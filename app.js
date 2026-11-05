// ==========================================
// 0. CONFIG
// ==========================================
const CONFIG = Object.freeze({
  PARSER: {
    INDENT_STEP: 2,
    DEFAULT_PERIOD_DAYS: 30,
    SUM_COLUMN: 4,
    QTY_COLUMN: 3,
    CONTROL_ROW: 'Мода',
    SKIP_ROWS: Object.freeze(['Продажи', 'Магазин', 'Склад', 'Номенклатура', 'Торговый зал', 'Итого']),
  },
  CATEGORY_RULES: Object.freeze([
    { name: 'Распродажа',  needles: ['распродаж', 'будут удалены'] },
    { name: 'Обувь',       needles: ['обувь'] },
    { name: 'Аксессуары',  needles: ['аксессуар'] },
  ]),
  DEFAULT_CATEGORY: 'Одежда',
  GENDER_RULES: Object.freeze([
    { code: 'Д', needles: ['детск', 'девочк', 'мальчик'] },
    { code: 'Ж', needles: ['женск'] },
    { code: 'М', needles: ['мужск'] },
  ]),
  TOP: {
    LIMIT: 5,
    CATEGORIES: Object.freeze(['М', 'Ж', 'Д', 'Обувь', 'Аксессуары']),
    EXCLUDE_FROM_GENDER_TABS: Object.freeze(['Обувь']),
  },
  ABC: { A_THRESHOLD: 0.80, B_THRESHOLD: 0.95 },
  PLAN: {
    MIN_DAYS_FOR_FORECAST: 10,
    FORECAST_SPREAD: 0.15,
  },
  RAILS: {
    CSV_DELIMITER: ';',
    DEFAULT_MIN_EFFICIENCY: 15000,
  },
  ALERTS: {
    PLAN_WARN_PCT: 80,
    PLAN_WARN_MIN_DAYS: 20,
  },
  PERIOD: {
    COMPARABLE_TOLERANCE: 0.10,
  },
  STORAGE: { MAX_IMPORTS: 12 },
});

// ==========================================
// 1. UI
// ==========================================
const Icons = {
  home: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  chart: `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  rail: `<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
};

const UI = {
  toast: (msg, type = 'default') => {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
  },
  modal: (html) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-content">${html}</div>`;
    root.classList.add('open');
  },
  closeModal: () => document.getElementById('modal-root').classList.remove('open')
};

// ==========================================
// 2. DB
// ==========================================
const DB = {
  dbName: 'analytics_flow_mvp', storeName: 'data', data: null,
  async init() {
    return new Promise((resolve) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(this.storeName);
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction(this.storeName, 'readonly');
        const getReq = tx.objectStore(this.storeName).get('state');
        getReq.onsuccess = () => {
          this.data = getReq.result || this._empty();
          if (!this.data.profile) this.data.profile = null;
          if (!this.data.rails) this.data.rails = [];
          if (!this.data.minEfficiency) this.data.minEfficiency = CONFIG.RAILS.DEFAULT_MIN_EFFICIENCY;
          resolve();
        };
        getReq.onerror = () => { this.data = this._empty(); resolve(); };
      };
      req.onerror = () => { this.data = this._empty(); resolve(); };
    });
  },
  _empty() {
    return {
      imports: [],
      rails: [],
      plans: {},
      profile: null,
      checklist: { plan: false, import: false, top5: false, alert: false },
      minEfficiency: CONFIG.RAILS.DEFAULT_MIN_EFFICIENCY,
    };
  },
  async save() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(this.data, 'state');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      };
    });
  },

  getCurrentView() {
    const imports = this.data.imports;
    if (!imports.length) return null;
    const sorted = [...imports].sort((a, b) => (b.periodEnd || b.date).localeCompare(a.periodEnd || a.date));
    const rank = { month: 4, week: 3, day: 2, multi_month: 1, unknown: 0 };
    const samePeriod = sorted.filter(i =>
      i.periodStart && sorted[0].periodStart &&
      i.periodStart.slice(0, 7) === sorted[0].periodStart.slice(0, 7)
    );
    const hero = (samePeriod.length ? samePeriod : sorted)
      .sort((a, b) => (rank[b.granularity] || 0) - (rank[a.granularity] || 0))[0];
    return { hero, all: sorted };
  },

  findComparable(current) {
    if (!current || !current.periodStart) return null;
    const tol = CONFIG.PERIOD.COMPARABLE_TOLERANCE;
    return this.data.imports.find(imp =>
      imp !== current &&
      imp.granularity === current.granularity &&
      imp.periodDays &&
      Math.abs(imp.periodDays - current.periodDays) / current.periodDays < tol &&
      (imp.periodEnd < current.periodStart || imp.periodStart > current.periodEnd)
    ) || null;
  }
};

