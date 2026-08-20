# Architecture

Post++ is organized around a small number of app entry points and shared libraries. Most durable business logic lives in `libraries/nestjs-libraries`, while app packages expose transport-specific boundaries such as HTTP controllers, Temporal workers, or React screens.

## Monorepo Boundaries

The root `package.json` owns shared dependencies, scripts, Prisma generation, and workspace-level commands. Application packages live under `apps/`; shared code lives under `libraries/`.

Key boundaries:

- `apps/backend` is the NestJS API process. It wires controllers, authentication middleware, guards, and provider managers.
- `apps/orchestrator` is the Temporal worker process. It registers workflows and activities using `getTemporalModule`.
- `apps/frontend` is the Vite React application. It calls backend routes through SWR hooks and the shared `useFetch` helper.
- `libraries/nestjs-libraries` is the server domain library. It owns Prisma services/repositories, DTOs, integrations, upload adapters, Temporal registration helpers, and reusable services.
- `libraries/helpers` is a cross-runtime helper package. The frontend fetch wrapper lives here and should remain generic.

## Backend Layering

Backend changes should pass through the established layers:

```text
DTO -> Controller -> Service -> Repository
```

Some flows use a manager between the controller and service:

```text
DTO -> Controller -> Manager -> Service -> Repository
```

Controllers belong in `apps/backend/src/api/routes` or `apps/backend/src/public-api/routes`. Services and repositories should usually live in `libraries/nestjs-libraries/src/database/prisma` or another shared library folder when they are business logic rather than transport wiring.

## Authentication Boundaries

The backend has two HTTP API groups:

- Authenticated app routes are registered by `ApiModule` in `apps/backend/src/api/api.module.ts`.
- Token-auth public API routes are registered by `PublicApiModule` in `apps/backend/src/public-api/public.api.module.ts`.

`ApiModule` applies `AuthMiddleware` to the authenticated controller list. `PublicApiModule` applies `PublicAuthMiddleware` to the public API controller list.

## Provider Boundaries

Generic flows must not branch on a specific social provider in shared logic. Provider-specific behavior belongs behind provider interfaces and concrete provider implementations under the integration layer.

When adding a provider capability:

- Extend the provider-facing interface.
- Call the new capability from generic code through the interface.
- Implement provider-specific details in that provider implementation.

## Background Work

Background work runs in `apps/orchestrator`. Workflows live in `apps/orchestrator/src/workflows`; activities live in `apps/orchestrator/src/activities`.

Temporal workflow and activity signatures are compatibility-sensitive. If a workflow or activity has already shipped on `origin/main`, add a new version instead of changing existing parameters.

## Data Ownership

The Prisma schema is in `libraries/nestjs-libraries/src/database/prisma/schema.prisma`. Prisma repositories and services live alongside the domain they own, for example `posts/posts.repository.ts` and `posts/posts.service.ts`.

Avoid raw SQL. Use Prisma and preserve migration safety for production databases.
