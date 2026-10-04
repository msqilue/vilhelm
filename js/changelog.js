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

  function renderPager() {
    const pager = els.pager;
    const list = state.entries;
    const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    pager.innerHTML = `
      <button class="pg-btn" data-pg="prev" ${state.page <= 1 ? 'disabled' : ''}>‹ 上一页</button>
      ${Array.from({ length: total }, (_, k) => `<button class="pg-num ${k + 1 === state.page ? 'on' : ''}" data-pg="${k + 1}">${k + 1}</button>`).join('')}
      <button class="pg-btn" data-pg="next" ${state.page >= total ? 'disabled' : ''}>下一页 ›</button>
      <span class="pg-info">共 ${list.length} 条 · 第 ${state.page}/${total} 页</span>`;
    pager.style.display = total > 1 ? 'flex' : 'none';
  }

  function goPage(p) {
    const total = Math.max(1, Math.ceil(state.entries.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, p), total);
    render();
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
    } catch (err) {
      console.error('changelog load failed', err);
      els.changelog.innerHTML = '<div class="changelog-empty">日志数据加载失败，请刷新重试</div>';
      els.pager.style.display = 'none';
    }
  });
})();
