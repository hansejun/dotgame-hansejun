# Independent Critic Review — pass 1

## Verdict
**ITERATE**

The plan is substantially actionable and preserves the requested scope. Two bounded specification clarifications are required; neither calls for a new feature, architectural expansion, or deployment work.

## Reviewed planner receipt
- owner session_id: 01a1c902-e179-706e-bcc4-376863c57bb2
- run_id: 01a1c902-e179-706e-bcc4-376863c57bb2
- stage: planner
- stage_n: 1
- path: .gjc/_session-01a1c902-e179-706e-bcc4-376863c57bb2/plans/ralplan/01a1c902-e179-706e-bcc4-376863c57bb2/stage-01-planner.md
- sha256 supplied by assignment: [REDACTED]
- Reviewed intent: same directory/stage-01-intent.md; assignment-supplied sha256 [REDACTED].

Both artifacts were read. Hashes are receipt identities supplied by the assignment, not independently recomputed hashes. No Architect output was consumed.

## Claim Checks
- The appendix is an actual complete human-readable replacement proposal with chapters 1 through 10, not merely an outline or a promise to write v3. Chapters 7 and 8 include full UI, four synthesized sound definitions, browser boundaries, and the one-key storage contract. It is explicitly unapproved and does not purport to have replaced GAME_DESIGN.md.
- Goal-4 retains level 1 and adds fixed 15×11 maps with L7/two a-b patrols/75000ms and L9/three a-b-c patrols/90000ms. Reading the grids supports the counts and straight route lengths a5/b3/c4. The level-1 grid matches src/levels.js. The proposed outer-corridor clear route is plausible by inspection; automated reachability and actual clear outcomes remain future verification, as the plan correctly states.
- Goal-4 uses fresh Enter from level-1/2 clear, carries cumulative score, resets per-level clocks/objects/animation, and leaves level-3 clear frozen. Goal-5 alone adds synthesized effects, localStorage key dotgame.bestScore, immediate level-3 final with bonus included, and final fresh Enter to title/current score 0. Goal-4 human approval is an explicit prerequisite for goal-5, not replaced by test success.
- Existing AC-1 through AC-32 text and dated checked history are preserved in the appendix. AC-30 is explicitly historical and superseded by AC-35/39/41/42 according to stage; no historical check is presented as new R3 evidence. New AC-33 through AC-48 are unchecked and describe actual human-observable behavior.
- Verification is document-number-driven: per-level exact grids/counts, 74999/75000/75001 and 89999/90000/90001 boundaries, route timing, failure precedence, 620→1440→2460 cumulative scores, no duplicate bonuses, sound scheduling, and storage exception/reload/write-count cases. node --test test/ is explicitly the future gate. Human interaction/listening/reload evidence is distinct from injected unit states and fixture screenshots.
- Existing implementation supports the proposed bounded extension. src/logic.js already parses a-c straight routes, advances all ghosts at the same due time, performs earliest-terminal catch-up, and separates logical movement from display interpolation. Its fixed levelDuration occurs in state initialization, remaining-time calculation, and catch-up deadlines; the plan names the need to change all of these. src/main.js currently has separate input/blur/RAF calls and a single imported map, so the common dispatch and active-map render updates are necessary, not speculative refactoring.
- test/logic.test.js currently imports the single level, extracts the first text block, accepts a-only in the actual-map assertion, and encodes R2 clear Enter no-op. The plan explicitly updates those consumers and retains applicable movement, time, immutability, and input-lifetime regressions. test/index.js imports that test file, so the requested node --test test/ gate remains the existing entry path.
- src/strings.js centralizes current Korean UI. Existing main text rendering and index.html already supply the proposed 240×192/720×576 fixed layout. The unchanged sprites palette matches the retained eight hex values. New audio.js/storage.js are clearly proposed files, not falsely cited existing modules.
- Alternative A and B are both viable, have distinct state ownership and integration costs, and are compared against the stated minimal-scope/determinism drivers. Recommending the single-state extension plus thin browser-effect modules is proportionate to the repository. No campaign framework, compatibility layer, dependency, account, backend, BGM, settings, or progress persistence is required.
- Storage temporal behavior is sufficiently specified: one startup read; only playing→failed or level-3 playing→final candidates; strictly higher values update memory before one write; no middle-clear/tick/return/repeat write; failed writes preserve session B and retry only on a later terminal exceeding that memory B. Getter/getItem/setItem exceptions and reload loss are explicit. No additional storage redesign is needed.

## Representative Implementation Simulations
1. Multi-level progression: replace the levels export with three grid/duration definitions; carry levelIndex and score through pure transitions; use selected duration in all clock calculations; render the selected map. A fresh Enter on a known clear builds the next level at the supplied now, retains score, and retains Enter consumption. A keydown that merely discovers a delayed terminal must not also traverse it. Existing Enter regression tests demonstrate the pattern. This path is actionable.
2. Goal-5 final/storage: level-3 last-light processing computes failure precedence and bonus before returning final. One main dispatch observes playing→final, compares the final cumulative score once, and supplies B to strings before render. Later tick/keyup/Enter see a non-playing predecessor and do not repeat storage. A failed write does not undo the in-memory highest score. This path is actionable.
3. Delayed terminal/audio: a repeated keydown or keyup can enter advancePlaying, process an overdue collision/timeout, and return failed. The sound table says playing→failed emits failure once, while the prose says keyup/repeat are silent without qualification. This path exposes finding R3-C1: implementers otherwise have to choose between blanket input-kind suppression and state-event precedence.

