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

const TAB_TITLES = { inicio: 'Inicio', movimientos: 'Movimientos', fijos: 'Pagos', metas: 'Metas', ajustes: 'Ajustes' };

const CREDIT_KINDS = {
  tarjeta: { icon: '💳', label: 'Tarjeta de crédito' },
  prestamo: { icon: '🏦', label: 'Préstamo' },
};

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
    version: 2,
    updatedAt: '',
    settings: {
      currency: guessCurrency(), theme: 'auto', name: '', savingsGoalPct: 20, onboarded: false,
      createdAt: new Date().toISOString(), lastBackup: '', backupSnoozeUntil: '', initialBalance: 0,
    },
    categories: defaultCategories(),
    transactions: [],
    fixed: [],
    goals: [],
    credits: [],
  };
}

/* =========================================================
   Persistencia
   ========================================================= */
const arr = (x) => (Array.isArray(x) ? x : []);

function normalize(d) {
  const base = freshDB();
  const out = {
    version: 2,
    updatedAt: (d && d.updatedAt) || '',
    settings: { ...base.settings, ...(d && d.settings) },
    categories: Array.isArray(d && d.categories) ? d.categories : base.categories,
    transactions: arr(d && d.transactions),
    fixed: arr(d && d.fixed),
    goals: arr(d && d.goals).map((g) => ({ ...g })),
    credits: arr(d && d.credits),
  };
  // v1 → v2: los aportes a metas pasan a ser movimientos de ahorro
  for (const g of out.goals) {
    if (!Array.isArray(g.contributions)) continue;
    for (const c of g.contributions) {
      if (!c || !c.amount) continue;
      const opening = c.note === 'Saldo inicial';
      out.transactions.push({
        id: c.id || 'm' + Math.random().toString(36).slice(2, 10), created: Date.now(), type: 'ahorro',
        amount: Math.abs(c.amount), withdraw: c.amount < 0 || undefined, opening: opening || undefined,
        date: c.date || new Date().toISOString().slice(0, 10), note: opening ? 'Ahorro previo' : c.note || '', goalId: g.id,
      });
    }
    delete g.contributions;
  }
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
  writeLocal();
  cloudSchedule();
}
function writeLocal() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (e) {
    toast('⚠️ No se pudo guardar. Exporta un respaldo.');
  }
}
const hasData = () => !!(db.transactions.length || db.fixed.length || db.goals.length || db.credits.length);

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
const savingValue = (t) => (t.withdraw ? -t.amount : t.amount);

function monthStats(key, untilDay = 31) {
  const txs = db.transactions.filter((t) => t.date && t.date.startsWith(key) && +t.date.slice(8, 10) <= untilDay);
  let ingresos = 0, gastos = 0, ahorro = 0, hormigaCount = 0;
  const byKind = { fijo: 0, variable: 0, hormiga: 0 };
  const byCat = {};
  for (const t of txs) {
    if (t.type === 'ingreso') { ingresos += t.amount; continue; }
    if (t.type === 'ahorro') { if (!t.opening) ahorro += savingValue(t); continue; }
    gastos += t.amount;
    const k = KINDS[t.kind] ? t.kind : 'variable';
    byKind[k] += t.amount;
    if (k === 'hormiga') hormigaCount++;
    byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount;
  }
  return { key, txs, ingresos, gastos, ahorro, neto: ingresos - gastos, balance: ingresos - gastos - ahorro, byKind, byCat, hormigaCount };
}

// Saldo disponible: saldo inicial + ingresos − gastos − lo que se aparta como ahorro
function balanceUntil(key) {
  let b = +db.settings.initialBalance || 0;
  for (const t of db.transactions) {
    if (t.date.slice(0, 7) > key) continue;
    if (t.type === 'ingreso') b += t.amount;
    else if (t.type === 'egreso') b -= t.amount;
    else if (t.type === 'ahorro' && !t.opening) b -= savingValue(t);
  }
  return b;
}
function savedUntil(key) {
  return db.transactions.reduce((s, t) => (t.type === 'ahorro' && t.date.slice(0, 7) <= key ? s + savingValue(t) : s), 0);
}

const goalById = (id) => db.goals.find((g) => g.id === id);
const goalTxs = (g) => db.transactions.filter((t) => t.type === 'ahorro' && t.goalId === g.id);
const goalSaved = (g) => goalTxs(g).reduce((s, t) => s + savingValue(t), 0);
const totalInGoals = () => db.goals.reduce((s, g) => s + goalSaved(g), 0);

/* ---------- Compras en cuotas ---------- */
const creditTxs = (c) => db.transactions.filter((t) => t.creditId === c.id);
const creditPaid = (c) => Math.min(c.n, (c.paidBefore || 0) + creditTxs(c).length);
const creditLeft = (c) => Math.max(0, c.n - creditPaid(c));
const creditEnd = (c) => addMonths(c.firstMonth, c.n - 1);
const creditTxIn = (c, key) => creditTxs(c).filter((t) => t.date.startsWith(key)).sort(byDateDesc)[0];
const creditsActive = (key) => db.credits.filter((c) => creditLeft(c) > 0 || creditTxIn(c, key));
const creditsDueIn = (key) => db.credits.filter((c) => key >= c.firstMonth && (creditTxIn(c, key) || creditLeft(c) > 0));
const creditAmountIn = (c, key) => { const t = creditTxIn(c, key); return t ? t.amount : c.cuota; };

function roundMoney(n) {
  return nfFull && nfFull.resolvedOptions().maximumFractionDigits === 0 ? Math.round(n) : round2(n);
}
// Cuota fija (sistema francés). Tasa mensual en %
function cuotaCalc(total, n, ratePct) {
  if (!(total > 0) || !(n > 0)) return 0;
  const i = (ratePct || 0) / 100;
  return roundMoney(i > 0 ? (total * i) / (1 - Math.pow(1 + i, -n)) : total / n);
}
const fmtRate = (r) => String(round2(r)).replace('.', ',');

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
  updateCloudBadge();
}

