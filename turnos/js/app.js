/* =========================================================
   Turnos 7x7 — calendario de turnos editable
   Ciclo de 28 días:
     Mar  → Subo a faena y trabajo la 1ª noche
     Mié…Lun → Noches 2 a 7
     Mar  → Termina la noche en la mañana y bajo de faena
     Mié…Lun → Descanso (6 días)
     Mar  → Subo a faena (turno de día)
     Mié…Mar → Días 1 a 7 (el último martes bajo de faena en la noche)
     Mié…Lun → Descanso (6 días)
   ========================================================= */
'use strict';

const STORE_KEY = 'turnos7x7-v1';
const DEFAULT_ANCHOR = '2026-01-06'; // Martes en que subo a turno de noche (según calendario 2026)

const CYCLE = [
  'NS', 'N', 'N', 'N', 'N', 'N', 'N', // 0-6   noches (martes a lunes)
  'NB',                               // 7     martes: bajada en la mañana
  'L', 'L', 'L', 'L', 'L', 'L',       // 8-13  descanso
  'DS',                               // 14    martes: subida
  'D', 'D', 'D', 'D', 'D', 'D', 'DB', // 15-21 días (miércoles a martes)
  'L', 'L', 'L', 'L', 'L', 'L',       // 22-27 descanso
];

const SHIFTS = {
  NS: { name: 'Turno de noche', short: 'Noche', icon: '🌙', cls: 'n', kind: 'n', mark: 'up',
        desc: 'Subes a faena y trabajas la 1ª noche' },
  N:  { name: 'Turno de noche', short: 'Noche', icon: '🌙', cls: 'n', kind: 'n' },
  NB: { name: 'Bajada', short: 'Bajada', icon: '⬇️', cls: 'nb', kind: 'b', mark: 'down',
        desc: 'Termina el turno de noche en la mañana y bajas de faena' },
  L:  { name: 'Descanso', short: 'Desc.', icon: '🏠', cls: 'l', kind: 'l' },
  DS: { name: 'Subida', short: 'Subida', icon: '⬆️', cls: 'ds', kind: 's', mark: 'up',
        desc: 'Subes a faena; mañana comienza el turno de día' },
  D:  { name: 'Turno de día', short: 'Día', icon: '☀️', cls: 'd', kind: 'd' },
  DB: { name: 'Turno de día', short: 'Día', icon: '☀️', cls: 'd', kind: 'd', mark: 'down',
        desc: 'Último día: terminas el turno y bajas de faena en la noche' },
};
const OVERRIDE_OPTS = [
  ['', 'Auto'], ['D', '☀️ Día'], ['N', '🌙 Noche'], ['L', '🏠 Desc.'], ['DS', '⬆️ Subida'], ['NB', '⬇️ Bajada'],
];

const COLORS = ['#1baf7a', '#eb6834', '#6250d6', '#d03b3b', '#2a78d6', '#b7791f', '#0e9aa7', '#c2410c', '#d6409f', '#5b6b7a'];

const DEFAULT_CATS = [
  { id: 'vac', name: 'Vacaciones', emoji: '🏖️', color: '#1baf7a' },
  { id: 'perm', name: 'Permiso', emoji: '📝', color: '#eb6834' },
  { id: 'curso', name: 'Curso', emoji: '🎓', color: '#6250d6' },
  { id: 'lic', name: 'Licencia médica', emoji: '🩺', color: '#d03b3b' },
  { id: 'admin', name: 'Día administrativo', emoji: '🗂️', color: '#2a78d6' },
  { id: 'extra', name: 'Turno extra', emoji: '➕', color: '#b7791f' },
  { id: 'cambio', name: 'Cambio de turno', emoji: '🔁', color: '#0e9aa7' },
  { id: 'examen', name: 'Examen médico', emoji: '🩻', color: '#d6409f' },
  { id: 'otro', name: 'Otro', emoji: '📌', color: '#5b6b7a' },
];

/* =========================================================
   Datos
   ========================================================= */
function freshDB() {
  return {
    version: 1,
    settings: {
      name: '',
      anchor: DEFAULT_ANCHOR,
      holidays: true,
      theme: 'auto',
      dayStart: '08:00', dayEnd: '20:00',
      nightStart: '20:00', nightEnd: '08:00',
      lastBackup: null,
    },
    categories: DEFAULT_CATS.map((c) => ({ ...c })),
    events: [],     // { id, cat, from, to, note }
    overrides: {},  // { 'YYYY-MM-DD': 'D' | 'N' | 'L' | 'DS' | 'NB' }
    notes: {},      // { 'YYYY-MM-DD': 'texto' }
  };
}

function normalize(d) {
  const base = freshDB();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d && d.settings) } };
  if (!Array.isArray(out.categories) || !out.categories.length) out.categories = base.categories;
  if (!Array.isArray(out.events)) out.events = [];
  out.events = out.events.filter((e) => e && isISO(e.from) && isISO(e.to)).map((e) => (e.to < e.from ? { ...e, from: e.to, to: e.from } : e));
  if (!out.overrides || typeof out.overrides !== 'object') out.overrides = {};
  if (!out.notes || typeof out.notes !== 'object') out.notes = {};
  if (!isISO(out.settings.anchor)) out.settings.anchor = DEFAULT_ANCHOR;
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('No se pudieron leer los datos', e); }
  return freshDB();
}

let db = load();

function save() {
  db.updatedAt = new Date().toISOString();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast('⚠️ No se pudo guardar. Exporta un respaldo.'); }
}

/* =========================================================
   Utilidades de fecha (días como números enteros, sin husos)
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const mod = (a, n) => ((a % n) + n) % n;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const DAY = 86400000;
function dnum(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); }
function diso(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
function todayISO() { const t = new Date(); return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
function dow(iso) { return new Date(dnum(iso) * DAY).getUTCDay(); } // 0 = domingo
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function addDays(iso, k) { return diso(dnum(iso) + k); }

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WD_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const WD_H = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function fmtLong(iso) { const [, m, d] = iso.split('-').map(Number); return `${WD[dow(iso)]} ${d} de ${MONTHS[m - 1]}`; }
function fmtShort(iso) { const [, m, d] = iso.split('-').map(Number); return `${WD_S[dow(iso)]} ${d} ${MONTHS_S[m - 1]}`; }
function fmtDM(iso) { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_S[m - 1]}`; }
function fmtRange(a, b) {
  if (a === b) return fmtShort(a);
  return `${fmtShort(a)} → ${fmtShort(b)}`;
}
function inDays(n) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === 2) return 'pasado mañana';
  return `en ${n} días`;
}

/* =========================================================
   Feriados de Chile
   ========================================================= */
