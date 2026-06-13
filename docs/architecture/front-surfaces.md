# Front Surfaces Architecture

## Canonical surfaces

The front-end now treats the product as three explicit surfaces:

1. `Agency Surface`
2. `Tenant Operator Surface`
3. `Tenant CEO Surface`

This is a navigation and shell decision, not a second auth system.

## Agency Surface

Agency is not only the platform control plane.
It is also the operating system of the agency itself.

### Agency Operating System

- `/agency/dashboard`
- `/agency/commercial/leads`
- `/agency/commercial/workspaces`
- `/agency/whatsapp`
- `/agency/content`
- `/agency/authority`
- `/agency/builder`

This lane exists for the agency to sell, run CRM, publish, automate and execute as its own business.

### Platform Control

- `/agency/cockpit`
- `/agency/executive`
- `/agency/command-center`
- `/agency/monitoring`
- `/agency/costs`
- `/agency/settings`

This lane exists for governance, health, observability, automation and platform-level control.

### Agency Surface v2

The agency home/dashboard now makes the duality explicit inside the same shell:

- a command-layer read of what needs platform governance now
- a separate operating-system read of what needs agency execution now
- real, lightweight blocks for tenants, rollout, integrations, pipeline, agenda, inbox, content and delivery
- honest fallbacks when one side of the surface still lacks enough signal

This keeps Agency distinct from tenant surfaces and prevents it from collapsing into a generic admin area.

## Tenant Operator Surface

The operator surface remains the cockpit of routine execution.

Core routes:

- `/org/[slug]/admin`
- `/org/[slug]/admin/crm`
- `/org/[slug]/admin/cockpit`
- `/org/[slug]/admin/whatsapp`
- `/org/[slug]/admin/deals`
- `/org/[slug]/admin/workspaces`
- `/org/[slug]/admin/offers`
- `/org/[slug]/admin/outbound`
- `/org/[slug]/admin/content`
- `/org/[slug]/admin/marketing`
- `/org/[slug]/admin/ai`

This shell is intentionally execution-first and does not try to behave like the CEO surface.

### Operator Surface v2

The operator home now behaves as an execution cockpit instead of a generic dashboard:

- summary of what needs action now
- short prioritization of follow-ups at risk
- immediate agenda and overdue work
- inbox, action queue and delivery pressure in one operational read
- honest fallback states when the tenant still lacks enough daily signal

The front remains presentation-first. Operational prioritization stays outside the view so the surface remains distinct from both Agency and CEO.

### Operator Surface and Revenue Engine

The Operator surface now consumes a shared Revenue Engine layer only where it improves execution:

- revenue at risk appears as an operational prioritization signal, not an executive dashboard block
- the follow-up section can surface top at-risk opportunities as direct CRM entry points
- heuristics stay centralized in backend services shared with the CEO surface

### Operator CRM Workspace

The operator surface now also exposes a dedicated CRM workspace at `/org/[slug]/admin/crm`.

That route exists to give the operator a real commercial operating workspace instead of scattering CRM across isolated screens:

- editable table for canonical commercial records
- board grouped by canonical deal stage
- 360 detail panel for contact, deal, proposal, activity, messages and agenda
- system-defined operational views for follow-up, stalled proposals, quiet windows, meetings and pipeline
- controlled operational metadata such as owner, priority and next action
- controlled inline qualification updates for segment, urgency and goal
- controlled niche fields only when the active industry schema explicitly allows them
- controlled niche adaptation through backend-derived schema, not arbitrary front customization
- contextual board layouts driven by the same CRM contract used by table and detail
- saved views derived from controlled presets, not a free-form builder
- explicit multi-select bulk actions for approved operational fields only
- workflow shortcuts that prefill the same controlled bulk contract per active view
- contextual playbooks for follow-up, reactivation, meetings, stalled proposals and opportunity advance
- simple cadence labels and heuristic next-step recommendations visible in both the workspace and the 360 detail
- a live record center in the 360 detail, with conversation context, operational timeline and deep links into the existing WhatsApp inbox

The route stays thin. Workspace derivation lives in `lib/operator/crm-workspace.ts`, preserving the canonical `Assessment -> Contact -> Deal -> Proposal` backbone and keeping inline update semantics out of the view.

### Operator WhatsApp Workspace

The WhatsApp workspace at `/org/[slug]/admin/whatsapp` now acts as a conversational execution point instead of a message thread only:

- the inbox keeps the canonical conversation and message pipeline
- the right rail can load tenant-safe commercial context for the linked contact and record
- contact, deal, proposal, activity and next-step context stay derived from services, not from front-owned business logic
- quick actions reuse the existing CRM mutation surfaces instead of opening a second commercial backend
- navigation is now bidirectional: CRM can open the linked conversation, and the inbox can deep-link back into the CRM record 360

## Tenant CEO Surface

The CEO surface remains a command surface, not a task cockpit.

Core routes:

- `/org/[slug]/executive`
- `/org/[slug]/executive#pipeline`
- `/org/[slug]/executive#alerts`
- `/org/[slug]/executive#actions`

Cross-links:

- back to `/org/[slug]/admin`
- bridge to `/org/[slug]/admin/ai`

The shell reuses executive intelligence from the backend and keeps empty states honest when the tenant still lacks signal.

### CEO Surface v2

The executive page now layers decision-oriented reading on top of the same backend intelligence contract:

- executive summary and state of play
- 30-day comparison versus the previous 30-day period
- prioritized alerts across system events, profit leaks and action recommendations
- explicit risk and opportunity narrative
- focus-now guidance for the leadership layer

All of this remains heuristic-first and backend-real, without introducing parallel auth or a second shell.

### CEO Surface v3

The next iteration deepens the same executive contract without changing the surface architecture:

- short recent time series for leadership reading, not BI exhaust
- short-window trend comparison for revenue, conversion, pipeline input and risk pressure
- stronger revenue intelligence with opportunity coverage versus open leakage
- richer alert context explaining why an alert was prioritized now
- war room executive snapshot: receita aberta x receita em risco, momentum, estágio travado e foco estratégico
- foco imediato por frente (propostas sem resposta, deals sem avanço, conversas críticas sem toque)

The front remains presentation-only. Executive derivations stay concentrated in `lib/executive/tenant-intelligence.ts`, while the route stays thin and the CEO surface stays distinct from the operator cockpit.

### CEO Surface and Revenue Engine

The CEO surface now consumes the first shared Revenue Engine layer on top of the existing executive intelligence contract.

This layer adds explicit but cheap signals such as:

- estimated open revenue
- estimated revenue at risk
- stalled proposals
- inactive deals
- most stagnant stage
- critical conversations and top opportunities at risk

The important architectural rule remains unchanged:

- the CEO surface reads a backend-composed decision contract
- the Operator surface reads a backend-composed execution contract
- neither surface owns revenue heuristics in the front

## Front-end rules

- No parallel auth
- No fake production data
- No mixing agency, operator and CEO semantics in the same shell
- CEO remains decision-first
- Operator remains execution-first
- Agency remains dual-nature: platform governance plus self-operation

## Expansion path

This architecture leaves room for:

- denser executive comparisons
- richer agency operating workflows
- alert center
- revenue intelligence
- deeper cross-surface guidance

without reopening the routing model or the auth model.
