# Techno-Gothic Workbench Design

## Summary

This redesign turns the current mixed UI into a single `Techno-Gothic 工作台` language, but the final reference image pushes the target toward a quieter analysis board: large dark group panels, compact text blocks, image tiles, and thin connector curves rather than a loud sci-fi console.

The product already has a strong functional structure across `Gallery`, `Canvas`, and `Agent`, and `Canvas` already contains partial dark-mode / graph-workbench vocabulary. The problem is inconsistency: the canvas reads like a specialized workspace, while the rest of the app still reads like a conventional utility interface. This redesign keeps the structure intact and unifies the surfaces around one visual system.

The target mood is not “flashy sci-fi”. It is a dark, controlled, analysis-first workstation: near-black foundation, cold gray floating panels, fine grid / arc relationships, and a single restrained `cyan / blue` accent family for focus and system emphasis.

## Recommendation

Use `方案 A / A1` as the design direction.

Assumption used for this spec:

- The user objective explicitly reaffirmed `方案 A` as the intended direction.
- The final reference image is the source of truth for the first implementation pass.
- The first implementation pass should focus on the core board surfaces shown in the reference, not the secondary overlay set.

Recommended scope:

- Primary work surfaces:
  - `Header`
  - `SearchBar`
  - `TaskCard`
  - `CanvasNode`
  - `InputBar`
  - `Gallery`
  - `Canvas`
  - `Agent`
- Deferred overlays:
  - `DetailModal`
  - `SettingsModal`
  - `Toast`
  - `ConfirmDialog`

This gives the product a coherent board identity without expanding into secondary overlays yet.

## Design Thesis

The interface should feel like a curated analysis board where every surface is part of one system, not a collection of independent pages. Hierarchy should come from panel structure, spacing, edge treatment, and restrained signal color, not from loud gradients or decorative effects.

The single signature move is:

`任务 / 节点以大块暗灰分组板和紧凑文本卡存在，并通过极细关系线形成分析图感。`

Canvas expresses that signature most strongly, while Gallery and Agent inherit the same language in flatter, more list-oriented forms.

## Alternatives Considered

### 1. Keep the current mixed aesthetic and only darken a few components

This would be low effort but would not solve the actual problem. The current UI would still feel split between a standard app shell and a specialized canvas surface.

### 2. Recommended: unified Techno-Gothic workbench

This preserves existing interaction models, uses the current component structure, and creates a product-wide identity that matches the reference image without introducing a new information architecture.

### 3. Make Canvas dramatically more stylized than the rest of the app

This would create a strong hero surface, but it would also increase the visual gap between `Canvas` and `Gallery / Agent`. The requested direction explicitly wants shared dark tokens, so the split treatment is not the right fit for this stage.

## Scope

### In scope

- Introduce a shared dark token system for the selected surfaces.
- Unify panel geometry, border treatment, spacing rhythm, label styling, and emphasis color usage.
- Strengthen the graph / analysis-board feeling in `Canvas`.
- Carry the same workbench vocabulary into `Gallery` and `Agent`.
- Restyle the primary input and filter surfaces so they behave like console controls instead of generic forms.
- Restyle the common overlays listed in scope `B` so they feel native to the same system.

### Out of scope

- No changes to product structure, routes, app modes, or state model.
- No changes to task creation logic, store contracts, or API behavior.
- No new icon library or third-party UI package.
- No secondary pass over help/history/collection-management surfaces in this stage.
- No “full cyberpunk” effect stack: no purple bias, no heavy neon bloom, no decorative glassmorphism.

## Existing-State Reading

### What already aligns with the target

- `CanvasWorkspace` already uses dark shells, subtle gradients, graph framing, and node-based composition.
- `CanvasNode` already carries strong panel structure, meta chips, and image-matrix composition close to the target direction.
- `index.css` already contains background grid and canvas shell primitives that can be promoted into global workbench tokens.

### What is still inconsistent

- `Header` still behaves visually like a conventional top nav rather than a system control rail.
- `SearchBar` is functionally solid but visually fragmented into separate white utility controls.
- `TaskCard` still reads more like a standard content card than a task node or analytical unit.
- `InputBar` is dense and powerful but not yet styled as the persistent command dock of the workbench.
- `AgentWorkspace` and `TaskGrid` do not yet inherit the same panel vocabulary and emphasis logic as `Canvas`.

