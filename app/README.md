# Sangyin App (`sangyin-app`)

The Sangyin client — one Expo / React Native codebase that runs on **web**, **iOS**,
and **Android**, talking to a [Sangyin backend](../backend/README.md) over its REST API.

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
│   ├── index.tsx        Library
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
- Dependency versions target **Expo SDK 52**. If you bump the SDK, run
  `npx expo install --fix` to realign native module versions.