function applyTheme() {
  const t = db.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/* ---------- Componentes ---------- */
function txItem(t) {
  const sub = [t.note ? esc(t.note) : '', fmtDateShort.format(parseISO(t.date))].filter(Boolean).join(' · ');
  let emoji, title, tag = '', amt;
  if (t.type === 'ahorro') {
    const g = goalById(t.goalId);
    emoji = g ? g.emoji || '🎯' : '🐷';
    title = (t.withdraw ? 'Retiro de ahorro' : 'Ahorro') + (g ? ` · ${g.name}` : '');
    tag = t.opening ? '<span class="tag sav">Previo</span>' : '';
    amt = `<span class="amt sav">${t.withdraw ? '−' : ''}${money(t.amount)}</span>`;
  } else {
    const c = catById(t.categoryId);
    emoji = c.emoji;
    title = c.name;
    if (t.creditId) tag = '<span class="tag cuota">Cuota</span>';
    else if (t.type === 'egreso') tag = `<span class="tag ${esc(t.kind)}">${esc((KINDS[t.kind] || KINDS.variable).label)}</span>`;
    amt = `<span class="amt ${t.type === 'ingreso' ? 'pos' : ''}">${signed(t.amount, t.type)}</span>`;
  }
  return `<button class="item" data-action="edit-tx" data-id="${esc(t.id)}">
    <span class="emoji" aria-hidden="true">${esc(emoji)}</span>
    <span class="main"><div class="t1">${esc(title)}${tag}</div><div class="t2">${sub}</div></span>
    ${amt}
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
  let html = '';

  if (!hasData()) {
    html += `<div class="card empty">
      <div class="big">👋</div>
      <p style="color:var(--ink-1);font-weight:600;font-size:18px">¡Bienvenido a Mis Finanzas!</p>
      <p class="sub" style="margin:6px 0 14px">Registra tus ingresos y gastos, marca tus gastos fijos y descubre cuánto se te va en gastos hormiga.</p>
      <div class="btn-row"><button class="btn primary" data-action="add">Agregar movimiento</button></div>
      <div class="btn-row"><button class="btn" data-action="go" data-tab="fijos">Configurar gastos fijos</button></div>
      <div class="btn-row"><button class="btn" data-action="sample">Ver con datos de ejemplo</button></div>
    </div>`;
  }

  html += backupReminder();

  // Héroe: saldo disponible
  const saldo = balanceUntil(key);
  const ib = +db.settings.initialBalance || 0;
  html += `<section class="card hero">
    <div class="label">Saldo disponible${isCurrent ? '' : ` <span class="muted small">al cierre de ${esc(monthShort(key))}</span>`}</div>
    <div class="value num ${saldo < 0 ? 'neg' : ''}">${money(saldo)}</div>
    <div class="meta"><span>Balance de ${esc(monthName(key))}: <b class="num ${m.balance < 0 ? 'neg' : 'pos'}">${m.balance > 0 ? '+' : ''}${money(m.balance)}</b></span></div>
    <p class="note">Ingresos − gastos − lo que apartas como ahorro${ib ? `, partiendo de un saldo inicial de ${money(ib)}` : ''}.
      <button class="link inline" data-action="edit-initial">${ib ? 'Editar saldo inicial' : '¿Ya tenías dinero? Agrega tu saldo inicial'}</button></p>
  </section>`;

  // Ahorro: del mes y total a la fecha
  html += renderSavingsCard(key, m, goalPct);

  // Tiles
  const delta = (cur, before, upIsGood) => {
    if (!before) return '<div class="delta">&nbsp;</div>';
    const ch = (cur - before) / before;
    const good = upIsGood ? ch >= 0 : ch <= 0;
    return `<div class="delta"><span class="${good ? 'pos' : 'neg'}">${ch >= 0 ? '▲' : '▼'} ${pct(Math.abs(ch))}</span> vs ${esc(monthShort(prev.key))}${isCurrent ? ' a la fecha' : ''}</div>`;
  };
  const due = creditsDueIn(key);
  const dueAmt = due.reduce((s2, c) => s2 + creditAmountIn(c, key), 0);
  const duePaid = due.filter((c) => creditTxIn(c, key)).length;
  html += `<div class="tiles">
    <button class="card tile" data-action="filter-go" data-type="ingreso" style="text-align:left">
      <div class="label">Ingresos</div><div class="value num">${money(m.ingresos)}</div>${delta(m.ingresos, prevCmp.ingresos, true)}
    </button>
    <button class="card tile" data-action="filter-go" data-type="egreso" style="text-align:left">
      <div class="label">Gastos</div><div class="value num">${money(m.gastos)}</div>${delta(m.gastos, prevCmp.gastos, false)}
    </button>
    <button class="card tile" data-action="go" data-tab="fijos" style="text-align:left">
      <div class="label">Cuotas del mes</div><div class="value num">${money(dueAmt)}</div>
      <div class="delta">${due.length ? `${duePaid} de ${due.length} pagadas` : 'Sin compras en cuotas'}</div>
    </button>
    <button class="card tile" data-action="go" data-tab="metas" style="text-align:left">
      <div class="label">En metas de ahorro</div><div class="value num">${money(totalInGoals())}</div><div class="delta">${db.goals.length} ${db.goals.length === 1 ? 'meta' : 'metas'}</div>
    </button>
  </div>`;

  // Consejos
  const tips = insights(key, m, prev, goalPct);
  if (tips.length) {
    html += `<section class="card"><div class="card-head"><h2>Resumen inteligente</h2></div>
      <ul class="insights">${tips.map(([i, t]) => `<li><span class="i" aria-hidden="true">${i}</span><span>${t}</span></li>`).join('')}</ul></section>`;
  }

  // Cuotas en curso
  html += renderCreditsCard(key);

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

function insights(key, m, prev, goalPct) {
  const out = [];
  const isCurrent = key === currentMonth();
  const fs = fixedStatus(key);
  const pending = fs.filter((x) => !x.tx && x.f.type === 'egreso');
  const pendingCuotas = creditsDueIn(key).filter((c) => !creditTxIn(c, key));
  const pendingAmt = pending.reduce((s, x) => s + x.f.amount, 0) + pendingCuotas.reduce((s, c) => s + c.cuota, 0);
  const pendingN = pending.length + pendingCuotas.length;
  const g = db.settings.savingsGoalPct || 0;
  const target = goalPct * m.ingresos;

  if (m.ingresos > 0) {
    if (m.ahorro > 0 && m.ahorro >= target) out.push(['✅', `Este mes ahorraste <b>${money(m.ahorro)}</b> (${pct(m.ahorro / m.ingresos)} de tus ingresos): cumples tu meta del ${g}&nbsp;%.`]);
    else if (m.ahorro > 0) out.push(['💡', `Llevas <b>${money(m.ahorro)}</b> ahorrado este mes. Para tu meta del ${g}&nbsp;% te faltan <b>${money(target - m.ahorro)}</b>.`]);
    else if (target > 0) out.push(['🐷', `Aún no registras ahorro este mes. Tu meta del ${g}&nbsp;% equivale a <b>${money(target)}</b>.`]);
  }
  if (m.neto < 0) out.push(['🚨', `Este mes gastaste <b>${money(-m.neto)}</b> más de lo que ingresó.`]);
  if (m.byKind.hormiga > 0) {
    out.push(['🐜', `Tus gastos hormiga suman <b>${money(m.byKind.hormiga)}</b> (${m.hormigaCount} compras). A este ritmo serían ~<b>${money(m.byKind.hormiga * 12)}</b> al año.`]);
  }
  if (isCurrent && pendingN) {
    out.push(['📅', `Tienes ${pendingN} ${pendingN === 1 ? 'pago pendiente' : 'pagos pendientes'} (fijos y cuotas) por <b>${money(pendingAmt)}</b>.`]);
  }
  const act = db.credits.filter((c) => creditLeft(c) > 0);
  if (act.length) {
    const monthly = act.reduce((s, c) => s + c.cuota, 0);
    const debt = act.reduce((s, c) => s + creditLeft(c) * c.cuota, 0);
    out.push(['💳', `Pagas <b>${money(monthly)}</b> al mes en cuotas y te quedan <b>${money(debt)}</b> por pagar.`]);
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
  return out.slice(0, 6);
}

function renderSavingsCard(key, m, goalPct) {
  const total = savedUntil(key);
  const target = goalPct * m.ingresos;
  const r = target > 0 ? m.ahorro / target : 0;
  const pendingFixed = fixedStatus(key).filter((x) => x.f.type === 'ahorro' && !x.tx);
  return `<section class="card">
    <div class="card-head"><h2>🐷 Ahorro</h2><button class="link" data-action="add-saving">+ Ahorrar</button></div>
    <div class="kv lg" style="grid-template-columns:1fr 1fr">
      <div><div class="k">Ahorro del mes</div><div class="v num">${money(m.ahorro)}</div></div>
      <div><div class="k">Total ahorrado a la fecha</div><div class="v num">${money(total)}</div></div>
    </div>
    ${m.ingresos > 0 && target > 0 ? `
      <div class="row" style="margin:12px 0 6px"><span class="sub">Meta del mes: <b class="num">${money(target)}</b></span><span class="spacer"></span>
        <span class="small muted">${db.settings.savingsGoalPct}&nbsp;% de tus ingresos</span></div>
      ${meter(r, r >= 1 ? 'good' : '')}
      <div class="status" style="margin-top:6px">${r >= 1 ? '✓ ¡Meta del mes cumplida!' : m.ahorro > 0 ? `Vas en el ${pct(r)} · te faltan ${money(target - m.ahorro)}` : 'Aún no registras ahorro este mes'}</div>`
      : `<p class="note">Anota cuánto apartas cada mes con “+ Ahorrar”. Al registrar tus ingresos verás tu meta del ${db.settings.savingsGoalPct}&nbsp;%.</p>`}
    ${pendingFixed.length ? `<div class="list" style="margin-top:6px">${pendingFixed.map(fixedRow).join('')}</div>` : ''}
  </section>`;
}

function creditBlock(c, key) {
  const paid = creditPaid(c);
  const left = creditLeft(c);
  const info = CREDIT_KINDS[c.kind] || CREDIT_KINDS.tarjeta;
  const txIn = creditTxIn(c, key);
  const bar = c.n <= 60
    ? `<div class="cuotas" style="gap:${c.n > 24 ? 2 : 4}px" role="img" aria-label="${paid} de ${c.n} cuotas pagadas">${Array.from({ length: c.n }, (_, i) => `<span class="${i < paid ? 'on' : ''}"></span>`).join('')}</div>`
    : `<div style="margin:12px 0 10px">${meter(paid / c.n, 'cuota')}</div>`;
  const interest = c.rate > 0 ? `${fmtRate(c.rate)}&nbsp;% mensual` : c.kind === 'tarjeta' ? 'Sin interés' : 'Cuota fija';
  const status = left === 0 ? '🎉 ¡Pagada por completo!'
    : left === 1 ? `Te queda solo la última cuota (${money(c.cuota)}).`
      : `Quedan ${left} · ${money(left * c.cuota)} por pagar. Termina en ${esc(monthLabel(creditEnd(c)))}.`;
  let action = '';
  if (key < c.firstMonth) action = `<span class="small muted">Primera cuota en ${esc(monthLabel(c.firstMonth))}</span>`;
  else if (txIn || left > 0) action = `<button class="check ${txIn ? 'on' : ''}" data-action="toggle-credit" data-id="${esc(c.id)}">${txIn ? '✓ Pagada este mes' : `Pagar cuota ${paid + 1}`}</button>`;
  return `<div class="credit">
    <button class="credit-main" data-action="edit-credit" data-id="${esc(c.id)}">
      <div class="credit-top"><span class="credit-name">${esc(c.name)}</span><span class="badge">${info.icon} ${esc(c.lender || info.label)}</span></div>
      <div class="small muted" style="margin-top:2px">${interest}${c.note ? ` · ${esc(c.note)}` : ''}</div>
      ${bar}
      <div class="credit-line">${paid ? `Cuota <b>${paid} de ${c.n}</b>` : `<b>${c.n} cuotas</b>`} · ${money(c.cuota)}</div>
      <div class="small muted" style="margin-top:4px">${status}</div>
    </button>
    ${action ? `<div class="row" style="margin-top:10px"><span class="spacer"></span>${action}</div>` : ''}
  </div>`;
}

function renderCreditsCard(key) {
  const act = creditsActive(key);
  if (!act.length) return '';
  const monthAmt = creditsDueIn(key).reduce((s, c) => s + creditAmountIn(c, key), 0);
  const debt = act.reduce((s, c) => s + creditLeft(c) * c.cuota, 0);
  return `<section class="card"><div class="card-head"><h2>💳 Cuotas en curso</h2><button class="link" data-action="go" data-tab="fijos">Ver todas</button></div>
    <p class="sub" style="margin:-4px 0 12px">Este mes: <b class="num">${money(monthAmt)}</b> · Deuda pendiente: <b class="num">${money(debt)}</b></p>
    ${act.slice(0, 3).map((c) => creditBlock(c, key)).join('')}
    ${act.length > 3 ? `<div class="btn-row"><button class="btn sm" data-action="go" data-tab="fijos">Ver ${act.length - 3} más</button></div>` : ''}
  </section>`;
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

function fixedEmoji(f) {
  if (f.type === 'ahorro') { const g = goalById(f.goalId); return g ? g.emoji || '🎯' : '🐷'; }
  return catById(f.categoryId).emoji;
}
function fixedRow({ f, tx }) {
  const isIn = f.type === 'ingreso';
  const isSav = f.type === 'ahorro';
  const doneLabel = isSav ? '✓ Ahorrado' : isIn ? '✓ Recibido' : '✓ Pagado';
  const todoLabel = isSav ? 'Ahorrar' : isIn ? 'Recibir' : 'Pagar';
  const g = isSav ? goalById(f.goalId) : null;
  return `<div class="item">
    <button class="emoji" data-action="edit-fixed" data-id="${esc(f.id)}" aria-label="Editar ${esc(f.name)}">${esc(fixedEmoji(f))}</button>
    <button class="main" style="text-align:left" data-action="edit-fixed" data-id="${esc(f.id)}">
      <div class="t1">${esc(f.name)}</div>
      <div class="t2"><span class="num ${isIn ? 'pos' : ''}" style="color:${isIn ? '' : 'var(--ink-1)'};font-weight:600">${money(tx ? tx.amount : f.amount)}</span> · día ${f.day || 1}${g ? ` · ${esc(g.name)}` : ''}</div></button>
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
  if (!data.some((d) => d.ingresos || d.gastos || d.ahorro)) return '';
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
  ['all', 'Todos'], ['ingreso', 'Ingresos'], ['egreso', 'Gastos'], ['ahorro', '🐷 Ahorro'], ['cuota', '💳 Cuotas'],
  ['fijo', 'Fijos'], ['variable', 'Variables'], ['hormiga', '🐜 Hormiga'],
];
function txSearchText(t) {
  const name = t.type === 'ahorro' ? `ahorro ${(goalById(t.goalId) || {}).name || ''}` : catById(t.categoryId).name;
  return `${name} ${t.note || ''} ${t.amount}`.toLowerCase();
}

function filteredTxs() {
  const f = ui.filter;
  const q = f.q.trim().toLowerCase();
  return db.transactions
    .filter((t) => t.date.startsWith(ui.month))
    .filter((t) => {
      if (f.type === 'ingreso' || f.type === 'egreso' || f.type === 'ahorro') return t.type === f.type;
      if (f.type === 'cuota') return !!t.creditId;
      if (KINDS[f.type]) return t.type === 'egreso' && t.kind === f.type;
      return true;
    })
    .filter((t) => !f.cat || t.categoryId === f.cat)
    .filter((t) => !q || txSearchText(t).includes(q))
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
  const sav = txs.filter((t) => t.type === 'ahorro').reduce((s, t) => s + savingValue(t), 0);
  const groups = {};
  txs.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
  return `<div class="row small sub" style="padding:0 4px;margin-bottom:-6px">
      <span>${txs.length} movimientos</span><span class="spacer"></span>
      ${inc ? `<span class="pos num">+${money(inc)}</span>` : ''}${out ? `<span class="num">−${money(out)}</span>` : ''}${sav ? `<span class="num">🐷 ${money(sav)}</span>` : ''}</div>
    ${Object.entries(groups).map(([date, list]) => {
      const net = list.reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : t.type === 'egreso' ? -t.amount : t.opening ? 0 : -savingValue(t)), 0);
      return `<div class="day-head"><span>${esc(dayLabel(date))}</span><span class="num">${money(net)}</span></div>
        <div class="card" style="padding:2px 14px"><div class="list">${list.map(txItem).join('')}</div></div>`;
    }).join('')}`;
}

/* =========================================================
   Vista: Pagos (fijos + cuotas)
   ========================================================= */
function renderFijos() {
  const key = ui.month;
  const fs = fixedStatus(key);
  const outs = fs.filter((x) => x.f.type === 'egreso');
  const ins = fs.filter((x) => x.f.type === 'ingreso');
  const savs = fs.filter((x) => x.f.type === 'ahorro');
  const due = creditsDueIn(key);
  const fixedOut = outs.reduce((s2, x) => s2 + x.f.amount, 0);
  const totalOut = fixedOut + due.reduce((s2, c) => s2 + creditAmountIn(c, key), 0);
  const totalIn = ins.reduce((s2, x) => s2 + x.f.amount, 0);
  const paidAmt = outs.filter((x) => x.tx).reduce((s2, x) => s2 + x.tx.amount, 0)
    + due.filter((c) => creditTxIn(c, key)).reduce((s2, c) => s2 + creditTxIn(c, key).amount, 0);
  const pendingOut = outs.filter((x) => !x.tx);
  const inactive = db.fixed.filter((f) => f.active === false);
  const active = creditsActive(key);
  const finished = db.credits.filter((c) => !active.includes(c));
  let html = `<section class="card">
    <div class="kv">
      <div><div class="k">Fijos + cuotas</div><div class="v num">${money(totalOut)}</div></div>
      <div><div class="k">Pagado</div><div class="v num">${money(paidAmt)}</div></div>
      <div><div class="k">Pendiente</div><div class="v num">${money(Math.max(0, totalOut - paidAmt))}</div></div>
    </div>
    ${totalOut ? `<div style="margin-top:12px">${meter(paidAmt / totalOut, 'good')}</div>` : ''}
    ${totalIn ? `<p class="sub" style="margin-top:10px">Tus gastos fijos y cuotas consumen el <b>${pct(totalOut / totalIn)}</b> de tus ingresos fijos (${money(totalIn)}). Lo ideal es que no superen el 50&nbsp;%.</p>` : ''}
    <div class="btn-row">
      <button class="btn primary" data-action="new-fixed">+ Nuevo fijo</button>
      <button class="btn primary" data-action="new-credit">+ Compra en cuotas</button>
    </div>
    ${pendingOut.length ? `<div class="btn-row"><button class="btn" data-action="pay-all">Marcar todos los fijos como pagados</button></div>` : ''}
    <p class="note">Toca “Pagar” para registrar el pago de ${esc(monthName(key))} como gasto. Toca el nombre para editar.</p>
  </section>`;
  html += `<h3 class="section-title">Compras en cuotas</h3>`;
  html += active.length
    ? `<section class="card">${active.map((c) => creditBlock(c, key)).join('')}</section>`
    : `<section class="card"><p class="sub">Registra compras con tarjeta de crédito o préstamos en cuotas y lleva la cuenta de cuántas te quedan.</p>
        <div class="btn-row"><button class="btn" data-action="new-credit">+ Agregar compra en cuotas</button></div></section>`;
  if (finished.length) {
    html += `<h3 class="section-title">Cuotas terminadas</h3><section class="card" style="padding:4px 14px"><div class="list">
      ${finished.map((c) => `<button class="item" data-action="edit-credit" data-id="${esc(c.id)}"><span class="emoji">${(CREDIT_KINDS[c.kind] || CREDIT_KINDS.tarjeta).icon}</span>
        <span class="main"><div class="t1">${esc(c.name)}</div><div class="t2">${c.n} cuotas de ${money(c.cuota)} · terminó en ${esc(monthLabel(creditEnd(c)))}</div></span><span class="chev">›</span></button>`).join('')}
    </div></section>`;
  }
  html += `<h3 class="section-title">Gastos fijos</h3><section class="card" style="padding:4px 14px">
    ${outs.length ? `<div class="list">${outs.map(fixedRow).join('')}</div>` : `<p class="muted" style="padding:12px 0">Aún no tienes gastos fijos.</p>`}</section>`;
  html += `<h3 class="section-title">Ingresos fijos</h3><section class="card" style="padding:4px 14px">
    ${ins.length ? `<div class="list">${ins.map(fixedRow).join('')}</div>` : `<p class="muted" style="padding:12px 0">Agrega tu sueldo u otros ingresos que recibes cada mes.</p>`}</section>`;
  html += `<h3 class="section-title">Ahorro fijo</h3><section class="card" style="padding:4px 14px">
    ${savs.length ? `<div class="list">${savs.map(fixedRow).join('')}</div>` : `<p class="muted" style="padding:12px 0">¿Apartas un monto cada mes? Agrégalo con “+ Nuevo fijo” → Ahorro.</p>`}</section>`;
  if (inactive.length) {
    html += `<h3 class="section-title">Pausados</h3><section class="card" style="padding:4px 14px"><div class="list">
      ${inactive.map((f) => `<button class="item" data-action="edit-fixed" data-id="${esc(f.id)}"><span class="emoji">${esc(fixedEmoji(f))}</span>
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
  const total = savedUntil('9999-12');
  const inGoals = totalInGoals();
  const thisMonth = monthStats(currentMonth()).ahorro;
  let html = `<section class="card hero">
    <div class="label">Total ahorrado a la fecha</div>
    <div class="value num">${money(total)}</div>
    <div class="meta"><span>Este mes: <b class="num">${money(thisMonth)}</b></span><span>En metas: <b class="num">${money(inGoals)}</b></span>
      <span>Sin meta: <b class="num">${money(total - inGoals)}</b></span></div>
    <div class="btn-row"><button class="btn primary" data-action="add-saving">+ Ahorrar</button><button class="btn" data-action="new-goal">+ Nueva meta</button></div>
    <p class="note">Cada ahorro que anotas se descuenta de tu saldo disponible y se suma aquí. Puedes asignarlo a una meta o dejarlo libre.</p>
  </section>`;
  const recent = db.transactions.filter((t) => t.type === 'ahorro').sort(byDateDesc).slice(0, 8);
  const recentHtml = recent.length ? `<h3 class="section-title">Últimos ahorros</h3><section class="card" style="padding:2px 14px"><div class="list">${recent.map(txItem).join('')}</div></section>` : '';
  if (!db.goals.length) {
    html += `<div class="card empty"><div class="big">🎯</div><p>Crea tu primera meta: fondo de emergencia, viaje, auto…</p>
      <div class="btn-row"><button class="btn primary" data-action="new-goal">+ Nueva meta</button></div></div>`;
    return html + recentHtml;
  }
  html += db.goals.map((g) => `<section class="card">${goalBlock(g)}
    <div class="btn-row"><button class="btn sm" data-action="contrib" data-id="${esc(g.id)}" data-sign="1">+ Aportar</button>
    <button class="btn sm" data-action="contrib" data-id="${esc(g.id)}" data-sign="-1">− Retirar</button></div></section>`).join('');
  return html + recentHtml;
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
    <div class="field"><label for="setInitial">Saldo inicial (dinero que tenías al empezar)</label>
      <input id="setInitial" class="input num" inputmode="decimal" data-setting="initialBalance" value="${esc(amountStr(s.initialBalance))}" placeholder="0"></div>
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

  <h3 class="section-title">Copia automática en Google Drive</h3>
  <section class="card" id="cloudCard">${renderCloudCard()}</section>

  <h3 class="section-title">Respaldo en iCloud / Archivos</h3>
  <section class="card">
    <p class="sub">Guarda un archivo de respaldo y elige “Guardar en Archivos” → iCloud Drive. Sirve para recuperar tus datos si borras la app o cambias de iPhone.</p>
    <p class="small muted" style="margin-top:6px">Último respaldo: <b>${db.settings.lastBackup ? esc(fmtDateTime(db.settings.lastBackup)) : 'nunca'}</b></p>
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
  <p class="note" style="text-align:center;margin:16px 0">Mis Finanzas · v2.0 · Sin cuentas, sin anuncios, sin servidores.</p>`;
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
  const firstCat = type === 'ahorro' ? null : catsOfType(type)[0];
  const categoryId = type === 'ahorro' ? '' : existing ? existing.categoryId : opts.categoryId || (firstCat ? firstCat.id : '');
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
    creditId: existing ? existing.creditId || null : null,
    goalId: existing ? existing.goalId || '' : opts.goalId || '',
    withdraw: existing ? !!existing.withdraw : !!opts.withdraw,
    opening: existing ? !!existing.opening : false,
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
  const op = document.getElementById('txOpening');
  if (op) sheetCtx.opening = op.checked;
}

function drawTxSheet(focus) {
  const d = sheetCtx;
  const isOut = d.type === 'egreso';
  const isSav = d.type === 'ahorro';
  const cats = isSav ? [] : catsOfType(d.type);
  const typeWord = isSav ? 'ahorros' : isOut ? 'gastos' : 'ingresos';
  const canRepeat = !d.id && !d.fixedId && !(isSav && (d.withdraw || d.opening));
  sheet.innerHTML = `<div class="grabber"></div>
    ${sheetHead(d.id ? 'Editar movimiento' : 'Nuevo movimiento', 'save-tx')}
    <div class="seg" style="margin-bottom:14px">
      <button class="${isOut ? 'on' : ''}" data-action="tx-type" data-v="egreso">Gasto</button>
      <button class="${d.type === 'ingreso' ? 'on' : ''}" data-action="tx-type" data-v="ingreso">Ingreso</button>
      <button class="${isSav ? 'on' : ''}" data-action="tx-type" data-v="ahorro">🐷 Ahorro</button>
    </div>
    <div class="field"><input id="txAmount" class="input amount num" inputmode="decimal" placeholder="0" value="${esc(d.amount)}" aria-label="Monto" autocomplete="off"></div>
    ${isSav ? `
    <div class="field"><div class="seg">
      <button class="${!d.withdraw ? 'on' : ''}" data-action="tx-withdraw" data-v="0">Aportar</button>
      <button class="${d.withdraw ? 'on' : ''}" data-action="tx-withdraw" data-v="1">Retirar</button>
    </div><div class="note" style="margin-top:2px">${d.withdraw ? 'Sacas dinero de tus ahorros: vuelve a tu saldo disponible.' : 'Apartas dinero de tu saldo disponible y lo sumas a tus ahorros.'}</div></div>
    <div class="field"><span class="lbl">¿Para qué meta?</span><div class="chips" style="flex-wrap:wrap">
      <button class="chip ${!d.goalId ? 'on' : ''}" data-action="tx-goal" data-id="">🐷 Sin meta</button>
      ${db.goals.map((g) => `<button class="chip ${d.goalId === g.id ? 'on' : ''}" data-action="tx-goal" data-id="${esc(g.id)}">${esc(g.emoji || '🎯')} ${esc(g.name)}</button>`).join('')}
    </div></div>
    ${!d.withdraw ? `<div class="switch-row"><span><b>Ya lo tenía ahorrado</b><br><span class="small muted">No descuenta de tu saldo ni cuenta como ahorro del mes; solo suma al total ahorrado.</span></span>
      <label class="switch"><input type="checkbox" id="txOpening" ${d.opening ? 'checked' : ''}><span></span></label></div>` : ''}`
    : `${isOut ? `<div class="field"><span class="lbl">Tipo de gasto</span><div class="seg">
      ${KIND_ORDER.map((k) => `<button class="${d.expKind === k ? 'on' : ''}" data-action="tx-kind" data-v="${k}">${k === 'hormiga' ? '🐜 ' : ''}${KINDS[k].label}</button>`).join('')}
    </div><div class="note" style="margin-top:2px">${KINDS[d.expKind].hint}</div></div>` : ''}
    <div class="field"><span class="lbl">Categoría</span><div class="cat-grid">
      ${cats.map((c) => `<button class="cat-opt ${c.id === d.categoryId ? 'on' : ''}" data-action="tx-cat" data-id="${esc(c.id)}"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}</button>`).join('')}
      <button class="cat-opt" data-action="new-cat" data-type="${d.type}"><span class="e">＋</span>Nueva</button>
    </div></div>`}
    <div class="field-row">
      <div class="field"><label for="txDate">Fecha</label><input id="txDate" class="input" type="date" value="${esc(d.date)}"></div>
      <div class="field"><label for="txNote">Nota</label><input id="txNote" class="input" value="${esc(d.note)}" placeholder="Opcional" enterkeyhint="done"></div>
    </div>
    ${canRepeat ? `<div class="switch-row"><span><b>Repetir cada mes</b><br><span class="small muted">Lo agrega a tus ${typeWord} fijos</span></span>
      <label class="switch"><input type="checkbox" id="txRepeat" ${d.repeat ? 'checked' : ''}><span></span></label></div>` : ''}
    ${d.fixedId ? `<p class="note">🔁 Movimiento generado desde un fijo mensual.</p>` : ''}
    ${d.creditId ? `<p class="note">💳 Pago de una compra en cuotas. Si lo eliminas, la cuota vuelve a quedar pendiente.</p>` : ''}
    <div class="btn-row"><button class="btn primary" data-action="save-tx">Guardar</button></div>
    ${isOut && !d.id ? `<div class="btn-row"><button class="btn" data-action="new-credit-from-tx">💳 ¿Fue en cuotas? Regístralo como compra en cuotas</button></div>` : ''}
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
  const isSav = d.type === 'ahorro';
  if (!isSav && !d.categoryId) { toast('Elige una categoría'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) { toast('Fecha inválida'); return; }
  const data = {
    type: d.type, amount, date: d.date, note: d.note.trim(),
    categoryId: isSav ? undefined : d.categoryId,
    kind: d.type === 'egreso' ? d.expKind : undefined,
    goalId: isSav && d.goalId ? d.goalId : undefined,
    withdraw: isSav && d.withdraw ? true : undefined,
    opening: isSav && !d.withdraw && d.opening ? true : undefined,
  };
  let t;
  if (d.id) {
    t = db.transactions.find((x) => x.id === d.id);
    Object.assign(t, data);
  } else {
    t = { id: uid(), created: Date.now(), ...data };
    if (d.repeat && !data.withdraw && !data.opening) {
      const g = goalById(d.goalId);
      const name = d.note.trim() || (isSav ? (g ? `Ahorro ${g.name}` : 'Ahorro mensual') : catById(d.categoryId).name);
      const f = { id: uid(), name, type: d.type, amount, categoryId: data.categoryId || '', goalId: data.goalId, day: parseISO(d.date).getDate(), active: true };
      db.fixed.push(f);
      t.fixedId = f.id;
      if (d.type === 'egreso') t.kind = 'fijo';
    }
    db.transactions.push(t);
  }
  Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]);
  save();
  closeSheet();
  ui.month = d.date.slice(0, 7);
  render();
  const g = isSav ? goalById(d.goalId) : null;
  if (g && !d.withdraw && goalSaved(g) >= g.target) toast(`🎉 ¡Cumpliste la meta ${g.name}!`);
  else toast(d.id ? 'Movimiento actualizado' : isSav ? (d.withdraw ? 'Retiro registrado' : 'Ahorro guardado 🐷') : d.type === 'ingreso' ? 'Ingreso guardado' : 'Gasto guardado');
}

