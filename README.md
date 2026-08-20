<p align="center">
  <img alt="Post++ Internal Docs" src="./images/logo.png" width="280" />
</p>

This repository is documented for maintainers working on internals and APIs: backend route ownership, public API behavior, Temporal workflows, Prisma data access, frontend API clients, and operational commands.

**Full documentation:** [https://headzoo.io/postplusplus/](https://headzoo.io/postplusplus/)

## Documentation

- [Internal overview](https://headzoo.io/postplusplus/)
- [Architecture](https://headzoo.io/postplusplus/architecture)
- [Backend API](https://headzoo.io/postplusplus/backend-api)
- [Public API](https://headzoo.io/postplusplus/public-api)
- [Temporal workflows](https://headzoo.io/postplusplus/workflows)
- [Database](https://headzoo.io/postplusplus/database)
- [Frontend API clients](https://headzoo.io/postplusplus/frontend-api)
- [Operations](https://headzoo.io/postplusplus/operations)

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

```bash
pnpm install
pnpm test
pnpm docs:serve
pnpm docs:build
SCREENSHOT_AUTH_TOKEN=<token> pnpm docs:screenshots
```

## License

This repository's source code is available under the [AGPL-3.0 license](LICENSE).
