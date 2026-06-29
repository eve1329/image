# Techno-Gothic Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the app into the quiet `Techno-Gothic 工作台` direction from the approved spec without changing routes, state, or backend behavior.

**Architecture:** Start with one shared dark shell in `src/index.css`, then re-skin the top chrome and shared controls so every surface uses the same border, radius, and accent rules. After that, restyle the gallery/task-list, agent dock, and canvas surfaces independently but with the same token vocabulary. Keep the pass purely presentational: no new packages, no store/API changes, and no deferred overlays in this stage.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, CSS variables in `src/index.css`, Zustand state that stays untouched, Vite + Vitest for verification, `@xyflow/react` for Canvas Mode.

---

## File Map

- Modify: `src/index.css`
  - Add the shared workbench token layer, reusable panel/control classes, and the quieter background/grid treatment.
- Modify: `src/components/Header.tsx`
  - Convert the current white nav bar into the slim dark system rail.
- Modify: `src/components/SearchBar.tsx`
  - Merge the filter controls into one dark tray and align active states with the new tokens.
- Modify: `src/components/Select.tsx`
  - Re-skin dropdown chrome so the filter tray does not fall back to the old bright utility style.
- Modify: `src/components/Checkbox.tsx`
  - Update the shared checkbox control so task cards and canvas nodes use the same state language.
- Modify: `src/components/ViewportTooltip.tsx`
  - Match the tooltip surface to the new quiet dark chrome.
- Modify: `src/components/TaskGrid.tsx`
  - Restyle the gallery grid shell and empty state.
- Modify: `src/components/TaskCard.tsx`
  - Turn task cards into analytical board tiles.
- Modify: `src/components/FavoriteCollections.tsx`
  - Re-skin the gallery collection overview so it reads as part of the same board system.
- Modify: `src/components/InputBar.tsx`
  - Restyle the persistent command dock and the multi-selection action bar.
- Modify: `src/components/AgentWorkspace.tsx`
  - Bring the conversational wing onto the same board language without changing message flow.
- Modify: `src/components/CanvasWorkspace.tsx`
  - Quiet the canvas background, grid, and toolbar surfaces.
- Modify: `src/components/CanvasNode.tsx`
  - Make the node the clearest expression of the shared workbench style.
- Do not modify: `src/lib/apiProfiles.ts`, `src/lib/apiProfiles.test.ts`
  - Those diffs are unrelated to this UI pass and should stay isolated.
- Deferred in this stage: `DetailModal`, `SettingsModal`, `Toast`, `ConfirmDialog`, `Lightbox`, `MaskEditorModal`, `ImageContextMenu`, `SupportPromptModal`
  - They should remain stylistically unchanged until a later pass.

## Task 1: Establish the shared dark shell

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the workbench tokens and reusable surface classes**

```css
:root {
  --wb-bg: 224 34% 4%;
  --wb-surface: 223 18% 10%;
  --wb-surface-2: 223 16% 13%;
  --wb-surface-3: 223 14% 17%;
  --wb-line: 218 17% 22%;
  --wb-line-strong: 196 92% 62%;
  --wb-ink: 210 40% 98%;
  --wb-muted: 215 14% 61%;
  --wb-accent: 196 92% 58%;
  --wb-accent-soft: rgba(56, 189, 248, 0.12);
  color-scheme: dark;
}

.workbench-panel {
  border: 1px solid hsl(var(--wb-line) / 0.72);
  background: linear-gradient(180deg, hsl(var(--wb-surface) / 0.96), hsl(var(--wb-surface) / 0.88));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.workbench-panel--strong {
  border-color: hsl(var(--wb-line-strong) / 0.55);
  box-shadow: 0 28px 100px rgba(0, 0, 0, 0.42);
}

.workbench-control {
  border: 1px solid hsl(var(--wb-line) / 0.72);
  background: hsl(var(--wb-surface-2) / 0.94);
  color: hsl(var(--wb-ink));
}

.workbench-chip {
  border: 1px solid hsl(var(--wb-line) / 0.62);
  background: hsl(var(--wb-surface-2) / 0.72);
  color: hsl(var(--wb-muted));
}

.workbench-grid-overlay {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
  background-size: 72px 72px;
}
```

- [ ] **Step 2: Move the global page background to the near-black board surface**

