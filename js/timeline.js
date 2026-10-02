/* ===== 时间线页逻辑 ===== */
// 记住上次选中的时间线 + 标签筛选，从事件页返回时恢复（localStorage）
const savedTl = localStorage.getItem('vilhelm:tlFilter');
let savedTags = [];
try { savedTags = JSON.parse(localStorage.getItem('vilhelm:tlTags') || '[]') || []; } catch (e) { savedTags = []; }
const state = {
  timeline: savedTl || 'all',      // 'all' 或时间线 id
  tags: new Set(savedTags),      // 选中的标签 id（跨类别 AND、同类别 OR）
  keyword: ''
};

initPage('timeline.html').then(renderAll);

function renderAll() {
  // 清理已失效的标签 id（时间线/标签被删除时）
  const valid = new Set(DATA.categories.flatMap(c => (c.tags || []).map(t => t.id)));
  let dirty = false;
  [...state.tags].forEach(id => { if (!valid.has(id)) { state.tags.delete(id); dirty = true; } });
  if (dirty) saveTags();
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

/* 筛选面板：四类别 → 标签多选 */
function renderFilter() {
  const el = document.getElementById('filter-panel');
  if (!DATA.categories.length) { el.innerHTML = ''; return; }
  el.innerHTML = DATA.categories.map(c => {
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

/* 跳转详情页时携带当前筛选（时间线 + 标签），供事件页按筛选后的顺序导航 */
function detailHref(id) {
  let url = 'event.html?id=' + encodeURIComponent(id);
  if (state.timeline && state.timeline !== 'all') url += '&tl=' + encodeURIComponent(state.timeline);
  if (state.tags.size) url += '&tags=' + [...state.tags].join(',');
  return url;
}

/* 时间轴 A：左右交替式渲染（点击卡片 → 跳转独立详情页） */
function renderTimeline() {
  const el = document.getElementById('timeline');
  const list = visibleEvents();
  if (!list.length) {
    el.innerHTML = `<p class="empty-tip">没有符合条件的事件。</p>`;
    return;
  }
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
              ${mainTagOf(ev) ? `<span class="main-tag" style="color:${mainTagOf(ev).color};border-color:${mainTagOf(ev).color}">${escapeHtml(mainTagOf(ev).name)}</span>` : ''}
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
}

/* 搜索防抖 */
const searchEl = document.getElementById('search');
searchEl.addEventListener('input', () => {
  clearTimeout(searchEl._t);
  searchEl._t = setTimeout(() => {
    state.keyword = searchEl.value.trim();
    renderTimeline();
  }, 300);
});
