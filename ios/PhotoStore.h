#import <Foundation/Foundation.h>

/** PhotoStore. Stores displayed JPEG copies under source-, path- and version-specific keys. */
@interface PhotoStore : NSObject
- (instancetype)initWithDirectory:(NSURL *)directory source:(NSString *)source limit:(NSUInteger)limit;
- (NSURL *)fileForPath:(NSString *)path version:(NSString *)version;
- (NSArray<NSURL *> *)files;
- (BOOL)save:(NSData *)jpeg to:(NSURL *)file;
@end
