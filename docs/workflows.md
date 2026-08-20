# Temporal Workflows

The orchestrator app owns Temporal workflows and activities. It runs separately from the HTTP API and is wired from `apps/orchestrator/src/app.module.ts`.

## Module Wiring

`AppModule` imports:

- `DatabaseModule` from `libraries/nestjs-libraries/src/database/prisma/database.module.ts`.
- `getTemporalModule(true, require.resolve('./workflows'), activities)` from `libraries/nestjs-libraries/src/temporal/temporal.module.ts`.

Activities are registered from `apps/orchestrator/src/activities` and provided in the module.

## Workflows

Workflow files live in `apps/orchestrator/src/workflows`.

Current workflow areas include:

- `autopost.workflow.ts` for recurring autopost execution.
- `digest.email.workflow.ts` and `send.email.workflow.ts` for email jobs.
- `missing.post.workflow.ts` for missing content checks.
- `refresh.token.workflow.ts` for integration token refresh.
- `streak.workflow.ts` for streak-related scheduling.

## Activities

Activity files live in `apps/orchestrator/src/activities`.

Current activity areas include:

- Post publishing and missing content handling.
- Autopost execution.
- Integration refresh and provider operations.
- Pipeline queue operations.
- Channel interaction, relationship grade, and analytics snapshots.
- Email sending.

## Compatibility Rules

Temporal history makes workflow and activity changes unusually sensitive.

Do not change the parameters of workflows or activities that already exist on `origin/main`. Changing signatures can break in-flight workflow histories.

When behavior or parameters need to change:

1. Create a new activity or workflow version.
2. Register the new version.
3. Update call sites to start the new workflow or proxy the new activity.
4. Keep old versions available until in-flight executions are no longer dependent on them.

## Retry And Timeouts

Workflows call activities through `proxyActivities`. For example, `autoPostWorkflow` proxies `autoPost` with:

- `startToCloseTimeout: '10 minute'`.
- `taskQueue: 'main'`.
- A retry policy with `maximumAttempts: 3`.

When adding an activity call, set explicit timeouts and retries that match the external API or database behavior being invoked.

## Scheduling Patterns

Recurring workflows may sleep and loop, as in `autoPostWorkflow`. Treat these as durable state machines:

- Keep loop state simple and serializable.
- Avoid importing non-deterministic Node APIs into workflow code.
- Move side effects into activities.
- Use services/repositories from activities, not workflows.
