# Design Document

## Overview

A no-behavior-change cleanup of the view layer. There are no new components, no new interfaces, and no domain or persistence behavior change. Each edit below was checked against the current source. The design is a list of concrete edits per file, grouped by requirement.

Reusable pieces this work leans on:

- `ChangeSignal` already exposes bound `subscribe` and `getVersion`. Every `ObservableStore` owner (`DeleteFlow`, `Navigator`, `Notifier`) exposes them as `subscribe = this.signal.subscribe` and `getVersion = this.signal.getVersion`. `RenameController` is the one owner that does not, and Requirement 5 brings it in line. `Workspace` keeps arrow wrappers because its `signal` is assigned in the constructor; it only gains an explanatory comment.
- `Diagram.setViewport` already does the work of `recordViewport`. Requirement 3 removes the wrapper and calls it directly.

## Architecture

The layering is unchanged: `src/domain` and `src/persistence` stay free of React and `@xyflow/react`, and `CanvasView` still talks to the domain through `Diagram`. The only structural change is that `CanvasView` calls `Diagram.setViewport` itself instead of through `recordViewport`.

## Components and Interfaces

No component or public interface is added. The concrete edit per file follows.

### Source

| File | Edit | Requirements |
| --- | --- | --- |
| `src/view/ComponentNode.tsx` | Replace the comment above `press` ("React Flow selects on pointerdown, before click, so only here is the previous Focus still visible") with: React Flow selects a node on click. Capturing `selected` at pointerdown is still correct because pointerdown precedes click, so the previous Focus is still visible. | 1.1, 1.2 |
| `src/view/ComponentNode.tsx` | Add `type MouseEvent` to the `react` import. Change `onClick = (e: { detail: number; clientX: number; clientY: number })` to `onClick = (e: MouseEvent)`. The body only reads `detail`, `clientX`, `clientY`, so it compiles unchanged. | 6.3 |
| `src/view/DiagramProjector.ts` | `data: { label: c.details.name }` becomes `data: {}`. `ComponentNode` reads the live name from `Details`, so nothing reads `data.label`. | 2.1 |
| `src/view/DiagramProjector.test.ts` | Change `expect(nodes[0].data).toEqual({ label: 'A' })` to `expect(nodes[0].data).toEqual({})`. Rename the test to "...with matching id and position". Delete the now pointless `a.details.patch({ name: 'A' })` line. | 2.2 |
| `src/view/CanvasView.tsx` | Delete `import { recordViewport } from './recordViewport'`. Change `onMoveEnd={(_, viewport) => recordViewport(diagram, viewport)}` to `onMoveEnd={(_, viewport) => diagram.setViewport(viewport)}`. React Flow's `Viewport` is structurally identical to the domain `Viewport`, which is what `recordViewport` already relied on. | 3.1 |
| `src/view/CanvasView.tsx` | Change `import { useEffect, useRef, useState } from 'react'` to also import `type MouseEvent`. Change `(e: React.MouseEvent)` to `(e: MouseEvent)`. | 6.2 |
| `src/view/CanvasView.tsx` | Re-indent the return block: the `div` one level inside `RenameContext.Provider`, and `<ReactFlow ...>` and its props one level inside the `div`. Whitespace only. | 6.1 |
| `src/view/recordViewport.ts` | Delete. | 3.2 |
| `src/view/recordViewport.test.ts` | Delete. It only covered the wrapper. `Diagram.setViewport` keeps its coverage in `viewports.property.test.ts` and `Diagram.test.ts`. | 3.2, 8.2 |
| `src/smoke.test.ts` | Delete. | 4.1, 8.2 |
| `src/view/RenameController.ts` | Replace the two arrow-function members with `subscribe = this.signal.subscribe` and `getVersion = this.signal.getVersion`. Safe as is: `signal` is a field initializer declared earlier in the class. | 5.1 |
| `src/domain/Workspace.ts` | Add a one-line comment above `subscribe` and `getVersion`: they stay arrow wrappers because `signal` is assigned in the constructor, after field initializers run. No code change. | 5.2 |
| `src/domain/Scheduler.ts` | Change the comment to "Lets Notifier, AutoSaver and RenameController run against a fake clock in tests." | 6.4 |

