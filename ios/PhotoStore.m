#import "PhotoStore.h"
#import <CommonCrypto/CommonDigest.h>

static NSString *digest(NSString *value) {
    NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
    unsigned char hash[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(data.bytes, (CC_LONG)data.length, hash);
    NSMutableString *text = [NSMutableString string];
    for (NSUInteger i = 0; i < sizeof(hash); i++) [text appendFormat:@"%02x", hash[i]];
    return text;
}

@implementation PhotoStore {
    NSURL *_directory;
    NSString *_prefix;
    NSUInteger _limit;
}
- (instancetype)initWithDirectory:(NSURL *)directory source:(NSString *)source limit:(NSUInteger)limit {
    if ((self = [super init])) {
        _directory = directory;
        _prefix = [digest(source) stringByAppendingString:@"."];
        _limit = MAX(limit, 1);
        [[NSFileManager defaultManager] createDirectoryAtURL:directory withIntermediateDirectories:YES attributes:nil error:nil];
        [self trim];
    }
    return self;
}
- (NSURL *)fileForPath:(NSString *)path version:(NSString *)version {
    NSString *name = [NSString stringWithFormat:@"%@%@.%@.jpg", _prefix, digest(path), digest(version)];
    return [_directory URLByAppendingPathComponent:name];
}
- (NSArray *)allJPEGs {
    NSArray *urls = [[NSFileManager defaultManager] contentsOfDirectoryAtURL:_directory
                        includingPropertiesForKeys:@[NSURLContentModificationDateKey] options:NSDirectoryEnumerationSkipsHiddenFiles error:nil];
    NSMutableArray *result = [NSMutableArray array];
    for (NSURL *url in urls) if ([url.pathExtension isEqual:@"jpg"]) [result addObject:url];
    return result;
}
- (NSArray *)files {
    NSMutableArray *result = [NSMutableArray array];
    for (NSURL *url in [self allJPEGs]) if ([url.lastPathComponent hasPrefix:_prefix]) [result addObject:url];
    return result;
}
- (void)trim {
    NSArray *files = [self allJPEGs];
    if (files.count <= _limit) return;
    NSArray *sorted = [files sortedArrayUsingComparator:^NSComparisonResult(NSURL *a, NSURL *b) {
        NSDate *left = nil, *right = nil;
        [a getResourceValue:&left forKey:NSURLContentModificationDateKey error:nil];
        [b getResourceValue:&right forKey:NSURLContentModificationDateKey error:nil];
        return [left compare:right];
    }];
    for (NSUInteger i = 0; i < sorted.count - _limit; i++)
        [[NSFileManager defaultManager] removeItemAtURL:sorted[i] error:nil];
}
- (BOOL)save:(NSData *)jpeg to:(NSURL *)file {
    if (!jpeg.length || ![jpeg writeToURL:file options:NSDataWritingAtomic error:nil]) return NO;
    NSString *pathPrefix = [[[file.lastPathComponent stringByDeletingPathExtension] stringByDeletingPathExtension] stringByAppendingString:@"."];
    for (NSURL *old in [self files]) {
        if (![old.lastPathComponent isEqual:file.lastPathComponent] && [old.lastPathComponent hasPrefix:pathPrefix])
            [[NSFileManager defaultManager] removeItemAtURL:old error:nil];
    }
    [self trim];
    return YES;
}
@end