/* ---------- Gasto/ingreso fijo ---------- */
function openFixedSheet(id) {
  const f = id ? db.fixed.find((x) => x.id === id) : null;
  const type = f ? f.type : 'egreso';
  const fixedCat = catsOfType(type).find((c) => c.kind === 'fijo') || catsOfType(type)[0];
  sheetCtx = {
    kind: 'fixed', id: f ? f.id : null, type, goalId: f ? f.goalId || '' : '',
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
  const isSav = d.type === 'ahorro';
  openSheet(`${sheetHead(d.id ? 'Editar fijo' : 'Nuevo fijo', 'save-fixed')}
    <div class="seg" style="margin-bottom:14px">
      <button class="${isOut ? 'on' : ''}" data-action="fx-type" data-v="egreso">Gasto</button>
      <button class="${d.type === 'ingreso' ? 'on' : ''}" data-action="fx-type" data-v="ingreso">Ingreso</button>
      <button class="${isSav ? 'on' : ''}" data-action="fx-type" data-v="ahorro">🐷 Ahorro</button>
    </div>
    <div class="field"><label for="fxName">Nombre</label><input id="fxName" class="input" value="${esc(d.name)}" placeholder="${isSav ? 'Ej: Ahorro mensual' : isOut ? 'Ej: Arriendo, Luz, Netflix' : 'Ej: Sueldo'}"></div>
    <div class="field-row">
      <div class="field"><label for="fxAmount">Monto mensual</label><input id="fxAmount" class="input num" inputmode="decimal" value="${esc(d.amount)}" placeholder="0"></div>
      <div class="field"><label for="fxDay">Día del mes</label><input id="fxDay" class="input" type="number" inputmode="numeric" min="1" max="31" value="${esc(d.day)}"></div>
    </div>
    ${isSav ? `<div class="field"><span class="lbl">¿Para qué meta?</span><div class="chips" style="flex-wrap:wrap">
      <button class="chip ${!d.goalId ? 'on' : ''}" data-action="fx-goal" data-id="">🐷 Sin meta</button>
      ${db.goals.map((g) => `<button class="chip ${d.goalId === g.id ? 'on' : ''}" data-action="fx-goal" data-id="${esc(g.id)}">${esc(g.emoji || '🎯')} ${esc(g.name)}</button>`).join('')}
    </div></div>` : `<div class="field"><span class="lbl">Categoría</span><div class="cat-grid">
      ${catsOfType(d.type).map((c) => `<button class="cat-opt ${c.id === d.categoryId ? 'on' : ''}" data-action="fx-cat" data-id="${esc(c.id)}"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}</button>`).join('')}
    </div></div>`}
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
  const isSav = d.type === 'ahorro';
  const data = { name: d.name.trim(), type: d.type, amount, categoryId: isSav ? '' : d.categoryId, goalId: isSav && d.goalId ? d.goalId : undefined, day, active: d.active };
  let f;
  if (d.id) { f = db.fixed.find((x) => x.id === d.id); Object.assign(f, data); }
  else { f = { id: uid(), ...data }; db.fixed.push(f); }
  Object.keys(f).forEach((k) => f[k] === undefined && delete f[k]);
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
    const t = {
      id: uid(), created: Date.now(), type: f.type, amount: f.amount,
      date: `${key}-${pad(Math.min(f.day || 1, daysInMonth(key)))}`, note: f.name, fixedId: f.id,
    };
    if (f.type === 'ahorro') { if (f.goalId) t.goalId = f.goalId; }
    else { t.categoryId = f.categoryId; if (f.type === 'egreso') t.kind = 'fijo'; }
    db.transactions.push(t);
  }
  save(); render();
  toast(tx ? 'Marcado como pendiente' : f.type === 'ahorro' ? `🐷 ${f.name} ahorrado` : f.type === 'ingreso' ? `✓ ${f.name} recibido` : `✓ ${f.name} pagado`);
}

/* ---------- Metas ---------- */
const GOAL_EMOJIS = ['🎯', '🛟', '✈️', '🚗', '🏠', '💻', '🎓', '💍', '🏖️', '📱', '👶', '🐶'];
function openGoalSheet(id) {
  const g = id ? db.goals.find((x) => x.id === id) : null;
  sheetCtx = { kind: 'goal', id: g ? g.id : null, emoji: g ? g.emoji || '🎯' : '🎯' };
  const contribs = g ? goalTxs(g).sort(byDateDesc) : [];
  openSheet(`${sheetHead(g ? 'Editar meta' : 'Nueva meta', 'save-goal')}
    <div class="field"><span class="lbl">Ícono</span><div class="chips" id="goalEmojis">
      ${GOAL_EMOJIS.map((e) => `<button class="chip ${e === sheetCtx.emoji ? 'on' : ''}" data-action="goal-emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
    <div class="field"><label for="gName">Nombre</label><input id="gName" class="input" value="${esc(g ? g.name : '')}" placeholder="Ej: Fondo de emergencia"></div>
    <div class="field-row">
      <div class="field"><label for="gTarget">Monto objetivo</label><input id="gTarget" class="input num" inputmode="decimal" value="${esc(g ? amountStr(g.target) : '')}" placeholder="0"></div>
      <div class="field"><label for="gDeadline">Fecha límite</label><input id="gDeadline" class="input" type="month" value="${esc(g ? g.deadline || '' : '')}"></div>
    </div>
    ${!g ? `<div class="field"><label for="gInitial">¿Cuánto llevas ahorrado para esta meta? (opcional)</label><input id="gInitial" class="input num" inputmode="decimal" placeholder="0"></div>` : ''}
    <div class="btn-row"><button class="btn primary" data-action="save-goal">Guardar</button></div>
    ${g ? `<div class="btn-row"><button class="btn" data-action="contrib" data-id="${esc(g.id)}" data-sign="1">+ Aportar</button><button class="btn" data-action="contrib" data-id="${esc(g.id)}" data-sign="-1">− Retirar</button></div>
      <h3 class="section-title">Historial (${contribs.length})</h3>
      ${contribs.length ? `<div class="list">${contribs.map(txItem).join('')}</div>` : '<p class="muted small">Sin aportes aún.</p>'}
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
    const g = { id: uid(), ...data };
    const init = parseAmount(val('gInitial'));
    if (init > 0) db.transactions.push({ id: uid(), created: Date.now(), type: 'ahorro', amount: init, opening: true, goalId: g.id, date: todayISO(), note: 'Ahorro previo' });
    db.goals.push(g);
  }
  save(); closeSheet(); render(); toast('Meta guardada');
}
/* ---------- Saldo inicial ---------- */
function openInitialSheet() {
  sheetCtx = { kind: 'initial' };
  openSheet(`${sheetHead('Saldo inicial', 'save-initial')}
    <p class="sub" style="margin-bottom:12px">¿Cuánto dinero disponible tenías (en tu cuenta o efectivo) cuando empezaste a usar la app? Se suma a tu saldo disponible.</p>
    <div class="field"><input id="ibAmount" class="input amount num" inputmode="decimal" placeholder="0" value="${esc(amountStr(db.settings.initialBalance))}" aria-label="Saldo inicial"></div>
    <p class="note">Si además ya tenías ahorros, regístralos con “+ Ahorrar” activando “Ya lo tenía ahorrado”.</p>
    <div class="btn-row"><button class="btn primary" data-action="save-initial">Guardar</button></div>`);
  setTimeout(() => { const a = $('#ibAmount'); if (a) a.focus(); }, 60);
}

/* ---------- Compras en cuotas ---------- */
function openCreditSheet(id, preset = {}) {
  const c = id ? db.credits.find((x) => x.id === id) : null;
  const defCat = db.categories.find((x) => x.id === 'c-creditos') || catsOfType('egreso')[0];
  sheetCtx = { kind: 'credit', id: c ? c.id : null, ckind: c ? c.kind : 'tarjeta', withInterest: c ? c.rate > 0 : false, manual: c ? !!c.cuotaManual : false };
  drawCreditSheet(c ? { ...c, total: amountStr(c.total), cuota: amountStr(c.cuota), rate: c.rate ? fmtRate(c.rate) : '' } : {
    name: preset.name || '', lender: '', total: preset.total || '', n: '', rate: '', cuota: '', firstMonth: ui.month,
    day: Math.min(new Date().getDate(), 28), paidBefore: 0, categoryId: preset.categoryId || (defCat ? defCat.id : ''), note: '',
  });
}
function readCreditForm() {
  return {
    name: val('crName'), lender: val('crLender'), total: val('crTotal'), n: val('crN'), rate: val('crRate'),
    cuota: val('crCuota'), firstMonth: val('crFirst'), day: val('crDay'), paidBefore: val('crPaid'),
    categoryId: val('crCat'), note: val('crNote'),
  };
}
function drawCreditSheet(v) {
  const d = sheetCtx;
  const isCard = d.ckind === 'tarjeta';
  const c = d.id ? db.credits.find((x) => x.id === d.id) : null;
  const showRate = !isCard || d.withInterest;
  openSheet(`${sheetHead(c ? 'Editar compra en cuotas' : 'Nueva compra en cuotas', 'save-credit')}
    <div data-credit>
    <div class="seg" style="margin-bottom:14px">
      <button class="${isCard ? 'on' : ''}" data-action="cr-kind" data-v="tarjeta">💳 Tarjeta de crédito</button>
      <button class="${!isCard ? 'on' : ''}" data-action="cr-kind" data-v="prestamo">🏦 Préstamo</button>
    </div>
    <div class="field"><label for="crName">${isCard ? '¿Qué compraste?' : '¿Para qué es el préstamo?'}</label>
      <input id="crName" class="input" value="${esc(v.name)}" placeholder="${isCard ? 'Ej: MacBook, cama, celular' : 'Ej: Auto, estudios, deudas'}"></div>
    <div class="field"><label for="crLender">${isCard ? 'Tarjeta' : 'Banco o financiera'} <span class="muted">(opcional)</span></label>
      <input id="crLender" class="input" value="${esc(v.lender)}" placeholder="${isCard ? 'Ej: Visa Santander' : 'Ej: BancoEstado'}"></div>
    <div class="field-row">
      <div class="field"><label for="crTotal">${isCard ? 'Precio de la compra' : 'Monto del préstamo'}</label><input id="crTotal" class="input num" inputmode="decimal" value="${esc(v.total)}" placeholder="0"></div>
      <div class="field"><label for="crN">N° de cuotas</label><input id="crN" class="input num" type="number" inputmode="numeric" min="1" max="360" value="${esc(v.n)}" placeholder="Ej: 12"></div>
    </div>
    ${isCard ? `<div class="field"><span class="lbl">Interés</span><div class="seg">
      <button class="${!d.withInterest ? 'on' : ''}" data-action="cr-int" data-v="0">Sin interés</button>
      <button class="${d.withInterest ? 'on' : ''}" data-action="cr-int" data-v="1">Con interés</button></div></div>` : ''}
    ${showRate ? `<div class="field"><label for="crRate">Tasa de interés mensual (%)</label>
      <input id="crRate" class="input num" inputmode="decimal" value="${esc(v.rate)}" placeholder="${isCard ? 'Ej: 2,5' : 'Ej: 1,2 (0 si no la sabes)'}">
      <div class="note" style="margin-top:2px">Aparece en tu estado de cuenta o simulación como “tasa mensual”.</div></div>` : ''}
    <div class="field"><label for="crCuota">Valor de cada cuota</label>
      <input id="crCuota" class="input num" inputmode="decimal" value="${esc(v.cuota)}" placeholder="Se calcula solo">
      <div class="note" id="crSummary" style="margin-top:2px"></div></div>
    <div class="field-row">
      <div class="field"><label for="crFirst">Primera cuota</label><input id="crFirst" class="input" type="month" value="${esc(v.firstMonth)}"></div>
      <div class="field"><label for="crDay">Día de pago</label><input id="crDay" class="input" type="number" inputmode="numeric" min="1" max="31" value="${esc(v.day)}"></div>
    </div>
    <div class="field"><label for="crPaid">Cuotas que ya pagaste antes de anotarla aquí</label>
      <input id="crPaid" class="input num" type="number" inputmode="numeric" min="0" value="${esc(v.paidBefore || 0)}"></div>
    <div class="field"><label for="crCat">Categoría del gasto</label><select id="crCat" class="select">
      ${catsOfType('egreso').map((x) => `<option value="${esc(x.id)}" ${x.id === v.categoryId ? 'selected' : ''}>${esc(x.emoji)} ${esc(x.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="crNote">Nota <span class="muted">(opcional)</span></label><input id="crNote" class="input" value="${esc(v.note)}" placeholder="Ej: para la casa"></div>
    </div>
    <div class="btn-row"><button class="btn primary" data-action="save-credit">Guardar</button></div>
    ${c ? `<div class="btn-row">
      ${creditLeft(c) > 0 ? '<button class="btn" data-action="credit-pay-next">Pagar siguiente cuota</button>' : ''}
      ${creditTxs(c).length ? '<button class="btn" data-action="credit-undo-last">Deshacer último pago</button>' : ''}</div>
      <div class="btn-row"><button class="btn danger" data-action="del-credit">Eliminar</button></div>
      <p class="note">Pagadas: ${creditPaid(c)} de ${c.n}. Eliminarla no borra los pagos ya registrados como gastos.</p>`
    : '<p class="note">Cada cuota que pagues se registra como gasto del mes en la categoría elegida.</p>'}`);
  recalcCredit();
}
function creditNumbers() {
  const isCard = sheetCtx.ckind === 'tarjeta';
  const total = parseAmount(val('crTotal'));
  const n = parseInt(val('crN'), 10);
  const rate = isCard && !sheetCtx.withInterest ? 0 : (parseAmount(val('crRate')) || 0);
  return { total, n, rate };
}
function recalcCredit(srcId) {
  if (!sheetCtx || sheetCtx.kind !== 'credit') return;
  const cuotaEl = $('#crCuota');
  if (srcId === 'crCuota') sheetCtx.manual = !!cuotaEl.value.trim();
  const { total, n, rate } = creditNumbers();
  if (!sheetCtx.manual) {
    const c = cuotaCalc(total, n, rate);
    cuotaEl.value = c ? String(c) : '';
  }
  const cuota = parseAmount(cuotaEl.value);
  const sum = $('#crSummary');
  if (!sum) return;
  if (cuota > 0 && n > 0) {
    const pay = cuota * n;
    const interest = total > 0 ? pay - total : 0;
    sum.innerHTML = `Total a pagar: <b>${money(pay)}</b>${interest > 0.5 ? ` · Intereses: <b>${money(interest)}</b>` : total > 0 ? ' · Sin intereses' : ''}${sheetCtx.manual ? ' · <button class="link inline" data-action="cr-auto">Calcular automáticamente</button>' : ''}`;
  } else sum.textContent = 'Ingresa el monto y el número de cuotas (o el valor de la cuota).';
}
function saveCredit() {
  const v = readCreditForm();
  const d = sheetCtx;
  const name = v.name.trim();
  if (!name) { toast('Escribe qué compraste'); return; }
  const n = parseInt(v.n, 10);
  if (!(n >= 1 && n <= 360)) { toast('Ingresa el número de cuotas'); return; }
  const { rate } = creditNumbers();
  let total = parseAmount(v.total);
  let cuota = parseAmount(v.cuota);
  if (!(cuota > 0)) cuota = cuotaCalc(total, n, rate);
  if (!(total > 0) && cuota > 0) total = roundMoney(cuota * n);
  if (!(cuota > 0)) { toast('Ingresa el monto o el valor de la cuota'); return; }
  const data = {
    kind: d.ckind, name, lender: v.lender.trim(), total, n, rate, cuota, cuotaManual: d.manual,
    firstMonth: /^\d{4}-\d{2}$/.test(v.firstMonth) ? v.firstMonth : ui.month,
    day: Math.min(31, Math.max(1, parseInt(v.day, 10) || 1)),
    paidBefore: Math.min(n, Math.max(0, parseInt(v.paidBefore, 10) || 0)),
    categoryId: v.categoryId, note: v.note.trim(),
  };
  if (d.id) Object.assign(db.credits.find((c) => c.id === d.id), data);
  else db.credits.push({ id: uid(), created: Date.now(), ...data });
  save(); closeSheet(); render();
  toast(d.id ? 'Compra actualizada' : `Guardada: ${n} cuotas de ${money(cuota)}`);
}
function payCredit(c, key) {
  if (creditLeft(c) <= 0) { toast('Esta compra ya está pagada'); return; }
  const k = creditPaid(c) + 1;
  db.transactions.push({
    id: uid(), created: Date.now(), type: 'egreso', kind: 'fijo', categoryId: c.categoryId, amount: c.cuota,
    date: key === currentMonth() ? todayISO() : `${key}-${pad(Math.min(c.day || 1, daysInMonth(key)))}`,
    note: `${c.name} · cuota ${k} de ${c.n}`, creditId: c.id,
  });
  save(); render();
  toast(k === c.n ? `🎉 ¡Terminaste de pagar ${c.name}!` : `✓ Cuota ${k} de ${c.n} pagada`);
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
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
async function exportJSON() {
  const ok = await shareOrDownload(`mis-finanzas-${todayISO()}.json`, JSON.stringify(db, null, 2), 'application/json');
  if (!ok) return;
  db.settings.lastBackup = new Date().toISOString();
  db.settings.backupSnoozeUntil = '';
  save(); render();
  toast('Respaldo guardado ✓');
}
function exportCSV() {
  const q = (s) => `"${String(s == null ? '' : s).replace(/"/g, '""')}"`;
  const rows = [['Fecha', 'Tipo', 'Categoría', 'Clase de gasto', 'Monto', 'Nota'].map(q).join(';')];
  [...db.transactions].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((t) => {
    const isSav = t.type === 'ahorro';
    const tipo = isSav ? (t.withdraw ? 'Retiro de ahorro' : 'Ahorro') : t.type === 'ingreso' ? 'Ingreso' : 'Gasto';
    const cat = isSav ? ((goalById(t.goalId) || {}).name || 'Ahorro') : catById(t.categoryId).name;
    const clase = t.type === 'egreso' ? (t.creditId ? 'Cuota' : (KINDS[t.kind] || KINDS.variable).label) : isSav && t.opening ? 'Ahorro previo' : '';
    rows.push([t.date, tipo, cat, clase, String(isSav ? savingValue(t) : t.amount).replace('.', ','), t.note || ''].map(q).join(';'));
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
  ].map(([name, type, usd, categoryId, day]) => ({ id: uid(), name, type, amount: amt(usd), categoryId, day, active: true }));
  const fondo = { id: uid(), name: 'Fondo de emergencia', emoji: '🛟', target: amt(4500), deadline: addMonths(cur, 12) };
  const vacas = { id: uid(), name: 'Vacaciones', emoji: '🏖️', target: amt(1500), deadline: addMonths(cur, 7) };
  d.goals = [fondo, vacas];
  fixed.push({ id: uid(), name: 'Ahorro mensual', type: 'ahorro', amount: amt(250), categoryId: '', goalId: fondo.id, day: 2, active: true });
  d.fixed = fixed;
  d.settings.initialBalance = amt(800);
  const mkCredit = (o) => ({ id: uid(), created: Date.now(), cuotaManual: false, note: '', paidBefore: 0, categoryId: 'c-creditos', ...o, cuota: cuotaCalc(o.total, o.n, o.rate) });
  d.credits = [
    mkCredit({ kind: 'tarjeta', name: 'Cama', lender: 'Visa', total: amt(210), n: 3, rate: 0, firstMonth: addMonths(cur, -2), day: 10, categoryId: 'c-compras', note: 'para el dormitorio' }),
    mkCredit({ kind: 'tarjeta', name: 'MacBook', lender: 'Mastercard', total: amt(1500), n: 24, rate: 1.5, firstMonth: addMonths(cur, -1), day: 10, categoryId: 'c-compras' }),
    mkCredit({ kind: 'prestamo', name: 'Auto', lender: 'BancoEstado', total: amt(8000), n: 48, rate: 1.1, firstMonth: addMonths(cur, -10), day: 20, paidBefore: 7 }),
  ];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tx = (date, type, usd, categoryId, kind, note = '', fixedId) => d.transactions.push({ id: uid(), created: Date.now(), date, type, amount: amt(usd), categoryId, kind: type === 'egreso' ? kind : undefined, note, fixedId });
  for (let back = 3; back >= 0; back--) {
    const key = addMonths(cur, -back);
    const lastDay = back === 0 ? today : daysInMonth(key);
    const D = (n) => `${key}-${pad(Math.min(n, daysInMonth(key)))}`;
    fixed.forEach((f) => {
      if (f.day > lastDay) return;
      if (f.type === 'ahorro') d.transactions.push({ id: uid(), created: Date.now(), date: D(f.day), type: 'ahorro', amount: f.amount, goalId: f.goalId, note: f.name, fixedId: f.id });
      else d.transactions.push({ id: uid(), created: Date.now(), date: D(f.day), type: f.type, amount: f.amount, categoryId: f.categoryId, kind: f.type === 'egreso' ? 'fijo' : undefined, note: f.name, fixedId: f.id });
    });
    if (back > 0) {
      d.credits.forEach((c) => {
        if (key < c.firstMonth) return;
        const k = c.paidBefore + d.transactions.filter((t) => t.creditId === c.id).length + 1;
        if (k > c.n) return;
        d.transactions.push({ id: uid(), created: Date.now(), date: D(c.day), type: 'egreso', kind: 'fijo', categoryId: c.categoryId, amount: c.cuota, note: `${c.name} · cuota ${k} de ${c.n}`, creditId: c.id });
      });
      d.transactions.push({ id: uid(), created: Date.now(), date: D(25), type: 'ahorro', amount: amt(150), goalId: vacas.id, note: '' });
    }
    if (back === 3) d.transactions.push({ id: uid(), created: Date.now(), date: D(1), type: 'ahorro', amount: amt(1200), goalId: fondo.id, opening: true, note: 'Ahorro previo' });
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
  d.transactions.forEach((t) => Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]));
  return d;
}

/* =========================================================
   Copia automática en Google Drive (Google Apps Script)
   ========================================================= */
const SYNC_KEY = 'misfinanzas.sync';
const cloud = (() => {
  const base = { url: '', key: '', lastSyncedAt: '' };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') }; } catch (e) { return base; }
})();
const cloudState = { status: 'off', error: '', checked: false, busy: false, pending: false, timer: null, lastCheck: 0 };
const cloudOn = () => !!(cloud.url && cloud.key);
const validCloudUrl = (u) => /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(u);

function saveSync() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(cloud)); } catch (e) { /* sin espacio */ }
}
function newCloudKey() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return 'mf-' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
function errMsg(e) {
  if (e instanceof TypeError) return 'Sin conexión, o la aplicación web no tiene acceso para “Cualquier usuario”.';
  return (e && e.message) || 'Error desconocido';
}
function setCloudStatus(status, error = '') {
  cloudState.status = status;
  cloudState.error = error;
  updateCloudBadge();
}
const fmtDateTimeI = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso) => fmtDateTimeI.format(new Date(iso));
function ago(iso) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return fmtDateTime(iso);
}

