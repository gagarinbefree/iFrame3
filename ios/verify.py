"""Verify the packaged iPad application against its deployment requirements."""

import plistlib
import struct
import sys
from pathlib import Path


def verify(bundle):
    with (bundle / "Info.plist").open("rb") as source:
        info = plistlib.load(source)
    if info["MinimumOSVersion"] != "9.0" or info["UIDeviceFamily"] != [2]:
        raise ValueError("Expected an iPad application for iOS 9")
    transport = info.get("NSAppTransportSecurity", {})
    if transport != {"NSExceptionDomains": {"localhost": {"NSExceptionAllowsInsecureHTTPLoads": True}}}:
        raise ValueError("The iOS 9 frame requires an HTTP exception scoped to localhost")
    binary = (bundle / info["CFBundleExecutable"]).read_bytes()
    magic, cpu, subtype, kind, count, size, _ = struct.unpack_from("<7I", binary)
    if (magic, cpu, subtype & 0xffffff, kind) != (0xfeedface, 12, 9, 2):
        raise ValueError("Expected a 32-bit ARMv7 Mach-O executable")
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
