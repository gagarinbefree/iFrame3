#import <UIKit/UIKit.h>
#import <QuartzCore/QuartzCore.h>
#import "PhotoLibrary.h"

static NSString *const folder = @"/var/mobile/Media/iFrame3Native";

/**
 * record. Writes a timestamped event to the device log and rotates the previous log.
 * @param message Slideshow or cache event to record.
 */
static void record(NSString *message) {
    NSLog(@"iFrame3 Native %@", message);
    @synchronized (folder) {
        NSString *path = [folder stringByAppendingPathComponent:@"frame.log"];
        NSFileManager *manager = NSFileManager.defaultManager;
        if ([manager attributesOfItemAtPath:path error:nil].fileSize > 65536) {
            NSString *previous = [folder stringByAppendingPathComponent:@"frame.previous.log"];
            [manager removeItemAtPath:previous error:nil];
            [manager moveItemAtPath:path toPath:previous error:nil];
        }
        if (![manager fileExistsAtPath:path]) [manager createFileAtPath:path contents:nil attributes:nil];
        NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:path];
        [handle seekToEndOfFile];
        [handle writeData:[[NSString stringWithFormat:@"%@ %@\n", NSDate.date, message] dataUsingEncoding:NSUTF8StringEncoding]];
        [handle closeFile];
    }
}

/**
 * settings. Reads and validates the device configuration before starting the slideshow.
 * @return The settings dictionary, or nil if the file is missing or its values are invalid.
 */
static NSDictionary *settings(void) {
    NSData *data = [NSData dataWithContentsOfFile:[folder stringByAppendingPathComponent:@"settings.json"]];
    NSDictionary *json = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    if (![json isKindOfClass:NSDictionary.class]) return nil;
    for (NSString *key in @[@"host", @"share", @"domain", @"user", @"folder"])
        if (![json[key] isKindOfClass:NSString.class]) return nil;
    for (NSString *key in @[@"cacheLimit",@"maxPhotoWidth",@"maxPhotoHeight",@"slideshowIntervalSeconds",@"smbPort"])
        if (![json[key] isKindOfClass:NSNumber.class] || [json[key] integerValue] < 1) return nil;
    if ([json[@"cacheLimit"] integerValue] > 500 || [json[@"smbPort"] integerValue] > 65535) return nil;
    return json;
}

/** FrameController. Presents one image at a time and saves a new frame after display refresh. */
@interface FrameController : UIViewController
/** start. Loads the current settings and begins selecting slides on the worker queue. */
- (void)start;
/** stop. Cancels pending presentation and releases the library on its worker queue. */
- (void)stop;
@end
@implementation FrameController {
    UIImageView *_photo;
    PhotoLibrary *_library;
    dispatch_queue_t _worker;
    NSTimeInterval _interval;
    NSUInteger _generation, _ticks;
    BOOL _active;
    CADisplayLink *_displayLink;
    FrameSlide *_pending;
}
/** loadView. Creates the full-screen image view with the launch artwork as its first image. */
- (void)loadView {
    _photo = [[UIImageView alloc] initWithFrame:CGRectZero];
    _photo.backgroundColor = UIColor.blackColor;
    _photo.contentMode = UIViewContentModeCenter;
    _photo.image = [UIImage imageNamed:@"FrameMark"];
    self.view = _photo;
    _worker = dispatch_queue_create("iframe3.native.photos", DISPATCH_QUEUE_SERIAL);
}
/**
 * prefersStatusBarHidden. Requests an unobstructed photo view.
 * @return YES throughout the slideshow.
 */
- (BOOL)prefersStatusBarHidden { return YES; }
- (void)start {
    if (_active) return;
    [self loadViewIfNeeded];
    _active = YES;
    NSDictionary *config = settings();
    if (!config) { record(@"invalid settings.json"); return; }
    _interval = [config[@"slideshowIntervalSeconds"] doubleValue];
    NSURL *base = [NSFileManager.defaultManager URLsForDirectory:NSApplicationSupportDirectory inDomains:NSUserDomainMask].firstObject;
    NSURL *cache = [base URLByAppendingPathComponent:@"iFrame3Native/Photos" isDirectory:YES];
    dispatch_async(_worker, ^{
        self->_library = [[PhotoLibrary alloc] initWithSettings:config cacheDirectory:cache];
    });
    [self next];
}
- (void)stop {
    _active = NO;
    ++_generation;
    [NSObject cancelPreviousPerformRequestsWithTarget:self];
    [_displayLink invalidate]; _displayLink = nil;
    _pending = nil;
    if (_worker) dispatch_async(_worker, ^{ self->_library = nil; });
}
/** next. Loads a slide off the main thread and presents it only if the same session is still active. */
- (void)next {
    if (!_active) return;
    NSUInteger token = _generation;
    dispatch_async(_worker, ^{
        @autoreleasepool {
            FrameSlide *slide = [self->_library nextSlide];
            dispatch_async(dispatch_get_main_queue(), ^{
                if (!self->_active || self->_generation != token) return;
                if (!slide.image) {
                    [self performSelector:@selector(next) withObject:nil afterDelay:1];
                    return;
                }
                self->_photo.contentMode = UIViewContentModeScaleAspectFit;
                self->_photo.image = slide.image;
                self->_pending = slide;
                self->_ticks = 0;
                self->_displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(displayed:)];
                [self->_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
            });
        }
    });
}
/**
 * displayed:. Waits for two display ticks before caching the image and scheduling the next slide.
 * @param link Display link observing the pending slide.
 */
- (void)displayed:(CADisplayLink *)link {
    if (++_ticks < 2) return;
    [link invalidate]; _displayLink = nil;
    FrameSlide *slide = _pending;
    _pending = nil;
    record(slide.fromCache ? @"displayed cache" : @"displayed share");
    if (!slide.fromCache) dispatch_async(_worker, ^{
        @autoreleasepool { record([self->_library saveDisplayed:slide] ? @"cached" : @"cache write failed"); }
    });
    [self performSelector:@selector(next) withObject:nil afterDelay:_interval];
}
@end

/** FrameApp. Owns the slideshow window and responds to application lifecycle events. */
@interface FrameApp : UIResponder <UIApplicationDelegate>
@property(nonatomic,strong) UIWindow *window;
@property(nonatomic,strong) FrameController *frame;
@end
@implementation FrameApp
/**
 * application:didFinishLaunchingWithOptions:. Creates the window and installs the frame controller.
 * @param app Application receiving the launch event.
 * @param options Launch context supplied by UIKit, if any.
 * @return YES after the window has been made visible.
 */
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.frame = [FrameController new];
    self.window.rootViewController = self.frame;
    [self.window makeKeyAndVisible];
    return YES;
}
/**
 * applicationDidBecomeActive:. Starts the slideshow and keeps the screen awake.
 * @param app Application entering the active state.
 */
- (void)applicationDidBecomeActive:(UIApplication *)app { app.idleTimerDisabled = YES; [self.frame start]; }
/**
 * applicationWillResignActive:. Stops presentation and restores the system idle timer.
 * @param app Application leaving the active state.
 */
- (void)applicationWillResignActive:(UIApplication *)app { app.idleTimerDisabled = NO; [self.frame stop]; }
@end

/**
 * main. Starts the UIKit event loop with FrameApp as its delegate.
 * @param argc Number of process arguments.
 * @param argv Process argument strings.
 * @return The exit status reported by UIApplicationMain if it returns.
 */
int main(int argc, char **argv) {
    @autoreleasepool { return UIApplicationMain(argc, argv, nil, NSStringFromClass(FrameApp.class)); }
}
