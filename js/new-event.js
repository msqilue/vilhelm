/* ===== 添加事件页面：人工填写 → 生成标准事件 JSON ===== */
initPage('new-event.html').then(() => {
  /* 时间线下拉 */
  const tlSel = document.getElementById('f-timeline');
  tlSel.innerHTML = (DATA.timelines || []).map(t =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
  /* 默认选中个人成长线 */
  const growthOpt = tlSel.querySelector('option[value="growth"]');
  if (growthOpt) growthOpt.selected = true;
  function currentTimeline() {
    return document.getElementById('f-timeline').value;
  }

  /* 标签多选（按分类分组） */
  const tagBox = document.getElementById('f-tags');
  tagBox.innerHTML = (DATA.categories || []).map(cat =>
    `<div class="admin-tagcat"><span class="admin-tagcat-name">${escapeHtml(cat.name)}</span>
      ${cat.tags.map(t =>
        `<label class="admin-tagcheck"><input type="checkbox" value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</label>`
      ).join('')}</div>`).join('');

  /* 动态行：引用 / 语音0 / 语音 / 图片 */
  const rowTpls = {
    quote: () => `<div class="admin-line">
      <textarea class="line-val" rows="2" placeholder="引用内容（多行用换行分隔）"></textarea>
      <button type="button" class="admin-btn small danger" data-act="del">✕</button></div>`,
    autoaudio: () => `<div class="admin-line">
      <input class="line-file" type="file" accept="audio/*">
      <span class="line-path" title="保存后请将文件放到此目录"></span>
      <button type="button" class="admin-btn small danger" data-act="del">✕</button></div>`,
    audio: () => `<div class="admin-line">
      <input class="line-file" type="file" accept="audio/*">
      <span class="line-path" title="保存后请将文件放到此目录"></span>
      <button type="button" class="admin-btn small danger" data-act="del">✕</button></div>`,
    image: () => `<div class="admin-line">
      <input class="line-file" type="file" accept="image/*">
      <span class="line-path" title="保存后请将文件放到此目录"></span>
      <button type="button" class="admin-btn small danger" data-act="del">✕</button></div>`
  };
  const lineKeys = ['quote', 'autoaudio', 'audio', 'image'];

  function addLine(kind) {
    const box = document.getElementById('f-' + (kind === 'autoaudio' ? 'autoaudio' : kind + 's'));
    const div = document.createElement('div');
    div.innerHTML = rowTpls[kind]();
    const line = div.firstElementChild;
    box.appendChild(line);
    const file = line.querySelector('.line-file');
    if (file) file.addEventListener('change', () => updateFilePath(line, kind));
  }
  lineKeys.forEach(kind => {
    document.querySelector(`[data-add="${kind}"]`).addEventListener('click', () => addLine(kind));
    /* 事件委托删除 */
  });

  document.querySelectorAll('.admin-lines').forEach(box => {
    box.addEventListener('click', e => {
      const btn = e.target.closest('[data-act="del"]');
      if (btn && btn.parentElement) btn.parentElement.remove();
    });
  });

  /* 文件选择后：按命名规则生成目标路径 */
  function updateFilePath(line, kind) {
    const file = line.querySelector('.line-file');
    const pathEl = line.querySelector('.line-path');
    if (!file.files || !file.files[0]) { pathEl.textContent = ''; return; }
    const title = document.getElementById('f-title').value.trim();
    const date = document.getElementById('f-date').value.trim();
    if (!title || !date) { pathEl.textContent = '（请先填写事件名称与日期）'; return; }
    const tl = currentTimeline();
    const dir = `assets/${kind === 'image' ? 'images' : 'audio'}/moyi/${tl}/${title}/`;
    const ext = (file.files[0].name.split('.').pop() || '').toLowerCase();
    const d = normalizeDate(date);
    let name = '';
    if (kind === 'autoaudio') name = `${title}-${d}-0.${ext}`;
    else if (kind === 'audio') {
      const n = line.parentElement.querySelectorAll('.admin-line').length;
      name = `${title}-${d}-${n}.${ext}`;
    } else {
      const n = line.parentElement.querySelectorAll('.admin-line').length;
      name = `${title}-${d}-${n}.${ext}`;
    }
    pathEl.textContent = dir + name;
    line.dataset.path = dir + name;
  }

  /* 日期规整：2026.9.27 → 20260927 */
  function normalizeDate(s) {
    const m = String(s).match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
    if (!m) return String(s).replace(/\D/g, '');
    return m[1] + String(m[2]).padStart(2, '0') + String(m[3]).padStart(2, '0');
  }

  /* 生成事件 JSON */
  document.getElementById('btn-gen').addEventListener('click', () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { alert('请填写事件名称'); return; }
    const subtitle = document.getElementById('f-subtitle').value.trim();
    const timelineId = currentTimeline();
    const date = document.getElementById('f-date').value.trim();
    const content = document.getElementById('f-content').value.trim();
    const tags = [...document.querySelectorAll('#f-tags input:checked')].map(i => i.value);
    const quotes = [...document.querySelectorAll('#f-quotes .line-val')]
      .map(t => t.value.trim()).filter(Boolean);

    const audioLines = [...document.querySelectorAll('#f-autoaudio .admin-line, #f-audios .admin-line')];
    const audios = audioLines.map(l => l.dataset.path).filter(Boolean);
    const images = [...document.querySelectorAll('#f-images .admin-line')]
      .map(l => l.dataset.path).filter(Boolean);

    const id = `${timelineId}-${title}-1`;
    const ev = {
      id,
      timelineId,
      title,
      subtitle,
      content,
      stage: '',
      date,
      order: 0,
      images,
      audios,
      quotes,
      characters: ['莫弈'],
      recordDate: '',
      importance: '',
      bgImage: '',
      tags,
      createdAt: new Date().toISOString()
    };

    const json = JSON.stringify(ev, null, 2);
    document.getElementById('ev-json').value = json;
    const note = [
      '① 素材请放到以下目录（未填的忽略）：',
      ...audios.map(a => '   ' + a),
      ...images.map(i => '   ' + i),
      '② 把上面 JSON 复制或下载后发给我，我会写入 data/events.json 并上线。'
    ].join('\n');
    document.getElementById('ev-path-note').textContent = note;
    document.getElementById('ev-result').hidden = false;
    document.getElementById('ev-result').scrollIntoView({ behavior: 'smooth' });
  });

  /* 复制 / 下载 */
  document.getElementById('btn-copy').addEventListener('click', () => {
    const ta = document.getElementById('ev-json');
    ta.select();
    try {
      navigator.clipboard.writeText(ta.value).then(() => alert('已复制 JSON，粘贴发我即可'));
    } catch (e) {
      document.execCommand('copy');
      alert('已复制 JSON（Ctrl+V 粘贴发我即可）');
    }
  });
  document.getElementById('btn-download').addEventListener('click', () => {
    const ta = document.getElementById('ev-json');
    const title = document.getElementById('f-title').value.trim() || 'event';
    const blob = new Blob([ta.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = title + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
});