async function cloudCall(action, extra = {}) {
  const res = await fetch(cloud.url, { method: 'POST', body: JSON.stringify({ action, key: cloud.key, ...extra }) });
  let j;
  try { j = await res.json(); } catch (e) {
    throw new Error('Google respondió algo inesperado. Revisa que la implementación sea “Aplicación web” con acceso “Cualquier usuario”.');
  }
  if (!j.ok) throw new Error(j.error === 'Clave incorrecta' ? 'La clave no coincide con la del código que pegaste en Google.' : j.error || 'Error desconocido');
  return j;
}

function cloudSchedule(ms = 1500) {
  if (!cloudOn()) return;
  cloudState.pending = true;
  clearTimeout(cloudState.timer);
  if (cloudState.checked && !cloudState.busy) setCloudStatus('pending');
  cloudState.timer = setTimeout(cloudPush, ms);
}

async function cloudPush() {
  if (!cloudOn()) return;
  // No subir nada hasta comparar con lo que hay en Drive (evita pisar datos de otro dispositivo)
  if (!cloudState.checked || cloudState.busy) { cloudState.pending = true; return; }
  clearTimeout(cloudState.timer);
  cloudState.busy = true;
  cloudState.pending = false;
  setCloudStatus('syncing');
  const at = db.updatedAt || new Date().toISOString();
  try {
    await cloudCall('save', { data: db, updatedAt: at });
    cloud.lastSyncedAt = at;
    saveSync();
    cloudState.busy = false;
    setCloudStatus('ok');
  } catch (e) {
    cloudState.busy = false;
    setCloudStatus('error', errMsg(e));
    return;
  }
  if (cloudState.pending) cloudSchedule(300);
}

