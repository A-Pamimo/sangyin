# Sangyin App (`sangyin-app`)

The Sangyin client — one Expo / React Native codebase that runs on **web**, **iOS**,
and **Android**, talking to a [Sangyin backend](../backend/README.md) over its REST API.

> **Hosted app:** https://sangyin-web-m5khb.ondigitalocean.app — a live web build,
> already wired to the hosted backend. The steps below are for running it yourself.

## Prerequisites

- Node.js 18+ and npm
- A running Sangyin backend (see [`../backend/README.md`](../backend/README.md))
- For native builds: the [Expo](https://docs.expo.dev/) tooling (`npx expo`), and for
  store builds an [EAS](https://docs.expo.dev/eas/) account

## Install

```bash
cd app
npm install
```

## Run on web

```bash
npm run web
```

Then open the app, go to **Settings**, and set **Backend URL** to your backend
(default `http://localhost:8000`). Import a document or paste text and press play.

> You can also preset the backend at build time:
> `EXPO_PUBLIC_BACKEND_URL=https://my-host npm run web`.

## Run on a phone (development)

```bash
npm start          # then scan the QR code with Expo Go (iOS/Android)
# or target a simulator/emulator:
npm run ios
npm run android
```

When testing on a physical device, the backend must be reachable from the phone — use
your computer's LAN IP (e.g. `http://192.168.1.20:8000`), not `localhost`, in Settings.

## Deploy the web app

The web app builds to a static site (`app.json` sets `web.output: "single"`), so it
can be hosted anywhere. Bake the backend URL in at build time:

```bash
EXPO_PUBLIC_BACKEND_URL=https://your-backend npx expo export --platform web
# → serves from ./dist  (index.html + a single JS bundle)
```

The repo ships a DigitalOcean static-site spec — [`.do/web.yaml`](../.do/web.yaml) —
that builds this on push and serves it at its own HTTPS URL:

```bash
doctl apps create --spec .do/web.yaml
```

`.node-version` pins the Node used for the cloud build.

## Build for the stores (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android      # produces an .aab/.apk
eas build -p ios          # requires an Apple Developer account (and macOS for local builds)
```

See the [EAS Build docs](https://docs.expo.dev/build/introduction/) for signing and
submission. iOS app-store builds require an Apple Developer account; Android builds can
run from any OS via EAS cloud builders.

## Project layout

```
app/
├── app/                 expo-router screens
│   ├── _layout.tsx      navigation stack
│   ├── +html.tsx        web document shell
│   ├── index.tsx        Landing (immersive scroll + how-to-use guide)
│   ├── library.tsx      Document library
│   ├── import.tsx       Import (paste / URL / file)
│   ├── reader.tsx       Reader + player (streaming, highlighting, transport)
│   └── settings.tsx     Backend URL, voice, default speed
└── src/
    ├── api/             typed client + NDJSON streaming
    ├── player/          PlaybackController, usePlayer, offline cache
    ├── store/           zustand state (backend URL, prefs, resume positions)
    ├── components/      shared UI
    ├── theme.ts
    └── config.ts
```

## Notes

- **Offline playback:** on native, generated audio chunks are cached to disk
  (`expo-file-system`) so already-synthesized audio persists.
- **Streaming:** audio is consumed incrementally from the backend's NDJSON stream
  (true streaming on web; buffered fallback where `fetch` streaming isn't available).
- **Resume:** the Reader remembers your spot per document. Pressing play resumes from
  the saved sentence (the client passes `start_index` to `/tts/stream` so synthesis
  begins mid-chapter instead of from the top). Tapping any sentence plays from there.
- Dependency versions target **Expo SDK 57** (React 19 / React Native 0.86), the
  current SDK — which is also what the **Expo Go** app on your phone supports. If you
  bump the SDK later, run `npx expo install --fix` to realign native module versions.

## Background audio & media controls

- **Background playback:** configured at startup via `setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true, interruptionMode: 'doNotMix' })`, so audio keeps
  playing when the screen locks or the app is backgrounded (`UIBackgroundModes: ["audio"]`
  is set for iOS in `app.json`).
  - **Android:** continuous background audio may require a foreground service. With a
    custom dev build, add the appropriate `FOREGROUND_SERVICE` permissions / config; this
    is not needed for foreground playback or web.
- **Media controls (web / mobile browsers / PWA):** the player wires the
  [Media Session API](https://developer.mozilla.org/docs/Web/API/Media_Session_API), so
  the OS lock screen / notification / media keys show the document title and drive
  play / pause / previous / next.
- **Native lock-screen now-playing (iOS/Android):** the player registers itself for
  lock-screen controls via `expo-audio`'s `setActiveForLockScreen`, showing the document
  title and chapter while playing (requires `interruptionMode: 'doNotMix'`, which is set
  at startup). One caveat of the per-sentence chunk model: the lock screen's seek bar
  reflects the current sentence, not the whole chapter.
