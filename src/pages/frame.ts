import { Photo, Slideshow } from '../services/slideshow';
import { PhotoCache, PhotoDimensions } from '../services/photo-cache';
import { ClientSettings, ClientSettingsStore } from '../store/settings';

/** FramePage. Manages the photo frame, source availability and offline cache. */
export class FramePage {
  private readonly frame = document.getElementById('frame') as HTMLElement;
  private readonly image = document.getElementById('photo') as HTMLImageElement;
  private readonly settingsStore: ClientSettingsStore;
  private appSettings: ClientSettings;
  private photos: Photo[] = [];
  private cached: Photo[] = [];
  private cache: PhotoCache | null = null;
  private sourceAvailable = false;
  private index = 0;
  private timer = 0;
  private failures = 0;
  private showSequence = 0;
  private indexSignature = '';
  private queue: Photo[] = [];
  private caching = false;
  private storageError = false;
  private checking = false;
  private started = false;

  /** constructor. Creates a frame and restores the last settings. */
  public constructor() {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch (_) {
      /* Storage can be unavailable. */
    }
    this.settingsStore = new ClientSettingsStore(storage);
    this.appSettings = this.settingsStore.read();
  }

  /** start. Begins loading settings and photographs. */
  public start(): void {
    this.image.onload = (): void => {
      this.failures = 0;
      this.frame.style.backgroundImage = 'url(' + JSON.stringify(this.image.src) + ')';
      this.schedule();
    };
    this.image.onerror = (): void => {
      this.missingPhoto();
    };
    window.addEventListener('offline', (): void => {
      this.showCached();
    });
    window.addEventListener('online', (): void => {
      this.refreshIndex();
    });
    window.setInterval((): void => {
      this.refreshIndex();
    }, 30000);
    this.loadSettings();
  }

  /**
   * refreshCached. Reloads cached metadata without reading image data.
   * @param done - Optional callback invoked after the metadata is read.
   */
  private refreshCached(done?: () => void): void {
    if (!this.cache) {
      if (done) done();
      return;
    }
    this.cache.list((error, items): void => {
      if (error || !items) {
        this.storageError = true;
        if (done) done();
        return;
      }
      this.cached = items;
      if (done) done();
    });
  }

  /**
   * isCached. Checks whether the current file version is already stored.
   * @param photo - Photo to look up.
   * @returns Whether the matching version is cached.
   */
  private isCached(photo: Photo): boolean {
    for (let i = 0; i < this.cached.length; i++)
      if (this.cached[i].url === photo.url && this.cached[i].version === photo.version) return true;
    return false;
  }

  /**
   * enqueue. Adds a photo to the background cache queue.
   * @param photo - Photo to cache.
   */
  private enqueue(photo: Photo): void {
    if (!this.cache || !this.sourceAvailable || this.storageError || this.isCached(photo)) return;
    for (let i = 0; i < this.queue.length; i++) if (this.queue[i].url === photo.url) return;
    this.queue.push(photo);
    this.processQueue();
  }

