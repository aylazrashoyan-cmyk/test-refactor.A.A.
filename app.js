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
  dbName: 'analitik_v4', storeName: 'data', data: null,
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
// 3. Parser (v4.0 — ИСПРАВЛЕНА МАТЕМАТИКА)
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

      // ВАЖНО: мы НЕ суммируем родителей. Сумма узла берётся из файла (row[4]).
      const node = {
        name, level, sum: toNum(row[4]), qty: toNum(row[3]), isItem: isItem(name),
        children: [], path: stack.length ? `${stack[stack.length - 1].path} > ${name}` : name,
        category: this.cat(stack.length ? stack[stack.length - 1].path : name),
        gender: this.gen(stack.length ? stack[stack.length - 1].path : name)
      };

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        roots.push(node);
      }
      if (!node.isItem) stack.push(node);
    });

    // ВАЛИДАЦИЯ: считаем только конечные листья (isItem === true).
    // НЕ берём промежуточные итоги — иначе двойной счёт.
    let leavesSum = 0;
    const collectLeaves = (nodes) => nodes.forEach(n => {
      if (n.isItem) leavesSum += n.sum;
      else if (n.children.length) collectLeaves(n.children);
    });
    collectLeaves(roots);

    const valid = Math.abs(leavesSum - controlSum) / (controlSum || 1) < 0.01;
    const errorMsg = valid ? '' : {
      leaves: Math.round(leavesSum),
      control: Math.round(controlSum)
    };

    return {
      roots, daysInPeriod, daysInMonth, totalSum: controlSum,
      leavesSum: Math.round(leavesSum), valid, errorMsg,
      date: new Date().toISOString(),
      filename
    };
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
        <div class="card empty-state">
          <h2>Нет данных</h2>
          <p>Загрузите выгрузку 1С, чтобы увидеть аналитику</p>
          <button class="btn btn-primary" onclick="App.route('settings')">Перейти в настройки</button>
        </div>`;
      return;
    }

    // План берём из настроек. Если нет — равен факту (не факт*1.1).
    const planKey = current.date.slice(0, 7);
    const plan = DB.data.plans[planKey] || current.totalSum;
    const planPct = plan > 0 ? Math.min(100, (current.totalSum / plan) * 100) : 0;

    // Прогноз только если дней >= 10 (иначе не врём)
    const showForecast = current.daysInPeriod >= 10;
    const forecast = showForecast
      ? Math.round((current.totalSum / current.daysInPeriod) * current.daysInMonth)
      : null;

    // КАТЕГОРИИ — берём ТОЛЬКО корневые папки (они уже содержат итог из файла)
    const cats = { 'Одежда': 0, 'Обувь': 0, 'Аксессуары': 0, 'Распродажа': 0 };
    current.roots.forEach(r => { if (cats[r.category] !== undefined) cats[r.category] += r.sum; });

    // ТОП-5 ПАПОК — только конечные не-item папки (без дублей)
    let tops = { 'М': [], 'Ж': [], 'Д': [], 'Аксессуары': [] };
    const collect = (nodes) => nodes.forEach(n => {
      if (n.isItem) return;
      const isLeafFolder = n.children.length === 0 || n.children.every(c => c.isItem);
      if (isLeafFolder) {
        if (n.category === 'Аксессуары') tops['Аксессуары'].push(n);
        else if (n.gender === 'М') tops['М'].push(n);
        else if (n.gender === 'Ж') tops['Ж'].push(n);
        else if (n.gender === 'Д') tops['Д'].push(n);
      } else {
        collect(n.children);
      }
    });
    collect(current.roots);
    Object.keys(tops).forEach(k => tops[k].sort((a, b) => b.sum - a.sum));

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
        <div style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.5);font-weight:500;">
          Прогноз на месяц: <span style="color:var(--accent);font-weight:700">${forecast.toLocaleString('ru-RU')} ₽</span>
        </div>` : `
        <div style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.4);font-weight:500;">
          Прогноз недоступен (мало данных: ${current.daysInPeriod} дн.)
        </div>`}
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

      <div class="card">
        <div class="card-title">Топ-5 папок</div>
        <div class="tabs">
          <div class="tab active" data-g="М" onclick="window.switchTop('М')">Мужской</div>
          <div class="tab" data-g="Ж" onclick="window.switchTop('Ж')">Женский</div>
          <div class="tab" data-g="Д" onclick="window.switchTop('Д')">Детский</div>
          <div class="tab" data-g="Аксессуары" onclick="window.switchTop('Аксессуары')">Аксесс.</div>
        </div>
        <div id="top-list"></div>
      </div>
    `;

    window.renderTop = (gender) => {
      const list = tops[gender] || [];
      if (!list.length) return `<div class="item-desc" style="padding:16px 0">Нет данных по этой категории</div>`;
      return list.slice(0, 5).map((item, i) => `
        <div class="list-item">
          <div>
            <div class="item-name">${i + 1}. ${item.name}</div>
            <div class="item-desc">${item.path.split(' > ').slice(-2).join(' · ')}</div>
          </div>
          <div class="item-val num ${item.sum < 0 ? 'neg' : ''}">${Math.round(item.sum).toLocaleString('ru-RU')} ₽</div>
        </div>
      `).join('');
    };

    window.switchTop = (g) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.g === g));
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
            Проверьте выгрузку из 1С и загрузите файл заново.
          </p>
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

    // Отделяем отрицательные и нулевые значения в группу Z
    const positive = folders.filter(f => f.sum > 0).sort((a, b) => b.sum - a.sum);
    const zeroOrNeg = folders.filter(f => f.sum <= 0);

    const total = positive.reduce((acc, f) => acc + f.sum, 0);
    let cum = 0;
    const a = [], b = [], c = [];
    positive.forEach(f => {
      cum += f.sum;
      if (cum <= total * 0.8) a.push(f);
      else if (cum <= total * 0.95) b.push(f);
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
          ${zeroOrNeg.length ? this.renderGroup('Группа Z (возвраты/нули)', zeroOrNeg, 'var(--warn)') : ''}
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
        </div>` : `<p style="color:var(--text-muted);font-size:14px;">Ограничений не найдено — все папки приносят достаточную выручку.</p>`}
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

  // --- РЕЙЛЫ (честная заглушка) ---
  rails(root) {
    root.innerHTML = `
      <div class="header"><h1 class="h1">Рейлы</h1></div>
      <div class="card empty-state">
        <h2>В разработке</h2>
        <p>Чтобы считать эффективность рейлов (₽/м), нужно загрузить карту рейлов и привязать к ним товары. Этот раздел появится в следующем обновлении.</p>
      </div>
    `;
  },

  // --- НАСТРОЙКИ ---
  settings(root) {
    const planKey = new Date().toISOString().slice(0, 7);
    const currentPlan = DB.data.plans[planKey] || '';

    root.innerHTML = `
      <div class="header"><h1 class="h1">Настройки</h1></div>

      <div class="card">
        <div class="card-title">План на месяц</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:500;">
          Введите плановую выручку на текущий месяц. Если не заполнить — план будет равен факту.
        </p>
        <input type="number" class="input" id="plan-input" placeholder="Например, 1000000" value="${currentPlan}">
        <button class="btn btn-primary" style="margin-top:12px" id="btn-save-plan">Сохранить план</button>
      </div>

      <div class="card">
        <div class="card-title">Данные 1С</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px;font-weight:500;">
          Загрузите .xlsx файл. Парсер определит иерархию по отступам и проверит сходимость.
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
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:20px;">Все загруженные отчёты и планы будут удалены. Это действие нельзя отменить.</p>
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
