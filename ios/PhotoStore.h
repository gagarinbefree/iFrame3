#import <Foundation/Foundation.h>

/** PhotoStore. Stores displayed JPEG copies under source-, path- and version-specific keys. */
@interface PhotoStore : NSObject
/**
 * initWithDirectory:source:limit:. Opens the cache and applies its size limit.
 * @param directory Local directory shared by the photo caches.
 * @param source Identifier for the SMB host, port, share and folder.
 * @param limit Maximum number of JPEGs across sources, with a minimum of one.
 * @return A store scoped to the selected source.
 */
- (instancetype)initWithDirectory:(NSURL *)directory source:(NSString *)source limit:(NSUInteger)limit;
/**
 * fileForPath:version:. Computes the cache URL for one version of a photo.
 * @param path File path relative to the SMB share.
 * @param version Key derived from file metadata and the requested thumbnail dimensions.
 * @return A local file URL that can be used before the JPEG exists.
 */
- (NSURL *)fileForPath:(NSString *)path version:(NSString *)version;
/**
 * files. Lists saved JPEGs belonging to this source.
 * @return Local file URLs in directory enumeration order, or an empty array.
 */
- (NSArray<NSURL *> *)files;
/**
 * save:to:. Writes a JPEG atomically, removes older versions and trims the cache.
 * @param jpeg Encoded JPEG bytes for a displayed frame.
 * @param file Cache URL produced by fileForPath:version:.
 * @return YES if the JPEG write succeeded.
 */
- (BOOL)save:(NSData *)jpeg to:(NSURL *)file;
@end
