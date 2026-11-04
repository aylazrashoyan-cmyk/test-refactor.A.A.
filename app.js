// ==========================================
// 0. CONFIG — единственный источник констант
// ==========================================
const CONFIG = Object.freeze({
  PARSER: {
    INDENT_STEP: 2,          // 1 уровень = 2 пробела в выгрузке 1С
    DEFAULT_PERIOD_DAYS: 30, // если дата в имени файла не распознана
    SUM_COLUMN: 4,           // индекс колонки «Сумма» (E)
    QTY_COLUMN: 3,           // индекс колонки «Кол-во» (D)
    CONTROL_ROW: 'Мода',     // строка-эталон итоговой суммы
    SKIP_ROWS: Object.freeze(['Продажи', 'Магазин', 'Склад', 'Номенклатура', 'Торговый зал', 'Итого']),
    ITEM_NAME_REGEX: /\d+\s*[рp₽]|\(\-?\d+%\)/i,
  },
  CATEGORY_RULES: Object.freeze([
    { name: 'Распродажа',  needles: ['распродаж', 'будут удалены'] }, // ПРИОРИТЕТ №1
    { name: 'Обувь',       needles: ['обувь'] },
    { name: 'Аксессуары',  needles: ['аксессуар'] },
  ]),
  DEFAULT_CATEGORY: 'Одежда',
  GENDER_RULES: Object.freeze([
    { code: 'Д', needles: ['детск', 'девочк', 'мальчик'] }, // ПРИОРИТЕТ №1
    { code: 'Ж', needles: ['женск'] },
    { code: 'М', needles: ['мужск'] },
  ]),
  TOP: {
    LIMIT: 5,
    CATEGORIES: Object.freeze(['М', 'Ж', 'Д', 'Обувь', 'Аксессуары']),
    EXCLUDE_FROM_GENDER_TABS: Object.freeze(['Обувь']),
  },
  ABC: { A_THRESHOLD: 0.80, B_THRESHOLD: 0.95 },
  PLAN: { MIN_DAYS_FOR_FORECAST: 10 },
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
// 2. DB (IndexedDB)
// ==========================================
const DB = {
  dbName: 'analitik_v7', storeName: 'data', data: null,
  async init() {
    return new Promise((resolve) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(this.storeName);
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction(this.storeName, 'readonly');
        const getReq = tx.objectStore(this.storeName).get('state');
        getReq.onsuccess = () => {
          this.data = getReq.result || { imports: [], rails: [], links: [], plans: {} };
          resolve();
        };
        getReq.onerror = () => { this.data = { imports: [], rails: [], links: [], plans: {} }; resolve(); };
      };
      req.onerror = () => { this.data = { imports: [], rails: [], links: [], plans: {} }; resolve(); };
    });
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
  }
};

