---
type: concept
title: Privacy & data-control model
status: current
sources: [0027]
updated: 2026-06-30
tags: [privacy, consent, data-control, biometric, opt-in]
---

# Privacy & data-control model

How Hark governs its sensitive artifacts: **user-controlled, transparent, privacy-first**
(`0027`). Speaker enrollment stores **voiceprints** (biometric data) and the audio-review screen
needs **stored recordings** — both carry real legal weight (all-party-consent recording statutes;
biometric-privacy law: GDPR special-category data, Illinois BIPA). The posture makes lawful use
*possible* without giving legal advice (`0027` §Context). This is the consent layer beneath the
[[local-first-guarantee]].

## Three artifacts, each user-governed

| Artifact | Purpose | Stored | Synced |
|---|---|---|---|
| Transcript (markdown) | the meeting notes — the product | always | the user's vault, their choice |
| **Audio recording** | verify-by-ear review/playback | **opt-in** (off unless enabled) | **off by default** |
| **Voiceprint** (`vault/.speakers/`) | recognize speakers across meetings | **opt-in** | **off by default** |

(`0027` §Decision.)

## Informed consent, then enforcement

- **Explicit opt-in at onboarding:** a privacy step asks the user to knowingly enable *Keep audio*
  and *Remember speakers*. Both default **OFF** if skipped; always changeable in
  **Settings → Privacy** (`0027`).
- **Engine enforcement:** `capture.start` carries `keep_audio` + `remember_speakers` (default
  false). The engine stores/matches voiceprints **only when** `remember_speakers`, and persists
  audio **only when** `keep_audio`. Absent flags ⇒ false ⇒ nothing sensitive stored (`0027`).
  This enforcement lives in the [[audio-capture]] engine.

## Sync off by default

Audio + voiceprints are **gitignored** — they never travel via a vault git remote. Folder-sync
(iCloud/Dropbox) copies whole folders, so Hark **discloses** that and lets the user
exclude/disable; a future native sync will honor per-type toggles (`0027`).

## Transparency surfaces

README "Your data & privacy"; the onboarding privacy step; a Settings → Privacy pane
("what's stored / where" + toggles + delete actions); and a plain-language **legal note**:
*"Recording and storing voiceprints may require consent under your local laws — you are
responsible for obtaining it. Hark keeps everything on your Mac to support that. This is not legal
advice."* Everything is deletable; nothing sensitive is stored or synced without explicit opt-in
(`0027`).

See [[egress-governance]] for the network boundary and [[threat-model]] for the threats these
controls answer.
