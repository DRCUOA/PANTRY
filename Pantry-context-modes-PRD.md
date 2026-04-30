# Pantry — Context-sensitive single-task view modes

**Status:** Draft v1
**Author:** Richard
**Last updated:** April 30, 2026

## Problem statement

Pantry is well-structured for thoughtful, sit-down use, but the family meal planner — the primary user — almost never uses it that way. They open the app standing at the stove with one greasy hand free, walking down a supermarket aisle pushing a cart, or peeking at it on a phone in another room asking *"do we have eggs?"*. In each of these moments the current UI puts every section, every chip filter, every secondary action on screen at once. The result is the user fights the interface to do one obvious thing, and over time stops opening it for the moments where it should be most valuable. The cost of not solving this is straightforward: a pantry tool that's only usable at a desk has lost the kitchen and the store, which are the two highest-value contexts.

## Goals

The view-mode system should produce the following outcomes for the family meal planner:

- Reduce time-to-complete for the four headline tasks — *cook from a recipe*, *shop a list*, *check stock*, *put away groceries* — by a meaningful margin against today's UI. A 40–50% reduction in median taps and time on each task is the target.
- Make each context immediately recognizable so the user lands in the right mode without thinking. Mode entry should be one tap from Home or trigger automatically on relevant signals (location, time of day, last action).
- Preserve the current full UI for users who want it. Modes are an *overlay* on the existing app, not a replacement — tapping out of a mode returns the user to the standard screen they were on.
- Keep the visual identity intact. Modes use the same color palette, typography, and component vocabulary as today's app, just at higher contrast and larger touch targets.
- Ship something testable in a single phase so we can validate the core thesis ("single-task views beat the dense default") before investing in the long tail of contexts.

## Non-goals

- *We are not redesigning the underlying data model or the section navigation.* The eight sections (Home, Scan, Pantry, Plan, Recipes, Shop, Settings) stay. Modes layer on top.
- *We are not building voice control, hands-free gesture, or wearable integrations in v1.* These come up in the kitchen context; out of scope until the visual single-task view is validated.
- *We are not adding a "household / multi-user" account model.* Pantry is single-user today and the modes work assuming that. Multi-user is a separate initiative.
- *We are not building commerce, delivery integrations, or in-store wayfinding.* Shopping mode improves the existing list workflow; it doesn't add new commercial surfaces.
- *We are not building a desktop layout for modes in v1.* Modes are mobile-first because every target context is mobile. Desktop falls back to today's UI.

## Target users

The primary user for this work is the **family meal planner** — someone responsible for what the household eats across the week. They cook several times a week, do a weekly shop with mid-week top-ups, juggle multiple eaters' preferences and intolerances, and care more about getting food on the table than about pantry purity. Secondary beneficiaries are the *solo home cook* (less data but same contexts) and the *bulk-pantry power user* (more data but less time pressure); the modes should serve them too without being designed for them.

## User stories

### Cooking mode

- As a meal planner cooking a recipe, I want a single big-text view of the next step and the ingredients I need *right now* so I can read it without picking up my phone with messy hands.
- As a meal planner mid-recipe, I want to tap an ingredient to decrement the pantry quantity so I don't have to re-do inventory at the end of the week.
- As a meal planner cooking, I want the screen to stay awake without me touching it so I'm not poking the phone every thirty seconds.
- As a meal planner, I want to swipe forward and back through steps with a clear indicator of where I am in the recipe.

### Shopping mode

- As a meal planner pushing a cart, I want my list grouped by aisle with checkboxes large enough to tick with a thumb so I can move through the store efficiently.
- As a meal planner who just remembered something, I want to add an item with one tap or a voice prompt without leaving shopping mode.
- As a meal planner at the shelf, I want to scan a barcode to confirm I'm grabbing the right item — especially for products I haven't bought before.
- As a meal planner finishing a trip, I want to see what's left unchecked so I can decide whether to skip it or backtrack.

### Quick-check mode

- As a meal planner about to leave the house, I want to ask "do we have X?" and get an answer in under two seconds without scrolling through the full pantry.
- As a meal planner thinking ahead, I want to see what's expiring this week as a single short list, not a filter result inside a longer screen.

