// Original minimal discovery flow; the existing offline matcher and catalog data are shared.
const SIMPLE_STORAGE_KEY = 'barilo.ai-catalog.simple.v1';
let P = { q: '', access: ['free-online'], rfOnly: true };
const simpleAccessOptions = ['free-online', 'local'];
const simpleAccessName = {
  'free-online': 'Бесплатно онлайн / с лимитами',
  all: 'Все',
  local: 'Бесплатно локально / У меня игровая видеокарта',
};
function normalizeSimpleAccess(value) {
  if (value === 'all' || value === 'online') return [];
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null;
  if (!items) return ['free-online'];
  if (!items.length || items.includes('all') || items.includes('online')) return [];
  const selected = simpleAccessOptions.filter((key) => items.includes(key));
  return selected.length ? selected : ['free-online'];
}
function simpleAccessLabel() {
  return !P.access.length
    ? 'Все'
    : P.access.length === 2
      ? 'Бесплатно онлайн и локально'
      : simpleAccessName[P.access[0]];
}
function applySimple(saved) {
  if (!saved || typeof saved !== 'object') return;
  P.q = typeof saved.q === 'string' ? saved.q.slice(0, 200) : '';
  P.access = normalizeSimpleAccess(saved.access);
  P.rfOnly = typeof saved.rfOnly === 'boolean' ? saved.rfOnly : true;
}
function readSimpleHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!['simple', 'steps'].includes(params.get('view'))) return false;
  applySimple({
    q: params.get('q') || '',
    access: params.get('access') || 'free-online',
    rfOnly: params.get('rf') !== '0',
  });
  return true;
}
function saveSimple() {
  try {
    localStorage.setItem(SIMPLE_STORAGE_KEY, JSON.stringify(P));
  } catch (_) {}
}
function writeSimpleHash() {
  const guided = activeWorkspace === 'steps', params = new URLSearchParams({ view: guided ? 'steps' : 'simple' });
  if (guided && guidedStep > 1) params.set('step', String(guidedStep));
  if (P.q) params.set('q', P.q);
  if (P.access.length !== 1 || P.access[0] !== 'free-online')
    params.set('access', P.access.length ? P.access.join(',') : 'all');
  if (!P.rfOnly) params.set('rf', '0');
  try {
    history.replaceState(null, '', location.pathname + location.search + '#' + params);
  } catch (_) {}
}
function withSimpleSelection(callback) {
  const previous = { ...S };
  try {
    Object.assign(S, {
      types: new Set(),
      groups: new Set(P.access.map((key) => (key === 'free-online' ? 'online-free' : 'local'))),
      quality: 0,
      difficulty: 0,
      q: P.q.trim(),
      sort: 'recommended',
      rfOnly: P.rfOnly,
    });
    return callback();
  } finally {
    Object.assign(S, previous);
  }
}
function simplePlan() {
  return withSimpleSelection(() => searchPlan());
}
function simpleIsTopic(plan) {
  return !!(P.q.trim() && !plan.tasks.length && !plan.tools.size && plan.terms.length);
}
function simpleVisible({ beforeAccess = false } = {}) {
  return withSimpleSelection(() => {
    if (beforeAccess) {
      S.groups = new Set();
      S.rfOnly = false;
    }
    const plan = searchPlan(),
      topic = simpleIsTopic(plan);
    if (topic) S.q = '';
    return getVisible(
      (f) => !topic || (f.category === 'text' && matchesQueryConditions(f, plan.filters)),
    );
  });
}
function renderSimpleHints() {
  const plan = simplePlan(),
    tasks = P.q.trim()
      ? plan.tasks.length
        ? plan.tasks
        : simpleIsTopic(plan)
          ? [{ id: 'text', name: 'Работа с текстом и темой', icon: 'text', group: 'general' }]
          : []
      : [],
    box = $('#simple-task-hints');
  box.hidden = !tasks.length;
  box.innerHTML = tasks.length
    ? '<span class="simple-hints-label">Типовые задачи:</span>' +
      tasks
        .map(
          (t) =>
            `<span class="simple-task-hint" data-simple-task="${esc(t.id)}" data-group="${esc(t.group || 'general')}">${icon(t.icon || t.id)}${esc(t.name)}</span>`,
        )
        .join('')
    : '';
}
function renderSimpleResults() {
  const rows = simpleVisible(),
    hasQuery = Boolean(P.q.trim());
  $('#simple-total-tools').textContent = D.tools.length;
  $('#simple-matching-tools').hidden = !hasQuery;
  $('#simple-matching-number').textContent = hasQuery ? rows.length : '';
  const plan = simplePlan(),
    meaningful =
      P.q.trim() &&
      (plan.tasks.length || plan.tools.size || plan.terms.length || plan.filters.length);
  $('#simple-empty p').textContent = plan.presentation.active
    ? 'С выбранными условиями не найден подтверждённый результат: ' + presentationRequestLabel(plan.presentation) + '. Измените формат или доступ. Неподтверждённый экспорт не считается совпадением.'
    : 'По этой задаче с выбранным доступом ничего не нашлось. Уточните запрос или измените доступность.';
  $('#simple-live-results').hidden = !meaningful && activeWorkspace !== 'steps';
  if (!meaningful) {
    if (activeWorkspace === 'steps') {
      $('#simple-matching-number').textContent = hasQuery ? '0' : '';
      $('#simple-results').replaceChildren();
      $('#simple-empty').hidden = false;
      $('#simple-results-note').textContent = simpleAccessLabel() + ' · Найдено: 0';
    }
    renderGuided();
    renderPrompts();
    return;
  }
  $('#simple-results-note').textContent =
    simpleAccessLabel() +
    ' · ' +
    (P.rfOnly ? 'Доступно в РФ' : 'Все регионы') +
    (activeWorkspace === 'steps' ? '' : ' · Найдено: ' + rows.length);
  $('#simple-empty').hidden = rows.length > 0;
  $('#simple-results').innerHTML = rows
    .map(({ tool, matched }) => {
      const f = matched[0],
        unknown = matched.some((x) => x.region === 'check'),
        restricted = matched.some(isRestricted),
        local = f.mode === 'local';
      const prices = [...new Set(matched.map((x) => priceGroup(x)))];
      return `<li class="simple-tool-row" data-simple-tool="${esc(tool.id)}"><div class="simple-tool-info"><h2>${esc(tool.name)}</h2><p class="simple-tool-description">${esc(f.description)}</p>${deliverySummary(matched, plan)}<div class="simple-tool-ratings"><span class="simple-quality"><span class="simple-rating-label">Качество</span> ${stars(f.quality.level, f.quality.level !== null)}</span><span class="simple-difficulty" aria-label="Сложность ${f.difficulty.level} из 5"><span class="simple-rating-label">Сложность</span> <span class="difficulty-symbols" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => icon('diamond', i < f.difficulty.level ? 'filled' : 'empty')).join('')}</span><b>${f.difficulty.level}/5</b></span></div><div class="simple-tool-tags">${prices.map((g) => `<span class="access-tag ${g}">${esc(g === 'online-free' ? freeAccessLabel(tool) : g === 'local' ? 'Локально' : 'Платно')}</span>`).join('')}${unknown ? '<span class="access-tag availability-unknown">Доступ уточнить</span>' : ''}${restricted ? '<span class="access-tag rf-limited">Есть ограничения работы в РФ</span>' : ''}</div>${local ? `<p class="simple-hardware">${esc(f.hardware?.label || 'Рекомендуется мощная игровая видеокарта')}</p>` : ''}</div><div class="simple-tool-actions"><a class="primary-button" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" aria-label="${local ? 'Как установить' : 'Открыть'} ${esc(tool.name)}">${local ? 'Как установить' : 'Открыть'} ↗</a><button type="button" class="simple-text-button" data-simple-details="${esc(tool.id)}" data-simple-function="${esc(f.id)}" aria-label="Возможности и условия: ${esc(tool.name)}">Подробнее</button></div></li>`;
    })
    .join('');
  renderGuided();
  renderPrompts();
}
function renderSimpleAccess() {
  for (const button of document.querySelectorAll('[data-simple-access]')) {
    const key = button.dataset.simpleAccess,
      chosen = key === 'all' ? !P.access.length : P.access.includes(key);
    button.setAttribute('aria-pressed', String(chosen));
  }
  $('#simple-rf').setAttribute('aria-pressed', String(P.rfOnly));
  $('#simple-local-hint').hidden = !P.access.includes('local');
  $('#simple-access-help').textContent =
    P.access.length === 2
      ? 'Бесплатные онлайн-сервисы и локальные программы. Для онлайн-работы нужен интернет; локальные программы устанавливаются на ваш компьютер.'
      : !P.access.length
        ? 'Все варианты: бесплатные и платные онлайн-сервисы, а также программы для установки на своём компьютере.'
        : P.access[0] === 'local'
          ? 'Программа работает на вашем компьютере: потребуется установка и настройка. Для нейросети нужно скачать модель.'
          : 'Нужен интернет. У сервисов есть бесплатный доступ или квота; лимиты и условия различаются.';
  $('#simple-rf-help').textContent = P.rfOnly
    ? 'Доступно в РФ: известные ограничения скрыты. Неподтверждённый доступ отмечен «Доступ уточнить».'
    : 'Показаны также сервисы с известными ограничениями доступа из РФ.';
}
function renderSimple() {
  $('#simple-query').value = P.q;
  renderSimpleAccess();
  renderSimpleHints();
  renderSimpleResults();
}
function initSimpleExamples() {
  const groups = D.queryExamples || [],
    panel = $('#simple-query-examples');
  panel.hidden = !groups.length;
  if (!groups.length) return;
  const examples = new Map(groups.flatMap((g) => g.examples.map((e) => [e.id, e])));
  $('#simple-example-groups').innerHTML = groups
    .map(
      (g) =>
        `<section class="simple-example-group" aria-labelledby="simple-example-group-${esc(g.id)}"><h3 id="simple-example-group-${esc(g.id)}">${esc(g.name)}</h3><ul>${g.examples.map((e) => `<li><button type="button" class="simple-example-button" data-simple-example="${esc(e.id)}">${esc(e.query)}</button></li>`).join('')}</ul></section>`,
    )
    .join('');
  panel.addEventListener('click', (e) => {
    const button = e.target.closest('[data-simple-example]');
    if (!button) return;
    const example = examples.get(button.dataset.simpleExample);
    if (!example) return;
    const input = $('#simple-query');
    input.value = example.query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    panel.open = false;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
}
function initSimple() {
  try {
    applySimple(JSON.parse(localStorage.getItem(SIMPLE_STORAGE_KEY) || '{}'));
  } catch (_) {}
  readSimpleHash();
  $('#simple-query').addEventListener('input', (e) => {
    P.q = e.target.value.slice(0, 200);
    saveSimple();
    renderSimpleHints();
    renderSimpleResults();
    writeSimpleHash();
  });
  $('#simple-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    P.q = $('#simple-query').value.trim().slice(0, 200);
    renderSimple();
    saveSimple();
    writeSimpleHash();
    if (activeWorkspace === 'steps') goGuidedStep(2);
  });
  $('#simple-access-choices').addEventListener('click', (e) => {
    const b = e.target.closest('[data-simple-access]');
    if (!b) return;
    const key = b.dataset.simpleAccess;
    if (key === 'all') P.access = [];
    else {
      const chosen = new Set(P.access);
      chosen.has(key) ? chosen.delete(key) : chosen.add(key);
      P.access = simpleAccessOptions.filter((value) => chosen.has(value));
    }
    renderSimpleAccess();
    renderSimpleResults();
    saveSimple();
    writeSimpleHash();
  });
  $('#simple-rf').addEventListener('click', () => {
    P.rfOnly = !P.rfOnly;
    renderSimpleAccess();
    renderSimpleResults();
    saveSimple();
    writeSimpleHash();
  });
  $('#simple-results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-simple-details]');
    if (b) openDetails(b.dataset.simpleDetails, b, b.dataset.simpleFunction);
  });
  initSimpleExamples();
}
