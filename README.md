# iFrame3

This branch contains the earlier Safari photo frame for iPad 3 and iOS 9. The local server lists photos in a folder or an SMB share mounted by the operating system. The viewer fits each image on screen, preserves its aspect ratio and supports JPEG, PNG and GIF.

## Run locally

Install Node.js 24, run `npm install` and copy `settings.example.json` to `settings.local.json`. Set `photosDir` to the local directory, mapped drive or UNC path containing your photos. Escape backslashes in JSON. For a share that requires authentication, connect to it through the operating system. The `PHOTOS_DIR` environment variable can override the configured path.

Run `npm start` and open `http://localhost:3000/` on the server computer. The server scans subfolders and refreshes its file list approximately every 30 seconds. Set the `PORT` environment variable before starting the server to use another port.

## Slideshow and offline storage

The default slideshow interval is 10 seconds. Set `slideshowIntervalSeconds` to a value from 1 to 3600. The browser stores resized JPEGs in IndexedDB. The default cache limit is 50 photos and the default landscape size is 2048 by 1536 pixels. Adjust `cacheLimit` (1–500), `maxPhotoWidth` and `maxPhotoHeight` in the settings file, then restart the application. Portrait photos use the reversed dimensions. Transparent areas become white and an animated GIF contributes a single still frame.

When the source folder is unavailable, the viewer can display photos already cached for that folder. Reducing the limit removes older entries. Browser quotas and storage eviction also affect how many photos remain available.

Safari on iOS 9 uses AppCache to store the viewer itself. Open the viewer once while the server is available and allow photos to be cached. Use the same address and browsing mode when reopening it offline. Browsers without AppCache may continue showing cached images in an open tab, but reopening the viewer offline depends on the browser.

## Development

The client and local server use TypeScript. The client uses Framework7 v1 and Webpack and builds to ES5. Run `npm test`, `npm run lint` and `npm run format:check` to verify changes.