async function cloudCheck() {
  if (!cloudOn() || cloudState.busy) return;
  cloudState.busy = true;
  setCloudStatus('syncing');
  let r;
  try { r = await cloudCall('load'); } catch (e) {
    cloudState.busy = false;
    setCloudStatus('error', errMsg(e));
    return;
  }
  cloudState.busy = false;
  cloudState.checked = true;
  cloudState.lastCheck = Date.now();
  const localAt = db.updatedAt || '';
  const remoteAt = (r.data && r.updatedAt) || '';
  if (!r.data) return hasData() ? cloudPush() : setCloudStatus('ok');
  if (localAt > remoteAt) return cloudPush();
  if (localAt === remoteAt) return cloudState.pending ? cloudPush() : setCloudStatus('ok');
  // Drive tiene datos más nuevos (por ejemplo, de otro dispositivo)
  const localChanged = hasData() && localAt > (cloud.lastSyncedAt || '');
  if (!localChanged) applyCloud(r, hasData() ? 'Datos actualizados desde Google Drive' : 'Datos recuperados desde Google Drive ✓');
  else openConflictSheet(r);
}

function applyCloud(r, msg) {
  db = normalize(r.data);
  db.updatedAt = r.updatedAt || db.updatedAt;
  writeLocal();
  cloud.lastSyncedAt = db.updatedAt;
  saveSync();
  cloudState.checked = true;
  cloudState.pending = false;
  setCloudStatus('ok');
  render();
  if (msg) toast(msg);
}

