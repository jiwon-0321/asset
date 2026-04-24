---
name: asset-manage-skills
description: Decide when asset-main needs a new Codex skill or an update to an existing one. Use after meaningful project changes, repeated incidents, or review coverage gaps.
---

# Asset Manage Skills

Use this skill to keep the Asset Codex skill set small, current, and useful.

## Goal

1. inspect recent project changes
2. map them to existing Asset skills and uncovered repeated workflows
3. decide whether to update, create, or skip a skill
4. sync approved source changes into the live install path

## Storage Rules

- Shared skill source lives in the repo under `skills/`.
- If you use a local Codex install, you may also keep a synced local copy outside the repo.
- Treat the repo copy as the shared source of truth for Asset skills.

## Workflow

### 1. Inspect project changes

- Use `git status --short`, `git diff --name-only`, and `git diff --stat` in `asset-main`.
- Focus on `app.js`, `client/*.js`, `api/*.js`, `lib/*.js`, `scripts/*.js`, `styles/*.css`, `docs/*.md`, and any local planning notes that matter to the workflow.

### 2. Check current skill coverage

- Review the source skill copy in `skills/` first.
- If you also keep a local Codex install, compare against that copy only to catch drift before syncing.
- Existing skills may already cover incident response, market-close policy, cash reconcile, verification, or session-summary work.
- Ask whether the changed behavior is already covered well enough.

### 3. Make the decision

- `UPDATE` if an existing skill covers the same domain but has stale paths, missing frontend or storage checks, weak guardrails, or source/install drift.
- `CREATE` if a repeated workflow is not covered by any current skill.
- `SKIP` if the change is one-off or already covered.

Good candidates for `CREATE` only after repeated need:
- owner-mobile QA
- Figma MCP design review or sync
- trade-photo-assist validation
- storage-provider audit

### 4. Author lean skills

- Write all skill content in English.
- Keep `SKILL.md` short and procedural.
- Prefer exact paths and concrete checks over long explanations.
- Avoid personal portfolio data, access codes, or secrets.
- Add or update `agents/openai.yaml`.

### 5. Sync the live install when needed

- After updating `skills/<skill-name>`, optionally sync the same skill into your local Codex install if you use one.
- Treat the repo skill path as the shared source of truth.
- Remove stray `.DS_Store` files from the skill tree when found.

## Output Format

- `Scope:` changed project area
- `Coverage:` existing skills that do or do not cover it
- `Decision:` UPDATE / CREATE / SKIP
- `Skill:` target skill name or `none`
- `Next:` what to edit, create, or sync

## Guardrails

- Ask the user before making broad changes that touch many files or significantly reshape the project.
- If the work will touch many files or restructure a large area, pause and confirm before continuing.
- Do not place too much new logic in one file.
- Prefer feature-specific modules or files instead of appending everything to a single file.
- If the request is ambiguous, restate your understanding first and wait for confirmation before acting.
- Do not create a new skill for a one-off fact.
- Do not duplicate an existing skill with a new name.
- Keep each skill narrow and reusable.
- If a skill writes a project artifact, define the exact repo path.
