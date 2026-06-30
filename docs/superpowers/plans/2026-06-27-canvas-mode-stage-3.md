# Canvas Mode Stage 3 Implementation Plan

> **For agentic workers:** keep the work local-first. Use the existing `selectedTaskIds` store state as the only selection source, and do not introduce a second canvas-specific selection model.

**Goal:** turn Canvas Mode into a selection-driven task action surface while preserving the stage-2 local layout overlay and the current detail-open behavior.

**Architecture:** keep `buildCanvasGraph()` and the stage-2 layout overlay unchanged, but make the canvas write to shared selection state. Nodes show selected state from `selectedTaskIds`, the canvas provides explicit selection affordances and marquee selection, and a compact single-selection quick-action strip routes to the existing task actions. Multi-selection should continue to use the app-wide batch action bar that already appears from shared store state.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, `@xyflow/react@12.11.1`

---

## File Map

- Modify: `src/components/CanvasWorkspace.tsx`
  - Add shared selection sync, explicit node selection affordance, marquee selection, escape-to-clear behavior, and a small single-selection quick action strip.
- Modify: `src/components/CanvasNode.tsx`
  - Render selected state and action chrome without replacing the existing node content hierarchy.
- Modify: `src/store.ts`
  - Keep `selectedTaskIds` canonical and prune it when tasks disappear or batch actions remove selected tasks.
- Modify: `src/components/DetailModal.tsx` or task action wiring only if needed
  - Reuse existing action flows instead of inventing new ones.
- Modify: `src/components/InputBar.tsx` only if the existing batch bar needs a small copy or visibility tweak for canvas-driven selection.
- Modify: `src/store.test.ts` and/or new component tests
  - Lock the shared-selection and prune-on-delete behavior, plus any focused canvas interaction regression coverage.
- Modify: `.agents/state/process.md`
  - Refresh the rolling handoff state after each meaningful milestone.

## Phase 1: Shared selection plumbing

Goal: make canvas selection reflect `selectedTaskIds`, and make selection clear/prune reliably.

- [ ] Inspect the current `selectedTaskIds` mutation paths and ensure they remain the only canonical selection state.
- [ ] Add canvas-level selection helpers that can set, toggle, and clear selected ids from the current visible nodes.
- [ ] Ensure delete / filter / batch cleanup keeps `selectedTaskIds` pruned without stale ids.
- [ ] Add or update tests for selection pruning and shared-state invariants.

## Phase 2: Canvas selection UI

Goal: make the canvas readable as an editable board without changing the underlying task model.

- [ ] Add a clear selected-node visual state in `CanvasNode`.
- [ ] Add an explicit selection affordance so selection does not depend on the existing detail-open click path.
- [ ] Add marquee selection on the canvas surface for visible nodes.
- [ ] Keep Escape as a clean selection reset.

## Phase 3: Single-selection quick actions

Goal: expose a compact canvas-local action strip for one selected task.

- [ ] Add a small action strip near the canvas that appears only when exactly one task is selected.
- [ ] Route detail, reuse, edit outputs, retry, favorite, and delete through the existing store actions.
- [ ] Verify multi-selection still falls back to the existing `InputBar` batch bar.

## Phase 4: Verify and stage

Goal: make the stage-3 increment safe to land.

- [ ] Run focused tests for selection and delete pruning.
- [ ] Run the full test suite and build if the focused checks pass.
- [ ] Update the rolling handoff state with what changed, what passed, and the next step.

