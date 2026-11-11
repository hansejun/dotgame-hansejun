# R3 Architect — review pass 1

## Summary
The current proposal satisfies the requested R3 architecture and supplies a concrete ten-chapter v3 replacement without claiming execution approval. No blocking functional defect was found in targeted read-only inspection; retain option A and narrow two verification obligations that exceed the necessary acceptance contract. Architectural Status: WATCH. Code Review Recommendation: COMMENT. These are nonblocking planning corrections, not authorization to implement.

## Exact reviewed planner receipt
```json
{"stage":"planner","stage_n":1,"path":"/Users/hansejun/Desktop/fastcampus/dotgame-hansejun/.gjc/_session-01a1c902-e179-706e-bcc4-376863c57bb2/plans/ralplan/01a1c902-e179-706e-bcc4-376863c57bb2/stage-01-planner.md","created_at":"2026-11-11T05:16:48.080Z","sha256":"[REDACTED]"}
```
Owner session_id and run_id: 01a1c902-e179-706e-bcc4-376863c57bb2. Reviewer: 1-R3Architect. Run-level pass: 1. Intent baseline: stage-01-intent.md, stage_n 1, sha256 [REDACTED] in the same directory. This review is of that exact planner artifact, not the current product as an implemented R3 release.

## Claims
- Planning-only and approval sequencing are preserved: planner lines 1–16 and 61–77; AGENTS.md requires document-first clarification and human browser acceptance. No product edits, tests, gates, formatters, servers, or browser execution were performed for this review.
- Appendix A contains all ten requested chapters: headings at lines 123,126,156,170,182,236,250,281,303,371. It is clearly a proposed replacement, not a silently applied specification. GAME_DESIGN.md remains v2, including the R3 deferrals in chapters 7/8 and the final section.
- The plan retains R0's 1→2→3 progression, 5/7/9 lanterns, 1/2/3 ghosts, 60/75/90 seconds, 100 points, floor bonus, fixed grid and palette. R0 interview rounds 6/7/10/13/14 and R2 pending-approval Intent Reconciliation support the proposed boundary; new audio/storage/map specifics are honestly marked proposals.

## Analysis
### Spec compliance and stage boundaries
Goal4 ends with level3 in frozen cleared state and no audio/storage/final implementation. Goal5 replaces that interim state with immediate final on the same safe last-light transition, including the final bonus, followed by fresh Enter→title score0. Planner lines 156–168 and AC-35/39/41/42 reconcile the formerly valid R2 AC-30 instead of deleting its history. Human goal4 approval before goal5 is explicit in sequencing and AC-40. There is no need to implement temporary flags, parallel reducers, or compatibility aliases to retain an obsolete runtime behavior across completed goals.

### Pure logic and every fixed-duration consumer
Current src/logic.js has a global levelDuration at line10. Its consumers are createState.remainingMs (45), update.remainingMs (104), and BOTH initial and repeated catch-up deadlines (128,132). createTitleState→createState (53–56), title start (148–149), and failed reset (151–152) must also use the new campaign/active-level contract. The proposal's single levels definition and all-time-calculations clause cover this inventory; its nonzero-start 75/90-second boundary tests will expose partial conversions. hudValues derives ceil from remainingMs, and displayPosition/isMoving correctly continue to use the separate 120ms move duration. Keep 400ms ghostInterval unchanged.

Current src/main.js imports a single level (1), creates title from it (9), passes it through keyboard/blur/RAF transitions (76,80,85), and draws that fixed map (89–91). The planned active-level rendering and common dispatch must replace all these assumptions together. test/logic.test.js also has a single-level import, helper defaults and first-codeblock extraction; the file-level plan explicitly covers those consumers. src/strings.js currently only knows title/cleared/failed, so the proposed stage-specific hints and final/bestScore external display argument are necessary, not extra functionality. Sprites/index.html/test runner can remain unchanged under the existing fixed dimensions and palette.

