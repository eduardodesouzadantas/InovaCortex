# CRM Workspace

## Objective

The CRM workspace is the operator-facing commercial workspace for the canonical flow:

- `Assessment` as entrypoint
- `Contact` as relational anchor
- `Deal` as canonical opportunity
- `Proposal` as artifact linked to the deal
- `Activity` as operational trail

It is not a parallel CRM and not an executive dashboard.

## Route

- `/org/[slug]/admin/crm`

This route belongs to the `Tenant Operator Surface`.

## Architecture

The central composition layer lives in:

- `lib/operator/crm-workspace.ts`

Responsibilities of that module:

- load tenant-scoped commercial records from canonical entities
- derive workspace summary, board columns, table rows and niche schema
- build the 360 record detail
- execute inline updates for the approved operator fields
- validate and persist saved views derived from controlled presets
- execute approved bulk actions and workflow shortcuts without moving semantics to the front
- expose contextual playbooks, cadence templates and heuristic recommendations from the same central contract

Thin transport layer:

- `app/api/org/[slug]/crm/records/[assessmentId]/route.ts`
- `app/api/org/[slug]/crm/views/route.ts`
- `app/api/org/[slug]/crm/bulk/route.ts`
- `app/api/org/[slug]/crm/playbooks/route.ts`

Front-end rendering:

- `app/org/[slug]/admin/crm/page.tsx`
- `app/org/[slug]/admin/crm/crm-workspace-client.tsx`
- `app/org/[slug]/admin/crm/_components/crm-workspace-view.tsx`

## First editable fields

The first inline update surface is intentionally narrow:

- `assessment.status`
- `contact.lifecycle`
- `deal.stageId`

Those mutations stay tenant-scoped and route through the canonical flow when contact or deal resolution is required.

## Workspace v2

The next iteration keeps the same canonical backbone and adds three controlled expansions:

- system-defined operational views such as all leads, follow-up, stalled proposals, quiet window, upcoming meetings, and pipeline by stage
- adaptive visible columns based on both `industry` and active view context
- a wider but still controlled inline-editing surface for operational fields

Additional inline-edit fields in v2:

- `conversation.assignedUserId`
- `workspace.priority`
- `workspace.nextAction`
- `workspace.nextActionAt`
- `assessment.segment`
- `assessment.urgency`
- `assessment.goal`
- controlled niche fields under `workspace.niche.*` for allowed industry schemas only

These operational fields are stored as controlled CRM metadata under the assessment context, while canonical relationship and pipeline transitions remain in the canonical domain.

## Niche extensibility

The workspace uses a controlled model:

- fixed canonical backbone
- controlled niche schema derived from tenant industry
- additional fields rendered from metadata already available in canonical assessment or ROI context

This avoids unrestricted customization while still allowing vertical adaptation.

The current controlled niche set is:

- healthcare: `appointmentWindow`, `procedureType`, `insuranceType`
- real estate: `propertyInterest`, `propertyType`, `budgetRange`
- legal: `legalArea`, `caseType`, `caseUrgency`

Services, commerce, education and unknown industries still adapt views and columns, but they do not open arbitrary niche field editing.

## Workspace v3

The v3 layer keeps the same controlled model and strengthens the field contract:

- field definitions now carry `label`, `valueType`, `editableField`, `options` and view visibility
- supported vertical fields use closed options from the central contract, not front-local enums
- table and detail render inputs from those definitions, preserving a thin front
- board grouping is now contextual per view instead of being stage-only in every scenario

Current contextual board behavior:

- `pipeline`: canonical grouping by deal stage
- `follow-up`: grouped by operational priority
- `quiet-window`: grouped by time since last touch
- `meetings`: grouped by short scheduling horizon
- `stalled-proposals`: grouped by proposal engagement state

This preserves the canonical CRM while making the operator workspace more useful without becoming a generic kanban builder.

## Workspace v4

The v4 layer keeps the same controlled backbone and focuses on operator velocity:

- saved views derived from system presets, with controlled persistence by user or tenant
- bulk actions only for approved operational fields
- workflow shortcuts bound to the active operational view
- stronger fluency between table, board and 360 detail after batch changes

