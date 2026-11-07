import defaultSettings from '../../settings.example.json' with { type: 'json' };

/** ClientSettings. Describes the non-sensitive settings used by the browser. */
export interface ClientSettings {
  /** Maximum number of photos saved on the device. */
  cacheLimit: number;
  /** Delay between slides, in seconds. */
  slideshowIntervalSeconds: number;
  /** Stable identifier of the configured photo source. */
  sourceId: string;
  /** Maximum width of a landscape photo in the cache. */
  maxPhotoWidth: number;
  /** Maximum height of a landscape photo in the cache. */
  maxPhotoHeight: number;
}

/** SettingsStorage. Provides the storage operations required for offline settings. */
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** ClientSettingsStore. Validates and retains settings for offline startup. */
export class ClientSettingsStore {
  private static readonly defaults: ClientSettings = {
    cacheLimit: defaultSettings.cacheLimit,
    slideshowIntervalSeconds: defaultSettings.slideshowIntervalSeconds,
    maxPhotoWidth: defaultSettings.maxPhotoWidth,
    maxPhotoHeight: defaultSettings.maxPhotoHeight,
    sourceId: '',
  };
  private static readonly key = 'iframe3.settings';
  private readonly storage: SettingsStorage | null;

  /**
   * constructor. Creates a settings store.
   * @param storage - Browser storage, or null when unavailable.
   */
  public constructor(storage: SettingsStorage | null) {
    this.storage = storage;
  }

  /**
   * isValid. Checks settings published by the local server.
   * @param value - Settings to validate.
   * @returns Whether all settings have supported values.
   */
  public static isValid(value: ClientSettings): boolean {
    return (
      !!value &&
      typeof value.cacheLimit === 'number' &&
      isFinite(value.cacheLimit) &&
      value.cacheLimit >= 1 &&
      value.cacheLimit <= 500 &&
      Math.floor(value.cacheLimit) === value.cacheLimit &&
      typeof value.slideshowIntervalSeconds === 'number' &&
      isFinite(value.slideshowIntervalSeconds) &&
      value.slideshowIntervalSeconds >= 1 &&
      value.slideshowIntervalSeconds <= 3600 &&
      Math.floor(value.slideshowIntervalSeconds) === value.slideshowIntervalSeconds &&
      typeof value.maxPhotoWidth === 'number' &&
      isFinite(value.maxPhotoWidth) &&
      value.maxPhotoWidth >= 1 &&
      value.maxPhotoWidth <= 8192 &&
      Math.floor(value.maxPhotoWidth) === value.maxPhotoWidth &&
      typeof value.maxPhotoHeight === 'number' &&
      isFinite(value.maxPhotoHeight) &&
      value.maxPhotoHeight >= 1 &&
      value.maxPhotoHeight <= value.maxPhotoWidth &&
      Math.floor(value.maxPhotoHeight) === value.maxPhotoHeight &&
      typeof value.sourceId === 'string' &&
      (value.sourceId === '' || /^[a-f0-9]{20}$/.test(value.sourceId))
    );
  }

  /**
   * read. Restores the last settings for offline use.
   * @returns Saved settings or safe defaults.
   */
  public read(): ClientSettings {
    try {
      const raw = this.storage && this.storage.getItem(ClientSettingsStore.key);
      const value = raw && JSON.parse(raw);
      if (value && value.maxPhotoWidth === undefined)
        value.maxPhotoWidth = ClientSettingsStore.defaults.maxPhotoWidth;
      if (value && value.maxPhotoHeight === undefined)
        value.maxPhotoHeight = ClientSettingsStore.defaults.maxPhotoHeight;
      return value && ClientSettingsStore.isValid(value) ? value : ClientSettingsStore.defaults;
    } catch (_) {
      return ClientSettingsStore.defaults;
    }
  }

  /**
   * save. Stores public settings for offline startup.
   * @param value - Settings to save.
   * @returns Whether the settings were saved.
   */
  public save(value: ClientSettings): boolean {
    if (!this.storage || !ClientSettingsStore.isValid(value)) return false;
    try {
      this.storage.setItem(ClientSettingsStore.key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }
}
