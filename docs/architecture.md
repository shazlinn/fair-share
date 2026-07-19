# FairShare architecture and implementation blueprint

This is the Phase 0 design. UI work should follow only after its financial and authorization services have tested server-side behavior.

## 1. System architecture

Start as a modular monolith. Next.js App Router hosts React, Server Components for reads, and Server Actions or Route Handlers for mutations. Domain services contain financial rules and are the only layer allowed to perform financial writes. Prisma is the persistence adapter for PostgreSQL/Neon, while Auth.js establishes identity.

The dependency direction is:

`UI -> server action/route -> authorization + Zod -> domain service -> Prisma transaction -> PostgreSQL`

- **Presentation:** responsive pages, shadcn/ui forms, loading/error/empty states, TanStack Table, and Recharts. Charts consume authorized aggregates.
- **Application:** use cases such as `createExpense`, `editExpense`, `deleteExpense`, `recordSettlement`, and `acceptInvitation`.
- **Domain:** pure BigInt functions for allocation, balances, and debt simplification. They know nothing about React or Prisma.
- **Infrastructure:** Prisma repositories, Auth.js, authenticated database-backed receipt storage, and notification delivery.
- **Database:** normalized payments, shares, and settlements are authoritative. Balances are derived, not mutable counters.

Use the Node.js runtime for transaction-heavy handlers. Never import Prisma or secrets into Client Components. Receipt bytes belong in private object storage; PostgreSQL stores metadata and an opaque key. Downloads require an authenticated endpoint or short-lived signed URL.

## 2. Initial database model

The initial schema is in `prisma/schema.prisma`.

- Auth.js-compatible identity tables are included.
- `GroupMember` is the authorization boundary; `leftAt IS NULL` means active membership.
- A group has one currency. Expenses and settlements copy it for an immutable audit record.
- Payments and participant shares are separate, allowing multiple payers.
- Composite foreign keys ensure payers, participants, settlement parties, and commenters have membership in the same group.
- Expenses are soft-deleted. Settlements are voided rather than overwritten or physically deleted.
- `version` enables optimistic concurrency; group-scoped `idempotencyKey` values prevent retry duplicates.
- Invitation secrets are stored only as hashes.
- Activity JSON serializes minor-unit BigInts as decimal strings.

The first SQL migration should add constraints Prisma cannot express: positive expense, payer, and settlement amounts; non-negative split amounts; different settlement sender and receiver; three-uppercase-letter currency codes; valid invitation use counts; percentage basis points from 0 to 10,000; and non-negative share units. Cross-row sums and active-membership checks must be validated inside transactions. A partial unique index should enforce one active owner per group, while application logic prevents removing or demoting the last owner.

## 3. Money and deterministic rounding

Use integer minor units as PostgreSQL/Prisma `BigInt`. RM100.00 is `10000n`. API and form boundaries accept strings such as `"100.00"`, validate the currency scale, and convert once to BigInt. Never accept a JavaScript `number` as authoritative money and never send a raw BigInt through JSON.

Use the largest-remainder allocation method:

1. Represent participant weights as non-negative integers: `1` for equal, basis points for percentage, and integer units for shares.
2. Compute `floor(totalMinor * weight / totalWeight)` using BigInt.
3. Compute `(totalMinor * weight) % totalWeight` for every participant.
4. Distribute leftover minor units by descending remainder, then ascending member ID as a stable tie-break.

For RM100 divided equally among three people, the stored allocations are RM33.33, RM33.33, and RM33.34. Which member receives the extra sen depends only on the documented stable ordering. Assert that every allocation result sums exactly to the input total.

Exact splits do not round and must sum to the total. Percentages are integer basis points totaling exactly `10000`. Shares require at least one positive integer unit and use the same largest-remainder method. Formatting via `Intl.NumberFormat` is presentation-only.

## 4. Expense transaction flow

Every mutation begins with an authenticated user ID and a server-parsed Zod command. Never trust a client-supplied role, currency, calculated share, or balance.

### Create

1. Begin a PostgreSQL `Serializable` transaction with bounded retry for serialization conflicts.
2. Load the group and caller's active membership; reject archived groups.
3. Load all payer and participant memberships in one query. Require the exact distinct ID set and active membership.
4. Parse and validate `amountMinor > 0`; require payer totals to equal it; calculate shares on the server.
5. Recheck calculated share totals and method-specific weights.
6. Insert expense, payers, splits, and activity log atomically.
7. Use `(groupId, idempotencyKey)` to return the previous result for a safe retry.
8. Commit, then deliver notifications. Add an outbox before external delivery so committed events are not lost.

### Edit

Repeat authorization and validation, then update with `WHERE id/groupId/version/status=ACTIVE` and increment `version`. If no row updates, return a conflict so the client refreshes. Replace payer and split rows with the fully validated set and write a safe before/after activity summary in the same transaction. Readers then see either the complete old expense or complete new expense.

### Delete

Authorize and version-check, mark the expense `DELETED`, add deletion metadata, increment the version, and write the activity log atomically. Derived queries exclude deleted expenses. Physical deletion is for explicit retention/privacy jobs, not normal UI actions.

## 5. Balance calculation

For every member:

`net = active expense payments - active expense shares + recorded settlements sent - recorded settlements received`

A positive net is receivable; a negative net is payable. Sending repayment reduces a debt, while receiving it reduces a credit.