  /** processQueue. Downloads and resizes queued photos one at a time. */
  private processQueue(): void {
    if (
      this.caching ||
      !this.cache ||
      !this.sourceAvailable ||
      this.storageError ||
      !this.queue.length
    )
      return;
    const photo = this.queue.shift() as Photo;
    if (this.isCached(photo)) {
      this.processQueue();
      return;
    }
    this.caching = true;
    const loader = new Image();
    let finished = false;
    const deadline = window.setTimeout((): void => {
      finish();
    }, 20000);
    /** finish. Releases the active image load before starting the next queued item. */
    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.clearTimeout(deadline);
      loader.onload = null;
      loader.onerror = null;
      this.caching = false;
      this.processQueue();
    };
    loader.onerror = (): void => {
      finish();
    };
    loader.onload = (): void => {
      if (!this.sourceAvailable || !this.cache || finished) {
        finish();
        return;
      }
      try {
        const dimensions = PhotoDimensions.fit(
          loader.naturalWidth || loader.width,
          loader.naturalHeight || loader.height,
          this.appSettings.maxPhotoWidth,
          this.appSettings.maxPhotoHeight,
        );
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(loader, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.82);
        if (data.indexOf('data:image/') !== 0 || data.length < 100)
          throw new Error('Image encoding failed');
        this.cache.put(photo, data, (error): void => {
          if (error) {
            this.storageError = true;
            finish();
            return;
          }
          this.refreshCached(finish);
        });
      } catch (_) {
        finish();
      }
    };
    loader.src = photo.url;
  }

  /** queuePhotos. Adds photos from the entire source to the background cache queue. */
  private queuePhotos(): void {
    this.queue = [];
    for (let i = 0; i < this.photos.length && i < this.appSettings.cacheLimit; i++)
      this.enqueue(this.photos[i]);
  }

  /** schedule. Schedules the next slide at the configured interval. */
  private schedule(): void {
    window.clearTimeout(this.timer);
    if (this.photos.length > 1)
      this.timer = window.setTimeout((): void => {
        this.advance();
      }, this.appSettings.slideshowIntervalSeconds * 1000);
  }

  /** show. Displays the selected photo, preferring its cached copy. */
  private show(): void {
    window.clearTimeout(this.timer);
    const sequence = ++this.showSequence;
    if (!this.photos.length) {
      this.image.removeAttribute('src');
      this.frame.style.backgroundImage = '';
      return;
    }
    const photo = this.photos[this.index];
    this.image.alt = photo.name;
    /**
     * display. Applies a cache result only if the requested slide is still current.
     * @param data - Cached image data, or null when unavailable.
     */
    const display = (data: string | null): void => {
      if (sequence !== this.showSequence) return;
      if (data) this.image.src = data;
      else if (this.sourceAvailable) {
        this.image.src = photo.url;
        this.enqueue(photo);
      } else this.missingPhoto();
    };
    if (this.cache)
      this.cache.get(photo.url, (error, data): void => {
        display(error ? null : data || null);
      });
    else display(null);
  }

  /** missingPhoto. Skips failed images and retries the source index when needed. */
  private missingPhoto(): void {
    this.failures++;
    if (this.failures < this.photos.length) {
      this.advance();
      return;
    }
    if (this.sourceAvailable) this.refreshIndex();
  }

  /** advance. Selects and displays the next photo. */
  private advance(): void {
    this.index = Slideshow.nextPhotoIndex(this.index, this.photos.length);
    this.show();
  }

  /**
   * applyPhotos. Updates the frame when the source or cached index changes.
   * @param items - Photos available in the selected mode.
   * @param available - Whether the original photo folder is available.
   */
  private applyPhotos(items: Photo[], available: boolean): void {
    const signature = JSON.stringify(items) + ':' + String(available);
    this.sourceAvailable = available;
    if (signature === this.indexSignature) return;
    this.indexSignature = signature;
    this.photos = items;
    this.index = 0;
    this.failures = 0;
    this.show();
    if (this.sourceAvailable) this.queuePhotos();
    else this.queue = [];
  }

  /** showCached. Shows only cached photos belonging to the configured source. */
  private showCached(): void {
    this.queue = [];
    this.refreshCached((): void => {
      const suffix = '?source=' + this.appSettings.sourceId;
      const matches = this.appSettings.sourceId
        ? this.cached.filter((photo: Photo): boolean => photo.url.slice(-suffix.length) === suffix)
        : [];
      this.applyPhotos(matches, false);
    });
  }

  /** refreshIndex. Reloads the source index and falls back to cached photos on failure. */
  private refreshIndex(): void {
    if (this.checking) return;
    this.checking = true;
    const request = new XMLHttpRequest();
    request.open('GET', 'photos.json', true);
    request.timeout = 10000;
    /** unavailable. Switches to cached photos after the source request fails. */
    const unavailable = (): void => {
      this.checking = false;
      this.showCached();
    };
    request.onload = (): void => {
      this.checking = false;
      if (request.status < 200 || request.status >= 300) {
        this.showCached();
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(request.responseText);
      } catch (_) {
        this.showCached();
        return;
      }
      if (!Array.isArray(parsed)) {
        this.showCached();
        return;
      }
      const valid = (parsed as Photo[]).filter(
        (photo: Photo): boolean =>
          !!photo &&
          typeof photo.name === 'string' &&
          typeof photo.folder === 'string' &&
          typeof photo.url === 'string' &&
          photo.url.indexOf('/photos/') === 0,
      );
      for (let i = 0; i < valid.length; i++)
        valid[i].version =
          (valid[i].version || '') +
          ':size=' +
          this.appSettings.maxPhotoWidth +
          'x' +
          this.appSettings.maxPhotoHeight;
      this.applyPhotos(valid, true);
    };
    request.onerror = unavailable;
    request.ontimeout = unavailable;
    request.send();
  }

  /** startWithSettings. Opens the photo cache and begins loading the configured source. */
  private startWithSettings(): void {
    if (window.indexedDB) {
      PhotoCache.open(
        window.indexedDB,
        (error, store): void => {
          if (error || !store) {
            this.storageError = true;
            this.refreshIndex();
            return;
          }
          this.cache = store;
          store.setLimit(this.appSettings.cacheLimit, (error): void => {
            if (error) this.storageError = true;
            this.refreshCached((): void => {
              this.refreshIndex();
            });
          });
        },
        this.appSettings.cacheLimit,
      );
    } else {
      this.storageError = true;
      this.refreshIndex();
    }
  }

  /** loadSettings. Loads current settings or restores the last values when offline. */
  private loadSettings(): void {
    const request = new XMLHttpRequest();
    request.open('GET', 'app-settings.json', true);
    request.timeout = 5000;
    /** startOnce. Starts the frame once after settings load or time out. */
    const startOnce = (): void => {
      if (!this.started) {
        this.started = true;
        this.startWithSettings();
      }
    };
    request.onload = (): void => {
      if (request.status >= 200 && request.status < 300) {
        try {
          const received: ClientSettings = JSON.parse(request.responseText);
          if (ClientSettingsStore.isValid(received)) {
            this.appSettings = received;
            this.settingsStore.save(received);
          }
        } catch (_) {
          /* Use the last settings when the response is invalid. */
        }
      }
      startOnce();
    };
    request.onerror = startOnce;
    request.ontimeout = startOnce;
    request.send();
  }
}