### Restocking mode

- As a meal planner unpacking shopping, I want to scan an item, confirm location, set expiry from a quick-picker, and immediately scan the next one — with nothing else on the screen.
- As a meal planner restocking, I want the previous item's location and expiry to be remembered as defaults so most items take one tap to save.

### Meal-planning mode

- As a meal planner planning the week, I want a calmer view of the weekly grid where pantry-matched recipes float to the top and missing ingredients can be one-tapped onto the shopping list.

## Requirements

### Must-have (P0)

**Mode framework.** A new top-level concept: a *mode* is a full-screen overlay launched from a Home card or auto-triggered by signal. Closing it returns to the prior section. Modes share a common chrome (close X, mode title, optional secondary action) but each has its own body. Modes do not share screens with the standard navigation — the bottom tab bar is hidden.

**Cooking mode.** Launched from any recipe detail or planned-meal tile. Shows current step (40px+ text), step counter (e.g. "3 of 8"), full ingredient list with checkable rows that decrement pantry on tap, swipe gestures for next/previous step, and the screen-wake API enabled while the mode is open. Acceptance: with no taps for 5 minutes, the screen stays on; tapping an ingredient decrements its pantry quantity by the recipe amount; swipe-left advances the step counter and updates the body in under 200ms.

**Shopping mode.** Launched from the Shop tab or auto-triggered when the user is at a known supermarket location (post-Phase-1 enhancement; see open questions). Shows the list grouped by aisle with 56px+ checkboxes, an Add bar at the top with voice input and barcode scan, and a "Done" footer summarizing checked vs. remaining. Acceptance: tap-target hit area is at least 48×48px; voice add transcribes within 3 seconds and inserts at the top of the relevant aisle group; checking an item moves it to a collapsed "Done" section with strike-through.

**Quick-check mode.** Launched from a Home card or via the FAB. A single full-width search field, results stream as the user types, an empty-state list of items expiring within 7 days. Acceptance: typing 2+ characters surfaces results in under 200ms (against local data); search hits both name and barcode-linked product names; tapping a result shows quantity, location, and expiry inline without a navigation.

**Restocking mode.** Launched from the Scan tab or via a Home card after a shopping trip ends (a new state). Each scan auto-advances to a confirm step with location and expiry pre-filled from defaults; Save returns to the camera. Acceptance: with sticky defaults, a barcode scan + Save commits an item in two taps; the camera reopens within 500ms of save.

**Mode launchers on Home.** Home gains a "Right now" card at the very top whose contents change by signal (last action, time of day, location, day-of-week). Examples: morning before known shopping day → "Shopping mode"; evening with a planned dinner → "Cook *Chicken pasta pomodoro*"; just left supermarket geofence → "Restock now". Acceptance: the card always shows exactly one suggested mode; tapping it enters that mode; an opt-out in Settings disables location-based suggestions.

### Nice-to-have (P1)

- **Meal-planning mode.** A reduced-density variant of the existing Plan screen with pantry-match ranking forced on, drag-and-drop, and a "Send all missing to Shopping" button always visible.
- **Mode history.** A small chevron in mode chrome lets the user back-swipe through their last few modes — useful for going Cook → Quick-check ("did we have parsley?") → Cook.
- **Shopping mode "find in store"** — for users who pre-sort their list by their preferred store's aisle order, persisted per-store.
- **Cooking mode timers.** Detected from recipe text ("simmer for 20 minutes") and offered as one-tap timers in the step header.
- **Restocking mode receipt OCR.** Snap the receipt; we attempt to match line items to barcodes and pre-populate the scan queue.

### Future considerations (P2)

- Voice-only cooking mode (no screen interaction at all).
- Apple Watch / Wear OS quick-check companion.
- Multi-store shopping (split list by store, route the trip).
- Hands-free gesture advance for cooking steps (proximity sensor or wave detection).
- Modes for *guests* — temporary collaborators given a single-mode share link (e.g. "Help me shop this list").

## Success metrics

### Leading indicators (within 30 days of rollout)

