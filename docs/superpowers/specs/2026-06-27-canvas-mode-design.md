# Canvas Mode Stage 1 Design

## Summary

Add a third top-level view to the existing React/Vite image playground: `Canvas Mode`.
This first stage is a shell, not a rewrite. It keeps the current generation API, history, favorites, and Agent workspace intact, and it turns the existing `TaskRecord` list into a read-only infinite-canvas style workspace.

The core layout decision is locked to **A**:

- Left side: prompt rail / task metadata.
- Right side: output thumbnail matrix.

That split matches the reference boards the user provided and keeps the prompt visually attached to the generated images instead of hiding it in a separate panel.

## Recommendation

Use a **React Flow-backed read-only canvas shell** for stage 1.

Why this is the best fit:

- It gives us pan, zoom, fit-to-view, nodes, edges, and a coordinate system without rebuilding viewport mechanics ourselves.
- It keeps the implementation aligned with open-source APIs instead of copying behavior from another app.
- It leaves the existing data model alone: the store still owns tasks, images, history, and Agent state.
- It is a cleaner long-term base if later stages add node dragging, edge editing, or expanded graph tools.

`basketikun/infinite-canvas` stays a reference for interaction language and visual composition only. It should not be copied into this repo because it is AGPL-3.0 and it is a complete product, not a small viewport library.

## Alternatives Considered

1. **Custom DOM / transform shell**

   Fastest to prototype, no extra dependency, but we would immediately start rebuilding pan/zoom, edge routing, fit-to-screen, and node coordination ourselves. That is the most likely path to wheel-reinvention.

2. **React Flow read-only shell**

   Recommended. It gives us the infinite-canvas primitives we need and keeps the stage 1 scope narrow.

3. **Fork or transplant `basketikun/infinite-canvas`**

   Not recommended. Too much product surface, too much coupling, and the license makes code reuse awkward.

## Scope For Stage 1

### In scope

- Add `Canvas Mode` as a third app mode alongside `gallery` and `agent`.
- Render tasks as read-only graph nodes.
- Map `inputImageIds` and `outputImages` into upstream / downstream connections.
- Show the prompt beside the images inside each node.
- Render output images as a thumbnail matrix first, not a full-size expandable editor.
- Provide basic zoom, pan, and fit-to-view.
- Keep current history, favorites, Agent workspace, and generation API untouched.

### Out of scope

- No backend schema or API rewrite.
- No node dragging, resizing, or edge editing in stage 1.
- No canvas persistence layer for manual layouts yet.
- No inline prompt editing from the canvas.
- No import/export, mini-map, nested canvases, or timeline reconstruction in stage 1.

## Visual Direction

The first version should feel like a dark editorial workbench rather than a generic diagram editor.

- Background: near-black matte surface with subtle grid or noise.
- Panels: soft charcoal cards with low-contrast borders.
- Accents: restrained cool-blue edge lines for relationships and focus states.
- Typography: reuse the existing UI font stack; keep labels compact and high-contrast.
- Signature move: each task node is a split card, with the prompt rail on the left and the thumbnail matrix on the right.

The prompt must stay visually adjacent to the images. That is the primary UX requirement, and it is the strongest reason to keep the node layout asymmetric.

## Data Model

### Source of truth

The existing `TaskRecord` stays the node source of truth.

- `TaskRecord.id` -> node id.
- `TaskRecord.prompt` -> prompt rail content.
- `TaskRecord.inputImageIds` -> upstream reference chips and incoming edge derivation.
- `TaskRecord.outputImages` -> thumbnail matrix and outgoing edge derivation.
- `TaskRecord.status`, `error`, `finishedAt`, `elapsed`, `apiModel`, `apiProvider`, `sourceMode` -> node badges and metadata.

### Edge derivation

Build a client-side reverse index:

- `outputImageId -> producing taskId`
- for every `inputImageId`, find the producing task
- create one edge per producer/consumer task pair
- dedupe multiple edges created by multiple inputs from the same producer

This keeps the graph derivable from existing data and avoids adding new persistence just to draw lines.

### Layout derivation

Use a deterministic, read-only layout:

- Left-to-right layers based on provenance depth.
- Sort tasks within a layer by `createdAt`.
- Use a stable fallback for orphan tasks or missing provenance.
- Keep the layout fixed in stage 1 so the user can explore it through pan/zoom instead of dragging nodes around.

The stage 1 goal is legibility, not manual arrangement.

## UI Structure

### App shell

- Extend `AppMode` with `canvas`.
- Keep the existing `Header`, `InputBar`, `SettingsModal`, `DetailModal`, `HistoryModal`, `Favorites`, and toast stack.
- Add a `CanvasWorkspace` route that renders when `appMode === 'canvas'`.
- Keep the existing `gallery` and `agent` paths unchanged.

### Canvas workspace

The workspace should contain:

- a viewport container,
- a minimal zoom toolbar,
- the graph viewport,
- read-only task nodes,
- edge lines.

The existing global search and favorite filters can continue to drive visibility, because they already exist in the store. No separate canvas search system is needed for stage 1.

### Node composition

Each task node should show:

- a compact header with status, source, and time metadata,
- the prompt rail on the left,
- input image chips or tiny previews near the prompt,
- the output thumbnail matrix on the right,
- a small overflow indicator when the output count exceeds the visible matrix capacity.

When a node is too small because of zoom level, it should collapse into a compact summary so the canvas remains readable at a distance.

## Interaction Model

### Allowed

- Pan across the canvas.
- Zoom in / out.
- Fit selected view to screen.
- Click a node to open the existing `DetailModal`.
- Use the existing global search and favorites filters to narrow the visible task set.

### Not allowed in stage 1

- Dragging nodes to new positions.
- Editing node text on canvas.
- Connecting or disconnecting nodes manually.
- Persisting manual graph layout changes.

### Behavior details

- Default entry into Canvas Mode should fit the current visible graph to the viewport.
- Edge rendering should stay readable at low zoom and not overwhelm the thumbnails.
- The node click path should reuse the existing detail experience rather than creating a second editor.

## Error Handling And Empty States

- Empty graph: show a centered empty state that explains there are no tasks yet or the current filters hide everything.
- Missing thumbnails: fall back to the existing cached thumbnail / placeholder logic used by `TaskCard`.
- Orphan tasks: render them as standalone nodes with no incoming edges.
- Partial provenance: if an input image cannot be mapped back to a task, keep the task visible and omit only the unresolved edge.
- Large graphs: keep image loading lazy and rely on the current thumbnail cache instead of preloading full-resolution assets.

## Testing

Stage 1 should be covered by a small, high-signal test set:

- graph derivation tests for node and edge mapping,
- layout tests for deterministic ordering,
- mode-switch smoke coverage to confirm `gallery`, `agent`, and `canvas` coexist,
- a UI sanity check for the A layout: prompt rail left, thumbnail matrix right.

The tests should focus on keeping the data mapping stable, because the canvas is just a view over existing state.

## Implementation Boundary

This stage deliberately stops before graph editing or canvas persistence.
That keeps the first deliverable shippable while still proving the central product idea: a task can be understood as a node in a visual lineage, not just as one card in a list.

If stage 1 feels good in practice, stage 2 can decide whether to add richer node editing, better auto-layout, mini-map, or a different open-source graph substrate. Stage 1 should not block that path.
