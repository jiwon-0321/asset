# Asset Skills

This folder contains the shared skill source for `asset-main`.

Each skill documents a focused workflow that can be reused while developing or maintaining the project.

## Included Skills

- `asset-cash-reconcile`
  Reconcile cash balance changes, total-asset mismatches, and realized vs unrealized P/L questions.
- `asset-incident-response`
  Triage runtime incidents such as broken API responses, quote failures, storage mismatches, and rendering crashes.
- `asset-manage-skills`
  Review, update, and keep the project skill set consistent as the codebase evolves.
- `asset-market-close-policy`
  Apply the quote freshness and market-session rules used for U.S. stock display behavior.
- `asset-session-summary`
  Maintain short local handoff notes after meaningful implementation or debugging work.
- `asset-verify-implementation`
  Run a compact verification pass after changing UI, APIs, storage, or portfolio behavior.

## Structure

- Shared skill docs live in `skills/<skill-name>/SKILL.md`.
- Optional agent metadata lives in `skills/<skill-name>/agents/openai.yaml`.

## Notes

- This repo keeps only the shared skill source.
- Local planning, session notes, and personal workflow files stay under `private/` and are not committed.
