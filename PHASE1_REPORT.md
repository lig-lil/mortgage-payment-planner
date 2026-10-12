# Phase 1 architecture and validation

## Files and responsibilities

- `src/types/index.ts`: additive LoanDetails, ActualMortgageState, ScheduleReference and ScenarioInput models; optional scenario inputs/references/assumptions retain compatibility with existing history; observed interest totals/deltas are separate from estimates.
- `src/utils/loanDetails.ts`: pure, idempotent migration, start-month normalization and compatibility labels for the current editor.
- `src/utils/actualMortgage.ts`: pure actual-state selector and cent-precision principal-repaid validation. Missing, unconfirmed, nonfinite or inconsistent values return null with a reason. No schedule-sum fallback for original principal.
- `src/utils/scenarios.ts`: schedule identity includes file, extraction date, interest assumptions and canonical sorted rows (including manual correction inputs). Saved results are associated with this reference; legacy references are explicitly unknown.
- `src/utils/scheduleState.ts`: validates accepted parsed schedules before rotating a detached snapshot; preserves independent Loan Details.
- `src/utils/scheduleComparison.ts`: retains existing comparison/estimate algorithms, exposes row date extraction, adds authoritative remaining-interest totals and signed differences when both schedules support them.
- `src/pages/HomePage.tsx`: persists Loan Details, wires selectors and upload boundary, preserves saved scenario outputs instead of silently recalculating history, records new scenario input/reference/assumptions, requires a current reference for interest and monthly planning, includes reference metadata in scenario CSV, clears new data with existing Clear Local Data.
- `Dashboard.tsx` and `CurrentMortgageCard.tsx`: use actual selector and independent loan details; unavailable repayment percentages and principal amounts display unavailable states. Existing loan editor remains in place.
- `LatestScenarioCard.tsx`, `ResultsCard.tsx`, `HistoryCard.tsx`: display saved schedule references and explicit legacy unknown-reference labels. Scenario card metrics come from its saved result.
- `EstimatedInterestSavedCard.tsx`: clarifies that the estimate does not prove savings caused by early repayment; calculation algorithm unchanged.
- `tests/domain.test.mjs` and `package.json`: dependency-free Node test runner with temporary TypeScript compilation; npm test runs new domain tests and existing comparison tests.

## Storage and migration

Existing rows, metadata, first-unpaid selection, previous snapshot, saved calculation history and draft keys remain unchanged. The only additional storage key is `mortgage.loanDetails.v1`. Loan Details are initialized from legacy metadata only when this key is absent; subsequent migration calls return existing details without overwriting them. All original legacy fields are copied into `legacy`, including incomplete/year-only dates. Complete dates normalize to YYYY-MM; incomplete values remain available to the current editor.

The existing editor saves or explicitly locks original principal to confirm it. Accordingly, a legacy locked value migrates as confirmed; an unlocked/ambiguous value remains an unverified candidate. New PDF uploads never replace Loan Details. Legacy fields remain allowed in ExtractionMeta but are no longer authoritative mortgage fields.

New scenarios use the existing recentResults key and additive optional fields. Old calculations remain intact, accessible and exportable, with unknown reference labels. Full legacy rebaselining is deferred; users can run a new principal calculation to use interest/planning against the active schedule. No backend or state library was introduced. Existing browser-storage quota behavior is unchanged (in-memory continuation on failed writes).

## Calculation boundaries and preserved interpretations

Actual state has no scenario argument or dependency. Observed changes compare previous/current real-schedule snapshots exclusively. Hypothetical results remain in calculation history and do not update rows, Loan Details or actual selectors. The amount/months/interest/monthly planning engine in calculations.ts was not modified.

Outstanding principal preserves the existing full-PDF sum of positive principal rows. Next installment, remaining interest and upcoming installment count use the selected first unpaid row. This differs from the snapshot's existing full-PDF installment count and is intentionally documented instead of changing established algorithms. Zero-principal rows remain excluded by the established principalRows interpretation, including fee-only rows. Total scheduled payments represent principal plus explicitly extracted interest; missing interest makes the total unavailable, and other charges are not inferred.

The new actual selector returns the date of the final principal row or null if missing. Existing observed finalScheduledPaymentDate searches backward for a known date; that compatibility behavior remains unchanged. Existing interest algorithms may infer raw columns whereas new authoritative interest metrics require explicit valid interestAmount values. Observed remaining-interest differences use each schedule's unpaid boundary, so elapsed payments, rate changes or other events can explain differences; they are not causal savings. The prior aligned estimation algorithm remains isolated and unchanged.

## Executed validation

- `npm.cmd test`: 21 tests passed, 0 failed (10 new domain tests plus 11 existing schedule-comparison tests).
- `npm.cmd run build`: TypeScript and Vite production build passed; PWA service worker generated.
- PowerShell blocks the npm.ps1 shim; npm.cmd runs the same package scripts.
- Domain tests cover principal-repaid availability/20%/invalid values, scenario isolation, accepted/rejected upload transitions, detached snapshots, idempotent legacy migration, saved-history compatibility and reference detection, amount/months regression values, and valid/unavailable observed interest differences.
- Upload tests exercise parsed-result acceptance, not real PDF extraction or a browser upload. No interactive browser, actual PDF fixture, CSV download or offline installation test was executed.

## Deferred

No navigation, theme, page hierarchy or visual redesign. New Add loan details/Overview UI, Scenarios/Compare/Schedule redesign, legacy scenario rebaselining, recurring prepayments, lower-installment simulations and comparison charts remain for later phases. Pre-existing uncommitted changes were preserved. Phase 1 stops here.
