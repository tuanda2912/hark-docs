---
title: User Stories
owner: BA
status: draft
last_updated: 2026-05-24
---

# User Stories

Organized by epic. Each story has acceptance criteria written as Given/When/Then so QA can lift them straight into test cases. Story IDs use the pattern `HARK-{epic}-{n}`.

## Epic A — Live Capture & Transcription

### HARK-A-1: Start and stop recording from the tray

> **As** a user mid-workday
> **I want to** start or stop transcription with one click from my menu bar
> **So that** I don't have to context-switch to a separate app when a meeting begins

**Acceptance criteria:**
- **Given** Hark is running, **When** I click the tray icon and select "Start recording", **Then** capture begins within 500ms and the tray icon turns red
- **Given** capture is active, **When** I select "Stop recording", **Then** capture ends, the meeting is auto-saved to the vault, and the tray icon returns to default
- **Given** I have not granted ScreenCapture permission, **When** I click "Start recording", **Then** the OS permission dialog appears and Hark waits for the result

**Priority:** P0
**Phase:** 4

---

### HARK-A-2: See live captions of the meeting

> **As** a user in a meeting
> **I want to** see what's being said as captions on screen
> **So that** I can follow non-native-language speakers and not miss context

**Acceptance criteria:**
- **Given** capture is active, **When** speech occurs, **Then** partial captions appear in the main window within 1.5s
- **Given** a partial caption is displayed, **When** WhisperKit refines the segment with more context, **Then** the displayed text updates in place (no jarring flicker)
- **Given** a VAD speech boundary is detected, **Then** the segment is finalized, locked, and appended to the persistent transcript

**Priority:** P0
**Phase:** 3–4

---

### HARK-A-3: Pause and resume capture mid-meeting

> **As** a privacy-conscious user
> **I want to** instantly pause capture when something sensitive comes up
> **So that** I retain control over what gets transcribed

**Acceptance criteria:**
- **Given** capture is active, **When** I click the always-visible pause button, **Then** within 200ms no further audio is processed
- **Given** capture is paused, **Then** a clear visual indicator shows "PAUSED" and the tray icon reflects it
- **Given** capture is paused, **When** I click resume, **Then** capture continues and a gap marker (`--- paused for Xs ---`) is inserted into the transcript

**Priority:** P0
**Phase:** 4

---

### HARK-A-4: Bookmark a moment with a hotkey

> **As** a user in a meeting
> **I want to** flag important moments with a single keystroke
> **So that** my post-meeting summary weights them and I can find them later

**Acceptance criteria:**
- **Given** capture is active, **When** I press ⌘⇧B (default), **Then** the current timestamp is bookmarked and a brief visual confirmation appears
- **Given** bookmarks exist, **When** the meeting is summarized, **Then** the LLM prompt explicitly lists bookmarked timestamps as "user-flagged moments"
- **Given** a bookmark exists, **When** I view the saved meeting file, **Then** the bookmark is rendered as `> 📌 [HH:MM:SS]` inline with the transcript

**Priority:** P1
**Phase:** 4

---

## Epic B — Speakers

### HARK-B-1: Identify different speakers in a meeting

> **As** a user reviewing a meeting
> **I want to** see who said what
> **So that** I can attribute decisions and follow conversation threads

**Acceptance criteria:**
- **Given** a meeting has been captured, **When** capture stops, **Then** FluidAudio diarization runs and segments are tagged with `Speaker 1`, `Speaker 2`, …
- **Given** diarization completes, **Then** speaker segments are visually distinguished in the transcript (different colors or labels)
- **Given** the meeting was a 1-person dictation, **Then** all segments are labeled `Speaker 1` without error

**Priority:** P0
**Phase:** 5

---

### HARK-B-2: Tag a speaker with a real name

> **As** a user reviewing a meeting
> **I want to** assign a name to a `Speaker N` label
> **So that** future meetings recognize this person automatically

