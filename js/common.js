/* ===== 莫弈·Vilhelm — 公共脚本 ===== */
const DATA = {
  site: null,
  timelines: [],
  categories: [],
  events: []
};

const SITE_ROOT = document.baseURI.replace(/[^/]*$/, '');

/* 资源/数据版本号：修改 HTML/CSS/JS/data 后递增，避免浏览器使用旧缓存 */
const DATA_VERSION='20261005c24';

async function loadData() {
  if (DATA.site) return DATA;
  const [s, t, g, e] = await Promise.all([
    fetch('data/site.json?v=' + DATA_VERSION).then(r => r.json()),
    fetch('data/timelines.json?v=' + DATA_VERSION).then(r => r.json()),
    fetch('data/tags.json?v=' + DATA_VERSION).then(r => r.json()),
    fetch('data/events.json?v=' + DATA_VERSION).then(r => r.json())
  ]);
  DATA.site = s;
  DATA.timelines = t.timelines || [];
  DATA.categories = g.categories || [];
  DATA.events = e.events || [];
  /* 合并浏览器本地「待入库事件」（添加事件页直接添加的），带 pending 标记；
     与正式数据同 id 时跳过（正式版优先），避免重复显示 */
  try {
    const pend = JSON.parse(localStorage.getItem('vilhelm:pendingEvents') || '[]');
    if (Array.isArray(pend) && pend.length) {
      const ids = new Set(DATA.events.map(e => e.id));
      DATA.events = DATA.events.concat(
        pend.map(p => p.event).filter(Boolean)
          .filter(ev => !ids.has(ev.id))
          .map(ev => Object.assign({ pending: true }, ev))
      );
    }
  } catch (err) { /* 本地存储不可用则忽略 */ }
  return DATA;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 事件展示排序：按剧情顺序倒序（最新在前） */
/* 解析 "2026.9.27" 这类日期为可比较数值；无日期返回 0 */
function parseEvDate(s) {
  if (!s) return 0;
  const m = String(s).match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  return m ? (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]) : 0;
}

function sortEvents(list) {
  return [...list].sort((a, b) => {
    const da = parseEvDate(a.date), db = parseEvDate(b.date);
    if (da && db) return db - da;            // 有日期：按日期倒序（最新在上）
    if (da) return -1;                        // 有日期的排前面
    if (db) return 1;
    return (b.order - a.order) || (a.createdAt < b.createdAt ? 1 : -1);
  });
}

function getTimeline(id) {
  return DATA.timelines.find(t => t.id === id) || null;
}

function tagById(id) {
  for (const c of DATA.categories) {
    const t = c.tags.find(x => x.id === id);
    if (t) return { ...t, categoryName: c.name };
  }
  return null;
}

function eventTags(event) {
  return (event.tags || []).map(tagById).filter(Boolean);
}

function mainTagOf(event) {
  const id = event.mainTag;
  if (!id) return null;
  return tagById(id) || null;
}

function importanceLabel(v) {
  return { normal: '', key: '关键', milestone: '里程碑' }[v] || '';
}

/* ===== 背景图 + 自动取色 ===== */
const BG_KEY = 'vilhelm:bg';
const OVERLAY_KEY = 'vilhelm:overlay';

function getStoredBg() {
  try { return localStorage.getItem(BG_KEY) || ''; } catch (e) { return ''; }
}
function storeBg(src) {
  try { localStorage.setItem(BG_KEY, src); } catch (e) { /* 忽略 */ }
}
function getStoredOverlay() {
  try {
    const v = parseFloat(localStorage.getItem(OVERLAY_KEY));
    return Number.isFinite(v) ? v : null;
  } catch (e) { return null; }
}
function storeOverlay(v) {
  try { localStorage.setItem(OVERLAY_KEY, String(v)); } catch (e) { /* 忽略 */ }
}

