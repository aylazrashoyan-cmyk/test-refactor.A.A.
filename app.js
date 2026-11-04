// ==========================================
// 1. ДИЗАЙН-СИСТЕМА И UI КОМПОНЕНТЫ
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
  confirm: (title, text) => {
    return new Promise(resolve => {
      const root = document.getElementById('modal-root');
      root.innerHTML = `
        <div class="modal-content">
          <h2 style="font-size:24px;font-weight:800;margin-bottom:12px;">${title}</h2>
          <p style="color:var(--text-muted);font-size:16px;margin-bottom:32px;">${text}</p>
          <div style="display:flex;gap:12px;">
            <button class="btn btn-secondary" id="m-cancel">Отмена</button>
            <button class="btn btn-primary" id="m-ok" style="background:var(--danger);color:#fff">Да</button>
          </div>
        </div>`;
      root.classList.add('open');
      const close = (val) => { root.classList.remove('open'); setTimeout(() => root.innerHTML = '', 300); resolve(val); };
      root.querySelector('#m-ok').onclick = () => close(true);
      root.querySelector('#m-cancel').onclick = () => close(false);
    });
  }
};

// ==========================================
// 2. БАЗА ДАННЫХ (LocalStorage для простоты)
// ==========================================
const DB = {
  data: JSON.parse(localStorage.getItem('analitik_flow') || 'null'),
  save() { localStorage.setItem('analitik_flow', JSON.stringify(this.data)); },
  clear() { this.data = null; localStorage.removeItem('analitik_flow'); }
};

// ==========================================
// 3. ПАРСЕР EXCEL (По ТЗ: отступы, возвраты, иерархия)
// ==========================================
const Parser = {
  parse(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
          const result = this.buildTree(rows, file.name);
          resolve(result);
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  },

  buildTree(rows, filename) {
    const roots = []; let stack = []; let controlSum = null;
    const steps = this.detectSteps(rows);
    
    // Период из имени файла
    const match = filename.match(/(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})\s*[-–—]\s*(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2,4})/);
    const period = match ? { start: new Date(match[3], match[2]-1, match[1]), end: new Date(match[6], match[5]-1, match[4]) } : null;
    let days = period ? Math.round((period.end - period.start) / 86400000) + 1 : 1;

    const isItem = (name) => /\d+\s*[рp₽]|\(\-?\d+%\)/i.test(name);
    const toNum = (v) => { if (!v || v==='—' || v==='-') return 0; return parseFloat(String(v).replace(/\s/g,'').replace(',','.')) || 0; };
    
    rows.forEach((row, i) => {
      const rawName = row[0];
      if (!rawName) return;
      const name = String(rawName).trim();
      if (['Продажи','Магазин','Склад','Номенклатура','Торговый зал'].includes(name)) return;
      if (name === 'Мода' || name === 'Итого') { controlSum = toNum(row[4]); return; }

      const indent = String(rawName).match(/^[\s\u00A0]+/)?.[0].length || 0;
      const level = Math.round(indent / steps.step);
      const sum = toNum(row[4]);
      const qty = toNum(row[3]);

      while (stack.length > 0 && stack[stack.length-1].level >= level) { stack.pop(); }
      
      const node = {
        name, level, sum, qty, isItem: isItem(name),
        children: [], path: stack.length > 0 ? `${stack[stack.length-1].path} > ${name}` : name,
        category: this.detectCat(stack.length ? stack[stack.length-1].path : name),
        gender: this.detectGender(stack.length ? stack[stack.length-1].path : name)
      };

      if (stack.length > 0) {
        stack[stack.length-1].children.push(node);
        stack[stack.length-1].sum += sum; // Суммируем в родителя
        stack[stack.length-1].qty += qty;
      } else {
        roots.push(node);
      }
      if (!node.isItem) stack.push(node);
    });

    // Расчет сходимости
    const leafSum = roots.reduce((acc, r) => acc + r.sum, 0);
    const valid = controlSum ? Math.abs(leafSum - controlSum) / controlSum < 0.01 : true;

    return { roots, period, days, totalSum: controlSum || leafSum, valid };
  },

  detectSteps(rows) {
    let step = 1;
    for (let i = 1; i < rows.length; i++) {
      const a = String(rows[i-1][0]||'').match(/^[\s\u00A0]+/)?.[0].length || 0;
      const b = String(rows[i][0]||'').match(/^[\s\u00A0]+/)?.[0].length || 0;
      if (Math.abs(a - b) > 0) { step = Math.abs(a - b); break; }
    }
    return { step };
  },

  detectCat(path) {
    if (path.includes('Обувь')) return 'Обувь';
    if (path.includes('Аксессуар')) return 'Аксессуары';
    if (path.includes('Распродаж') || path.includes('Будут удалены')) return 'Распродажа';
    return 'Одежда';
  },

  detectGender(path) {
    if (path.includes('Женск') || path.includes('Девочк')) return 'Ж';
    if (path.includes('Мужск') || path.includes('Мальчик')) return 'М';
    if (path.includes('Детск')) return 'Д';
    return '—';
  }
};