### Multi-ghost time semantics
Current update maps every due ghost before ghosts.some checks every collision, including index-paired previous positions; advancePlaying processes due<now in chronological order and exact-now with the input, stopping at the first terminal. Preserve this shape rather than per-ghost terminal returns or one large jump. Planner lines 150–154 and verification rows 89–90 specify synchronous shared deadlines, b/c detection, same-cell/swap checks, exact-time inputs, no retroactive merging, timeout precedence and delayed-call early termination. Path lengths imply periods a=3200ms, b=1600ms, c=2400ms as stated. Duration must remain the active level's for every iteration, not a HUD-only change.

### Maps, counts, connectivity and achievability by inspection
Appendix lines 185–234 retain the existing level1 grid and add concrete level2/3 grids. Each is 11 rows of 15 cells, with a closed wall border, one P, and respectively 5/7/9 L. Level2 adds L at the left corridor and right lower corridor plus b; level3 adds top and bottom L plus c. Patrols are nonoverlapping horizontal contiguous runs: a5, b3, c4; no L or P lies on them. The original interior walls remain the only obstacles. The open top/bottom/left/right corridors and open rows around the small wall blocks connect all passable areas; every L is reachable without stepping onto any patrol run. An outside circuit with a short inward visit to the right middle L and left near-edge L suffices. Parent additionally reports a read-only grid check confirming dimensions/counts/connectivity/route-avoiding L reachability; this is corroboration, not runtime or human-play proof.

The safe route exists, but neither actual reducer success nor human play is claimed here. Proposed future BFS and real-grid keydown/keyup replay with live ghost timing are suitable automated evidence, followed by actual human AC-37 play. Do not convert the arbitrary 46-step estimate into a product requirement; see A1-ROUTE-02.

### Audio and storage one-shot handling
The thin audio/storage module boundaries are proportionate to browser-only effects. Pure logic does not import browser APIs or discover its own clock; main dispatch compares previous/next state, while drawing does not emit effects. Audio selection uses newly lit cells and terminal edges, not score delta (which also includes bonuses). failed>final>cleared>light priority suppresses duplicate last-light sounds. The contract limits AudioContext to one, activates/resumes only from actual approved fresh Enter gestures, handles asynchronous rejection without waiting, discards unavailable sounds without delayed queues, and stops/disconnects prior effects. The proposed fake-context tests cover timing and cleanup; real listening remains required.

Storage reads once and validates canonical decimal safe integers in 0..4350, using one key dotgame.bestScore. The loose bound is consistent: 2100 lantern points plus at most 2250 time bonus; it does not claim attainability. Only playing→failed or level3 playing→final compares, strict improvement updates memory before one write, and lower/equal/intermediate clears/RAF/Enter do not write. Getter/getItem/setItem exceptions and write-failure retention are expressly covered. Memory-only best score when storage is blocked is a narrowly defined external capability policy, not a workaround for a controllable logic defect. Do not introduce retries, migration keys or progress saving. Errors must not affect gameplay or be mistaken for verified persistence.

### Human acceptance versus automated proof
AC-33–48 are all unchecked. Historical AC-1–32 are labelled history, not R3 execution evidence. Boundary timings, impossible last-L/collision combinations, immutability and injected audio/storage branches belong to automated proof. Human observations cover actual controls, visible maps/UI, listening, refresh/persistence and blocked-capability environments. Fixture states/screenshots do not establish human acceptance. HTTP static serving corrects the ES-module file:// misconception without introducing a backend. Deployment work remains excluded; Pages observations must not become an unrequested completion dependency.

## Root Cause
No load-bearing architectural defect was identified. The two findings share a planning cause: verification examples were promoted into stronger completion obligations than the requested R3 behavior—an exact route budget and an external deployment surface.

