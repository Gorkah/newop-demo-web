/* NEW OP · Interfície del taller. Les escriptures i la persistència pertanyen al servidor. */
(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Separar euros y céntimos antes de formatear evita redondear precios válidos.
  const moneyFormat = new Intl.NumberFormat('ca-ES', {style:'currency', currency:'EUR'});
  const money = value => {
    const amount = BigInt(value);
    return moneyFormat.formatToParts(amount / 100n).map(part => part.type === 'fraction' ? String(amount % 100n).padStart(2,'0') : part.value).join('');
  };
  const decimalMoney = value => {
    const amount = BigInt(value);
    return String(amount / 100n) + '.' + String(amount % 100n).padStart(2,'0');
  };
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : String(value || '');
  const path = (module, id) => '#/' + module + (id ? '/' + encodeURIComponent(id) : '');
  const safeHash = hash => /^#\/(clients|pressupostos|albarans|facturacio|seguiment|teixits)\/[^/]+$/.test(hash || '') ? hash : '#/inici';
  const iconPaths = {
    folder:'M3 6h7l2 2h9v11H3z',
    home:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
    quote:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5',
    delivery:'M3 6h12v12H3zM15 10h4l3 4v4h-7M5 6V3h8v3M7 18v3M18 18v3',
    invoice:'M5 3h14v18l-3-2-4 2-4-2-3 2zM9 8h6M9 12h6M9 16h3',
    calendar:'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
    task:'M9 4h6v3H9zM9 5H5v16h14V5h-4M8 13l2 2 5-5',
    fabric:'m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
    clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8',
    query:'M4 4h16v12H9l-5 4zM8 8h8M8 12h5',
    plus:'M12 5v14M5 12h14', arrow:'M5 12h14M14 7l5 5-5 5', back:'M19 12H5M10 7l-5 5 5 5',
    print:'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z', close:'m6 6 12 12M6 18 18 6',
    check:'m5 12 4 4L19 6', search:'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 6 6'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.quote}"></path></svg>`;
  const modules = [
    ['inici','Inici','home'], ['pressupostos','Pressupostos','quote'], ['albarans','Albarans','delivery'],
    ['facturacio','Facturació','invoice'], ['seguiment','Seguiment','task'], ['calendari','Calendari','calendar'], ['teixits','Teixits','fabric'],
    ['clients','Clients','clients'], ['consultes','Consultes','query']
  ];
  const statusLabels = {draft:'Esborrany',approved:'Aprovat',sent_simulated:'Enviat · simulat',workshop:'Al taller',ready:'A punt',delivered:'Lliurat',pending:'Pendent',completed:'Completada',paid_simulated:'Cobrada · simulat'};
  const badge = status => `<span class="badge ${['approved','delivered','completed','paid_simulated'].includes(status) ? 'green' : ['draft','pending','ready'].includes(status) ? 'amber' : ''}">${escape(statusLabels[status] || status)}</span>`;
  const button = (label, action, id = '', secondary = false, image = '') => `<button type="button" class="button${secondary ? ' secondary' : ''}" data-action="${action}"${id ? ` data-id="${escape(id)}"` : ''}>${image ? icon(image) : ''}${escape(label)}</button>`;
  const link = (module, id, label) => `<a href="${path(module, id)}">${escape(label)}</a>`;
  const empty = (title, text, action = '') => `<div class="empty">${icon('fabric')}<h2>${escape(title)}</h2><p>${escape(text)}</p>${action}</div>`;
  const table = (headings, rows) => `<div class="table-scroll" role="region" aria-label="Taula amb desplaçament horitzontal" tabindex="0"><table><thead><tr>${headings.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const panelHead = (title, subtitle = '', action = '') => `<div class="panel-head"><div><h2>${escape(title)}</h2>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}</div>${action}</div>`;
  const heading = (title, subtitle, action = '', eyebrow = 'ESPAI DE TALLER') => `<div class="page-heading"><div><div class="eyebrow">${escape(eyebrow)}</div><h1 tabindex="-1">${escape(title)}</h1><p>${escape(subtitle)}</p></div>${action ? `<div class="actions">${action}</div>` : ''}</div>`;
  const totals = (value, rate) => `<div class="totals mono"><div><span>Base il·lustrativa</span><span>${money(value.baseCents)}</span></div><div><span>Impost simulat (${new Intl.NumberFormat('ca-ES').format(rate / 100)} %)</span><span>${money(value.taxCents)}</span></div><div class="total"><span>Total demo</span><span>${money(value.totalCents)}</span></div></div>`;
  const field = (name, label, control, help = '') => `<label class="field" for="${name}">${escape(label)}${control}${help ? `<small>${escape(help)}</small>` : ''}<span class="field-error" id="${name}-error"></span></label>`;
  const input = (name, type = 'text', value = '', extra = '') => `<input id="${name}" name="${name}" type="${type}" value="${escape(value)}" aria-describedby="${name}-error" ${extra}>`;
  const select = (name, options, selected = '') => `<select id="${name}" name="${name}" aria-describedby="${name}-error">${options.map(([value,label]) => `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(label)}</option>`).join('')}</select>`;
  const formError = '<div class="form-error" role="alert" tabindex="-1"></div>';
  const formActions = (label, cancel = true) => `<div class="form-actions">${cancel ? button('Cancel·la','dialog-close','',true) : ''}<button class="button" type="submit">${escape(label)}</button></div>`;
  const disclaimer = '<p class="dialog-disclaimer">Dades fictícies · Operacions simulades · Sense validesa fiscal o legal.</p>';

  let store;
  let state;
  let route = {module:'inici',id:null};
  let dialogOpener = null;
  let invoicePreview = null;
  let selectedQuoteId = null;
  let lastAnswer = null;
  let feedbackTimer;
  let ai = null;
  let dialogSerial = 0;
  let jobSeq = 0;
  let quoteProposal = null;
  let lastAiAnswer = null;
  let followup = {draft:null,key:null,refs:[]};
  let opsCache = new Map();
  let prepareKey = '';
  let opBusy = false;
  let commandBusy = false;
  let initialized = false;
  let booting = false;
  let session = null;
  let legacy = null;
  let legacyNotice = null;
  let importPreview = null;
  const jobs = {};
  const overlay = $('#overlay');
  const view = $('#view');

  $('#nav').innerHTML = modules.map(([slug,label,image]) => `<a class="nav-link" href="${path(slug)}" data-module="${slug}">${icon(image)}<span>${label}</span></a>`).join('');
  $('.skip-link').addEventListener('click', event => {event.preventDefault();view.focus();view.scrollIntoView({block:'start'});});

  function fatal(message) {
    view.innerHTML = `<div class="panel">${empty('No s’ha pogut obrir la demo',message,button('Torna a carregar','reload','',true))}</div>`;
    $('#storage-status').innerHTML = '<div class="storage-warning">La demo no està disponible. No s’ha creat cap estat alternatiu.</div>';
  }

  if (!window.NewopDemo || typeof window.NewopDemo.createStore !== 'function') {
    fatal('Falta el motor local demo.js. Cal integrar el fitxer de backend abans d’utilitzar els mòduls.');
    document.addEventListener('click', event => {if (event.target.closest('[data-action="reload"]')) window.location.reload();});
    return;
  }
  try {
    ai = window.NewopAI.createClient();
    store = window.NewopServerStore.createStore({engine:window.NewopDemo,client:ai});
  } catch (_) {
    fatal('Falta el client del servidor. Comprova que ai-client.js i server-store.js estan disponibles.');
    return;
  }

  const clientName = id => state.clients.find(c => c.id === id)?.name || 'Client no disponible';
  const fabricName = id => state.fabrics.find(f => f.id === id)?.name || 'Sense teixit vinculat';
  const clientOptions = selected => select('clientId', [['','Selecciona un client fictici'], ...state.clients.map(c => [c.id,c.name])], selected);
  const tariffOptions = (name, selected) => select(name, state.catalog.tariffs.map(t => [t.code,'Tarifa ' + t.code + ' · il·lustrativa']), selected);
  const requireQuery = request => {const result = store.query(request);if (!result.ok) throw result.error;return result.data;};

  function notify(message, isError = false) {
    clearTimeout(feedbackTimer);
    $('#feedback').innerHTML = `<div class="feedback${isError ? ' error-message' : ''}">${escape(message)}</div>`;
    if (!isError) feedbackTimer = setTimeout(() => {$('#feedback').innerHTML = '';}, 6500);
  }

  function storageStatus() {
    if (!initialized) return;
    const status = store.getStorageStatus();
    const label = status.mode === 'browser' ? 'Demo web · dades en aquest navegador' : status.mode === 'supabase' ? 'Supabase · dades persistents' : 'Servidor local · dades persistents';
    $('.local-label').innerHTML = `<span class="status-dot"></span> ${escape(label)}`;
    const importButton = $('#import-backup-button');
    if (importButton) importButton.hidden = !store.canImport();
    $('#storage-status').innerHTML = legacyNotice ? `<div class="storage-warning">${escape(legacyNotice)} ${legacy && store.canImport() ? button('Revisa la importació','legacy-import','',true) : ''}${legacy ? button('Descarrega la còpia anterior','legacy-backup','',true) : ''}</div>` : '';
  }

  function readLegacy() {
    legacy = null;legacyNotice = null;
    let raw;
    try {raw = window.localStorage.getItem(window.NewopDemo.STORAGE_KEY);} catch (_) {return;}
    if (!raw) return;
    try {
      const checked = window.NewopDemo.validateState(JSON.parse(raw),{allowRealContacts:true});
      if (!checked.ok) throw new Error('invalid');
      legacy = {raw,state:checked.data};
      if (JSON.stringify(checked.data) === JSON.stringify(store.getState())) return;
      legacyNotice = store.canImport() ? 'Hi ha dades de la versió anterior en aquest navegador. Pots revisar-les i importar-les sense esborrar-ne la còpia original.' : 'Es conserva una còpia de la versió anterior al navegador. El servidor ja conté dades: no se substituiran.';
    } catch (_) {legacyNotice = 'Les dades de la versió anterior no són compatibles. Es conserven intactes al navegador; no s’han importat.';}
  }

  function loginMarkup() {
    return `<section class="panel pad session-panel"><div class="eyebrow">ESPAI PRIVAT DEL TALLER</div><h1>Entra a NEW OP</h1><p class="small muted">Utilitza el compte autoritzat del teu espai. Les claus dels serveis es configuren al servidor.</p><form data-form="login" novalidate>${formError}${field('email','Correu del compte',input('email','email','','required autocomplete="username" autofocus'))}${field('password','Contrasenya',input('password','password','','required autocomplete="current-password"'))}${formActions('Entra',false)}</form></section>`;
  }
  async function bootstrap() {
    if (booting) return;
    booting = true;
    try {
      const result = await api('session');
      if (!result.ok) {fatal(errorMessage(result.error));return;}
      session = result.data;
      if (!session.authenticated) {
        view.innerHTML = loginMarkup();
        $('#storage-status').innerHTML = '';
        $('#api-state').textContent = 'Servidor disponible · cal iniciar sessió';
        $('#session-button').textContent = 'Inicia sessió';
        return;
      }
      const loaded = await store.refresh();
      if (!loaded.ok) {fatal(errorMessage(loaded.error));return;}
      initialized = true;
      state = store.getState();
      if (session.mode !== "browser") readLegacy();
      $('#api-state').textContent = session.mode === 'browser' ? 'Demo web preparada' : session.mode === 'local' ? 'API connectada · sessió local de demo' : 'API connectada · sessió privada';
      $('#session-button').textContent = session.mode === 'local' ? 'Sessió local de demo' : 'Tanca la sessió';
      render();
    } catch (_) {fatal('No s’ha pogut connectar amb el servidor. Torna a carregar per provar-ho; no s’han modificat les dades.');}
    finally {booting = false;}
  }

  async function refreshState() {
    const loaded = await store.refresh();
    if (!loaded.ok) {notify(errorMessage(loaded.error),true);return false;}
    state = store.getState();if (session.mode !== "browser") readLegacy();render(true);return true;
  }

  function openImport(candidate = legacy, sourceLabel = 'Còpia anterior d’aquest navegador') {
    if (!candidate || !store.canImport()) {notify('Aquest espai ja conté dades; no se substituiran.',true);return;}
    const previous = candidate.state, current = store.getState();
    const counts = value => `${value.clients.length} clients · ${value.quotes.length} pressupostos · ${value.deliveryNotes.length} albarans · ${value.invoices.length} factures · ${value.tasks.length} seguiments`;
    openDialog('Revisa la còpia abans d’importar',`<p class="dialog-intro">Importa aquesta còpia a l’espai del servidor, que encara no té canvis. No es barregen espais ni s’esborra el fitxer o la còpia original del navegador. El JSON no inclou els bytes dels adjunts; un trasllat complet requereix el procediment privat de servidor.</p><dl class="details-meta"><div><dt>${escape(sourceLabel)}</dt><dd>${escape(counts(previous))}</dd></div><div><dt>Espai nou del servidor</dt><dd>${escape(counts(current))}</dd></div></dl><div class="actions">${button('Descarrega la còpia que importaràs','import-preview-backup','',true)}</div><form data-form="legacy-import" novalidate>${formError}<label class="check-field"><input type="checkbox" name="confirmed" id="import-confirmed" aria-describedby="import-confirmed-error"><span>He revisat els registres i confirmo la importació a aquest espai nou. No es barrejaran dades de dos espais ni s’esborrarà la còpia original.<span class="field-error" id="import-confirmed-error"></span></span></label>${formActions('Importa les dades al servidor')}${disclaimer}</form>`,true);
    importPreview = candidate;
  }

  function openBackupFile() {
    if (!store.canImport()) {notify('Aquest espai ja conté dades; no se substituiran.',true);return;}
    openDialog('Importa una còpia de NEW OP',`<p class="dialog-intro">Tria el fitxer JSON descarregat des de NEW OP. Primer es validarà i en veuràs un resum. Les dades només s’importaran quan ho confirmis al pas següent.</p><form data-form="backup-select" novalidate>${formError}${field('backupFile','Còpia JSON (màxim 128 KiB)',input('backupFile','file','','required accept="application/json,.json" autofocus'),'El fitxer original es conserva. Aquest espai encara no té canvis i pot rebre una còpia vàlida.')}<div id="backup-file-status" role="status" aria-live="polite"></div>${formActions('Valida i revisa la còpia')}${disclaimer}</form>`);
  }
  async function reviewBackupFile(form) {
    const control = form.elements.backupFile;
    const file = control && control.files && control.files[0];
    if (!file) throw new InputError('Selecciona un fitxer de còpia JSON.','backupFile');
    if (file.size > 128 * 1024) throw new InputError('La còpia supera el límit de 128 KiB. No s’ha importat cap dada.','backupFile');
    if (!file.size) throw new InputError('El fitxer és buit. Selecciona una còpia vàlida.','backupFile');
    const serial = dialogSerial;
    const submit = $('[type="submit"]',form);
    submit.disabled = true;setStatus('backup-file-status','Validant la còpia…');
    try {
      const raw = await file.text();
      if (serial !== dialogSerial || !form.isConnected) return;
      let candidate;
      try {candidate = JSON.parse(raw);} catch (_) {throw new InputError('El fitxer no conté JSON vàlid. No s’ha modificat l’espai.','backupFile');}
      const checked = window.NewopDemo.validateState(candidate,{allowRealContacts:true});
      if (!checked.ok) throw new InputError('Aquesta còpia no és un estat vàlid de NEW OP. Comprova el fitxer original; no s’ha importat cap dada.','backupFile');
      if (!store.canImport()) throw new InputError('Aquest espai ja conté dades; no se substituiran.',null);
      openImport({raw,state:checked.data},file.name);
    } finally {if (submit.isConnected) submit.disabled = false;}
  }

  function openDialog(title, body, wide = false, opener = document.activeElement) {
    if (overlay.open && overlay.contains(opener)) opener = dialogOpener;
    if (overlay.open) overlay.close();
    dialogSerial++;
    resetDialogState();
    dialogOpener = opener;
    overlay.className = wide ? 'wide' : '';
    overlay.innerHTML = `<div class="dialog-header"><h2 id="dialog-title" tabindex="-1">${escape(title)}</h2><button type="button" class="icon-button" data-action="dialog-close" aria-label="Tanca el diàleg">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
    overlay.showModal();
    const focus = $('[autofocus]',overlay) || $('#dialog-title',overlay);
    focus.focus();
  }

  function closeDialog() {if (overlay.open) overlay.close();}
  overlay.addEventListener('close', () => {
    if (!overlay.open) {invoicePreview = null;dialogSerial++;resetDialogState();$('#print-document').replaceChildren();}
    const opener = dialogOpener;
    queueMicrotask(() => {if (!overlay.open) (opener && opener.isConnected ? opener : $('h1', view) || view).focus();});
  });
  overlay.addEventListener('click', event => {if (event.target === overlay) {const rect = overlay.getBoundingClientRect();if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();}});

  function setMenu(open) {
    const sidebar = $('.sidebar');
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    sidebar.classList.toggle('open',open);
    sidebar.inert = mobile && !open;
    if (mobile && !open) sidebar.setAttribute('aria-hidden','true');else sidebar.removeAttribute('aria-hidden');
    $('#menu-backdrop').hidden = !open;
    $('#menu-button').setAttribute('aria-expanded',String(open));
    document.body.classList.toggle('menu-open',open);
    if (open) $('.nav-link[aria-current="page"]')?.focus();
  }
  $('#menu-backdrop').addEventListener('click', () => {setMenu(false);$('#menu-button').focus();});
  document.addEventListener('keydown', event => {
    if (overlay.open) return;
    if (event.key === 'Escape' && $('.sidebar').classList.contains('open')) {setMenu(false);$('#menu-button').focus();}
    if (event.key === 'Tab' && $('.sidebar').classList.contains('open')) {
      const controls = $$('a,button', $('.sidebar')).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
    }
  });

  function navigate(module, id = null) {
    const target = path(module,id);
    if (window.location.hash === target) render(true);else window.location.hash = target;
  }

  function readRoute() {
    const raw = window.location.hash || '#/inici';
    const match = /^#\/([^/]+)(?:\/([^/]+))?$/.exec(raw);
    if (!match) return {module:'unknown',id:null};
    try {return {module:match[1],id:match[2] ? decodeURIComponent(match[2]) : null};} catch (_) {return {module:'unknown',id:null};}
  }

  function notFound(label = 'Aquest registre no existeix') {
    return `<div class="panel">${empty(label,'Revisa l’enllaç o torna al llistat per continuar amb les dades locals.',`<a class="button secondary" href="${path(modules.some(m => m[0] === route.module) ? route.module : 'inici')}">Torna al mòdul</a>`)}</div>`;
  }

  function render(focus = false) {
    if (!initialized) {bootstrap();return;}
    const activeAction = document.activeElement?.dataset.action;
    const wasInView = view.contains(document.activeElement);
    state = store.getState();
    route = readRoute();
    setMenu(false);
    const module = modules.find(m => m[0] === route.module);
    $('#current-module').textContent = module?.[1] || 'Ruta desconeguda';
    document.title = (module?.[1] || 'Ruta desconeguda') + ' · NEW OP';
    $$('.nav-link').forEach(el => {if (el.dataset.module === route.module) el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    const views = {inici:renderHome,pressupostos:renderQuotes,albarans:renderDeliveries,facturacio:renderInvoices,seguiment:renderTasks,calendari:renderCalendar,teixits:renderFabrics,clients:renderClients,consultes:renderQueries};
    try {view.innerHTML = views[route.module] ? views[route.module]() : notFound('No hem trobat aquesta pàgina');}
    catch (error) {view.innerHTML = `<div class="panel">${empty('No s’han pogut carregar les dades',error.message || 'Revisa la integració del motor local.',button('Torna a provar','refresh','',true))}</div>`;}
    storageStatus();
    if (focus) {($('h1',view) || view).focus();window.scrollTo({top:0,behavior:'instant'});}
    else if (activeAction && wasInView) {($$('[data-action]',view).find(el => el.dataset.action === activeAction) || $('h1',view) || view).focus();}
  }


  /* Auditoria v4 · Operacions revisables dins dels vuit mòduls. */
  const noteKinds = {note:'Nota',change:'Canvi',fitting:'Prova / fitting',delivery:'Lliurament'};
  const emptyWorkflow = {clientNotes:[],meetings:[],attachments:[],workshopEntries:[],purchases:[],billingProfiles:[],proformas:[],receipts:[],creditAllocations:[],quoteEvents:[]};
  const workflow = () => state.workflow || emptyWorkflow;
  const serverToday = () => ai?.serverNow?.()?.slice(0,10) || state.scenarioDate;
  const attachmentById = id => workflow().attachments.find(a => a.id === id);
  const checkedHuman = (data,name='reviewed') => {if (!data.has(name)) throw new InputError('Confirma que has revisat les dades abans de registrar-les.',name);};
  let manualRowSequence = 0;
  let weekRange = null;
  let paymentRange = null;
  let attachmentJob = null;
  let attachmentPending = null;
  const selectedAttachments = form => $$('[name="attachmentIds"]:checked',form).map(el => el.value);
  function attachmentList(ids) {
    const files = (ids || []).map(attachmentById).filter(Boolean);
    if (!files.length) return '<p class="small muted">Sense adjunts vinculats.</p>';
    return `<ul class="attachment-list">${files.map(file=>{
      const source=ai.imageSource(file);
      return `<li>${source ? `<img class="attachment-thumb" src="${escape(source)}" alt="" width="86" height="62" loading="lazy">` : ''}
        ${button(file.filename,'download-attachment',file.id,true,'download')}
        <small>${escape(formatDateTime(file.createdAt))} · ${new Intl.NumberFormat('ca-ES').format(file.sizeBytes)} B</small></li>`;
    }).join('')}</ul>`;
  }
  function attachmentChoices(selected=[]) {
    return workflow().attachments.length ? `<fieldset class="source-picker"><legend>Fotos d’aquest navegador (màxim 5 per registre)</legend>${workflow().attachments.map(a => `<label class="check-field compact"><input type="checkbox" name="attachmentIds" value="${escape(a.id)}"${selected.includes(a.id) ? ' checked' : ''}><span>${escape(a.filename)} · ${new Intl.NumberFormat('ca-ES').format(a.sizeBytes)} B</span></label>`).join('')}</fieldset>` : '<p class="small muted">Encara no has pujat arxius privats.</p>';
  }
  function attachmentPicker(withSample=false, supplier=false) {
    return `<details class="attachment-picker"><summary>${supplier?'Adjunta una foto o PDF':'Adjunta una foto'}</summary><p class="small muted">${supplier?'JPEG, PNG, WebP o PDF de fins a 1 MiB. L’arxiu no es llegeix automàticament: revisa els conceptes i el client de cada línia abans de desar.':'JPEG, PNG o WebP de fins a 1 MiB. La foto no es llegeix automàticament: escriu i revisa el text abans de desar.'}</p>${field('attachmentFile',supplier?'Foto o PDF':'Foto',input('attachmentFile','file','',supplier?'accept="image/jpeg,image/png,image/webp,application/pdf"':'accept="image/jpeg,image/png,image/webp"'))}<div class="actions">${button('Adjunta la foto','upload-attachment','',true)}${withSample ? button('Usa una foto fictícia','sample-meeting-photo','',true) : ''}<button type="button" class="button secondary" data-action="cancel-attachment" hidden>Cancel·la la pujada</button></div><div id="attachment-status" role="status" aria-live="polite"></div><div id="attachment-choices">${attachmentChoices()}</div><p class="field-help">Els arxius pujats queden al teu espai; selecciona’ls i desa el registre per vincular-los. El backup JSON només inclou les metadades.</p></details>`;
  }
  function humanReview(label='He revisat el contingut, les dates i els imports. Aquesta acció només registra dades de demostració.') {
    return `<label class="check-field"><input type="checkbox" name="reviewed" id="workflow-reviewed" aria-describedby="workflow-reviewed-error"><span>${escape(label)}<span class="field-error" id="workflow-reviewed-error"></span></span></label>`;
  }
  function dialogForm(name,body,submit,extra='') {
    return `<form data-form="${name}" ${extra} novalidate>${formError}${body}${formActions(submit)}${disclaimer}</form>`;
  }
  function workflowSources(refs) {
    return (refs || []).map(ref => {
      const maps = {client:['clients',state.clients],quote:['pressupostos',state.quotes],deliveryNote:['albarans',state.deliveryNotes],invoice:['facturacio',state.invoices],task:['seguiment',state.tasks],fabric:['teixits',state.fabrics]};
      const entry=maps[ref.entityType], entity=entry?.[1].find(x=>x.id===ref.id);
      if (entity) return link(entry[0],entity.id,entity.number || entity.name || entity.text);
      const names={meeting:'meetings',clientNote:'clientNotes',workshopEntry:'workshopEntries',purchase:'purchases',proforma:'proformas'};
      const record=workflow()[names[ref.entityType]]?.find(x=>x.id===ref.id);
      return record ? link('clients',record.clientId,record.number || record.reference || record.summary || record.text || 'Registre del client') : '';
    }).filter(Boolean).join(' · ');
  }
  function meetingsPanel(clientId=null) {
    const meetings=workflow().meetings.filter(m=>!clientId || m.clientId===clientId).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return `<section class="panel">${panelHead('Reunions que es converteixen en peces','Notes i resum revisats; els adjunts no s’analitzen automàticament.',button('Desa una reunió','new-meeting',clientId || '',true,'plus'))}<div class="panel-body">${meetings.length ? `<div class="record-grid">${meetings.map(m=>`<article class="record-card"><div class="record-meta"><span>${escape(formatDateTime(m.createdAt))}</span>${link('clients',m.clientId,clientName(m.clientId))}</div><h3>${escape(m.summary)}</h3><p class="notes small">${escape(m.notes)}</p>${attachmentList(m.attachmentIds)}<div class="source-links">${(m.quoteIds || []).map(id=>link('pressupostos',id,state.quotes.find(q=>q.id===id)?.number || id)).join('')}</div><div class="actions">${button('Genera des del resum','meeting-draft',m.id,false,'arrow') + button('Prepara el pressupost','meeting-quote',m.id,true)}</div></article>`).join('')}</div>` : empty('Conserva el punt de partida','Desa les notes i un resum humà abans de preparar les peces.')}</div></section>`;
  }
  function renderQuotes() {
    const content=renderQuotesBase();
    if (!route.id) return content + meetingsPanel();
    const q=state.quotes.find(x=>x.id===route.id);
    if (!q) return content;
    const meeting=workflow().meetings.find(m=>(m.quoteIds || []).includes(q.id));
    return content + quotePhasePanel(q) + `<section class="panel">${panelHead('El fil del pressupost','Origen, resposta i anticips',q.status==='draft' ? button('Afegeix o canvia peces','edit-manual-quote',q.id,true) : '')}<div class="panel-body">${meeting ? `<p class="small">Reunió del ${escape(formatDateTime(meeting.createdAt))}: ${escape(meeting.summary)}</p>${attachmentList(meeting.attachmentIds)}` : '<p class="small muted">Sense reunió vinculada; les notes originals del pressupost es conserven.</p>'}${quoteEventMarkup(q)}${['approved','sent_simulated'].includes(q.status) && !q.lines.some(line=>remainingQuantity(q,line)>0) ? `<div class="hint">Totes les unitats ja tenen albarà.<div class="source-links">${state.deliveryNotes.filter(d=>d.quoteId===q.id).map(d=>link('albarans',d.id,d.number)).join('')}</div></div>` : ''}<div class="actions">${button('Registra una resposta','quote-response',q.id,true)}${button('Prepara un correu revisable','quote-followup',q.id,true)}${invoiceableQuote(q) ? button('Prepara una proforma','new-proforma',q.id,true) : ''}</div></div></section>`;
  }
  function quoteEventMarkup(q) {
    const events=workflow().quoteEvents.filter(e=>e.quoteId===q.id).slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    const sent=events.find(e=>e.kind==='sent_simulated'), response=events.find(e=>e.kind==='response_recorded');
    const now=ai?.serverNow?.();
    const days=sent && now ? Math.max(0,Math.floor((Date.parse(now)-Date.parse(sent.createdAt))/86400000)) : null;
    const summary=response ? 'Resposta registrada: ja no es compta com a pendent de resposta.' : sent ? (days===null ? 'Enviament simulat registrat; no es disposa del rellotge del servidor.' : `${days} ${days===1 ? 'dia' : 'dies'} sense resposta des de l’enviament simulat.`) : 'Data d’enviament desconeguda. No es calcula des de la data fixa de l’escenari.';
    return `<div class="hint"><strong>${escape(summary)}</strong><p class="small muted">L’enviament actual és simulat. Els dies provenen del primer registre del navegador.</p></div>${events.length ? `<ol class="timeline compact">${events.map(e=>`<li><time>${escape(formatDateTime(e.createdAt))}</time><strong>${e.kind==='sent_simulated' ? 'Enviament simulat' : 'Resposta registrada manualment'}</strong><span>Data operativa: ${date(e.occurredOn)}</span>${e.note ? `<p class="notes">${escape(e.note)}</p>` : ''}</li>`).join('')}</ol>` : ''}`;
  }
  function timelinePanel(clientId=null) {
    const notes=workflow().clientNotes.filter(n=>!clientId || n.clientId===clientId).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return `<section class="panel">${panelHead('Cronologia del client','Hora de registre del navegador; les correccions es desen com una entrada nova.',button('Afegeix una entrada','new-client-note',clientId || '',true,'plus'))}<div class="panel-body">${notes.length ? `<ol class="timeline">${notes.map(n=>`<li><div class="record-meta"><time>${escape(formatDateTime(n.createdAt))}</time><span class="badge">${escape(noteKinds[n.kind] || n.kind)}</span>${link('clients',n.clientId,clientName(n.clientId))}</div><p class="notes">${escape(n.text)}</p><div class="timeline-dates">${n.occurredOn ? `<span>Fet: ${date(n.occurredOn)}</span>` : ''}${n.dueDate ? `<span>Venciment: ${date(n.dueDate)}</span>` : ''}</div>${attachmentList(n.attachmentIds)}${n.sourceRefs?.length ? `<div class="source-links">${workflowSources(n.sourceRefs)}</div>` : ''}</li>`).join('')}</ol>` : empty('Cada canvi, amb el seu moment','Afegeix notes, canvis, proves i lliuraments sense sobreescriure el fil anterior.')}</div></section>`;
  }
  function renderCalendar() {
    const today = serverToday();
    const start = /^\d{4}-\d{2}-\d{2}$/.test(route.id || '') ? new Date(route.id + 'T12:00:00Z') : new Date(today + 'T12:00:00Z');
    if (!Number.isFinite(start.getTime())) return notFound();
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay()+6)%7);
    const day = offset => new Date(start.getTime()+offset*86400000).toISOString().slice(0,10);
    const events = [
      ...state.tasks.filter(t=>t.status==='pending').map(t=>({tone:'clients',type:'Seguiment',on:t.dueDate,text:t.text,client:t.clientId,module:'seguiment',id:t.id})),
      ...workflow().clientNotes.filter(n=>['fitting','delivery'].includes(n.kind)).map(n=>({tone:n.kind==='delivery'?'albarans':'clients',type:noteKinds[n.kind],on:n.dueDate || n.occurredOn,text:n.text,client:n.clientId,module:'clients',id:n.clientId})),
      ...workflow().workshopEntries.map(w=>({tone:'albarans',type:'Taller',on:w.dueDate,text:w.workshopName+' · '+w.text,client:w.clientId,module:'albarans',id:w.deliveryNoteId}))
    ];
    const nav = (offset,label) => `<a class="button secondary" href="${path('calendari',day(offset))}">${label}</a>`;
    const days = ['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
    return heading('Calendari','Tasques, proves i lliuraments en una agenda setmanal.',button('Nou seguiment','new-task','',false,'plus')+button('Afegeix una entrada','new-client-note','',true,'plus'))+
      `<section class="panel pad"><div class="actions">${nav(-7,'Setmana anterior')}<a class="button secondary" href="#/calendari">Avui</a>${nav(7,'Setmana següent')}</div><h2>${date(day(0))} - ${date(day(6))}</h2><div class="calendar-grid">${days.map((name,index)=>{
        const items = events.filter(event=>event.on===day(index));
        return `<article class="record-card${day(index)===today ? ' calendar-today' : ''}"><h3>${name} · ${date(day(index))}${day(index)===today ? ' <span class="badge">Avui</span>' : ''}</h3>${items.length ? `<ul>${items.map(event=>`<li class="calendar-event folder-${event.tone}">${link(event.module,event.id,event.text)}<br><small>${escape(event.type)} · ${escape(clientName(event.client))}</small></li>`).join('')}</ul>` : '<p class="muted">Sense cites</p>'}</article>`;
      }).join('')}</div></section>`;
  }
  function renderTasks() {return renderTasksBase() + (!route.id ? timelinePanel() : '');}
  function renderClients() {
    const base=renderClientsBase();
    if (!route.id || !state.clients.some(c=>c.id===route.id)) return base;
    return base + billingProfilePanel(route.id) + meetingsPanel(route.id) + timelinePanel(route.id) + purchasesPanel(route.id);
  }
  function billingProfilePanel(clientId) {
    const profile=workflow().billingProfiles.find(p=>p.clientId===clientId);
    return `<section class="panel">${panelHead('Condicions del client','Percentatges de demostració; no són condicions comercials confirmades.',button('Revisa les condicions','billing-profile',clientId,true))}<div class="panel-body"><dl class="details-meta"><div><dt>Perfil</dt><dd>${profile ? (profile.isNewClient ? 'Client nou' : 'Client habitual') : 'Pendent de confirmar'}</dd></div><div><dt>Termini</dt><dd>${profile ? profile.paymentTermDays + ' dies' : 'Sense perfil desat'}</dd></div><div><dt>Anticipació</dt><dd>${profile ? new Intl.NumberFormat('ca-ES').format(profile.depositBps/100) + ' %' : '50 % demo per defecte en nous clients'}</dd></div></dl></div></section>`;
  }
  function balance(targetType,targetId) {
    const result=store.query({type:'BILLING_BALANCE',targetType,targetId});
    return result.ok ? result.data : null;
  }
  function balanceMarkup(targetType,targetId) {
    const b=balance(targetType,targetId);
    return b ? `<dl class="balance-grid"><div><dt>Import del document</dt><dd>${money(b.totalCents)}</dd></div><div><dt>${targetType==='proforma' ? 'Anticipació rebuda' : 'Cobraments directes'}</dt><dd>${money(b.receivedCents)}</dd></div><div><dt>${targetType==='invoice' ? 'Anticipació aplicada' : 'Crèdit ja aplicat'}</dt><dd>${money(targetType==='invoice' ? b.creditCents : b.allocatedCents)}</dd></div><div><dt>Pendent de cobrar</dt><dd>${money(b.outstandingCents)}</dd></div>${targetType==='proforma' ? `<div><dt>Disponible per aplicar</dt><dd>${money(b.availableCreditCents)}</dd></div>` : ''}</dl>${targetType==='proforma' ? '<p class="small muted">Aplicar l’anticipació a una factura no registra un nou cobrament ni un ingrés addicional.</p>' : ''}` : '<p class="small muted">No s’ha pogut calcular el saldo. Actualitza les dades abans de registrar un cobrament.</p>';
  }
  function purchasesPanel(clientId=null) {
    const purchases=workflow().purchases.filter(p=>!clientId || p.clientId===clientId).slice().reverse();
    return `<section class="panel" id="compres">${panelHead('Compres refacturables','Del document del proveïdor a la factura del client, sense tornar-lo a capturar.',button('Nova compra','new-purchase',clientId || '',true,'plus') + button('Refactura compres','rebill-purchases',clientId || '',false))}<div class="panel-body">${purchases.length ? `<div class="record-grid">${purchases.map(p=>`<article class="record-card"><div class="record-meta"><span class="badge ${p.invoiceId ? 'green' : 'amber'}">${p.invoiceId ? 'Refacturada' : 'Pendent de refacturar'}</span><span>${p.paymentStatus==='paid_recorded' ? 'Pagament registrat' : 'Pendent de pagar'}</span></div><h3>${escape(p.reference)} · ${escape(p.supplierName)}</h3><p>${escape(p.description)}</p><dl class="details-meta"><div><dt>Client</dt><dd>${link('clients',p.clientId,clientName(p.clientId))}</dd></div><div><dt>Compra</dt><dd>${date(p.purchasedOn)}</dd></div><div><dt>Quantitat / cost unitari</dt><dd>${escape(p.quantity)} × ${money(p.unitCostCents)}</dd></div><div><dt>Total il·lustratiu</dt><dd>${money(p.totals.totalCents)}</dd></div><div><dt>Venciment</dt><dd>${p.dueDate ? date(p.dueDate) : 'Sense data'}</dd></div></dl>${attachmentList(p.attachmentIds)}${p.invoiceId ? `<p>Factura: ${link('facturacio',p.invoiceId,state.invoices.find(i=>i.id===p.invoiceId)?.number || p.invoiceId)}</p>` : ''}${p.paymentStatus==='paid_recorded' ? `<p class="small">Pagament manual del ${date(p.paidOn)} · ${escape(p.paymentReference || '')}</p>` : `<div class="actions">${button('Registra el pagament manual','purchase-payment',p.id,true)}</div>`}</article>`).join('')}</div>` : empty('Cap compra registrada','Vincula cada compra al client, al proveïdor i a una referència única.')}</div></section>`;
  }
  function defaultWeekRange() {
    const from = serverToday();
    const end = new Date(from + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() + 6);
    return {from, to:end.toISOString().slice(0,10)};
  }
  function supplierPaymentsPanel() {
    const {from, to} = paymentRange || defaultWeekRange();
    const pending = workflow().purchases.filter(purchase => purchase.paymentStatus === 'pending');
    const dated = pending.filter(purchase => purchase.dueDate >= from && purchase.dueDate <= to)
      .sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    const undated = pending.filter(purchase => !purchase.dueDate);
    const paymentTable = purchases => table(['Venciment','Proveïdor','Referència','Import','Acció'], purchases.map(purchase =>
      `<tr><td>${purchase.dueDate ? date(purchase.dueDate) : 'Sense data'}</td><td>${escape(purchase.supplierName)}</td><td>${escape(purchase.reference)}</td><td>${money(purchase.totals.totalCents)}</td><td>${button('Registra el pagament manual','purchase-payment',purchase.id,true)}</td></tr>`
    ));
    return `<section class="panel" id="pagaments-setmana">${panelHead('Pagaments de la setmana','Venciments pendents amb registre manual del pagament.')}
      <div class="panel-body"><form data-form="supplier-payment-range" class="toolbar">
        ${field('paymentFrom','Des del dia',input('paymentFrom','date',from,'required'))}
        ${field('paymentTo','Fins al dia',input('paymentTo','date',to,'required'))}
        <button class="button secondary" type="submit">Mostra els pagaments</button>${formError}
      </form>
      ${dated.length ? paymentTable(dated) : empty('Cap pagament en aquest període','Canvia les dates per consultar altres venciments.')}
      ${undated.length ? `<h3>Pendents sense venciment</h3>${paymentTable(undated)}` : ''}
      </div></section>`;
  }
  function proformasPanel() {
    return `<section class="panel" id="proformes">${panelHead('Proformes i anticipacions','Separades de les factures; els cobraments només són registres humans.')}<div class="panel-body">${workflow().proformas.length ? `<div class="record-grid">${workflow().proformas.slice().reverse().map(p=>`<article class="record-card"><div class="record-meta"><strong>${escape(p.number)}</strong><span class="badge">Proforma · no és factura</span></div><p>${link('clients',p.clientId,clientName(p.clientId))} · ${link('pressupostos',p.quoteId,state.quotes.find(q=>q.id===p.quoteId)?.number || p.quoteId)}</p><p class="small">${new Intl.NumberFormat('ca-ES').format(p.depositBps/100)} % de ${money(p.quoteTotalCents)} · Venciment ${date(p.dueDate)}</p>${balanceMarkup('proforma',p.id)}<div class="actions">${button('Document','proforma-document',p.id,true,'print')}${button('Registra un cobrament','receipt-proforma',p.id,true)}</div>${receiptHistory('proforma',p.id)}</article>`).join('')}</div>` : empty('Cap proforma encara','Des d’un pressupost aprovat pots preparar una anticipació revisada.')}</div></section>`;
  }
  function receiptHistory(targetType,targetId) {
    const rows=workflow().receipts.filter(r=>r.targetType===targetType && r.targetId===targetId);
    return rows.length ? `<details class="receipt-history"><summary>${rows.length} cobrament${rows.length===1 ? '' : 's'} registrat${rows.length===1 ? '' : 's'}</summary><ul>${rows.map(r=>`<li>${date(r.receivedOn)} · ${money(r.amountCents)} · ${escape(r.reference)}<small>Registrat ${escape(formatDateTime(r.createdAt))}</small></li>`).join('')}</ul></details>` : '';
  }
  function renderInvoices() {
    const content=renderInvoicesBase();
    if (!route.id) return content + `<nav class="section-nav" aria-label="Seccions de facturació"><button type="button" data-action="scroll-section" data-section="compres">Compres</button><button type="button" data-action="scroll-section" data-section="pagaments-setmana">Pagaments de la setmana</button><button type="button" data-action="scroll-section" data-section="proformes">Proformes i anticipacions</button></nav>` + purchasesPanel() + supplierPaymentsPanel() + proformasPanel();
    const invoice=state.invoices.find(i=>i.id===route.id);
    if (!invoice) return content;
    return content + `<section class="panel">${panelHead('Cobraments i saldo','Cap moviment bancari; els registres i les aplicacions requereixen revisió.')}<div class="panel-body">${balanceMarkup('invoice',invoice.id)}<p class="small muted">Venciment: ${invoice.dueDate ? date(invoice.dueDate) : 'No consta al document històric'}</p><div class="actions">${button('Registra un cobrament parcial','receipt-invoice',invoice.id,true)}${invoice.origin!=='purchase' ? button('Aplica anticipació cobrada','apply-credit',invoice.id,true) : ''}</div>${receiptHistory('invoice',invoice.id)}${workflow().creditAllocations.filter(a=>a.invoiceId===invoice.id).map(a=>`<p class="small">Anticipació aplicada: ${money(a.amountCents)} · ${escape(workflow().proformas.find(p=>p.id===a.proformaId)?.number || a.proformaId)} · ${escape(formatDateTime(a.createdAt))}</p>`).join('')}</div></section>`;
  }
  function renderDeliveries() {
    const content=renderDeliveriesBase();
    return !route.id ? deliverySections() : content;
  }
  function workshopPanel() {
    const {from, to} = weekRange || defaultWeekRange();
    const result=store.query({type:'WORKSHOP_WEEK',from,to});
    const entries=result.ok ? result.data.entries : [];
    return `<section class="panel" id="taller-setmana">${panelHead('La setmana del taller','Dates previstes i lliuraments registrats, sense interpretar fotos.',button('Nova feina de taller','new-workshop','',true,'plus'))}<div class="panel-body"><form data-form="workshop-range" class="toolbar" novalidate>${field('from','Des del dia',input('from','date',from,'required'))}${field('to','Fins al dia',input('to','date',to,'required'))}<button class="button secondary" type="submit">Mostra el període</button>${button('Imprimeix el resum','print-workshop','',true,'print')}${formError}</form>${entries.length ? table(['Data prevista','Taller / client','Feina','Estat','Lliurament / acció'],entries.map(e=>`<tr><td>${date(e.dueDate)}</td><td>${escape(e.workshopName)}<span class="cell-secondary">${link('clients',e.clientId,clientName(e.clientId))}</span></td><td class="wrap-cell">${escape(e.text)}${e.deliveryNoteId ? `<span class="cell-secondary">${link('albarans',e.deliveryNoteId,state.deliveryNotes.find(d=>d.id===e.deliveryNoteId)?.number || e.deliveryNoteId)}</span>` : ''}${attachmentList(e.attachmentIds)}</td><td>${e.status==='delivered' ? 'Lliurada' : 'Pendent'}</td><td>${e.status==='delivered' ? date(e.deliveredOn) + `<small class="cell-secondary">Registrat ${escape(formatDateTime(e.deliveredAt))}</small>` : button('Registra el lliurament','complete-workshop',e.id,true)}</td></tr>`)) : empty('Sense feines en aquest període','Canvia les dates o registra una feina de taller.')}<p class="small muted">Resum del ${date(from)} al ${date(to)}. La negociació amb els tallers continua pel canal habitual.</p></div></section>`;
  }
  function openMeeting(clientId='') {
    openDialog('Desa la reunió',dialogForm('record-meeting',`${field('clientId','Client fictici',clientOptions(clientId))}${field('notes','Notes originals revisades','<textarea id="notes" name="notes" required maxlength="2000" rows="5" aria-describedby="notes-error" autofocus></textarea>')}${field('summary','Resum humà de la reunió','<textarea id="summary" name="summary" required maxlength="2000" rows="3" aria-describedby="summary-error"></textarea>')}${attachmentPicker(true)}${humanReview('He revisat el resum i les fonts.')}`,'Desa la reunió'),true);
  }
  function manualRow(line={}) {
    const n=++manualRowSequence;
    return `<div class="manual-line" data-manual-line${line.id ? ` data-id="${escape(line.id)}"` : ''}><div class="manual-line-heading"><strong>Peça</strong>${button('Elimina','remove-manual-line','',true)}</div><div class="form-grid">${field('manual-label-'+n,'Descripció',`<input id="manual-label-${n}" name="label" value="${escape(line.label || '')}" required maxlength="160" aria-describedby="manual-label-${n}-error"><span hidden></span>`)}${field('manual-code-'+n,'Codi de peça',`<input id="manual-code-${n}" name="garmentCode" value="${escape(line.garmentCode || 'MAN')}" required maxlength="20" aria-describedby="manual-code-${n}-error">`)}<label class="field">Teixit<select name="fabricId"><option value="">Sense teixit vinculat</option>${state.fabrics.map(f=>`<option value="${escape(f.id)}"${line.fabricId===f.id ? ' selected' : ''}>${escape(f.name)}</option>`).join('')}</select></label><label class="field">Quantitat<input type="number" name="quantity" min="1" step="1" value="${line.quantity || 1}" required></label><label class="field">Origen del preu<select name="priceMode"><option value="manual"${line.priceMode!=='tariff' ? ' selected' : ''}>Preu manual</option><option value="tariff"${line.priceMode==='tariff' ? ' selected' : ''}>Tarifa demo A/B/C</option></select></label><label class="field">Preu unitari (€)<input type="text" inputmode="decimal" name="unitPriceCents" value="${decimalMoney(line.unitPriceCents || 0)}"${line.priceMode==='tariff' ? ' disabled' : ''}></label></div></div>`;
  }
  function openManualQuote(clientId='',meetingId='',quote=null) {
    const meetings=workflow().meetings;
    const meeting=meetings.find(m=>m.id===meetingId);
    clientId=quote?.clientId || meeting?.clientId || clientId;
    openDialog(quote ? 'Edita totes les peces' : 'Pressupost manual des de la reunió',dialogForm('manual-quote',`${quote ? `<p class="dialog-intro">${escape(quote.number)} · Revisió ${quote.revision}. Desar anul·la la revisió humana anterior.</p>` : `<div class="form-grid">${field('clientId','Client fictici',clientOptions(clientId))}${field('meetingId','Reunió d’origen (opcional)',select('meetingId',[['','Sense reunió vinculada'],...meetings.filter(m=>m.clientId===clientId).map(m=>[m.id,formatDateTime(m.createdAt)+' · '+m.summary.slice(0,70)])],meetingId))}</div>`}${field('tariff','Tarifa de demostració',tariffOptions('tariff',quote?.tariff || 'A'))}<p class="small muted">Manté els trams ficticis 1/10/50. Els preus manuals es revisen abans d’aprovar; no es dedueixen dels adjunts.</p><div id="manual-lines">${(quote?.lines || [{}]).map(manualRow).join('')}</div><div class="actions">${button('Afegeix una peça','add-manual-line','',true,'plus')}</div>${humanReview('He revisat les descripcions, les quantitats i els preus. Es desarà un esborrany pendent de revisió financera i aprovació.')}`,quote ? 'Desa les peces' : 'Crea l’esborrany',quote ? `data-id="${escape(quote.id)}" data-revision="${quote.revision}"` : ''),true);
  }
  function openClientNote(clientId='') {
    openDialog('Una nova entrada al fil',dialogForm('client-note',`<div class="form-grid">${field('clientId','Client fictici',clientOptions(clientId))}${field('kind','Tipus',select('kind',Object.entries(noteKinds),'note'))}${field('occurredOn','Data del fet (opcional)',input('occurredOn','date',serverToday()))}${field('dueDate','Venciment (opcional)',input('dueDate','date',''))}</div>${field('text','Nota','<textarea name="text" id="text" required maxlength="2000" rows="4" aria-describedby="text-error" autofocus></textarea>')}${attachmentPicker()}<p class="field-help">L’hora de registre es desa automàticament. Aquesta entrada no substitueix cap nota anterior.</p>`,'Desa l’entrada'),true);
  }
  function openPurchase(clientId='') {
    openDialog('Registra una compra refacturable',dialogForm('purchase',`${field('clientId','Client fictici',clientOptions(clientId))}<div class="form-grid">${field('supplierName','Proveïdor fictici',input('supplierName','text','','required maxlength="160"'))}${field('reference','Referència del document',input('reference','text','','required maxlength="100"'))}${field('purchasedOn','Data de compra',input('purchasedOn','date',serverToday(),'required'))}${field('dueDate','Venciment (opcional)',input('dueDate','date',''))}</div>${field('description','Concepte',input('description','text','','required maxlength="160"'))}<div class="form-grid">${field('quantity','Quantitat',input('quantity','number','1','required min="1" step="1"'))}${field('unitCost','Cost unitari (€)',input('unitCost','text','','required inputmode="decimal"'))}${field('taxPercent','Impost il·lustratiu (%)',input('taxPercent','text',decimalMoney(state.catalog.taxRateBps),'required inputmode="decimal"'))}</div>${attachmentPicker()}${humanReview('He revisat la compra i els imports. No s’emet cap factura ni s’executa cap pagament en desar-la.')}`,'Desa la compra'),true);
  }
  function openRebill(clientId='') {
    openDialog('Revisa les compres a refacturar',dialogForm('rebill',`${field('clientId','Client fictici',clientOptions(clientId))}<div id="rebill-choices">${rebillChoices(clientId)}</div><div id="rebill-total" role="status"></div>${humanReview('He revisat les compres, el client i els imports. Confirmo una factura demo de les compres seleccionades, sense duplicar-ne cap.')}`,'Crea la factura de compres'),true);
  }
  function rebillChoices(clientId) {
    const purchases=workflow().purchases.filter(p=>p.clientId===clientId && !p.invoiceId);
    return purchases.length ? `<fieldset class="source-picker"><legend>Compres completes, pendents de refacturar</legend>${purchases.map(p=>`<label class="selection-row"><input type="checkbox" name="purchaseIds" value="${escape(p.id)}"><span>${escape(p.reference)} · ${escape(p.description)}<small>${escape(p.quantity)} × ${money(p.unitCostCents)} · base ${money(p.totals.baseCents)} + impost ${money(p.totals.taxCents)} = ${money(p.totals.totalCents)}</small></span></label>`).join('')}</fieldset>` : '<p class="hint">Selecciona un client amb compres pendents. No es requereix cap albarà per refacturar-les.</p>';
  }
  function openBillingProfile(clientId) {
    const p=workflow().billingProfiles.find(x=>x.clientId===clientId) || {isNewClient:true,paymentTermDays:0,depositBps:5000};
    openDialog('Condicions de demostració',dialogForm('billing-profile',`<p>${escape(clientName(clientId))}</p>${field('isNewClient','Perfil',select('isNewClient',[['yes','Client nou'],['no','Client habitual']],p.isNewClient ? 'yes' : 'no'))}<div class="form-grid">${field('paymentTermDays','Termini de pagament (dies)',input('paymentTermDays','number',p.paymentTermDays,'required min="0" max="365" step="1"'))}${field('depositPercent','Anticipació demo (%)',input('depositPercent','text',decimalMoney(p.depositBps),'required inputmode="decimal"'))}</div>${humanReview('He revisat aquestes condicions de demostració. No representen tarifes ni condicions reals confirmades per NEW OP.')}`,'Desa les condicions',`data-id="${escape(clientId)}"`));
  }
  function openProforma(quoteId) {
    const q=state.quotes.find(x=>x.id===quoteId), p=workflow().billingProfiles.find(x=>x.clientId===q.clientId);
    const percent=p?.depositBps ?? 5000;
    const amount=Number((BigInt(q.totals.totalCents)*BigInt(percent)+5000n)/10000n);
    openDialog('Revisa la proforma',dialogForm('proforma',`<p>${escape(q.number)} · ${escape(clientName(q.clientId))}</p><dl class="balance-grid"><div><dt>Total pressupost</dt><dd>${money(q.totals.totalCents)}</dd></div><div><dt>Anticipació demo</dt><dd>${new Intl.NumberFormat('ca-ES').format(percent/100)} %</dd></div><div><dt>Import previst</dt><dd>${money(amount)}</dd></div></dl><p class="hint">La proforma no és una factura ni registra cap cobrament. L’import definitiu es calcula amb les condicions desades.</p>${humanReview('He revisat el pressupost i les condicions i confirmo la proforma de demostració.')}`,'Crea la proforma',`data-id="${escape(quoteId)}"`));
  }
  function openReceipt(type,id) {
    const target=type==='invoice' ? state.invoices.find(i=>i.id===id) : workflow().proformas.find(p=>p.id===id), b=balance(type,id);
    if (!target || !b) {notify('Actualitza les dades abans de registrar un cobrament.',true);return;}
    openDialog('Registra un cobrament manual',dialogForm('receipt',`<p>${escape(target.number)} · ${escape(clientName(target.clientId))}</p>${balanceMarkup(type,id)}${field('amount','Import rebut (€)',input('amount','text',decimalMoney(b.outstandingCents),'required inputmode="decimal"'))}<div class="form-grid">${field('receivedOn','Data del cobrament',input('receivedOn','date',serverToday(),'required'))}${field('reference','Referència del registre',input('reference','text','','required maxlength="100"'))}</div>${humanReview('He comprovat aquest cobrament. Només el registro manualment: no es farà cap càrrec ni conciliació bancària.')}`,'Desa el cobrament',`data-id="${escape(id)}" data-target="${type}"`));
  }
  function openCredit(invoiceId) {
    const invoice=state.invoices.find(i=>i.id===invoiceId), quotes=new Set(invoice.deliveryNoteIds.map(id=>state.deliveryNotes.find(d=>d.id===id)?.quoteId));
    const options=workflow().proformas.filter(p=>p.clientId===invoice.clientId && quotes.has(p.quoteId)).map(p=>{const b=balance('proforma',p.id);return b?.availableCreditCents>0 ? [p.id,p.number+' · disponible '+money(b.availableCreditCents)] : null;}).filter(Boolean);
    if(!options.length) {
      openDialog('Anticipacions disponibles',balanceMarkup('invoice',invoiceId)+'<p class="hint">Encara no hi ha anticipacions cobrades per a aquest pressupost.</p><div class="form-actions">'+button('Tanca','dialog-close','',true)+'</div>');
      return;
    }
    openDialog('Aplica una anticipació cobrada',dialogForm('credit',`${balanceMarkup('invoice',invoiceId)}${field('proformaId','Proforma del mateix pressupost',select('proformaId',options,options[0][0]))}${field('amount','Import a aplicar (€)',input('amount','text','','required inputmode="decimal"'))}${humanReview('He revisat l’origen i l’import. No es pot aplicar més del que s’ha cobrat ni del saldo de la factura.')}`,'Aplica l’anticipació',`data-id="${escape(invoiceId)}"`));
  }
  function openWorkshop() {
    openDialog('Una feina al taller',dialogForm('workshop',`<div class="form-grid">${field('clientId','Client fictici',clientOptions(''))}${field('deliveryNoteId','Albarà (opcional)',select('deliveryNoteId',[['','Sense albarà'],...state.deliveryNotes.map(d=>[d.id,d.number+' · '+clientName(d.clientId)])],''))}${field('workshopName','Nom del taller fictici',input('workshopName','text','','required maxlength="160"'))}${field('dueDate','Lliurament previst',input('dueDate','date',serverToday(),'required'))}</div>${field('text','Feina prevista','<textarea name="text" id="text" required maxlength="2000" rows="4" aria-describedby="text-error"></textarea>')}${attachmentPicker()}<p class="field-help">Desa un text revisat. Una foto adjunta no es converteix automàticament en una ordre de producció.</p>`,'Desa la feina'),true);
  }
  function proformaDocument(p) {
    return `<article class="print-sheet"><header class="document-header"><img src="assets/newop-logo.png" width="150" height="45" alt="NEW OP"><div><h2>Proforma · no és factura</h2><strong>${escape(p.number)}</strong></div></header><div class="document-warning">Dades fictícies · Sense validesa fiscal o legal. Aquest document no registra un cobrament.</div><p>${escape(clientName(p.clientId))} · ${date(p.createdOn)}</p><p>Pressupost: ${escape(state.quotes.find(q=>q.id===p.quoteId)?.number || p.quoteId)}</p><p>Anticipació ${new Intl.NumberFormat('ca-ES').format(p.depositBps/100)} % sobre ${money(p.quoteTotalCents)}</p><h2>${money(p.amountCents)}</h2><p>Venciment: ${date(p.dueDate)}</p>${balanceMarkup('proforma',p.id)}<footer class="document-footer">NEW OP · Document de demostració imprimible. No es confirma cap transferència.</footer></article>`;
  }
  function showPrintable(title,markup) {
    $('#print-document').innerHTML=markup;
    openDialog(title,`<div class="actions">${button('Imprimeix el document','print','',false,'print')}</div>${markup}`,true);
  }
  function sampleMeetingPhoto(lines=['Reunió de mostra','25 camises de lli','Preparar el pressupost'],filename='llibreta-de-mostra.png') {
    const canvas=document.createElement('canvas');
    canvas.width=600;canvas.height=400;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f4eddf';ctx.fillRect(0,0,600,400);
    ctx.strokeStyle='#d6c8b5';
    for(let y=85;y<390;y+=43){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(570,y);ctx.stroke();}
    ctx.fillStyle='#302b25';ctx.font='bold 21px sans-serif';ctx.fillText('NEW OP · NOTES FICTÍCIES',35,55);
    ctx.font='italic 26px serif';
    lines.forEach((line,index)=>ctx.fillText(line,45,119+43*index));
    return new Promise(resolve=>canvas.toBlob(blob=>resolve(new File([blob],filename,{type:'image/png'})),'image/png'));
  }
  async function uploadAttachment(form, file=form.elements.attachmentFile?.files?.[0]) {
    clearErrors(form);
    if (!file) throw new InputError('Selecciona un arxiu.','attachmentFile');
    if (!file.size || file.size>1048576) throw new InputError('Cada arxiu ha de tenir entre 1 byte i 1 MiB.','attachmentFile');
    if (selectedAttachments(form).length>=5) throw new InputError('Aquest registre ja té 5 arxius seleccionats.','attachmentFile');
    if (attachmentJob || commandBusy) return;
    const job={controller:new AbortController(),form,serial:dialogSerial};attachmentJob=job;
    const run=$('[data-action="upload-attachment"]',form), cancel=$('[data-action="cancel-attachment"]',form), submit=$('[type="submit"]',form);
    const sample=$('[data-action="sample-meeting-photo"]',form);
    run.disabled=true;if(sample)sample.disabled=true;submit.disabled=true;cancel.hidden=false;setStatus('attachment-status','Pujant l’arxiu privat… El registre encara no s’ha desat.');
    try {
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
      for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const signature=JSON.stringify([file.name,file.type,btoa(binary)]);
      if (!attachmentPending || attachmentPending.signature!==signature) attachmentPending={signature,request:{filename:file.name,mimeType:file.type,contentBase64:btoa(binary),expectedRevision:state.revision,idempotencyKey:newKey()}};
      const result=await api('uploadAttachment',attachmentPending.request,{signal:job.controller.signal});
      if (job.serial!==dialogSerial || !form.isConnected) return;
      if (!result.ok) {
        const uncertain=['NETWORK_UNAVAILABLE','ABORTED','INVALID_RESPONSE','TIMEOUT','STORAGE_UNAVAILABLE','STORAGE_ERROR','UNAVAILABLE'].includes(result.error.code);
        if (!uncertain) attachmentPending=null;
        if (['STALE_REVIEW','REVISION_CONFLICT','STALE_REVISION','CONFLICT'].includes(result.error.code)) {const loaded=await store.refresh();if(loaded.ok)state=store.getState();}
        setStatus('attachment-status',errorMessage(result.error)+(uncertain ? ' Torna a provar el mateix arxiu per recuperar el rebut sense duplicar-lo.' : ' Les dades del formulari es conserven.'),true);return;
      }
      const metadata=result.data.attachment || result.data.result;
      if (!metadata || typeof metadata.id!=='string') {setStatus('attachment-status','La resposta de la pujada no és vàlida. Torna a provar el mateix arxiu per recuperar el rebut.',true);return;}
      const loaded=await store.refresh();
      if (!loaded.ok) {setStatus('attachment-status','El servidor ha rebut l’arxiu, però no s’ha pogut actualitzar la llista. Torna a provar per recuperar-lo sense duplicar-lo.',true);return;}
      state=store.getState();
      if (!attachmentById(metadata.id)) {setStatus('attachment-status','L’arxiu encara no consta a la llista actualitzada. Torna a provar per recuperar el rebut.',true);return;}
      const selected=[...selectedAttachments(form),metadata.id];
      $('#attachment-choices',form).innerHTML=attachmentChoices(selected);
      attachmentPending=null;form.elements.attachmentFile.value='';
      setStatus('attachment-status','Arxiu pujat al teu espai i seleccionat. Desa el formulari per vincular-lo al registre.');
    } finally {if (attachmentJob===job) attachmentJob=null;if (run.isConnected) run.disabled=false;if(sample?.isConnected)sample.disabled=false;if (submit.isConnected) submit.disabled=false;if (cancel.isConnected) cancel.hidden=true;}
  }
  async function workflowAction(action,id,el) {
    switch(action) {
      case 'phase-scroll':document.getElementById(id)?.scrollIntoView({block:'start'});break;
      case 'edit-client-segment': {
        const client=state.clients.find(item=>item.id===id);
        openDialog('Tipus de client',dialogForm('client-segment',field('segment','Carpeta',select('segment',clientSegmentOptions,client.segment||'')),'Desa el tipus',`data-id="${escape(id)}"`));
        break;
      }
      case 'quote-costing':openCosting(id);break;
      case 'quote-final':openDialog('Crea el pressupost definitiu',dialogForm('quote-final',humanReview('El client ha acceptat l’orientació. Revisaré els imports definitius abans d’aprovar.'),'Crea l’esborrany definitiu',`data-id="${escape(id)}"`));break;
      case 'new-production':openProduction();break;
      case 'edit-production':openProduction(id);break;
      case 'next-production':openProduction(id,true);break;
      case 'print-production':printProduction(id);break;
      case 'direct-delivery':openDirectDelivery(id);break;
      case 'supplier-document':openSupplierDocument();break;
      case 'supplier-add':el.closest('form').querySelector('.supplier-lines').insertAdjacentHTML('beforeend',supplierRow());break;
      case 'supplier-remove':if(el.closest('form').querySelectorAll('.supplier-row').length>1)el.closest('.supplier-row').remove();break;
      case 'supplier-example':await loadSupplierExample(el.closest('form'));break;
      case 'supplier-annotations':loadSupplierAnnotations(el.closest('form'));break;
      case 'new-meeting':openMeeting(id);break;
      case 'manual-quote':openManualQuote(id);break;
      case 'meeting-draft': {const meeting=workflow().meetings.find(m=>m.id===id);if(meeting)newQuote(meeting.clientId,meeting);break;}
      case 'meeting-quote':openManualQuote('',id);break;
      case 'edit-manual-quote':openManualQuote('','',state.quotes.find(q=>q.id===id));break;
      case 'add-manual-line':$('#manual-lines',overlay).insertAdjacentHTML('beforeend',manualRow());break;
      case 'remove-manual-line':el.closest('[data-manual-line]').remove();break;
      case 'new-client-note':openClientNote(id);break;
      case 'new-purchase':openPurchase(id);break;
      case 'rebill-purchases':openRebill(id);break;
      case 'billing-profile':openBillingProfile(id);break;
      case 'new-proforma':openProforma(id);break;
      case 'receipt-invoice':openReceipt('invoice',id);break;
      case 'receipt-proforma':openReceipt('proforma',id);break;
      case 'apply-credit':openCredit(id);break;
      case 'new-workshop':openWorkshop();break;
      case 'sample-meeting-photo': {
        const form=el.closest('form');
        if(form.elements.attachmentFile.files.length) throw new InputError('Adjunta la foto seleccionada o treu-la abans de fer servir la mostra.','attachmentFile');
        const file=await sampleMeetingPhoto();
        if(!form.isConnected || !overlay.open)return true;
        await uploadAttachment(form,file);
        if (form.isConnected && Array.from(form.querySelectorAll('[name="attachmentIds"]:checked')).some(field=>attachmentById(field.value)?.filename===file.name)) {
          form.elements.notes.value ||= 'El client demana 25 camises de lli.';
          form.elements.summary.value ||= '25 camises de lli';
        }
        break;
      }
      case 'upload-attachment':await uploadAttachment(el.closest('form'));break;
      case 'cancel-attachment':attachmentJob?.controller.abort();break;
      case 'download-attachment': {
        const a=attachmentById(id);if (!a) throw new Error('Aquest arxiu no consta al teu espai.');
        el.disabled=true;
        try {const result=await api('downloadAttachment',id);if (!result.ok) throw new Error(errorMessage(result.error));downloadBlob(result.data.blob,a.filename);}finally {if(el.isConnected)el.disabled=false;}break;
      }
      case 'purchase-payment': {const p=workflow().purchases.find(p=>p.id===id);openDialog('Registra el pagament al proveïdor',dialogForm('purchase-payment',`<p><strong>${escape(p.reference)}</strong> · ${escape(p.supplierName)} · ${money(p.totals.totalCents)}</p><p class="small muted">${escape(clientName(p.clientId))} · ${escape(p.description)}</p>${field('paidOn','Data del pagament manual',input('paidOn','date',serverToday(),'required'))}${field('reference','Referència',input('reference','text','','required maxlength="100"'))}${humanReview('He comprovat el pagament. Aquesta acció no executa cap transferència ni contacta amb el banc.')}`,'Desa el pagament',`data-id="${escape(id)}"`));break;}
      case 'complete-workshop':openDialog('Registra el lliurament',dialogForm('workshop-complete',`${field('deliveredOn','Data operativa del lliurament',input('deliveredOn','date',serverToday(),'required'))}<p class="field-help">L’hora de registre del navegador es conservarà separada d’aquesta data.</p>`,'Confirma el lliurament',`data-id="${escape(id)}"`));break;
      case 'quote-response':openDialog('Registra la resposta del client',dialogForm('quote-response',`${field('respondedOn','Data de resposta',input('respondedOn','date',serverToday(),'required'))}${field('note','Nota (opcional)','<textarea name="note" id="note" maxlength="2000" rows="3" aria-describedby="note-error"></textarea>')}`,'Desa la resposta',`data-id="${escape(id)}"`));break;
      case 'followup-email': {
        const form=el.closest('form'), draft=followup.draft;
        if (!draft || store.getState().revision!==draft.stateRevision || followupKey(form)!==followup.key) throw new Error('L’esborrany ha canviat. Torna a generar-lo.');
        const text=form.elements.followupText.value;
        if (!text.trim() || text.length>500) throw new Error('Revisa un text de seguiment d’entre 1 i 500 caràcters.');
        const clientId=draft.clientId, refs=draft.sourceRefs || [];
        openPrepare(clientId);
        const prepared=$('[data-form="op-prepare"]',overlay);
        prepared.elements.subject.value='Seguiment del pressupost';prepared.elements.text.value=text;
        prepared.dataset.sourceRefs=JSON.stringify(refs);
        break;
      }
      case 'quote-followup': {
        const q=state.quotes.find(q=>q.id===id);openFollowup(q.clientId);
        followup.refs.forEach((ref,index)=>{if(ref.entityType==='quote' && ref.id===id){const c=$(`[name="sourceRef"][value="${index}"]`,overlay);if(c)c.checked=true;}});
        const instruction=$('[name="instruction"]',overlay);instruction.value='Prepara un text breu per demanar resposta sobre aquest pressupost, sense inventar terminis.';break;
      }
      case 'proforma-document':showPrintable('Proforma de demostració',proformaDocument(workflow().proformas.find(p=>p.id===id)));break;
      case 'scroll-section':document.getElementById(el.dataset.section)?.scrollIntoView({behavior:'smooth',block:'start'});break;
      case 'print-workshop': {
        const panel=$('#taller-setmana');const from=$('[name="from"]',panel).value,to=$('[name="to"]',panel).value;
        const result=store.query({type:'WORKSHOP_WEEK',from,to});if(!result.ok)throw new Error(result.error.message);
        showPrintable('Resum setmanal del taller',`<article class="print-sheet"><header class="document-header"><img src="assets/newop-logo.png" width="150" height="45" alt="NEW OP"><h2>Taller · ${date(from)} — ${date(to)}</h2></header><div class="document-warning">Dades fictícies. Resum de registres revisats; no és una extracció automàtica d’una foto.</div>${table(['Previst','Taller / client','Feina','Estat','Lliurat'],result.data.entries.map(e=>`<tr><td>${date(e.dueDate)}</td><td>${escape(e.workshopName)} · ${escape(clientName(e.clientId))}</td><td>${escape(e.text)}</td><td>${e.status==='delivered' ? 'Lliurada' : 'Pendent'}</td><td>${e.deliveredOn ? date(e.deliveredOn) : '—'}</td></tr>`))}</article>`);break;
      }
      case 'attachments-library':openDialog('Arxius privats i trasllat',`<p class="dialog-intro">Descarrega cada original abans de traslladar l’espai. El JSON conserva només metadades i referències: no inclou aquests bytes ni els rebuts de connectors. Per traslladar l’espai complet, segueix el procediment privat de servidor del manual: exportació i restauració atòmiques de dades i arxius. No editis el JSON ni reiniciïs l’espai.</p>${attachmentList(workflow().attachments.map(a=>a.id))}`,true);break;
      default:return false;
    }
    return true;
  }
  async function workflowSubmit(form,data) {
    const get=key=>String(data.get(key) ?? ''), ids=selectedAttachments(form);
    if (form.elements.attachmentFile?.files.length) {
      form.elements.attachmentFile.closest('details').open=true;
      throw new InputError('Prem «Adjunta la foto» per vincular el fitxer abans de desar.','attachmentFile');
    }
    if (ids.length>5) throw new InputError('Selecciona com a màxim 5 adjunts.','attachmentFile');
    switch(form.dataset.form) {
      case 'quote-filters':quoteFilter={client:get('filterClient'),status:get('filterStatus'),phase:get('filterPhase')};render();break;
      case 'delivery-filters': {
        const from=get('deliveryFrom'),to=get('deliveryTo');
        if(from&&to&&from>to)throw new InputError('La data final ha de ser igual o posterior a la inicial.','deliveryTo');
        deliveryFilter={client:get('deliveryClient'),status:get('deliveryStatus'),from,to};render();break;
      }
      case 'client-segment':await commit({type:'SET_CLIENT_SEGMENT',id:form.dataset.id,segment:get('segment')},form,'Tipus de client desat.');break;
      case 'quote-costing': {
        const costing=Object.fromEntries(['materials','trims','sewing','pressing','margin'].map(key=>[key,cents(get(key),key)]));
        costing.discounts=[25,50,100,300].map(n=>cents(get('discount'+n),'discount'+n));
        await commit({type:'SAVE_QUOTE_COSTING',id:form.dataset.id,lineId:get('lineId'),costing,terms:get('terms')},form,'Escandall aplicat a la peça.');break;
      }
      case 'quote-final':checkedHuman(data);await commit({type:'CREATE_FINAL_QUOTE',id:form.dataset.id,reviewed:true},form,'Esborrany definitiu creat.','pressupostos');break;
      case 'production-note': {
        const sizes=get('sizes').split(/[,\n]/).map(text=>text.trim()).filter(Boolean).map(text=>{
          const match=/^([^:]{1,15}):\s*(\d+)$/.exec(text);
          if(!match)throw new InputError('Escriu cada talla com S:5, M:10.','sizes');
          return {label:match[1].trim(),quantity:Number(match[2])};
        });
        const fields=Object.fromEntries(['clientId','stage','workshop','model','description','fabric','supplier','code','color','notes'].map(key=>[key,get(key)]));
        await commit({type:'SAVE_PRODUCTION',...fields,id:form.dataset.id || undefined,previousId:form.dataset.previousId || undefined,sizes,received:data.has('received')},form,'Albarà de producció desat.');break;
      }
      case 'direct-delivery':checkedHuman(data);await commit({type:'CREATE_DIRECT_DELIVERY',clientId:get('clientId'),model:get('model'),description:get('description'),quantity:Number(get('quantity')),unitPriceCents:cents(get('price'),'price'),productionId:form.dataset.productionId,reviewed:true},form,'Albarà de lliurament creat.','albarans');break;
      case 'supplier-document': {
        checkedHuman(data);
        if(!ids.length)throw new InputError('Adjunta la foto o el PDF del proveïdor.','attachmentFile');
        const unresolved=$$('[name="allocation"]',form).find(control=>control.value==='__unknown');
        if(unresolved){unresolved.dataset.errorField='allocation-unresolved';throw new InputError('Assigna un client o «Casa» als conceptes amb un client anotat desconegut.','allocation-unresolved');}
        const lines=$$('.supplier-row',form).map(row=>({description:$('[name="concept"]',row).value,clientId:$('[name="allocation"]',row).value,quantity:Number($('[name="units"]',row).value),unitCostCents:cents($('[name="price"]',row).value,'price')}));
        await commit({type:'SAVE_SUPPLIER_DOCUMENT',supplierName:get('supplierName'),reference:get('reference'),createdOn:get('createdOn'),attachmentIds:ids,lines,reviewed:true},form,'Albarà desat. Els conceptes assignats són a la fitxa dels clients.');break;
      }
      case 'record-meeting':checkedHuman(data);await commit({type:'RECORD_MEETING',clientId:get('clientId'),notes:get('notes'),summary:get('summary'),attachmentIds:ids},form,'Reunió desada amb el resum i les fonts.');break;
      case 'manual-quote': {
        checkedHuman(data);
        const rows=$$('[data-manual-line]',form);
        if(!rows.length)throw new InputError('Afegeix almenys una peça.',null);
        const lines=rows.map(row=>{const value=name=>$(`[name="${name}"]`,row).value;return {...(row.dataset.id ? {id:row.dataset.id} : {}),garmentCode:value('garmentCode'),label:value('label'),fabricId:value('fabricId') || null,quantity:Number(value('quantity')),unitPriceCents:value('priceMode')==='tariff' ? null : cents(value('unitPriceCents'),'lines')};});
        const editing=Boolean(form.dataset.id);
        const command=editing ? {type:'UPDATE_QUOTE_LINES',id:form.dataset.id,expectedQuoteRevision:Number(form.dataset.revision),tariff:get('tariff'),lines} : {type:'DRAFT_QUOTE_MANUAL',clientId:get('clientId'),...(get('meetingId') ? {meetingId:get('meetingId')} : {}),tariff:get('tariff'),lines,humanReviewed:true,phase:'initial'};
        await commit(command,form,'Peces desades com a esborrany. Revisa els imports abans d’aprovar.','pressupostos');break;
      }
      case 'client-note':await commit({type:'ADD_CLIENT_NOTE',clientId:get('clientId'),kind:get('kind'),text:get('text'),occurredOn:get('occurredOn') || null,dueDate:get('dueDate') || null,attachmentIds:ids},form,'Entrada afegida a la cronologia. Les anteriors es conserven.');break;
      case 'purchase':checkedHuman(data);await commit({type:'CREATE_PURCHASE',clientId:get('clientId'),supplierName:get('supplierName'),reference:get('reference'),purchasedOn:get('purchasedOn'),description:get('description'),quantity:Number(get('quantity')),unitCostCents:cents(get('unitCost'),'unitCost'),taxRateBps:cents(get('taxPercent'),'taxPercent'),dueDate:get('dueDate') || null,attachmentIds:ids},form,'Compra desada: pendent de refacturar i de pagar.');break;
      case 'rebill':checkedHuman(data);await commit({type:'CREATE_REBILL_INVOICE',purchaseIds:data.getAll('purchaseIds'),reviewed:true,expectedRevision:state.revision},form,'Factura de compres creada amb traçabilitat.','facturacio');break;
      case 'billing-profile':checkedHuman(data);await commit({type:'SET_CLIENT_BILLING_PROFILE',clientId:form.dataset.id,isNewClient:get('isNewClient')==='yes',paymentTermDays:Number(get('paymentTermDays')),depositBps:cents(get('depositPercent'),'depositPercent')},form,'Condicions demo desades.');break;
      case 'proforma':checkedHuman(data);await commit({type:'CREATE_PROFORMA',quoteId:form.dataset.id,reviewed:true,expectedRevision:state.revision},form,'Proforma creada. Encara no s’ha registrat cap cobrament.');break;
      case 'receipt':checkedHuman(data);await commit({type:'RECORD_RECEIPT',targetType:form.dataset.target,targetId:form.dataset.id,amountCents:cents(get('amount'),'amount'),receivedOn:get('receivedOn'),reference:get('reference'),reviewed:true},form,'Cobrament manual registrat. Cap càrrec bancari executat.');break;
      case 'credit':checkedHuman(data);await commit({type:'APPLY_PROFORMA_CREDIT',proformaId:get('proformaId'),invoiceId:form.dataset.id,amountCents:cents(get('amount'),'amount'),reviewed:true},form,'Anticipació aplicada al saldo de la factura.');break;
      case 'purchase-payment':checkedHuman(data);await commit({type:'MARK_PURCHASE_PAID',id:form.dataset.id,paidOn:get('paidOn'),reference:get('reference'),reviewed:true},form,'Pagament al proveïdor registrat manualment. Cap transferència executada.');break;
      case 'workshop':await commit({type:'CREATE_WORKSHOP_ENTRY',clientId:get('clientId'),deliveryNoteId:get('deliveryNoteId') || null,workshopName:get('workshopName'),text:get('text'),dueDate:get('dueDate'),attachmentIds:ids},form,'Feina de taller desada amb la seva data prevista.');break;
      case 'workshop-complete':await commit({type:'COMPLETE_WORKSHOP_ENTRY',id:form.dataset.id,deliveredOn:get('deliveredOn')},form,'Lliurament registrat amb hora del servidor.');break;
      case 'quote-response':await commit({type:'RECORD_QUOTE_RESPONSE',quoteId:form.dataset.id,respondedOn:get('respondedOn'),note:get('note')},form,'Resposta registrada. El pressupost ja no figura pendent de resposta.');break;
      case 'supplier-payment-range': {
        const from = get('paymentFrom');
        const to = get('paymentTo');
        if (!from || !to || from > to) throw new InputError('La data final ha de ser igual o posterior a la inicial.','paymentTo');
        paymentRange = {from, to};
        render();
        break;
      }
      case 'workshop-range': {
        const from=get('from'),to=get('to'),result=store.query({type:'WORKSHOP_WEEK',from,to});
        if(!result.ok)throw new InputError(result.error.message,'from');weekRange={from,to};render();break;
      }
      default:return false;
    }
    return true;
  }
  document.addEventListener('change',event=>{
    const form=event.target.closest('form');if(!form)return;
    if(form.dataset.form==='manual-quote') {
      const row=event.target.closest('[data-manual-line]');
      if(row && event.target.name==='priceMode') $('[name="unitPriceCents"]',row).disabled=event.target.value==='tariff';
      if(event.target.name==='clientId') form.elements.meetingId.innerHTML='<option value="">Sense reunió vinculada</option>'+workflow().meetings.filter(m=>m.clientId===event.target.value).map(m=>`<option value="${escape(m.id)}">${escape(formatDateTime(m.createdAt)+' · '+m.summary)}</option>`).join('');
    }
    if(form.dataset.form==='rebill') {
      if(event.target.name==='clientId') $('#rebill-choices',form).innerHTML=rebillChoices(event.target.value);
      const selected=dataPurchaseIds(form), purchases=workflow().purchases.filter(p=>selected.includes(p.id));
      const total=purchases.reduce((sum,p)=>sum+BigInt(p.totals.totalCents),0n);
      $('#rebill-total',form).textContent=`${purchases.length} compres · Total il·lustratiu: ${money(total)}`;
    }
    if(form.dataset.form==='production-note' && event.target.name==='fabric') {
      const fabric=state.fabrics.find(f=>f.name.toLowerCase()===event.target.value.trim().toLowerCase());
      if(fabric && !form.elements.supplier.value.trim()) form.elements.supplier.value=fabric.supplierName;
    }
    if(form.dataset.form==='workshop' && event.target.name==='clientId') form.elements.deliveryNoteId.innerHTML='<option value="">Sense albarà</option>'+state.deliveryNotes.filter(d=>d.clientId===event.target.value).map(d=>`<option value="${escape(d.id)}">${escape(d.number)}</option>`).join('');
  });
  function dataPurchaseIds(form) {return $$('[name="purchaseIds"]:checked',form).map(c=>c.value);}

  const moduleFolders=[['clients','Clients'],['facturacio','Facturació'],['pressupostos','Pressupostos'],['albarans','Albarans']];
  const phaseData=()=>state.phaseOne || {production:[],suppliers:[]};
  const quotePhase=q=>({initial:'Orientatiu',final:'Definitiu'}[q.phase] || 'Històric');
  const invoiceableQuote=q=>q.phase!=='initial' && ['approved','sent_simulated'].includes(q.status);
  const deadlineTone=(on,today)=>{
    const days=(Date.parse(on)-Date.parse(today))/86400000;
    return days<=1 ? ['urgent',days<0?'Endarrerida':'Urgent'] : days<=3 ? ['soon','Pròxima'] : ['planned','Amb marge'];
  };
  function renderHome() {
    if(route.id)return notFound();
    const today=serverToday();
    const pending=state.tasks.filter(t=>t.status==='pending').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const priorities=pending.filter(t=>t.dueDate<=today);
    const upcoming=pending.filter(t=>t.dueDate>today).slice(0,4);
    const list=tasks=>tasks.map(t=>{
      const [tone,label]=deadlineTone(t.dueDate,today);
      return `<div class="task-row"><div class="task-row-content">${link('seguiment',t.id,t.text)}<small>${escape(clientName(t.clientId))} · ${date(t.dueDate)}</small></div><span class="phase-chip ${tone}">${label}</span></div>`;
    }).join('');
    return heading('El teu espai de treball',date(today),button('Reunió amb foto','new-meeting','',false,'task')+button('Nou pressupost','manual-quote','',true,'plus')+'<a class="button secondary" href="#/calendari">'+icon('calendar')+' Obre el calendari</a>')+
      `<nav class="folder-grid" aria-label="Carpetes de treball">${moduleFolders.map(([slug,label])=>`<a class="folder-card folder-${slug}" href="${path(slug)}">${icon('folder')}<strong>${label}</strong>${icon('arrow')}</a>`).join('')}</nav>
      <div class="grid-2"><section class="panel">${panelHead('Tasques a fer avui','Avui i pendents endarrerides',button('Nova tasca','new-task','',true,'plus'))}<div class="panel-body">${priorities.length?list(priorities):empty('Tot al dia','Les tasques amb data d’avui apareixeran aquí.')}</div></section>
      <section class="panel">${panelHead('Pròximes tasques','Del calendari de treball','<a href="#/calendari">Veure calendari</a>')}<div class="panel-body">${upcoming.length?list(upcoming):empty('Cap tasca prevista','Pots programar-ne una al calendari.')}</div></section></div>`;
  }
  let quoteFilter={client:'',status:'',phase:''};
  function filteredQuotes() {
    return state.quotes.filter(q=>(!quoteFilter.client||q.clientId===quoteFilter.client)&&(!quoteFilter.status||q.status===quoteFilter.status)&&(!quoteFilter.phase||q.phase===quoteFilter.phase));
  }
  function quoteFilters() {
    const statuses=['draft','approved','sent_simulated'].map(key=>[key,statusLabels[key]]);
    return `<div class="panel-body"><form data-form="quote-filters" class="toolbar">
      ${field('filterClient','Client',select('filterClient',[['','Tots'],...state.clients.map(c=>[c.id,c.name])],quoteFilter.client))}
      ${field('filterStatus','Estat',select('filterStatus',[['','Tots'],...statuses],quoteFilter.status))}
      ${field('filterPhase','Fase',select('filterPhase',[['','Totes'],['initial','Orientatiu'],['final','Definitiu']],quoteFilter.phase))}
      <button type="submit" class="button">Filtra</button></form></div>`;
  }
  function quotePhasePanel(q) {
    const final=state.quotes.find(item=>item.initialQuoteId===q.id);
    const initial=state.quotes.find(item=>item.id===q.initialQuoteId);
    const refs=final ? link('pressupostos',final.id,'Definitiu '+final.number) : initial ? link('pressupostos',initial.id,'Orientatiu '+initial.number) : '';
    const conversion=q.phase==='initial'&&q.status!=='draft'&&!final ? button('Crea el definitiu','quote-final',q.id) : '';
    return `<section class="panel">${panelHead('Pressupost '+quotePhase(q).toLowerCase(),'',
      (q.status==='draft'?button('Escandall i condicions','quote-costing',q.id,true):'')+conversion)}
      ${refs||q.terms ? `<div class="panel-body">${refs}${q.terms?`<p class="notes">${escape(q.terms)}</p>`:''}</div>` : ''}</section>`;
  }
  function costingTiers(b) {
    const base=(BigInt(b.materials)+BigInt(b.trims)+BigInt(b.sewing)+BigInt(b.pressing))*BigInt(10000+b.margin);
    return [25,50,100,300].map((quantity,i)=>({quantity,unitCents:(base*BigInt(10000-b.discounts[i])+50000000n)/100000000n}));
  }
  function quoteVolumePaper(quote) {
    const pieces=quote.lines.flatMap(line=>{
      const costing=quote.lineCostings?.[line.id] || (quote.lines.length===1 ? quote.costing : null);
      return costing ? [[line,costing]] : [];
    });
    if(!pieces.length)return '';
    return `<section class="paper-notes"><h4>Preus orientatius per volum</h4>${table(['Peça','Unitats','Preu unitari','Import'],pieces.flatMap(([line,costing])=>costingTiers(costing).map(tier=>
      `<tr><td>${escape(line.label)}</td><td class="mono">${tier.quantity}</td><td class="mono">${money(tier.unitCents)}</td><td class="mono">${money(tier.unitCents*BigInt(tier.quantity))}</td></tr>`)))}
      <p class="small">Preus aproximats calculats amb l’escandall desat.</p></section>`;
  }
  function openCosting(id) {
    const q=state.quotes.find(q=>q.id===id);
    const defaultCost={materials:0,trims:0,sewing:0,pressing:0,margin:0,discounts:[0,0,0,0]};
    const costFor=id=>q.lineCostings?.[id] || (q.lines.length===1 ? q.costing : null) || defaultCost;
    const b=costFor(q.lines[0].id);
    const entries=[['materials','Teixit per unitat (€)'],['trims','Fornitures per unitat (€)'],['sewing','Confecció per unitat (€)'],['pressing','Planxa per unitat (€)'],['margin','Recàrrec de gestió (%)']];
    const textAmount=(name,label,amount)=>field(name,label,input(name,'text',decimalMoney(amount),'inputmode="decimal" required'));
    openDialog('Escandall i condicions',dialogForm('quote-costing',
      field('lineId','Peça',select('lineId',q.lines.map(line=>[line.id,line.label]),q.lines[0].id))+
      '<div class="form-grid">'+entries.map(([key,label])=>textAmount(key,label,b[key])).join('')+'</div>'+
      '<h3>Descompte segons volum</h3><div class="form-grid">'+[25,50,100,300].map((qty,i)=>textAmount('discount'+qty,qty+' unitats (%)',b.discounts[i])).join('')+'</div>'+
      '<div id="costing-preview" role="status"></div>'+
      field('terms','Condicions de la plantilla',`<textarea id="terms" name="terms" maxlength="1200" rows="3">${escape(q.terms||'')}</textarea>`),
      'Aplica a la peça',`data-id="${escape(q.id)}"`),true);
    const form=$('[data-form="quote-costing"]',overlay);
    const preview=()=>{
      try {
        const get=key=>cents(form.elements[key].value,key);
        const unit=['materials','trims','sewing','pressing'].reduce((n,key)=>n+BigInt(get(key)),0n);
        const base=unit*BigInt(10000+get('margin'));
        $('#costing-preview',form).innerHTML='<ul class="costing-tiers">'+[25,50,100,300].map(qty=>{
          const discount=get('discount'+qty);
          if(discount>10000)throw Error();
          const price=(base*BigInt(10000-discount)+50000000n)/100000000n;
          return `<li><strong>${qty} unitats</strong><span>${money(price)} / u.</span><span>${money(price*BigInt(qty))}</span></li>`;
        }).join('')+'</ul>';
      } catch (_) {$('#costing-preview',form).textContent='Revisa els imports i els percentatges.';}
    };
    form.elements.lineId.addEventListener('change',()=>{
      const costing=costFor(form.elements.lineId.value);
      for(const [key] of entries)form.elements[key].value=decimalMoney(costing[key]);
      [25,50,100,300].forEach((qty,i)=>{form.elements['discount'+qty].value=decimalMoney(costing.discounts[i]);});
      preview();
    });
    form.addEventListener('input',preview);preview();
  }
  function productionActions(row) {
    if(row.status==='pending') return button('Edita / rep','edit-production',row.id,true);
    const next=phaseData().production.find(item=>item.previousId===row.id);
    if(next) return `<span class="small muted">Continua a ${escape(next.stage)} · ${escape(next.id.toUpperCase())}</span>`;
    const delivered=state.deliveryNotes.some(note=>note.productionId===row.id);
    return (row.stage!=='Planxa'&&!delivered?button('Pas següent','next-production',row.id,true):'')+button('Prepara el lliurament','direct-delivery',row.id,true);
  }
  function productionTable(rows) {
    return rows.length?table(['Albarà','Client / taller','Model','Talles','Estat','Accions'],rows.map(row=>
      `<tr><td>${escape(row.id.toUpperCase())}<br>${date(row.createdOn)}</td><td>${link('clients',row.clientId,clientName(row.clientId))}<br>${escape(row.workshop)}</td><td>${escape(row.model)} · ${escape(row.description)}</td><td>${row.sizes.map(size=>escape(size.label)+': '+size.quantity).join(' · ')}</td><td>${escape(row.stage)} · ${row.status==='received'?'Rebut':'Pendent'}</td><td>${button('Document','print-production',row.id,true,'print')}${productionActions(row)}</td></tr>`))
      : empty('Cap albarà de producció','Crea un albarà vinculat al client i al taller.');
  }
  let deliveryFilter={client:'',status:'',from:'',to:''};
  const invoicedDelivery=note=>state.invoices.some(invoice=>invoice.deliveryNoteIds.includes(note.id));
  function deliveryFilters() {
    const statuses=[['','Tots'],['workshop','Al taller'],['ready','A punt'],['delivered','Lliurat'],['uninvoiced','Lliurat sense facturar']];
    return `<section class="panel"><div class="panel-body"><form data-form="delivery-filters" class="toolbar">
      ${field('deliveryClient','Client',select('deliveryClient',[['','Tots'],...state.clients.map(c=>[c.id,c.name])],deliveryFilter.client))}
      ${field('deliveryStatus','Estat del lliurament',select('deliveryStatus',statuses,deliveryFilter.status))}
      ${field('deliveryFrom','Des del dia',input('deliveryFrom','date',deliveryFilter.from))}
      ${field('deliveryTo','Fins al dia',input('deliveryTo','date',deliveryFilter.to))}
      ${formError}<button type="submit" class="button">Filtra</button></form></div></section>`;
  }
  function deliverySections() {
    const {client,status,from,to}=deliveryFilter;
    const dateMatches=record=>(!from||record.createdOn>=from)&&(!to||record.createdOn<=to);
    const production=phaseData().production.filter(row=>(!client||row.clientId===client)&&dateMatches(row));
    const notes=state.deliveryNotes.filter(note=>dateMatches(note)&&(!client||note.clientId===client)&&(!status||(status==='uninvoiced'?note.status==='delivered'&&!invoicedDelivery(note):note.status===status)));
    const suppliers=phaseData().suppliers.filter(doc=>dateMatches(doc)&&(!client||doc.lines.some(line=>line.clientId===client)));
    return heading('Albarans','Producció, lliuraments i costos dels proveïdors.')+
      '<nav class="actions section-title" aria-label="Tipus d’albarà">'+[['produccio','Producció'],['lliurament','Lliurament'],['proveidor','Proveïdor']].map(([id,label])=>`<button class="button secondary" data-action="phase-scroll" data-id="${id}">${label}</button>`).join('')+'</nav>'+deliveryFilters()+
      `<section id="produccio" class="panel">${panelHead('Producció','Tall, confecció i planxa',button('Nou albarà de producció','new-production','',false,'plus'))}${productionTable(production)}</section>
      <section id="lliurament" class="panel">${panelHead('Lliurament','La factura es genera a partir dels albarans lliurats; en pots agrupar diversos del mateix client.',button('Nou albarà de lliurament','direct-delivery','',false,'plus')+button('Factura albarans lliurats','new-invoice','',true,'invoice')+button('Des d’un pressupost definitiu','new-delivery','',true))}${deliveryTable(notes)}</section>
      <section id="proveidor" class="panel">${panelHead('Proveïdor','Assigna cada concepte al client que l’ha de pagar.',button('Nou albarà de proveïdor','supplier-document','',false,'plus'))}<div class="panel-body">${suppliers.length?suppliers.map(supplierCard).join(''):empty('Cap albarà de proveïdor','Pots adjuntar una foto o un PDF i revisar els conceptes.')}</div></section>`+workshopPanel();
  }
  function supplierCard(doc) {
    const sum=lines=>lines.reduce((n,line)=>n+BigInt(line.unitCostCents)*BigInt(line.quantity),0n);
    const purchaseState=line=>{
      if(!line.clientId) return 'Despesa de casa';
      const purchase=workflow().purchases.find(p=>p.id===line.purchaseId);
      return purchase?.invoiceId ? link('facturacio',purchase.invoiceId,'Refacturat · '+(state.invoices.find(i=>i.id===purchase.invoiceId)?.number || purchase.invoiceId)) : 'Pendent de refacturar';
    };
    return `<article class="record-card"><h3>${escape(doc.reference)} · ${escape(doc.supplierName)}</h3><p>${date(doc.createdOn)}</p>${attachmentList(doc.attachmentIds)}
      ${table(['Concepte','Assignació','Unitats','Preu unitari','Estat'],doc.lines.map(line=>`<tr><td>${escape(line.description)}</td><td>${line.clientId?link('clients',line.clientId,clientName(line.clientId)):'Casa · New Op'}</td><td>${line.quantity}</td><td>${money(line.unitCostCents)}</td><td>${purchaseState(line)}</td></tr>`))}
      <p class="small">Repercutible a clients: <strong>${money(sum(doc.lines.filter(line=>line.clientId)))}</strong> · Despesa de casa: <strong>${money(sum(doc.lines.filter(line=>!line.clientId)))}</strong> · Bases sense impost.</p></article>`;
  }
  function openProduction(id='',next=false) {
    const row=phaseData().production.find(row=>row.id===id)||{};
    const stages=['Tall','Confecció','Planxa'];
    const stage=next ? stages[stages.indexOf(row.stage)+1] : row.stage||stages[0];
    const productionFields=[['workshop','Taller','required maxlength="120"'],['model','Número de model','required maxlength="20"'],['description','Descripció','required maxlength="400"'],['fabric','Teixit','list="production-fabrics" maxlength="120"'],['supplier','Proveïdor del teixit','maxlength="120"'],['code','Codi del teixit','maxlength="80"'],['color','Color','maxlength="80"']];
    const fields=productionFields.map(([key,label,extra])=>field(key,label,input(key,'text',row[key]||'',extra))).join('');
    const stageChoices=next||(id&&row.previousId)?[stage]:stages;
    openDialog('Albarà de producció',dialogForm('production-note',
      `${next?`<p class="dialog-intro">Continua ${escape(row.id.toUpperCase())} (${escape(row.stage)} rebut) amb les quantitats reals. Corregeix-les si el taller n’ha comptat unes altres.</p>`:''}<div class="form-grid">${field('clientId','Client',clientOptions(row.clientId||''))}${field('stage','Operació',select('stage',stageChoices.map(s=>[s,s]),stage))}${fields}</div><datalist id="production-fabrics">${state.fabrics.map(f=>`<option value="${escape(f.name)}"></option>`).join('')}</datalist>
      ${field('sizes','Quantitats per talla',`<textarea id="sizes" name="sizes" rows="2" required>${escape(row.sizes?.map(s=>s.label+':'+s.quantity).join(', ')||'')}</textarea>`,'Per exemple, S:5, M:10, L:15. En rebre les peces, indica el recompte real.')}
      ${field('notes','Observacions tècniques',`<textarea id="notes" name="notes" rows="3" maxlength="1200">${escape(row.notes||'')}</textarea>`)}
      ${id&&!next?'<label class="check-field"><input type="checkbox" name="received"> Marca com a rebut amb aquestes quantitats</label>':''}`,
      'Desa l’albarà',`data-id="${escape(next?'':id)}"${next?` data-previous-id="${escape(id)}"`:''}`),true);
  }
  function printProduction(id) {
    const row=phaseData().production.find(row=>row.id===id);
    if(!row)return;
    showPrintable('Albarà de producció',`<article class="print-sheet paper-document"><header class="paper-brand"><div><h3>Albarà de producció ${escape(row.id.toUpperCase())}</h3><p>${date(row.createdOn)} · ${escape(row.stage)}</p></div><img src="assets/newop-logo.png" width="200" alt="NEW OP"></header>
      <h3>${escape(row.workshop)}</h3><p>${escape(clientName(row.clientId))}</p><p>${escape(row.model)} · ${escape(row.description)}</p>
      <p>${[row.fabric,row.supplier,row.code,row.color].filter(Boolean).map(escape).join(' · ')}</p>
      ${table(row.sizes.map(size=>size.label).concat('Total'),[`<tr>${row.sizes.map(size=>`<td>${size.quantity}</td>`).join('')}<td>${row.sizes.reduce((n,s)=>n+s.quantity,0)}</td></tr>`])}
      ${row.notes?`<section class="paper-notes"><h4>Observacions tècniques</h4><p class="notes">${escape(row.notes)}</p></section>`:''}<footer class="paper-footer">Document de demostració</footer></article>`);
  }
  function openDirectDelivery(id='') {
    const row=phaseData().production.find(row=>row.id===id);
    const assigned=state.deliveryNotes.filter(note=>row&&note.productionId===row.id).flatMap(note=>note.lines).reduce((n,line)=>n+line.quantity,0);
    const quantity=row ? row.sizes.reduce((n,size)=>n+size.quantity,0)-assigned : 1;
    if(quantity<=0){notify('Totes les peces rebudes ja són en albarans de lliurament.');return;}
    const agreed=row && state.quotes.filter(q=>q.clientId===row.clientId&&q.phase==='final'&&invoiceableQuote(q)).reverse()
      .flatMap(q=>q.lines).find(line=>line.garmentCode.toLowerCase()===row.model.toLowerCase());
    const description=row?.description.slice(0,160)||'';
    openDialog('Albarà de lliurament',dialogForm('direct-delivery',
      `<div class="form-grid">${field('clientId','Client',clientOptions(row?.clientId||''))}${field('model','Model',input('model','text',row?.model||'','required maxlength="20"'))}${field('description','Descripció',input('description','text',description,'required maxlength="160"'))}
      ${field('quantity','Unitats per lliurar',input('quantity','number',quantity,'min="1" step="1" required'))}${field('price','Preu unitari acordat (€)',input('price','text',agreed?decimalMoney(agreed.unitPriceCents):'','inputmode="decimal" required'))}</div>`+humanReview('He comprovat el recompte final i el preu acordat.'),
      'Crea l’albarà',`data-production-id="${escape(id)}"`),true);
  }
  let supplierSequence=0;
  function supplierRow(concept='',clientId='',units=1,price='',unknown='') {
    const index=++supplierSequence;
    const item=(label,name,type,value,attrs='')=>field(name+index,label,input(name,type,value,attrs).replace('id="'+name+'"','id="'+name+index+'"'));
    return `<fieldset class="supplier-row"><legend>Concepte del proveïdor</legend><div class="form-grid">${item('Concepte','concept','text',concept,'required')}${item('Unitats','units','number',units,'required min="1" step="1"')}${item('Cost unitari (€)','price','text',price,'required inputmode="decimal"')}
      ${field('allocation'+index,'Assigna a',select('allocation',[...(unknown?[['__unknown','Revisa: «'+unknown+'»']]:[]),['','Casa · New Op (no es repercuteix)'],...state.clients.map(c=>[c.id,c.name])],unknown?'__unknown':clientId).replace('id="allocation"','id="allocation'+index+'"').replace('aria-describedby="allocation-error"','aria-describedby="allocation'+index+'-error"'))}</div>${unknown?`<p class="field-help">El client anotat «${escape(unknown)}» no coincideix amb cap fitxa. Tria’n un o marca «Casa» abans de desar.</p>`:''}${button('Treu el concepte','supplier-remove','',true)}</fieldset>`;
  }
  function openSupplierDocument() {
    openDialog('Albarà de proveïdor',dialogForm('supplier-document',
      `<div class="form-grid">${field('supplierName','Proveïdor',input('supplierName','text','','required'))}${field('reference','Número o referència',input('reference','text','','required'))}${field('createdOn','Data de l’albarà',input('createdOn','date',serverToday(),'required'))}</div>
      ${attachmentPicker(false,true)}<div class="actions">${button('Afegeix un concepte','supplier-add','',true,'plus')}${button('Carrega una mostra simulada','supplier-example','',true)}</div>
      <details class="attachment-picker"><summary>Enganxa els conceptes anotats</summary>${field('annotations','Text revisat','<textarea id="annotations" name="annotations" rows="3" placeholder="Folre | 3 | 4,50 | Estudi Brisa"></textarea>','Una línia per concepte amb el format concepte | unitats | preu | client.')}${button('Proposa les assignacions','supplier-annotations','',true)}</details><div class="supplier-lines">${supplierRow()}</div>`+humanReview('He revisat els imports i el client assignat a cada concepte.'),
      'Desa i assigna els costos'),true);
  }
  function loadSupplierAnnotations(form) {
    const rows=form.elements.annotations.value.split(/\n/).map(line=>line.trim()).filter(Boolean);
    if(!rows.length||rows.length>50)throw new InputError('Enganxa entre 1 i 50 conceptes.','annotations');
    const normalize=text=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
    const values=rows.map(row=>{
      const [concept,quantity,price,name='',...extra]=row.split('|').map(part=>part.trim());
      if(!concept||!/^\d+$/.test(quantity||'')||Number(quantity)<1||price===undefined||extra.length)throw new InputError('Format: concepte | unitats | preu | client.','annotations');
      cents(price,'annotations');
      const client=state.clients.find(client=>normalize(client.name)===normalize(name));
      return {concept,quantity,price,clientId:client?.id||'',unknown:!client&&name&&!['casa','new op','newop'].includes(normalize(name))?name:''};
    });
    $('.supplier-lines',form).innerHTML=values.map(line=>supplierRow(line.concept,line.clientId,line.quantity,line.price,line.unknown)).join('');
    form.elements.reviewed.checked=false;
  }
  async function loadSupplierExample(form) {
    const source=await sampleMeetingPhoto(['ALBARÀ DE PROVEÏDOR · MOSTRA','Folre cru · 3 × 4,50 €','Folre negre · 2 × 5,00 €','Agulles · 1 × 2,00 €'],'albara-proveidor-mostra.png');
    if(!form.isConnected)return;
    form.elements.supplierName.value='Proveïdor de mostra';
    form.elements.reference.value='MOSTRA-'+Date.now().toString(36).toUpperCase();
    $('.supplier-lines',form).innerHTML=supplierRow('Folre cru',state.clients[0].id,3,'4,50')+supplierRow('Folre negre',state.clients[1].id,2,'5,00')+supplierRow('Agulles', '',1,'2,00');
    form.elements.attachmentFile.closest('details').open=true;
    await uploadAttachment(form,source);
  }
  function quoteTable(quotes) {
    if (!quotes.length) return empty('Cap pressupost encara','Crea un esborrany a partir de notes fictícies.',button('Nou pressupost','new-quote','',false,'plus'));
    return table(['Document','Client fictici','Data','Estat','Total demo'],quotes.map(q => `<tr><td>${link('pressupostos',q.id,q.number)}<span class="cell-secondary">${quotePhase(q)} · Rev. ${q.revision}</span></td><td>${link('clients',q.clientId,clientName(q.clientId))}</td><td>${date(q.createdOn)}</td><td>${badge(q.status)}</td><td class="mono">${money(q.totals.totalCents)}</td></tr>`));
  }
  function deliveryTable(notes) {
    if (!notes.length) return empty('Cap albarà encara','Comença amb un pressupost aprovat per preparar la producció.',button('Nou albarà','new-delivery','',false,'plus'));
    return table(['Albarà','Client fictici','Pressupost','Estat','Total demo'],notes.map(d => `<tr><td>${link('albarans',d.id,d.number)}<span class="cell-secondary">${date(d.createdOn)}</span></td><td>${link('clients',d.clientId,clientName(d.clientId))}</td><td>${d.quoteId ? link('pressupostos',d.quoteId,state.quotes.find(q => q.id === d.quoteId)?.number || d.quoteId) : '—'}</td><td>${badge(d.status)}</td><td class="mono">${money(d.totals.totalCents)}</td></tr>`));
  }
  function invoiceTable(invoices) {
    if (!invoices.length) return empty('Cap factura encara','Agrupa albarans lliurats d’un mateix client per crear una factura il·lustrativa.',button('Prepara una factura','new-invoice','',false,'plus'));
    return table(['Factura demo','Client fictici','Origen','Estat','Total demo'],invoices.map(i => `<tr><td>${link('facturacio',i.id,i.number)}<span class="cell-secondary">${date(i.createdOn)}</span></td><td>${link('clients',i.clientId,clientName(i.clientId))}</td><td>${i.origin === 'purchase' ? (i.purchaseIds || []).length + ' compres' : i.deliveryNoteIds.length + ' albarans'}</td><td>${badge(i.paymentStatus)}</td><td class="mono">${money(i.totals.totalCents)}</td></tr>`));
  }
  function linesTable(lines, editable = false) {
    return table(editable ? ['Peça / teixit','Quantitat','Preu unitari (€)','Origen del preu'] : ['Peça','Teixit','Quantitat','Preu unitari'],lines.map((l,index) => {
      const quantityId = `quote-line-${index}-quantity`, priceId = `quote-line-${index}-price`;
      return `<tr${editable ? ` data-line-id="${escape(l.id)}"` : ''}><td>${escape(l.label)}<span class="cell-secondary">${escape(l.garmentCode)}${editable ? ' · '+escape(fabricName(l.fabricId)) : ''}</span></td>${editable ? `<td><input id="${quantityId}" type="number" name="quantity" data-error-field="lines[${index}].quantity" aria-describedby="${quantityId}-error" aria-label="Quantitat · ${escape(l.label)}" min="1" step="1" value="${l.quantity}" required><span class="field-error" id="${quantityId}-error"></span></td><td><input id="${priceId}" type="text" inputmode="decimal" name="unitPriceCents" data-error-field="lines[${index}].unitPriceCents" aria-describedby="${priceId}-error" data-money aria-label="Preu unitari en euros · ${escape(l.label)}" value="${decimalMoney(l.unitPriceCents)}"${l.priceMode === 'tariff' ? ' disabled' : ''}><span class="field-error" id="${priceId}-error"></span></td><td><select id="quote-line-${index}-price-mode" name="priceMode" aria-label="Origen del preu · ${escape(l.label)}"><option value="tariff"${l.priceMode === 'tariff' ? ' selected' : ''}>Segons tarifa</option><option value="manual"${l.priceMode === 'manual' ? ' selected' : ''}>Preu manual</option></select></td>` : `<td>${l.fabricId ? link('teixits',l.fabricId,fabricName(l.fabricId)) : 'Sense teixit vinculat'}</td><td class="mono">${l.quantity}</td><td class="mono">${money(l.unitPriceCents)}</td>`}</tr>`;
    }));
  }

  function detailHeader(entity, label, actions) {
    return `<a class="back-link" href="${path(route.module)}">${icon('back')} Torna a ${escape(modules.find(m => m[0] === route.module)[1].toLowerCase())}</a>` + heading(entity.number || label,clientName(entity.clientId),actions,label.toUpperCase() + ' · DADES FICTÍCIES') + `<dl class="details-meta"><div><dt>Client fictici</dt><dd>${link('clients',entity.clientId,clientName(entity.clientId))}</dd></div><div><dt>Data de l’escenari</dt><dd>${date(entity.createdOn)}</dd></div><div><dt>Estat</dt><dd>${badge(entity.paymentStatus || entity.status)}</dd></div></dl>`;
  }

  function renderQuotesBase() {
    if (!route.id) return heading('Pressupostos','De la reunió al pressupost: peces, imports i fonts, sempre revisats.',button('Entrada manual','manual-quote','',false,'plus') + button('Desa una reunió','new-meeting','',true,'task') + button('Notes assistides','new-quote','',true,'query')) + `<section class="panel">${panelHead('Totes les propostes','Tarifes i imports exclusivament il·lustratius')}${quoteFilters()+quoteTable(filteredQuotes())}</section>`;
    const q = state.quotes.find(item => item.id === route.id);
    if (!q) return notFound();
    const actions = button('Document','document',q.id,true,'print') + (invoiceableQuote(q) && q.lines.some(line=>remainingQuantity(q,line)>0) ? button('Crea un albarà','new-delivery',q.id,false,'plus') : '');
    let content = detailHeader(q,'Pressupost',actions);
    if (q.status === 'draft') {
      content += `<form id="quote-editor" data-form="edit-quote" data-id="${escape(q.id)}" novalidate><section class="panel">${panelHead('Revisa les peces','Desar qualsevol canvi anul·la la revisió anterior.')}<div class="panel-body">${formError}${field('tariff','Tarifa il·lustrativa',tariffOptions('tariff',q.tariff))}<div class="line-editor">${linesTable(q.lines,true)}</div><p class="field-help">Amb «Segons tarifa», el motor recalcula el preu en desar. «Preu manual» permet editar-lo. Imports en euros, màxim dos decimals.</p><div class="form-actions"><button type="submit" class="button secondary">Desa els canvis</button></div></div></section></form><p id="quote-dirty" class="review-status pending" hidden>Hi ha canvis sense desar. Desa’ls abans de revisar o aprovar.</p><p class="review-status ${q.reviewedRevision === q.revision ? '' : 'pending'}">${q.reviewedRevision === q.revision ? 'Revisió humana confirmada per a la revisió ' + q.revision + '.' : 'Pendent de revisió humana explícita.'}</p><div class="actions">${button('Revisa el pressupost','review-quote',q.id,true,'check')}${button('Aprova el pressupost','approve-quote',q.id)}</div>`;
    } else {
      content += `<section class="panel">${panelHead('Peces del pressupost','Contingut revisat · Tarifa ' + q.tariff)}${linesTable(q.lines)}${totals(q.totals,q.taxRateBps)}</section>`;
      if (q.status === 'approved') content += `<div class="actions section-title">${button('Marca l’enviament simulat','send-quote',q.id)}</div>`;
    }
    if (q.status === 'draft') content += `<section class="panel">${panelHead('Imports desats','Els canvis es reflecteixen després de desar.')}${totals(q.totals,q.taxRateBps)}</section>`;
    return content + `<section class="panel">${panelHead('Notes originals','Conservades tal com es van introduir')}<div class="panel-body notes">${escape(q.notes)}</div></section>`;
  }

  function renderDeliveriesBase() {
    if (!route.id) return '';
    const d = state.deliveryNotes.find(item => item.id === route.id);
    if (!d) return notFound();
    const next = d.status === 'workshop' ? ['ready','Marca a punt'] : d.status === 'ready' ? ['delivered','Marca lliurat'] : null;
    return detailHeader(d,'Albarà',button('Document','document',d.id,true,'print') + (next ? `<button type="button" class="button" data-action="delivery-status" data-id="${escape(d.id)}" data-status="${next[0]}">${next[1]}</button>` : button('Prepara una factura','new-invoice',d.id))) + `<p class="small muted">Pressupost d’origen: ${d.quoteId ? link('pressupostos',d.quoteId,state.quotes.find(q => q.id === d.quoteId)?.number || d.quoteId) : '—'}</p><section class="panel">${panelHead('Peces de l’albarà','Quantitats i preus conservats en crear el document')}${linesTable(d.lines)}${totals(d.totals,d.taxRateBps)}</section><div class="hint">Circuit de taller: Al taller → A punt → Lliurat. Aquest albarà és una simulació.</div>`;
  }

  function renderInvoicesBase() {
    if (!route.id) return heading('Facturació','Documents il·lustratius, sempre després de revisar.',button('Exporta CSV comptable','csv-dialog','',true,'invoice') + button('Prepara una factura','new-invoice','',false,'plus')) + `<section class="panel">${panelHead('Factures de demostració','Sense validesa fiscal o legal · cap moviment bancari')}${invoiceTable(state.invoices)}</section>`;
    const i = state.invoices.find(item => item.id === route.id);
    if (!i) return notFound();
    return detailHeader(i,'Factura il·lustrativa',button('Document','document',i.id,true,'print') + (i.paymentStatus === 'pending' ? button('Registra un cobrament','receipt-invoice',i.id) : '')) + `<div class="hint"><strong>${i.origin === 'purchase' ? 'Compres refacturades' : 'Albarans d’origen'}</strong><div class="source-links">${i.origin === 'purchase' ? (i.purchaseIds || []).map(id => {const purchase = workflow().purchases.find(p => p.id === id);return purchase ? link('clients',purchase.clientId,purchase.reference + ' · ' + purchase.supplierName) : escape(id);}).join(' · ') : i.deliveryNoteIds.map(id => link('albarans',id,state.deliveryNotes.find(d => d.id === id)?.number || id)).join('')}</div></div><section class="panel">${panelHead('Detall de la factura demo','Snapshots de les peces · imports ficticis')}${linesTable(i.lines)}${totals(i.totals,i.taxRateBps)}</section><p class="small muted">Revisió humana de l’estat ${i.reviewedAtRevision}. Els registres de cobrament i les anticipacions es detallen al saldo. No s’executen moviments bancaris.</p>`;
  }

  function taskTable(tasks) {
    return tasks.length ? table(['Seguiment','Client fictici','Data prevista','Estat','Acció'],tasks.map(t => `<tr><td>${link('seguiment',t.id,t.text)}</td><td>${link('clients',t.clientId,clientName(t.clientId))}</td><td>${date(t.dueDate)}</td><td>${badge(t.status)}</td><td>${t.status === 'pending' ? button('Completa','complete-task',t.id,true,'check') : 'Completada'}</td></tr>`)) : empty('Cap seguiment en aquest estat','Pots afegir una nota amb una data per continuar el fil amb un client fictici.');
  }
  function renderTasksBase() {
    if (route.id) {
      const t = state.tasks.find(item => item.id === route.id);
      if (!t) return notFound();
      return `<a class="back-link" href="#/seguiment">${icon('back')} Torna al seguiment</a>` + heading('Nota de seguiment',clientName(t.clientId),t.status === 'pending' ? button('Completa la tasca','complete-task',t.id,false,'check') : '') + `<section class="panel pad"><div class="actions">${badge(t.status)}<span class="small muted">Data prevista: ${date(t.dueDate)}</span></div><p class="notes" style="margin-top:20px">${escape(t.text)}</p><p class="small">Client: ${link('clients',t.clientId,clientName(t.clientId))}</p><p class="small muted">Nota fictícia. No s’ha enviat cap comunicació externa.</p></section>`;
    }
    const pending = state.tasks.filter(t => t.status === 'pending');
    const completed = state.tasks.filter(t => t.status === 'completed');
    return heading('Seguiment','Petites notes per no perdre el fil.',button('Esborrany IA','ai-followup','',true,'query') + button('Nou seguiment','new-task','',false,'plus')) + `<section class="panel">${panelHead('Pendents',pending.length + ' tasques fictícies')}${taskTable(pending)}</section><section class="panel">${panelHead('Completades','Historial desat en aquest navegador')}${taskTable(completed)}</section>`;
  }

  function fabricCards(fabrics) {
    return fabrics.length ? `<div class="fabric-grid">${fabrics.map(f => `<a class="fabric-card" href="${path('teixits',f.id)}"><div class="fabric-swatch" aria-hidden="true"><span>MOSTRA VISUAL IL·LUSTRATIVA</span></div><div class="fabric-info"><h2>${escape(f.name)}</h2><p>${escape(f.composition)}</p><footer><span>${f.priceCents === null ? 'Sense preu' : money(f.priceCents)}</span><span>${escape(f.stock.quantity)} ${escape(f.stock.unit)} en estoc ↗</span></footer></div></a>`).join('')}</div>` : `<section class="panel">${empty('No hi ha coincidències','Prova un altre nom, composició o preu màxim.',button('Restableix els filtres','reset-fabrics','',true))}</section>`;
  }
  function renderFabrics() {
    if (route.id) {
      const f = state.fabrics.find(item => item.id === route.id);
      if (!f) return notFound();
      return `<a class="back-link" href="#/teixits">${icon('back')} Torna als teixits</a>` + heading(f.name,'Fitxa de teixit · dades de demostració') + `<section class="panel pad"><div class="fabric-swatch fabric-large" aria-hidden="true"><span>TEXTURA IL·LUSTRATIVA · NO ÉS UNA MOSTRA REAL</span></div><dl class="details-meta"><div><dt>Composició</dt><dd>${escape(f.composition)}</dd></div><div><dt>Estoc fictici</dt><dd>${escape(f.stock.quantity)} ${escape(f.stock.unit)}</dd></div><div><dt>Proveïdor fictici</dt><dd>${escape(f.supplierName)}</dd></div><div><dt>Preu il·lustratiu</dt><dd>${f.priceCents === null ? 'Sense preu disponible' : money(f.priceCents)}</dd></div></dl></section>`;
    }
    const fabrics = requireQuery({type:'FABRICS'});
    return heading('Biblioteca de teixits','Textures, composicions i possibilitats per a cada peça.') + `<form data-form="filter-fabrics" class="toolbar" novalidate>${field('text','Nom del teixit',input('text','search','','placeholder="Cerca un teixit…"'))}${field('composition','Composició',input('composition','text','','placeholder="Ex.: cotó"'))}${field('maxPrice','Preu màxim (€)',input('maxPrice','text','','inputmode="decimal" placeholder="Sense límit"'))}<button type="submit" class="button secondary">${icon('search')} Filtra</button>${formError}</form><div id="fabric-results" aria-live="polite">${fabricCards(fabrics)}</div>`;
  }

  const clientSegments=[['merchandising','Merchandising i promocional'],['collection','Col·leccions']];
  const clientSegmentOptions=[['','Sense classificar'],...clientSegments];
  function clientFolders(clients) {
    if(!clients.length)return clientCards(clients);
    return clientSegmentOptions.map(([segment,label])=>{
      const records=clients.filter(client=>(client.segment||'')===segment);
      if(!segment&&!records.length)return '';
      return `<section class="panel">${panelHead(label,'',icon('folder'))}<div class="panel-body">${records.length?clientCards(records):'<p class="muted">Cap client en aquesta carpeta.</p>'}</div></section>`;
    }).join('');
  }
  function clientCards(clients) {
    return clients.length ? `<div class="client-grid">${clients.map(c => `<a class="client-card" href="${path('clients',c.id)}"><div class="client-monogram" aria-hidden="true">${escape(c.name.split(/\s+/).slice(0,2).map(word => word[0]).join(''))}</div><h2>${escape(c.name)}</h2><p>${escape(c.email || 'Sense correu fictici')}</p><span class="card-link">Obre la fitxa <span aria-hidden="true">↗</span></span></a>`).join('')}</div>` : `<section class="panel">${empty('No hem trobat cap client','Canvia la cerca o restableix-la per veure tots els clients ficticis.',button('Restableix la cerca','reset-clients','',true))}</section>`;
  }
  function renderClientsBase() {
    if (route.id) {
      const result = store.query({type:'CLIENT_DETAIL',id:route.id});
      if (!result.ok) return notFound();
      const d = result.data;
      return `<a class="back-link" href="#/clients">${icon('back')} Torna als clients</a>` + heading(d.client.name,d.client.email || 'Sense correu fictici',button('Esborrany IA','ai-followup',d.client.id,true,'query') + button('Nou seguiment','new-task',d.client.id,true,'plus') + button('Nou pressupost','new-quote',d.client.id,false,'plus')+button('Canvia el tipus','edit-client-segment',d.client.id,true),'CLIENT SINTÈTIC') + `<section class="panel">${panelHead('Pressupostos','Documents vinculats exclusivament a aquest client')}${quoteTable(d.quotes)}</section><section class="panel">${panelHead('Albarans')}${deliveryTable(d.deliveryNotes)}</section><section class="panel">${panelHead('Factures il·lustratives')}${invoiceTable(d.invoices)}</section><section class="panel">${panelHead('Notes i seguiment')}${taskTable(d.tasks)}</section>`;
    }
    return heading('Clients','El fil de cada relació, en una sola fitxa.',button('Nou client fictici','new-client','',false,'plus')) + `<form data-form="filter-clients" class="toolbar" novalidate>${field('clientSearch','Cerca per nom o correu fictici',input('clientSearch','search','','placeholder="Cerca un client…"'))}<button type="submit" class="button secondary">${icon('search')} Cerca</button>${formError}</form><div id="client-results" aria-live="polite">${clientFolders(requireQuery({type:'CLIENTS'}))}</div>`;
  }

  function sourceLinks(sources) {return sources.map(source => `<a href="${escape(safeHash(source.hash))}">${icon('arrow')}${escape(source.label)}</a>`).join('');}
  function answerMarkup(answer) {return `<div class="answer-box"><div class="eyebrow">${answer.kind === 'answer' ? 'RESPOSTA LOCAL · SIMULACIÓ' : 'SENSE DADES'}</div><p>${escape(answer.text)}</p>${answer.sources.length ? `<div class="small muted">Fonts locals consultades</div><div class="source-links">${sourceLinks(answer.sources)}</div>` : ''}<small>Resposta determinista sobre dades fictícies. Sense serveis IA externs.</small></div>`;}
  function renderQueries() {
    if (route.id) return notFound();
    return heading('Consultes amb fonts','Pregunta al teu espai de taller. Cada resposta té un origen.','','CONSULTA LOCAL · SIMULACIÓ') + `<div class="grid-2"><section class="panel pad"><h2>Què vols consultar?</h2><p class="small muted">Només es consulten els registres ficticis d’aquesta demo.</p><form data-form="answer" novalidate>${formError}${field('question','La teva pregunta',`<textarea id="question" name="question" rows="4" maxlength="${state.catalog.queryMaxLength}" aria-describedby="question-help question-error" placeholder="Escriu una pregunta sobre els registres locals…" required></textarea>`,`Màxim ${state.catalog.queryMaxLength} caràcters. Una pregunta desconeguda retorna absència de dades.`)}<p id="question-help" class="field-help">Sense interpretació de documents externs ni accés a informació real.</p><button type="submit" class="button">${icon('query')} Consulta les dades locals</button></form><div id="answer-result" aria-live="polite">${lastAnswer ? answerMarkup(lastAnswer) : ''}</div></section><section class="panel pad"><div class="eyebrow">PER COMENÇAR</div><h2>Preguntes de l’escenari</h2><p class="small muted">Exemples reconeguts amb enllaços al registre d’origen.</p><div class="guided-list">${state.catalog.guidedQuestions.map(q => `<button class="guided-question" type="button" data-action="guided-question" data-id="${escape(q.id)}"><span>${escape(q.text)}</span>${icon('arrow')}</button>`).join('')}</div></section></div>
      <section class="panel pad ai-panel"><div class="eyebrow">CONSULTA ASSISTIDA · IA</div><h2>Pregunta amb ajuda de la IA</h2><p class="small muted">La IA només tria la intenció i les fonts; el text i els imports es construeixen des dels registres locals i enllacen cada font. No modifica cap dada.</p><form data-form="ai-answer" novalidate>${formError}${field('aiQuestion','La teva pregunta',`<textarea id="aiQuestion" name="aiQuestion" rows="3" maxlength="${state.catalog.queryMaxLength}" aria-describedby="aiQuestion-error" placeholder="Ex.: Quins pressupostos té pendents un client?" required></textarea>`,`Màxim ${state.catalog.queryMaxLength} caràcters.`)}<div class="actions"><button type="submit" class="button" id="ai-answer-run">${icon('query')} Consulta amb IA</button><button type="button" class="button secondary" id="ai-answer-cancel" data-action="ai-cancel" data-job="answer" hidden>Cancel·la la consulta</button></div></form><div id="ai-answer-status" role="status" aria-live="polite"></div><div id="ai-answer-result">${aiAnswerSection()}</div></section>`;
  }

  function newQuote(clientId = '', meeting = null) {
    openDialog('De les notes al pressupost',`<div class="actions workflow-intro">${button('Des de reunió / entrada manual','manual-quote',clientId,true,'plus')}${button('Desa una reunió','new-meeting',clientId,true,'task')}</div><p class="dialog-intro">Genera un esborrany determinista amb exemples del catàleg local. Després hauràs de revisar-lo i aprovar-lo.</p><form data-form="new-quote" data-meeting-id="${escape(meeting?.id || '')}" novalidate>${formError}<div class="form-grid">${field('clientId','Client fictici',clientOptions(clientId))}${field('tariff','Tarifa il·lustrativa',tariffOptions('tariff','A'))}</div>${field('notes','Notes de la reunió',`<textarea id="notes" name="notes" aria-describedby="notes-error" required autofocus placeholder="Indica una quantitat i una peça coneguda…">${escape(meeting?.summary || '')}</textarea>`)}<div class="hint"><strong>Prova un exemple del catàleg</strong>${state.catalog.noteRules.map((rule,i) => `<button type="button" class="example-button" data-action="note-example" data-index="${i}">${escape(rule.example)}</button>`).join('')}</div><details class="hint"><summary>Tarifes A/B/C i trams ficticis</summary>${state.catalog.tariffs.map(t => `<p><strong>Tarifa ${escape(t.code)}</strong>: ${t.bands.map(b => 'a partir de '+b.minQuantity+' u. · '+money(b.unitPriceCents)+'/u.').join(' / ')}</p>`).join('')}</details>${quoteAiBox()}${formActions('Genera l’esborrany simulat')}${disclaimer}</form>`);
  }

  function remainingQuantity(quote,line) {
    const reserved=state.deliveryNotes.filter(d=>d.quoteId===quote.id).flatMap(d=>d.lines).filter(l=>l.id===line.id).reduce((sum,l)=>sum+BigInt(l.quantity),0n);
    return Number(BigInt(line.quantity)>reserved ? BigInt(line.quantity)-reserved : 0n);
  }
  function newDelivery(quoteId = '') {
    const requested=state.quotes.find(q=>q.id===quoteId && invoiceableQuote(q));
    if (requested && !requested.lines.some(line=>remainingQuantity(requested,line)>0)) {
      openDialog('Unitats ja assignades',`<p class="dialog-intro">Totes les unitats d’aquest pressupost ja tenen albarà. No es tornarà a reservar el mateixa comanda.</p><div class="source-links">${state.deliveryNotes.filter(d=>d.quoteId===quoteId).map(d=>`<a href="${path('albarans',d.id)}" data-action="dialog-link">${escape(d.number)}</a>`).join('')}</div>`+disclaimer);return;
    }
    const quotes = state.quotes.filter(q => invoiceableQuote(q) && q.lines.some(line=>remainingQuantity(q,line)>0));
    if (!quotes.length) {
      const approved=state.quotes.some(q=>['approved','sent_simulated'].includes(q.status));
      openDialog('Nou albarà',empty(approved ? 'No queden unitats per assignar' : 'Cal un pressupost aprovat',approved ? 'Totes les unitats aprovades ja estan reservades en albarans. Continua amb els documents existents.' : 'Revisa i aprova una proposta abans de preparar les peces.',`<a class="button" href="${approved ? '#/albarans' : '#/pressupostos'}" data-action="dialog-link">${approved ? 'Ves als albarans existents' : 'Ves als pressupostos'}</a>`)+disclaimer);return;
    }
    selectedQuoteId = quotes.some(q => q.id === quoteId) ? quoteId : quotes[0].id;
    const q = quotes.find(item => item.id === selectedQuoteId);
    openDialog('Prepara un albarà',`<p class="dialog-intro">Selecciona un pressupost aprovat i les quantitats de les peces. El motor local conservarà els seus preus.</p><form data-form="new-delivery" novalidate>${formError}${field('quoteId','Pressupost aprovat',select('quoteId',quotes.map(item => [item.id,item.number+' · '+clientName(item.clientId)]),q.id))}<div id="delivery-lines">${deliveryInputs(q)}</div>${formActions('Crea l’albarà fictici')}${disclaimer}</form>`,true);
  }
  function deliveryInputs(q) {
    return `<p class="small muted">Client: ${escape(clientName(q.clientId))}. Introdueix una quantitat positiva per a cada peça seleccionada.</p><div class="selection-list">${q.lines.map((l,index) => {
      const quantityId = `delivery-line-${index}-quantity`, remaining=remainingQuantity(q,l);
      return `<div class="selection-row" data-quote-line="${escape(l.id)}"><input id="delivery-line-${index}-include" type="checkbox" name="includeLine"${remaining ? ' checked' : ' disabled'} aria-label="Inclou ${escape(l.label)}"><div class="selection-content"><strong>${escape(l.label)}</strong><small>${escape(fabricName(l.fabricId))} · ${remaining} disponibles de ${l.quantity} pressupostades</small></div><label class="field" for="${quantityId}" style="width:90px;margin:0">Quantitat<input id="${quantityId}" type="number" name="quantity" min="1" max="${remaining}" step="1" value="${remaining}"${remaining ? '' : ' disabled'} aria-describedby="${quantityId}-error" aria-label="Quantitat · ${escape(l.label)}"><span class="field-error" id="${quantityId}-error"></span></label></div>`;
    }).join('')}</div>`;
  }

  function newInvoice(deliveryId = '') {
    const delivered = state.deliveryNotes.filter(d => d.status === 'delivered');
    openDialog('Agrupa albarans lliurats',`<p class="dialog-intro">Selecciona albarans d’un mateix client. La previsualització validarà la selecció i els imports abans de la revisió humana.</p><form data-form="invoice-selection" novalidate>${formError}${delivered.length ? `<div class="selection-list">${delivered.map(d => {const invoiced = state.invoices.some(i => i.deliveryNoteIds.includes(d.id));return `<label class="selection-row"><input type="checkbox" name="deliveryNoteIds" value="${escape(d.id)}"${invoiced ? ' disabled' : d.id === deliveryId ? ' checked' : ''}><span class="selection-content"><strong>${escape(d.number)}</strong><small>${escape(clientName(d.clientId))} · ${money(d.totals.totalCents)}</small></span>${invoiced ? '<span class="badge amber">Ja facturat</span>' : badge(d.status)}</label>`;}).join('')}</div>` : empty('Cap albarà lliurat','Completa el circuit de taller d’un albarà abans de facturar.')}${formActions('Previsualitza els imports')}${disclaimer}</form>`);
  }

  function paperDocument(entity, kind) {
    const delivery = kind === 'albarans';
    const invoice = kind === 'facturacio';
    const title = invoice ? 'Factura' : delivery ? 'Albarà de lliurament' : 'Pressupost '+quotePhase(entity).toLowerCase();
    const client = state.clients.find(item => item.id === entity.clientId);
    const units = entity.lines.reduce((sum,line) => sum + line.quantity, 0);
    const rows = entity.lines.map(line => `<tr>
      <td><strong>${escape(line.garmentCode)}</strong><br>${escape(line.label)}</td>
      <td>${line.fabricId ? escape(fabricName(line.fabricId)) : '—'}</td>
      <td class="mono">${line.quantity}</td><td class="mono">${money(line.unitPriceCents)}</td>
      <td class="mono">${money(BigInt(line.unitPriceCents) * BigInt(line.quantity))}</td>
    </tr>`);
    const source = delivery && state.quotes.find(quote => quote.id === entity.quoteId);
    const production=delivery && phaseData().production.find(row=>row.id===entity.productionId);
    return `<article class="print-sheet paper-document">
      <header class="paper-brand"><div><strong>Noves Iniciatives de Confecció</strong><br>Sabadell · Espai de taller</div><img src="assets/newop-logo.png" width="230" height="70" alt="NEW OP"></header>
      <div class="paper-meta"><div><h3>${title} ${escape(entity.number)}</h3><p>Data ${date(entity.createdOn)}</p>${source ? `<p>Pressupost d’origen ${escape(source.number)}</p>` : ''}${production ? `<p>Producció ${escape(production.id.toUpperCase())} · ${escape(production.workshop)}</p>` : ''}</div>
      <div><small>Client fictici</small><br><strong>${escape(clientName(entity.clientId))}</strong>${client?.email ? `<br>${escape(client.email)}` : ''}</div></div>
      ${table(['Ref. / descripció','Teixit','Unitats','Preu unitari','Import'], [...rows,`<tr class="paper-total"><th scope="row" colspan="2">Total de peces</th><td>${units}</td><td></td><td>${money(entity.totals.baseCents)}</td></tr>`])}
      ${totals(entity.totals,entity.taxRateBps)}
      ${!delivery && !invoice && entity.phase!=='final' ? quoteVolumePaper(entity) : ''}
      ${entity.terms ? `<section class="paper-notes"><h4>Condicions de la proposta</h4><p class="notes">${escape(entity.terms)}</p></section>` : ''}
      ${entity.notes ? `<section class="paper-notes"><h4>Observacions</h4><p class="notes">${escape(entity.notes)}</p></section>` : ''}
      ${delivery ? '' : '<section class="paper-notes"><h4>Acceptació del pressupost</h4><div class="paper-signatures"><span>Signatura del client</span><span>Signatura de NEW OP</span></div></section>'}
      <footer class="paper-footer">Document de demostració · Dades fictícies · Sense validesa fiscal o legal</footer>
    </article>`;
  }

  function openPaperDocument(entity, kind) {
    const delivery = kind === 'albarans';
    const invoice = kind === 'facturacio';
    const title = invoice ? 'Factura' : delivery ? 'Albarà de lliurament' : 'Pressupost '+quotePhase(entity).toLowerCase();
    const units = entity.lines.reduce((sum,line) => sum + line.quantity, 0);
    const markup = invoice ? documentMarkup(entity,kind) : paperDocument(entity,kind);
    $('#print-document').innerHTML = markup;
    let next = '';
    if (delivery && entity.status === 'workshop') next = 'ready';
    if (delivery && entity.status === 'ready') next = 'delivered';
    const action = next
      ? `<button type="button" class="button" data-action="delivery-status" data-id="${escape(entity.id)}" data-status="${next}">${next === 'ready' ? 'Marca a punt' : 'Marca lliurat'}</button>`
      : !delivery && entity.status === 'draft' ? button('Torna a l’esborrany','dialog-close') : '';
    openDialog(`${clientName(entity.clientId)} · ${invoice ? money(entity.totals.totalCents) : units+' unitats'}`,`
      <div class="paper-stage">${markup}</div>
      <footer class="paper-actions">${button('Imprimeix / Desa en PDF','print','',true,'print')}${action}</footer>`,true);
    overlay.classList.add('document-drawer');
    const heading = $('#dialog-title',overlay);
    const wrapper = document.createElement('div');
    heading.before(wrapper);
    wrapper.innerHTML = `<p class="drawer-kicker">${title} ${escape(entity.number)} ${badge(entity.paymentStatus || entity.status)}</p>`;
    wrapper.append(heading);
    wrapper.insertAdjacentHTML('beforeend',`<p class="drawer-date">${date(entity.createdOn)}</p>`);
    heading.focus();
  }

  function documentMarkup(entity, kind) {
    const title = {pressupostos:'Pressupost',albarans:'Albarà',facturacio:'Factura il·lustrativa'}[kind];
    let sources = link('clients',entity.clientId,clientName(entity.clientId));
    if (entity.quoteId) sources += ' · ' + link('pressupostos',entity.quoteId,state.quotes.find(q => q.id === entity.quoteId)?.number || entity.quoteId);
    if (entity.purchaseIds) sources += ' · ' + entity.purchaseIds.map(id => {const p = workflow().purchases.find(x => x.id === id);return p ? escape(p.reference + ' · ' + p.supplierName) : escape(id);}).join(' · ');
    if (entity.deliveryNoteIds) sources += ' · ' + entity.deliveryNoteIds.map(id => link('albarans',id,state.deliveryNotes.find(d => d.id === id)?.number || id)).join(' · ');
    return `<article class="print-sheet paper-document"><header class="document-header"><div><img src="assets/newop-logo.png" width="150" height="45" alt="NEW OP"><p>ESPAI DE TALLER · DEMO LOCAL</p></div><div><h2>${title}</h2><strong>${escape(entity.number)}</strong><p>${date(entity.createdOn)} · ${badge(entity.paymentStatus || entity.status)}</p></div></header><div class="document-warning"><strong>Simulació · Dades fictícies · Sense validesa fiscal o legal.</strong><br>Imports, impostos i referències exclusivament il·lustratius. Cap enviament, signatura ni pagament real.</div><dl class="details-meta"><div><dt>Client fictici</dt><dd>${escape(clientName(entity.clientId))}</dd></div><div><dt>Correu sintètic</dt><dd>${escape(state.clients.find(c => c.id === entity.clientId)?.email || 'Sense correu')}</dd></div></dl>${linesTable(entity.lines)}${totals(entity.totals,entity.taxRateBps)}<section class="paper-notes"><h4>Cobraments i saldo</h4><p>Venciment: ${entity.dueDate ? date(entity.dueDate) : 'Sense data de venciment'}</p>${balanceMarkup('invoice',entity.id)}</section>${entity.notes ? `<h3>Notes originals fictícies</h3><p class="notes">${escape(entity.notes)}</p>` : ''}<footer class="document-footer">Fonts locals: ${sources}<br>Escenari fictici del 05/11/2026 · Document HTML imprimible de demostració.<br>NEW OP · Demo preparada per NexaVision AI.</footer></article>`;
  }

  /* ===== Capa IA i connectors (RF-010 a RF-014). Tot el càlcul i la validació de negoci resten al servidor i a demo.js. ===== */
  const entityLabels = {client:'Client',quote:'Pressupost',deliveryNote:'Albarà',invoice:'Factura',task:'Seguiment',fabric:'Teixit',meeting:'Reunió',clientNote:'Cronologia',workshopEntry:'Taller',purchase:'Compra',proforma:'Proforma'};
  const kindLabels = {ai:'IA',email:'Correu',whatsapp:'WhatsApp',calendar:'Calendari',accounting:'Gestor comptable'};
  const connectionStatusLabels = {demo:'Demo',pending:'Pendent de connexió',configured:'Configurat · no verificat',error:'Error'};
  const operationStatusLabels = {prepared:'Preparada',reviewed:'Revisada',executing:'En execució',simulated:'Simulada',succeeded:'Completada',failed:'Fallida',unknown:'Resultat desconegut'};
  const jobMessages = {quote:'Anàlisi cancel·lada. Les notes es conserven.',answer:'Consulta cancel·lada. La pregunta es conserva.',followup:'Generació cancel·lada. No s’ha creat cap tasca.'};
  const unavailable = () => ({ok:false,error:{code:'NETWORK_UNAVAILABLE',field:null,message:'No s’ha pogut contactar amb el servidor. Torna a provar-ho; les dades introduïdes es conserven i no s’ha creat cap alternativa local.'}});
  const api = (method, ...args) => ai && typeof ai[method] === 'function' ? ai[method](...args) : Promise.resolve(unavailable());
  const errorMessage = error => (error && error.message) || 'No s’ha pogut completar l’operació.';
  const snapshot = () => ({expectedRevision:store.getState().revision});
  const modeBadge = mode => `<span class="badge ${mode === 'live' ? 'amber' : 'green'}">${mode === 'live' ? 'IA real · servidor' : 'IA demo · simulació'}</span>`;
  const opBadge = status => `<span class="badge ${['simulated','succeeded'].includes(status) ? 'green' : ['failed','unknown'].includes(status) ? 'rose' : 'amber'}">${escape(operationStatusLabels[status] || status)}</span>`;
  const formatDateTime = value => {const parsed = new Date(value);return Number.isNaN(parsed.getTime()) ? String(value ?? '') : parsed.toLocaleString('ca-ES');};
  const newKey = () => 'op-' + (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));


  function startJob(name) {
    if (jobs[name]) jobs[name].controller.abort();
    const job = {id:++jobSeq,controller:new AbortController()};
    jobs[name] = job;
    return job;
  }
  const isCurrent = (name, job) => jobs[name] === job;
  const endJob = (name, job) => {if (jobs[name] === job) delete jobs[name];};
  function cancelJob(name) {if (jobs[name]) {jobs[name].controller.abort();delete jobs[name];}}
  function setStatus(id, text, isError = false) {
    const region = document.getElementById(id);
    if (region) region.innerHTML = text ? `<p class="ai-status${isError ? ' error' : ''}">${escape(text)}</p>` : '';
  }
  function setRunning(name, running) {
    const run = document.getElementById(`ai-${name}-run`), cancel = document.getElementById(`ai-${name}-cancel`);
    if (run) run.disabled = running;
    if (cancel) cancel.hidden = !running;
  }
  function resetDialogState() {
    if (attachmentJob) {attachmentJob.controller.abort();attachmentJob=null;}
    cancelJob('quote');cancelJob('followup');
    quoteProposal = null;
    followup = {draft:null,key:null,refs:[]};
    importPreview = null;
  }
  function aiFailure(name, result, suffix = '') {
    setStatus(`ai-${name}-status`, result.error.code === 'ABORTED' ? jobMessages[name] : errorMessage(result.error) + suffix, result.error.code !== 'ABORTED');
  }

  /* --- RF-010 · QuoteAIReview --- */
  const garmentLabel = code => state.catalog.noteRules.find(rule => rule.garmentCode === code)?.label || code;
  const quoteInput = form => ({clientId:form.elements.clientId.value,notes:form.elements.notes.value,tariff:form.elements.tariff.value});
  const sameInput = (a, b) => a.clientId === b.clientId && a.notes === b.notes && a.tariff === b.tariff;
  const questionsMarkup = questions => questions && questions.length ? `<div class="hint ai-questions"><strong>Dubtes per resoldre</strong><ul>${questions.map(q => `<li>${escape(q)}</li>`).join('')}</ul></div>` : '';
  function quoteAiBox() {
    return `<div class="ai-box"><div class="eyebrow">ASSISTÈNCIA IA · REVISABLE</div><p class="small muted">La IA només suggereix peces i quantitats amb evidència a les notes. Els preus els calcula el motor local i el resultat és un esborrany.</p><div class="actions"><button type="button" class="button secondary" id="ai-quote-run" data-action="ai-quote-run">${icon('query')}Analitza les notes amb IA</button><button type="button" class="button secondary" id="ai-quote-cancel" data-action="ai-cancel" data-job="quote" hidden>Cancel·la l’anàlisi</button></div><div id="ai-quote-status" role="status" aria-live="polite"></div><div id="ai-quote-review"></div></div>`;
  }
  function quoteReviewMarkup(data) {
    const questions = data.questions || [];
    const head = `<div class="ai-review-head">${modeBadge(data.mode)}<span class="small muted">Proposta pendent de la teva revisió</span></div>`;
    if (data.kind === 'no_data' || !data.items.length) return `<div class="ai-review">${head}<p>No s’ha detectat cap peça del catàleg amb una quantitat explícita. Afegeix quantitats i peces conegudes a les notes i torna a analitzar.</p>${questionsMarkup(questions)}</div>`;
    const rows = data.items.map(item => `<tr><td>${escape(garmentLabel(item.garmentCode))}<span class="cell-secondary">${escape(item.garmentCode)}</span></td><td class="mono">${escape(item.quantity)}</td><td><ul class="evidence-list">${item.evidence.map(e => `<li><q>${escape(e.text)}</q><span class="cell-secondary">Posició ${escape(e.start)}–${escape(e.end)} · quantitat ${escape(e.quantity)}</span></li>`).join('')}</ul></td></tr>`);
    return `<div class="ai-review">${head}${table(['Peça','Quantitat','Evidència a les notes'],rows)}${questionsMarkup(questions)}<label class="check-field"><input type="checkbox" id="ai-reviewed" name="aiReviewed" data-ai-reviewed${questions.length ? ' disabled' : ''}><span>He revisat les peces, les quantitats i les evidències. Entenc que només es crearà un esborrany sense revisió financera ni aprovació.</span></label>${questions.length ? '<p class="review-status pending">Hi ha dubtes pendents: modifica les notes i torna a analitzar per poder aplicar la proposta.</p>' : ''}<div class="form-actions"><button type="button" class="button" id="ai-apply" data-action="ai-apply-quote" disabled>Aplica com a esborrany</button></div></div>`;
  }
  function invalidateQuoteProposal(message) {
    if (!quoteProposal && !jobs.quote) return;
    cancelJob('quote');
    quoteProposal = null;
    setRunning('quote',false);
    const review = $('#ai-quote-review');
    if (review) review.innerHTML = '';
    setStatus('ai-quote-status',message || 'Les dades han canviat: la proposta anterior s’ha descartat. Torna a analitzar les notes.',true);
  }
  async function runQuoteAnalysis(form) {
    clearErrors(form);
    const input = quoteInput(form);
    if (!state.clients.some(c => c.id === input.clientId)) {showFormError(form,{field:'clientId',message:'Selecciona un client fictici abans d’analitzar.'});return;}
    if (!input.notes.trim()) {showFormError(form,{field:'notes',message:'Escriu notes de la reunió abans d’analitzar-les.'});return;}
    if (input.notes.length > 2000) {showFormError(form,{field:'notes',message:'Les notes poden tenir com a màxim 2000 caràcters.'});return;}
    quoteProposal = null;
    $('#ai-quote-review').innerHTML = '';
    const job = startJob('quote');
    setRunning('quote',true);
    setStatus('ai-quote-status','Analitzant les notes… Pots cancel·lar-ho; les notes es conserven.');
    const snap = snapshot();
    const result = await api('quote',{...snap,...input},{signal:job.controller.signal});
    if (!isCurrent('quote',job)) return;
    endJob('quote',job);
    setRunning('quote',false);
    if (!result.ok) {aiFailure('quote',result,' Les notes es conserven.');return;}
    const candidate = result.data && result.data.candidate;
    const data = candidate && {...candidate,mode:result.data.mode,stateRevision:snap.expectedRevision,items:Array.isArray(candidate.items) ? candidate.items.map(item => ({...item,quantity:item.evidence.reduce((sum,e) => sum + e.quantity,0)})) : null};
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.questions)) {setStatus('ai-quote-status','La resposta de la IA no és vàlida. Les notes es conserven.',true);return;}
    if (data.stateRevision !== store.getState().revision || !form.isConnected || !sameInput(quoteInput(form),input)) {setStatus('ai-quote-status','La proposta ja no és vigent perquè les dades han canviat. Torna a analitzar.',true);return;}
    quoteProposal = {data,candidate,input,stateRevision:data.stateRevision};
    setStatus('ai-quote-status','Proposta rebuda. Revisa-la abans d’aplicar-la.');
    $('#ai-quote-review').innerHTML = quoteReviewMarkup(data);
    const review = $('#ai-quote-review .ai-review');
    if (review) {review.tabIndex = -1;review.focus();}
  }
  async function applyQuoteProposal(form) {
    clearErrors(form);
    const proposal = quoteProposal;
    if (!proposal) {showFormError(form,{field:null,message:'Primer cal analitzar les notes amb la IA.'});return;}
    if (proposal.data.questions.length || !proposal.data.items.length) {showFormError(form,{field:null,message:'La proposta té dubtes pendents o no té peces: no es pot aplicar.'});return;}
    const reviewed = $('#ai-reviewed');
    if (!reviewed || !reviewed.checked) {showFormError(form,{field:'aiReviewed',message:'Confirma que has revisat la proposta abans d’aplicar-la.'});return;}
    if (!sameInput(quoteInput(form),proposal.input)) {invalidateQuoteProposal();showFormError(form,{field:null,message:'Les notes, el client o la tarifa han canviat. Torna a analitzar.'});return;}
    if (store.getState().revision !== proposal.stateRevision) {invalidateQuoteProposal();showFormError(form,{field:null,message:'Les dades de la demo han canviat des de l’anàlisi. Torna a analitzar.'});return;}
    $('#ai-apply').disabled = true;
    const created = await commit({type:'DRAFT_QUOTE_FROM_AI',...proposal.input,expectedRevision:proposal.stateRevision,humanReviewed:true,candidate:proposal.candidate},form,'Esborrany creat des de la proposta IA. La revisió i l’aprovació financeres continuen sent independents.','pressupostos');
    if (created) quoteProposal = null;
    else if ($('#ai-apply')) $('#ai-apply').disabled = false;
  }

  /* --- RF-011 · AssistedQuery --- */
  function aiAnswerMarkup(answer) {
    return `<div class="answer-box" id="ai-answer-box" tabindex="-1"><div class="eyebrow">${answer.kind === 'answer' ? 'RESPOSTA ASSISTIDA' : 'SENSE DADES'}</div><p>${modeBadge(answer.mode)}</p><p>${escape(answer.text)}</p>${answer.sources && answer.sources.length ? `<div class="small muted">Fonts locals consultades</div><div class="source-links">${sourceLinks(answer.sources)}</div>` : ''}<small>La IA només selecciona fonts; el text i els imports es construeixen des dels registres locals. Sense mutacions.</small></div>`;
  }
  function aiAnswerSection() {
    if (lastAiAnswer && lastAiAnswer.stateRevision !== state.revision) {lastAiAnswer = null;return '<div class="hint">El resultat anterior s’ha descartat perquè les dades han canviat. Torna a fer la consulta.</div>';}
    return lastAiAnswer ? aiAnswerMarkup(lastAiAnswer) : '';
  }
  async function runAiAnswer(form) {
    clearErrors(form);
    const text = form.elements.aiQuestion.value;
    if (!text.trim() || text.length > state.catalog.queryMaxLength) {showFormError(form,{field:'aiQuestion',message:'Escriu una pregunta d’entre 1 i ' + state.catalog.queryMaxLength + ' caràcters.'});return;}
    lastAiAnswer = null;
    $('#ai-answer-result').innerHTML = '';
    const job = startJob('answer');
    setRunning('answer',true);
    setStatus('ai-answer-status','Consultant les dades locals… Pots cancel·lar-ho; la pregunta es conserva.');
    const snap = snapshot();
    const result = await api('query',{...snap,text},{signal:job.controller.signal});
    if (!isCurrent('answer',job)) return;
    endJob('answer',job);
    setRunning('answer',false);
    if (!result.ok) {aiFailure('answer',result,' La pregunta es conserva.');return;}
    const answer = result.data && result.data.answer;
    const data = answer && {...answer,kind:answer.sources && answer.sources.length ? 'answer' : 'no_data',mode:result.data.mode,stateRevision:snap.expectedRevision};
    if (!data || typeof data.text !== 'string' || !Array.isArray(data.sources)) {setStatus('ai-answer-status','La resposta de la IA no és vàlida. No s’ha mostrat cap dada.',true);return;}
    if (data.stateRevision !== store.getState().revision) {setStatus('ai-answer-status','El resultat és obsolet perquè les dades han canviat. Torna a consultar.',true);return;}
    lastAiAnswer = data;
    setStatus('ai-answer-status','Resposta rebuda.');
    const box = $('#ai-answer-result');
    if (box) {box.innerHTML = aiAnswerMarkup(data);$('#ai-answer-box').focus();}
  }

  /* --- RF-012 · FollowupDraft --- */
  function sourcesFromRefs(refs) {
    const collections = {client:['clients',state.clients],quote:['pressupostos',state.quotes],deliveryNote:['albarans',state.deliveryNotes],invoice:['facturacio',state.invoices],task:['seguiment',state.tasks],fabric:['teixits',state.fabrics]};
    return refs.map(ref => {
      const collection = collections[ref.entityType];
      const entity = collection && collection[1].find(x => x.id === ref.id);
      if (!entity) {const names={meeting:'meetings',clientNote:'clientNotes',workshopEntry:'workshopEntries',purchase:'purchases',proforma:'proformas'};const record=workflow()[names[ref.entityType]]?.find(x=>x.id===ref.id);return record ? {entityType:ref.entityType,id:record.id,label:record.number || record.reference || record.summary || record.text,hash:path('clients',record.clientId)} : null;}
      return entity ? {entityType:ref.entityType,id:ref.id,label:entity.number || entity.name || entity.text,hash:path(collection[0],ref.id)} : null;
    }).filter(Boolean);
  }
  function followupRefs(clientId) {
    const result = store.query({type:'CLIENT_DETAIL',id:clientId});
    if (!result.ok) return [];
    const d = result.data;
    return [...d.quotes.map(x => ['quote',x.id,x.number]),...d.deliveryNotes.map(x => ['deliveryNote',x.id,x.number]),...d.invoices.map(x => ['invoice',x.id,x.number]),...d.tasks.map(x => ['task',x.id,String(x.text).slice(0,60)]),...['meetings','clientNotes','workshopEntries','purchases','proformas'].flatMap((key,index)=>workflow()[key].filter(x=>x.clientId===clientId).map(x=>[['meeting','clientNote','workshopEntry','purchase','proforma'][index],x.id,String(x.number || x.reference || x.summary || x.text).slice(0,80)]))];
  }
  function followupSourcesMarkup(clientId) {
    const refs = followupRefs(clientId);
    followup.refs = refs.map(([entityType,id]) => ({entityType,id}));
    return refs.length ? `<fieldset class="source-picker"><legend>Fonts del client (opcional)</legend>${refs.map(([type,,label],index) => `<label class="check-field compact"><input type="checkbox" name="sourceRef" value="${index}"><span>${escape(entityLabels[type])} · ${escape(label)}</span></label>`).join('')}</fieldset>` : '<p class="small muted">Aquest client encara no té documents ni seguiments. L’esborrany tindrà poques dades.</p>';
  }
  const followupKey = form => JSON.stringify([form.elements.clientId.value,form.elements.instruction.value,$$('[name="sourceRef"]:checked',form).map(el => el.value)]);
  function openFollowup(clientId = '') {
    openDialog('Esborrany de seguiment amb IA',`<p class="dialog-intro">La IA proposa un text editable a partir de les fonts del client. No fixa terminis, preus ni compromisos, i no envia res. Només es desa com a tasca local si ho confirmes amb una data manual.</p><form data-form="followup-save" novalidate>${formError}${field('clientId','Client fictici',clientOptions(clientId))}<div id="followup-sources">${clientId ? followupSourcesMarkup(clientId) : '<p class="small muted">Selecciona un client per triar fonts.</p>'}</div>${field('instruction','Instrucció per a l’esborrany (opcional)',`<textarea id="instruction" name="instruction" rows="3" maxlength="500" aria-describedby="instruction-error" placeholder="Ex.: recorda l’estat del darrer albarà"></textarea>`)}<div class="actions"><button type="button" class="button" id="ai-followup-run" data-action="followup-run">${icon('query')}Genera l’esborrany</button><button type="button" class="button secondary" id="ai-followup-cancel" data-action="ai-cancel" data-job="followup" hidden>Cancel·la la generació</button></div><div id="ai-followup-status" role="status" aria-live="polite"></div><div id="followup-draft"></div><div class="form-actions"><button type="button" class="button secondary" data-action="dialog-close">Tanca</button></div>${disclaimer}</form>`,true);
    if (clientId) followup.refs = followupRefs(clientId).map(([entityType,id]) => ({entityType,id}));
  }
  function followupDraftMarkup(data) {
    if (data.kind === 'no_data' || !data.text) return `<div class="ai-review"><div class="ai-review-head">${modeBadge(data.mode)}</div><p>No hi ha prou dades per proposar un seguiment. Afegeix fonts o una instrucció i torna a generar-lo.</p>${questionsMarkup(data.questions)}</div>`;
    return `<div class="ai-review"><div class="ai-review-head">${modeBadge(data.mode)}<span class="small muted">Esborrany provisional i editable</span></div>${field('followupText','Text del seguiment (màx. 500 caràcters)',`<textarea id="followupText" name="followupText" rows="4" maxlength="500" aria-describedby="followupText-error">${escape(data.text)}</textarea>`)}${data.sources.length ? `<div class="small muted">Fonts de l’esborrany</div><div class="source-links">${sourceLinks(data.sources)}</div>` : ''}${questionsMarkup(data.questions)}${field('dueDate','Data prevista (manual)',input('dueDate','date','','required'),'La IA no fixa terminis: indica la data tu mateix.')}<label class="check-field"><input type="checkbox" id="followup-reviewed" name="reviewed" aria-describedby="followup-reviewed-error"><span>He revisat el text i la data. Entenc que es desa com a tasca local i que no s’envia cap missatge.<span class="field-error" id="followup-reviewed-error"></span></span></label><div class="form-actions"><button type="submit" class="button">Desa com a seguiment</button>${button('Prepara com a correu revisable','followup-email','',true)}</div></div>`;
  }
  function invalidateFollowup(message) {
    if (!followup.draft && !jobs.followup) return;
    cancelJob('followup');
    followup.draft = null;
    setRunning('followup',false);
    const box = $('#followup-draft');
    if (box) box.innerHTML = '';
    setStatus('ai-followup-status',message || 'Les dades han canviat: l’esborrany anterior s’ha descartat. Torna a generar-lo.',true);
  }
  async function runFollowup(form) {
    clearErrors(form);
    const clientId = form.elements.clientId.value;
    const instruction = form.elements.instruction.value;
    if (!state.clients.some(c => c.id === clientId)) {showFormError(form,{field:'clientId',message:'Selecciona un client fictici.'});return;}
    if (instruction.length > 500) {showFormError(form,{field:'instruction',message:'La instrucció pot tenir com a màxim 500 caràcters.'});return;}
    const key = followupKey(form);
    const sourceRefs = $$('[name="sourceRef"]:checked',form).map(el => followup.refs[Number(el.value)]).filter(Boolean);
    followup.draft = null;
    $('#followup-draft').innerHTML = '';
    const job = startJob('followup');
    setRunning('followup',true);
    setStatus('ai-followup-status','Generant l’esborrany… Pots cancel·lar-ho; no es crea cap tasca.');
    const snap = snapshot();
    const result = await api('followup',{...snap,clientId,sourceRefs,instruction},{signal:job.controller.signal});
    if (!isCurrent('followup',job)) return;
    endJob('followup',job);
    setRunning('followup',false);
    if (!result.ok) {aiFailure('followup',result,' No s’ha creat cap tasca.');return;}
    const draft = result.data && result.data.draft;
    const data = draft && {...draft,kind:draft.text ? 'draft' : 'no_data',mode:result.data.mode,clientId,stateRevision:snap.expectedRevision,sources:sourcesFromRefs(draft.sourceRefs || [])};
    if (!data || !Array.isArray(data.sources) || !Array.isArray(data.questions)) {setStatus('ai-followup-status','La resposta de la IA no és vàlida. No s’ha creat cap tasca.',true);return;}
    if (data.stateRevision !== store.getState().revision || !form.isConnected || followupKey(form) !== key) {setStatus('ai-followup-status','L’esborrany ja no és vigent perquè les dades han canviat. Torna a generar-lo.',true);return;}
    followup.draft = data;
    followup.key = key;
    setStatus('ai-followup-status',data.kind === 'draft' ? 'Esborrany rebut. Revisa’l, indica la data i desa’l.' : 'La IA no ha pogut proposar un esborrany.');
    $('#followup-draft').innerHTML = followupDraftMarkup(data);
    const target = $('#followupText') || $('#followup-draft .ai-review');
    if (target) {if (!target.matches('textarea')) target.tabIndex = -1;target.focus();}
  }
  async function saveFollowup(form, data) {
    const draft = followup.draft;
    if (!draft || draft.kind !== 'draft') throw new InputError('Genera primer un esborrany amb la IA.',null);
    if (followupKey(form) !== followup.key) {invalidateFollowup();throw new InputError('Les dades han canviat. Torna a generar l’esborrany.',null);}
    const text = String(data.get('followupText') ?? '');
    if (!text.trim()) throw new InputError('El text del seguiment no pot estar buit.','followupText');
    if (text.length > 500) throw new InputError('El text pot tenir com a màxim 500 caràcters.','followupText');
    const dueDate = String(data.get('dueDate') ?? '');
    if (!dueDate) throw new InputError('Indica manualment la data prevista.','dueDate');
    if (!data.has('reviewed')) throw new InputError('Confirma que has revisat el text i la data.','reviewed');
    if (store.getState().revision !== draft.stateRevision) {invalidateFollowup();throw new InputError('Les dades han canviat des que es va generar l’esborrany. Torna a generar-lo.',null);}
    await commit({type:'CREATE_TASK',clientId:draft.clientId,text,dueDate,sourceRefs:draft.sourceRefs || []},form,'Seguiment desat com a tasca local. No s’ha enviat cap missatge.','seguiment');
  }

  /* --- RF-013 · ConnectionsDialog --- */
  function connectionsMarkup(connections) {
    return `<div class="connection-list">${connections.map(c => `<article class="connection-card"><header><h3>${escape(kindLabels[c.kind] || c.kind)}</h3><span class="badge ${c.status === 'error' ? 'rose' : c.status === 'configured' || c.status === 'demo' ? 'green' : 'amber'}">${escape(connectionStatusLabels[c.status] || c.status)}</span></header><dl><div><dt>Mode</dt><dd>${escape(c.mode)}</dd></div><div><dt>Configuració completa</dt><dd>${c.configured ? 'Sí' : 'No'}</dd></div><div><dt>Verificat</dt><dd>${c.verified ? 'Sí' : 'No verificat'}</dd></div><div><dt>Simulació</dt><dd>${c.demoAvailable ? 'Disponible' : 'No disponible'}</dd></div></dl>${c.reasons && c.reasons.length ? `<ul class="connection-reasons">${c.reasons.map(r => `<li>${escape(r)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</div>`;
  }
  function openConnections() {
    openDialog('Connexions i IA',`<p class="dialog-intro">Estat públic de la configuració del servidor. «Configurat» només indica que els camps estan complets; no vol dir que la connexió s’hagi verificat.</p><div id="connections-body" role="status" aria-live="polite"><p class="ai-status">Carregant l’estat de les connexions…</p></div><div class="form-actions">${button('Actualitza','connections-refresh','',true)}${button('Tanca','dialog-close')}</div><p class="dialog-disclaimer">Les claus i la configuració viuen únicament al servidor, mai al navegador. Aquesta interfície no demana ni desa claus. Simulació · Dades fictícies · Sense validesa fiscal o legal.</p>`,true);
    loadConnections();
  }
  async function loadConnections() {
    const serial = dialogSerial;
    const body = $('#connections-body');
    if (!body) return;
    body.innerHTML = '<p class="ai-status">Carregant l’estat de les connexions…</p>';
    const result = await api('connections');
    if (serial !== dialogSerial) return;
    const target = $('#connections-body');
    if (!target) return;
    if (!result.ok || !Array.isArray(result.data && result.data.connections)) {target.innerHTML = `<p class="ai-status error">${escape(result.ok ? 'La resposta de l’API no és vàlida.' : errorMessage(result.error))}</p>`;return;}
    target.innerHTML = connectionsMarkup(result.data.connections);
  }

  /* --- RF-014 · ConnectorOutbox, OperationReview, Receipt --- */
  function receiptMarkup(receipt) {
    if (!receipt) return '<p class="small muted">Encara no hi ha cap rebut.</p>';
    return `<section class="receipt" aria-label="Rebut"><div class="eyebrow">REBUT · ${escape(kindLabels[receipt.kind] || receipt.kind)}</div><dl class="details-meta"><div><dt>Estat</dt><dd>${opBadge(receipt.status)}</dd></div><div><dt>Mode</dt><dd>${escape(receipt.mode === 'live' ? 'Connexió real' : 'Simulació')}</dd></div><div><dt>Identificador</dt><dd class="mono">${escape(receipt.id)}</dd></div><div><dt>Proveïdor</dt><dd>${escape(receipt.providerId || 'Cap')}</dd></div><div><dt>Completat</dt><dd>${escape(formatDateTime(receipt.completedAt))}</dd></div></dl>${receipt.error ? `<p class="form-error">${escape(receipt.error.message)}</p>` : ''}${receipt.status === 'unknown' ? '<p class="review-status pending">Resultat desconegut: no es reintenta automàticament. Comprova-ho manualment abans de preparar una nova operació.</p>' : ''}<p class="small muted">${receipt.mode === 'demo' || receipt.status === 'simulated' ? 'Rebut simulat: no acredita cap enviament ni sincronització externa.' : 'Rebut emès pel servidor.'} Dades fictícies · Sense validesa fiscal o legal.</p></section>`;
  }
  function outboxTable(operations) {
    if (!operations.length) return empty('Cap operació encara','Prepara una operació de correu, WhatsApp, calendari o gestor comptable. El mode de cada operació queda identificat abans de confirmar-la.',button('Prepara una operació','op-new','',false,'plus'));
    return table(['Tipus','Client fictici','Estat','Rebut','Acció'],operations.map(op => `<tr><td>${escape(kindLabels[op.kind] || op.kind)}</td><td>${escape(clientName(op.clientId))}</td><td>${opBadge(op.status)}</td><td>${op.receipt ? escape(op.receipt.id) : '—'}</td><td>${button('Obre','op-open',op.id,true)}</td></tr>`));
  }
  function openOutbox() {
    openDialog('Safata de connectors',`<p class="dialog-intro">Prepara, revisa i confirma operacions. Comprova el mode de cada operació: les simulacions no fan enviaments externs. Els rebuts es conserven al servidor.</p><div class="actions">${button('Prepara una operació','op-new','',false,'plus')}${button('Actualitza','outbox-refresh','',true)}${button('Exporta CSV comptable','csv-dialog','',true)}</div><div id="outbox-list" role="status" aria-live="polite" class="outbox-list"></div>${disclaimer}`,true);
    loadOutbox();
  }
  async function loadOutbox() {
    const serial = dialogSerial;
    const box = $('#outbox-list');
    if (!box) return;
    box.innerHTML = '<p class="ai-status">Carregant operacions…</p>';
    const result = await api('listOperations');
    if (serial !== dialogSerial) return;
    const target = $('#outbox-list');
    if (!target) return;
    if (!result.ok || !Array.isArray(result.data && result.data.operations)) {target.innerHTML = empty('No s’han pogut carregar les operacions',result.ok ? 'La resposta de l’API no és vàlida.' : errorMessage(result.error),button('Torna a provar','outbox-refresh','',true));return;}
    opsCache = new Map(result.data.operations.map(op => [op.id,op]));
    target.innerHTML = outboxTable(result.data.operations);
  }
  function opFieldsMarkup(kind, clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return '<p class="small muted">Selecciona un client per continuar.</p>';
    const text = label => field('text',label,`<textarea id="text" name="text" rows="4" aria-describedby="text-error" required></textarea>`);
    if (kind === 'email') return `<p class="small muted">Destinatari fictici: ${escape(client.email || 'aquest client no té correu example.com')}</p>${field('subject','Assumpte',input('subject','text','','required maxlength="200"'))}${text('Missatge (text pla, sense adjunts)')}`;
    if (kind === 'whatsapp') return `<p class="small muted">Destí de demo: no es demana cap telèfon real.</p>${text('Missatge')}`;
    if (kind === 'calendar') return `${field('summary','Títol de l’esdeveniment',input('summary','text','','required maxlength="200"'))}${field('description','Descripció',`<textarea id="description" name="description" rows="3" aria-describedby="description-error"></textarea>`)}<div class="form-grid">${field('start','Inici',input('start','datetime-local','','required'))}${field('end','Final',input('end','datetime-local','','required'))}</div>`;
    const invoices = state.invoices.filter(i => i.clientId === clientId);
    return invoices.length ? `<fieldset class="source-picker"><legend>Factures il·lustratives del client</legend>${invoices.map(i => `<label class="check-field compact"><input type="checkbox" name="invoiceIds" value="${escape(i.id)}"><span>${escape(i.number)} · ${money(i.totals.totalCents)}</span></label>`).join('')}</fieldset>` : '<p class="small muted">Aquest client no té factures il·lustratives per exportar.</p>';
  }
  function openPrepare(clientId = '') {
    prepareKey = newKey();
    openDialog('Prepara una operació',`<p class="dialog-intro">Es crea una versió preparada; cal revisar-la i confirmar-la després. Qualsevol canvi de contingut genera una nova preparació.</p><form data-form="op-prepare" novalidate>${formError}<div class="form-grid">${field('kind','Connector',select('kind',[['email','Correu'],['whatsapp','WhatsApp'],['calendar','Calendari'],['accounting','Gestor comptable']],'email'))}${field('clientId','Client fictici',clientOptions(clientId))}</div><div id="op-fields">${opFieldsMarkup('email',clientId)}</div>${formActions('Prepara l’operació')}${disclaimer}</form>`,true);
  }
  function buildPreparation(form, data) {
    const get = key => String(data.get(key) ?? '');
    const kind = get('kind'), clientId = get('clientId');
    const client = state.clients.find(c => c.id === clientId);
    if (!client) throw new InputError('Selecciona un client fictici.','clientId');
    const sourceRefs = [{entityType:'client',id:clientId},...JSON.parse(form.dataset.sourceRefs || '[]')];
    let payload;
    if (kind === 'email') {
      if (!client.email) throw new InputError('Aquest client no té correu fictici example.com.','clientId');
      if (!get('subject').trim()) throw new InputError('Indica l’assumpte.','subject');
      if (!get('text').trim()) throw new InputError('Escriu el missatge.','text');
      payload = {clientId,to:client.email,subject:get('subject'),text:get('text')};
    } else if (kind === 'whatsapp') {
      if (!get('text').trim()) throw new InputError('Escriu el missatge.','text');
      payload = {clientId,to:'demo:' + clientId,text:get('text')};
    } else if (kind === 'calendar') {
      if (!get('summary').trim()) throw new InputError('Indica el títol de l’esdeveniment.','summary');
      const start = new Date(get('start')), end = new Date(get('end'));
      if (!get('start') || Number.isNaN(start.getTime())) throw new InputError('Indica una data i hora d’inici vàlides.','start');
      if (!get('end') || Number.isNaN(end.getTime())) throw new InputError('Indica una data i hora de final vàlides.','end');
      if (end <= start) throw new InputError('El final ha de ser posterior a l’inici.','end');
      payload = {clientId,summary:get('summary'),description:get('description'),start:start.toISOString(),end:end.toISOString()};
    } else if (kind === 'accounting') {
      const invoiceIds = data.getAll('invoiceIds').map(String);
      if (!invoiceIds.length) throw new InputError('Selecciona almenys una factura.','invoiceIds');
      payload = {clientId,invoiceIds};
      invoiceIds.forEach(id => sourceRefs.push({entityType:'invoice',id}));
    } else throw new InputError('Selecciona un connector.','kind');
    return {kind,clientId,sourceRefs,...payload,text:payload.text || payload.description || payload.summary || 'Exportació comptable revisable',idempotencyKey:prepareKey};
  }
  async function prepareOperation(form, data) {
    if (opBusy) return;
    const request = buildPreparation(form,data);
    opBusy = true;
    const submit = $('[type="submit"]',form);
    if (submit) submit.disabled = true;
    const serial = dialogSerial;
    const result = await api('prepareOperation',{...snapshot(),...request});
    opBusy = false;
    if (serial !== dialogSerial) return;
    if (submit && submit.isConnected) submit.disabled = false;
    if (!result.ok) {showFormError(form,result.error);return;}
    const operation = result.data.operation;
    if (!operation || typeof operation.id !== 'string') {showFormError(form,{message:'La resposta de l’API no és vàlida.'});return;}
    opsCache.set(operation.id,operation);
    notify('Operació preparada. Revisa-la abans de confirmar-la; encara no s’ha executat res.');
    openOperation(operation.id);
  }
  function operationPayload(op) {
    const labels = {clientId:'Client',to:'Destí',subject:'Assumpte',text:'Missatge',summary:'Títol',description:'Descripció',start:'Inici',end:'Final',dueDate:'Data',invoiceIds:'Factures'};
    const payload = op.payload || op;
    const visible = Object.keys(labels).filter(key => payload[key] !== undefined);
    const details = `<dl class="payload-list">${visible.map(key => {
      const value = payload[key];
      const shown = Array.isArray(value) ? value.map(id => state.invoices.find(i => i.id === id)?.number || String(id)).join(', ') : key === 'clientId' ? clientName(value) : ['start','end'].includes(key) ? formatDateTime(value) : key === 'dueDate' ? date(value) : String(value ?? '');
      return `<div><dt>${escape(labels[key])}</dt><dd class="notes">${escape(shown)}</dd></div>`;
    }).join('')}</dl>`;
    const invoices = Array.isArray(payload.invoices) ? payload.invoices : [];
    const invoiceRows = invoices.filter(item => item && typeof item.number === 'string' && item.totals && ['baseCents','taxCents','totalCents'].every(key => Number.isSafeInteger(item.totals[key]) && item.totals[key] >= 0)).map(item => `<tr><td>${escape(item.number)}</td><td class="mono">${money(item.totals.baseCents)}</td><td class="mono">${money(item.totals.taxCents)}</td><td class="mono">${money(item.totals.totalCents)}</td></tr>`);
    return details + (invoiceRows.length ? table(['Factura preparada','Base','Impost','Total'],invoiceRows) : '');
  }

  function operationActions(op) {
    const stale = op.stateRevision !== undefined && op.stateRevision !== state.revision ? '<p class="review-status pending">Les dades han canviat des que es va preparar l’operació. Revisa’n les fonts i prepara una operació nova si cal.</p>' : '';
    if (op.status === 'prepared') return `${stale}<form data-form="op-review" data-id="${escape(op.id)}" novalidate>${formError}${field('reviewText','Contingut per revisar (editable)',`<textarea id="reviewText" name="reviewText" rows="4" maxlength="2000" aria-describedby="reviewText-error">${escape(op.text || op.payload?.text || op.payload?.description || '')}</textarea>`)}<label class="check-field"><input type="checkbox" id="op-reviewed" name="reviewed" aria-describedby="op-reviewed-error"><span>He revisat el contingut exacte d’aquesta operació.<span class="field-error" id="op-reviewed-error"></span></span></label>${formActions('Confirma la revisió',false)}</form>`;
    if (op.status === 'reviewed') return `${stale}<form data-form="op-execute" data-id="${escape(op.id)}" novalidate>${formError}<label class="check-field"><input type="checkbox" id="op-confirmed" name="confirmed" aria-describedby="op-confirmed-error"><span>${op.mode === 'live' ? 'Confirmo l’execució real d’aquesta operació revisada amb el servei connectat.' : 'Confirmo la simulació d’aquesta operació revisada. No s’enviarà ni se sincronitzarà res de manera real.'}<span class="field-error" id="op-confirmed-error"></span></span></label>${formActions(op.mode === 'live' ? 'Confirma l’execució real' : 'Executa la simulació',false)}</form>`;
    if (op.status === 'executing') return `<p class="review-status pending">L’operació ja s’està executant. No es repeteix.</p><div class="actions">${button('Actualitza l’estat','op-refresh',op.id,true)}</div>`;
    return receiptMarkup({...op.receipt,id:op.receipt?.id || op.id,kind:op.kind,status:op.status,mode:op.mode,completedAt:op.updatedAt,error:op.error,providerId:op.receipt?.provider || null});
  }
  function openOperation(id) {
    const op = opsCache.get(id);
    if (!op) {notify('No s’ha trobat l’operació. Actualitza la safata.',true);return;}
    openDialog('Revisió de l’operació',`<p class="dialog-intro">${escape(kindLabels[op.kind] || op.kind)} · ${escape(clientName(op.clientId))} · ${opBadge(op.status)} <span class="badge">${escape(op.mode === 'live' ? 'Connexió real' : 'Simulació')}</span></p>${operationPayload(op)}<dl class="details-meta"><div><dt>Versió de l’operació</dt><dd class="mono">${escape(op.revision || 1)}</dd></div><div><dt>Revisió de l’estat preparada</dt><dd class="mono">${escape(op.stateRevision ?? op.expectedRevision ?? '—')}</dd></div></dl>${operationActions(op)}<div class="form-actions">${button('Torna a la safata','outbox','',true)}</div>${disclaimer}`,true);
  }
  async function operationStep(form, method, extra, successMessage) {
    if (opBusy) return;
    const id = form.dataset.id;
    const op = opsCache.get(id);
    if (!op) throw new InputError('No s’ha trobat l’operació. Actualitza la safata.',null);
    const confirmation = form.elements.reviewed || form.elements.confirmed;
    if (!confirmation || !confirmation.checked) throw new InputError(method === 'reviewOperation' ? 'Confirma que has revisat el contingut de l’operació.' : 'Confirma l’execució simulada d’aquesta operació.',confirmation ? confirmation.name : null);
    opBusy = true;
    const submit = $('[type="submit"]',form);
    if (submit) submit.disabled = true;
    const serial = dialogSerial;
    const result = await api(method,id,{...extra(op)});
    opBusy = false;
    if (serial !== dialogSerial) return;
    if (submit && submit.isConnected) submit.disabled = false;
    if (!result.ok) {showFormError(form,result.error);return;}
    const updated = result.data && result.data.operation ? result.data.operation : result.data;
    const receipt = result.data && 'receipt' in result.data ? result.data.receipt : updated.receipt;
    opsCache.set(updated.id,{...updated,receipt:receipt || updated.receipt || null});
    notify(updated.status === 'executing' ? 'L’operació ja s’està executant; no es repeteix.' : successMessage);
    openOperation(updated.id);
  }
  async function refreshOperation(id) {
    const result = await api('listOperations');
    if (!result.ok || !Array.isArray(result.data && result.data.operations)) {notify(errorMessage(result.error),true);return;}
    opsCache = new Map(result.data.operations.map(op => [op.id,op]));
    openOperation(id);
  }

  /* --- CSV comptable genèric --- */
  function openCsv() {
    const invoices = state.invoices;
    openDialog('Exporta CSV comptable',`<p class="dialog-intro">Descarrega un CSV genèric amb les factures il·lustratives seleccionades. No és un format propi de cap gestor comptable ni modifica les factures.</p><form data-form="csv-export" novalidate>${formError}${invoices.length ? `<div class="selection-list">${invoices.map(i => `<label class="selection-row"><input type="checkbox" name="invoiceIds" value="${escape(i.id)}"><span class="selection-content"><strong>${escape(i.number)}</strong><small>${escape(clientName(i.clientId))} · ${money(i.totals.totalCents)}</small></span></label>`).join('')}</div>` : empty('Cap factura encara','Crea una factura il·lustrativa abans d’exportar.')}<div id="csv-status" role="status" aria-live="polite"></div>${invoices.length ? formActions('Descarrega el CSV') : ''}${disclaimer}</form>`);
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;link.download = filename;link.rel = 'noopener';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  async function exportCsv(form, data) {
    if (opBusy) return;
    const invoiceIds = data.getAll('invoiceIds').map(String);
    if (!invoiceIds.length) throw new InputError('Selecciona almenys una factura.','invoiceIds');
    opBusy = true;
    const submit = $('[type="submit"]',form);
    if (submit) submit.disabled = true;
    const serial = dialogSerial;
    const result = await api('exportAccountingCsv',{...snapshot(),invoiceIds});
    opBusy = false;
    if (serial !== dialogSerial) return;
    if (submit && submit.isConnected) submit.disabled = false;
    if (!result.ok) {showFormError(form,result.error);return;}
    downloadBlob(result.data.blob,result.data.filename);
    setStatus('csv-status','CSV generat: ' + result.data.filename + '. Les factures no s’han modificat.');
    notify('CSV descarregat: ' + result.data.filename + '.');
  }

  class InputError extends Error {constructor(message,field) {super(message);this.field = field;}}
  function cents(value, name) {
    const text = String(value).trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new InputError('Introdueix un import positiu o zero, amb un màxim de dos decimals.',name);
    const [euros,fraction = ''] = text.replace(',','.').split('.');
    const result = BigInt(euros) * 100n + BigInt(fraction.padEnd(2,'0'));
    if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new InputError('Aquest import és massa gran.',name);
    return Number(result);
  }
  function clearErrors(form) {
    $('.form-error',form).textContent = '';
    $$('[aria-invalid]',form).forEach(el => el.removeAttribute('aria-invalid'));
    $$('.field-error',form).forEach(el => {el.textContent = '';});
  }
  function showFormError(form, error) {
    const fieldName = error.field;
    const control = fieldName ? Array.from(form.elements).find(el => el.dataset.errorField === fieldName || el.name === fieldName) : null;
    const message = error.message || 'No s’ha pogut completar l’operació. Revisa les dades.';
    if (control && typeof control.focus === 'function') {
      control.setAttribute('aria-invalid','true');
      const fieldError = control.id && document.getElementById(control.id + '-error');
      if (fieldError) fieldError.textContent = message;
      else {const region = $('.form-error',form);region.textContent = message;control.setAttribute('aria-describedby',region.id || (region.id = 'active-form-error'));}
      control.focus();
    } else {const region = $('.form-error',form);region.textContent = message;region.focus();}
    notify(message,true);
  }
  async function commit(command, form, message, destination) {
    if (commandBusy) return null;
    if (form && form.dataset.stale === 'true') {$('.form-error',form).focus();notify('Aquest formulari correspon a una revisió anterior. Actualitza les dades i torna a obrir el document per revisar-ne el contingut vigent.',true);return null;}
    commandBusy = true;
    const controls = form ? $$('button',form) : [];
    const previous = controls.map(el => el.disabled);
    controls.forEach(el => {el.disabled = true;});
    let result;
    try {result = await store.dispatch(command);}
    finally {commandBusy = false;controls.forEach((el,index) => {if (el.isConnected) el.disabled = previous[index];});}
    if (!result.ok && ['STALE_REVIEW','REVISION_CONFLICT','STALE_REVISION','CONFLICT'].includes(result.error.code)) {
      const refreshed = await store.refresh();
      if (refreshed.ok) state = store.getState();
      if (form) {
        // Never approve or overwrite unseen concurrent changes using an old form.
        form.dataset.stale = 'true';
        const region = $('.form-error',form);
        region.innerHTML = `${escape(result.error.message)}<p>Les dades del formulari es conserven per consultar-les. Actualitza l’espai i torna a obrir el document per revisar-ne la versió vigent.</p><div class="actions">${button('Actualitza les dades','refresh-state','',true)}</div>`;
        region.focus();
        notify('Hi ha canvis més recents. Cal tornar a revisar el document abans de desar.',true);
      } else {render(true);notify(result.error.message,true);}
      return null;
    }
    if (!result.ok) {if (form) showFormError(form,result.error);else notify(result.error.message,true);return null;}
    closeDialog();
    state = store.getState();
    if (destination) {navigate(destination,result.data && result.data.id);render();}else render();
    storageStatus();
    notify(message);
    return result.data;
  }

  function editedQuoteLines(form) {
    return $$('[data-line-id]',form).map((row,index) => ({id:row.dataset.lineId,quantity:Number($('[name="quantity"]',row).value),unitPriceCents:$('[name="priceMode"]',row).value === 'tariff' ? null : cents($('[name="unitPriceCents"]',row).value,`lines[${index}].unitPriceCents`)}));
  }
  function selectedDeliveryLines(form) {
    $$('[data-quote-line] [name="quantity"]',form).forEach(control => {delete control.dataset.errorField;});
    return $$('[data-quote-line]',form).filter(row => $('[name="includeLine"]',row).checked).map((row,index) => {
      const control = $('[name="quantity"]',row);
      control.dataset.errorField = `lines[${index}].quantity`;
      return {quoteLineId:row.dataset.quoteLine,quantity:Number(control.value)};
    });
  }

  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    clearErrors(form);
    const data = new FormData(form);
    const get = key => String(data.get(key) ?? '');
    try {
      if (await workflowSubmit(form,data)) return;
      switch (form.dataset.form) {
        case 'login': {
          const submit = $('[type="submit"]',form);submit.disabled = true;
          const result = await api('login',{email:get('email').trim(),password:get('password')});
          submit.disabled = false;
          if (!result.ok) {showFormError(form,result.error);break;}
          form.reset();await bootstrap();break;
        }
        case 'backup-select':await reviewBackupFile(form);break;
        case 'legacy-import': {
          if (!data.has('confirmed')) throw new InputError('Confirma que has revisat la importació.','confirmed');
          if (!importPreview) throw new InputError('Torna a seleccionar i revisar una còpia vàlida.',null);
          if (commandBusy) break;
          commandBusy = true;
          const submit = $('[type="submit"]',form);submit.disabled = true;
          let result;
          try {result = await store.importState(importPreview.state);}
          finally {commandBusy = false;if (submit.isConnected) submit.disabled = false;}
          if (!result.ok) {showFormError(form,result.error);break;}
          closeDialog();state = store.getState();if (session.mode !== "browser") readLegacy();render(true);notify('Dades importades al servidor. La còpia original del navegador es conserva.');break;
        }
        case 'new-client': await commit({type:'CREATE_CLIENT',name:get('name'),email:get('email').trim() || null,segment:get('segment')},form,'Client fictici creat.','clients');break;
        case 'new-task': await commit({type:'CREATE_TASK',clientId:get('clientId'),text:get('text'),dueDate:get('dueDate')},form,'Seguiment desat. No s’ha enviat cap missatge.',route.module === 'calendari' ? undefined : 'seguiment');break;
        case 'new-quote': await commit({type:'DRAFT_QUOTE',clientId:get('clientId'),notes:get('notes'),tariff:get('tariff'),meetingId:form.dataset.meetingId || null,phase:'initial'},form,'Esborrany simulat creat. Revisa les peces i els imports.','pressupostos');break;
        case 'edit-quote': {
          const q = state.quotes.find(item => item.id === form.dataset.id);
          const lines = editedQuoteLines(form);
          await commit({type:'UPDATE_QUOTE',id:q.id,expectedQuoteRevision:q.revision,tariff:get('tariff'),lines},form,'Canvis desats. Cal tornar a revisar el pressupost.');break;
        }
        case 'review-quote': {
          if (!data.has('reviewed')) throw new InputError('Confirma que has revisat les peces i els imports.','reviewed');
          const q = state.quotes.find(item => item.id === form.dataset.id);
          await commit({type:'REVIEW_QUOTE',id:q.id,expectedQuoteRevision:q.revision},form,'Revisió humana confirmada. Ja pots aprovar el pressupost.');break;
        }
        case 'new-delivery': {
          const lines = selectedDeliveryLines(form);
          await commit({type:'CREATE_DELIVERY_NOTE',quoteId:get('quoteId'),lines},form,'Albarà fictici creat i incorporat al taller.','albarans');break;
        }
        case 'invoice-selection': {
          const result = store.query({type:'INVOICE_PREVIEW',deliveryNoteIds:data.getAll('deliveryNoteIds')});
          if (!result.ok) {showFormError(form,result.error);break;}
          const preview = result.data;
          openDialog('Revisa la factura il·lustrativa',`<p class="dialog-intro">Client fictici: <strong>${escape(clientName(preview.clientId))}</strong>. Comprova les peces, els albarans i els imports abans de crear el document.</p>${linesTable(preview.lines)}${totals(preview.totals,preview.taxRateBps)}<div class="source-links">${preview.deliveryNoteIds.map(id => link('albarans',id,state.deliveryNotes.find(d => d.id === id)?.number || id)).join('')}</div><form data-form="create-invoice" novalidate>${formError}<label class="check-field"><input type="checkbox" id="reviewed" name="reviewed" aria-describedby="reviewed-error"><span>He revisat aquesta selecció i els imports. Confirmo la creació d’una factura fictícia, sense validesa fiscal o legal.<span id="reviewed-error" class="field-error"></span></span></label>${formActions('Crea la factura demo')}${disclaimer}</form>`,true);
          invoicePreview = preview;
          break;
        }
        case 'create-invoice': {
          if (!invoicePreview) throw new InputError('Torna a previsualitzar els albarans. La revisió ja no està disponible.',null);
          await commit({type:'CREATE_INVOICE',deliveryNoteIds:invoicePreview.deliveryNoteIds,reviewed:data.has('reviewed'),expectedRevision:invoicePreview.stateRevision},form,'Factura il·lustrativa creada. Els albarans ja estan vinculats.','facturacio');break;
        }
        case 'filter-fabrics': {
          const request = {type:'FABRICS',text:get('text'),composition:get('composition')};
          if (get('maxPrice').trim()) request.maxPriceCents = cents(get('maxPrice'),'maxPrice');
          const result = store.query(request);
          if (result.ok) $('#fabric-results').innerHTML = fabricCards(result.data);else showFormError(form,result.error);
          break;
        }
        case 'filter-clients': {
          const result = store.query({type:'CLIENTS',text:get('clientSearch')});
          if (result.ok) $('#client-results').innerHTML = clientFolders(result.data);else showFormError(form,result.error);break;
        }
        case 'answer': {
          const text = get('question');
          if (!text.trim() || text.length > state.catalog.queryMaxLength) throw new InputError('Escriu una pregunta d’entre 1 i '+state.catalog.queryMaxLength+' caràcters.','question');
          const result = store.query({type:'ANSWER',text});
          if (result.ok) {lastAnswer = result.data;$('#answer-result').innerHTML = answerMarkup(result.data);}else showFormError(form,result.error);break;
        }
        case 'ai-answer': await runAiAnswer(form);break;
        case 'followup-save': await saveFollowup(form,data);break;
        case 'op-prepare': prepareOperation(form,data).catch(error => showFormError(form,error));break;
        case 'op-review': await operationStep(form,'reviewOperation',() => ({text:get('reviewText')}),'Operació revisada. Comprova el mode abans de confirmar l’execució.').catch(error => showFormError(form,error));break;
        case 'op-execute': await operationStep(form,'executeOperation',op => ({idempotencyKey:op.idempotencyKey,confirmed:true}),'Operació processada. Revisa el rebut i el mode d’execució.').catch(error => showFormError(form,error));break;
        case 'csv-export': exportCsv(form,data).catch(error => showFormError(form,error));break;
      }
    } catch (error) {showFormError(form,error);}
  });

  document.addEventListener('change', event => {
    const target = event.target;
    const quoteForm = target.closest('[data-form="new-quote"]');
    if (quoteForm && ['clientId','tariff','notes'].includes(target.name)) invalidateQuoteProposal();
    if (target.matches && target.matches('[data-ai-reviewed]')) {const apply = $('#ai-apply');if (apply) apply.disabled = !target.checked || !quoteProposal || quoteProposal.data.questions.length > 0;}
    const followupForm = target.closest('[data-form="followup-save"]');
    if (followupForm && ['clientId','instruction','sourceRef'].includes(target.name)) {
      invalidateFollowup();
      if (target.name === 'clientId') $('#followup-sources',followupForm).innerHTML = target.value ? followupSourcesMarkup(target.value) : '<p class="small muted">Selecciona un client per triar fonts.</p>';
    }
    const prepareForm = target.closest('[data-form="op-prepare"]');
    if (prepareForm) {
      prepareKey = newKey();
      if (['kind','clientId'].includes(target.name)) $('#op-fields',prepareForm).innerHTML = opFieldsMarkup(prepareForm.elements.kind.value,prepareForm.elements.clientId.value);
    }
    if (target.name === 'quoteId' && target.closest('[data-form="new-delivery"]')) {
      selectedQuoteId = target.value;
      const q = state.quotes.find(item => item.id === target.value);
      if (q) $('#delivery-lines').innerHTML = deliveryInputs(q);
    }
    if (target.name === 'priceMode' && target.closest('#quote-editor')) $('[name="unitPriceCents"]',target.closest('tr')).disabled = target.value === 'tariff';
  });
  document.addEventListener('input', event => {
    const target = event.target;
    if (target.closest('[data-form="new-quote"]') && ['clientId','tariff','notes'].includes(target.name)) invalidateQuoteProposal();
    if (target.closest('[data-form="followup-save"]') && ['instruction','sourceRef'].includes(target.name)) invalidateFollowup();
    if (target.closest('[data-form="op-prepare"]')) prepareKey = newKey();
    if (target.name === 'aiQuestion') {cancelJob('answer');setRunning('answer',false);lastAiAnswer = null;const box = $('#ai-answer-result');if (box) box.innerHTML = '';setStatus('ai-answer-status','');}
    if (event.target.closest('#quote-editor')) {
      $('#quote-dirty').hidden = false;
      $$('[data-action="review-quote"],[data-action="approve-quote"]').forEach(el => {el.disabled = true;});
    }
  });

  document.addEventListener('click', async event => {
    const navLink = event.target.closest('.nav-link');
    if (navLink) setMenu(false);
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = el.dataset.action;
    const id = el.dataset.id;
    if (!initialized && !['menu-open','menu-close','reload','session','dialog-close'].includes(action)) return;
    try {
    if (await workflowAction(action,id,el)) return;
    switch (action) {
      case 'session': {
        if (!session || !session.authenticated) {await bootstrap();break;}
        if (session.mode === 'local') {openDialog('Sessió local de demostració','<p>Espai local amb dades fictícies i persistència al servidor. En connectar Supabase, l’accés requerirà el compte autoritzat.</p>'+disclaimer);break;}
        openDialog('Tanca la sessió','<p>Vols sortir del teu espai privat?</p><div class="form-actions">'+button('Cancel·la','dialog-close','',true)+button('Tanca la sessió','logout')+'</div>');break;
      }
      case 'logout': {const result = await api('logout');if (!result.ok) {notify(errorMessage(result.error),true);break;}closeDialog();initialized = false;session = null;state = null;$('#print-document').innerHTML = '';await bootstrap();break;}
      case 'import-backup':openBackupFile();break;
      case 'import-preview-backup':if (importPreview) downloadBlob(new Blob([importPreview.raw],{type:'application/json'}),'newop-import-backup.json');break;
      case 'legacy-import':openImport();break;
      case 'legacy-backup':if (legacy) downloadBlob(new Blob([legacy.raw],{type:'application/json'}),'newop-browser-backup.json');break;
      case 'backup':downloadBlob(new Blob([JSON.stringify(store.getState(),null,2)],{type:'application/json'}),'newop-workspace-backup.json');notify('JSON descarregat: inclou dades i metadades, però no els arxius binaris ni els rebuts de connectors. Per a un trasllat complet, segueix el manual privat de servidor.');break;
      case 'menu-open':setMenu(true);break;
      case 'menu-close':setMenu(false);$('#menu-button').focus();break;
      case 'dialog-close':closeDialog();break;
      case 'dialog-link':closeDialog();break;
      case 'reload':window.location.reload();break;
      case 'refresh-state':closeDialog();await refreshState();break;
      case 'refresh':await refreshState();break;
      case 'reset':openDialog('Reinicia les dades de demo',`<p>Es restauraran els registres ficticis inicials. Es perdran els canvis que hagis fet en aquesta demo.</p><p class="small muted">Es restabliran les dades i s’eliminaran les fotos d’aquesta demo en aquest navegador.</p><div class="form-actions">${button('Cancel·la','dialog-close','',true)}${button('Sí, restaura la demo','confirm-reset')}</div>${disclaimer}`);break;
      case 'confirm-reset': {
        if (commandBusy) break;
        commandBusy = true;
        el.disabled = true;
        let result;
        try {result = await store.dispatch({type:'RESET',confirmed:true});}
        finally {commandBusy = false;if (el.isConnected) el.disabled = false;}
        /* reset receipt remains in the server audit journal. */

        if (!result.ok) {notify(result.error.message,true);break;}
        closeDialog();lastAnswer = null;$('#print-document').innerHTML = '';navigate('inici');render(true);notify('Demo restaurada amb les dades fictícies inicials.');break;
      }
      case 'new-client':openDialog('Nou client fictici',`<p class="dialog-intro">Crea una marca sintètica per explorar el taller. Utilitza únicament dades inventades.</p><form data-form="new-client" novalidate>${formError}${field('name','Nom de la marca fictícia',input('name','text','','required autofocus placeholder="Ex.: Estudi de Mostra"'))}${field('email','Correu fictici (opcional)',input('email','email','','placeholder="mostra@example.com"'),'Només s’admet el domini example.com. No introdueixis dades reals.')}${field('segment','Carpeta',select('segment',clientSegmentOptions))}${formActions('Crea el client fictici')}${disclaimer}</form>`);break;
      case 'new-task':openDialog('Un nou fil de seguiment',`<p class="dialog-intro">Desa una nota i una data. Aquesta acció no envia cap missatge.</p><form data-form="new-task" novalidate>${formError}${field('clientId','Client fictici',clientOptions(id || ''))}${field('text','Nota de seguiment',`<textarea id="text" name="text" aria-describedby="text-error" required autofocus placeholder="Què cal recordar?"></textarea>`)}${field('dueDate','Data prevista',input('dueDate','date',route.module === 'calendari' && route.id ? route.id : serverToday(),'required'))}${formActions('Desa el seguiment')}${disclaimer}</form>`);break;
      case 'complete-task':await commit({type:'COMPLETE_TASK',id},null,'Seguiment completat i conservat a l’historial.');break;
      case 'new-quote':newQuote(id);break;
      case 'note-example':$('#notes',overlay).value = state.catalog.noteRules[Number(el.dataset.index)].example;invalidateQuoteProposal();$('#notes',overlay).focus();break;
      case 'review-quote': {
        const q = state.quotes.find(item => item.id === id);
        openDialog('Revisió humana del pressupost',`<p class="dialog-intro">${escape(q.number)} · ${escape(clientName(q.clientId))} · Revisió ${q.revision}</p>${linesTable(q.lines)}${totals(q.totals,q.taxRateBps)}<form data-form="review-quote" data-id="${escape(id)}" novalidate>${formError}<label class="check-field"><input id="reviewed" type="checkbox" name="reviewed" aria-describedby="reviewed-error"><span>He comprovat les peces, les quantitats i els preus ficticis d’aquesta revisió.<span class="field-error" id="reviewed-error"></span></span></label>${formActions('Confirma la revisió humana')}${disclaimer}</form>`,true);break;
      }
      case 'approve-quote': {const q = state.quotes.find(item => item.id === id);await commit({type:'APPROVE_QUOTE',id,expectedQuoteRevision:q.revision},null,'Pressupost aprovat. Ja pots preparar-ne un albarà.');break;}
      case 'send-quote':await commit({type:'SEND_QUOTE',id},null,'Enviament marcat com a simulat. No s’ha enviat cap missatge.');break;
      case 'new-delivery':newDelivery(id);break;
      case 'delivery-status':await commit({type:'SET_DELIVERY_STATUS',id,status:el.dataset.status},null,'Estat de l’albarà actualitzat.');break;
      case 'new-invoice':newInvoice(id);break;
      case 'pay-invoice':openDialog('Simula el cobrament',`<p>Vols marcar aquesta factura il·lustrativa com a cobrada?</p><p class="small muted">Només es canvia un indicador de demostració. No hi ha cap càrrec, pagament ni connexió bancària.</p><div class="form-actions">${button('Cancel·la','dialog-close','',true)}${button('Confirma el cobrament simulat','confirm-payment',id)}</div>${disclaimer}`);break;
      case 'confirm-payment':await commit({type:'MARK_INVOICE_PAID',id},null,'Cobrament simulat registrat. No s’ha fet cap moviment econòmic.');break;
      case 'document': {
        const collection = {pressupostos:state.quotes,albarans:state.deliveryNotes,facturacio:state.invoices}[route.module];
        const entity = collection?.find(item => item.id === id);
        if (!entity) {notify('No s’ha trobat el document.',true);break;}
        openPaperDocument(entity,route.module);break;
      }
      case 'print':window.print();break;
      case 'ai-quote-run': {const form = el.closest('form');if (form) await runQuoteAnalysis(form);break;}
      case 'ai-apply-quote': {const form = el.closest('form');if (form) await applyQuoteProposal(form);break;}
      case 'followup-run': {const form = el.closest('form');if (form) await runFollowup(form);break;}
      case 'ai-cancel': {
        const name = el.dataset.job;
        cancelJob(name);setRunning(name,false);setStatus(`ai-${name}-status`,jobMessages[name]);
        document.getElementById(`ai-${name}-run`)?.focus();break;
      }
      case 'ai-followup':openFollowup(id);break;
      case 'connections':openConnections();break;
      case 'connections-refresh':await loadConnections();break;
      case 'outbox':openOutbox();break;
      case 'outbox-refresh':await loadOutbox();break;
      case 'op-new':openPrepare();break;
      case 'op-open':openOperation(id);break;
      case 'op-refresh':await refreshOperation(id);break;
      case 'csv-dialog':openCsv();break;
      case 'reset-fabrics': {const form = $('[data-form="filter-fabrics"]');form.reset();form.requestSubmit();break;}
      case 'reset-clients': {const form = $('[data-form="filter-clients"]');form.reset();form.requestSubmit();break;}
      case 'guided-question': {
        const question = state.catalog.guidedQuestions.find(q => q.id === id);
        $('#question').value = question.text;
        $('[data-form="answer"]').requestSubmit();
        $('#answer-result').scrollIntoView({behavior:'auto',block:'nearest'});break;
      }
    }
    } catch (error) {notify(errorMessage(error),true);}
  });

  window.addEventListener('hashchange', () => {cancelJob('answer');closeDialog();render(true);});
  window.matchMedia('(max-width: 820px)').addEventListener('change', () => setMenu(false));
  render();
})();
