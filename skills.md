# Codex Skills Index

This file is the canonical skill index for `asset-main`.
It replaces the old split between a repo-local bridge file and a separate outside skill index.

## Start In A New Chat

Read in this order first:

1. `private/summary/LATEST.md`
2. `private/summary/YYYY-MM-DD-chat-summary.md`
3. `private/PROJECT_PLAN.md`
4. `skills.md` only if skill routing or guardrails are needed
5. `docs/ai/AI_WORKFLOW.md` only if workflow detail is still needed

## Claude To Codex Mapping

The original Claude index listed maintenance and verification skills. In Codex, use these equivalents:

| Claude skill | Codex skill | Purpose |
| --- | --- | --- |
| `verify-implementation` | `asset-verify-implementation` | run the focused post-change verification pass for asset-main |
| `manage-skills` | `asset-manage-skills` | update, review, and sync Asset Codex skills and workflow rules |

## Skill Locations

- Repo skill source lives in `skills/asset-*`.
- Live Codex install lives in `~/.codex/skills/asset-*`.
- Claude originals stay separate in `/Users/jojiwon/vibecording/claude/skills`.

Current custom Asset skills:

- `asset-manage-skills`
- `asset-session-summary`
- `asset-verify-implementation`
- `asset-incident-response`
- `asset-market-close-policy`
- `asset-cash-reconcile`

## Important Split

- Live owner data belongs to Firebase runtime state.
- Code, structure, UI, docs, and sample fallback data belong to the GitHub repo.
- Personal planning notes and session handoff live under `private/` and stay out of Git by default.
- Update repo skill source first, then sync the installed `~/.codex/skills` copy when needed.

## Core Guardrails

- If the work will touch many files, reshape a large area, or change structure broadly, ask the user before continuing.
- Do not keep stacking large new logic into one file.
- Prefer feature-specific modules or files instead of appending everything to a single file such as `app.js`.
- Split new behavior by feature or module when that keeps ownership and review clearer.
- Keep each skill and each project module narrow and reusable.
- Use sub-agents only for clearly parallel, non-overlapping work.
- Prefer Safari for UI verification.

## Practical Rule

- If the task matches an Asset workflow, use the relevant Asset skill.
- If workflow context is unclear, check `docs/ai/AI_WORKFLOW.md`.
- If skill definitions or guardrails are needed, open the matching file under `skills/asset-*/SKILL.md`.
- If the work changes shipped behavior, update `private/summary/LATEST.md`, the current private daily summary, and `private/PROJECT_PLAN.md` when needed.
