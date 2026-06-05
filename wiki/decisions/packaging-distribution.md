---
type: decision-digest
title: Packaging & distribution (ADR-0021/0038)
status: current
sources: [ADR-0021, ADR-0038]
updated: 2026-06-05
tags: [packaging, signing, notarization, tcc, electron, privacy]
---

# Packaging & distribution (ADR-0021/0038)

How Hark becomes a shippable macOS `.app`: **electron-builder bundles the `harkd` sidecar via `extraResources` into `Contents/Resources/engine/harkd`, with hardened runtime and split entitlements so the nested binary inherits the app's identity (`com.apple.security.inherit`) and TCC attributes the audio-capture grant to "Hark"** (0021). ADR-0038 **amends** that: it closes a signing gap where `harkd` under `Resources/` was never actually re-signed (so `inherit` was never applied), fixing it with an explicit `mac.binaries` entry, and records the full **sign → notarize → staple** chain (0038). For the spawn-and-handshake runtime, see [[electron-main]]; the privacy framing is [[threat-model]].

## At a glance

| ADR | Title | Status | Supersession |
|---|---|---|---|
| 0021 | macOS app packaging — Electron + bundled harkd sidecar | Accepted | **amended by 0038** (the nested-`harkd` signing gap + the notarize/staple chain) |
| 0038 | Notarization signing chain + explicit harkd sidecar signing | Accepted | **amends 0021** |

## ADR-0021 — macOS app packaging (Electron + bundled harkd sidecar)

[../decisions/0021-macos-app-packaging.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0021-macos-app-packaging.md) · 2026-06-02 · **Accepted** · **amended by ADR-0038**

The first real `.app`: before this, the engine ran from `swift build` output and the UI from `ng serve`. Decisions:

- **electron-builder** (over electron-forge — no leverage to switch; its `extraResources` + `entitlementsInherit` + notarize-hook story fit cleanly). Bundle id **`com.hark.app`**, **arm64-only** for v1.
- **`harkd` is a single self-contained static binary** — `otool -L` shows only system frameworks + the OS Swift runtime (WhisperKit / FluidAudio / NIO statically linked, no dylibs to co-locate). Shipped via **`extraResources`** to **`Contents/Resources/engine/harkd`**. This sidesteps the classic hardened-runtime `@rpath` deep-signing footgun entirely.
- **Hardened runtime on.** App entitlements: `allow-jit`, `allow-unsigned-executable-memory` (Electron requirement), `device.audio-input`. Nested binaries get **inherit** entitlements — `com.apple.security.inherit`, `allow-jit`, `device.audio-input` — so `harkd` runs under the app's identity and **TCC attributes the audio grant to "Hark"** (the broad `allow-unsigned-executable-memory` is app-only, never inherited). Rejected: giving `harkd` its own code identity (`com.hark.daemon.dev`), which would make TCC attribute the grant to "harkd" — a confusing System Settings entry and a grant that may not persist.
- **Local-signed-first.** A constraint shaped everything: the user has a **free "Apple Development"** cert, not a paid **Developer ID**. The free cert signs for local execution (enough to validate the app + TCC on-device) but **cannot notarize** — so notarization was **deferred to BACKLOG**. The `afterSign` notarize hook (`build/notarize.js`) no-ops unless `APPLE_*` env vars are present, so dev builds never contact Apple.
- **Disable Angular critical-CSS inlining** (`optimization.styles.inlineCritical: false`): its async-stylesheet trick uses an inline `onload` handler, blocked by the strict CSP (`script-src 'self'`, no `'unsafe-inline'`) — leaving the packaged `file://` app unstyled. A plain `<link>` costs nothing on a local load.
- Rejected: **App Store sandbox** (`com.apple.security.app-sandbox`) — would break the loopback WS handshake, the out-of-container vault, and Process Tap APIs; only the App Store needs it. **Universal arm64+x86_64** build — Apple Silicon is the only target (CLAUDE.md).

**Verified on-device (2026-06-02):** packaged app launches, `harkd` spawns from the bundle, the system-audio prompt names **"Hark"**, transcription works, grant persists across relaunch. *(But see ADR-0038: this likely passed only because a manually re-signed `harkd` was present — the unattended `npm run dist` path did not reproduce it.)*

Must remain true: `harkd` stays a single self-contained binary (else revisit bundling + deep-signing); the strict CSP stays (keep `inlineCritical: false`); Apple Silicon only.

## ADR-0038 — Notarization signing chain + explicit harkd sidecar signing

[../decisions/0038-notarization-signing-chain.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0038-notarization-signing-chain.md) · 2026-06-04 · **Accepted** · **amends ADR-0021**

The record ADR-0021 promised ("Packaging ADR (TBD) will record the signing chain"), plus a **signing gap** found in the Phase 7 packaging-hardening review.