**Acceptance criteria:**
- **Given** an unlabeled `Speaker N` is shown, **When** I click the label and type a name, **Then** all segments by that speaker in this meeting are renamed and the voice embedding is saved to `vault/.speakers/{slug}.json`
- **Given** a speaker has been tagged in a previous meeting, **When** a new meeting includes their voice, **Then** their segments auto-resolve to the saved name (cosine similarity > threshold)
- **Given** auto-resolution is uncertain (similarity in the ambiguous band), **Then** the segment is labeled `Speaker N (Alice?)` so the user can confirm

**Priority:** P0
**Phase:** 5

---

## Epic C — Translation

### HARK-C-1: Translate live captions

> **As** a bilingual user in a code-switching meeting
> **I want to** see captions translated into my second language as the meeting happens
> **So that** I can follow nuance even when speakers slip into a language I'm less fluent in

**Acceptance criteria:**
- **Given** translation is enabled in Settings, **When** a segment is finalized, **Then** a translated line appears below the original within 500ms (local mode) or 3s (Claude mode)
- **Given** translation mode is "Fast (local)", **Then** NLLB-200 CoreML is used; no network call occurs
- **Given** translation mode is "High quality (Claude)", **Then** the segment text is sent to Claude API and translation streams back
- **Given** the user toggles modes mid-meeting, **Then** subsequent segments use the new mode without restart

**Priority:** P0
**Phase:** 6

---

## Epic D — Vault

### HARK-D-1: Save each meeting as a markdown file

> **As** a user with a long-term knowledge habit
> **I want** every meeting to land as a plain markdown file in my vault folder
> **So that** I can open, search, and edit my meetings with any tool (Obsidian, VS Code, grep)

**Acceptance criteria:**
- **Given** a meeting ends, **Then** within 5s a file is written to `vault/hark/meetings/YYYY-MM-DD-{slug}.md`
- **Given** the file is written, **Then** it contains YAML frontmatter (date, duration, speakers, bookmarks count) and the transcript organized by speaker
- **Given** the vault folder is a git repo, **Then** the new file is auto-committed with message `feat(meeting): add {slug}`
- **Given** the vault folder is NOT a git repo, **Then** Hark prompts once to initialize git, with explanation; user can decline and lose versioning

**Priority:** P0
**Phase:** 4–5

---

### HARK-D-2: Auto-link known vault terms in the transcript

> **As** a user who has built up a vault of terms and projects
> **I want** the transcript to automatically link to my notes when those terms are mentioned
> **So that** the meeting connects to the rest of my knowledge

**Acceptance criteria:**
- **Given** I have `notes/camunda.md` in the vault, **When** "Camunda" appears in a finalized segment, **Then** the rendered transcript shows it as `[[Camunda]]`
- **Given** a term has multiple matching files, **Then** the most-recently-edited match wins
- **Given** the user adds a new vault note, **Then** future transcripts include it without restart (FSEvents watcher updates the term index within 30s)

**Priority:** P1
**Phase:** 5–6

---

### HARK-D-3: Whisper vocab grows from vault

> **As** a user with technical/domain jargon in my vault
> **I want** Hark to recognize those terms in audio more accurately
> **So that** WER on my actual meetings keeps improving with use

**Acceptance criteria:**
- **Given** vault terms exist (note titles + frontmatter tags), **When** Hark starts a recording, **Then** the WhisperKit initial-prompt includes the top-N most-relevant terms (recency + frequency weighted)
- **Given** the initial-prompt is built, **Then** it never exceeds WhisperKit's prompt-token limit (truncate gracefully)

**Priority:** P1
**Phase:** 5–6

---

## Epic E — Intelligence

### HARK-E-1: Summarize the meeting

> **As** a user who just finished a meeting
> **I want** a structured summary with action items, decisions, and open questions
> **So that** I can act on the meeting in 2 minutes instead of re-reading the transcript

**Acceptance criteria:**
- **Given** a meeting file exists, **When** I click "Summarize", **Then** the transcript + bookmarks are sent to Claude and a streamed summary appears
- **Given** the summary completes, **Then** the meeting file is updated with sections: `## TL;DR`, `## Action Items`, `## Decisions`, `## Open Questions`, `## Chapters`
- **Given** the meeting file is updated, **Then** git auto-commits the change
- **Given** redact-before-send is enabled, **Then** detected PII (emails, phone numbers, ID numbers) is stripped from the prompt before send