Saved views remain intentionally limited to the central contract:

- `baseViewId`
- `defaultMode`
- `sortId`
- allowed `columnIds`
- `scope` (`user` or `tenant`)

There is still no arbitrary filter builder and no free-form field/view schema.

Approved bulk action surface in v4:

- `assessment.status`
- `contact.lifecycle`
- `deal.stageId`
- `conversation.assignedUserId`
- `workspace.priority`
- `workspace.nextAction`
- `workspace.nextActionAt`

Workflow shortcuts are also contract-driven and currently prefill bulk operations for:

- `follow-up`
- `quiet-window`
- `meetings`
- `stalled-proposals`
- `pipeline`

Persistence uses tenant-scoped `SystemSetting` rows keyed under the CRM workspace namespace, preserving multi-tenant isolation without introducing a parallel CRM model.

## Workspace v5

The v5 layer keeps the same canonical and multi-tenant backbone and adds bounded operational automation:

- contextual playbooks connected to existing workspace views instead of a free automation builder
- short cadence templates for common follow-up motions such as initial touch, reactivation, proposal revival and meeting prep
- heuristic recommendations derived from cheap record signals like unread messages, proposal state, upcoming meetings and active cadence
- consistent exposure of those actions across table, board and 360 detail without moving semantics into the front

Current playbook surface is intentionally explicit:

- `follow-up-initial`
- `reactivate-silent-lead`
- `revive-stalled-proposal`
- `prepare-meeting`
- `advance-opportunity`
- `advance-active-cadence`

Current cadence templates are also controlled in the central contract:

- `initial-follow-up`
- `silent-reactivation`
- `proposal-revival`
- `meeting-prep`
- `opportunity-advance`

Playbook execution stays tenant-safe and observable:

- selection is explicit and limited
- the active view context can be validated against the playbook definition
- mutations still resolve through canonical assessment/contact/deal data
- resulting priority, next action, next action date and cadence state are persisted in controlled workspace metadata
- audit and activity trails are recorded for executed playbooks

## Workspace v6

The v6 layer turns each CRM record into a live execution center without creating a second inbox:

- the 360 detail now exposes a conversation context block derived from canonical `Contact`, `Conversation` and recent `Message` state
- a unified operational timeline combines recent messages, deal activities, proposal changes and meeting signals in one concise feed
- quick actions stay contract-driven and reuse existing primitives such as inline patch, playbook execution and deep links into the existing WhatsApp CRM
- the operator can understand, in one place, who the contact is, where the opportunity stands, what happened last, what is pending and what the next best action is

This still preserves the same canonical backbone:

- `Assessment` remains the entrypoint
- `Contact` remains the communication anchor
- `Deal` remains the canonical opportunity
- `Proposal` remains tied to the deal
- `Conversation` and `Message` enrich execution context instead of replacing CRM truth

The detail intentionally does not become a full inbox:

- the conversation block summarizes status, unread pressure, preview, SLA and assignment
- the live timeline is short and operational, not a full message archive
- opening the linked conversation deep-links into the existing WhatsApp surface instead of creating a parallel messaging shell

The handoff is now bidirectional:

- CRM can open the linked WhatsApp conversation through `conversationId`
- WhatsApp can open the linked CRM record 360 through `assessmentId`

## Revenue Engine exposure

The CRM workspace now also consumes the first shared `Revenue Engine` layer.

This does not turn CRM into a BI surface.
It only enriches the operator summary with reusable signals already derived in backend services:

- estimated open revenue
- estimated revenue at risk
- stalled proposals
- inactive deals
- top at-risk opportunity focus

The contract still stays thin in the front:

- heuristics remain in backend services
- the workspace only renders summary metrics and focus hints
- canonical records remain anchored in `Assessment -> Contact -> Deal -> Proposal`

## Guardrails

- no parallel auth
- no fake backend data
- no front-owned commercial transition logic
- no CRM semantics inside the CEO surface
- no break in tenant isolation
- no unrestricted per-tenant field builder
