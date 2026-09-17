# Golden-task conformance eval protocol (Phase E)

Purpose: measure how well an agent, given ONLY the generated skills, follows the
tiny-repo rule corpus — and what value the skill set adds over no skills.

## Inputs

- **Tasks**: `evals/tasks/<category>/<task-id>.json` — a realistic prompt against
  `test/fixtures/tiny-repo`, plus `expected_rules` (checklist of rule IDs) and a
  per-rule `checklist` describing what "satisfied" looks like.
- **Skill set under test**: the generated artifacts in `out/tiny-repo/copilot/`
  (tier-0 SKILL.md + per-category skills). Re-run `npm run skills:compile` before
  an eval so the skills match the corpus exactly.

## Run procedure (manual, in-chat via subagent — plan step 12)

For each task and condition:

1. Copy the fixture repo to an isolated workspace:
   `.tmp-eval/<condition>/<task-id>/repo` (gitignored via `.tmp-*/`).
2. Launch a fresh subagent session with:
   - **skills condition**: the full text of every generated skill file
     (`out/tiny-repo/copilot/agent-skills.SKILL.md` + all `skills/*.SKILL.md`)
     presented as the agent's standing instructions, plus the task prompt.
   - **baseline condition (negative control — step 13)**: NO skill content; only
     "you are working in this Node.js repository".
   - Both: the path to the isolated repo copy; instruction to implement the task
     there and run `npm test` inside it; no other context about the rules corpus.
3. After the subagent finishes, the scorer (the main session) inspects the changed
   files in the temp workspace and marks each checklist item satisfied / not
   satisfied, with a one-line justification. Scoring is done by the SAME scorer for
   both conditions to keep judgments consistent.

## Scoring

- Per task: `satisfied / total` over its `expected_rules`.
- Conformance % per condition = average across all tasks in that run.
- **Value of skills** = conformance(skills) − conformance(baseline).
- A rule that shows LOWER coverage under the skills condition than baseline is a
  flag: the rule is wrong, noisy, or actively misleading — fix or drop it and note
  this in the eval report (never silently).

## Records

Each run writes `evals/<YYYY-MM-DD>/`:
- `<task-id>.<condition>.md` — per-item scoring with justifications.
- `report.md` — summary table, conformance %, delta, and any flag rules.

Scores are committed; the temp workspaces are not.
