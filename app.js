'use strict';
/* LabTrack – experiments, chip chambers, daily photos, consumables storage.
   All data is stored locally in IndexedDB on this device. */

const APP_VERSION = '1.8.0';
const MODELS = ['Lung-IPF', 'Lung-COPD', 'Heart-video', 'Heart-Electrophysiology', 'Knee', 'Synovium', 'Gut', 'Scar'];
const COPD_MODEL = 'Lung-COPD';
const CSE_REF = 0.07;            // CSE fraction = 0.07 / absorbance
const BASE_MEDIUM = [            // per 10 mL
  ['Pneumacult BM', 9530], ['100x supplement', 100], ['Heparin', 20], ['Hydrocortisone', 50], ['PS', 100], ['ACA', 200],
];
const BASE_MEDIUM_TOTAL = BASE_MEDIUM.reduce((s, r) => s + r[1], 0);
const WAVELENGTHS = [405, 477, 545, 637];
const CONC_UNITS = {
  'M': ['mol', 1], 'mM': ['mol', 1e-3], 'µM': ['mol', 1e-6], 'nM': ['mol', 1e-9], 'pM': ['mol', 1e-12],
  'mg/mL': ['mass', 1e-3], 'µg/mL': ['mass', 1e-6], 'ng/mL': ['mass', 1e-9], '%': ['pct', 1e-2], '×': ['x', 1],
};
const PHOTO_MAX = 1024;          // longest side in px
const PHOTO_QUALITY = 0.8;       // JPEG quality
const EXP_STATUS = ['Planned', 'Running', 'Finished'];
const CH_STATUS = { ok: 'OK', low: 'Low-density', failed: 'Failed' };
const FAIL_REASONS = ['Contamination', 'Leak', 'Bubble', 'Detachment', 'Other'];
const UNITS = ['mL', 'µL', 'L', 'g', 'mg', 'µg', 'pcs', 'box', 'pack', 'vial', 'tube', 'flask', 'plate', 'chip', 'kit'];
const CATEGORIES = ['Media', 'Reagents', 'Sera & supplements', 'Antibodies', 'Kits', 'Plastics', 'Chips', 'Other'];
const LOCATIONS = ['Fridge 4 °C', 'Freezer -20 °C', 'Freezer -80 °C', 'LN2', 'RT shelf', 'Cabinet'];

/* ---------------- icons ---------------- */
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  fwd: svg('<path d="M9 18l6-6-6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  flask: svg('<path d="M9 3h6M10 3v6l-5.6 9.4A2 2 0 0 0 6.1 21h11.8a2 2 0 0 0 1.7-2.6L14 9V3"/><path d="M7 15h10"/>'),
  box: svg('<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  cells: svg('<circle cx="8" cy="9" r="4.5"/><circle cx="16.5" cy="15.5" r="4.5"/><circle cx="17" cy="5.5" r="2"/><circle cx="6" cy="18" r="1.5"/>'),
  crop: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
};

/* ---------------- utilities ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const main = $('#main');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => Date.now();
const round = n => Math.round(n * 1e6) / 1e6;
const fmtQty = n => String(round(Number(n) || 0));
const pad2 = n => String(n).padStart(2, '0');
const expNum = e => '#' + pad2(e.number);
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
const toUTC = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayOf = (seed, dateISO) => (seed ? Math.round((toUTC(dateISO) - toUTC(seed)) / 864e5) : null);
const dateForDay = (seed, n) => { const d = new Date(toUTC(seed) + n * 864e5); return d.toISOString().slice(0, 10); };
function fmtDate(s) {
  if (!s) return '';
  const d = s.length === 10 ? new Date(s + 'T00:00') : new Date(s);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(s) { const d = new Date(s); return fmtDate(s) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
function letters(i) { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
const groupBy = (arr, k) => arr.reduce((m, x) => ((m[x[k]] ||= []).push(x), m), {});
const slug = s => String(s || '').normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

let objURLs = [];
function url(blob) { const u = URL.createObjectURL(blob); objURLs.push(u); return u; }
function revokeURLs() { objURLs.forEach(u => URL.revokeObjectURL(u)); objURLs = []; }

let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- database (IndexedDB) ---------------- */
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('labtrack', 2);
    r.onupgradeneeded = ev => {
      const d = r.result;
      if (ev.oldVersion < 2 && !d.objectStoreNames.contains('expansions')) d.createObjectStore('expansions', { keyPath: 'id' });
      if (ev.oldVersion >= 1) return;
      d.createObjectStore('experiments', { keyPath: 'id' });
      d.createObjectStore('chips', { keyPath: 'id' }).createIndex('expId', 'expId');
      const p = d.createObjectStore('photos', { keyPath: 'id' });
      p.createIndex('expId', 'expId'); p.createIndex('chipId', 'chipId');
      d.createObjectStore('items', { keyPath: 'id' });
      const m = d.createObjectStore('movements', { keyPath: 'id' });
      m.createIndex('itemId', 'itemId'); m.createIndex('expId', 'expId');
      d.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tx(stores, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(stores, mode); let out;
    Promise.resolve(fn(t)).then(v => { out = v; }).catch(e => { try { t.abort(); } catch { } rej(e); });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaction aborted'));
  });
}
const all = (store, index, key) => tx([store], 'readonly', t => { const s = t.objectStore(store); return reqP(index ? s.index(index).getAll(key) : s.getAll()); });
const get = (store, id) => tx([store], 'readonly', t => reqP(t.objectStore(store).get(id)));
const put = (store, obj) => tx([store], 'readwrite', t => { t.objectStore(store).put(obj); });
const del = (store, id) => tx([store], 'readwrite', t => { t.objectStore(store).delete(id); });

/* ---------------- dialogs ---------------- */
function dialog({ title, body = '', actions = [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', cls: 'primary' }], onMount, wide }) {
  return new Promise(res => {
    const d = document.createElement('dialog');
    d.className = 'dlg' + (wide ? ' wide' : '');
    d.innerHTML = `<form method="dialog"><h2>${title}</h2><div class="dlg-body">${body}</div>
      <div class="dlg-actions">${actions.map(a => `<button value="${a.value}" class="btn ${a.cls || ''}" ${a.value === 'cancel' || a.novalidate ? 'formnovalidate' : ''}>${a.label}</button>`).join('')}</div></form>`;
    document.body.appendChild(d);
    const form = $('form', d);
    d.addEventListener('close', () => {
      const data = Object.fromEntries(new FormData(form));
      const v = d.returnValue || 'cancel';
      d.remove();
      res({ action: v, ok: v !== 'cancel', data });
    });
    onMount && onMount(d);
    d.showModal();
  });
}
const confirmDlg = (title, msg, label = 'OK', cls = 'primary') =>
  dialog({ title, body: `<p>${msg}</p>`, actions: [{ label: 'Cancel', value: 'cancel' }, { label, value: 'ok', cls }] }).then(r => r.ok);

/* ---------------- router ---------------- */
const navStack = [location.hash || '#/'];
window.addEventListener('hashchange', () => {
  const h = location.hash || '#/';
  if (navStack[navStack.length - 2] === h) navStack.pop(); else navStack.push(h);
  route();
});
function go(h) { location.hash = h; }
function goBack(parent) {
  if (navStack.length > 1 && navStack[navStack.length - 2] === parent) history.back();
  else { navStack.pop(); location.replace(parent); }
}
function setHeader(title, { back, actions = '' } = {}) {
  $('#title').textContent = title;
  const b = $('#backBtn'); b.hidden = !back; b.innerHTML = I.back; b.onclick = () => goBack(back);
  $('#hdrActions').innerHTML = actions;
}
function setTab(t) { $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === t)); }

async function route() {
  revokeURLs();
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  setTab(p[0] === 'storage' || p[0] === 'item' ? 'storage' : p[0] === 'settings' ? 'settings' : p[0] === 'cexp' ? 'cexp' : 'exp');
  try {
    if (!p.length) return await viewExperiments();
    if (p[0] === 'exp' && p.length === 2) return await viewExperiment(p[1]);
    if (p[0] === 'exp' && p[2] === 'chip' && p[4] === 'ch') return await viewChamber(p[1], p[3], +p[5]);
    if (p[0] === 'exp' && p[2] === 'day') return await viewDay(p[1], +p[3]);
    if (p[0] === 'exp' && p[2] === 'medium') return await viewMedium(p[1], p[3]);
    if (p[0] === 'exp' && p[2] === 'stain') return await viewStaining(p[1], p[3]);
    if (p[0] === 'cexp' && p.length === 1) return await viewExpansions();
    if (p[0] === 'cexp' && p.length === 2) return await viewExpansion(p[1]);
    if (p[0] === 'cexp' && p[2] === 'split') return await viewSplit(p[1]);
    if (p[0] === 'cexp' && p[2] === 'flask') return await viewFlask(p[1], p[3]);
    if (p[0] === 'storage') return await viewStorage();
    if (p[0] === 'item') return await viewItem(p[1]);
    if (p[0] === 'settings') return await viewSettings();
    return await viewExperiments();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty">Something went wrong:<br><code>${esc(e.message)}</code></div>`;
  }
}
async function rerender() { const y = scrollY; await route(); scrollTo(0, y); }

/* =========================================================
   EXPERIMENTS LIST
   ========================================================= */
let expFilter = 'active';
async function viewExperiments() {
  setHeader('Experiments', { actions: `<button class="icon" id="impBtn" title="Import experiment file">${I.upload}</button>` });
  $('#impBtn').onclick = importFromFile;
  const [exps, chips] = await Promise.all([all('experiments'), all('chips')]);
  exps.sort((a, b) => b.number - a.number);
  const byExp = groupBy(chips, 'expId');
  const shown = exps.filter(e => expFilter === 'all' || (expFilter === 'active' ? e.status !== 'Finished' : e.status === 'Finished'));
  main.innerHTML = `
    <div class="seg" id="expSeg">${[['active', 'Active'], ['finished', 'Finished'], ['all', 'All']].map(([k, l]) =>
      `<button data-k="${k}" class="${expFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${shown.length ? shown.map(e => expCard(e, byExp[e.id] || [])).join('')
      : `<div class="empty">${exps.length ? 'No experiments in this view.' : 'No experiments yet.<br>Tap <b>New experiment</b> to start.'}</div>`}
    <button class="fab" id="newExp">${I.plus}<span>New experiment</span></button>`;
  $$('#expSeg button').forEach(b => b.onclick = () => { expFilter = b.dataset.k; route(); });
  $('#newExp').onclick = newExperiment;
}
function expCard(e, chips) {
  const ch = chips.flatMap(c => c.chambers);
  const failed = ch.filter(x => x.status === 'failed').length, low = ch.filter(x => x.status === 'low').length;
  const day = e.seedingDate ? dayOf(e.seedingDate, todayISO()) : null;
  return `<a class="card exp-card" href="#/exp/${e.id}">
    <div class="row"><span class="expnum">${expNum(e)}</span><span class="title">${esc(e.title || 'Untitled')}</span>
      <span class="badge st-${e.status.toLowerCase()}">${e.status}</span></div>
    ${e.model ? `<div class="meta"><span class="tag model">${esc(e.model)}</span></div>` : ''}
    <div class="meta">${e.seedingDate ? `Seeded ${fmtDate(e.seedingDate)}${e.status !== 'Finished' ? ` · <b>Day ${day}</b>` : ''}` : 'No seeding date'}${e.protocol ? ' · ' + esc(e.protocol) : ''}${e.cellsHarvested ? ' · ' + esc(e.cellsHarvested) + ' cells' : ''}</div>
    <div class="meta">${chips.length} chip${chips.length === 1 ? '' : 's'} · ${ch.length} chambers${low ? ` · <span class="dot low"></span>${low} low` : ''}${failed ? ` · <span class="dot failed"></span>${failed} failed` : ''}</div>
  </a>`;
}
async function newExperiment() {
  const exps = await all('experiments');
  const num = exps.reduce((m, e) => Math.max(m, e.number), 0) + 1;
  const r = await dialog({
    title: `New experiment #${pad2(num)}`,
    body: `<label>Title / short description<input name="title" placeholder="e.g. Cardiac chips – donor 3"></label>
      <label>Model<select name="model" required>${modelOptions(await getModels(), '')}</select></label>
      <div class="grid2"><label>Seeding date<input type="date" name="seedingDate" value="${todayISO()}"></label>
      <label>Status<select name="status">${EXP_STATUS.map(s => `<option ${s === 'Running' ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      <label>Protocol<input name="protocol"></label>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', value: 'ok', cls: 'primary' }],
    onMount: d => bindModelSelect($('[name=model]', d)),
  });
  if (!r.ok) return;
  const e = { id: uid(), number: num, title: r.data.title.trim(), model: r.data.model, seedingDate: r.data.seedingDate, status: r.data.status,
    protocol: r.data.protocol.trim(), cellsHarvested: '', notes: '', conditions: [], drugs: [], mediumChanges: [], stainings: [],
    createdAt: now(), updatedAt: now() };
  await put('experiments', e);
  go('#/exp/' + e.id);
}

/* =========================================================
   EXPERIMENT PAGE
   ========================================================= */
