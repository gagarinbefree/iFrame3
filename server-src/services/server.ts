import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PhotoIndex } from './photo-index';
import { ServerSettings } from './settings';

/** PhotoServer. Serves the frame and photos from the configured directory. */
export class PhotoServer {
  private readonly projectRoot: string;
  private root: string | null = null;
  private refreshIndex: () => void = () => {};
  private clientSettings = '';
  private port = 3000;
  private readonly files: Record<string, [string, string]> = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/framework7.css': ['framework7.css', 'text/css; charset=utf-8'],
    '/photos.json': ['photos.json', 'application/json; charset=utf-8'],
    '/app-settings.json': ['app-settings.json', 'application/json; charset=utf-8'],
    '/app.manifest': ['app.manifest', 'text/cache-manifest; charset=utf-8'],
  };

  /**
   * constructor. Creates a server for an application directory.
   * @param projectRoot - Root directory containing settings and the production build.
   */
  public constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * getPort. Selects the local server port.
   * @param value - Optional PORT environment value.
   * @returns Validated port number.
   */
  public static getPort(value: string | undefined): number {
    if (value === undefined) return 3000;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
      throw new Error('PORT должен быть целым числом от 1 до 65535.');
    return Number(value);
  }

  /**
   * resolvePhoto. Resolves an image path within the configured photo root.
   * @param root - Absolute photo directory.
   * @param relative - Requested relative image path.
   * @returns Resolved path, or null when invalid.
   */
  public static resolvePhoto(root: string, relative: string): string | null {
    if (
      !relative ||
      relative.includes('\\') ||
      relative.includes('\0') ||
      !/\.(jpe?g|png|gif)$/i.test(relative)
    )
      return null;
    const target = path.resolve(root, relative);
    const inside = path.relative(root, target);
    if (!inside || inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside))
      return null;
    return target;
  }

  /**
   * start. Starts the local static server and periodically refreshes the photo index.
   * @param environment - Environment variables used for runtime overrides.
   */
  public start(environment: NodeJS.ProcessEnv): void {
    try {
      this.port = PhotoServer.getPort(environment.PORT);
      const settings = ServerSettings.readSettings(
        path.join(this.projectRoot, 'settings.local.json'),
        environment,
      );
      if (settings.photosDir) this.root = path.resolve(settings.photosDir);
      const indexPath = path.join(this.projectRoot, 'dist', 'photos.json');
      this.clientSettings = JSON.stringify({
        cacheLimit: settings.cacheLimit,
        slideshowIntervalSeconds: settings.slideshowIntervalSeconds,
        maxPhotoWidth: settings.maxPhotoWidth,
        maxPhotoHeight: settings.maxPhotoHeight,
        sourceId: ServerSettings.sourceId(this.root),
      });
      this.refreshIndex = (): void => {
        try {
          PhotoIndex.writePhotoIndex(this.root, indexPath, ServerSettings.sourceId(this.root));
        } catch (error) {
          console.error('Не удалось обновить список фотографий: ' + (error as Error).message);
        }
      };
      console.log(
        this.root
          ? `Папка фотографий: ${this.root}`
          : 'Папка фотографий не задана. Укажите PHOTOS_DIR.',
      );
    } catch (error) {
      console.error('Ошибка подготовки фотографий: ' + (error as Error).message);
      process.exitCode = 1;
      return;
    }
    const server = http.createServer((request, response): void => {
      this.handleRequest(request, response);
    });
    server.on('error', (error: NodeJS.ErrnoException): void => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        console.error(
          `Не удалось открыть порт ${this.port} (${error.code}). Укажите другой порт через PORT.`,
        );
        process.exitCode = 1;
        return;
      }
      throw error;
    });
    server.listen(this.port, '127.0.0.1', (): void => {
      try {
        fs.writeFileSync(
          path.join(this.projectRoot, 'dist', 'app-settings.json'),
          this.clientSettings,
        );
      } catch (error) {
        console.error('Не удалось подготовить настройки: ' + (error as Error).message);
        server.close();
        process.exitCode = 1;
        return;
      }
      this.refreshIndex();
      setInterval(this.refreshIndex, 30000);
      console.log(`iFrame3: http://localhost:${this.port}`);
    });
  }

  /**
   * handleRequest. Routes static application and photo requests.
   * @param request - Incoming HTTP request.
   * @param response - HTTP response to send.
   */
  private handleRequest(request: http.IncomingMessage, response: http.ServerResponse): void {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;
    if (pathname.startsWith('/photos/') && this.root) {
      const root = this.root;
      const requestedSource = requestUrl.searchParams.get('source');
      if (requestedSource && requestedSource !== ServerSettings.sourceId(root)) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      let relative: string;
      try {
        relative = decodeURIComponent(pathname.slice(8));
      } catch (_) {
        response.writeHead(400);
        response.end();
        return;
      }
      const target = PhotoServer.resolvePhoto(root, relative);
      if (!target) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      fs.realpath(root, (rootError, realRoot): void => {
        if (rootError) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        fs.realpath(target, (error, real): void => {
          if (
            error ||
            !PhotoServer.resolvePhoto(
              realRoot,
              path.relative(realRoot, real).split(path.sep).join('/'),
            )
          ) {
            response.writeHead(404);
            response.end('Not found');
            return;
          }
          const extension = path.extname(real).toLowerCase();
          const type =
            extension === '.png' ? 'image/png' : extension === '.gif' ? 'image/gif' : 'image/jpeg';
          fs.readFile(real, (readError, data): void => {
            if (readError) {
              response.writeHead(404);
              response.end('Not found');
              return;
            }
            response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
            response.end(data);
          });
        });
      });
      return;
    }
    const file = this.files[pathname];
    if (!file) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    fs.readFile(path.join(this.projectRoot, 'dist', file[0]), (error, data): void => {
      if (error) {
        response.writeHead(500);
        response.end('Server error');
        return;
      }
      const cacheControl =
        pathname === '/photos.json' || pathname === '/app-settings.json' ? 'no-store' : 'no-cache';
      response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': cacheControl });
      response.end(data);
    });
  }
}
if (require.main === module) new PhotoServer(path.resolve(__dirname, '../..')).start(process.env);