## Findings
```json
[
  {
    "findingId":"A1-SCOPE-01",
    "targetId":"AC-48-and-AC-46-Pages-verification",
    "action":"change",
    "severity":"MEDIUM",
    "evidence":["stage-01-planner.md:364 requires localhost and deployed Pages and leaves absent Pages unchecked","stage-01-planner.md:362 also requires observing localhost/Pages record separation","stage-01-planner.md:65-72 treats AC-41–48 as goal5 acceptance while excluding unrequested deployment work at lines42 and283"],
    "sourceRole":"architect",
    "impact":"An absent Pages deployment can keep the goal acceptance set permanently incomplete despite deployment being outside this request.",
    "fix":"Require local static HTTP and relative-import/UI/browser correctness. Treat Pages loading and cross-origin record separation as conditional non-gating observations when an existing URL is available; explicitly mark unavailable environment evidence separately. Do not set up, push or demand deployment.",
    "blocking":false,
    "priority":"P2"
  },
  {
    "findingId":"A1-ROUTE-02",
    "targetId":"Verification-Plan-achievability-route-budget",
    "action":"remove",
    "severity":"LOW",
    "evidence":["stage-01-planner.md:87 makes ≤46 moves/≤11.04 seconds an obligation while calling it an unexecuted estimate","Appendix chapter2 fixes actual limits at 75/90 seconds; AC-37 requires safe achievability, not route optimality"],
    "sourceRole":"architect",
    "impact":"Unnecessary coupling to one traversal can create false failures or tempt unrequested map/timing changes even when the game is safely achievable within its specified time.",
    "fix":"Remove only the exact 46-step/11.04-second obligation. Retain route-avoiding reachability, normal reducer key events with ghosts active and completion before the active level deadline. Any measured traversal length may be evidence, not a new requirement.",
    "blocking":false,
    "priority":"P3"
  }
]
```
Both issues were reported through report_finding. The first tool finding used a nearby line361 anchor; the precise affected AC anchors are lines362/364 as recorded above. No CRITICAL/HIGH findings and no implementation changes are requested now.

## Antithesis and constructive synthesis
Strongest fair antithesis: preserving a single game state can couple campaign navigation to level simulation; every reset must preserve only score and fresh Enter consumption, and external effect comparison must not confuse a bonus with a lantern event. A separate campaign reducer could make that boundary explicit. For this fixed three-level game it adds nested transitions and duplicate terminal accounting risk without solving an unmet requirement. Synthesis: retain option A, one authoritative levelIndex and score, active definitions for duration/map, one dispatch for input/blur/RAF, and small effect-only browser modules. Existing edge-based tests plus proposed deadline/terminal tests address the genuine coupling risk without more layers.

## Recommendations
1. Narrow AC-46/48 Pages evidence to conditional/non-gating; no deployment actions.
2. Remove the exact route-budget obligation; keep real-grid safe-clear verification against actual deadlines.
3. Otherwise retain the current architecture, complete appendix and goal4→human approval→goal5 sequence. Present the plan for user review; do not dispatch implementation under the current planning-only request.

## Architectural Status
WATCH — nonblocking acceptance-scope clarification only; functional architecture is sound by inspection.

## Code Review Recommendation
COMMENT — no blocking changes and no implementation approval. This is a plan review, not a claim that tests, audio, storage or gameplay have been executed.

## Tradeoffs
| Choice | Benefit | Cost / decision |
|---|---|---|
| A: single pure game state + effect boundaries | Minimal extension of existing transition model; one terminal accounting point | Update all map/duration/reset consumers together; retain |
| B: separate campaign reducer | Explicit navigation/simulation split | Extra state/Enter/score handoffs for only three fixed levels; not needed |
| Conditional existing Pages observation | Honest environment evidence without deployment scope expansion | No deployed-host proof when unavailable; report that limit |
| Required Pages acceptance despite no deployment request | Broader hosting proof | External completion dependency; avoid |
| Safe real-grid route before actual deadline | Tests requested achievability | Does not prove optimal path; optimality was not requested |
| Fixed ≤46-step budget | Convenient example bound | Unrequested path coupling; remove as obligation |

## Verification limits
All conclusions are from targeted read-only source/spec/plan inspection. No test, lint, formatter, gate, server, browser, audio, storage or product execution occurred. This restriction is required by the user's planning-only request. Critic's artifact was not read; this is an independent pass. Native writer persistence is the only mutation performed.
