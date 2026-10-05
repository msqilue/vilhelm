/* ===== 时间线页逻辑 ===== */
// 记住上次选中的时间线 + 标签筛选，从事件页返回时恢复（localStorage）
const savedTl = localStorage.getItem('vilhelm:tlFilter');
let savedTags = [];
try { savedTags = JSON.parse(localStorage.getItem('vilhelm:tlTags') || '[]') || []; } catch (e) { savedTags = []; }
const state = {
  timeline: savedTl || 'all',      // 'all' 或时间线 id
  tags: new Set(savedTags),      // 选中的标签 id（跨类别 AND、同类别 OR）
  keyword: '',
  page: 1
};

initPage('timeline.html').then(renderAll);

function renderAll() {
  // 清理已失效的标签 id（时间线/标签被删除时）
  const valid = new Set(DATA.categories.flatMap(c => (c.tags || []).map(t => t.id)));
  let dirty = false;
  [...state.tags].forEach(id => { if (!valid.has(id)) { state.tags.delete(id); dirty = true; } });
  if (dirty) saveTags();
  state.page = 1;
  renderSwitch();
  renderFilter();
  renderTimeline();
}

function saveTags() {
  localStorage.setItem('vilhelm:tlTags', JSON.stringify([...state.tags]));
}

/* 时间线切换器 */
function renderSwitch() {
  const el = document.getElementById('tl-switch');
  const items = [{ id: 'all', name: '全部' }, ...DATA.timelines];
  el.innerHTML = items.map(t =>
    `<span class="chip ${state.timeline === t.id ? 'on' : ''}" data-tl="${t.id}">${escapeHtml(t.name)}</span>`
  ).join('');
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.timeline = chip.dataset.tl;
      localStorage.setItem('vilhelm:tlFilter', state.timeline);
      renderAll();
    });
  });
}

/* 筛选面板：四类别 → 标签多选（稀有度组置顶） */
function renderFilter() {
  const el = document.getElementById('filter-panel');
  if (!DATA.categories.length) { el.innerHTML = ''; return; }
  const cats = [DATA.categories.find(c => c.name === '稀有度'), ...DATA.categories.filter(c => c.name !== '稀有度')].filter(Boolean);
  el.innerHTML = cats.map(c => {
    const tags = c.tags.map(t =>
      `<span class="tag-chip ${state.tags.has(t.id) ? 'on' : ''}" data-tag="${t.id}" style="${t.color && !state.tags.has(t.id) ? 'border-color:' + t.color + ';' : ''}">${escapeHtml(t.name)}</span>`
    ).join('');
    return `<div class="filter-group"><h4>${escapeHtml(c.name)}</h4><div class="filter-tags">${tags}</div></div>`;
  }).join('') +
    `<div class="filter-summary">已选 ${state.tags.size} 个标签 <a href="#" id="clear-filter">清除</a></div>`;

  el.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.tag;
      if (state.tags.has(id)) state.tags.delete(id); else state.tags.add(id);
      saveTags();
      renderAll();
    });
  });
  const clear = el.querySelector('#clear-filter');
  if (clear) clear.addEventListener('click', e => {
    e.preventDefault();
    state.tags.clear();
    saveTags();
    renderAll();
  });
}

