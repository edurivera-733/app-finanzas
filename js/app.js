/* Mis Finanzas — app de finanzas personales (PWA, datos 100% locales) */
'use strict';

/* =========================================================
   Constantes
   ========================================================= */
const STORE_KEY = 'misfinanzas.v1';

const CURRENCIES = {
  CLP: { locale: 'es-CL', name: 'Peso chileno' },
  MXN: { locale: 'es-MX', name: 'Peso mexicano' },
  COP: { locale: 'es-CO', name: 'Peso colombiano' },
  ARS: { locale: 'es-AR', name: 'Peso argentino' },
  PEN: { locale: 'es-PE', name: 'Sol peruano' },
  UYU: { locale: 'es-UY', name: 'Peso uruguayo' },
  BOB: { locale: 'es-BO', name: 'Boliviano' },
  PYG: { locale: 'es-PY', name: 'Guaraní' },
  GTQ: { locale: 'es-GT', name: 'Quetzal' },
  CRC: { locale: 'es-CR', name: 'Colón costarricense' },
  DOP: { locale: 'es-DO', name: 'Peso dominicano' },
  USD: { locale: 'es-US', name: 'Dólar estadounidense' },
  EUR: { locale: 'es-ES', name: 'Euro' },
};
const REGION_CURRENCY = {
  CL: 'CLP', MX: 'MXN', CO: 'COP', AR: 'ARS', PE: 'PEN', UY: 'UYU', BO: 'BOB', PY: 'PYG',
  GT: 'GTQ', CR: 'CRC', DO: 'DOP', US: 'USD', EC: 'USD', SV: 'USD', PA: 'USD', ES: 'EUR',
};

const KINDS = {
  fijo: { label: 'Fijo', plural: 'Gastos fijos', color: 'var(--s-fijo)', hint: 'Arriendo, cuentas, suscripciones' },
  variable: { label: 'Variable', plural: 'Gastos variables', color: 'var(--s-variable)', hint: 'Supermercado, transporte, salidas' },
  hormiga: { label: 'Hormiga', plural: 'Gastos hormiga', color: 'var(--s-hormiga)', hint: 'Pequeños gastos diarios: café, snacks…' },
};
const KIND_ORDER = ['fijo', 'variable', 'hormiga'];

const TAB_TITLES = { inicio: 'Inicio', movimientos: 'Movimientos', fijos: 'Fijos', metas: 'Metas', ajustes: 'Ajustes' };

function defaultCategories() {
  const g = (id, emoji, name, kind, budget = 0) => ({ id, emoji, name, type: 'egreso', kind, budget });
  const i = (id, emoji, name) => ({ id, emoji, name, type: 'ingreso', kind: 'variable', budget: 0 });
  return [
    g('c-vivienda', '🏠', 'Vivienda', 'fijo'),
    g('c-servicios', '💡', 'Servicios básicos', 'fijo'),
    g('c-internet', '📱', 'Internet y telefonía', 'fijo'),
    g('c-suscripciones', '📺', 'Suscripciones', 'fijo'),
    g('c-creditos', '🏦', 'Créditos y deudas', 'fijo'),
    g('c-educacion', '🎓', 'Educación', 'fijo'),
    g('c-super', '🛒', 'Supermercado', 'variable'),
    g('c-transporte', '🚗', 'Transporte', 'variable'),
    g('c-restaurantes', '🍽️', 'Restaurantes', 'variable'),
    g('c-salud', '💊', 'Salud', 'variable'),
    g('c-compras', '🛍️', 'Compras', 'variable'),
    g('c-ocio', '🎉', 'Ocio', 'variable'),
    g('c-mascotas', '🐾', 'Mascotas', 'variable'),
    g('c-regalos', '🎁', 'Regalos', 'variable'),
    g('c-cafe', '☕', 'Café', 'hormiga'),
    g('c-snacks', '🍫', 'Snacks y antojos', 'hormiga'),
    g('c-delivery', '🛵', 'Delivery', 'hormiga'),
    g('c-apps', '🚕', 'Taxis / apps', 'hormiga'),
    g('c-otros', '📦', 'Otros gastos', 'variable'),
    i('c-sueldo', '💼', 'Sueldo'),
    i('c-freelance', '💻', 'Trabajos extra'),
    i('c-inversiones', '📈', 'Inversiones'),
    i('c-otros-ing', '💰', 'Otros ingresos'),
  ];
}

function guessCurrency() {
  const langs = navigator.languages || [navigator.language || 'es'];
  for (const l of langs) {
    const region = (l.split('-')[1] || '').toUpperCase();
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'USD';
}

function freshDB() {
  return {
    version: 1,
    settings: { currency: guessCurrency(), theme: 'auto', name: '', savingsGoalPct: 20, onboarded: false },
    categories: defaultCategories(),
    transactions: [],
    fixed: [],
    goals: [],
  };
}

/* =========================================================
   Persistencia
   ========================================================= */
const arr = (x) => (Array.isArray(x) ? x : []);

function normalize(d) {
  const base = freshDB();
  return {
    version: 1,
    settings: { ...base.settings, ...(d && d.settings) },
    categories: Array.isArray(d && d.categories) ? d.categories : base.categories,
    transactions: arr(d && d.transactions),
    fixed: arr(d && d.fixed),
    goals: arr(d && d.goals).map((g) => ({ ...g, contributions: arr(g.contributions) })),
  };
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
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (e) {
    toast('⚠️ No se pudo guardar. Exporta un respaldo.');
  }
}

/* =========================================================
   Utilidades
   ========================================================= */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const round2 = (n) => Math.round(n * 100) / 100;
const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const currentMonth = () => todayISO().slice(0, 7);
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
const fmtMonthLong = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
const fmtMonthShort = new Intl.DateTimeFormat('es', { month: 'short' });
const fmtMonthOnly = new Intl.DateTimeFormat('es', { month: 'long' });
const fmtDay = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDateShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const monthLabel = (key) => fmtMonthLong.format(parseISO(key + '-01')).replace(' de ', ' ');
const monthShort = (key) => fmtMonthShort.format(parseISO(key + '-01')).replace('.', '');
const monthName = (key) => fmtMonthOnly.format(parseISO(key + '-01'));

function dayLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Hoy';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`) return 'Ayer';
  return fmtDay.format(parseISO(iso));
}

let nfFull, nfInt, nfCompact;
function setupFormat() {
  const cur = CURRENCIES[db.settings.currency] ? db.settings.currency : 'USD';
  const locale = CURRENCIES[cur].locale;
  nfFull = new Intl.NumberFormat(locale, { style: 'currency', currency: cur });
  nfInt = new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 0, minimumFractionDigits: 0 });
  nfCompact = new Intl.NumberFormat(locale, { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 });
}
function money(n) {
  n = round2(n || 0);
  const s = Number.isInteger(n) ? nfInt.format(Math.abs(n)) : nfFull.format(Math.abs(n));
  return (n < 0 ? '−' : '') + s;
}
const moneyCompact = (n) => (Math.abs(n) < 10000 ? money(n) : nfCompact.format(n));
const signed = (n, type) => (type === 'ingreso' ? '+' : '−') + money(Math.abs(n));
const pct = (r) => `${Math.round(r * 100)}\u00a0%`;

function parseAmount(input) {
  let s = String(input == null ? '' : input).trim().replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const th = dec === '.' ? ',' : '.';
    s = s.split(th).join('').replace(dec, '.');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,(?=[^,]*$)/, '.').replace(/,/g, '');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/\.(?=.*\.)/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2(n) : NaN;
}

function catById(id) {
  return db.categories.find((c) => c.id === id) || { id: '', emoji: '📦', name: 'Sin categoría', type: 'egreso', kind: 'variable', budget: 0 };
}
const catsOfType = (type) => db.categories.filter((c) => c.type === type);

/* =========================================================
   Cálculos
   ========================================================= */
function monthStats(key, untilDay = 31) {
  const txs = db.transactions.filter((t) => t.date && t.date.startsWith(key) && +t.date.slice(8, 10) <= untilDay);
  let ingresos = 0, gastos = 0, hormigaCount = 0;
  const byKind = { fijo: 0, variable: 0, hormiga: 0 };
  const byCat = {};
  for (const t of txs) {
    if (t.type === 'ingreso') { ingresos += t.amount; continue; }
    gastos += t.amount;
    const k = KINDS[t.kind] ? t.kind : 'variable';
    byKind[k] += t.amount;
    if (k === 'hormiga') hormigaCount++;
    byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount;
  }
  return { key, txs, ingresos, gastos, ahorro: ingresos - gastos, byKind, byCat, hormigaCount };
}

function balanceUntil(key) {
  let b = 0;
  for (const t of db.transactions) {
    if (t.date.slice(0, 7) > key) continue;
    b += t.type === 'ingreso' ? t.amount : -t.amount;
  }
  return b;
}

const goalSaved = (g) => g.contributions.reduce((s, c) => s + c.amount, 0);
const totalInGoals = () => db.goals.reduce((s, g) => s + goalSaved(g), 0);

function fixedStatus(key) {
  return db.fixed
    .filter((f) => f.active !== false)
    .sort((a, b) => (a.day || 1) - (b.day || 1))
    .map((f) => ({ f, tx: db.transactions.find((t) => t.fixedId === f.id && t.date.startsWith(key)) }));
}

function budgetRows(stats) {
  return db.categories
    .filter((c) => c.type === 'egreso' && c.budget > 0)
    .map((c) => {
      const spent = stats.byCat[c.id] || 0;
      const r = spent / c.budget;
      return { c, spent, r, status: r > 1 ? 'critical' : r >= 0.8 ? 'warning' : 'good' };
    })
    .sort((a, b) => b.r - a.r);
}

/* =========================================================
   Estado UI
   ========================================================= */
const ui = {
  tab: 'inicio',
  month: currentMonth(),
  filter: { type: 'all', q: '', cat: '' },
  chartSel: null,
  showTable: false,
};
let sheetCtx = null;

