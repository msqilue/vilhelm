/* ===== 统计页逻辑 ===== */
(function () {
initPage('stats.html').then(renderStats);

const RARITY = { t25: 'SSS', t26: 'SSR', t27: 'SR', t28: 'MR', t29: 'R' };

function barHtml(label, count, max, total) {
  const pct = total
    ? Math.round(count / total * 100)
    : (max ? Math.round(count / max * 100) : 0);
  const fillW = Math.max(pct, total ? 4 : 0);
  const tip = total ? count + '/' + total + ' · ' + pct + '%' : String(count);
  return `<div class="bar-row" data-tip="${tip}">
    <span class="bar-label">${escapeHtml(label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${fillW}%"></span></span>
    <span class="bar-val">${total ? count + '/' + total : count}</span>
  </div>`;
}

function parseYear(s) {
  if (!s) return '';
  const m = String(s).match(/(\d{4})/);
  return m ? m[1] : '';
}

async function renderStats() {
  const events = DATA.events;
  const cards = document.getElementById('stat-cards');

  // 全量清单基准（data/stats-base.json）：稀有度/篇章显示基准总数 + 基准后新增事件数
  let base = { rarity: {}, chapter: {}, baselineEvents: [] };
  try {
    const r = await fetch('data/stats-base.json?v=' + (window.DATA_VERSION || ''));
    if (r.ok) base = await r.json();
  } catch (e) { /* 无基准文件时退化为仅站点数据 */ }
  const baseSet = new Set(base.baselineEvents || []);
  const added = events.filter(e => !baseSet.has(e.id));

  // 基础卡片
  const totalImages = events.reduce((s, e) => s + (e.images || []).length, 0);
  const totalAudios = events.reduce((s, e) => s + (e.audios || []).length, 0);
  let localLikes = 0;
  events.forEach(e => { if (isLiked(e.id)) localLikes++; });

  // 派生口径：典藏卡片数（有卡面+语音+稀有度标签，多段语音拆条，与典藏页一致）
  const galleryCards = (window.MP && MP.cards) || [];
  // 语音条目数：有 voices 按段数，无 voices 但有语音素材算 1
  const voiceItems = events.reduce((s, e) => {
    if ((e.voices || []).length) return s + e.voices.length;
    return s + ((e.audios || []).length ? 1 : 0);
  }, 0);

  cards.innerHTML = [
    { n: events.length, l: '事件总数' },
    ...DATA.timelines.map(t => ({ n: events.filter(e => e.timelineId === t.id).length, l: t.name })),
    { n: galleryCards.length, l: '典藏卡片' },
    { n: voiceItems, l: '语音条目' },
    { n: totalImages, l: '图片素材' },
    { n: totalAudios, l: '语音素材' },
    { n: localLikes, l: '我的点赞' }
  ].map(s => `<div class="stat-card"><div class="stat-num">${s.n}</div><div class="stat-label">${escapeHtml(s.l)}</div></div>`).join('');

  // 分布条形：稀有度 + 篇章 + 年份
  const bars = document.getElementById('stat-bars');

  // 稀有度分布：进度条按「已收录/总量」展示
  const rarityRows = ['SSS', 'SSR', 'SR', 'MR', 'R'].map(r => {
    const owned = events.filter(e => (e.tags || []).some(t => RARITY[t] === r)).length;
    return {
      label: r,
      count: owned,
      total: (base.rarity[r] || 0) + added.filter(e => (e.tags || []).some(t => RARITY[t] === r)).length
    };
  });

  // 篇章分布：进度条按「已收录/总量」展示
  const stateCat = DATA.categories.find(c => c.id === 'state');
  const chapterRows = [];
  if (stateCat) {
    stateCat.tags.forEach(t => {
      const owned = events.filter(e => (e.tags || []).includes(t.id)).length;
      const total = (base.chapter[t.name] || 0) + added.filter(e => (e.tags || []).includes(t.id)).length;
      if (total > 0) chapterRows.push({ label: t.name, count: owned, total });
    });
  }

  // 年份分布（官方全量基准 + 基准后新增，倒序；口径：SSS/SSR/SR/MR 有语音卡面事件，R 卡无语音不参与）
  const yearMap = {};
  events.forEach(e => {
    const y = parseYear(e.date);
    if (y) yearMap[y] = (yearMap[y] || 0) + 1;
  });
  const YEAR_TOTAL = base.year || {};
  const yearSet = new Set([...Object.keys(YEAR_TOTAL), ...Object.keys(yearMap)]);
  const yearRows = [...yearSet].sort((a, b) => b - a).map(y => ({
    label: y + '年',
    count: yearMap[y] || 0,
    total: (YEAR_TOTAL[y] || 0) + added.filter(e => parseYear(e.date) === y).length
  }));

  bars.innerHTML = `
    <div class="stat-card">
      <h3 class="serif" style="font-size:1.1rem;margin-bottom:12px;">稀有度分布</h3>
      ${rarityRows.map(r => barHtml(r.label, r.count, 0, r.total)).join('')}
    </div>
    <div class="stat-card">
      <h3 class="serif" style="font-size:1.1rem;margin-bottom:12px;">篇章分布</h3>
      ${chapterRows.length ? chapterRows.map(r => barHtml(r.label, r.count, 0, r.total)).join('') : '<p style="color:var(--muted);font-size:.88rem;">暂无数据</p>'}
    </div>
    <div class="stat-card">
      <h3 class="serif" style="font-size:1.1rem;margin-bottom:12px;">年份分布</h3>
      ${yearRows.length ? yearRows.map(r => barHtml(r.label, r.count, 0, r.total)).join('') : '<p style="color:var(--muted);font-size:.88rem;">暂无数据</p>'}
    </div>`;

  // 悬停提示：跟随鼠标显示在右下方
  let tip = document.getElementById('bar-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'bar-tip';
    tip.className = 'bar-tip';
    document.body.appendChild(tip);
  }
  document.querySelectorAll('.bar-row').forEach(row => {
    row.addEventListener('mousemove', ev => {
      tip.textContent = row.getAttribute('data-tip') || '';
      tip.style.opacity = '1';
      const pad = 14, gap = 16;
      const r = tip.getBoundingClientRect();
      let x = ev.clientX + pad;
      let y = ev.clientY + gap;
      if (x + r.width > window.innerWidth - 6) x = ev.clientX - r.width - pad;
      if (y + r.height > window.innerHeight - 6) y = ev.clientY - r.height - 6;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    });
    row.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
  });
}
})();
