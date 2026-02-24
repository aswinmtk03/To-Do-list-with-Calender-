/* ─── STATE ──────────────────────────────────────── */
let tasks = JSON.parse(localStorage.getItem('taskflow_tasks') || '[]');
let editingId = null;
let currentFilter = 'all';
let calendarDate = new Date();
let selectedDay = null;

/* ─── HELPERS ────────────────────────────────────── */
const $ = id => document.getElementById(id);
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function saveTasks() {
  localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function getCategory(t) { return t.category || 'other'; }
function getPriority(t) { return t.priority || 'medium'; }

/* ─── TABS ───────────────────────────────────────── */
function switchTab(tab) {
  ['tasks','calendar'].forEach(v => {
    $(`view-${v}`).classList.toggle('hidden', v !== tab);
    $(`btn-${v}`).classList.toggle('active', v === tab);
  });
  if (tab === 'calendar') renderCalendar();
}

/* ─── FILTER ─────────────────────────────────────── */
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

/* ─── MODAL ──────────────────────────────────────── */
function openModal(id) {
  $('modal-overlay').classList.add('open');
  if (id) {
    const t = tasks.find(x => x.id === id);
    editingId = id;
    $('modal-title').textContent = 'Edit Task';
    $('save-btn').textContent = 'Update Task';
    $('task-title').value = t.title;
    $('task-desc').value  = t.desc || '';
    $('task-date').value  = t.date || '';
    $('task-priority').value = t.priority;
    document.querySelector(`input[name="cat"][value="${t.category}"]`).checked = true;
  } else {
    editingId = null;
    $('modal-title').textContent = 'New Task';
    $('save-btn').textContent = 'Save Task';
    $('task-form').reset();
    document.querySelector(`input[name="cat"][value="personal"]`).checked = true;
    $('task-priority').value = 'medium';
  }
}

function closeModal(e) {
  if (e && e.target !== $('modal-overlay')) return;
  $('modal-overlay').classList.remove('open');
}

/* ─── SAVE TASK ──────────────────────────────────── */
function saveTask(e) {
  e.preventDefault();
  const title    = $('task-title').value.trim();
  const desc     = $('task-desc').value.trim();
  const date     = $('task-date').value;
  const priority = $('task-priority').value;
  const category = document.querySelector('input[name="cat"]:checked').value;

  if (!title) return;

  if (editingId) {
    const t = tasks.find(x => x.id === editingId);
    Object.assign(t, { title, desc, date, priority, category });
  } else {
    tasks.unshift({ id: uid(), title, desc, date, priority, category, done: false, createdAt: Date.now() });
  }

  saveTasks();
  $('modal-overlay').classList.remove('open');
  renderTasks();
  renderStats();
}

/* ─── DELETE TASK ────────────────────────────────── */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
  renderStats();
  if (selectedDay) showDayTasks(selectedDay);
}

/* ─── TOGGLE DONE ────────────────────────────────── */
function toggleDone(id) {
  const t = tasks.find(x => x.id === id);
  if (t) t.done = !t.done;
  saveTasks();
  renderTasks();
  renderStats();
  if (selectedDay) showDayTasks(selectedDay);
}

/* ─── RENDER TASKS ───────────────────────────────── */
function renderTasks() {
  const list = $('task-list');
  const emptyState = $('empty-state');

  const filtered = tasks.filter(t => currentFilter === 'all' || t.category === currentFilter);

  list.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    updateProgress(0, 0);
    return;
  }
  emptyState.style.display = 'none';

  filtered.forEach(t => {
    const isOverdue = t.date && t.date < today() && !t.done;
    const dateLabel = t.date
      ? `📅 ${formatDate(t.date)}${isOverdue ? ' (overdue)' : ''}`
      : '';

    const item = document.createElement('div');
    item.className = `task-item priority-${t.priority}${t.done ? ' done' : ''}`;
    item.innerHTML = `
      <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleDone('${t.id}')"></div>
      <div class="task-body">
        <div class="task-title">${escHtml(t.title)}</div>
        ${t.desc ? `<div class="task-desc">${escHtml(t.desc)}</div>` : ''}
        <div class="task-meta">
          <span class="tag tag-${t.category}">${catLabel(t.category)}</span>
          <span class="tag">${prioLabel(t.priority)}</span>
          ${dateLabel ? `<span class="tag-date ${isOverdue ? 'tag-overdue' : ''}">${dateLabel}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn" onclick="openModal('${t.id}')" title="Edit">✏️</button>
        <button class="action-btn del" onclick="deleteTask('${t.id}')" title="Delete">🗑️</button>
      </div>`;
    list.appendChild(item);
  });

  const done = filtered.filter(t => t.done).length;
  updateProgress(done, filtered.length);
}

function updateProgress(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  $('progress-fill').style.width = pct + '%';
  $('progress-pct').textContent  = pct + '%';
}

/* ─── RENDER STATS ───────────────────────────────── */
function renderStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const pending = total - done;
  $('stat-total').textContent   = total;
  $('stat-done').textContent    = done;
  $('stat-pending').textContent = pending;
}

/* ─── CALENDAR ───────────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  $('cal-month-label').textContent = `${MONTHS[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month+1, 0).getDate();
  const daysInPrevMo = new Date(year, month, 0).getDate();

  const container = $('calendar-days');
  container.innerHTML = '';

  const todayStr = today();

  // Fill in blanks from prev month
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMo - i;
    const cell = makeDayCell(year, month - 1, d, true, todayStr);
    container.appendChild(cell);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = makeDayCell(year, month, d, false, todayStr);
    container.appendChild(cell);
  }

  // Fill trailing days from next month
  const totalCells = container.children.length;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remainingCells; d++) {
    const cell = makeDayCell(year, month + 1, d, true, todayStr);
    container.appendChild(cell);
  }
}

