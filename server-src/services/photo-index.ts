import * as fs from 'node:fs';
import * as path from 'node:path';

/** IndexedPhoto. Describes a file published by the local photo index. */
export interface IndexedPhoto {
  /** Original photo file name. */
  name: string;
  /** File version used for cache refresh. */
  version: string;
  /** Relative path of the parent folder. */
  folder: string;
  /** URL used to load the photo. */
  url: string;
}

/** PhotoIndex. Scans photo directories and writes a static index. */
export class PhotoIndex {
  /**
   * scanPhotos. Collects photos without following symbolic links.
   * @param root - Photo directory.
   * @param source - Optional source identifier for cache isolation.
   * @returns Photo metadata and URLs.
   */
  public static scanPhotos(root: string, source?: string): IndexedPhoto[] {
    const result: IndexedPhoto[] = [];
    PhotoIndex.visit(root, [], source, result);
    return result;
  }

  /**
   * visit. Walks a directory without following symbolic links.
   * @param current - Directory being scanned.
   * @param parts - Relative path components.
   * @param source - Optional source identifier for cache isolation.
   * @param result - Array to receive indexed photos.
   */
  private static visit(
    current: string,
    parts: string[],
    source: string | undefined,
    result: IndexedPhoto[],
  ): void {
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const next = parts.concat(entry.name);
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) PhotoIndex.visit(file, next, source, result);
      else if (entry.isFile() && /\.(jpe?g|png|gif)$/i.test(entry.name)) {
        const stat = fs.statSync(file);
        result.push({
          name: entry.name,
          version: String(stat.size) + ':' + String(stat.mtimeMs),
          folder: parts.join('/'),
          url:
            '/photos/' +
            next.map(encodeURIComponent).join('/') +
            (source ? '?source=' + encodeURIComponent(source) : ''),
        });
      }
    }
  }

  /**
   * writePhotoIndex. Writes an index and distinguishes an unavailable source from an empty one.
   * @param root - Photo directory, or null when not configured.
   * @param file - Destination index file.
   * @param source - Optional source identifier for cache isolation.
   * @returns Whether the photo directory was scanned successfully.
   */
  public static writePhotoIndex(root: string | null, file: string, source?: string): boolean {
    let data: IndexedPhoto[] | { available: false };
    let available = false;
    try {
      if (!root) throw new Error('No photo folder');
      data = PhotoIndex.scanPhotos(root, source);
      available = true;
    } catch (_) {
      data = { available: false };
    }
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, file);
    return available;
  }
}
