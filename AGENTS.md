# InovaCortex Agent Instructions

All future work in this repository must be based on the documents in `docs/ai-ops/`.

Required operating docs:

- `docs/ai-ops/CODEX_SUPREME_OPERATOR.md`
- `docs/ai-ops/CODEX_AUTOPILOT_MODE_INOVACORTEX.md`
- `docs/ai-ops/ENGINEERING_RULES.md`
- `docs/ai-ops/AGENTS.md`
- `docs/ai-ops/SKILLS.md`
- `docs/ai-ops/NEW_FEATURE_WORKFLOW.md`
- `docs/ai-ops/CODEX_TASK_TEMPLATE.md`
- `docs/ai-ops/PROMPT_ENGINEER.md`

Execution rules:

- Use these documents as the default operating baseline for planning, implementation, testing, and review.
- Prefer the smallest safe change and verify the real user path before closing a task.
- Keep imports synchronized by updating `docs/ai-ops/source-pdfs/` and re-running `node scripts/import-ai-ops-pdfs.mjs` when the source PDFs change.
