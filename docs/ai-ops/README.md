# AI Ops Rules

All AI-assisted work in this repository must follow the governing documents in `docs/ai-ops/`.

Primary operating docs:

- `CODEX_SUPREME_OPERATOR.md`
- `CODEX_AUTOPILOT_MODE_INOVACORTEX.md`
- `ENGINEERING_RULES.md`
- `AGENTS.md`
- `SKILLS.md`
- `NEW_FEATURE_WORKFLOW.md`
- `CODEX_TASK_TEMPLATE.md`
- `PROMPT_ENGINEER.md`

Operational notes:

- Start with the smallest safe change that satisfies the request.
- Use the workflow and template docs for any non-trivial feature or implementation task.
- Keep the source PDFs in `docs/ai-ops/source-pdfs/` as the import baseline.
- Re-run `node scripts/import-ai-ops-pdfs.mjs` if any of the source PDFs are updated in `Downloads`.
