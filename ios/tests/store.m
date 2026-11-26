#import "../PhotoStore.h"

int main(void) {
    @autoreleasepool {
        NSURL *root = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString]];
        PhotoStore *store = [[PhotoStore alloc] initWithDirectory:root source:@"one" limit:2];
        NSURL *one = [store fileForPath:@"folder/a.jpg" version:@"v1"];
        NSData *sample = [@"thumbnail" dataUsingEncoding:NSUTF8StringEncoding];
        NSCAssert(store.files.count == 0, @"Looking up a photo must not cache it");
        NSCAssert([store save:sample to:one], @"Initial save");
        NSURL *newer = [store fileForPath:@"folder/a.jpg" version:@"v2"];
        NSCAssert([store save:sample to:newer] && store.files.count == 1, @"Replace changed photo");
        NSCAssert(![one checkResourceIsReachableAndReturnError:nil], @"Remove superseded version");
        [store save:sample to:[store fileForPath:@"b.jpg" version:@"1"]];
        [store save:sample to:[store fileForPath:@"c.jpg" version:@"1"]];
        PhotoStore *reopened = [[PhotoStore alloc] initWithDirectory:root source:@"one" limit:1];
        NSCAssert(reopened.files.count == 1 && [[NSData dataWithContentsOfURL:reopened.files.firstObject] isEqual:sample], @"Reopen and enforce reduced limit");
        PhotoStore *other = [[PhotoStore alloc] initWithDirectory:root source:@"two" limit:2];
        NSCAssert(!other.files.count, @"Keep different sources separate");
        [[NSFileManager defaultManager] removeItemAtURL:root error:nil];
    }
    return 0;
}