const holidayCache = {};
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}
function juneSolsticeChile(y) {
  const Y = (y - 2000) / 1000;
  const jde = 2451716.56767 + 365241.62603 * Y + 0.00325 * Y * Y + 0.00888 * Y ** 3 - 0.0003 * Y ** 4;
  const ms = (jde - 2440587.5) * DAY - 4 * 3600000; // hora de Chile en invierno (UTC-4)
  return new Date(ms).toISOString().slice(0, 10);
}
function movedToMonday(iso) {
  // Ley 19.668: mar/mié/jue → lunes anterior; vie → lunes siguiente
  const w = dow(iso);
  if (w >= 2 && w <= 4) return addDays(iso, -(w - 1));
  if (w === 5) return addDays(iso, 3);
  return iso;
}
function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const h = {};
  const add = (iso, name) => { h[iso] = h[iso] ? `${h[iso]} · ${name}` : name; };
  add(ymd(y, 1, 1), 'Año Nuevo');
  const e = easter(y);
  add(addDays(e, -2), 'Viernes Santo');
  add(addDays(e, -1), 'Sábado Santo');
  add(ymd(y, 5, 1), 'Día del Trabajo');
  add(ymd(y, 5, 21), 'Día de las Glorias Navales');
  if (y >= 2021) add(juneSolsticeChile(y), 'Día de los Pueblos Indígenas');
  add(movedToMonday(ymd(y, 6, 29)), 'San Pedro y San Pablo');
  add(ymd(y, 7, 16), 'Virgen del Carmen');
  add(ymd(y, 8, 15), 'Asunción de la Virgen');
  add(ymd(y, 9, 18), 'Independencia Nacional');
  add(ymd(y, 9, 19), 'Glorias del Ejército');
  add(movedToMonday(ymd(y, 10, 12)), 'Encuentro de Dos Mundos');
  const ev = ymd(y, 10, 31), w = dow(ev);
  add(w === 2 ? ymd(y, 10, 27) : w === 3 ? ymd(y, 11, 2) : ev, 'Día de las Iglesias Evangélicas');
  add(ymd(y, 11, 1), 'Todos los Santos');
  add(ymd(y, 12, 8), 'Inmaculada Concepción');
  add(ymd(y, 12, 25), 'Navidad');
  holidayCache[y] = h;
  return h;
}
function holidayName(iso) {
  if (!db.settings.holidays) return '';
  return holidays(Number(iso.slice(0, 4)))[iso] || '';
}
const isRed = (iso) => { const w = dow(iso); return w === 0 || w === 6 || !!holidayName(iso); };

/* =========================================================
   Lógica de turnos
   ========================================================= */
function baseOffset(iso) { return mod(dnum(iso) - dnum(db.settings.anchor), 28); }
function shiftCode(iso) { return db.overrides[iso] || CYCLE[baseOffset(iso)]; }

function shiftInfo(iso) {
  const ov = db.overrides[iso];
  const off = baseOffset(iso);
  const code = ov || CYCLE[off];
  const s = SHIFTS[code];
  let pos = '';
  if (!ov) {
    if (off <= 6) pos = `Noche ${off + 1} de 7`;
    else if (off >= 15 && off <= 21) pos = `Día ${off - 14} de 7`;
    else if (off >= 8 && off <= 13) pos = `Descanso ${off - 7} de 6`;
    else if (off >= 22) pos = `Descanso ${off - 21} de 6`;
  }
  const hours = s.kind === 'd' ? `${db.settings.dayStart} – ${db.settings.dayEnd}`
    : s.kind === 'n' ? `${db.settings.nightStart} – ${db.settings.nightEnd}` : '';
  return { code, off, s, pos, override: !!ov, base: CYCLE[off], hours };
}

// Bloque de trabajo (subida → bajada) que contiene el día, según la secuencia base
function workBlock(iso) {
  const off = baseOffset(iso);
  const n = dnum(iso);
  if (off <= 7) return { kind: 'n', from: diso(n - off), to: diso(n - off + 7) };
  if (off >= 14 && off <= 21) return { kind: 'd', from: diso(n - (off - 14)), to: diso(n - (off - 21)) };
  return null;
}
function restBlock(iso) {
  const off = baseOffset(iso), n = dnum(iso);
  if (off >= 8 && off <= 13) return { from: diso(n - (off - 8)), to: diso(n + (13 - off)) };
  if (off >= 22) return { from: diso(n - (off - 22)), to: diso(n + (27 - off)) };
  return null;
}

function findNext(fromIso, test, max = 400) {
  const n0 = dnum(fromIso);
  for (let k = 0; k <= max; k++) { const iso = diso(n0 + k); if (test(shiftCode(iso), iso)) return { iso, k }; }
  return null;
}

/* Eventos */
const catById = (id) => db.categories.find((c) => c.id === id) || { id, name: 'Otro', emoji: '📌', color: '#5b6b7a' };
function eventsOn(iso) { return db.events.filter((e) => e.from <= iso && iso <= e.to).sort((a, b) => a.from.localeCompare(b.from)); }
function eventsInRange(a, b) { return db.events.filter((e) => e.from <= b && e.to >= a).sort((x, y) => x.from.localeCompare(y.from)); }
const evDays = (e) => dnum(e.to) - dnum(e.from) + 1;

/* =========================================================
   Estado de la interfaz
   ========================================================= */
const ui = {
  tab: 'hoy',
  y: Number(todayISO().slice(0, 4)),
  m: Number(todayISO().slice(5, 7)),
  year: Number(todayISO().slice(0, 4)),
};
try { const t = localStorage.getItem(STORE_KEY + ':tab'); if (['hoy', 'mes', 'anio', 'resumen'].includes(t)) ui.tab = t; } catch (e) { /* */ }

const view = $('#view');
const sheet = $('#sheet');
const backdrop = $('#backdrop');

