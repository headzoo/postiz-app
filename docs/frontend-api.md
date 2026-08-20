# Frontend API Clients

The frontend is a Next.js React app under `apps/frontend`. API calls should use SWR and the shared `useFetch` hook from `libraries/helpers/src/utils/custom.fetch.tsx`.

## Fetch Wrapper

`FetchWrapperComponent` creates a request client with project-specific request hooks and exposes it through React context. Components call `useFetch()` to access that client.

The underlying helper lives in:

```text
libraries/helpers/src/utils/custom.fetch.func.ts
```

Keep this helper generic. Do not add provider-specific behavior or UI-specific assumptions to the shared fetch layer.

## SWR Pattern

Each SWR query should be wrapped in a dedicated hook. This keeps hook usage compliant with `react-hooks/rules-of-hooks` and makes cache keys explicit.

Preferred shape:

```tsx
const useFollowers = (integrationId: string) => {
  const fetch = useFetch();

  return useSWR(['followers', integrationId], () =>
    fetch(`/integrations/${integrationId}/followers`)
  );
};
```

Avoid returning nested functions that call hooks later. Hooks must be called at the top level of the hook body.

## Cache Keys

Use cache keys that include the route identity and every parameter that affects the response. For example, include IDs, filters, pagination, dates, or integration identifiers in the SWR key.

Mutation hooks should invalidate or update the same keys used by read hooks.

## Route Ownership

Frontend API hooks should match backend route ownership:

- Post and calendar screens call `apps/backend/src/api/routes/posts.controller.ts`.
- Pipeline screens call `pipelines.controller.ts` and `pipeline-autopost.controller.ts`.
- Follower screens call `followers.controller.ts`.
- Admin screens call `admin.controller.ts` and admin auth helpers.
- Integration screens call `integrations.controller.ts` and OAuth controllers.

If a frontend change needs a new backend endpoint, add the backend DTO/controller/service/repository path first, then wire the frontend hook.

## Error Handling

Prefer using the existing fetch helper behavior and local UI patterns for errors. Avoid ad hoc fetch wrappers in components.

When a flow has special behavior, such as admin step-up or upload progress, keep that behavior near the relevant feature hook/component and preserve the shared fetch abstraction.
