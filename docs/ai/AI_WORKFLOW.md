# AI Workflow

This folder is the repo-tracked source of truth for project-specific AI workflow notes.

## Purpose

- Keep project-specific AI guidance versioned with `asset-main`
- Make new chats easier to start without relying on memory
- Separate repo docs from live Codex execution skills

## Split Of Responsibility

- `docs/ai/*`
  - repo-tracked workflow docs
  - easier to review, edit, branch, and merge with normal project work
- `private/*`
  - local-only planning, handoff, and session notes
  - ignored by Git on purpose
- `skills.md`
  - canonical skill index and the default entry point for skill routing inside `asset-main`
- `skills/asset-*`
  - repo-tracked source for custom Asset Codex skills
- `~/.codex/skills/asset-*`
  - compressed live Codex skills
  - execution-facing copies used during actual Codex work

If a workflow changes, update the repo copy first and then sync the matching live skill when needed.

## Default New-Chat Read Order

Use this order unless the task clearly needs something else:

1. `private/summary/LATEST.md`
2. `private/summary/YYYY-MM-DD-chat-summary.md` for the current day
3. `private/PROJECT_PLAN.md`
4. `skills.md` only if skill routing or workflow context is needed
5. `docs/ai/AI_WORKFLOW.md` only if workflow detail is still needed
6. the specific file for the active task, only when relevant

This means `skills -> summary -> handoff -> plan` is not the default order.
The practical default is `LATEST -> daily summary -> PLAN`, then `skills.md` or workflow docs only when needed.

## Guardrails

- Do not put secrets, access codes, or personal portfolio data in these docs.
- Keep the repo copies readable for humans.
- Keep live Codex skills shorter and more execution-oriented than the repo copies.
- Ask the user before broad changes that touch many files or significantly reshape the project.
- If the work will touch many files or rework a large area, pause and confirm before continuing.
- Do not concentrate too much new logic in one file.
- When new behavior can stand on its own, split it by feature or module so ownership and later review stay clearer.
- Prefer feature-specific modules over expanding one file with unrelated responsibilities.

## Runtime Ownership Policy

- Treat live owner data as Firebase-managed runtime state, not as repo-tracked content.
- Treat code, UI, structure, workflow docs, and non-sensitive sample fallback data as repo-tracked Git content.
- Treat `private/*` as local-only planning context that should stay outside Git tracking.
- After feature or structure work, commit and push only the repo-side code and docs changes.
- After live data changes, verify the active runtime source with `npm run storage:status` before assuming any repo JSON file is authoritative.
- Do not reintroduce personal portfolio snapshots or secrets into Git-tracked files.
