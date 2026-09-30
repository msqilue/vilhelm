/* ===== 管理端 admin.js：事件 / 标签 / 时间线 动态维护 + 导出 JSON ===== */
const AKEY = 'vilhelm:admin-state';
const deep = o => JSON.parse(JSON.stringify(o));
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let A = null;            // 编辑状态 {site, timelines, categories, events}

initPage('admin.html').then(() => { A = initAdmin(); });

function loadState() {
  try {
    const raw = localStorage.getItem(AKEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 忽略 */ }
  return null;
}
function saveState() {
  try {
    localStorage.setItem(AKEY, JSON.stringify({ site: A.site, timelines: A.timelines, categories: A.categories, events: A.events }));
  } catch (e) { /* 忽略 */ }
}
function updateStateNote() {
  const hasLocal = (() => { try { return !!localStorage.getItem(AKEY); } catch (e) { return false; } })();
  $('#admin-state').textContent = hasLocal
    ? '当前为「本地编辑版本」（已自动保存到本浏览器），导出后替换 data/ 目录即生效；点「重置」可回到仓库数据'
    : '当前为仓库数据版本，编辑后自动进入本地编辑模式';
}

/* ---------- 初始化 ---------- */
function initAdmin() {
  A = {
    site: deep(DATA.site),
    timelines: deep(DATA.timelines),
    categories: deep(DATA.categories),
    events: deep(DATA.events)
  };
  const st = loadState();
  if (st && st.events) Object.assign(A, st);

  // Tab 切换
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      ['events', 'tags', 'timelines'].forEach(p => $('#panel-' + p).hidden = (p !== btn.dataset.tab));
    });
  });

  $('#btn-export').addEventListener('click', exportJson);
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('确认重置？当前本地编辑将丢弃，回到仓库数据。')) return;
    try { localStorage.removeItem(AKEY); } catch (e) { /* 忽略 */ }
    location.reload();
  });

  renderEvents();
  renderTags();
  renderTimelines();
  updateStateNote();
  return A;
}

/* ---------- 通用：标签展平 ---------- */
function allTags() {
  const out = [];
  (A.categories || []).forEach(c => (c.tags || []).forEach(t => out.push(t)));
  return out;
}
function tagName(id) {
  const t = allTags().find(x => x.id === id);
  return t ? t.name : id;
}

/* ---------- 事件管理 ---------- */
let editingEventId = null;

function renderEvents() {
  const panel = $('#panel-events');
  panel.innerHTML = `
    <div class="admin-block">
      <h3>编辑事件</h3>
      <form class="admin-form" id="ev-form">
        <div>
          <label>事件 ID（建议 {时间线}-{章节}-{序号}）</label>
          <input type="text" id="f-id" placeholder="如 growth-生日-1">
        </div>
        <div>
          <label>所属时间线</label>
          <select id="f-timeline">${A.timelines.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
        </div>
        <div>
          <label>标题</label>
          <input type="text" id="f-title">
        </div>
        <div>
          <label>章节 / 阶段</label>
          <input type="text" id="f-stage" placeholder="如 生日 / 序章">
        </div>
        <div>
          <label>日期（展示用，如 2026.9.27）</label>
          <input type="text" id="f-date">
        </div>
        <div>
          <label>排序 order（同线内数字，大在前）</label>
          <input type="number" id="f-order" step="1">
        </div>
        <div>
          <label>重要度</label>
          <select id="f-importance">
            <option value="key">关键 key</option>
            <option value="milestone">里程碑 milestone</option>
            <option value="normal">普通</option>
          </select>
        </div>
        <div>
          <label>台词（quote，可空）</label>
          <input type="text" id="f-quote">
        </div>
        <div>
          <label>角色（逗号分隔）</label>
          <input type="text" id="f-characters" placeholder="莫弈">
        </div>
        <div class="full">
          <label>正文 content（\n 换行）</label>
          <textarea id="f-content"></textarea>
        </div>
        <div class="full">
          <label>图片路径（每行一条，如 assets/images/moyi/growth/生日-20260927-1.jpg）</label>
          <textarea id="f-images"></textarea>
        </div>
        <div class="full">
          <label>语音路径（每行一条）</label>
          <textarea id="f-audios"></textarea>
        </div>
        <div>
          <label>事件级背景图（可空）</label>
          <input type="text" id="f-bgimage" placeholder="assets/images/moyi/xxx.jpg">
        </div>
        <div class="full">
          <label>标签（多选）</label>
          <div class="admin-tags-pick" id="f-tags">${allTags().map(t => `<label data-tid="${esc(t.id)}"><input type="checkbox" value="${esc(t.id)}">${esc(t.name)}</label>`).join('')}</div>
        </div>
        <div class="full" style="display:flex;gap:10px">
          <button type="button" class="admin-btn primary" id="btn-save-ev">保存事件</button>
          <button type="button" class="admin-btn" id="btn-new-ev">新建事件（清空表单）</button>
          <span class="admin-state" id="ev-form-state"></span>
        </div>
      </form>
    </div>
    <div class="admin-block">
      <h3>事件列表（${A.events.length}）</h3>
      <div class="admin-list" id="ev-list">
        ${A.events.map(ev => `
          <div class="admin-item" data-id="${esc(ev.id)}">
            <div class="grow">
              <strong>${esc(ev.title)}</strong>
              <span style="opacity:.75;font-size:.82rem"> · ${esc(A.timelines.find(t => t.id === ev.timelineId)?.name || ev.timelineId)} · ${esc(ev.date || '')} · ${esc(ev.id)}</span>
            </div>
            <button class="admin-btn" data-act="edit">编辑</button>
            <button class="admin-btn danger" data-act="del">删除</button>
          </div>`).join('')}
      </div>
    </div>`;

  // 列表操作
  $('#ev-list').querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.admin-item').dataset.id;
      const ev = A.events.find(x => x.id === id);
      if (!ev) return;
      if (btn.dataset.act === 'edit') fillEventForm(ev);
      if (btn.dataset.act === 'del' && confirm('删除事件：' + ev.title + '？')) {
        A.events = A.events.filter(x => x.id !== id);
        saveState(); renderEvents(); updateStateNote();
      }
    });
  });

  $('#btn-save-ev').addEventListener('click', saveEventForm);
  $('#btn-new-ev').addEventListener('click', () => {
    editingEventId = null;
    fillEventForm({
      id: '', timelineId: A.timelines[0]?.id || '', title: '', content: '', stage: '',
      date: '', order: A.events.length + 1, images: [], audios: [], quote: '',
      characters: ['莫弈'], recordDate: '', importance: 'key', bgImage: '', tags: [],
      createdAt: new Date().toISOString()
    });
    $('#ev-form-state').textContent = '新建模式：填写后点「保存事件」';
  });
}

