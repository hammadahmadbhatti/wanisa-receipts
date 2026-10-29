# Wanisa Invoices

A small invoice generator for **Wanisa Renovations**. It runs completely in the
browser: no server, no account, no cost. Client details never leave the device.

## What it does

- Company letterhead on every invoice: logo, name, address, phone/WhatsApp,
  email, website (and SSM number when filled in).
- Client: full name, phone, email, address.
- Services: the 7 Wanisa services, plus **Other** to type any custom service.
  Each line has details (optional), quantity and price in RM.
- **Download PDF** creates an A4 invoice, for example
  `Invoice-WR-2026-0001-Nur-Aisyah-binti-Ahmad.pdf`. **Preview** opens it first.
- Invoice numbers count up automatically (`WR-2026-0001`, `WR-2026-0002`, …).
- **No records:** client details are never saved, on the device or online. They exist
  only in the open form and in the PDF you download. Closing or reloading a filled-in
  form asks for confirmation first.

## How to use it

1. Open `index.html` (double-click on a laptop, or the hosted link on a phone).
2. The first time, click **Company details** and fill in the full address,
   SSM number and (optional) bank details. They are saved on that
   device and printed on every invoice.
3. Fill in the client and services; the total is calculated as you type.
4. Click **Download PDF**, then send the PDF to the client on WhatsApp or email.
5. **New invoice** clears the form and moves to the next number.

The only things the browser remembers are the company details and the invoice
counter (localStorage). Old versions also kept the last form as a draft; that is
deleted automatically when the page opens.

Company details and the invoice counter are stored per device and browser. If
you use it on two devices, set the details on both and check the invoice number.

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
- Invoices are not stored as a history: keep the PDFs (for example in a
  Google Drive folder) as your record.
