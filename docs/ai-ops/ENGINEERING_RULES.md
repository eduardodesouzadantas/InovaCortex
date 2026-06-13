<!-- Imported from # ENGINEERING_RULES.md.pdf on 2026-03-16 -->

# ENGINEERING_RULES.md
This repository follows professional engineering standards.
## Code Organization
Prefer:
services/
repositories/
controllers/
domain/
Avoid large files with mixed responsibilities.
## Naming
Names must be:
- descriptive
- consistent
- domain oriented
Avoid abbreviations.
## Error Handling
Never return raw stack traces.
Errors must be:
- categorized
- logged
- safe for clients
## Logging
Logs must include:
- timestamp
- context
- operation
- result
- error details when applicable
## Refactoring
When refactoring:
