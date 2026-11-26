#import <UIKit/UIKit.h>

/** FrameSlide. Holds a display-sized image and its cache destination until the first visible frame. */
@interface FrameSlide : NSObject
@property(nonatomic, strong) UIImage *image;
@property(nonatomic, strong) NSURL *cacheFile;
@property(nonatomic) BOOL fromCache;
@end

/** PhotoLibrary. Reads the configured share and serves saved frames on a serial background queue. */
@interface PhotoLibrary : NSObject
- (instancetype)initWithSettings:(NSDictionary *)settings cacheDirectory:(NSURL *)directory;
- (FrameSlide *)nextSlide;
- (BOOL)saveDisplayed:(FrameSlide *)slide;
@end