### Specs and diagrams

| File | Edit | Requirements |
| --- | --- | --- |
| `.kiro/specs/component-click-interaction/design.md` | See the list below. | 1.3, 7.1 to 7.4 |
| `.kiro/specs/canvas-double-click-create/design.md` | See the list below. | 7.2 to 7.4 |
| `.kiro/specs/flow/design.md` | Remove the `onMoveEnd` bullet's `recordViewport(diagram, viewport)` call: it becomes "`onMoveEnd` calls `diagram.setViewport(viewport)` (4.1, 4.2)". Remove `recordViewport` from the CanvasView collaborators line. Delete the whole `**recordViewport(diagram, viewport)**` block. In Testing, delete the `recordViewport` bullet and reword the "Not tested here" line to say only React Flow's own pan and zoom is not tested. In the traceability table, drop `recordViewport` from the 4.1 and 4.2 rows. | 3.3 |
| `docs/diagrams/system-architecture.mmd` | Delete the `recordViewport` node and the `CanvasView --> recordViewport` edge. | 3.4 |

`component-click-interaction/design.md`:

- Architecture, "React Flow selects a node on pointer down, before `onNodeClick` runs" becomes: React Flow selects a node on click. `ComponentNode` captures `selected` on `pointerdown`, which is still correct because pointerdown precedes click, so the prop still holds the previous value. Remove the claim that a click handler cannot see the previous Focus.
- Sequence diagram: the "not focused" branch note ("selection already moved") becomes "this click moves the selection".
- Decisions table: the `wasFocused` rationale ("Only point where the pre-click focus is still observable") becomes the pointerdown-precedes-click rationale. The "Pending Rename lives in the controller, not in a React ref" row stays.
- Findings list: the `DiagramProjector.toNodes` bullet no longer mentions `data.label`. In the "DiagramProjector (changed)" section, remove "`data.label` stays for compatibility" and say `data` is an empty object.
- ComponentNode section: "on mount, focus and select all text" becomes a per-frame retry (up to `MAX_FOCUS_FRAMES`) until the input holds focus, because React Flow keeps a new node `visibility: hidden` until it measures it. Focus is not single-shot on mount.
- Level section: "In `onSelectionChange`, calls `controller.cancel()`" becomes: cancels pending work only when the selection key changes (via `selectionKey`), not on every call, because React Flow re-reports an unchanged selection on each render.

`canvas-double-click-create/design.md`:

- Level section: the sentence about the new id says it is held in React state (not a ref) because the sync runs during render. It already says this. Add that the sync clears it in the same pass, so pending focus is consumed once per model change.
- RenameController section: the sentence "The selection change caused by creation calls `rename.cancel()` in `Level`" becomes: `onSelectionChange` cancels only when the selection actually changes, and that cancel leaves an active Rename alone.
- Statement that the input "already focuses and selects its text on mount" becomes: it retries focus per frame until it sticks, so focus is not single-shot on mount.

## Data Models

No change. The only data-shape edit is that a React Flow node's `data` is `{}` instead of `{ label }`, and nothing reads `label`.

## Error Handling

No runtime error paths change. Failure modes are build-time: a stale import of `recordViewport`. It surfaces in `tsc -b`.

## Testing Strategy

Property-based testing does not apply. The refactor adds no behavior, so there is no new input-dependent logic to quantify over. Correctness Properties are omitted.

- Existing tests are the safety net. Every test is kept except `recordViewport.test.ts` and `smoke.test.ts` (8.2). `RenameController.test.ts` exercises the changed subscription fields.
- `DiagramProjector.test.ts` is updated per Requirement 2.2.
- Run `npm run build`, `npm test` and `npm run lint`. All three must exit 0 (8.1).
- A final `grep` for `recordViewport` over `src`, `docs`, and `.kiro/specs/flow/design.md` must return nothing (3.2 to 3.4).

## Documentation

`docs/diagrams/system-architecture.mmd` is the only diagram affected (3.4). The other diagrams do not mention `recordViewport` or the changed constructor.

## Out of Scope

`.kiro/specs/flow/tasks.md` and `tasks.meta.json` still name `recordViewport`. They record completed work and stay unchanged.
