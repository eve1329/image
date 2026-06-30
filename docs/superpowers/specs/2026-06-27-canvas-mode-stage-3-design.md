# Canvas Mode Stage 3 Design

## Summary

Stage 3 turns Canvas Mode from a local-layout board into a selection-driven task action surface.
The canvas still renders lineage derived from `TaskRecord`, and it still keeps the stage-2 local layout overlay, but the user can now select one or more task nodes and apply existing task actions directly from the canvas.

The scope stays local-first:

- selection is shared with the existing app state,
- task actions reuse the current store and modal flows,
- layout persistence remains browser-local,
- no backend sync, collaboration layer, or schema migration is introduced.

This gives the canvas a real editing edge without turning it into a new data model.

## Recommendation

Use the existing global `selectedTaskIds` as the canonical selection model and build canvas actions on top of it.

Why this is the best fit:

- It reuses the selection and batch-action semantics the app already has.
- It keeps one selection concept across canvas, grid, and other task surfaces.
- It avoids inventing a second canvas-specific store just for selection state.
- It lets us expose meaningful editing actions without touching backend contracts.

The canvas should stay a view over tasks, not a separate document.

## Alternatives Considered

1. **Inline prompt / parameter editing inside each canvas node**

   This is the most “editor-like” interpretation, but it is also the most likely to collide with the existing `InputBar`, `DetailModal`, and task submission flow. It would pull the stage into prompt editing semantics before we have a good reason to change them.

2. **Selection-driven task action surface**

   Recommended. The canvas becomes a place where users can select tasks, inspect them, and invoke the same task actions they already trust elsewhere in the app.

3. **Collaborative synced canvas document**

   Too large for this stage. It would require storage/versioning decisions that are unrelated to the current local editing problem.

## Scope For Stage 3

### In scope

- Select one or more task nodes on the canvas.
- Mirror canvas selection into the existing `selectedTaskIds` store state.
- Keep drag-to-pan and node dragging from stage 2 unchanged.
- Add a clear visual affordance for selected nodes.
- Provide a small canvas-local quick action strip for a single selected node.
- Reuse existing task actions from the app shell for batch operations on multiple selected tasks.
- Support explicit selection clearing from the canvas.
- Support box / marquee selection for visible nodes.
- Preserve the current lineage graph and local layout overlay.

### Out of scope

- No backend persistence of selection or action state.
- No shared collaboration, comments, or review threads.
- No new task schema fields.
- No new layout schema fields.
- No inline prompt editing inside the node body.
- No manual edge editing, edge creation, or graph rewiring.
- No node creation, node resizing, or nested canvases.
- No cross-device sync of canvas layout or selection.

## Data Model

### Source of truth

The existing `TaskRecord` remains the source of truth for task content and lineage.

Selection should reuse the app's current task-selection state:

- `selectedTaskIds` stays canonical for selected tasks.
- Canvas writes to that state instead of keeping a second selection store.
- Batch actions continue to work across task surfaces with one shared selection model.

### Layout And Selection Separation

Stage 2 already separated layout from content:

- `TaskRecord` and derived graph data describe what exists.
- browser-local layout overlay describes where nodes sit.
- `selectedTaskIds` describes which tasks are currently acted on.

Stage 3 should keep those three concerns separate.

### Action Routing

Canvas actions should reuse existing task flows rather than inventing new ones:

- detail open should continue to use the current detail modal flow,
- reuse should continue to use the current reuse flow,
- retry should continue to use the existing retry path,
- delete should continue to use the existing delete path,
- favorite and download should continue to use the existing selection/batch behavior.

## UI Structure

### Canvas Surface

The canvas should stay visually legible as a board, not become a form.

Recommended structure:

- a subtle node selection state with a clear ring or halo,
- a small selection affordance in node chrome so selection does not depend on destructive click behavior,
- a compact quick action strip for the selected single node,
- the existing global batch action surface for multi-selection,
- a small count indicator so the user can tell when the canvas is in selection mode.

### Node Composition

Each node already shows lineage, prompt, thumbnails, and metadata.
Stage 3 should add only the minimum extra chrome needed for editing:

- selected state,
- selection affordance,
- single-node quick actions,
- count / action feedback when multi-select is active.

Do not expand the node into a full editor panel.

### Action Surface

When exactly one task is selected, the canvas can expose quick actions such as:

- detail,
- reuse,
- edit outputs,
- retry,
- favorite,
- delete.

When multiple tasks are selected, the app should rely on the shared batch action surface rather than creating a second, canvas-only command palette.

## Interaction Model

### Allowed

- Select a single node from an explicit affordance or modifier-assisted click.
- Select multiple nodes with box / marquee selection.
- Clear selection with `Esc`.
- Apply batch actions to the selected tasks.
- Keep stage-2 drag, pan, zoom, and fit behavior intact.

### Not Allowed

- Plain selection should not destroy the current layout interaction model.
- Do not turn the canvas into a new prompt editor.
- Do not introduce node-edge editing.
- Do not introduce a second selection model that diverges from the store.

### Behavioral Details

- Plain node click should remain usable for detail viewing if that is the current expectation; selection should be explicit so stage-2 detail behavior is not lost accidentally.
- The user should be able to select without losing the ability to drag or inspect nodes.
- Selection should be limited to currently visible tasks when filters are active, but removing a task from view must not require new persistence.
- If a selected task disappears because of delete or filter changes, the selection should clear or prune cleanly.

## Error Handling And Empty States

- If no nodes are selected, the action surface should hide or disable itself.
- If a batch action removes the last selected task, the selection state should clear cleanly.
- If a selected task is filtered out, the UI should not keep showing stale node actions for it.
- If an action callback is unavailable, the canvas should fall back to the existing task detail flow rather than breaking interaction.

## Testing

Stage 3 should be covered by a compact, high-signal test set:

- selection sync tests for single-select, multi-select, and selection clear,
- store-level tests proving `selectedTaskIds` remains the shared selection source,
- UI smoke coverage for canvas batch actions and quick actions,
- regression coverage confirming stage-2 layout persistence is unchanged,
- keyboard shortcut coverage for selection clearing and batch delete behavior.

The important contract is that the canvas becomes more editable without becoming a separate task database.

## Implementation Boundary

Stage 3 stops at selection-driven editing and task actions.

It deliberately does not become:

- a synced canvas document,
- a collaborative editing surface,
- a prompt/schema migration,
- or a backend-backed layout system.

If the product later needs inline prompt editing, comments, collaborative cursors, or cross-device layout sync, those should be separate stages with their own storage and migration decisions.
