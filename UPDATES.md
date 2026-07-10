# Updates — "Warm Retro Hybrid" UI pass

A reskin + additive-motion pass over the Sangyin app frontend (`app/`). It keeps the
existing "Fernwood" earth-tone palettes (Sage / Clay / Loam) and the Bricolage + Hanken
type, and layers retro structural motifs on top: a boot intro, marquee tickers, XP-ish
window-chrome cards, and an opt-in web-only sound layer.

> Status: implemented on branch `claude/ios-eas-setup`. Not committed. Typecheck passes
> (`cd app && npm run typecheck`) and the web bundle builds clean (`npx expo export --platform web`).
> **The reader's playback/streaming/pregen/media-session logic was not changed — style only.**

---

## New files

| File | What it is |
|---|---|
| `app/src/sfx/sfx.ts` | Tactile UI sound. Web-only synthesized blips (`tap`/`toggle`/`confirm`/`back`) via one lazy `AudioContext`; a hard **no-op on native**. Never touches expo-audio, `setAudioModeAsync`, or the TTS `<audio>` elements, so it can't disturb narration. Gated by the `sfxEnabled` store flag. |
| `app/src/fx/useReduceMotion.ts` | Reads the in-app `reduceMotion` preference. |
| `app/src/fx/Marquee.tsx` | Infinite horizontal ticker (reanimated `withRepeat` translateX, UI-thread, `ReduceMotion.Never`). Renders content twice for a seamless loop; a single static copy under reduce-motion. Chrome text only. |
| `app/src/fx/Scramble.tsx` | Mount-time character "decode" scramble that resolves to the final text. Fixed-width hidden sizer so it never reflows; prints final text at once under reduce-motion. |
| `app/src/fx/BootScreen.tsx` | Calm "warming up" intro overlay, shown once per launch. Gated on store hydration so a persisted `reduceMotion` is never briefly ignored. Tap-to-skip; instant-dismiss under reduce-motion. |
| `app/src/components/retro.tsx` | Retro primitives built on the theme: `Window` (beveled card + optional title bar), `TitleBar`, `BevelButton` (drop-in for `Button`, pressed inset flip + SFX), `SegmentedControl<T>`, `RetroChip`, `SegMeter` (blocky progress bar). Re-exports the calm `ui.tsx` primitives. |

## Modified files

| File | Changes |
|---|---|
| `app/src/theme.ts` | Added `tokens.fonts.mono` (Space Mono on web / system monospace on native), chrome tokens (`radiusChrome: 2`, `bevelWidth: 2`, `chromeBarHeight: 28`, `chromeDot: 10`), a `mix()` color-lerp helper, a `bevel()` function (opaque per-edge colors derived from the palette + `isDark`), and a `useRetro()` hook. Extended the `Theme` interface / `buildTheme`. **`Palette` shape unchanged.** |
| `app/app/+html.tsx` | Added Space Mono to the existing Google Fonts request. |
| `app/src/store/appStore.ts` | Added `sfxEnabled` (default `false`) and `reduceMotion` (default `false`), both persisted, plus a session-only `bootSeen` (not persisted → intro shows once per cold start), with setters. Added `useHasHydrated()`. No `version` bump / no custom merge, so existing persisted `positions` / `themeName` / `backendUrl` are preserved. |
| `app/app/_layout.tsx` | Mounts `<BootScreen />` above the `Stack`; binds `sfx.setEnabled(sfxEnabled)`; web-only one-shot gesture listener calls `sfx.unlock()`; header title font switched to mono. **`setAudioModeAsync` effect left untouched.** |
| `app/app/settings.tsx` | Cards → `Window`; theme / voice / speed chips → `SegmentedControl` (theme uses swatches). New **"Sound & Motion"** window with two `Switch` rows: Sound effects (`sfxEnabled`) and Reduce motion / skip intro (`reduceMotion`). |
| `app/app/library.tsx` | Toolbar buttons → `BevelButton`; document cards → `Window` (source tag in the title bar, `%` read badge); progress bar → `SegMeter`; empty/error states → dialog `Window`s; SFX on open/import/remove. |
| `app/app/import.tsx` | Paste/URL/File tabs → `SegmentedControl`; cards → `Window`; text inputs → inset beveled fields; busy overlay → a retro processing dialog with a `Marquee` "barber-pole"; SFX on tab switch + submit. |
| `app/app/index.tsx` (landing) | Approach / Guide / Gallery cards → `Window`; added a `Marquee` ticker band; hero word "deep" → `Scramble`; wordmark badge → mono; theme pills → `SegmentedControl`; `Anim` now drops translate/scale/rotate to opacity-only under reduce-motion. The pinned-stage scroll architecture (`Stage`/`Anim`) was kept. |
| `app/app/reader.tsx` | **Style only.** Header → mono title bar; chapter + PDF toggles → `SegmentedControl`; transport dock → beveled "transport" panel with beveled buttons (glyphs `⏮ ▶ ❚❚ ⬇ ⏭` and all conditionals kept verbatim); pregen bar → `SegMeter` (same `%` math); speed/voice/prepare → `RetroChip`; bumped list `paddingBottom` for the taller dock. Active-sentence highlight kept at identical box metrics (color/background/weight only) so auto-scroll stays aligned. No streaming/pregen/media-session/OCR logic touched. |

---

## Design notes (why things are the way they are)

- **Bevels are opaque, on square (radius-2) chrome.** Translucent per-side borders collapse to a
  uniform border on iOS/Android once a `borderRadius` is set, so edges are precomputed opaque colors
  via `mix()` and chrome is kept near-square — web and native render identically.
- **Sound is opt-in, off by default,** and web-only. This keeps the "calm by default" feel and avoids
  any interaction with the native TTS audio session.
- **Reduce motion** (Settings) suppresses the intro, marquees, parallax, and scramble.
- **Boot intro** is gated on store hydration to avoid a first-frame flash of the wrong motion setting.

## Not yet done / left for device QA

- Manual on-device check that SFX (if enabled) doesn't disturb TTS on iOS Safari (single audio session).
- Visual pass across all three themes on a real device, incl. dark **Loam** bevels.
- Nothing is committed.
