# Post++

![Post++ Logo](./images/logo.png)

[![License: AGPL 3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

**Post++** (Post Plus Plus) is your ultimate AI social media scheduling tool. Schedule posts across 28+ channels, build an audience, and grow your business — an alternative to Buffer, Hypefury, Twitter Hunter, and similar tools.

## Features

- Schedule posts and manage them from a calendar view
- Pipelines (recurring slots, queued content, autopost)
- Agents
- Analytics
- Followers
- Team management
- Media library
- Context documents
- Automation via API

## What Post++ adds

Post++ is a fork of Postiz. On top of the shared scheduling foundation, it adds:

- Pipelines with recurring slots, queued content, schedule management, and autopost
- Followers and audience tooling (triage, relationship grades, notes, lists, and interaction history)
- Channel interaction tracking (likes, replies, quotes, and reposts via webhooks)
- Context documents for AI
- Calendar search across scheduled content
- Platform-specific analytics snapshots

## Tech Stack

- pnpm workspaces (monorepo)
- Vite + React (frontend)
- NestJS (backend and orchestrator)
- Prisma (PostgreSQL by default)
- Temporal
- Resend (email notifications)

## Quick Start

Prerequisites: Node.js `>=22.12`, [pnpm](https://pnpm.io), and Docker.

1. Copy the environment template and configure required variables:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start local infrastructure and the app (Postgres, Redis, Temporal, then backend, frontend, and orchestrator):

   ```bash
   pnpm dev
   ```

`pnpm dev` runs `docker compose -f ./docker-compose.dev.yaml up -d --wait`, then starts the development servers in parallel.

## Database migrations for self-hosted deployments

Post++ containers do not change the database schema during application startup. The
image contains the workspace-pinned Prisma CLI and generated client, and migrations
must succeed before the application container is replaced.

### Fresh database

Start PostgreSQL, pull the target Post++ image, and run the migration container
before starting Post++:

```bash
docker compose up -d postiz-postgres
docker compose pull postiz
docker compose run --rm --no-deps postiz pnpm run prisma-migrate-deploy
docker compose up -d postiz
```

The migration command uses the `DATABASE_URL` configured for the `postiz` Compose
service and does not publish the application's ports.

### Existing database previously managed by `prisma db push`

Do this one-time adoption before enabling an automated deployment that runs
`prisma migrate deploy`.

1. Stop Post++ writes and take a tested PostgreSQL backup. Keep the previous image
   and backup available; Prisma migrations do not provide an automatic rollback.
2. Pull the target image and verify the database schema against the migration SQL
   and the Prisma schema in that exact image. Identify which migrations are already
   fully reflected in the database. Do not infer adoption from a Prisma error code.
3. Mark the generated baseline as applied only when every object in the historical
   pre-`20260812120000_channel_interactions` schema has been verified. Verify any
   later objects separately in the next step:

   ```bash
   docker compose run --rm --no-deps postiz pnpm exec prisma migrate resolve \
     --applied 20260812110000_pre_channel_interactions_baseline \
     --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma
   ```

4. In chronological order, mark each later migration as applied only if an operator
   has verified that its complete SQL change is already present:

   ```text
   20260812120000_channel_interactions
   20260812130000_follower_relationship_details
   20260813000000_audience_member_note_count
   20260813120000_post_webhook_http_logs
   20260813130000_align_relationship_fk_name
   ```

   Use the same `prisma migrate resolve --applied <migration-name> --schema ...`
   command for each verified migration. Leave unapplied migrations unresolved so
   `migrate deploy` can apply them.

5. Run:

   ```bash
   docker compose run --rm --no-deps postiz pnpm run prisma-migrate-deploy
   ```

   Start or recreate Post++ only after it succeeds. If verification or migration
   fails, keep Post++ stopped, investigate, and restore the backup before returning
   to the previous image when recovery is required.

Never automate `migrate resolve` for an unknown or merely populated database.

This repository also has a manual GitHub Action, **Adopt Prisma baseline**, that
runs the six historical `--applied` resolves above, then `migrate deploy`, then
recreates Post++. It only starts if you type this confirmation string exactly:

```text
I have a tested backup and verified the existing database schema matches the v1.4.5 migrations
```

It does not run on tag pushes or regular Deploy jobs. Do not use it unless you
have already completed steps 1–2.

## Compliance

- Post++ is an open-source, self-hosted social media scheduling tool that supports platforms like X (formerly Twitter), Bluesky, Mastodon, Discord, and others.
- Post++ hosted service uses official, platform-approved OAuth flows.
- Post++ does not automate or scrape content from social media platforms.
- Post++ does not collect, store, or proxy API keys or access tokens from users.
- Post++ never asks users to paste API keys into our hosted product.
- Post++ users always authenticate directly with the social platform (e.g., X, Discord, etc.), ensuring platform compliance and data privacy.

## License

This repository's source code is available under the [AGPL-3.0 license](LICENSE).
