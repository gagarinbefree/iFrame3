import io
import tarfile
import unittest
from unittest.mock import Mock

import update


class UpdateTests(unittest.TestCase):
    def test_refuses_other_package_formats(self):
        with self.assertRaises(ValueError):
            update.contents(b"")

    def test_refuses_maintainer_scripts(self):
        control = io.BytesIO()
        with tarfile.open(fileobj=control, mode="w:gz") as archive:
            archive.addfile(tarfile.TarInfo("./postinst"), io.BytesIO())
        raw = bytearray(b"!<arch>\n")
        for name, data in (("debian-binary", b"2.0\n"), ("control.tar.gz", control.getvalue()),
                           ("data.tar.gz", b"")):
            raw.extend(f"{name:<16}{0:<12}{0:<6}{0:<6}{'100644':<8}{len(data):<10}`\n".encode())
            raw.extend(data)
            if len(data) % 2:
                raw.extend(b"\n")
        with self.assertRaisesRegex(ValueError, "postinst"):
            update.contents(bytes(raw))

    def test_requires_matching_files_and_configured_package(self):
        device = Mock()
        expected = {update.APP + "IFrame3Native": b"binary"}
        prefix = b"Package: " + update.PACKAGE.encode()
        for state, result in ((b"install ok installed", True), (b"install ok unpacked", False)):
            device.read.side_effect = [b"binary", prefix + b"\nStatus: " + state + b"\n"]
            self.assertEqual(update.installed(device, expected), result)
        device.read.side_effect = [None]
        self.assertFalse(update.installed(device, expected))
