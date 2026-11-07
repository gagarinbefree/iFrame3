import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

/** ServerConfiguration. Contains the local photo and playback settings. */
export interface ServerConfiguration {
  /** Local or mounted folder containing the photos. */
  photosDir: string;
  /** Maximum number of photos saved on the device. */
  cacheLimit: number;
  /** Delay between slides, in seconds. */
  slideshowIntervalSeconds: number;
  /** Maximum width of a landscape photo in the cache. */
  maxPhotoWidth: number;
  /** Maximum height of a landscape photo in the cache. */
  maxPhotoHeight: number;
}

/** ServerSettings. Reads and validates the local JSON configuration. */
export class ServerSettings {
  private static readonly defaults: ServerConfiguration = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../settings.example.json'), 'utf8'),
  ) as ServerConfiguration;

  /**
   * readSettings. Reads JSON settings with an optional environment override.
   * @param file - Path to the local settings file.
   * @param environment - Environment variables used for overrides.
   * @returns Validated photo folder and playback settings.
   */
  public static readSettings(file: string, environment: NodeJS.ProcessEnv): ServerConfiguration {
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Не удалось прочитать файл настроек: ' + (error as Error).message);
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings))
      throw new Error('Файл настроек должен содержать объект.');
    if (settings.photosDir !== undefined && typeof settings.photosDir !== 'string')
      throw new Error('В настройках photosDir должен быть строкой.');
    const cacheLimit =
      settings.cacheLimit === undefined ? ServerSettings.defaults.cacheLimit : settings.cacheLimit;
    const interval =
      settings.slideshowIntervalSeconds === undefined
        ? ServerSettings.defaults.slideshowIntervalSeconds
        : settings.slideshowIntervalSeconds;
    const maxPhotoWidth =
      settings.maxPhotoWidth === undefined
        ? ServerSettings.defaults.maxPhotoWidth
        : settings.maxPhotoWidth;
    const maxPhotoHeight =
      settings.maxPhotoHeight === undefined
        ? ServerSettings.defaults.maxPhotoHeight
        : settings.maxPhotoHeight;
    if (
      typeof cacheLimit !== 'number' ||
      !Number.isInteger(cacheLimit) ||
      cacheLimit < 1 ||
      cacheLimit > 500
    )
      throw new Error('cacheLimit должен быть целым числом от 1 до 500.');
    if (
      typeof interval !== 'number' ||
      !Number.isInteger(interval) ||
      interval < 1 ||
      interval > 3600
    )
      throw new Error('slideshowIntervalSeconds должен быть целым числом от 1 до 3600.');
    if (
      typeof maxPhotoWidth !== 'number' ||
      !Number.isInteger(maxPhotoWidth) ||
      maxPhotoWidth < 1 ||
      maxPhotoWidth > 8192
    )
      throw new Error('maxPhotoWidth должен быть целым числом от 1 до 8192.');
    if (
      typeof maxPhotoHeight !== 'number' ||
      !Number.isInteger(maxPhotoHeight) ||
      maxPhotoHeight < 1 ||
      maxPhotoHeight > maxPhotoWidth
    )
      throw new Error('maxPhotoHeight должен быть целым числом от 1 до maxPhotoWidth.');
    const photosDir =
      environment.PHOTOS_DIR !== undefined
        ? environment.PHOTOS_DIR
        : (settings.photosDir as string) || ServerSettings.defaults.photosDir;
    return {
      photosDir,
      cacheLimit,
      slideshowIntervalSeconds: interval,
      maxPhotoWidth,
      maxPhotoHeight,
    };
  }

  /**
   * sourceId. Identifies a photo source without exposing its path.
   * @param root - Photo directory.
   * @returns Stable source identifier, or an empty string when unset.
   */
  public static sourceId(root: string | null): string {
    if (!root) return '';
    const normalized = path.resolve(root);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
  }
}
