---
type: decision
title: macOS packaging, signing & notarization
status: current
sources: [docs/decisions/0021-macos-app-packaging.md, docs/decisions/0038-notarization-signing-chain.md]
updated: 2026-06-30
tags: [decision, packaging, signing, notarization, macos]
---

# Decision — macOS packaging, signing & notarization

How Hark ships as a single `.app`: an Electron/Angular shell plus the Swift `harkd` sidecar
([[streaming-daemon]]), signed and notarization-ready without breaking the local-first posture.

## Packaging (`0021`)
- **electron-builder.** `harkd` is a **single self-contained static binary** (`otool -L` shows only
  system frameworks + the OS Swift runtime — WhisperKit/FluidAudio/NIO statically linked), shipped via
  `extraResources` to `Contents/Resources/engine/harkd`. No dylib co-location / `@rpath` rewriting —
  the classic hardened-runtime signing footgun avoided entirely (`0021`).
- **Hardened runtime on.** App entitlements: `allow-jit`,
  `allow-unsigned-executable-memory` (an Electron requirement, **app-only**, never inherited),
  `device.audio-input`. Nested binaries get **inherit** entitlements
  (`com.apple.security.inherit` + `allow-jit` + `device.audio-input`) so `harkd` runs under the app's
  identity and **TCC attributes the audio grant to "Hark"** — and it persists across launches (`0021`,
  building on ADR-0011 #18).
- Bundle id `com.hark.app`, **arm64-only**. **No App Store sandbox** (would break the loopback WS, the
  out-of-container vault, and Process Tap APIs). **No auto-update, no telemetry** (`0021`).
- **Strict CSP forces a build tweak:** Angular's critical-CSS inlining is **disabled**
  (`inlineCritical: false`) because its inline `onload` handler is blocked by the
  `script-src 'self'` CSP — otherwise the packaged `file://` app loads unstyled (`0021`; see
  [[preload-security]]).

## Signing chain & notarization (`0038`, amends `0021`)
A Phase-7 audit found a **signing gap**: `harkd` under `Resources/` didn't match electron-builder's
`nested` re-sign rule, so it was sealed only as an opaque resource hash with **no inherit
entitlements** — breaking TCC attribution and failing notarization (`0038`). The fix:
- **Sign harkd explicitly via `mac.binaries: [Contents/Resources/engine/harkd]`** — app-builder-lib
  applies the inherit entitlements + hardened runtime to every signed file except the app root, signing
  deepest-first so `harkd` is sealed before the parent re-seals over it (`0038`).
- **Two-tier certs:** **free "Apple Development"** signs for local dogfood + on-device TCC validation
  but **cannot notarize**; **paid Developer ID Application** is the release path —
  deep-sign → `notarytool --wait` → **staple** (`0038`).
- The `afterSign` `build/notarize.js` hook is **env-gated** (no-op without full Apple credentials), so
  dev builds never contact Apple; it now also staples. Electron's default
  `NSCamera`/`NSBluetooth*UsageDescription` strings are blanked — Hark uses neither (`0038`).

## Status / what's deferred
Notarization + Developer ID enrollment are still **BACKLOG** (the free cert can't notarize, so builds
aren't Gatekeeper-clean on other Macs); arm64-only stands; on-device re-verification after the
`mac.binaries` fix is still required (`0038` §Open questions). The lifecycle owner of the packaged app
is [[electron-main]]; the privacy rationale is [[local-first-egress]].