Aggregate with PostgreSQL `SUM(bigint)` grouped by user for application reads. Keep a pure BigInt implementation as the reference/test oracle. Always assert that all member nets sum to zero; a non-zero result means corrupt data or a query bug. Do not persist a mutable balance column in the MVP. A future projection must remain rebuildable from normalized facts.

## 6. Debt simplification

Given member-to-BigInt nets whose sum is zero:

1. Convert negative balances to debtors with positive amounts owed; positive balances become creditors.
2. Sort both deterministically by descending amount and then member ID.
3. Transfer `min(debtRemaining, creditRemaining)` from the current debtor to creditor.
4. Reduce both and advance either side that reaches zero.
5. Continue until exhausted, omitting zero transfers.

This greedy method emits at most `debtors + creditors - 1` transfers and exactly preserves each member's balance. It reduces transfers but does not claim a globally minimal count. Suggestions are read-only; only recorded repayments change balances.

Before recording a settlement, recompute balances in a serializable transaction. The sender's debt and receiver's credit must both be at least the requested amount. This blocks stale or concurrent over-settlement.

## 7. Authorization model

Authorization is deny-by-default and server-side.

- Authenticated users update only their own profile and view their own notifications.
- Active members may view a group and authorized receipts, create expenses, comment, and record permitted settlements.
- Owners additionally manage group settings, archive/restore, invitations, membership, and ownership transfer.
- Archived groups are read-only for everyone except the explicit owner restore operation.
- Former members have no group access in the MVP; their historical accounting rows remain.

Use `requireUser`, `requireActiveMembership(groupId)`, `requireOwner(groupId)`, and `requireWritableGroup(groupId)`. Query by resource ID and authorization scope together to prevent IDOR. Receipt endpoints repeat the membership check.

Recommended expense policy: any active member may create; only the creator or owner may edit/delete. Owner transfer must be atomic and may never leave a group without exactly one active owner.

## 8. Suggested folder structure

```text
src/
  app/
    (auth)/
    (app)/
      dashboard/
      groups/[groupId]/
        expenses/[expenseId]/
        balances/
        activity/
        settings/
    api/auth/[...nextauth]/
    api/receipts/[attachmentId]/
  components/
    ui/
    forms/
    tables/
    charts/
  features/
    groups/
    invitations/
    expenses/
    settlements/
    comments/
    notifications/
  domain/
    money/minor-units.ts
    money/allocate.ts
    balances/calculate-balances.ts
    balances/simplify-debts.ts
  server/
    auth/config.ts
    auth/guards.ts
    db/prisma.ts
    db/transaction.ts
    storage/
    notifications/
  lib/
    errors.ts
    result.ts
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
e2e/
```

Keep `use client` leaves small. Server Components fetch authorized data; React Hook Form uses shared Zod schemas, and the server parses every command again.

## 9. MVP phases

1. **Foundation:** scaffold Next.js, TypeScript, Tailwind, shadcn/ui, Prisma/Neon placeholder, Auth.js, typed errors, Vitest, Playwright, CI, and migration constraints.
2. **Financial domain:** decimal-string parsing, largest-remainder allocation, balances, and simplification with exhaustive unit/property-style tests.
3. **Groups/access:** profiles, group lifecycle, owner/member guards, invitation issue/accept/revoke, and activity logs.
4. **Expenses:** transactional CRUD, four split modes, multiple payers, responsive forms/tables, and PostgreSQL integration tests.
5. **Balances/settlements:** balance views, suggestions, transactional over-settlement protection, voiding, and concurrency tests.
6. **Collaboration:** comments, private receipt lifecycle, notification outbox, and in-app feed.
7. **Dashboard/hardening:** authorized analytics, charts, pagination, accessibility, critical Playwright paths, observability, rate limits, and security review.

A phase is complete only when backend rules and automated tests work. The UI should never expose controls backed by placeholders.

## 10. Financial, concurrency, and integrity edge cases

- Reject extra decimal places, exponent notation, signs, separators, Unicode digits, and values outside BigInt/database bounds.
- Handle rounding ties, totals smaller than participant count, zero weights, duplicate IDs, and one-minor-unit drift.
- Reject payer/exact sums that differ from total, percentages not exactly 10,000 basis points, and all-zero shares.
- Recheck membership if a member leaves between form load and submit; preserve historical accounting when creators leave.
- Prevent last-owner removal, duplicate invite acceptance, expired/revoked/exhausted links, and invite escalation to owner.
- Use idempotency for double-clicks and network retries.
- Reject stale expense edits through version checks.
- Serialize competing settlements so two individually valid requests cannot collectively over-settle.
- Reject self, wrong-direction, wrong-currency, zero/negative, or excessive settlements.
- Recheck archived status inside the write transaction.
- Commit financial rows and activity together; exclude deleted expenses and voided settlements everywhere.
- Store instants in UTC and define a group reporting timezone before date analytics.
- Prevent BigInt-to-number coercion in APIs, CSVs, and charts. Display-only chart conversion must be explicit and bounded.
- Validate receipt signatures and lifecycle state in PostgreSQL; deleted receipts must clear their byte payload.
- Keep activity in-transaction; use an outbox and retries for external notifications.
- Test server and database rejection paths directly, not only form validation.

## Testing baseline

Vitest covers every allocation mode, parsing boundaries, conservation invariants, balance invariants, and replay of simplified transfers. Randomized cases must prove allocations sum to totals. PostgreSQL integration tests cover constraints, idempotency, optimistic concurrency, rollback, and simultaneous settlements. Playwright covers auth, invitations, all split modes, archive read-only behavior, and settlement recording.