const BG = {
  overlay: null,
  current: '',
  defaultSrc: '',
  _accentRGB: '',
  _dark: true,
  _autoA: 0,

  /* 设置遮罩层（dark：主色暗渐变；light：白色轻纱渐变，提升深色文字可读性） */
  _setOverlay(accentRGB, a, dark) {
    if (!this.overlay) return;
    let bg;
    if (dark) {
      bg = `linear-gradient(180deg, rgba(${accentRGB},${(a * 0.55).toFixed(2)}) 0%, ` +
           `rgba(${accentRGB},${(a * 0.8).toFixed(2)}) 55%, ` +
           `rgba(${accentRGB},${a.toFixed(2)}) 100%)`;
    } else {
      // 浅色主题：白色轻纱遮罩，压淡背景图案但不降低亮度，深色文字更清晰
      const w = Math.min(0.85, Math.max(0.18, a));
      bg = `linear-gradient(180deg, rgba(255,255,255,${(w * 1.15).toFixed(2)}) 0%, ` +
           `rgba(255,255,255,${(w * 1.3).toFixed(2)}) 55%, ` +
           `rgba(255,255,255,${w.toFixed(2)}) 100%)`;
    }
    this.overlay.style.background = bg;
  },

  /* 应用背景图：src 为空时按优先级取「用户已选背景 → 全局配置背景」 */
  async apply(src) {
    const cfg = DATA.site.background || {};
    if (cfg.enabled === false) return;
    const stored = getStoredBg();
    const target = src || stored || cfg.image || '';
    if (!target) return;
    if (target === this.current) return;
    this.current = target;

    document.body.style.backgroundImage = `url('${target}')`;
    document.body.style.backgroundColor = 'var(--bg-base)';

    if (cfg.autoExtract !== false) {
      try {
        const img = await loadImage(target);
        const c = extractPalette(img);
        // 按背景亮度自动切换主题：暗背景 → 浅色文字；亮背景 → 深色文字
        const dark = c.brightness <= 0.5;
        this._dark = dark;
        document.body.classList.toggle('theme-light', !dark);

        this._accentRGB = `${c.r},${c.g},${c.b}`;
        document.body.style.setProperty('--bg-accent', `rgb(${this._accentRGB})`);

        // 遮罩强度：用户手动值优先，否则自动（暗 0.45~0.85；亮 0.28~0.52）
        const lo = cfg.overlayMin ?? 0.45;
        const hi = cfg.overlayMax ?? 0.85;
        let a;
        if (dark) {
          a = Math.min(hi, Math.max(lo, lo + c.brightness * (hi - lo)));
        } else {
          a = 0.28 + (1 - c.brightness) * 0.24;
        }
        const manual = getStoredOverlay();
        if (manual != null) a = manual;
        this._autoA = a;

        this._setOverlay(this._accentRGB, a, dark);
      } catch (e) {
        /* 取色失败：保留默认主题与遮罩 */
      }
    }
  },

  /* 用户主动把某张图设为背景：记住选择并立即应用（背景路径不写死，可动态更换） */
  async setBg(src) {
    if (!src) return;
    storeBg(src);
    this.current = '';           // 强制重新应用
    await this.apply(src);
  }
};

/* ===== 右上角「设置」：右侧抽屉（背景：遮罩滑块 + 恢复默认背景） ===== */
let bgCtlEl = null;
function renderBgControl() {
  if (bgCtlEl) return;
  bgCtlEl = document.createElement('div');
  bgCtlEl.className = 'bg-ctl';
  bgCtlEl.innerHTML = `
    <button class="bg-ctl-toggle" title="设置">设置<span class="bg-ctl-arrow">▸</span></button>
    <div class="bg-backdrop"></div>
    <div class="bg-drawer">
      <button class="bg-drawer-close" title="关闭">✕</button>
      <div class="bg-ctl-title">背景</div>
      <div class="bg-ctl-row"><span class="bg-ctl-label">遮罩强度</span><span class="bg-ctl-val"></span></div>
      <input class="bg-ctl-range" type="range" min="10" max="90" step="5">
      <button class="bg-ctl-reset">恢复默认背景</button>
    </div>`;
  document.body.appendChild(bgCtlEl);

  const drawer = bgCtlEl.querySelector('.bg-drawer');
  const backdrop = bgCtlEl.querySelector('.bg-backdrop');
  const range = bgCtlEl.querySelector('.bg-ctl-range');
  const valEl = bgCtlEl.querySelector('.bg-ctl-val');
  const reset = bgCtlEl.querySelector('.bg-ctl-reset');
  const toggle = bgCtlEl.querySelector('.bg-ctl-toggle');
  const closeBtn = bgCtlEl.querySelector('.bg-drawer-close');
  const arrow = bgCtlEl.querySelector('.bg-ctl-arrow');

  const open = () => { drawer.classList.add('open'); backdrop.classList.add('open'); toggle.classList.add('on'); arrow.classList.add('rot'); };
  const close = () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); toggle.classList.remove('on'); arrow.classList.remove('rot'); };

  const syncRange = () => {
    const manual = getStoredOverlay();
    const init = Math.round((manual != null ? manual : BG._autoA) * 100);
    range.value = Math.max(10, Math.min(90, init));
    valEl.textContent = range.value + '%';
  };

  // 点击按钮打开/关闭抽屉；点遮罩或 ✕ 关闭
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    drawer.classList.contains('open') ? close() : open();
  });
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  range.addEventListener('input', () => {
    const v = parseInt(range.value, 10) / 100;
    storeOverlay(v);
    valEl.textContent = range.value + '%';
    BG._setOverlay(BG._accentRGB || '20,16,32', v, BG._dark);
  });
  reset.addEventListener('click', () => {
    try { localStorage.removeItem(BG_KEY); localStorage.removeItem(OVERLAY_KEY); } catch (e) { /* 忽略 */ }
    location.reload();
  });

  syncRange();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed: ' + src));
    img.src = src;
  });
}

