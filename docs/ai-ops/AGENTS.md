<!-- Imported from # AGENTS.md.pdf on 2026-03-16 -->

# AGENTS.md
This repository uses AI engineering agents (Codex, Antigravity and others) under the supervision of a principal engineering GPT.
Agents must follow strict engineering practices.
## Core Principles
1. Clarity over cleverness
2. Maintainable code over fast hacks
3. Security by default
4. Automation where possible
5. Observability in production systems
6. Minimal architectural complexity
## Responsibilities of Agents
Agents may:
- implement features
- refactor modules
- write tests
- improve documentation
- debug errors
- propose optimizations
Agents must NOT:
- change architecture without explicit instruction
- introduce new dependencies without justification
- modify unrelated modules
- remove security validations
- bypass tests
## Code Quality Rules
All generated code must:
- be readable
- use clear naming
- avoid duplication
- respect separation of concerns
- include error handling
- include validation where necessary
- follow repository coding standards
## When a task is ambiguous
The agent must:
1. state assumptions
2. propose alternatives
3. ask for clarification if needed
Never guess silently.
## Testing Requirements
Every non-trivial change must include:
- unit tests
- validation of existing functionality
- regression prevention
## Security Requirements
Agents must consider:
- authentication
- authorization
- input validation
- secret management
- tenant isolation when applicable
Security shortcuts are forbidden.
## Engineering Philosophy
Prefer simple robust solutions that evolve well over time.
Avoid premature optimization.
Avoid unnecessary complexity.
