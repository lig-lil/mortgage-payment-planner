# Phase 2 — Navigation and Overview

## A. Files changed

- `src/pages/HomePage.tsx`: four destinations, Saved Scenarios subview, independent persisted Actual boundary, correct upload initialization and snapshot rotation, actual payment-status control in Schedule, preserved exports/clear-data actions. Scenario inputs and interest scenario reference metadata are explicitly retained; monthly planning rejects results from an unknown/different reference schedule.
- `src/components/Dashboard.tsx`: Overview with Current Mortgage, observed changes and Latest Scenario in that reading order. The latest scenario is selected by creation date, so opening older history does not make it the latest calculation.
- `src/components/CurrentMortgageCard.tsx`: Actual-only bank metrics, validated principal progress, compact Add loan details state, source information and explicit Loan details action.
- `src/components/LoanDetailsDialog.tsx`: native accessible dialog with desktop modal/mobile bottom-sheet layout, isolated drafts, validation, save/cancel, Escape dismissal, initial focus, focus restoration and background scroll lock.
- `src/components/ScheduleChangesCard.tsx`: compact observed rows and neutral missing states; optional aligned-interest estimate stays separately identified in a disclosure.
- `src/components/LatestScenarioCard.tsx`: compact stored-result preview, estimated labels, original schedule reference or explicit legacy unknown state, action to Scenarios.
- `src/components/FirstUnpaidSelector.tsx`: reused editable selector with independent Actual/Scenario labels and accessible names.
- `src/utils/installmentBoundaries.ts`: pure independent selection initialization, Actual snapshot creation and conservative legacy snapshot comparison.
- `src/utils/loanDetailsEditor.ts`: validated saving of permanent details; confirmation occurs only on explicit save of a valid amount.
- `src/utils/overviewFormatting.ts`: consistent RON and real source/date formatting, unavailable fallbacks.
- `src/types/index.ts`: additive optional `boundaryVersion` identifies snapshots with known Actual selection semantics.
- `src/styles.css`: approved dark tokens, desktop sidebar/mobile bottom navigation, Overview proportions and cards, responsive dialog and minimal dark-theme compatibility for retained screens.
- `src/assets/fonts/dm-sans.woff2`, `space-grotesk.woff2`: font assets extracted from the supplied design bundle, served locally and included in the PWA precache.
- `index.html`, `vite.config.ts`: dark browser/PWA theme colors and language matching the existing English interface.
- `tests/phase2.test.mjs`: domain regression and server-rendered Overview checks.

The supplied HTML was read as a design reference only. Its nested Main component was inspected to obtain layout tokens: charcoal #111318, surface #181B22, border #272B34, accent #3DDC97, 228px sidebar, desktop content padding 26px/40px, desktop bottom-card columns 1.15fr/1fr, full-width Current Mortgage, mobile single-column order and compact loan-details action. No artifact runtime, iframe or sample financial data was embedded into the application.

## B. Navigation mapping

- Home → Overview.
- Planner → Scenarios calculator, retaining amount/months/manual interest and monthly reimbursement tools.
- History → Scenarios → Saved Scenarios; Back to calculator restores the tools. Open still selects the stored result for the calculator, and CSV exports and Clear Local Data remain accessible here.
- Compare → honest Phase 3 placeholder, with access to Saved Scenarios and no sample comparisons.
- Schedule → existing upload, summary and editable rows, plus an Actual first unpaid control and schedule CSV export. Warnings are visible here.

Order is Overview / Scenarios / Compare / Schedule on desktop and mobile. Controls are native keyboard-operable buttons with current-page semantics. Desktop sidebar is sticky; mobile navigation is fixed with safe-area padding and content clearance. Wide history tables scroll inside their own container.

## C. Actual vs Scenario installment selection

`mortgage.firstUnpaidRowId` remains the legacy Scenario/Planner starting selection. It is never interpreted as actual payment-status evidence. The existing legacy installment-index migration remains scenario-only. Valid manual scenario IDs are preserved during reload/editing, and during replacement if still present in the new principal rows. A missing/invalid scenario selection suggests the second eligible principal row (or first if only one); this is only a default and never a fixed calculation rule.

The new `mortgage.actualFirstUnpaidRowId.v1` independently persists the Actual boundary. When absent/invalid, it initially suggests the first eligible principal row; neither the calendar nor the Scenario selector determines it. Users can correct it in Schedule. Both controls validate against stable principal-row identities. Empty schedules clear both selections. Clear Local Data clears the new key along with all existing keys.

Amount/month calculations receive the exact Scenario selection and do not skip another row. Actual selectors and newly captured observed snapshots receive only the Actual selection. The calculation engine itself is unchanged.

New snapshots carry `boundaryVersion: actual-v2`, count unpaid principal rows inclusively, and retain detached installment data. Legacy snapshots remain unchanged. Because their selected boundary was a Planner choice, installment/remaining-interest differences and aligned estimates are unavailable when comparing such a legacy previous snapshot; principal and scheduled-end-date comparisons remain available. Once another accepted PDF rotates an actual-v2 snapshot, these comparisons can use the independent Actual boundary. Invalid parsed schedules cannot rotate snapshots or replace active data.

## D. Overview data mapping