function applyTheme() {
  const t = db.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

const TITLES = { hoy: 'Hoy', mes: 'Calendario', anio: 'Año', resumen: 'Resumen', ajustes: 'Ajustes' };

function render() {
  applyTheme();
  $('#title').textContent = TITLES[ui.tab];
  document.querySelectorAll('.tabbar .tab[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const nav = $('#periodNav');
  nav.hidden = !['mes', 'anio', 'resumen'].includes(ui.tab);
  if (ui.tab === 'mes') $('#periodLabel').textContent = `${MONTHS[ui.m - 1]} ${ui.y}`;
  else $('#periodLabel').textContent = String(ui.year);
  const fn = { hoy: viewHoy, mes: viewMes, anio: viewAnio, resumen: viewResumen, ajustes: viewAjustes }[ui.tab];
  view.innerHTML = fn();
}

/* =========================================================
   Vista: Hoy
   ========================================================= */
function viewHoy() {
  const t = todayISO();
  const info = shiftInfo(t);
  const evs = eventsOn(t);
  const hol = holidayName(t);
  const name = db.settings.name ? `Hola, ${esc(db.settings.name)} · ` : '';
  let title = info.s.name, sub = info.pos || '';
  if (info.s.desc && !info.override) sub = sub ? `${sub} · ${info.s.desc}` : info.s.desc;
  if (info.hours) sub += `${sub ? ' · ' : ''}${info.hours}`;
  if (info.override) sub = `Cambiado manualmente${info.hours ? ' · ' + info.hours : ''}`;

  // Progreso del bloque actual
  let progress = '';
  const wb = workBlock(t);
  const rb = restBlock(t);
  if (!info.override && wb) {
    const total = dnum(wb.to) - dnum(wb.from) + 1;
    const done = dnum(t) - dnum(wb.from) + 1;
    const left = dnum(wb.to) - dnum(t);
    const lbl = wb.kind === 'n' ? 'Turno de noche' : 'Turno de día';
    progress = `<div class="progress"><div class="meter ${wb.kind}"><span style="width:${(done / total) * 100}%"></span></div>
      <div class="row"><span>${lbl}: ${fmtDM(wb.from)} → ${fmtDM(wb.to)}</span><span>${left === 0 ? 'Bajas hoy' : `Bajas ${inDays(left)}`}</span></div></div>`;
  } else if (!info.override && rb) {
    const total = dnum(rb.to) - dnum(rb.from) + 1;
    const done = dnum(t) - dnum(rb.from) + 1;
    progress = `<div class="progress"><div class="meter l"><span style="width:${(done / total) * 100}%"></span></div>
      <div class="row"><span>Descanso: ${fmtDM(rb.from)} → ${fmtDM(rb.to)}</span><span>Subes ${inDays(dnum(rb.to) - dnum(t) + 1)}</span></div></div>`;
  }

  const banners = evs.map((e) => {
    const c = catById(e.cat);
    return `<button class="ev-banner" style="background:color-mix(in srgb, ${c.color} 16%, transparent);width:100%;text-align:left" data-action="edit-event" data-id="${e.id}">
      <span>${c.emoji}</span><span style="flex:1">${esc(c.name)}${e.note ? ` · <span class="sub">${esc(e.note)}</span>` : ''}</span>
      <span class="small muted">${e.from === e.to ? '' : `hasta ${fmtDM(e.to)}`}</span></button>`;
  }).join('');

  const hero = `<section class="card">
    <button class="today" data-action="day" data-date="${t}" style="width:100%;text-align:left">
      <div class="big-ico ${info.s.kind === 'd' ? 'd' : info.s.kind === 'n' ? 'n' : ''}">${info.s.icon}</div>
      <div style="min-width:0">
        <div class="t-date cap">${name}${fmtLong(t)}${hol ? ` · 🎉 ${esc(hol)}` : ''}</div>
        <div class="t-title">${evs.length ? `${catById(evs[0].cat).emoji} ${esc(catById(evs[0].cat).name)}` : esc(title)}</div>
        <div class="t-sub">${evs.length ? `Turno: ${esc(info.s.name)}${info.pos ? ' · ' + info.pos : ''}` : esc(sub)}</div>
      </div>
    </button>
    ${progress}
    ${banners}
  </section>`;

  // Próxima subida / bajada
  const nUp = findNext(addDays(t, 1), (c) => c === 'NS' || c === 'DS');
  const nDown = findNext(t, (c) => c === 'NB' || c === 'DB');
  const upTxt = nUp ? (shiftCode(nUp.iso) === 'NS' ? 'turno de noche' : 'turno de día') : '';
  const next = `<div class="next-grid">
    <button class="card" data-action="day" data-date="${nUp ? nUp.iso : t}" style="text-align:left">
      <div class="k">⬆️ Próxima subida</div>
      <div class="v">${nUp ? (nUp.k + 1 === 1 ? 'Mañana' : `En ${nUp.k + 1} días`) : '—'}</div>
      <div class="w">${nUp ? `${fmtShort(nUp.iso)} · ${upTxt}` : ''}</div>
    </button>
    <button class="card" data-action="day" data-date="${nDown ? nDown.iso : t}" style="text-align:left">
      <div class="k">⬇️ Próxima bajada</div>
      <div class="v">${nDown ? (nDown.k === 0 ? 'Hoy' : nDown.k === 1 ? 'Mañana' : `En ${nDown.k} días`) : '—'}</div>
      <div class="w">${nDown ? `${fmtShort(nDown.iso)} · ${shiftCode(nDown.iso) === 'NB' ? 'en la mañana' : 'en la noche'}` : ''}</div>
    </button>
  </div>`;

  // Próximos 21 días
  let strip = '';
  for (let k = 0; k < 21; k++) {
    const iso = addDays(t, k);
    const si = shiftInfo(iso);
    const dots = eventsOn(iso).slice(0, 3).map((e) => `<i style="background:${catById(e.cat).color}"></i>`).join('');
    strip += `<button class="${si.s.cls === 'd' || si.s.cls === 'n' ? si.s.cls : ''} ${k === 0 ? 'is-today' : ''}" data-action="day" data-date="${iso}">
      <span class="wd"${isRed(iso) ? ' style="color:var(--red-ink)"' : ''}>${WD_S[dow(iso)]}</span>
      <span class="dn">${Number(iso.slice(8))}</span>
      <span class="ic">${si.s.kind === 'l' ? '' : si.s.icon}</span>
      <span class="evd">${dots}</span>
    </button>`;
  }
  const stripCard = `<section class="card"><div class="card-head"><h2>Próximos días</h2>
    <button class="link" data-action="go" data-tab="mes">Ver mes</button></div>
    <div class="strip">${strip}</div></section>`;

  // Próximos eventos
  const up = db.events.filter((e) => e.to >= t).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 6);
  const evCard = `<section class="card"><div class="card-head"><h2>Vacaciones, permisos y más</h2>
    <button class="link" data-action="add">Agregar</button></div>
    ${up.length ? `<ul class="list">${up.map(eventItem).join('')}</ul>` : `<div class="empty"><div class="big">🗓️</div>Aún no tienes nada agendado.<br>Toca <b>+</b> para agregar vacaciones, permisos, cursos…</div>`}
  </section>`;

  return hero + next + stripCard + evCard + backupReminder();
}

function eventItem(e) {
  const c = catById(e.cat);
  const n = evDays(e);
  const t = todayISO();
  const when = e.from > t ? inDays(dnum(e.from) - dnum(t)) : e.to >= t ? 'en curso' : '';
  return `<li><button class="item ev-item" data-action="edit-event" data-id="${e.id}" style="--evc:${c.color}">
    <span class="emoji">${c.emoji}</span>
    <span class="main"><div class="t1">${esc(c.name)}${e.note ? ` <span class="muted">· ${esc(e.note)}</span>` : ''}</div>
      <div class="t2">${fmtRange(e.from, e.to)}${when ? ' · ' + when : ''}</div></span>
    <span class="amt">${n} ${n === 1 ? 'día' : 'días'}</span>
  </button></li>`;
}

function backupReminder() {
  if (!db.events.length && !Object.keys(db.overrides).length) return '';
  const last = db.settings.lastBackup ? new Date(db.settings.lastBackup).getTime() : 0;
  if (Date.now() - last < 30 * DAY) return '';
  return `<section class="card"><div class="row"><span style="font-size:22px">💾</span>
    <div class="main" style="flex:1"><div class="t1" style="font-weight:600">Haz un respaldo</div>
    <div class="t2 muted small">Guarda tus datos en iCloud por si cambias de teléfono.</div></div>
    <button class="btn sm primary" data-action="export-json">Respaldar</button></div></section>`;
}

/* =========================================================
   Vista: Mes
   ========================================================= */
function cellHTML(iso, opts = {}) {
  const si = shiftInfo(iso);
  const evs = eventsOn(iso);
  const t = todayISO();
  const cls = ['cell', si.s.cls, iso === t ? 'is-today' : '', evs.length ? 'has-ev' : ''].join(' ');
  const mark = si.s.mark === 'up' ? '<span class="mk up">↑</span>' : si.s.mark === 'down' ? '<span class="mk down">↓</span>' : '';
  let ic = '';
  if (si.code === 'NS' || si.code === 'N') ic = '🌙';
  else if (si.code === 'D' || si.code === 'DB') ic = '☀️';
  else if (si.code === 'DS') ic = '<span class="ic faded">☀️</span>';
  else if (si.code === 'NB') ic = '<span class="ic faded">🌙</span>';
  const icon = ic.startsWith('<') ? ic : `<span class="ic">${ic}</span>`;
  const emo = evs.slice(0, 2).map((e) => catById(e.cat).emoji).join('');
  const bar = evs.length ? `<span class="bar">${evs.slice(0, 3).map((e) => `<i style="background:${catById(e.cat).color}"></i>`).join('')}</span>` : '';
  const note = db.notes[iso] ? '<span class="nt"></span>' : '';
  const ov = si.override ? '<span class="ov">✎</span>' : '';
  return `<button class="${cls}" data-action="day" data-date="${iso}" aria-label="${fmtLong(iso)}: ${si.s.name}${evs.map((e) => ', ' + catById(e.cat).name).join('')}">
    <span class="dn${isRed(iso) ? ' red' : ''}">${Number(iso.slice(8))}</span>${mark}${note}
    ${icon}<span class="evs">${emo}</span>${ov}${bar}</button>`;
}

function monthCounts(from, to) {
  const c = { d: 0, n: 0, l: 0, s: 0, b: 0 };
  for (let k = dnum(from); k <= dnum(to); k++) c[SHIFTS[shiftCode(diso(k))].kind]++;
  return c;
}

function viewMes() {
  const { y, m } = ui;
  const first = ymd(y, m, 1);
  const last = ymd(y, m, daysInMonth(y, m));
  const lead = (dow(first) + 6) % 7;
  let grid = WD_H.map((w, i) => `<div class="wh${i >= 5 ? ' we' : ''}">${w}</div>`).join('');
  for (let i = 0; i < lead; i++) grid += '<div class="cell blank"></div>';
  for (let d = 1; d <= daysInMonth(y, m); d++) grid += cellHTML(ymd(y, m, d));

  const c = monthCounts(first, last);
  const evs = eventsInRange(first, last);
  const hol = db.settings.holidays ? Object.entries(holidays(y)).filter(([k]) => k >= first && k <= last) : [];

  return `<section class="card" id="monthCard" style="padding:12px 10px">
      <div class="cal">${grid}</div>
      <div class="legend-row">
        <span><i style="background:var(--sun-wash)"></i>☀️ Día</span>
        <span><i style="background:var(--moon-wash)"></i>🌙 Noche</span>
        <span><b class="pos">↑</b> Subida</span>
        <span><b class="neg">↓</b> Bajada</span>
        <span><i style="background:var(--card-2)"></i>Descanso</span>
      </div>
    </section>
    <section class="card"><div class="card-head"><h2>Este mes</h2></div>
      <div class="counts">
        <div class="d"><div class="v">${c.d}</div><div class="k">Días</div></div>
        <div class="n"><div class="v">${c.n}</div><div class="k">Noches</div></div>
        <div><div class="v">${c.l + c.b}</div><div class="k">Descanso</div></div>
        <div><div class="v">${c.s}</div><div class="k">Subidas</div></div>
      </div>
      <p class="note">Toca un día para ver el detalle, agregar vacaciones, permisos o cursos, o cambiar el turno de ese día.</p>
    </section>
    <section class="card"><div class="card-head"><h2>Agendado en ${MONTHS[m - 1]}</h2><button class="link" data-action="add">Agregar</button></div>
      ${evs.length ? `<ul class="list">${evs.map(eventItem).join('')}</ul>` : '<p class="sub">Nada agendado este mes.</p>'}
      ${hol.length ? `<div class="section-title" style="margin-left:0">Feriados</div><ul class="list">${hol.map(([k, v]) => `<li class="item" style="padding:6px 0"><span class="main"><div class="t1">🎉 ${esc(v)}</div><div class="t2">${fmtLong(k)}</div></span></li>`).join('')}</ul>` : ''}
    </section>`;
}

/* =========================================================
   Vista: Año
   ========================================================= */
function viewAnio() {
  const y = ui.year;
  const t = todayISO();
  let html = '<div class="year">';
  for (let m = 1; m <= 12; m++) {
    const first = ymd(y, m, 1);
    const lead = (dow(first) + 6) % 7;
    let g = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w) => `<span class="h">${w}</span>`).join('');
    for (let i = 0; i < lead; i++) g += '<span></span>';
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const iso = ymd(y, m, d);
      const si = shiftInfo(iso);
      const ev = eventsOn(iso)[0];
      const cls = [si.s.cls === 'l' ? '' : si.s.cls, isRed(iso) ? 'red' : '', ev ? 'ev' : '', iso === t ? 'td' : ''].join(' ').trim();
      g += `<span class="${cls}"${ev ? ` style="--evc:${catById(ev.cat).color}"` : ''}>${d}</span>`;
    }
    html += `<button class="mini" data-action="open-month" data-y="${y}" data-m="${m}"><h3>${MONTHS[m - 1]}</h3><div class="g">${g}</div></button>`;
  }
  html += '</div>';
  const cats = db.categories.filter((c) => db.events.some((e) => e.cat === c.id && e.from.slice(0, 4) <= String(y) && e.to.slice(0, 4) >= String(y)));
  return `${html}
    <section class="card" style="margin-top:12px">
      <div class="legend-row" style="margin-top:0">
        <span><i style="background:var(--sun-wash)"></i>Turno de día</span>
        <span><i style="background:var(--moon-wash)"></i>Turno de noche</span>
        <span><i style="background:linear-gradient(135deg, transparent 50%, var(--sun-wash) 50%)"></i>Subida</span>
        <span><i style="background:linear-gradient(135deg, var(--moon-wash) 50%, transparent 50%)"></i>Bajada</span>
        ${cats.map((c) => `<span><i style="background:${c.color}"></i>${c.emoji} ${esc(c.name)}</span>`).join('')}
      </div>
      <p class="note">Toca un mes para abrirlo y editarlo.</p>
    </section>`;
}

