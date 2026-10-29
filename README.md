# Wanisa Receipts

A small receipt generator for **Wanisa Renovations**. It runs completely in the
browser: no server, no account, no cost. Client details never leave the device.

## What it does

- Company letterhead on every receipt: logo, name, address, phone/WhatsApp,
  email, website (and SSM number when filled in).
- Client: full name, phone, email, address.
- Services: the 7 Wanisa services, plus **Other** to type any custom service.
  Each line has details (optional), quantity and price in RM.
- Tax: **with or without**, rate editable (default 18%).
- **Download PDF** creates an A4 receipt, for example
  `Receipt-WR-2026-0001-Nur-Aisyah-binti-Ahmad.pdf`. **Preview** opens it first.
- Receipt numbers count up automatically (`WR-2026-0001`, `WR-2026-0002`, …).
- The form is saved as you type, so a refresh or closed tab loses nothing.

## How to use it

1. Open `index.html` (double-click on a laptop, or the hosted link on a phone).
2. The first time, click **Company details** and fill in the full address,
   SSM number, tax details and (optional) bank details. They are saved on that
   device and printed on every receipt.
3. Fill in the client and services, choose **With tax** or **Without tax**.
4. Click **Download PDF**, then send the PDF to the client on WhatsApp or email.
5. **New receipt** clears the form and moves to the next number.

Company details and the receipt counter are stored per device and browser. If
you use it on two devices, set the details on both and check the receipt number.

## Free hosting (to use it on a phone)

The whole folder is static files, so any free static host works:

- **Netlify Drop:** open app.netlify.com/drop and drag this folder onto the page.
- **Cloudflare Pages:** Create project → Direct upload → this folder.
- **GitHub Pages:** push this folder to a public repository and turn on Pages.
  It contains no secrets; client data is never stored in it.

The page tells search engines not to list it (`noindex`).

## Files

| File | Purpose |
|---|---|
| `index.html` | the form |
| `css/style.css` | layout, Wanisa colours |
| `js/app.js` | form logic, totals, numbering, PDF layout |
| `js/logo.js` | the logo, embedded so the PDF also works when opened from a file |
| `vendor/` | jsPDF 4.2.1 + jsPDF-AutoTable 5.0.9 (MIT licence) |

## Limits

- The PDF fonts cover Latin letters (with accents). Names in Chinese, Tamil or
  Jawi script cannot be printed; the form warns before creating the PDF.
- Receipts are not stored as a history: keep the PDFs (for example in a
  Google Drive folder) as your record.
