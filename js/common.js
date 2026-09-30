/* ===== 莫弈·Vilhelm — 公共脚本 ===== */
const DATA = {
  site: null,
  timelines: [],
  categories: [],
  events: []
};

const SITE_ROOT = document.baseURI.replace(/[^/]*$/, '');

async function loadData() {
  if (DATA.site) return DATA;
  const [s, t, g, e] = await Promise.all([
    fetch('data/site.json').then(r => r.json()),
    fetch('data/timelines.json').then(r => r.json()),
    fetch('data/tags.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json())
  ]);
  DATA.site = s;
  DATA.timelines = t.timelines || [];
  DATA.categories = g.categories || [];
  DATA.events = e.events || [];
  return DATA;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sortEvents(list) {
  return [...list].sort((a, b) => (a.order - b.order) || (a.createdAt < b.createdAt ? -1 : 1));
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

function importanceLabel(v) {
  return { normal: '', key: '关键', milestone: '里程碑' }[v] || '';
}

/* 页头 / 页脚渲染 */
function currentPage() {
  const p = location.pathname.split('/').pop() || 'index.html';
  return p;
}

function renderHeader(active) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const pages = [
    ['index.html', '首页'],
    ['timeline.html', '时间线'],
    ['stats.html', '统计'],
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
    lightboxEl.innerHTML = '<img alt=""><span class="lightbox-close">&times;</span>';
    lightboxEl.addEventListener('click', e => {
      if (e.target === lightboxEl || e.target.classList.contains('lightbox-close')) closeLightbox();
    });
    document.body.appendChild(lightboxEl);
  }
  return lightboxEl;
}
function openLightbox(src) {
  const lb = ensureLightbox();
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

/* 初始化：加载数据 + 页头页脚 */
async function initPage(active) {
  await loadData();
  renderHeader(active);
  renderFooter();
  document.title = DATA.site.siteName;
}
