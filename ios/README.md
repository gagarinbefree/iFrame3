# iFrame3 Native

The Objective-C app uses UIKit for presentation, libsmb2 for direct guest access to the photo share and Image I/O for display-sized thumbnails. PhotoStore keeps the displayed images in Application Support. The app and Debian package use the identifier `io.github.gagarinbefree.iframe3.native`.

The [iPad workflow](../.github/workflows/ipad.yml) fetches the pinned iPhoneOS 10.3 SDK and libsmb2 sources, runs the host-side cache tests and builds the ARMv7 app with an iOS 9.0 deployment target. It verifies the packaged executable, launch artwork, Home Screen icons and the USB updater's package validation before publishing the artifacts.

For the device smoke test, place `FrameCheck` next to the app's extracted `Frameworks` directory on the iPad and pass it the path to the configured settings file. The test reads a photo from the share, saves it in a temporary cache and reopens it with the share disconnected.
