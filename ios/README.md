# iFrame3 Native

This branch builds a standalone ARMv7 UIKit app for iOS 9. It reads the configured SMB share directly using the dynamically linked LGPL library libsmb2. The app streams a source file to temporary storage, decodes a display-sized image using Image I/O, and records a JPEG in its own Application Support directory after presentation. The web frame and the native frame have separate bundle identifiers, settings and caches.

Copy `settings.example.json` to `/var/mobile/Media/iFrame3Native/settings.json` and edit it for the device. `folder` is relative to the share. The configured guest account needs read access. Settings take effect on the next foreground activation. The app records display and cache events in `frame.log` beside the settings.

The Objective-C GitHub Actions workflow produces `iFrame3-native-armv7.deb` for the device package manager, an app archive and a device smoke test. The existing Windows main-branch updater is dedicated to the web frame. Use the separate native package for this branch. Its package identifier is `io.github.gagarinbefree.iframe3.native`.

The host-side cache test runs before each build. To run the device test, place `FrameCheck` beside the extracted app's `Frameworks` directory on the iPad and pass the settings file path as its argument. It reads a real photo and exercises cache persistence and source loss in a temporary cache.