## Design System Rules

### Core mood

- Background: near-black and calm, never bright black.
- Surfaces: dark charcoal / slate panels with very low sheen and shallow depth.
- Accent: restrained `cyan / blue`, used only for selection, active focus, and the most important graph cues.
- Status colors: remain semantic only, never decorative.
- The image content should carry most of the visual life; the shell should stay quiet.

### Typography

Keep the existing font system instead of introducing a new display font family in this stage.

Use:

- `HarmonyOS Sans SC` as the main UI face
- `Maple Mono` as the system / metadata face

The target tone should come from hierarchy and spacing, not from swapping to a more aggressive font stack. This keeps the Chinese UI readable and avoids unnecessary font churn.

Type ramp:

- Display / hero: large, compact line-height, high contrast
- Title: medium-large, semibold, tight tracking
- Body: stable and readable
- Meta / system label: small, mono-friendly, slightly tracked

Uppercase treatment should be limited to micro-labels and system chips, not general body UI.

### Color tokens

Promote a shared token system built around:

- `--bg`: global background
- `--bg-grid`: background grid line color
- `--surface`: primary floating panel
- `--surface-2`: secondary surface / inset
- `--surface-3`: stronger selected or emphasized inset
- `--ink`: primary foreground
- `--muted`: muted foreground
- `--line`: default border
- `--line-strong`: selected / focused border
- `--accent`: cyan-blue primary accent
- `--accent-soft`: low-opacity accent wash
- `--success`, `--warning`, `--danger`, `--info`: semantic-only status colors

Usage rules:

- Accent is for focus, selection, relationships, current mode, and active controls.
- Gray values carry most of the structure.
- Success / warning / danger are used only when the UI is communicating a real state.

### Shape and depth

- Large panels: gently rounded, approximately `6px` to `12px`
- Small controls: `4px` to `8px`
- Borders: thin and cool, with slightly stronger emphasis on active surfaces
- Depth: use shadow and subtle inner contrast, not blurry glass
- Avoid soft pill shapes and inflated glassmorphism

Panels should feel suspended, not inflated.

### Motion

- One orchestrated entry feel for workspace surfaces
- Small hover sheen or edge response on interactive panels
- Clear focus ring on keyboard navigation
- Respect `prefers-reduced-motion`
- Keep animation minimal; the reference image feels mostly static and composed

Motion should suggest system responsiveness, not entertainment.

## Global Shell

### Background

The global shell should stay quiet and let the board dominate:

- near-black base
- only the faintest surface texture or edge glow, if any
- connector lines and node structure should be the visible pattern, not a decorative backdrop

This background must remain subtle enough that content panels are always dominant.

### Shared panel language

All major surfaces should inherit the same construction rules:

- dark floating card
- thin cool border
- restrained highlight edge or halo when active
- mono micro-labels for system metadata
- consistent spacing rhythm

This turns the app into one board system with multiple modes instead of multiple sub-products.

## Component Design

### Header

Turn the header into a slim, quiet system control bar.

Target traits:

- left side reads like a product / workspace identity strip
- app mode switch reads like a system segmented control, not simple tabs
- utility actions feel like console toggles
- the bar should float over the background rather than flatten into it

Key changes:

- stronger dark shell
- quieter border line
- more deliberate selected state on mode switch
- tighter text hierarchy for title and collection / conversation context

### SearchBar

Turn the search area into a quiet filter tray.

Target traits:

- controls read as one coordinated tray
- action buttons, status filter, and search field share the same panel language
- active filters show as signal states, not just form values

Key changes:

- merge the “loose collection of controls” feeling into a single system strip
- use darker inset surfaces
- make icon buttons read as hardware-like toggles
- sharpen spacing and control heights for a more intentional rhythm

### TaskCard

Task cards should stop reading like generic result cards and start reading like analytical text units.

Target traits:

- clearer separation between prompt, metadata, outputs, and actions
- status chips feel like system tags
- selection and active states echo the canvas node behavior

Key changes:

