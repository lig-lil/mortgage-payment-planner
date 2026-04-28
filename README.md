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
3. Detects the installment and credit/principal columns using fuzzy header matching.
4. Shows the extracted rows in an editable preview table.
5. Lets you correct installment numbers and credit values manually.
6. Calculates:
   - how many months are covered by a payment amount
   - how much money is required for the next N months
7. Saves the latest schedule, selected unpaid installment, and recent results locally for offline reuse.

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
- Your latest schedule, warnings, chosen starting installment, and recent calculations are kept in `localStorage`.

## Manual correction is intentionally included

Browser-side PDF extraction is inherently imperfect because PDFs often store text with inconsistent positioning, split table cells, or unexpected reading order. This app therefore always uses a resilient flow:

- attempt best-effort extraction in the browser
- surface warnings when confidence is low
- always allow manual edits, deletions, sorting, and new row entry

This is deliberate so the app stays useful even when the PDF parser is only partially accurate.

## Supported numeric formats

Manual edits and extracted values are parsed flexibly. Examples:

- `1.234,56`
- `1234,56`
- `1,234.56`
- `1234.56`

## JSON import/export

- `Exporta JSON` saves the current local schedule and recent results.
- `Importa program din JSON` restores previously saved schedule data without any backend.

## Important limitation

This app only reads text-based PDFs in the browser. If the uploaded document is image-only or heavily scanned without selectable text, extraction quality will be limited and manual entry may be required.