/* 从图片提取主色（量化统计）与亮度 */
function extractPalette(img) {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // 第一遍：跳过过暗像素（黑色背景不参与主色），统计亮度
  const freq = new Map();
  let sumL = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    sumL += L; n++;
  }
  const avgBright = n ? sumL / n / 255 : 0.5;

  // 第二遍：仅用「非过暗」像素统计主色（暗图时取有色彩的区域）
  const lightEnough = n && avgBright < 0.45 ? 34 : 20; // 图越暗，跳过阈值越低
  const freq2 = new Map();
  let n2 = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    if (L < lightEnough) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    freq2.set(key, (freq2.get(key) || 0) + 1);
    n2++;
  }

  let best = 0, bestKey = 0;
  const pool = (n2 >= 4) ? freq2 : freq; // 整图过暗时回退全像素
  pool.forEach((cnt, k) => { if (cnt > best) { best = cnt; bestKey = k; } });
  return {
    r: ((bestKey >> 8) & 0xF) * 16 + 8,
    g: ((bestKey >> 4) & 0xF) * 16 + 8,
    b: (bestKey & 0xF) * 16 + 8,
    brightness: avgBright
  };
}

/* 页头 / 页脚渲染 */
function currentPage() {
  return location.pathname.split('/').pop() || 'index.html';
}

function renderHeader(active) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const pages = [
    ['index.html', '首页'],
    ['profile.html', '人物'],
    ['timeline.html', '时间线'],
    ['gallery.html', '典藏'],
    ['stats.html', '统计'],
    ['changelog.html', '日志'],
    ['about.html', '关于']
  ];
  nav.innerHTML = pages.map(([href, label]) =>
    `<a href="${href}" class="${href === active ? 'active' : ''}">${label}</a>`
  ).join('');
  const brand = document.getElementById('brand');
  if (brand && DATA.site) brand.textContent = DATA.site.siteName;
}

function renderFooter() {
  const foot = document.getElementById('footer-text');
  if (foot && DATA.site) {
    foot.innerHTML = `${escapeHtml(DATA.site.siteName)} · ${escapeHtml(DATA.site.siteSubtitle)}<br>
      <span style="color:var(--muted)">${escapeHtml(DATA.site.fanDeclaration)}</span>`;
  }
  const admin = document.getElementById('admin-link');
  if (admin) {
    admin.innerHTML = '管理';
    admin.href = 'admin.html';
  }
}

/* 灯箱（全站共用） */
let lightboxEl = null;
function ensureLightbox() {
  if (!lightboxEl) {
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'lightbox';
    lightboxEl.innerHTML = '<img alt=""><button class="lightbox-setbg" title="将这张图设为页面背景">设为背景</button><span class="lightbox-close">&times;</span>';
    lightboxEl.addEventListener('click', e => {
      if (e.target === lightboxEl || e.target.classList.contains('lightbox-close')) closeLightbox();
    });
    // 灯箱内「设为背景」
    lightboxEl.querySelector('.lightbox-setbg').addEventListener('click', e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const src = lightboxEl._src;
      if (!src) return;
      BG.setBg(src).then(() => {
        btn.textContent = '已设为背景 ✓';
        btn.classList.add('done');
        setTimeout(() => { btn.textContent = '设为背景'; btn.classList.remove('done'); }, 1600);
      });
    });
    document.body.appendChild(lightboxEl);
  }
  return lightboxEl;
}
function openLightbox(src) {
  const lb = ensureLightbox();
  lb._src = src;
  lb.querySelector('img').src = src;
  lb.classList.add('open');
  document.addEventListener('keydown', onLbKey);
}
function closeLightbox() {
  if (lightboxEl) lightboxEl.classList.remove('open');
  document.removeEventListener('keydown', onLbKey);
}
function onLbKey(e) {
  if (e.key === 'Escape') closeLightbox();
}

