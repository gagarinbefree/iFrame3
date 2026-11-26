#!/bin/sh
# Installed under /var/root over the paired USB connection. Run once as root.
set -eu
pkg=/var/root/iframe3-update.deb
job=/Library/LaunchDaemons/io.github.gagarinbefree.iframe3.update.plist
test "$(/usr/bin/dpkg-deb -f "$pkg" Package)" = io.github.gagarinbefree.iframe3
/usr/bin/dpkg -i "$pkg"
umask 022
cat > "$job.new" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>Label</key><string>io.github.gagarinbefree.iframe3.update</string>
<key>ProgramArguments</key><array>
  <string>/usr/bin/dpkg</string><string>-i</string><string>/var/root/iframe3-update.deb</string>
</array>
<key>WatchPaths</key><array><string>/var/root/iframe3-update.deb</string></array>
</dict></plist>
PLIST
/bin/chmod 644 "$job.new"
/bin/mv -f "$job.new" "$job"
if ! /bin/launchctl list | /bin/grep -q 'io.github.gagarinbefree.iframe3.update$'; then
    /bin/launchctl load "$job"
fi
/bin/su mobile -c /usr/bin/uicache
echo 'iFrame3 updates enabled'
