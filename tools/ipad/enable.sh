#!/bin/sh
# enable.sh. Installs the staged package and enables the device's USB update job.
# Run once as root after staging the package through the paired USB connection.
set -eu
pkg=/var/root/iframe3-update.deb
job=/Library/LaunchDaemons/io.github.gagarinbefree.iframe3.update.plist
test "$(/usr/bin/dpkg-deb -f "$pkg" Package)" = io.github.gagarinbefree.iframe3.native
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
