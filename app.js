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
  dbName: 'analitik_v5', storeName: 'data', data: null,
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
      };
      req.onerror = () => resolve();
    });
  },
  async save() {
    return new Promise((resolve) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(this.data, 'state');
        tx.oncomplete = () => resolve();
      };
    });
  }
};

// ==========================================
// 3. Parser (v5.0 — УМНЫЙ ПАРСЕР)
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
      reader.readAsArrayBuffer(file);
    });
  },

  build(rows, filename) {
    let controlSum = 0, step = 2;
    let dateMatch = filename.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})\s*[-–—]\s*(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})/);

    let daysInPeriod = 30, daysInMonth = 30;
    if (dateMatch) {
      const s = new Date(dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
      const e = new Date(dateMatch[6].length === 2 ? '20' + dateMatch[6] : dateMatch[6], dateMatch[5] - 1, dateMatch[4]);
      daysInPeriod = Math.round((e - s) / 86400000) + 1;
      daysInMonth = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    }

    const toNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[\s\u00A0]/g, '').replace(',', '.')) || 0);
    const isItem = (name) => /\d+\s*[рp₽]|\(\-?\d+%\)/i.test(name);

    const roots = []; let stack = [];

    rows.forEach(row => {
      const raw = row[0]; if (!raw) return;
      const name = String(raw).trim();
      if (['Продажи', 'Магазин', 'Склад', 'Номенклатура', 'Торговый зал', 'Итого'].includes(name)) return;
      if (name === 'Мода') { controlSum = toNum(row[4]); return; }

      const indent = String(raw).match(/^[\s\u00A0]+/)?.[0].length || 0;
      const level = Math.round(indent / step);

      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();

      // Берем суммы ИЗ ФАЙЛА, не суммируем вручную
      const node = {
        name, level, sum: toNum(row[4]), qty: toNum(row[3]), isItem: isItem(name),
        children: [], path: stack.length ? `${stack[stack.length - 1].path} > ${name}` : name,
        category: this.cat(stack.length ? stack[stack.length - 1].path : name),
        gender: this.gen(stack.length ? stack[stack.length - 1].path : name)
      };

      if (stack.length > 0) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      
      if (!node.isItem) stack.push(node);
    });

    // Валидация по листьям
    let leavesSum = 0;
    const collectLeaves = (nodes) => nodes.forEach(n => {
      if (n.isItem) leavesSum += n.sum;
      else if (n.children.length) collectLeaves(n.children);
    });
    collectLeaves(roots);

    const valid = Math.abs(leavesSum - controlSum) / (controlSum || 1) < 0.01;
    const errorMsg = valid ? '' : { leaves: Math.round(leavesSum), control: Math.round(controlSum) };

    return { roots, daysInPeriod, daysInMonth, totalSum: controlSum, valid, errorMsg, date: new Date().toISOString(), filename };
  },

  cat(path) {
    if (path.includes('Обувь')) return 'Обувь';
    if (path.includes('Аксессуар')) return 'Аксессуары';
    if (path.includes('Распродаж') || path.includes('Будут удалены')) return 'Распродажа';
    return 'Одежда';
  },
  gen(path) {
    if (path.includes('Женск') || path.includes('Девочк')) return 'Ж';
    if (path.includes('Мужск') || path.includes('Мальчик')) return 'М';
    if (path.includes('Детск')) return 'Д';
    return null;
  }
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
    const showForecast = current.daysInPeriod >= 10;
    const forecast = showForecast ? Math.round((current.totalSum / current.daysInPeriod) * current.daysInMonth) : null;

    // КАТЕГОРИИ: берем корневые папки. Если "Одежда", "Обувь", "Аксессуары" лежат отдельно — они и будут корневыми.
    const cats = { 'Одежда': 0, 'Обувь': 0, 'Аксессуары': 0, 'Распродажа': 0 };
    current.roots.forEach(r => {
      // В 1С может быть "Мода -> Мужская -> Верхняя одежда", а может "Мода -> Обувь"
      if (r.category === 'Обувь') cats['Обувь'] += r.sum;
      else if (r.category === 'Аксессуары') cats['Аксессуары'] += r.sum;
      else if (r.category === 'Распродажа') cats['Распродажа'] += r.sum;
      else cats['Одежда'] += r.sum;
    });

    // УМНЫЙ СБОР ТОП-5
    let tops = { 'М': [], 'Ж': [], 'Д': [], 'Аксессуары': [], 'Обувь': [] };
    
    // Функция рекурсивного поиска "нормальных" папок
    const findLeaves = (nodes, depth = 0) => {
      const result = [];
      nodes.forEach(n => {
        if (n.isItem) return; // Товары пропускаем
        const isLeafFolder = n.children.length === 0 || n.children.every(c => c.isItem);
        
        // Если это папка с товарами (лист) И название не дублирует родителя (типа Куртки -> Куртки)
        if (isLeafFolder) {
          result.push(n);
        } else {
          // Если это промежуточная папка, спускаемся глубже
          result.push(...findLeaves(n.children, depth + 1));
        }
      });
      return result;
    };

    current.roots.forEach(rootNode => {
      if (rootNode.category === 'Обувь') {
        // Обувь: берем подпапки Женская/Мужская/Детская, а в них уже листья
        rootNode.children.forEach(genderNode => {
          if (genderNode.name.includes('Женск') || genderNode.name.includes('Девочк')) tops['Ж'].push(...findLeaves([genderNode]));
          else if (genderNode.name.includes('Мужск') || genderNode.name.includes('Мальчик')) tops['М'].push(...findLeaves([genderNode]));
          else if (genderNode.name.includes('Детск')) tops['Д'].push(...findLeaves([genderNode]));
          else tops['Обувь'].push(...findLeaves([genderNode]));
        });
      } 
      else if (rootNode.category === 'Аксессуары') {
        // Аксессуары: берем папки 1-го уровня (Носки, Сумки, Рюкзаки)
        rootNode.children.forEach(child => {
          if (child.name !== 'Аксессуары' && !child.isItem) tops['Аксессуары'].push(child);
        });
      } 
      else {
        // Одежда (Ж, М, Д)
        if (rootNode.name.includes('Женск')) tops['Ж'].push(...findLeaves(rootNode.children));
        else if (rootNode.name.includes('Мужск')) tops['М'].push(...findLeaves(rootNode.children));
        else if (rootNode.name.includes('Детск')) tops['Д'].push(...findLeaves(rootNode.children));
        else {
           // Если в корне лежит "Одежда" (как общая папка), распределяем по детям
           rootNode.children.forEach(child => {
             if (child.name.includes('Женск')) tops['Ж'].push(...findLeaves(child.children));
             else if (child.name.includes('Мужск')) tops['М'].push(...findLeaves(child.children));
             else if (child.name.includes('Детск')) tops['Д'].push(...findLeaves(child.children));
           });
        }
      }
    });

    // Очистка от пустых и дублей, сортировка
    Object.keys(tops).forEach(k => {
      const unique = [];
      const seen = new Set();
      tops[k].forEach(item => {
        if (item.sum > 0 && !seen.has(item.name)) {
          // Убираем дубли по имени (Куртки -> Куртки)
          // Если у папки сумма равна сумме единственного ребенка, берем ребенка
          if (item.children.length === 1 && !item.children[0].isItem && Math.abs(item.sum - item.children[0].sum) < 1) {
            return; // Пропускаем пустышку
          }
          seen.add(item.name);
          unique.push(item);
        }
      });
      tops[k] = unique.sort((a, b) => b.sum - a.sum);
    });

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
        ${forecast !== null ? `
        <div class="forecast-text">Прогноз на месяц: <span style="color:var(--accent);font-weight:700">${forecast.toLocaleString('ru-RU')} ₽</span></div>
        ` : `
        <div class="forecast-text">Прогноз недоступен (мало данных: ${current.daysInPeriod} дн.)</div>
        `}
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
      const list = tops[gender] || [];
      if (!list.length) return `<div class="item-desc" style="padding:16px 0">Нет данных</div>`;
      return list.slice(0, 5).map((item, i) => `
        <div class="list-item">
          <div>
            <div class="item-name">${i + 1}. ${item.name}</div>
            <div class="item-desc">${item.path.split(' > ').slice(-2).join(' · ')}</div>
          </div>
          <div class="item-val num ${item.sum < 0 ? 'neg' : ''}">${Math.round(item.sum).to
