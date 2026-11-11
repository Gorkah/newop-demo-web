(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.NewopDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'newop-demo:v1';
  const SCENARIO_DATE = '2026-11-05';
  const TAX_RATE_BPS = 2100;
  const QUERY_MAX_LENGTH = 200;
  const NAME_MAX_LENGTH = 80;
  const NOTES_MAX_LENGTH = 2000;
  const TASK_MAX_LENGTH = 500;
  const NO_DATA_TEXT = 'No disposo de dades per a aquesta consulta.';
  const TARIFF_CODES = ['A', 'B', 'C'];
  const QUOTE_STATUSES = ['draft', 'approved', 'sent_simulated'];
  const DELIVERY_STATUSES = ['workshop', 'ready', 'delivered'];
  const PAYMENT_STATUSES = ['pending', 'paid_simulated'];
  const TASK_STATUSES = ['pending', 'completed'];
  const ENTITY_TYPES = ['client', 'quote', 'deliveryNote', 'invoice', 'task', 'fabric'];
  const ROUTES = { client: 'clients', quote: 'pressupostos', deliveryNote: 'albarans', invoice: 'facturacio', task: 'seguiment', fabric: 'teixits' };
  const COLLECTIONS = { client: 'clients', quote: 'quotes', deliveryNote: 'deliveryNotes', invoice: 'invoices', task: 'tasks', fabric: 'fabrics' };
  const STATUS_LABELS = {
    draft: 'esborrany', approved: 'aprovat', sent_simulated: 'enviat (simulat)',
    workshop: 'al taller', ready: 'llest', delivered: 'entregat',
    pending: 'pendent', paid_simulated: 'cobrada (simulat)', completed: 'completada'
  };

  // ---------- Utilitats ----------
  function fail(code, field, message) {
    const e = new Error(message);
    e.fail = { code, field: field === undefined ? null : field, message };
    throw e;
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const okResult = (data) => ({ ok: true, data });
  function run(fn) {
    try {
      return okResult(fn());
    } catch (e) {
      if (e && e.fail) return { ok: false, error: { code: e.fail.code, field: e.fail.field, message: e.fail.message } };
      throw e;
    }
  }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (v) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    const p = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null;
  };
  const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
  const isMoney = (v) => Number.isSafeInteger(v) && v >= 0;
  const isQty = (v) => Number.isSafeInteger(v) && v > 0;
  const isInt0 = (v) => Number.isSafeInteger(v) && v >= 0;
  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    if (y < 1 || m < 1 || m > 12 || d < 1) return false;
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return d <= dim;
  }
  const normName = (s) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const textKey = (s) => ' ' + s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const pad4 = (n) => String(n).padStart(4, '0');
  const eur = (c) => String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(c % 100).padStart(2, '0') + ' €';
  const EMAIL_RE = /^[a-z0-9._%+-]+@example\.com$/i;
  const CONTACT_EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  function validEmail(email, allowRealContacts) {
    if (!allowRealContacts) return EMAIL_RE.test(email);
    const local = email.split('@')[0];
    return email.length <= 254 && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && CONTACT_EMAIL_RE.test(email);
  }

  // ---------- Cálculo ----------
  function totalsOf(lines, rate, path) {
    const p = path || 'lines';
    if (!Array.isArray(lines)) fail('VALIDATION_ERROR', p, 'Les línies no són vàlides.');
    if (!isInt0(rate)) fail('VALIDATION_ERROR', 'taxRateBps', 'El tipus d\'impost no és vàlid.');
    let base = 0n;
    lines.forEach((l, i) => {
      if (!isObj(l) || !isQty(l.quantity)) fail('VALIDATION_ERROR', p + '[' + i + '].quantity', 'La quantitat ha de ser un enter positiu.');
      if (!isMoney(l.unitPriceCents)) fail('VALIDATION_ERROR', p + '[' + i + '].unitPriceCents', 'L\'import ha de ser un enter no negatiu en cèntims.');
      base += BigInt(l.quantity) * BigInt(l.unitPriceCents);
    });
    const tax = (base * BigInt(rate) + 5000n) / 10000n;
    const total = base + tax;
    if (total > BigInt(Number.MAX_SAFE_INTEGER)) fail('VALIDATION_ERROR', p, 'L\'import total supera el límit admès.');
    return { baseCents: Number(base), taxCents: Number(tax), totalCents: Number(total) };
  }
  function calculateTotals(amountLines, taxRateBps) {
    return run(() => totalsOf(amountLines, taxRateBps, 'amountLines'));
  }
  function billingTotals(invoices) {
    const months = new Map();
    let invoiced = 0n;
    invoices.forEach((invoice) => {
      invoiced += BigInt(invoice.totals.totalCents);
      const period = invoice.createdOn.slice(0, 7);
      const month = months.get(period) || { period, baseCents: 0n, taxCents: 0n, totalCents: 0n };
      for (const key of ['baseCents', 'taxCents', 'totalCents']) month[key] += BigInt(invoice.totals[key]);
      months.set(period, month);
    });
    if (invoiced > BigInt(Number.MAX_SAFE_INTEGER)) fail('VALIDATION_ERROR', 'invoices', 'La facturació acumulada supera el límit admès.');
    return {
      invoicedCents: Number(invoiced),
      billingSeries: [...months.values()].map((month) => ({ period: month.period, baseCents: Number(month.baseCents), taxCents: Number(month.taxCents), totalCents: Number(month.totalCents) }))
        .sort((a, b) => a.period < b.period ? -1 : 1)
    };
  }
  function bandPrice(tariff, quantity) {
    let price = tariff.bands[0].unitPriceCents;
    for (const b of tariff.bands) {
      if (b.minQuantity <= quantity) price = b.unitPriceCents;
      else break;
    }
    return price;
  }

  // ---------- Fixtures ----------
  function createInitialState() {
    const tariffs = [
      { code: 'A', bands: [{ minQuantity: 1, unitPriceCents: 4800 }, { minQuantity: 10, unitPriceCents: 4200 }, { minQuantity: 50, unitPriceCents: 3600 }] },
      { code: 'B', bands: [{ minQuantity: 1, unitPriceCents: 4200 }, { minQuantity: 10, unitPriceCents: 3700 }, { minQuantity: 50, unitPriceCents: 3200 }] },
      { code: 'C', bands: [{ minQuantity: 1, unitPriceCents: 3600 }, { minQuantity: 10, unitPriceCents: 3200 }, { minQuantity: 50, unitPriceCents: 2800 }] }
    ];
    const noteRules = [
      { token: 'camis', garmentCode: 'CAM', label: 'Camisa', fabricId: 'fab-001', example: '25 camises de lli' },
      { token: 'polo', garmentCode: 'POL', label: 'Polo', fabricId: 'fab-004', example: '40 polos de cotó' },
      { token: 'pantal', garmentCode: 'PAN', label: 'Pantaló', fabricId: 'fab-002', example: '60 pantalons de twill' },
      { token: 'jaquet', garmentCode: 'JAQ', label: 'Jaqueta', fabricId: 'fab-003', example: '8 jaquetes de llana' },
      { token: 'davantal', garmentCode: 'DAV', label: 'Davantal', fabricId: 'fab-006', example: '30 davantals de denim' },
      { token: 'vestit', garmentCode: 'VES', label: 'Vestit', fabricId: 'fab-005', example: '12 vestits de viscosa' },
      { token: 'faldill', garmentCode: 'FAL', label: 'Faldilla', fabricId: 'fab-008', example: '20 faldilles de punt' },
      { token: 'abric', garmentCode: 'ABR', label: 'Abric', fabricId: 'fab-003', example: '6 abrics de llana' }
    ];
    const clients = [
      ['cli-001', 'Estudi Brisa', 'estudi.brisa@example.com'],
      ['cli-002', 'Fil de Nord', 'fil.de.nord@example.com'],
      ['cli-003', 'Atelier Sorra', 'atelier.sorra@example.com'],
      ['cli-004', 'Taller Maror', 'taller.maror@example.com'],
      ['cli-005', 'Cosit a Mà Demo', 'cosit.a.ma@example.com'],
      ['cli-006', 'Roba Viva Estudi', 'roba.viva@example.com'],
      ['cli-007', 'Brodats Llevant', null],
      ['cli-008', 'Teixits Aurora Demo', 'aurora.demo@example.com']
    ].map(([id, name, email]) => ({ id, name, email }));
    const fabrics = [
      ['fab-001', 'Lli rentat natural', '100% lli', 120, 'm', 'Proveïdor fictici Alfa', 1850],
      ['fab-002', 'Twill de cotó orgànic', '98% cotó, 2% elastà', 240, 'm', 'Proveïdor fictici Beta', 1290],
      ['fab-003', 'Llana merina peigada', '100% llana', 60.5, 'm', 'Proveïdor fictici Gamma', 3400],
      ['fab-004', 'Popelina de cotó', '100% cotó', 310, 'm', 'Proveïdor fictici Alfa', 890],
      ['fab-005', 'Viscosa fluida', '100% viscosa', 85, 'm', 'Proveïdor fictici Delta', 1120],
      ['fab-006', 'Denim lleuger', '99% cotó, 1% elastà', 150, 'm', 'Proveïdor fictici Beta', 1560],
      ['fab-007', 'Mussolina doble gasa', '100% cotó', 45, 'm', 'Proveïdor fictici Delta', null],
      ['fab-008', 'Jersei de punt', '95% cotó, 5% elastà', 72, 'm', 'Proveïdor fictici Gamma', 1340]
    ].map(([id, name, composition, quantity, unit, supplierName, priceCents]) => ({
      id, name, composition, stock: { quantity, unit }, supplierName, priceCents
    }));
    const tariffOf = (code) => tariffs.find((t) => t.code === code);
    const mkLine = (id, code, quantity, tariffCode, manual) => {
      const rule = noteRules.find((r) => r.garmentCode === code);
      return {
        id, garmentCode: code, label: rule.label, fabricId: rule.fabricId, quantity,
        unitPriceCents: manual == null ? bandPrice(tariffOf(tariffCode), quantity) : manual,
        priceMode: manual == null ? 'tariff' : 'manual'
      };
    };
    const mkQuote = (n, clientId, createdOn, notes, tariff, status, revision, reviewedRevision, lines) => ({
      id: 'pre-00' + n, number: 'PRE-2026-' + pad4(n), clientId, createdOn, notes, tariff, status, revision, reviewedRevision,
      lines, taxRateBps: TAX_RATE_BPS, totals: totalsOf(lines, TAX_RATE_BPS)
    });
    const quotes = [
      mkQuote(1, 'cli-001', '2026-10-20', 'Reunió de taller (escenari fictici): 25 camises de lli i 40 polos de cotó per a la col·lecció de tardor.', 'A', 'approved', 2, 2,
        [mkLine('pre-001-l1', 'CAM', 25, 'A'), mkLine('pre-001-l2', 'POL', 40, 'A')]),
      mkQuote(2, 'cli-002', '2026-10-22', 'Notes ficticies: 8 jaquetes de llana per a una mostra de temporada.', 'B', 'sent_simulated', 1, 1,
        [mkLine('pre-002-l1', 'JAQ', 8, 'B')]),
      mkQuote(3, 'cli-003', '2026-11-03', 'Notes ficticies: 12 vestits de viscosa pendents de revisar.', 'C', 'draft', 1, null,
        [mkLine('pre-003-l1', 'VES', 12, 'C')]),
      mkQuote(4, 'cli-004', '2026-10-25', 'Notes ficticies: 60 pantalons de twill per lliurar en dues tandes.', 'A', 'approved', 1, 1,
        [mkLine('pre-004-l1', 'PAN', 60, 'A')]),
      mkQuote(5, 'cli-005', '2026-11-04', 'Notes ficticies: 20 faldilles de punt i 6 abrics de llana.', 'B', 'draft', 3, 3,
        [mkLine('pre-005-l1', 'FAL', 20, 'B'), mkLine('pre-005-l2', 'ABR', 6, 'B')]),
      mkQuote(6, 'cli-001', '2026-10-27', 'Notes ficticies: 30 davantals de denim amb preu pactat a mà.', 'B', 'approved', 2, 2,
        [mkLine('pre-006-l1', 'DAV', 30, 'B', 2750)]),
      mkQuote(7, 'cli-002', '2026-09-14', 'Notes ficticies: 5 jaquetes de llana (comanda de setembre).', 'B', 'approved', 1, 1,
        [mkLine('pre-007-l1', 'JAQ', 5, 'B')])
    ];
    const mkNote = (n, quoteId, createdOn, status, picks) => {
      const q = quotes.find((x) => x.id === quoteId);
      const lines = picks.map(([lineId, quantity]) => ({ ...q.lines.find((l) => l.id === lineId), quantity }));
      return {
        id: 'alb-00' + n, number: 'ALB-2026-' + pad4(n), clientId: q.clientId, quoteId, createdOn, status,
        lines, taxRateBps: TAX_RATE_BPS, totals: totalsOf(lines, TAX_RATE_BPS)
      };
    };
    const deliveryNotes = [
      mkNote(1, 'pre-001', '2026-10-24', 'delivered', [['pre-001-l1', 25], ['pre-001-l2', 40]]),
      mkNote(2, 'pre-002', '2026-10-28', 'delivered', [['pre-002-l1', 8]]),
      mkNote(3, 'pre-004', '2026-10-30', 'ready', [['pre-004-l1', 30]]),
      mkNote(4, 'pre-004', '2026-11-02', 'workshop', [['pre-004-l1', 30]]),
      mkNote(5, 'pre-006', '2026-11-02', 'delivered', [['pre-006-l1', 15]]),
      mkNote(6, 'pre-006', '2026-11-04', 'delivered', [['pre-006-l1', 15]]),
      mkNote(7, 'pre-007', '2026-09-25', 'delivered', [['pre-007-l1', 5]])
    ];
    const mkInvoice = (n, createdOn, noteIds, paymentStatus) => {
      const dns = noteIds.map((id) => deliveryNotes.find((d) => d.id === id));
      const lines = dns.flatMap((d) => d.lines.map((l) => ({ ...l, id: d.id + '/' + l.id })));
      return {
        id: 'fac-00' + n, number: 'FAC-2026-' + pad4(n), clientId: dns[0].clientId, createdOn, deliveryNoteIds: noteIds.slice(),
        lines, taxRateBps: TAX_RATE_BPS, totals: totalsOf(lines, TAX_RATE_BPS), reviewedAtRevision: 0, paymentStatus
      };
    };
    const invoices = [
      mkInvoice(1, '2026-10-28', ['alb-001'], 'pending'),
      mkInvoice(2, '2026-09-30', ['alb-007'], 'paid_simulated')
    ];
    const tasks = [
      ['tsk-001', 'cli-003', '2026-11-03', 'Confirmar mides i teixit dels vestits abans de revisar el pressupost.', '2026-11-06', 'pending'],
      ['tsk-002', 'cli-005', '2026-11-04', 'Revisar el pressupost amb el client i decidir la tarifa.', '2026-11-09', 'pending'],
      ['tsk-003', 'cli-004', '2026-11-02', 'Avisar que el segon albarà de pantalons és al taller.', '2026-11-12', 'pending'],
      ['tsk-004', 'cli-002', '2026-10-29', 'Preguntar per la mostra de llana de la jaqueta.', '2026-11-05', 'completed'],
      ['tsk-005', 'cli-001', '2026-11-04', 'Preparar la factura agrupada dels davantals entregats.', '2026-11-05', 'pending'],
      ['tsk-006', 'cli-006', '2026-11-01', 'Fer seguiment de la mostra de roba pendent d\'enviament.', '2026-11-20', 'pending']
    ].map(([id, clientId, createdOn, text, dueDate, status]) => ({ id, clientId, createdOn, text, dueDate, status }));
    const guidedQuestions = [
      { id: 'gq-001', text: 'Quin és l\'estat del pressupost PRE-2026-0003?', entityType: 'quote', entityId: 'pre-003' },
      { id: 'gq-002', text: 'Quin és l\'estat de l\'albarà ALB-2026-0003?', entityType: 'deliveryNote', entityId: 'alb-003' },
      { id: 'gq-003', text: 'Quina és la situació de la factura FAC-2026-0001?', entityType: 'invoice', entityId: 'fac-001' },
      { id: 'gq-004', text: 'Quina tasca de seguiment té Estudi Brisa?', entityType: 'task', entityId: 'tsk-005' },
      { id: 'gq-005', text: 'Quin estoc queda de lli rentat natural?', entityType: 'fabric', entityId: 'fab-001' },
      { id: 'gq-006', text: 'Què sabem d\'Estudi Brisa?', entityType: 'client', entityId: 'cli-001' }
    ];
    return {
      schemaVersion: SCHEMA_VERSION, scenarioDate: SCENARIO_DATE, revision: 0, sequence: 100,
      clients, fabrics, quotes, deliveryNotes, invoices, tasks,
      catalog: { tariffs, noteRules, guidedQuestions, queryMaxLength: QUERY_MAX_LENGTH, taxRateBps: TAX_RATE_BPS }
    };
  }

  // ---------- Validación de estado ----------
  const bad = (field, msg) => fail('INVALID_STATE', field, msg || 'Estructura no vàlida a ' + field + '.');
  function exact(v, keys, path) {
    if (!isObj(v)) bad(path);
    const ks = Object.keys(v);
    if (ks.length !== keys.length || keys.some((k) => !has(v, k))) bad(path);
    return v;
  }
  function optionalExact(v, keys, optional, path) {
    exact(v, keys.concat(optional.filter(k => has(v || {}, k))), path);
    return v;
  }
  function arr(v, path) {
    if (!Array.isArray(v)) bad(path);
    return v;
  }
  function uniqueIds(list, path) {
    const seen = new Set();
    list.forEach((e, i) => {
      if (!isStr(e.id) || seen.has(e.id)) bad(path + '[' + i + '].id');
      seen.add(e.id);
    });
    return seen;
  }
  function checkLines(lines, path, fabricIds) {
    arr(lines, path);
    if (lines.length === 0) bad(path);
    const seen = new Set();
    lines.forEach((l, i) => {
      const p = path + '[' + i + ']';
      exact(l, ['id', 'garmentCode', 'label', 'fabricId', 'quantity', 'unitPriceCents', 'priceMode'], p);
      if (!isStr(l.id) || seen.has(l.id)) bad(p + '.id');
      seen.add(l.id);
      if (!isStr(l.garmentCode)) bad(p + '.garmentCode');
      if (!isStr(l.label)) bad(p + '.label');
      if (l.fabricId !== null && !(typeof l.fabricId === 'string' && fabricIds.has(l.fabricId))) bad(p + '.fabricId');
      if (!isQty(l.quantity)) bad(p + '.quantity');
      if (!isMoney(l.unitPriceCents)) bad(p + '.unitPriceCents');
      if (l.priceMode !== 'tariff' && l.priceMode !== 'manual') bad(p + '.priceMode');
    });
  }
  function checkTotals(doc, rate, path) {
    exact(doc.totals, ['baseCents', 'taxCents', 'totalCents'], path + '.totals');
    let expected;
    try {
      expected = totalsOf(doc.lines, rate, path + '.lines');
    } catch (e) {
      bad(path + '.totals');
    }
    for (const k of ['baseCents', 'taxCents', 'totalCents']) if (doc.totals[k] !== expected[k]) bad(path + '.totals.' + k, 'Els totals no coincideixen a ' + path + '.');
  }
  const lineSnapshotEq = (a, b) => a.garmentCode === b.garmentCode && a.label === b.label && a.fabricId === b.fabricId && a.unitPriceCents === b.unitPriceCents && a.priceMode === b.priceMode;
  function invoiceLinesOf(dns) {
    return dns.flatMap((d) => d.lines.map((l) => ({ ...l, id: d.id + '/' + l.id })));
  }

  function checkState(s, {allowRealContacts = false} = {}) {
    optionalExact(s, ['schemaVersion', 'scenarioDate', 'revision', 'sequence', 'clients', 'fabrics', 'quotes', 'deliveryNotes', 'invoices', 'tasks', 'catalog'], ['workflow'], 'state');
    if (s.schemaVersion !== SCHEMA_VERSION) bad('schemaVersion');
    if (s.scenarioDate !== SCENARIO_DATE) bad('scenarioDate');
    if (!isInt0(s.revision)) bad('revision');
    if (!isQty(s.sequence)) bad('sequence');
    const cat = exact(s.catalog, ['tariffs', 'noteRules', 'guidedQuestions', 'queryMaxLength', 'taxRateBps'], 'catalog');
    if (!isQty(cat.queryMaxLength)) bad('catalog.queryMaxLength');
    if (!isInt0(cat.taxRateBps)) bad('catalog.taxRateBps');
    const rate = cat.taxRateBps;

    arr(s.clients, 'clients');
    const clientIds = uniqueIds(s.clients, 'clients');
    const names = new Set();
    s.clients.forEach((c, i) => {
      const p = 'clients[' + i + ']';
      exact(c, ['id', 'name', 'email'], p);
      if (!isStr(c.name)) bad(p + '.name');
      const n = normName(c.name);
      if (names.has(n)) bad(p + '.name', 'Nom de client duplicat.');
      names.add(n);
      if (c.email !== null && !(typeof c.email === 'string' && validEmail(c.email, allowRealContacts === true))) bad(p + '.email');
    });

    arr(s.fabrics, 'fabrics');
    const fabricIds = uniqueIds(s.fabrics, 'fabrics');
    s.fabrics.forEach((f, i) => {
      const p = 'fabrics[' + i + ']';
      exact(f, ['id', 'name', 'composition', 'stock', 'supplierName', 'priceCents'], p);
      if (!isStr(f.name)) bad(p + '.name');
      if (typeof f.composition !== 'string') bad(p + '.composition');
      if (typeof f.supplierName !== 'string') bad(p + '.supplierName');
      exact(f.stock, ['quantity', 'unit'], p + '.stock');
      if (typeof f.stock.quantity !== 'number' || !Number.isFinite(f.stock.quantity) || f.stock.quantity < 0) bad(p + '.stock.quantity');
      if (!isStr(f.stock.unit)) bad(p + '.stock.unit');
      if (f.priceCents !== null && !isMoney(f.priceCents)) bad(p + '.priceCents');
    });

    arr(cat.tariffs, 'catalog.tariffs');
    if (cat.tariffs.length !== TARIFF_CODES.length) bad('catalog.tariffs');
    const tariffs = {};
    cat.tariffs.forEach((t, i) => {
      const p = 'catalog.tariffs[' + i + ']';
      exact(t, ['code', 'bands'], p);
      if (!TARIFF_CODES.includes(t.code) || has(tariffs, t.code)) bad(p + '.code');
      arr(t.bands, p + '.bands');
      if (t.bands.length === 0) bad(p + '.bands');
      let prev = 0;
      t.bands.forEach((b, j) => {
        const bp = p + '.bands[' + j + ']';
        exact(b, ['minQuantity', 'unitPriceCents'], bp);
        if (!isQty(b.minQuantity) || b.minQuantity <= prev || (j === 0 && b.minQuantity !== 1)) bad(bp + '.minQuantity');
        if (!isMoney(b.unitPriceCents)) bad(bp + '.unitPriceCents');
        prev = b.minQuantity;
      });
      tariffs[t.code] = t;
    });
    arr(cat.noteRules, 'catalog.noteRules');
    if (cat.noteRules.length === 0) bad('catalog.noteRules');
    const tokens = new Set();
    cat.noteRules.forEach((r, i) => {
      const p = 'catalog.noteRules[' + i + ']';
      exact(r, ['token', 'garmentCode', 'label', 'fabricId', 'example'], p);
      if (typeof r.token !== 'string' || !/^[a-z]{2,}$/.test(r.token) || tokens.has(r.token)) bad(p + '.token');
      tokens.add(r.token);
      if (!isStr(r.garmentCode)) bad(p + '.garmentCode');
      if (!isStr(r.label)) bad(p + '.label');
      if (r.fabricId !== null && !(typeof r.fabricId === 'string' && fabricIds.has(r.fabricId))) bad(p + '.fabricId');
      if (!isStr(r.example)) bad(p + '.example');
    });

    arr(s.quotes, 'quotes');
    const quoteIds = uniqueIds(s.quotes, 'quotes');
    const quotesById = new Map();
    const numbers = new Set();
    s.quotes.forEach((q, i) => {
      const p = 'quotes[' + i + ']';
      exact(q, ['id', 'number', 'clientId', 'createdOn', 'notes', 'tariff', 'status', 'revision', 'reviewedRevision', 'lines', 'taxRateBps', 'totals'], p);
      if (!isStr(q.number) || numbers.has(q.number)) bad(p + '.number');
      numbers.add(q.number);
      if (!clientIds.has(q.clientId)) bad(p + '.clientId');
      if (!isDate(q.createdOn)) bad(p + '.createdOn');
      if (!isStr(q.notes)) bad(p + '.notes');
      if (!has(tariffs, q.tariff)) bad(p + '.tariff');
      if (!QUOTE_STATUSES.includes(q.status)) bad(p + '.status');
      if (!isQty(q.revision)) bad(p + '.revision');
      if (q.reviewedRevision !== null && (!isQty(q.reviewedRevision) || q.reviewedRevision > q.revision)) bad(p + '.reviewedRevision');
      if (q.status !== 'draft' && q.reviewedRevision !== q.revision) bad(p + '.reviewedRevision', 'Pressupost aprovat sense revisió vigent.');
      checkLines(q.lines, p + '.lines', fabricIds);
      q.lines.forEach((l, j) => {
        if (l.priceMode === 'tariff' && l.unitPriceCents !== bandPrice(tariffs[q.tariff], l.quantity)) bad(p + '.lines[' + j + '].unitPriceCents', 'El preu no coincideix amb la tarifa.');
      });
      if (q.taxRateBps !== rate) bad(p + '.taxRateBps');
      checkTotals(q, rate, p);
      quotesById.set(q.id, q);
    });

    arr(s.deliveryNotes, 'deliveryNotes');
    uniqueIds(s.deliveryNotes, 'deliveryNotes');
    const dnById = new Map();
    numbers.clear();
    s.deliveryNotes.forEach((d, i) => {
      const p = 'deliveryNotes[' + i + ']';
      exact(d, ['id', 'number', 'clientId', 'quoteId', 'createdOn', 'status', 'lines', 'taxRateBps', 'totals'], p);
      if (!isStr(d.number) || numbers.has(d.number)) bad(p + '.number');
      numbers.add(d.number);
      if (!clientIds.has(d.clientId)) bad(p + '.clientId');
      if (!quoteIds.has(d.quoteId)) bad(p + '.quoteId');
      const q = quotesById.get(d.quoteId);
      if (q.clientId !== d.clientId) bad(p + '.clientId', 'El client de l\'albarà no coincideix amb el del pressupost.');
      if (q.status === 'draft') bad(p + '.quoteId', 'L\'albarà prové d\'un pressupost sense aprovar.');
      if (!isDate(d.createdOn)) bad(p + '.createdOn');
      if (!DELIVERY_STATUSES.includes(d.status)) bad(p + '.status');
      checkLines(d.lines, p + '.lines', fabricIds);
      d.lines.forEach((l, j) => {
        const src = q.lines.find((x) => x.id === l.id);
        if (!src || !lineSnapshotEq(src, l)) bad(p + '.lines[' + j + ']', 'La línia no coincideix amb el pressupost.');
      });
      if (d.taxRateBps !== rate) bad(p + '.taxRateBps');
      checkTotals(d, rate, p);
      dnById.set(d.id, d);
    });

    // Quantities in every delivery note are reserved, including work still at the workshop.
    const reserved = new Map();
    for (const d of s.deliveryNotes) for (const l of d.lines) {
      const key = d.quoteId + '/' + l.id;
      const amount = (reserved.get(key) || 0n) + BigInt(l.quantity);
      if (amount > BigInt(quotesById.get(d.quoteId).lines.find(x => x.id === l.id).quantity)) bad('deliveryNotes', 'La suma dels albarans supera la quantitat pressupostada.');
      reserved.set(key, amount);
    }
    arr(s.invoices, 'invoices');
    uniqueIds(s.invoices, 'invoices');
    numbers.clear();
    const invoiced = new Set();
    s.invoices.forEach((inv, i) => {
      const p = 'invoices[' + i + ']';
      const purchaseOrigin = inv.origin === 'purchase';
      optionalExact(inv, ['id', 'number', 'clientId', 'createdOn', 'deliveryNoteIds', 'lines', 'taxRateBps', 'totals', 'reviewedAtRevision', 'paymentStatus'].concat(purchaseOrigin ? ['origin','purchaseIds'] : []), ['dueDate'], p);
      if (has(inv, 'dueDate') && !isDate(inv.dueDate)) bad(p + '.dueDate');
      if (!isStr(inv.number) || numbers.has(inv.number)) bad(p + '.number');
      numbers.add(inv.number);
      if (!clientIds.has(inv.clientId)) bad(p + '.clientId');
      if (!isDate(inv.createdOn)) bad(p + '.createdOn');
      arr(inv.deliveryNoteIds, p + '.deliveryNoteIds');
      if (purchaseOrigin ? inv.deliveryNoteIds.length !== 0 : inv.deliveryNoteIds.length === 0) bad(p + '.deliveryNoteIds');
      const dns = inv.deliveryNoteIds.map((id, j) => {
        if (typeof id !== 'string' || !dnById.has(id)) bad(p + '.deliveryNoteIds[' + j + ']');
        if (invoiced.has(id)) bad(p + '.deliveryNoteIds[' + j + ']', 'Albarà facturat més d\'una vegada.');
        invoiced.add(id);
        return dnById.get(id);
      });
      dns.forEach((d) => {
        if (d.clientId !== inv.clientId) bad(p + '.clientId', 'La factura barreja clients.');
        if (d.status !== 'delivered') bad(p + '.deliveryNoteIds', 'La factura inclou albarans sense entregar.');
      });
      checkLines(inv.lines, p + '.lines', fabricIds);
      let expectedLines = invoiceLinesOf(dns);
      if (purchaseOrigin) {
        if (!s.workflow || !Array.isArray(s.workflow.purchases) || !Array.isArray(inv.purchaseIds) || !inv.purchaseIds.length || new Set(inv.purchaseIds).size !== inv.purchaseIds.length) bad(p + '.purchaseIds');
        expectedLines = inv.purchaseIds.map(id => {
          const purchase = s.workflow.purchases.find(x => x.id === id);
          if (!purchase || purchase.clientId !== inv.clientId || purchase.invoiceId !== inv.id || purchase.taxRateBps !== inv.taxRateBps) bad(p + '.purchaseIds');
          return purchaseLine(purchase);
        });
      }
      if (inv.lines.length !== expectedLines.length || inv.lines.some((l, j) => l.id !== expectedLines[j].id || l.quantity !== expectedLines[j].quantity || !lineSnapshotEq(l, expectedLines[j]))) bad(p + '.lines', 'Les línies no coincideixen amb els albarans.');
      if (!purchaseOrigin && inv.taxRateBps !== rate) bad(p + '.taxRateBps');
      checkTotals(inv, inv.taxRateBps, p);
      if (!isInt0(inv.reviewedAtRevision) || inv.reviewedAtRevision > s.revision) bad(p + '.reviewedAtRevision');
      if (!PAYMENT_STATUSES.includes(inv.paymentStatus)) bad(p + '.paymentStatus');
      if (inv.paymentStatus==='paid_simulated' && (purchaseOrigin || has(inv,'dueDate')) && !s.workflow && inv.totals.totalCents!==0) bad(p+'.paymentStatus','Un cobrament nou requereix rebut o anticipo.');
    });
    billingTotals(s.invoices);

    arr(s.tasks, 'tasks');
    const taskIds = uniqueIds(s.tasks, 'tasks');
    s.tasks.forEach((t, i) => {
      const p = 'tasks[' + i + ']';
      exact(t, ['id', 'clientId', 'createdOn', 'text', 'dueDate', 'status'], p);
      if (!clientIds.has(t.clientId)) bad(p + '.clientId');
      if (!isDate(t.createdOn)) bad(p + '.createdOn');
      if (!isStr(t.text)) bad(p + '.text');
      if (!isDate(t.dueDate)) bad(p + '.dueDate');
      if (!TASK_STATUSES.includes(t.status)) bad(p + '.status');
    });

    arr(cat.guidedQuestions, 'catalog.guidedQuestions');
    const ids = { client: clientIds, quote: quoteIds, deliveryNote: new Set(dnById.keys()), invoice: new Set(s.invoices.map((x) => x.id)), task: taskIds, fabric: fabricIds };
    uniqueIds(cat.guidedQuestions, 'catalog.guidedQuestions');
    cat.guidedQuestions.forEach((g, i) => {
      const p = 'catalog.guidedQuestions[' + i + ']';
      exact(g, ['id', 'text', 'entityType', 'entityId'], p);
      if (!isStr(g.text)) bad(p + '.text');
      if (!ENTITY_TYPES.includes(g.entityType)) bad(p + '.entityType');
      if (typeof g.entityId !== 'string' || !ids[g.entityType].has(g.entityId)) bad(p + '.entityId');
    });
    if (has(s, 'workflow')) checkWorkflow(s);
    return s;
  }

  function validateState(candidate, options = {}) {
    try {
      return okResult(clone(checkState(candidate, options)));
    } catch (e) {
      if (e && e.fail) return { ok: false, error: { code: 'INVALID_STATE', field: e.fail.field, message: e.fail.message } };
      return { ok: false, error: { code: 'INVALID_STATE', field: null, message: 'L\'estat no és vàlid.' } };
    }
  }

  // ---------- Fuentes y consultas ----------
  const byId = (list, id) => list.find((e) => e.id === id) || null;
  const clientName = (s, id) => (byId(s.clients, id) || { name: id }).name;
  function labelOf(s, type, e) {
    switch (type) {
      case 'client': return e.name;
      case 'quote': return e.number + ' · ' + clientName(s, e.clientId);
      case 'deliveryNote': return e.number + ' · ' + clientName(s, e.clientId);
      case 'invoice': return e.number + ' · ' + clientName(s, e.clientId);
      case 'task': return 'Tasca: ' + (e.text.length > 48 ? e.text.slice(0, 47) + '…' : e.text) + ' · ' + clientName(s, e.clientId);
      default: return e.name;
    }
  }
  const sourceOf = (s, type, e) => ({ entityType: type, id: e.id, label: labelOf(s, type, e), hash: '#/' + ROUTES[type] + '/' + encodeURIComponent(e.id) });
  function describe(s, type, e) {
    switch (type) {
      case 'client': {
        const n = (c) => s[c].filter((x) => x.clientId === e.id).length;
        return e.name + ' (client fictici): ' + n('quotes') + ' pressupostos, ' + n('deliveryNotes') + ' albarans, ' + n('invoices') + ' factures i ' + s.tasks.filter((t) => t.clientId === e.id && t.status === 'pending').length + ' tasques pendents.';
      }
      case 'quote': return 'El pressupost ' + e.number + ' de ' + clientName(s, e.clientId) + ' està ' + STATUS_LABELS[e.status] + ', amb un total de ' + eur(e.totals.totalCents) + ' (import fictici, simulació).';
      case 'deliveryNote': return 'L\'albarà ' + e.number + ' de ' + clientName(s, e.clientId) + ' està ' + STATUS_LABELS[e.status] + ', amb un total de ' + eur(e.totals.totalCents) + ' (import fictici, simulació).';
      case 'invoice': return 'La factura ' + e.number + ' de ' + clientName(s, e.clientId) + ' està ' + STATUS_LABELS[e.paymentStatus] + ', amb un total de ' + eur(e.totals.totalCents) + ' (import fictici, simulació).';
      case 'task': return 'Tasca de ' + clientName(s, e.clientId) + ' (' + STATUS_LABELS[e.status] + ', per al ' + e.dueDate + '): ' + e.text;
      default: return e.name + ': estoc de ' + e.stock.quantity + ' ' + e.stock.unit + ', proveïdor ' + e.supplierName + ', ' + (e.priceCents === null ? 'sense preu.' : 'preu fictici de ' + eur(e.priceCents) + ' per ' + e.stock.unit + '.');
    }
  }

  function answerQuery(s, rawText) {
    if (typeof rawText !== 'string' || rawText.trim() === '') fail('VALIDATION_ERROR', 'text', 'Escriu una pregunta.');
    if (rawText.length > s.catalog.queryMaxLength) fail('VALIDATION_ERROR', 'text', 'La pregunta no pot superar els ' + s.catalog.queryMaxLength + ' caràcters.');
    const key = textKey(rawText);
    const has_ = (k) => key.includes(textKey(k));
    const answer = (text, sources) => ({ kind: 'answer', text, sources });
    const one = (type, e) => answer(describe(s, type, e), [sourceOf(s, type, e)]);
    const guided = s.catalog.guidedQuestions.find((g) => textKey(g.text) === key);
    if (guided) return one(guided.entityType, findEntity(s, guided.entityType, guided.entityId));
    for (const type of ['quote', 'deliveryNote', 'invoice']) {
      const e = s[COLLECTIONS[type]].find((x) => has_(x.number));
      if (e) return one(type, e);
    }
    const fabric = s.fabrics.find((f) => has_(f.name));
    if (fabric) return one('fabric', fabric);
    const client = s.clients.find((c) => has_(c.name));
    if (client) return one('client', client);
    const list = (type, items, empty, intro) => items.length
      ? answer(intro + ' ' + items.length + ': ' + items.map((e) => e.number || e.text).join(', ') + '.', items.map((e) => sourceOf(s, type, e)))
      : answer(empty, []);
    if (has_('pressupostos') && (has_('pendents') || has_('esborrany'))) {
      return list('quote', s.quotes.filter((q) => q.status === 'draft'), 'No hi ha pressupostos pendents.', 'Pressupostos en esborrany:');
    }
    if ((has_('tasques') || has_('seguiment')) && has_('pendents')) {
      return list('task', s.tasks.filter((t) => t.status === 'pending').sort(taskOrder), 'No hi ha tasques pendents.', 'Tasques pendents:');
    }
    if (has_('albarans') && (has_('taller') || has_('pendents'))) {
      return list('deliveryNote', s.deliveryNotes.filter((d) => d.status !== 'delivered'), 'No hi ha albarans pendents d\'entrega.', 'Albarans pendents d\'entrega:');
    }
    if (has_('factures') || has_('facturacio') || has_('facturat')) {
      const total = billingTotals(s.invoices).invoicedCents;
      const pending = s.invoices.filter((i) => i.paymentStatus === 'pending').length;
      return answer('Facturat: ' + eur(total) + ' en ' + s.invoices.length + ' factures; ' + pending + ' pendents de cobrament simulat (imports ficticis).', s.invoices.map((i) => sourceOf(s, 'invoice', i)));
    }
    return { kind: 'no_data', text: NO_DATA_TEXT, sources: [] };
  }
  function findEntity(s, type, id) {
    return byId(s[COLLECTIONS[type]], id);
  }
  const taskOrder = (a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  function dashboard(s) {
    const pendingTasks = s.tasks.filter((t) => t.status === 'pending').sort(taskOrder);
    const draft = s.quotes.filter((q) => q.status === 'draft');
    const active = s.deliveryNotes.filter((d) => d.status !== 'delivered');
    const billing = billingTotals(s.invoices);
    const count = (st) => s.deliveryNotes.filter((d) => d.status === st).length;
    return {
      scenarioDate: s.scenarioDate,
      summary: { quotesPendingCount: draft.length, productionCount: active.length, tasksPendingCount: pendingTasks.length, invoicedCents: billing.invoicedCents,
        outstandingCents:sumCents(s.invoices.map(i=>({amountCents:balance(s,'invoice',i.id).outstandingCents}))),
        receivedCents:sumCents([...(s.workflow?.receipts||[]),...s.invoices.filter(i=>i.paymentStatus==='paid_simulated'&&!(s.workflow?.receipts||[]).some(r=>r.targetType==='invoice'&&r.targetId===i.id)&&!(s.workflow?.creditAllocations||[]).some(r=>r.invoiceId===i.id)).map(i=>({amountCents:i.totals.totalCents}))]) },
      priorityTasks: pendingTasks,
      production: { workshop: count('workshop'), ready: count('ready'), delivered: count('delivered') },
      billingSeries: billing.billingSeries,
      sources: [
        ...pendingTasks.map((e) => sourceOf(s, 'task', e)),
        ...draft.map((e) => sourceOf(s, 'quote', e)),
        ...active.map((e) => sourceOf(s, 'deliveryNote', e)),
        ...s.invoices.map((e) => sourceOf(s, 'invoice', e))
      ]
    };
  }

  function selectDeliveryNotes(s, ids) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string' || i === '')) fail('VALIDATION_ERROR', 'deliveryNoteIds', 'Selecciona almenys un albarà.');
    if (new Set(ids).size !== ids.length) fail('DUPLICATE_REFERENCE', 'deliveryNoteIds', 'Hi ha albarans repetits a la selecció.');
    const dns = ids.map((id) => byId(s.deliveryNotes, id) || fail('NOT_FOUND', 'deliveryNoteIds', 'No s\'ha trobat l\'albarà ' + id + '.'));
    if (dns.some((d) => d.status !== 'delivered')) fail('INVALID_TRANSITION', 'deliveryNoteIds', 'Només es poden facturar albarans entregats.');
    if (new Set(dns.map((d) => d.clientId)).size !== 1) fail('CLIENT_MISMATCH', 'deliveryNoteIds', 'Els albarans han de ser del mateix client.');
    if (dns.some((d) => s.invoices.some((i) => i.deliveryNoteIds.includes(d.id)))) fail('ALREADY_INVOICED', 'deliveryNoteIds', 'Algun albarà ja està facturat.');
    return dns;
  }

  function runQuery(s, req) {
    if (!isObj(req) || typeof req.type !== 'string') fail('VALIDATION_ERROR', 'type', 'Consulta no vàlida.');
    switch (req.type) {
      case 'BILLING_BALANCE': return balance(s, req.targetType, req.targetId);
      case 'WORKSHOP_WEEK': {
        if (!isDate(req.from) || !isDate(req.to) || req.from > req.to) fail('VALIDATION_ERROR', 'from', 'Indica un interval de dates vàlid.');
        const entries = (s.workflow?.workshopEntries || []).filter(e => e.dueDate >= req.from && e.dueDate <= req.to).sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
        return {from:req.from,to:req.to,entries,pendingCount:entries.filter(e=>e.status==='pending').length,deliveredCount:entries.filter(e=>e.status==='delivered').length};
      }
      case 'DASHBOARD': return dashboard(s);
      case 'FABRICS': {
        for (const f of ['text', 'composition']) if (req[f] !== undefined && typeof req[f] !== 'string') fail('VALIDATION_ERROR', f, 'El filtre ha de ser text.');
        if (req.maxPriceCents !== undefined && !isMoney(req.maxPriceCents)) fail('VALIDATION_ERROR', 'maxPriceCents', 'El preu màxim ha de ser un enter no negatiu en cèntims.');
        const text = (req.text || '').trim().toLowerCase();
        const comp = (req.composition || '').trim().toLowerCase();
        return s.fabrics.filter((f) => f.name.toLowerCase().includes(text) && f.composition.toLowerCase().includes(comp) &&
          (req.maxPriceCents === undefined || (f.priceCents !== null && f.priceCents <= req.maxPriceCents)));
      }
      case 'CLIENTS': {
        if (req.text !== undefined && typeof req.text !== 'string') fail('VALIDATION_ERROR', 'text', 'La cerca ha de ser text.');
        const text = (req.text || '').trim().toLowerCase();
        return s.clients.filter((c) => c.name.toLowerCase().includes(text) || (c.email || '').toLowerCase().includes(text));
      }
      case 'CLIENT_DETAIL': {
        const client = typeof req.id === 'string' ? byId(s.clients, req.id) : null;
        if (!client) fail('NOT_FOUND', 'id', 'No s\'ha trobat el client.');
        const own = (c) => s[c].filter((x) => x.clientId === client.id);
        return { client, quotes: own('quotes'), deliveryNotes: own('deliveryNotes'), invoices: own('invoices'), tasks: own('tasks') };
      }
      case 'INVOICE_PREVIEW': {
        const dns = selectDeliveryNotes(s, req.deliveryNoteIds);
        const lines = invoiceLinesOf(dns);
        return { clientId: dns[0].clientId, deliveryNoteIds: dns.map((d) => d.id), lines, taxRateBps: s.catalog.taxRateBps, totals: totalsOf(lines, s.catalog.taxRateBps), stateRevision: s.revision };
      }
      case 'ANSWER': return answerQuery(s, req.text);
      default: return fail('VALIDATION_ERROR', 'type', 'Tipus de consulta desconegut.');
    }
  }

  // ---------- Comandos ----------
  // Formas catalanas explícitas del catálogo; el token interno no es un prefijo libre.
  const garmentWords = {
    CAM: 'camisa|camises', POL: 'polo|polos', PAN: 'pantalo|pantalons', JAQ: 'jaqueta|jaquetes',
    DAV: 'davantal|davantals', VES: 'vestit|vestits', FAL: 'faldilla|faldilles', ABR: 'abric|abrics'
  };
  function parseNotes(s, notes) {
    const text = notes.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[\u2212\u2010-\u2015\uFE63\uFF0D]/g, '-').replace(/[\uFE62\uFF0B]/g, '+')
      .replace(/[\u2044\u2215\uFF0F]/g, '/');
    const found = [];
    s.catalog.noteRules.forEach((rule) => {
      const words = garmentWords[rule.garmentCode];
      if (!words) return;
      // Capturar también fracciones y signos completos para rechazarlos, sin extraer un sufijo válido.
      const quantityPattern = '([+\\-]?\\s*\\d+(?:[.,]\\d+|\\s*/\\s*[+\\-]?\\s*\\d+)*(?:e[+\\-]?\\d+)?)';
      const re = new RegExp('(?:^|[^\\p{L}\\p{N}.,+/\\-])' + quantityPattern +
        '\\s*(?:unitats?|uts?|u|peces?|x)?\\s*(?:de\\s+|d\')?(?:' + words + ')(?![\\p{L}\\p{N}_])', 'gu');
      let m;
      while ((m = re.exec(text)) !== null) {
        const token = m[1].trim();
        const quantity = Number(token);
        if (!/^\d+$/.test(token) || !isQty(quantity)) fail('VALIDATION_ERROR', 'notes', 'La quantitat de les notes ha de ser un enter positiu.');
        found.push({ index: m.index, rule, quantity });
      }
    });
    found.sort((a, b) => a.index - b.index);
    const merged = [];
    found.forEach((f) => {
      const prev = merged.find((x) => x.rule.garmentCode === f.rule.garmentCode);
      if (prev) {
        const quantity = BigInt(prev.quantity) + BigInt(f.quantity);
        if (quantity > BigInt(Number.MAX_SAFE_INTEGER)) fail('VALIDATION_ERROR', 'notes', 'La quantitat de les notes supera el límit admès.');
        prev.quantity = Number(quantity);
      }
      else merged.push({ rule: f.rule, quantity: f.quantity });
    });
    return merged;
  }
  function nextId(s, prefix, col) {
    let id;
    do {
      id = prefix + '-' + s.sequence;
      s.sequence += 1;
    } while ((s[col] || s.workflow?.[col] || []).some((e) => e.id === id));
    return id;
  }
  function nextNumber(s, col, prefix) {
    let n = s[col].length + 1;
    while (s[col].some((e) => e.number === prefix + '-2026-' + pad4(n))) n += 1;
    return prefix + '-2026-' + pad4(n);
  }
  const need = (cmd, field, msg) => {
    if (typeof cmd[field] !== 'string' || cmd[field].trim() === '') fail('VALIDATION_ERROR', field, msg || 'Aquest camp és obligatori.');
    return cmd[field];
  };
  const expectRevision = (cmd, field) => {
    if (!isQty(cmd[field])) fail('VALIDATION_ERROR', field, 'La revisió esperada no és vàlida.');
    return cmd[field];
  };
  const getOrFail = (s, col, id, field, msg) => byId(s[col], id) || fail('NOT_FOUND', field, msg);
  const tariffByCode = (s, code) => s.catalog.tariffs.find((t) => t.code === code);
  const quoteTotals = (s, lines) => totalsOf(lines, s.catalog.taxRateBps);
  function cleanName(name) {
    const n = name.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (n === '') fail('VALIDATION_ERROR', 'name', 'El nom és obligatori.');
    if (n.length > NAME_MAX_LENGTH) fail('VALIDATION_ERROR', 'name', 'El nom no pot superar els ' + NAME_MAX_LENGTH + ' caràcters.');
    return n;
  }

  const HANDLERS = {
    CREATE_CLIENT(s, c, options = {}) {
      if (typeof c.name !== 'string') fail('VALIDATION_ERROR', 'name', 'El nom és obligatori.');
      const name = cleanName(c.name);
      let email = c.email === undefined ? null : c.email;
      if (email !== null && typeof email !== 'string') fail('VALIDATION_ERROR', 'email', 'El correu no és vàlid.');
      if (typeof email === 'string') {
        email = email.trim();
        if (email === '') email = null;
        else if (!validEmail(email, options.allowRealContacts === true)) fail('VALIDATION_ERROR', 'email', options.allowRealContacts === true ? 'El correu no té un format vàlid.' : 'Només s\'admeten correus ficticis d\'example.com.');
      }
      const key = normName(name);
      if (s.clients.some((x) => normName(x.name) === key)) fail('DUPLICATE_CLIENT', 'name', 'Ja existeix un client amb aquest nom.');
      const client = { id: nextId(s, 'cli', 'clients'), name, email };
      s.clients.push(client);
      return client;
    },
    DRAFT_QUOTE(s, c) {
      need(c, 'clientId', 'Selecciona un client.');
      if (!TARIFF_CODES.includes(c.tariff)) fail('VALIDATION_ERROR', 'tariff', 'La tarifa ha de ser A, B o C.');
      if (typeof c.notes !== 'string' || c.notes.trim() === '') fail('VALIDATION_ERROR', 'notes', 'Escriu les notes de la reunió.');
      if (c.notes.length > NOTES_MAX_LENGTH) fail('VALIDATION_ERROR', 'notes', 'Les notes no poden superar els ' + NOTES_MAX_LENGTH + ' caràcters.');
      getOrFail(s, 'clients', c.clientId, 'clientId', 'No s\'ha trobat el client.');
      const picks = parseNotes(s, c.notes);
      if (picks.length === 0) fail('NO_DATA', 'notes', 'No s\'ha reconegut cap quantitat amb prenda a les notes.');
      const tariff = tariffByCode(s, c.tariff);
      const id = nextId(s, 'pre', 'quotes');
      const lines = picks.map((p, i) => ({
        id: id + '-l' + (i + 1), garmentCode: p.rule.garmentCode, label: p.rule.label, fabricId: p.rule.fabricId,
        quantity: p.quantity, unitPriceCents: bandPrice(tariff, p.quantity), priceMode: 'tariff'
      }));
      const quote = {
        id, number: nextNumber(s, 'quotes', 'PRE'), clientId: c.clientId, createdOn: s.scenarioDate, notes: c.notes, tariff: c.tariff,
        status: 'draft', revision: 1, reviewedRevision: null, lines, taxRateBps: s.catalog.taxRateBps, totals: quoteTotals(s, lines)
      };
      s.quotes.push(quote);
      return quote;
    },
    DRAFT_QUOTE_FROM_AI(s, c) {
      if (c.humanReviewed !== true) fail('REVIEW_REQUIRED', 'humanReviewed', 'Cal revisar la proposta abans de crear l’esborrany.');
      if (!isInt0(c.expectedRevision) || c.expectedRevision !== s.revision) fail('STALE_REVIEW', 'expectedRevision', 'Les dades han canviat; torna a preparar la proposta.');
      if (typeof c.notes !== 'string' || !c.notes.trim() || c.notes.length > NOTES_MAX_LENGTH) fail('VALIDATION_ERROR', 'notes', 'Les notes no són vàlides.');
      const exactKeys = (value, allowed) => isObj(value) && Object.keys(value).every((key) => allowed.includes(key));
      const candidate = c.candidate;
      if (!exactKeys(candidate, ['items', 'questions']) || !Array.isArray(candidate.items) || !candidate.items.length || candidate.items.length > 40 || !Array.isArray(candidate.questions) || candidate.questions.length) fail('AI_CANDIDATE_INVALID', 'candidate', 'Resol les preguntes i revisa una proposta amb evidències vàlides.');
      const spans = [], quantities = new Map();
      const recognised = parseNotes(s, c.notes);
      candidate.items.forEach((item) => {
        if (!exactKeys(item, ['garmentCode', 'evidence']) || !garmentWords[item.garmentCode] || !s.catalog.noteRules.some((rule) => rule.garmentCode === item.garmentCode) || !Array.isArray(item.evidence) || !item.evidence.length || item.evidence.length > 50 || quantities.has(item.garmentCode)) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'La proposta conté peces o camps no permesos.');
        let quantity = 0n;
        item.evidence.forEach((evidence) => {
          if (!exactKeys(evidence, ['start', 'end', 'quantity', 'text']) || !isInt0(evidence.start) || !Number.isSafeInteger(evidence.end) || evidence.end <= evidence.start || evidence.end > c.notes.length || !isQty(evidence.quantity)) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'Les posicions o quantitats de l’evidència no són vàlides.');
          const text = c.notes.slice(evidence.start, evidence.end);
          if (has(evidence, 'text') && evidence.text !== text) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'L’evidència ha de coincidir amb les notes originals.');
          if (spans.some((span) => evidence.start < span.end && evidence.end > span.start)) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'No es poden repetir ni solapar evidències.');
          const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const match = new RegExp('^\\s*(\\d+)\\s*(?:unitats?|uts?|u|peces?|x)?\\s*(?:de\\s+|d\')?(?:' + garmentWords[item.garmentCode] + ')\\s*$', 'u').exec(normalized);
          if (!match || Number(match[1]) !== evidence.quantity || /[\p{L}\p{N}.,+\/\-\u2212\u2010-\u2015\uFE63\uFF0D]$/u.test(c.notes.slice(0,evidence.start)) || /^[\p{L}\p{N}_]/u.test(c.notes.slice(evidence.end))) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'La peça i la quantitat han d’aparèixer explícitament a les notes.');
          spans.push({start:evidence.start,end:evidence.end}); quantity += BigInt(evidence.quantity);
        });
        if (quantity > BigInt(Number.MAX_SAFE_INTEGER)) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'La quantitat supera el límit admès.');
        quantities.set(item.garmentCode, Number(quantity));
      });
      if (recognised.length !== quantities.size || recognised.some((pick) => quantities.get(pick.rule.garmentCode) !== pick.quantity)) fail('AI_CANDIDATE_INVALID', 'candidate.items', 'La proposta no coincideix amb totes les quantitats de les notes.');
      // The existing deterministic handler owns tariffs, tax and totals. AI never supplies prices.
      return HANDLERS.DRAFT_QUOTE(s, c);
    },
    UPDATE_QUOTE(s, c) {
      need(c, 'id');
      expectRevision(c, 'expectedQuoteRevision');
      if (!TARIFF_CODES.includes(c.tariff)) fail('VALIDATION_ERROR', 'tariff', 'La tarifa ha de ser A, B o C.');
      if (!Array.isArray(c.lines)) fail('VALIDATION_ERROR', 'lines', 'Les línies no són vàlides.');
      const q = getOrFail(s, 'quotes', c.id, 'id', 'No s\'ha trobat el pressupost.');
      if (q.status !== 'draft') fail('INVALID_TRANSITION', 'id', 'Només es poden editar pressupostos en esborrany.');
      if (c.expectedQuoteRevision !== q.revision) fail('STALE_REVIEW', 'expectedQuoteRevision', 'El pressupost ha canviat; torna a carregar-lo.');
      const seen = new Set();
      c.lines.forEach((l, i) => {
        if (!isObj(l) || typeof l.id !== 'string') fail('VALIDATION_ERROR', 'lines[' + i + '].id', 'Línia no vàlida.');
        if (seen.has(l.id)) fail('DUPLICATE_REFERENCE', 'lines[' + i + '].id', 'Línia repetida.');
        seen.add(l.id);
        if (!q.lines.some((x) => x.id === l.id)) fail('NOT_FOUND', 'lines[' + i + '].id', 'La línia no pertany al pressupost.');
        if (!isQty(l.quantity)) fail('VALIDATION_ERROR', 'lines[' + i + '].quantity', 'La quantitat ha de ser un enter positiu.');
        if (l.unitPriceCents !== null && !isMoney(l.unitPriceCents)) fail('VALIDATION_ERROR', 'lines[' + i + '].unitPriceCents', 'L\'import ha de ser un enter no negatiu en cèntims.');
      });
      if (seen.size !== q.lines.length) fail('VALIDATION_ERROR', 'lines', 'Cal indicar totes les línies del pressupost.');
      const tariff = tariffByCode(s, c.tariff);
      const lines = q.lines.map((old) => {
        const upd = c.lines.find((l) => l.id === old.id);
        return { ...old, quantity: upd.quantity,
          unitPriceCents: upd.unitPriceCents === null ? bandPrice(tariff, upd.quantity) : upd.unitPriceCents,
          priceMode: upd.unitPriceCents === null ? 'tariff' : 'manual' };
      });
      q.tariff = c.tariff;
      q.lines = lines;
      q.totals = quoteTotals(s, lines);
      q.revision += 1;
      q.reviewedRevision = null;
      return q;
    },
    REVIEW_QUOTE(s, c) {
      need(c, 'id');
      expectRevision(c, 'expectedQuoteRevision');
      const q = getOrFail(s, 'quotes', c.id, 'id', 'No s\'ha trobat el pressupost.');
      if (q.status !== 'draft') fail('INVALID_TRANSITION', 'id', 'Només es poden revisar pressupostos en esborrany.');
      if (c.expectedQuoteRevision !== q.revision) fail('STALE_REVIEW', 'expectedQuoteRevision', 'El pressupost ha canviat; torna a carregar-lo.');
      q.reviewedRevision = q.revision;
      return q;
    },
    APPROVE_QUOTE(s, c) {
      need(c, 'id');
      expectRevision(c, 'expectedQuoteRevision');
      const q = getOrFail(s, 'quotes', c.id, 'id', 'No s\'ha trobat el pressupost.');
      if (q.status !== 'draft') fail('INVALID_TRANSITION', 'id', 'Només es poden aprovar pressupostos en esborrany.');
      if (c.expectedQuoteRevision !== q.revision) fail('STALE_REVIEW', 'expectedQuoteRevision', 'El pressupost ha canviat; torna a carregar-lo.');
      if (q.reviewedRevision !== q.revision) fail('REVIEW_REQUIRED', 'id', 'Cal una revisió humana vigent abans d\'aprovar.');
      q.status = 'approved';
      return q;
    },
    SEND_QUOTE(s, c, options) {
      need(c, 'id');
      const q = getOrFail(s, 'quotes', c.id, 'id', 'No s\'ha trobat el pressupost.');
      if (q.status !== 'approved') fail('INVALID_TRANSITION', 'id', 'Només es poden enviar (simulat) pressupostos aprovats.');
      q.status = 'sent_simulated';
      const at = stamp(options);
      workflow(s).quoteEvents.push({id:nextId(s,'qev','quoteEvents'),quoteId:q.id,clientId:q.clientId,kind:'sent_simulated',occurredOn:at.slice(0,10),createdAt:at,note:''});
      return q;
    },
    CREATE_DELIVERY_NOTE(s, c) {
      need(c, 'quoteId', 'Selecciona un pressupost.');
      if (!Array.isArray(c.lines) || c.lines.length === 0) fail('VALIDATION_ERROR', 'lines', 'Selecciona almenys una línia.');
      c.lines.forEach((l, i) => {
        if (!isObj(l) || typeof l.quoteLineId !== 'string' || l.quoteLineId === '') fail('VALIDATION_ERROR', 'lines[' + i + '].quoteLineId', 'Línia no vàlida.');
      });
      const q = getOrFail(s, 'quotes', c.quoteId, 'quoteId', 'No s\'ha trobat el pressupost.');
      if (q.status === 'draft') fail('INVALID_TRANSITION', 'quoteId', 'El pressupost ha d\'estar aprovat.');
      if (new Set(c.lines.map((l) => l.quoteLineId)).size !== c.lines.length) fail('DUPLICATE_REFERENCE', 'lines', 'Hi ha línies repetides.');
      c.lines.forEach((l, i) => {
        if (!q.lines.some((x) => x.id === l.quoteLineId)) fail('NOT_FOUND', 'lines[' + i + '].quoteLineId', 'La línia no pertany al pressupost.');
        if (!isQty(l.quantity)) fail('VALIDATION_ERROR', 'lines[' + i + '].quantity', 'La quantitat ha de ser un enter positiu.');
        const reserved = s.deliveryNotes.filter(d => d.quoteId === q.id).flatMap(d => d.lines).filter(x => x.id === l.quoteLineId).reduce((n,x) => n + BigInt(x.quantity), 0n);
        if (reserved + BigInt(l.quantity) > BigInt(q.lines.find(x => x.id === l.quoteLineId).quantity)) fail('QUANTITY_EXCEEDED','lines[' + i + '].quantity','La quantitat supera el pendent del pressupost.');
      });
      const lines = c.lines.map((l) => ({ ...q.lines.find((x) => x.id === l.quoteLineId), quantity: l.quantity }));
      const dn = {
        id: nextId(s, 'alb', 'deliveryNotes'), number: nextNumber(s, 'deliveryNotes', 'ALB'), clientId: q.clientId, quoteId: q.id,
        createdOn: s.scenarioDate, status: 'workshop', lines, taxRateBps: s.catalog.taxRateBps, totals: quoteTotals(s, lines)
      };
      s.deliveryNotes.push(dn);
      return dn;
    },
    SET_DELIVERY_STATUS(s, c) {
      need(c, 'id');
      if (c.status !== 'ready' && c.status !== 'delivered') fail('VALIDATION_ERROR', 'status', 'L\'estat ha de ser llest o entregat.');
      const d = getOrFail(s, 'deliveryNotes', c.id, 'id', 'No s\'ha trobat l\'albarà.');
      const next = { workshop: 'ready', ready: 'delivered' }[d.status];
      if (next !== c.status) fail('INVALID_TRANSITION', 'status', 'Transició d\'estat no permesa.');
      d.status = c.status;
      return d;
    },
    CREATE_INVOICE(s, c, options) {
      if (!Array.isArray(c.deliveryNoteIds) || c.deliveryNoteIds.length === 0) fail('VALIDATION_ERROR', 'deliveryNoteIds', 'Selecciona almenys un albarà.');
      if (typeof c.reviewed !== 'boolean') fail('VALIDATION_ERROR', 'reviewed', 'La revisió ha de ser true o false.');
      if (!isInt0(c.expectedRevision)) fail('VALIDATION_ERROR', 'expectedRevision', 'La revisió esperada no és vàlida.');
      const dns = selectDeliveryNotes(s, c.deliveryNoteIds);
      if (c.reviewed !== true) fail('REVIEW_REQUIRED', 'reviewed', 'Cal revisar la factura abans de crear-la.');
      if (c.expectedRevision !== s.revision) fail('STALE_REVIEW', 'expectedRevision', 'Les dades han canviat des de la previsualització.');
      const lines = invoiceLinesOf(dns);
      const invoice = {
        id: nextId(s, 'fac', 'invoices'), number: nextNumber(s, 'invoices', 'FAC'), clientId: dns[0].clientId, createdOn: s.scenarioDate,
        deliveryNoteIds: dns.map((d) => d.id), lines, taxRateBps: s.catalog.taxRateBps, totals: quoteTotals(s, lines),
        reviewedAtRevision: c.expectedRevision, paymentStatus: 'pending'
      };
      if (options?.now) {workflow(s);invoice.createdOn = stamp(options).slice(0,10);invoice.dueDate = addDays(invoice.createdOn, profile(s,invoice.clientId).paymentTermDays);}
      s.invoices.push(invoice);
      billingTotals(s.invoices);
      return invoice;
    },
    MARK_INVOICE_PAID(s, c, options) {
      need(c, 'id');
      const inv = getOrFail(s, 'invoices', c.id, 'id', 'No s\'ha trobat la factura.');
      if (inv.paymentStatus !== 'pending') fail('INVALID_TRANSITION', 'id', 'La factura ja està cobrada (simulat).');
      if (s.workflow) {
        const amountCents = balance(s,'invoice',inv.id).outstandingCents;
        if (amountCents===0) {inv.paymentStatus='paid_simulated';return inv;}
        HANDLERS.RECORD_RECEIPT(s,{targetType:'invoice',targetId:inv.id,amountCents,receivedOn:stamp(options).slice(0,10),reference:'manual-'+inv.id,reviewed:true},options);
      } else inv.paymentStatus = 'paid_simulated';
      return inv;
    },
    CREATE_TASK(s, c, options) {
      need(c, 'clientId', 'Selecciona un client.');
      if (typeof c.text !== 'string' || c.text.trim() === '') fail('VALIDATION_ERROR', 'text', 'El text és obligatori.');
      if (c.text.trim().length > TASK_MAX_LENGTH) fail('VALIDATION_ERROR', 'text', 'El text no pot superar els ' + TASK_MAX_LENGTH + ' caràcters.');
      if (!isDate(c.dueDate)) fail('VALIDATION_ERROR', 'dueDate', 'La data no és vàlida (AAAA-MM-DD).');
      getOrFail(s, 'clients', c.clientId, 'clientId', 'No s\'ha trobat el client.');
      const task = { id: nextId(s, 'tsk', 'tasks'), clientId: c.clientId, createdOn: s.scenarioDate, text: c.text.trim(), dueDate: c.dueDate, status: 'pending' };
      s.tasks.push(task);
      if (c.sourceRefs !== undefined) HANDLERS.ADD_CLIENT_NOTE(s,{clientId:c.clientId,kind:'note',text:c.text,dueDate:c.dueDate,sourceRefs:c.sourceRefs},options);
      return task;
    },
    COMPLETE_TASK(s, c) {
      need(c, 'id');
      const t = getOrFail(s, 'tasks', c.id, 'id', 'No s\'ha trobat la tasca.');
      if (t.status !== 'pending') fail('INVALID_TRANSITION', 'id', 'La tasca ja està completada.');
      t.status = 'completed';
      return t;
    }
  };

  // ---------- Reviewed workflows (optional; legacy snapshots are unchanged) ----------
  const WORKFLOW_COLLECTIONS = ['clientNotes','meetings','attachments','workshopEntries','purchases','billingProfiles','proformas','receipts','creditAllocations','quoteEvents'];
  function workflow(s) {
    if (!s.workflow) s.workflow = Object.fromEntries([['version',1],...WORKFLOW_COLLECTIONS.map(k=>[k,[]])]);
    return s.workflow;
  }
  function stamp(options) {
    const value = options?.now ? options.now() : new Date().toISOString();
    if (typeof value !== 'string' || !validStamp(value)) fail('VALIDATION_ERROR','createdAt','El rellotge del servidor no és vàlid.');
    return value;
  }
  function validStamp(value) {return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;}
  function addDays(day,days) {const d = new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function profile(s,clientId) {return s.workflow?.billingProfiles.find(p=>p.clientId===clientId) || {clientId,isNewClient:true,paymentTermDays:0,depositBps:5000};}
  function textValue(v,field,max=2000) {if (!isStr(v) || v.trim().length>max) fail('VALIDATION_ERROR',field,'Escriu un text vàlid, dins del límit indicat.');return v.trim();}
  function dateValue(v,field,nullable=false) {if (nullable && (v===undefined || v===null || v==='')) return null;if (!isDate(v)) fail('VALIDATION_ERROR',field,'Indica una data vàlida.');return v;}
  function clientCheck(s,id) {return getOrFail(s,'clients',id,'clientId','No s’ha trobat el client.');}
  function wfGet(s,col,id) {const e=s.workflow?.[col].find(x=>x.id===id);if (!e) fail('NOT_FOUND','id','No s’ha trobat el registre.');return e;}
  const refCollections = {...COLLECTIONS,clientNote:'clientNotes',meeting:'meetings',workshopEntry:'workshopEntries',purchase:'purchases',proforma:'proformas'};
  function refsFor(s,refs,clientId) {
    if (!Array.isArray(refs) || refs.length>20) fail('VALIDATION_ERROR','sourceRefs','Selecciona fonts vàlides.');
    const seen=new Set();
    return refs.map(r=>{
      if (!isObj(r) || Object.keys(r).sort().join(',')!=='entityType,id' || !refCollections[r.entityType]) fail('VALIDATION_ERROR','sourceRefs','Font no vàlida.');
      const list=s[refCollections[r.entityType]] || s.workflow?.[refCollections[r.entityType]] || [];
      const e=list.find(x=>x.id===r.id),key=r.entityType+':'+r.id;
      if (!e || (r.entityType==='client'?e.id:e.clientId)!==clientId || seen.has(key)) fail('CLIENT_MISMATCH','sourceRefs','La font no pertany al client o està repetida.');
      seen.add(key);return {entityType:r.entityType,id:r.id};
    });
  }
  function attachmentIds(s,ids=[]) {
    if (!Array.isArray(ids) || ids.length>5 || new Set(ids).size!==ids.length || ids.some(id=>typeof id!=='string' || !s.workflow?.attachments.some(a=>a.id===id))) fail('VALIDATION_ERROR','attachmentIds','Selecciona fins a cinc adjunts propis vàlids.');
    return ids.slice();
  }
  function reviewed(c) {if (c.reviewed!==true) fail('REVIEW_REQUIRED','reviewed','Cal una revisió humana explícita.');}
  function revisionCheck(s,c) {if (c.expectedRevision!==undefined && c.expectedRevision!==s.revision) fail('STALE_REVIEW','expectedRevision','Les dades han canviat.');}
  function purchaseLine(p) {return {id:p.id,garmentCode:'PUR',label:p.description,fabricId:null,quantity:p.quantity,unitPriceCents:p.unitCostCents,priceMode:'manual'};}
  function sumCents(rows) {const n=rows.reduce((v,r)=>v+BigInt(r.amountCents),0n);if (n>BigInt(Number.MAX_SAFE_INTEGER)) fail('VALIDATION_ERROR','amountCents','L’import acumulat supera el límit.');return Number(n);}
  function balance(s,targetType,targetId) {
    if (!['invoice','proforma'].includes(targetType)) fail('VALIDATION_ERROR','targetType','Tipus de registre no vàlid.');
    const target=targetType==='invoice'?getOrFail(s,'invoices',targetId,'targetId','Factura no disponible.'):wfGet(s,'proformas',targetId);
    const receipts=(s.workflow?.receipts || []).filter(r=>r.targetType===targetType&&r.targetId===targetId);
    const credits=(s.workflow?.creditAllocations || []).filter(r=>targetType==='invoice'?r.invoiceId===targetId:r.proformaId===targetId);
    const totalCents=targetType==='invoice'?target.totals.totalCents:target.amountCents;
    const historical=targetType==='invoice'&&target.paymentStatus==='paid_simulated'&&target.origin!=='purchase'&&!has(target,'dueDate')&&!receipts.length&&!credits.length;
    const receivedCents=historical?totalCents:sumCents(receipts), allocatedCents=targetType==='proforma'?sumCents(credits):0,creditCents=targetType==='invoice'?sumCents(credits):0;
    return {totalCents,receivedCents,creditCents,allocatedCents,outstandingCents:totalCents-receivedCents-creditCents,availableCreditCents:targetType==='proforma'?receivedCents-allocatedCents:0};
  }
  function manualLines(s,raw,id,existing=[]) {
    if (!Array.isArray(raw) || !raw.length || raw.length>100) fail('VALIDATION_ERROR','lines','Indica entre una i cent línies.');
    const used=new Set();
    return raw.map((l,i)=>{
      if (!isObj(l) || Object.keys(l).some(k=>!['id','garmentCode','label','fabricId','quantity','unitPriceCents'].includes(k))) fail('VALIDATION_ERROR','lines','Línia no vàlida.');
      if (l.id!==undefined && (!existing.some(x=>x.id===l.id)||used.has(l.id))) fail('VALIDATION_ERROR','lines','Referència de línia no vàlida.');
      if (!isQty(l.quantity) || (l.unitPriceCents!==null&&!isMoney(l.unitPriceCents)) || (l.fabricId!==null&&!s.fabrics.some(f=>f.id===l.fabricId))) fail('VALIDATION_ERROR','lines','Revisa quantitat, preu i teixit.');
      const lineId=l.id || id+'-l'+(++s.sequence);used.add(lineId);
      return {id:lineId,garmentCode:textValue(l.garmentCode,'garmentCode',20),label:textValue(l.label,'label',200),fabricId:l.fabricId,quantity:l.quantity,unitPriceCents:l.unitPriceCents,priceMode:l.unitPriceCents===null?'tariff':'manual'};
    });
  }
  function checkWorkflow(s) {
    const w=exact(s.workflow,['version',...WORKFLOW_COLLECTIONS],'workflow');if (w.version!==1) bad('workflow.version');
    for (const col of WORKFLOW_COLLECTIONS) {arr(w[col],'workflow.'+col);if (w[col].length>10000) bad('workflow.'+col);if (col!=='billingProfiles') uniqueIds(w[col],'workflow.'+col);}
    const check=(e,keys,col)=>exact(e,keys,'workflow.'+col);
    const client=e=>{if (!s.clients.some(c=>c.id===e.clientId)) bad('workflow.clientId');};
    const txt=(v,max=2000)=>{if (!isStr(v)||v.length>max) bad('workflow.text');};
    const at=e=>{if (!validStamp(e.createdAt)) bad('workflow.createdAt');};
    let bytes=0;
    w.attachments.forEach(e=>{check(e,['id','filename','mimeType','sizeBytes','sha256','createdAt'],'attachments');at(e);txt(e.filename,120);if (/[/\\\x00-\x1f\x7f]/.test(e.filename)||!['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/mp4','audio/ogg','audio/wav'].includes(e.mimeType)||!isQty(e.sizeBytes)||e.sizeBytes>1048576||typeof e.sha256!=='string'||!/^([a-f0-9]{64})$/.test(e.sha256)) bad('workflow.attachments');bytes+=e.sizeBytes;});
    if (bytes>20971520) bad('workflow.attachments');
    w.clientNotes.forEach(e=>{check(e,['id','clientId','kind','text','occurredOn','dueDate','attachmentIds','sourceRefs','createdAt'],'clientNotes');client(e);at(e);txt(e.text);if (!['note','change','fitting','delivery'].includes(e.kind)) bad('workflow.kind');dateValue(e.occurredOn,'occurredOn',true);dateValue(e.dueDate,'dueDate',true);attachmentIds(s,e.attachmentIds);refsFor(s,e.sourceRefs,e.clientId);});
    const linkedQuotes=new Set();
    w.meetings.forEach(e=>{check(e,['id','clientId','notes','summary','attachmentIds','createdAt','quoteIds'],'meetings');client(e);at(e);txt(e.notes);txt(e.summary);attachmentIds(s,e.attachmentIds);if (!Array.isArray(e.quoteIds)) bad('workflow.meetings.quoteIds');for (const id of e.quoteIds) {if (linkedQuotes.has(id)||!s.quotes.some(q=>q.id===id&&q.clientId===e.clientId)) bad('workflow.meetings.quoteIds');linkedQuotes.add(id);}});
    w.workshopEntries.forEach(e=>{check(e,['id','clientId','deliveryNoteId','workshopName','text','dueDate','status','createdAt','deliveredAt','deliveredOn','attachmentIds'],'workshopEntries');client(e);at(e);txt(e.workshopName,120);txt(e.text);dateValue(e.dueDate,'dueDate');attachmentIds(s,e.attachmentIds);if (e.deliveryNoteId!==null&&!s.deliveryNotes.some(d=>d.id===e.deliveryNoteId&&d.clientId===e.clientId)) bad('workflow.deliveryNoteId');if (!['pending','delivered'].includes(e.status) || (e.status==='pending'?(e.deliveredAt!==null||e.deliveredOn!==null):(!validStamp(e.deliveredAt)||!isDate(e.deliveredOn)))) bad('workflow.workshopEntries.status');});
    const purchases=new Set();
    w.purchases.forEach(e=>{check(e,['id','clientId','supplierName','reference','purchasedOn','description','quantity','unitCostCents','taxRateBps','dueDate','attachmentIds','totals','invoiceId','paymentStatus','paidOn','paymentReference','createdAt'],'purchases');client(e);at(e);txt(e.supplierName,120);txt(e.reference,120);txt(e.description,500);dateValue(e.purchasedOn,'purchasedOn');dateValue(e.dueDate,'dueDate',true);attachmentIds(s,e.attachmentIds);const ref=normName(e.supplierName)+'/'+normName(e.reference)+'/'+e.clientId;if (purchases.has(ref)) bad('workflow.purchases.reference');purchases.add(ref);if (!isQty(e.quantity)||!isMoney(e.unitCostCents)||!isInt0(e.taxRateBps)||e.taxRateBps>10000) bad('workflow.purchases.amount');const totals=totalsOf([purchaseLine(e)],e.taxRateBps);exact(e.totals,['baseCents','taxCents','totalCents'],'workflow.purchases.totals');for (const k of Object.keys(totals)) if (e.totals[k]!==totals[k]) bad('workflow.purchases.totals');const inv=s.invoices.find(i=>i.origin==='purchase'&&i.purchaseIds.includes(e.id));if (e.invoiceId!==null ? !inv||inv.id!==e.invoiceId : !!inv) bad('workflow.purchases.invoiceId');if (!['pending','paid_recorded'].includes(e.paymentStatus)||(e.paymentStatus==='pending'?(e.paidOn!==null||e.paymentReference!==null):(!isDate(e.paidOn)||!isStr(e.paymentReference)))) bad('workflow.purchases.paymentStatus');});
    const profiles=new Set();w.billingProfiles.forEach(e=>{check(e,['clientId','isNewClient','paymentTermDays','depositBps','updatedAt'],'billingProfiles');client(e);if (profiles.has(e.clientId)||typeof e.isNewClient!=='boolean'||!isInt0(e.paymentTermDays)||e.paymentTermDays>365||!isInt0(e.depositBps)||e.depositBps>10000||!validStamp(e.updatedAt)) bad('workflow.billingProfiles');profiles.add(e.clientId);});
    const proQuotes=new Set(),proNumbers=new Set();w.proformas.forEach(e=>{check(e,['id','number','quoteId','clientId','amountCents','depositBps','quoteTotalCents','createdOn','dueDate','createdAt'],'proformas');client(e);at(e);dateValue(e.createdOn,'createdOn');dateValue(e.dueDate,'dueDate');txt(e.number,80);const q=s.quotes.find(q=>q.id===e.quoteId&&q.clientId===e.clientId&&q.status!=='draft');if (!q||proQuotes.has(e.quoteId)||proNumbers.has(e.number)||!isQty(e.depositBps)||e.depositBps>10000||q.totals.totalCents!==e.quoteTotalCents||e.amountCents!==Number((BigInt(e.quoteTotalCents)*BigInt(e.depositBps)+5000n)/10000n)||!isQty(e.amountCents)) bad('workflow.proformas');proQuotes.add(e.quoteId);proNumbers.add(e.number);});
    const receiptRefs=new Set();w.receipts.forEach(e=>{check(e,['id','targetType','targetId','clientId','amountCents','receivedOn','reference','createdAt'],'receipts');client(e);at(e);dateValue(e.receivedOn,'receivedOn');txt(e.reference,120);const target=e.targetType==='invoice'?s.invoices.find(i=>i.id===e.targetId):e.targetType==='proforma'?w.proformas.find(i=>i.id===e.targetId):null;const ref=e.clientId+'/'+normName(e.reference);if (!target||target.clientId!==e.clientId||!isQty(e.amountCents)||receiptRefs.has(ref)) bad('workflow.receipts');receiptRefs.add(ref);});
    w.creditAllocations.forEach(e=>{check(e,['id','proformaId','invoiceId','clientId','amountCents','createdAt'],'creditAllocations');client(e);at(e);const pro=w.proformas.find(p=>p.id===e.proformaId&&p.clientId===e.clientId),inv=s.invoices.find(i=>i.id===e.invoiceId&&i.clientId===e.clientId);if (!pro||!inv||inv.origin==='purchase'||!isQty(e.amountCents)||inv.deliveryNoteIds.some(id=>s.deliveryNotes.find(d=>d.id===id)?.quoteId!==pro.quoteId)) bad('workflow.creditAllocations');});
    for (const p of w.proformas) {const b=balance(s,'proforma',p.id);if (b.outstandingCents<0||b.availableCreditCents<0) bad('workflow.receipts');}
    for (const i of s.invoices) {const b=balance(s,'invoice',i.id);if (b.outstandingCents<0 || (i.paymentStatus==='paid_simulated'&&b.outstandingCents!==0)) bad('workflow.receipts');}
    const sent=new Set(),response=new Set();w.quoteEvents.forEach(e=>{check(e,['id','quoteId','clientId','kind','occurredOn','createdAt','note'],'quoteEvents');client(e);at(e);dateValue(e.occurredOn,'occurredOn');if (typeof e.note!=='string'||e.note.length>500||!s.quotes.some(q=>q.id===e.quoteId&&q.clientId===e.clientId)||!['sent_simulated','response_recorded'].includes(e.kind)) bad('workflow.quoteEvents');const seen=e.kind==='sent_simulated'?sent:response;if (seen.has(e.quoteId)) bad('workflow.quoteEvents');seen.add(e.quoteId);});
  }
  Object.assign(HANDLERS,{
    ADD_CLIENT_NOTE(s,c,o) {clientCheck(s,c.clientId);const e={id:nextId(s,'not','clientNotes'),clientId:c.clientId,kind:c.kind,text:textValue(c.text,'text'),occurredOn:dateValue(c.occurredOn,'occurredOn',true),dueDate:dateValue(c.dueDate,'dueDate',true),attachmentIds:attachmentIds(s,c.attachmentIds),sourceRefs:refsFor(s,c.sourceRefs||[],c.clientId),createdAt:stamp(o)};if (!['note','change','fitting','delivery'].includes(e.kind)) fail('VALIDATION_ERROR','kind','Tipus de nota no vàlid.');workflow(s).clientNotes.push(e);return e;},
    RECORD_MEETING(s,c,o) {clientCheck(s,c.clientId);const e={id:nextId(s,'reu','meetings'),clientId:c.clientId,notes:textValue(c.notes,'notes'),summary:textValue(c.summary,'summary'),attachmentIds:attachmentIds(s,c.attachmentIds),createdAt:stamp(o),quoteIds:[]};workflow(s).meetings.push(e);return e;},
    DRAFT_QUOTE_MANUAL(s,c,o) {
      clientCheck(s,c.clientId);if(c.humanReviewed!==true) fail('REVIEW_REQUIRED','humanReviewed','Revisa les línies abans de crear el pressupost.');if(!TARIFF_CODES.includes(c.tariff)) fail('VALIDATION_ERROR','tariff','Selecciona A, B o C.');
      const meeting=c.meetingId?wfGet(s,'meetings',c.meetingId):null;if(meeting&&meeting.clientId!==c.clientId) fail('CLIENT_MISMATCH','meetingId','La reunió és d’un altre client.');
      const id=nextId(s,'pre','quotes'),lines=manualLines(s,c.lines,id);for (const l of lines) if(l.priceMode==='tariff') l.unitPriceCents=bandPrice(tariffByCode(s,c.tariff),l.quantity);
      const q={id,number:nextNumber(s,'quotes','PRE'),clientId:c.clientId,createdOn:stamp(o).slice(0,10),notes:meeting?meeting.notes:'Pressupost manual revisat.',tariff:c.tariff,status:'draft',revision:1,reviewedRevision:null,lines,taxRateBps:s.catalog.taxRateBps,totals:quoteTotals(s,lines)};
      workflow(s);s.quotes.push(q);if(meeting)meeting.quoteIds.push(id);return q;
    },
    UPDATE_QUOTE_LINES(s,c) {const q=getOrFail(s,'quotes',c.id,'id','Pressupost no disponible.');if(q.status!=='draft')fail('INVALID_TRANSITION','id','Només es poden editar esborranys.');if(c.expectedQuoteRevision!==undefined&&c.expectedQuoteRevision!==q.revision)fail('STALE_REVIEW','expectedQuoteRevision','El pressupost ha canviat.');if(c.tariff!==undefined){if(!TARIFF_CODES.includes(c.tariff))fail('VALIDATION_ERROR','tariff','Selecciona A, B o C.');q.tariff=c.tariff;}const lines=manualLines(s,c.lines,q.id,q.lines);for(const l of lines)if(l.priceMode==='tariff')l.unitPriceCents=bandPrice(tariffByCode(s,q.tariff),l.quantity);q.lines=lines;q.totals=quoteTotals(s,lines);q.revision++;q.reviewedRevision=null;return q;},
    CREATE_PURCHASE(s,c,o) {clientCheck(s,c.clientId);const e={id:nextId(s,'cmp','purchases'),clientId:c.clientId,supplierName:textValue(c.supplierName,'supplierName',120),reference:textValue(c.reference,'reference',120),purchasedOn:dateValue(c.purchasedOn,'purchasedOn'),description:textValue(c.description,'description',500),quantity:c.quantity,unitCostCents:c.unitCostCents,taxRateBps:c.taxRateBps,dueDate:dateValue(c.dueDate,'dueDate',true),attachmentIds:attachmentIds(s,c.attachmentIds),invoiceId:null,paymentStatus:'pending',paidOn:null,paymentReference:null,createdAt:stamp(o)};if(!isQty(e.quantity)||!isMoney(e.unitCostCents)||!isInt0(e.taxRateBps)||e.taxRateBps>10000)fail('VALIDATION_ERROR','quantity','Revisa els imports de la compra.');const w=workflow(s);if(w.purchases.some(p=>p.clientId===e.clientId&&normName(p.supplierName)===normName(e.supplierName)&&normName(p.reference)===normName(e.reference)))fail('DUPLICATE_PURCHASE','reference','Aquest registre de proveïdor ja està registrat.');e.totals=totalsOf([purchaseLine(e)],e.taxRateBps);w.purchases.push(e);return e;},
    CREATE_REBILL_INVOICE(s,c,o) {reviewed(c);revisionCheck(s,c);if(!Array.isArray(c.purchaseIds)||!c.purchaseIds.length||new Set(c.purchaseIds).size!==c.purchaseIds.length)fail('VALIDATION_ERROR','purchaseIds','Selecciona compres úniques.');const ps=c.purchaseIds.map(id=>wfGet(s,'purchases',id));if(ps.some(p=>p.invoiceId!==null))fail('ALREADY_INVOICED','purchaseIds','Una compra ja està refacturada.');if(ps.some(p=>p.clientId!==ps[0].clientId||p.taxRateBps!==ps[0].taxRateBps))fail('CLIENT_MISMATCH','purchaseIds','Les compres han de compartir client i impost.');const day=stamp(o).slice(0,10),lines=ps.map(purchaseLine),i={id:nextId(s,'fac','invoices'),number:nextNumber(s,'invoices','FAC'),clientId:ps[0].clientId,createdOn:day,dueDate:addDays(day,profile(s,ps[0].clientId).paymentTermDays),deliveryNoteIds:[],origin:'purchase',purchaseIds:ps.map(p=>p.id),lines,taxRateBps:ps[0].taxRateBps,totals:totalsOf(lines,ps[0].taxRateBps),reviewedAtRevision:s.revision,paymentStatus:'pending'};ps.forEach(p=>{p.invoiceId=i.id;});s.invoices.push(i);billingTotals(s.invoices);return i;},
    MARK_PURCHASE_PAID(s,c,o) {reviewed(c);const p=wfGet(s,'purchases',c.id);if(p.paymentStatus!=='pending')fail('INVALID_TRANSITION','id','La compra ja té el pagament registrat.');p.paidOn=dateValue(c.paidOn,'paidOn');p.paymentReference=textValue(c.reference,'reference',120);p.paymentStatus='paid_recorded';stamp(o);return p;},
    SET_CLIENT_BILLING_PROFILE(s,c,o) {clientCheck(s,c.clientId);if(typeof c.isNewClient!=='boolean'||!isInt0(c.paymentTermDays)||c.paymentTermDays>365||!isInt0(c.depositBps)||c.depositBps>10000)fail('VALIDATION_ERROR','depositBps','Revisa les condicions del client.');const w=workflow(s),p={clientId:c.clientId,isNewClient:c.isNewClient,paymentTermDays:c.paymentTermDays,depositBps:c.depositBps,updatedAt:stamp(o)},i=w.billingProfiles.findIndex(x=>x.clientId===c.clientId);if(i<0)w.billingProfiles.push(p);else w.billingProfiles[i]=p;return p;},
    CREATE_PROFORMA(s,c,o) {reviewed(c);revisionCheck(s,c);const q=getOrFail(s,'quotes',c.quoteId,'quoteId','Pressupost no disponible.');if(q.status==='draft')fail('INVALID_TRANSITION','quoteId','Aprova el pressupost abans de preparar la proforma.');const w=workflow(s);if(w.proformas.some(p=>p.quoteId===q.id))fail('DUPLICATE_REFERENCE','quoteId','Aquest pressupost ja té proforma.');const bp=profile(s,q.clientId),amount=Number((BigInt(q.totals.totalCents)*BigInt(bp.depositBps)+5000n)/10000n);if(!isQty(amount))fail('VALIDATION_ERROR','depositBps','L’anticipo ha de ser positiu.');const at=stamp(o),p={id:nextId(s,'pro','proformas'),number:'PRO-2026-'+pad4(w.proformas.length+1),quoteId:q.id,clientId:q.clientId,amountCents:amount,depositBps:bp.depositBps,quoteTotalCents:q.totals.totalCents,createdOn:at.slice(0,10),dueDate:addDays(at.slice(0,10),bp.paymentTermDays),createdAt:at};w.proformas.push(p);return p;},
    RECORD_RECEIPT(s,c,o) {reviewed(c);if(!isQty(c.amountCents))fail('VALIDATION_ERROR','amountCents','Indica un import positiu en cèntims.');const b=balance(s,c.targetType,c.targetId);if(c.amountCents>b.outstandingCents)fail('AMOUNT_EXCEEDED','amountCents','L’import supera el saldo pendent.');const target=c.targetType==='invoice'?s.invoices.find(i=>i.id===c.targetId):wfGet(s,'proformas',c.targetId),w=workflow(s),reference=textValue(c.reference,'reference',120);if(w.receipts.some(r=>r.clientId===target.clientId&&normName(r.reference)===normName(reference)))fail('DUPLICATE_REFERENCE','reference','Aquest rebut ja està registrat.');const r={id:nextId(s,'rec','receipts'),targetType:c.targetType,targetId:c.targetId,clientId:target.clientId,amountCents:c.amountCents,receivedOn:dateValue(c.receivedOn,'receivedOn'),reference,createdAt:stamp(o)};w.receipts.push(r);if(c.targetType==='invoice'&&balance(s,'invoice',target.id).outstandingCents===0)target.paymentStatus='paid_simulated';return r;},
    APPLY_PROFORMA_CREDIT(s,c,o) {reviewed(c);const pro=wfGet(s,'proformas',c.proformaId),inv=getOrFail(s,'invoices',c.invoiceId,'invoiceId','Factura no disponible.');if(pro.clientId!==inv.clientId||inv.origin==='purchase'||inv.deliveryNoteIds.some(id=>s.deliveryNotes.find(d=>d.id===id)?.quoteId!==pro.quoteId))fail('CLIENT_MISMATCH','invoiceId','La factura ha de provenir del mateix client i pressupost.');if(!isQty(c.amountCents)||c.amountCents>balance(s,'proforma',pro.id).availableCreditCents||c.amountCents>balance(s,'invoice',inv.id).outstandingCents)fail('AMOUNT_EXCEEDED','amountCents','L’anticipo disponible o el saldo és insuficient.');const e={id:nextId(s,'cre','creditAllocations'),proformaId:pro.id,invoiceId:inv.id,clientId:inv.clientId,amountCents:c.amountCents,createdAt:stamp(o)};workflow(s).creditAllocations.push(e);if(balance(s,'invoice',inv.id).outstandingCents===0)inv.paymentStatus='paid_simulated';return e;},
    CREATE_WORKSHOP_ENTRY(s,c,o) {clientCheck(s,c.clientId);const d=c.deliveryNoteId?getOrFail(s,'deliveryNotes',c.deliveryNoteId,'deliveryNoteId','Albarà no disponible.'):null;if(d&&d.clientId!==c.clientId)fail('CLIENT_MISMATCH','deliveryNoteId','Albarà d’un altre client.');const e={id:nextId(s,'tal','workshopEntries'),clientId:c.clientId,deliveryNoteId:d?.id||null,workshopName:textValue(c.workshopName,'workshopName',120),text:textValue(c.text,'text'),dueDate:dateValue(c.dueDate,'dueDate'),status:'pending',createdAt:stamp(o),deliveredAt:null,deliveredOn:null,attachmentIds:attachmentIds(s,c.attachmentIds)};workflow(s).workshopEntries.push(e);return e;},
    COMPLETE_WORKSHOP_ENTRY(s,c,o) {const e=wfGet(s,'workshopEntries',c.id);if(e.status!=='pending')fail('INVALID_TRANSITION','id','L’entrega ja està registrada.');e.deliveredAt=stamp(o);e.deliveredOn=dateValue(c.deliveredOn||e.deliveredAt.slice(0,10),'deliveredOn');e.status='delivered';return e;},
    RECORD_QUOTE_RESPONSE(s,c,o) {const q=getOrFail(s,'quotes',c.quoteId,'quoteId','Pressupost no disponible.');const w=workflow(s);if(w.quoteEvents.some(e=>e.quoteId===q.id&&e.kind==='response_recorded'))fail('DUPLICATE_REFERENCE','quoteId','Ja hi ha una resposta registrada.');const e={id:nextId(s,'qev','quoteEvents'),quoteId:q.id,clientId:q.clientId,kind:'response_recorded',occurredOn:dateValue(c.respondedOn,'respondedOn'),createdAt:stamp(o),note:c.note===undefined?'':textValue(c.note,'note',500)};w.quoteEvents.push(e);return e;}
  });

  // ---------- Store ----------
  function createStore(options) {
    const storage = options && options.storage ? options.storage : null;
    const allowRealContacts = options && options.allowRealContacts === true;
    let state = createInitialState();
    let status = { mode: 'persistent', reason: null };
    let writeEnabled = true;
    const goTemporary = (reason) => {
      status = { mode: 'temporary', reason };
      writeEnabled = false;
    };

    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      goTemporary('STORAGE_UNAVAILABLE');
    } else {
      let raw;
      let readable = true;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch (e) {
        readable = false;
        goTemporary('STORAGE_UNAVAILABLE');
      }
      if (readable && raw !== null && raw !== undefined) {
        let parsed;
        let parsedOk = typeof raw === 'string';
        if (parsedOk) {
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsedOk = false;
          }
        }
        if (!parsedOk) goTemporary('STATE_CORRUPT');
        else if (isObj(parsed) && has(parsed, 'schemaVersion') && parsed.schemaVersion !== SCHEMA_VERSION) goTemporary('SCHEMA_UNSUPPORTED');
        else {
          const v = validateState(parsed, {allowRealContacts});
          if (v.ok) state = v.data;
          else goTemporary('STATE_CORRUPT');
        }
      }
    }

    function persist() {
      if (!writeEnabled) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        goTemporary('STORAGE_UNAVAILABLE');
      }
    }

    function dispatch(command) {
      return run(() => {
        if (!isObj(command) || typeof command.type !== 'string') fail('VALIDATION_ERROR', 'type', 'Ordre no vàlida.');
        if (command.type === 'RESET') {
          if (command.confirmed !== true) fail('CONFIRMATION_REQUIRED', 'confirmed', 'Cal confirmar el reinici.');
          state = createInitialState();
          if (!storage) goTemporary('STORAGE_UNAVAILABLE');
          else {
            try {
              storage.setItem(STORAGE_KEY, JSON.stringify(state));
              status = { mode: 'persistent', reason: null };
              writeEnabled = true;
            } catch (e) {
              goTemporary('STORAGE_UNAVAILABLE');
            }
          }
          return clone(state);
        }
        const handler = has(HANDLERS, command.type) ? HANDLERS[command.type] : null;
        if (!handler) fail('VALIDATION_ERROR', 'type', 'Tipus d\'ordre desconegut.');
        const work = clone(state);
        const data = handler(work, command, {allowRealContacts,now:options?.now});
        work.revision += 1;
        const v = validateState(work, {allowRealContacts});
        if (!v.ok) fail('INVALID_STATE', v.error.field, v.error.message);
        state = v.data;
        persist();
        return clone(data);
      });
    }

    return {
      getState: () => clone(state),
      getStorageStatus: () => ({ mode: status.mode, reason: status.reason }),
      query: (request) => run(() => clone(runQuery(state, request))),
      dispatch
    };
  }

  return { SCHEMA_VERSION, STORAGE_KEY, createInitialState, validateState, calculateTotals, createStore };
});
