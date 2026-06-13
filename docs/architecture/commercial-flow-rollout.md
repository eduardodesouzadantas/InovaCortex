# Commercial Flow Rollout

## Scope

This rollout applies the additive migration for the canonical commercial flow:

- `prisma/migrations/20260316170000_add_canonical_commercial_flow_links/migration.sql`

The migration adds:

- nullable `contactId` and `dealId` to `assessments`
- nullable `dealId` to `proposals`
- supporting indexes
- foreign keys with `ON DELETE SET NULL`

## Safety Review

The SQL is additive and non-destructive:

- no column drops
- no data rewrite
- no backfill required to complete the migration
- legacy rows remain valid because all new columns are nullable
- foreign keys only apply when the new link fields are populated

Expected impact on existing data:

- existing assessments and proposals keep working with null canonical links
- canonical links are backfilled lazily by the application flow
- orphan creation risk is reduced because new links must point to valid tenant-scoped entities

## Rollout Procedure

1. Confirm target environment variables are loaded for the intended database.
2. Generate Prisma client:
   - `npx prisma generate`
3. Apply migrations:
   - `npx prisma migrate deploy`
4. Validate compile/build baseline:
   - `npx tsc --noEmit`
   - `npm run build`
5. Run focused regression tests:
   - `npx jest __tests__/commercial-flow.test.ts __tests__/agency-commercial-leads.test.ts __tests__/whatsapp-crm-pipeline.test.ts __tests__/whatsapp-outbound-service.test.ts --runInBand`
6. Run transactional smoke validation against the real database:
   - `npx tsx scripts/smoke-commercial-flow.ts`

## Smoke Validation Contract

The smoke script validates, inside one transaction that is intentionally rolled back:

- assessment creation
- assessment promotion to canonical contact and deal
- proposal creation linked to the canonical deal
- activity persistence on the same deal
- WhatsApp-compatible deal reuse through the shared canonical resolver

Because the transaction is rolled back, no operational records remain in the database after validation.

## Rollback Procedure

If `prisma migrate deploy` fails before applying the migration:

- stop rollout
- inspect the error and database connectivity/state
- do not continue with smoke validation

If the migration is applied but post-validation fails:

1. freeze new deploys on the target environment
2. inspect:
   - new FK violations
   - unexpected null-link behavior
   - proposal/deal linkage regressions
   - WhatsApp deal reuse behavior
3. if application rollback is required, deploy the last known-good application build only if it is compatible with the new additive schema
4. if schema rollback is absolutely required, use an explicit manual SQL rollback after confirming no production data depends on the new columns:
   - drop foreign keys
   - drop indexes
   - drop added nullable columns

Manual schema rollback SQL must not be executed blindly in production. The preferred rollback is application-level because this migration is additive.

## Evidence To Capture

- `npx prisma migrate deploy` output
- smoke script JSON output
- focused jest pass
- typecheck/build pass
