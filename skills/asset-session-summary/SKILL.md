---
name: asset-session-summary
description: Write or update a short session summary for asset-main. Use after meaningful implementation, debugging, deployment, or review work.
---

# Asset Session Summary

Use this skill to keep a lean daily summary and handoff pointer inside the local `asset-main` workspace.

## Goal

Write a short, factual summary that future sessions can scan quickly, then refresh the latest handoff pointer.

## Output Location

- Write to `/Users/jojiwon/vibecording/asset-main/private/summary/YYYY-MM-DD-chat-summary.md`.
- If the file for the current date already exists, update it instead of creating a duplicate.
- Refresh `/Users/jojiwon/vibecording/asset-main/private/summary/LATEST.md` in the same pass.

## Workflow

### 1. Gather only confirmed facts

- Inspect `git status --short`, `git diff --stat`, and the key files touched in the session.
- Include validation only if it was actually run.
- Include deployment or storage state only if it was actually verified.

### 2. Compress aggressively

- Keep the daily summary to 4-6 bullets.
- Prefer one line per idea.
- Skip conversational filler and temporary dead ends.

### 3. Use these exact structures

Daily summary:

```markdown
# Asset Session Summary (YYYY-MM-DD)

- Scope: ...
- Changes: ...
- Validation: ...
- Risks: ...
- Next: ...
```

Latest handoff:

```markdown
# Asset Latest Handoff

- Date: `YYYY-MM-DD`
- Read first: `private/summary/YYYY-MM-DD-chat-summary.md`
- Then read: `private/PROJECT_PLAN.md`
- Current branch: `...`
- Current shipped state: `...`
- Storage note: `...`
- Next check: `...`
```

- Omit a bullet only if there is nothing confirmed to say.
- Keep wording in English.

## Guardrails

- Do not claim tests passed if they were not run.
- Do not repeat unchanged background context.
- Do not write a second summary file for the same day.
- Do not leave `private/summary/LATEST.md` pointing at stale context after a meaningful session.
- Keep both files token-efficient and scannable.
