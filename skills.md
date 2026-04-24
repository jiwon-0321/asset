# Codex Skills Index

This file is the shared skill index for the `asset` repository.

## Start In A New Chat

Read in this order first:

1. `README.md`
2. `.env.example`
3. `skills.md`
4. `private/summary/LATEST.md` only if a local ignored handoff folder exists
5. `private/PROJECT_PLAN.md` only if a local ignored project plan exists
6. The matching `skills/asset-*/SKILL.md` file only if skill routing or guardrails are needed

## Claude To Codex Mapping

The original Claude index listed maintenance and verification skills. In Codex, use these equivalents:

| Claude skill | Codex skill | Purpose |
| --- | --- | --- |
| `verify-implementation` | `asset-verify-implementation` | run the focused post-change verification pass for Asset |
| `manage-skills` | `asset-manage-skills` | update, review, and sync Asset Codex skills and workflow rules |

## Skill Locations

- Repo skill source lives in `skills/asset-*`.
- Optional agent metadata lives in `skills/asset-*/agents/openai.yaml`.
- Optional local Codex installs or Claude originals should stay outside this public repository.
- Treat the repo copy as the shared source of truth for Asset skills.

Current custom Asset skills:

- `asset-manage-skills`
- `asset-session-summary`
- `asset-verify-implementation`
- `asset-incident-response`
- `asset-market-close-policy`
- `asset-cash-reconcile`

## Important Split

- Runtime owner data belongs to the configured storage provider.
- Access codes, API keys, and service-account JSON stay outside Git.
- Code, structure, UI, docs, and sample fallback data belong to the GitHub repository.
- Personal planning notes and session handoff files should stay under a local ignored `private/` folder.
- Update the repo skill source first, then sync any local Codex install copy if you use one.

## Core Guardrails

- If the work will touch many files, reshape a large area, or change structure broadly, ask the user before continuing.
- Do not keep stacking large new logic into one file.
- Prefer feature-specific modules or files instead of appending everything to a single file such as `app.js`.
- Split new behavior by feature or module when that keeps ownership and review clearer.
- Keep each skill and each project module narrow and reusable.
- Use sub-agents only for clearly parallel, non-overlapping work.
- Prefer browser verification for UI-facing changes.

## Practical Rule

- If the task matches an Asset workflow, use the relevant Asset skill.
- If skill definitions or guardrails are needed, open the matching file under `skills/asset-*/SKILL.md`.
- If the work changes shipped behavior, run the relevant verification checks and update public docs when needed.
- If local private handoff files exist, update them after meaningful implementation, debugging, deployment, or review work.
