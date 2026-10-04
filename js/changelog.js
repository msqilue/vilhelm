/* 更新日志页渲染（分页，每页 10 条） */
(function () {
  const els = {};
  function $(id) { return document.getElementById(id); }

  const PAGE_SIZE = 10;
  let state = { page: 1, entries: [] };

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pageItems() {
    const list = state.entries;
    const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > total) state.page = total;
    const start = (state.page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }

  function render() {
    const wrap = els.changelog;
    if (!state.entries.length) {
      wrap.innerHTML = '<div class="changelog-empty">暂无更新记录</div>';
      els.pager.style.display = 'none';
      return;
    }
    wrap.innerHTML = pageItems().map(entry => {
      const items = Array.isArray(entry.items) ? entry.items : [entry.items];
      const lis = items.map(t => `<li>${escapeHtml(t)}</li>`).join('');
      return `<div class="changelog-item">
        <div class="changelog-ver">
          <div class="cl-time">${escapeHtml(entry.date || '')}</div>
          <div class="cl-ver">${escapeHtml(entry.ver || '')}</div>
        </div>
        <div class="changelog-body">
          <ul>${lis}</ul>
        </div>
      </div>`;
    }).join('');
    renderPager();
  }

  /* 折叠页码：首尾恒显，当前页前后各1页，中间用 … 省略 */
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

  function renderPager() {
    const pager = els.pager;
    const list = state.entries;
    const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    pager.innerHTML = `
      <button class="pg-btn" data-pg="prev" ${state.page <= 1 ? 'disabled' : ''}>‹ 上一页</button>
      ${pageNums(state.page, total).map(n => n === '…'
        ? `<span class="pg-ellipsis">…</span>`
        : `<button class="pg-num ${n === state.page ? 'on' : ''}" data-pg="${n}">${n}</button>`).join('')}
      <button class="pg-btn" data-pg="next" ${state.page >= total ? 'disabled' : ''}>下一页 ›</button>
      <span class="pg-info">共 ${list.length} 条 · 第 ${state.page}/${total} 页</span>
      <span class="pg-jump">第 <input class="pg-input" id="pg-input" type="number" min="1" max="${total}" value="${state.page}"> 页</span>`;
    pager.style.display = total > 1 ? 'flex' : 'none';
  }

  function goPage(p) {
    const total = Math.max(1, Math.ceil(state.entries.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, p), total);
    render();
  }

  function jumpTo() {
    const input = $('pg-input');
    if (!input) return;
    const v = parseInt(input.value, 10);
    if (!v || Number.isNaN(v)) return;
    goPage(v);
  }

  initPage('changelog.html').then(async () => {
    els.changelog = $('changelog');
    els.pager = $('pager');
    try {
      const res = await fetch('data/changelog.json?v=' + DATA_VERSION, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      state.entries = d.entries || [];
      render();
      els.pager.addEventListener('click', e => {
        const b = e.target.closest('[data-pg]');
        if (!b) return;
        const pg = b.dataset.pg;
        if (pg === 'prev') goPage(state.page - 1);
        else if (pg === 'next') goPage(state.page + 1);
        else goPage(+pg);
      });
      els.pager.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.id === 'pg-input') jumpTo();
      });
      els.pager.addEventListener('blur', e => {
        if (e.target.id === 'pg-input') jumpTo();
      }, true);
    } catch (err) {
      console.error('changelog load failed', err);
      els.changelog.innerHTML = '<div class="changelog-empty">日志数据加载失败，请刷新重试</div>';
      els.pager.style.display = 'none';
    }
  });
})();