// ==========================================
// 3. Parser (v7.1)
// ==========================================
const Parser = {
  parse(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(
            wb.Sheets[wb.SheetNames[0]],
            { header: 1, defval: null, raw: true }
          );
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
        name,
        level,
        sum: toNum(row[SUM_COLUMN]),
        qty: toNum(row[QTY_COLUMN]),
        path,
        category: this.category(path),
        gender: this.gender(path),
        children: [],
        isItem: false, // определим после обхода
      };

      if (parent) parent.children.push(node);
      else roots.push(node);

      stack.push(node);
    }

    // --- isItem = лист
    const markItems = (nodes) => nodes.forEach(n => {
      if (n.children.length === 0) {
        n.isItem = true;
      } else {
        markItems(n.children);
      }
    });
    markItems(roots);

    // --- Сходимость
    let leavesSum = 0;
    const collectLeaves = (nodes) => nodes.forEach(n => {
      if (n.isItem) leavesSum += n.sum;
      else collectLeaves(n.children);
    });
    collectLeaves(roots);

    const valid = controlSum === 0
      ? Math.abs(leavesSum) < 1
      : Math.abs(leavesSum - controlSum) / Math.abs(controlSum) < 0.01;

    return {
      roots,
      daysInPeriod: period.daysInPeriod,
      daysInMonth: period.daysInMonth,
      periodKnown: period.known,
      totalSum: controlSum,
      valid,
      errorMsg: valid ? null : { leaves: Math.round(leavesSum), control: Math.round(controlSum) },
      date: new Date().toISOString(),
      filename,
    };
  },

  parsePeriod(filename) {
    const m = filename.match(
      /(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})\s*[-–—]\s*(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})/
    );
    if (!m) {
      return { daysInPeriod: CONFIG.PARSER.DEFAULT_PERIOD_DAYS, daysInMonth: 30, known: false };
    }
    const y = (s) => (s.length === 2 ? 2000 + Number(s) : Number(s));
    const start = new Date(y(m[3]), Number(m[2]) - 1, Number(m[1]));
    const end   = new Date(y(m[6]), Number(m[5]) - 1, Number(m[4]));
    const daysInPeriod = Math.round((end - start) / 86400000) + 1;
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    return { daysInPeriod, daysInMonth, known: true };
  },

  normalize(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е');
  },

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
// 4. APP Router & Screens
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
    this.route(this.screen);
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
    if (screen === 'home') Screens.home(root);
    if (screen === 'analytics') Screens.analytics(root);
    if (screen === 'rails') Screens.rails(root);
    if (screen === 'settings') Screens.settings(root);
    window.scrollTo(0, 0);
  }
};

