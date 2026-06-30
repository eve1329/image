# Canvas Mode Stage 2 Design

## Summary

Stage 2 turns the existing read-only Canvas Mode into a lightly editable workspace for local arrangement only. The user can drag task nodes, the app remembers those positions on this device, and the automatic lineage layout remains the baseline when no manual override exists.

The scope is deliberately narrow:

- manual node dragging is allowed;
- positions are persisted in browser `localStorage` only;
- the canonical task lineage still comes from `TaskRecord` and the derived graph;
- automatic layout continues to exist as the fallback and reset target;
- no backend schema, sync, export/import, or shared collaboration layer is introduced.

This keeps stage 2 useful for personal workflow tuning without turning the canvas into a new data model.

## Recommendation

Use an **overlay layout model**: keep the deterministic auto-layout from stage 1 as the base graph, then apply a device-local manual position map on top.

Why this is the best fit:

- It preserves the stage-1 graph derivation logic, so the canvas still reflects real task lineage.
- It makes reset behavior simple: clearing the manual map returns the user to the canonical auto-layout.
- It avoids rewriting graph generation or introducing a second source of truth for task relationships.
- It keeps persistence small and inspectable: a per-task position map keyed by task id.

## Alternatives Considered

1. **Persist only manual positions**

   Simplest storage model, but fragile. If a task graph changes or new tasks appear, the canvas can become hard to recover because there is no canonical fallback.

2. **Overlay manual positions on auto-layout**

   Recommended. The app keeps a stable auto-generated baseline and stores only user deviations. This is the least surprising behavior when the task set changes.

3. **Full canvas document model**

   More flexible in the long run, but too large for the current boundary. It would pull in export/import, versioning, and probably a more complex migration story.

## Scope For Stage 2

### In scope

- Enable node dragging in Canvas Mode.
- Persist manual node positions in browser `localStorage` only.
- Re-apply stored positions when the same tasks reappear.
- Keep auto-layout as the default for nodes without manual overrides.
- Allow a user action to reset layout back to the deterministic auto-layout baseline.
- Keep current lineage derivation, filtering, and read-only edges intact.
- Keep the rest of the app unchanged: gallery, agent, history, favorites, and generation flow remain as they are.

### Out of scope

- No backend persistence of layout state.
- No shared layout sync across devices or browsers.
- No task editing, prompt editing, edge editing, or node creation from Canvas Mode.
- No import/export of canvas layout state in stage 2.
- No canvas-specific collaboration, comments, or revision history.
- No new task schema fields for layout in `TaskRecord`.

## Data Model

### Source of truth

The existing `TaskRecord` and the derived graph remain the source of truth for task content and relationships.

The new layout state is a separate browser-local layer:

- `canvasLayoutVersion`: versioned `localStorage` payload for future migration.
- `taskId -> { x, y }`: manual node position overrides.
- optional `pinnedTaskIds`: future extension point only if we need to distinguish “user touched this node” from “position matches baseline”.

### Merge behavior

When the canvas renders:

1. Build the deterministic graph from the current `TaskRecord` set.
2. Compute the default auto-layout positions.
3. Look up any manual override for each task id.
4. Use the manual position when present; otherwise use the auto-layout position.
5. If the stored position map contains entries for missing tasks, keep them in storage for now but ignore them in the render.

That means a task can move between layers in the auto-layout while still retaining a manual override. The manual override always wins until reset.

### Persistence behavior

- Save after a drag finishes, not on every pointer move.
- Store only the minimum needed data: task id and x/y coordinates.
- Keep the payload device-local via `localStorage`.
- Use a versioned key so the format can change later without breaking older browsers or old payloads.

## UI Structure

### Canvas workspace controls

The canvas gets a small, explicit control cluster:

- `Reset layout` to discard manual overrides and return to the auto-layout baseline.
- `Fit view` to re-center the visible graph after manual edits or load.
- optional `Show local positions` or similar diagnostics only if they help validate the feature during development; they should not become a permanent product surface unless they provide obvious value.

### Dragging behavior

- Dragging is node-level only.
- Edges remain derived and read-only.
- Manual movement should feel immediate and not fight the auto-layout unless the user is actively moving a node.
- If two nodes overlap after a manual move, the app should not auto-resolve that conflict in stage 2; the user is allowed to arrange nodes freely.

### Reset behavior

Resetting layout should:

- clear the manual position map;
- return all nodes to auto-layout positions on next render;
- keep the underlying graph data untouched;
- not clear filters, search state, or detail selection unless the current canvas implementation already does so for other reasons.

## Interaction Model

### Allowed

- Drag task nodes to new positions.
- Pan and zoom the canvas as before.
- Reset to the baseline auto-layout.
- Open task details from a node click as in stage 1.

### Not allowed in stage 2

- Manual edge creation or deletion.
- Node resizing.
- Inline prompt editing.
- Backend-backed layout sharing.
- Any change that would require editing `TaskRecord` to store layout data.

### Behavioral details

- Manual overrides should persist across app reloads on the same browser profile.
- If a task disappears because of filtering, its stored override should remain available when the task returns.
- If the underlying graph changes enough that a task id is no longer present, the stale override should be ignored silently.

## Error Handling And Empty States

- If `localStorage` is unavailable or throws, the canvas should still work with auto-layout only.
- If stored layout data cannot be parsed, discard it and fall back to auto-layout rather than blocking the workspace.
- If the user clears site data, the canvas should simply return to auto-layout with no hard failure.
- Empty graph behavior remains the same as stage 1.

## Testing

Stage 2 should be covered by focused tests around the persistence boundary and layout merging:

- a test that dragging one node writes a local position override and rehydrates it on reload,
- a test that tasks without manual overrides still use auto-layout,
- a test that resetting layout clears only the local override layer,
- a test that malformed or missing `localStorage` data falls back safely,
- a UI-level smoke test that canvas mode still opens and the manual drag controls coexist with the stage-1 lineage board.

The tests should stay small and deterministic. The important contract is that the task graph stays derived from `TaskRecord`, while arrangement lives in a separate browser-local layer.

## Implementation Boundary

Stage 2 stops at local arrangement persistence.

That means the product gains a useful personal workflow tool without committing us to a collaborative document model, a backend migration, or a new schema for task lineage. If we later decide to support syncing or sharing layouts, that should be a new stage with its own explicit storage and versioning plan.
