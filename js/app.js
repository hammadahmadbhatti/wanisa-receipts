// Wanisa Renovations receipt generator: runs fully in the browser, nothing is uploaded.
// Company details and the current draft are kept in this device's localStorage.
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
    taxLabel: 'SST',
    taxRate: 18,
    taxReg: '',
    next: 1,
    bank: '',
    thanks: 'Thank you for choosing Wanisa Renovations!',
  };
  var KEY_SETTINGS = 'wanisa-receipt-settings';
  var KEY_DRAFT = 'wanisa-receipt-draft';

  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: still works, just not remembered */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  var settings = Object.assign({}, DEFAULTS, store.get(KEY_SETTINGS) || {});

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
  function receiptNo(n) { return settings.prefix + '-' + new Date().getFullYear() + '-' + String(n).padStart(4, '0'); }
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
    var withTax = $('tax-with').checked;
    var rate = withTax ? num($('tax-rate').value) : 0;
    var sub = items.reduce(function (s, i) { return s + i.total; }, 0);
    var tax = Math.round(sub * rate / 100);
    return {
      number: $('r-number').value.trim(), date: $('r-date').value, method: $('r-method').value,
      client: { name: $('c-name').value.trim(), phone: $('c-phone').value.trim(), email: $('c-email').value.trim(), address: $('c-address').value.trim() },
      items: items, withTax: withTax, rate: rate, sub: sub, tax: tax, total: sub + tax, notes: $('r-notes').value.trim(),
    };
  }

  function update() {
    var s = state();
    s.items.forEach(function (i) { i.row.refs.amount.textContent = rm(i.total); });
    $('t-sub').textContent = rm(s.sub);
    $('t-tax-label').textContent = s.withTax ? settings.taxLabel + ' (' + s.rate + '%)' : 'Tax (not charged)';
    $('t-tax').textContent = rm(s.tax);
    $('t-total').textContent = rm(s.total);
    $('tax-rate').disabled = !s.withTax;
    store.set(KEY_DRAFT, {
      number: s.number, date: s.date, method: s.method, client: s.client, withTax: s.withTax,
      rate: $('tax-rate').value, notes: s.notes, items: s.items.map(function (i) { return i.raw; }),
    });
  }

  // ---------- validation ----------
  // The PDF fonts cover Latin letters (incl. accents); other scripts would print as garbage.
  var LATIN = /^[\u0000-ÿ‘’“”–•…€]*$/;
  function validate(s) {
    document.querySelectorAll('.invalid').forEach(function (e) { e.classList.remove('invalid'); });
    var bad = [];
    function flag(input, msg) { input.classList.add('invalid'); bad.push(msg); }
    if (!s.number) flag($('r-number'), 'receipt number');
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

    // letterhead: logo left, company details right
    var logoW = 64, logoH = logoW * window.WANISA_LOGO.h / window.WANISA_LOGO.w;
    doc.addImage(window.WANISA_LOGO.src, 'PNG', M, 14, logoW, logoH);
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
    doc.text('RECEIPT', M, y);
    var facts = [['Receipt no.', s.number], ['Date', niceDate(s.date)], ['Payment', s.method]];
    var fy = y - 7;
    facts.forEach(function (f) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, MUTED);
      doc.text(f[0], R - 46, fy);
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
    doc.text('RECEIVED FROM', M + 5, y + 6);
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

    // totals
    var rows = [['Subtotal', rm(s.sub)]];
    rows.push(s.withTax ? [cfg.taxLabel + ' (' + s.rate + '%)', rm(s.tax)] : ['Tax', 'Not charged']);
    if (y + 40 > 270) { doc.addPage(); footer(); y = 24; }
    var tx = R - 80;
    doc.setFontSize(9.5);
    rows.forEach(function (r) {
      doc.setFont('helvetica', 'normal'); doc.setTextColor.apply(doc, MUTED); doc.text(r[0], tx, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, INK); doc.text(r[1], R, y, { align: 'right' });
      y += 6;
    });
    doc.setFillColor.apply(doc, CHAR);
    doc.roundedRect(tx - 4, y - 3, R - tx + 4, 11, 2, 2, 'F');
    doc.setTextColor.apply(doc, PEARL); doc.setFontSize(11);
    doc.text('TOTAL PAID', tx, y + 4);
    doc.setFontSize(12.5); doc.text(rm(s.total), R - 3, y + 4.2, { align: 'right' });
    if (s.withTax && cfg.taxReg) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, MUTED);
      doc.text(cfg.taxLabel + ' reg. no.: ' + cfg.taxReg, R, y + 13, { align: 'right' });
    }

    // left column next to the totals: payment status + bank details + notes
    var ly = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, CHAR);
    doc.text('Payment received in full by ' + s.method.toLowerCase() + '.', M, ly);
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

    // thank-you + signature
    var sy = Math.max(y + 26, ly + 10);
    if (sy > 262) { doc.addPage(); footer(); sy = 40; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, CHAR);
    doc.text(cfg.thanks || '', M, sy);
    doc.setDrawColor.apply(doc, MUTED); doc.setLineWidth(0.3); doc.line(R - 62, sy, R, sy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, MUTED);
    doc.text('Authorised signature', R, sy + 4.5, { align: 'right' });

    // page numbers once all pages exist
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
      doc.text('Page ' + p + ' of ' + n, R, 290, { align: 'right' });
    }
    doc.setProperties({ title: 'Receipt ' + s.number, subject: 'Receipt for ' + c.name, author: cfg.name, creator: cfg.name });
    return doc;

    function footer() {
      doc.setDrawColor.apply(doc, DOVE); doc.setLineWidth(0.3); doc.line(M, 284, R, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, MUTED);
      doc.text(cfg.name + '  ·  ' + [cfg.phone, cfg.web].filter(Boolean).join('  ·  ') + '  ·  Computer-generated receipt', M, 290);
    }
  }

  function fileName(s) {
    var who = s.client.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return 'Receipt-' + s.number.replace(/[^A-Za-z0-9-]+/g, '') + (who ? '-' + who : '') + '.pdf';
  }

  // ---------- receipt numbering ----------
  function numberOf(str) { var m = String(str).match(/(\d+)\s*$/); return m ? Number(m[1]) : 0; }
  function markUsed(s) {
    var used = numberOf(s.number);
    if (used >= settings.next) { settings.next = used + 1; store.set(KEY_SETTINGS, settings); }
  }

  // ---------- form setup ----------
  function fill(draft) {
    $('items').textContent = '';
    $('r-number').value = (draft && draft.number) || receiptNo(settings.next);
    $('r-date').value = (draft && draft.date) || today();
    $('r-method').value = (draft && draft.method) || 'Cash';
    var c = (draft && draft.client) || {};
    $('c-name').value = c.name || ''; $('c-phone').value = c.phone || '';
    $('c-email').value = c.email || ''; $('c-address').value = c.address || '';
    $(draft && draft.withTax ? 'tax-with' : 'tax-without').checked = true;
    $('tax-rate').value = draft && draft.rate !== undefined && draft.rate !== '' ? draft.rate : settings.taxRate;
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
    if (started && !window.confirm('Start a new receipt? The current form will be cleared.')) return;
    if (numberOf(s.number) >= settings.next) markUsed(s);
    store.del(KEY_DRAFT);
    fill(null);
    $('c-name').focus();
  });

  // ---------- settings dialog ----------
  var SFIELDS = { name: 's-name', reg: 's-reg', address: 's-address', phone: 's-phone', email: 's-email', web: 's-web', prefix: 's-prefix', taxLabel: 's-tax-label', taxRate: 's-tax-rate', taxReg: 's-tax-reg', next: 's-next', bank: 's-bank', thanks: 's-thanks' };
  $('open-settings').addEventListener('click', function () {
    Object.keys(SFIELDS).forEach(function (k) { $(SFIELDS[k]).value = settings[k]; });
    $('settings').showModal();
  });
  $('settings').addEventListener('close', function () {
    if ($('settings').returnValue !== 'save') return;
    Object.keys(SFIELDS).forEach(function (k) { settings[k] = $(SFIELDS[k]).value.trim(); });
    settings.taxRate = num(settings.taxRate);
    settings.next = Math.max(1, Math.floor(num(settings.next)) || 1);
    settings.prefix = settings.prefix || 'WR';
    settings.taxLabel = settings.taxLabel || 'Tax';
    settings.name = settings.name || DEFAULTS.name;
    store.set(KEY_SETTINGS, settings);
    update();
  });

  fill(store.get(KEY_DRAFT));
})();