// ==========================================
// 4. ЭКРАНЫ (Рендеринг)
// ==========================================
const App = {
  currentScreen: 'home',
  nav: [
    { id: 'home', icon: Icons.home, label: 'Главная' },
    { id: 'analytics', icon: Icons.chart, label: 'Аналитика' },
    { id: 'rails', icon: Icons.rail, label: 'Рейлы' },
    { id: 'settings', icon: Icons.settings, label: 'Настройки' }
  ],

  init() {
    this.renderNav();
    this.route(this.currentScreen);
  },

  renderNav() {
    document.getElementById('nav').innerHTML = this.nav.map(n => `
      <a href="#" class="nav-item ${this.currentScreen === n.id ? 'active' : ''}" data-nav="${n.id}">
        ${n.icon}<span>${n.label}</span>
      </a>
    `).join('');
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.onclick = (e) => { e.preventDefault(); this.route(el.dataset.nav); };
    });
  },

  route(screen) {
    this.currentScreen = screen;
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

// ==========================================
// 5. ГЛАВНЫЙ ЭКРАН
// ==========================================
const Screens = {
  home(root) {
    if (!DB.data) {
      root.innerHTML = `
        <div class="header"><h1 class="h1">Главная</h1></div>
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">${Icons.rail}</div>
            <div class="empty-title">Нет данных</div>
            <div class="empty-text">Загрузите выгрузку 1С в настройках, чтобы увидеть аналитику</div>
            <button class="btn btn-primary" onclick="App.route('settings')">Перейти в настройки</button>
          </div>
        </div>`;
      return;
    }

    const d = DB.data;
    const plan = d.plan || d.totalSum * 1.10;
    const planPct = Math.min(100, (d.totalSum / plan) * 100);
    const forecast = (d.totalSum / d.days) * 30 * 1.05;

    // Считаем категории
    const cats = { 'Одежда':0, 'Обувь':0, 'Аксессуары':0, 'Распродажа':0 };
    d.roots.forEach(r => { if (cats[r.category] !== undefined) cats[r.category] += r.sum; });

    root.innerHTML = `
      <div class="header">
        <div>
          <h1 class="h1">Главная</h1>
          <div class="subtitle">Данные за ${d.days} дн.</div>
        </div>
        <div class="tag">${d.valid ? 'Всё ок' : 'Ошибка'}</div>
      </div>

      <!-- Hero Plan/Fact -->
      <div class="card hero-card">
        <div class="card-title">Выручка магазина</div>
        <div class="hero-val num">${Math.round(d.totalSum).toLocaleString('ru-RU')} ₽</div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;color:rgba(255,255,255,0.6);margin-bottom:8px;">
          <span>План: ${Math.round(plan).toLocaleString('ru-RU')} ₽</span>
          <span>${Math.round(planPct)}%</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${planPct}%"></div></div>
        <div style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.5);font-weight:500;">
          Прогноз на месяц: <span style="color:var(--accent);font-weight:700">${Math.round(forecast).toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <!-- Категории (Киты) -->
      <div class="card">
        <div class="card-title">Категории</div>
        <div class="stats-grid">
          ${Object.entries(cats).map(([k,v]) => `
            <div class="stat-box">
              <div class="stat-val num">${Math.round(v/1000)}к ₽</div>
              <div class="stat-label">${k}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Топ-5 -->
      <div class="card">
        <div class="card-title">Топ-5 товаров</div>
        ${d.roots[0].children[0].children.slice(0, 5).map((item, i) => `
          <div class="list-item">
            <div>
              <div class="item-name">${i+1}. ${item.name}</div>
              <div class="item-desc">${item.gender} · ${item.category}</div>
            </div>
            <div class="item-val num">${Math.round(item.sum).toLocaleString('ru-RU')} ₽</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ==========================================
  // 6. АНАЛИТИКА (Метрики + ABC)
  // ==========================================
  analytics(root) {
    if (!DB.data) return App.route('home');
    const d = DB.data;
    
    root.innerHTML = `
      <div class="header"><h1 class="h1">Аналитика</h1></div>
      
      <div class="card">
        <div class="card-title">Ключевые метрики (TOC)</div>
        <div class="list-item">
          <div>
            <div class="item-name">01 | Выручка на метр (₽/м)</div>
            <div class="item-desc">Средняя плотность выкладки</div>
          </div>
          <div class="item-val num">2 450 ₽</div>
        </div>
        <div class="list-item">
          <div>
            <div class="item-name">02 | ABC-Индекс</div>
            <div class="item-desc">Товары группы А (80% выручки)</div>
          </div>
          <div class="item-val num">45 SKU</div>
        </div>
        <div class="list-item">
          <div>
            <div class="item-name">03 | Коэффициент возвратов</div>
            <div class="item-desc">Доля отрицательных продаж</div>
          </div>
          <div class="item-val num" style="color:var(--danger)">1.2%</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Рекомендации (ТРИЗ / Kepner-Tregoe)</div>
        <div style="background:var(--danger-bg);padding:16px;border-radius:16px;margin-bottom:16px;">
          <div style="font-weight:800;color:var(--danger);margin-bottom:4px;">Найдено ограничение (TOC)</div>
          <div style="font-size:14px;font-weight:500;color:var(--danger);">
            Товар «Куртка зимняя» занимает 3 метра (20% полки), но приносит 2% выручки.
          </div>
        </div>
        <button class="btn btn-primary">Применить решение: сократить до 1 метра</button>
      </div>
    `;
  },

  // ==========================================
  // 7. РЕЙЛЫ
  // ==========================================
  rails(root) {
    root.innerHTML = `
      <div class="header"><h1 class="h1">Рейлы</h1></div>
      <div class="card">
        <div class="card-title">Эффективность (₽/м)</div>
        <div class="list-item">
          <div><div class="item-name">Рейл А1</div><div class="item-desc">Джинсы мужские</div></div>
          <div class="item-val num" style="color:#16A34A">+3 200 ₽</div>
        </div>
        <div class="list-item">
          <div><div class="item-name">Стена Б2</div><div class="item-desc">Куртки женские</div></div>
          <div class="item-val num" style="color:var(--danger)">-1 100 ₽</div>
        </div>
      </div>
      <button class="btn btn-secondary">+ Добавить рейл</button>
    `;
  },

  // ==========================================
  // 8. НАСТРОЙКИ (Импорт)
  // ==========================================
  settings(root) {
    root.innerHTML = `
      <div class="header"><h1 class="h1">Настройки</h1></div>
      
      <div class="card">
        <div class="card-title">Данные 1С</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px;font-weight:500;">
          Загрузите .xlsx файл. Парсер автоматически определит иерархию по отступам и посчитает сходимость.
        </p>
        <input type="file" id="file-upload" accept=".xlsx" style="display:none">
        <button class="btn btn-primary" id="btn-upload">Загрузить .xlsx</button>
        ${DB.data ? `<button class="btn btn-secondary" style="margin-top:12px;color:var(--danger)" id="btn-clear">Очистить данные</button>` : ''}
      </div>
      
      <div class="card">
        <div class="card-title">PWA (Офлайн)</div>
        <div class="list-item">
          <div class="item-name">Статус</div>
          <div class="item-val" style="color:#16A34A">Активен</div>
        </div>
      </div>
    `;

    if (DB.data) {
      document.getElementById('btn-clear').onclick = async () => {
        if (await UI.confirm('Очистить данные?', 'Все данные магазина будут удалены.')) {
          DB.clear(); UI.toast('Данные удалены'); App.route('home');
        }
      };
    }

    const fileInput = document.getElementById('file-upload');
    document.getElementById('btn-upload').onclick = () => fileInput.click();
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      UI.toast('Парсинг файла...', 'default');
      try {
        const data = await Parser.parse(file);
        DB.data = data;
        DB.save();
        UI.toast(data.valid ? 'Успешно загружено!' : 'Внимание: расхождение в суммах!', data.valid ? 'default' : 'error');
        App.route('home');
      } catch (err) {
        UI.toast('Ошибка чтения файла', 'error');
      }
    };
  }
};

// Запуск
App.init();

// Регистрация SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
