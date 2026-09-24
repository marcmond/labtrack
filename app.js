'use strict';
/* LabTrack – experiments, chip chambers, daily photos, consumables storage.
   All data is stored locally in IndexedDB on this device. */

const APP_VERSION = '1.0.0';
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
    const r = indexedDB.open('labtrack', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
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
  setTab(p[0] === 'storage' || p[0] === 'item' ? 'storage' : p[0] === 'settings' ? 'settings' : 'exp');
  try {
    if (!p.length) return await viewExperiments();
    if (p[0] === 'exp' && p.length === 2) return await viewExperiment(p[1]);
    if (p[0] === 'exp' && p[2] === 'chip' && p[4] === 'ch') return await viewChamber(p[1], p[3], +p[5]);
    if (p[0] === 'exp' && p[2] === 'day') return await viewDay(p[1], +p[3]);
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
    <div class="meta">${e.seedingDate ? `Seeded ${fmtDate(e.seedingDate)}${e.status !== 'Finished' ? ` · <b>Day ${day}</b>` : ''}` : 'No seeding date'}${e.protocol ? ' · ' + esc(e.protocol) : ''}</div>
    <div class="meta">${chips.length} chip${chips.length === 1 ? '' : 's'} · ${ch.length} chambers${low ? ` · <span class="dot low"></span>${low} low` : ''}${failed ? ` · <span class="dot failed"></span>${failed} failed` : ''}</div>
  </a>`;
}
async function newExperiment() {
  const exps = await all('experiments');
  const num = exps.reduce((m, e) => Math.max(m, e.number), 0) + 1;
  const r = await dialog({
    title: `New experiment #${pad2(num)}`,
    body: `<label>Title / short description<input name="title" placeholder="e.g. Cardiac chips – donor 3"></label>
      <div class="grid2"><label>Seeding date<input type="date" name="seedingDate" value="${todayISO()}"></label>
      <label>Status<select name="status">${EXP_STATUS.map(s => `<option ${s === 'Running' ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
      <label>Protocol<input name="protocol"></label>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', value: 'ok', cls: 'primary' }],
  });
  if (!r.ok) return;
  const e = { id: uid(), number: num, title: r.data.title.trim(), seedingDate: r.data.seedingDate, status: r.data.status,
    protocol: r.data.protocol.trim(), cellsHarvested: '', notes: '', createdAt: now(), updatedAt: now() };
  await put('experiments', e);
  go('#/exp/' + e.id);
}

/* =========================================================
   EXPERIMENT PAGE
   ========================================================= */
