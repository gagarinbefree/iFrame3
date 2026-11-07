/** Photo. Describes an indexed photo and its source folder. */
export interface Photo {
  /** Original photo file name. */
  name: string;
  /** Relative path of the parent folder. */
  folder: string;
  /** URL used to load and cache the photo. */
  url: string;
  /** Source and resizing version used for cache refresh. */
  version?: string;
}

/** Slideshow. Provides photo navigation. */
export class Slideshow {
  /**
   * nextPhotoIndex. Advances through a circular photo list.
   * @param index - Current photo index.
   * @param count - Number of photos.
   * @returns The next index, or zero for an empty list.
   */
  public static nextPhotoIndex(index: number, count: number): number {
    return count > 0 ? (index + 1) % count : 0;
  }
}
