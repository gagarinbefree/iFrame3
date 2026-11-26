#import <UIKit/UIKit.h>

/** FrameSlide. Holds a display-sized image and its cache destination until the first visible frame. */
@interface FrameSlide : NSObject
/** image. The decoded frame to present on screen. */
@property(nonatomic, strong) UIImage *image;
/** cacheFile. The local JPEG URL for this version of the source photo. */
@property(nonatomic, strong) NSURL *cacheFile;
/** fromCache. YES when the image was decoded from a saved JPEG. */
@property(nonatomic) BOOL fromCache;
@end

/** PhotoLibrary. Reads the configured share and serves saved frames on a serial background queue. */
@interface PhotoLibrary : NSObject
/**
 * initWithSettings:cacheDirectory:. Opens the cache for the configured SMB source.
 * @param settings Validated share, guest account, thumbnail size and cache settings.
 * @param directory Local directory for displayed photos.
 * @return A library ready to select its first frame.
 */
- (instancetype)initWithSettings:(NSDictionary *)settings cacheDirectory:(NSURL *)directory;
/**
 * nextSlide. Selects a random photo and uses a cached copy when available.
 * @return A display-sized slide from the share or cache, or nil when neither yields a readable image.
 */
- (FrameSlide *)nextSlide;
/**
 * saveDisplayed:. Saves a newly displayed frame as a JPEG.
 * @param slide The slide that reached the screen.
 * @return YES if the slide came from cache or its JPEG was written successfully.
 */
- (BOOL)saveDisplayed:(FrameSlide *)slide;
@end