/* =========================================================
   Vista: Resumen
   ========================================================= */
function viewResumen() {
  const y = ui.year;
  const from = ymd(y, 1, 1), to = ymd(y, 12, 31);
  const c = monthCounts(from, to);
  // Días por categoría (sin contar dos veces el mismo día)
  const perCat = db.categories.map((cat) => {
    const days = new Set();
    let work = 0;
    db.events.filter((e) => e.cat === cat.id).forEach((e) => {
      for (let k = Math.max(dnum(e.from), dnum(from)); k <= Math.min(dnum(e.to), dnum(to)); k++) {
        const iso = diso(k);
        if (!days.has(iso)) { days.add(iso); const kd = SHIFTS[shiftCode(iso)].kind; if (kd === 'd' || kd === 'n') work++; }
      }
    });
    return { cat, days: days.size, work };
  }).filter((r) => r.days > 0);

  const cur = todayISO().slice(0, 7);
  const rows = MONTHS.map((mn, i) => {
    const a = ymd(y, i + 1, 1), b = ymd(y, i + 1, daysInMonth(y, i + 1));
    const mc = monthCounts(a, b);
    const evd = new Set();
    eventsInRange(a, b).forEach((e) => { for (let k = Math.max(dnum(e.from), dnum(a)); k <= Math.min(dnum(e.to), dnum(b)); k++) evd.add(k); });
    return `<tr class="${`${y}-${pad(i + 1)}` === cur ? 'cur' : ''}"><td>${mn}</td><td>${mc.d}</td><td>${mc.n}</td><td>${mc.l + mc.b}</td><td>${mc.s}</td><td>${evd.size || ''}</td></tr>`;
  }).join('');

  return `<section class="card"><div class="card-head"><h2>Año ${y}</h2></div>
      <div class="counts">
        <div class="d"><div class="v">${c.d}</div><div class="k">Días ☀️</div></div>
        <div class="n"><div class="v">${c.n}</div><div class="k">Noches 🌙</div></div>
        <div><div class="v">${c.l + c.b}</div><div class="k">Descanso</div></div>
        <div><div class="v">${c.s}</div><div class="k">Subidas</div></div>
      </div>
      <p class="note">Total de días de trabajo: <b>${c.d + c.n}</b>. Los martes de subida al turno de día se cuentan como “Subidas”; los martes de bajada del turno de noche, como descanso.</p>
    </section>
    <section class="card"><div class="card-head"><h2>Vacaciones, permisos y más</h2></div>
      ${perCat.length ? `<ul class="list">${perCat.map((r) => `<li class="item"><span class="emoji" style="box-shadow:inset 0 -3px 0 ${r.cat.color}">${r.cat.emoji}</span>
        <span class="main"><div class="t1">${esc(r.cat.name)}</div><div class="t2">${r.work} ${r.work === 1 ? 'era día' : 'eran días'} de turno</div></span>
        <span class="amt">${r.days} ${r.days === 1 ? 'día' : 'días'}</span></li>`).join('')}</ul>`
        : '<p class="sub">Aún no hay nada agendado este año.</p>'}
    </section>
    <section class="card"><div class="card-head"><h2>Por mes</h2></div>
      <table class="data"><thead><tr><th>Mes</th><th>☀️</th><th>🌙</th><th>Desc.</th><th>⬆️</th><th>📌</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="note">📌 = días con vacaciones, permisos, cursos u otros.</p>
    </section>`;
}