function fillEventForm(ev) {
  editingEventId = ev.id || null;
  $('#f-id').value = ev.id || '';
  $('#f-timeline').value = ev.timelineId || '';
  $('#f-title').value = ev.title || '';
  $('#f-stage').value = ev.stage || '';
  $('#f-date').value = ev.date || '';
  $('#f-order').value = ev.order != null ? ev.order : '';
  $('#f-importance').value = ev.importance || 'key';
  $('#f-quote').value = ev.quote || '';
  $('#f-characters').value = (ev.characters || []).join(',');
  $('#f-content').value = ev.content || '';
  $('#f-images').value = (ev.images || []).join('\n');
  $('#f-audios').value = (ev.audios || []).join('\n');
  $('#f-bgimage').value = ev.bgImage || '';
  document.querySelectorAll('#f-tags input[type=checkbox]').forEach(cb => {
    cb.checked = (ev.tags || []).includes(cb.value);
    cb.closest('label').classList.toggle('checked', cb.checked);
  });
  $('#ev-form-state').textContent = '正在编辑：' + (ev.id || '新事件');
}

function saveEventForm() {
  const id = $('#f-id').value.trim();
  if (!id) { alert('请填写事件 ID'); return; }
  const tl = $('#f-timeline').value;
  const tags = [...document.querySelectorAll('#f-tags input[type=checkbox]:checked')].map(cb => cb.value);
  const ev = {
    id,
    timelineId: tl,
    title: $('#f-title').value.trim() || '未命名',
    content: $('#f-content').value,
    stage: $('#f-stage').value.trim(),
    date: $('#f-date').value.trim(),
    order: parseInt($('#f-order').value, 10) || 0,
    images: $('#f-images').value.split('\n').map(s => s.trim()).filter(Boolean),
    audios: $('#f-audios').value.split('\n').map(s => s.trim()).filter(Boolean),
    quote: $('#f-quote').value.trim(),
    characters: $('#f-characters').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
    recordDate: '',
    importance: $('#f-importance').value,
    bgImage: $('#f-bgimage').value.trim(),
    tags,
    createdAt: A.events.find(x => x.id === editingEventId)?.createdAt || new Date().toISOString()
  };
  if (editingEventId) {
    const i = A.events.findIndex(x => x.id === editingEventId);
    if (i >= 0) A.events[i] = ev;
  } else {
    A.events.push(ev);
  }
  saveState(); renderEvents(); updateStateNote();
  fillEventForm(ev);
}

