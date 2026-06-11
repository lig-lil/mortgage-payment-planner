# Mortgage Payment Planner PWA

Mortgage Payment Planner is a fully client-side Progressive Web App for personal mortgage repayment calculations. It runs entirely in the browser, works offline after the first load, and does not require any backend or external server at runtime.

## Tech stack

- React + TypeScript
- Vite
- `vite-plugin-pwa`
- `pdfjs-dist`
- Local persistence with `localStorage`

## What the app does

1. Uploads a mortgage reimbursement PDF directly in the browser.
2. Extracts a best-effort repayment schedule from the PDF.
3. Detects the installment, credit/principal, and interest columns using fuzzy header matching.
4. Shows the extracted rows in an editable preview table.
5. Lets you correct installment numbers and credit values manually.
6. Calculates:
   - how many months are covered by a payment amount
   - how much money is required for the next N months
   - how much interest is saved after entering the new total interest amount manually
7. Estimates a monthly reimbursement plan from the latest result, including remaining months, remaining years, and the estimated last payment date.
8. Treats the first principal installment as already paid, so repayment calculations start from the second principal row.
9. Saves the latest schedule, selected unpaid installment, input drafts, and recent results locally for offline reuse.

## Project structure

```text
src/
  components/       Reusable UI cards and mobile-friendly controls
  content/          Easily editable UI strings
  hooks/            Local storage state hook
  pages/            Main page composition
  pwa/              Service worker registration
  services/         Browser-side PDF parsing with pdf.js
  types/            Shared TypeScript models
  utils/            Money parsing, row normalization, calculations, fuzzy matching
```

## Install dependencies

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Build for production

```bash
npm run build
```

## Preview the production build

```bash
npm run preview
```

## Install on phone

### Android

1. Open the deployed or locally hosted app in Chrome.
2. Tap the browser menu.
3. Choose `Install app` or `Add to Home screen`.

### iPhone

1. Open the app in Safari.
2. Tap the Share button.
3. Choose `Add to Home Screen`.

## Offline behavior

- The app shell is cached by the service worker created through `vite-plugin-pwa`.
- After the first successful load, the interface is available offline.
- Your latest schedule, chosen first unpaid installment, input drafts, parser notices, and recent calculations are kept in `localStorage`.
- The `Offline ready` actions sit at the end of the page rather than floating over the screen.

## Calculation flow

The app has three calculation cards and one planning panel:

- `Calculate by Amount`: enter the repayment amount you want to use. The app covers as many full principal installments as possible, reports any unused amount, recalculates the remaining principal, remaining installments, remaining years, and adjusted last payment date.
- `Calculate by Months`: enter how many upcoming installments you want to cover. The app totals the required principal amount and recalculates the remaining schedule.
- `Calculate Interest Saved`: enter the new interest amount from the updated repayment schedule. The app compares it with the original interest read from the uploaded PDF and shows `Total interest saved` in the results.
- `Planning`: enter a fixed `Monthly reimbursement` amount under `Results`. The app estimates how many payment months remain if that amount is paid ahead of schedule every month.

The first principal installment is always considered paid. The selector therefore starts from installment 2, and no default local value is stored for installment 1.

`Remaining principal` is calculated by subtracting both the covered principal and any unused repayment amount from the total remaining principal.

`Remaining installments` is based on the selected first unpaid payment date and the adjusted last payment date, counted inclusively. `Last payment date` is calculated from the original final payment date after subtracting all paid installments, including the already-paid first installment.

Planning estimates use the current latest result as the starting point. Each regular month pays the current installment, then the monthly reimbursement amount is applied to future principal installments starting with the next installment, so a reimbursement made in one month can cover one or more following months.

## Manual correction is intentionally included

Browser-side PDF extraction is inherently imperfect because PDFs often store text with inconsistent positioning, split table cells, or unexpected reading order. This app therefore always uses a resilient flow:

- attempt best-effort extraction in the browser
- keep parser notices in local/exported state when confidence is low
- always allow manual edits, deletions, sorting, and new row entry

This is deliberate so the app stays useful even when the PDF parser is only partially accurate.

## Supported numeric formats

Manual edits and extracted values are parsed flexibly. Examples:

- `1.234,56`
- `1234,56`
- `1,234.56`
- `1234.56`

## CSV export

- `Export schedule CSV` saves the current schedule rows as a CSV file with installment, principal, interest, payment date, and source columns.
- `Export results CSV` saves a snapshot of the current app state, including Local Summary totals, relevant current inputs, latest Results, and Planning estimates.
- `Clear local data` removes locally stored schedule data, drafts, planning input, and recent results.

## Important limitation

This app only reads text-based PDFs in the browser. If the uploaded document is image-only or heavily scanned without selectable text, extraction quality will be limited and manual entry may be required.