/* =========================================================
   Vista: Ajustes
   ========================================================= */
function cycleHTML() {
  return `<div class="cycle">${CYCLE.map((c, i) => {
    const s = SHIFTS[c];
    const lbl = c === 'NS' || c === 'N' ? '🌙' : c === 'D' || c === 'DB' ? '☀️' : c === 'DS' ? '↑' : c === 'NB' ? '↓' : '';
    return `<span class="${s.cls}" title="${WD_S[(2 + i) % 7]}">${lbl}</span>`;
  }).join('')}</div>
  <div class="row small muted" style="justify-content:space-between"><span>mar</span><span>28 días · se repite</span><span>lun</span></div>`;
}

function viewAjustes() {
  const s = db.settings;
  const anchorOk = dow(s.anchor) === 2;
  return `<div class="section-title">Mi turno 7x7</div>
    <section class="card">
      <p class="sub">El ciclo dura 28 días y se repite siempre igual:</p>
      ${cycleHTML()}
      <ol class="steps">
        <li><b>Martes</b>: subo a faena y comienza el turno de <b>noche</b> (7 noches, de martes a lunes).</li>
        <li><b>Martes</b> en la mañana: termina la noche y <b>bajo</b>. Descanso miércoles a lunes.</li>
        <li><b>Martes</b>: <b>subo</b> a faena. Turno de <b>día</b> de miércoles a martes; ese martes bajo en la noche.</li>
        <li>Descanso miércoles a lunes y vuelve a empezar.</li>
      </ol>
      <div class="field" style="margin-top:14px">
        <label for="anchor">Un martes en que subes a turno de noche</label>
        <input class="input" type="date" id="anchor" data-setting="anchor" value="${s.anchor}">
        ${anchorOk ? '' : '<span class="small neg">⚠️ Esa fecha no es martes. Revisa que sea correcta.</span>'}
      </div>
      <p class="note">Viene configurado según tu calendario 2026 (noche desde el martes 6 de enero). Si la empresa corre la secuencia, cambia esta fecha y todo el calendario se ajusta solo. Tus vacaciones, permisos y cambios se mantienen.</p>
      ${s.anchor !== DEFAULT_ANCHOR ? '<button class="btn block" data-action="reset-anchor" style="margin-top:8px">Volver a la secuencia 2026 original</button>' : ''}
    </section>

    <div class="section-title">Horarios</div>
    <section class="card">
      <div class="field-row">
        <div class="field"><label>☀️ Día: entrada</label><input class="input" type="time" data-setting="dayStart" value="${s.dayStart}"></div>
        <div class="field"><label>Salida</label><input class="input" type="time" data-setting="dayEnd" value="${s.dayEnd}"></div>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0"><label>🌙 Noche: entrada</label><input class="input" type="time" data-setting="nightStart" value="${s.nightStart}"></div>
        <div class="field" style="margin-bottom:0"><label>Salida</label><input class="input" type="time" data-setting="nightEnd" value="${s.nightEnd}"></div>
      </div>
    </section>

    <div class="section-title">Categorías</div>
    <section class="card">
      <ul class="list">${db.categories.map((c) => `<li><button class="item" data-action="edit-cat" data-id="${c.id}">
        <span class="emoji" style="box-shadow:inset 0 -3px 0 ${c.color}">${c.emoji}</span>
        <span class="main"><div class="t1">${esc(c.name)}</div></span><span class="chev">›</span></button></li>`).join('')}</ul>
      <button class="btn block" data-action="edit-cat" style="margin-top:8px">+ Nueva categoría</button>
    </section>

    <div class="section-title">Calendario del iPhone</div>
    <section class="card">
      <p class="sub">Exporta tus turnos y vacaciones al Calendario del iPhone, con aviso el día antes de cada subida.</p>
      <button class="btn block primary" data-action="ics-sheet" style="margin-top:12px">📅 Exportar al Calendario</button>
    </section>

    <div class="section-title">General</div>
    <section class="card">
      <div class="field"><label for="nm">Tu nombre (opcional)</label><input class="input" id="nm" data-setting="name" value="${esc(s.name)}" placeholder="Ej: Eduardo"></div>
      <div class="switch-row"><span>🎉 Mostrar feriados de Chile</span>
        <label class="switch"><input type="checkbox" data-setting="holidays" ${s.holidays ? 'checked' : ''}><span></span></label></div>
      <div class="field" style="margin:10px 0 0"><span class="lbl">Tema</span>
        <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button data-action="theme" data-v="${v}" class="${s.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    </section>

    <div class="section-title">Respaldo</div>
    <section class="card">
      <p class="sub">Tus datos se guardan solo en este iPhone. Guarda un respaldo en iCloud Drive (Archivos) de vez en cuando.</p>
      <div class="btn-row"><button class="btn" data-action="export-json">Exportar respaldo</button><button class="btn" data-action="import-json">Importar</button></div>
      <p class="note">${s.lastBackup ? `Último respaldo: ${fmtLong(new Date(s.lastBackup).toISOString().slice(0, 10))}.` : 'Aún no has hecho un respaldo.'}</p>
      <button class="btn block danger" data-action="wipe" style="margin-top:10px">Borrar vacaciones, permisos y cambios</button>
    </section>
    <p class="note" style="text-align:center;margin:18px 0">Turnos 7x7 · funciona sin internet</p>`;
}

/* =========================================================
   Hojas (sheets)
   ========================================================= */
function openSheet(html) {
  sheet.innerHTML = `<div class="grabber"></div>${html}`;
  sheet.hidden = false; backdrop.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  sheet.hidden = true; backdrop.hidden = true; sheet.innerHTML = '';
  document.body.style.overflow = '';
  sheetCtx = {};
}

let sheetCtx = {};