/* ---------- 标签管理 ---------- */
function renderTags() {
  const panel = $('#panel-tags');
  panel.innerHTML = (A.categories || []).map((cat, ci) => `
    <div class="admin-block">
      <h3>
        <input type="text" value="${esc(cat.name)}" style="width:auto" data-cat-name="${ci}" title="分类名">
        <span style="opacity:.7;font-size:.8rem">（${esc(cat.id)}）</span>
      </h3>
      <div class="admin-list">
        ${(cat.tags || []).map((t, ti) => `
          <div class="admin-item" data-ci="${ci}" data-ti="${ti}">
            <input type="text" class="t-name" value="${esc(t.name)}" placeholder="标签名">
            <input type="text" class="t-id" value="${esc(t.id)}" placeholder="id 如 t12">
            <input type="color" class="t-color" value="${esc(t.color || '#8A93A6')}">
            <button class="admin-btn danger" data-act="del-tag">删除</button>
          </div>`).join('')}
      </div>
      <button class="admin-btn" data-act="add-tag" data-ci="${ci}">+ 添加标签</button>
    </div>`).join('') +
    `<button class="admin-btn" data-act="add-cat">+ 添加分类</button>`;

  // 分类名编辑
  panel.querySelectorAll('[data-cat-name]').forEach(inp => {
    inp.addEventListener('change', () => {
      A.categories[+inp.dataset.catName].name = inp.value.trim();
      saveState(); updateStateNote();
    });
  });
  // 标签字段编辑
  panel.querySelectorAll('.admin-item').forEach(item => {
    const ci = +item.dataset.ci, ti = +item.dataset.ti;
    const t = A.categories[ci].tags[ti];
    item.querySelector('.t-name').addEventListener('change', e => { t.name = e.target.value.trim(); saveState(); updateStateNote(); });
    item.querySelector('.t-id').addEventListener('change', e => { t.id = e.target.value.trim(); saveState(); updateStateNote(); });
    item.querySelector('.t-color').addEventListener('input', e => { t.color = e.target.value; saveState(); });
    item.querySelector('[data-act="del-tag"]').addEventListener('click', () => {
      if (!confirm('删除标签：' + t.name + '？')) return;
      A.categories[ci].tags.splice(ti, 1);
      saveState(); renderTags(); updateStateNote();
    });
  });
  // 添加标签 / 分类
  panel.querySelectorAll('[data-act="add-tag"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = +btn.dataset.ci;
      A.categories[ci].tags.push({ id: 't' + Date.now().toString().slice(-5), name: '新标签', color: '#8A93A6' });
      saveState(); renderTags(); updateStateNote();
    });
  });
  panel.querySelector('[data-act="add-cat"]').addEventListener('click', () => {
    A.categories.push({ id: 'cat' + Date.now().toString().slice(-5), name: '新分类', tags: [{ id: 't' + Date.now().toString().slice(-6), name: '新标签', color: '#8A93A6' }] });
    saveState(); renderTags(); updateStateNote();
  });
}

/* ---------- 时间线管理 ---------- */
function renderTimelines() {
  const panel = $('#panel-timelines');
  panel.innerHTML = `
    <div class="admin-block">
      <h3>时间线（注意：事件数据按 timelineId 引用，删除前请确认无事件使用）</h3>
      <div class="admin-list">
        ${A.timelines.map((t, i) => `
          <div class="admin-item" data-i="${i}">
            <input type="text" class="tl-id" value="${esc(t.id)}" placeholder="id 如 main">
            <input type="text" class="tl-name" value="${esc(t.name)}" placeholder="名称如 主线剧情线">
            <input type="text" class="tl-desc" value="${esc(t.desc || '')}" placeholder="描述">
            <button class="admin-btn danger" data-act="del-tl">删除</button>
          </div>`).join('')}
      </div>
      <button class="admin-btn" data-act="add-tl">+ 添加时间线</button>
    </div>`;

  panel.querySelectorAll('.admin-item').forEach(item => {
    const i = +item.dataset.i;
    const t = A.timelines[i];
    item.querySelector('.tl-id').addEventListener('change', e => { t.id = e.target.value.trim(); saveState(); updateStateNote(); });
    item.querySelector('.tl-name').addEventListener('change', e => { t.name = e.target.value.trim(); saveState(); updateStateNote(); });
    item.querySelector('.tl-desc').addEventListener('change', e => { t.desc = e.target.value.trim(); saveState(); updateStateNote(); });
    item.querySelector('[data-act="del-tl"]').addEventListener('click', () => {
      const used = A.events.filter(ev => ev.timelineId === t.id).length;
      if (used > 0) { alert('该时间线下还有 ' + used + ' 个事件，请先删除或移动事件'); return; }
      if (!confirm('删除时间线：' + t.name + '？')) return;
      A.timelines.splice(i, 1);
      saveState(); renderTimelines(); updateStateNote();
    });
  });
  panel.querySelector('[data-act="add-tl"]').addEventListener('click', () => {
    A.timelines.push({ id: 'line' + Date.now().toString().slice(-5), name: '新时间线', desc: '' });
    saveState(); renderTimelines(); updateStateNote();
  });
}

/* ---------- 导出 JSON ---------- */
function exportJson() {
  const files = {
    'site.json': { ...A.site },
    'timelines.json': { timelines: A.timelines },
    'tags.json': { categories: A.categories },
    'events.json': { events: A.events }
  };
  const names = Object.keys(files);
  names.forEach(name => {
    const blob = new Blob([JSON.stringify(files[name], null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  alert('已导出 ' + names.join('、') + '，请将这四个文件替换项目 data/ 目录下的同名文件，再 git push 即全站生效。');
}