// ==========================================
// 3. Parser (Наш строгий + гранулярность)
// ==========================================
const Parser = {
  parse(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });
          resolve(this.build(rows, file.name));
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsArrayBuffer(file);
    });
  },

  build(rows, filename) {
    const { INDENT_STEP, SUM_COLUMN, QTY_COLUMN, CONTROL_ROW, SKIP_ROWS } = CONFIG.PARSER;
    let controlSum = 0;
    const period = this.parsePeriod(filename);

    const toNum = (v) => {
      if (typeof v === 'number') return v;
      const cleaned = String(v ?? '').replace(/[\s\u00A0]/g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const roots = [];
    const stack = [];

    for (const row of rows) {
      const raw = row?.[0];
      if (raw == null || raw === '') continue;
      const name = String(raw).trim();
      if (!name || SKIP_ROWS.includes(name)) continue;
      if (name === CONTROL_ROW) { controlSum = toNum(row[SUM_COLUMN]); continue; }

      const indent = (String(raw).match(/^[\s\u00A0]+/)?.[0].length) || 0;
      const level = Math.round(indent / INDENT_STEP);
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();

      const parent = stack.length ? stack[stack.length - 1] : null;
      const path = parent ? `${parent.path} > ${name}` : name;

      const node = {
        name, level,
        sum: toNum(row[SUM_COLUMN]),
        qty: toNum(row[QTY_COLUMN]),
        path,
        category: this.category(path),
        gender: this.gender(path),
        children: [],
        isItem: false,
      };

      if (parent) parent.children.push(node);
      else roots.push(node);
      stack.push(node);
    }

    const markItems = (nodes) => nodes.forEach(n => {
      if (n.children.length === 0) n.isItem = true;
      else markItems(n.children);
    });
    markItems(roots);

    let leavesSum = 0, totalQty = 0;
    const collectLeaves = (nodes) => nodes.forEach(n => {
      if (n.isItem) { leavesSum += n.sum; totalQty += n.qty; }
      else collectLeaves(n.children);
    });
    collectLeaves(roots);

    const valid = controlSum === 0
      ? Math.abs(leavesSum) < 1
      : Math.abs(leavesSum - controlSum) / Math.abs(controlSum) < 0.01;

    return {
      roots,
      periodStart: period.startISO,
      periodEnd: period.endISO,
      periodDays: period.daysInPeriod,
      granularity: period.granularity,
      periodLabel: period.label,
      periodKnown: period.known,
      daysInMonth: period.daysInMonth,
      totalSum: controlSum,
      totalQty,
      avgCheck: totalQty > 0 ? controlSum / totalQty : 0,
      valid,
      errorMsg: valid ? null : { leaves: Math.round(leavesSum), control: Math.round(controlSum) },
      date: new Date().toISOString(),
      filename,
    };
  },

  parsePeriod(filename) {
    const m = filename.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})\s*[-–—]\s*(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})/);
    if (!m) {
      return { startISO: null, endISO: null, daysInPeriod: CONFIG.PARSER.DEFAULT_PERIOD_DAYS, daysInMonth: 30, granularity: 'unknown', label: 'период не определён', known: false };
    }
    const y = (s) => (s.length === 2 ? 2000 + Number(s) : Number(s));
    const start = new Date(y(m[3]), Number(m[2]) - 1, Number(m[1]));
    const end   = new Date(y(m[6]), Number(m[5]) - 1, Number(m[4]));
    const days = Math.round((end - start) / 86400000) + 1;

    let granularity;
    if (days === 1) granularity = 'day';
    else if (days <= 7) granularity = 'week';
    else if (days >= 28 && days <= 31) granularity = 'month';
    else if (days > 31) granularity = 'multi_month';
    else granularity = 'unknown';

    const iso = (d) => d.toISOString().slice(0, 10);
    const label = `${m[1].padStart(2,'0')}.${m[2].padStart(2,'0')}–${m[4].padStart(2,'0')}.${m[5].padStart(2,'0')}`;

    return {
      startISO: iso(start), endISO: iso(end),
      daysInPeriod: days,
      daysInMonth: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(),
      granularity, label, known: true,
    };
  },

  normalize(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); },

  category(path) {
    const p = this.normalize(path);
    for (const rule of CONFIG.CATEGORY_RULES) {
      if (rule.needles.some(n => p.includes(n))) return rule.name;
    }
    return CONFIG.DEFAULT_CATEGORY;
  },

  gender(path) {
    const p = this.normalize(path);
    for (const rule of CONFIG.GENDER_RULES) {
      if (rule.needles.some(n => p.includes(n))) return rule.code;
    }
    return null;
  },
};