function openDay(iso) {
  sheetCtx = { day: iso };
  const si = shiftInfo(iso);
  const evs = eventsOn(iso);
  const hol = holidayName(iso);
  const wb = workBlock(iso);
  let blockTxt = '';
  if (wb && !si.override) {
    blockTxt = wb.kind === 'n'
      ? `Bloque de noche: sube ${fmtShort(wb.from)} · baja ${fmtShort(wb.to)} en la mañana`
      : `Bloque de día: sube ${fmtShort(wb.from)} · baja ${fmtShort(wb.to)} en la noche`;
  } else if (!si.override) {
    const rb = restBlock(iso);
    if (rb) blockTxt = `Descanso del ${fmtShort(rb.from)} al ${fmtShort(rb.to)}`;
  }
  const desc = [si.pos, si.override ? `Cambiado manualmente (normalmente: ${SHIFTS[si.base].name})` : si.s.desc, si.hours].filter(Boolean).join(' · ');
  openSheet(`<div class="sheet-head"><h2 class="cap">${fmtLong(iso)}</h2><button class="link strong" data-action="close-sheet">Listo</button></div>
    ${hol ? `<p class="sub" style="margin:-6px 0 10px">🎉 Feriado: ${esc(hol)}</p>` : ''}
    <div class="shift-box ${si.s.kind === 'd' ? 'd' : si.s.kind === 'n' ? 'n' : ''}">
      <span class="ic">${si.s.icon}</span>
      <div><div class="t1">${si.s.name}</div><div class="t2">${esc(desc)}</div></div>
    </div>
    ${blockTxt ? `<p class="note">${blockTxt}</p>` : ''}

    ${evs.length ? `<div class="section-title">Este día</div><ul class="list">${evs.map(eventItem).join('')}</ul>` : ''}

    <div class="section-title">Agregar a este día</div>
    <div class="cat-grid">${db.categories.map((c) => `<button class="cat-opt" data-action="new-event" data-cat="${c.id}" data-date="${iso}">
      <span class="e">${c.emoji}</span>${esc(c.name)}<span class="sw" style="background:${c.color}"></span></button>`).join('')}</div>

    <div class="section-title">Cambiar el turno de este día</div>
    <div class="seg grid3">${OVERRIDE_OPTS.map(([v, l]) => `<button data-action="override" data-v="${v}" class="${(db.overrides[iso] || '') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p class="note">Úsalo si cambias un turno puntual. “Auto” vuelve a la secuencia normal 7x7.</p>

    <div class="section-title">Nota</div>
    <textarea class="input" id="dayNote" rows="3" style="min-height:80px" placeholder="Ej: llevar EPP, reunión, vuelo 7:30…">${esc(db.notes[iso] || '')}</textarea>
  `);
}

function saveDayNote() {
  const ta = $('#dayNote', sheet);
  if (!ta || !sheetCtx.day) return;
  const v = ta.value.trim();
  if ((db.notes[sheetCtx.day] || '') === v) return;
  if (v) db.notes[sheetCtx.day] = v; else delete db.notes[sheetCtx.day];
  save();
}

function openEvent(opts = {}) {
  const existing = opts.id ? db.events.find((e) => e.id === opts.id) : null;
  const e = existing ? { ...existing } : { cat: opts.cat || db.categories[0].id, from: opts.date || todayISO(), to: opts.date || todayISO(), note: '' };
  sheetCtx = { event: e, id: existing ? existing.id : null, returnDay: opts.returnDay || null };
  renderEventSheet();
}

function renderEventSheet() {
  const { event: e, id } = sheetCtx;
  const n = e.to >= e.from ? evDays(e) : 0;
  const wb = workBlock(e.from);
  const rb = restBlock(e.from);
  // Cuántos días de turno cubre
  let work = 0;
  if (n > 0 && n < 800) for (let k = dnum(e.from); k <= dnum(e.to); k++) { const kd = SHIFTS[shiftCode(diso(k))].kind; if (kd === 'd' || kd === 'n') work++; }
  openSheet(`<div class="sheet-head">
      <button class="link" data-action="close-sheet">Cancelar</button>
      <h2>${id ? 'Editar' : 'Agregar'}</h2>
      <button class="link strong" data-action="save-event">Guardar</button></div>
    <div class="field"><span class="lbl">Tipo</span>
      <div class="cat-grid">${db.categories.map((c) => `<button class="cat-opt ${e.cat === c.id ? 'on' : ''}" data-action="pick-cat" data-cat="${c.id}">
        <span class="e">${c.emoji}</span>${esc(c.name)}<span class="sw" style="background:${c.color}"></span></button>`).join('')}</div></div>
    <div class="field-row">
      <div class="field"><label for="evFrom">Desde</label><input class="input" type="date" id="evFrom" value="${e.from}"></div>
      <div class="field"><label for="evTo">Hasta</label><input class="input" type="date" id="evTo" value="${e.to}"></div>
    </div>
    <div class="chips" style="margin:-4px 0 12px">
      <button class="chip" data-action="ev-range" data-r="day">Solo un día</button>
      ${wb ? `<button class="chip" data-action="ev-range" data-r="block">Todo el turno de ${wb.kind === 'n' ? 'noche' : 'día'} (${fmtDM(wb.from)}–${fmtDM(wb.to)})</button>` : ''}
      ${rb ? `<button class="chip" data-action="ev-range" data-r="rest">Todo el descanso (${fmtDM(rb.from)}–${fmtDM(rb.to)})</button>` : ''}
      <button class="chip" data-action="ev-range" data-r="next">Mi próximo turno</button>
    </div>
    <p class="sub" id="evSummary">${n > 0 ? `<b>${n}</b> ${n === 1 ? 'día' : 'días'} · ${work} ${work === 1 ? 'es día' : 'son días'} de turno` : '<span class="neg">“Hasta” debe ser igual o posterior a “Desde”.</span>'}</p>
    <div class="field" style="margin-top:12px"><label for="evNote">Nota (opcional)</label>
      <input class="input" id="evNote" value="${esc(e.note || '')}" placeholder="Ej: Curso de altura, trámite, viaje…"></div>
    ${id ? `<div class="btn-row"><button class="btn" data-action="dup-event">Duplicar</button><button class="btn danger" data-action="del-event">Eliminar</button></div>` : ''}
  `);
}

function readEventForm() {
  const e = sheetCtx.event;
  const f = $('#evFrom', sheet), t = $('#evTo', sheet), nt = $('#evNote', sheet);
  if (f && isISO(f.value)) e.from = f.value;
  if (t && isISO(t.value)) e.to = t.value;
  if (nt) e.note = nt.value.trim();
}

function afterEventSheet() {
  const back = sheetCtx.returnDay;
  if (back) openDay(back); else closeSheet();
  render();
}

function openCat(id) {
  const c = id ? db.categories.find((x) => x.id === id) : { id: null, name: '', emoji: '📌', color: COLORS[db.categories.length % COLORS.length] };
  sheetCtx = { cat: { ...c } };
  renderCatSheet();
}
function renderCatSheet() {
  const c = sheetCtx.cat;
  const used = c.id ? db.events.filter((e) => e.cat === c.id).length : 0;
  openSheet(`<div class="sheet-head"><button class="link" data-action="close-sheet">Cancelar</button>
      <h2>${c.id ? 'Categoría' : 'Nueva categoría'}</h2><button class="link strong" data-action="save-cat">Guardar</button></div>
    <div class="field-row" style="grid-template-columns:auto 1fr">
      <div class="field"><label>Emoji</label><input class="input emoji-input" id="catEmoji" value="${esc(c.emoji)}" maxlength="4"></div>
      <div class="field"><label>Nombre</label><input class="input" id="catName" value="${esc(c.name)}" placeholder="Ej: Capacitación"></div>
    </div>
    <div class="field"><span class="lbl">Color</span>
      <div class="colors">${COLORS.map((col) => `<button data-action="cat-color" data-c="${col}" class="${c.color === col ? 'on' : ''}" style="background:${col}" aria-label="Color ${col}"></button>`).join('')}</div></div>
    ${c.id ? `<button class="btn block danger" data-action="del-cat" style="margin-top:8px">Eliminar categoría${used ? ` (y sus ${used} registros)` : ''}</button>` : ''}`);
}

/* Exportar a Calendario (.ics) */
function openIcsSheet() {
  const y = Number(todayISO().slice(0, 4));
  sheetCtx = { ics: { year: y } };
  openSheet(`<div class="sheet-head"><button class="link" data-action="close-sheet">Cerrar</button><h2>Calendario iPhone</h2><span style="width:60px"></span></div>
    <div class="field"><span class="lbl">Año</span>
      <div class="seg">${[y - 1, y, y + 1].map((v) => `<button data-action="ics-year" data-v="${v}" class="${v === y ? 'on' : ''}">${v}</button>`).join('')}</div></div>
    <label class="chk-row"><input type="checkbox" id="icsShifts" checked> Turnos de día y noche (con horario)</label>
    <label class="chk-row"><input type="checkbox" id="icsEvents" checked> Vacaciones, permisos, cursos…</label>
    <label class="chk-row"><input type="checkbox" id="icsAlarm" checked> Aviso el día antes de cada subida</label>
    <div class="btn-row" style="flex-direction:column">
      <button class="btn primary block" data-action="ics-open">Abrir en Calendario</button>
      <button class="btn block" data-action="ics-share">Compartir / guardar archivo .ics</button>
    </div>
    <ol class="steps" style="margin-top:12px">
      <li>Toca <b>Abrir en Calendario</b> y luego <b>Agregar todo</b>.</li>
      <li>Si no se abre, usa <b>Compartir</b> → <b>Guardar en Archivos</b>, abre el archivo desde la app Archivos y toca <b>Agregar todo</b>.</li>
      <li>Consejo: elige o crea un calendario llamado “Turnos” para poder ocultarlo o borrarlo fácilmente.</li>
    </ol>
    <p class="note">Si después cambias algo aquí, vuelve a exportar (borra antes el calendario “Turnos” anterior para no duplicar).</p>`);
}

function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function icsFold(line) {
  const out = []; let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
  out.push(s); return out.join('\r\n');
}
function buildICS(year, opt) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Turnos 7x7//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Turnos'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const D = (iso) => iso.replace(/-/g, '');
  const T = (iso, hm) => `${D(iso)}T${hm.replace(':', '')}00`;
  const ev = (uid, props, alarm) => {
    L.push('BEGIN:VEVENT', `UID:${uid}@turnos7x7`, `DTSTAMP:${stamp}`, ...props);
    if (alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(alarm.text)}`, `TRIGGER:${alarm.trigger}`, 'END:VALARM');
    L.push('END:VEVENT');
  };
  const s = db.settings;
  const from = dnum(ymd(year, 1, 1)), to = dnum(ymd(year, 12, 31));
  if (opt.shifts) {
    // Agrupar días consecutivos del mismo tipo (respeta cambios manuales)
    let k = from - 10;
    while (k <= to + 10) {
      const code = shiftCode(diso(k));
      const kind = SHIFTS[code].kind;
      if (kind === 'd' || kind === 'n') {
        let e = k;
        while (SHIFTS[shiftCode(diso(e + 1))].kind === kind) e++;
        if (k >= from && k <= to) {
          const a = diso(k), b = diso(e);
          const nd = e - k + 1;
          if (kind === 'n') {
            ev(`n-${a}`, [`DTSTART:${T(a, s.nightStart)}`, `DTEND:${T(diso(e + 1), s.nightEnd)}`,
              `SUMMARY:${icsText(`🌙 Turno de noche (${nd} ${nd === 1 ? 'noche' : 'noches'})`)}`,
              `DESCRIPTION:${icsText(`Subida a faena: ${fmtLong(a)}.\nÚltima noche: ${fmtLong(b)}.\nBajada: ${fmtLong(diso(e + 1))} en la mañana.`)}`],
              opt.alarm ? { text: 'Mañana subes a faena (turno de noche)', trigger: '-P1D' } : null);
          } else {
            ev(`d-${a}`, [`DTSTART:${T(a, s.dayStart)}`, `DTEND:${T(b, s.dayEnd)}`,
              `SUMMARY:${icsText(`☀️ Turno de día (${nd} ${nd === 1 ? 'día' : 'días'})`)}`,
              `DESCRIPTION:${icsText(`Del ${fmtLong(a)} al ${fmtLong(b)}.\nBajada de faena: ${fmtLong(b)} en la noche.`)}`]);
          }
        }
        k = e + 1;
      } else {
        if (code === 'DS' && k >= from && k <= to) {
          const a = diso(k);
          ev(`s-${a}`, [`DTSTART;VALUE=DATE:${D(a)}`, `DTEND;VALUE=DATE:${D(diso(k + 1))}`, `SUMMARY:${icsText('⬆️ Subida a faena (turno de día)')}`, 'TRANSP:TRANSPARENT'],
            opt.alarm ? { text: 'Mañana subes a faena (turno de día)', trigger: '-PT6H' } : null);
        }
        k++;
      }
    }
  }
  if (opt.events) {
    eventsInRange(ymd(year, 1, 1), ymd(year, 12, 31)).forEach((e) => {
      const c = catById(e.cat);
      ev(`e-${e.id}`, [`DTSTART;VALUE=DATE:${D(e.from)}`, `DTEND;VALUE=DATE:${D(addDays(e.to, 1))}`,
        `SUMMARY:${icsText(`${c.emoji} ${c.name}${e.note ? ' · ' + e.note : ''}`)}`, 'TRANSP:TRANSPARENT']);
    });
  }
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
function icsOptions() {
  return {
    shifts: $('#icsShifts', sheet).checked,
    events: $('#icsEvents', sheet).checked,
    alarm: $('#icsAlarm', sheet).checked,
  };
}

