# Database

Post++ uses Prisma with PostgreSQL. Database schema and generated client ownership is centralized under `libraries/nestjs-libraries/src/database/prisma`.

## Schema

The Prisma schema is:

```text
libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

The root scripts use that schema for generation and migrations:

```bash
pnpm run prisma-generate
pnpm run prisma-migrate-deploy
```

## Services And Repositories

Domain folders under `libraries/nestjs-libraries/src/database/prisma` usually pair a service with a repository:

- `posts/posts.service.ts` and `posts/posts.repository.ts`.
- `integrations/integration.service.ts` and `integrations/integration.repository.ts`.
- `pipelines/pipeline.service.ts` and `pipelines/pipeline.repository.ts`.
- `media/media.service.ts` and `media/media.repository.ts`.
- `webhooks/webhooks.service.ts` and `webhooks/webhooks.repository.ts`.

Services own business rules. Repositories own Prisma access. Keep raw Prisma query details out of controllers.

## Migration Safety

The project is production-backed. Schema changes need migration discipline:

- Use Prisma migrations, not raw SQL.
- Review generated SQL before deployment-sensitive changes.
- Preserve existing data unless the user explicitly requested a destructive change.
- Consider backfills or nullable rollout paths for required fields.
- Do not rely on application startup to mutate schema.

## Existing Deployment Guidance

The root README documents self-hosted migration adoption and warns that containers do not change schema during application startup. Keep that operational constraint intact when changing database behavior.

For existing databases previously managed by `prisma db push`, the documented process requires a backup, explicit schema verification, and manual `prisma migrate resolve --applied` for verified historical migrations only.

## Data Model Hotspots

The `Organization` model is central and relates to many areas:

- Users and organizations.
- Integrations and OAuth applications.
- Posts, media, sets, signatures, and webhooks.
- Pipelines and autopost.
- Followers, channel interactions, channel analytics, and relationship grades.
- Logs for posts and webhooks.

When adding an organization-scoped model, add indexes for the organization key and any high-cardinality query filters used by list endpoints.

## Adding Database Behavior

When adding database behavior:

1. Add DTOs for API input if the change is request-facing.
2. Add or update a service method for business rules.
3. Add or update a repository method for Prisma access.
4. Add indexes in `schema.prisma` for new query paths.
5. Generate Prisma client with `pnpm run prisma-generate`.
6. Add tests around service behavior and any migration-sensitive edge cases.