## Missing Evidence
- No runtime, map algorithm, listening, browser, storage, or test results were produced in this planning review. Tests, gates, servers, lint, and formatters were deliberately not run, as instructed. Future evidence is explicitly planned rather than fabricated.
- Availability of an already-deployed GitHub Pages URL is not established. The plan acknowledges a missing deployment may remain unverified, but its mandatory goal-5 AC grouping does not say whether that prevents goal completion; see R3-C2.
- R0 Locked Intent/relevant R3 deferral lines and the prior R2 pending-approval reconciliation/sequence were checked selectively. The entire historical interview was not re-audited. All current product files materially referenced by the implementation plan were located/read at the relevant sections; no product file was edited.

## Typed Findings

### R3-C1 — Scope input-silence rules to input-only effects
- findingId: R3-C1
- targetId: appendix.chapter7.audio-trigger-precedence; verification.audio
- action: change
- severity: medium
- sourceRole: critic
- evidence: Planner sound table/prose around lines 274–281 specifies both playing→failed once and unqualified silence for keyup/repeat/ghost-only events. Existing src/logic.js advancePlaying processes time on keyup and repeated direction input; transition also advances time for play Enter. test/logic.test.js AC-26 and AC-32 explicitly cover inputs/blur discovering elapsed-time state changes. Thus a delayed input can legitimately discover the terminal edge the sound table requires.
- required change: Add one bounded precedence sentence: silence for wall/revisit/movement/keyup/repeat/Enter means no sound from that input itself; a newly discovered terminal edge still selects exactly one terminal sound, independent of the triggering input type, provided audio is available. Add one deterministic injected-context case where keyup or repeat discovers an overdue failure and the following tick/keyup/Enter emits no additional sound; use the same case to assert at most one eligible storage write. Do not add an event log, new audio effect, feature, or generalized effect framework.
- certainty: Definite wording conflict on a reachable existing reducer path; the intended terminal-first resolution is already strongly implied by the table.

### R3-C2 — Do not make unavailable Pages deployment an implicit completion dependency
- findingId: R3-C2
- targetId: acceptance.goal5; appendix.chapter9.AC-46; appendix.chapter9.AC-48
- action: change
- severity: medium
- sourceRole: critic
- evidence: The plan says goal-5 accepts AC-41–48 and the all-AC human gate, while AC-46 requires confirming localhost-versus-Pages records and AC-48 covers localhost plus deployed Pages. AC-48 permits an undeployed Pages item to remain unverified, and chapter 8/scope correctly forbid unsolicited Pages settings/push/deployment work. The requested scope prohibits extra deployment prerequisites. It is therefore unclear whether a fully working local implementation remains blocked until unrelated deployment occurs.
- required change: State explicitly that localhost actual-browser validation is the required R3 completion environment; Pages checks and cross-origin comparison are conditional on an already-available deployment and cannot require deployment, settings, commit, or push. When unavailable, record Pages as not applicable/deferred and do not claim it verified, while allowing the local goal acceptance boundary to be satisfied. Keep relative imports/origin separation and available HTTPS checks; do not add deployment work.
- certainty: Definite mismatch between the unconditional goal-5 AC grouping and the conditionally available environment; not a claim that deployment is currently absent.

## Approval Boundary
The maps, numbers, score/time rules, stage separation, full v3 appendix structure/history, alternatives, pure-state approach, one-key storage semantics, and planned numeric/human verification are approved as planning content. Return to the planner only for the two narrow wording/verification fixes above. No redesign or requirements interview is needed. After revision the full plan/v3 proposal still requires the user's approval; this review authorizes no source/document implementation or tests. Goal-5 additionally remains behind actual goal-4 human approval.

## Summary
- Clarity: strong, except the two bounded precedence/completion ambiguities.
- Verifiability: strong document-derived matrix and real-human AC; no invented current evidence.
- Completeness: genuine ten-chapter v3 plus preserved history and numbered new AC.
- Big Picture: fits the small zero-dependency three-level game and approval-first workflow.
- Principle/Option Consistency: sound; no need for extra abstractions.
- Alternatives Depth: adequate and meaningfully distinct.
- Risk/Verification Rigor: strong on time, cumulative score, storage and duplicate effects; add the late-input terminal-effect case and clarify the optional Pages boundary.

## Required Changes
1. Resolve R3-C1 in audio prose and one bounded temporal/duplicate-effect test row.
2. Resolve R3-C2 in the acceptance boundary and AC-46/48 conditional environment wording.