/* =========================================================
   Render principal
   ========================================================= */
const view = $('#view');

function render() {
  setupFormat();
  applyTheme();
  const showMonth = ['inicio', 'movimientos', 'fijos'].includes(ui.tab);
  $('#monthNav').hidden = !showMonth;
  $('#monthLabel').textContent = monthLabel(ui.month) + (ui.month === currentMonth() ? '' : ' ↺');
  const name = db.settings.name.trim();
  $('#title').textContent = ui.tab === 'inicio' ? (name ? `Hola, ${name}` : 'Mis Finanzas') : TAB_TITLES[ui.tab];
  document.querySelectorAll('.tabbar .tab[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const fn = { inicio: renderInicio, movimientos: renderMovimientos, fijos: renderFijos, metas: renderMetas, ajustes: renderAjustes }[ui.tab];
  view.innerHTML = fn();
}

function applyTheme() {
  const t = db.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/* ---------- Componentes ---------- */
function txItem(t) {
  const c = catById(t.categoryId);
  const kindTag = t.type === 'egreso' ? `<span class="tag ${esc(t.kind)}">${esc((KINDS[t.kind] || KINDS.variable).label)}</span>` : '';
  const sub = [t.note ? esc(t.note) : '', fmtDateShort.format(parseISO(t.date))].filter(Boolean).join(' · ');
  return `<button class="item" data-action="edit-tx" data-id="${esc(t.id)}">
    <span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>
    <span class="main"><div class="t1">${esc(c.name)}${kindTag}</div><div class="t2">${sub}</div></span>
    <span class="amt ${t.type === 'ingreso' ? 'pos' : ''}">${signed(t.amount, t.type)}</span>
  </button>`;
}

function meter(ratio, cls = '') {
  const w = Math.max(0, Math.min(1, ratio)) * 100;
  return `<div class="meter ${cls}" role="img" aria-label="${Math.round(ratio * 100)} %"><span style="width:${w.toFixed(1)}%"></span></div>`;
}

const STATUS_LABEL = {
  good: '✓ Dentro del presupuesto',
  warning: '⚠︎ Cerca del límite',
  critical: '✕ Excedido',
};

/* =========================================================
   Vista: Inicio (dashboard)
   ========================================================= */
function renderInicio() {
  const key = ui.month;
  const m = monthStats(key);
  const prev = monthStats(addMonths(key, -1));
  // Para el mes en curso, comparar contra el mes anterior hasta el mismo día
  const isCurrent = key === currentMonth();
  const prevCmp = isCurrent ? monthStats(addMonths(key, -1), new Date().getDate()) : prev;
  const goalPct = (db.settings.savingsGoalPct || 0) / 100;
  const rate = m.ingresos > 0 ? m.ahorro / m.ingresos : null;
  let html = '';

  if (!db.transactions.length && !db.fixed.length) {
    html += `<div class="card empty">
      <div class="big">👋</div>
      <p style="color:var(--ink-1);font-weight:600;font-size:18px">¡Bienvenido a Mis Finanzas!</p>
      <p class="sub" style="margin:6px 0 14px">Registra tus ingresos y gastos, marca tus gastos fijos y descubre cuánto se te va en gastos hormiga.</p>
      <div class="btn-row"><button class="btn primary" data-action="add">Agregar movimiento</button></div>
      <div class="btn-row"><button class="btn" data-action="go" data-tab="fijos">Configurar gastos fijos</button></div>
      <div class="btn-row"><button class="btn" data-action="sample">Ver con datos de ejemplo</button></div>
    </div>`;
  }

  // Héroe: ahorro del mes
  const rateStatus = rate == null ? null : rate < 0 ? 'critical' : rate >= goalPct ? 'good' : 'warning';
  const rateText = rate == null ? 'Sin ingresos este mes' : `Ahorras el ${pct(rate)} de tus ingresos`;
  html += `<section class="card hero">
    <div class="label">Ahorro del mes <span class="muted small">(ingresos − gastos)</span></div>
    <div class="value num ${m.ahorro < 0 ? 'neg' : ''}">${money(m.ahorro)}</div>
    <div class="meta">
      <span class="pill">${rateStatus ? `<span class="dot" style="background:var(--${rateStatus})"></span>` : ''}${rateText}</span>
      <span>Meta: ${db.settings.savingsGoalPct || 0} %</span>
    </div>
  </section>`;

  // Tiles
  const delta = (cur, before, upIsGood) => {
    if (!before) return '<div class="delta">&nbsp;</div>';
    const ch = (cur - before) / before;
    const good = upIsGood ? ch >= 0 : ch <= 0;
    return `<div class="delta"><span class="${good ? 'pos' : 'neg'}">${ch >= 0 ? '▲' : '▼'} ${pct(Math.abs(ch))}</span> vs ${esc(monthShort(prev.key))}${isCurrent ? ' a la fecha' : ''}</div>`;
  };
  html += `<div class="tiles">
    <button class="card tile" data-action="filter-go" data-type="ingreso" style="text-align:left">
      <div class="label">Ingresos</div><div class="value num">${money(m.ingresos)}</div>${delta(m.ingresos, prevCmp.ingresos, true)}
    </button>
    <button class="card tile" data-action="filter-go" data-type="egreso" style="text-align:left">
      <div class="label">Gastos</div><div class="value num">${money(m.gastos)}</div>${delta(m.gastos, prevCmp.gastos, false)}
    </button>
    <div class="card tile">
      <div class="label">Saldo acumulado</div><div class="value num ${balanceUntil(key) < 0 ? 'neg' : ''}">${money(balanceUntil(key))}</div><div class="delta">al cierre de ${esc(monthShort(key))}</div>
    </div>
    <button class="card tile" data-action="go" data-tab="metas" style="text-align:left">
      <div class="label">En metas de ahorro</div><div class="value num">${money(totalInGoals())}</div><div class="delta">${db.goals.length} ${db.goals.length === 1 ? 'meta' : 'metas'}</div>
    </button>
  </div>`;

  // Consejos
  const tips = insights(key, m, prev, rate, goalPct);
  if (tips.length) {
    html += `<section class="card"><div class="card-head"><h2>Resumen inteligente</h2></div>
      <ul class="insights">${tips.map(([i, t]) => `<li><span class="i" aria-hidden="true">${i}</span><span>${t}</span></li>`).join('')}</ul></section>`;
  }

  // Distribución fijo / variable / hormiga
  if (m.gastos > 0) {
    html += `<section class="card"><div class="card-head"><h2>¿En qué se va tu dinero?</h2></div>
      <div class="segbar" role="img" aria-label="Distribución de gastos por tipo">
        ${KIND_ORDER.filter((k) => m.byKind[k] > 0).map((k) => `<span style="flex:${m.byKind[k]};background:${KINDS[k].color}" title="${KINDS[k].plural}: ${money(m.byKind[k])}"></span>`).join('')}
      </div>
      <ul class="legend">
        ${KIND_ORDER.map((k) => `<li><button class="row" style="width:100%" data-action="filter-go" data-type="${k}">
          <span class="sw" style="background:${KINDS[k].color}"></span><span class="name" style="text-align:left">${KINDS[k].plural}</span>
          <span class="val num">${money(m.byKind[k])}</span><span class="pct num">${pct(m.byKind[k] / m.gastos)}</span></button></li>`).join('')}
      </ul></section>`;
  }

  // Gastos hormiga
  html += renderHormigaCard(m);

  // Fijos del mes
  html += renderFixedSummary(key);

  // Presupuestos
  const budgets = budgetRows(m);
  if (budgets.length) {
    html += `<section class="card"><div class="card-head"><h2>Presupuestos</h2><button class="link" data-action="go" data-tab="ajustes">Editar</button></div>
      <div class="cbars">${budgets.map(({ c, spent, r, status }) => `
        <button class="cbar" data-action="filter-cat" data-id="${esc(c.id)}">
          <div class="top"><span aria-hidden="true">${esc(c.emoji)}</span><span class="name">${esc(c.name)}</span>
            <span class="num small">${money(spent)} <span class="muted">/ ${money(c.budget)}</span></span></div>
          ${meter(r, status)}
          <div class="row"><span class="status">${STATUS_LABEL[status]}</span><span class="spacer"></span>
            <span class="small muted num">${r > 1 ? `+${money(spent - c.budget)}` : `Quedan ${money(c.budget - spent)}`}</span></div>
        </button>`).join('')}</div></section>`;
  }

  // Gastos por categoría
  const cats = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    const top = cats.slice(0, 7);
    const rest = cats.slice(7).reduce((s, [, v]) => s + v, 0);
    const max = top[0][1];
    html += `<section class="card"><div class="card-head"><h2>Gastos por categoría</h2><span class="muted small">${esc(monthName(key))}</span></div>
      <div class="cbars">
        ${top.map(([id, v]) => { const c = catById(id); return `<button class="cbar" data-action="filter-cat" data-id="${esc(id)}">
          <div class="top"><span aria-hidden="true">${esc(c.emoji)}</span><span class="name">${esc(c.name)}</span>
          <span class="num small">${money(v)}</span><span class="muted small num" style="width:40px;text-align:right">${pct(v / m.gastos)}</span></div>
          <div class="track"><div class="fill" style="width:${((v / max) * 100).toFixed(1)}%"></div></div></button>`; }).join('')}
        ${rest > 0 ? `<div class="cbar"><div class="top"><span>➕</span><span class="name">Otras categorías</span><span class="num small">${money(rest)}</span><span class="muted small num" style="width:40px;text-align:right">${pct(rest / m.gastos)}</span></div>
          <div class="track"><div class="fill" style="width:${((rest / max) * 100).toFixed(1)}%;opacity:.5"></div></div></div>` : ''}
      </div></section>`;
  }

  // Tendencia 6 meses
  html += renderTrendCard(key);

  // Metas
  if (db.goals.length) {
    html += `<section class="card"><div class="card-head"><h2>Metas de ahorro</h2><button class="link" data-action="go" data-tab="metas">Ver todas</button></div>
      ${db.goals.slice(0, 3).map(goalBlock).join('')}</section>`;
  }

  // Últimos movimientos
  const last = [...m.txs].sort(byDateDesc).slice(0, 5);
  html += `<section class="card"><div class="card-head"><h2>Últimos movimientos</h2><button class="link" data-action="go" data-tab="movimientos">Ver todos</button></div>
    ${last.length ? `<div class="list">${last.map(txItem).join('')}</div>` : `<p class="muted">Aún no hay movimientos en ${esc(monthName(key))}.</p>`}
  </section>`;

  return html;
}

function byDateDesc(a, b) {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0);
}

