"""Deploy the latest successful iFrame3 main build to a specific paired iPad."""
import argparse
import hashlib
import io
import json
import plistlib
import subprocess
import sys
import tarfile
import time
import zipfile
from pathlib import Path
from datetime import datetime, timezone

from usb import Device

REPO = "gagarinbefree/iFrame3"
PACKAGE = "io.github.gagarinbefree.iframe3"
APP = "Applications/IFrame3.app/"
HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[1] / ".cache" / "ipad-updates"


def api(path):
    return subprocess.check_output(["gh", "api", "repos/" + REPO + "/" + path])


def latest():
    runs = json.loads(api("actions/workflows/ipad.yml/runs?branch=main&status=success&per_page=20"))
    run = next(r for r in runs["workflow_runs"] if r["event"] in ("push", "workflow_dispatch")
               and r["head_branch"] == "main" and r["head_repository"]["full_name"] == REPO)
    result = json.loads(api("actions/runs/%d/artifacts" % run["id"]))
    artifact, = [a for a in result["artifacts"] if a["name"] == "iFrame3-armv7" and not a["expired"]]
    if not 0 < artifact["size_in_bytes"] <= 20 * 1024 * 1024:
        raise ValueError("Unexpected artifact size")
    digest = artifact["digest"]
    path = CACHE / ("%d.zip" % artifact["id"])
    archive = path.read_bytes() if path.exists() else b""
    if "sha256:" + hashlib.sha256(archive).hexdigest() != digest:
        archive = api("actions/artifacts/%d/zip" % artifact["id"])
        if "sha256:" + hashlib.sha256(archive).hexdigest() != digest:
            raise ValueError("GitHub artifact digest mismatch")
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(archive)
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        if bundle.getinfo("iFrame3-armv7.deb").file_size > 16 * 1024 * 1024:
            raise ValueError("Package exceeds size limit")
        deb = bundle.read("iFrame3-armv7.deb")
    return run["id"], deb


def contents(deb):
    """Accept only this application's files and plain dpkg metadata."""
    if not deb.startswith(b"!<arch>\n") or len(deb) > 16 * 1024 * 1024:
        raise ValueError("Invalid Debian archive")
    members, offset = {}, 8
    while offset < len(deb):
        header = deb[offset:offset + 60]
        name = header[:16].decode().strip().rstrip("/")
        if header[58:] != b"`\n" or name in members:
            raise ValueError("Invalid ar member")
        length = int(header[48:58])
        offset += 60
        if length < 0 or offset + length > len(deb):
            raise ValueError("Invalid member length")
        members[name] = deb[offset:offset + length]
        offset += length + length % 2
    if set(members) != {"debian-binary", "control.tar.gz", "data.tar.gz"} or members["debian-binary"] != b"2.0\n":
        raise ValueError("Unexpected Debian archive layout")
    files = {}
    for part in ("control", "data"):
        with tarfile.open(fileobj=io.BytesIO(members[part + ".tar.gz"]), mode="r:gz") as tar:
            for entry in tar:
                name = entry.name.removeprefix("./").rstrip("/")
                if entry.uid or entry.gid or entry.mode & 0o7022:
                    raise ValueError("Unexpected owner or mode: " + name)
                if entry.isdir() and (name in ("", ".") or part == "data" and
                        name in ("Applications", APP[:-1], APP + "_CodeSignature")):
                    continue
                allowed = {"control"} if part == "control" else {
                    APP + "IFrame3", APP + "Info.plist", APP + "_CodeSignature/CodeResources"}
                if (name not in allowed or name in files or not entry.isfile()
                        or entry.size > 8 * 1024 * 1024):
                    raise ValueError("Unexpected package entry: " + name)
                files[name] = tar.extractfile(entry).read()
    if (b"Package: " + PACKAGE.encode()) not in files.pop("control").splitlines():
        raise ValueError("Wrong package identifier")
    if plistlib.loads(files[APP + "Info.plist"])["CFBundleIdentifier"] != PACKAGE:
        raise ValueError("Wrong app bundle identifier")
    if set(files) != {APP + "IFrame3", APP + "Info.plist", APP + "_CodeSignature/CodeResources"}:
        raise ValueError("Incomplete app")
    return files


def installed(device, expected):
    if not all(device.read("/" + name) == data for name, data in expected.items()):
        return False
    status = device.read("/var/lib/dpkg/status") or b""
    return any((b"Package: " + PACKAGE.encode()) in block.splitlines()
               and b"Status: install ok installed" in block.splitlines() for block in status.split(b"\n\n"))


def deploy(device, deb, bootstrap):
    expected = contents(deb)
    enabled = device.read("/Library/LaunchDaemons/" + PACKAGE + ".update.plist") is not None
    if not enabled and not bootstrap:
        raise RuntimeError("Run the one-time iPad setup first")
    if installed(device, expected) and enabled:
        return "installed and verified"
    device.publish("/var/root/iframe3-update.deb", deb)
    if bootstrap:
        script = (HERE / "enable.sh").read_bytes().replace(b"\r\n", b"\n")
        device.publish("/var/root/iframe3-enable.sh", script)
    if not enabled:
        return "staged; waiting for local administrator activation"
    for _ in range(30):
        time.sleep(2)
        if installed(device, expected):
            return "installed and verified"
    raise RuntimeError("iPad has not confirmed installation; retry at the next check")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", required=True)
    parser.add_argument("--suite", type=Path, required=True)
    parser.add_argument("--bootstrap", action="store_true")
    args = parser.parse_args()
    ids = subprocess.check_output([args.suite / "idevice_id.exe", "-l"], text=True).split()
    if args.device not in ids:
        return "Waiting for the paired iPad"
    run, deb = latest()
    device = Device(args.suite, args.device)
    try:
        return "Build %d: %s" % (run, deploy(device, deb, args.bootstrap))
    finally:
        device.close()


if __name__ == "__main__":
    try:
        message, code = main(), 0
    except Exception as error:
        message, code = str(error), 1
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "last-check.txt").write_text(datetime.now(timezone.utc).isoformat() + " " + message + "\n",
                                          encoding="utf-8")
    print(message)
    sys.exit(code)
