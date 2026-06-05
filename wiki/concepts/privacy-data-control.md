---
type: concept
title: Privacy & data-control (opt-in gates)
status: current
sources: [ADR-0026, ADR-0027, ADR-0028, engine/Sources/Harkd/EngineSession.swift, ui/src/app/services/preferences.service.ts]
updated: 2026-06-05
tags: [privacy, consent, gates, audio, voiceprints]
---

The governance model for Hark's three sensitive artifacts: the **transcript** is
always written (it *is* the product, vault-local), while **stored audio** and
**voiceprints** are **opt-in, default OFF** — enforced by the `keepAudio` /
`rememberSpeakers` flags sent on `capture.start`, surfaced for informed consent
in onboarding, reversible in Settings → Privacy, and gitignored so they never
travel a remote.

This is the *data-at-rest* half of Hark's privacy posture. The *data-in-motion*
half (what may leave the machine) is [[threat-model]] + [[egress-governance]] /
[[privacy-egress]]. This page is about what gets *stored*.

## The three artifacts (ADR-0027)

| Artifact | Purpose | Stored | Synced |
|---|---|---|---|
| Transcript (markdown) | the meeting notes | **always** (the product) | the user's vault, their choice |
| Audio recording | verify-by-ear review/playback | **opt-in** (off unless enabled) | off by default |
| Voiceprint (`vault/.speakers/`) | recognize speakers across meetings | **opt-in** | off by default |

The asymmetry is deliberate. The transcript is the reason Hark exists, so it is
never gated. Audio and voiceprints carry real legal weight — all-party-consent
recording statutes and biometric-privacy law (GDPR special-category data,
Illinois BIPA) — *especially* for **other** meeting participants. Storing them
without an explicit choice, or silently syncing them off the Mac, is a liability.
So both are dormant until the user knowingly turns them on (ADR-0027).

## Two flags, one default

Everything reduces to two booleans, both **default false**:

- **`keepAudio`** — persist the whole-meeting audio for the future Post-Meeting
  Review screen (ADR-0028).
- **`rememberSpeakers`** — store and match voiceprints, i.e. enable
  [[speaker-enrollment]] (ADR-0026).

(Two further forward-looking flags, `syncAudio` / `syncSpeakers`, capture sync
*intent* for a future Hark-native sync; they don't yet gate engine behavior —
`ui/src/app/services/preferences.service.ts`.)

## Enforcement — the engine is the gate

The flags are carried on every `capture.start` and read by `harkd`. The renderer
sends camelCase; they arrive on the wire **snake_case** (`keep_audio` /
`remember_speakers`) and fold to Swift properties via `CodingKeys`
(`engine/Sources/Harkd/WireProtocol.swift`). See [[wire-protocol]].

The **single point** where "absent" becomes "off" is the coalesce in
`EngineSession.handle`'s `capture.start` branch — there is no other default
(`engine/Sources/Harkd/EngineSession.swift`):

```swift
// Privacy gates (ADR-0027): absent ⇒ false = privacy-safe.
let keepAudio = cmd.keepAudio ?? false
let rememberSpeakers = cmd.rememberSpeakers ?? false
```

Both are threaded into the session via `startCapture(...)` and retained for the
meeting's whole lifetime. They are **load-bearing gates**, not hints:

- **`rememberSpeakers`** — `voiceprintAccessAllowed(rememberSpeakers:)` is checked
  before *any* `.speakers/` access. When false: enroll-on-rename is skipped and
  auto-match is skipped — **zero `.speakers/` I/O** (the store is never even read).
- **`keepAudio`** — audio is persisted only in `persistMeeting`'s slice-B write,
  passed straight to `AudioStore.persist(meetingId:samples:keepAudio:)`. The store's
  own gate (`audioPersistenceAllowed(keepAudio:)`, mirroring `voiceprintAccessAllowed`)
  guarantees **zero `.audio/` I/O** when off — no dir, no temp file, no write (proven
  by `testGateOffMeansZeroAudioIO`, ADR-0028).

So a `capture.start` with neither flag stores nothing sensitive beyond the
transcript. The gate lives in the engine, not the UI — a malformed or omitted
field fails safe to off.