function makeDayCell(year, month, day, isOther, todayStr) {
  // Normalise month overflow
  const d = new Date(year, month, day);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const tasksDue = tasks.filter(t => t.date === dateStr);

  const cell = document.createElement('div');
  cell.className = 'cal-day';
  if (isOther)      cell.classList.add('other-month');
  if (dateStr === todayStr) cell.classList.add('today');
  if (dateStr === selectedDay) cell.classList.add('selected');

  cell.innerHTML = `<span>${day}</span>`;

  // Dots for tasks
  if (tasksDue.length > 0) {
    const dotRow = document.createElement('div');
    dotRow.className = 'dot-row';
    const shown = tasksDue.slice(0, 3);
    shown.forEach(t => {
      const dot = document.createElement('div');
      dot.className = `dot dot-${t.priority}`;
      dotRow.appendChild(dot);
    });
    cell.appendChild(dotRow);
  }

  if (!isOther) {
    cell.onclick = () => {
      selectedDay = dateStr;
      // Update selected state
      document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      showDayTasks(dateStr);
    };
  }

  return cell;
}

function changeMonth(dir) {
  calendarDate.setMonth(calendarDate.getMonth() + dir);
  renderCalendar();
  if (selectedDay) showDayTasks(selectedDay);
}

function showDayTasks(dateStr) {
  const dayTasks = tasks.filter(t => t.date === dateStr);
  const title = $('day-tasks-title');
  const list  = $('day-task-list');

  const [y, m, dd] = dateStr.split('-');
  const label = new Date(+y, +m - 1, +dd).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  title.textContent = dayTasks.length === 0 ? `No tasks on ${label}` : `${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''} on ${label}`;
  title.style.color = '';

  list.innerHTML = '';
  dayTasks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'mini-task';
    const dotColor = t.priority === 'high' ? '#f87171' : t.priority === 'medium' ? '#fbbf24' : '#22d3a5';
    const badge = t.done
      ? `<span class="mini-badge" style="background:rgba(34,211,165,0.15);color:#22d3a5">Done</span>`
      : `<span class="mini-badge" style="background:rgba(251,191,36,0.15);color:#fbbf24">Pending</span>`;
    el.innerHTML = `
      <div class="mini-dot" style="background:${dotColor}"></div>
      <span class="mini-title ${t.done ? 'done-text' : ''}">${escHtml(t.title)}</span>
      ${badge}`;
    list.appendChild(el);
  });
}

/* ─── UTILS ──────────────────────────────────────── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  const [y, m, day] = d.split('-');
  return new Date(+y, +m-1, +day).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function catLabel(c) {
  return { work:'💼 Work', personal:'🏠 Personal', health:'💪 Health', other:'🌟 Other' }[c] || c;
}
function prioLabel(p) {
  return { high:'🔴 High', medium:'🟡 Medium', low:'🟢 Low' }[p] || p;
}

/* ─── INIT ───────────────────────────────────────── */
function init() {
  // Set today's date label
  $('today-date-label').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  // Pre-fill today in the date picker
  $('task-date').value = today();

  renderTasks();
  renderStats();

  // Keyboard shortcut: N to add task
  document.addEventListener('keydown', e => {
    if (e.key === 'n' && !$('modal-overlay').classList.contains('open') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      openModal();
    }
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
