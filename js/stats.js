/* ===== 统计页逻辑 ===== */
initPage('stats.html').then(renderStats);

function barHtml(label, count, max, unit = '') {
  const pct = max ? Math.max(4, Math.round(count / max * 100)) : 0;
  return `<div class="bar-row">
    <span class="bar-label">${escapeHtml(label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
    <span class="bar-val">${count}${unit}</span>
  </div>`;
}

function renderStats() {
  const events = DATA.events;
  const cards = document.getElementById('stat-cards');

  // 基础卡片
  const totalImages = events.reduce((s, e) => s + (e.images || []).length, 0);
  const totalAudios = events.reduce((s, e) => s + (e.audios || []).length, 0);
  let localLikes = 0;
  events.forEach(e => { if (isLiked(e.id)) localLikes++; });

  cards.innerHTML = [
    { n: events.length, l: '事件总数' },
    ...DATA.timelines.map(t => ({ n: events.filter(e => e.timelineId === t.id).length, l: t.name })),
    { n: totalImages, l: '图片素材' },
    { n: totalAudios, l: '语音素材' },
    { n: localLikes, l: '我的点赞' }
  ].map(s => `<div class="stat-card"><div class="stat-num">${s.n}</div><div class="stat-label">${escapeHtml(s.l)}</div></div>`).join('');

  // 分布条形：成长阶段（按"角色状态"类别聚合）+ 事件类型分布 + 各时间线
  const bars = document.getElementById('stat-bars');

  const stateCat = DATA.categories.find(c => c.id === 'state');
  const stageRows = [];
  if (stateCat) {
    const max = 1;
    stateCat.tags.forEach(t => {
      stageRows.push({ label: t.name, count: events.filter(e => (e.tags || []).includes(t.id)).length });
    });
  }
  const maxStage = Math.max(1, ...stageRows.map(r => r.count));

  const tlRows = DATA.timelines.map(t => ({
    label: t.name,
    count: events.filter(e => e.timelineId === t.id).length
  }));
  const maxTl = Math.max(1, ...tlRows.map(r => r.count));

  bars.innerHTML = `
    <div class="stat-card">
      <h3 class="serif" style="font-size:1.1rem;margin-bottom:12px;">成长阶段分布</h3>
      ${stageRows.length ? stageRows.map(r => barHtml(r.label, r.count, maxStage)).join('') : '<p style="color:var(--muted);font-size:.88rem;">暂无数据</p>'}
    </div>
    <div class="stat-card">
      <h3 class="serif" style="font-size:1.1rem;margin-bottom:12px;">各时间线事件数</h3>
      ${tlRows.map(r => barHtml(r.label, r.count, maxTl)).join('')}
    </div>`;
}