const Screens = {
  home(root) {
    const current = DB.data.imports[0];
    if (!current) {
      root.innerHTML = `
        <div class="header"><h1 class="h1">Главная</h1></div>
        <div class="card empty-state">
          <h2>Нет данных</h2>
          <p>Загрузите выгрузку 1С, чтобы увидеть аналитику</p>
          <button class="btn btn-primary" onclick="App.route('settings')">Перейти в настройки</button>
        </div>`;
      return;
    }

    const planKey = current.date.slice(0, 7);
    const plan = DB.data.plans[planKey] || current.totalSum;
    const planPct = plan > 0 ? Math.min(100, (current.totalSum / plan) * 100) : 0;
    
    // Блок 5: прогноз через конфиг и periodKnown
    const showForecast = current.periodKnown && current.daysInPeriod >= CONFIG.PLAN.MIN_DAYS_FOR_FORECAST;
    const forecast = showForecast
      ? Math.round((current.totalSum / current.daysInPeriod) * current.daysInMonth)
      : null;

    // 1. КАТЕГОРИИ (только листья)
    const cats = { 'Одежда': 0, 'Обувь': 0, 'Аксессуары': 0, 'Распродажа': 0 };
    const calcCats = (nodes) => nodes.forEach(n => {
      if (n.isItem) cats[n.category] += n.sum;
      else calcCats(n.children);
    });
    calcCats(current.roots);

    // 2. ТОП-5 — все листовые папки, приоритет по категории и полу
    const tops = Object.fromEntries(CONFIG.TOP.CATEGORIES.map(k => [k, []]));

    const findLeafFolders = (nodes) => nodes.forEach(n => {
      if (n.isItem) return;
      const isLeaf = n.children.length === 0 || n.children.every(c => c.isItem);
      if (isLeaf) this._classifyTopFolder(n, tops);
      else findLeafFolders.call(this, n.children);
    });
    findLeafFolders.call(this, current.roots);

    // Очистка от дублей по path и сортировка
    for (const key of CONFIG.TOP.CATEGORIES) {
      const seen = new Set();
      tops[key] = tops[key]
        .filter(f => f.sum !== 0 && !seen.has(f.path) && seen.add(f.path))
        .sort((a, b) => b.sum - a.sum);
    }

    root.innerHTML = `
      <div class="header">
        <div>
          <h1 class="h1">Мода ▾</h1>
          <div class="subtitle">Данные за ${current.daysInPeriod} дн.</div>
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
          <span>${Math.round(planPct)}%</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${planPct}%"></div></div>
        ${forecast !== null
          ? `<div class="forecast-text">Прогноз на месяц: <span style="color:var(--accent);font-weight:700">${forecast.toLocaleString('ru-RU')} ₽</span></div>`
          : `<div class="forecast-text">${current.periodKnown
              ? `Прогноз недоступен (мало данных: ${current.daysInPeriod} дн.)`
              : `Прогноз недоступен (период не определён по имени файла)`}</div>`
        }
      </div>

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
          <div class="tab active" data-g="М" onclick="window.switchTop('М', this)">Мужская одежда</div>
          <div class="tab" data-g="Ж" onclick="window.switchTop('Ж', this)">Женская одежда</div>
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

  // Раскладывает листовую папку по вкладкам топа.
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

  analytics(root) {
    const current = DB.data.imports[0];
    if (!current) return App.route('home');

    let folders = [];
    const collect = (nodes) => nodes.forEach(n => {
      if (n.isItem) return;
      if (n.children.length === 0 || n.children.every(c => c.isItem)) folders.push(n);
      else collect(n.children);
    });
    collect(current.roots);

    const positive = folders.filter(f => f.sum > 0).sort((a, b) => b.sum - a.sum);
    const zeroOrNeg = folders.filter(f => f.sum <= 0);

    const total = positive.reduce((acc, f) => acc + f.sum, 0);
    
    // Блок 4: ABC через конфиг
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
            <div class="stat-val num">${a.length} папок</div>
          </div>
          <div class="stat-box" style="background:var(--danger);color:#fff">
            <div class="stat-label" style="color:#fff">B (15%)</div>
            <div class="stat-val num">${b.length} папок</div>
          </div>
          <div class="stat-box" style="background:var(--danger-bg);color:var(--danger)">
            <div class="stat-label" style="color:var(--danger)">C (5%)</div>
            <div class="stat-val num">${c.length} папок</div>
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

  rails(root) {
    root.innerHTML = `
      <div class="header"><h1 class="h1">Рейлы</h1></div>
      <div class="card empty-state">
        <h2>В разработке</h2>
        <p>Чтобы считать эффективность рейлов (₽/м), нужно загрузить карту рейлов и привязать к ним товары.</p>
      </div>
    `;
  },

  settings(root) {
    const planKey = new Date().toISOString().slice(0, 7);
    const currentPlan = DB.data.plans[planKey] || '';

    root.innerHTML = `
      <div class="header"><h1 class="h1">Настройки</h1></div>

      <div class="card">
        <div class="card-title">План на месяц</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:500;">
          Введите плановую выручку на текущий месяц.
        </p>
        <input type="number" class="input" id="plan-input" placeholder="Например, 1000000" value="${currentPlan}">
        <button class="btn btn-primary" style="margin-top:12px" id="btn-save-plan">Сохранить план</button>
      </div>

      <div class="card">
        <div class="card-title">Данные 1С</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px;font-weight:500;">
          Загрузите .xlsx файл.
        </p>
        <input type="file" id="file-upload" accept=".xlsx" style="display:none">
        <button class="btn btn-primary" id="btn-upload">Загрузить .xlsx</button>
        ${DB.data.imports.length ? `<button class="btn btn-danger" style="margin-top:12px" id="btn-clear">Очистить все данные</button>` : ''}
      </div>
    `;

    document.getElementById('btn-save-plan').onclick = async () => {
      const val = parseFloat(document.getElementById('plan-input').value) || 0;
      DB.data.plans[planKey] = val;
      await DB.save();
      UI.toast('План сохранён');
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
      DB.data = { imports: [], rails: [], links: [], plans: {} };
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
        // Блок 6: лимит импортов
        DB.data.imports = DB.data.imports.slice(0, CONFIG.STORAGE.MAX_IMPORTS);
        await DB.save();
        UI.toast(data.valid ? 'Успешно загружено' : 'Внимание: расхождение в суммах', data.valid ? 'default' : 'error');
        App.route('home');
      } catch (err) {
        UI.toast('Ошибка чтения файла', 'error');
      }
    };
  }
};

// ==========================================
// 5. INIT
// ==========================================
window.App = App;
window.UI = UI;

DB.init().then(() => {
  App.init();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
