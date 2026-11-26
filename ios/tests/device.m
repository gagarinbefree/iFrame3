#import "../PhotoLibrary.h"

/** OfflineLibrary. Runs the real fallback path with the share disconnected. */
@interface OfflineLibrary : PhotoLibrary
@end
@implementation OfflineLibrary
- (BOOL)connect { return NO; }
@end

int main(int argc, char **argv) {
    @autoreleasepool {
        if (argc != 2) return 2;
        NSData *json = [NSData dataWithContentsOfFile:[NSString stringWithUTF8String:argv[1]]];
        NSDictionary *settings = json ? [NSJSONSerialization JSONObjectWithData:json options:0 error:nil] : nil;
        if (!settings) return 3;
        NSURL *dir = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString]];
        PhotoLibrary *library = [[PhotoLibrary alloc] initWithSettings:settings cacheDirectory:dir];
        FrameSlide *slide = nil;
        for (int i=0; i<25 && !slide; i++) slide = [library nextSlide];
        if (!slide || slide.fromCache || [slide.cacheFile checkResourceIsReachableAndReturnError:nil]) return 4;
        printf("SMB thumbnail %.0fx%.0f, cache initially empty\n",slide.image.size.width,slide.image.size.height);
        if (![library saveDisplayed:slide]) return 5;
        library = nil;
        OfflineLibrary *offline = [[OfflineLibrary alloc] initWithSettings:settings cacheDirectory:dir];
        if (![offline nextSlide].fromCache || ![offline nextSlide].fromCache) return 6;
        puts("Reopened JPEG and displayed-source lookup succeeded offline");
        [NSFileManager.defaultManager removeItemAtURL:dir error:nil];
    }
    return 0;
}
