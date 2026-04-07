# Research: Review UI Patterns for AI Proposals

## Visual Presentation
- **Indented card clusters** — parent as header card, variants indented beneath with left border/connector
- **Color-coded group boundaries** — alternating subtle backgrounds per group
- **Collapsible by default** for accepted groups; expanded for pending review
- Single scrollable list — avoid tabs/modals to maintain spatial context

## Accept/Reject Interaction
- **Inline button trio** on each group: green check (accept), red X (reject), pencil (edit)
- **Keyboard shortcuts** critical for speed: A=accept, R=reject, E=edit, arrows to navigate
- **Batch toolbar** pinned at top: "Accept all", "Accept high-confidence", filters
- Use **undo toast** instead of confirmation dialogs — accept/reject should be instant

## Override / Partial Edit
- Click edit → group card expands:
  - Drag-and-drop reorder children
  - Checkbox to **ungroup** (eject to standalone) per child
  - Dropdown to change dish_kind on parent
  - "Merge with..." typeahead to manually add ungrouped dishes
  - Save/cancel buttons replace accept/reject during edit mode

## Confidence Indicator
- Small badge (high/medium/low) per group
- Use as **sort/filter mechanism**: default sort low-confidence first
- "Accept all above X% confidence" bulk action

## Bulk Operations
- Multi-select checkboxes + batch action dropdown
- Filter bar: by confidence, dish_kind, "has grouping" vs standalone
- Running counter: "14 of 37 groups reviewed"

## AI Reasoning
- **Progressive disclosure**: show only proposal + confidence by default
- Hover/click info icon → tooltip: "Grouped because: similar name pattern, same price range, adjacent on menu"
- 1-2 sentences max. Never block review flow.

## Anti-Patterns to Avoid
- Confirmation dialogs on every action (use undo toast)
- Forcing review of every item (allow bulk-accept)
- Hiding raw data (always show original menu photo alongside)
- Non-reversible actions (everything undoable until final submit)
- Overloading card surface (name, price, confidence visible; rest behind disclosure)
