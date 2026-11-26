#import "PhotoLibrary.h"
#import "PhotoStore.h"
#import <ImageIO/ImageIO.h>
#include <fcntl.h>
#include <smb2/smb2.h>
#include <smb2/libsmb2.h>

@implementation FrameSlide
@end

@implementation PhotoLibrary {
    NSDictionary *_settings;
    PhotoStore *_store;
    struct smb2_context *_smb;
    NSMutableArray *_directories, *_deck, *_offline;
    NSDate *_retryAt;
    NSString *_lastPath, *_lastCacheName;
    BOOL _first;
}
- (instancetype)initWithSettings:(NSDictionary *)settings cacheDirectory:(NSURL *)directory {
    if ((self = [super init])) {
        _settings = settings;
        NSString *source = [NSString stringWithFormat:@"%@:%@/%@/%@", settings[@"host"], settings[@"smbPort"], settings[@"share"], settings[@"folder"] ?: @""];
        _store = [[PhotoStore alloc] initWithDirectory:directory source:source limit:[settings[@"cacheLimit"] integerValue]];
        _first = YES;
    }
    return self;
}
- (void)dealloc { if (_smb) smb2_destroy_context(_smb); }
- (void)disconnected {
    if (_smb) smb2_destroy_context(_smb);
    _smb = NULL;
    _directories = nil;
    _deck = nil;
    _retryAt = [NSDate dateWithTimeIntervalSinceNow:30];
    NSLog(@"iFrame3 Native share unavailable");
}
- (BOOL)connect {
    if (_smb) return YES;
    if (_retryAt.timeIntervalSinceNow > 0) return NO;
    _smb = smb2_init_context();
    if (!_smb) { [self disconnected]; return NO; }
    NSString *host = _settings[@"host"], *share = _settings[@"share"];
    if (!host.length || !share.length) { [self disconnected]; return NO; }
    if ([_settings[@"smbPort"] integerValue] != 445)
        host = [NSString stringWithFormat:@"%@:%@", host, _settings[@"smbPort"]];
    smb2_set_timeout(_smb, 5);
    smb2_set_version(_smb, SMB2_VERSION_ANY2);
    // NTLM folds account names to uppercase; libc's byte-wise toupper cannot fold Cyrillic.
    NSString *user = [_settings[@"user"] uppercaseString] ?: @"GUEST";
    smb2_set_user(_smb, user.UTF8String);
    smb2_set_password(_smb, "");
    smb2_set_domain(_smb, [_settings[@"domain"] UTF8String] ?: "");
    if (smb2_connect_share(_smb, host.UTF8String, share.UTF8String, user.UTF8String) < 0) {
        NSLog(@"iFrame3 Native SMB connect failed: %s", smb2_get_error(_smb));
        [self disconnected]; return NO;
    }
    NSLog(@"iFrame3 Native SMB connected");
    return YES;
}
- (BOOL)scanDirectory:(NSString *)path {
    struct smb2dir *dir = smb2_opendir(_smb, path.UTF8String);
    if (!dir) return NO;
    struct smb2dirent *entry;
    while ((entry = smb2_readdir(_smb, dir))) {
        @autoreleasepool {
            NSString *name = [NSString stringWithUTF8String:entry->name];
            if (!name.length || [name isEqual:@"."] || [name isEqual:@".."] ||
                [name containsString:@"/"] || [name containsString:@"\\"]) continue;
            NSString *child = path.length ? [path stringByAppendingPathComponent:name] : name;
            if (entry->st.smb2_type == SMB2_TYPE_DIRECTORY) [_directories addObject:child];
            else if (entry->st.smb2_type == SMB2_TYPE_FILE &&
                     [@[@"jpeg", @"jpg", @"png", @"gif"] containsObject:name.pathExtension.lowercaseString]) {
                NSString *version = [NSString stringWithFormat:@"%llu-%llu-%llu-%@x%@",entry->st.smb2_size,
                    entry->st.smb2_mtime,entry->st.smb2_mtime_nsec,_settings[@"maxPhotoWidth"],_settings[@"maxPhotoHeight"]];
                [_deck addObject:@{@"path": child, @"version": version, @"bytes": @(entry->st.smb2_size)}];
            }
        }
    }
    smb2_closedir(_smb, dir);
    return YES;
}
- (UIImage *)download:(NSDictionary *)photo {
    struct smb2fh *handle = smb2_open(_smb, [photo[@"path"] UTF8String], O_RDONLY);
    if (!handle) { [self disconnected]; return nil; }
    NSURL *temp = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString]];
    FILE *file = fopen(temp.fileSystemRepresentation, "wb");
    int n = -1;
    uint64_t total = 0;
    if (file) {
        uint8_t buffer[32768];
        uint32_t chunk = MIN((uint32_t)sizeof(buffer), smb2_get_max_read_size(_smb));
        while (chunk && (n = smb2_read(_smb, handle, buffer, chunk)) > 0) {
            if (fwrite(buffer, 1, n, file) != (size_t)n) { n = -1; break; }
            total += n;
        }
        if (fclose(file) != 0) n = -1;
    }
    smb2_close(_smb, handle);
    if (n < 0) [self disconnected];
    UIImage *image = nil;
    if (n == 0 && total && total == [photo[@"bytes"] unsignedLongLongValue]) {
        CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)temp, NULL);
        if (source) {
            NSDictionary *info = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, NULL));
            double w = [info[(id)kCGImagePropertyPixelWidth] doubleValue], h = [info[(id)kCGImagePropertyPixelHeight] doubleValue];
            if (w > 0 && h > 0) {
                double longest = MAX(w,h), shortest = MIN(w,h);
                double scale = MIN(1.,MIN([_settings[@"maxPhotoWidth"] doubleValue]/longest, [_settings[@"maxPhotoHeight"] doubleValue]/shortest));
                NSDictionary *options = @{(id)kCGImageSourceCreateThumbnailFromImageAlways:@YES,
                    (id)kCGImageSourceCreateThumbnailWithTransform:@YES,
                    (id)kCGImageSourceThumbnailMaxPixelSize:@(MAX(1.,floor(longest*scale)))};
                CGImageRef thumb = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options);
                if (thumb) { image = [UIImage imageWithCGImage:thumb]; CGImageRelease(thumb); }
            }
            CFRelease(source);
        }
    }
    [[NSFileManager defaultManager] removeItemAtURL:temp error:nil];
    return image;
}
- (FrameSlide *)cached:(NSURL *)file {
    UIImage *image = [UIImage imageWithContentsOfFile:file.path];
    if (!image) return nil;
    FrameSlide *slide = [FrameSlide new];
    slide.image = image;
    slide.fromCache = YES;
    slide.cacheFile = file;
    return slide;
}
- (FrameSlide *)offlineSlide {
    if (!_offline.count) _offline = [_store.files mutableCopy];
    while (_offline.count) {
        NSUInteger i = arc4random_uniform((uint32_t)_offline.count);
        if (_offline.count > 1 && [[_offline[i] lastPathComponent] isEqual:_lastCacheName])
            i = (i+1)%_offline.count;
        NSURL *file = _offline[i];
        [_offline removeObjectAtIndex:i];
        FrameSlide *slide = [self cached:file];
        if (slide) { _lastCacheName = file.lastPathComponent; return slide; }
    }
    return nil;
}
- (FrameSlide *)nextSlide {
    if (_first) {
        _first = NO;
        FrameSlide *immediate = [self offlineSlide];
        if (immediate) return immediate;
    }
    if (![self connect]) return [self offlineSlide];
    if (!_directories.count && !_deck.count) {
        _directories = [NSMutableArray arrayWithObject:_settings[@"folder"] ?: @""];
        _deck = [NSMutableArray array];
    }
    // Discover a bounded batch each turn so large directory trees do not delay the first frame.
    for (int i=0; i<4 && _directories.count; i++) {
        NSString *dir = _directories.lastObject;
        [_directories removeLastObject];
        if (![self scanDirectory:dir]) { [self disconnected]; return [self offlineSlide]; }
        if (_deck.count && !_lastPath) break;
    }
    if (!_deck.count) return [self offlineSlide];
    NSUInteger i = arc4random_uniform((uint32_t)_deck.count);
    if (_deck.count > 1 && [_deck[i][@"path"] isEqual:_lastPath]) i = (i+1)%_deck.count;
    NSDictionary *photo = _deck[i];
    [_deck removeObjectAtIndex:i];
    _lastPath = photo[@"path"];
    NSURL *file = [_store fileForPath:_lastPath version:photo[@"version"]];
    FrameSlide *existing = [self cached:file];
    if (existing) return existing;
    UIImage *image = [self download:photo];
    if (!image) return [self offlineSlide];
    FrameSlide *slide = [FrameSlide new];
    slide.image = image;
    slide.cacheFile = file;
    return slide;
}
- (BOOL)saveDisplayed:(FrameSlide *)slide {
    if (slide.fromCache) return YES;
    return [_store save:UIImageJPEGRepresentation(slide.image, 0.82) to:slide.cacheFile];
}
@end
