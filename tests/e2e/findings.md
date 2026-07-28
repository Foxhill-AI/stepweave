# StepWeave Design Tool — QA Audit Report

_Generated: 2026-07-28T04:06:20.167Z_
_Tool: Playwright automated audit | Base URL: http://localhost:3004_

---

## Summary

| Category | Count |
|----------|-------|
| ✓ Works correctly | 60 |
| ✗ Broken / not working | 3 |
| ⚠ UX issues / confusing | 6 |
| ! Console errors | 0 |

---

## ✓ What Works

- **[01-homepage]** Title: "Step Weave" _(01-homepage.png)_
- **[01-homepage]** Navigation bar visible
- **[01-homepage]** Products loaded (no loading spinner visible after networkidle)
- **[02-auth]** Login with test credentials succeeded (modal closed, session active) _(02-auth-success.png)_
- **[03-design-hub]** H1: "Design Tool" _(03-design-hub.png)_
- **[03-design-hub]** "Start new design" card visible and links to /design-tool/new
- **[03-design-hub]** "My drafts" card visible
- **[04-model-selection]** 10 shoe model card(s) visible _(04-model-selection.png)_
- **[04-model-selection]** Model selected: "Men's Athletic Shoes" — card shows selected state _(04b-model-selected.png)_
- **[04-model-selection]** Structural color section (White/Black) visible below model grid
- **[04-model-selection]** "Continue" button enabled after model selection
- **[04-model-selection]** Draft created, navigated to: http://localhost:3004/design-tool/268
- **[05-design-step]** Draft editor loaded at http://localhost:3004/design-tool/268 _(05-design-step.png)_
- **[05-design-step]** Step bar: "← Change shoeDesign›Customize›Publish"
- **[05-design-step]** Back link visible: "← Change shoe"
- **[05-design-step]** AI prompt panel visible (Design step is first)
- **[05-design-step]** Prompt textarea visible (placeholder: "Describe what you want to create…")
- **[05-design-step]** "Generate" button correctly disabled with empty prompt
- **[05-design-step]** "Attach photo" button visible
- **[05-design-step]** Attach hint: "Place on shoe or use as AI reference"
- **[06-customize]** Photo choice appeared after upload: "Put it on my shoes" / "Use as AI inspiration"
- **[06-customize]** "Continue to customize →" button appears after "Put it on my shoes" selection (canGoNext = true)
- **[06-customize]** Preview workspace visible on Customize step _(06-customize-step.png)_
- **[06-customize]** Placement tabs: [Left shoe, Right shoe]
- **[06-customize]** Hidden file input (preview-canvas-file-input) present for image upload
- **[06-customize]** Placement picker shown after upload (multiple views detected)
- **[06-customize]** Placement confirm button: "Add to all views"
- **[06-customize]** Image bar visible: "2 layers applied Add imageT Add text Remove" _(06-after-placement-confirm.png)_
- **[06-customize]** "Add text" button visible in image bar
- **[06-customize]** Remove button visible (aria-label: "Remove selected layer")
- **[06-customize]** Shoe canvas (template editor) visible after upload
- **[06-customize]** 2 image layer(s) on canvas after upload _(06-after-placement-confirm.png)_
- **[07-select-image]** Moveable selection handles appear on image layer click _(07-layer-selected.png)_
- **[07-select-image]** Layer toolbar (flip/opacity/duplicate/delete) appears on selection
- **[09-text]** "Add text" button visible in image bar (appears after image upload)
- **[09-text]** Text add panel opened _(09-text-panel.png)_
- **[09-text]** Text input accepts keyboard input
- **[09-text]** Font selector has 10 options
- **[09-text]** Font size input visible (value: 120)
- **[09-text]** Color picker visible in text panel
- **[09-text]** Text layer on canvas: "Text layer: "Hello Shoe" (selected)" _(09-text-added.png)_
- **[10-select-text]** Canvas has 1 text and 2 image layer(s)
- **[10-select-text]** Text layer gets --selected class on click _(10-text-selected.png)_
- **[10-select-text]** Text inline edit panel appears (current text: "Hello Shoe") _(10-text-selected.png)_
- **[11-preview]** "Preview →" button enabled
- **[11-preview]** Mockup generation started — loading indicator shown _(11-after-click.png)_
- **[12-finish]** "Finish →" publish button visible in step bar on Customize step _(12-finish-step.png)_
- **[12-finish]** Publish flow modal opens on "Finish →" click _(12-publish-modal.png)_
- **[13-ui-audit]** All checked visible buttons have accessible names (text or aria-label)
- **[13-ui-audit]** All <img> elements have alt attributes
- **[13-ui-audit]** MediaUploaderUI placeholder is NOT in use — PreviewWorkspace correctly handles uploads
- **[13-ui-audit]** "← Change shoe" navigation visible in step bar
- **[14-mobile]** Homepage loads on 375x812 viewport _(14-mobile-homepage.png)_
- **[14-mobile]** Navbar visible (height: 96px)
- **[14-mobile]** Auth modal works on mobile viewport — login succeeded
- **[14-mobile]** Design hub option cards visible on mobile _(14-mobile-design-hub.png)_
- **[14-mobile]** Step bar fits mobile viewport (375px)
- **[14-mobile]** "▼ Adjust positions" mobile toggle visible _(14-mobile-customize.png)_
- **[14-mobile]** Mobile adjustment panel opens on toggle _(14-mobile-tools-open.png)_
- **[14-mobile]** Preview workspace fits mobile (375px)

