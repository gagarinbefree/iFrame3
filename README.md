# <img src="ios/home-icon.png" width="64" height="64" align="middle" alt=""> iFrame3

iFrame3 turns an iPad 3 running iOS 9 into a full-screen photo frame. It reads photos directly from an SMB share and its subfolders, shuffles them and fits each photo on screen with its original proportions. The screen stays awake while the slideshow is active.

## Connect a photo share

1. Give the guest account read access to the photo share.
2. Copy the [example settings](ios/settings.example.json) to `/var/mobile/Media/iFrame3Native/settings.json` on the iPad.
3. Set `host` to the server name or IP address and `share` to the shared folder name. Set `folder` to a subfolder path or leave it empty to start at the share root.
4. Open **iFrame3 Native**. Reopen the app after changing its settings.

## Playback and storage

Photos change every 10 seconds by default. Adjust `slideshowIntervalSeconds` to change the interval. After a photo appears on screen, the app saves a resized JPEG on the iPad. Subsequent views can use that copy. If the share becomes unavailable, the slideshow continues with photos already cached for that source.

The default cache holds 50 photos. Set `cacheLimit` to change the limit and `maxPhotoWidth` and `maxPhotoHeight` to adjust the thumbnail dimensions. The app writes display and cache events to `frame.log` next to the settings file.

## Build and install

The GitHub Actions workflow builds the ARMv7 application from `main` on macOS. Download the `iFrame3-native-armv7` artifact for the Debian installation package, the IPA archive and the `FrameCheck` device test. A paired iPad can receive verified builds over USB from Windows. [USB update instructions](tools/ipad/README.md)

The application uses Objective-C, UIKit and libsmb2. The native sources, artwork and tests are in the iOS directory. [Build and device test details](ios/README.md)