// ==========================================
// 4. Rails (CSV)
// ==========================================
const Rails = {
  parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const out = [];
    for (const line of lines) {
      const parts = line.split(CONFIG.RAILS.CSV_DELIMITER).map(s => s.trim());
      if (parts.length < 3) continue;
      const [name, folderPath, metersRaw] = parts;
      const meters = parseFloat(String(metersRaw).replace(',', '.'));
      if (!name || !folderPath || !Number.isFinite(meters) || meters <= 0) continue;
      out.push({ name, folderPath, meters });
    }
    return out;
  },

  efficiency(importData) {
    if (!importData || !DB.data.rails.length) return [];
    const folders = [];
    const collect = (nodes) => nodes.forEach(n => {
      if (n.isItem) return;
      const leaf = n.children.length === 0 || n.children.every(c => c.isItem);
      if (leaf) folders.push(n);
      else collect(n.children);
    });
    collect(importData.roots);

    const byPath = new Map(folders.map(f => [f.path, f]));
    const minEff = DB.data.minEfficiency || CONFIG.RAILS.DEFAULT_MIN_EFFICIENCY;

    return DB.data.rails.map(r => {
      const folder = byPath.get(r.folderPath);
      const revenue = folder ? folder.sum : 0;
      const eff = revenue / r.meters;
      return {
        ...r,
        revenue,
        efficiency: eff,
        low: eff < minEff,
        found: !!folder,
      };
    }).sort((a, b) => b.efficiency - a.efficiency);
  }
};

// ==========================================
// 5. ALERTS (Только безопасные проверки)
// ==========================================
const Alerts = {
  check(current) {
    if (!current) return [];
    const out = [];

    const planKey = current.periodStart ? current.periodStart.slice(0, 7) : current.date.slice(0, 7);
    const plan = DB.data.plans[planKey];
    if (plan > 0 && current.periodDays >= CONFIG.ALERTS.PLAN_WARN_MIN_DAYS) {
      const pct = (current.totalSum / plan) * 100;
      if (pct < CONFIG.ALERTS.PLAN_WARN_PCT) {
        out.push({ type: 'warn', text: `План выполнен на ${Math.round(pct)}% — нужно ускориться` });
      }
    }

    if (!current.valid) {
      out.push({ type: 'error', text: 'Данные 1С подозрительны: расхождение в суммах' });
    }

    return out;
  }
};

// ==========================================
// 6. APP Router & Screens
// ==========================================
const App = {
  screen: 'home',
  nav: [
    { id: 'home', icon: Icons.home, label: 'Главная' },
    { id: 'analytics', icon: Icons.chart, label: 'Аналитика' },
    { id: 'rails', icon: Icons.rail, label: 'Рейлы' },
    { id: 'settings', icon: Icons.settings, label: 'Настройки' }
  ],

  init() {
    this.renderNav();
    if (!DB.data.profile) {
      this.route('onboarding');
    } else {
      this.route(this.screen);
    }
  },

  renderNav() {
    document.getElementById('nav').innerHTML = this.nav.map(n => `
      <a href="#" class="nav-item ${this.screen === n.id ? 'active' : ''}" onclick="App.route('${n.id}'); return false;">
        ${n.icon}<span>${n.label}</span>
      </a>
    `).join('');
  },

  route(screen) {
    this.screen = screen;
    this.renderNav();
    const root = document.getElementById('screen');
    root.innerHTML = '';
    if (screen === 'onboarding') Screens.onboarding(root);
    if (screen === 'home') Screens.home(root);
    if (screen === 'analytics') Screens.analytics(root);
    if (screen === 'rails') Screens.rails(root);
    if (screen === 'settings') Screens.settings(root);
    window.scrollTo(0, 0);
  }
};

