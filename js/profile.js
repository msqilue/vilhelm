/* ===== 人物介绍页逻辑 ===== */
(function () {
initPage('profile.html').then(async () => {
  const pf = await fetch('data/profile.json?v=' + DATA_VERSION).then(r => r.json());
  const c = pf.character;
  if (!c) return;

  document.title = c.name + ' · ' + (DATA.site ? DATA.site.siteName : 'Vilhelm');

  /* Hero：背景图（沿用全局背景机制取色）+ 名字 + 角色语 */
  const hero = document.getElementById('pf-hero');
  document.getElementById('pf-name').textContent = c.name;
  document.getElementById('pf-en').textContent = c.enName || '';
  document.getElementById('pf-quote').textContent = c.roleQuote || '';

  /* 背景图：优先角色专属 heroImage，否则沿用全局背景 */
  const heroImg = c.heroImage || (DATA.site.background && DATA.site.background.image) || '';
  if (heroImg) {
    hero.style.backgroundImage = `url("${heroImg}")`;
    hero.classList.add('has-bg');
    BG.apply(heroImg);
  }

  /* 基本信息卡 */
  const info = (c.info || []).map(i =>
    `<div class="pf-info-item"><span class="pf-info-label">${escapeHtml(i.label)}</span><span class="pf-info-value">${escapeHtml(i.value)}</span></div>`
  ).join('');
  document.getElementById('pf-info').innerHTML = info;

  /* 简介 */
  document.getElementById('pf-intro').textContent = c.intro || '';
  const story = (c.story || []).map(s => `<p>${escapeHtml(s)}</p>`).join('');
  document.getElementById('pf-story').innerHTML = story;

  /* 性格特征 */
  document.getElementById('pf-traits').innerHTML = (c.traits || []).map(t =>
    `<span class="tag-chip ev-tag" style="border-color:var(--accent);color:var(--accent)">${escapeHtml(t)}</span>`
  ).join('');

  /* 经典片段 */
  document.getElementById('pf-quotes').innerHTML = (c.quotes || []).map(q =>
    `<div class="quote-card"><div class="quote-mark">❝</div><div class="quote-text">${escapeHtml(q)}</div></div>`
  ).join('');

  /* 相关事件：个人成长线的生日事件（SR/MR/R 走语音卡版式） */
  const evs = DATA.events.filter(e => e.timelineId === 'growth');
  document.getElementById('pf-events').innerHTML = evs.map(e => {
    const voice = (e.tags || []).some(t => ['t27', 't28', 't29'].includes(t));
    const href = (voice ? 'event-voice.html' : 'event.html') + '?id=' + encodeURIComponent(e.id);
    return `<a class="pf-event-chip" href="${href}">${escapeHtml(e.title)} · ${escapeHtml(e.date || '')}</a>`;
  }).join('');

  document.getElementById('pf-note').textContent = c.note || '';
});
})();