/* 点赞（localStorage） */
function likeKey(id) { return 'vilhelm:like:' + id; }
function isLiked(id) { return localStorage.getItem(likeKey(id)) === '1'; }
function toggleLike(id) {
  const k = likeKey(id);
  if (isLiked(id)) { localStorage.removeItem(k); return false; }
  localStorage.setItem(k, '1'); return true;
}

/* 初始化：加载数据 + 页头页脚 + 背景图 */
async function initPage(active) {
  await loadData();
  renderHeader(active);
  renderFooter();
  document.title = DATA.site.siteName;

  // 遮罩层
  if (!BG.overlay) {
    BG.overlay = document.createElement('div');
    BG.overlay.className = 'bg-overlay';
    document.body.insertBefore(BG.overlay, document.body.firstChild);
  }
  // 全局背景图（自动取色）
  BG.defaultSrc = (DATA.site.background || {}).image || '';
  await BG.apply('');
  renderBgControl();

  // 全局迷你播放器：全站共享，切页/新开页面持续播放
  if (window.MP) window.MP.init();
}

/* ===== 全局迷你播放器（全站共享：跨页面/新开标签持续播放） ===== */
(function () {
  const MP_KEY = 'vilhelm:mp';
  const RARITY = { t25: 'SSS', t26: 'SSR', t27: 'SR', t28: 'MR', t29: 'R' };
  const st = { key: null, mode: 'order', queue: [], playing: false, open: false, dragging: false };
  let cards = [];
  let audio = null;
  let mpEl = null;
  let inited = false;

  function buildCards() {
    const byTag = {};
    DATA.categories.forEach(c => (c.tags || []).forEach(t => { byTag[t.id] = t.name; }));
    const out = [];
    DATA.events.forEach(e => {
      const imgs = e.images || [], auds = e.audios || [];
      const tags = e.tags || [];
      const rid = tags.find(t => RARITY[t]);
      if (!rid) return;
      const tagNames = tags.filter(t => !RARITY[t]).map(t => byTag[t]).filter(Boolean);
      const mainTag = byTag[e.mainTag];
      const sub = (e.subtitle || '').trim() || mainTag || tagNames[0] || '';
      const push = (name, img, audioSrc, subTxt) => {
        out.push({
          key: e.id + '::' + name, id: e.id, name, rarity: RARITY[rid], sub: subTxt,
          tags: tagNames, date: e.date || '', img, audio: audioSrc, dur: ''
        });
      };
      if ((e.voices || []).length) e.voices.forEach(v => push(e.title + '-' + v.title, v.image, v.audio, sub));
      if (!imgs.length || !auds.length) return;
      push(e.title, imgs[0], auds[0], sub);
    });
    out.sort((a, b) => (parseDateNum(b.date) - parseDateNum(a.date)) || 0);
    return out;
  }
  function parseDateNum(s) {
    if (!s) return 0;
    const m = String(s).match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : 0;
  }
  function cardByKey(k) { return cards.find(c => c.key === k) || null; }

  function save() {
    try {
      localStorage.setItem(MP_KEY, JSON.stringify({
        key: st.key, t: audio && audio.currentTime ? audio.currentTime : 0,
        mode: st.mode, queue: st.queue, playing: st.playing
      }));
    } catch (e) { /* 忽略 */ }
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(MP_KEY)) || null; } catch (e) { return null; }
  }

  function updateUI() {
    if (!mpEl) return;
    const cur = st.key ? cardByKey(st.key) : null;
    if (!cur) { mpEl.classList.remove('show'); return; }
    document.getElementById('mp-cover').src = cur.img;
    document.getElementById('mp-name').textContent = cur.name;
    document.getElementById('mp-sub').textContent = cur.sub + ' · ' + cur.rarity;
    const t = document.getElementById('mp-toggle');
    t.textContent = audio.paused ? '▶' : '❚❚';
    t.classList.toggle('playing', !audio.paused);
    // 模式图标
    const mb = document.getElementById('mp-mode');
    mb.querySelector('.ic-order').style.display = st.mode === 'random' ? 'none' : 'block';
    mb.querySelector('.ic-random').style.display = st.mode === 'random' ? 'block' : 'none';
    mb.title = st.mode === 'random' ? '随机播放' : '顺序播放';
    mb.classList.toggle('on', st.mode === 'random');
    // 播放列表
    const wrap = document.getElementById('mp-pl-wrap');
    if (!st.queue.length) {
      wrap.innerHTML = '<div class="mp-pl-empty">播放列表为空 · 从上方卡片/列表点击可重新加入</div>';
    } else {
      wrap.innerHTML = `
        <div class="mp-pl-title">播放列表（${st.queue.length}）</div>
        <div class="mp-pl-items">
          ${st.queue.map((k, i) => {
            const it = cardByKey(k);
            if (!it) return '';
            return `<div class="mp-pl-item ${st.key === k ? 'playing' : ''}" data-key="${escapeHtml(k)}">
              <span class="mp-pl-idx">${st.key === k ? '♪' : String(i + 1).padStart(2, '0')}</span>
              <span class="mp-pl-name">${escapeHtml(it.name)}</span>
              <span class="mp-pl-dur">${it.dur || ''}</span>
              <button class="mp-pl-del" data-key="${escapeHtml(k)}" title="从本次循环删除">×</button>
            </div>`;
          }).join('')}
        </div>`;
    }
    mpEl.classList.add('show');
    document.dispatchEvent(new CustomEvent('mpchange'));
  }

  function playKey(k) {
    const c = cardByKey(k);
    if (!c) return;
    if (st.key === k && !audio.paused) { audio.pause(); st.playing = false; updateUI(); save(); return; }
    st.key = k;
    if (!st.queue.includes(k)) st.queue.push(k);
    audio.src = c.audio;
    audio.play().then(() => { st.playing = true; updateUI(); save(); })
      .catch(() => { st.playing = false; updateUI(); save(); });
  }
  /* 以整组列表作为播放队列（如典藏页当前筛选的全部卡片），从 startKey 开始播放 */
  function playAll(keys, startKey) {
    const q = (keys || []).filter(k => cardByKey(k));
    if (!q.length) return;
    const start = q.includes(startKey) ? startKey : q[0];
    st.queue = q;
    st.key = start;
    const c = cardByKey(start);
    audio.src = c.audio;
    audio.play().then(() => { st.playing = true; updateUI(); save(); })
      .catch(() => { st.playing = false; updateUI(); save(); });
  }

  function toggle() {
    if (!st.key) return;
    if (audio.paused) {
      audio.play().then(() => { st.playing = true; updateUI(); save(); }).catch(() => {});
    } else { audio.pause(); st.playing = false; updateUI(); save(); }
  }
  function nextTrack() {
    const q = st.queue;
    if (!q.length || !st.key) return;
    const pos = q.indexOf(st.key);
    let nk;
    if (st.mode === 'random' && q.length > 1) {
      let r; do { r = Math.floor(Math.random() * q.length); } while (r === pos);
      nk = q[r];
    } else { nk = q[(pos + 1) % q.length]; }
    playKey(nk);
  }
  function prevTrack() {
    const q = st.queue;
    if (!q.length || !st.key) return;
    const pos = q.indexOf(st.key);
    playKey(q[(pos - 1 + q.length) % q.length]);
  }
  function close() {
    audio.pause(); audio.currentTime = 0;
    st.key = null; st.playing = false; st.queue = [];
    save(); updateUI();
  }

  function init() {
    if (inited) return;
    inited = true;
    cards = buildCards();
    audio = new Audio();
    audio.loop = false;
    audio.addEventListener('ended', () => nextTrack());

    // 注入播放器 DOM（所有页面共用）
    mpEl = document.createElement('div');
    mpEl.className = 'mini-player';
    mpEl.id = 'mini-player';
    mpEl.innerHTML = `
      <div class="mp-dragbar" id="mp-dragbar"></div>
      <div class="mp-pl-wrap" id="mp-pl-wrap"></div>
      <div class="mp-body">
        <div class="mp-coverwrap">
          <img class="mp-cover" id="mp-cover" alt="">
          <button class="mp-list-tab" id="mp-list-tab" title="播放列表">
            <svg class="tab-ic ic-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>
            <svg class="tab-ic ic-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M6 10l6 6 6-6"/></svg>
          </button>
        </div>
        <div class="mp-info">
          <div class="mp-name" id="mp-name"></div>
          <div class="mp-sub" id="mp-sub"></div>
        </div>
        <div class="mp-ctrl">
          <button class="mp-btn" id="mp-prev" title="上一首">⏮</button>
          <button class="mp-btn mp-play" id="mp-toggle" title="播放/停止">▶</button>
          <button class="mp-btn" id="mp-next" title="下一首">⏭</button>
        </div>
        <div class="mp-mode">
          <button class="mp-mode-btn" id="mp-mode" title="顺序播放">
            <svg class="mp-mode-ic ic-order" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-4 4"/><path d="M21 7H8a4 4 0 0 0-4 4"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h13a4 4 0 0 0 4-4"/></svg>
            <svg class="mp-mode-ic ic-random" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
          </button>
        </div>
        <button class="mp-close" id="mp-close" title="关闭">×</button>
      </div>`;
    document.body.appendChild(mpEl);

    // 事件绑定
    document.getElementById('mp-toggle').addEventListener('click', toggle);
    document.getElementById('mp-next').addEventListener('click', () => { if (st.key) nextTrack(); });
    document.getElementById('mp-prev').addEventListener('click', () => { if (st.key) prevTrack(); });
    document.getElementById('mp-close').addEventListener('click', close);
    document.getElementById('mp-mode').addEventListener('click', () => {
      st.mode = st.mode === 'random' ? 'order' : 'random';
      updateUI(); save();
    });
    const mpTab = document.getElementById('mp-list-tab');
    const mpWrap = document.getElementById('mp-pl-wrap');
    mpTab.addEventListener('click', () => {
      st.open = !mpWrap.classList.contains('open');
      mpWrap.classList.toggle('open', st.open);
      mpTab.classList.toggle('open', st.open);
      mpTab.querySelector('.ic-up').style.display = st.open ? 'none' : 'block';
      mpTab.querySelector('.ic-down').style.display = st.open ? 'block' : 'none';
      if (getComputedStyle(mpEl).bottom === 'auto' && mpEl.style.top) {
        const delta = st.open ? 275 : -275;
        mpEl.style.top = (parseFloat(mpEl.style.top) - delta) + 'px';
      }
    });
    mpWrap.addEventListener('click', e => {
      const del = e.target.closest('.mp-pl-del');
      if (del) {
        const k = del.dataset.key;
        const pos = st.queue.indexOf(k);
        if (pos >= 0) st.queue.splice(pos, 1);
        if (st.key === k) { /* 删除当前播放项后切到队列下一项或暂停 */ }
        updateUI(); save();
        return;
      }
      const item = e.target.closest('.mp-pl-item');
      if (item) playKey(item.dataset.key);
    });
    // 拖拽
    const dragbar = document.getElementById('mp-dragbar');
    dragbar.addEventListener('mousedown', e => {
      st.dragging = true;
      mpEl._dx = e.clientX - mpEl.getBoundingClientRect().left;
      mpEl._dy = e.clientY - mpEl.getBoundingClientRect().top;
      mpEl.style.transition = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!st.dragging) return;
      const x = e.clientX - mpEl._dx, y = e.clientY - mpEl._dy;
      const r = mpEl.getBoundingClientRect();
      mpEl.style.left = Math.min(Math.max(0, x), window.innerWidth - r.width) + 'px';
      mpEl.style.top = Math.min(Math.max(0, y), window.innerHeight - r.height) + 'px';
      mpEl.style.right = 'auto'; mpEl.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (st.dragging) { st.dragging = false; mpEl.style.transition = ''; }
    });

    // 跨页续播：离开页面时保存进度；新页面加载时恢复
    const persist = () => save();
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    window.addEventListener('pagehide', persist);

    const saved = loadSaved();
    if (saved && saved.key && cardByKey(saved.key)) {
      st.key = saved.key;
      st.mode = saved.mode || 'order';
      st.queue = Array.isArray(saved.queue) ? saved.queue.filter(k => cardByKey(k)) : [];
      const c = cardByKey(saved.key);
      audio.src = c.audio;
      // 等音频元数据加载后再跳转到保存的进度
      if (saved.t) {
        audio.addEventListener('loadedmetadata', () => {
          try { if (saved.t && Math.abs(audio.currentTime - saved.t) > 0.5) audio.currentTime = saved.t; } catch (e) { /* 忽略 */ }
        }, { once: true });
      }
      if (saved.playing) {
        audio.play().then(() => { st.playing = true; updateUI(); save(); })
          .catch(() => { st.playing = false; updateUI(); save(); });
      } else {
        st.playing = false;
        updateUI();
      }
    }
  }

  window.MP = {
    state: st,
    play: playKey,
    playAll,
    toggle,
    next: nextTrack,
    prev: prevTrack,
    close,
    init,
    get playingKey() { return st.key; }
  };
  Object.defineProperty(window.MP, 'cards', { get: () => cards });
})();