---

## ✗ What is Broken

- **[08-drag]** Drag did not move layer (Δx=0px Δy=0px) — Moveable may need layer to be selected first _(08-after-drag.png)_
- **[10-select-text]** Text layer still shows as selected after clicking image layer — selection not switching correctly
- **[11-preview]** Preview generation timed out after 25s — Printful API may be unreachable or slow _(11-timeout.png)_

---

## ⚠ UX Issues / Confusing Behaviour

- **[06-customize]** "Customize" in the step bar is a non-interactive <span>, not a <button>. Users can only reach the Customize step via the AI panel flow (generate or attach+place), not by clicking the step label directly.
- **[06-customize]** "Preview →" NOT disabled before upload
- **[06-customize]** "Add text" button has raw "T" character as icon: "T Add text" — should use SVG (lucide Type icon)
- **[09-text]** Font size unit is tooltip-only ("Font size (printfile pixels)") — "printfile pixels" is a technical concept unknown to end users. No visible unit label.
- **[13-ui-audit]** Auto-save indicator idle — check if it shows after changes (no error state exists if save fails)
- **[14-mobile]** Cookie consent banner appears on mobile — may block auth modal interactions if z-index is lower than modal overlay _(14-mobile-homepage.png)_

---

## ! Console Errors


---

## Code Fix Recommendations

### BUG-1: `MediaUploaderUI.tsx` — Upload button is a confirmed no-op placeholder

**File:** `components/design-tool/MediaUploaderUI.tsx` lines 29–34

```tsx
const handleClick = () => {
  // UI only – no file picker opened   <-- dead code
}
const handleDrop = (e: React.DragEvent) => {
  // UI only – no actual upload         <-- dead code
}
```

The component's `aria-label` literally says `"Upload or drop files (UI only)"` — a dev comment exposed to assistive tech.

