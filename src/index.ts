import 'framework7';
import { FramePage } from './pages/frame';

declare global {
  /** Window. Extends the browser window with the Framework7 constructor. */
  interface Window {
    /** Framework7 constructor exposed by the library. */
    Framework7: new () => unknown;
  }
}

/** FrameApplication. Initializes Framework7, the frame page and offline updates. */
class FrameApplication {
  /** start. Starts the frame and activates downloaded offline shell updates. */
  public start(): void {
    new window.Framework7();
    new FramePage().start();
    const offlineApp = (
      window as Window & {
        applicationCache?: {
          addEventListener(type: string, listener: () => void): void;
          swapCache(): void;
        };
      }
    ).applicationCache;
    if (offlineApp) {
      offlineApp.addEventListener('updateready', (): void => {
        try {
          offlineApp.swapCache();
          location.reload();
        } catch (_) {
          /* A later load can apply the update. */
        }
      });
    }
  }
}
new FrameApplication().start();