function openConflictSheet(r, firstTime = false) {
  sheetCtx = { kind: 'conflict', remote: r };
  const rc = (r.data.transactions || []).length;
  setCloudStatus('pending');
  openSheet(`${sheetHead(firstTime ? 'Ya tienes datos en Drive' : 'Hay cambios en dos lugares', null)}
    <p class="sub" style="margin-bottom:12px">${firstTime
      ? 'Encontramos una copia en tu Google Drive y también hay datos en este iPhone. ¿Cuáles quieres conservar?'
      : 'Los datos de Google Drive cambiaron desde otro dispositivo, y este iPhone también tiene cambios sin guardar. Elige cuáles conservar.'}</p>
    <div class="kv" style="grid-template-columns:1fr 1fr">
      <div><div class="k">☁️ Google Drive</div><div class="v">${rc} movimientos</div><div class="k">${r.updatedAt ? esc(fmtDateTime(r.updatedAt)) : ''}</div></div>
      <div><div class="k">📱 Este iPhone</div><div class="v">${db.transactions.length} movimientos</div><div class="k">${db.updatedAt ? esc(fmtDateTime(db.updatedAt)) : ''}</div></div>
    </div>
    <div class="btn-row"><button class="btn primary" data-action="conflict-remote">Usar los de Google Drive</button></div>
    <div class="btn-row"><button class="btn" data-action="conflict-local">Usar los de este iPhone</button></div>
    <p class="note">Los datos que no elijas no se pierden del todo: Google Drive guarda una copia por día en la carpeta “Mis Finanzas (respaldos)”.</p>`);
}

