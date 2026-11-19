# meetateam

Turns a box running Debian 13 with no desktop into a meeting-room kiosk:
- **Calendar:** boots straight into a full-screen calendar page.
- **Guest join:** on-screen buttons to join Google Meet, Microsoft Teams, or Zoom meetings by entering a meeting code/ID.
- **Guest sessions:** Sign out button appears during calls, auto sign-out after 2 hours (5-minute warning with "Stay signed in").
- **Screensaver:** floating display showing time, room name, and next meeting. Activates after 3 minutes idle, screen goes fully black after 1 hour.
- **On-screen config:** gear icon opens a PIN-protected settings screen to change room name, calendar URL, timeouts, and enabled services.

## Quick install

On a fresh Debian 13 box (as root):

```sh
curl -fsSL https://raw.githubusercontent.com/juan-ms2lab/meetateam/main/setup.sh | URL=https://your-calendar-url bash
reboot
```

## Files

| File | What it is |
|---|---|
| `install.sh` | Installer. Run as root on the target machine. |
| `setup.sh` | One-line bootstrap: downloads and runs `install.sh`. |
| `ext/` | Chromium extension: join buttons, session timer, screensaver, config screen. |

## Manual install

```sh
scp -r meetateam you@<box-ip>:~
ssh you@<box-ip>
cd meetateam
sudo URL=https://your-calendar-url ./install.sh
sudo reboot
```

### Options (env vars)

| Variable | Default | Meaning |
|---|---|---|
| `URL` | required | Home page (the room calendar). Only this site stays signed in. |
| `RES` | auto | Screen mode, e.g. `1920x1080` |
| `ROOM_NAME` | _(empty)_ | Display name shown on bar and screensaver. |
| `IDLE_BLANK` | `180` | Seconds idle before screensaver activates. |
| `SCREEN_BLANK` | `3600` | Seconds idle before screen goes fully black. |
| `CONFIG_PIN` | `0000` | 4-digit PIN for the on-screen config screen. |
| `ENABLE_MEET` | `true` | Show Google Meet join button. |
| `ENABLE_TEAMS` | `true` | Show Microsoft Teams join button. |
| `ENABLE_ZOOM` | `true` | Show Zoom join button. |

All of these can also be changed at runtime via the on-screen config screen (gear icon → enter PIN).

## Admin keys

| Keys | Action |
|---|---|
| `Super+Shift+A` | Choose speaker/mic (remembered across reboots) |
| `Super+Shift+H` | Restart browser: back to calendar with clean session |

SSH in or `Ctrl+Alt+F2` for a shell.

## Get Debian 13

From https://cdimage.debian.org/debian-cd/current/

- **Intel (production):** `amd64/iso-cd/debian-13.x.x-amd64-netinst.iso`
- **Apple Silicon VM (testing):** `arm64/iso-cd/debian-13.x.x-arm64-netinst.iso`

At **Software selection**, untick every desktop. Keep only SSH server + standard system utilities.

## Testing in UTM

1. Install [UTM](https://mac.getutm.app). Virtualize → Linux: 2 GB RAM, 2 CPUs, 12 GB disk, arm64 ISO.
2. Display: `virtio-gpu-gl-pci`. If screen stays black, add `export WLR_RENDERER=pixman` to `/home/kiosk/.profile`.
3. Set `IDLE_BLANK=20` for quick screensaver testing.

## Known limits

- **Teams and Meet run as web apps.** No native Linux clients.
- **Long calls can be cut off.** Auto sign-out ends calls after 2 hours if nobody taps "Stay signed in".
- **Camera choice isn't remembered.** Sign-out wipes non-calendar site settings. Use one camera per room.