```css
body {
  background:
    radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.06), transparent 24%),
    radial-gradient(circle at 86% 10%, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, hsl(var(--wb-bg)), hsl(223 30% 3%));
  color: hsl(var(--wb-ink));
}

main[data-home-main] {
  position: relative;
}

main[data-home-main]::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.55;
  mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
  background: transparent;
}
```

- [ ] **Step 3: Run the app and confirm the old white/dark split is gone**

Run: `npm run dev`
Expected: the app shell lands on one dark foundation with the panel classes available for the component rewrites that follow.

- [ ] **Step 4: Build-check the CSS token layer**

Run: `npm run build`
Expected: pass, with no CSS or TS syntax regressions.

## Task 2: Rebuild the header and filter chrome

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/components/Select.tsx`
- Modify: `src/components/Checkbox.tsx`
- Modify: `src/components/ViewportTooltip.tsx`

- [ ] **Step 1: Turn the header into a slim dark system rail**

```tsx
<header className="safe-area-top fixed top-0 left-0 right-0 z-40 border-b border-white/8 bg-[hsl(var(--wb-bg)/0.82)] backdrop-blur-xl">
  <div className="safe-area-x safe-header-inner mx-auto flex items-center justify-between">
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-[17px] font-semibold tracking-tight text-[hsl(var(--wb-ink))]">
        GPT Image Playground
      </h1>
    </div>
    <div className="workbench-panel flex items-center gap-1 rounded-[14px] p-1">
      ...
    </div>
  </div>
</header>
```

- [ ] **Step 2: Merge the search controls into one dark tray**

```tsx
<div className="workbench-panel mt-6 mb-4 flex gap-3 rounded-[18px] px-3 py-3">
  <div className="flex flex-shrink-0 gap-2">
    <SearchActionButton className="workbench-control h-10 w-10 rounded-[12px]" />
    <Select className="workbench-control h-10 rounded-[12px] px-3 text-sm" />
  </div>
  <div className="relative flex-1">
    <input className="workbench-control h-10 w-full rounded-[12px] pl-10 pr-4 text-sm" />
  </div>
</div>
```

- [ ] **Step 3: Re-skin shared primitives so the chrome stays consistent**

```tsx
<input
  type="checkbox"
  className="peer appearance-none rounded-[4px] border border-[color:var(--wb-line)] bg-[hsl(var(--wb-surface-2))] focus:ring-2 focus:ring-sky-400/20 checked:bg-[hsl(var(--wb-accent))]"
/>

<div className="fixed z-[120] rounded-[10px] border border-[color:var(--wb-line)] bg-[hsl(var(--wb-surface)/0.96)] px-3 py-2 text-xs text-[hsl(var(--wb-ink))] shadow-[0_18px_60px_rgba(0,0,0,0.42)]">
  ...
</div>
```

- [ ] **Step 4: Verify keyboard focus and active states in dark mode**

Run: `npm run dev`
Expected: the header buttons, search tray, select dropdown, and checkboxes keep visible focus rings and do not fall back to bright utility chrome.

## Task 3: Restyle gallery, task list, and the command dock

**Files:**
- Modify: `src/components/TaskGrid.tsx`
- Modify: `src/components/TaskCard.tsx`
- Modify: `src/components/FavoriteCollections.tsx`
- Modify: `src/components/InputBar.tsx`

- [ ] **Step 1: Make the gallery grid and empty state feel like board surfaces**

```tsx
<div ref={gridRef} className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
  ...
</div>

{!filteredTasks.length && (
  <div className="workbench-panel mx-auto max-w-xl rounded-[18px] px-6 py-12 text-center text-[hsl(var(--wb-muted))]">
    <p className="text-sm">没有找到匹配的任务</p>
  </div>
)}
```

- [ ] **Step 2: Rebuild `TaskCard` into a dark analytical tile**

```tsx
<article
  className={`workbench-panel group relative overflow-hidden rounded-[16px] border transition-all ${
    isSelected
      ? 'workbench-panel--strong ring-1 ring-sky-400/50'
      : 'hover:border-white/18'
  }`}
>
  <header className="border-b border-white/8 px-4 py-3">
    ...
  </header>