async function viewExperiment(id) {
  const e = await get('experiments', id);
  if (!e) return go('#/');
  const [chips, photos, movs, items, models] = await Promise.all([all('chips', 'expId', id), all('photos', 'expId', id), all('movements', 'expId', id), all('items'), getModels()]);
  chips.sort((a, b) => a.idx - b.idx);
  await ensureExpShape(e, chips);
  const copd = e.model === COPD_MODEL;
  setHeader(`${expNum(e)} ${e.title || ''}`, {
    back: '#/',
    actions: `<button class="icon" id="expExport" title="Export experiment">${I.download}</button>
              <button class="icon" id="expDelete" title="Delete experiment">${I.trash}</button>`,
  });
  const today = e.seedingDate ? dayOf(e.seedingDate, todayISO()) : null;
  const latest = {};
  for (const p of photos) { const k = p.chipId + '_' + p.chamber; if (!latest[k] || p.day > latest[k].day) latest[k] = p; }
  const days = [...new Set(photos.map(p => p.day))].sort((a, b) => a - b);
  const allCh = chips.flatMap(c => c.chambers);
  const nFailed = allCh.filter(c => c.status === 'failed').length;
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const used = {};
  for (const m of movs) { if (m.delta >= 0) continue; const u = (used[m.itemId] ||= { total: 0, n: 0 }); u.total += -m.delta; u.n++; }
  const mcs = [...e.mediumChanges].sort((a, b) => b.date.localeCompare(a.date) || b.savedAt - a.savedAt);
  const sts = [...e.stainings].sort((a, b) => b.date.localeCompare(a.date) || b.savedAt - a.savedAt);

  main.innerHTML = `
  <section class="card" id="info">
    <div class="grid2">
      <label class="span2">Title<input name="title" value="${esc(e.title)}"></label>
      <label>Model<select name="model">${modelOptions(models, e.model)}</select></label>
      <label>Status<select name="status">${EXP_STATUS.map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Seeding date<input type="date" name="seedingDate" value="${esc(e.seedingDate)}"></label>
      <label>Protocol<input name="protocol" value="${esc(e.protocol)}"></label>
    </div>
    <div class="cellcount" id="cellCount">
      <div class="cc-head">Cell count</div>
      <div class="grid2">
        <label>Dilution factor<input id="ccDil" type="number" step="any" min="0" inputmode="decimal" value="${esc(e.cellCount?.dilution ?? '')}" placeholder="e.g. 2"></label>
        <div></div>
      </div>
      <div class="cc-label">Counts</div>
      <div class="cc-counts" id="ccCounts">${(e.cellCount?.counts?.length ? e.cellCount.counts : ['']).map(v =>
        `<span class="cc-cnt"><input data-cnt type="number" step="any" min="0" inputmode="decimal" value="${esc(v)}" placeholder="count"><button type="button" class="icon sm" data-rmcnt title="Remove">${I.close}</button></span>`).join('')}
        <button type="button" class="btn" id="ccAdd">${I.plus} Count</button></div>
      <div class="cc-result" id="ccRes"></div>
    </div>
    <div class="stats">
      <div><b>${today ?? '–'}</b><span>Day</span></div>
      <div><b>${chips.length}</b><span>Chips seeded</span></div>
      <div><b>${allCh.length}</b><span>Chambers</span></div>
      <div><b style="color:${nFailed ? 'var(--failed)' : 'inherit'}">${nFailed}</b><span>Failed</span></div>
    </div>
    <label>Notes<textarea name="notes" rows="3">${esc(e.notes)}</textarea></label>
  </section>

  <div class="sec-head"><h2>Chips (${chips.length})</h2><button class="btn primary" id="addChip">${I.plus} Add chip</button></div>
  ${chips.length ? `<div class="chips">${chips.map(c => chipCard(e, c, latest)).join('')}</div>`
    : `<div class="card empty">No chips yet. Tap <b>Add chip</b> – chips are named A, B, C… with 3 chambers each.</div>`}

  <div class="sec-head"><h2>Conditions</h2><button class="btn" id="addCond">${I.plus} Condition</button></div>
  <div class="card">${e.conditions.length ? e.conditions.map(c => {
    const n = chips.reduce((t, x) => t + [0, 1, 2].filter(i => chCondId(x, i) === c.id).length, 0);
    return `<button class="used rowbtn" data-cond="${c.id}"><span><b>${esc(c.name)}</b>${copd ? ` <span class="muted">${esc(condDesc(e, c))}</span>` : ''}</span><span class="muted">${n} chamber${n === 1 ? '' : 's'}</span></button>`;
  }).join('') : `<div class="muted">No conditions yet.${copd ? ' For COPD, define each condition with CSE and/or drugs – they drive the medium-change calculation.' : ''}</div>`}</div>

  ${copd ? `<div class="sec-head"><h2>Drugs</h2><button class="btn" id="addDrug">${I.plus} Drug</button></div>
  <div class="card">${e.drugs.length ? e.drugs.map(d => `<button class="used rowbtn" data-drug="${d.id}"><span><b>${esc(d.name)}</b></span><span class="muted">${esc(drugDesc(d))}</span></button>`).join('')
    : '<div class="muted">No drugs yet. Add each drug with its dilution (ratio 1:X, or stock → final concentration).</div>'}</div>

  <div class="sec-head"><h2>Medium changes</h2><a class="btn primary" href="#/exp/${id}/medium/new">${I.plus} New medium change</a></div>
  <div class="card">${mcs.length ? mcs.map(m => `<a class="used" href="#/exp/${id}/medium/${m.id}"><span><b>${m.day != null ? 'Day ' + m.day : ''}</b> ${fmtDate(m.date)}</span>
      <span class="muted">Abs ${m.absorbance != null ? fmtN(m.absorbance) : '–'} · CSE ${m.cseFraction ? fmtN(m.cseFraction * 100) + '%' : '–'}</span></a>`).join('')
    : '<div class="muted">No medium changes recorded yet.</div>'}</div>` : ''}

  <div class="sec-head"><h2>Stainings</h2><a class="btn primary" href="#/exp/${id}/stain/new">${I.plus} New staining</a></div>
  <div class="card">${sts.length ? sts.map(s => {
    const img = WAVELENGTHS.some(w => s.imaging?.[w]?.laser || s.imaging?.[w]?.exposure);
    return `<a class="used" href="#/exp/${id}/stain/${s.id}"><span><b>${esc(s.title || 'Staining')}</b> <span class="muted">${s.day != null ? 'Day ' + s.day + ' · ' : ''}${fmtDate(s.date)} · ${s.nChambers} ch.</span></span>
      ${img ? '<span class="tag ok">Imaging ✓</span>' : '<span class="tag soon">Imaging to fill</span>'}</a>`;
  }).join('') : '<div class="muted">No stainings yet.</div>'}</div>

  ${days.length ? `<div class="sec-head"><h2>Photos by day</h2></div>
    <div class="pills">${days.map(d => `<a class="pill" href="#/exp/${id}/day/${d}">Day ${d}</a>`).join('')}</div>` : ''}

  <div class="sec-head"><h2>Consumables used</h2></div>
  <div class="card">${Object.keys(used).length ? Object.entries(used).map(([iid, u]) => {
    const it = itemMap[iid];
    return `<div class="used"><span>${it ? `<a href="#/item/${iid}">${esc(it.name)}</a>` : '<i>deleted item</i>'}</span><span><b>${fmtQty(u.total)} ${esc(it?.unit || '')}</b> <span class="muted">(${u.n}×)</span></span></div>`;
  }).join('') : '<div class="muted">Nothing yet. When you remove something in Storage, pick this experiment to link it here.</div>'}</div>`;

  // autosave main info
  $$('#info [name]:not([name=model])').forEach(el => el.addEventListener('change', async () => {
    e[el.name] = el.value.trim(); await saveExp(e);
    if (['title', 'seedingDate', 'status'].includes(el.name)) rerender(); else toast('Saved');
  }));
  const ccRender = () => {
    const r = cellTotal(e.cellCount);
    $('#ccRes').innerHTML = r ? `Average <b>${fmtN(r.avg)}</b> (${r.n} count${r.n === 1 ? '' : 's'}) × ${fmtN(r.dil)} × 10⁴ = <span class="cc-total">${fmtSci(r.total)} cells</span>`
      : `<span class="muted">${e.cellsHarvested && !e.cellCount ? `Previously entered: <b>${esc(e.cellsHarvested)}</b>. ` : ''}Enter dilution factor and at least one count. Total = average(counts) × dilution factor × 10⁴</span>`;
  };
  const ccSave = async () => {
    const counts = $$('#ccCounts [data-cnt]').map(i => i.value.trim()).filter(v => v !== '' && isFinite(+v)).map(Number);
    e.cellCount = { dilution: $('#ccDil').value === '' ? '' : Number($('#ccDil').value), counts };
    const r = cellTotal(e.cellCount);
    e.cellsHarvested = r ? fmtSci(r.total, true) : '';
    await saveExp(e); ccRender();
  };
  const ccBind = el => {
    el.querySelector('[data-cnt]').addEventListener('input', () => { e.cellCount = { dilution: +$('#ccDil').value || '', counts: $$('#ccCounts [data-cnt]').map(i => i.value).filter(v => v !== '').map(Number) }; ccRender(); });
    el.querySelector('[data-cnt]').addEventListener('change', ccSave);
    el.querySelector('[data-cnt]').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ccAddField(); } });
    el.querySelector('[data-rmcnt]').onclick = () => { if ($$('#ccCounts .cc-cnt').length > 1) el.remove(); else el.querySelector('[data-cnt]').value = ''; ccSave(); };
  };
  const ccAddField = () => {
    const span = document.createElement('span'); span.className = 'cc-cnt';
    span.innerHTML = `<input data-cnt type="number" step="any" min="0" inputmode="decimal" placeholder="count"><button type="button" class="icon sm" data-rmcnt title="Remove">${I.close}</button>`;
    $('#ccAdd').before(span); ccBind(span); span.querySelector('input').focus();
  };
  $$('#ccCounts .cc-cnt').forEach(ccBind);
  $('#ccAdd').onclick = ccAddField;
  $('#ccDil').addEventListener('input', () => { e.cellCount = { ...(e.cellCount || { counts: [] }), dilution: +$('#ccDil').value || '' }; ccRender(); });
  $('#ccDil').addEventListener('change', ccSave);
  ccRender();
  bindModelSelect($('#info [name=model]'), async m => { e.model = m; await saveExp(e); toast('Model: ' + m); rerender(); });
  $('#addChip').onclick = () => addChips(e, chips);
  $$('[data-editchip]').forEach(b => b.onclick = () => editChip(e, chips.find(c => c.id === b.dataset.editchip)));
  $('#addCond').onclick = async () => { if (await condDialog(e, null)) rerender(); };
  $$('[data-cond]').forEach(b => b.onclick = async () => { if (await condDialog(e, e.conditions.find(c => c.id === b.dataset.cond))) rerender(); });
  $('#addDrug') && ($('#addDrug').onclick = async () => { if (await drugDialog(e, null)) rerender(); });
  $$('[data-drug]').forEach(b => b.onclick = async () => { if (await drugDialog(e, e.drugs.find(d => d.id === b.dataset.drug))) rerender(); });
  $('#expExport').onclick = () => exportMenu('exp', id);
  $('#expDelete').onclick = async () => {
    if (!await confirmDlg('Delete experiment?', `${expNum(e)} ${esc(e.title)} with all its chips and ${photos.length} photos will be permanently deleted from this device. Consider exporting it first.`, 'Delete', 'danger')) return;
    await deleteExperiment(id); toast('Experiment deleted'); goBack('#/');
  };
}
function chipCard(e, c, latest) {
  const cn = condName(e, c);
  return `<div class="card">
    <div class="chip-head"><span class="chip-letter">${c.letter}</span>
      <span class="cond">${chipMixed(c) ? '<span class="muted">Mixed conditions</span>' : cn ? esc(cn) : '<span class="muted">No condition set</span>'}</span>
      <button class="icon sm" data-editchip="${c.id}" title="Edit chip">${I.edit}</button></div>
    <div class="chambers">${c.chambers.map((ch, i) => {
      const n = i + 1, p = latest[c.id + '_' + n];
      return `<a class="chamber st-${ch.status}" href="#/exp/${e.id}/chip/${c.id}/ch/${n}" title="${CH_STATUS[ch.status]}">
        ${p ? `<img src="${url(photoBlob(p))}" alt="">` : I.camera}
        <span class="ch-label">${c.letter}${n}</span>
        ${p ? `<span class="ch-day">D${p.day}</span>` : ''}
        ${ch.notes ? '<span class="ch-note">✎</span>' : ''}
        ${chipMixed(c) ? `<span class="ch-cond">${esc(chCondName(e, c, i) || '–')}</span>` : ''}
        ${ch.status === 'failed' ? '<span class="ch-fail">FAIL</span>' : ch.status === 'low' ? '<span class="ch-fail" style="background:var(--low);color:#241c00">LOW</span>' : ''}
      </a>`;
    }).join('')}</div>
    ${c.notes ? `<div class="chip-notes">${esc(c.notes)}</div>` : ''}
  </div>`;
}
const newChamber = () => ({ status: 'ok', notes: '', failReason: '', failDay: null, failNote: '' });
async function addChips(e, chips) {
  const next = chips.reduce((m, c) => Math.max(m, c.idx + 1), 0);
  const r = await dialog({
    title: 'Add chip',
    body: `<label>How many chips?<input type="number" name="n" min="1" max="52" value="1" inputmode="numeric" required></label>
      <p class="muted" id="namesPrev"></p>
      <label>Condition (whole chip)<select name="cond">${condOptions(e, '')}</select></label>
      <label class="check"><input type="checkbox" name="perch" id="perch"> Different condition per chamber</label>
      <div id="perchBox" hidden>${chamberCondSelects(e, null)}<p class="muted calcnote" style="margin:0">Applied to chambers 1, 2, 3 of every chip added.</p></div>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add', value: 'ok', cls: 'primary' }],
    onMount: d => {
      $('#perch', d).onchange = ev => { $('#perchBox', d).hidden = !ev.target.checked; };
      $$('#perchBox select', d).forEach(sel => bindCondSelect(sel, e, d));
      const inp = $('[name=n]', d);
      const upd = () => { const n = Math.max(1, Math.min(52, +inp.value || 1)); $('#namesPrev', d).textContent = 'Will be named: ' + Array.from({ length: n }, (_, i) => letters(next + i)).join(', '); };
      inp.addEventListener('input', upd); upd();
      bindCondSelect($('[name=cond]', d), e, d);
    },
  });
  if (!r.ok) return;
  const n = Math.max(1, Math.min(52, +r.data.n || 1));
  const cond = e.conditions.find(c => c.id === r.data.cond);
  const chc = r.data.perch ? readChamberConds(r.data, cond?.id) : [null, null, null];
  await tx(['chips', 'experiments'], 'readwrite', t => {
    for (let i = 0; i < n; i++) {
      t.objectStore('chips').put({ id: uid(), expId: e.id, idx: next + i, letter: letters(next + i), conditionId: cond?.id || null, condition: cond?.name || '', notes: '',
        chambers: chc.map(cid => ({ ...newChamber(), conditionId: cid })), createdAt: now(), updatedAt: now() });
    }
    e.updatedAt = now(); t.objectStore('experiments').put(e);
  });
  toast(n === 1 ? `Chip ${letters(next)} added` : `${n} chips added`);
  rerender();
}
async function editChip(e, c) {
  const r = await dialog({
    title: `Chip ${c.letter}`,
    body: `<label>Condition (whole chip)<select name="cond">${condOptions(e, c.conditionId)}</select></label>
      ${chamberCondSelects(e, c)}
      <label>Notes<textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>`,
    actions: [{ label: 'Delete chip', value: 'delete', cls: 'danger', novalidate: true }, { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', cls: 'primary' }],
    onMount: d => { bindCondSelect($('[name=cond]', d), e, d); $$('.chcond select', d).forEach(sel => bindCondSelect(sel, e, d)); },
  });
  if (r.action === 'delete') {
    if (!await confirmDlg(`Delete chip ${c.letter}?`, 'The chip, its 3 chambers and all their photos will be permanently deleted.', 'Delete', 'danger')) return;
    await tx(['chips', 'photos'], 'readwrite', async t => {
      t.objectStore('chips').delete(c.id);
      const s = t.objectStore('photos');
      (await reqP(s.index('chipId').getAllKeys(c.id))).forEach(k => s.delete(k));
    });
    toast(`Chip ${c.letter} deleted`); return rerender();
  }
  if (!r.ok) return;
  const cond = e.conditions.find(x => x.id === r.data.cond);
  c.conditionId = cond?.id || null; c.condition = cond?.name || ''; c.notes = r.data.notes.trim(); c.updatedAt = now();
  readChamberConds(r.data, c.conditionId).forEach((cid, i) => { c.chambers[i].conditionId = cid; });
  await put('chips', c); rerender();
}

/* ---------------- models, conditions, drugs ---------------- */
async function saveExp(e) { e.updatedAt = now(); await put('experiments', e); }
async function getModels() { const m = await get('meta', 'models'); return [...new Set([...MODELS, ...(m?.list || [])])]; }
async function addModel(name) {
  const m = (await get('meta', 'models')) || { key: 'models', list: [] };
  if (!m.list.includes(name) && !MODELS.includes(name)) m.list.push(name);
  await put('meta', m);
}
function modelOptions(models, cur) {
  return `${cur && !models.includes(cur) ? `<option selected>${esc(cur)}</option>` : ''}<option value="" ${!cur ? 'selected' : ''}>— select model —</option>
    ${models.map(m => `<option ${m === cur ? 'selected' : ''}>${esc(m)}</option>`).join('')}<option value="__new">+ New model…</option>`;
}
function bindModelSelect(sel, onPicked) {
  let prev = sel.value;
  sel.addEventListener('change', async () => {
    if (sel.value !== '__new') { prev = sel.value; onPicked && sel.value && onPicked(sel.value); return; }
    const r = await dialog({ title: 'New model', body: '<label>Model name<input name="name" required placeholder="e.g. Liver-NASH"></label>',
      actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add', value: 'ok', cls: 'primary' }] });
    const n = r.ok ? r.data.name.trim() : '';
    if (!n) { sel.value = prev; return; }
    await addModel(n);
    if (![...sel.options].some(o => o.value === n)) sel.insertBefore(new Option(n, n), sel.lastElementChild);
    sel.value = n; prev = n; onPicked && onPicked(n);
  });
}
async function ensureExpShape(e, chips) {
  let dirty = false;
  for (const k of ['conditions', 'drugs', 'mediumChanges', 'stainings']) if (!Array.isArray(e[k])) { e[k] = []; dirty = true; }
  const changed = [];
  for (const c of chips) {
    if (c.conditionId || !c.condition) continue;
    let cd = e.conditions.find(x => x.name === c.condition);
    if (!cd) { cd = { id: uid(), name: c.condition, cse: false, drugIds: [] }; e.conditions.push(cd); dirty = true; }
    c.conditionId = cd.id; changed.push(c);
  }
  if (dirty || changed.length) await tx(['experiments', 'chips'], 'readwrite', t => { t.objectStore('experiments').put(e); changed.forEach(c => t.objectStore('chips').put(c)); });
}
const condName = (e, c) => (e.conditions || []).find(x => x.id === c.conditionId)?.name || c.condition || '';
// chamber-level condition: a chamber can override its chip's condition
const chCondId = (c, i) => c.chambers[i]?.conditionId || c.conditionId || null;
const chCondName = (e, c, i) => c.chambers[i]?.conditionId ? ((e.conditions || []).find(x => x.id === c.chambers[i].conditionId)?.name || '') : condName(e, c);
const chipMixed = c => c.chambers.some(ch => ch.conditionId && ch.conditionId !== c.conditionId);
function chamberCondSelects(e, c) {
  return `<div class="muted" style="font-size:13px;font-weight:600;margin:6px 0 4px">Chamber conditions</div><div class="chcond">${[0, 1, 2].map(i =>
    `<label>${c ? c.letter : ''}${i + 1}<select name="chc${i}"><option value="">As chip</option>${e.conditions.map(x => `<option value="${x.id}" ${c?.chambers[i]?.conditionId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ New condition…</option></select></label>`).join('')}</div>`;
}
function readChamberConds(data, chipCondId) {
  return [0, 1, 2].map(i => { const v = data['chc' + i]; return v && v !== '__new' && v !== chipCondId ? v : null; });
}
function condDesc(e, c) {
  const parts = [];
  if (c.cse) parts.push('CSE');
  for (const id of c.drugIds || []) { const d = e.drugs.find(x => x.id === id); if (d) parts.push(d.name); }
  return parts.length ? parts.join(' + ') : 'medium only';
}
function condOptions(e, cur) {
  return `<option value="">— none —</option>${e.conditions.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ New condition…</option>`;
}
function bindCondSelect(sel, e, scope, onPicked) {
  let prev = sel.value;
  sel.addEventListener('change', async () => {
    if (sel.value !== '__new') { prev = sel.value; onPicked && onPicked(sel.value); return; }
    const c = await condDialog(e, null);
    if (!c) { sel.value = prev; return; }
    for (const s2 of scope ? $$('select', scope).filter(x => [...x.options].some(o => o.value === '__new')) : [sel]) s2.insertBefore(new Option(c.name, c.id), s2.lastElementChild);
    sel.value = c.id; prev = c.id; onPicked && onPicked(c.id);
  });
}
async function condDialog(e, c) {
  const isNew = !c, copd = e.model === COPD_MODEL;
  c = c ? { ...c, drugIds: [...(c.drugIds || [])] } : { id: uid(), name: '', cse: false, drugIds: [] };
  const r = await dialog({
    title: isNew ? 'New condition' : 'Edit condition',
    body: `<label>Name<input name="name" required value="${esc(c.name)}" placeholder="e.g. Ctrl, CSE, CSE + Drug A"></label>
      ${copd ? `<label class="check"><input type="checkbox" name="cse" ${c.cse ? 'checked' : ''}> CSE</label>
      <div class="muted" style="font-size:13px;font-weight:600;margin:6px 0">Drugs</div>
      ${e.drugs.length ? e.drugs.map(d => `<label class="check"><input type="checkbox" name="drug_${d.id}" ${c.drugIds.includes(d.id) ? 'checked' : ''}> ${esc(d.name)} <span class="muted">${esc(drugDesc(d))}</span></label>`).join('')
        : '<p class="muted">No drugs defined yet – add them in the Drugs section of the experiment.</p>'}` : ''}`,
    actions: [...(isNew ? [] : [{ label: 'Delete', value: 'delete', cls: 'danger', novalidate: true }]), { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', cls: 'primary' }],
  });
  if (r.action === 'delete') {
    const chips = (await all('chips', 'expId', e.id)).filter(x => x.conditionId === c.id || x.chambers.some(ch => ch.conditionId === c.id));
    if (!await confirmDlg('Delete condition?', `${esc(c.name)} will be removed${chips.length ? ` and the chips/chambers using it will have no condition` : ''}.`, 'Delete', 'danger')) return null;
    e.conditions = e.conditions.filter(x => x.id !== c.id);
    await tx(['experiments', 'chips'], 'readwrite', t => {
      e.updatedAt = now(); t.objectStore('experiments').put(e);
      chips.forEach(x => { if (x.conditionId === c.id) { x.conditionId = null; x.condition = ''; } x.chambers.forEach(ch => { if (ch.conditionId === c.id) ch.conditionId = null; }); x.updatedAt = now(); t.objectStore('chips').put(x); });
    });
    return c;
  }
  if (!r.ok) return null;
  c.name = r.data.name.trim();
  if (copd) { c.cse = !!r.data.cse; c.drugIds = e.drugs.filter(d => r.data['drug_' + d.id]).map(d => d.id); }
  const i = e.conditions.findIndex(x => x.id === c.id);
  if (i < 0) e.conditions.push(c); else e.conditions[i] = c;
  const chips = isNew ? [] : (await all('chips', 'expId', e.id)).filter(x => x.conditionId === c.id && x.condition !== c.name);
  await tx(['experiments', 'chips'], 'readwrite', t => {
    e.updatedAt = now(); t.objectStore('experiments').put(e);
    chips.forEach(x => { x.condition = c.name; x.updatedAt = now(); t.objectStore('chips').put(x); });
  });
  return c;
}
function cellTotal(cc) {
  const counts = (cc?.counts || []).filter(v => v !== '' && isFinite(v)).map(Number);
  const dil = Number(cc?.dilution);
  if (!counts.length || !(dil > 0)) return null;
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  return { n: counts.length, avg, dil, total: avg * dil * 1e4 };
}
function fmtSci(x, plain) {
  if (!(x > 0)) return '0';
  const ex = Math.floor(Math.log10(x)), m = x / 10 ** ex;
  if (ex < 3) return fmtN(x);
  const sup = String(ex).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('');
  return `${m.toFixed(2)} × 10${plain ? sup : '<sup>' + ex + '</sup>'}`;
}
const fmtN = x => String(Number(Number(x).toPrecision(4)));
function fmtUL(v) {
  if (v == null || !isFinite(v)) return '–';
  const a = Math.abs(v);
  return (a === 0 ? '0' : a < 10 ? v.toFixed(2) : a < 100 ? v.toFixed(1) : String(Math.round(v))) + ' µL';
}
function parseRatio(s) {
  s = String(s ?? '').trim().replace(',', '.');
  const m = s.match(/^1\s*[:/]\s*([\d.]+(?:e[+-]?\d+)?)$/i);
  const x = m ? parseFloat(m[1]) : parseFloat(s);
  return x > 0 && isFinite(x) && (m || /^[\d.]+(e[+-]?\d+)?$/i.test(s)) ? x : null;
}
function drugFraction(d) {
  if (!d) return null;
  if (d.mode === 'conc') {
    const a = CONC_UNITS[d.stockUnit], b = CONC_UNITS[d.finalUnit];
    if (!a || !b || a[0] !== b[0]) return null;
    const st = parseFloat(d.stock) * a[1], fi = parseFloat(d.final) * b[1];
    if (!(st > 0 && fi > 0) || fi > st) return null;
    return fi / st;
  }
  const x = parseFloat(d.ratio);
  return x >= 1 ? 1 / x : null;
}
function drugDesc(d) {
  const f = drugFraction(d);
  const base = d.mode === 'conc' ? `${d.stock} ${d.stockUnit} → ${d.final} ${d.finalUnit}` : `1:${d.ratio}`;
  return f ? `${base} · ${fmtUL(f * 1000)}/mL` : `${base} – invalid`;
}
async function drugDialog(e, d) {
  const isNew = !d;
  d = d ? { ...d } : { id: uid(), name: '', mode: 'ratio', ratio: '', stock: '', stockUnit: 'mM', final: '', finalUnit: 'µM' };
  const unitOpts = cur => Object.keys(CONC_UNITS).map(u => `<option ${u === cur ? 'selected' : ''}>${u}</option>`).join('');
  const r = await dialog({
    title: isNew ? 'New drug' : 'Edit drug',
    body: `<label>Drug name<input name="name" required value="${esc(d.name)}"></label>
      <div class="seg" id="modeSeg"><button type="button" data-m="ratio">Ratio 1:X</button><button type="button" data-m="conc">Stock → final</button></div>
      <input type="hidden" name="mode" value="${d.mode}">
      <div id="mRatio"><label>Dilution<input name="ratio" value="${d.ratio ? '1:' + d.ratio : ''}" placeholder="1:1000"></label></div>
      <div id="mConc" class="grid2">
        <label>Stock conc.<input name="stock" type="number" step="any" min="0" inputmode="decimal" value="${esc(d.stock)}"></label><label>Unit<select name="stockUnit">${unitOpts(d.stockUnit)}</select></label>
        <label>Final conc.<input name="final" type="number" step="any" min="0" inputmode="decimal" value="${esc(d.final)}"></label><label>Unit<select name="finalUnit">${unitOpts(d.finalUnit)}</select></label>
      </div>
      <p class="muted" id="drugPrev"></p>`,
    actions: [...(isNew ? [] : [{ label: 'Delete', value: 'delete', cls: 'danger', novalidate: true }]), { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', cls: 'primary' }],
    onMount: dl => {
      const f = $('form', dl).elements;
      const upd = () => {
        const m = f.mode.value;
        $$('#modeSeg button', dl).forEach(b => b.classList.toggle('on', b.dataset.m === m));
        $('#mRatio', dl).hidden = m !== 'ratio'; $('#mConc', dl).hidden = m !== 'conc';
        const fr = drugFraction({ mode: m, ratio: parseRatio(f.ratio.value), stock: f.stock.value, stockUnit: f.stockUnit.value, final: f.final.value, finalUnit: f.finalUnit.value });
        $('#drugPrev', dl).textContent = fr ? `= 1:${fmtN(1 / fr)} → ${fmtUL(fr * 1000)} per mL of medium` : 'Enter a valid dilution';
        f.ratio.setCustomValidity(m === 'ratio' && !fr ? 'Enter a dilution like 1:1000' : '');
        f.final.setCustomValidity(m === 'conc' && !fr ? 'Units must be compatible and final ≤ stock' : '');
      };
      $$('#modeSeg button', dl).forEach(b => b.onclick = () => { f.mode.value = b.dataset.m; upd(); });
      $('form', dl).addEventListener('input', upd); $('form', dl).addEventListener('change', upd); upd();
    },
  });
  if (r.action === 'delete') {
    if (!await confirmDlg('Delete drug?', `${esc(d.name)} will be removed from all conditions.`, 'Delete', 'danger')) return false;
    e.drugs = e.drugs.filter(x => x.id !== d.id);
    e.conditions.forEach(c => { c.drugIds = (c.drugIds || []).filter(x => x !== d.id); });
    await saveExp(e); return true;
  }
  if (!r.ok) return false;
  Object.assign(d, { name: r.data.name.trim(), mode: r.data.mode, ratio: parseRatio(r.data.ratio) || '', stock: r.data.stock, stockUnit: r.data.stockUnit, final: r.data.final, finalUnit: r.data.finalUnit });
  const i = e.drugs.findIndex(x => x.id === d.id);
  if (i < 0) e.drugs.push(d); else e.drugs[i] = d;
  await saveExp(e); return true;
}

/* ---------------- COPD medium change ---------------- */
async function viewMedium(expId, mid) {
  const e = await get('experiments', expId);
  if (!e) return go('#/');
  const chips = await all('chips', 'expId', expId);
  await ensureExpShape(e, chips);
  const isNew = mid === 'new';
  const mc = isNew ? null : e.mediumChanges.find(m => m.id === mid);
  if (!isNew && !mc) return go('#/exp/' + expId);
  const conds = e.conditions;
  const activeChambers = cid => chips.reduce((t, c) => t + c.chambers.filter((ch, i) => ch.status !== 'failed' && chCondId(c, i) === cid).length, 0);
  const st = mc || { date: todayISO(), absorbance: '', volPerChip: 1, counts: {}, notes: '', countUnit: 'chamber' };
  // readings: up to 2 CSE + 2 blank; records before v1.7 only stored the final absorbance
  const rd = st.cseReadings ? { cse: [...st.cseReadings, '', ''], blank: [...(st.blankReadings || []), '', ''] }
    : { cse: [st.absorbance ?? '', ''], blank: [st.absorbance != null && st.absorbance !== '' ? 0 : '', ''] };
  const oldUnit = st.countUnit !== 'chamber';                 // records saved before v1.6 counted chips
  const count = cid => st.counts?.[cid] != null ? st.counts[cid] * (oldUnit ? 3 : 1) : activeChambers(cid);
  setHeader(isNew ? 'New medium change' : 'Medium change', { back: '#/exp/' + expId });
  main.innerHTML = `
  ${e.model !== COPD_MODEL ? '<div class="warn">This experiment is not set to the Lung-COPD model.</div>' : ''}
  ${!conds.length ? '<div class="warn">No conditions defined. Add conditions (with CSE / drugs) on the experiment page first.</div>' : ''}
  <form class="card" id="mform">
    <div class="grid2">
      <label>Date<input type="date" name="date" value="${esc(st.date)}" required></label>
      <label>Volume per chip (mL)<input name="vol" type="number" step="any" min="0" inputmode="decimal" value="${esc(st.volPerChip)}" required></label>
    </div>
    <div class="absbox">
      <div class="cc-head">CSE absorbance</div>
      <div class="grid2">
        <label>CSE reading 1<input name="cse1" type="number" step="any" inputmode="decimal" value="${esc(rd.cse[0])}" placeholder="e.g. 0.92"></label>
        <label>CSE reading 2 <span style="font-weight:400">(optional)</span><input name="cse2" type="number" step="any" inputmode="decimal" value="${esc(rd.cse[1])}"></label>
        <label>Blank reading 1<input name="blk1" type="number" step="any" inputmode="decimal" value="${esc(rd.blank[0])}" placeholder="e.g. 0.05"></label>
        <label>Blank reading 2 <span style="font-weight:400">(optional)</span><input name="blk2" type="number" step="any" inputmode="decimal" value="${esc(rd.blank[1])}"></label>
      </div>
      <div id="absPrev" class="calcnote"></div>
      <div id="csePrev" class="calcnote" style="margin-top:4px"></div>
    </div>
    ${conds.length ? `<div class="muted" style="font-size:13px;font-weight:600;margin:4px 0 6px">Chambers per condition <span style="font-weight:400">(default: non-failed chambers; volume per chamber = volume per chip ÷ 3)</span></div>
    <table class="calc"><tbody>${conds.map(c => `<tr><td><b>${esc(c.name)}</b><br><small class="muted">${esc(condDesc(e, c))}</small></td>
      <td style="width:110px"><input name="n_${c.id}" type="number" min="0" step="1" inputmode="numeric" value="${count(c.id)}"></td></tr>`).join('')}</tbody></table>` : ''}
    <label style="margin-top:10px">Notes<textarea name="notes" rows="2">${esc(st.notes)}</textarea></label>
  </form>
  <div class="sec-head"><h2>Dedicated medium per condition</h2></div>
  <div class="card scroll" id="mres"></div>
  <div class="sec-head"><h2>Base medium</h2></div>
  <div class="card scroll" id="mbase"></div>
  <button class="btn primary big" id="msave">Save medium change</button>
  ${isNew ? '' : `<div class="cap-row"><button class="btn danger" id="mdel">${I.trash} Delete</button></div>`}`;

  const form = $('#mform');
  form.addEventListener('submit', ev => ev.preventDefault());
  const calc = () => {
    const f = form.elements;
    const nums = names => names.map(n => f[n].value.trim()).filter(v => v !== '' && isFinite(+v)).map(Number);
    const cseR = nums(['cse1', 'cse2']), blkR = nums(['blk1', 'blk2']);
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const cseAvg = cseR.length ? avg(cseR) : NaN, blkAvg = blkR.length ? avg(blkR) : NaN;
    const A = cseR.length && blkR.length ? cseAvg - blkAvg : NaN, V = (parseFloat(f.vol.value) || 0) * 1000;
    const cseF = A > 0 ? CSE_REF / A : null;
    const cseBad = cseF != null && cseF >= 1;
    const rows = conds.map(c => {
      const n = Math.max(0, parseInt(f['n_' + c.id]?.value) || 0), T = n * V / 3;
      const cse = c.cse ? (cseF && !cseBad ? T * cseF : NaN) : 0;
      const drugs = (c.drugIds || []).map(id => e.drugs.find(d => d.id === id)).filter(Boolean)
        .map(d => { const fr = drugFraction(d); return { name: d.name, vol: fr ? T * fr : NaN }; });
      const medium = T - (cse || 0) - drugs.reduce((s, d) => s + (d.vol || 0), 0);
      return { condId: c.id, name: c.name, n, total: T, cse, drugs, medium };
    });
    return { date: f.date.value, A, cseR, blkR, cseAvg, blkAvg, V, cseF, cseBad, rows, notes: f.notes.value.trim(), needsCse: conds.some(c => c.cse) };
  };
  const render = () => {
    const r = calc();
    $('#absPrev').innerHTML = isFinite(r.A)
      ? `Absorbance = CSE avg ${fmtN(r.cseAvg)} − blank avg ${fmtN(r.blkAvg)} = <b>${fmtN(r.A)}</b>`
      : (r.cseR.length || r.blkR.length ? 'Enter at least one CSE and one blank reading' : '');
    $('#csePrev').innerHTML = isFinite(r.A) && r.A <= 0 ? '<span style="color:var(--danger)">CSE average must be higher than the blank</span>' : r.cseF ? (r.cseBad ? '<span style="color:var(--danger)">Absorbance must be above 0.07</span>'
      : `CSE fraction = 0.07 / ${fmtN(r.A)} = <b>${fmtN(r.cseF)}</b> (${fmtN(r.cseF * 100)}% · ${fmtUL(r.cseF * 1000)}/mL)`) : (r.needsCse ? 'Enter the absorbance to calculate CSE' : '');
    const tot = { total: 0, cse: 0, medium: 0, drugs: {} };
    r.rows.forEach(x => { tot.total += x.total; tot.cse += x.cse || 0; tot.medium += x.medium; x.drugs.forEach(d => { tot.drugs[d.name] = (tot.drugs[d.name] || 0) + (d.vol || 0); }); });
    const block = (title, sub, lines) => `<h3 class="subh">${title} <span class="muted" style="font-weight:400">${sub}</span></h3>
      <table class="calc"><tbody>${lines.map(([n, v, b]) => `<tr><td>${n}</td><td class="num">${b ? `<b>${fmtUL(v)}</b>` : fmtUL(v)}</td></tr>`).join('')}</tbody></table>`;
    $('#mres').innerHTML = r.rows.length ? r.rows.map(x => block(esc(x.name), `${x.n} chamber${x.n === 1 ? '' : 's'} · ${fmtUL(x.total)}`, [
        ...(x.cse !== 0 ? [['CSE', x.cse, true]] : []),
        ...x.drugs.map(d => [esc(d.name), d.vol, true]),
        ['Base medium', x.medium, true],
      ])).join('') + block('Total', fmtUL(tot.total), [
        ['CSE', tot.cse], ...Object.entries(tot.drugs).map(([n, v]) => [esc(n), v]), ['Base medium', tot.medium],
      ]) + `<p class="muted calcnote">Per chip: ${fmtN(r.V / 1000)} mL → per chamber: ${fmtUL(r.V / 3)}. CSE and drugs from their dilution, the rest is base medium.</p>` : '<div class="muted">No conditions.</div>';
    const prep = Math.max(1, Math.ceil(tot.medium / 1000));
    const k = prep * 1000 / BASE_MEDIUM_TOTAL;
    $('#mbase').innerHTML = `<p class="calcnote" style="margin-top:0">Needed: <b>${fmtUL(tot.medium)}</b> → prepare <b>${prep} mL</b></p>
      <table class="calc"><thead><tr><th>Component</th><th>per 10 mL</th><th>for ${prep} mL</th></tr></thead><tbody>
      ${BASE_MEDIUM.map(([n, v]) => `<tr><td>${n}</td><td class="num">${fmtUL(v)}</td><td class="num"><b>${fmtUL(v * k)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${fmtUL(BASE_MEDIUM_TOTAL)}</td><td class="num">${fmtUL(prep * 1000)}</td></tr></tfoot></table>`;
    return { ...r, tot, prep };
  };
  form.addEventListener('input', render); render();
  $('#msave').onclick = async () => {
    if (!form.reportValidity()) return;
    const r = render();
    if (r.needsCse && (!r.cseF || r.cseBad)) { toast('Enter CSE and blank readings (CSE − blank must be > 0.07)', 3500); form.elements.cse1.focus(); return; }
    const rec = {
      id: mc?.id || uid(), date: r.date, day: e.seedingDate ? dayOf(e.seedingDate, r.date) : null,
      absorbance: isFinite(r.A) ? r.A : null, cseReadings: r.cseR, blankReadings: r.blkR, cseFraction: r.cseF && !r.cseBad ? r.cseF : null, volPerChip: r.V / 1000, countUnit: 'chamber',
      counts: Object.fromEntries(r.rows.map(x => [x.condId, x.n])),
      rows: r.rows.map(x => ({ name: x.name, n: x.n, total: x.total, cse: x.cse, drugs: x.drugs, medium: x.medium })),
      baseMediumMl: r.prep, notes: r.notes, savedAt: now(),
    };
    const i = e.mediumChanges.findIndex(m => m.id === rec.id);
    if (i < 0) e.mediumChanges.push(rec); else e.mediumChanges[i] = rec;
    await saveExp(e); toast('Medium change saved'); goBack('#/exp/' + expId);
  };
  $('#mdel') && ($('#mdel').onclick = async () => {
    if (!await confirmDlg('Delete medium change?', 'This record will be permanently deleted.', 'Delete', 'danger')) return;
    e.mediumChanges = e.mediumChanges.filter(m => m.id !== mid); await saveExp(e); goBack('#/exp/' + expId);
  });
}

/* ---------------- staining ---------------- */
const VOL_UNIT_UL = { 'µL': 1, 'uL': 1, 'ul': 1, 'µl': 1, 'mL': 1e-3, 'ml': 1e-3, 'L': 1e-6 };
async function viewStaining(expId, sid) {
  const e = await get('experiments', expId);
  if (!e) return go('#/');
  const [chips, items] = await Promise.all([all('chips', 'expId', expId), all('items')]);
  await ensureExpShape(e, chips);
  const isNew = sid === 'new';
  const old = isNew ? null : e.stainings.find(s => s.id === sid);
  if (!isNew && !old) return go('#/exp/' + expId);
  const abItems = items.filter(i => /antibod/i.test(i.category || '')).sort((a, b) => a.name.localeCompare(b.name));
  const nonFailed = chips.flatMap(c => c.chambers).filter(ch => ch.status !== 'failed').length;
  const emptySlot = () => ({ itemId: '', name: '', dilution: '' });
  const s = old ? JSON.parse(JSON.stringify(old)) : {
    id: uid(), title: '', date: todayISO(), nChambers: nonFailed, volPerChamber: 100, extraPct: 0,
    primary: [emptySlot(), emptySlot(), emptySlot()], secondary: [emptySlot(), emptySlot(), emptySlot()],
    deducted: false, imaging: {}, notes: '',
  };
  const slot = (pre, i, sl) => {
    const missing = sl.itemId && sl.itemId !== '__other' && !abItems.some(it => it.id === sl.itemId);
    return `<div class="abslot">
      <label>Antibody #${i + 1}<select name="${pre}${i}_item">
        <option value="">${i ? '— not present —' : '— select —'}</option>
        ${missing ? `<option value="${esc(sl.itemId)}" selected>${esc(sl.name)} (not in storage)</option>` : ''}
        ${abItems.map(it => `<option value="${it.id}" ${sl.itemId === it.id ? 'selected' : ''}>${esc(it.name)}${it.lot ? ' · lot ' + esc(it.lot) : ''}</option>`).join('')}
        <option value="__other" ${sl.itemId === '__other' ? 'selected' : ''}>Other (type name)…</option></select></label>
      <label>Dilution<input name="${pre}${i}_dil" value="${sl.dilution ? '1:' + sl.dilution : ''}" placeholder="1:200"></label>
      <label class="span2 abname" ${sl.itemId === '__other' ? '' : 'hidden'}>Antibody name<input name="${pre}${i}_name" value="${esc(sl.itemId === '__other' ? sl.name : '')}"></label>
    </div>`;
  };
  setHeader(isNew ? 'New staining' : (s.title || 'Staining'), { back: '#/exp/' + expId });
  main.innerHTML = `
  <form id="sform">
  <section class="card">
    <div class="grid2">
      <label class="span2">Name / markers (optional)<input name="title" value="${esc(s.title)}" placeholder="e.g. ZO-1 / Muc5AC / DAPI"></label>
      <label>Date<input type="date" name="date" value="${esc(s.date)}" required></label>
      <label>Chambers to stain<input name="n" type="number" min="1" step="1" inputmode="numeric" value="${esc(s.nChambers)}" required></label>
      <label>Volume per chamber (µL)<input name="vol" type="number" min="0" step="any" inputmode="decimal" value="${esc(s.volPerChamber)}" required></label>
      <label>Extra volume (%)<input name="extra" type="number" min="0" step="any" inputmode="decimal" value="${esc(s.extraPct)}"></label>
    </div>
    <p class="muted calcnote" style="margin:0">Non-failed chambers in this experiment: ${nonFailed}</p>
  </section>
  ${abItems.length ? '' : '<div class="warn">No antibodies in Storage yet. Add them in Storage with category <b>Antibodies</b> to pick them here (or use "Other").</div>'}
  <div class="sec-head"><h2>Primary antibodies</h2></div>
  <section class="card">${[0, 1, 2].map(i => slot('p', i, s.primary[i] || emptySlot())).join('')}</section>
  <div class="sec-head"><h2>Secondary antibodies</h2></div>
  <section class="card">${[0, 1, 2].map(i => slot('s', i, s.secondary[i] || emptySlot())).join('')}
    ${s.deducted ? '<p class="muted calcnote">✓ Antibody volumes already deducted from Storage.</p>'
      : '<label class="check"><input type="checkbox" name="deduct"> Deduct antibody volumes from Storage when saving</label>'}
  </section>
  <div class="sec-head"><h2>Solutions to prepare</h2></div>
  <div class="card scroll" id="sres"></div>
  <div class="sec-head"><h2>Imaging <span class="muted" style="font-weight:400;font-size:13px">(fill later)</span></h2></div>
  <section class="card scroll">
    <table class="calc imgtab"><thead><tr><th>λ (nm)</th><th>Marker</th><th>Laser (%)</th><th>Exposure (ms)</th></tr></thead><tbody>
    ${WAVELENGTHS.map(w => { const v = s.imaging?.[w] || {}; return `<tr><td><b>${w}</b></td>
      <td><input name="img_${w}_marker" value="${esc(v.marker)}"></td>
      <td><input name="img_${w}_laser" type="number" step="any" min="0" inputmode="decimal" value="${esc(v.laser)}"></td>
      <td><input name="img_${w}_exposure" type="number" step="any" min="0" inputmode="decimal" value="${esc(v.exposure)}"></td></tr>`; }).join('')}
    </tbody></table>
    <label style="margin-top:10px">Notes<textarea name="notes" rows="2">${esc(s.notes)}</textarea></label>
  </section>
  </form>
  <button class="btn primary big" id="ssave">Save staining</button>
  ${isNew ? '' : `<div class="cap-row"><button class="btn danger" id="sdel">${I.trash} Delete</button></div>`}`;

  const form = $('#sform'), f = form.elements;
  form.addEventListener('submit', ev => ev.preventDefault());
  const readSlots = pre => [0, 1, 2].map(i => {
    const itemId = f[`${pre}${i}_item`].value;
    const it = abItems.find(x => x.id === itemId);
    const name = itemId === '__other' ? f[`${pre}${i}_name`].value.trim() : it ? it.name : (itemId ? (s[pre === 'p' ? 'primary' : 'secondary'][i]?.name || '') : '');
    return { itemId, name, dilution: parseRatio(f[`${pre}${i}_dil`].value) || '' };
  });
  const calc = () => {
    const n = parseInt(f.n.value) || 0, vol = parseFloat(f.vol.value) || 0, extra = parseFloat(f.extra.value) || 0;
    const V = n * vol * (1 + extra / 100);
    const mk = slots => slots.filter(x => x.itemId).map(x => ({ ...x, vol: x.dilution ? V / x.dilution : NaN }));
    const P = mk(readSlots('p')), S = mk(readSlots('s'));
    return { n, vol, extra, V, P, S };
  };
  const table = (rows, V) => `<table class="calc"><tbody>${rows.map(([n, v]) => `<tr><td>${n}</td><td class="num"><b>${fmtUL(v)}</b></td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${fmtUL(V)}</td></tr></tfoot></table>`;
  const abRows = (abs, V) => {
    const gs = V * 0.005, sum = abs.reduce((t, a) => t + (a.vol || 0), 0);
    return [['Goat Serum (0.5%)', gs], ...abs.map((a, i) => [`#${i + 1} ${esc(a.name || '?')} (${a.dilution ? '1:' + a.dilution : '<span style="color:var(--danger)">no dilution</span>'})`, a.vol]), ['PBS (remaining)', V - gs - sum]];
  };
  const render = () => {
    const r = calc();
    $$('.abslot').forEach(el => { const sel = $('select', el); $('.abname', el).hidden = sel.value !== '__other'; });
    $('#sres').innerHTML = `<p class="calcnote" style="margin-top:0">Volume per solution: ${r.n} chambers × ${fmtN(r.vol)} µL${r.extra ? ` + ${fmtN(r.extra)}%` : ''} = <b>${fmtUL(r.V)}</b></p>
      <h3 class="subh">Permeabilization & blocking</h3>${table([['Goat Serum (5%)', r.V * 0.05], ['Tween-20 (0.1%)', r.V * 0.001], ['PBS (remaining)', r.V * (1 - 0.05 - 0.001)]], r.V)}
      <h3 class="subh">Primary antibody solution</h3>${r.P.length ? table(abRows(r.P, r.V), r.V) : '<p class="muted">Select antibody #1.</p>'}
      <h3 class="subh">Secondary antibody solution</h3>${r.S.length ? table(abRows(r.S, r.V), r.V) : '<p class="muted">Select antibody #1.</p>'}`;
    return r;
  };
  form.addEventListener('input', render); form.addEventListener('change', ev => {
    render();
    const m = ev.target.name?.match(/^([ps])(\d)_item$/);
    if (m) { const it = abItems.find(x => x.id === ev.target.value); const dil = f[`${m[1]}${m[2]}_dil`]; if (it?.abDilution && !dil.value) { dil.value = '1:' + it.abDilution; render(); } }
  });
  render();
  $('#ssave').onclick = async () => {
    if (!form.reportValidity()) return;
    const r = render();
    const P = readSlots('p'), S = readSlots('s');
    for (const [lbl, arr] of [['primary', P], ['secondary', S]]) {
      if (!arr[0].itemId) { toast(`Select ${lbl} antibody #1`, 3000); return; }
      for (const [i, a] of arr.entries()) if (a.itemId && (!a.dilution || (a.itemId === '__other' && !a.name))) { toast(`Check name and dilution of ${lbl} antibody #${i + 1}`, 3000); return; }
    }
    const withVol = arr => arr.map(a => a.itemId ? { ...a, vol: r.V / a.dilution } : a);
    Object.assign(s, {
      title: f.title.value.trim(), date: f.date.value, day: e.seedingDate ? dayOf(e.seedingDate, f.date.value) : null,
      nChambers: r.n, volPerChamber: r.vol, extraPct: r.extra, totalVolume: r.V, primary: withVol(P), secondary: withVol(S),
      imaging: Object.fromEntries(WAVELENGTHS.map(w => [w, { marker: f[`img_${w}_marker`].value.trim(), laser: f[`img_${w}_laser`].value, exposure: f[`img_${w}_exposure`].value }])),
      notes: f.notes.value.trim(), savedAt: now(),
    });
    // remember dilutions + optional stock deduction
    const skipped = [];
    const used = [...s.primary, ...s.secondary].filter(a => abItems.some(it => it.id === a.itemId));
    for (const a of used) { const it = await get('items', a.itemId); if (it && it.abDilution !== a.dilution) { it.abDilution = a.dilution; await put('items', it); } }
    if (f.deduct?.checked && !s.deducted) {
      for (const a of used) {
        const it = await get('items', a.itemId), k = VOL_UNIT_UL[it.unit];
        if (k == null) { skipped.push(`${it.name} (unit ${it.unit})`); continue; }
        await applyMovement(it.id, -round(a.vol * k), { type: 'remove', expId, note: `Staining ${s.title || fmtDate(s.date)}` });
      }
      s.deducted = true;
    }
    const i = e.stainings.findIndex(x => x.id === s.id);
    if (i < 0) e.stainings.push(s); else e.stainings[i] = s;
    await saveExp(e);
    toast(skipped.length ? `Saved. Not deducted (unit not µL/mL): ${skipped.join(', ')}` : 'Staining saved', skipped.length ? 5000 : 2200);
    goBack('#/exp/' + expId);
  };
  $('#sdel') && ($('#sdel').onclick = async () => {
    if (!await confirmDlg('Delete staining?', 'This record will be permanently deleted. Storage deductions are not reverted.', 'Delete', 'danger')) return;
    e.stainings = e.stainings.filter(x => x.id !== sid); await saveExp(e); goBack('#/exp/' + expId);
  });
}
async function deleteExperiment(id) {
  await tx(['experiments', 'chips', 'photos'], 'readwrite', async t => {
    t.objectStore('experiments').delete(id);
    for (const st of ['chips', 'photos']) {
      const s = t.objectStore(st);
      (await reqP(s.index('expId').getAllKeys(id))).forEach(k => s.delete(k));
    }
  });
}

/* =========================================================
   CHAMBER PAGE
   ========================================================= */
let chamberTarget = { key: '', day: 0 };
async function viewChamber(expId, chipId, n) {
  const [e, chip, chips] = await Promise.all([get('experiments', expId), get('chips', chipId), all('chips', 'expId', expId)]);
  if (!e || !chip || !(n >= 1 && n <= 3)) return go('#/exp/' + expId);
  chips.sort((a, b) => a.idx - b.idx);
  const photos = (await all('photos', 'chipId', chipId)).filter(p => p.chamber === n).sort((a, b) => b.day - a.day || b.createdAt - a.createdAt);
  const ch = chip.chambers[n - 1];
  const name = chip.letter + n;
  await ensureExpShape(e, chips);
  const todayDay = e.seedingDate ? dayOf(e.seedingDate, todayISO()) : 0;
  const key = chipId + '_' + n;
  if (chamberTarget.key !== key) chamberTarget = { key, day: todayDay };
  const tDay = chamberTarget.day;
  const tDate = e.seedingDate ? dateForDay(e.seedingDate, tDay) : todayISO();
  const existing = photos.find(p => p.day === tDay);

  // prev / next chamber across all chips
  const order = chips.flatMap(c => [1, 2, 3].map(k => ({ c, k })));
  const pos = order.findIndex(o => o.c.id === chipId && o.k === n);
  const prev = order[pos - 1], next = order[pos + 1];
  const link = o => `#/exp/${expId}/chip/${o.c.id}/ch/${o.k}`;

  setHeader(`Chamber ${name} · ${expNum(e)}`, { back: '#/exp/' + expId });
  main.innerHTML = `
  <div class="chnav">
    ${prev ? `<a class="btn" href="${link(prev)}">${I.back}${prev.c.letter}${prev.k}</a>` : '<span class="ph"></span>'}
    <div class="mid"><b>${name}</b><small>${esc(chCondName(e, chip, n - 1) || 'No condition')}</small></div>
    ${next ? `<a class="btn" href="${link(next)}">${next.c.letter}${next.k}${I.fwd}</a>` : '<span class="ph"></span>'}
  </div>

  <section class="card">
    <div class="seg status" id="stSeg">${Object.entries(CH_STATUS).map(([k, l]) => `<button data-s="${k}" class="${ch.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${ch.status === 'failed' ? `<div class="failinfo">Failed${ch.failDay != null && ch.failDay !== '' ? ' on Day ' + esc(ch.failDay) : ''} · ${esc(ch.failReason || '—')}${ch.failNote ? ' · ' + esc(ch.failNote) : ''}
       <button class="icon sm" id="editFail" style="color:inherit;vertical-align:middle" title="Edit">${I.edit}</button></div>` : ''}
    <label>Condition<select id="chCond"><option value="">Same as chip${condName(e, chip) ? ' (' + esc(condName(e, chip)) + ')' : ''}</option>${e.conditions.map(x => `<option value="${x.id}" ${ch.conditionId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__new">+ New condition…</option></select></label>
    <label>Chamber notes<textarea id="chNotes" rows="3" placeholder="Observations, morphology, beating, …">${esc(ch.notes)}</textarea></label>
  </section>

  <section class="card">
    ${e.seedingDate ? '' : '<div class="warn">Set the seeding date on the experiment page to get automatic day numbers.</div>'}
    <div class="daystep">
      <button id="dMinus" aria-label="Previous day">${I.minus}</button>
      <div class="mid"><b>Day ${tDay}</b><small>${fmtDate(tDate)}${tDay === todayDay ? ' · today' : ''}</small></div>
      <button id="dPlus" aria-label="Next day">${I.plus}</button>
    </div>
    ${existing ? '<div class="warn">A photo for this day already exists – a new one will replace it.</div>' : ''}
    <button class="btn primary big" id="snap">${I.camera} Take photo – Day ${tDay}</button>
    <div class="cap-row"><button class="btn" id="fromFile">${I.image} From file / gallery</button></div>
  </section>

  <div class="sec-head"><h2>Timeline (${photos.length})</h2></div>
  ${photos.length ? `<div class="timeline">${photos.map((p, i) => `<button class="tl" data-i="${i}"><img src="${url(photoBlob(p))}" alt="" loading="lazy">
      <div><b>Day ${p.day}</b><small>${fmtDate(p.date)}</small></div></button>`).join('')}</div>`
    : '<div class="card empty">No photos yet.</div>'}`;

  $$('#stSeg button').forEach(b => b.onclick = () => setChamberStatus(chip, n, b.dataset.s, todayDay));
  $('#editFail') && ($('#editFail').onclick = () => setChamberStatus(chip, n, 'failed', todayDay, true));
  bindCondSelect($('#chCond'), e, null, async v => {
    chip.chambers[n - 1].conditionId = v && v !== chip.conditionId ? v : null; chip.updatedAt = now();
    await put('chips', chip); toast(`${name}: ${chCondName(e, chip, n - 1) || 'no condition'}`); rerender();
  });
  $('#chNotes').addEventListener('change', async ev => {
    chip.chambers[n - 1].notes = ev.target.value.trim(); chip.updatedAt = now();
    await put('chips', chip); toast('Notes saved');
  });
  $('#dMinus').onclick = () => { chamberTarget.day--; rerender(); };
  $('#dPlus').onclick = () => { chamberTarget.day++; rerender(); };
  const take = async src => {
    try {
      const raw = src === 'camera' ? await acquireCamera() : await pickFile({ accept: 'image/*' });
      if (!raw) return;
      if (existing && !await confirmDlg('Replace photo?', `${name} already has a photo for Day ${tDay}. Replace it?`, 'Replace')) return;
      const blob = await resizeImage(raw);
      await tx(['photos'], 'readwrite', t => {
        const s = t.objectStore('photos');
        if (existing) s.delete(existing.id);
        s.put({ id: uid(), expId, chipId, chamber: n, day: tDay, date: todayISO(), blob, createdAt: now() });
      });
      toast(`Photo saved – ${name}, Day ${tDay} (${fmtSize(blob.size)})`);
      rerender();
    } catch (err) { console.error(err); toast('Could not save photo: ' + err.message, 4000); }
  };
  $('#snap').onclick = () => take('camera');
  $('#fromFile').onclick = () => take('file');
  $$('.tl').forEach(b => b.onclick = () => openViewer(photos.map(p => ({ ...p, label: name })), +b.dataset.i, rerender));
}
async function setChamberStatus(chip, n, status, todayDay, forceDialog) {
  const ch = chip.chambers[n - 1];
  if (status === 'failed') {
    const r = await dialog({
      title: `Mark ${chip.letter}${n} as failed`,
      body: `<label>Reason<select name="reason">${FAIL_REASONS.map(x => `<option ${x === ch.failReason ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label>Failed on day<input type="number" name="day" inputmode="numeric" value="${ch.failDay ?? todayDay ?? ''}"></label>
        <label>Details (optional)<input name="note" value="${esc(ch.failNote)}"></label>`,
      actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Mark failed', value: 'ok', cls: 'danger' }],
    });
    if (!r.ok) return;
    Object.assign(ch, { status, failReason: r.data.reason, failDay: r.data.day === '' ? null : +r.data.day, failNote: r.data.note.trim() });
  } else {
    if (ch.status === status && !forceDialog) return;
    Object.assign(ch, { status, failReason: '', failDay: null, failNote: '' });
  }
  chip.updatedAt = now();
  await put('chips', chip);
  toast(`${chip.letter}${n}: ${CH_STATUS[status]}`);
  rerender();
}

/* ---------------- day gallery ---------------- */
async function viewDay(expId, d) {
  const [e, chips, photosAll] = await Promise.all([get('experiments', expId), all('chips', 'expId', expId), all('photos', 'expId', expId)]);
  if (!e) return go('#/');
  chips.sort((a, b) => a.idx - b.idx);
  const days = [...new Set(photosAll.map(p => p.day))].sort((a, b) => a - b);
  const i = days.indexOf(d), prev = days[i - 1], next = days[i + 1];
  const photos = photosAll.filter(p => p.day === d);
  const map = Object.fromEntries(photos.map(p => [p.chipId + '_' + p.chamber, p]));
  const list = [];
  setHeader(`${expNum(e)} · Day ${d}`, { back: '#/exp/' + expId });
  main.innerHTML = `
  <div class="chnav">
    ${prev != null ? `<a class="btn" href="#/exp/${expId}/day/${prev}">${I.back}Day ${prev}</a>` : '<span class="ph"></span>'}
    <div class="mid"><b>Day ${d}</b><small>${e.seedingDate ? fmtDate(dateForDay(e.seedingDate, d)) : ''} · ${photos.length} photos</small></div>
    ${next != null ? `<a class="btn" href="#/exp/${expId}/day/${next}">Day ${next}${I.fwd}</a>` : '<span class="ph"></span>'}
  </div>
  <div class="card daygrid">${chips.map(c => `<div class="chiprow"><span class="chip-letter">${c.letter}</span>${[1, 2, 3].map(n => {
    const p = map[c.id + '_' + n], st = c.chambers[n - 1].status;
    if (!p) return `<a class="cell st-${st}" href="#/exp/${expId}/chip/${c.id}/ch/${n}">${c.letter}${n}<br>no photo</a>`;
    list.push({ ...p, label: c.letter + n });
    return `<button class="cell st-${st}" data-i="${list.length - 1}"><img src="${url(photoBlob(p))}" alt=""><span class="ch-label">${c.letter}${n}</span>${e.conditions?.length ? `<span class="ch-cond">${esc(chCondName(e, c, n - 1))}</span>` : ''}</button>`;
  }).join('')}</div>`).join('')}</div>`;
  $$('.cell[data-i]').forEach(b => b.onclick = () => openViewer(list, +b.dataset.i, rerender));
}

/* ---------------- full-screen photo viewer ---------------- */
const photoBlob = p => p.cropBlob || p.blob;
function openViewer(list, start, onChanged) {
  let i = start, changed = false, closed = false;
  const urls = list.map(p => URL.createObjectURL(photoBlob(p)));
  const ov = document.createElement('div');
  ov.className = 'viewer';
  ov.innerHTML = `<div class="v-top"><div class="v-cap"></div>
      <button class="icon" data-a="crop" title="Crop">${I.crop}</button>
      <button class="icon" data-a="day" title="Change day">${I.edit}</button>
      <button class="icon" data-a="del" title="Delete photo">${I.trash}</button>
      <button class="icon" data-a="close" title="Close">${I.close}</button></div>
    <div class="v-img"><img alt="" draggable="false"></div>
    <div class="v-zoombar" hidden><span class="v-zl"></span><button class="btn" data-a="cropview">${I.crop} Crop to this view</button><button class="btn" data-a="reset">Reset zoom</button></div>
    <button class="v-nav prev" aria-label="Previous">${I.back}</button><button class="v-nav next" aria-label="Next">${I.fwd}</button>`;
  document.body.appendChild(ov);
  const box = $('.v-img', ov), img = $('img', box);
  // ---- zoom / pan state (transform-origin 0 0, img fills the box with object-fit: contain)
  let s = 1, tx = 0, ty = 0;
  const apply = () => {
    const W = box.clientWidth, H = box.clientHeight;
    s = Math.min(8, Math.max(1, s));
    tx = Math.min(0, Math.max(W - W * s, tx)); ty = Math.min(0, Math.max(H - H * s, ty));
    img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    $('.v-zoombar', ov).hidden = s <= 1.01;
    $('.v-zl', ov).textContent = `${s.toFixed(1)}×`;
    $$('.v-nav', ov).forEach(b => b.classList.toggle('dim', s > 1.01));
  };
  const zoomAt = (mx, my, ns) => { const k = Math.min(8, Math.max(1, ns)) / s; tx = mx - (mx - tx) * k; ty = my - (my - ty) * k; s *= k; apply(); };
  const resetZoom = () => { s = 1; tx = 0; ty = 0; apply(); };
  const rel = ev => { const r = box.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const pts = new Map(); let g = null, lastTap = 0;
  box.addEventListener('pointerdown', ev => {
    box.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, rel(ev));
    const a = [...pts.values()];
    if (a.length === 2) { const d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); g = { pinch: true, d0: d, s0: s, tx0: tx, ty0: ty, m: [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2] }; }
    else if (a.length === 1) g = { pinch: false, p0: a[0], tx0: tx, ty0: ty, t: Date.now() };
  });
  box.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId) || !g) return;
    pts.set(ev.pointerId, rel(ev));
    const a = [...pts.values()];
    if (g.pinch && a.length >= 2) {
      const d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), ns = Math.min(8, Math.max(1, g.s0 * d / g.d0)), k = ns / g.s0;
      s = ns; tx = g.m[0] - (g.m[0] - g.tx0) * k; ty = g.m[1] - (g.m[1] - g.ty0) * k; apply();
    } else if (!g.pinch && s > 1.01) { tx = g.tx0 + a[0][0] - g.p0[0]; ty = g.ty0 + a[0][1] - g.p0[1]; apply(); }
  });
  const up = ev => {
    if (!pts.has(ev.pointerId)) return;
    const p = rel(ev); pts.delete(ev.pointerId);
    if (g && !g.pinch && pts.size === 0) {
      const dx = p[0] - g.p0[0], dy = p[1] - g.p0[1];
      if (s <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && i > 0) { i--; show(); } else if (dx < 0 && i < list.length - 1) { i++; show(); } }
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        const t = Date.now(); if (t - lastTap < 300) { s > 1.01 ? resetZoom() : zoomAt(p[0], p[1], 2.5); lastTap = 0; } else lastTap = t;
      }
    }
    if (pts.size < 2 && g?.pinch) g = pts.size === 1 ? { pinch: false, p0: [...pts.values()][0], tx0: tx, ty0: ty } : null;
    if (!pts.size) g = null;
  };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', ev => { ev.preventDefault(); const [mx, my] = rel(ev); zoomAt(mx, my, s * (ev.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });

  const show = () => {
    const p = list[i];
    img.src = urls[i]; resetZoom();
    $('.v-cap', ov).innerHTML = `<b>${esc(p.label)} · Day ${p.day}</b> · ${fmtDate(p.date)}${p.cropBlob ? ' · <span class="v-tag">cropped</span>' : ''}<small>${i + 1}/${list.length}</small>`;
    $('.prev', ov).hidden = i === 0; $('.next', ov).hidden = i === list.length - 1;
  };
  const doClose = () => {
    if (closed) return; closed = true;
    ov.remove(); urls.forEach(u => URL.revokeObjectURL(u)); $('.cropper')?.remove();
    removeEventListener('keydown', onKey); removeEventListener('popstate', onPop); removeEventListener('resize', apply);
    if (changed) onChanged && onChanged();
  };
  const close = () => history.back();           // pops our pushed state -> onPop
  const onPop = () => doClose();
  const onKey = ev => {
    if ($('dialog[open]') || $('.cropper')) return;
    if (ev.key === 'Escape') close();
    if (ev.key === 'ArrowLeft' && i > 0) { i--; show(); } if (ev.key === 'ArrowRight' && i < list.length - 1) { i++; show(); }
    if (ev.key === '+' || ev.key === '=') zoomAt(box.clientWidth / 2, box.clientHeight / 2, s * 1.3);
    if (ev.key === '-') zoomAt(box.clientWidth / 2, box.clientHeight / 2, s / 1.3);
  };
  history.pushState({ viewer: 1 }, '', location.href);
  addEventListener('popstate', onPop); addEventListener('keydown', onKey);
  $('.prev', ov).onclick = () => { if (i > 0) { i--; show(); } };
  $('.next', ov).onclick = () => { if (i < list.length - 1) { i++; show(); } };
  $('[data-a=close]', ov).onclick = close;
  $('[data-a=reset]', ov).onclick = resetZoom;
  // visible part of the displayed image -> normalized rect of the displayed (possibly cropped) image
  const visibleRect = () => {
    const W = box.clientWidth, H = box.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    const k = Math.min(W / nw, H / nh), iw = nw * k, ih = nh * k, ix = (W - iw) / 2, iy = (H - ih) / 2;
    const x0 = Math.max(ix, -tx / s), y0 = Math.max(iy, -ty / s), x1 = Math.min(ix + iw, (W - tx) / s), y1 = Math.min(iy + ih, (H - ty) / s);
    return { x: (x0 - ix) / iw, y: (y0 - iy) / ih, w: (x1 - x0) / iw, h: (y1 - y0) / ih };
  };
  const doCrop = async initView => {
    const p = list[i];
    // the crop is always stored relative to the ORIGINAL photo
    const base = p.crop || { x: 0, y: 0, w: 1, h: 1 };
    let init = p.crop || { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
    if (initView) { const v = visibleRect(); init = { x: base.x + v.x * base.w, y: base.y + v.y * base.h, w: v.w * base.w, h: v.h * base.h }; }
    const res = await cropEditor(p.blob, init, !!p.crop);
    if (!res) return;
    const rec = await get('photos', p.id);
    if (!rec) return;
    if (res === 'remove') { delete rec.crop; delete rec.cropBlob; }
    else { rec.crop = res.rect; rec.cropBlob = res.blob; }
    await put('photos', rec);
    Object.assign(p, { crop: rec.crop, cropBlob: rec.cropBlob }); if (res === 'remove') { delete p.crop; delete p.cropBlob; }
    URL.revokeObjectURL(urls[i]); urls[i] = URL.createObjectURL(photoBlob(p));
    changed = true; show(); toast(res === 'remove' ? 'Crop removed – original photo restored' : 'Photo cropped (the original is kept)', 2600);
  };
  $('[data-a=crop]', ov).onclick = () => doCrop(false);
  $('[data-a=cropview]', ov).onclick = () => doCrop(true);
  $('[data-a=del]', ov).onclick = async () => {
    const p = list[i];
    if (!await confirmDlg('Delete photo?', `${esc(p.label)} · Day ${p.day} will be permanently deleted.`, 'Delete', 'danger')) return;
    await del('photos', p.id); changed = true;
    URL.revokeObjectURL(urls[i]); list.splice(i, 1); urls.splice(i, 1);
    if (!list.length) return close();
    i = Math.min(i, list.length - 1); show();
  };
  $('[data-a=day]', ov).onclick = async () => {
    const p = list[i];
    const r = await dialog({ title: 'Change day', body: `<label>Day number for this photo<input type="number" name="day" inputmode="numeric" required value="${p.day}"></label>` });
    if (!r.ok || r.data.day === '' || +r.data.day === p.day) return;
    const nd = +r.data.day;
    const clash = (await all('photos', 'chipId', p.chipId)).find(x => x.chamber === p.chamber && x.day === nd && x.id !== p.id);
    if (clash && !await confirmDlg('Replace?', `There is already a photo for Day ${nd}. It will be replaced by this one.`, 'Replace', 'danger')) return;
    await tx(['photos'], 'readwrite', t => {
      const st = t.objectStore('photos'); if (clash) st.delete(clash.id);
      const { label, ...rec } = p; rec.day = nd; st.put(rec);
    });
    p.day = nd; changed = true; show(); toast('Day changed');
  };
  addEventListener('resize', apply);
  show();
}

/* crop editor: returns { rect, blob } | 'remove' | null */
function cropEditor(blob, init, hasCrop) {
  return new Promise(resolve => {
    const src = URL.createObjectURL(blob);
    const ov = document.createElement('div');
    ov.className = 'cropper';
    ov.innerHTML = `<div class="cr-top"><button class="btn" data-a="cancel">Cancel</button><b class="cr-title">Crop photo</b>
        <button class="btn primary" data-a="save">Save</button></div>
      <div class="cr-stage"><img alt="" draggable="false"><div class="cr-rect"><span data-h="nw"></span><span data-h="ne"></span><span data-h="sw"></span><span data-h="se"></span><i class="cr-grid"></i></div></div>
      <div class="cr-bar"><button class="btn" data-a="square">Square</button><button class="btn" data-a="full">Whole photo</button>
        ${hasCrop ? '<button class="btn danger" data-a="remove">Remove crop</button>' : ''}<span class="cr-size muted"></span></div>`;
    document.body.appendChild(ov);
    const stage = $('.cr-stage', ov), img = $('img', ov), rectEl = $('.cr-rect', ov);
    let r = { ...init }, lay = null, nw = 1, nh = 1;
    const clampR = () => {
      const m = 0.03;
      r.w = Math.min(1, Math.max(m, r.w)); r.h = Math.min(1, Math.max(m, r.h));
      r.x = Math.min(1 - r.w, Math.max(0, r.x)); r.y = Math.min(1 - r.h, Math.max(0, r.y));
    };
    const layout = () => {
      const W = stage.clientWidth, H = stage.clientHeight, k = Math.min(W / nw, H / nh);
      lay = { iw: nw * k, ih: nh * k, ix: (W - nw * k) / 2, iy: (H - nh * k) / 2 };
      Object.assign(img.style, { left: lay.ix + 'px', top: lay.iy + 'px', width: lay.iw + 'px', height: lay.ih + 'px' });
      draw();
    };
    const draw = () => {
      if (!lay) return;
      clampR();
      Object.assign(rectEl.style, { left: lay.ix + r.x * lay.iw + 'px', top: lay.iy + r.y * lay.ih + 'px', width: r.w * lay.iw + 'px', height: r.h * lay.ih + 'px' });
      $('.cr-size', ov).textContent = `${Math.round(r.w * nw)} × ${Math.round(r.h * nh)} px`;
    };
    img.onload = () => { nw = img.naturalWidth; nh = img.naturalHeight; layout(); };
    img.src = src;
    let drag = null;
    rectEl.addEventListener('pointerdown', ev => {
      ev.preventDefault(); rectEl.setPointerCapture(ev.pointerId);
      drag = { h: ev.target.dataset.h || 'move', x0: ev.clientX, y0: ev.clientY, r0: { ...r } };
    });
    rectEl.addEventListener('pointermove', ev => {
      if (!drag) return;
      const dx = (ev.clientX - drag.x0) / lay.iw, dy = (ev.clientY - drag.y0) / lay.ih, o = drag.r0;
      if (drag.h === 'move') { r.x = o.x + dx; r.y = o.y + dy; }
      else {
        let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
        if (drag.h.includes('w')) x0 = Math.min(x1 - 0.03, Math.max(0, o.x + dx));
        if (drag.h.includes('e')) x1 = Math.max(x0 + 0.03, Math.min(1, x1 + dx));
        if (drag.h.includes('n')) y0 = Math.min(y1 - 0.03, Math.max(0, o.y + dy));
        if (drag.h.includes('s')) y1 = Math.max(y0 + 0.03, Math.min(1, y1 + dy));
        r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      draw();
    });
    const end = () => { drag = null; };
    rectEl.addEventListener('pointerup', end); rectEl.addEventListener('pointercancel', end);
    const finish = v => { removeEventListener('resize', layout); ov.remove(); URL.revokeObjectURL(src); resolve(v); };
    $('[data-a=cancel]', ov).onclick = () => finish(null);
    $('[data-a=full]', ov).onclick = () => { r = { x: 0, y: 0, w: 1, h: 1 }; draw(); };
    $('[data-a=square]', ov).onclick = () => {
      const side = Math.min(r.w * nw, r.h * nh), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      r = { w: side / nw, h: side / nh, x: cx - side / nw / 2, y: cy - side / nh / 2 }; draw();
    };
    $('[data-a=remove]', ov) && ($('[data-a=remove]', ov).onclick = () => finish('remove'));
    $('[data-a=save]', ov).onclick = async () => {
      clampR();
      if (r.w > 0.995 && r.h > 0.995) return finish(hasCrop ? 'remove' : null);
      const c = document.createElement('canvas');
      const sx = Math.round(r.x * nw), sy = Math.round(r.y * nh), sw = Math.max(1, Math.round(r.w * nw)), sh = Math.max(1, Math.round(r.h * nh));
      c.width = sw; c.height = sh;
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      c.toBlob(b => finish(b ? { rect: { ...r }, blob: b } : null), 'image/jpeg', 0.9);
    };
    addEventListener('resize', layout);
  });
}

/* ---------------- image capture & resize ---------------- */
function pickFile({ accept = '', capture = false } = {}) {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept; if (capture) inp.setAttribute('capture', 'environment');
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', () => { res(inp.files[0] || null); inp.remove(); });
    inp.addEventListener('cancel', () => { res(null); inp.remove(); });
    inp.click();
  });
}
async function acquireCamera() {
  if (isMobile) return pickFile({ accept: 'image/*', capture: true });   // native camera app on Android
  if (!navigator.mediaDevices?.getUserMedia) return pickFile({ accept: 'image/*' });
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) {
    toast('No camera available – choose a file instead', 3000);
    return pickFile({ accept: 'image/*' });
  }
  let canvas = null;
  const r = await dialog({
    title: 'Camera', wide: true,
    body: '<video class="camvid" autoplay playsinline muted></video>',
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Capture', value: 'ok', cls: 'primary' }],
    onMount: d => {
      $('video', d).srcObject = stream;
      $('form', d).addEventListener('submit', ev => {
        if (ev.submitter?.value !== 'ok') return;
        const v = $('video', d); if (!v.videoWidth) return;
        canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        canvas.getContext('2d').drawImage(v, 0, 0);
      });
    },
  });
  stream.getTracks().forEach(t => t.stop());
  if (!r.ok || !canvas) return null;
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
}
async function resizeImage(blob, max = PHOTO_MAX, q = PHOTO_QUALITY) {
  let src, w, h;
  try { src = await createImageBitmap(blob, { imageOrientation: 'from-image' }); w = src.width; h = src.height; }
  catch {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Unsupported image')); im.src = URL.createObjectURL(blob); });
    w = src.naturalWidth; h = src.naturalHeight;
  }
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  src.close && src.close();
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Encoding failed')), 'image/jpeg', q));
}

/* =========================================================
   STORAGE
   ========================================================= */
let stQuery = '', stCat = '', stFilter = 'all', lastRemovalExp = '';
function isLow(i) { return i.minQty !== '' && i.minQty != null && Number(i.quantity) <= Number(i.minQty); }
function expiryState(i) {
  if (!i.expiry) return null;
  const d = dayOf(todayISO(), i.expiry);
  return d < 0 ? { cls: 'expired', txt: 'Expired' } : d <= 30 ? { cls: 'soon', txt: d === 0 ? 'Expires today' : `Expires in ${d} d` } : null;
}
async function viewStorage() {
  setHeader('Storage', { actions: `<button class="icon" id="stExport" title="Export storage">${I.download}</button>` });
  $('#stExport').onclick = () => exportMenu('storage');
  const items = await all('items');
  const cats = [...new Set(items.map(i => i.category || 'Uncategorized'))].sort();
  if (stCat && !cats.includes(stCat)) stCat = '';
  const nLow = items.filter(isLow).length, nExp = items.filter(expiryState).length;
  main.innerHTML = `
    <div class="searchbar">${I.search}<input id="stq" type="search" placeholder="Search name, lot, supplier, location…" value="${esc(stQuery)}"></div>
    <div class="filters">
      <select id="stcat"><option value="">All categories</option>${cats.map(c => `<option ${c === stCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <div class="seg" id="stSeg">${[['all', 'All'], ['low', `Low stock (${nLow})`], ['exp', `Expiring (${nExp})`]].map(([k, l]) =>
        `<button data-k="${k}" class="${stFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div id="stlist"></div>
    <button class="fab" id="newItem">${I.plus}<span>New item</span></button>`;
  const renderList = () => {
    const q = stQuery.toLowerCase();
    let list = items.filter(i => (!stCat || (i.category || 'Uncategorized') === stCat) &&
      (!q || [i.name, i.lot, i.supplier, i.catalog, i.location, i.category].join(' ').toLowerCase().includes(q)));
    if (stFilter === 'low') list = list.filter(isLow);
    if (stFilter === 'exp') list = list.filter(expiryState);
    const groups = Object.entries(groupBy(list.map(i => ({ ...i, _c: i.category || 'Uncategorized' })), '_c')).sort((a, b) => a[0].localeCompare(b[0]));
    $('#stlist').innerHTML = groups.length ? groups.map(([cat, its]) => `<h3 class="grp">${esc(cat)}</h3>
      <div class="card list">${its.sort((a, b) => a.name.localeCompare(b.name)).map(itemRow).join('')}</div>`).join('')
      : `<div class="empty">${items.length ? 'No items match.' : 'No items yet.<br>Tap <b>New item</b> to add your first consumable.'}</div>`;
    $$('[data-add]').forEach(b => b.onclick = () => quickMove(b.dataset.add, 1));
    $$('[data-rm]').forEach(b => b.onclick = () => quickMove(b.dataset.rm, -1));
  };
  const quickMove = async (id, sign) => { const it = await get('items', id); if (await changeQty(it, sign)) rerender(); };
  renderList();
  $('#stq').addEventListener('input', ev => { stQuery = ev.target.value; renderList(); });
  $('#stcat').onchange = ev => { stCat = ev.target.value; renderList(); };
  $$('#stSeg button').forEach(b => b.onclick = () => { stFilter = b.dataset.k; $$('#stSeg button').forEach(x => x.classList.toggle('on', x === b)); renderList(); });
  $('#newItem').onclick = () => go('#/item/new');
}
function itemRow(i) {
  const ex = expiryState(i);
  return `<div class="item ${isLow(i) ? 'low' : ''}">
    <a class="item-main" href="#/item/${i.id}"><div class="item-name">${esc(i.name)}</div>
      <div class="item-sub">${[i.location, i.lot && 'Lot ' + i.lot].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('<span>·</span>')}
      ${isLow(i) ? '<span class="tag low">Low stock</span>' : ''}${ex ? `<span class="tag ${ex.cls}">${ex.txt}</span>` : ''}</div></a>
    <div class="qty-ctl">
      <button class="qbtn" data-rm="${i.id}" aria-label="Remove">${I.minus}</button>
      <div class="qty"><b>${fmtQty(i.quantity)}</b><small>${esc(i.unit)}</small></div>
      <button class="qbtn" data-add="${i.id}" aria-label="Add">${I.plus}</button>
    </div></div>`;
}
async function changeQty(item, sign) {
  const exps = sign < 0 ? (await all('experiments')).sort((a, b) => (a.status === 'Finished') - (b.status === 'Finished') || b.number - a.number) : [];
  const step = item.step || 1;
  const r = await dialog({
    title: `${sign > 0 ? 'Add to' : 'Remove from'}: ${esc(item.name)}`,
    body: `<p>In stock: <b>${fmtQty(item.quantity)} ${esc(item.unit)}</b></p>
      <label>Quantity (${esc(item.unit)})<input name="q" type="number" step="any" min="0" inputmode="decimal" required value="${step}"></label>
      <div class="after" id="after"></div>
      ${sign < 0 ? `<label>Used for experiment<select name="exp"><option value="">— none —</option>${exps.map(e =>
        `<option value="${e.id}" ${e.id === lastRemovalExp ? 'selected' : ''}>${expNum(e)} ${esc(e.title || '')}${e.status === 'Finished' ? ' (finished)' : ''}</option>`).join('')}</select></label>` : ''}
      <label>Note (optional)<input name="note"></label>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: sign > 0 ? 'Add' : 'Remove', value: 'ok', cls: 'primary' }],
    onMount: d => {
      const inp = $('[name=q]', d);
      const upd = () => {
        const v = parseFloat(inp.value) || 0, after = round(Number(item.quantity) + sign * v);
        $('#after', d).innerHTML = `After: <b>${fmtQty(after)} ${esc(item.unit)}</b>`;
        $('#after', d).classList.toggle('neg', after < 0);
        inp.setCustomValidity(v <= 0 ? 'Enter a quantity above 0' : after < 0 ? `Only ${fmtQty(item.quantity)} ${item.unit} in stock` : '');
      };
      inp.addEventListener('input', upd); upd();
      setTimeout(() => inp.select(), 50);
    },
  });
  if (!r.ok) return false;
  const q = round(parseFloat(r.data.q));
  if (sign < 0) lastRemovalExp = r.data.exp || '';
  const it = await applyMovement(item.id, sign * q, { type: sign > 0 ? 'add' : 'remove', expId: r.data.exp || null, note: r.data.note.trim(), step: q });
  toast(`${sign > 0 ? '+' : '−'}${fmtQty(q)} ${item.unit} · now ${fmtQty(it.quantity)} ${item.unit}${isLow(it) ? ' · LOW STOCK' : ''}`, 2800);
  return true;
}
function applyMovement(itemId, delta, { type, expId = null, note = '', step, setTo } = {}) {
  return tx(['items', 'movements'], 'readwrite', async t => {
    const s = t.objectStore('items');
    const it = await reqP(s.get(itemId));
    if (setTo != null) delta = round(setTo - Number(it.quantity));
    it.quantity = round(Number(it.quantity || 0) + delta);
    if (step) it.step = step;
    it.updatedAt = now();
    s.put(it);
    t.objectStore('movements').put({ id: uid(), itemId, delta, balance: it.quantity, type, expId, note, date: new Date().toISOString() });
    return it;
  });
}

/* ---------------- item page ---------------- */
async function viewItem(id) {
  const isNew = id === 'new';
  const it = isNew ? { name: '', category: '', location: '', unit: '', quantity: 0, minQty: '', step: 1, lot: '', expiry: '', supplier: '', catalog: '', notes: '' } : await get('items', id);
  if (!it) return go('#/storage');
  const [items, movs, exps] = await Promise.all([all('items'), isNew ? [] : all('movements', 'itemId', id), all('experiments')]);
  const expMap = Object.fromEntries(exps.map(e => [e.id, e]));
  movs.sort((a, b) => b.date.localeCompare(a.date));
  const cats = [...new Set([...CATEGORIES, ...items.map(i => i.category).filter(Boolean)])];
  const locs = [...new Set([...LOCATIONS, ...items.map(i => i.location).filter(Boolean)])];
  const units = [...new Set([...UNITS, ...items.map(i => i.unit).filter(Boolean)])];
  const ex = expiryState(it);
  setHeader(isNew ? 'New item' : it.name, { back: '#/storage', actions: isNew ? '' : `<button class="icon" id="delItem" title="Delete item">${I.trash}</button>` });
  main.innerHTML = `
  ${isNew ? '' : `<section class="card">
    <div class="bigqty"><button class="qbtn" id="rmQ" aria-label="Remove">${I.minus}</button>
      <div class="qty"><b>${fmtQty(it.quantity)}</b><small>${esc(it.unit)} in stock</small></div>
      <button class="qbtn" id="addQ" aria-label="Add">${I.plus}</button></div>
    <div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap">${isLow(it) ? '<span class="tag low">Low stock</span>' : ''}${ex ? `<span class="tag ${ex.cls}">${ex.txt}</span>` : ''}
      <button class="btn" id="setQ">Set count (stocktake)</button></div>
  </section>`}
  <form class="card" id="itemForm">
    <div class="grid2">
      <label class="span2">Name *<input name="name" required value="${esc(it.name)}" placeholder="e.g. DMEM high glucose"></label>
      <label>Category<input name="category" list="dl-cat" value="${esc(it.category)}"></label>
      <label>Location<input name="location" list="dl-loc" value="${esc(it.location)}"></label>
      <label>Unit *<input name="unit" list="dl-unit" required value="${esc(it.unit)}" placeholder="mL, pcs, box…"></label>
      ${isNew ? `<label>Initial quantity<input name="quantity" type="number" step="any" min="0" inputmode="decimal" value="0"></label>` : '<span></span>'}
      <label>Minimum (low-stock alert)<input name="minQty" type="number" step="any" min="0" inputmode="decimal" value="${esc(it.minQty)}" placeholder="optional"></label>
      <label>Default +/− quantity<input name="step" type="number" step="any" min="0" inputmode="decimal" value="${esc(it.step)}"></label>
      <label>Lot number<input name="lot" value="${esc(it.lot)}"></label>
      <label>Expiry date<input name="expiry" type="date" value="${esc(it.expiry)}"></label>
      <label>Supplier<input name="supplier" value="${esc(it.supplier)}"></label>
      <label>Catalog #<input name="catalog" value="${esc(it.catalog)}"></label>
      <label class="span2">Notes<textarea name="notes" rows="2">${esc(it.notes)}</textarea></label>
    </div>
    <button class="btn primary big" type="submit">${isNew ? 'Create item' : 'Save changes'}</button>
    <datalist id="dl-cat">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <datalist id="dl-loc">${locs.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <datalist id="dl-unit">${units.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
  </form>
  ${isNew ? '' : `<div class="sec-head"><h2>History (${movs.length})</h2></div>
  <div class="card">${movs.length ? movs.map(m => `<div class="hist">
      <span class="d ${m.delta >= 0 ? 'pos' : 'neg'}">${m.delta >= 0 ? '+' : '−'}${fmtQty(Math.abs(m.delta))}</span>
      <div class="w">${m.type === 'set' ? 'Stocktake' : m.type === 'initial' ? 'Initial stock' : m.delta >= 0 ? 'Added' : 'Removed'}
        ${m.expId ? ` · <a href="#/exp/${m.expId}">${expMap[m.expId] ? expNum(expMap[m.expId]) + ' ' + esc(expMap[m.expId].title || '') : 'deleted experiment'}</a>` : ''}
        ${m.note ? ` · ${esc(m.note)}` : ''}<small>${fmtDateTime(m.date)} · balance ${fmtQty(m.balance)} ${esc(it.unit)}</small></div></div>`).join('')
    : '<div class="muted">No movements yet.</div>'}</div>`}`;

  $('#itemForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    const rec = {
      ...it, name: f.name.trim(), category: f.category.trim(), location: f.location.trim(), unit: f.unit.trim(),
      minQty: f.minQty === '' ? '' : Number(f.minQty), step: Number(f.step) || 1, lot: f.lot.trim(), expiry: f.expiry,
      supplier: f.supplier.trim(), catalog: f.catalog.trim(), notes: f.notes.trim(), updatedAt: now(),
    };
    if (isNew) {
      rec.id = uid(); rec.createdAt = now(); rec.quantity = 0;
      await put('items', rec);
      const q = Number(f.quantity) || 0;
      if (q > 0) await applyMovement(rec.id, q, { type: 'initial' });
      toast('Item created'); goBack('#/storage');
    } else {
      const cur = await get('items', id); rec.quantity = cur.quantity; rec.step = rec.step || cur.step;
      await put('items', rec); toast('Saved'); rerender();
    }
  });
  if (isNew) return;
  $('#addQ').onclick = async () => { if (await changeQty(await get('items', id), 1)) rerender(); };
  $('#rmQ').onclick = async () => { if (await changeQty(await get('items', id), -1)) rerender(); };
  $('#setQ').onclick = async () => {
    const cur = await get('items', id);
    const r = await dialog({ title: 'Set count', body: `<p>Current: <b>${fmtQty(cur.quantity)} ${esc(cur.unit)}</b></p>
      <label>Actual quantity counted (${esc(cur.unit)})<input name="q" type="number" step="any" min="0" inputmode="decimal" required value="${fmtQty(cur.quantity)}"></label>
      <label>Note (optional)<input name="note"></label>` });
    if (!r.ok) return;
    await applyMovement(id, 0, { type: 'set', setTo: round(parseFloat(r.data.q)), note: r.data.note.trim() });
    toast('Count updated'); rerender();
  };
  $('#delItem').onclick = async () => {
    if (!await confirmDlg('Delete item?', `${esc(it.name)} and its history will be permanently deleted.`, 'Delete', 'danger')) return;
    await tx(['items', 'movements'], 'readwrite', async t => {
      t.objectStore('items').delete(id);
      const s = t.objectStore('movements');
      (await reqP(s.index('itemId').getAllKeys(id))).forEach(k => s.delete(k));
    });
    toast('Item deleted'); goBack('#/storage');
  };
}

/* =========================================================
   EXPORT / IMPORT
   ========================================================= */
function blobToDataURL(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); }); }
function dataURLToBlob(d) {
  const [head, b64] = d.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
async function deliverFile(blob, name, type = 'application/json', hint) {
  const file = new File([blob], name, { type });
  let canShare = false; try { canShare = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch { }
  const r = await dialog({
    title: 'Export ready',
    body: `<p><b>${esc(name)}</b><br><span class="muted">${fmtSize(blob.size)}</span></p>
      <p class="muted">${hint || 'Save the file (it goes to your Downloads folder), then copy it to the other device – e.g. via Google Drive, OneDrive, email or USB – and open <b>Settings → Import file</b> there.'}</p>`,
    actions: [{ label: 'Close', value: 'cancel' }, ...(canShare ? [{ label: 'Share…', value: 'share' }] : []), { label: 'Save file', value: 'save', cls: 'primary' }],
  });
  if (r.action === 'save') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
    toast('Saved ' + name, 3000);
  } else if (r.action === 'share') {
    try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed: ' + e.message, 4000); }
  }
}
async function exportExperiment(id) {
  toast('Preparing export…', 10000);
  const e = await get('experiments', id);
  const [chips, photos, movs, items] = await Promise.all([all('chips', 'expId', id), all('photos', 'expId', id), all('movements', 'expId', id), all('items')]);
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const head = {
    format: 'labtrack-experiment', version: 1, app: APP_VERSION, exportedAt: new Date().toISOString(),
    experiment: e, chips,
    consumablesUsed: movs.map(m => ({ ...m, itemName: itemMap[m.itemId]?.name || '', unit: itemMap[m.itemId]?.unit || '' })),
  };
  const parts = [JSON.stringify(head).slice(0, -1) + ',"photos":['];
  for (let i = 0; i < photos.length; i++) {
    const { blob, cropBlob, ...meta } = photos[i];
    meta.data = await blobToDataURL(blob);
    if (cropBlob) meta.cropData = await blobToDataURL(cropBlob);
    parts.push((i ? ',' : '') + JSON.stringify(meta));
  }
  parts.push(']}');
  const out = new Blob(parts, { type: 'application/json' });
  $('#toast').classList.remove('show');
  await deliverFile(out, `LabTrack_Exp${pad2(e.number)}${e.title ? '_' + slug(e.title) : ''}_${todayISO()}.json`);
}
async function exportStorage() {
  const [items, movements] = await Promise.all([all('items'), all('movements')]);
  const out = new Blob([JSON.stringify({ format: 'labtrack-storage', version: 1, app: APP_VERSION, exportedAt: new Date().toISOString(), items, movements })], { type: 'application/json' });
  await deliverFile(out, `LabTrack_Storage_${todayISO()}.json`);
}
async function importFromFile() {
  const f = await pickFile({});
  if (!f) return;
  let data;
  try { toast('Reading file…', 10000); data = JSON.parse(await f.text()); }
  catch { toast('This is not a valid LabTrack file', 4000); return; }
  try {
    if (data.format === 'labtrack-experiment') await importExperiment(data);
    else if (data.format === 'labtrack-storage') await importStorage(data);
    else if (data.format === 'labtrack-expansion') await importExpansion(data);
    else toast('This is not a LabTrack export file', 4000);
  } catch (e) { console.error(e); toast('Import failed: ' + e.message, 5000); }
}
async function importExperiment(data) {
  const inc = data.experiment;
  const local = await get('experiments', inc.id);
  const exps = await all('experiments');
  const photos = data.photos.map(p => { const { data: d, cropData: cd, ...m } = p; return { ...m, blob: dataURLToBlob(d), ...(cd ? { cropBlob: dataURLToBlob(cd) } : {}) }; });
  $('#toast').classList.remove('show');
  let msg;
  if (!local) {
    const clash = exps.find(x => x.number === inc.number);
    const newNum = clash ? exps.reduce((m, x) => Math.max(m, x.number), 0) + 1 : inc.number;
    if (!await confirmDlg('Import experiment?', `<b>#${pad2(inc.number)} ${esc(inc.title)}</b> – ${data.chips.length} chips, ${photos.length} photos.` +
      (clash ? `<br><br>Number #${pad2(inc.number)} is already used on this device (${esc(clash.title)}), so it will be imported as <b>#${pad2(newNum)}</b>.` : ''), 'Import')) return;
    inc.number = newNum;
    await tx(['experiments', 'chips', 'photos'], 'readwrite', t => {
      t.objectStore('experiments').put(inc);
      data.chips.forEach(c => t.objectStore('chips').put(c));
      photos.forEach(p => t.objectStore('photos').put(p));
    });
    msg = `Imported ${expNum(inc)} with ${photos.length} photos`;
  } else {
    if (!await confirmDlg('Merge experiment?', `<b>${expNum(local)} ${esc(local.title)}</b> already exists on this device.<br><br>The file will be merged: newer info, chip and chamber changes win, and new photos are added (for the same chamber and day, the newer photo is kept).`, 'Merge')) return;
    let nChips = 0, nPhotos = 0;
    await tx(['experiments', 'chips', 'photos'], 'readwrite', async t => {
      if ((inc.updatedAt || 0) > (local.updatedAt || 0)) t.objectStore('experiments').put({ ...inc, number: local.number });
      const cs = t.objectStore('chips');
      for (const c of data.chips) {
        const lc = await reqP(cs.get(c.id));
        if (!lc || (c.updatedAt || 0) > (lc.updatedAt || 0)) { cs.put(c); nChips++; }
      }
      const ps = t.objectStore('photos');
      const localPhotos = await reqP(ps.index('expId').getAll(inc.id));
      for (const p of photos) {
        if (localPhotos.some(x => x.id === p.id)) continue;
        const slot = localPhotos.find(x => x.chipId === p.chipId && x.chamber === p.chamber && x.day === p.day);
        if (slot) { if ((p.createdAt || 0) <= (slot.createdAt || 0)) continue; ps.delete(slot.id); }
        ps.put(p); nPhotos++;
      }
    });
    msg = `Merged: ${nChips} chips updated, ${nPhotos} photos added`;
  }
  toast(msg, 4000);
  go('#/exp/' + inc.id);
}
async function importStorage(data) {
  $('#toast').classList.remove('show');
  if (!await confirmDlg('Import storage?', `${data.items.length} items and ${data.movements.length} history entries.<br><br>They will be merged with this device: for items present on both, the most recently changed version wins; history entries are combined.`, 'Import')) return;
  let nI = 0, nM = 0;
  await tx(['items', 'movements'], 'readwrite', async t => {
    const is = t.objectStore('items'), ms = t.objectStore('movements');
    for (const i of data.items) { const l = await reqP(is.get(i.id)); if (!l || (i.updatedAt || 0) > (l.updatedAt || 0)) { is.put(i); nI++; } }
    for (const m of data.movements) { const l = await reqP(ms.get(m.id)); if (!l) { ms.put(m); nM++; } }
  });
  toast(`Storage imported: ${nI} items updated, ${nM} history entries added`, 4000);
  go('#/storage');
}

/* =========================================================
   CELL EXPANSION
   ========================================================= */
const FLASK_AREAS = { 'T25': 25, 'T75': 75, 'T175': 175, 'T225': 225, 'Other': null };
function parseNum(s) {
  s = String(s ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  s = s.replace(/[x×*·]10\^?/i, 'e');
  const commas = (s.match(/,/g) || []).length, dots = (s.match(/\./g) || []).length;
  if (commas > 1 || (commas && dots)) s = s.replace(/,/g, '');   // 1,500,000 / 1,500.5
  else if (commas === 1) s = s.replace(',', '.');                // 1,5 (decimal comma)
  if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, ''); // 1.500.000
  const v = Number(s);
  return isFinite(v) ? v : NaN;
}
const fmtCells = x => (x == null || !isFinite(x)) ? '–' : Math.abs(x) >= 1e4 ? fmtSci(x, true) : fmtN(x);
const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 36e5;
function nowLocal() { const d = new Date(); return `${todayISO()}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
const fmtDT = s => s ? fmtDate(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '') : '';
const fmtH = h => (h == null || !isFinite(h)) ? '–' : `${fmtN(h)} h`;
const fmtDur = h => (h == null || !isFinite(h)) ? '–' : `${fmtN(h / 24)} d (${Math.round(h)} h)`;
const pLabel = p => 'P' + p.n;
const curPassage = x => x.passages[x.passages.length - 1];

function expansionStats(x) {
  const area = FLASK_AREAS[x.flaskType] || null;
  const rows = [];
  let cpd = 0, cpdC = 0, yieldT = null, doneH = 0;
  const tot = { harvested: 0, frozen: 0, used: 0, discarded: 0 };
  x.passages.forEach((p, i) => {
    const N0 = p.flasks.reduce((s, f) => s + (+f.seeded || 0), 0);
    const prevViab = i === 0 ? x.viability : (x.passages[i - 1].split?.viability || 100);
    const N0c = N0 * (x.seedingEff / 100) * (prevViab / 100);
    const r = { p, N0, N0c, nFlasks: p.flasks.length, seedDens: area ? N0 / (p.flasks.length * area) : null };
    if (yieldT == null) yieldT = N0;
    const s = p.split;
    if (s) {
      r.h = hoursBetween(p.start, s.date);
      r.fold = s.harvested / N0; r.foldC = s.harvested / N0c;
      r.pd = Math.log2(r.fold); r.pdC = Math.log2(r.foldC);
      r.dt = r.pd > 0 ? r.h / r.pd : null; r.dtC = r.pdC > 0 ? r.h / r.pdC : null;
      r.mu = r.h > 0 ? Math.log(r.fold) / (r.h / 24) : null; r.muC = r.h > 0 ? Math.log(r.foldC) / (r.h / 24) : null;
      cpd += r.pd; cpdC += r.pdC; r.cpd = cpd; r.cpdC = cpdC;
      yieldT *= r.fold; r.yieldT = yieldT;
      r.harvDens = area ? s.harvested / (p.flasks.length * area) : null;
      doneH += r.h;
      for (const k of Object.keys(tot)) tot[k] += +s[k] || 0;
    } else {
      r.h = hoursBetween(p.start, new Date());
    }
    rows.push(r);
  });
  const first = rows[0];
  return {
    rows, tot, area, cpd, cpdC, doneH, yieldT,
    totalH: first ? hoursBetween(first.p.start, curPassage(x).split?.date || new Date()) : 0,
    dt: cpd > 0 ? doneH / cpd : null, dtC: cpdC > 0 ? doneH / cpdC : null,
    splits: rows.filter(r => r.p.split).length,
  };
}

/* ---------------- list ---------------- */
let cexpFilter = 'active';
async function viewExpansions() {
  setHeader('Cell expansion', { actions: `<button class="icon" id="impBtn" title="Import file">${I.upload}</button>` });
  $('#impBtn').onclick = importFromFile;
  const xs = (await all('expansions')).sort((a, b) => b.number - a.number);
  const shown = xs.filter(x => cexpFilter === 'all' || (cexpFilter === 'active' ? x.status !== 'Finished' : x.status === 'Finished'));
  main.innerHTML = `
    <div class="seg" id="cxSeg">${[['active', 'Active'], ['finished', 'Finished'], ['all', 'All']].map(([k, l]) =>
      `<button data-k="${k}" class="${cexpFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${shown.length ? shown.map(x => {
      const st = expansionStats(x), p = curPassage(x);
      return `<a class="card exp-card" href="#/cexp/${x.id}">
        <div class="row"><span class="expnum">#${pad2(x.number)}</span><span class="title">${esc(x.cellType || 'Cells')}${x.lot ? ' · lot ' + esc(x.lot) : ''}</span>
          <span class="badge st-${x.status.toLowerCase()}">${x.status}</span></div>
        <div class="meta">${x.status === 'Finished' ? `Ended at ${pLabel(p)}` : `<b>${pLabel(p)}</b> · day ${fmtN(Math.floor(hoursBetween(p.start, new Date()) / 24))} · ${p.flasks.length} flask${p.flasks.length === 1 ? '' : 's'}`} · started ${fmtDate(x.passages[0].start)}</div>
        <div class="meta">${st.splits ? `CPD ${fmtN(st.cpd)} (corr. ${fmtN(st.cpdC)}) · DT ${fmtH(st.dt)} (corr. ${fmtH(st.dtC)})` : 'No split yet'}${st.tot.frozen ? ` · ${fmtCells(st.tot.frozen)} frozen` : ''}</div>
      </a>`;
    }).join('') : `<div class="empty">${xs.length ? 'No expansions in this view.' : 'No cell expansions yet.<br>Tap <b>New expansion</b> to start.'}</div>`}
    <button class="fab" id="newCx">${I.plus}<span>New expansion</span></button>`;
  $$('#cxSeg button').forEach(b => b.onclick = () => { cexpFilter = b.dataset.k; route(); });
  $('#newCx').onclick = () => expansionDialog(null);
}
function cellInput(name, label, val, extra = '') {
  return `<label>${label}<input name="${name}" data-cells inputmode="decimal" value="${val === '' || val == null ? '' : esc(val)}" ${extra} placeholder="e.g. 1500000 or 1.5e6"><small class="cellprev muted"></small></label>`;
}
function bindCellPreviews(root) {
  $$('[data-cells]', root).forEach(inp => {
    const upd = () => {
      const v = parseNum(inp.value), prev = inp.parentElement.querySelector('.cellprev');
      if (prev) prev.textContent = inp.value.trim() === '' ? '' : isFinite(v) ? '= ' + fmtCells(v) : 'not a number';
      inp.setCustomValidity(inp.value.trim() !== '' && !isFinite(v) ? 'Enter a number, e.g. 1500000 or 1.5e6' : '');
    };
    inp.addEventListener('input', upd); upd();
  });
}
async function expansionDialog(x) {
  const isNew = !x, xs = await all('expansions');
  const types = [...new Set(xs.map(e => e.cellType).filter(Boolean))];
  const r = await dialog({
    title: isNew ? 'New cell expansion' : 'Edit expansion',
    body: `<label>Cell type<input name="cellType" list="dl-ct" required value="${esc(x?.cellType)}" placeholder="e.g. hBEC, iPSC-CM, fibroblasts"></label>
      <datalist id="dl-ct">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="grid2">
        <label>Lot<input name="lot" value="${esc(x?.lot)}"></label>
        ${cellInput('vialCells', 'Cells in vial (theoretical)', x?.vialCells ?? '', 'required')}
        <label>Seeding efficiency (%)<input name="se" type="number" step="any" min="0" max="100" inputmode="decimal" required value="${esc(x?.seedingEff ?? '')}"></label>
        <label>Cell viability (%)<input name="viab" type="number" step="any" min="0" max="100" inputmode="decimal" required value="${esc(x?.viability ?? '')}"></label>
        ${isNew ? `<label>Number of flasks<input name="nFlasks" type="number" min="1" step="1" inputmode="numeric" required value="1"></label>
        <label>Starting passage (P)<input name="p0" type="number" min="0" step="1" inputmode="numeric" required value="1"></label>
        <label>Seeding date & time<input name="start" type="datetime-local" required value="${nowLocal()}"></label>` : ''}
        <label>Flask type<select name="flaskType">${Object.keys(FLASK_AREAS).map(k => `<option ${k === (x?.flaskType || 'T75') ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      </div>
      <label>Notes<textarea name="notes" rows="2">${esc(x?.notes)}</textarea></label>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: isNew ? 'Create' : 'Save', value: 'ok', cls: 'primary' }],
    onMount: d => bindCellPreviews(d),
  });
  if (!r.ok) return;
  const base = { cellType: r.data.cellType.trim(), lot: r.data.lot.trim(), vialCells: parseNum(r.data.vialCells), seedingEff: +r.data.se, viability: +r.data.viab,
    flaskType: r.data.flaskType, notes: r.data.notes.trim(), updatedAt: now() };
  if (isNew) {
    const n = Math.max(1, +r.data.nFlasks || 1);
    const x2 = { id: uid(), number: xs.reduce((m, e) => Math.max(m, e.number), 0) + 1, status: 'Running', createdAt: now(), ...base,
      passages: [{ id: uid(), n: +r.data.p0 || 0, start: r.data.start, flasks: equalFlasks(n, base.vialCells), split: null }] };
    await put('expansions', x2); go('#/cexp/' + x2.id);
  } else {
    Object.assign(x, base); await put('expansions', x); rerender();
  }
}
function equalFlasks(n, total, old = []) {
  const v = splitEqual(total, n);
  return Array.from({ length: n }, (_, i) => ({ id: old[i]?.id || uid(), name: 'F' + (i + 1), seeded: v[i], notes: old[i]?.notes || '' }));
}
function splitEqual(total, n) {          // whole cells, remainder spread over the first flasks
  if (!n) return [];
  const base = Math.floor(Math.round(total) / n), rem = Math.round(total) - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/* ---------------- expansion page ---------------- */
async function viewExpansion(id) {
  const x = await get('expansions', id);
  if (!x) return go('#/cexp');
  const photos = await all('photos', 'expId', id);
  const st = expansionStats(x), p = curPassage(x), cur = st.rows[st.rows.length - 1];
  const latest = {};
  for (const ph of photos) if (!latest[ph.chipId] || ph.day > latest[ph.chipId].day) latest[ph.chipId] = ph;
  const running = x.status !== 'Finished';
  setHeader(`#${pad2(x.number)} ${x.cellType || ''}`, {
    back: '#/cexp',
    actions: `<button class="icon" id="cxEdit" title="Edit">${I.edit}</button><button class="icon" id="cxExport" title="Export">${I.download}</button><button class="icon" id="cxDelete" title="Delete">${I.trash}</button>`,
  });
  const pr = (label, a, b) => `<tr><td>${label}</td><td class="num">${a}</td>${b === undefined ? '<td></td>' : `<td class="num">${b}</td>`}</tr>`;
  const passageCard = r => {
    const s = r.p.split;
    return `<div class="card scroll">
      <h3 class="subh" style="margin-top:0">${pLabel(r.p)} <span class="muted" style="font-weight:400">${fmtDT(r.p.start)}${s ? ' → ' + fmtDT(s.date) : ' → running'}</span></h3>
      <div class="pills" style="margin:6px 0 8px">${r.p.flasks.map(f => `<a class="pill" href="#/cexp/${id}/flask/${f.id}">${f.name} · ${fmtCells(f.seeded)}</a>`).join('')}</div>
      <table class="calc"><thead><tr><th>Parameter</th><th>Raw</th><th>Corrected</th></tr></thead><tbody>
        ${pr('Cells seeded (N₀)', fmtCells(r.N0), fmtCells(r.N0c))}
        ${r.seedDens != null ? pr('Seeding density', fmtCells(r.seedDens) + '/cm²', fmtCells(r.N0c / (r.nFlasks * st.area)) + '/cm²') : ''}
        ${pr('Time in culture', fmtDur(r.h))}
        ${s ? `${pr('Cells harvested (N)', fmtCells(s.harvested))}
          ${r.harvDens != null ? pr('Harvest density', fmtCells(r.harvDens) + '/cm²') : ''}
          ${pr('Fold expansion (N/N₀)', fmtN(r.fold) + '×', fmtN(r.foldC) + '×')}
          ${pr('Population doublings', fmtN(r.pd), fmtN(r.pdC))}
          ${pr('<b>Doubling time</b>', '<b>' + fmtH(r.dt) + '</b>', '<b>' + fmtH(r.dtC) + '</b>')}
          ${pr('Growth rate μ', r.mu != null ? fmtN(r.mu) + ' /day' : '–', r.muC != null ? fmtN(r.muC) + ' /day' : '–')}
          ${pr('Cumulative PD', fmtN(r.cpd), fmtN(r.cpdC))}
          ${pr('Frozen / used / discarded', `${fmtCells(s.frozen)} / ${fmtCells(s.used)} / ${fmtCells(s.discarded)}`)}
          ${s.viability ? pr('Viability at harvest', fmtN(s.viability) + ' %') : ''}` : ''}
      </tbody></table>${s?.notes ? `<p class="muted calcnote">${esc(s.notes)}</p>` : ''}</div>`;
  };
  main.innerHTML = `
  <section class="card">
    <div class="kv"><span>Cell type · lot</span><b>${esc(x.cellType)}${x.lot ? ' · ' + esc(x.lot) : ''}</b></div>
    <div class="kv"><span>Cells in vial</span><b>${fmtCells(x.vialCells)}</b></div>
    <div class="kv"><span>Seeding efficiency · viability</span><b>${fmtN(x.seedingEff)} % · ${fmtN(x.viability)} %</b></div>
    <div class="kv"><span>Flask type</span><b>${esc(x.flaskType)}${st.area ? ` (${st.area} cm²)` : ''}</b></div>
    ${x.notes ? `<p class="muted calcnote">${esc(x.notes)}</p>` : ''}
    <div class="stats" style="margin-top:10px">
      <div><b>${pLabel(p)}</b><span>${running ? 'Current' : 'Last'}</span></div>
      <div><b>${fmtN(Math.floor(st.totalH / 24))}</b><span>Days total</span></div>
      <div><b>${st.splits ? fmtN(st.cpd) : '–'}</b><span>Cum. PD</span></div>
      <div><b>${st.dt ? Math.round(st.dt) + ' h' : '–'}</b><span>Mean DT</span></div>
    </div>
  </section>

  ${running ? `<div class="sec-head"><h2>${pLabel(p)} · day ${fmtN(Math.floor(cur.h / 24))}</h2><a class="btn primary" href="#/cexp/${id}/split">Split / passage</a></div>
  <div class="chips">${p.flasks.map(f => { const ph = latest[f.id]; return `<a class="card flaskcard" href="#/cexp/${id}/flask/${f.id}">
      <div class="chamber" style="border-color:var(--accent)">${ph ? `<img src="${url(photoBlob(ph))}" alt=""><span class="ch-day">D${ph.day}</span>` : I.camera}<span class="ch-label">${f.name}</span></div>
      <div class="fc-meta"><b>${f.name}</b> · ${fmtCells(f.seeded)} seeded${f.notes ? '<br><span class="muted">' + esc(f.notes) + '</span>' : ''}</div></a>`; }).join('')}</div>` : ''}

  ${st.splits ? `<div class="sec-head"><h2>Overall</h2></div>
  <div class="card scroll"><table class="calc"><thead><tr><th>Parameter</th><th>Raw</th><th>Corrected</th></tr></thead><tbody>
    ${pr('Passages completed', st.splits)}
    ${pr('Time (completed passages)', fmtDur(st.doneH))}
    ${pr('Cumulative population doublings', fmtN(st.cpd), fmtN(st.cpdC))}
    ${pr('<b>Mean doubling time</b>', '<b>' + fmtH(st.dt) + '</b>', '<b>' + fmtH(st.dtC) + '</b>')}
    ${pr('Theoretical yield (all cells kept)', fmtCells(st.yieldT))}
    ${pr('Total frozen', fmtCells(st.tot.frozen))}
    ${pr('Total used', fmtCells(st.tot.used))}
    ${pr('Total discarded', fmtCells(st.tot.discarded))}
  </tbody></table>
  <p class="muted calcnote">Corrected: N₀ × seeding efficiency × viability (vial viability for the first passage, viability at harvest – if entered – for later passages).</p></div>` : ''}

  <div class="sec-head"><h2>Passages</h2>${st.splits ? `<button class="btn" id="undoSplit">Undo last split</button>` : ''}</div>
  ${[...st.rows].reverse().map(passageCard).join('')}
  ${running ? '' : `<div class="cap-row"><button class="btn" id="reopen">Reopen expansion</button></div>`}`;

  $('#cxEdit').onclick = () => expansionDialog(x);
  $('#cxExport').onclick = () => exportMenu('cexp', id);
  $('#cxDelete').onclick = async () => {
    if (!await confirmDlg('Delete expansion?', `#${pad2(x.number)} ${esc(x.cellType)} and its ${photos.length} photos will be permanently deleted. Consider exporting it first.`, 'Delete', 'danger')) return;
    await tx(['expansions', 'photos'], 'readwrite', async t => {
      t.objectStore('expansions').delete(id);
      const s = t.objectStore('photos'); (await reqP(s.index('expId').getAllKeys(id))).forEach(k => s.delete(k));
    });
    toast('Expansion deleted'); goBack('#/cexp');
  };
  $('#reopen') && ($('#reopen').onclick = async () => { x.status = 'Running'; x.updatedAt = now(); await put('expansions', x); rerender(); });
  $('#undoSplit') && ($('#undoSplit').onclick = async () => {
    const last = curPassage(x);
    if (!last.split) {             // current passage open -> remove it and reopen previous split
      const nPh = photos.filter(ph => last.flasks.some(f => f.id === ph.chipId)).length;
      if (!await confirmDlg('Undo last split?', `${pLabel(last)} will be removed${nPh ? ` together with its ${nPh} flask photos` : ''} and ${pLabel(x.passages[x.passages.length - 2])} becomes the current passage again.`, 'Undo', 'danger')) return;
      await tx(['expansions', 'photos'], 'readwrite', t => {
        const s = t.objectStore('photos');
        photos.filter(ph => last.flasks.some(f => f.id === ph.chipId)).forEach(ph => s.delete(ph.id));
        x.passages.pop(); curPassage(x).split = null; x.status = 'Running'; x.updatedAt = now();
        t.objectStore('expansions').put(x);
      });
    } else {                       // last passage was split into 0 flasks (expansion finished)
      if (!await confirmDlg('Undo last split?', `The final split of ${pLabel(last)} will be removed and the expansion reopened.`, 'Undo', 'danger')) return;
      last.split = null; x.status = 'Running'; x.updatedAt = now(); await put('expansions', x);
    }
    toast('Split undone'); rerender();
  });
}

/* ---------------- split / passage ---------------- */
async function viewSplit(id) {
  const x = await get('expansions', id);
  if (!x) return go('#/cexp');
  const p = curPassage(x);
  if (p.split) return go('#/cexp/' + id);
  const st = expansionStats(x), r0 = st.rows[st.rows.length - 1];
  setHeader(`Split ${pLabel(p)} → P${p.n + 1}`, { back: '#/cexp/' + id });
  main.innerHTML = `
  <form class="card" id="spForm">
    <label>Harvest date & time<input type="datetime-local" name="date" required value="${nowLocal()}"></label>
    <div class="grid2">
      ${cellInput('harvested', 'Total cells harvested', '', 'required')}
      ${cellInput('frozen', 'Cells frozen', '0')}
      ${cellInput('used', 'Cells used', '0')}
      ${cellInput('discarded', 'Cells thrown away', '0')}
      <label>Viability at harvest (%)<input name="viability" type="number" step="any" min="0" max="100" inputmode="decimal" placeholder="optional"></label>
      <label>Number of flasks (P${p.n + 1})<input name="nFlasks" type="number" min="0" step="1" inputmode="numeric" required value="${p.flasks.length}"></label>
    </div>
    <label>Notes<input name="notes"></label>
  </form>
  <div class="sec-head"><h2>Seeding of P${p.n + 1}</h2><button class="btn" id="spEqual" type="button">Split equally</button></div>
  <div class="card"><div id="spAvail" class="calcnote" style="margin-bottom:8px"></div><div id="spFlasks" class="flaskdist"></div><div id="spSum" class="calcnote"></div></div>
  <div class="sec-head"><h2>${pLabel(p)} results</h2></div>
  <div class="card scroll" id="spRes"></div>
  <button class="btn primary big" id="spSave">Save split</button>`;
  const form = $('#spForm'), f = form.elements;
  form.addEventListener('submit', ev => ev.preventDefault());
  bindCellPreviews(form);
  let manual = false, dist = [];
  const avail = () => { const h = parseNum(f.harvested.value); return h - (parseNum(f.frozen.value) || 0) - (parseNum(f.used.value) || 0) - (parseNum(f.discarded.value) || 0); };
  const drawFlasks = () => {
    const n = Math.max(0, parseInt(f.nFlasks.value) || 0), a = avail();
    if (!manual || dist.length !== n) { dist = splitEqual(isFinite(a) && a > 0 ? a : 0, n); manual = false; }
    $('#spFlasks').innerHTML = dist.map((v, i) => `<label>F${i + 1}<input data-fl="${i}" data-cells inputmode="decimal" value="${v}"><small class="cellprev muted"></small></label>`).join('') || '<p class="muted">0 flasks: the expansion will be finished after this split.</p>';
    bindCellPreviews($('#spFlasks'));
    $$('#spFlasks [data-fl]').forEach(inp => inp.addEventListener('input', () => { manual = true; dist[+inp.dataset.fl] = parseNum(inp.value) || 0; summary(); }));
    summary();
  };
  const summary = () => {
    const a = avail(), sum = dist.reduce((s, v) => s + v, 0);
    $('#spAvail').innerHTML = isFinite(a) ? (a < 0 ? '<span style="color:var(--danger)">Frozen + used + thrown away exceed the harvested cells</span>'
      : `Cells to seed (harvested − frozen − used − thrown away): <b>${fmtCells(a)}</b>`) : 'Enter the total cells harvested.';
    const ok = !dist.length || (isFinite(a) && Math.abs(sum - a) <= Math.max(1, a * 0.001));
    $('#spSum').innerHTML = dist.length ? `In flasks: <b>${fmtCells(sum)}</b>${ok ? ' ✓' : ` <span style="color:var(--danger)">≠ ${fmtCells(a)} (difference ${fmtCells(sum - a)})</span>`}` : '';
    // results preview
    const H = parseNum(f.harvested.value), h = hoursBetween(p.start, f.date.value);
    if (!(H > 0) || !(h > 0)) { $('#spRes').innerHTML = `<p class="muted" style="margin:0">${h > 0 ? 'Enter the cells harvested.' : 'Harvest date must be after the seeding of ' + pLabel(p) + ' (' + fmtDT(p.start) + ').'}</p>`; return ok; }
    const fold = H / r0.N0, foldC = H / r0.N0c, pd = Math.log2(fold), pdC = Math.log2(foldC);
    $('#spRes').innerHTML = `<table class="calc"><thead><tr><th>Parameter</th><th>Raw</th><th>Corrected</th></tr></thead><tbody>
      <tr><td>Cells seeded (N₀)</td><td class="num">${fmtCells(r0.N0)}</td><td class="num">${fmtCells(r0.N0c)}</td></tr>
      <tr><td>Time in culture</td><td class="num">${fmtDur(h)}</td><td></td></tr>
      <tr><td>Fold expansion</td><td class="num">${fmtN(fold)}×</td><td class="num">${fmtN(foldC)}×</td></tr>
      <tr><td>Population doublings</td><td class="num">${fmtN(pd)}</td><td class="num">${fmtN(pdC)}</td></tr>
      <tr><td><b>Doubling time</b></td><td class="num"><b>${pd > 0 ? fmtH(h / pd) : '–'}</b></td><td class="num"><b>${pdC > 0 ? fmtH(h / pdC) : '–'}</b></td></tr>
    </tbody></table>`;
    return ok;
  };
  form.addEventListener('input', ev => { if (['nFlasks', 'harvested', 'frozen', 'used', 'discarded'].includes(ev.target.name)) { if (ev.target.name === 'nFlasks') manual = false; if (!manual) drawFlasks(); else summary(); } else summary(); });
  $('#spEqual').onclick = () => { manual = false; drawFlasks(); };
  drawFlasks();
  $('#spSave').onclick = async () => {
    if (!form.reportValidity()) return;
    const a = avail(), n = Math.max(0, parseInt(f.nFlasks.value) || 0);
    if (!(parseNum(f.harvested.value) > 0)) { toast('Enter the total cells harvested', 3000); return; }
    if (hoursBetween(p.start, f.date.value) <= 0) { toast('Harvest date must be after the passage seeding date', 3000); return; }
    if (a < 0) { toast('Frozen + used + thrown away exceed the harvested cells', 3500); return; }
    if (!summary()) { toast('The cells in the flasks must add up to the cells to seed', 3500); return; }
    if (n === 0 && !await confirmDlg('Finish expansion?', 'With 0 flasks no new passage is created and the expansion is marked as finished.', 'Finish')) return;
    p.split = { date: f.date.value, harvested: parseNum(f.harvested.value), frozen: parseNum(f.frozen.value) || 0, used: parseNum(f.used.value) || 0,
      discarded: parseNum(f.discarded.value) || 0, viability: f.viability.value === '' ? null : +f.viability.value, notes: f.notes.value.trim() };
    if (n > 0) x.passages.push({ id: uid(), n: p.n + 1, start: f.date.value, flasks: dist.map((v, i) => ({ id: uid(), name: 'F' + (i + 1), seeded: v, notes: '' })), split: null });
    else x.status = 'Finished';
    x.updatedAt = now();
    await put('expansions', x);
    toast(n > 0 ? `Split saved – P${p.n + 1} seeded in ${n} flask${n === 1 ? '' : 's'}` : 'Expansion finished', 3000);
    goBack('#/cexp/' + id);
  };
}

/* ---------------- flask page (daily photos) ---------------- */
let flaskTarget = { key: '', day: 0 };
async function viewFlask(id, fid) {
  const x = await get('expansions', id);
  if (!x) return go('#/cexp');
  const pi = x.passages.findIndex(p => p.flasks.some(fl => fl.id === fid));
  if (pi < 0) return go('#/cexp/' + id);
  const p = x.passages[pi], fl = p.flasks.find(q => q.id === fid), fi = p.flasks.indexOf(fl);
  const photos = (await all('photos', 'chipId', fid)).sort((a, b) => b.day - a.day || b.createdAt - a.createdAt);
  const start = p.start.slice(0, 10);
  const todayDay = dayOf(start, todayISO());
  if (flaskTarget.key !== fid) flaskTarget = { key: fid, day: todayDay };
  const tDay = flaskTarget.day, tDate = dateForDay(start, tDay);
  const existing = photos.find(ph => ph.day === tDay);
  const prev = p.flasks[fi - 1], next = p.flasks[fi + 1];
  const name = `${pLabel(p)} · ${fl.name}`;
  setHeader(`${name} · #${pad2(x.number)}`, { back: '#/cexp/' + id });
  main.innerHTML = `
  <div class="chnav">
    ${prev ? `<a class="btn" href="#/cexp/${id}/flask/${prev.id}">${I.back}${prev.name}</a>` : '<span class="ph"></span>'}
    <div class="mid"><b>${name}</b><small>${esc(x.cellType)} · ${fmtCells(fl.seeded)} seeded ${fmtDT(p.start)}</small></div>
    ${next ? `<a class="btn" href="#/cexp/${id}/flask/${next.id}">${next.name}${I.fwd}</a>` : '<span class="ph"></span>'}
  </div>
  <section class="card"><label>Flask notes<textarea id="flNotes" rows="2">${esc(fl.notes)}</textarea></label></section>
  <section class="card">
    <div class="daystep">
      <button id="dMinus" aria-label="Previous day">${I.minus}</button>
      <div class="mid"><b>Day ${tDay}</b><small>${fmtDate(tDate)}${tDay === todayDay ? ' · today' : ''}</small></div>
      <button id="dPlus" aria-label="Next day">${I.plus}</button>
    </div>
    ${existing ? '<div class="warn">A photo for this day already exists – a new one will replace it.</div>' : ''}
    <button class="btn primary big" id="snap">${I.camera} Take photo – Day ${tDay}</button>
    <div class="cap-row"><button class="btn" id="fromFile">${I.image} From file / gallery</button></div>
  </section>
  <div class="sec-head"><h2>Timeline (${photos.length})</h2></div>
  ${photos.length ? `<div class="timeline">${photos.map((ph, i) => `<button class="tl" data-i="${i}"><img src="${url(photoBlob(ph))}" alt="" loading="lazy">
      <div><b>Day ${ph.day}</b><small>${fmtDate(ph.date)}</small></div></button>`).join('')}</div>` : '<div class="card empty">No photos yet.</div>'}`;
  $('#flNotes').addEventListener('change', async ev => { fl.notes = ev.target.value.trim(); x.updatedAt = now(); await put('expansions', x); toast('Notes saved'); });
  $('#dMinus').onclick = () => { flaskTarget.day--; rerender(); };
  $('#dPlus').onclick = () => { flaskTarget.day++; rerender(); };
  const take = async src => {
    try {
      const raw = src === 'camera' ? await acquireCamera() : await pickFile({ accept: 'image/*' });
      if (!raw) return;
      if (existing && !await confirmDlg('Replace photo?', `${esc(name)} already has a photo for Day ${tDay}. Replace it?`, 'Replace')) return;
      const blob = await resizeImage(raw);
      await tx(['photos'], 'readwrite', t => {
        const s = t.objectStore('photos'); if (existing) s.delete(existing.id);
        s.put({ id: uid(), expId: id, chipId: fid, chamber: 1, passageId: p.id, day: tDay, date: todayISO(), blob, createdAt: now() });
      });
      toast(`Photo saved – ${name}, Day ${tDay} (${fmtSize(blob.size)})`); rerender();
    } catch (err) { console.error(err); toast('Could not save photo: ' + err.message, 4000); }
  };
  $('#snap').onclick = () => take('camera');
  $('#fromFile').onclick = () => take('file');
  $$('.tl').forEach(b => b.onclick = () => openViewer(photos.map(ph => ({ ...ph, label: name })), +b.dataset.i, rerender));
}

/* ---------------- export / import ---------------- */
async function exportExpansion(id) {
  toast('Preparing export…', 10000);
  const x = await get('expansions', id), photos = await all('photos', 'expId', id);
  const parts = [JSON.stringify({ format: 'labtrack-expansion', version: 1, app: APP_VERSION, exportedAt: new Date().toISOString(), expansion: x }).slice(0, -1) + ',"photos":['];
  for (let i = 0; i < photos.length; i++) { const { blob, cropBlob, ...m } = photos[i]; m.data = await blobToDataURL(blob); if (cropBlob) m.cropData = await blobToDataURL(cropBlob); parts.push((i ? ',' : '') + JSON.stringify(m)); }
  parts.push(']}');
  $('#toast').classList.remove('show');
  await deliverFile(new Blob(parts, { type: 'application/json' }), `LabTrack_Expansion${pad2(x.number)}_${slug(x.cellType)}_${todayISO()}.json`);
}
async function importExpansion(data) {
  const inc = data.expansion, local = await get('expansions', inc.id), xs = await all('expansions');
  const photos = data.photos.map(p => { const { data: d, cropData: cd, ...m } = p; return { ...m, blob: dataURLToBlob(d), ...(cd ? { cropBlob: dataURLToBlob(cd) } : {}) }; });
  $('#toast').classList.remove('show');
  if (!local) {
    const clash = xs.find(e => e.number === inc.number);
    const num = clash ? xs.reduce((m, e) => Math.max(m, e.number), 0) + 1 : inc.number;
    if (!await confirmDlg('Import expansion?', `<b>#${pad2(inc.number)} ${esc(inc.cellType)}</b> – ${inc.passages.length} passages, ${photos.length} photos.` +
      (clash ? `<br><br>Number #${pad2(inc.number)} is already used here, so it will be imported as <b>#${pad2(num)}</b>.` : ''), 'Import')) return;
    inc.number = num;
    await tx(['expansions', 'photos'], 'readwrite', t => { t.objectStore('expansions').put(inc); photos.forEach(p => t.objectStore('photos').put(p)); });
    toast(`Imported expansion #${pad2(num)}`, 3000);
  } else {
    if (!await confirmDlg('Merge expansion?', `<b>#${pad2(local.number)} ${esc(local.cellType)}</b> already exists here. The most recently changed version of the passages is kept, and new photos are added.`, 'Merge')) return;
    let nP = 0;
    await tx(['expansions', 'photos'], 'readwrite', async t => {
      if ((inc.updatedAt || 0) > (local.updatedAt || 0)) t.objectStore('expansions').put({ ...inc, number: local.number });
      const ps = t.objectStore('photos'), lp = await reqP(ps.index('expId').getAll(inc.id));
      for (const p of photos) {
        if (lp.some(q => q.id === p.id)) continue;
        const slot = lp.find(q => q.chipId === p.chipId && q.day === p.day);
        if (slot) { if ((p.createdAt || 0) <= (slot.createdAt || 0)) continue; ps.delete(slot.id); }
        ps.put(p); nP++;
      }
    });
    toast(`Merged: ${nP} photos added`, 3000);
  }
  go('#/cexp/' + inc.id);
}

/* =========================================================
   EXPORT CHOICE + POWERPOINT REPORTS (16:9)
   ========================================================= */
async function exportMenu(kind, id) {
  const label = { exp: 'experiment', cexp: 'cell expansion', storage: 'storage' }[kind];
  const r = await dialog({
    title: `Export ${label}`,
    body: `<p><b>Data file (.json)</b> – to move to another device or keep as a backup. It can be imported back into LabTrack.</p>
      <p><b>Report (.pptx)</b> – a 16:9 PowerPoint presentation with all the information, ready to open, edit or present.</p>
      ${kind === 'storage' ? '<label class="check"><input type="checkbox" name="hist" checked> Include movement history in the report</label>'
        : '<label class="check"><input type="checkbox" name="photos" checked> Include photos in the report (cropped photos are used as cropped)</label>'}`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Data file (.json)', value: 'json' }, { label: 'Report (.pptx)', value: 'report', cls: 'primary' }],
  });
  if (r.action === 'json') return kind === 'exp' ? exportExperiment(id) : kind === 'cexp' ? exportExpansion(id) : exportStorage();
  if (r.action !== 'report') return;
  toast('Building presentation…', 60000);
  try {
    const PptxGenJS = await loadPptx();
    const rep = kind === 'exp' ? await deckExperiment(PptxGenJS, id, !!r.data.photos)
      : kind === 'cexp' ? await deckExpansion(PptxGenJS, id, !!r.data.photos) : await deckStorage(PptxGenJS, !!r.data.hist);
    const blob = await rep.pres.write({ outputType: 'blob' });
    $('#toast').classList.remove('show');
    await deliverFile(blob, rep.file, PPTX_MIME, 'Open it with PowerPoint (or Google Slides / Keynote). On Android it is saved in Downloads.');
  } catch (e) { console.error(e); toast('Could not build the presentation: ' + e.message, 6000); }
}
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';   // cached by sw.js for offline use
let pptxLoading = null;
function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  return pptxLoading ||= new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = PPTX_CDN; sc.crossOrigin = 'anonymous';
    sc.onload = () => window.PptxGenJS ? res(window.PptxGenJS) : rej(new Error('PowerPoint library not available'));
    sc.onerror = () => { pptxLoading = null; rej(new Error('could not load the PowerPoint library – connect to the internet once and try again')); };
    document.head.appendChild(sc);
  });
}

/* ---- deck style (edit here to match another template) ---- */
const PT = {
  font: 'Calibri', dark: '0B3B3A', primary: '0F766E', accent: '14B8A6', soft: 'E6F4F2', text: '1F2933', muted: '667085', line: 'D5DEE4',
  ok: '2E9D5B', okSoft: 'E1F4E8', low: 'E0B100', lowSoft: 'FFF3C4', failed: 'D64545', failedSoft: 'FDE2E2', white: 'FFFFFF', zebra: 'F7FAFA',
};
const ST_FILL = { ok: [PT.okSoft, PT.ok], low: [PT.lowSoft, PT.low], failed: [PT.failedSoft, PT.failed] };
const clip = (s, n = 90) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const chunk = (a, n) => { const out = []; for (let k = 0; k < a.length; k += n) out.push(a.slice(k, k + n)); return out.length ? out : [[]]; };
const um = s => String(s ?? '').replace(/<[^>]+>/g, '');   // strip any html

function newDeck(PptxGenJS, docName) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';                 // 10 × 5.625 in
  pres.author = 'LabTrack'; pres.company = 'LabTrack'; pres.title = docName;
  pres.theme = { headFontFace: PT.font, bodyFontFace: PT.font };
  const foot = um(docName).replace(/&/g, 'and');
  pres.defineSlideMaster({
    title: 'LT_TITLE', background: { color: PT.dark },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.55, w: 8.8, h: 1.25, fontFace: PT.font, fontSize: 36, bold: true, color: PT.white, align: 'left', valign: 'bottom', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 2.95, w: 8.8, h: 1.6, fontFace: PT.font, fontSize: 16, color: 'CFE9E5', align: 'left', valign: 'top', margin: 0 }, text: '' } },
      { text: { text: 'LabTrack report', options: { x: 0.6, y: 5.0, w: 5, h: 0.3, fontFace: PT.font, fontSize: 10, color: '8FC9C1', margin: 0 } } },
    ],
  });
  pres.defineSlideMaster({
    title: 'LT_SECTION', background: { color: PT.primary },
    objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 2.1, w: 8.8, h: 1.0, fontFace: PT.font, fontSize: 32, bold: true, color: PT.white, valign: 'middle', margin: 0 }, text: '' } }],
  });
  pres.defineSlideMaster({
    title: 'LT_CONTENT', background: { color: PT.white }, margin: [0.5, 0.5, 0.45, 0.5],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.25, w: 9, h: 0.6, fontFace: PT.font, fontSize: 24, bold: true, color: PT.primary, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
      { text: { text: clip(foot, 80), options: { x: 0.5, y: 5.27, w: 7.5, h: 0.25, fontFace: PT.font, fontSize: 9, color: PT.muted, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.27, w: 0.5, h: 0.25, fontFace: PT.font, fontSize: 9, color: PT.muted, align: 'right' },
  });
  return pres;
}
function sTitle(pres, sec, title, sub) {
  const s = pres.addSlide({ masterName: 'LT_TITLE', sectionTitle: sec });
  s.addText(title, { placeholder: 'title' });
  if (sub) s.addText(sub, { placeholder: 'body' });
  return s;
}
function sContent(pres, sec, title) {
  const s = pres.addSlide({ masterName: 'LT_CONTENT', sectionTitle: sec });
  s.addText(title, { placeholder: 'title' });
  return s;
}
function addSec(pres, title) { pres.addSection({ title }); return title; }
/* table: head = [{t, w, a}] widths in inches; rows = arrays of strings or {text, color, bold, fill} */
function pTable(slide, head, rows, { x = 0.5, y = 1.05, fontSize = 12, rowH = 0.32, foot } = {}) {
  const cell = (c, i, extra = {}) => {
    const o = typeof c === 'object' && c !== null ? c : { text: c };
    return { text: um(o.text ?? ''), options: { fontFace: PT.font, fontSize, color: o.color || PT.text, bold: !!o.bold, align: head[i]?.a || 'left', valign: 'middle', fill: { color: o.fill || extra.fill || PT.white }, margin: [0.03, 0.06, 0.03, 0.06] } };
  };
  const data = [
    head.map((h, i) => ({ text: h.t, options: { fontFace: PT.font, fontSize, bold: true, color: PT.white, fill: { color: PT.primary }, align: h.a || 'left', valign: 'middle', margin: [0.03, 0.06, 0.03, 0.06] } })),
    ...rows.map((r, k) => r.map((c, i) => cell(c, i, { fill: k % 2 ? PT.zebra : PT.white }))),
    ...(foot ? [foot.map((c, i) => { const o = cell(c, i, { fill: PT.soft }); o.options.bold = true; return o; })] : []),
  ];
  slide.addTable(data, { x, y, w: head.reduce((t, h) => t + h.w, 0), colW: head.map(h => h.w), rowH, border: { type: 'solid', pt: 0.75, color: PT.line } });
}
/* paginated table over several slides */
function pTablePages(pres, sec, title, head, rows, opts = {}) {
  const per = opts.per || 11;
  const pages = chunk(rows, per);
  pages.forEach((pg, k) => {
    const s = sContent(pres, sec, title + (pages.length > 1 ? ` (${k + 1}/${pages.length})` : ''));
    if (!pg.length) s.addText(opts.empty || 'Nothing recorded.', { x: 0.5, y: 1.1, w: 9, h: 0.4, fontFace: PT.font, fontSize: 14, color: PT.muted, isTextBox: true, margin: 0 });
    else pTable(s, head, pg, { ...opts, foot: k === pages.length - 1 ? opts.foot : null });
  });
}
function pStat(slide, x, y, w, value, label, color = PT.primary) {
  slide.addShape('roundRect', { x, y, w, h: 1.05, rectRadius: 0.08, fill: { color: PT.soft }, line: { color: PT.soft } });
  slide.addText(String(value), { x: x + 0.1, y: y + 0.08, w: w - 0.2, h: 0.55, fontFace: PT.font, fontSize: 26, bold: true, color, align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
  slide.addText(label, { x: x + 0.1, y: y + 0.63, w: w - 0.2, h: 0.32, fontFace: PT.font, fontSize: 11, color: PT.muted, align: 'center', valign: 'top', isTextBox: true, margin: 0 });
}
function pKV(slide, rows, { x = 0.5, y = 1.05, w = 9, kw = 2.6, fontSize = 12, rowH = 0.3 } = {}) {
  const data = rows.filter(r => r && r[1] !== undefined && r[1] !== null && um(r[1]) !== '').map(([k, v]) => [
    { text: um(k), options: { fontFace: PT.font, fontSize, bold: true, color: PT.text, fill: { color: PT.soft }, valign: 'middle', margin: [0.03, 0.08, 0.03, 0.08] } },
    { text: clip(um(v), 260), options: { fontFace: PT.font, fontSize, color: PT.text, fill: { color: PT.white }, valign: 'middle', margin: [0.03, 0.08, 0.03, 0.08] } },
  ]);
  if (data.length) slide.addTable(data, { x, y, w, colW: [kw, w - kw], rowH, border: { type: 'solid', pt: 0.75, color: PT.line } });
  return data.length;
}
/* square (or given aspect) JPEG thumbnail of a photo, centre-cropped to fill the frame */
async function photoThumb(blob, aspect = 1, size = 640) {
  const bmp = await createImageBitmap(blob);
  const tw = aspect >= 1 ? size : Math.round(size * aspect), th = aspect >= 1 ? Math.round(size / aspect) : size;
  const k = Math.max(tw / bmp.width, th / bmp.height), sw = tw / k, sh = th / k;
  const c = document.createElement('canvas'); c.width = tw; c.height = th;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, tw, th);
  bmp.close && bmp.close();
  const d = c.toDataURL('image/jpeg', 0.85);
  return d.replace(/^data:/, '');
}
function pPhoto(slide, data, x, y, w, h, frame, caption) {
  if (data) slide.addImage({ data, x, y, w, h, rounding: false });
  else slide.addShape('rect', { x, y, w, h, fill: { color: 'F2F4F7' }, line: { color: PT.line, dashType: 'dash' } });
  slide.addShape('rect', { x, y, w, h, fill: { color: PT.white, transparency: 100 }, line: { color: frame || PT.line, width: data ? 2.25 : 0.75 } });
  if (!data) slide.addText('no photo', { x, y: y + h / 2 - 0.15, w, h: 0.3, fontFace: PT.font, fontSize: 10, color: PT.muted, align: 'center', isTextBox: true, margin: 0 });
  if (caption) slide.addText(caption, { x, y: y + h + 0.03, w, h: 0.26, fontFace: PT.font, fontSize: 10, color: PT.text, align: 'left', isTextBox: true, margin: 0, fit: 'shrink' });
}
function pLegend(slide, y = 4.9) {
  [['ok', 'OK'], ['low', 'Low-density'], ['failed', 'Failed']].forEach(([k, l], j) => {
    const x = 0.5 + j * 1.7;
    slide.addShape('roundRect', { x, y: y + 0.04, w: 0.28, h: 0.2, rectRadius: 0.04, fill: { color: ST_FILL[k][0] }, line: { color: ST_FILL[k][1], width: 1.5 } });
    slide.addText(l, { x: x + 0.36, y, w: 1.3, h: 0.28, fontFace: PT.font, fontSize: 11, color: PT.text, valign: 'middle', isTextBox: true, margin: 0 });
  });
}

/* ---------------- experiment deck ---------------- */
async function deckExperiment(PptxGenJS, id, withPhotos) {
  const e = await get('experiments', id);
  const [chips, photos, movs, items] = await Promise.all([all('chips', 'expId', id), all('photos', 'expId', id), all('movements', 'expId', id), all('items')]);
  chips.sort((a, b) => a.idx - b.idx);
  await ensureExpShape(e, chips);
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const allCh = chips.flatMap(c => c.chambers);
  const cnt = s => allCh.filter(c => c.status === s).length;
  const cc = cellTotal(e.cellCount), copd = e.model === COPD_MODEL;
  const name = `Experiment ${expNum(e)}${e.title ? ' – ' + e.title : ''}`;
  const pres = newDeck(PptxGenJS, name);

  let sec = addSec(pres, 'Overview');
  sTitle(pres, sec, name, [e.model || 'No model', e.status, e.seedingDate ? 'Seeded ' + fmtDate(e.seedingDate) : '', 'Report ' + fmtDate(todayISO())].filter(Boolean).join('  ·  '));
  let s = sContent(pres, sec, 'Experiment at a glance');
  const day = e.seedingDate ? dayOf(e.seedingDate, todayISO()) : null;
  [[e.status === 'Finished' ? '–' : (day ?? '–'), 'Day'], [chips.length, 'Chips seeded'], [allCh.length, 'Chambers'], [cnt('failed'), 'Failed', cnt('failed') ? PT.failed : PT.primary]]
    .forEach(([v, l, col], k) => pStat(s, 0.5 + k * 2.3, 1.05, 2.1, v, l, col));
  pKV(s, [
    ['Model', e.model], ['Status', e.status], ['Seeding date', fmtDate(e.seedingDate)], ['Protocol', e.protocol],
    ['Chambers', `${cnt('ok')} OK · ${cnt('low')} low-density · ${cnt('failed')} failed`],
    ['Cell count', cc ? `${fmtSci(cc.total, true)} cells  (avg of ${e.cellCount.counts.map(fmtN).join(', ')} = ${fmtN(cc.avg)} × dilution ${fmtN(cc.dil)} × 10⁴)` : (e.cellsHarvested || '')],
    ['Notes', clip(e.notes, 250)],
  ], { y: 2.35, rowH: 0.34 });

  // chip map (8 chips per slide)
  if (chips.length) {
    chunk(chips, 8).forEach((grp, k, arr) => {
      const sl = sContent(pres, sec, 'Chip map' + (arr.length > 1 ? ` (${k + 1}/${arr.length})` : ''));
      grp.forEach((c, j) => {
        const x = 0.5 + (j % 4) * 2.3, y = 1.05 + Math.floor(j / 4) * 1.9, w = 2.1, h = 1.75;
        sl.addShape('roundRect', { x, y, w, h, rectRadius: 0.12, fill: { color: 'F4F7F8' }, line: { color: PT.line, width: 1 } });
        sl.addText([{ text: 'Chip ' + c.letter, options: { bold: true, color: PT.primary } }, { text: '  ' + clip(chipMixed(c) ? 'mixed conditions' : (condName(e, c) || 'no condition'), 22), options: { color: PT.muted } }],
          { x: x + 0.1, y: y + 0.06, w: w - 0.2, h: 0.3, fontFace: PT.font, fontSize: 11, isTextBox: true, margin: 0, valign: 'middle' });
        c.chambers.forEach((ch, i) => {
          const cx = x + 0.12 + i * 0.64, cy = y + 0.42, cw = 0.58, chh = 1.22, [fill, line] = ST_FILL[ch.status];
          sl.addShape('roundRect', { x: cx, y: cy, w: cw, h: chh, rectRadius: 0.1, fill: { color: fill }, line: { color: line, width: 1.75 } });
          sl.addText([{ text: c.letter + (i + 1), options: { bold: true, fontSize: 12, color: PT.text, breakLine: true } },
            { text: clip(chCondName(e, c, i) || '–', 18), options: { fontSize: 8, color: PT.muted } }],
            { x: cx + 0.02, y: cy + 0.05, w: cw - 0.04, h: chh - 0.1, fontFace: PT.font, align: 'center', valign: 'middle', isTextBox: true, margin: 0, fit: 'shrink' });
        });
      });
      pLegend(sl);
    });
  }

  // conditions & drugs
  sec = addSec(pres, 'Conditions');
  const condRows = e.conditions.map(c => [{ text: c.name, bold: true }, ...(copd ? [c.cse ? 'Yes' : 'No', (c.drugIds || []).map(d => e.drugs.find(x => x.id === d)?.name || '').filter(Boolean).join(', ') || '–'] : []),
    chips.flatMap(x => [0, 1, 2].filter(i => chCondId(x, i) === c.id).map(i => x.letter + (i + 1))).join(', ') || '–']);
  pTablePages(pres, sec, 'Conditions', copd ? [{ t: 'Condition', w: 2.3 }, { t: 'CSE', w: 0.8 }, { t: 'Drugs', w: 2.4 }, { t: 'Chambers', w: 3.5 }] : [{ t: 'Condition', w: 3 }, { t: 'Chambers', w: 6 }],
    condRows, { per: 10, empty: 'No conditions defined.' });
  if (e.drugs.length) pTablePages(pres, sec, 'Drugs', [{ t: 'Drug', w: 2.5 }, { t: 'Dilution', w: 4.5 }, { t: 'Per mL of medium', w: 2, a: 'right' }],
    e.drugs.map(d => { const f = drugFraction(d); return [{ text: d.name, bold: true }, d.mode === 'conc' ? `${d.stock} ${d.stockUnit} → ${d.final} ${d.finalUnit} (1:${f ? fmtN(1 / f) : '?'})` : `1:${d.ratio}`, f ? fmtUL(f * 1000) : '–']; }), { per: 10 });

  // chambers
  sec = addSec(pres, 'Chambers');
  const chRows = chips.flatMap(c => c.chambers.map((ch, i) => [
    { text: c.letter + (i + 1), bold: true }, clip(chCondName(e, c, i), 26),
    { text: CH_STATUS[ch.status], bold: true, color: ST_FILL[ch.status][1] },
    ch.status === 'failed' ? clip(`${ch.failReason || ''}${ch.failDay != null && ch.failDay !== '' ? ' · day ' + ch.failDay : ''}${ch.failNote ? ' · ' + ch.failNote : ''}`, 40) : '',
    clip(ch.notes, 70), String(photos.filter(p => p.chipId === c.id && p.chamber === i + 1).length),
  ]));
  pTablePages(pres, sec, 'Chamber details', [{ t: 'Chamber', w: 0.9 }, { t: 'Condition', w: 1.9 }, { t: 'Status', w: 1.2 }, { t: 'Failure', w: 1.9 }, { t: 'Notes', w: 2.4 }, { t: 'Photos', w: 0.7, a: 'right' }],
    chRows, { per: 12, rowH: 0.3, fontSize: 11, empty: 'No chips yet.' });

  // medium changes
  if (e.mediumChanges.length) {
    sec = addSec(pres, 'Medium changes');
    for (const m of [...e.mediumChanges].sort((a, b) => a.date.localeCompare(b.date))) {
      const sl = sContent(pres, sec, `Medium change – ${m.day != null ? 'Day ' + m.day + ' · ' : ''}${fmtDate(m.date)}`);
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      pStat(sl, 0.5, 1.05, 1.9, m.absorbance != null ? fmtN(m.absorbance) : '–', 'Absorbance');
      pStat(sl, 0.5, 2.25, 1.9, m.cseFraction ? fmtN(m.cseFraction * 100) + ' %' : '–', 'CSE fraction (0.07/abs)');
      const info = [
        m.cseReadings ? `CSE: ${m.cseReadings.map(fmtN).join(', ')}${m.cseReadings.length > 1 ? ' (avg ' + fmtN(avg(m.cseReadings)) + ')' : ''}` : '',
        m.blankReadings ? `Blank: ${m.blankReadings.map(fmtN).join(', ')}${m.blankReadings.length > 1 ? ' (avg ' + fmtN(avg(m.blankReadings)) + ')' : ''}` : '',
        `Volume per chip: ${fmtN(m.volPerChip)} mL`, m.notes ? clip(m.notes, 90) : '',
      ].filter(Boolean);
      sl.addText(info.map((t, k) => ({ text: t, options: { breakLine: k < info.length - 1 } })), { x: 0.5, y: 3.45, w: 1.9, h: 1.6, fontFace: PT.font, fontSize: 10, color: PT.text, valign: 'top', isTextBox: true, margin: 0, fit: 'shrink' });
      const tot = { total: 0, cse: 0, medium: 0 }; (m.rows || []).forEach(r => { tot.total += r.total || 0; tot.cse += r.cse || 0; tot.medium += r.medium || 0; });
      const unit = m.countUnit === 'chamber' ? 'Chambers' : 'Chips';
      const rows = (m.rows || []).map(r => [{ text: r.name, bold: true }, String(r.n), fmtUL(r.total), r.cse ? fmtUL(r.cse) : '–', (r.drugs || []).map(d => `${d.name} ${fmtUL(d.vol)}`).join('\n') || '–', { text: fmtUL(r.medium), bold: true }]);
      pTable(sl, [{ t: 'Condition', w: 1.5 }, { t: unit, w: 0.85, a: 'right' }, { t: 'Total', w: 0.85, a: 'right' }, { t: 'CSE', w: 0.8, a: 'right' }, { t: 'Drugs', w: 1.3 }, { t: 'Base medium', w: 1.0, a: 'right' }],
        rows.slice(0, 9), { x: 2.65, y: 1.05, fontSize: 10.5, rowH: 0.28, foot: ['Total', '', fmtUL(tot.total), fmtUL(tot.cse), '', fmtUL(tot.medium)] });
      const k = (m.baseMediumMl || 0) * 1000 / BASE_MEDIUM_TOTAL;
      const extraLines = (m.rows || []).slice(0, 9).reduce((t, r) => t + Math.max(0, (r.drugs || []).length - 1), 0);
      const yb = 1.05 + 0.28 * (Math.min(rows.length, 9) + 2) + 0.2 * extraLines + 0.3;
      if (yb < 4.3) pTable(sl, [{ t: `Base medium · ${m.baseMediumMl} mL`, w: 2.3 }, { t: 'per 10 mL', w: 2.0, a: 'right' }, { t: `for ${m.baseMediumMl} mL`, w: 2.0, a: 'right' }],
        BASE_MEDIUM.map(([n, v]) => [n, fmtUL(v), { text: fmtUL(v * k), bold: true }]), { x: 2.65, y: yb, fontSize: 9.5, rowH: 0.22 });
      else {
        const sl2 = sContent(pres, sec, `Base medium – ${fmtDate(m.date)}`);
        pTable(sl2, [{ t: 'Component', w: 3 }, { t: 'per 10 mL', w: 2, a: 'right' }, { t: `for ${m.baseMediumMl} mL`, w: 2, a: 'right' }], BASE_MEDIUM.map(([n, v]) => [n, fmtUL(v), { text: fmtUL(v * k), bold: true }]));
      }
    }
  }

  // stainings
  if (e.stainings.length) {
    sec = addSec(pres, 'Stainings');
    for (const st of [...e.stainings].sort((a, b) => a.date.localeCompare(b.date))) {
      const V = st.totalVolume ?? st.nChambers * st.volPerChamber * (1 + (st.extraPct || 0) / 100);
      const sl = sContent(pres, sec, `${clip(st.title || 'Staining', 40)} – ${st.day != null ? 'Day ' + st.day + ' · ' : ''}${fmtDate(st.date)}`);
      sl.addText(`${st.nChambers} chambers × ${fmtN(st.volPerChamber)} µL${st.extraPct ? ' + ' + fmtN(st.extraPct) + ' %' : ''} = ${fmtUL(V)} per solution${st.deducted ? '  ·  antibodies deducted from storage' : ''}`,
        { x: 0.5, y: 0.9, w: 9, h: 0.3, fontFace: PT.font, fontSize: 12, color: PT.muted, isTextBox: true, margin: 0 });
      const abList = abs => (abs || []).filter(a => a.itemId);
      const abRowsP = abs => { const l = abList(abs), gs = V * 0.005, sum = l.reduce((t, a) => t + (a.vol ?? V / a.dilution), 0);
        return [['Goat Serum 0.5 %', fmtUL(gs)], ...l.map((a, i) => [`#${i + 1} ${clip(a.name, 22)} 1:${a.dilution}`, fmtUL(a.vol ?? V / a.dilution)]), ['PBS (rest)', fmtUL(V - gs - sum)]]; };
      const cols = [
        ['Permeabilization & blocking', [['Goat Serum 5 %', fmtUL(V * 0.05)], ['Tween-20 0.1 %', fmtUL(V * 0.001)], ['PBS (rest)', fmtUL(V * 0.949)]]],
        ['Primary antibodies', abRowsP(st.primary)], ['Secondary antibodies', abRowsP(st.secondary)],
      ];
      cols.forEach(([t, rows], k) => pTable(sl, [{ t, w: 2.05 }, { t: 'µL', w: 0.85, a: 'right' }], rows, { x: 0.5 + k * 3.05, y: 1.3, fontSize: 10, rowH: 0.27, foot: ['Total', fmtUL(V)] }));
      const img = WAVELENGTHS.map(w => [{ text: w + ' nm', bold: true }, clip(st.imaging?.[w]?.marker, 30) || '–', st.imaging?.[w]?.laser !== '' && st.imaging?.[w]?.laser != null ? st.imaging[w].laser + ' %' : '–', st.imaging?.[w]?.exposure !== '' && st.imaging?.[w]?.exposure != null ? st.imaging[w].exposure + ' ms' : '–']);
      pTable(sl, [{ t: 'Imaging', w: 1.4 }, { t: 'Marker', w: 3.8 }, { t: 'Laser', w: 1.9, a: 'right' }, { t: 'Exposure', w: 1.9, a: 'right' }], img, { x: 0.5, y: 3.35, fontSize: 10.5, rowH: 0.27 });
      if (st.notes) sl.addText('Notes: ' + clip(st.notes, 160), { x: 0.5, y: 4.85, w: 9, h: 0.35, fontFace: PT.font, fontSize: 10, color: PT.muted, isTextBox: true, margin: 0, fit: 'shrink' });
    }
  }

  // consumables
  sec = addSec(pres, 'Consumables');
  pTablePages(pres, sec, 'Consumables used', [{ t: 'Date', w: 1.9 }, { t: 'Item', w: 3.2 }, { t: 'Quantity', w: 1.4, a: 'right' }, { t: 'Note', w: 2.5 }],
    movs.sort((a, b) => a.date.localeCompare(b.date)).map(m => [fmtDateTime(m.date), clip(itemMap[m.itemId]?.name || 'deleted item', 40), `${fmtQty(-m.delta)} ${itemMap[m.itemId]?.unit || ''}`, clip(m.note, 40)]),
    { per: 12, empty: 'No consumables linked to this experiment.' });

  // photos: one slide per day and per 4 chips (rows = chambers 1-3)
  if (withPhotos && photos.length) {
    sec = addSec(pres, 'Photos');
    const days = [...new Set(photos.map(p => p.day))].sort((a, b) => a - b);
    for (const d of days) {
      const withP = chips.filter(c => photos.some(p => p.day === d && p.chipId === c.id));
      for (const [k, grp] of chunk(withP, 4).entries()) {
        const pages = Math.ceil(withP.length / 4);
        const sl = sContent(pres, sec, `Day ${d}${e.seedingDate ? ' · ' + fmtDate(dateForDay(e.seedingDate, d)) : ''}${pages > 1 ? ` (${k + 1}/${pages})` : ''}`);
        const size = 1.18;
        for (const [j, c] of grp.entries()) {
          const x = 0.5 + j * 2.3;
          for (let n = 1; n <= 3; n++) {
            const p = photos.find(q => q.day === d && q.chipId === c.id && q.chamber === n), stt = c.chambers[n - 1].status;
            const y = 0.95 + (n - 1) * 1.45;
            pPhoto(sl, p ? await photoThumb(photoBlob(p)) : null, x, y, size, size, ST_FILL[stt][1]);
            sl.addText([{ text: c.letter + n, options: { bold: true, breakLine: true, fontSize: 12 } }, { text: clip(chCondName(e, c, n - 1), 24), options: { fontSize: 9, color: PT.muted, breakLine: true } },
              { text: CH_STATUS[stt], options: { fontSize: 9, color: ST_FILL[stt][1], bold: true } }],
              { x: x + size + 0.07, y, w: 2.3 - size - 0.15, h: size, fontFace: PT.font, color: PT.text, valign: 'top', isTextBox: true, margin: 0, fit: 'shrink' });
          }
        }
      }
    }
  }
  return { pres, file: `LabTrack_Report_Exp${pad2(e.number)}${e.title ? '_' + slug(e.title) : ''}_${todayISO()}.pptx` };
}

/* ---------------- cell expansion deck ---------------- */
async function deckExpansion(PptxGenJS, id, withPhotos) {
  const x = await get('expansions', id), photos = await all('photos', 'expId', id);
  const st = expansionStats(x), area = st.area;
  const name = `Cell expansion #${pad2(x.number)} – ${x.cellType || ''}`;
  const pres = newDeck(PptxGenJS, name);
  let sec = addSec(pres, 'Overview');
  sTitle(pres, sec, name, [x.lot ? 'Lot ' + x.lot : '', x.status, 'Started ' + fmtDT(x.passages[0].start), 'Report ' + fmtDate(todayISO())].filter(Boolean).join('  ·  '));
  let s = sContent(pres, sec, 'Expansion at a glance');
  [[pLabel(curPassage(x)), x.status === 'Finished' ? 'Last passage' : 'Current passage'], [st.splits ? fmtN(st.cpd) : '–', 'Cumulative PD (raw)'],
   [st.dt ? Math.round(st.dt) + ' h' : '–', 'Mean DT raw'], [st.dtC ? Math.round(st.dtC) + ' h' : '–', 'Mean DT corrected']]
    .forEach(([v, l], k) => pStat(s, 0.5 + k * 2.3, 1.05, 2.1, v, l));
  pKV(s, [
    ['Cell type · lot', `${x.cellType}${x.lot ? ' · ' + x.lot : ''}`], ['Cells in vial', fmtCells(x.vialCells)],
    ['Seeding efficiency · viability', `${fmtN(x.seedingEff)} % · ${fmtN(x.viability)} %`], ['Flask type', `${x.flaskType}${area ? ` (${area} cm²)` : ''}`],
    ['Totals', `harvested ${fmtCells(st.tot.harvested)} · frozen ${fmtCells(st.tot.frozen)} · used ${fmtCells(st.tot.used)} · discarded ${fmtCells(st.tot.discarded)}`],
    ['Theoretical yield', st.splits ? fmtCells(st.yieldT) + ' (if all cells had been kept)' : ''], ['Notes', clip(x.notes, 200)],
  ], { y: 2.35, rowH: 0.34 });

  const done = st.rows.filter(r => r.p.split);
  if (done.length) {
    sec = addSec(pres, 'Growth');
    s = sContent(pres, sec, 'Growth across passages');
    const labels = done.map(r => pLabel(r.p));
    const axis = { catAxisLabelColor: PT.muted, valAxisLabelColor: PT.muted, catAxisLabelFontFace: PT.font, valAxisLabelFontFace: PT.font, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
      valGridLine: { color: 'E5EAEE', size: 0.75 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontFace: PT.font, legendFontSize: 11,
      titleFontFace: PT.font, titleFontSize: 13, titleColor: PT.text, dataLabelFontFace: PT.font, dataLabelFontSize: 9, dataLabelColor: PT.text };
    s.addChart(pres.ChartType.line, [{ name: 'Raw', labels, values: done.map(r => +r.cpd.toFixed(2)) }, { name: 'Corrected', labels, values: done.map(r => +r.cpdC.toFixed(2)) }],
      { x: 0.5, y: 1.0, w: 4.4, h: 4.1, showTitle: true, title: 'Cumulative population doublings', chartColors: [PT.primary, PT.low], lineSize: 2.5, lineDataSymbolSize: 8,
        showValue: true, dataLabelPosition: 't', dataLabelFormatCode: '0.0', ...axis });
    s.addChart(pres.ChartType.bar, [{ name: 'Raw', labels, values: done.map(r => r.dt ? +r.dt.toFixed(1) : 0) }, { name: 'Corrected', labels, values: done.map(r => r.dtC ? +r.dtC.toFixed(1) : 0) }],
      { x: 5.1, y: 1.0, w: 4.4, h: 4.1, barDir: 'col', barGrouping: 'clustered', showTitle: true, title: 'Doubling time per passage (h)', chartColors: [PT.primary, PT.low],
        showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0', ...axis });
  }

  sec = addSec(pres, 'Passages');
  pTablePages(pres, sec, 'Passage summary',
    [{ t: 'Passage', w: 0.8 }, { t: 'Seeded', w: 1.45 }, { t: 'Harvested', w: 1.45 }, { t: 'Flasks', w: 0.6, a: 'right' }, { t: 'N₀', w: 0.95, a: 'right' }, { t: 'N', w: 0.95, a: 'right' },
     { t: 'Time', w: 0.65, a: 'right' }, { t: 'PD raw/corr', w: 1.05, a: 'right' }, { t: 'DT raw/corr', w: 1.1, a: 'right' }],
    st.rows.map(r => [{ text: pLabel(r.p), bold: true }, fmtDT(r.p.start), r.p.split ? fmtDT(r.p.split.date) : 'running', String(r.nFlasks), fmtCells(r.N0),
      r.p.split ? fmtCells(r.p.split.harvested) : '–', r.p.split ? Math.round(r.h) + ' h' : '–', r.p.split ? `${fmtN(r.pd)} / ${fmtN(r.pdC)}` : '–',
      r.p.split ? `${r.dt ? Math.round(r.dt) : '–'} / ${r.dtC ? Math.round(r.dtC) : '–'} h` : '–']), { per: 10, fontSize: 10.5 });
  for (const r of st.rows) {
    const sp = r.p.split;
    const sl = sContent(pres, sec, `${pLabel(r.p)} · ${fmtDT(r.p.start)} → ${sp ? fmtDT(sp.date) : 'running'}`);
    pTable(sl, [{ t: 'Parameter', w: 2.4 }, { t: 'Raw', w: 1.5, a: 'right' }, { t: 'Corrected', w: 1.5, a: 'right' }], [
      ['Cells seeded (N₀)', fmtCells(r.N0), fmtCells(r.N0c)],
      ...(r.seedDens != null ? [['Seeding density /cm²', fmtCells(r.seedDens), fmtCells(r.N0c / (r.nFlasks * area))]] : []),
      ['Time in culture', fmtDur(r.h), ''],
      ...(sp ? [['Cells harvested (N)', fmtCells(sp.harvested), ''], ...(r.harvDens != null ? [['Harvest density /cm²', fmtCells(r.harvDens), '']] : []),
        ['Fold expansion', fmtN(r.fold) + '×', fmtN(r.foldC) + '×'], ['Population doublings', fmtN(r.pd), fmtN(r.pdC)],
        [{ text: 'Doubling time', bold: true }, { text: fmtH(r.dt), bold: true }, { text: fmtH(r.dtC), bold: true }],
        ['Growth rate μ (/day)', r.mu != null ? fmtN(r.mu) : '–', r.muC != null ? fmtN(r.muC) : '–'], ['Cumulative PD', fmtN(r.cpd), fmtN(r.cpdC)]] : []),
    ], { x: 0.5, y: 1.05, fontSize: 11, rowH: 0.3 });
    pTable(sl, [{ t: 'Flask', w: 0.9 }, { t: 'Seeded', w: 1.3, a: 'right' }, { t: 'Photos', w: 0.9, a: 'right' }],
      r.p.flasks.slice(0, 7).map(f => [{ text: f.name, bold: true }, fmtCells(f.seeded), String(photos.filter(q => q.chipId === f.id).length)]), { x: 6.4, y: 1.05, fontSize: 11, rowH: 0.3 });
    if (sp) pKV(sl, [['Frozen', fmtCells(sp.frozen)], ['Used', fmtCells(sp.used)], ['Thrown away', fmtCells(sp.discarded)], ['Viability at harvest', sp.viability ? fmtN(sp.viability) + ' %' : ''], ['Notes', clip(sp.notes, 60)]],
      { x: 6.4, y: 1.05 + 0.3 * (Math.min(r.p.flasks.length, 7) + 1) + 0.25, w: 3.1, kw: 1.4, fontSize: 10.5, rowH: 0.27 });
  }
  if (st.splits) {
    const sl = sContent(pres, sec, 'How the values are calculated');
    sl.addText([
      { text: 'Population doublings (PD) = log₂(N / N₀); doubling time = hours in culture / PD; growth rate μ = ln(N / N₀) / days.', options: { breakLine: true, bullet: true } },
      { text: 'Raw: N₀ = cells seeded in the flasks.', options: { breakLine: true, bullet: true } },
      { text: 'Corrected: N₀ × seeding efficiency × viability – vial viability for the first passage, viability at harvest of the previous split (if entered) for later passages.', options: { breakLine: true, bullet: true } },
      { text: 'Mean doubling time = total hours of completed passages / cumulative PD.', options: { bullet: true } },
    ], { x: 0.5, y: 1.1, w: 9, h: 3.5, fontFace: PT.font, fontSize: 15, color: PT.text, valign: 'top', isTextBox: true, paraSpaceAfter: 10 });
  }

  if (withPhotos && photos.length) {
    sec = addSec(pres, 'Photos');
    for (const p of x.passages) for (const f of p.flasks) {
      const ph = photos.filter(q => q.chipId === f.id).sort((a, b) => a.day - b.day);
      for (const [k, grp] of chunk(ph, 8).entries()) {
        if (!grp.length) continue;
        const pages = Math.ceil(ph.length / 8);
        const sl = sContent(pres, sec, `${pLabel(p)} · ${f.name}${pages > 1 ? ` (${k + 1}/${pages})` : ''}`);
        for (const [j, q] of grp.entries()) {
          const xx = 0.5 + (j % 4) * 2.3, yy = 1.0 + Math.floor(j / 4) * 2.1, sz = 1.75;
          pPhoto(sl, await photoThumb(photoBlob(q)), xx + 0.17, yy, sz, sz, PT.primary, `Day ${q.day} · ${fmtDate(q.date)}`);
        }
      }
    }
  }
  return { pres, file: `LabTrack_Report_Expansion${pad2(x.number)}_${slug(x.cellType)}_${todayISO()}.pptx` };
}

/* ---------------- storage deck ---------------- */
async function deckStorage(PptxGenJS, withHist) {
  const [items, movs, exps] = await Promise.all([all('items'), all('movements'), all('experiments')]);
  const expMap = Object.fromEntries(exps.map(e => [e.id, e])), itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const low = items.filter(isLow), expiring = items.filter(expiryState);
  const pres = newDeck(PptxGenJS, 'Storage inventory');
  let sec = addSec(pres, 'Overview');
  sTitle(pres, sec, 'Storage inventory', `${items.length} items  ·  ${fmtDate(todayISO())}`);
  const s = sContent(pres, sec, 'Alerts');
  const cats = new Set(items.map(i => i.category || 'Uncategorized'));
  [[items.length, 'Items'], [cats.size, 'Categories'], [low.length, 'Low stock', low.length ? PT.low : PT.primary], [expiring.length, 'Expiring / expired', expiring.length ? PT.failed : PT.primary]]
    .forEach(([v, l, c], k) => pStat(s, 0.5 + k * 2.3, 1.05, 2.1, v, l, c));
  const alerts = [...low.map(i => [{ text: i.name, bold: true }, { text: `Low stock (min ${fmtQty(i.minQty)})`, color: '7A5A00' }, `${fmtQty(i.quantity)} ${i.unit}`, i.location || '']),
    ...expiring.map(i => [{ text: i.name, bold: true }, { text: `${expiryState(i).txt} (${fmtDate(i.expiry)})`, color: PT.failed }, `${fmtQty(i.quantity)} ${i.unit}`, i.location || ''])];
  if (alerts.length) pTable(s, [{ t: 'Item', w: 3 }, { t: 'Alert', w: 2.8 }, { t: 'Quantity', w: 1.4, a: 'right' }, { t: 'Location', w: 1.8 }], alerts.slice(0, 7), { y: 2.35, fontSize: 11, rowH: 0.3 });
  else s.addText('No low-stock or expiring items.', { x: 0.5, y: 2.4, w: 9, h: 0.4, fontFace: PT.font, fontSize: 14, color: PT.muted, isTextBox: true, margin: 0 });
  if (alerts.length > 7) pTablePages(pres, sec, 'Alerts (continued)', [{ t: 'Item', w: 3 }, { t: 'Alert', w: 2.8 }, { t: 'Quantity', w: 1.4, a: 'right' }, { t: 'Location', w: 1.8 }], alerts.slice(7), { fontSize: 11, per: 12 });

  sec = addSec(pres, 'Inventory');
  const groups = Object.entries(groupBy(items.map(i => ({ ...i, _c: i.category || 'Uncategorized' })), '_c')).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [cat, its] of groups) {
    pTablePages(pres, sec, cat, [{ t: 'Item', w: 2.3 }, { t: 'Quantity', w: 1.1, a: 'right' }, { t: 'Min', w: 0.6, a: 'right' }, { t: 'Location', w: 1.4 }, { t: 'Lot', w: 1.0 }, { t: 'Expiry', w: 1.2 }, { t: 'Supplier / cat. #', w: 1.4 }],
      its.sort((a, b) => a.name.localeCompare(b.name)).map(i => [{ text: clip(i.name, 34), bold: true, fill: isLow(i) ? PT.lowSoft : undefined }, `${fmtQty(i.quantity)} ${i.unit}`, i.minQty === '' || i.minQty == null ? '' : fmtQty(i.minQty),
        clip(i.location, 18), clip(i.lot, 14), i.expiry ? { text: fmtDate(i.expiry), color: expiryState(i) ? PT.failed : PT.text, bold: !!expiryState(i) } : '', clip([i.supplier, i.catalog].filter(Boolean).join(' · '), 22)]),
      { per: 12, fontSize: 10.5, rowH: 0.3 });
  }
  if (withHist) {
    sec = addSec(pres, 'History');
    pTablePages(pres, sec, 'Movement history', [{ t: 'Date', w: 1.6 }, { t: 'Item', w: 2.4 }, { t: 'Type', w: 1.0 }, { t: 'Change', w: 0.9, a: 'right' }, { t: 'Balance', w: 1.1, a: 'right' }, { t: 'Experiment / note', w: 2.0 }],
      movs.sort((a, b) => b.date.localeCompare(a.date)).map(m => { const it = itemMap[m.itemId]; return [fmtDateTime(m.date), clip(it?.name || 'deleted item', 30),
        m.type === 'set' ? 'Stocktake' : m.type === 'initial' ? 'Initial' : m.delta >= 0 ? 'Added' : 'Removed',
        { text: `${m.delta >= 0 ? '+' : '−'}${fmtQty(Math.abs(m.delta))}`, color: m.delta >= 0 ? PT.ok : PT.failed, bold: true }, `${fmtQty(m.balance)} ${it?.unit || ''}`,
        clip([m.expId ? (expMap[m.expId] ? expNum(expMap[m.expId]) + ' ' + (expMap[m.expId].title || '') : 'deleted exp.') : '', m.note].filter(Boolean).join(' · '), 28)]; }),
      { per: 13, fontSize: 10, rowH: 0.28, empty: 'No movements.' });
  }
  return { pres, file: `LabTrack_Report_Storage_${todayISO()}.pptx` };
}

/* =========================================================
   SETTINGS
   ========================================================= */
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (location.hash.startsWith('#/settings')) route(); });
async function viewSettings() {
  setHeader('Settings');
  const [exps, photos, items, xs] = await Promise.all([all('experiments'), tx(['photos'], 'readonly', t => reqP(t.objectStore('photos').count())), all('items'), all('expansions')]);
  let est = null; try { est = await navigator.storage?.estimate(); } catch { }
  let persisted = false; try { persisted = await navigator.storage?.persisted(); } catch { }
  const standalone = matchMedia('(display-mode: standalone)').matches;
  main.innerHTML = `
  <div class="sec-head"><h2>Move data between devices</h2></div>
  <section class="card">
    <p class="muted" style="margin-top:0">Data is stored only on this device. To move an experiment or a cell expansion, open it and tap ${I.download} <b>Export</b>. For consumables use the storage export below. Then import the file on the other device.</p>
    <div class="cap-row"><button class="btn primary" id="imp">${I.upload} Import file</button></div>
    <div class="cap-row"><button class="btn" id="expSt">${I.download} Export storage (data file or report)</button></div>
  </section>
  <div class="sec-head"><h2>This device</h2></div>
  <section class="card">
    <div class="kv"><span>Experiments</span><b>${exps.length}</b></div>
    <div class="kv"><span>Cell expansions</span><b>${xs.length}</b></div>
    <div class="kv"><span>Photos</span><b>${photos}</b></div>
    <div class="kv"><span>Storage items</span><b>${items.length}</b></div>
    ${est ? `<div class="kv"><span>Space used</span><b>${fmtSize(est.usage || 0)}</b></div>` : ''}
    <div class="kv"><span>Protected from automatic cleanup</span><b>${persisted ? 'Yes' : 'No'}</b></div>
    ${persisted ? '' : `<div class="cap-row"><button class="btn" id="persist">Protect my data</button></div>`}
  </section>
  <div class="sec-head"><h2>App</h2></div>
  <section class="card">
    ${standalone ? '<div class="kv"><span>Installed</span><b>Yes</b></div>' : installEvt
      ? `<button class="btn primary big" id="install">Install LabTrack on this device</button>`
      : '<p class="muted" style="margin:0 0 8px">To install: in Chrome / Edge open the browser menu and choose <b>Install app</b> (Windows) or <b>Add to Home screen → Install</b> (Android).</p>'}
    <div class="kv"><span>Version</span><b>${APP_VERSION}</b></div>
    ${waitingSW ? `<button class="btn primary big" id="updSet">Install new version now</button>` : `<div class="cap-row"><button class="btn" id="chkUpd">Check for updates</button></div>`}
    <div class="kv"><span>Photo size</span><b>${PHOTO_MAX} px, JPEG</b></div>
  </section>`;
  $('#imp').onclick = importFromFile;
  $('#updSet') && ($('#updSet').onclick = applyUpdate);
  $('#chkUpd') && ($('#chkUpd').onclick = checkForUpdate);
  $('#expSt').onclick = () => exportMenu('storage');
  $('#persist') && ($('#persist').onclick = async () => {
    const ok = await navigator.storage?.persist?.();
    toast(ok ? 'Data protected' : 'The browser declined. Installing the app usually allows it.', 4000); rerender();
  });
  $('#install') && ($('#install').onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; rerender(); });
}

/* ---------------- app updates ---------------- */
let swReg = null, waitingSW = null, updateRequested = false;
function setupUpdates() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateRequested) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
    setInterval(() => reg.update().catch(() => { }), 30 * 60 * 1000);
  }).catch(e => console.warn('SW', e));
}
function showUpdateBar(w) {
  waitingSW = w;
  $('#toast').classList.remove('show');
  let bar = $('#updBar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'updBar';
    bar.innerHTML = `<span>A new version of LabTrack is available.</span><button class="btn primary" id="updNow">Update</button><button class="icon sm" id="updLater" title="Later">${I.close}</button>`;
    document.body.appendChild(bar);
    $('#updNow').onclick = applyUpdate;
    $('#updLater').onclick = () => bar.remove();
  }
  if (location.hash.startsWith('#/settings')) route();
}
function applyUpdate() {
  if (!waitingSW) return location.reload();
  updateRequested = true;
  $('#updNow') && ($('#updNow').textContent = 'Updating…');
  waitingSW.postMessage('SKIP_WAITING');
  setTimeout(() => location.reload(), 4000);   // fallback
}
async function checkForUpdate() {
  if (!swReg) { toast('Updates are not available here'); return; }
  toast('Checking for updates…', 5000);
  try { await swReg.update(); } catch { toast('Could not check – are you offline?', 3000); return; }
  setTimeout(() => { if (!waitingSW && !swReg.installing) toast(`You have the latest version (${APP_VERSION})`, 3000); }, 1500);
}

/* ---------------- start ---------------- */
(function init() {
  const tabs = $$('#tabs a');
  tabs[0].innerHTML = I.flask + '<span>Experiments</span>';
  tabs[1].innerHTML = I.box + '<span>Storage</span>';
  tabs[2].innerHTML = I.cells + '<span>Expansion</span>';
  tabs[3].innerHTML = I.gear + '<span>Settings</span>';
  setupUpdates();
  navigator.storage?.persist?.().catch(() => { });
  route();
})();