/* =========================================================
   Respaldo
   ========================================================= */
async function shareOrDownload(filename, content, mime) {
  const file = new File([content], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
async function exportJSON() {
  const ok = await shareOrDownload(`turnos-7x7-${todayISO()}.json`, JSON.stringify(db, null, 2), 'application/json');
  if (!ok) return;
  db.settings.lastBackup = new Date().toISOString();
  save(); render();
  toast('Respaldo exportado');
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.events) || !d.settings) throw new Error('formato');
      if (!confirm('¿Reemplazar los datos actuales por los del respaldo?')) return;
      db = normalize(d);
      save(); render();
      toast('Respaldo importado ✅');
    } catch (e) { toast('⚠️ El archivo no es un respaldo válido'); }
  };
  r.readAsText(file);
}

/* =========================================================
   Toast
   ========================================================= */
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-action="undo">Deshacer</button>' : ''}`;
  t.hidden = false;
  toast.undo = undo || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; toast.undo = null; }, undo ? 5000 : 2200);
}

/* =========================================================
   Acciones
   ========================================================= */
function go(tab) {
  ui.tab = tab;
  try { if (tab !== 'ajustes') localStorage.setItem(STORE_KEY + ':tab', tab); } catch (e) { /* */ }
  render();
  window.scrollTo(0, 0);
}

function shiftPeriod(delta) {
  if (ui.tab === 'mes') {
    let m = ui.m + delta, y = ui.y;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    ui.m = m; ui.y = y; ui.year = y;
  } else {
    ui.year += delta;
  }
  render();
}

