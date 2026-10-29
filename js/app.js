// Wanisa Renovations invoice and receipt generator: runs fully in the browser, nothing is uploaded.
// Only the company details and the receipt counter are kept (localStorage). Client
// details are never stored: they exist in the open form and the PDF you download.
(function () {
  'use strict';

  var SERVICES = [
    'Electrician', 'Plumber', 'IKEA Furniture Assembly', 'Tile Installation',
    'Waterproofing', 'House Painting', 'Kitchen Sink Blockage',
  ];
  var OTHER = '__other__';
  var DEFAULTS = {
    name: 'Wanisa Renovations',
    reg: '',
    address: 'Jalan Aman, Desa Aman Puri\n52100 Kuala Lumpur\nWilayah Persekutuan Kuala Lumpur, Malaysia',
    phone: '+60 14-630 8041',
    email: 'wanisarenovations@gmail.com',
    web: 'www.wanisarenovations.com',
    prefix: 'WR',
    nextInvoice: 1,
    nextReceipt: 1,
    docType: 'invoice',
    bank: '',
    thanks: 'Thank you for choosing Wanisa Renovations!',
  };
  var KEY_SETTINGS = 'wanisa-receipt-settings';
  var KEY_OLD_DRAFT = 'wanisa-receipt-draft'; // older versions saved the form here; removed on load

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: still works, just not remembered */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  var settings = Object.assign({}, DEFAULTS, store.get(KEY_SETTINGS) || {});
  ['taxLabel', 'taxRate', 'taxReg'].forEach(function (k) { delete settings[k]; }); // tax option removed
  if (settings.next) { settings.nextInvoice = Math.max(settings.nextInvoice, settings.next); delete settings.next; } // one counter before

  // Wording and number series per document type
  var TYPES = {
    invoice: {
      title: 'INVOICE', noLabel: 'Invoice no.', code: 'INV', counter: 'nextInvoice', word: 'invoice', file: 'Invoice',
      party: 'CUSTOMER DETAILS', total: 'TOTAL',
      payLine: function (m) { return 'Payment method: ' + m; },
      hint: 'A bill for the work: shows the payment method, not marked as paid.',
    },
    receipt: {
      title: 'RECEIPT', noLabel: 'Receipt no.', code: 'RCP', counter: 'nextReceipt', word: 'receipt', file: 'Receipt',
      party: 'RECEIVED FROM', total: 'TOTAL PAID',
      payLine: function (m) { return 'Payment received in full by ' + m.toLowerCase() + '.'; },
      hint: 'Proof of payment: confirms the amount was paid in full.',
    },
  };

  // ---------- money (whole sen, no floating point drift) ----------
  function toSen(v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? Math.round(n * 100) : 0; }
  function num(v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function rm(sen) {
    return 'RM ' + (sen / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function plain(sen) {
    return (sen / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function docNo(type) { return settings.prefix + '-' + TYPES[type].code + '-' + new Date().getFullYear() + '-' + String(settings[TYPES[type].counter]).padStart(4, '0'); }
  function docType() { return $('type-receipt').checked ? 'receipt' : 'invoice'; }
  function niceDate(iso) {
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(p[1]) - 1];
    return Number(p[2]) + ' ' + m + ' ' + p[0];
  }

  // ---------- service rows ----------
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function field(label, input, cls) {
    var l = el('label', { class: cls || '' });
    l.appendChild(document.createTextNode(label));
    l.appendChild(input);
    return l;
  }

  function addItem(data) {
    data = data || {};
    var select = el('select', { 'aria-label': 'Service' });
    select.appendChild(el('option', { value: '', text: 'Choose a service…' }));
    SERVICES.forEach(function (s) { select.appendChild(el('option', { value: s, text: s })); });
    select.appendChild(el('option', { value: OTHER, text: 'Other (type your own)' }));
    select.value = data.service || '';

    var custom = el('input', { placeholder: 'e.g. Ceiling repair, gate motor', maxlength: '80' });
    custom.value = data.custom || '';
    var desc = el('input', { placeholder: 'optional, e.g. master bathroom floor', maxlength: '160' });
    desc.value = data.desc || '';
    var qty = el('input', { type: 'number', min: '0', step: 'any', inputmode: 'decimal' });
    qty.value = data.qty != null ? data.qty : 1;
    var price = el('input', { type: 'number', min: '0', step: '0.01', inputmode: 'decimal', placeholder: '0.00' });
    price.value = data.price != null ? data.price : '';
    var amount = el('div', { class: 'amount', 'aria-live': 'polite' });
    var remove = el('button', { type: 'button', class: 'remove', 'aria-label': 'Remove this service', title: 'Remove', text: '×' });

    var customLabel = field('Service name *', custom, 'custom');
    var row = el('div', { class: 'item' }, [
      field('Service *', select, 'service'),
      field('Details', desc, 'desc'),
      field('Qty', qty),
      field('Price (RM) *', price),
      amount,
      remove,
      customLabel,
    ]);
    function syncCustom() { customLabel.hidden = select.value !== OTHER; }
    select.addEventListener('change', function () { syncCustom(); if (select.value === OTHER) custom.focus(); update(); });
    remove.addEventListener('click', function () {
      if (document.querySelectorAll('.item').length > 1) row.remove(); else { select.value = ''; custom.value = ''; desc.value = ''; qty.value = 1; price.value = ''; }
      syncCustom(); update();
    });
    row.refs = { select: select, custom: custom, desc: desc, qty: qty, price: price, amount: amount };
    $('items').appendChild(row);
    syncCustom();
    return row;
  }

  function readItems() {
    return Array.prototype.map.call(document.querySelectorAll('.item'), function (row) {
      var r = row.refs;
      var name = r.select.value === OTHER ? r.custom.value.trim() : r.select.value;
      var q = num(r.qty.value);
      var unit = toSen(r.price.value);
      return {
        row: row, name: name, desc: r.desc.value.trim(), qty: q, unit: unit, total: Math.round(q * unit),
        raw: { service: r.select.value, custom: r.custom.value, desc: r.desc.value, qty: r.qty.value, price: r.price.value },
      };
    });
  }

  function state() {
    var items = readItems();
    var total = items.reduce(function (s, i) { return s + i.total; }, 0);
    return {
      type: docType(), number: $('r-number').value.trim(), date: $('r-date').value, method: $('r-method').value,
      client: { name: $('c-name').value.trim(), phone: $('c-phone').value.trim(), email: $('c-email').value.trim(), address: $('c-address').value.trim() },
      items: items, total: total, notes: $('r-notes').value.trim(),
    };
  }

  function update() {
    var s = state();
    s.items.forEach(function (i) { i.row.refs.amount.textContent = rm(i.total); });
    $('t-total').textContent = rm(s.total);
  }

  // Nothing is saved, so warn before closing or reloading a filled-in form.
  function hasContent() {
    var s = state();
    return Boolean(s.client.name || s.client.phone || s.notes || s.items.some(function (i) { return i.name || i.unit; }));
  }
  window.addEventListener('beforeunload', function (e) {
    if (!hasContent()) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // ---------- validation ----------
  // The PDF fonts cover Latin letters (incl. accents); other scripts would print as garbage.
  var LATIN = /^[\u0000-ÿ‘’“”–•…€]*$/;
  function validate(s) {
    document.querySelectorAll('.invalid').forEach(function (e) { e.classList.remove('invalid'); });
    var bad = [];
    function flag(input, msg) { input.classList.add('invalid'); bad.push(msg); }
    if (!s.number) flag($('r-number'), 'number');
    if (!s.date) flag($('r-date'), 'date');
    if (!s.client.name) flag($('c-name'), 'client name');
    if (!s.client.phone) flag($('c-phone'), 'client phone');
    var filled = s.items.filter(function (i) { return i.name || i.unit; });
    if (!filled.length) flag(s.items[0].row.refs.select, 'at least one service');
    filled.forEach(function (i) {
      if (!i.name) flag(i.row.refs.select.value === OTHER ? i.row.refs.custom : i.row.refs.select, 'service name');
      if (i.unit <= 0) flag(i.row.refs.price, 'price');
      if (i.qty <= 0) flag(i.row.refs.qty, 'quantity');
    });
    var texts = [s.client.name, s.client.address, s.notes].concat(filled.map(function (i) { return i.name + i.desc; }));
    if (!texts.every(function (t) { return LATIN.test(t); })) bad.push('Latin letters only (the PDF cannot print Chinese/Tamil/Jawi characters)');
    var err = $('form-error');
    err.hidden = !bad.length;
    err.textContent = bad.length ? 'Please check: ' + bad.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + '.' : '';
    return bad.length ? null : Object.assign({}, s, { items: filled });
  }

  // ---------- PDF ----------
  var INK = [45, 45, 45], CHAR = [47, 47, 49], MUTED = [107, 101, 103], PEARL = [237, 233, 233], DOVE = [216, 209, 208];

  function buildPdf(s) {
    var JsPDF = window.jspdf.jsPDF;
    var doc = new JsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, M = 16, R = W - M;
    var cfg = settings;
    var T = TYPES[s.type];

    // letterhead: logo left, company details right
    var logoW = 64, logoH = logoW * window.WANISA_LOGO.h / window.WANISA_LOGO.w;
    doc.addImage(window.WANISA_LOGO.src, 'PNG', M, 14, logoW, logoH, 'logo', 'FAST');
    var y = 15;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, CHAR);
    doc.text(cfg.name, R, y, { align: 'right' }); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, MUTED);
    var lines = [];
    if (cfg.reg) lines.push('SSM: ' + cfg.reg);
    String(cfg.address || '').split('\n').forEach(function (l) { if (l.trim()) lines.push(l.trim()); });
    if (cfg.phone) lines.push('Tel / WhatsApp: ' + cfg.phone);
    if (cfg.email) lines.push(cfg.email);
    if (cfg.web) lines.push(cfg.web);
    lines.forEach(function (l) { doc.text(l, R, y, { align: 'right' }); y += 4; });
    y = Math.max(y, 14 + logoH) + 4;
    doc.setDrawColor.apply(doc, CHAR); doc.setLineWidth(0.8); doc.line(M, y, R, y);
    doc.setDrawColor.apply(doc, DOVE); doc.setLineWidth(0.3); doc.line(M, y + 1.4, R, y + 1.4);
    y += 12;

    // title + receipt facts
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor.apply(doc, CHAR);
    doc.text(T.title, M, y);
    var facts = [[T.noLabel, s.number], ['Date', niceDate(s.date)], ['Payment method', s.method]];
    var fy = y - 7;
    facts.forEach(function (f) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, MUTED);
      doc.text(f[0], R - 64, fy);
      doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, INK);
      doc.text(String(f[1]), R, fy, { align: 'right' });
      fy += 5;
    });
    y = Math.max(y + 10, fy + 4);

    // received from
    doc.setFillColor.apply(doc, PEARL);
    var c = s.client;
    var clientLines = [c.phone, c.email].concat(c.address ? doc.splitTextToSize(c.address, 110) : []).filter(Boolean);
    var boxH = 13 + clientLines.length * 4.5;
    doc.roundedRect(M, y, R - M, boxH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, MUTED);
    doc.text(T.party, M + 5, y + 6);
    doc.setFontSize(11.5); doc.setTextColor.apply(doc, INK);
    doc.text(c.name, M + 5, y + 11.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, MUTED);
    clientLines.forEach(function (l, k) { doc.text(l, M + 5, y + 16.5 + k * 4.5); });
    y += boxH + 7;

    // services table
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      head: [['#', 'Service', 'Qty', 'Unit price (RM)', 'Amount (RM)']],
      body: s.items.map(function (i, k) {
        return [String(k + 1), i.desc ? i.name + '\n' + i.desc : i.name, String(i.qty), plain(i.unit), plain(i.total)];
      }),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, valign: 'top' },
      headStyles: { fillColor: CHAR, textColor: PEARL, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 246, 246] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center', textColor: MUTED },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: function (d) {
        if (d.section === 'head' && d.column.index >= 3) d.cell.styles.halign = 'right';
        if (d.section === 'head' && (d.column.index === 0 || d.column.index === 2)) d.cell.styles.halign = 'center';
      },
      didDrawPage: footer,
    });
    y = doc.lastAutoTable.finalY + 6;

    // total
    if (y + 40 > 270) { doc.addPage(); footer(); y = 24; }
    var tx = R - 80;
    y += 2;
    doc.setFillColor.apply(doc, CHAR);
    doc.roundedRect(tx - 4, y - 3, R - tx + 4, 11, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, PEARL); doc.setFontSize(11);
    doc.text(T.total, tx, y + 4);
    doc.setFontSize(12.5); doc.text(rm(s.total), R - 3, y + 4.2, { align: 'right' });

    // left column next to the totals: payment status + bank details + notes
    var ly = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, CHAR);
    doc.text(T.payLine(s.method), M, ly);
    ly += 6;
    function block(title, text) {
      if (!text) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, MUTED);
      doc.text(title, M, ly); ly += 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, INK);
      var t = doc.splitTextToSize(text, tx - M - 12);
      doc.text(t, M, ly); ly += t.length * 4.2 + 3;
    }
    block('NOTES', s.notes);
    block('PAYMENT DETAILS', cfg.bank);

    // thank-you line + note instead of a signature
    var sy = Math.max(y + 24, ly + 10);
    if (sy > 266) { doc.addPage(); footer(); sy = 40; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, CHAR);
    doc.text(cfg.thanks || '', M, sy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, MUTED);
    doc.text('This is a computer-generated ' + T.word + ' and does not require a signature.', M, sy + 5);

    // page numbers once all pages exist
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
      doc.text('Page ' + p + ' of ' + n, R, 290, { align: 'right' });
    }
    doc.setProperties({ title: T.file + ' ' + s.number, subject: T.file + ' for ' + c.name, author: cfg.name, creator: cfg.name });
    return doc;

    function footer() {
      doc.setDrawColor.apply(doc, DOVE); doc.setLineWidth(0.3); doc.line(M, 284, R, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
      doc.text(cfg.name + '  ·  ' + [cfg.phone, cfg.web].filter(Boolean).join('  ·  ') + '  ·  Computer-generated ' + T.word, M, 290);
    }
  }

  function fileName(s) {
    var who = s.client.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return TYPES[s.type].file + '-' + s.number.replace(/[^A-Za-z0-9-]+/g, '') + (who ? '-' + who : '') + '.pdf';
  }

  // ---------- numbering: one series per document type ----------
  function numberOf(str) { var m = String(str).match(/(\d+)\s*$/); return m ? Number(m[1]) : 0; }
  // A number belongs to a series when it carries that type's code, e.g. WR-RCP-2026-0007
  function inSeries(number, type) { return new RegExp('-' + TYPES[type].code + '-\\d{4}-\\d+$').test(number); }
  function markUsed(s) {
    if (!inSeries(s.number, s.type)) return; // a number from the other series or typed by hand does not move the counter
    var key = TYPES[s.type].counter;
    var used = numberOf(s.number);
    if (used >= settings[key]) { settings[key] = used + 1; store.set(KEY_SETTINGS, settings); }
  }

  // Switching type: labels follow, and an untouched number moves to that type's series
  function applyType(prev) {
    var t = docType();
    var T = TYPES[t];
    $('no-label').textContent = T.noLabel;
    $('type-hint').textContent = T.hint;
    var current = $('r-number').value.trim();
    if (prev && (!current || inSeries(current, prev))) $('r-number').value = docNo(t);
    if (settings.docType !== t) { settings.docType = t; store.set(KEY_SETTINGS, settings); }
  }
  ['type-invoice', 'type-receipt'].forEach(function (id) {
    $(id).addEventListener('change', function () { applyType(id === 'type-invoice' ? 'receipt' : 'invoice'); });
  });

  // ---------- form setup ----------
  function fill(draft) {
    $('items').textContent = '';
    $(settings.docType === 'receipt' ? 'type-receipt' : 'type-invoice').checked = true;
    applyType(null);
    $('r-number').value = docNo(docType());
    $('r-date').value = (draft && draft.date) || today();
    $('r-method').value = (draft && draft.method) || 'Cash';
    var c = (draft && draft.client) || {};
    $('c-name').value = c.name || ''; $('c-phone').value = c.phone || '';
    $('c-email').value = c.email || ''; $('c-address').value = c.address || '';
    $('r-notes').value = (draft && draft.notes) || '';
    var items = (draft && draft.items && draft.items.length) ? draft.items : [{}];
    items.forEach(addItem);
    $('form-error').hidden = true;
    update();
  }

  $('add-item').addEventListener('click', function () { addItem().refs.select.focus(); update(); });
  $('receipt-form').addEventListener('input', update);
  $('receipt-form').addEventListener('change', update);

  $('preview').addEventListener('click', function () {
    var s = validate(state());
    if (!s) return;
    var win = window.open('', '_blank');
    var url = buildPdf(s).output('bloburl');
    if (win) win.location.href = url; else window.location.href = url;
  });
  $('receipt-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = validate(state());
    if (!s) return;
    buildPdf(s).save(fileName(s));
    markUsed(s);
  });
  $('new-receipt').addEventListener('click', function () {
    var s = state();
    var started = s.client.name || s.items.some(function (i) { return i.name || i.unit; });
    if (started && !window.confirm('Start a new ' + TYPES[s.type].word + '? The current form will be cleared.')) return;
    markUsed(s);
    fill(null);
    $('c-name').focus();
  });

  // ---------- settings dialog ----------
  var SFIELDS = { name: 's-name', reg: 's-reg', address: 's-address', phone: 's-phone', email: 's-email', web: 's-web', prefix: 's-prefix', nextInvoice: 's-next-inv', nextReceipt: 's-next-rcp', bank: 's-bank', thanks: 's-thanks' };
  $('open-settings').addEventListener('click', function () {
    Object.keys(SFIELDS).forEach(function (k) { $(SFIELDS[k]).value = settings[k]; });
    $('settings').showModal();
  });
  $('settings').addEventListener('close', function () {
    if ($('settings').returnValue !== 'save') return;
    Object.keys(SFIELDS).forEach(function (k) { settings[k] = $(SFIELDS[k]).value.trim(); });
    settings.nextInvoice = Math.max(1, Math.floor(num(settings.nextInvoice)) || 1);
    settings.nextReceipt = Math.max(1, Math.floor(num(settings.nextReceipt)) || 1);
    settings.prefix = settings.prefix || 'WR';
    settings.name = settings.name || DEFAULTS.name;
    store.set(KEY_SETTINGS, settings);
    var before = $('r-number').value.trim();
    if (!before || /-(INV|RCP)-\d{4}-\d+$/.test(before)) $('r-number').value = docNo(docType()); // follow a changed prefix/counter
    update();
  });

  store.del(KEY_OLD_DRAFT);
  fill(null);
})();
