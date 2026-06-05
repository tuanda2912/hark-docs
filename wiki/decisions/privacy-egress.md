---
type: decision-digest
title: Privacy & egress (ADR-0027/0028/0029/0030/0031)
status: current
sources: [ADR-0027, ADR-0028, ADR-0029, ADR-0030, ADR-0031]
updated: 2026-06-05
tags: [decisions, privacy, egress, llm, audio]
---

# Privacy & egress (ADR-0027/0028/0029/0030/0031)

Five decisions, all dated 2026-06-02 and all **Accepted** (none superseded), that
build Hark's privacy/data-control model and the single, auditable path by which
user content may leave the machine. They split into two halves: **what sensitive
data is stored at rest** (the opt-in gates of [0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md)
and the audio-WAV write of [0028](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0028-meeting-audio-persistence.md)),
and **how the LLM features open the first outbound network** — calls from Electron
main ([0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)), `safeStorage` key
storage ([0030](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0030-api-key-storage.md)), and content redaction +
the metadata-only cloud-call log ([0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md)).
These embody `CLAUDE.md` hard rules #1 (audio leaves only via an explicit
user-invoked path), #2 (vault-only for content), #3 (no exfiltration), #5
(voiceprints stay local), and #6 (ADR before any network socket). See
[[privacy-data-control]], [[egress-governance]], and [[threat-model]] for the
concepts these enact, and [[glossary]] for terms.

> Causal chain: 0027 plumbs the `keep_audio` + `remember_speakers` gates but leaves
> the audio write as a `TODO(slice B)` → 0028 fills it in. Separately, Phase 6's
> LLM features need the app's first outbound socket → 0029 puts it in main, 0030
> stores the key it needs, and 0031 governs what content crosses and logs it.

## The decisions

### ADR-0027 — Privacy & data-control model (opt-in gates)
- **Status:** Accepted (2026-06-02). Not superseded.
- **Decision:** three sensitive artifacts, each user-governed. **Transcript** is
  always stored (it's the product). **Audio recording** and **voiceprint**
  (`vault/.speakers/`) are both **opt-in, off by default, and never synced by
  default**. An onboarding privacy step asks the user to knowingly enable *Keep
  audio* and *Remember speakers* (both default OFF if skipped; always changeable in
  Settings → Privacy).
- **Engine enforcement:** `capture.start` carries `keep_audio` + `remember_speakers`
  (default false). The engine **stores/matches voiceprints only when
  `remember_speakers`** and **persists audio only when `keep_audio`** — absent flags
  ⇒ false ⇒ nothing sensitive stored.
- **Why:** voiceprints are biometric data (GDPR special-category, BIPA) and stored
  audio carries all-party-consent recording weight; an explicit informed-consent
  moment is the defensible posture. Silent privacy-first defaults and
  remember-speakers-on-by-default were both **rejected**; storing in app-data
  (outside the vault) was rejected as a rule-#2 violation. Audio + voiceprints are
  **gitignored** so they never travel a vault git remote; folder-sync (iCloud/Dropbox)
  is disclosed.
- **Embodied by:** [[privacy-data-control]], [[speaker-enrollment]], [[audio-store]],
  [[threat-model]]. Maps to `CLAUDE.md` rules #1/#2/#5.
- → [../decisions/0027-privacy-data-control-model.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md)

### ADR-0028 — Meeting audio persistence (opt-in WAV, slice B)
- **Status:** Accepted (2026-06-02). Not superseded. Fills in 0027's `keep_audio`
  `TODO(slice B)`.
- **Decision:** when — and **only when** — `keep_audio` is true, write the
  whole-meeting mixed PCM (already buffered in memory for the offline diarization
  pass) as a **16 kHz mono signed-16-bit-LE WAV** via the existing `HarkCore.WAVWriter`,
  atomically (temp + rename). **Location:** `<vaultRoot>/.audio/<meeting-id>.wav`,
  where the stem matches the meeting's markdown file (`2026-06-02-1436.wav` ↔
  `….md`). A hidden `.audio/` folder at the vault root, parallel to `.speakers/`,
  **not** inside the git-tracked `meetings/`, and **gitignored idempotently** on
  creation.
