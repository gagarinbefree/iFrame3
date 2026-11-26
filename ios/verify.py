"""Verify the packaged iPad application against its deployment requirements."""

import plistlib
import struct
import sys
from pathlib import Path


def verify_artwork(bundle, info):
    launch = info.get("UILaunchImageFile")
    if not launch:
        raise ValueError("Missing the iPad launch image declaration")
    icon_files = info.get("CFBundleIcons", {}).get("CFBundlePrimaryIcon", {}).get("CFBundleIconFiles", [])
    if "FrameIcon" not in icon_files:
        raise ValueError("Missing the iPad Home Screen icon declaration")
    for scale, suffix in ((1, ""), (2, "@2x")):
        for name, width, height in (
            ("FrameIcon", 76, 76),
            ("FrameMark", 192, 192),
            (launch + "-Portrait", 768, 1024),
            (launch + "-Landscape", 1024, 768),
        ):
            path = bundle / (name + suffix + ".png")
            with path.open("rb") as resource:
                header = resource.read(24)
            if header[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", header[16:24]) != (width * scale, height * scale):
                raise ValueError(f"Invalid iPad artwork: {path.name}")


def verify(bundle):
    with (bundle / "Info.plist").open("rb") as source:
        info = plistlib.load(source)
    if info["MinimumOSVersion"] != "9.0" or info["UIDeviceFamily"] != [2]:
        raise ValueError("Expected an iPad application for iOS 9")
    if info["CFBundleIdentifier"] != "io.github.gagarinbefree.iframe3.native":
        raise ValueError("Use the separate native app identifier")
    verify_artwork(bundle, info)
    binary = (bundle / info["CFBundleExecutable"]).read_bytes()
    magic, cpu, subtype, kind, count, size, _ = struct.unpack_from("<7I", binary)
    if (magic, cpu, subtype & 0xffffff, kind) != (0xfeedface, 12, 9, 2):
        raise ValueError("Expected a 32-bit ARMv7 Mach-O executable")
    if b"/WebKit.framework/" in binary or b"libsmb2.dylib" not in binary:
        raise ValueError("Expected the native SMB viewer")
    offset = 28
    versions = []
    for _ in range(count):
        cmd, length = struct.unpack_from("<II", binary, offset)
        if length < 8 or offset + length > 28 + size:
            raise ValueError("Invalid Mach-O load command")
        if cmd == 0x25:  # LC_VERSION_MIN_IPHONEOS
            versions.append(struct.unpack_from("<I", binary, offset + 8)[0])
        offset += length
    if versions != [0x090000]:
        raise ValueError("Expected an iOS 9.0 deployment target")
    print("Verified iPad ARMv7 executable with iOS 9.0 deployment target")


if __name__ == "__main__":
    verify(Path(sys.argv[1]))
