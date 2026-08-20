<p align="center">
  <img alt="Post++ Internal Docs" src="./images/logo.png" width="280" />
</p>

# Post++ Internal Docs

This repository is documented for maintainers working on internals and APIs: backend route ownership, public API behavior, Temporal workflows, Prisma data access, frontend API clients, and operational commands.

**Full documentation:** [https://headzoo.github.io/postplusplus/](https://headzoo.github.io/postplusplus/)

## Documentation

- [Internal overview](https://headzoo.github.io/postplusplus/)
- [Architecture](https://headzoo.github.io/postplusplus/architecture)
- [Backend API](https://headzoo.github.io/postplusplus/backend-api)
- [Public API](https://headzoo.github.io/postplusplus/public-api)
- [Temporal workflows](https://headzoo.github.io/postplusplus/workflows)
- [Database](https://headzoo.github.io/postplusplus/database)
- [Frontend API clients](https://headzoo.github.io/postplusplus/frontend-api)
- [Operations](https://headzoo.github.io/postplusplus/operations)

Canonical docs live in [`docs/`](./docs/). Edit those pages directly, then run `pnpm docs:build:nav` to refresh the VitePress sidebar.

## Development

```bash
pnpm install
pnpm test
pnpm docs:serve
pnpm docs:build
```

## License

This repository's source code is available under the [AGPL-3.0 license](LICENSE).