const actions = {
  go: (el) => go(el.dataset.tab),
  period: (el) => shiftPeriod(Number(el.dataset.delta)),
  'period-today': () => { const t = todayISO(); ui.y = Number(t.slice(0, 4)); ui.m = Number(t.slice(5, 7)); ui.year = ui.y; render(); },
  'open-month': (el) => { ui.y = Number(el.dataset.y); ui.m = Number(el.dataset.m); go('mes'); },
  day: (el) => openDay(el.dataset.date),
  'close-sheet': () => { saveDayNote(); closeSheet(); render(); },
  add: () => { saveDayNote(); openEvent({ date: todayISO() }); },
  'new-event': (el) => { saveDayNote(); openEvent({ cat: el.dataset.cat, date: el.dataset.date, returnDay: el.dataset.date }); },
  'edit-event': (el) => { const from = sheetCtx.day; saveDayNote(); openEvent({ id: el.dataset.id, returnDay: from || null }); },
  'pick-cat': (el) => { readEventForm(); sheetCtx.event.cat = el.dataset.cat; renderEventSheet(); },
  'ev-range': (el) => {
    readEventForm();
    const e = sheetCtx.event;
    const r = el.dataset.r;
    if (r === 'day') e.to = e.from;
    if (r === 'block') { const b = workBlock(e.from); if (b) { e.from = b.from; e.to = b.to; } }
    if (r === 'rest') { const b = restBlock(e.from); if (b) { e.from = b.from; e.to = b.to; } }
    if (r === 'next') {
      const up = findNext(addDays(e.from, 1), (c) => c === 'NS' || c === 'DS');
      if (up) { const b = workBlock(up.iso); if (b) { e.from = b.from; e.to = b.to; } }
    }
    renderEventSheet();
  },
  'save-event': () => {
    readEventForm();
    const e = sheetCtx.event;
    if (!isISO(e.from) || !isISO(e.to)) return toast('Elige las fechas');
    if (e.to < e.from) return toast('“Hasta” debe ser igual o posterior a “Desde”');
    if (sheetCtx.id) {
      const i = db.events.findIndex((x) => x.id === sheetCtx.id);
      if (i >= 0) db.events[i] = { ...e, id: sheetCtx.id };
    } else {
      db.events.push({ ...e, id: uid() });
    }
    save();
    toast(`${catById(e.cat).emoji} ${catById(e.cat).name} guardado`);
    afterEventSheet();
  },
  'dup-event': () => {
    readEventForm();
    sheetCtx.id = null;
    sheetCtx.event = { ...sheetCtx.event };
    renderEventSheet();
    toast('Copia lista: ajusta las fechas y guarda');
  },
  'del-event': () => {
    const i = db.events.findIndex((x) => x.id === sheetCtx.id);
    if (i < 0) return;
    const [removed] = db.events.splice(i, 1);
    save();
    afterEventSheet();
    toast('Eliminado', () => { db.events.push(removed); save(); render(); });
  },
  undo: () => { const u = toast.undo; $('#toast').hidden = true; if (u) u(); },
  override: (el) => {
    const iso = sheetCtx.day;
    const v = el.dataset.v;
    if (!v || v === CYCLE[baseOffset(iso)]) delete db.overrides[iso]; else db.overrides[iso] = v;
    saveDayNote();
    save(); render(); openDay(iso);
  },
  theme: (el) => { db.settings.theme = el.dataset.v; save(); render(); },
  'reset-anchor': () => { db.settings.anchor = DEFAULT_ANCHOR; save(); render(); toast('Secuencia 2026 restablecida'); },
  'edit-cat': (el) => openCat(el.dataset.id || null),
  'cat-color': (el) => { readCatForm(); sheetCtx.cat.color = el.dataset.c; renderCatSheet(); },
  'save-cat': () => {
    readCatForm();
    const c = sheetCtx.cat;
    if (!c.name) return toast('Escribe un nombre');
    if (c.id) { const i = db.categories.findIndex((x) => x.id === c.id); if (i >= 0) db.categories[i] = c; }
    else db.categories.push({ ...c, id: uid() });
    save(); closeSheet(); render();
  },
  'del-cat': () => {
    const c = sheetCtx.cat;
    if (db.categories.length <= 1) return toast('Debe quedar al menos una categoría');
    const n = db.events.filter((e) => e.cat === c.id).length;
    if (n && !confirm(`Se eliminarán también ${n} registros de “${c.name}”. ¿Continuar?`)) return;
    db.categories = db.categories.filter((x) => x.id !== c.id);
    db.events = db.events.filter((e) => e.cat !== c.id);
    save(); closeSheet(); render();
  },
  'ics-sheet': () => openIcsSheet(),
  'ics-year': (el) => {
    sheetCtx.ics.year = Number(el.dataset.v);
    sheet.querySelectorAll('[data-action="ics-year"]').forEach((b) => b.classList.toggle('on', b === el));
  },
  'ics-open': () => {
    const txt = buildICS(sheetCtx.ics.year, icsOptions());
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  'ics-share': () => {
    const y = sheetCtx.ics.year;
    shareOrDownload(`turnos-${y}.ics`, buildICS(y, icsOptions()), 'text/calendar');
  },
  'export-json': () => exportJSON(),
  'import-json': () => $('#importFile').click(),
  wipe: () => {
    if (!confirm('¿Borrar todas las vacaciones, permisos, cursos, notas y cambios de turno? (La secuencia 7x7 se mantiene)')) return;
    db.events = []; db.overrides = {}; db.notes = {};
    save(); render(); toast('Datos borrados');
  },
};

function readCatForm() {
  const c = sheetCtx.cat;
  const n = $('#catName', sheet), e = $('#catEmoji', sheet);
  if (n) c.name = n.value.trim();
  if (e) c.emoji = e.value.trim() || '📌';
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'evFrom' || el.id === 'evTo') {
    readEventForm();
    const ev = sheetCtx.event;
    if (el.id === 'evFrom' && ev.to < ev.from) ev.to = ev.from;
    renderEventSheet();
    return;
  }
  const key = el.dataset.setting;
  if (!key) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (key === 'anchor' && !isISO(v)) return;
  if (['dayStart', 'dayEnd', 'nightStart', 'nightEnd'].includes(key) && !/^\d{2}:\d{2}$/.test(v)) return;
  if (key === 'name') v = String(v).trim().slice(0, 40);
  db.settings[key] = v;
  save(); render();
  toast('Ajuste guardado');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheet.hidden) { saveDayNote(); closeSheet(); render(); }
});

$('#importFile').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) importJSON(f);
  e.target.value = '';
});

// Deslizar en el calendario mensual para cambiar de mes
let touch = null;
view.addEventListener('touchstart', (e) => {
  if (ui.tab !== 'mes' && ui.tab !== 'anio') return;
  const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, at: Date.now() };
}, { passive: true });
view.addEventListener('touchend', (e) => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
  const fast = Date.now() - touch.at < 600;
  touch = null;
  if (fast && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftPeriod(dx < 0 ? 1 : -1);
}, { passive: true });

// Al volver a la app otro día, refrescar "Hoy"
let lastDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayISO() !== lastDay) {
    lastDay = todayISO();
    if (sheet.hidden) render();
  }
  if (document.visibilityState === 'hidden') saveDayNote();
});

/* =========================================================
   Inicio
   ========================================================= */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Para pruebas
window.__turnos = { shiftCode, shiftInfo, holidays, buildICS, CYCLE };