- **Wire + gate:** `meeting.saved` gains `audio_path` (`audioPath: String?` ↔ JSON
  `audio_path`, explicit `null`, never dropped). `AudioStore.audioPersistenceAllowed(keepAudio:)`
  mirrors `voiceprintAccessAllowed`; gate off ⇒ **zero `.audio/` I/O**, proven by
  `testGateOffMeansZeroAudioIO`.
- **Why:** unblocks the Post-Meeting Review screen (verify-by-ear → assign speaker)
  with zero extra memory (reuses the diarization buffer) and zero new network
  surface. Compressed audio (AAC/Opus) **deferred** (WAV reuses `WAVWriter` + plays
  natively in `<audio>`); co-locating in `meetings/` and storing in app-data both
  **rejected** (git-tracked / rule #2). Tradeoff: WAV is large (~1.9 MB/min; 1 hr ≈
  115 MB), and audio only persists when the diarizer loaded (the buffer is
  accumulated only when `diarizer != nil`) — both logged in BACKLOG.
- **Embodied by:** [[audio-store]], [[vault-writer]], [[wire-protocol]],
  [[privacy-data-control]].
- → [../decisions/0028-meeting-audio-persistence.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0028-meeting-audio-persistence.md)

### ADR-0029 — LLM provider layer & network egress (main-process, provider-agnostic)
- **Status:** Accepted (2026-06-02). Not superseded. **First outbound network in
  the app** — privacy-audited before merge (rule #6).
- **Decision:** **LLM calls originate in the Electron main process (Node)** — never
  the Swift engine, never the sandboxed renderer. The renderer calls main over IPC;
  main streams results back via IPC events.
  - **Why not the engine:** keeps `harkd` network-free, preserving its audited
    "never opens an outbound socket" property; the engine is the most privileged
    process (holds TCC audio) and is the wrong place for an HTTP client.
  - **Why not the renderer:** the renderer stays sandboxed with an unchanged,
    loopback-only CSP, and **the API key never enters the renderer/DevTools context**.
- **Provider abstraction:** an `LlmProvider` interface in main with **Anthropic-native**
  (`https://api.anthropic.com`) and **OpenAI-compatible** (configurable `baseUrl`
  covering OpenAI/Gemini/OpenRouter in the cloud **and** Ollama/LM Studio/llama.cpp on
  `localhost` — local = zero egress). **No vendor SDK** — Node's built-in `fetch`
  against documented REST endpoints (avoids SDK telemetry + supply-chain surface;
  means we parse SSE ourselves).
- **Privacy invariants:** text only ever crosses (main has **no audio path** into a
  provider); single egress chokepoint; user-invoked only; every call logged
  (metadata, never content); PII redaction ON by default before any *cloud* send;
  CSP unchanged.
- **Embodied by:** [[llm-egress]], [[egress-governance]], [[electron-main]],
  [[preload-security]], [[threat-model]]. Maps to rules #1/#3/#6.
- → [../decisions/0029-llm-provider-layer-egress.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)

### ADR-0030 — LLM API key storage (Electron safeStorage / OS Keychain, main-only)
- **Status:** Accepted (2026-06-02). Not superseded.
- **Decision:** use **Electron `safeStorage`** (on macOS this derives its key from
  the **Keychain**) to encrypt the API key in the **main process**.
  `safeStorage.encryptString(key)` → base64 ciphertext stored in app-data in a file
  **separate from `prefs.json`**: `~/Library/Application Support/Hark/llm-keys.json`,
  one entry per provider. **Decrypt only in main**, only to inject into the provider's
  `Authorization` / `x-api-key` header at call time.
- **Renderer isolation:** the renderer can `setApiKey` / `clearApiKey` and query
  **`hasKey: boolean`**, but can **never read the key back** across the bridge. Keys
  are never logged, never plaintext. If `safeStorage.isEncryptionAvailable()` is
  false, fail gracefully ("key storage unavailable") — never fall back to plaintext.
- **Why:** secure at rest, no native dependency, matches the design promise "Hark
  never sees your key." `keytar` **rejected** (extra native dep to build/sign/notarize);
  plaintext in `prefs.json` and a Swift Keychain helper in the engine both **rejected**.
  Tradeoff: ciphertext is bound to the app's OS-derived key, so a change in app
  identity (or a different machine) means re-entering the key.
- **Embodied by:** [[llm-egress]], [[electron-main]], [[preload-security]],
  [[egress-governance]]. Credential in app-data, not vault content (rule #2 fine).
- → [../decisions/0030-api-key-storage.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0030-api-key-storage.md)

### ADR-0031 — Content egress governance (local-vs-cloud, PII redaction, cloud-call log)
- **Status:** Accepted (2026-06-02). Not superseded. Phase 6 slice 2 — the **first
  time user content (transcript text) leaves the machine**.
- **Decision (5 parts):**
  1. **Local vs cloud is the first fork.** Local provider (OpenAI-compatible with a
     `localhost`/`127.0.0.1` base URL) → send the **full transcript, no redaction** (it
     never leaves the Mac). Cloud provider → **redact before send**.
  2. **Redaction (cloud only), ON by default, v1 scope:** regex-replaced typed
     placeholders for emails, phone numbers, money amounts, long digit runs (≥ 7
     digits), URLs; plus the meeting's **known speaker display-names** collapsed to
     their labels (`"Tuan"` → `"Speaker 1"`). Returns per-category counts.
  3. **Honest limitation:** arbitrary names in free speech are **not** auto-detected
     (no NER yet); the on-screen receipt + log state exactly what was redacted and
     must not overclaim. NER is BACKLOG.
  4. **Cloud-call log (transparency):** every summarize / future Q&A / translation
     action is logged locally to app-data `cloud-calls.json` — timestamp, action,
     provider, model, **egress (cloud|local)**, char counts in/out, redaction total,
     status, optional cost. **Transcript content is NEVER logged — metadata only.**
     Local actions logged too, marked `egress: local`. Surfaced in Settings → Privacy.
  5. **Never sent:** audio, voiceprints — only (redacted, if cloud) transcript text.
- **Persistence through the engine:** the generated summary is written back to the
  meeting markdown by the **engine** (`VaultWriter` appends `## Summary` + a local
  git-commit) via a `summary.write` wire command — **not** by main writing the vault
  behind the engine's back, keeping vault writes single-owner (rule #4). Mirrors the
  `speaker.rename` command shape (ADR-0020).
- **Why:** cloud egress is redacted + fully logged; local is full-quality + zero-egress.
  Redacting for local models, no cloud redaction, full NER now, and main appending the
  summary directly were all **rejected**.
- **Embodied by:** [[egress-governance]], [[llm-egress]], [[vault-writer]],
  [[threat-model]]. Maps to rules #1/#3/#4.
- → [../decisions/0031-content-egress-redaction-log.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md)

## Invariants these lock in

- **Two opt-in gates, both default OFF:** `keep_audio` and `remember_speakers` ride
  `capture.start`; absent ⇒ false ⇒ nothing sensitive stored (0027). Audio persists
  only when `keep_audio` (0028); voiceprints only when `remember_speakers` (0027 +
  [[speaker-enrollment]]).
- **Audio + voiceprints live in the vault, hidden + gitignored** (`.audio/`,
  `.speakers/`), never inside git-tracked `meetings/`, never on a vault git remote
  (0027/0028). See [[audio-store]].
- **One egress chokepoint, in Electron main.** The engine stays network-free; the
  renderer's CSP stays loopback-only; the API key never enters the renderer (0029/0030).
- **Only text crosses, never audio or voiceprints; cloud sends are redacted by
  default; every LLM call is logged metadata-only** (0029/0031). See [[egress-governance]].
- **Vault writes stay single-owner** — even the LLM summary goes back through the
  engine's `VaultWriter` + git (0031, rule #4). See [[vault-writer]].

## See also

- [[privacy-data-control]] · [[egress-governance]] · [[llm-egress]] ·
  [[preload-security]] · [[audio-store]] · [[speaker-enrollment]] · [[threat-model]]
  · [[glossary]]
- Related digests: [[foundations]] (ADR-0004 no cloud ASR — the Claude API edge),
  [[diarization-speakers]] (ADR-0026 enrollment — the gate 0027 mirrors),
  [[vault-rag-decisions]], [[translation]].
