#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

/** FrameController. Displays the locally served frame and retries failed page loads. */
@interface FrameController : UIViewController <WKNavigationDelegate>
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) NSURL *frameURL;
@end

@implementation FrameController
- (void)loadView {
    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.applicationNameForUserAgent = @"iFrame3Native";
    self.webView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
    self.webView.navigationDelegate = self;
    self.webView.opaque = NO;
    self.webView.backgroundColor = UIColor.blackColor;
    self.webView.scrollView.scrollEnabled = NO;
    self.view = self.webView;
    NSNumber *port = [NSBundle.mainBundle objectForInfoDictionaryKey:@"FrameServerPort"];
    self.frameURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://localhost:%@/", port]];
    [self openFrame];
}
- (BOOL)prefersStatusBarHidden { return YES; }
- (void)openFrame {
    [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(openFrame) object:nil];
    [self.webView loadRequest:[NSURLRequest requestWithURL:self.frameURL]];
}
- (void)retry {
    [NSObject cancelPreviousPerformRequestsWithTarget:self selector:@selector(openFrame) object:nil];
    [self performSelector:@selector(openFrame) withObject:nil afterDelay:3];
}
- (void)webView:(WKWebView *)view didFailProvisionalNavigation:(WKNavigation *)navigation
      withError:(NSError *)error {
    if (error.code != NSURLErrorCancelled) {
        NSLog(@"iFrame3 page load failed %@ %ld", error.domain, (long)error.code);
        [self retry];
    }
}
- (void)webView:(WKWebView *)view didFailNavigation:(WKNavigation *)navigation
      withError:(NSError *)error {
    if (error.code != NSURLErrorCancelled) [self retry];
}
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)webView { [self retry]; }
@end

/** FrameApp. Owns the fullscreen window and the foreground application's idle timer. */
@interface FrameApp : UIResponder <UIApplicationDelegate>
@property(nonatomic, strong) UIWindow *window;
@end

@implementation FrameApp
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.backgroundColor = UIColor.blackColor;
    self.window.rootViewController = [[FrameController alloc] init];
    [self.window makeKeyAndVisible];
    return YES;
}
- (void)applicationDidBecomeActive:(UIApplication *)app {
    app.idleTimerDisabled = YES;
    NSLog(@"iFrame3 active idleTimerDisabled=%d", app.idleTimerDisabled);
}
- (void)applicationWillResignActive:(UIApplication *)app {
    app.idleTimerDisabled = NO;
    NSLog(@"iFrame3 inactive idleTimerDisabled=%d", app.idleTimerDisabled);
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass(FrameApp.class));
    }
}