**Priority:** P0
**Phase:** 6

---

### HARK-E-2: Ask the vault a question during a meeting

> **As** a user mid-meeting who forgot a prior decision
> **I want** to ask my vault a question without leaving the meeting context
> **So that** I can contribute informed answers in real time

**Acceptance criteria:**
- **Given** capture is active and I press ⌘⇧Q, **Then** the Q&A side-panel opens within 200ms
- **Given** I type and submit a question, **Then** local RAG retrieves top-K relevant chunks, Claude streams an answer within 3s p95, and citations link to source files
- **Given** I click a citation, **Then** the cited file opens in a side panel (does NOT navigate away from live captions)
- **Given** the Anthropic API is unreachable, **Then** local search results are shown as a fallback with a "Q&A offline" notice

**Priority:** P0
**Phase:** 6

---

### HARK-E-3: See definitions of detected terms inline

> **As** a user in a meeting where unfamiliar terms come up
> **I want** to see definitions from my vault appear inline next to the transcript
> **So that** I get context without typing a query

**Acceptance criteria:**
- **Given** a vault-known term is detected in a finalized segment, **Then** an unobtrusive inline card appears on the side showing the term's note excerpt
- **Given** the inline card is shown, **When** I click it, **Then** the full note opens in a side panel
- **Given** more than 5 terms are detected in 10 seconds, **Then** only the most-recent 3 are displayed (avoid wall of cards)

**Priority:** P2
**Phase:** 6

---

## Epic F — Trust & Privacy

### HARK-F-1: Honor "redact before send" for the Claude API path

> **As** a privacy-conscious user
> **I want** PII automatically stripped before any transcript text is sent to Claude
> **So that** even my cloud-touching workflows minimize exposure

**Acceptance criteria:**
- **Given** redact-before-send is ON (default), **Then** before any Claude API call, the prompt passes through a redactor that replaces detected emails, phone numbers, national-ID-format strings, and tagged speaker names with placeholders
- **Given** redact-before-send is ON, **Then** the redaction log is written to `~/Library/Logs/Hark/` (local) so the user can audit what was replaced
- **Given** redact-before-send is OFF (user explicitly opted out), **Then** a persistent banner reminds the user with "Redaction OFF" until they re-enable

**Priority:** P0
**Phase:** 6–7

---

### HARK-F-2: Verify no audio leaves the machine

> **As** a user trusting the local-first claim
> **I want** to be able to verify Hark never sends audio anywhere
> **So that** the trust promise is auditable, not just stated

**Acceptance criteria:**
- **Given** the user reviews Settings → Privacy, **Then** a page shows: "Audio is never sent over the network. Only transcript text and only when you invoke summary, translate, or Q&A."
- **Given** a release build, **Then** the `privacy-auditor` agent has been run and produced 0 BLOCKER findings (enforced in release checklist)
- **Given** the Anthropic SDK is used, **Then** it is configured with no audio modality, only text — verified by a unit test that fails if audio bytes are passed

**Priority:** P0
**Phase:** All

---

## Out-of-scope stories (recorded so they don't sneak in)

- HARK-X-1: ~~Auto-join Zoom meetings via deep link~~ — out of scope, v1
- HARK-X-2: ~~Sync vault to iCloud Drive~~ — v2 maybe, requires threat-model rework
- HARK-X-3: ~~Share speaker fingerprints across teammates~~ — v2 only
- HARK-X-4: ~~Pull attendees from Outlook calendar~~ — blocked by corporate IT
- HARK-X-5: ~~Real-time sentiment analysis~~ — gimmicky, dropped

## Related

- [User journeys](04-user-journeys.md) — the flows these stories compose into
- [Test strategy](../qa/09-test-strategy.md) — how acceptance criteria turn into test cases
- [Roadmap](../product/03-roadmap.md) — when each epic lands