const Screens = {
  // ---------- ONBOARDING (Упрощенный) ----------
  onboarding(root) {
    let step = 0;
    const answers = { role: null, stores: null, pains: [] };

    const render = () => {
      const steps = [
        `
          <div class="header"><h1 class="h1">Знакомство</h1></div>
          <div class="card">
            <div class="card-title">Кто вы?</div>
            <div class="radio-group">
              ${[['owner','Собственник'],['director','Директор'],['manager','Управляющий']].map(([v,l]) =>
                `<label class="radio-item ${answers.role===v?'active':''}" onclick="window.__ob('role','${v}',this)">${l}</label>`
              ).join('')}
            </div>
          </div>
          <div class="card">
            <div class="card-title">Сколько магазинов?</div>
            <div class="radio-group">
              ${[['1','1'],['2-5','2–5'],['6+','6 и больше']].map(([v,l]) =>
                `<label class="radio-item ${answers.stores===v?'active':''}" onclick="window.__ob('stores','${v}',this)">${l}</label>`
              ).join('')}
            </div>
          </div>
          <button class="btn btn-primary" onclick="window.__obNext()">Далее</button>
        `,
        `
          <div class="header"><h1 class="h1">Что болит</h1></div>
          <div class="card">
            <div class="card-title">Что чаще всего вызывает вопросы?</div>
            <div class="radio-group">
              ${[['falling','Падение выручки'],['unclear_folders','Непонятные папки'],['rails_overload','Перегруз рейлов'],['plan','План']].map(([v,l]) =>
                `<label class="radio-item ${answers.pains.includes(v)?'active':''}" onclick="window.__obMulti('pains','${v}',this)">${l}</label>`
              ).join('')}
            </div>
          </div>
          <button class="btn btn-primary" onclick="window.__obFinish()">Готово</button>
        `
      ];

      root.innerHTML = steps[step] + `
        <div class="onboarding-progress">
          ${[0,1].map(i => `<div class="dot ${i===step?'active':''}"></div>`).join('')}
        </div>
      `;
    };

    window.__ob = (key, val, el) => {
      answers[key] = val;
      el.parentNode.querySelectorAll('.radio-item').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
    };
    window.__obMulti = (key, val, el) => {
      const arr = answers[key];
      const i = arr.indexOf(val);
      if (i >= 0) { arr.splice(i, 1); el.classList.remove('active'); }
      else { arr.push(val); el.classList.add('active'); }
    };
    window.__obNext = () => { step++; render(); };
    window.__obFinish = async () => {
      DB.data.profile = { ...answers, completedAt: new Date().toISOString() };
      DB.data.checklist = { plan: false, import: false, top5: false, alert: true };
      await DB.save();
      UI.toast('Профиль сохранён');
      App.route('home');
    };

    render();
  },

  // ---------- HOME ----------
  home(root) {
    const view = DB.getCurrentView();
    if (!view) {
      root.innerHTML = `
        <div class="header"><h1 class="h1">Главная</h1></div>
        <div class="card empty-state">
          <h2>Нет данных</h2>
          <p>Загрузите выгрузку 1С, чтобы увидеть аналитику</p>
          <button class="btn btn-primary" onclick="App.route('settings')">Перейти в настройки</button>
        </div>`;
      return;
    }

    const current = view.hero;
    const comparable = DB.findComparable(current);

    const planKey = current.periodStart ? current.periodStart.slice(0, 7) : current.date.slice(0, 7);
    const plan = DB.data.plans[planKey] || current.totalSum;
    const planPctRaw = plan > 0 ? (current.totalSum / plan) * 100 : 0;
    const planPct = Math.min(100, planPctRaw);
    const overPlan = planPctRaw > 100;

    const showForecast = current.periodKnown && current.periodDays >= CONFIG.PLAN.MIN_DAYS_FOR_FORECAST;
    let forecastLine = '';
    if (showForecast) {
      const base = Math.round((current.totalSum / current.periodDays) * current.daysInMonth);
      const spread = Math.round(base * CONFIG.PLAN.FORECAST_SPREAD);
      forecastLine = `Прогноз: <b>${(base - spread).toLocaleString('ru-RU')}–${(base + spread).toLocaleString('ru-RU')} ₽</b> <span style="color:rgba(255,255,255,0.4);font-weight:500">(±15%)</span>`;
    } else {
      forecastLine = current.periodKnown
        ? `Прогноз недоступен (мало данных: ${current.periodDays} дн.)`
        : `Прогноз недоступен (период не определён)`;
    }

    let deltaLine = '';
    if (comparable) {
      const d = ((current.totalSum - comparable.totalSum) / comparable.totalSum) * 100;
      const sign = d >= 0 ? '▲' : '▼';
      const cls = d >= 0 ? 'pos' : 'neg';
      deltaLine = `<span class="delta ${cls}">${sign} ${Math.abs(d).toFixed(1)}%</span> к периоду ${comparable.periodLabel}`;
    } else {
      deltaLine = `<span style="color:rgba(255,255,255,0.4)">Нет сопоставимого периода</span>`;
    }

    const sparkline = this._renderSparkline(view.all);

    const cats = { 'Одежда': 0, 'Обувь': 0, 'Аксессуары': 0, 'Распродажа': 0 };
    const calcCats = (nodes) => nodes.forEach(n => {
      if (n.isItem) cats[n.category] += n.sum;
      else calcCats(n.children);
    });
    calcCats(current.roots);

    const tops = Object.fromEntries(CONFIG.TOP.CATEGORIES.map(k => [k, []]));
    const findLeafFolders = (nodes) => nodes.forEach(n => {
      if (n.isItem) return;
      const isLeaf = n.children.length === 0 || n.children.every(c => c.isItem);
      if (isLeaf) this._classifyTopFolder(n, tops);
      else findLeafFolders.call(this, n.children);
    });
    findLeafFolders.call(this, current.roots);

    for (const key of CONFIG.TOP.CATEGORIES) {
      const seen = new Set();
      tops[key] = tops[key]
        .filter(f => f.sum !== 0 && !seen.has(f.path) && seen.add(f.path))
        .sort((a, b) => b.sum - a.sum);
    }

    const cl = DB.data.checklist;
    const checklistVisible = !cl.plan || !cl.import || !cl.top5;
    const checklistHTML = checklistVisible ? `
      <div class="card">
        <div class="card-title">Первые шаги</div>
        ${this._checklistItem(cl.plan, 'Заполнить план на месяц', "App.route('settings')")}
        ${this._checklistItem(cl.import, 'Загрузить файл 1С', "App.route('settings')")}
        ${this._checklistItem(cl.top5, 'Посмотреть топ-5 папок', "document.getElementById('top-list').scrollIntoView({behavior:'smooth'})")}
      </div>
    ` : '';

    root.innerHTML = `
      <div class="header">
        <div>
          <h1 class="h1">Analytics</h1>
          <div class="subtitle">${current.periodLabel} · ${current.periodDays} дн.</div>
        </div>
        <div class="tag ${current.valid ? 'ok' : 'err'}" id="err-tag">
          ${current.valid ? 'Всё ок' : 'Ошибка'}
        </div>
      </div>

      <div class="card hero-card">
        <div class="card-title">Выручка магазина</div>
        <div class="hero-val num">${Math.round(current.totalSum).toLocaleString('ru-RU')} ₽</div>
        <div class="hero-meta">
          <span>План: ${Math.round(plan).toLocaleString('ru-RU')} ₽</span>
          <span>${Math.round(planPctRaw)}% ${overPlan ? '<span class="badge-over">+</span>' : ''}</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${planPct}%"></div></div>
        <div class="hero-meta" style="margin-top:10px">
          <span>Ср. чек: <b>${Math.round(current.avgCheck).toLocaleString('ru-RU')} ₽</b></span>
        </div>
        <div class="hero-meta" style="font-size:11px">${deltaLine}</div>
        ${sparkline}
        <div class="forecast-text">${forecastLine}</div>
      </div>

      ${this._renderAlerts(current)}
      ${checklistHTML}

      <div class="card">
        <div class="card-title">Категории</div>
        <div class="stats-grid">
          ${Object.entries(cats).map(([k, v]) => `
            <div class="stat-box">
              <div class="stat-val num">${Math.round(v).toLocaleString('ru-RU')} ₽</div>
              <div class="stat-label">${k}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card" style="padding-bottom:12px">
        <div class="card-title">Топ-5 папок</div>
        <div class="tabs-scroll">
          <div class="tab active" data-g="М" onclick="window.switchTop('М', this)">Мужская</div>
          <div class="tab" data-g="Ж" onclick="window.switchTop('Ж', this)">Женская</div>
          <div class="tab" data-g="Д" onclick="window.switchTop('Д', this)">Детская</div>
          <div class="tab" data-g="Обувь" onclick="window.switchTop('Обувь', this)">Обувь</div>
          <div class="tab" data-g="Аксессуары" onclick="window.switchTop('Аксессуары', this)">Аксессуары</div>
        </div>
        <div id="top-list" style="margin-top: 8px;"></div>
      </div>
    `;

    window.renderTop = (gender) => {
      let list = tops[gender] || [];
      if (gender === 'М' || gender === 'Ж') {
        list = list.filter(i => !CONFIG.TOP.EXCLUDE_FROM_GENDER_TABS.includes(i.category));
      }
      if (!list.length) return `<div class="item-desc" style="padding:16px 0">Нет данных</div>`;
      return list.slice(0, CONFIG.TOP.LIMIT).map((item, i) => `
        <div class="list-item">
          <div>
            <div class="item-name">${i + 1}. ${item.name}</div>
            <div class="item-desc">${item.path.split(' > ').slice(-2).join(' · ')}</div>
          </div>
          <div class="item-val num ${item.sum < 0 ? 'neg' : ''}">${Math.round(item.sum).toLocaleString('ru-RU')} ₽</div>
        </div>
      `).join('');
    };

    window.switchTop = (g, el) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('top-list').innerHTML = window.renderTop(g);
      if (!DB.data.checklist.top5) {
        DB.data.checklist.top5 = true;
        DB.save();
      }
    };

    document.getElementById('top-list').innerHTML = window.renderTop('М');

    if (!current.valid) {
      document.getElementById('err-tag').onclick = () => {
        const em = current.errorMsg;
        UI.modal(`
          <h2 style="font-size:24px;font-weight:800;margin-bottom:12px;color:var(--danger)">Ошибка в файле</h2>
          <p style="color:var(--text-muted);font-size:16px;margin-bottom:24px;">
            Итог по товарам (${em.leaves.toLocaleString('ru-RU')} ₽) не совпадает с итогом магазина (${em.control.toLocaleString('ru-RU')} ₽).
          </p>
          <button class="btn btn-primary" onclick="UI.closeModal()">Понятно</button>
        `);
      };
    }
  },

  _checklistItem(done, label, action) {
    return `
      <div class="checklist-item ${done ? 'done' : ''}" ${done ? '' : `onclick="${action}"`}>
        <div class="checkbox">${done ? '✓' : ''}</div>
        <div class="checklist-label">${label}</div>
      </div>
    `;
  },

  _renderAlerts(current) {
    const alerts = Alerts.check(current);
    if (!alerts.length) return '';
    return `
      <div class="card alerts-card">
        <div class="card-title">Внимание</div>
        ${alerts.map(a => `
          <div class="alert-item ${a.type}">
            <span class="alert-dot"></span>
            <span>${a.text}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderSparkline(imports) {
    const monthly = imports
      .filter(i => i.granularity === 'month' && i.totalSum > 0)
      .sort((a, b) => (a.periodStart || '').localeCompare(b.periodStart || ''))
      .slice(-8);
    if (monthly.length < 2) return '';
    const w = 300, h = 50, pad = 4;
    const max = Math.max(...monthly.map(m => m.totalSum));
    const min = Math.min(...monthly.map(m => m.totalSum));
    const range = max - min || 1;
    const pts = monthly.map((m, i) => {
      const x = pad + (i / (monthly.length - 1)) * (w - pad * 2);
      const y = h - pad - ((m.totalSum - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `
      <div class="sparkline-wrap">
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
          <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="sparkline-labels">
          <span>${monthly[0].periodLabel}</span>
          <span>${monthly[monthly.length-1].periodLabel}</span>
        </div>
      </div>
    `;
  },

  _classifyTopFolder(folder, tops) {
    const cat = folder.category;
    if (cat === 'Аксессуары') {
      if (folder.name.toLowerCase() !== 'аксессуары') tops['Аксессуары'].push(folder);
      return;
    }
    if (cat === 'Обувь') {
      tops['Обувь'].push(folder);
      if (folder.gender) tops[folder.gender].push(folder);
      return;
    }
    if (cat === 'Одежда') {
      if (folder.gender) tops[folder.gender].push(folder);
      return;
    }
  },

  // ---------- ANALYTICS ----------
  analytics(root) {
    const view = DB.getCurrentView();
    if (!view) return App.route('home');
    const current = view.hero;

    const folders = this._collectFolders(current.roots);
    const positive = folders.filter(f => f.sum > 0).sort((a, b) => b.sum - a.sum);
    const zeroOrNeg = folders.filter(f => f.sum <= 0);
    const total = positive.reduce((acc, f) => acc + f.sum, 0);

    const { A_THRESHOLD, B_THRESHOLD } = CONFIG.ABC;
    let cum = 0;
    const a = [], b = [], c = [];
    positive.forEach(f => {
      cum += f.sum;
      if (cum <= total * A_THRESHOLD) a.push(f);
      else if (cum <= total * B_THRESHOLD) b.push(f);
      else c.push(f);
    });

    root.innerHTML = `
      <div class="header"><h1 class="h1">Аналитика</h1></div>
      <div class="card">
        <div class="card-title">ABC-Анализ папок</div>
        <div class="stats-grid" style="margin-bottom:12px;">
          <div class="stat-box" style="background:var(--accent)">
            <div class="stat-label" style="color:var(--text)">A (80%)</div>
            <div class="stat-val num">${a.length}</div>
          </div>
          <div class="stat-box" style="background:#F2B84B;color:#fff">
            <div class="stat-label" style="color:#fff">B (15%)</div>
            <div class="stat-val num">${b.length}</div>
          </div>
          <div class="stat-box" style="background:var(--danger-bg);color:var(--danger)">
            <div class="stat-label" style="color:var(--danger)">C (5%)</div>
            <div class="stat-val num">${c.length}</div>
          </div>
          <div class="stat-box" style="background:var(--warn-bg);color:var(--warn)">
            <div class="stat-label" style="color:var(--warn)">Z (возвраты)</div>
            <div class="stat-val num">${zeroOrNeg.length}</div>
          </div>
        </div>
        <button class="btn btn-secondary" id="btn-abc">Показать списки</button>
        <div id="abc-list" style="display:none; margin-top:16px;">
          ${this.renderGroup('Группа А', a)}
          ${this.renderGroup('Группа B', b)}
          ${this.renderGroup('Группа C', c)}
          ${zeroOrNeg.length ? this.renderGroup('Группа Z (возвраты)', zeroOrNeg, 'var(--warn)') : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Рекомендации (TOC)</div>
        ${c.length ? `
        <div style="background:var(--danger-bg);padding:16px;border-radius:16px;margin-bottom:16px;">
          <div style="font-weight:800;color:var(--danger);margin-bottom:4px;">Найдено ограничение</div>
          <div style="font-size:14px;font-weight:500;color:var(--danger);">
            ${c.length} папок приносят менее 5% выручки. Рекомендуется сократить их метраж.
          </div>
        </div>
        <button class="btn btn-primary" id="btn-rec">Показать рекомендации</button>
        <div id="rec-list" style="display:none; margin-top:16px;">
          ${c.slice(0, 5).map(f => `<div class="list-item"><div class="item-name">${f.name}</div><div class="item-val" style="color:var(--danger)">Сократить метр</div></div>`).join('')}
        </div>` : `<p style="color:var(--text-muted);font-size:14px;">Ограничений не найдено.</p>`}
      </div>
    `;

    document.getElementById('btn-abc').onclick = () => {
      const el = document.getElementById('abc-list');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };
    const btnRec = document.getElementById('btn-rec');
    if (btnRec) btnRec.onclick = () => {
      const el = document.getElementById('rec-list');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };
  },

  renderGroup(title, arr, color = 'var(--accent-dark)') {
    if (!arr.length) return '';
    return `
      <div style="font-weight:800; margin:16px 0 8px; color:${color}">${title} (${arr.length})</div>
      ${arr.map(f => `<div class="list-item"><div class="item-name">${f.name}</div><div class="item-val num ${f.sum < 0 ? 'neg' : ''}">${Math.round(f.sum).toLocaleString('ru-RU')} ₽</div></div>`).join('')}
    `;
  },

  _collectFolders(nodes) {
    const out = [];
    const walk = (arr) => arr.forEach(n => {
      if (n.isItem) return;
      const leaf = n.children.length === 0 || n.children.every(c => c.isItem);
      if (leaf) out.push(n);
      else walk(n.children);
    });
    walk(nodes);
    return out;
  },

  // ---------- RAILS ----------
  rails(root) {
    const view = DB.getCurrentView();
    const current = view?.hero;
    const rails = current ? Rails.efficiency(current) : [];
    const minEff = DB.data.minEfficiency || CONFIG.RAILS.DEFAULT_MIN_EFFICIENCY;

    root.innerHTML = `
      <div class="header"><h1 class="h1">Рейлы</h1></div>

      <div class="card">
        <div class="card-title">Настройки эффективности</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="number" class="input" id="min-eff-input" value="${minEff}" style="flex:1">
          <span style="font-size:14px; font-weight:600; color:var(--text-muted)">₽/м</span>
          <button class="btn btn-secondary" style="width:auto; padding:14px;" id="btn-save-min-eff">OK</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Карта рейлов</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:500;">
          CSV: <code>рейл;папка;метраж</code>
        </p>
        <input type="file" id="rails-upload" accept=".csv,text/csv" style="display:none">
        <button class="btn btn-primary" id="btn-rails-upload">Загрузить CSV</button>
        ${DB.data.rails.length ? `<button class="btn btn-secondary" style="margin-top:8px" id="btn-rails-clear">Очистить карту</button>` : ''}
      </div>

      ${rails.length ? `
      <div class="card">
        <div class="card-title">Эффективность (${rails.length} рейлов)</div>
        ${rails.map(r => `
          <div class="list-item ${r.low ? 'rail-low' : ''}">
            <div>
              <div class="item-name">${r.name} ${r.low ? '<span class="badge-low">недогружен</span>' : ''}</div>
              <div class="item-desc">${r.meters} м · ${r.found ? r.folderPath : 'папка не найдена'}</div>
            </div>
            <div style="text-align:right">
              <div class="item-val num ${r.efficiency < 0 ? 'neg' : ''}">${Math.round(r.efficiency).toLocaleString('ru-RU')} ₽/м</div>
              <div class="item-desc">${Math.round(r.revenue).toLocaleString('ru-RU')} ₽</div>
            </div>
          </div>
        `).join('')}
      </div>
      ` : `<div class="card empty-state"><h2>Нет карты рейлов</h2><p>Загрузите CSV, чтобы увидеть ₽/м по каждому рейлу</p></div>`}
    `;

    document.getElementById('btn-save-min-eff').onclick = async () => {
      const val = parseFloat(document.getElementById('min-eff-input').value) || CONFIG.RAILS.DEFAULT_MIN_EFFICIENCY;
      DB.data.minEfficiency = val;
      await DB.save();
      UI.toast('Порог сохранён');
      App.route('rails');
    };

    const fi = document.getElementById('rails-upload');
    document.getElementById('btn-rails-upload').onclick = () => fi.click();
    fi.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const text = await f.text();
      const parsed = Rails.parseCSV(text);
      if (!parsed.length) { UI.toast('Не удалось разобрать CSV', 'error'); return; }
      DB.data.rails = parsed;
      await DB.save();
      UI.toast(`Загружено рейлов: ${parsed.length}`);
      App.route('rails');
    };

    const clr = document.getElementById('btn-rails-clear');
    if (clr) clr.onclick = async () => {
      DB.data.rails = [];
      await DB.save();
      UI.toast('Карта рейлов очищена');
      App.route('rails');
    };
  },

  // ---------- SETTINGS ----------
  settings(root) {
    const view = DB.getCurrentView();
    const current = view?.hero;
    const planKey = current?.periodStart ? current.periodStart.slice(0, 7) : new Date().toISOString().slice(0, 7);
    const currentPlan = DB.data.plans[planKey] || '';

    root.innerHTML = `
      <div class="header"><h1 class="h1">Настройки</h1></div>

      <div class="card">
        <div class="card-title">План на месяц</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:500;">
          Плановая выручка на месяц (${planKey}).
        </p>
        <input type="number" class="input" id="plan-input" placeholder="Например, 1000000" value="${currentPlan}">
        <button class="btn btn-primary" style="margin-top:12px" id="btn-save-plan">Сохранить план</button>
      </div>

      <div class="card">
        <div class="card-title">Данные 1С</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px;font-weight:500;">
          Загрузите .xlsx файл. Имя файла должно содержать период (например, 01.12.2026-31.12.2026.xlsx).
        </p>
        <input type="file" id="file-upload" accept=".xlsx" style="display:none">
        <button class="btn btn-primary" id="btn-upload">Загрузить .xlsx</button>
        ${DB.data.imports.length ? `<button class="btn btn-danger" style="margin-top:12px" id="btn-clear">Очистить все данные</button>` : ''}
      </div>

      <div class="card">
        <div class="card-title">Профиль</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;">
          ${DB.data.profile ? `Роль: ${DB.data.profile.role || '—'} · Магазинов: ${DB.data.profile.stores || '—'}` : 'Не заполнен'}
        </p>
        <button class="btn btn-secondary" id="btn-retake">Пройти анкету заново</button>
      </div>
    `;

    document.getElementById('btn-save-plan').onclick = async () => {
      const val = parseFloat(document.getElementById('plan-input').value) || 0;
      DB.data.plans[planKey] = val;
      if (val > 0) DB.data.checklist.plan = true;
      await DB.save();
      UI.toast('План сохранён');
      App.route('home');
    };

    if (DB.data.imports.length) {
      document.getElementById('btn-clear').onclick = async () => {
        UI.modal(`
          <h2 style="font-size:20px;font-weight:800;margin-bottom:12px;">Очистить данные?</h2>
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:20px;">Все загруженные отчёты будут удалены.</p>
          <button class="btn btn-danger" onclick="window.confirmClear()">Да, удалить</button>
          <button class="btn btn-secondary" style="margin-top:8px" onclick="UI.closeModal()">Отмена</button>
        `);
      };
    }

    window.confirmClear = async () => {
      DB.data.imports = [];
      DB.data.checklist.import = false;
      DB.data.checklist.top5 = false;
      await DB.save();
      UI.closeModal();
      UI.toast('Данные удалены');
      App.route('home');
    };

    const fileInput = document.getElementById('file-upload');
    document.getElementById('btn-upload').onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      UI.toast('Парсинг файла...');
      try {
        const data = await Parser.parse(file);
        DB.data.imports.unshift(data);
        DB.data.imports = DB.data.imports.slice(0, CONFIG.STORAGE.MAX_IMPORTS);
        DB.data.checklist.import = true;
        await DB.save();
        UI.toast(
          data.valid ? `Загружено: ${data.periodLabel}` : 'Внимание: расхождение в суммах',
          data.valid ? 'default' : 'error'
        );
        App.route('home');
      } catch (err) {
        UI.toast('Ошибка чтения файла', 'error');
      }
    };

    document.getElementById('btn-retake').onclick = () => {
      DB.data.profile = null;
      App.route('onboarding');
    };
  }
};

// ==========================================
// 7. INIT
// ==========================================
window.App = App;
window.UI = UI;

DB.init().then(() => {
  App.init();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