- stronger card shell
- meta labels and counts use shared chip grammar
- output blocks feel embedded into the panel structure
- hover and selected states reinforce “inspectable node” instead of “content tile”

### CanvasNode

`CanvasNode` is already closest to the target and should become the reference implementation for the rest of the system.

Key changes:

- align radii, borders, chip styling, and title framing with the global token system
- refine the cyan emphasis so it feels controlled, not over-lit
- keep the image matrix, prompt rail, and node metadata, but bring typography closer to the shared scale

Canvas is the strongest expression of the design system, but it should still feel like the same product as Gallery and Agent.

### InputBar

The input bar should become a restrained command dock of the workbench.

Target traits:

- persistent, grounded, powerful
- reads like the place where commands are issued into the system
- image mentions and helper controls feel integrated instead of bolted on

Key changes:

- clearer dock shell
- better separation between input field, parameter controls, and action cluster
- stronger active / focused state
- mention tags and chips inherit the same system language

### TaskGrid / Gallery surface

Gallery should behave like a flatter, browsable expression of the same board system.

Key changes:

- unify spacing and gutters around the grid
- ensure empty states and section framing inherit dark tokens
- keep the grid readable and calm; the drama should come from the shared shell, not from overdecorated cards

### AgentWorkspace

Agent should look like the conversational wing of the same board system.

Key changes:

- assistant / system output blocks use shared panel shells
- task insertions and image blocks feel native to the same design language as TaskCard
- transient states such as web search, generation, or branch navigation inherit the same chip / line / muted hierarchy

The result should feel like “analysis console with a copilot”, not “separate chat app”.

### Common overlays

Defer `DetailModal`, `SettingsModal`, `Toast`, and `ConfirmDialog` to a later pass.

They should eventually reuse the same dark floating-shell treatment, but they are not part of the final reference image and should not shape the first implementation pass.

## Relationship Language

The signature move must appear in a disciplined way:

- actual graph edges in `Canvas`
- subtle relationship cues in Gallery and Agent
- selection / focus using thin edge-like traces and controlled active borders

This relationship language should never overwhelm the content. It is there to create analytical structure, not ornament.

## Accessibility

The darker palette must not reduce usability.

Required constraints:

- high enough contrast for primary text and controls
- visible focus ring on all interactive elements
- large enough hit targets for control buttons
- accent color never as the only signal for critical status
- reduced-motion fallback for hover sheen / transitions

## Implementation Guidance

This design should be implemented by promoting the existing canvas shell vocabulary into shared tokens first, then applying those tokens to the target components.

Recommended order:

1. establish global dark tokens and shell background
2. unify shared panel / control primitives
3. restyle `Header`, `SearchBar`, and `InputBar`
4. restyle `TaskCard` to match the board language
5. align `CanvasNode` and `CanvasWorkspace` with the shared tokens
6. bring `AgentWorkspace` and `TaskGrid / Gallery` into the same system

This keeps the system coherent and avoids per-component one-off styling.

## Risks And Guardrails

### Main risks

- overusing glow, blur, or accent, which would collapse the restrained board feel
- making Gallery and Agent too visually dramatic, which would reduce readability
- breaking spacing consistency by styling each component separately instead of promoting tokens

### Guardrails

- one accent family only
- status colors remain semantic
- no decorative purple / rainbow gradients
- no random glassmorphism
- Canvas remains the most graph-like mode, but not a different design language
- keep the chrome quiet so the board remains the hero

## Definition Of Done

This stage is complete when:

- the app reads as one coherent workbench across `Gallery`, `Canvas`, and `Agent`
- `Header`, `SearchBar`, `TaskCard`, `CanvasNode`, and `InputBar` clearly share one visual system
- `Canvas` is still the strongest expression of the graph / analysis-board identity
- the board surfaces, section shells, and connector curves match the reference image's calm hierarchy
- deferred overlays are explicitly outside this pass
- the signature move is present but restrained
- accessibility and reduced-motion behavior remain intact

## Verification

Implementation verification should include:

- desktop and mobile visual pass
- keyboard focus pass
- reduced-motion pass
- contrast spot checks on core surfaces
- regression check that functional structure and existing workflows remain unchanged