- Outstanding principal: Phase 1 ActualMortgageState, preserving the existing full-PDF positive-principal sum interpretation. Changing the Actual unpaid boundary changes upcoming metrics, not that established full-schedule balance interpretation.
- Principal repaid: validated confirmed original amount minus Actual outstanding principal; no schedule-total fallback, no invented percentage, no progress bar when unavailable/inconsistent.
- Next installment date, principal, interest and total: selected Actual unpaid row. Total is shown only when explicit valid interest exists; payment split appears only with a valid total.
- Installments left: eligible principal rows from Actual first unpaid inclusive.
- Remaining interest: sum of valid explicit interest amounts from Actual first unpaid through final principal row inclusive; current unpaid month's interest is included.
- Last payment date: final actual principal row's known date, never a saved simulation date.
- Schedule source and extraction date: actual metadata, no sample dates.
- Observed changes: previous accepted real snapshot compared with current real snapshot, not simulation outputs. Interest differences do not establish early-repayment causality; estimates keep existing alignment safeguards.
- Latest Scenario: stored result and original schedule reference, with estimated term reduction from stored monthsCovered, extra payment, remaining principal and supported stored interest savings. Legacy references stay explicitly unknown. The preview is never rebased onto the active PDF.

Missing amounts/dates show neutral unavailable states. Existing principal-row normalization excludes zero-principal/fee rows; this interpretation was preserved.

## E. Loan Details integration

Overview opens an explicit Loan details modal/sheet. Amount and optional YYYY-MM start period are edited as isolated drafts. Numeric validation accepts ordinary decimal/grouped formats, rejects malformed/nonpositive/unsafe values, and keeps cent precision. A valid amount saved by the user becomes confirmed. Leaving the amount empty saves an unavailable/unconfirmed amount. Read-only metadata displays the active source and extraction date.

Save writes only `mortgage.loanDetails.v1`; schedule rows/metadata are not modified. Cancel, Escape and backdrop dismissal discard drafts. Legacy candidate amount and incomplete legacy period remain reviewable. Existing Phase 1 migration and legacy preservation remain in place. New PDF uploads retain Loan Details, including confirmed amounts and start period.

## F. Executed validation and limitations

- `npm.cmd test`: 32 tests passed, 0 failed: all 21 Phase 1 tests plus 11 Phase 2 tests.
- Phase 2 regression tests cover independent boundary initialization, Actual isolation from Scenario changes, inclusive current-month interest, exact #3 calculation start, valid/manual and invalid/new identities, Loan Details validation and JSON persistence round-trip, accepted-upload preservation, real detached snapshots, conservative legacy snapshot handling, original scenario references, missing-confirmation progress state and server-rendered Overview metric/section-order checks.
- `npm.cmd run build`: TypeScript and Vite production build passed; PWA service worker and local-font precache generated.
- `git diff --check`: passed (line-ending normalization warnings only).

Interactive browser verification was attempted through the available browser-control tool: the in-app browser was unavailable and the browser inventory was empty. Therefore desktop/mobile rendering at 320/390/1440px, click navigation, modal focus trapping/save/cancel, horizontal overflow, bottom-navigation overlap, actual browser reload persistence, CSV downloads, real PDF upload and offline installation were not interactively tested. Server-rendered markup checks are not a substitute for those browser tests. The CSS was implemented from the inspected reference tokens; pixel-level visual matching is unverified.

No dependency upgrades, backend or state-management framework were introduced. Existing uncommitted work and Phase 1 artifacts were preserved.

## G. Deferred work

Full Scenarios and Scenario Result redesign, comparison charts/engine, recurring prepayments, lower-installment simulations and legacy scenario rebaselining remain for Phase 3. Schedule redesign, first-upload onboarding and PDF review/confirmation remain for Phase 4. No fictional comparison data or bundled design runtime was introduced. Work stops after Phase 2.

## H. Unicode hotfix

Six maintained files failed strict UTF-8 decoding before repair: this report, CurrentMortgageCard.tsx, LatestScenarioCard.tsx, LoanDetailsDialog.tsx, ScheduleChangesCard.tsx and overviewFormatting.ts. Source bytes were already invalid for UTF-8; navigation arrows and sidebar separators had also become literal question marks. The original writing tool/encoding is unknown. The existing UTF-8 HTML declaration cannot recover those source literals. No evidence of a font-caused corruption was found; the existing DM Sans and Space Grotesk stacks retain system-ui/sans-serif fallbacks.

Repaired contextual middle-dot separators, navigation/previous-to-current arrows, em-dash unavailable values, the close multiplication symbol and the approximation symbol only on the aligned interest estimate. HomePage.tsx sidebar separators were also repaired. All edited files were written with Node filesystem APIs using explicit UTF-8 encoding. No financial logic, persistence, layout or dependencies changed.

Added tests/encoding.test.mjs to strictly decode maintained source, tests, public text and root documentation/configuration, and reject replacement characters and common mojibake. Dependencies, build output and font assets are excluded. Ordinary question marks remain valid. Added rendered Phase 2 regressions for representative labels, transitions, close control and missing-value em dashes; valid zero still displays as 0.00 RON.

Validation: npm run test passed all 36 tests; npm run build passed. Browser inventory returned no browsers or apps, so actual desktop glyph rendering remains unverified. Server-rendered UI string checks passed.
