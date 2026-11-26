import type { Photo } from './slideshow';

/**
 * Callback. Receives the result of an asynchronous cache operation.
 * @template T - Result value type.
 * @param error - Error when the operation fails, otherwise null.
 * @param value - Optional result value.
 */
type Callback<T> = (error: Error | null, value?: T) => void;
/** CacheEntry. Describes stored photo metadata and insertion order. */
interface CacheEntry {
  /** Source URL used as the cache key. */
  url: string;
  /** Original photo file name. */
  name: string;
  /** Relative path of the parent folder. */
  folder: string;
  /** Source and resizing version. */
  version?: string;
  /** Ordering value used when evicting old photos. */
  savedAt: number;
}

/** PhotoDimensions. Computes display-sized photo dimensions. */
export class PhotoDimensions {
  /**
   * fit. Fits a photo within the configured bounds without enlarging it.
   * @param width - Original width in pixels.
   * @param height - Original height in pixels.
   * @param maxLandscapeWidth - Configured width limit for a landscape photo.
   * @param maxLandscapeHeight - Configured height limit for a landscape photo.
   * @returns Dimensions for the resized photo.
   */
  public static fit(
    width: number,
    height: number,
    maxLandscapeWidth: number,
    maxLandscapeHeight: number,
  ): { width: number; height: number } {
    const maxWidth = width >= height ? maxLandscapeWidth : maxLandscapeHeight;
    const maxHeight = width >= height ? maxLandscapeHeight : maxLandscapeWidth;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }
}

/** PhotoCache. Provides asynchronous access to stored photographs and metadata. */
export class PhotoCache {
  private readonly db: IDBDatabase;
  private maxPhotos: number;
  // Photo keys are strings. The numeric key holds only the ordered directory.
  private static readonly directoryKey = 0;

  /**
   * constructor. Creates a cache over an open database.
   * @param db - Open IndexedDB database.
   * @param maxPhotos - Maximum number of cached photos.
   */
  private constructor(db: IDBDatabase, maxPhotos: number) {
    this.db = db;
    this.maxPhotos = maxPhotos;
  }

  /**
   * open. Opens persistent image and metadata stores.
   * @param factory - IndexedDB factory supplied by the browser.
   * @param done - Receives the opened cache or an error.
   * @param maxPhotos - Maximum number of cached photos.
   */
  public static open(factory: IDBFactory, done: Callback<PhotoCache>, maxPhotos = 50): void {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open('iframe3-photos', 2);
    } catch (_) {
      done(new Error('Хранилище фотографий недоступно.'));
      return;
    }
    request.onupgradeneeded = (event): void => {
      const db = request.result;
      if (event.oldVersion === 0) {
        db.createObjectStore('images', { keyPath: 'url' });
        return;
      }
      const transaction = request.transaction!;
      const images = transaction.objectStore('images');
      const entries: CacheEntry[] = [];
      const cursor = transaction.objectStore('index').openCursor();
      cursor.onsuccess = (): void => {
        const item = cursor.result;
        if (item) {
          entries.push(item.value as CacheEntry);
          item.continue();
          return;
        }
        entries.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
        const photos = entries.map((entry): Photo => {
          const photo: Photo = { url: entry.url, name: entry.name, folder: entry.folder };
          if (entry.version !== undefined) photo.version = entry.version;
          return photo;
        });
        images.put({ url: PhotoCache.directoryKey, photos });
        db.deleteObjectStore('index');
      };
    };
    request.onerror = (): void => {
      done(new Error('Не удалось открыть кэш фотографий.'));
    };
    request.onsuccess = (): void => {
      const db = request.result;
      db.onversionchange = (): void => {
        db.close();
      };
      done(null, new PhotoCache(db, maxPhotos));
    };
  }

  /**
   * get. Reads a cached image.
   * @param url - Source URL used as the cache key.
   * @param done - Receives the image data or an error.
   */
  public get(url: string, done: Callback<string | null>): void {
    try {
      const get = this.db.transaction('images', 'readonly').objectStore('images').get(url);
      get.onsuccess = (): void => {
        done(null, get.result ? get.result.data : null);
      };
      get.onerror = (): void => {
        done(new Error('Не удалось прочитать кэш.'));
      };
    } catch (_) {
      done(new Error('Не удалось прочитать кэш.'));
    }
  }

  /**
   * list. Reads cached photo metadata.
   * @param done - Receives the metadata list or an error.
   */
  public list(done: Callback<Photo[]>): void {
    try {
      const request = this.db
        .transaction('images', 'readonly')
        .objectStore('images')
        .get(PhotoCache.directoryKey);
      request.onsuccess = (): void => done(null, request.result ? request.result.photos : []);
      request.onerror = (): void => done(new Error('Не удалось прочитать список кэша.'));
    } catch (_) {
      done(new Error('Не удалось прочитать список кэша.'));
    }
  }

  /**
   * setLimit. Updates the limit and removes excess cached photos.
   * @param limit - Maximum number of photos.
   * @param done - Receives the completion result.
   */
  public setLimit(limit: number, done: Callback<void>): void {
    this.maxPhotos = Math.max(1, Math.floor(limit));
    this.updateDirectory(done);
  }

  /**
   * put. Saves a photo and evicts older entries if necessary.
   * @param photo - Metadata and cache key.
   * @param data - Resized image as a data URL.
   * @param done - Receives the completion result.
   */
  public put(photo: Photo, data: string, done: Callback<void>): void {
    this.updateDirectory(done, { photo, data });
  }

  /**
   * updateDirectory. Commits the photo, directory and evictions in one single-store transaction.
   * @param done - Receives the transaction result.
   * @param addition - Optional newly displayed photo and its encoded image.
   */
  private updateDirectory(done: Callback<void>, addition?: { photo: Photo; data: string }): void {
    try {
      const transaction = this.db.transaction('images', 'readwrite');
      const store = transaction.objectStore('images');
      const directory = store.get(PhotoCache.directoryKey);
      directory.onsuccess = (): void => {
        let photos: Photo[] = directory.result ? directory.result.photos : [];
        if (addition) {
          const { photo, data } = addition;
          photos = photos.filter((entry) => entry.url !== photo.url);
          photos.push(photo);
          store.put({ url: photo.url, data });
        } else if (photos.length <= this.maxPhotos) {
          return;
        }
        const removed = photos.splice(0, Math.max(0, photos.length - this.maxPhotos));
        for (const photo of removed) store.delete(photo.url);
        store.put({ url: PhotoCache.directoryKey, photos });
      };
      transaction.oncomplete = (): void => done(null);
      transaction.onabort = (): void => done(new Error('Не удалось обновить кэш фотографий.'));
    } catch (_) {
      done(new Error('Не удалось обновить кэш фотографий.'));
    }
  }
}
