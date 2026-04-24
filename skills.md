# Asset Skills Index

This file is the shared skill index for the `asset` repository.

## Start In A New Chat

Read in this order first:

1. `README.md`
2. `.env.example`
3. `skills.md`
4. The matching `skills/asset-*/SKILL.md` file only if the task needs a focused workflow

## Skill Locations

- Repo skill source lives in `skills/asset-*`.
- Optional agent metadata lives in `skills/asset-*/agents/openai.yaml`.
- If you use a local Codex install, keep that local copy outside this repository and treat the repo copy as the shared source of truth.

## Included Shared Skills

- `asset-cash-reconcile`: reconcile cash balance changes, total-asset mismatches, and realized vs unrealized P/L questions.
- `asset-incident-response`: triage broken API responses, quote failures, storage mismatches, and rendering crashes.
- `asset-manage-skills`: review, update, and keep the project skill set consistent as the codebase evolves.
- `asset-market-close-policy`: apply quote freshness and market-session rules for U.S. stock display behavior.
- `asset-session-summary`: maintain short local handoff notes after meaningful implementation or debugging work.
- `asset-verify-implementation`: run a focused verification pass after changing UI, APIs, storage, or portfolio behavior.

## Important Split

- Runtime owner data, access codes, API keys, and service-account JSON stay outside Git.
- Code, structure, UI, docs, and sample fallback data belong to the GitHub repository.
- Personal planning notes and session handoff files should stay under a local ignored `private/` folder.
- Update the repo skill source first, then sync any local Codex install copy if you use one.

## Core Guardrails

- Ask the user before broad changes that touch many files or significantly reshape the project.
- Do not keep stacking large new logic into one file.
- Prefer feature-specific modules or files instead of appending everything to a single file such as `app.js`.
- Split new behavior by feature or module when that keeps ownership and review clearer.
- Keep each skill and project module narrow and reusable.
- Use sub-agents only for clearly parallel, non-overlapping work.
- Prefer browser verification for UI-facing changes.

## Practical Rule

- If the task matches an Asset workflow, use the relevant Asset skill.
- If skill definitions or guardrails are needed, open the matching file under `skills/asset-*/SKILL.md`.
- If shipped behavior changes, run the relevant verification checks and update public docs when needed.
