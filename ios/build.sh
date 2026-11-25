#!/usr/bin/env bash
set -euo pipefail
sdk=${1:?Supply the path to iPhoneOS10.3.sdk}
out=${2:?Supply an output directory}
app="$out/Payload/IFrame3.app"
mkdir -p "$app"
cp ios/Info.plist "$app/"
xcrun clang -target armv7-apple-ios9.0 -isysroot "$sdk" -fobjc-arc -fmodules-cache-path="$out/modules" \
  -Os -c ios/FrameApp.m -o "$out/FrameApp.o"
xcrun ld-classic -arch armv7 -platform_version ios 9.0 10.3 -syslibroot "$sdk" \
  -o "$app/IFrame3" "$out/FrameApp.o" -framework UIKit -framework WebKit \
  -framework Foundation -framework CoreGraphics -framework CFNetwork -lobjc -lSystem
codesign --force --sign - --timestamp=none --digest-algorithm=sha1 "$app"
codesign --verify "$app"
python3 ios/verify.py "$app"
(cd "$out" && /usr/bin/zip -qry iFrame3-armv7.ipa Payload)
mkdir -p "$out/debian/Applications" "$out/debian/DEBIAN"
cp -R "$app" "$out/debian/Applications/"
cp ios/control "$out/debian/DEBIAN/control"
dpkg-deb --root-owner-group -Zgzip --build "$out/debian" "$out/iFrame3-armv7.deb"
