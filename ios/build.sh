#!/usr/bin/env bash
set -euo pipefail
sdk=${1:?Supply the path to iPhoneOS10.3.sdk}
out=${2:?Supply an output directory}
app="$out/Payload/IFrame3Native.app"
lib="$PWD/smb-source"
mkdir -p "$app/Frameworks" "$out/objects"
cp ios/Info.plist "$app/"
# Use the same artwork on the Home Screen, at launch, and while the first photo loads.
for scale in 1 2; do
  suffix=""
  if [[ "$scale" == 2 ]]; then suffix="@2x"; fi
  mark="$app/FrameMark$suffix.png"
  magick ios/frame-mark.png -resize "$((76 * scale))x$((76 * scale))" "PNG24:$app/FrameIcon$suffix.png"
  magick ios/frame-mark.png -resize "$((192 * scale))x$((192 * scale))" "PNG24:$mark"
  magick "$mark" -background black -gravity center -extent "$((768 * scale))x$((1024 * scale))" "PNG24:$app/FrameLaunch-Portrait$suffix.png"
  magick "$mark" -background black -gravity center -extent "$((1024 * scale))x$((768 * scale))" "PNG24:$app/FrameLaunch-Landscape$suffix.png"
done
build=${GITHUB_RUN_NUMBER:-1}
attempt=${GITHUB_RUN_ATTEMPT:-1}
[[ "$build" =~ ^[0-9]+$ && "$attempt" =~ ^[0-9]+$ ]]
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $build.$attempt" "$app/Info.plist"
cc=(xcrun clang -target armv7-apple-ios9.0 -isysroot "$sdk" -Os -I"$lib/include")
# This SDK snapshot omits seven public libc exports from the ARMv7 linker metadata.
# The device's libSystem supplies them. Keep the real install name and re-exports.
mkdir -p "$out/stubs"
awk '{print} /^exports:$/ {
  print "  - archs: [ armv7 ]"
  print "    symbols: [ _memcmp, _memcpy, _memmove, _memset, _strchr, _strcmp, _strncmp ]"
}' \
  "$sdk/usr/lib/libSystem.B.tbd" > "$out/stubs/libSystem.tbd"
ld=(xcrun ld-classic -arch armv7 -platform_version ios 9.0 10.3 -syslibroot "$sdk" -L"$out/stubs")
for source in "$lib"/lib/*.c; do
  "${cc[@]}" -DHAVE_CONFIG_H '-D_U_=__attribute__((unused))' -I"$lib/include/apple" -I"$lib/include/smb2" \
    -c "$source" -o "$out/objects/$(basename "$source" .c).o"
done
dylib="$app/Frameworks/libsmb2.dylib"
"${ld[@]}" -dylib -install_name @executable_path/Frameworks/libsmb2.dylib -o "$dylib" "$out"/objects/*.o -lSystem
codesign --force --sign - --timestamp=none --digest-algorithm=sha1 "$dylib"
cp "$lib/LICENCE-LGPL-2.1.txt" "$app/libsmb2-license.txt"
for module in FrameApp PhotoLibrary PhotoStore; do
  "${cc[@]}" -fobjc-arc -c "ios/$module.m" -o "$out/$module.o"
done
frameworks=(-framework UIKit -framework ImageIO -framework QuartzCore -framework Foundation -framework CoreGraphics -lobjc -lSystem)
"${ld[@]}" -o "$app/IFrame3Native" "$out/FrameApp.o" "$out/PhotoLibrary.o" "$out/PhotoStore.o" "$dylib" "${frameworks[@]}"
"${cc[@]}" -fobjc-arc -c ios/tests/device.m -o "$out/device-test.o"
"${ld[@]}" -o "$out/FrameCheck" "$out/device-test.o" "$out/PhotoLibrary.o" "$out/PhotoStore.o" "$dylib" "${frameworks[@]}"
codesign --force --sign - --timestamp=none --digest-algorithm=sha1 "$out/FrameCheck"
codesign --force --sign - --timestamp=none --digest-algorithm=sha1 "$app"
codesign --verify "$app"
python3 ios/verify.py "$app"
(cd "$out" && /usr/bin/zip -qry iFrame3-native-armv7.ipa Payload)
mkdir -p "$out/debian/Applications" "$out/debian/DEBIAN"
cp -R "$app" "$out/debian/Applications/"
sed "s/^Version: .*/Version: 0.1-$build.$attempt/" ios/control > "$out/debian/DEBIAN/control"
dpkg-deb --root-owner-group -Zgzip --build "$out/debian" "$out/iFrame3-native-armv7.deb"