</article>
```

- [ ] **Step 3: Bring the favorite-collection overview into the same board language**

```tsx
<article className="workbench-panel overflow-hidden rounded-[16px] border transition hover:border-white/18">
  <div className="aspect-[4/3] bg-[hsl(var(--wb-surface-2))]">
    ...
  </div>
  <div className="px-4 py-3">
    ...
  </div>
</article>
```

- [ ] **Step 4: Restyle the persistent input dock without touching submission logic**

```tsx
<div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/8 bg-[hsl(var(--wb-bg)/0.84)] backdrop-blur-xl">
  <div className="mx-auto max-w-7xl px-4 py-3">
    <div className="workbench-panel flex items-end gap-3 rounded-[18px] px-4 py-4">
      ...
    </div>
  </div>
</div>
```

- [ ] **Step 5: Verify task selection, swipe, and gallery actions still behave exactly the same**

Run: `npm test`
Expected: pass, with no logic regressions in selection, filtering, or task actions.

## Task 4: Bring the agent workspace onto the same board system

**Files:**
- Modify: `src/components/AgentWorkspace.tsx`

- [ ] **Step 1: Re-skin the agent conversation shell and message blocks**

```tsx
<section className="workbench-panel rounded-[18px] border border-white/8 bg-[hsl(var(--wb-surface)/0.92)]">
  <header className="border-b border-white/8 px-4 py-3">
    ...
  </header>
  <div className="space-y-3 px-4 py-4">
    ...
  </div>
</section>
```

- [ ] **Step 2: Make embedded task cards and tool/status rows inherit the same muted chips and borders**

```tsx
<div className="workbench-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]">
  ...
</div>
```

- [ ] **Step 3: Keep the conversation actions and mobile header behavior intact**

Run: `npm run dev`
Expected: message sending, stop/retry, and mobile header visibility still work, but the surface now feels like the conversational wing of the same workstation.

## Task 5: Quiet the canvas and make nodes match the new tokens

**Files:**
- Modify: `src/components/CanvasWorkspace.tsx`
- Modify: `src/components/CanvasNode.tsx`

- [ ] **Step 1: Tone down the canvas background, grid, and toolbar chrome**

```tsx
<div className="canvas-shell workbench-grid-overlay">
  ...
  <div className="workbench-panel flex items-center gap-2 rounded-full px-2 py-2">
    ...
  </div>
</div>
```

- [ ] **Step 2: Restyle `CanvasNode` into the clearest expression of the shared board language**

```tsx
<div
  className={`canvas-task-node workbench-panel group relative overflow-hidden rounded-[16px] border transition-all ${
    selected ? 'workbench-panel--strong ring-1 ring-sky-400/50' : 'border-white/10 hover:border-white/18'
  }`}
>
  ...
</div>
```

- [ ] **Step 3: Keep selection, drag handles, fit/reset, and quick actions untouched**

Run: `npm run dev`
Expected: Canvas Mode still drags, selects, fits, and resets exactly as before, but the board reads calmer and closer to the final reference image.

- [ ] **Step 4: Compare the result against the existing mockup artifacts if the visual fit is ambiguous**

Inspect:
- `output/playwright/cherry-ai-compare.html`
- `output/playwright/cherry-ai-compare.png`
- `output/playwright/cherry-ai-scheme-a.html`
- `output/playwright/cherry-ai-scheme-b.html`

Expected: the production canvas should sit much closer to the quiet analysis-board reference than to the older brighter workbench look.

## Task 6: Final verification and scope lock

**Files:**
- None expected unless a small visual fix is needed in one of the files above.

- [ ] **Step 1: Run the full automated checks**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Confirm the scope stayed inside the approved UI pass**

Check:
- Only the files listed above changed.
- `src/lib/apiProfiles.ts` and `src/lib/apiProfiles.test.ts` are still separate and untouched.
- Deferred overlays remain unchanged for this pass.

- [ ] **Step 3: Do one last browser pass on desktop and mobile widths**

Run: `npm run dev`
Expected: the app reads as one coherent dark workbench across gallery, canvas, and agent surfaces, with readable focus states and no bright utility leftovers.

- [ ] **Step 4: If a final visual mismatch remains, make one last targeted edit only in the files above**

Expected: no new components, no new dependencies, and no deferred overlays pulled into this stage.

