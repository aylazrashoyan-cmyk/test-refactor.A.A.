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
  dbName: 'analitik_v3', storeName: 'data', data: null,
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
// 3. Parser (Strict v3.0)
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
      const s = new Date(dateMatch[3].length===2?'20'+dateMatch[3]:dateMatch[3], dateMatch[2]-1, dateMatch[1]);
      const e = new Date(dateMatch[6].length===2?'20'+dateMatch[6]:dateMatch[6], dateMatch[5]-1, dateMatch[4]);
      daysInPeriod = Math.round((e - s)/86400000) + 1;
      daysInMonth = new Date(s.getFullYear(), s.getMonth()+1, 0).getDate();
    }

    const toNum = (v) => (typeof v === 'number' ? v : parseFloat(String(v||'').replace(/[\s\u00A0]/g,'').replace(',','.')) || 0);
    const isItem = (name) => /\d+\s*[рp₽]|\(\-?\d+%\)/i.test(name);

    const roots = []; let stack = [];

    rows.forEach(row => {
      const raw = row[0]; if (!raw) return;
      const name = String(raw).trim();
      if (['Продажи','Магазин','Склад','Номенклатура','Торговый зал','Итого'].includes(name)) return;
      if (name === 'Мода') { controlSum = toNum(row[4]); return; }

      const indent = String(raw).match(/^[\s\u00A0]+/)?.[0].length || 0;
      const level = Math.round(indent / step);
      
      while (stack.length > 0 && stack[stack.length-1].level >= level) stack.pop();
      
      const node = {
        name, level, sum: toNum(row[4]), qty: toNum(row[3]), isItem: isItem(name),
        children: [], path: stack.length ? `${stack[stack.length-1].path} > ${name}` : name,
        category: this.cat(stack.length ? stack[stack.length-1].path : name),
        gender: this.gen(stack.length ? stack[stack.length-1].path : name)
      };

      if (stack.length > 0) {
        stack[stack.length-1].children.push(node);
        stack[stack.length-1].sum += node.sum; // Сумма родителя для сходимости
      } else roots.push(node);
      if (!node.isItem) stack.push(node);
    });

    // Валидация (считаем только конечные папки, чтобы избежать дублей)
    let trueSum = 0;
    const sumLeaves = (nodes) => nodes.forEach(n => {
      if (n.children.length === 0 || n.children.every(c => c.isItem)) trueSum += n.sum;
      else sumLeaves(n.children);
    });
    sumLeaves(roots);

    const valid = Math.abs(trueSum - controlSum) / (controlSum || 1) < 0.01;
    const errorMsg = valid ? '' : `Сумма листьев (${Math.round(trueSum)}) не сходится с Итого (${controlSum})`;

    return { roots, daysInPeriod, daysInMonth, totalSum: controlSum, valid, errorMsg, date: new Date().toISOString() };
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
  // --- ГЛАВНАЯ ---
  home(root) {
    const current = DB.data.imports[0];
    if (!current) {
      root.innerHTML = `
        <div class="header"><h1 class="h1">Главная</h1></div>
        <div class="card" style="text-align:center; padding: 40px 20px;">
          <h2 style="font-size:20px; font-weight:800; margin-bottom:8px;">Нет данных</h2>
          <p style="color:var(--text-muted); margin-bottom:20px;">Загрузите выгрузку 1С, чтобы увидеть аналитику</p>
          <button class="btn btn-primary" onclick="App.route('settings')">Перейти в настройки</button>
        </div>`;
      return;
    }

    const plan = DB.data.plans[current.date.slice(0,7)] || current.totalSum * 1.10;
    const planPct = Math.min(100, (current.totalSum / plan) * 100);
    const forecast = (current.totalSum / current.daysInPeriod) * current.daysInMonth * 1.05;

    // КАТЕГОРИИ (берем только корневые папки, чтобы не было двойного счета)
    const cats = { 'Одежда':0, 'Обувь':0, 'Аксессуары':0, 'Распродажа':0 };
    current.roots.forEach(r => { if (cats[r.category] !== undefined) cats[r.category] += r.sum; });

    // ТОП-5 ПАПОК
    let tops = { 'М': [], 'Ж': [], 'Д': [], 'Аксессуары': [] };
    const collect = (nodes) => nodes.forEach(n => {
      if (n.isItem) return;
      if (n.children.length === 0 || n.children.every(c => c.isItem)) {
        if (n.category === 'Аксессуары') tops['Аксессуары'].push(n);
        else if (n.gender === 'М') tops['М'].push(n);
        else if (n.gender === 'Ж') tops['Ж'].push(n);
        else if (n.gender === 'Д') tops['Д'].push(n);
      } else collect(n.children);
    });
    collect(current.roots);
    Object.keys(tops).forEach(k => tops[k].sort((a,b) => b.sum - a.sum));

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
        <div style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.5);font-weight:500;">
          Прогноз: <span style="color:var(--accent);font-weight:700">${Math.round(forecast).toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Категории</div>
        <div class="stats-grid">
          ${Object.entries(cats).map(([k,v]) => `
            <div class="stat-box">
              <div class="stat-val num">${Math.round(v).toLocaleString('ru-RU')} ₽</div>
              <div class="stat-label">${k}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Топ-5 папок</div>
        <div class="tabs">
          <div class="tab active" onclick="document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));this.classList.add('active');document.getElementById('top-list').innerHTML=renderTop('М')">Мужской</div>
          <div class="tab" onclick="document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));this.classList.add('active');document.getElementById('top-list').innerHTML=renderTop('Ж')">Женский</div>
          <div class="tab" onclick="document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));this.classList.add('active');document.getElementById('top-list').innerHTML=renderTop('Д')">Детский</div>
          <div class="tab" onclick="document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));this.classList.add('active');document.getElementById('top-list').innerHTML=renderTop('Аксессуары')">Аксесс.</div>
        </div>
        <div id="top-list"></div>
      </div>
    `;

    window.renderTop = (gender) => tops[gender].slice(0, 5).map((item, i) => `
      <div class="list-item">
        <div>
          <div class="item-name">${i+1}. ${item.name}</div>
          <div class="item-desc">${item.path.split(' > ').slice(-2).join(' · ')}</div>
        </div>
        <div class="item-val num">${Math.round(item.sum).toLocaleString('ru-RU')} ₽</div>
      </div>
    `).join('');
    
    document.getElementById('top-list').innerHTML = window.renderTop('М');

    // Клик по ошибке
    if (!current.valid) {
      document.getElementById('err-tag').onclick = () => {
        UI.modal(`
          <h2 style="font-size:24px;font-weight:800;margin-bottom:12px;color:var(--danger)">Ошибка сходимости</h2>
          <p style="color:var(--text-muted);font-size:16px;margin-bottom:24px;">${current.errorMsg}</p>
          <button class="btn btn-primary" onclick="UI.closeModal()">Понятно</button>
        `);
      };
    }
  },

  // --- АНАЛИТИКА ---
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
    folders.sort((a,b) => b.sum - a.sum);

    let total = folders.reduce((acc, f) => acc + (f.sum > 0 ? f.sum : 0), 0);
    let cum = 0, a=[], b=[], c=[];
    folders.forEach(f => {
      if (f.sum <= 0) { c.push(f); return; }
      cum += f.sum;
      if (cum <= total * 0.8) a.push(f);
      else if (cum <= total * 0.95) b.push(f);
      else c.push(f);
    });

    root.innerHTML = `
      <div class="header"><h1 class="h1">Аналитика</h1></div>
      
      <div class="card">
        <div class="card-title">ABC-Анализ папок</div>
        <div class="stats-grid" style="margin-bottom:16px;">
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
        </div>
        <button class="btn btn-secondary" onclick="document.getElementById('abc-list').style.display = document.getElementById('abc-list').style.display === 'none' ? 'block' : 'none'">Показать списки</button>
        <div id="abc-list" style="display:none; margin-top:16px;">
          <div style="font-weight:800; margin-bottom:8px; color:var(--accent-dark)">Группа А</div>
          ${a.map(f => `<div class="list-item"><div class="item-name">${f.name}</div><div class="item-val num">${Math.round(f.sum).toLocaleString('ru-RU')} ₽</div></div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Рекомендации (TOC)</div>
        <div style="background:var(--danger-bg);padding:16px;border-radius:16px;margin-bottom:16px;">
          <div style="font-weight:800;color:var(--danger);margin-bottom:4px;">Найдено ограничение</div>
          <div style="font-size:14px;font-weight:500;color:var(--danger);">
            ${c.length} папок приносят менее 5% выручки. Рекомендуется сократить их метраж.
          </div>
        </div>
        <button class="btn btn-primary" onclick="document.getElementById('rec-list').style.display = document.getElementById('rec-list').style.display === 'none' ? 'block' : 'none'">Показать рекомендации</button>
        <div id="rec-list" style="display:none; margin-top:16px;">
          ${c.slice(0, 5).map(f => `<div class="list-item"><div class="item-name">${f.name}</div><div class="item-val" style="color:var(--danger)">Сократить метр</div></div>`).join('')}
        </div>
      </div>
    `;
  },

  // --- РЕЙЛЫ ---
  rails(root) {
    root.innerHTML = `
      <div class="header"><h1 class="h1">Рейлы</h1></div>
      <div class="card">
        <div class="card-title">Эффективность (₽/м)</div>
        <div class="list-item">
          <div><div class="item-name">Рейл А1</div><div class="item-desc">Джинсы мужские</div></div>
          <div class="item-val num" style="color:var(--accent-dark)">+3 200 ₽</div>
        </div>
        <div class="list-item">
          <div><div class="item-name">Стена Б2</div><div class="item-desc">Куртки женские</div></div>
          <div class="item-val num" style="color:var(--danger)">-1 100 ₽</div>
        </div>
      </div>
      <button class="btn btn-primary">+ Добавить рейл</button>
    `;
  },

  // --- НАСТРОЙКИ ---
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
        ${DB.data.imports.length ? `<button class="btn btn-secondary" style="margin-top:12px;color:var(--danger)" id="btn-clear">Очистить данные</button>` : ''}
      </div>
    `;

    if (DB.data.imports.length) {
      document.getElementById('btn-clear').onclick = async () => {
        DB.data = { imports: [], rails: [], links: [], plans: {} };
        await DB.save(); UI.toast('Данные удалены'); App.route('home');
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
        DB.data.imports.unshift(data); // Сохраняем в историю
        await DB.save();
        UI.toast(data.valid ? 'Успешно загружено!' : 'Внимание: расхождение в суммах!', data.valid ? 'default' : 'error');
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
// Привязываем к window, чтобы onclick работали
window.App = App; 
window.UI = UI;

DB.init().then(() => {
  App.init();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
