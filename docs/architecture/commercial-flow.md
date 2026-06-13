# Canonical Commercial Flow

## Objective

The canonical commercial flow is now explicitly:

- `Assessment` as the diagnostic/commercial entrypoint
- `Contact` as the tenant-scoped relational anchor
- `Deal` as the canonical commercial opportunity
- `Proposal` as the commercial artifact attached to the deal
- `Activity` as the operational trail across the transition

This flow is tenant-safe by contract and designed to stay compatible with the canonical WhatsApp + CRM pipeline.

## Canonical Responsibilities

### Assessment

- Captures the initial diagnostic/commercial signal
- Remains the source of assessment context, score, ROI, and pre-sales artifacts
- Now stores optional canonical linkage to `contactId` and `dealId`

### Contact

- Remains the primary CRM relationship entity
- Is resolved per tenant with `organizationId + phoneNumberE164`
- Is the canonical bridge between WhatsApp conversations and the commercial pipeline

### Deal

- Represents the canonical open opportunity for a tenant contact
- Is reused when an open scoped deal already exists
- Is created through shared orchestration, not ad-hoc route logic

### Proposal

- Remains versioned from the assessment context
- Now stores optional `dealId`
- Must be generated and updated against the canonical deal when one is available

### Activity

- Records durable operational milestones:
  - `deal_created_from_assessment`
  - `deal_created_from_proposal`
  - `deal_created_from_whatsapp`
  - `assessment_linked`
  - `proposal_created`
  - `proposal_status_changed`
  - WhatsApp message activities already defined in the CRM pipeline

## Shared Orchestration

The shared orchestration layer lives in:

- `lib/commercial/canonical-flow.ts`

Core rules:

- tenant scoping is explicit on every transition
- assessment promotion is idempotent
- stale cross-tenant links are ignored
- open deals are reused before creating a new opportunity
- the front does not implement commercial transitions

## Current Integration Points

- `app/api/assessment/route.ts`
  - creates the assessment and immediately promotes it into canonical commercial context
- `lib/agency/commercial/leads.ts`
  - proposal generation and proposal updates use the canonical flow
- `lib/whatsapp/crm-service.ts`
  - WhatsApp deal resolution now uses the same shared deal orchestration

## Compatibility Notes

- The WhatsApp pipeline still owns conversation and message persistence
- Legacy agency/admin routes remain thin wrappers around the same commercial handlers
- Existing assessments/proposals without canonical links are backfilled lazily when proposal workflows run

Operational rollout and rollback steps are documented in `docs/architecture/commercial-flow-rollout.md`.