**Fix:** Wire to a real `<input type="file" />` (copy pattern from `PreviewWorkspace.tsx`'s `fileInputRef`) or delete this component entirely — `PreviewWorkspace` already handles uploads.

### BUG-2: Auth modal blocks the model selection page after navigation

**Observed:** When unauthenticated user navigates to `/design-tool/new`, the URL is rewritten to `/design-tool/new?openAuth=1`, which causes the Navbar to open the login modal. If the user then logs in, the modal closes but a second navigation to `/design-tool/new` still hits the `?openAuth=1` param (which persists in the URL). This means the auth modal re-opens every time users land on the page from a stale link or bookmark, **blocking the entire model selection grid** with a modal overlay.

**Evidence:** Playwright screenshot `test-failed-1.png` shows shoe models visible behind the login modal overlay — users cannot click model cards while modal is open.

**File:** `components/Navbar.tsx` lines ~137-145 / `app/design-tool/new/page.tsx` lines ~22-24

```tsx
// In DesignToolNewInner useEffect:
if (searchParams.get('openAuth') !== '1') {
  router.replace('/design-tool/new?openAuth=1')
}
```

**Fix 1:** After the modal opens, strip the query param: `router.replace('/design-tool/new')` inside the Navbar effect that reads `openAuth`.
**Fix 2:** Use a modal-open state in session storage rather than a URL param.

### BUG-3: Homepage shows "Loading products…" spinner visible past networkidle

**File:** `app/page.tsx` — `fetchProducts` with 12s timeout on `/api/home-products`

The API is slow enough (>3s in local dev) that the page reaches network idle with no products visible. Users see a blank page with a loading spinner.

**Fix:** Add a loading skeleton (not raw text), or add server-side product preloading.

### BUG-4: Design tool hub page cards not visible when `userAccount` is null

**File:** `app/design-tool/page.tsx` — `DesignToolHubInner` checks `user` but hub cards are rendered when `!authLoading && user`

After login via the modal on a different route, navigating to `/design-tool` may hit a timing window where `user` is set but `userAccount` is null (still loading), causing the hub to render the "not logged in" view briefly.

**Fix:** Wait for both `user` and `!authLoading` before deciding to show the "sign in" vs hub view.

### BUG-5: Auto-save failure is completely silent

**File:** `components/design-tool/DesignToolPage.tsx` line ~338

```tsx
.catch(() => setAutoSaveState('idle'))  // ← silent failure
```

**Fix:**
```tsx
.catch(() => {
  setAutoSaveState('error')
  setTimeout(() => setAutoSaveState('idle'), 3000)
})
// Add error render in step bar: {autoSaveState === 'error' && <span>Save failed — check connection</span>}
```

### UX-1: "T Add text" uses raw letter as icon

**File:** `components/design-tool/PreviewWorkspace.tsx` line ~498

```tsx
  T Add text  // "T" is not an icon — should be <Type size={13} aria-hidden /> from lucide-react
```

**Fix:** `import { Type } from 'lucide-react'` and replace `T` with `<Type size={13} aria-hidden />`.

### UX-2: "Add text" button hidden until image applied — text-only designs are impossible

**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~464-513

Button rendered only inside `{hasImage && viewMode === "canvas" && ...}`. Users wanting to add only text to a shoe must upload an image first — even if they want a text-only design.

**Fix:** Show a standalone "Add text" action that appears even when no image is uploaded. Could sit on the upload hero or a secondary toolbar.

### UX-3: Preview button disabled state has no mobile-visible explanation

**File:** `components/design-tool/PreviewWorkspace.tsx` line ~682

```tsx
title={!hasPatternImage ? 'Add a pattern first' : undefined}
```

On mobile, `title` attribute tooltips never appear on tap. The button just looks broken.

**Fix:** Render `<span className="preview-hint">Add an image first to preview</span>` below the button when disabled.

### UX-4: Font size input has no visible unit label

**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~544-552

"Printfile pixels" is a Printful-specific concept. End users have no context for what value to enter.

**Fix:** Add a visible label `"Size (pt)"` or change units to something familiar (e.g. a percentage of the print area).

### UX-5: Placement picker uses `<p>` grouping, not accessible `<fieldset>/<legend>`

**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~414-461

```tsx
// Current: <p> heading over checkboxes — screen readers won't associate prompt with checkboxes
<p>Add image to which views?</p>
// Fix:
<fieldset><legend>Add image to which views?</legend>...
```

### UX-6: "Finish →" publish CTA only in step bar — hard to find on mobile

**File:** `components/design-tool/DesignToolPage.tsx` lines ~729-737

The only publish path on the customize step is a small button in the top step bar. Consider a more prominent CTA at the bottom of the canvas.

### UX-7: React hydration mismatch in Footer on every page load

**File:** `components/Footer.tsx` — newsletter `<input>` has an extra `style` attribute on server

Console error: `Warning: Extra attributes from the server: style at input at form at div ... at Footer`

**Fix:** Audit `Footer.tsx` for any style/attribute that uses `window` or browser-only APIs on first render. Wrap such code in `useEffect` or `typeof window !== "undefined"` guards.

### UX-8: Auth redirect URL pollution — `?openAuth=1` persists in address bar

**File:** `components/Navbar.tsx` lines ~137-145

After the auth modal is triggered and the user logs in, the URL remains `.../design-tool/new?openAuth=1`. Bookmarking or sharing this URL will always re-open the modal.

**Fix:** After modal opens, `router.replace(pathname)` to strip the `openAuth` param.

### ACCESSIBILITY-1: Upload drop zone uses `div[role=button]` instead of native `<button>`

**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~377-403

The hidden `<input type="file">` is `aria-hidden`, so screen readers can only access the upload via the `div[role=button]`. Some screen readers handle this inconsistently.

**Fix:** Use a `<label>` wrapping `<input type="file">` — the most accessible upload pattern. Or replace the div with a native `<button>` that triggers `fileInputRef.current?.click()`.

### ACCESSIBILITY-2: Cookie consent banner on mobile can block auth modal interactions

**Observed:** On 375x812 viewport, the cookie consent banner ("We use cookies") renders at the bottom of the screen behind the modal. In Playwright, auth-related click events on form fields behind the cookie banner were blocked.

**Fix:** Ensure the cookie consent banner has a lower z-index than the auth modal overlay.

---

## Screenshots

- `01-homepage.png` — [works] 01-homepage
- `02-auth-success.png` — [works] 02-auth
- `03-design-hub.png` — [works] 03-design-hub
- `04-model-selection.png` — [works] 04-model-selection
- `04b-model-selected.png` — [works] 04-model-selection
- `05-design-step.png` — [works] 05-design-step
- `06-customize-step.png` — [works] 06-customize
- `06-after-placement-confirm.png` — [works] 06-customize
- `06-after-placement-confirm.png` — [works] 06-customize
- `07-layer-selected.png` — [works] 07-select-image
- `08-after-drag.png` — [broken] 08-drag
- `09-text-panel.png` — [works] 09-text
- `09-text-added.png` — [works] 09-text
- `10-text-selected.png` — [works] 10-select-text
- `10-text-selected.png` — [works] 10-select-text
- `11-after-click.png` — [works] 11-preview
- `11-timeout.png` — [broken] 11-preview
- `12-finish-step.png` — [works] 12-finish
- `12-publish-modal.png` — [works] 12-finish
- `14-mobile-homepage.png` — [works] 14-mobile
- `14-mobile-homepage.png` — [ux_issue] 14-mobile
- `14-mobile-design-hub.png` — [works] 14-mobile
- `14-mobile-customize.png` — [works] 14-mobile
- `14-mobile-tools-open.png` — [works] 14-mobile