/* 过滤 + 排序（倒序：最新在前） */
function visibleEvents() {
  let list = DATA.events.filter(ev => {
    if (state.timeline !== 'all' && ev.timelineId !== state.timeline) return false;
    // 标签：跨类别 AND、同类别 OR
    for (const c of DATA.categories) {
      const selected = [...state.tags].filter(tid => c.tags.some(t => t.id === tid));
      if (selected.length && !selected.some(tid => (ev.tags || []).includes(tid))) return false;
    }
    if (state.keyword) {
      const kw = state.keyword.toLowerCase();
      const hay = [ev.title, ev.content, ev.quote, ev.stage, ...(ev.characters || []), ...eventTags(ev).map(t => t.name)].join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  return sortEvents(list);
}

/* 跳转详情页时携带当前筛选（时间线 + 标签），供事件页按筛选后的顺序导航；
   SR/MR/R（稀有度 t27/t28/t29）事件走语音卡版式 event-voice.html */
function detailHref(id) {
  const ev = DATA.events.find(e => e.id === id);
  const isVoice = ev && (ev.tags || []).some(t => ['t27', 't28', 't29'].includes(t));
  let url = (isVoice ? 'event-voice.html' : 'event.html') + '?id=' + encodeURIComponent(id);
  if (state.timeline && state.timeline !== 'all') url += '&tl=' + encodeURIComponent(state.timeline);
  if (state.tags.size) url += '&tags=' + [...state.tags].join(',');
  return url;
}

/* 时间轴 A：左右交替式渲染（点击卡片 → 跳转独立详情页） */
function cardTagHtml(ev) {
  const main = mainTagOf(ev);
  if (main) return `<span class="main-tag" style="color:${main.color};border-color:${main.color}">${escapeHtml(main.name)}</span>`;
  const et = eventTags(ev);
  const chapter = et.find(t => t.categoryName === '篇章');
  const rare = et.find(t => ['t25', 't26', 't27', 't28', 't29'].includes(t.id));
  return [chapter, rare].filter(Boolean)
    .map(t => `<span class="main-tag" style="color:${t.color};border-color:${t.color}">${escapeHtml(t.name)}</span>`).join('');
}
function renderTimeline() {
  const el = document.getElementById('timeline');
  const all = visibleEvents();
  const pager = document.getElementById('tl-pager');
  if (!all.length) {
    el.innerHTML = `<p class="empty-tip">没有符合条件的事件。</p>`;
    if (pager) pager.style.display = 'none';
    return;
  }
  const total = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (state.page > total) state.page = total;
  const start = (state.page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  el.innerHTML = list.map((ev, i) => {
    const tl = getTimeline(ev.timelineId);
    const imp = ev.importance || 'normal';
    const excerpt = (ev.content || '').split('\n').filter(Boolean).join(' ').slice(0, 60);
    const thumb = (ev.images && ev.images.length) ? ev.images[0] : null;
    const side = (i % 2 === 0) ? 'left' : 'right';
    return `
      <div class="tl-row ${side}" data-id="${ev.id}">
        <span class="node importance-${imp}"></span>
        <article class="event-card tl-card" data-href="${detailHref(ev.id)}">
          ${thumb ? `<div class="card-media"><img src="${escapeHtml(thumb)}" alt="" loading="lazy"></div>` : ''}
          <div class="card-body">
            <div class="event-meta">
              ${ev.subtitle ? `<span class="event-subtitle">『${escapeHtml(ev.subtitle)}』</span>` : (tl ? `<span>${escapeHtml(tl.name)}</span>` : '')}
              ${cardTagHtml(ev)}
              ${ev.stage ? `<span>${escapeHtml(ev.stage)}</span>` : ''}
              ${ev.date ? `<span>${escapeHtml(ev.date)}</span>` : ''}
              ${imp !== 'normal' ? `<span class="badge ${imp === 'milestone' ? 'badge-milestone' : ''}">${importanceLabel(imp)}</span>` : ''}
            </div>
            <h3 class="event-title">${escapeHtml(ev.title)}${ev.pending ? ' <span class="badge badge-local">本地</span>' : ''}</h3>
            ${excerpt ? `<p class="event-excerpt">${escapeHtml(excerpt)}…</p>` : ''}
            <div class="card-foot">
              <span class="card-open">查看详情 →</span>
              <button class="like-btn" data-id="${ev.id}">点赞 ♡</button>
            </div>
          </div>
        </article>
      </div>`;
  }).join('');

  el.querySelectorAll('.event-card').forEach(card => {
    const id = card.dataset.href;
    card.addEventListener('click', e => {
      if (e.target.closest('.like-btn')) return;
      location.href = card.dataset.href;
    });
  });
  // 点赞（localStorage）
  el.querySelectorAll('.like-btn').forEach(btn => {
    const id = btn.dataset.id;
    const refresh = () => { btn.classList.toggle('on', isLiked(id)); btn.textContent = isLiked(id) ? '已赞 ♥' : '点赞 ♡'; };
    refresh();
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleLike(id);
      refresh();
    });
  });
  renderPager(all.length, total);
}

/* ===== 时间线分页（每页 5 条，复用日志页分页样式） ===== */
const PAGE_SIZE = 5;

function pageNums(current, total) {
  const set = new Set([1, total, current - 1, current, current + 1]);
  const nums = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

function renderPager(count, total) {
  const pager = document.getElementById('tl-pager');
  if (!pager) return;
  pager.innerHTML = `
    <button class="pg-btn" data-pg="prev" ${state.page <= 1 ? 'disabled' : ''}>‹ 上一页</button>
    ${pageNums(state.page, total).map(n => n === '…'
      ? `<span class="pg-ellipsis">…</span>`
      : `<button class="pg-num ${n === state.page ? 'on' : ''}" data-pg="${n}">${n}</button>`).join('')}
    <button class="pg-btn" data-pg="next" ${state.page >= total ? 'disabled' : ''}>下一页 ›</button>
    <span class="pg-info">共 ${count} 条 · 第 ${state.page}/${total} 页</span>
    <span class="pg-jump">第 <input class="pg-input" id="tl-pg-input" type="number" min="1" max="${total}" value="${state.page}"> 页
      <button class="pg-btn pg-go" id="tl-pg-go">跳转</button></span>`;
  pager.style.display = total > 1 ? 'flex' : 'none';
}

function goPage(p) {
  const total = Math.max(1, Math.ceil(visibleEvents().length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, p), total);
  renderTimeline();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const tlPager = document.getElementById('tl-pager');
if (tlPager) {
  tlPager.addEventListener('click', e => {
    const b = e.target.closest('[data-pg]');
    if (b) {
      const pg = b.dataset.pg;
      if (pg === 'prev') goPage(state.page - 1);
      else if (pg === 'next') goPage(state.page + 1);
      else goPage(+pg);
      return;
    }
    if (e.target.closest('#tl-pg-go')) {
      const input = document.getElementById('tl-pg-input');
      const v = input ? parseInt(input.value, 10) : NaN;
      if (!Number.isNaN(v)) goPage(v);
    }
  });
  tlPager.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'tl-pg-input') {
      const v = parseInt(e.target.value, 10);
      if (!Number.isNaN(v)) goPage(v);
    }
  });
}

/* 搜索防抖 */
const searchEl = document.getElementById('search');
searchEl.addEventListener('input', () => {
  clearTimeout(searchEl._t);
  searchEl._t = setTimeout(() => {
    state.keyword = searchEl.value.trim();
    state.page = 1;
    renderTimeline();
  }, 300);
});
