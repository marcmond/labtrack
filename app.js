'use strict';
/* LabTrack – experiments, chip chambers, daily photos, consumables storage.
   All data is stored locally in IndexedDB on this device. */

const APP_VERSION = '1.5.0';
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
    const n = chips.filter(x => x.conditionId === c.id).length;
    return `<button class="used rowbtn" data-cond="${c.id}"><span><b>${esc(c.name)}</b>${copd ? ` <span class="muted">${esc(condDesc(e, c))}</span>` : ''}</span><span class="muted">${n} chip${n === 1 ? '' : 's'}</span></button>`;
  }).join('') : `<div class="muted">No conditions yet.${copd ? ' For COPD, define each condition with CSE and/or drugs – they drive the medium-change calculation.' : ''}</div>`}</div>

  ${copd ? `<div class="sec-head"><h2>Drugs</h2><button class="btn" id="addDrug">${I.plus} Drug</button></div>
  <div class="card">${e.drugs.length ? e.drugs.map(d => `<button class="used rowbtn" data-drug="${d.id}"><span><b>${esc(d.name)}</b></span><span class="muted">${esc(drugDesc(d))}</span></button>`).join('')
    : '<div class="muted">No drugs yet. Add each drug with its dilution (ratio 1:X, or stock → final concentration).</div>'}</div>

  <div class="sec-head"><h2>Medium changes</h2><a class="btn primary" href="#/exp/${id}/medium/new">${I.plus} New medium change</a></div>
  <div class="card">${mcs.length ? mcs.map(m => `<a class="used" href="#/exp/${id}/medium/${m.id}"><span><b>${m.day != null ? 'Day ' + m.day : ''}</b> ${fmtDate(m.date)}</span>
      <span class="muted">Abs ${m.absorbance ?? '–'} · CSE ${m.cseFraction ? fmtN(m.cseFraction * 100) + '%' : '–'}</span></a>`).join('')
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
      <span class="cond">${cn ? esc(cn) : '<span class="muted">No condition set</span>'}</span>
      <button class="icon sm" data-editchip="${c.id}" title="Edit chip">${I.edit}</button></div>
    <div class="chambers">${c.chambers.map((ch, i) => {
      const n = i + 1, p = latest[c.id + '_' + n];
      return `<a class="chamber st-${ch.status}" href="#/exp/${e.id}/chip/${c.id}/ch/${n}" title="${CH_STATUS[ch.status]}">
        ${p ? `<img src="${url(p.blob)}" alt="">` : I.camera}
        <span class="ch-label">${c.letter}${n}</span>
        ${p ? `<span class="ch-day">D${p.day}</span>` : ''}
        ${ch.notes ? '<span class="ch-note">✎</span>' : ''}
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
      <label>Condition<select name="cond">${condOptions(e, '')}</select></label>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add', value: 'ok', cls: 'primary' }],
    onMount: d => {
      const inp = $('[name=n]', d);
      const upd = () => { const n = Math.max(1, Math.min(52, +inp.value || 1)); $('#namesPrev', d).textContent = 'Will be named: ' + Array.from({ length: n }, (_, i) => letters(next + i)).join(', '); };
      inp.addEventListener('input', upd); upd();
      bindCondSelect($('[name=cond]', d), e);
    },
  });
  if (!r.ok) return;
  const n = Math.max(1, Math.min(52, +r.data.n || 1));
  const cond = e.conditions.find(c => c.id === r.data.cond);
  await tx(['chips', 'experiments'], 'readwrite', t => {
    for (let i = 0; i < n; i++) {
      t.objectStore('chips').put({ id: uid(), expId: e.id, idx: next + i, letter: letters(next + i), conditionId: cond?.id || null, condition: cond?.name || '', notes: '',
        chambers: [newChamber(), newChamber(), newChamber()], createdAt: now(), updatedAt: now() });
    }
    e.updatedAt = now(); t.objectStore('experiments').put(e);
  });
  toast(n === 1 ? `Chip ${letters(next)} added` : `${n} chips added`);
  rerender();
}
async function editChip(e, c) {
  const r = await dialog({
    title: `Chip ${c.letter}`,
    body: `<label>Condition<select name="cond">${condOptions(e, c.conditionId)}</select></label>
      <label>Notes<textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>`,
    actions: [{ label: 'Delete chip', value: 'delete', cls: 'danger', novalidate: true }, { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', cls: 'primary' }],
    onMount: d => bindCondSelect($('[name=cond]', d), e),
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
function condDesc(e, c) {
  const parts = [];
  if (c.cse) parts.push('CSE');
  for (const id of c.drugIds || []) { const d = e.drugs.find(x => x.id === id); if (d) parts.push(d.name); }
  return parts.length ? parts.join(' + ') : 'medium only';
}
function condOptions(e, cur) {
  return `<option value="">— none —</option>${e.conditions.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ New condition…</option>`;
}
function bindCondSelect(sel, e) {
  let prev = sel.value;
  sel.addEventListener('change', async () => {
    if (sel.value !== '__new') { prev = sel.value; return; }
    const c = await condDialog(e, null);
    if (!c) { sel.value = prev; return; }
    sel.insertBefore(new Option(c.name, c.id), sel.lastElementChild);
    sel.value = c.id; prev = c.id;
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
    const chips = (await all('chips', 'expId', e.id)).filter(x => x.conditionId === c.id);
    if (!await confirmDlg('Delete condition?', `${esc(c.name)} will be removed${chips.length ? ` and ${chips.length} chip(s) will have no condition` : ''}.`, 'Delete', 'danger')) return null;
    e.conditions = e.conditions.filter(x => x.id !== c.id);
    await tx(['experiments', 'chips'], 'readwrite', t => {
      e.updatedAt = now(); t.objectStore('experiments').put(e);
      chips.forEach(x => { x.conditionId = null; x.condition = ''; x.updatedAt = now(); t.objectStore('chips').put(x); });
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
  const activeChips = cid => chips.filter(c => c.conditionId === cid && c.chambers.some(ch => ch.status !== 'failed')).length;
  const st = mc || { date: todayISO(), absorbance: '', volPerChip: 1, counts: {}, notes: '' };
  const count = cid => st.counts?.[cid] ?? activeChips(cid);
  setHeader(isNew ? 'New medium change' : 'Medium change', { back: '#/exp/' + expId });
  main.innerHTML = `
  ${e.model !== COPD_MODEL ? '<div class="warn">This experiment is not set to the Lung-COPD model.</div>' : ''}
  ${!conds.length ? '<div class="warn">No conditions defined. Add conditions (with CSE / drugs) on the experiment page first.</div>' : ''}
  <form class="card" id="mform">
    <div class="grid2">
      <label>Date<input type="date" name="date" value="${esc(st.date)}" required></label>
      <label>CSE absorbance<input name="abs" type="number" step="any" min="0" inputmode="decimal" value="${esc(st.absorbance)}" placeholder="e.g. 0.85"></label>
      <label>Volume per chip (mL)<input name="vol" type="number" step="any" min="0" inputmode="decimal" value="${esc(st.volPerChip)}" required></label>
      <div id="csePrev" class="calcnote"></div>
    </div>
    ${conds.length ? `<div class="muted" style="font-size:13px;font-weight:600;margin:4px 0 6px">Chips per condition <span style="font-weight:400">(default: chips with at least one non-failed chamber)</span></div>
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
    const A = parseFloat(f.abs.value), V = (parseFloat(f.vol.value) || 0) * 1000;
    const cseF = A > 0 ? CSE_REF / A : null;
    const cseBad = cseF != null && cseF >= 1;
    const rows = conds.map(c => {
      const n = Math.max(0, parseInt(f['n_' + c.id]?.value) || 0), T = n * V;
      const cse = c.cse ? (cseF && !cseBad ? T * cseF : NaN) : 0;
      const drugs = (c.drugIds || []).map(id => e.drugs.find(d => d.id === id)).filter(Boolean)
        .map(d => { const fr = drugFraction(d); return { name: d.name, vol: fr ? T * fr : NaN }; });
      const medium = T - (cse || 0) - drugs.reduce((s, d) => s + (d.vol || 0), 0);
      return { condId: c.id, name: c.name, n, total: T, cse, drugs, medium };
    });
    return { date: f.date.value, A, V, cseF, cseBad, rows, notes: f.notes.value.trim(), needsCse: conds.some(c => c.cse) };
  };
  const render = () => {
    const r = calc();
    $('#csePrev').innerHTML = r.cseF ? (r.cseBad ? '<span style="color:var(--danger)">Absorbance must be above 0.07</span>'
      : `CSE fraction = 0.07 / ${fmtN(r.A)} = <b>${fmtN(r.cseF)}</b> (${fmtN(r.cseF * 100)}% · ${fmtUL(r.cseF * 1000)}/mL)`) : (r.needsCse ? 'Enter the absorbance to calculate CSE' : '');
    const tot = { total: 0, cse: 0, medium: 0, drugs: {} };
    r.rows.forEach(x => { tot.total += x.total; tot.cse += x.cse || 0; tot.medium += x.medium; x.drugs.forEach(d => { tot.drugs[d.name] = (tot.drugs[d.name] || 0) + (d.vol || 0); }); });
    const block = (title, sub, lines) => `<h3 class="subh">${title} <span class="muted" style="font-weight:400">${sub}</span></h3>
      <table class="calc"><tbody>${lines.map(([n, v, b]) => `<tr><td>${n}</td><td class="num">${b ? `<b>${fmtUL(v)}</b>` : fmtUL(v)}</td></tr>`).join('')}</tbody></table>`;
    $('#mres').innerHTML = r.rows.length ? r.rows.map(x => block(esc(x.name), `${x.n} chip${x.n === 1 ? '' : 's'} · ${fmtUL(x.total)}`, [
        ...(x.cse !== 0 ? [['CSE', x.cse, true]] : []),
        ...x.drugs.map(d => [esc(d.name), d.vol, true]),
        ['Base medium', x.medium, true],
      ])).join('') + block('Total', fmtUL(tot.total), [
        ['CSE', tot.cse], ...Object.entries(tot.drugs).map(([n, v]) => [esc(n), v]), ['Base medium', tot.medium],
      ]) + `<p class="muted calcnote">Per chip: ${fmtN(r.V / 1000)} mL. CSE and drugs from their dilution, the rest is base medium.</p>` : '<div class="muted">No conditions.</div>';
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
    if (r.needsCse && (!r.cseF || r.cseBad)) { toast('Enter a valid CSE absorbance (> 0.07)', 3000); form.elements.abs.focus(); return; }
    const rec = {
      id: mc?.id || uid(), date: r.date, day: e.seedingDate ? dayOf(e.seedingDate, r.date) : null,
      absorbance: isFinite(r.A) ? r.A : null, cseFraction: r.cseF && !r.cseBad ? r.cseF : null, volPerChip: r.V / 1000,
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
    <div class="mid"><b>${name}</b><small>${esc(chip.condition || 'Chip ' + chip.letter)}</small></div>
    ${next ? `<a class="btn" href="${link(next)}">${next.c.letter}${next.k}${I.fwd}</a>` : '<span class="ph"></span>'}
  </div>

  <section class="card">
    <div class="seg status" id="stSeg">${Object.entries(CH_STATUS).map(([k, l]) => `<button data-s="${k}" class="${ch.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${ch.status === 'failed' ? `<div class="failinfo">Failed${ch.failDay != null && ch.failDay !== '' ? ' on Day ' + esc(ch.failDay) : ''} · ${esc(ch.failReason || '—')}${ch.failNote ? ' · ' + esc(ch.failNote) : ''}
       <button class="icon sm" id="editFail" style="color:inherit;vertical-align:middle" title="Edit">${I.edit}</button></div>` : ''}
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
  ${photos.length ? `<div class="timeline">${photos.map((p, i) => `<button class="tl" data-i="${i}"><img src="${url(p.blob)}" alt="" loading="lazy">
      <div><b>Day ${p.day}</b><small>${fmtDate(p.date)}</small></div></button>`).join('')}</div>`
    : '<div class="card empty">No photos yet.</div>'}`;

  $$('#stSeg button').forEach(b => b.onclick = () => setChamberStatus(chip, n, b.dataset.s, todayDay));
  $('#editFail') && ($('#editFail').onclick = () => setChamberStatus(chip, n, 'failed', todayDay, true));
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
    return `<button class="cell st-${st}" data-i="${list.length - 1}"><img src="${url(p.blob)}" alt=""><span class="ch-label">${c.letter}${n}</span></button>`;
  }).join('')}</div>`).join('')}</div>`;
  $$('.cell[data-i]').forEach(b => b.onclick = () => openViewer(list, +b.dataset.i, rerender));
}

/* ---------------- full-screen photo viewer ---------------- */
function openViewer(list, start, onChanged) {
  let i = start, changed = false, closed = false;
  const urls = list.map(p => URL.createObjectURL(p.blob));
  const ov = document.createElement('div');
  ov.className = 'viewer';
  ov.innerHTML = `<div class="v-top"><div class="v-cap"></div>
      <button class="icon" data-a="day" title="Change day">${I.edit}</button>
      <button class="icon" data-a="del" title="Delete photo">${I.trash}</button>
      <button class="icon" data-a="close" title="Close">${I.close}</button></div>
    <div class="v-img"><img alt=""></div>
    <button class="v-nav prev" aria-label="Previous">${I.back}</button><button class="v-nav next" aria-label="Next">${I.fwd}</button>`;
  document.body.appendChild(ov);
  const show = () => {
    const p = list[i];
    $('img', ov).src = urls[i];
    $('.v-cap', ov).innerHTML = `<b>${esc(p.label)} · Day ${p.day}</b> · ${fmtDate(p.date)} · ${fmtSize(p.blob.size)}<small>${i + 1}/${list.length}</small>`;
    $('.prev', ov).hidden = i === 0; $('.next', ov).hidden = i === list.length - 1;
  };
  const doClose = () => {
    if (closed) return; closed = true;
    ov.remove(); urls.forEach(u => URL.revokeObjectURL(u));
    removeEventListener('keydown', onKey); removeEventListener('popstate', onPop);
    if (changed) onChanged && onChanged();
  };
  const close = () => history.back();           // pops our pushed state -> onPop
  const onPop = () => doClose();
  const onKey = ev => { if ($('dialog[open]')) return; if (ev.key === 'Escape') close(); if (ev.key === 'ArrowLeft' && i > 0) { i--; show(); } if (ev.key === 'ArrowRight' && i < list.length - 1) { i++; show(); } };
  history.pushState({ viewer: 1 }, '', location.href);
  addEventListener('popstate', onPop); addEventListener('keydown', onKey);
  $('.prev', ov).onclick = () => { if (i > 0) { i--; show(); } };
  $('.next', ov).onclick = () => { if (i < list.length - 1) { i++; show(); } };
  let x0 = null;
  $('.v-img', ov).addEventListener('touchstart', ev => { x0 = ev.touches.length === 1 ? ev.touches[0].clientX : null; }, { passive: true });
  $('.v-img', ov).addEventListener('touchend', ev => {
    if (x0 == null) return; const dx = ev.changedTouches[0].clientX - x0; x0 = null;
    if (dx > 60 && i > 0) { i--; show(); } else if (dx < -60 && i < list.length - 1) { i++; show(); }
  });
  $('[data-a=close]', ov).onclick = close;
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
      const s = t.objectStore('photos'); if (clash) s.delete(clash.id);
      const { label, ...rec } = p; rec.day = nd; s.put(rec);
    });
    p.day = nd; changed = true; show(); toast('Day changed');
  };
  show();
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
async function deliverFile(blob, name) {
  const file = new File([blob], name, { type: 'application/json' });
  let canShare = false; try { canShare = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch { }
  const r = await dialog({
    title: 'Export ready',
    body: `<p><b>${esc(name)}</b><br><span class="muted">${fmtSize(blob.size)}</span></p>
      <p class="muted">Save the file (it goes to your Downloads folder), then copy it to the other device – e.g. via Google Drive, OneDrive, email or USB – and open <b>Settings → Import file</b> there.</p>`,
    actions: [{ label: 'Close', value: 'cancel' }, ...(canShare ? [{ label: 'Share…', value: 'share' }] : []), { label: 'Save file', value: 'save', cls: 'primary' }],
  });
  if (r.action === 'save') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
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
    const { blob, ...meta } = photos[i];
    meta.data = await blobToDataURL(blob);
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
  const photos = data.photos.map(p => { const { data: d, ...m } = p; return { ...m, blob: dataURLToBlob(d) }; });
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
      <div class="chamber" style="border-color:var(--accent)">${ph ? `<img src="${url(ph.blob)}" alt=""><span class="ch-day">D${ph.day}</span>` : I.camera}<span class="ch-label">${f.name}</span></div>
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
  ${photos.length ? `<div class="timeline">${photos.map((ph, i) => `<button class="tl" data-i="${i}"><img src="${url(ph.blob)}" alt="" loading="lazy">
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
  for (let i = 0; i < photos.length; i++) { const { blob, ...m } = photos[i]; m.data = await blobToDataURL(blob); parts.push((i ? ',' : '') + JSON.stringify(m)); }
  parts.push(']}');
  $('#toast').classList.remove('show');
  await deliverFile(new Blob(parts, { type: 'application/json' }), `LabTrack_Expansion${pad2(x.number)}_${slug(x.cellType)}_${todayISO()}.json`);
}
async function importExpansion(data) {
  const inc = data.expansion, local = await get('expansions', inc.id), xs = await all('expansions');
  const photos = data.photos.map(p => { const { data: d, ...m } = p; return { ...m, blob: dataURLToBlob(d) }; });
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
   EXPORT CHOICE + DETAILED REPORTS
   ========================================================= */
async function exportMenu(kind, id) {
  const label = { exp: 'experiment', cexp: 'cell expansion', storage: 'storage' }[kind];
  const r = await dialog({
    title: `Export ${label}`,
    body: `<p><b>Data file (.json)</b> – to move to another device or keep as a backup. It can be imported back into LabTrack.</p>
      <p><b>Report</b> – a readable document with all the information, to print, save as PDF or share.</p>
      ${kind === 'storage' ? '<label class="check"><input type="checkbox" name="hist" checked> Include movement history in the report</label>'
        : '<label class="check"><input type="checkbox" name="photos" checked> Include photos in the report</label>'}`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Data file (.json)', value: 'json' }, { label: 'Report', value: 'report', cls: 'primary' }],
  });
  if (r.action === 'json') return kind === 'exp' ? exportExperiment(id) : kind === 'cexp' ? exportExpansion(id) : exportStorage();
  if (r.action !== 'report') return;
  toast('Building report…', 20000);
  try {
    const rep = kind === 'exp' ? await reportExperiment(id, !!r.data.photos)
      : kind === 'cexp' ? await reportExpansion(id, !!r.data.photos) : await reportStorage(!!r.data.hist);
    $('#toast').classList.remove('show');
    openReport(rep.title, rep.html, rep.file);
  } catch (e) { console.error(e); toast('Could not build report: ' + e.message, 5000); }
}

const REPORT_CSS = `
*{box-sizing:border-box}body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#18212b;margin:0;padding:24px;background:#fff}
.wrap{max-width:900px;margin:0 auto}
h1{font-size:22px;margin:0 0 2px;color:#0f766e}h2{font-size:16px;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid #0f766e;color:#0f766e}
h3{font-size:14px;margin:16px 0 6px}.sub{color:#667085;margin:0 0 10px}
table{width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:12.5px}
th{text-align:left;background:#eef6f5;color:#344054;font-weight:700;padding:5px 7px;border:1px solid #d9e2e8}
td{padding:5px 7px;border:1px solid #e2e6eb;vertical-align:top}
td.n,th.n{text-align:right;white-space:nowrap}tfoot td{font-weight:700;background:#f7f9fa}
table.kv td:first-child{width:36%;color:#475467;font-weight:600;background:#fafbfc}
.st{font-weight:700;padding:1px 7px;border-radius:9px;font-size:11.5px;white-space:nowrap}
.st.ok{background:#e1f4e8;color:#1e7a45}.st.low{background:#fff3c4;color:#7a5a00}.st.failed{background:#fde2e2;color:#b42318}
.muted{color:#667085}.note{white-space:pre-wrap}
.block{border:1px solid #e2e6eb;border-radius:10px;padding:10px 12px;margin:10px 0;page-break-inside:avoid}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 12px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 12px}
figure{margin:0;page-break-inside:avoid}figure img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:3px solid #2e9d5b;display:block}
figure.low img{border-color:#e0b100}figure.failed img{border-color:#d64545}figure.none{border:1px dashed #cfd6dd;border-radius:6px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#98a2b3;font-size:11px}
figcaption{font-size:11px;color:#475467;margin-top:2px}
.day{page-break-inside:avoid}
.small table{font-size:11px}.small td,.small th{padding:4px 5px}
@page{size:A4;margin:14mm}
@media print{body{padding:0}h2{page-break-after:avoid}}
`;
function reportDoc(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${REPORT_CSS}</style></head>
<body><div class="wrap">${body}<p class="muted" style="margin-top:30px;font-size:11px">Generated ${fmtDateTime(new Date().toISOString())} with LabTrack ${APP_VERSION}</p></div></body></html>`;
}
const rKV = rows => `<table class="kv"><tbody>${rows.filter(r => r && r[1] !== undefined && r[1] !== null && r[1] !== '').map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>`;
const rTable = (head, rows, foot) => `<table><thead><tr>${head.map(h => `<th${h.n ? ' class="n"' : ''}>${h.t ?? h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${head[i]?.n ? ' class="n"' : ''}>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>${foot ? `<tfoot><tr>${foot.map((c, i) => `<td${head[i]?.n ? ' class="n"' : ''}>${c ?? ''}</td>`).join('')}</tr></tfoot>` : ''}</table>`;
const stBadge = s => `<span class="st ${s}">${CH_STATUS[s]}</span>`;
const nl = s => s ? `<span class="note">${esc(s)}</span>` : '';

async function reportExperiment(id, withPhotos) {
  const e = await get('experiments', id);
  const [chips, photos, movs, items] = await Promise.all([all('chips', 'expId', id), all('photos', 'expId', id), all('movements', 'expId', id), all('items')]);
  chips.sort((a, b) => a.idx - b.idx);
  await ensureExpShape(e, chips);
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const allCh = chips.flatMap(c => c.chambers);
  const cnt = s => allCh.filter(c => c.status === s).length;
  const cc = cellTotal(e.cellCount);
  const copd = e.model === COPD_MODEL;
  let h = `<h1>Experiment ${expNum(e)}${e.title ? ' – ' + esc(e.title) : ''}</h1><p class="sub">${esc(e.model || 'No model')} · ${e.status}</p>`;
  h += `<h2>General information</h2>` + rKV([
    ['Model', esc(e.model)], ['Status', e.status], ['Seeding date', fmtDate(e.seedingDate)],
    ['Current day', e.seedingDate && e.status !== 'Finished' ? 'Day ' + dayOf(e.seedingDate, todayISO()) : ''],
    ['Protocol', esc(e.protocol)], ['Chips seeded', chips.length],
    ['Chambers', `${allCh.length} – ${cnt('ok')} OK, ${cnt('low')} low-density, ${cnt('failed')} failed`],
    ['Notes', nl(e.notes)],
  ]);
  h += `<h2>Cell count</h2>` + (cc ? rKV([
    ['Counts', e.cellCount.counts.map(fmtN).join(', ')], ['Average count', fmtN(cc.avg)], ['Dilution factor', fmtN(cc.dil)],
    ['Total cells (average × dilution × 10⁴)', `<b>${fmtSci(cc.total)}</b>`],
  ]) : `<p class="muted">${e.cellsHarvested ? 'Cells harvested: ' + esc(e.cellsHarvested) : 'No cell count entered.'}</p>`);
  h += `<h2>Conditions</h2>` + (e.conditions.length ? rTable(['Condition', ...(copd ? ['CSE', 'Drugs'] : []), 'Chips'],
    e.conditions.map(c => [`<b>${esc(c.name)}</b>`, ...(copd ? [c.cse ? 'Yes' : 'No', (c.drugIds || []).map(d => esc(e.drugs.find(x => x.id === d)?.name || '')).join(', ') || '–'] : []),
      chips.filter(x => x.conditionId === c.id).map(x => x.letter).join(', ') || '–'])) : '<p class="muted">No conditions.</p>');
  if (e.drugs.length) h += `<h3>Drugs</h3>` + rTable(['Drug', 'Dilution', { t: 'Per mL of medium', n: 1 }],
    e.drugs.map(d => { const f = drugFraction(d); return [esc(d.name), d.mode === 'conc' ? `${esc(d.stock)} ${d.stockUnit} → ${esc(d.final)} ${d.finalUnit} (1:${f ? fmtN(1 / f) : '?'})` : `1:${d.ratio}`, f ? fmtUL(f * 1000) : '–']; }));
  h += `<h2>Chips and chambers</h2>` + (chips.length ? rTable(['Chip', 'Condition', 'Chamber', 'Status', 'Failure', 'Notes', { t: 'Photos', n: 1 }],
    chips.flatMap(c => c.chambers.map((ch, i) => [
      i === 0 ? `<b>${c.letter}</b>${c.notes ? '<br><span class="muted">' + esc(c.notes) + '</span>' : ''}` : '', i === 0 ? esc(condName(e, c)) : '',
      c.letter + (i + 1), stBadge(ch.status),
      ch.status === 'failed' ? `${esc(ch.failReason || '')}${ch.failDay != null && ch.failDay !== '' ? ' · day ' + ch.failDay : ''}${ch.failNote ? ' · ' + esc(ch.failNote) : ''}` : '',
      nl(ch.notes), photos.filter(p => p.chipId === c.id && p.chamber === i + 1).length,
    ]))) : '<p class="muted">No chips.</p>');
  if (e.mediumChanges.length) {
    h += `<h2>Medium changes</h2>`;
    for (const m of [...e.mediumChanges].sort((a, b) => a.date.localeCompare(b.date))) {
      const tot = { total: 0, cse: 0, medium: 0 };
      (m.rows || []).forEach(r => { tot.total += r.total || 0; tot.cse += r.cse || 0; tot.medium += r.medium || 0; });
      const k = (m.baseMediumMl || 0) * 1000 / BASE_MEDIUM_TOTAL;
      h += `<div class="block"><h3 style="margin-top:0">${m.day != null ? 'Day ' + m.day + ' · ' : ''}${fmtDate(m.date)}</h3>` + rKV([
        ['CSE absorbance', m.absorbance ?? '–'], ['CSE fraction (0.07 / absorbance)', m.cseFraction ? `${fmtN(m.cseFraction)} (${fmtN(m.cseFraction * 100)} %)` : '–'],
        ['Volume per chip', fmtN(m.volPerChip) + ' mL'], ['Notes', nl(m.notes)],
      ]) + rTable(['Condition', { t: 'Chips', n: 1 }, { t: 'Total', n: 1 }, { t: 'CSE', n: 1 }, 'Drugs', { t: 'Base medium', n: 1 }],
        (m.rows || []).map(r => [esc(r.name), r.n, fmtUL(r.total), r.cse ? fmtUL(r.cse) : '–', (r.drugs || []).map(d => `${esc(d.name)} ${fmtUL(d.vol)}`).join('<br>') || '–', `<b>${fmtUL(r.medium)}</b>`]),
        ['Total', '', fmtUL(tot.total), fmtUL(tot.cse), '', fmtUL(tot.medium)])
        + `<p style="margin:4px 0">Base medium prepared: <b>${m.baseMediumMl} mL</b></p>`
        + rTable(['Component', { t: 'per 10 mL', n: 1 }, { t: `for ${m.baseMediumMl} mL`, n: 1 }], BASE_MEDIUM.map(([n, v]) => [n, fmtUL(v), `<b>${fmtUL(v * k)}</b>`])) + `</div>`;
    }
  }
  if (e.stainings.length) {
    h += `<h2>Stainings</h2>`;
    for (const s of [...e.stainings].sort((a, b) => a.date.localeCompare(b.date))) {
      const V = s.totalVolume ?? s.nChambers * s.volPerChamber * (1 + (s.extraPct || 0) / 100);
      const abT = abs => { const list = abs.filter(a => a.itemId); const gs = V * 0.005, sum = list.reduce((t, a) => t + (a.vol || V / a.dilution || 0), 0);
        return rTable(['Component', { t: 'Volume', n: 1 }], [['Goat Serum (0.5 %)', fmtUL(gs)], ...list.map((a, i) => [`#${i + 1} ${esc(a.name)} (1:${a.dilution})`, fmtUL(a.vol ?? V / a.dilution)]), ['PBS (remaining)', fmtUL(V - gs - sum)]], ['Total', fmtUL(V)]); };
      const img = WAVELENGTHS.map(w => [w, esc(s.imaging?.[w]?.marker), s.imaging?.[w]?.laser ?? '', s.imaging?.[w]?.exposure ?? '']);
      h += `<div class="block"><h3 style="margin-top:0">${esc(s.title || 'Staining')} – ${s.day != null ? 'Day ' + s.day + ' · ' : ''}${fmtDate(s.date)}</h3>` + rKV([
        ['Chambers stained', s.nChambers], ['Volume per chamber', fmtN(s.volPerChamber) + ' µL'], ['Extra volume', s.extraPct ? fmtN(s.extraPct) + ' %' : ''],
        ['Volume per solution', fmtUL(V)], ['Antibodies deducted from storage', s.deducted ? 'Yes' : 'No'], ['Notes', nl(s.notes)],
      ]) + `<h3>Permeabilization & blocking</h3>` + rTable(['Component', { t: 'Volume', n: 1 }], [['Goat Serum (5 %)', fmtUL(V * 0.05)], ['Tween-20 (0.1 %)', fmtUL(V * 0.001)], ['PBS (remaining)', fmtUL(V * 0.949)]], ['Total', fmtUL(V)])
        + `<h3>Primary antibodies</h3>` + abT(s.primary || []) + `<h3>Secondary antibodies</h3>` + abT(s.secondary || [])
        + `<h3>Imaging</h3>` + rTable([{ t: 'λ (nm)' }, 'Marker', { t: 'Laser (%)', n: 1 }, { t: 'Exposure (ms)', n: 1 }], img) + `</div>`;
    }
  }
  h += `<h2>Consumables used</h2>` + (movs.length ? rTable(['Date', 'Item', { t: 'Quantity', n: 1 }, 'Note'],
    movs.sort((a, b) => a.date.localeCompare(b.date)).map(m => [fmtDateTime(m.date), esc(itemMap[m.itemId]?.name || 'deleted item'), `${fmtQty(-m.delta)} ${esc(itemMap[m.itemId]?.unit || '')}`, esc(m.note)])) : '<p class="muted">None recorded.</p>');
  if (withPhotos && photos.length) {
    h += `<h2>Photos</h2>`;
    const days = [...new Set(photos.map(p => p.day))].sort((a, b) => a - b);
    for (const d of days) {
      h += `<div class="day"><h3>Day ${d}${e.seedingDate ? ' · ' + fmtDate(dateForDay(e.seedingDate, d)) : ''}</h3>`;
      for (const c of chips) {
        const cells = [];
        for (let n = 1; n <= 3; n++) {
          const p = photos.find(x => x.day === d && x.chipId === c.id && x.chamber === n), st = c.chambers[n - 1].status;
          cells.push(p ? `<figure class="${st}"><img src="${await blobToDataURL(p.blob)}" alt=""><figcaption><b>${c.letter}${n}</b> · ${esc(condName(e, c))}</figcaption></figure>` : `<figure class="none">${c.letter}${n} – no photo</figure>`);
        }
        if (photos.some(x => x.day === d && x.chipId === c.id)) h += `<div class="grid">${cells.join('')}</div>`;
      }
      h += `</div>`;
    }
  }
  const title = `Experiment ${expNum(e)} ${e.title || ''}`.trim();
  return { title, html: reportDoc(title, h), file: `LabTrack_Report_Exp${pad2(e.number)}${e.title ? '_' + slug(e.title) : ''}_${todayISO()}.html` };
}

async function reportExpansion(id, withPhotos) {
  const x = await get('expansions', id), photos = await all('photos', 'expId', id);
  const st = expansionStats(x);
  const area = st.area;
  let h = `<h1>Cell expansion #${pad2(x.number)} – ${esc(x.cellType)}</h1><p class="sub">${x.lot ? 'Lot ' + esc(x.lot) + ' · ' : ''}${x.status}</p>`;
  h += `<h2>General information</h2>` + rKV([
    ['Cell type', esc(x.cellType)], ['Lot', esc(x.lot)], ['Cells in vial (theoretical)', fmtCells(x.vialCells)],
    ['Seeding efficiency', fmtN(x.seedingEff) + ' %'], ['Cell viability', fmtN(x.viability) + ' %'],
    ['Flask type', esc(x.flaskType) + (area ? ` (${area} cm²)` : '')], ['Started', fmtDT(x.passages[0].start)], ['Status', x.status],
    ['Passages', x.passages.map(pLabel).join(', ')], ['Notes', nl(x.notes)],
  ]);
  if (st.splits) h += `<h2>Overall results</h2>` + rTable(['Parameter', { t: 'Raw', n: 1 }, { t: 'Corrected', n: 1 }], [
    ['Passages completed', st.splits, ''], ['Time (completed passages)', fmtDur(st.doneH), ''],
    ['Cumulative population doublings', fmtN(st.cpd), fmtN(st.cpdC)], ['<b>Mean doubling time</b>', `<b>${fmtH(st.dt)}</b>`, `<b>${fmtH(st.dtC)}</b>`],
    ['Theoretical yield (all cells kept)', fmtCells(st.yieldT), ''], ['Total harvested', fmtCells(st.tot.harvested), ''],
    ['Total frozen', fmtCells(st.tot.frozen), ''], ['Total used', fmtCells(st.tot.used), ''], ['Total discarded', fmtCells(st.tot.discarded), ''],
  ]) + `<p class="muted">Corrected: N₀ × seeding efficiency × viability (vial viability for the first passage, viability at harvest – if entered – for later passages).</p>`;
  h += `<h2>Passage summary</h2><div class="small">` + rTable(['Passage', 'Seeded', 'Harvested', { t: 'Flasks', n: 1 }, { t: 'N₀', n: 1 }, { t: 'N', n: 1 }, { t: 'Time', n: 1 }, { t: 'PD raw', n: 1 }, { t: 'PD corr.', n: 1 }, { t: 'DT raw', n: 1 }, { t: 'DT corr.', n: 1 }],
    st.rows.map(r => [pLabel(r.p), fmtDT(r.p.start), r.p.split ? fmtDT(r.p.split.date) : 'running', r.nFlasks, fmtCells(r.N0), r.p.split ? fmtCells(r.p.split.harvested) : '–',
      r.p.split ? fmtN(r.h) + ' h' : '–', r.p.split ? fmtN(r.pd) : '–', r.p.split ? fmtN(r.pdC) : '–', r.p.split ? fmtH(r.dt) : '–', r.p.split ? fmtH(r.dtC) : '–'])) + '</div>';
  h += `<h2>Passage details</h2>`;
  for (const r of st.rows) {
    const s = r.p.split;
    h += `<div class="block"><h3 style="margin-top:0">${pLabel(r.p)} · ${fmtDT(r.p.start)} → ${s ? fmtDT(s.date) : 'running'}</h3>`
      + rTable(['Flask', { t: 'Cells seeded', n: 1 }, ...(area ? [{ t: 'Density', n: 1 }] : []), 'Notes', { t: 'Photos', n: 1 }],
        r.p.flasks.map(f => [f.name, fmtCells(f.seeded), ...(area ? [fmtCells(f.seeded / area) + '/cm²'] : []), nl(f.notes), photos.filter(p => p.chipId === f.id).length]))
      + rTable(['Parameter', { t: 'Raw', n: 1 }, { t: 'Corrected', n: 1 }], [
        ['Cells seeded (N₀)', fmtCells(r.N0), fmtCells(r.N0c)],
        ...(r.seedDens != null ? [['Seeding density', fmtCells(r.seedDens) + '/cm²', fmtCells(r.N0c / (r.nFlasks * area)) + '/cm²']] : []),
        ['Time in culture', fmtDur(r.h), ''],
        ...(s ? [
          ['Cells harvested (N)', fmtCells(s.harvested), ''],
          ...(r.harvDens != null ? [['Harvest density', fmtCells(r.harvDens) + '/cm²', '']] : []),
          ['Fold expansion', fmtN(r.fold) + '×', fmtN(r.foldC) + '×'], ['Population doublings', fmtN(r.pd), fmtN(r.pdC)],
          ['<b>Doubling time</b>', `<b>${fmtH(r.dt)}</b>`, `<b>${fmtH(r.dtC)}</b>`],
          ['Growth rate μ', r.mu != null ? fmtN(r.mu) + ' /day' : '–', r.muC != null ? fmtN(r.muC) + ' /day' : '–'],
          ['Cumulative PD', fmtN(r.cpd), fmtN(r.cpdC)],
          ['Frozen', fmtCells(s.frozen), ''], ['Used', fmtCells(s.used), ''], ['Thrown away', fmtCells(s.discarded), ''],
          ...(s.viability ? [['Viability at harvest', fmtN(s.viability) + ' %', '']] : []),
          ...(s.notes ? [['Split notes', nl(s.notes), '']] : []),
        ] : []),
      ]) + `</div>`;
  }
  if (withPhotos && photos.length) {
    h += `<h2>Photos</h2>`;
    for (const p of x.passages) for (const f of p.flasks) {
      const ph = photos.filter(q => q.chipId === f.id).sort((a, b) => a.day - b.day);
      if (!ph.length) continue;
      const figs = [];
      for (const q of ph) figs.push(`<figure><img src="${await blobToDataURL(q.blob)}" alt=""><figcaption><b>Day ${q.day}</b> · ${fmtDate(q.date)}</figcaption></figure>`);
      h += `<div class="day"><h3>${pLabel(p)} · ${f.name}</h3><div class="grid4">${figs.join('')}</div></div>`;
    }
  }
  const title = `Cell expansion #${pad2(x.number)} ${x.cellType || ''}`.trim();
  return { title, html: reportDoc(title, h), file: `LabTrack_Report_Expansion${pad2(x.number)}_${slug(x.cellType)}_${todayISO()}.html` };
}

async function reportStorage(withHist) {
  const [items, movs, exps] = await Promise.all([all('items'), all('movements'), all('experiments')]);
  const expMap = Object.fromEntries(exps.map(e => [e.id, e])), itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const low = items.filter(isLow), expiring = items.filter(expiryState);
  let h = `<h1>Storage inventory</h1><p class="sub">${items.length} items · ${fmtDate(todayISO())}</p>`;
  h += `<h2>Alerts</h2>` + ((low.length || expiring.length) ? rTable(['Item', 'Alert', { t: 'Quantity', n: 1 }, 'Location'],
    [...low.map(i => [esc(i.name), `Low stock (min ${fmtQty(i.minQty)})`, `${fmtQty(i.quantity)} ${esc(i.unit)}`, esc(i.location)]),
     ...expiring.map(i => [esc(i.name), `${expiryState(i).txt} (${fmtDate(i.expiry)})`, `${fmtQty(i.quantity)} ${esc(i.unit)}`, esc(i.location)])]) : '<p class="muted">No low-stock or expiring items.</p>');
  const groups = Object.entries(groupBy(items.map(i => ({ ...i, _c: i.category || 'Uncategorized' })), '_c')).sort((a, b) => a[0].localeCompare(b[0]));
  h += `<h2>Inventory</h2>`;
  for (const [cat, its] of groups) {
    h += `<h3>${esc(cat)}</h3>` + rTable(['Item', { t: 'Quantity', n: 1 }, { t: 'Min', n: 1 }, 'Location', 'Lot', 'Expiry', 'Supplier / cat. #', 'Notes'],
      its.sort((a, b) => a.name.localeCompare(b.name)).map(i => [`<b>${esc(i.name)}</b>${isLow(i) ? ' <span class="st low">LOW</span>' : ''}`,
        `${fmtQty(i.quantity)} ${esc(i.unit)}`, i.minQty === '' || i.minQty == null ? '' : fmtQty(i.minQty), esc(i.location), esc(i.lot),
        i.expiry ? fmtDate(i.expiry) + (expiryState(i) ? ` <span class="st ${expiryState(i).cls === 'expired' ? 'failed' : 'low'}">${expiryState(i).txt}</span>` : '') : '',
        [i.supplier, i.catalog].filter(Boolean).map(esc).join(' · '), nl(i.notes)]));
  }
  if (withHist) {
    h += `<h2>Movement history</h2>` + (movs.length ? rTable(['Date', 'Item', 'Type', { t: 'Change', n: 1 }, { t: 'Balance', n: 1 }, 'Experiment', 'Note'],
      movs.sort((a, b) => b.date.localeCompare(a.date)).map(m => {
        const it = itemMap[m.itemId];
        return [fmtDateTime(m.date), esc(it?.name || 'deleted item'), m.type === 'set' ? 'Stocktake' : m.type === 'initial' ? 'Initial' : m.delta >= 0 ? 'Added' : 'Removed',
          `${m.delta >= 0 ? '+' : '−'}${fmtQty(Math.abs(m.delta))}`, `${fmtQty(m.balance)} ${esc(it?.unit || '')}`,
          m.expId ? (expMap[m.expId] ? expNum(expMap[m.expId]) + ' ' + esc(expMap[m.expId].title || '') : 'deleted') : '', esc(m.note)];
      })) : '<p class="muted">No movements.</p>');
  }
  return { title: 'Storage inventory', html: reportDoc('Storage inventory', h), file: `LabTrack_Report_Storage_${todayISO()}.html` };
}

function openReport(title, html, file) {
  const blob = new Blob([html], { type: 'text/html' }), src = URL.createObjectURL(blob);
  const ov = document.createElement('div');
  ov.className = 'reportview';
  ov.innerHTML = `<div class="rv-top"><button class="icon" data-a="close" title="Close">${I.close}</button><b class="rv-title">${esc(title)}</b>
    <button class="btn" data-a="dl">${I.download} HTML</button><button class="btn primary" data-a="print">Print / PDF</button></div>
    <iframe title="Report"></iframe>`;
  document.body.appendChild(ov);
  const frame = $('iframe', ov); frame.src = src;
  let closed = false;
  const doClose = () => { if (closed) return; closed = true; ov.remove(); setTimeout(() => URL.revokeObjectURL(src), 1000); removeEventListener('popstate', doClose); };
  history.pushState({ report: 1 }, '', location.href);
  addEventListener('popstate', doClose);
  $('[data-a=close]', ov).onclick = () => history.back();
  $('[data-a=print]', ov).onclick = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { toast('Printing not available here – download the HTML and print it from the browser', 4000); } };
  $('[data-a=dl]', ov).onclick = () => {
    const a = document.createElement('a'); a.href = src; a.download = file; document.body.appendChild(a); a.click(); a.remove();
    toast(`Saved ${file} (${fmtSize(blob.size)})`, 3000);
  };
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