async function cloudConnect() {
  const url = val('cloudUrl').trim();
  const key = val('cloudKey').trim();
  if (!validCloudUrl(url)) { toast('Pega la URL de la aplicación web: empieza con https://script.google.com/macros/s/ y termina en /exec'); return; }
  if (!key) { toast('Falta la clave'); return; }
  cloud.url = url; cloud.key = key; cloud.lastSyncedAt = '';
  saveSync();
  cloudState.checked = false;
  render();
  setCloudStatus('syncing');
  let r;
  try { r = await cloudCall('load'); } catch (e) {
    cloud.url = ''; saveSync();
    setCloudStatus('off');
    render();
    toast('No se pudo conectar: ' + errMsg(e));
    return;
  }
  cloudState.checked = true;
  cloudState.lastCheck = Date.now();
  if (r.data && hasData() && r.updatedAt !== db.updatedAt) { render(); openConflictSheet(r, true); return; }
  if (r.data && !hasData()) { applyCloud(r, '¡Conectado! Recuperamos tus datos de Google Drive ✓'); return; }
  if (!db.updatedAt) { db.updatedAt = new Date().toISOString(); writeLocal(); }
  await cloudPush();
  render();
  if (cloudState.status === 'ok') toast('¡Conectado! Tus datos se guardan solos en Google Drive ✓');
}

async function cloudRestore() {
  setCloudStatus('syncing');
  let r;
  try { r = await cloudCall('load'); } catch (e) { setCloudStatus('error', errMsg(e)); toast(errMsg(e)); return; }
  if (!r.data) { setCloudStatus('ok'); toast('Aún no hay datos en Google Drive'); return; }
  if (!confirm(`¿Reemplazar los datos de este iPhone por la copia de Google Drive (${r.data.transactions.length} movimientos, ${r.updatedAt ? fmtDateTime(r.updatedAt) : ''})?`)) { setCloudStatus('ok'); return; }
  applyCloud(r, 'Datos recuperados desde Google Drive ✓');
}

function cloudStatusHTML() {
  const st = cloudState.status;
  if (st === 'error') return `<span class="status" style="color:var(--neg-ink)">⚠︎ No se pudo guardar</span><div class="small muted" style="margin-top:2px">${esc(cloudState.error)}</div>`;
  if (st === 'syncing' || st === 'pending' || !cloudState.checked) return '<span class="status">↻ Guardando en Google Drive…</span>';
  return `<span class="status" style="color:var(--pos-ink)">✓ Todo guardado en Google Drive</span>${cloud.lastSyncedAt ? `<span class="small muted"> · ${esc(ago(cloud.lastSyncedAt))}</span>` : ''}`;
}

function renderCloudCard() {
  if (cloudOn()) {
    return `<div id="cloudStatus">${cloudStatusHTML()}</div>
      <p class="note">Cada cambio se guarda solo en la carpeta <b>“Mis Finanzas (respaldos)”</b> de tu Google Drive, con una copia por día de los últimos 60 días.</p>
      <div class="btn-row"><button class="btn sm" data-action="cloud-push">Guardar ahora</button><button class="btn sm" data-action="cloud-restore">Recuperar desde Drive</button></div>
      ${cloudState.status === 'error' ? '<div class="btn-row"><button class="btn sm primary" data-action="cloud-retry">Reintentar</button></div>' : ''}
      <p class="note">¿Otro dispositivo? Abre la app ahí, entra a Ajustes y conecta con la misma URL y esta clave:</p>
      <div class="row" style="margin-top:6px"><code class="small" style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(cloud.key)}</code><button class="btn sm" data-action="cloud-copy-key">Copiar</button></div>
      <div class="btn-row"><button class="btn sm danger" data-action="cloud-disconnect">Desconectar</button></div>`;
  }
  return `<p class="sub">Guarda tus datos solos en <b>tu</b> Google Drive cada vez que anotas algo. Si borras la app o cambias de teléfono, los recuperas al conectar de nuevo. Se configura una sola vez (unos 10 minutos).</p>
    <div class="btn-row"><button class="btn primary" data-action="cloud-guide">Paso a paso: activar</button></div>
    <div class="field" style="margin-top:14px"><label for="cloudUrl">URL de la aplicación web</label>
      <input id="cloudUrl" class="input" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(cloud.url)}"></div>
    <div class="field"><label for="cloudKey">Clave</label>
      <input id="cloudKey" class="input" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Se crea al abrir el paso a paso" value="${esc(cloud.key)}"></div>
    <div class="btn-row" style="margin-top:0"><button class="btn" data-action="cloud-connect">Conectar</button></div>`;
}

function updateCloudBadge() {
  const b = $('#cloudBtn');
  if (!b) return;
  b.hidden = !cloudOn();
  if (!cloudOn()) return;
  const st = cloudState.checked || cloudState.status === 'error' ? cloudState.status : 'syncing';
  const map = {
    ok: ['var(--good)', '✓', 'Guardado en Google Drive'],
    syncing: ['var(--accent)', '↻', 'Guardando en Google Drive'],
    pending: ['var(--accent)', '↻', 'Guardando en Google Drive'],
    error: ['var(--critical)', '!', 'Error al guardar en Google Drive'],
    off: ['var(--ink-3)', '', 'Copia en Google Drive'],
  };
  const [c, g, label] = map[st] || map.off;
  b.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A6 6 0 0 0 6 20h13a5 5 0 0 0 .35-9.96Z"/></svg><span class="cloud-dot" style="background:${c}">${g}</span>`;
  b.setAttribute('aria-label', label);
  b.title = label;
  const s = document.getElementById('cloudStatus');
  if (s) s.innerHTML = cloudStatusHTML();
}

async function openCloudGuide() {
  if (!cloud.key) { cloud.key = newCloudKey(); saveSync(); }
  const k = $('#cloudKey');
  if (k && !k.value) k.value = cloud.key;
  sheetCtx = { kind: 'guide' };
  openSheet(`${sheetHead('Activar copia en Google Drive', null)}
    <ol class="steps">
      <li>Toca <b>Copiar código</b> (ya incluye tu clave secreta). Si lo harás en el computador, toca <b>Enviar</b> y mándatelo por correo o WhatsApp.</li>
      <li>Abre <a href="https://script.google.com/home" target="_blank" rel="noopener">script.google.com</a> e inicia sesión con tu Gmail. En iPhone, en Safari toca <b>aA → Solicitar sitio web de escritorio</b>. Toca <b>Nuevo proyecto</b>.</li>
      <li>Borra todo el texto que aparece, <b>pega el código</b> y toca <b>Guardar</b> (💾).</li>
      <li>Toca <b>Implementar → Nueva implementación</b>. En ⚙️ “Seleccionar tipo” elige <b>Aplicación web</b>. Ejecutar como: <b>Yo</b>. Quién tiene acceso: <b>Cualquier usuario</b>. Toca <b>Implementar</b>.</li>
      <li>Toca <b>Autorizar acceso</b> y elige tu cuenta. Si dice “Google no verificó esta app”, toca <b>Configuración avanzada → Ir a … (no seguro)</b> y luego <b>Permitir</b>. Es normal: el script es tuyo y solo tú lo usas.</li>
      <li>Copia la <b>URL de la aplicación web</b> (termina en <code>/exec</code>), vuelve a esta app, pégala en <b>Ajustes → URL de la aplicación web</b> y toca <b>Conectar</b>.</li>
    </ol>
    <div class="btn-row"><button class="btn primary" data-action="cloud-copy">Copiar código</button><button class="btn" data-action="cloud-share">Enviar</button></div>
    <textarea id="cloudCode" class="input small" readonly rows="6" style="margin-top:12px;font-family:ui-monospace,Menlo,monospace;font-size:12px">Cargando código…</textarea>
    <p class="note">Tu clave: <code>${esc(cloud.key)}</code>. Solo quien tenga la URL y la clave puede leer o guardar tus datos. Nadie más (ni GitHub ni esta app) los recibe.</p>
    <div class="btn-row"><button class="btn" data-action="close-sheet">Listo</button></div>`);
  try {
    const res = await fetch('google-apps-script/Codigo.gs', { cache: 'no-cache' });
    const code = (await res.text()).replace('PEGA-AQUI-TU-CLAVE', cloud.key);
    const t = $('#cloudCode');
    if (t) t.value = code;
  } catch (e) {
    const t = $('#cloudCode');
    if (t) t.value = 'No se pudo cargar el código. Revisa tu conexión a internet y vuelve a abrir este paso a paso.';
  }
}

