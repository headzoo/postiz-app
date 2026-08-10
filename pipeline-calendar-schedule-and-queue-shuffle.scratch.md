<!-- BIG-PLAN:1 -->

# Big Plan: Pipeline calendar schedule and queue shuffle

Plan status: complete
Review cycle: 0
Max review cycles: 2

## Objective

Move weekly posting-time configuration out of the Pipeline create/edit modal and into the Pipeline Open detail page, render it as an interactive seven-day-by-24-hour calendar with hover `+` controls, create new Pipelines with no schedule slots, and add a safe shuffle action for queued posts.

## Original request

I don't like having the timeline settings in the edit pipeline modal. (3rd screenshot) Remove them. Use defaults (0) when creating the pipeline.

The schedule should be configured from Pipelines -> Pipeline -> Open. The "Weekly schedule" view should be changed to look like the 7 day calendar. (1st screenshot) And like the calendar times are chosen by clicking a + that shows up in each hour of the day.

The "Queue" section on that same page (2nd screenshot) should have a shuffle button that randomizes the queued posts.

Context from screenshots:

- Screenshot 1: Calendar week view - 7-day grid with hourly rows (0:00 AM, 1:00 AM, etc.), + buttons appear in each hour cell on hover to add times.
- Screenshot 2: Pipeline detail page "Queue" section with queued posts (#1, #2) with drag handles, reorder controls, Edit/Now/Schedule/Remove/Delete buttons.
- Screenshot 3: "Edit Pipeline" modal with Timezone, Channels, and "Weekly schedule" sections - timeline settings should be removed from this modal.

## Global architectural decisions

- Interpret “Use defaults (0)” as **no schedule at all**: every newly created Pipeline is persisted with zero `scheduleSlots` rows. The server owns this empty default; the client must not send schedule data during creation.
- “Timeline settings” means the weekly posting-time editor. Remove that editor and its validation from both create and edit modal modes; retain Pipeline name, timezone, and channels in the modal because timezone cannot be represented by `0` and no replacement timezone-editing interaction was requested.
- Split metadata and schedule mutation contracts. The ordinary Pipeline update must preserve schedule rows and must not increment `scheduleRevision`; a dedicated schedule update route replaces schedule rows atomically and increments `scheduleRevision` so already-dispatched Temporal occurrences become stale safely.
- Allow an empty weekly schedule. Existing schedule helpers already return no upcoming slots when `scheduleSlots` is empty, so a Pipeline with no configured times simply does not auto-dispatch until the user adds slots on the detail page.
- Use the existing calendar week view as the visual reference, not as a directly embedded component: `CalendarColumn` is tightly coupled to composer context, posts, drag/drop, and modals. The Pipeline schedule grid should reuse its 24-hour labels, sticky seven-day layout, hover-plus interaction, and current `new*`/`btnPrimary` design tokens without deprecated `customColor*` tokens.
- Clicking an empty hourly cell adds the exact top-of-hour slot (`minuteOfDay = hour * 60`). A selected slot is visibly marked and removable. Existing non-hour schedule values must remain visible and removable in their containing hour cell and must not be rounded or discarded on save.
- Schedule edits are local until an explicit Save action succeeds. Disable duplicate exact slots and concurrent submissions; show API errors, refresh Pipeline detail/list SWR keys after success, and retain unsaved state after failure.
- Shuffle only `QUEUED` items; never include `PUBLISHING`, `FAILED`, `PUBLISHED`, or `REMOVED` items. The browser creates a Fisher-Yates permutation and sends the complete ordered queued-item ID list to a generic bulk reorder endpoint.
- The bulk reorder endpoint validates that IDs are unique and exactly match the Pipeline's current queued set, then rewrites sparse positions in one serializable Prisma transaction. A concurrent claim, enqueue, move, or reorder must produce a conflict/retry outcome rather than a partial or stale order.
- Do not change Prisma schema or existing Temporal workflow/activity signatures. The current `position` and `scheduleRevision` fields already support the feature.
- Preserve existing uncommitted user work. At planning time, `pipeline.schedule.editor.tsx` contains an uncommitted `removeError={true}` change; inspect the current file before editing and preserve its intent if the time input survives, or explicitly account for its obsolescence if the input is replaced by the calendar.

## Open questions / assumptions

- Assumption requiring product confirmation: “timeline settings” refers to weekly schedule slots only. Timezone and channels remain editable in the modal.
- Confirmed: “defaults (0)” means no schedule slots at creation time, not Sunday 00:00.
- The requested hourly `+` interaction adds top-of-hour times. Existing minute-precision slots remain compatible, but the new grid does not add arbitrary minute values.

## Execution policy

- The current repository is authoritative; this plan captures intent.
- Paths below are hints unless explicitly stated otherwise.
- Never use line numbers as implementation anchors.
- The orchestrator owns this plan's status fields and completion records.
- Implementers must not edit this plan file.

---

## Step BP-001: Separate schedule APIs and add atomic bulk ordering

Status: complete
Agent: reasoning-implementer
Model tier: reasoning
Session: foreground
Depends on: none
Parallel group: none
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

The DTO/controller/service/repository wiring is conventional, but safely separating schedule revisions and replacing an actively consumed queue order requires nontrivial transactional reasoning across scheduler claims, enqueue, move, and reorder behavior.

### Intent

Establish backend contracts that create Pipelines with no schedule rows, update metadata without touching schedules, replace schedules with correct revision semantics, and atomically persist a complete queued-item permutation.

### Architectural decisions to preserve

- The server creates Pipelines with zero schedule rows; no implicit default slot.
- Metadata edits preserve schedule rows and `scheduleRevision`.
- Schedule replacement increments `scheduleRevision`; slots must be unique when present, and an empty array is valid.
- Bulk ordering operates only on the exact current `QUEUED` set in a serializable transaction.
- No raw SQL, schema migration, workflow edit, or provider-specific logic.

### Semantic targets

- `CreatePipelineDto` and `UpdatePipelineDto` — stop accepting modal-controlled schedule rows while retaining name, timezone, and integrations validation.
- A dedicated schedule update DTO and route — validate zero or more nested `PipelineScheduleSlotDto` values.
- A bulk queue-order DTO and route — accept an ordered array of at least two unique string item IDs.
- `PipelineService.createPipeline`, metadata update, schedule update, and bulk reorder methods — enforce configuration, ownership, uniqueness, and useful not-found/conflict errors.
- `PipelineRepository.createPipeline`, metadata update, schedule replacement, and bulk queued-item ordering — apply the empty-schedule default and transaction boundaries with Prisma.
- Pipeline API/ranking tests — prove empty creation default, revision behavior, exact-set validation, deterministic ordering, and rollback/conflict behavior.

### Likely files

Paths are hints based on the repository at planning time.

- `libraries/nestjs-libraries/src/dtos/pipelines/pipeline.dto.ts`
- `apps/backend/src/api/routes/pipelines.controller.ts`
- `libraries/nestjs-libraries/src/database/prisma/pipelines/pipeline.service.ts`
- `libraries/nestjs-libraries/src/database/prisma/pipelines/pipeline.repository.ts`
- `libraries/nestjs-libraries/src/database/prisma/pipelines/pipeline.api.spec.ts`
- `libraries/nestjs-libraries/src/database/prisma/pipelines/pipeline.ranking.spec.ts`

### Implementation

1. Refactor the create/update DTO relationship so create and metadata update accept `name`, valid IANA `timezone`, and at least one integration, but no longer require or consume `scheduleSlots`. Add a schedule DTO containing a validated nested slot array that may be empty, and a bulk order DTO containing at least two string IDs; perform duplicate checks in the service because decorator validation does not establish exact-set semantics.
2. Update creation so the repository creates no schedule rows, regardless of client behavior. Keep timezone and integration ownership checks in the service.
3. Change ordinary metadata update so it still atomically enforces the existing “channels cannot change while queued items exist” rule, but does not delete/recreate schedule rows and does not increment `scheduleRevision`.
4. Add a dedicated authenticated organization-scoped route such as `PUT /pipelines/:id/schedule`, following DTO -> controller -> service -> repository. Reuse schedule bounds and duplicate validation, atomically replace schedule rows (including clearing all rows), increment `scheduleRevision`, return a useful updated result, and report missing Pipelines consistently.
5. Add a bulk queued-order route such as `POST /pipelines/:id/items/reorder` without disturbing the existing single-item route. In the service reject duplicate IDs. In one serializable repository transaction, load the organization-owned Pipeline and current non-deleted `QUEUED` IDs in canonical order, require exact set equality with the submitted IDs, then assign strictly increasing positions using the existing `QUEUE_POSITION_INCREMENT`. Return not found for an inaccessible Pipeline and conflict for a stale/mismatched queue.
6. Ensure transaction retries continue to handle Prisma `P2034`. Conditional reads/writes must prevent partial ordering if a scheduler claim or another queue mutation races the request.
7. Extend focused tests to cover: creation persists zero schedule rows; metadata update preserves schedule/revision; schedule replacement increments revision, accepts an empty array, and rejects duplicate slot values; bulk order rejects duplicate, foreign, missing, stale, or non-queued IDs; a valid permutation produces deterministic unique positions; and transaction failure cannot leave a partial order.

### Do not

- Do not add a database migration or modify `schema.prisma`.
- Do not edit existing Temporal workflow or activity files/signatures.
- Do not create any implicit default schedule row on Pipeline creation.
- Do not shuffle or rewrite positions for non-`QUEUED` items.
- Do not implement bulk reorder as multiple HTTP calls or independent Prisma writes.
- Do not weaken organization ownership checks or the queued-channel-change conflict.

### Acceptance criteria

- [ ] Creating a Pipeline without schedule input stores zero schedule rows.
- [ ] Editing name/timezone/channels leaves schedule rows and `scheduleRevision` unchanged.
- [ ] Dedicated schedule replacement validates slots, replaces them atomically, and increments `scheduleRevision` exactly once.
- [ ] A valid complete queued permutation is persisted in the submitted order with unique increasing positions.
- [ ] Stale, duplicate, incomplete, foreign, or non-queued permutations fail without a partial reorder.
- [ ] Existing individual drag/arrow reorder and scheduler execution behavior remain supported.

### Verification

```text
pnpm exec jest --config jest.pipelines.config.js --runInBand
pnpm build:backend
```

### Completion record

Started: 2026-08-10
Completed: 2026-08-10
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: apps/backend/src/api/routes/pipelines.controller.ts, libraries/nestjs-libraries/src/dtos/pipelines/pipeline.dto.ts, libraries/nestjs-libraries/src/database/prisma/pipelines/pipeline.service.ts, pipeline.repository.ts, pipeline.api.spec.ts, pipeline.ranking.spec.ts
Symbols changed: UpdatePipelineScheduleDto, ReorderPipelineQueueDto, PipelinesController.updatePipelineSchedule, PipelinesController.reorderQueue, PipelineService.updatePipelineSchedule, PipelineService.reorderQueue, PipelineRepository.updatePipelineSchedule, PipelineRepository.reorderQueuedItems
Verification result: jest pipelines PASS, build:backend PASS
Deviations: none
Notes for later steps: Existing frontend schedule payloads are now ignored by metadata contracts; BP-002 should remove them from modal UI and use dedicated schedule endpoint.

---

## Step BP-002: Build the detail-page weekly calendar editor

Status: complete
Agent: reasoning-implementer
Model tier: reasoning
Session: foreground
Depends on: BP-001
Parallel group: none
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

The implementation is frontend-only after the API is fixed, but preserving legacy minute slots while delivering a responsive 168-cell calendar, explicit save state, modal contract changes, and SWR cache coherence requires meaningful local reasoning.

### Intent

Remove weekly times from create/edit modals and make the Pipeline Open page's Weekly schedule section an editable calendar matching the established seven-day week view.

### Architectural decisions to preserve

- Keep name, timezone, and channels in the modal; remove weekly schedule UI and validation from both modal modes.
- Creation payload omits schedule data; the server persists an empty schedule.
- Reuse calendar visual conventions and approved `new*` design tokens, but do not import the composer-coupled `CalendarColumn`.
- Add top-of-hour slots via hover `+`; preserve and expose removal for existing off-hour values.
- Use a dedicated `useFetch`-based update hook and explicit Save semantics.

### Semantic targets

- `PipelineForm` — metadata-only form state, validation, and payloads.
- Pipeline frontend payload types — distinguish create/metadata update from schedule update.
- `PipelineScheduleEditor` — seven day headers, 24 hour rows, hover add affordances, selected/removable slot states, error and saving controls.
- `PipelineDetailView` Weekly schedule section — own draft schedule state, reset it when server data changes, save through the dedicated endpoint, and refresh detail/list projections.
- A separate schedule mutation hook — follow existing `useFetch`, `parseApiError`, and SWR mutation patterns.
- Existing `WeekView`, hour labels, `PIPELINE_DAYS`, and slot conversion utilities — visual/semantic references.

### Likely files

Paths are hints based on the repository at planning time.

- `apps/frontend/src/components/pipelines/pipeline.form.tsx`
- `apps/frontend/src/components/pipelines/pipeline.detail.tsx`
- `apps/frontend/src/components/pipelines/pipeline.schedule.editor.tsx`
- `apps/frontend/src/components/pipelines/pipeline.types.ts`
- `apps/frontend/src/components/pipelines/pipeline.utils.ts`
- `apps/frontend/src/components/pipelines/use.pipeline.update.ts`
- `apps/frontend/src/components/pipelines/use.pipeline.schedule.update.ts`
- `apps/frontend/src/components/pipelines/pipelines.tsx`
- `apps/frontend/src/components/launches/calendar.tsx`
- `apps/frontend/src/app/colors.scss`
- `apps/frontend/tailwind.config.cjs`

### Implementation

1. Inspect the current working tree before editing, especially the uncommitted schedule-editor change. Remove `dayTimes`, schedule validation, conversion imports, and `PipelineScheduleEditor` rendering from `PipelineForm`. Create and metadata-update payloads should contain only trimmed name, timezone, and selected integration IDs.
2. Update frontend request types and the existing metadata update hook to match BP-001. Add a separate schedule-update payload and a standalone hook that calls the dedicated route with `useFetch`, parses non-OK errors, and mutates both `pipelineDetailKey(id)` and `PIPELINES_KEY`.
3. Redesign `PipelineScheduleEditor` around `PIPELINE_DAYS` and 24 hourly rows. Match the calendar WeekView's scrollable grid, sticky day headers/left hour labels, borders, spacing, and hover-plus behavior. Use locale-aware 12/24-hour labels by reusing or extracting a small generic helper only if that avoids coupling; otherwise implement a local equivalent consistent with the existing calendar.
4. For each day/hour cell, display all matching existing times. If the exact top-of-hour slot does not exist, reveal an accessible `+` button on hover/focus that adds it. Existing slots, including values such as `09:30`, must show their formatted time and an accessible remove action. Prevent duplicate additions and use stable semantic keys.
5. Make the 168-cell grid horizontally scrollable at narrow widths with a practical minimum width; keep day/hour headers visible while scrolling. Use only the current `newBorder`, `newBgColor`, `newBgColorInner`, `newTableHeader`, `newTableText`, `btnPrimary`, and related non-deprecated tokens.
6. Replace the detail page's read-only day cards with the editor. Initialize draft values from `data.scheduleSlots`, resynchronize after successful SWR refresh without clobbering active unsaved edits, show dirty/saving/error states, and provide explicit Save and Reset/Cancel controls. Allow saving an empty schedule and explain that times use the displayed Pipeline timezone. When no slots are configured, show an empty calendar and copy that makes clear auto-posting will not run until times are added.
7. On successful save, show the established success toast and refresh detail/list so `nextSlot`, projections, and queue timestamps reflect the incremented revision. On failure, retain the draft and show a warning.
8. Adjust Pipeline list/create copy if it still claims posting times are chosen during creation. Keep the Open route as the documented place to configure the schedule.
9. Verify keyboard access: every add/remove control has a label containing day and time, focus reveals the same affordance as hover, disabled/saving state is communicated, and the grid remains usable without pointer hover.

### Do not

- Do not embed or generalize `CalendarColumn`; it owns unrelated post/editor/drag-drop behavior.
- Do not discard or round existing non-hour schedule slots.
- Do not introduce deprecated `customColor*` classes or a new component dependency.
- Do not send the old schedule array through metadata update.
- Do not auto-save every cell click.
- Do not overwrite the user's uncommitted schedule-editor work blindly.

### Acceptance criteria

- [ ] Create and edit Pipeline modals no longer display or validate Weekly schedule.
- [ ] Newly created Pipelines start with an empty schedule until the user configures times on the detail page.
- [ ] Pipeline Open shows seven day columns and 24 hourly rows styled like the current calendar week view.
- [ ] Hovering or focusing an empty hour cell exposes `+`; activating it adds that day at the exact hour.
- [ ] Selected and legacy off-hour slots are visible, removable, and never silently changed.
- [ ] Save updates the dedicated schedule API and refreshes next-slot/projection data; failures preserve the draft.
- [ ] The editor is responsive, keyboard accessible, and uses no deprecated color tokens.

### Verification

```text
pnpm build:frontend
Manual: create a Pipeline and confirm its Open page starts with an empty Weekly schedule while the modal contains no Weekly schedule section.
Manual: on Pipelines -> Pipeline -> Open, add slots by hover/focus +, remove all slots, save, reload, and verify next-slot/queue projections reflect the empty or updated schedule.
Manual: seed or retain a non-hour slot such as 09:30 and verify the grid displays and preserves it unless explicitly removed.
Manual: verify the calendar at desktop and narrow viewport widths in both light and dark themes.
```

### Completion record

Started: 2026-08-10
Completed: 2026-08-10
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: pipeline.form.tsx, pipeline.detail.tsx, pipeline.schedule.editor.tsx, pipeline.types.ts, use.pipeline.schedule.update.ts, pipelines.tsx
Symbols changed: PipelineForm, PipelineScheduleEditor, PipelineDetailView, UpdatePipelineSchedulePayload, useUpdatePipelineSchedule
Verification result: pnpm build:frontend PASS
Deviations: none
Notes for later steps: none

---

## Step BP-003: Add the Queue shuffle interaction

Status: complete
Agent: cheap-implementer
Model tier: cheap
Session: foreground
Depends on: BP-001, BP-002
Parallel group: none
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason

With the atomic bulk order contract already established, this is ordinary UI wiring using the queue's existing pending, error, refresh, and projection patterns.

### Intent

Add a Queue header button that randomizes queued posts, persists the complete permutation once, and refreshes all projected posting times.

### Architectural decisions to preserve

- Shuffle only the filtered `QUEUED` list.
- Use an unbiased Fisher-Yates permutation and one bulk API request.
- Reuse the queue's single pending state, toaster errors, and detail refresh.
- Never mutate publishing/failed items or call the per-item reorder endpoint repeatedly.

### Semantic targets

- `PipelineQueue` header and queue state — expose Shuffle beside the section title and disable it when unsafe.
- A queue shuffle/bulk-order mutation hook or callback — send the ordered IDs through `useFetch`, parse API errors consistently, and refresh detail data.
- Queue projections — rely on refreshed server detail so each item receives its new projected slot.

### Likely files

Paths are hints based on the repository at planning time.

- `apps/frontend/src/components/pipelines/pipeline.queue.tsx`
- `apps/frontend/src/components/pipelines/pipeline.types.ts`
- `apps/frontend/src/components/pipelines/pipeline.utils.ts`
- `apps/frontend/src/components/pipelines/use.pipeline.queue.order.ts`

### Implementation

1. Add a Shuffle button in the Queue section header, aligned with the title and using the existing `Button` styling. Give it an accessible label/tooltip that clearly says it randomizes queued posts.
2. Disable Shuffle while any queue action is pending and when fewer than two `QUEUED` items exist. Failed/publishing items shown below must not influence eligibility or the submitted ID set.
3. Generate a new Fisher-Yates permutation from a copied queued array. If the rare result equals the current order, force a different valid order (for example rotate once) so a successful user click always causes a visible change when at least two items exist.
4. Optimistically display the new queued order while retaining non-queued items in their existing section/order. Submit all queued IDs once to BP-001's bulk order endpoint.
5. On success, call the existing detail `mutate`/refresh path so positions, `#` labels, and `projectedFor` values come from server truth, and show a concise success toast. On conflict or any failure, refresh or restore the previous order and show the API error.
6. Keep drag-and-drop, arrow reorder, Move to, Edit, Now, Schedule, Remove, and Delete behavior unchanged after a shuffle.

### Do not

- Do not shuffle arrays in place.
- Do not include non-`QUEUED` IDs.
- Do not persist by issuing N individual reorder calls.
- Do not leave optimistic projections paired with stale items after the request settles.
- Do not enable the action for zero or one queued item.

### Acceptance criteria

- [ ] Queue displays a clearly labeled Shuffle control in its header.
- [ ] With at least two queued items, one click visibly changes order and persists it after reload.
- [ ] Queue numbers and projected Pipeline times refresh to match the randomized order.
- [ ] Publishing and failed items stay outside the shuffled set and preserve their section/order.
- [ ] The button is disabled during pending actions and for queues smaller than two.
- [ ] A stale/concurrent queue conflict restores server truth and reports the failure.
- [ ] All existing queue controls still work after shuffling.

### Verification

```text
pnpm build:frontend
Manual: shuffle a Pipeline with at least three queued items, reload, and confirm the same randomized order and recalculated projected times persist.
Manual: confirm Shuffle is disabled with zero/one queued item and while another queue action is pending.
Manual: include FAILED or PUBLISHING items and confirm only QUEUED items move.
Manual: after shuffling, exercise drag, arrow, Move to, Edit, Now, Schedule, Remove, and Delete controls for regressions.
```

### Completion record

Started: 2026-08-10
Completed: 2026-08-10
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: pipeline.queue.tsx, pipeline.types.ts, pipeline.utils.ts, use.pipeline.queue.order.ts
Symbols changed: PipelineQueue, ReorderPipelineQueuePayload, fisherYatesShuffle, shuffleQueuedOrder, useReorderPipelineQueue
Verification result: pnpm build:frontend PASS
Deviations: none
Notes for later steps: none

---

## Step BP-999: Final integration review

Status: complete
Agent: frontier-reviewer
Model tier: frontier
Session: foreground
Depends on: BP-001, BP-002, BP-003
Parallel group: none
Retry limit: 0
Escalation chain: stop

### Routing reason

A single frontier review after implementation is cheaper than frontier review after every step and catches cross-step integration problems.

### Intent

Review the completed implementation as a whole against the original objective and architectural decisions.

### Architectural decisions to preserve

- All global architectural decisions in this plan.

### Semantic targets

- The complete diff and all behavior changed by this plan.
- Create/edit modal payloads versus dedicated schedule mutation.
- Schedule revision interaction with existing scheduler discovery/claim behavior.
- Atomic queue permutation under concurrent claim/enqueue/move/reorder operations.
- Detail-page schedule accessibility, legacy minute-slot preservation, and queue projection refresh.

### Likely files

Paths are hints based on the repository at planning time.

- All files changed by completed implementation/remediation steps.

### Implementation

1. Review only; do not edit implementation files.
2. Check correctness, integration, regressions, security implications, error handling, contracts, unnecessary complexity, and coverage.
3. Confirm no existing Temporal workflow/activity file or parameter was changed and no schema migration was introduced unnecessarily.
4. Confirm current uncommitted user changes were preserved or intentionally superseded without unrelated work being modified.
5. Return `REVIEW_RESULT: PASS` when no material issue remains.
6. If material issues remain, return `REVIEW_RESULT: REMEDIATION_REQUIRED` followed by complete remediation step packets using the same step schema and cost-routing rules.
7. Do not create remediation for optional stylistic preferences.

### Do not

- Rewrite working code for style preference.
- Edit code directly.
- Request remediation for speculative improvements unrelated to the feature.

### Acceptance criteria

- [ ] Original feature requirements are satisfied.
- [ ] Cross-step integration is coherent.
- [ ] No material regression or correctness issue remains.
- [ ] Backend layering, Prisma-only persistence, SWR/useFetch patterns, and current design tokens are respected.
- [ ] Deterministic tests/builds and the required manual interactions have credible passing evidence.

### Verification

```text
Review the completed plan records, current repository, diff, and relevant deterministic verification results.
```

### Completion record

Started: 2026-08-10
Completed: 2026-08-10
Actual agent: frontier-reviewer
Attempts: 1
Result: PASS
Files changed: none
Symbols changed: none
Verification result: REVIEW_RESULT: PASS — feature requirements and architecture satisfied; no schema/migration/Temporal changes
Deviations: none
Notes for later steps: none