**The gap.** A packaging-mechanics audit of an existing dev bundle (`ui/release/mac-arm64/Hark.app`, free dev cert) showed `Contents/Resources/engine/harkd` was sealed in `_CodeSignature/CodeResources` as an **opaque resource hash** (`files`/`files2` `hash2`) — *not* as a nested code item with its own `cdhash` + designated `requirement`, the way Electron helpers and frameworks were. electron-builder's deep-sign pass only re-signs Mach-Os matching its `nested` resource rule (`^(Frameworks|…|Helpers|MacOS|Library/…)/`); a file under `Resources/` does not match, so **`entitlementsInherit` was never applied to `harkd`**. It kept whatever signature `swift build` produced (ad-hoc — SwiftPM does not sign) and carried **no `com.apple.security.inherit`**. Two serious consequences: (1) at runtime the spawned `harkd` child runs under its **own** identity, so `kTCCServiceAudioCapture` does not reliably attribute to "Hark" or persist — the exact thing [[capture-audio|ADR-0011 #18]] needs; (2) an ad-hoc / non-inheriting nested Mach-O **fails notarization**.

**The fix (four parts):**

1. **Sign `harkd` explicitly via `mac.binaries`.** Add to `ui/electron-builder.yml`: `mac: binaries: [Contents/Resources/engine/harkd]`. app-builder-lib 25.1.8's `macPackager.getOptionsForFile()` applies the **inherit** entitlements (`entitlements.mac.inherit.plist`: `com.apple.security.inherit` + `allow-jit` + `device.audio-input`) + hardened runtime to **every signed file except the app root** — so `harkd` gets exactly the inherit set and NOT the broad app-only `allow-unsigned-executable-memory`. The signer runs **deepest-first**, so `harkd` is signed before the parent bundle re-seals over it. *This* is the unlock that makes `harkd` inherit Hark's identity. Rejected alternatives: a custom `afterPack`/`codesign` hook (reinvents `mac.binaries`, easy to get entitlements/ordering wrong); moving `harkd` into `Contents/MacOS/` or `Helpers/` so the `nested` rule catches it (churns the working spawn path / layout to avoid a one-line config key).
2. **The signing chain.** *Dev/dogfood:* free **Apple Development** cert — signs everything for local execution, validates TCC on-device, **cannot notarize**. *Release:* paid Developer Program + **Developer ID Application** cert; `npm run dist` with `CSC_NAME` set; electron-builder deep-signs **app → helpers/frameworks → harkd** with hardened runtime; then the `afterSign` hook submits to Apple's notary via `notarytool --wait` and **staples** the ticket into the `.app`.
3. **Notarize hook stays env-gated and now staples.** `build/notarize.js` is a NO-OP unless a full credential set is present (Apple-ID+password OR App Store Connect API key), keeping dev builds offline. It now **staples + validates** after a successful notarize (`@electron/notarize` only submits, never staples; only electron-builder's own `mac.notarize` path auto-staples, which Hark does not use). It also supports the API-key auth the config header always advertised. Rejected: driving notarization via `mac.notarize: true` (auto-staples, but harder to make a clean offline NO-OP; the explicit env-gated hook is clearer about *when* a network call to Apple happens — CLAUDE.md rules #3 / #6).
4. **Suppress Electron's default usage strings.** electron-builder's base Info.plist injects `NSCameraUsageDescription` + `NSBluetooth*UsageDescription`; Hark uses neither, and a shipped app advertising unused camera access is a privacy smell — blanked via `extendInfo`.

The **`.dmg` staple is a separate manual post-build step** (the afterSign hook only sees the `.app`, before the dmg exists) — documented in the runbook.

Must remain true: `harkd` stays a single self-contained static Mach-O (else revisit the `mac.binaries` list + signing order); the inherit plist keeps `com.apple.security.inherit` (drop it and TCC attribution breaks again); the notarize hook stays env-gated (must never contact Apple on a dev build). Tradeoff: `mac.binaries` is brittle to the `extraResources` `to:` path — both must reference `Contents/Resources/engine/harkd` in lockstep.

> TODO(wiki): **On-device re-verification still REQUIRED.** ADR-0038's fix is verified only at the config / CodeResources-structure level. It has **not** yet been re-verified on real hardware after a fresh `npm run dist` with the `mac.binaries` change — `codesign -dvvv` on the nested `harkd` must show the inherit entitlements + `runtime` flag, and a launched build's TCC prompt must say "Hark". (Open in ADR-0038.)

## Where these decisions live in the code

The packaging config and signing chain live entirely under `ui/`:

- `ui/electron-builder.yml` — `extraResources` layout, hardened runtime, `entitlementsInherit`, `mac.binaries`, `extendInfo` plist suppression.
- `ui/build/entitlements.mac.plist` — app-only entitlements (incl. `allow-unsigned-executable-memory`).
- `ui/build/entitlements.mac.inherit.plist` — the inherit set (`com.apple.security.inherit` + `allow-jit` + `device.audio-input`) applied to `harkd`.
- `ui/build/notarize.js` — env-gated `afterSign` hook: submit via `notarytool` then staple + validate.
- `ui/src/main/harkd-spawn.ts` — the prod spawn path resolves `process.resourcesPath/engine/harkd`; the runtime side of this packaging contract lives in [[electron-main]].

The TCC attribution this whole chain protects is the audio-capture grant from [[capture-audio]] / [[audio-capture]] (`kTCCServiceAudioCapture`, ADR-0011 #18). The "no silent network / no telemetry / minimal entitlements" framing is [[threat-model]] (rules #1, #3, #6). Terms like hardened runtime, `com.apple.security.inherit`, notarization, stapling, `cdhash`, and TCC are in [[glossary]].

## See also

[[electron-main]] · [[tray]] · [[threat-model]] · [[capture-audio]] · [[audio-capture]] · [[glossary]]