function copyText(text, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text) && done());
  } else if (fallbackCopy(text)) done();
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  if (!ok) toast('No se pudo copiar: mantén presionado el texto y elige Copiar');
  return ok;
}
function copyCloudCode() {
  const t = $('#cloudCode');
  if (!t || t.value.startsWith('Cargando') || t.value.startsWith('No se pudo')) { toast('Espera a que cargue el código'); return; }
  copyText(t.value, 'Código copiado ✓ Ahora ábrelo en script.google.com');
}

/* ---------- Recordatorio de respaldo ---------- */
function backupReminder() {
  if (!hasData()) return '';
  const s = db.settings;
  const now = Date.now();
  if (s.backupSnoozeUntil && now < Date.parse(s.backupSnoozeUntil)) return '';
  const cloudOk = cloudOn() && cloudState.status !== 'error';
  const since = Date.parse(s.lastBackup || s.createdAt || '') || now;
  const days = Math.floor((now - since) / 864e5);
  if (days < (cloudOk ? 30 : 7)) return '';
  if (s.lastBackup && (db.updatedAt || '') <= s.lastBackup) return '';
  return `<section class="card">
    <div class="row" style="align-items:flex-start"><span class="emoji" aria-hidden="true">💾</span>
      <div style="flex:1"><b>Haz un respaldo en iCloud</b>
        <p class="sub" style="margin-top:2px">${s.lastBackup ? `Tu último respaldo fue hace ${days} días.` : 'Aún no has guardado ningún respaldo.'}
        ${cloudOk ? 'Ya tienes copia automática en Google Drive; este es un respaldo extra.' : 'Si borras la app o cambias de iPhone, lo vas a necesitar.'}</p></div></div>
    <div class="btn-row"><button class="btn sm primary" data-action="export-json">Respaldar ahora</button><button class="btn sm" data-action="snooze-backup">Más tarde</button></div>
    <p class="note">Al respaldar elige “Guardar en Archivos” → iCloud Drive.${!cloudOn() ? ' O mejor, <button class="link" style="color:var(--accent);font-size:inherit" data-action="cloud-goto">activa la copia automática en Google Drive</button>.' : ''}</p>
  </section>`;
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
    const first = sheetCtx.type === 'ahorro' ? null : catsOfType(sheetCtx.type)[0];
    sheetCtx.categoryId = first ? first.id : '';
    sheetCtx.expKind = first ? first.kind : 'variable';
    drawTxSheet(false);
  },
  'tx-withdraw': (el) => { syncTxDraft(); sheetCtx.withdraw = el.dataset.v === '1'; if (sheetCtx.withdraw) sheetCtx.opening = false; drawTxSheet(false); },
  'tx-goal': (el) => { syncTxDraft(); sheetCtx.goalId = el.dataset.id; drawTxSheet(false); },
  'add-saving': () => openTxSheet({ type: 'ahorro' }),
  'new-credit-from-tx': () => {
    syncTxDraft();
    const d = sheetCtx;
    const preset = { total: d.amount, name: d.note, categoryId: d.categoryId };
    closeSheet();
    openCreditSheet(null, preset);
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

  // Saldo inicial
  'edit-initial': () => openInitialSheet(),
  'save-initial': () => {
    const v = val('ibAmount').trim();
    const n = v ? parseAmount(v) : 0;
    if (!Number.isFinite(n)) { toast('Ingresa un monto válido'); return; }
    db.settings.initialBalance = n;
    save(); closeSheet(); render(); toast('Saldo inicial guardado');
  },

  // Compras en cuotas
  'new-credit': () => openCreditSheet(null),
  'edit-credit': (el) => openCreditSheet(el.dataset.id),
  'cr-kind': (el) => { const v = readCreditForm(); sheetCtx.ckind = el.dataset.v; drawCreditSheet(v); },
  'cr-int': (el) => { const v = readCreditForm(); sheetCtx.withInterest = el.dataset.v === '1'; if (!sheetCtx.withInterest) v.rate = ''; drawCreditSheet(v); },
  'cr-auto': () => { sheetCtx.manual = false; recalcCredit(); },
  'save-credit': () => saveCredit(),
  'toggle-credit': (el) => {
    const c = db.credits.find((x) => x.id === el.dataset.id);
    if (!c) return;
    const t = creditTxIn(c, ui.month);
    if (t) {
      db.transactions = db.transactions.filter((x) => x !== t);
      save(); render(); toast('Pago de cuota deshecho');
    } else payCredit(c, ui.month);
  },
  'credit-pay-next': () => { const c = db.credits.find((x) => x.id === sheetCtx.id); closeSheet(); payCredit(c, ui.month); },
  'credit-undo-last': () => {
    const c = db.credits.find((x) => x.id === sheetCtx.id);
    const last = creditTxs(c).sort(byDateDesc)[0];
    if (!last) return;
    withUndo('Último pago deshecho', () => { db.transactions = db.transactions.filter((t) => t !== last); });
  },
  'del-credit': () => { const id = sheetCtx.id; withUndo('Compra en cuotas eliminada', () => { db.credits = db.credits.filter((c) => c.id !== id); }); },

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
    const c = sheetCtx.type === 'ahorro' ? null : catsOfType(sheetCtx.type).find((x) => x.kind === 'fijo') || catsOfType(sheetCtx.type)[0];
    sheetCtx.categoryId = c ? c.id : '';
    drawFixedSheet();
  },
  'fx-cat': (el) => { syncFixedDraft(); sheetCtx.categoryId = el.dataset.id; drawFixedSheet(); },
  'fx-goal': (el) => { syncFixedDraft(); sheetCtx.goalId = el.dataset.id; drawFixedSheet(); },
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
  'del-goal': () => {
    const id = sheetCtx.id;
    withUndo('Meta eliminada (sus ahorros siguen en tu total)', () => {
      db.goals = db.goals.filter((g) => g.id !== id);
      db.transactions.forEach((t) => { if (t.goalId === id) delete t.goalId; });
      db.fixed.forEach((f) => { if (f.goalId === id) delete f.goalId; });
    });
  },
  contrib: (el) => openTxSheet({ type: 'ahorro', goalId: el.dataset.id, withdraw: el.dataset.sign === '-1' }),

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

  // Copia en Google Drive y recordatorio
  'snooze-backup': () => {
    db.settings.backupSnoozeUntil = new Date(Date.now() + 3 * 864e5).toISOString();
    save(); render(); toast('Te lo recordaré en 3 días');
  },
  'cloud-goto': () => { ui.tab = 'ajustes'; render(); const c = $('#cloudCard'); if (c) c.scrollIntoView({ block: 'center' }); },
  'cloud-guide': () => openCloudGuide(),
  'cloud-copy': () => copyCloudCode(),
  'cloud-share': () => {
    const t = $('#cloudCode');
    if (t && navigator.share) navigator.share({ title: 'Código Mis Finanzas', text: t.value }).catch(() => {});
    else copyCloudCode();
  },
  'cloud-connect': () => cloudConnect(),
  'cloud-push': async () => { await cloudPush(); if (cloudState.status === 'ok') toast('Guardado en Google Drive ✓'); },
  'cloud-retry': () => cloudCheck(),
  'cloud-restore': () => cloudRestore(),
  'cloud-copy-key': () => copyText(cloud.key, 'Clave copiada'),
  'cloud-disconnect': () => {
    if (!confirm('¿Desconectar la copia automática? Tus datos quedan en este iPhone y la copia existente sigue en tu Google Drive.')) return;
    cloud.url = ''; cloud.lastSyncedAt = ''; saveSync();
    cloudState.status = 'off'; cloudState.checked = false;
    render(); toast('Copia automática desactivada');
  },
  'conflict-remote': () => { const r = sheetCtx.remote; closeSheet(); applyCloud(r, 'Datos de Google Drive cargados ✓'); },
  'conflict-local': async () => { closeSheet(); cloudState.checked = true; await cloudPush(); if (cloudState.status === 'ok') toast('Se guardaron en Google Drive los datos de este iPhone ✓'); },

  // Ajustes
  theme: (el) => { db.settings.theme = el.dataset.v; save(); render(); },
  'export-json': () => exportJSON(),
  'export-csv': () => exportCSV(),
  'import-json': () => $('#importFile').click(),
  reset: () => {
    if (!confirm(`¿Borrar TODOS tus datos?${cloudOn() ? ' También se borrarán de la copia en Google Drive (el historial diario se conserva).' : ''} Te recomendamos exportar un respaldo antes.`)) return;
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
  if (e.target.closest && e.target.closest('[data-credit]')) recalcCredit(e.target.id);
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
  if (key === 'initialBalance') v = parseAmount(v) || 0;
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
  if (document.visibilityState === 'hidden' && cloudOn() && cloudState.pending) cloudPush();
  if (document.visibilityState === 'visible' && cloudOn() && Date.now() - cloudState.lastCheck > 60000) cloudCheck();
  if (document.visibilityState === 'visible' && currentMonth() !== lastActiveMonth) {
    if (ui.month === lastActiveMonth) ui.month = currentMonth();
    lastActiveMonth = currentMonth();
    render();
  }
});

/* =========================================================
   Inicio
   ========================================================= */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
render();
if (cloudOn()) cloudCheck();
window.addEventListener('online', () => { if (cloudOn() && cloudState.status === 'error') cloudCheck(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
