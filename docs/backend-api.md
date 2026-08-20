# Backend API

The backend API is a NestJS application under `apps/backend`. This page documents the internal app API used by the frontend and authenticated users, not the token-auth public API.

## Module Wiring

`apps/backend/src/api/api.module.ts` is the main map for authenticated app routes. It imports shared providers from `libraries/nestjs-libraries` and applies `AuthMiddleware` to the `authenticatedController` list.

Controller groups include:

- Auth and user state: `auth.controller.ts`, `users.controller.ts`, `admin-auth.controller.ts`.
- Publishing and scheduling: `posts.controller.ts`, `pipelines.controller.ts`, `pipeline-autopost.controller.ts`, `autopost.controller.ts`.
- Channels and integrations: `integrations.controller.ts`, `approved-apps.controller.ts`, `oauth.controller.ts`, `oauth-app.controller.ts`, `channel-webhooks.controller.ts`.
- Media and content: `media.controller.ts`, `context-documents.controller.ts`, `sets.controller.ts`, `signature.controller.ts`.
- Measurement and logs: `analytics.controller.ts`, `followers.controller.ts`, `logs.controller.ts`.
- Admin and billing: `admin.controller.ts`, `billing.controller.ts`, `stripe.controller.ts`, `enterprise.controller.ts`.

Controllers outside the authenticated list, such as `public.controller.ts`, `monitor.controller.ts`, and webhook/OAuth entry points, need separate review because they may be intentionally unauthenticated.

## Request Flow

Most request flows should look like this:

1. DTOs in `libraries/nestjs-libraries/src/dtos` validate and shape request input.
2. Controllers in `apps/backend/src/api/routes` handle HTTP decorators and organization/user extraction.
3. Services in `libraries/nestjs-libraries/src/database/prisma` apply business rules.
4. Repositories in the same domain folder perform Prisma access.

Keep controllers thin. If a controller starts coordinating multiple domain concepts, prefer moving that orchestration into a service or manager that already matches the local pattern.

## Organization Context

Authenticated controllers commonly use decorators from `libraries/nestjs-libraries/src/user`, including:

- `GetOrgFromRequest` for organization-scoped operations.
- `GetUserFromRequest` for user-scoped actions.

The repository should not trust client-provided organization IDs when the authenticated context already supplies one.

## Authorization

Policy checks use the permission helpers under `apps/backend/src/services/auth/permissions`. Sensitive admin flows can require step-up verification with `RequireAdminStepUp`.

When adding or changing an endpoint:

- Confirm the controller is in the correct authenticated or unauthenticated module list.
- Add a `CheckPolicies` guard when the action maps to an authorization section.
- Use existing `AuthorizationActions` and `Sections` values before adding new ones.
- Treat admin endpoints and debug exports as sensitive by default.

## Endpoint Discovery

For quick route discovery, search controller decorators:

```bash
rg '@(Get|Post|Put|Delete|Patch)\(' apps/backend/src/api/routes
```

For public API endpoints, see [Public API](/public-api).

## Adding A Route

When adding an app API route:

1. Add or reuse a DTO in `libraries/nestjs-libraries/src/dtos`.
2. Add the controller method in the relevant `apps/backend/src/api/routes/*controller.ts`.
3. Add business logic to the domain service in `libraries/nestjs-libraries`.
4. Add repository changes only where Prisma access is needed.
5. Add focused tests around the changed service/controller behavior.
6. Verify frontend callers use SWR and `useFetch` as described in [Frontend API Clients](/frontend-api).
