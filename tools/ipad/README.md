# iFrame3 USB updates

The Windows task checks for the paired iPad every five minutes while the configured Windows user is signed in. It downloads the most recent successful main build of the iPad workflow and checks GitHub's artifact digest. It accepts the iFrame3 Debian package with its application files and plain package metadata. The USB transfer uses a temporary file and verifies the bytes before renaming it. Installation is confirmed by checking the installed files and dpkg status. Reopen the frame to run the updated binary.

Use Python 3.10 or later, the GitHub CLI authenticated as the Windows user, and the libimobiledevice Windows suite. The iPad uses its existing AFC2 service and package manager.

1. On Windows run `python tools/ipad/update.py --bootstrap --device <udid> --suite D:/windows/libimobile-suite-latest_w64`.
2. Once on the iPad, run `su root -c 'sh /var/root/iframe3-enable.sh'` in MTerminal. This installs the initial frame and registers a launchd job that invokes dpkg for the single package under /var/root.
3. On Windows run `./tools/ipad/register.ps1 -Device <udid>`. The latest check is recorded in `.cache/ipad-updates/last-check.txt`.

To pause Windows checks, run `Disable-ScheduledTask -TaskName 'iFrame3 USB update'`. To remove the iPad job, run `launchctl unload /Library/LaunchDaemons/io.github.gagarinbefree.iframe3.update.plist` as root, then remove that plist.