- **Mode adoption rate.** Percentage of weekly active users who entered any mode at least once. Target: 60%; stretch: 75%.
- **Cooking mode completion.** Of cooking mode sessions started, percentage that advanced past step 3. Target: 70%.
- **Shopping mode session length / list size ratio.** Time spent in shopping mode divided by number of items checked. Target: ≤ 25% of today's median time-per-checked-item in the standard Shop tab.
- **Quick-check round-trip.** Time from app open to first useful answer in quick-check mode. Target: ≤ 5 seconds median.
- **Restocking throughput.** Items added per minute in restocking mode vs. today's manual scan loop. Target: 2× today's median.

### Lagging indicators (60–90 days)

- **DAU and retention.** Day-7 and day-30 retention of users who tried any mode vs. control. Target: a measurable lift in 30-day retention; size to be calibrated against pre-launch baseline.
- **Self-reported satisfaction.** A one-question NPS-style prompt after a mode session at most once a week. Target: median rating ≥ 8/10 across all modes; flag any single mode below 6.
- **Section retention.** Whether users who use modes still use the underlying sections (Pantry, Recipes, Plan). Target: no decrease — modes should *expand* usage, not cannibalize.

### Measurement

Instrument each mode entry, exit, and the key in-mode actions (step advance, ingredient decrement, voice-add, scan-confirm). Compare task duration on equivalent jobs done with and without a mode. Re-evaluate at 30 days and again at 90.

## Open questions

- **Mode auto-trigger thresholds (engineering, design).** What's the right confidence bar for surfacing "Shopping mode" from a geofence? False positives are worse than false negatives — but how much worse? Need a brief alpha to learn.
- **Privacy posture for location-based mode triggers (legal, design).** Do we ask for "always" location permissions or only "while using"? "While using" probably suffices because mode triggers are evaluated on app open; confirm.
- **Screen-wake on cooking mode and battery (engineering).** Wake-lock on long-cook recipes drains. Do we offer a "dim after 3 minutes of no input but keep the screen on"?
- **Voice add transcription provider (engineering, data).** Local Web Speech API is cheap but inconsistent; a server-side transcription is reliable but routes microphone audio off-device. Privacy-first stance suggests local first, fallback opt-in.
- **Meal-planning-mode density (design).** Calmer than the current Plan screen — but how much calmer? Probably one day visible at a time on phones, week visible only on tablet/desktop. Validate.
- **Sticky defaults memory length in restocking mode (design).** Per-session? Per-trip? Forever-until-changed? Probably session, with a "lock these defaults for this trip" toggle.

## Timeline considerations

This work is exploratory with no fixed deadline, so the right framing is a single-phase v1 that validates the thesis, followed by a decision gate before investing in the long tail.

**Phase 1 — Cooking mode + Shopping mode + Mode framework (v1).** These are the two highest-value contexts and the ones where the user explicitly asked for help. Building them together pays for the framework cost.

**Phase 2 — Quick-check + Restocking (v1.1).** Both are short, defensible additions that round out the four contexts. Should ship close behind Phase 1 — the framework is paid for.

**Phase 3 — Meal-planning mode + P1 enhancements.** Conditional on Phase 1 and Phase 2 hitting their leading-indicator targets. If adoption is below 40% or NPS is mixed, return to Phase 1 to fix before expanding.

Phases assume a 2-engineer + 1-designer pod and roughly two-week iterations; calendar dates fall out of the team's actual capacity rather than a contractual deadline.

## Appendix — context map

For reference during implementation, here's how each context maps to a mode and the existing sections:


| Context                   | Mode               | Pulls from                  | Writes back            |
| ------------------------- | ------------------ | --------------------------- | ---------------------- |
| In the kitchen — cooking  | Cooking mode       | Recipe + Pantry             | Pantry decrements      |
| Supermarket — shopping    | Shopping mode      | Shopping list               | Item checks, new items |
| Quick check from anywhere | Quick-check mode   | Pantry                      | —                      |
| Restocking groceries      | Restocking mode    | Scan + sticky defaults      | Pantry adds            |
| Meal planning at home     | Meal-planning mode | Recipes + Pantry + Shopping | Plan, Shopping list    |
