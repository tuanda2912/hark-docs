---
description: Fail-closed content scan for leaked secrets/keys/tokens in the wiki — the content-side complement to the remote-host guard. Run before publishing or pushing a wiki that can go public (cairn)
argument-hint: "(optional) paths to scan — default: wiki/ + wiki.context.md"
---

# Guard the wiki content (cairn)

`guard-remote` checks **where** the brain can be pushed (the git host). `/cairn-guard` checks **what's in
it** — a fail-closed scan for secrets, keys, and tokens that would leak the moment a page goes public. Run it
before publishing, and especially in a workspace that opted into a public remote (`.cairn-allow-public`).

Scope: **$ARGUMENTS** (files/dirs; default `wiki/` and `wiki.context.md`).

## Run
```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}"
TARGETS="$(echo "$ARGUMENTS" | tr ' ' '\n' | grep -v '^--')"
[ -n "$TARGETS" ] || TARGETS="$WIKI_DIR wiki.context.md"
node .claude/lib/scan-secrets.mjs $TARGETS
echo "(guard exit: $?  — 0 clean · 1 leak risk · 2 bad input)"
```

## Act on the result
- **Exit 0 (CLEAN)** → safe to publish on the confidentiality dimension. (Still respect `guard-remote`.)
- **Exit 1 (LEAK RISK)** → **BLOCKER**. For each finding:
  - **Real secret** → redact it. A wiki should reference *where* a secret lives (a vault path, an env var
    name), never the value. Rotate the credential if it was already committed.
  - **False positive** (a documented example, a placeholder) → mark that line with a trailing
    `<!-- cairn:allow-secret <reason> -->` so the scan passes and the intent is recorded.
- Re-run until clean. Do not publish or push while exit is non-zero.

## Notes
- The patterns are curated for low false positives (PEM keys, AWS/GitHub/Slack/Google/OpenAI tokens, JWTs,
  and hardcoded `secret/token/password = …` assignments); they are not exhaustive — judgment still applies.
- `/cairn-lint` runs the same scan at **warning** severity (so a stray match never blocks a routine lint).
  `/cairn-guard` is the **fail-closed** gate for the publish/push moment.