## Surfacing for informed consent

ADR-0027 chose an **explicit onboarding opt-in** over silent privacy-first
defaults — an informed-consent moment is legally stronger. The renderer state
lives in `PreferencesService` (`ui/src/app/services/preferences.service.ts`),
all flags `DEFAULT_PREFS.privacy.* = false`:

- **Onboarding privacy step** — asks the user to knowingly enable *Keep audio* and
  *Remember speakers*; both stay OFF if skipped. See [[ui-onboarding]].
- **Settings → Privacy** — a "what's stored / where" pane with the same toggles
  plus delete actions; both write through `PreferencesService.setPrivacy(...)`,
  which persists immediately. Fully **reversible**.
- A partial/missing privacy block on load reads as **all-false** (the
  privacy-first state) via `!!pv?.…` — an older `main` can't accidentally enable
  anything.
- A plain-language **legal note**: recording and storing voiceprints may require
  consent under local law; the user is responsible for obtaining it; Hark keeps
  everything on-device to support that; this is not legal advice.

## Where the sensitive data lives — and why gitignored

Both artifacts live in **hidden, gitignored folders at the vault root**, parallel
to each other and deliberately *outside* git-tracked `meetings/`:

- **Voiceprints** → `vault/.speakers/<uuid>.json` — one file per person, UUID
  filename (no PII in filenames), 256-dim L2-normalized centroid. Gitignored
  since ADR-0016. See [[speaker-enrollment]], [[diarization]].
- **Audio** → `vault/.audio/<meeting-id>.wav` — 16 kHz mono S16LE WAV, atomic
  write, `<meeting-id>` is the **exact stem** of the meeting's `.md`
  (`2026-06-02-1436.wav` ↔ `2026-06-02-1436.md`). `.audio/` is added to the vault
  `.gitignore` idempotently when the folder is first created. See [[audio-store]].

Gitignoring is the enforcement that **neither artifact ever travels a vault git
remote** — the same guarantee for both (CLAUDE.md rule #5 spirit). Folder-sync
(iCloud/Dropbox) copies whole folders, so ADR-0027 *discloses* that and lets the
user exclude the folders; a future Hark-native sync will honor per-type toggles.

Storing either outside the vault (e.g. in app-data) was **rejected** — audio and
voiceprints are user content and belong in the vault (CLAUDE.md rule #2).

## Embodying ADRs

- **ADR-0026** — speaker enrollment; introduced the `rememberSpeakers` gating
  pattern that ADR-0028 then mirrored for audio.
  [../decisions/0026-speaker-enrollment.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0026-speaker-enrollment.md)
- **ADR-0027** — the privacy & data-control model itself: three artifacts, two
  opt-in flags, onboarding consent, transparency surfaces.
  [../decisions/0027-privacy-data-control-model.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md)
- **ADR-0028** — fills in the `keepAudio` write path (the slice-B `TODO` ADR-0027
  left open): opt-in WAV in `vault/.audio/`.
  [../decisions/0028-meeting-audio-persistence.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0028-meeting-audio-persistence.md)

All three are digested together in [[diarization-speakers]] (ADR-0026) and
[[privacy-egress]] (ADR-0027/0028 neighbors).

## Invariants (must stay true)

1. **Default OFF, fail-safe.** Absent/malformed `keep_audio` / `remember_speakers`
   ⇒ false. The coalesce in `EngineSession` is the only default.
2. **The engine is the gate**, not the UI. Gates are checked in `harkd` before any
   `.audio/` or `.speakers/` I/O; the UI toggle is just the user's intent.
3. **Gate off ⇒ zero I/O** for that artifact — not "written then ignored." Proven
   for audio by `testGateOffMeansZeroAudioIO`.
4. **The transcript is never gated** — it is the product.
5. **Both folders gitignored** — they never travel a vault git remote.
6. **Everything deletable; nothing stored or synced without an explicit opt-in.**

## Related

[[threat-model]] · [[egress-governance]] · [[privacy-egress]] ·
[[speaker-enrollment]] · [[audio-store]] · [[diarization]] ·
[[diarization-speakers]] · [[ui-onboarding]] · [[wire-protocol]] · [[glossary]]
