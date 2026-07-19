# FairShare deployment checklist

## Required environment variables

- `DATABASE_URL`: Neon pooled runtime connection string.
- `DIRECT_URL`: Neon direct connection string used only by Prisma migrations.
- `AUTH_SECRET`: a production-only high-entropy Auth.js secret.
- `AUTH_URL`: the canonical HTTPS application URL when the platform cannot infer it.

Never commit `.env`. Configure these values in the deployment platform and use separate Neon branches or databases for preview, staging, and production.

## Release sequence

1. Run `npm ci`.
2. Run `npm run typecheck`, `npm run lint`, `npm run test:coverage`, and `npm run test:e2e`.
3. Apply committed migrations with `npx prisma migrate deploy` using `DIRECT_URL`.
4. Run `npm run build` and deploy the Next.js application using the Node.js runtime.
5. Verify `/sign-in`, an authenticated group page, a receipt download, and the notification inbox over HTTPS.

## Operational notes

- Receipt files are stored in PostgreSQL `bytea` and limited to 5 MB. Monitor storage; move the same authenticated download contract to private object storage before substantially raising this limit.
- Financial balances are derived from normalized expenses and settlements. Do not introduce mutable balance columns.
- Keep regular Neon backups and test migration rollback procedures on a non-production branch.
- Application security headers are configured in `next.config.ts`. Terminate TLS at the hosting platform.
- External notification delivery would require an outbox; current notifications are transactional and in-app only.
