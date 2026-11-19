#!/bin/bash
# Meeting-room kiosk for Debian 13 (trixie) minimal install.
# Usage (as root):  URL=https://calendar.example.org/room/1 ./install.sh
#   URL          = home page (room calendar). Its domain keeps cookies; everything else is wiped on reset.
#   RES          = output mode, empty = monitor's preferred mode.
#   ROOM_NAME    = display name shown on the bar and screensaver.
#   IDLE_BLANK   = seconds of no input before screensaver activates (default 3 min).
#   SCREEN_BLANK = seconds of no input before screen goes fully black (default 1 h).
#   CONFIG_PIN   = 4-digit PIN to access on-screen config (default 0000).
#   ENABLE_MEET  = true/false (default true).
#   ENABLE_TEAMS = true/false (default true).
#   ENABLE_ZOOM  = true/false (default true).
set -euo pipefail
: "${URL:?set URL=https://your-calendar-page}"
RES="${RES:-}"
ROOM_NAME="${ROOM_NAME:-}"
IDLE_BLANK="${IDLE_BLANK:-180}"
SCREEN_BLANK="${SCREEN_BLANK:-3600}"
CONFIG_PIN="${CONFIG_PIN:-0000}"
ENABLE_MEET="${ENABLE_MEET:-true}"
ENABLE_TEAMS="${ENABLE_TEAMS:-true}"
ENABLE_ZOOM="${ENABLE_ZOOM:-true}"
HOST=$(echo "$URL" | awk -F/ '{print $3}')
U=kiosk

apt-get update
apt-get install -y --no-install-recommends \
  sway swayidle chromium pipewire-audio wireplumber pulseaudio-utils pavucontrol \
  psmisc fonts-dejavu fonts-noto-color-emoji dbus-user-session
[ "$(dpkg --print-architecture)" = amd64 ] && apt-get install -y intel-media-va-driver

id "$U" >/dev/null 2>&1 || useradd -m -G video,audio,input,render "$U"

echo "URL=$URL" > /etc/kiosk.conf

rm -rf /opt/kiosk-ext && cp -r "$(dirname "$0")/ext" /opt/kiosk-ext
cat > /opt/kiosk-ext/config.js <<EOF
const HOME = '$URL';
const IDLE_BLANK = $IDLE_BLANK;
const SCREEN_BLANK = $SCREEN_BLANK;
const ROOM_NAME = '$ROOM_NAME';
const CONFIG_PIN = '$CONFIG_PIN';
const ENABLE_MEET = $ENABLE_MEET;
const ENABLE_TEAMS = $ENABLE_TEAMS;
const ENABLE_ZOOM = $ENABLE_ZOOM;
EOF

mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $U --noclear %I \$TERM
EOF
cat > /home/$U/.profile <<'EOF'
export WLR_NO_HARDWARE_CURSORS=1
[ "$(tty)" = /dev/tty1 ] && exec sway
EOF

cat > /usr/local/bin/kiosk-browser <<'EOF'
#!/bin/sh
. /etc/kiosk.conf
while :; do
  chromium --ozone-platform=wayland --kiosk --no-first-run --noerrdialogs \
    --disable-session-crashed-bubble --password-store=basic \
    --enable-features=VaapiVideoDecoder --load-extension=/opt/kiosk-ext "$URL"
  sleep 1
done
EOF

cat > /usr/local/bin/kiosk-blank <<'EOF'
#!/bin/sh
in_call() { fuser -s /dev/video* 2>/dev/null || [ -n "$(pactl list short source-outputs 2>/dev/null)" ]; }
while in_call; do sleep 30; done
swaymsg 'output * power off'
EOF
chmod +x /usr/local/bin/kiosk-browser /usr/local/bin/kiosk-blank

mkdir -p /home/$U/.config/sway
cat > /home/$U/.config/sway/config <<EOF
output * bg #000000 solid_color
${RES:+output * mode $RES}
default_border none
default_floating_border none
seat * hide_cursor 500
seat * xcursor_theme default 1
for_window [app_id="pavucontrol"] floating enable, resize set 900 600
bindsym Mod4+Shift+a exec pavucontrol
bindsym Mod4+Shift+h exec pkill -x chromium
exec /usr/local/bin/kiosk-browser
exec swayidle -w timeout 3600 'kiosk-blank' resume 'swaymsg "output * power on"'
EOF
chown -R $U:$U /home/$U

mkdir -p /etc/chromium/policies/managed
cat > /etc/chromium/policies/managed/kiosk.json <<EOF
{
  "DefaultCookiesSetting": 4,
  "CookiesAllowedForUrls": ["[*.]$HOST"],
  "RestoreOnStartup": 5,
  "VideoCaptureAllowedUrls": ["https://meet.google.com", "https://teams.microsoft.com", "https://teams.live.com", "https://zoom.us", "https://app.zoom.us"],
  "AudioCaptureAllowedUrls": ["https://meet.google.com", "https://teams.microsoft.com", "https://teams.live.com", "https://zoom.us", "https://app.zoom.us"],
  "BrowserSignin": 0,
  "SyncDisabled": true,
  "PasswordManagerEnabled": false,
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "TranslateEnabled": false,
  "DefaultNotificationsSetting": 2,
  "URLBlocklist": ["devtools://*", "chrome://extensions", "chrome://settings", "file://*"]
}
EOF

systemctl daemon-reload
echo "Done. Reboot to start the kiosk."
