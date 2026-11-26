# iFrame3

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

The branch workflow publishes the `iFrame3-native-armv7` artifact. Install its Debian package on the iPad using the device package manager. The artifact also includes an IPA archive and the `FrameCheck` device test. [Native build details](ios/README.md)
