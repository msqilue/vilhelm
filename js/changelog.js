/* 更新日志页渲染 */
(function () {
  const els = {};
  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(entries) {
    const wrap = els.changelog;
    if (!entries || !entries.length) {
      wrap.innerHTML = '<div class="changelog-empty">暂无更新记录</div>';
      return;
    }
    wrap.innerHTML = entries.map(entry => {
      const items = Array.isArray(entry.items) ? entry.items : [entry.items];
      const lis = items.map(t => `<li>${escapeHtml(t)}</li>`).join('');
      return `<div class="changelog-item">
        <div class="changelog-ver">${escapeHtml(entry.date || '')}</div>
        <div class="changelog-body">
          <ul>${lis}</ul>
        </div>
      </div>`;
    }).join('');
  }

  initPage('changelog.html').then(async () => {
    els.changelog = $('changelog');
    try {
      const res = await fetch('data/changelog.json?v=' + DATA_VERSION, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      render(d.entries || []);
    } catch (err) {
      console.error('changelog load failed', err);
      els.changelog.innerHTML = '<div class="changelog-empty">日志数据加载失败，请刷新重试</div>';
    }
  });
})();