function insights(key, m, prev, rate, goalPct) {
  const out = [];
  const isCurrent = key === currentMonth();
  const fs = fixedStatus(key);
  const pending = fs.filter((x) => !x.tx && x.f.type === 'egreso');
  const pendingAmt = pending.reduce((s, x) => s + x.f.amount, 0);

  if (m.ingresos > 0) {
    if (rate >= goalPct) out.push(['✅', `Estás ahorrando el <b>${pct(rate)}</b> de tus ingresos: cumples tu meta del ${db.settings.savingsGoalPct} %.`]);
    else if (rate >= 0) out.push(['💡', `Para llegar a tu meta de ahorro del ${db.settings.savingsGoalPct} % te faltan <b>${money(goalPct * m.ingresos - m.ahorro)}</b> este mes.`]);
    else out.push(['🚨', `Este mes gastaste <b>${money(-m.ahorro)}</b> más de lo que ingresó.`]);
  }
  if (m.byKind.hormiga > 0) {
    out.push(['🐜', `Tus gastos hormiga suman <b>${money(m.byKind.hormiga)}</b> (${m.hormigaCount} compras). A este ritmo serían ~<b>${money(m.byKind.hormiga * 12)}</b> al año.`]);
  }
  if (isCurrent && pending.length) {
    out.push(['📅', `Tienes ${pending.length} ${pending.length === 1 ? 'gasto fijo pendiente' : 'gastos fijos pendientes'} por <b>${money(pendingAmt)}</b>.`]);
  }
  if (isCurrent && m.gastos > 0) {
    const d = new Date().getDate();
    const days = daysInMonth(key);
    if (d < days) {
      const variable = m.byKind.variable + m.byKind.hormiga;
      const proj = m.byKind.fijo + pendingAmt + (variable / d) * days;
      out.push(['📈', `Al ritmo actual cerrarías ${esc(monthName(key))} con ~<b>${money(proj)}</b> en gastos.`]);
    }
  }
  const over = budgetRows(m).filter((b) => b.status === 'critical');
  if (over.length) out.push(['⚠️', `Superaste el presupuesto de ${over.map((b) => esc(b.c.name)).join(', ')}.`]);
  if (!isCurrent && prev.gastos > 0 && m.gastos > 0) {
    const ch = (m.gastos - prev.gastos) / prev.gastos;
    if (Math.abs(ch) >= 0.05) out.push([ch > 0 ? '⬆️' : '⬇️', `Gastaste ${pct(Math.abs(ch))} ${ch > 0 ? 'más' : 'menos'} que en ${esc(monthName(prev.key))}.`]);
  }
  return out.slice(0, 5);
}

