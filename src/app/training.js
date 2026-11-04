// Original first-request learning flow, originally authored for this project. No external runtime or copied interface.
const FIRST_STORAGE_KEY = 'barilo.ai-catalog.first-request.v1';
const firstData = D.firstRequest;
let L = {
  step: 1,
  task: 'quiz',
  subject: firstData?.example.subject || 'Физика',
  customSubject: '',
  grade: String(firstData?.example.grade || 7),
  topic: '',
  tool: 'alice',
  checks: [false, false, false],
  completed: false,
  draft: '',
  signature: '',
};
function firstSubject() {
  return L.subject === 'Другой предмет' ? L.customSubject.trim() : L.subject;
}
function firstFields() {
  return {
    subject: firstSubject() || firstData.example.subject,
    grade: L.grade || String(firstData.example.grade),
    topic: L.topic.trim() || firstData.example.topic,
  };
}
function applyFirstDefaults() {
  const fields = firstFields();
  if (!firstSubject()) {
    if (L.subject === 'Другой предмет') L.customSubject = fields.subject;
    else L.subject = fields.subject;
  }
  if (!L.grade) L.grade = fields.grade;
  if (!L.topic.trim()) L.topic = fields.topic;
}
function firstValid() {
  const fields = firstFields();
  return !!(
    fields.subject &&
    fields.topic &&
    Number.isInteger(Number(fields.grade)) &&
    Number(fields.grade) >= 1 &&
    Number(fields.grade) <= 11
  );
}
function firstFill(template) {
  const fields = firstFields();
  return template.replace(/\{(subject|grade|topic)\}/g, (_, key) => fields[key]);
}
function firstPrompt() {
  const task = firstData.tasks.find((t) => t.id === L.task) || firstData.tasks[0],
    signature = JSON.stringify([L.task, firstFields()]);
  if (signature !== L.signature) {
    L.signature = signature;
    L.draft = firstFill(task.template);
  }
  return L.draft;
}
function clearFirstCopyStatus(message = '') {
  for (const e of document.querySelectorAll(
    '#first-copy-status,#first-chat-copy-status,[data-first-copy-status]',
  ))
    e.textContent = '';
  for (const id of ['first-copy-status', 'first-chat-copy-status'])
    $('#' + id).textContent = message;
}
function saveFirst() {
  try {
    const { draft, signature, ...saved } = L;
    localStorage.setItem(FIRST_STORAGE_KEY, JSON.stringify(saved));
  } catch (_) {}
}
function loadFirst() {
  try {
    const p = JSON.parse(localStorage.getItem(FIRST_STORAGE_KEY) || '{}');
    if (!p || typeof p !== 'object') return;
    if (firstData.tasks.some((t) => t.id === p.task)) L.task = p.task;
    if (firstData.subjects.includes(p.subject)) L.subject = p.subject;
    L.customSubject = typeof p.customSubject === 'string' ? p.customSubject.slice(0, 80) : '';
    L.topic = typeof p.topic === 'string' ? p.topic.slice(0, 200) : '';
    if (Number.isInteger(Number(p.grade)) && Number(p.grade) >= 1 && Number(p.grade) <= 11)
      L.grade = String(Number(p.grade));
    if (firstData.tools.some((t) => t.id === p.tool)) L.tool = p.tool;
    L.checks = firstData.checks.map((_, i) => p.checks?.[i] === true);
    L.completed = p.completed === true && L.checks.every(Boolean);
    L.step = Number.isInteger(p.step) ? Math.max(1, Math.min(5, p.step)) : 1;
    if (L.step > 1 && !firstValid()) L.step = 1;
  } catch (_) {}
}
function updateHeroCount(count = getVisible().length) {
  const show = activeWorkspace === 'catalog' && count > 0;
  $('#matching-tools').hidden = !show;
  $('#matching-tools').textContent = show ? count + ' из ' : '';
  $('#total-tools').textContent = D.tools.length;
  $('#hero-count-label').textContent = show ? 'инструментов' : 'инструментов в каталоге';
  $('#hero-match-hint').hidden = !show;
  $('#hero-match-hint').textContent = 'По выбранным условиям';
}
function setWorkspace(mode, persist = true) {
  if (mode === 'expert') mode = 'catalog';
  activeWorkspace =
    mode === 'first' && firstData ? 'first' : mode === 'catalog' ? 'catalog' : mode === 'simple' ? 'simple' : 'steps';
  document.body.dataset.workspace = activeWorkspace;
  const skip = $('.skip-link');
  skip.href =
    activeWorkspace === 'first'
      ? '#first-request'
      : ['simple', 'steps'].includes(activeWorkspace)
        ? activeWorkspace === 'steps' ? '#steps' : '#simple-workspace'
        : '#catalog';
  skip.textContent =
    activeWorkspace === 'first'
      ? 'К обучению'
      : ['simple', 'steps'].includes(activeWorkspace)
        ? 'К подбору'
        : 'К инструментам';
  $('#first-request').hidden = activeWorkspace !== 'first';
  $('#catalog-workspace').hidden = activeWorkspace !== 'catalog';
  $('#simple-workspace').hidden = !['simple', 'steps'].includes(activeWorkspace);
  syncModeToggle();
  if (persist) writeHash();
  if (activeWorkspace === 'first') renderFirst();
  else if (['simple', 'steps'].includes(activeWorkspace)) renderSimple();
  else update(false);
  if (!['simple', 'steps'].includes(activeWorkspace)) {
    renderGuided();
    renderPrompts();
  }
  fitPromptAreas();
  updateHeroCount();
}
function readFirstForm() {
  const before = JSON.stringify([L.task, L.subject, L.customSubject, L.grade, L.topic]);
  L.subject = $('#first-subject').value;
  L.customSubject = $('#first-custom-subject').value.slice(0, 80);
  L.grade = $('#first-grade').value;
  L.topic = $('#first-topic').value.slice(0, 200);
  if (before !== JSON.stringify([L.task, L.subject, L.customSubject, L.grade, L.topic])) {
    L.completed = false;
    L.checks = firstData.checks.map(() => false);
    clearFirstCopyStatus();
  }
  renderFirst();
  saveFirst();
}
function renderFirst() {
  if (!firstData) return;
  for (const [id, value] of [
    ['first-subject', L.subject],
    ['first-custom-subject', L.customSubject],
    ['first-grade', L.grade],
    ['first-topic', L.topic],
  ])
    if ($('#' + id).value !== value) $('#' + id).value = value;
  $('#first-custom-wrap').hidden = L.subject !== 'Другой предмет';
  for (const b of document.querySelectorAll('[data-first-task]')) {
    const selected = b.dataset.firstTask === L.task;
    b.setAttribute('aria-checked', String(selected));
    b.tabIndex = selected ? 0 : -1;
  }
  for (const b of document.querySelectorAll('[data-first-tool]')) {
    const selected = b.dataset.firstTool === L.tool;
    b.setAttribute('aria-checked', String(selected));
    b.tabIndex = selected ? 0 : -1;
  }
  for (const panel of document.querySelectorAll('[data-first-step]'))
    panel.hidden = Number(panel.dataset.firstStep) !== L.step;
  for (const b of document.querySelectorAll('[data-first-nav]')) {
    b.classList.toggle('active', +b.dataset.firstNav === L.step);
    b.setAttribute('aria-current', +b.dataset.firstNav === L.step ? 'step' : 'false');
  }
  $('#first-progress').textContent = 'Шаг ' + L.step + ' из 5';
  if (firstValid()) {
    $('#first-prompt').value = firstPrompt();
    $('#first-followups').innerHTML = firstData.followups
      .map(
        (f, i) =>
          `<article class="first-followup"><h4>${esc(f.name)}</h4><p id="first-followup-${i}" tabindex="-1">${esc(firstFill(f.text))}</p><button type="button" class="secondary-button" data-first-copy="followup-${i}">Скопировать уточнение</button><span class="first-followup-copy-status" id="first-followup-status-${i}" data-first-copy-status role="status"></span></article>`,
      )
      .join('');
  }
  const tool = D.tools.find((t) => t.id === L.tool);
  $('#first-open-chat').href = tool.url;
  $('#first-open-chat').textContent = '2. Открыть ' + tool.name + ' ↗';
  for (const name of document.querySelectorAll('[data-first-chat-name]'))
    name.textContent = tool.name;
  const startInfo = firstData.tools.find((info) => info.id === L.tool),
    genericStart = [
      'Войдите в сервис, если он предлагает авторизацию.',
      'Найдите поле для сообщения в открытом чате.',
    ];
  for (const item of document.querySelectorAll('[data-first-service-step]'))
    item.textContent =
      startInfo?.startSteps?.[Number(item.dataset.firstServiceStep)] ||
      genericStart[Number(item.dataset.firstServiceStep)];
  for (const input of document.querySelectorAll('[data-first-check]'))
    input.checked = L.checks[Number(input.dataset.firstCheck)];
  $('#first-check-hint').textContent = L.completed
    ? 'Практика отмечена как завершённая.'
    : L.checks.every(Boolean)
      ? 'Все три пункта отмечены. Можно завершить практику.'
      : 'Кнопка «Завершить практику» станет доступна после трёх отметок выше.';
  $('#first-complete').disabled = !L.checks.every(Boolean) || L.completed;
  $('#first-complete').textContent = L.completed ? 'Практика завершена ✓' : 'Завершить практику';
  $('#first-complete-status').textContent = L.completed
    ? 'Вы отметили завершение первого запроса. Сохраните материал и попробуйте другую тему или задачу.'
    : '';
  fitPromptAreas();
}
function goFirst(step) {
  if (step > 1) applyFirstDefaults();
  if (step > 1 && !firstValid()) {
    L.step = 1;
    renderFirst();
    $('#first-form').reportValidity();
    return;
  }
  L.step = Math.max(1, Math.min(5, step));
  renderFirst();
  saveFirst();
  const heading = $(`#first-step-${L.step}-title`);
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}
async function copyFirst(kind) {
  let text, element, status;
  if (kind === 'main') {
    text = firstPrompt();
    element = $('#first-prompt');
    status = L.step === 3 ? $('#first-chat-copy-status') : $('#first-copy-status');
  } else {
    const i = Number(kind.replace('followup-', ''));
    if (!firstData.followups[i]) return;
    text = firstFill(firstData.followups[i].text);
    element = $('#first-followup-' + i);
    status = $('#first-followup-status-' + i);
  }
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_) {}
  if (!copied) {
    if (kind === 'main' && L.step !== 2) {
      goFirst(2);
      status = $('#first-copy-status');
    }
    element.focus();
    if (element.tagName === 'TEXTAREA') element.select();
    else {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    try {
      copied = document.execCommand('copy');
    } catch (_) {}
  }
  if (!copied)
    status.textContent =
      'Автоматическое копирование не сработало. Текст выделен: нажмите Ctrl+C (⌘+C на Mac) или выберите «Копировать» в меню текста.';
  else if (kind === 'main' && text !== firstPrompt())
    status.textContent = 'Текст изменён. Скопируйте запрос заново.';
  else if (kind === 'main')
    status.textContent =
      L.step === 2
        ? 'Запрос скопирован. Теперь нажмите «Выбрать чат →».'
        : 'Запрос скопирован. Откройте чат кнопкой 2 и вставьте текст в поле сообщения.';
  else
    status.textContent =
      'Уточнение скопировано. Перейдите во вкладку с сервисом и вставьте его в тот же разговор.';
}
function firstRadioKeyboard(container, attribute) {
  container.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const buttons = [...container.querySelectorAll('[' + attribute + ']')],
      index = buttons.findIndex((b) => b === document.activeElement);
    if (index < 0) return;
    e.preventDefault();
    let n =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : (index + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : buttons.length - 1)) %
            buttons.length;
    buttons[n].click();
    buttons[n].focus();
  });
}
function initFirstRequest() {
  if (!firstData) {
    return;
  }
  loadFirst();
  $('#first-topic').placeholder = firstData.example.topic;
  $('#first-custom-subject').placeholder = firstData.example.subject;
  $('#first-subject').innerHTML = firstData.subjects
    .map((x) => `<option>${esc(x)}</option>`)
    .join('');
  $('#first-grade').innerHTML = Array.from(
    { length: 11 },
    (_, i) => `<option value="${i + 1}">${i + 1} класс</option>`,
  ).join('');
  $('#first-steps').innerHTML = ['Урок', 'Запрос', 'Чат', 'Диалог', 'Проверка']
    .map(
      (name, i) =>
        `<button type="button" data-first-nav="${i + 1}"><span>${i + 1}</span>${name}</button>`,
    )
    .join('');
  $('#first-task-choices').innerHTML = firstData.tasks
    .map(
      (t) =>
        `<button type="button" role="radio" aria-checked="false" data-first-task="${esc(t.id)}"><b>${esc(t.name)}</b><span>${esc(t.description)}</span></button>`,
    )
    .join('');
  $('#first-tools').innerHTML = firstData.tools
    .map((info) => {
      const tool = D.tools.find((t) => t.id === info.id);
      return `<div class="first-tool-card"><button type="button" role="radio" aria-checked="false" data-first-tool="${tool.id}"><b>${esc(tool.name)}</b><span>${esc(info.note)}</span></button><a href="${esc(info.help)}" target="_blank" rel="noopener noreferrer">${esc(info.helpLabel || 'Официальная инструкция')} ↗</a></div>`;
    })
    .join('');
  $('#first-checks').innerHTML = firstData.checks
    .map(
      (text, i) =>
        `<label><input type="checkbox" data-first-check="${i}"><span>${esc(text)}</span></label>`,
    )
    .join('');
  $('#first-form').addEventListener('input', readFirstForm);
  $('#first-form').addEventListener('change', readFirstForm);
  $('#first-form').addEventListener('submit', (e) => {
    e.preventDefault();
    readFirstForm();
    goFirst(2);
  });
  $('#first-example').addEventListener('click', () => {
    Object.assign(L, firstData.example);
    clearFirstCopyStatus();
    L.completed = false;
    L.checks = firstData.checks.map(() => false);
    renderFirst();
    saveFirst();
    $('#first-topic').focus();
  });
  $('#first-prompt').addEventListener('input', (e) => {
    L.draft = e.target.value;
    clearFirstCopyStatus('Текст изменён. Скопируйте запрос заново.');
    fitPromptArea(e.target);
  });
  $('#first-task-choices').addEventListener('click', (e) => {
    const b = e.target.closest('[data-first-task]');
    if (b) {
      L.task = b.dataset.firstTask;
      clearFirstCopyStatus();
      L.completed = false;
      L.checks = firstData.checks.map(() => false);
      renderFirst();
      saveFirst();
    }
  });
  $('#first-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-first-tool]');
    if (b) {
      L.tool = b.dataset.firstTool;
      renderFirst();
      saveFirst();
    }
  });
  $('#first-request').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-first-nav],[data-first-go]'),
      copy = e.target.closest('[data-first-copy]');
    if (nav) goFirst(Number(nav.dataset.firstNav || nav.dataset.firstGo));
    if (copy) copyFirst(copy.dataset.firstCopy);
  });
  $('#first-checks').addEventListener('change', (e) => {
    if (e.target.matches('[data-first-check]')) {
      L.checks[+e.target.dataset.firstCheck] = e.target.checked;
      if (!L.checks.every(Boolean)) L.completed = false;
      renderFirst();
      saveFirst();
    }
  });
  $('#first-complete').addEventListener('click', () => {
    if (L.checks.every(Boolean)) {
      L.completed = true;
      renderFirst();
      saveFirst();
    }
  });
  $('#first-restart').addEventListener('click', () => {
    L.step = 1;
    L.topic = '';
    L.signature = '';
    L.draft = '';
    clearFirstCopyStatus();
    L.completed = false;
    L.checks = firstData.checks.map(() => false);
    renderFirst();
    saveFirst();
    $('#first-topic').focus();
  });
  firstRadioKeyboard($('#first-task-choices'), 'data-first-task');
  firstRadioKeyboard($('#first-tools'), 'data-first-tool');
}