async function viewExperiment(id) {
  const e = await get('experiments', id);
  if (!e) return go('#/');
  const [chips, photos, movs, items] = await Promise.all([all('chips', 'expId', id), all('photos', 'expId', id), all('movements', 'expId', id), all('items')]);
  chips.sort((a, b) => a.idx - b.idx);
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

  main.innerHTML = `
  <section class="card" id="info">
    <div class="grid2">
      <label class="span2">Title<input name="title" value="${esc(e.title)}"></label>
      <label>Status<select name="status">${EXP_STATUS.map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Seeding date<input type="date" name="seedingDate" value="${esc(e.seedingDate)}"></label>
      <label>Protocol<input name="protocol" value="${esc(e.protocol)}"></label>
      <label>Cells harvested<input name="cellsHarvested" value="${esc(e.cellsHarvested)}" placeholder="e.g. 2.4 × 10⁶"></label>
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

  ${days.length ? `<div class="sec-head"><h2>Photos by day</h2></div>
    <div class="pills">${days.map(d => `<a class="pill" href="#/exp/${id}/day/${d}">Day ${d}</a>`).join('')}</div>` : ''}

  <div class="sec-head"><h2>Consumables used</h2></div>
  <div class="card">${Object.keys(used).length ? Object.entries(used).map(([iid, u]) => {
    const it = itemMap[iid];
    return `<div class="used"><span>${it ? `<a href="#/item/${iid}">${esc(it.name)}</a>` : '<i>deleted item</i>'}</span><span><b>${fmtQty(u.total)} ${esc(it?.unit || '')}</b> <span class="muted">(${u.n}×)</span></span></div>`;
  }).join('') : '<div class="muted">Nothing yet. When you remove something in Storage, pick this experiment to link it here.</div>'}</div>`;

  // autosave main info
  $$('#info [name]').forEach(el => el.addEventListener('change', async () => {
    e[el.name] = el.value.trim(); e.updatedAt = now();
    await put('experiments', e);
    if (['title', 'seedingDate', 'status'].includes(el.name)) rerender(); else toast('Saved');
  }));
  $('#addChip').onclick = () => addChips(e, chips);
  $$('[data-editchip]').forEach(b => b.onclick = () => editChip(chips.find(c => c.id === b.dataset.editchip)));
  $('#expExport').onclick = () => exportExperiment(id);
  $('#expDelete').onclick = async () => {
    if (!await confirmDlg('Delete experiment?', `${expNum(e)} ${esc(e.title)} with all its chips and ${photos.length} photos will be permanently deleted from this device. Consider exporting it first.`, 'Delete', 'danger')) return;
    await deleteExperiment(id); toast('Experiment deleted'); goBack('#/');
  };
}
function chipCard(e, c, latest) {
  return `<div class="card">
    <div class="chip-head"><span class="chip-letter">${c.letter}</span>
      <span class="cond">${c.condition ? esc(c.condition) : '<span class="muted">No condition set</span>'}</span>
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
      <label>Condition / treatment (optional)<input name="condition" placeholder="e.g. Control, 10 µM drug X"></label>`,
    actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add', value: 'ok', cls: 'primary' }],
    onMount: d => {
      const inp = $('[name=n]', d);
      const upd = () => { const n = Math.max(1, Math.min(52, +inp.value || 1)); $('#namesPrev', d).textContent = 'Will be named: ' + Array.from({ length: n }, (_, i) => letters(next + i)).join(', '); };
      inp.addEventListener('input', upd); upd();
    },
  });
  if (!r.ok) return;
  const n = Math.max(1, Math.min(52, +r.data.n || 1));
  await tx(['chips', 'experiments'], 'readwrite', t => {
    for (let i = 0; i < n; i++) {
      t.objectStore('chips').put({ id: uid(), expId: e.id, idx: next + i, letter: letters(next + i), condition: r.data.condition.trim(), notes: '',
        chambers: [newChamber(), newChamber(), newChamber()], createdAt: now(), updatedAt: now() });
    }
    e.updatedAt = now(); t.objectStore('experiments').put(e);
  });
  toast(n === 1 ? `Chip ${letters(next)} added` : `${n} chips added`);
  rerender();
}
async function editChip(c) {
  const r = await dialog({
    title: `Chip ${c.letter}`,
    body: `<label>Condition / treatment<input name="condition" value="${esc(c.condition)}"></label>
      <label>Notes<textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>`,
    actions: [{ label: 'Delete chip', value: 'delete', cls: 'danger', novalidate: true }, { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', cls: 'primary' }],
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
  c.condition = r.data.condition.trim(); c.notes = r.data.notes.trim(); c.updatedAt = now();
  await put('chips', c); rerender();
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
  setHeader('Storage');
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
   SETTINGS
   ========================================================= */
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (location.hash.startsWith('#/settings')) route(); });
async function viewSettings() {
  setHeader('Settings');
  const [exps, photos, items] = await Promise.all([all('experiments'), tx(['photos'], 'readonly', t => reqP(t.objectStore('photos').count())), all('items')]);
  let est = null; try { est = await navigator.storage?.estimate(); } catch { }
  let persisted = false; try { persisted = await navigator.storage?.persisted(); } catch { }
  const standalone = matchMedia('(display-mode: standalone)').matches;
  main.innerHTML = `
  <div class="sec-head"><h2>Move data between devices</h2></div>
  <section class="card">
    <p class="muted" style="margin-top:0">Data is stored only on this device. To move an experiment, open it and tap ${I.download} <b>Export</b>. For consumables use the storage export below. Then import the file on the other device.</p>
    <div class="cap-row"><button class="btn primary" id="imp">${I.upload} Import file</button></div>
    <div class="cap-row"><button class="btn" id="expSt">${I.download} Export storage (items + history)</button></div>
  </section>
  <div class="sec-head"><h2>This device</h2></div>
  <section class="card">
    <div class="kv"><span>Experiments</span><b>${exps.length}</b></div>
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
    <div class="kv"><span>Photo size</span><b>${PHOTO_MAX} px, JPEG</b></div>
  </section>`;
  $('#imp').onclick = importFromFile;
  $('#expSt').onclick = exportStorage;
  $('#persist') && ($('#persist').onclick = async () => {
    const ok = await navigator.storage?.persist?.();
    toast(ok ? 'Data protected' : 'The browser declined. Installing the app usually allows it.', 4000); rerender();
  });
  $('#install') && ($('#install').onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; rerender(); });
}

/* ---------------- start ---------------- */
(function init() {
  const tabs = $$('#tabs a');
  tabs[0].innerHTML = I.flask + '<span>Experiments</span>';
  tabs[1].innerHTML = I.box + '<span>Storage</span>';
  tabs[2].innerHTML = I.gear + '<span>Settings</span>';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  navigator.storage?.persist?.().catch(() => { });
  route();
})();