function renderHormigaCard(m) {
  const hormigaCats = catsOfType('egreso').filter((c) => c.kind === 'hormiga');
  const total = m.byKind.hormiga;
  const avg = m.hormigaCount ? total / m.hormigaCount : 0;
  const share = m.gastos ? total / m.gastos : 0;
  const top = Object.entries(
    m.txs.filter((t) => t.type === 'egreso' && t.kind === 'hormiga').reduce((acc, t) => ((acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount), acc), {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<section class="card"><div class="card-head"><h2>🐜 Gastos hormiga</h2><button class="link" data-action="filter-go" data-type="hormiga">Ver</button></div>
    <div class="kv">
      <div><div class="k">Total mes</div><div class="v num">${money(total)}</div></div>
      <div><div class="k">Compras</div><div class="v num">${m.hormigaCount}</div></div>
      <div><div class="k">Promedio</div><div class="v num">${money(avg)}</div></div>
    </div>
    ${total > 0 ? `<p class="sub" style="margin-top:10px">Son el <b>${pct(share)}</b> de tus gastos. En un año: <b>${money(total * 12)}</b>.</p>` : `<p class="sub" style="margin-top:10px">Los pequeños gastos diarios suman mucho. Regístralos rápido aquí:</p>`}
    ${top.length ? `<p class="small muted" style="margin-top:6px">Más frecuentes: ${top.map(([id, v]) => `${esc(catById(id).emoji)} ${esc(catById(id).name)} (${money(v)})`).join(' · ')}</p>` : ''}
    <div class="quick">${hormigaCats.slice(0, 6).map((c) => `<button class="chip" data-action="quick-hormiga" data-id="${esc(c.id)}">+ ${esc(c.emoji)} ${esc(c.name)}</button>`).join('')}</div>
  </section>`;
}

function renderFixedSummary(key) {
  const fs = fixedStatus(key).filter((x) => x.f.type === 'egreso');
  if (!fs.length) {
    return `<section class="card"><div class="card-head"><h2>Gastos fijos del mes</h2></div>
      <p class="sub">Agrega tus gastos fijos (arriendo, luz, internet…) para controlar qué ya pagaste cada mes.</p>
      <div class="btn-row"><button class="btn" data-action="new-fixed">+ Agregar gasto fijo</button></div></section>`;
  }
  const total = fs.reduce((s, x) => s + x.f.amount, 0);
  const paid = fs.filter((x) => x.tx);
  const paidAmt = paid.reduce((s, x) => s + x.tx.amount, 0);
  const pending = fs.filter((x) => !x.tx);
  return `<section class="card"><div class="card-head"><h2>Gastos fijos del mes</h2><button class="link" data-action="go" data-tab="fijos">Ver todos</button></div>
    <div class="row" style="margin-bottom:8px"><span class="sub">Pagados ${paid.length} de ${fs.length}</span><span class="spacer"></span>
      <span class="num small">${money(paidAmt)} <span class="muted">/ ${money(total)}</span></span></div>
    ${meter(total ? paidAmt / total : 0, 'good')}
    ${pending.length ? `<div class="list" style="margin-top:6px">${pending.slice(0, 4).map(fixedRow).join('')}</div>`
      : `<p class="sub" style="margin-top:10px">🎉 ¡Todos tus gastos fijos de ${esc(monthName(key))} están pagados!</p>`}
  </section>`;
}

function fixedRow({ f, tx }) {
  const c = catById(f.categoryId);
  const isIn = f.type === 'ingreso';
  const doneLabel = isIn ? '✓ Recibido' : '✓ Pagado';
  const todoLabel = isIn ? 'Recibir' : 'Pagar';
  return `<div class="item">
    <button class="emoji" data-action="edit-fixed" data-id="${esc(f.id)}" aria-label="Editar ${esc(f.name)}">${esc(c.emoji)}</button>
    <button class="main" style="text-align:left" data-action="edit-fixed" data-id="${esc(f.id)}">
      <div class="t1">${esc(f.name)}</div>
      <div class="t2"><span class="num ${isIn ? 'pos' : ''}" style="color:${isIn ? '' : 'var(--ink-1)'};font-weight:600">${money(tx ? tx.amount : f.amount)}</span> · día ${f.day || 1}</div></button>
    <button class="check ${tx ? 'on' : ''}" data-action="toggle-fixed" data-id="${esc(f.id)}">${tx ? doneLabel : todoLabel}</button>
  </div>`;
}

/* ---------- Gráfico de columnas (6 meses) ---------- */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}
function colPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function renderTrendCard(key) {
  const months = Array.from({ length: 6 }, (_, i) => addMonths(key, i - 5));
  const data = months.map((k) => monthStats(k));
  if (!data.some((d) => d.ingresos || d.gastos)) return '';
  const sel = ui.chartSel != null && ui.chartSel < 6 ? ui.chartSel : 5;
  const W = 340, H = 170, L = 44, T = 8, B = 22;
  const plotW = W - L, plotH = H - T - B;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.ingresos, d.gastos))));
  const band = plotW / 6;
  const bw = Math.min(14, (band - 14) / 2);
  const y = (v) => T + plotH - (v / max) * plotH;
  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    const yy = y(v);
    svg += `<line class="${i === 0 ? 'base' : 'grid'}" x1="${L}" x2="${W}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text x="${L - 6}" y="${yy + 4}" text-anchor="end">${esc(moneyCompact(v))}</text>`;
  }
  data.forEach((d, i) => {
    const cx = L + band * i + band / 2;
    svg += `<rect class="hit ${i === sel ? 'sel' : ''}" x="${L + band * i + 2}" y="${T}" width="${band - 4}" height="${plotH}" rx="6" data-action="chart-sel" data-i="${i}"/>`;
    const hi = plotH * (d.ingresos / max), hg = plotH * (d.gastos / max);
    svg += `<path d="${colPath(cx - bw - 1, T + plotH - hi, bw, hi)}" fill="var(--s-ingreso)" pointer-events="none"/>`;
    svg += `<path d="${colPath(cx + 1, T + plotH - hg, bw, hg)}" fill="var(--s-gasto)" pointer-events="none"/>`;
    svg += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="${i === sel ? 'sel' : ''}">${esc(monthShort(d.key))}</text>`;
  });
  const s = data[sel];
  const table = `<table class="data"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Ahorro</th></tr></thead><tbody>
    ${data.map((d) => `<tr><td>${esc(monthShort(d.key))}</td><td>${money(d.ingresos)}</td><td>${money(d.gastos)}</td><td class="${d.ahorro < 0 ? 'neg' : ''}">${money(d.ahorro)}</td></tr>`).join('')}
  </tbody></table>`;
  return `<section class="card"><div class="card-head"><h2>Últimos 6 meses</h2><button class="link" data-action="toggle-table">${ui.showTable ? 'Ver gráfico' : 'Ver tabla'}</button></div>
    ${ui.showTable ? table : `
    <div class="chart-readout"><strong>${esc(monthLabel(s.key))}</strong>
      <span class="k"><i class="sw" style="background:var(--s-ingreso)"></i>Ingresos ${money(s.ingresos)}</span>
      <span class="k"><i class="sw" style="background:var(--s-gasto)"></i>Gastos ${money(s.gastos)}</span>
      <span class="k">Ahorro <b class="${s.ahorro < 0 ? 'neg' : ''}">${money(s.ahorro)}</b></span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">${svg}</svg>
    <div class="chart-legend"><span><i style="background:var(--s-ingreso)"></i>Ingresos</span><span><i style="background:var(--s-gasto)"></i>Gastos</span><span class="muted">Toca un mes para ver el detalle</span></div>`}
  </section>`;
}

/* =========================================================
   Vista: Movimientos
   ========================================================= */
const FILTERS = [
  ['all', 'Todos'], ['ingreso', 'Ingresos'], ['egreso', 'Gastos'],
  ['fijo', 'Fijos'], ['variable', 'Variables'], ['hormiga', '🐜 Hormiga'],
];

function filteredTxs() {
  const f = ui.filter;
  const q = f.q.trim().toLowerCase();
  return db.transactions
    .filter((t) => t.date.startsWith(ui.month))
    .filter((t) => {
      if (f.type === 'ingreso' || f.type === 'egreso') return t.type === f.type;
      if (KINDS[f.type]) return t.type === 'egreso' && t.kind === f.type;
      return true;
    })
    .filter((t) => !f.cat || t.categoryId === f.cat)
    .filter((t) => !q || `${catById(t.categoryId).name} ${t.note || ''} ${t.amount}`.toLowerCase().includes(q))
    .sort(byDateDesc);
}

function renderMovimientos() {
  const cat = ui.filter.cat ? catById(ui.filter.cat) : null;
  return `
    <input class="input search" type="search" placeholder="Buscar por categoría, nota o monto" value="${esc(ui.filter.q)}" data-input="search" enterkeyhint="search">
    <div class="chips" style="margin-bottom:10px">
      ${FILTERS.map(([k, l]) => `<button class="chip ${ui.filter.type === k ? 'on' : ''}" data-action="filter" data-type="${k}">${l}</button>`).join('')}
    </div>
    ${cat ? `<div class="chips" style="margin-bottom:10px"><button class="chip on" data-action="clear-cat">${esc(cat.emoji)} ${esc(cat.name)} ✕</button></div>` : ''}
    <div id="txList">${renderTxList()}</div>`;
}

function renderTxList() {
  const txs = filteredTxs();
  if (!txs.length) {
    return `<div class="card empty"><div class="big">🧾</div><p>No hay movimientos ${ui.filter.type !== 'all' || ui.filter.q || ui.filter.cat ? 'con estos filtros ' : ''}en ${esc(monthName(ui.month))}.</p>
      <div class="btn-row"><button class="btn primary" data-action="add">Agregar movimiento</button></div></div>`;
  }
  const inc = txs.filter((t) => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const out = txs.filter((t) => t.type === 'egreso').reduce((s, t) => s + t.amount, 0);
  const groups = {};
  txs.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
  return `<div class="row small sub" style="padding:0 4px;margin-bottom:-6px">
      <span>${txs.length} movimientos</span><span class="spacer"></span>
      ${inc ? `<span class="pos num">+${money(inc)}</span>` : ''}${out ? `<span class="num">−${money(out)}</span>` : ''}</div>
    ${Object.entries(groups).map(([date, list]) => {
      const net = list.reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0);
      return `<div class="day-head"><span>${esc(dayLabel(date))}</span><span class="num">${money(net)}</span></div>
        <div class="card" style="padding:2px 14px"><div class="list">${list.map(txItem).join('')}</div></div>`;
    }).join('')}`;
}

/* =========================================================
   Vista: Fijos
   ========================================================= */
function renderFijos() {
  const key = ui.month;
  const fs = fixedStatus(key);
  const outs = fs.filter((x) => x.f.type === 'egreso');
  const ins = fs.filter((x) => x.f.type === 'ingreso');
  const totalOut = outs.reduce((s, x) => s + x.f.amount, 0);
  const totalIn = ins.reduce((s, x) => s + x.f.amount, 0);
  const pendingOut = outs.filter((x) => !x.tx);
  const paidAmt = outs.filter((x) => x.tx).reduce((s, x) => s + x.tx.amount, 0);
  const inactive = db.fixed.filter((f) => f.active === false);
  let html = `<section class="card">
    <div class="kv">
      <div><div class="k">Fijos / mes</div><div class="v num">${money(totalOut)}</div></div>
      <div><div class="k">Pagado</div><div class="v num">${money(paidAmt)}</div></div>
      <div><div class="k">Pendiente</div><div class="v num">${money(pendingOut.reduce((s, x) => s + x.f.amount, 0))}</div></div>
    </div>
    ${totalOut ? `<div style="margin-top:12px">${meter(paidAmt / totalOut, 'good')}</div>` : ''}
    ${totalIn ? `<p class="sub" style="margin-top:10px">Tus gastos fijos consumen el <b>${pct(totalOut / totalIn)}</b> de tus ingresos fijos (${money(totalIn)}). Lo ideal es que no superen el 50&nbsp;%.</p>` : ''}
    <div class="btn-row">
      <button class="btn primary" data-action="new-fixed">+ Nuevo fijo</button>
      ${pendingOut.length ? `<button class="btn" data-action="pay-all">Pagar todos</button>` : ''}
    </div>
    <p class="note">Toca “Pagar” para registrar el gasto de ${esc(monthName(key))} automáticamente. Toca el nombre para editar el monto o el día.</p>
  </section>`;
  html += `<h3 class="section-title">Gastos fijos</h3><section class="card" style="padding:4px 14px">
    ${outs.length ? `<div class="list">${outs.map(fixedRow).join('')}</div>` : `<p class="muted" style="padding:12px 0">Aún no tienes gastos fijos.</p>`}</section>`;
  html += `<h3 class="section-title">Ingresos fijos</h3><section class="card" style="padding:4px 14px">
    ${ins.length ? `<div class="list">${ins.map(fixedRow).join('')}</div>` : `<p class="muted" style="padding:12px 0">Agrega tu sueldo u otros ingresos que recibes cada mes.</p>`}</section>`;
  if (inactive.length) {
    html += `<h3 class="section-title">Pausados</h3><section class="card" style="padding:4px 14px"><div class="list">
      ${inactive.map((f) => `<button class="item" data-action="edit-fixed" data-id="${esc(f.id)}"><span class="emoji">${esc(catById(f.categoryId).emoji)}</span>
        <span class="main"><div class="t1">${esc(f.name)}</div><div class="t2">Pausado</div></span><span class="amt muted">${money(f.amount)}</span></button>`).join('')}
    </div></section>`;
  }
  return html;
}

/* =========================================================
   Vista: Metas
   ========================================================= */
function goalBlock(g) {
  const saved = goalSaved(g);
  const r = g.target > 0 ? saved / g.target : 0;
  let plan = '';
  if (r >= 1) plan = '🎉 ¡Meta cumplida!';
  else if (g.deadline) {
    const now = currentMonth();
    const [y1, m1] = now.split('-').map(Number);
    const [y2, m2] = g.deadline.split('-').map(Number);
    const left = (y2 - y1) * 12 + (m2 - m1) + 1;
    plan = left > 0 ? `Ahorra ${money(Math.ceil((g.target - saved) / left))}/mes para lograrlo en ${esc(monthLabel(g.deadline))}` : `Fecha límite vencida (${esc(monthLabel(g.deadline))})`;
  }
  return `<button class="goal" data-action="edit-goal" data-id="${esc(g.id)}">
    <div class="row"><span class="emoji" aria-hidden="true">${esc(g.emoji || '🎯')}</span>
      <span class="main" style="flex:1;min-width:0"><div class="t1" style="font-weight:600">${esc(g.name)}</div>
      <div class="t2 num">${money(saved)} de ${money(g.target)}</div></span>
      <span class="num" style="font-weight:650">${pct(Math.min(r, 9.99))}</span></div>
    ${meter(r)}
    ${plan ? `<div class="small muted">${plan}</div>` : ''}
  </button>`;
}

function renderMetas() {
  const total = totalInGoals();
  const balance = balanceUntil(currentMonth());
  const free = balance - total;
  let html = `<section class="card hero">
    <div class="label">Total ahorrado en metas</div>
    <div class="value num">${money(total)}</div>
    <div class="meta"><span>Saldo acumulado: <b class="num">${money(balance)}</b></span>
      <span>Sin asignar: <b class="num ${free < 0 ? 'neg' : ''}">${money(free)}</b></span></div>
    <p class="note">El saldo acumulado es la suma de todos tus ingresos menos tus gastos. Asigna parte de él a tus metas con “Aportar”.</p>
  </section>`;
  if (!db.goals.length) {
    html += `<div class="card empty"><div class="big">🎯</div><p>Crea tu primera meta: fondo de emergencia, viaje, auto…</p>
      <div class="btn-row"><button class="btn primary" data-action="new-goal">+ Nueva meta</button></div></div>`;
    return html;
  }
  html += db.goals.map((g) => `<section class="card">${goalBlock(g)}
    <div class="btn-row"><button class="btn sm" data-action="contrib" data-id="${esc(g.id)}" data-sign="1">+ Aportar</button>
    <button class="btn sm" data-action="contrib" data-id="${esc(g.id)}" data-sign="-1">− Retirar</button></div></section>`).join('');
  html += `<div class="btn-row"><button class="btn primary block" data-action="new-goal">+ Nueva meta</button></div>`;
  return html;
}

/* =========================================================
   Vista: Ajustes
   ========================================================= */
function renderAjustes() {
  const s = db.settings;
  const catList = (type) => catsOfType(type).map((c) => `<button class="item" data-action="edit-cat" data-id="${esc(c.id)}">
      <span class="emoji">${esc(c.emoji)}</span>
      <span class="main"><div class="t1">${esc(c.name)}</div><div class="t2">${type === 'egreso' ? `${KINDS[c.kind] ? KINDS[c.kind].label : 'Variable'}${c.budget > 0 ? ` · Presupuesto ${money(c.budget)}` : ''}` : 'Ingreso'}</div></span>
      <span class="chev">›</span></button>`).join('');
  return `
  <h3 class="section-title">General</h3>
  <section class="card">
    <div class="field"><label for="setName">Tu nombre</label><input id="setName" class="input" data-setting="name" value="${esc(s.name)}" placeholder="Opcional" autocomplete="given-name"></div>
    <div class="field"><label for="setCur">Moneda</label><select id="setCur" class="select" data-setting="currency">
      ${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}" ${k === s.currency ? 'selected' : ''}>${k} — ${v.name}</option>`).join('')}</select></div>
    <div class="field"><label for="setGoal">Meta de ahorro mensual (% de tus ingresos)</label>
      <input id="setGoal" class="input" type="number" inputmode="numeric" min="0" max="100" data-setting="savingsGoalPct" value="${esc(s.savingsGoalPct)}"></div>
    <div class="field" style="margin-bottom:0"><span class="lbl">Apariencia</span>
      <div class="seg">${[['auto', 'Automática'], ['light', 'Clara'], ['dark', 'Oscura']].map(([k, l]) => `<button class="${s.theme === k ? 'on' : ''}" data-action="theme" data-v="${k}">${l}</button>`).join('')}</div></div>
  </section>

  <h3 class="section-title">Categorías de gasto y presupuestos</h3>
  <section class="card settings-list" style="padding:4px 14px"><div class="list">${catList('egreso')}</div></section>
  <h3 class="section-title">Categorías de ingreso</h3>
  <section class="card settings-list" style="padding:4px 14px"><div class="list">${catList('ingreso')}</div></section>
  <div class="btn-row"><button class="btn block" data-action="new-cat">+ Nueva categoría</button></div>

  <h3 class="section-title">Respaldo de datos</h3>
  <section class="card">
    <p class="sub">Tus datos se guardan solo en este iPhone. Haz un respaldo de vez en cuando (puedes guardarlo en Archivos o iCloud Drive).</p>
    <div class="btn-row"><button class="btn" data-action="export-json">⬆︎ Exportar respaldo</button><button class="btn" data-action="import-json">⬇︎ Importar</button></div>
    <div class="btn-row"><button class="btn" data-action="export-csv">Exportar a Excel (CSV)</button></div>
  </section>

  <h3 class="section-title">Instalar en tu iPhone</h3>
  <section class="card">
    <ol class="steps"><li>Abre esta página en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (cuadrado con flecha).</li>
    <li>Elige <b>“Agregar a pantalla de inicio”</b>.</li><li>Abre “Finanzas” desde tu pantalla de inicio: funciona sin internet.</li></ol>
  </section>

  <h3 class="section-title">Zona de datos</h3>
  <section class="card">
    <div class="btn-row" style="margin-top:0"><button class="btn" data-action="sample">Cargar datos de ejemplo</button></div>
    <div class="btn-row"><button class="btn danger" data-action="reset">Borrar todos los datos</button></div>
  </section>
  <p class="note" style="text-align:center;margin:16px 0">Mis Finanzas · v1.0 · Sin cuentas, sin anuncios, sin servidores.</p>`;
}

/* =========================================================
   Hojas (formularios)
   ========================================================= */
const sheet = $('#sheet');
const backdrop = $('#backdrop');

function openSheet(html) {
  sheet.innerHTML = `<div class="grabber"></div>${html}`;
  sheet.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  sheet.hidden = true;
  backdrop.hidden = true;
  sheet.innerHTML = '';
  sheetCtx = null;
  document.body.style.overflow = '';
}
function sheetHead(title, saveAction, saveLabel = 'Guardar') {
  return `<div class="sheet-head"><button class="link" data-action="close-sheet">Cancelar</button><h2>${esc(title)}</h2>
    ${saveAction ? `<button class="link strong" data-action="${saveAction}">${esc(saveLabel)}</button>` : '<span style="width:60px"></span>'}</div>`;
}
const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
const amountStr = (n) => (n ? String(n) : '');

/* ---------- Movimiento ---------- */
function openTxSheet(opts = {}) {
  const existing = opts.id ? db.transactions.find((t) => t.id === opts.id) : null;
  const type = existing ? existing.type : opts.type || 'egreso';
  const firstCat = catsOfType(type)[0];
  const categoryId = existing ? existing.categoryId : opts.categoryId || (firstCat ? firstCat.id : '');
  sheetCtx = {
    kind: 'tx',
    id: existing ? existing.id : null,
    type,
    categoryId,
    expKind: existing ? existing.kind || 'variable' : opts.kind || catById(categoryId).kind || 'variable',
    amount: existing ? amountStr(existing.amount) : '',
    date: existing ? existing.date : defaultDateForMonth(),
    note: existing ? existing.note || '' : '',
    repeat: false,
    fixedId: existing ? existing.fixedId || null : null,
  };
  drawTxSheet(true);
}

function defaultDateForMonth() {
  return ui.month === currentMonth() ? todayISO() : `${ui.month}-${pad(Math.min(new Date().getDate(), daysInMonth(ui.month)))}`;
}

function syncTxDraft() {
  if (!sheetCtx || sheetCtx.kind !== 'tx') return;
  sheetCtx.amount = val('txAmount');
  sheetCtx.date = val('txDate') || sheetCtx.date;
  sheetCtx.note = val('txNote');
  const rep = document.getElementById('txRepeat');
  sheetCtx.repeat = rep ? rep.checked : false;
}

function drawTxSheet(focus) {
  const d = sheetCtx;
  const isOut = d.type === 'egreso';
  const cats = catsOfType(d.type);
  sheet.innerHTML = `<div class="grabber"></div>
    ${sheetHead(d.id ? 'Editar movimiento' : 'Nuevo movimiento', 'save-tx')}
    <div class="seg" style="margin-bottom:14px">
      <button class="${isOut ? 'on' : ''}" data-action="tx-type" data-v="egreso">Gasto</button>
      <button class="${!isOut ? 'on' : ''}" data-action="tx-type" data-v="ingreso">Ingreso</button>
    </div>
    <div class="field"><input id="txAmount" class="input amount num" inputmode="decimal" placeholder="0" value="${esc(d.amount)}" aria-label="Monto" autocomplete="off"></div>
    ${isOut ? `<div class="field"><span class="lbl">Tipo de gasto</span><div class="seg">
      ${KIND_ORDER.map((k) => `<button class="${d.expKind === k ? 'on' : ''}" data-action="tx-kind" data-v="${k}">${k === 'hormiga' ? '🐜 ' : ''}${KINDS[k].label}</button>`).join('')}
    </div><div class="note" style="margin-top:2px">${KINDS[d.expKind].hint}</div></div>` : ''}
    <div class="field"><span class="lbl">Categoría</span><div class="cat-grid">
      ${cats.map((c) => `<button class="cat-opt ${c.id === d.categoryId ? 'on' : ''}" data-action="tx-cat" data-id="${esc(c.id)}"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}</button>`).join('')}
      <button class="cat-opt" data-action="new-cat" data-type="${d.type}"><span class="e">＋</span>Nueva</button>
    </div></div>
    <div class="field-row">
      <div class="field"><label for="txDate">Fecha</label><input id="txDate" class="input" type="date" value="${esc(d.date)}"></div>
      <div class="field"><label for="txNote">Nota</label><input id="txNote" class="input" value="${esc(d.note)}" placeholder="Opcional" enterkeyhint="done"></div>
    </div>
    ${!d.id && !d.fixedId ? `<div class="switch-row"><span><b>Repetir cada mes</b><br><span class="small muted">Lo agrega a tus ${isOut ? 'gastos' : 'ingresos'} fijos</span></span>
      <label class="switch"><input type="checkbox" id="txRepeat" ${d.repeat ? 'checked' : ''}><span></span></label></div>` : ''}
    ${d.fixedId ? `<p class="note">🔁 Movimiento generado desde un ${isOut ? 'gasto' : 'ingreso'} fijo.</p>` : ''}
    <div class="btn-row"><button class="btn primary" data-action="save-tx">Guardar</button></div>
    ${d.id ? `<div class="btn-row"><button class="btn" data-action="dup-tx">Duplicar</button><button class="btn danger" data-action="del-tx">Eliminar</button></div>` : ''}`;
  sheet.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  if (focus && !d.id) setTimeout(() => { const a = $('#txAmount'); if (a) a.focus(); }, 60);
}

function saveTx() {
  syncTxDraft();
  const d = sheetCtx;
  const amount = parseAmount(d.amount);
  if (!(amount > 0)) { toast('Ingresa un monto válido'); $('#txAmount').focus(); return; }
  if (!d.categoryId) { toast('Elige una categoría'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) { toast('Fecha inválida'); return; }
  const data = {
    type: d.type, amount, categoryId: d.categoryId, date: d.date, note: d.note.trim(),
    kind: d.type === 'egreso' ? d.expKind : undefined,
  };
  if (d.id) {
    const t = db.transactions.find((x) => x.id === d.id);
    Object.assign(t, data);
    if (t.type === 'ingreso') delete t.kind;
  } else {
    const t = { id: uid(), created: Date.now(), ...data };
    if (d.repeat) {
      const f = { id: uid(), name: d.note.trim() || catById(d.categoryId).name, type: d.type, amount, categoryId: d.categoryId, day: parseISO(d.date).getDate(), active: true };
      db.fixed.push(f);
      t.fixedId = f.id;
      t.kind = d.type === 'egreso' ? 'fijo' : undefined;
    }
    db.transactions.push(t);
  }
  save();
  closeSheet();
  ui.month = d.date.slice(0, 7);
  render();
  toast(d.id ? 'Movimiento actualizado' : d.type === 'ingreso' ? 'Ingreso guardado' : 'Gasto guardado');
}

/* ---------- Gasto/ingreso fijo ---------- */
function openFixedSheet(id) {
  const f = id ? db.fixed.find((x) => x.id === id) : null;
  const type = f ? f.type : 'egreso';
  const fixedCat = catsOfType(type).find((c) => c.kind === 'fijo') || catsOfType(type)[0];
  sheetCtx = {
    kind: 'fixed', id: f ? f.id : null, type,
    categoryId: f ? f.categoryId : fixedCat ? fixedCat.id : '',
    name: f ? f.name : '', amount: f ? amountStr(f.amount) : '', day: f ? f.day : 1,
    active: f ? f.active !== false : true,
  };
  drawFixedSheet();
}
function syncFixedDraft() {
  const d = sheetCtx;
  d.name = val('fxName'); d.amount = val('fxAmount'); d.day = val('fxDay');
  const a = document.getElementById('fxActive'); if (a) d.active = a.checked;
}
function drawFixedSheet() {
  const d = sheetCtx;
  const isOut = d.type === 'egreso';
  openSheet(`${sheetHead(d.id ? 'Editar fijo' : 'Nuevo fijo', 'save-fixed')}
    <div class="seg" style="margin-bottom:14px">
      <button class="${isOut ? 'on' : ''}" data-action="fx-type" data-v="egreso">Gasto fijo</button>
      <button class="${!isOut ? 'on' : ''}" data-action="fx-type" data-v="ingreso">Ingreso fijo</button>
    </div>
    <div class="field"><label for="fxName">Nombre</label><input id="fxName" class="input" value="${esc(d.name)}" placeholder="${isOut ? 'Ej: Arriendo, Luz, Netflix' : 'Ej: Sueldo'}"></div>
    <div class="field-row">
      <div class="field"><label for="fxAmount">Monto mensual</label><input id="fxAmount" class="input num" inputmode="decimal" value="${esc(d.amount)}" placeholder="0"></div>
      <div class="field"><label for="fxDay">Día del mes</label><input id="fxDay" class="input" type="number" inputmode="numeric" min="1" max="31" value="${esc(d.day)}"></div>
    </div>
    <div class="field"><span class="lbl">Categoría</span><div class="cat-grid">
      ${catsOfType(d.type).map((c) => `<button class="cat-opt ${c.id === d.categoryId ? 'on' : ''}" data-action="fx-cat" data-id="${esc(c.id)}"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}</button>`).join('')}
    </div></div>
    ${d.id ? `<div class="switch-row"><span><b>Activo</b><br><span class="small muted">Desactívalo para pausarlo sin borrarlo</span></span>
      <label class="switch"><input type="checkbox" id="fxActive" ${d.active ? 'checked' : ''}><span></span></label></div>` : ''}
    <div class="btn-row"><button class="btn primary" data-action="save-fixed">Guardar</button></div>
    ${d.id ? `<div class="btn-row"><button class="btn danger" data-action="del-fixed">Eliminar</button></div>
      <p class="note">Cambiar el monto no modifica los pagos ya registrados. Eliminarlo tampoco borra los movimientos pasados.</p>` : ''}`);
}
function saveFixed() {
  syncFixedDraft();
  const d = sheetCtx;
  const amount = parseAmount(d.amount);
  if (!d.name.trim()) { toast('Escribe un nombre'); return; }
  if (!(amount > 0)) { toast('Ingresa un monto válido'); return; }
  const day = Math.min(31, Math.max(1, parseInt(d.day, 10) || 1));
  const data = { name: d.name.trim(), type: d.type, amount, categoryId: d.categoryId, day, active: d.active };
  if (d.id) Object.assign(db.fixed.find((f) => f.id === d.id), data);
  else db.fixed.push({ id: uid(), ...data });
  save(); closeSheet(); render();
  toast('Guardado');
}
function toggleFixed(id, key = ui.month) {
  const f = db.fixed.find((x) => x.id === id);
  if (!f) return;
  const tx = db.transactions.find((t) => t.fixedId === id && t.date.startsWith(key));
  if (tx) {
    db.transactions = db.transactions.filter((t) => t !== tx);
  } else {
    db.transactions.push({
      id: uid(), created: Date.now(), type: f.type, amount: f.amount, categoryId: f.categoryId,
      date: `${key}-${pad(Math.min(f.day || 1, daysInMonth(key)))}`, note: f.name, fixedId: f.id,
      kind: f.type === 'egreso' ? 'fijo' : undefined,
    });
  }
  save(); render();
  toast(tx ? 'Marcado como pendiente' : f.type === 'ingreso' ? `✓ ${f.name} recibido` : `✓ ${f.name} pagado`);
}

/* ---------- Metas ---------- */
const GOAL_EMOJIS = ['🎯', '🛟', '✈️', '🚗', '🏠', '💻', '🎓', '💍', '🏖️', '📱', '👶', '🐶'];
function openGoalSheet(id) {
  const g = id ? db.goals.find((x) => x.id === id) : null;
  sheetCtx = { kind: 'goal', id: g ? g.id : null, emoji: g ? g.emoji || '🎯' : '🎯' };
  const contribs = g ? [...g.contributions].sort(byDateDesc) : [];
  openSheet(`${sheetHead(g ? 'Editar meta' : 'Nueva meta', 'save-goal')}
    <div class="field"><span class="lbl">Ícono</span><div class="chips" id="goalEmojis">
      ${GOAL_EMOJIS.map((e) => `<button class="chip ${e === sheetCtx.emoji ? 'on' : ''}" data-action="goal-emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
    <div class="field"><label for="gName">Nombre</label><input id="gName" class="input" value="${esc(g ? g.name : '')}" placeholder="Ej: Fondo de emergencia"></div>
    <div class="field-row">
      <div class="field"><label for="gTarget">Monto objetivo</label><input id="gTarget" class="input num" inputmode="decimal" value="${esc(g ? amountStr(g.target) : '')}" placeholder="0"></div>
      <div class="field"><label for="gDeadline">Fecha límite</label><input id="gDeadline" class="input" type="month" value="${esc(g ? g.deadline || '' : '')}"></div>
    </div>
    ${!g ? `<div class="field"><label for="gInitial">¿Cuánto llevas ahorrado? (opcional)</label><input id="gInitial" class="input num" inputmode="decimal" placeholder="0"></div>` : ''}
    <div class="btn-row"><button class="btn primary" data-action="save-goal">Guardar</button></div>
    ${g ? `<div class="btn-row"><button class="btn" data-action="contrib" data-id="${esc(g.id)}" data-sign="1">+ Aportar</button><button class="btn" data-action="contrib" data-id="${esc(g.id)}" data-sign="-1">− Retirar</button></div>
      <h3 class="section-title">Historial (${contribs.length})</h3>
      ${contribs.length ? `<div class="list">${contribs.map((c) => `<button class="item" data-action="edit-contrib" data-goal="${esc(g.id)}" data-id="${esc(c.id)}">
        <span class="main"><div class="t1">${c.amount >= 0 ? 'Aporte' : 'Retiro'}${c.note ? ` · ${esc(c.note)}` : ''}</div><div class="t2">${esc(fmtDateShort.format(parseISO(c.date)))} ${esc(c.date.slice(0, 4))}</div></span>
        <span class="amt ${c.amount >= 0 ? 'pos' : ''}">${c.amount >= 0 ? '+' : ''}${money(c.amount)}</span></button>`).join('')}</div>` : '<p class="muted small">Sin aportes aún.</p>'}
      <div class="btn-row"><button class="btn danger" data-action="del-goal">Eliminar meta</button></div>` : ''}`);
}
function saveGoal() {
  const name = val('gName').trim();
  const target = parseAmount(val('gTarget'));
  if (!name) { toast('Escribe un nombre'); return; }
  if (!(target > 0)) { toast('Ingresa un monto objetivo'); return; }
  const data = { name, target, deadline: val('gDeadline'), emoji: sheetCtx.emoji };
  if (sheetCtx.id) Object.assign(db.goals.find((g) => g.id === sheetCtx.id), data);
  else {
    const g = { id: uid(), ...data, contributions: [] };
    const init = parseAmount(val('gInitial'));
    if (init > 0) g.contributions.push({ id: uid(), date: todayISO(), amount: init, note: 'Saldo inicial' });
    db.goals.push(g);
  }
  save(); closeSheet(); render(); toast('Meta guardada');
}
function openContribSheet(goalId, sign, contribId) {
  const g = db.goals.find((x) => x.id === goalId);
  if (!g) return;
  const c = contribId ? g.contributions.find((x) => x.id === contribId) : null;
  const s = c ? (c.amount < 0 ? -1 : 1) : sign;
  sheetCtx = { kind: 'contrib', goalId, id: c ? c.id : null, sign: s };
  openSheet(`${sheetHead(`${s > 0 ? 'Aportar a' : 'Retirar de'} ${g.name}`, 'save-contrib')}
    <div class="seg" style="margin-bottom:14px">
      <button class="${s > 0 ? 'on' : ''}" data-action="contrib-sign" data-v="1">Aportar</button>
      <button class="${s < 0 ? 'on' : ''}" data-action="contrib-sign" data-v="-1">Retirar</button></div>
    <div class="field"><input id="cAmount" class="input amount num" inputmode="decimal" placeholder="0" value="${esc(c ? amountStr(Math.abs(c.amount)) : '')}" aria-label="Monto"></div>
    <div class="field-row">
      <div class="field"><label for="cDate">Fecha</label><input id="cDate" class="input" type="date" value="${esc(c ? c.date : todayISO())}"></div>
      <div class="field"><label for="cNote">Nota</label><input id="cNote" class="input" value="${esc(c ? c.note || '' : '')}" placeholder="Opcional"></div>
    </div>
    <div class="btn-row"><button class="btn primary" data-action="save-contrib">Guardar</button></div>
    ${c ? `<div class="btn-row"><button class="btn danger" data-action="del-contrib">Eliminar</button></div>` : ''}`);
  if (!c) setTimeout(() => { const a = $('#cAmount'); if (a) a.focus(); }, 60);
}
function saveContrib() {
  const g = db.goals.find((x) => x.id === sheetCtx.goalId);
  const amount = parseAmount(val('cAmount'));
  if (!(amount > 0)) { toast('Ingresa un monto válido'); return; }
  const data = { amount: amount * sheetCtx.sign, date: val('cDate') || todayISO(), note: val('cNote').trim() };
  if (sheetCtx.id) Object.assign(g.contributions.find((c) => c.id === sheetCtx.id), data);
  else g.contributions.push({ id: uid(), ...data });
  save(); closeSheet(); render();
  const saved = goalSaved(g);
  toast(saved >= g.target ? `🎉 ¡Cumpliste la meta ${g.name}!` : `${g.name}: ${pct(saved / g.target)} completado`);
}

/* ---------- Categorías ---------- */
function openCatSheet(id, type) {
  const c = id ? db.categories.find((x) => x.id === id) : null;
  const returnTo = sheetCtx && (sheetCtx.kind === 'tx') ? { ...sheetCtx } : null;
  sheetCtx = { kind: 'cat', id: c ? c.id : null, type: c ? c.type : type || 'egreso', expKind: c ? c.kind || 'variable' : 'variable', returnTo };
  drawCatSheet(c);
}
function drawCatSheet(c) {
  const d = sheetCtx;
  const name = c ? c.name : val('catName');
  const emoji = c ? c.emoji : val('catEmoji') || '🏷️';
  const budget = c ? amountStr(c.budget) : val('catBudget');
  const isOut = d.type === 'egreso';
  const used = c ? db.transactions.filter((t) => t.categoryId === c.id).length : 0;
  openSheet(`${sheetHead(c ? 'Editar categoría' : 'Nueva categoría', 'save-cat')}
    ${!c ? `<div class="seg" style="margin-bottom:14px">
      <button class="${isOut ? 'on' : ''}" data-action="cat-type" data-v="egreso">Gasto</button>
      <button class="${!isOut ? 'on' : ''}" data-action="cat-type" data-v="ingreso">Ingreso</button></div>` : ''}
    <div class="row" style="align-items:flex-end;gap:10px">
      <div class="field"><label for="catEmoji">Emoji</label><input id="catEmoji" class="input emoji-input" value="${esc(emoji)}" maxlength="8"></div>
      <div class="field" style="flex:1"><label for="catName">Nombre</label><input id="catName" class="input" value="${esc(name)}" placeholder="Ej: Gimnasio"></div>
    </div>
    ${isOut ? `<div class="field"><span class="lbl">Tipo de gasto por defecto</span><div class="seg">
      ${KIND_ORDER.map((k) => `<button class="${d.expKind === k ? 'on' : ''}" data-action="cat-kind" data-v="${k}">${KINDS[k].label}</button>`).join('')}</div></div>
    <div class="field"><label for="catBudget">Presupuesto mensual (opcional)</label><input id="catBudget" class="input num" inputmode="decimal" value="${esc(budget)}" placeholder="Sin presupuesto"></div>` : ''}
    <div class="btn-row"><button class="btn primary" data-action="save-cat">Guardar</button></div>
    ${c ? `<div class="btn-row"><button class="btn danger" data-action="del-cat">Eliminar categoría</button></div>
      ${used ? `<p class="note">Tiene ${used} movimientos. Si la eliminas, pasarán a “Sin categoría”.</p>` : ''}` : ''}`);
}
function saveCat() {
  const d = sheetCtx;
  const name = val('catName').trim();
  if (!name) { toast('Escribe un nombre'); return; }
  const budget = parseAmount(val('catBudget'));
  const data = { name, emoji: val('catEmoji').trim() || '🏷️', type: d.type, kind: d.type === 'egreso' ? d.expKind : 'variable', budget: budget > 0 ? budget : 0 };
  let newId = d.id;
  if (d.id) Object.assign(db.categories.find((c) => c.id === d.id), data);
  else { newId = 'c-' + uid(); db.categories.push({ id: newId, ...data }); }
  save();
  if (d.returnTo) {
    sheetCtx = d.returnTo;
    if (sheetCtx.type === data.type) { sheetCtx.categoryId = newId; if (data.type === 'egreso') sheetCtx.expKind = data.kind; }
    drawTxSheet(false);
    render();
    return;
  }
  closeSheet(); render(); toast('Categoría guardada');
}

/* =========================================================
   Respaldo / importación / ejemplo
   ========================================================= */
async function shareOrDownload(filename, content, mime) {
  const file = new File([content], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportJSON() {
  shareOrDownload(`mis-finanzas-${todayISO()}.json`, JSON.stringify(db, null, 2), 'application/json');
}
function exportCSV() {
  const q = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
  const rows = [['Fecha', 'Tipo', 'Categoría', 'Clase de gasto', 'Monto', 'Nota'].map(q).join(';')];
  [...db.transactions].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((t) => {
    rows.push([t.date, t.type === 'ingreso' ? 'Ingreso' : 'Gasto', catById(t.categoryId).name,
      t.type === 'egreso' ? (KINDS[t.kind] || KINDS.variable).label : '', String(t.amount).replace('.', ','), t.note || ''].map(q).join(';'));
  });
  shareOrDownload(`mis-finanzas-${todayISO()}.csv`, '﻿' + rows.join('\r\n'), 'text/csv');
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.transactions)) throw new Error('formato');
      if (!confirm(`Esto reemplazará tus datos actuales por el respaldo (${data.transactions.length} movimientos). ¿Continuar?`)) return;
      db = normalize(data); save(); render(); toast('Respaldo importado ✓');
    } catch (e) { toast('El archivo no es un respaldo válido'); }
  };
  reader.readAsText(file);
}

function sampleData() {
  const d = freshDB();
  d.settings = { ...db.settings, onboarded: true };
  const cur = currentMonth();
  const today = new Date().getDate();
  const scale = { CLP: 1000, COP: 4000, ARS: 1000, PYG: 7000, CRC: 500, MXN: 18, DOP: 60, UYU: 40, PEN: 3.7, BOB: 7, GTQ: 7.8, USD: 1, EUR: 1 }[d.settings.currency] || 1;
  const amt = (usd) => (scale >= 100 ? Math.round((usd * scale) / 100) * 100 : Math.round(usd * scale * 100) / 100);
  const setB = (id, usd) => { d.categories.find((c) => c.id === id).budget = amt(usd); };
  setB('c-super', 400); setB('c-restaurantes', 150); setB('c-cafe', 40); setB('c-transporte', 120);
  const fixed = [
    ['Sueldo', 'ingreso', 2500, 'c-sueldo', 1],
    ['Arriendo', 'egreso', 700, 'c-vivienda', 5],
    ['Luz y agua', 'egreso', 70, 'c-servicios', 10],
    ['Internet y celular', 'egreso', 45, 'c-internet', 12],
    ['Netflix + Spotify', 'egreso', 22, 'c-suscripciones', 15],
    ['Crédito auto', 'egreso', 230, 'c-creditos', 20],
  ].map(([name, type, usd, categoryId, day]) => ({ id: uid(), name, type, amount: amt(usd), categoryId, day, active: true }));
  d.fixed = fixed;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tx = (date, type, usd, categoryId, kind, note = '', fixedId) => d.transactions.push({ id: uid(), created: Date.now(), date, type, amount: amt(usd), categoryId, kind: type === 'egreso' ? kind : undefined, note, fixedId });
  for (let back = 3; back >= 0; back--) {
    const key = addMonths(cur, -back);
    const lastDay = back === 0 ? today : daysInMonth(key);
    const D = (n) => `${key}-${pad(Math.min(n, daysInMonth(key)))}`;
    fixed.forEach((f) => { if (f.day <= lastDay) d.transactions.push({ id: uid(), created: Date.now(), date: D(f.day), type: f.type, amount: f.amount, categoryId: f.categoryId, kind: f.type === 'egreso' ? 'fijo' : undefined, note: f.name, fixedId: f.id }); });
    if (back === 2 && lastDay >= 18) tx(D(18), 'ingreso', 350, 'c-freelance', null, 'Proyecto web');
    for (let day = 1; day <= lastDay; day++) {
      if (rnd() < 0.55) tx(D(day), 'egreso', 2.5 + rnd() * 3, 'c-cafe', 'hormiga', rnd() < 0.5 ? 'Café' : 'Latte');
      if (rnd() < 0.25) tx(D(day), 'egreso', 1.5 + rnd() * 4, 'c-snacks', 'hormiga');
      if (rnd() < 0.12) tx(D(day), 'egreso', 8 + rnd() * 10, 'c-delivery', 'hormiga');
      if (rnd() < 0.1) tx(D(day), 'egreso', 5 + rnd() * 8, 'c-apps', 'hormiga');
      if (day % 7 === 3) tx(D(day), 'egreso', 70 + rnd() * 45, 'c-super', 'variable', 'Compra semanal');
      if (rnd() < 0.15) tx(D(day), 'egreso', 15 + rnd() * 25, 'c-transporte', 'variable', 'Bencina / transporte');
      if (rnd() < 0.1) tx(D(day), 'egreso', 20 + rnd() * 35, 'c-restaurantes', 'variable');
      if (rnd() < 0.05) tx(D(day), 'egreso', 25 + rnd() * 60, 'c-compras', 'variable');
      if (rnd() < 0.04) tx(D(day), 'egreso', 15 + rnd() * 40, 'c-ocio', 'variable', 'Cine / salida');
      if (rnd() < 0.03) tx(D(day), 'egreso', 10 + rnd() * 30, 'c-salud', 'variable', 'Farmacia');
    }
  }
  const c = (back, usd, note = '') => ({ id: uid(), date: `${addMonths(cur, -back)}-02`, amount: amt(usd), note });
  d.goals = [
    { id: uid(), name: 'Fondo de emergencia', emoji: '🛟', target: amt(4500), deadline: addMonths(cur, 12), contributions: [c(3, 1200, 'Saldo inicial'), c(2, 250), c(1, 250), c(0, 250)] },
    { id: uid(), name: 'Vacaciones', emoji: '🏖️', target: amt(1500), deadline: addMonths(cur, 7), contributions: [c(2, 150), c(1, 150), c(0, 150)] },
  ];
  return d;
}

/* =========================================================
   Toast con deshacer
   ========================================================= */
let toastTimer;
function toast(msg, undoFn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undoFn ? '<button data-action="undo">Deshacer</button>' : ''}`;
  el.hidden = false;
  toast.undo = undoFn || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; toast.undo = null; }, undoFn ? 5000 : 2200);
}
function withUndo(msg, mutate) {
  const snapshot = JSON.stringify(db);
  mutate();
  save(); closeSheet(); render();
  toast(msg, () => { db = normalize(JSON.parse(snapshot)); save(); render(); toast('Restaurado'); });
}

/* =========================================================
   Acciones
   ========================================================= */
const actions = {
  go: (el) => { ui.tab = el.dataset.tab; if (ui.tab !== 'movimientos') ui.filter.cat = ''; render(); window.scrollTo(0, 0); },
  month: (el) => { ui.month = addMonths(ui.month, +el.dataset.delta); ui.chartSel = null; render(); },
  'month-today': () => { ui.month = currentMonth(); ui.chartSel = null; render(); },
  add: () => openTxSheet({ type: 'egreso' }),
  'close-sheet': () => closeSheet(),
  undo: () => { const fn = toast.undo; $('#toast').hidden = true; if (fn) fn(); },

  // Dashboard
  'filter-go': (el) => { ui.tab = 'movimientos'; ui.filter = { type: el.dataset.type, q: '', cat: '' }; render(); window.scrollTo(0, 0); },
  'filter-cat': (el) => { ui.tab = 'movimientos'; ui.filter = { type: 'all', q: '', cat: el.dataset.id }; render(); window.scrollTo(0, 0); },
  'chart-sel': (el) => { ui.chartSel = +el.dataset.i; render(); },
  'toggle-table': () => { ui.showTable = !ui.showTable; render(); },
  'quick-hormiga': (el) => openTxSheet({ type: 'egreso', categoryId: el.dataset.id, kind: 'hormiga' }),
  sample: () => {
    if (db.transactions.length && !confirm('Esto reemplazará tus datos actuales por datos de ejemplo. ¿Continuar?')) return;
    const snapshot = JSON.stringify(db);
    db = sampleData(); save(); ui.month = currentMonth(); ui.tab = 'inicio'; render(); window.scrollTo(0, 0);
    toast('Datos de ejemplo cargados', () => { db = normalize(JSON.parse(snapshot)); save(); render(); });
  },

  // Movimientos
  filter: (el) => { ui.filter.type = el.dataset.type; render(); },
  'clear-cat': () => { ui.filter.cat = ''; render(); },
  'edit-tx': (el) => openTxSheet({ id: el.dataset.id }),
  'tx-type': (el) => {
    syncTxDraft();
    if (sheetCtx.type === el.dataset.v) return;
    sheetCtx.type = el.dataset.v;
    const first = catsOfType(sheetCtx.type)[0];
    sheetCtx.categoryId = first ? first.id : '';
    sheetCtx.expKind = first ? first.kind : 'variable';
    drawTxSheet(false);
  },
  'tx-kind': (el) => { syncTxDraft(); sheetCtx.expKind = el.dataset.v; drawTxSheet(false); },
  'tx-cat': (el) => {
    syncTxDraft();
    sheetCtx.categoryId = el.dataset.id;
    if (sheetCtx.type === 'egreso') sheetCtx.expKind = catById(el.dataset.id).kind || 'variable';
    drawTxSheet(false);
  },
  'save-tx': () => saveTx(),
  'dup-tx': () => {
    const t = db.transactions.find((x) => x.id === sheetCtx.id);
    db.transactions.push({ ...t, id: uid(), created: Date.now(), date: todayISO(), fixedId: undefined });
    save(); closeSheet(); ui.month = currentMonth(); render(); toast('Movimiento duplicado para hoy');
  },
  'del-tx': () => { const id = sheetCtx.id; withUndo('Movimiento eliminado', () => { db.transactions = db.transactions.filter((t) => t.id !== id); }); },

  // Fijos
  'new-fixed': () => openFixedSheet(null),
  'edit-fixed': (el) => openFixedSheet(el.dataset.id),
  'toggle-fixed': (el) => toggleFixed(el.dataset.id),
  'pay-all': () => {
    const pend = fixedStatus(ui.month).filter((x) => !x.tx && x.f.type === 'egreso');
    if (!confirm(`¿Registrar ${pend.length} gastos fijos como pagados en ${monthName(ui.month)}?`)) return;
    pend.forEach(({ f }) => db.transactions.push({ id: uid(), created: Date.now(), type: 'egreso', amount: f.amount, categoryId: f.categoryId, kind: 'fijo', note: f.name, fixedId: f.id, date: `${ui.month}-${pad(Math.min(f.day || 1, daysInMonth(ui.month)))}` }));
    save(); render(); toast('Gastos fijos registrados ✓');
  },
  'fx-type': (el) => {
    syncFixedDraft();
    sheetCtx.type = el.dataset.v;
    const c = catsOfType(sheetCtx.type).find((x) => x.kind === 'fijo') || catsOfType(sheetCtx.type)[0];
    sheetCtx.categoryId = c ? c.id : '';
    drawFixedSheet();
  },
  'fx-cat': (el) => { syncFixedDraft(); sheetCtx.categoryId = el.dataset.id; drawFixedSheet(); },
  'save-fixed': () => saveFixed(),
  'del-fixed': () => { const id = sheetCtx.id; withUndo('Fijo eliminado', () => { db.fixed = db.fixed.filter((f) => f.id !== id); }); },

  // Metas
  'new-goal': () => openGoalSheet(null),
  'edit-goal': (el) => openGoalSheet(el.dataset.id),
  'goal-emoji': (el) => {
    sheetCtx.emoji = el.dataset.v;
    document.querySelectorAll('#goalEmojis .chip').forEach((b) => b.classList.toggle('on', b.dataset.v === el.dataset.v));
  },
  'save-goal': () => saveGoal(),
  'del-goal': () => { const id = sheetCtx.id; withUndo('Meta eliminada', () => { db.goals = db.goals.filter((g) => g.id !== id); }); },
  contrib: (el) => openContribSheet(el.dataset.id, +el.dataset.sign),
  'edit-contrib': (el) => openContribSheet(el.dataset.goal, 1, el.dataset.id),
  'contrib-sign': (el) => {
    sheetCtx.sign = +el.dataset.v;
    sheet.querySelectorAll('[data-action="contrib-sign"]').forEach((b) => b.classList.toggle('on', b.dataset.v === el.dataset.v));
  },
  'save-contrib': () => saveContrib(),
  'del-contrib': () => {
    const { goalId, id } = sheetCtx;
    withUndo('Aporte eliminado', () => { const g = db.goals.find((x) => x.id === goalId); g.contributions = g.contributions.filter((c) => c.id !== id); });
  },

  // Categorías
  'new-cat': (el) => { if (sheetCtx && sheetCtx.kind === 'tx') syncTxDraft(); openCatSheet(null, el.dataset.type); },
  'edit-cat': (el) => openCatSheet(el.dataset.id),
  'cat-type': (el) => { sheetCtx.type = el.dataset.v; drawCatSheet(null); },
  'cat-kind': (el) => {
    sheetCtx.expKind = el.dataset.v;
    sheet.querySelectorAll('[data-action="cat-kind"]').forEach((b) => b.classList.toggle('on', b.dataset.v === el.dataset.v));
  },
  'save-cat': () => saveCat(),
  'del-cat': () => { const id = sheetCtx.id; withUndo('Categoría eliminada', () => { db.categories = db.categories.filter((c) => c.id !== id); }); },

  // Ajustes
  theme: (el) => { db.settings.theme = el.dataset.v; save(); render(); },
  'export-json': () => exportJSON(),
  'export-csv': () => exportCSV(),
  'import-json': () => $('#importFile').click(),
  reset: () => {
    if (!confirm('¿Borrar TODOS tus datos? Te recomendamos exportar un respaldo antes.')) return;
    const snapshot = JSON.stringify(db);
    const keep = { currency: db.settings.currency, theme: db.settings.theme };
    db = freshDB(); Object.assign(db.settings, keep); save(); ui.tab = 'inicio'; render();
    toast('Datos borrados', () => { db = normalize(JSON.parse(snapshot)); save(); render(); });
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'search') {
    ui.filter.q = e.target.value;
    $('#txList').innerHTML = renderTxList();
  }
});

document.addEventListener('change', (e) => {
  const key = e.target.dataset.setting;
  if (!key) return;
  let v = e.target.value;
  if (key === 'savingsGoalPct') v = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
  db.settings[key] = v;
  save(); render();
  toast('Ajuste guardado');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  if (e.key === 'Enter' && !sheet.hidden && e.target.matches('input:not([type=checkbox])')) {
    const btn = sheet.querySelector('.sheet-head .link.strong');
    if (btn) { e.preventDefault(); btn.click(); }
  }
});

$('#importFile').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) importJSON(f);
  e.target.value = '';
});

// Mantener el mes actual al volver a la app tras días sin abrirla
let lastActiveMonth = currentMonth();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentMonth() !== lastActiveMonth) {
    if (ui.month === lastActiveMonth) ui.month = currentMonth();
    lastActiveMonth = currentMonth();
    render();
  }
});

/* =========================================================
   Inicio
   ========================================================= */
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
