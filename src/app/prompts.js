// Original prompt sizing: include borders and shrink as well as grow, without measuring closed details.
function fitPromptArea(area) {
  if (!area || !area.getClientRects().length) return;
  area.style.height = 'auto';
  area.style.height = area.scrollHeight + area.offsetHeight - area.clientHeight + 'px';
}
function fitPromptAreas() {
  for (const area of document.querySelectorAll('#prompt-list textarea,#first-request textarea'))
    fitPromptArea(area);
}
function showPrompt(index) {
  const cards = [...$('#prompt-list').querySelectorAll('[data-task-prompt]')],
    current = Math.max(0, Math.min(cards.length - 1, index));
  cards.forEach((card, i) => { card.hidden = i !== current; });
  activePromptKey = cards[current]?.dataset.promptItem || '';
  $('#prompt-task-title').textContent = cards[current]?.dataset.promptTaskName || '';
  $('#prompt-number').textContent = cards[current] ? 'Пример: ' + cards[current].dataset.promptNumber : '';
  $('#prompt-position').textContent = cards.length ? current + 1 + ' из ' + cards.length : '0 из 0';
  $('#prompt-previous').disabled = current === 0;
  $('#prompt-next').disabled = !cards.length || current === cards.length - 1;
  fitPromptAreas();
}
function stepPrompt(direction) {
  const cards = [...$('#prompt-list').querySelectorAll('[data-task-prompt]')],
    current = cards.findIndex((card) => card.dataset.promptItem === activePromptKey);
  showPrompt(current + direction);
}
function syncPromptDisclosure() {
  const novice = ['simple', 'steps'].includes(activeWorkspace),
    expanded = !novice || promptDisclosureOpen;
  $('#task-prompts .prompts-heading').hidden = novice;
  $('#task-prompts').setAttribute('aria-labelledby', novice ? 'prompt-disclosure-title' : 'prompts-title');
  $('#prompt-toggle').hidden = !novice || $('#task-prompts').hidden ||
    (activeWorkspace === 'steps' && guidedStep !== 3);
  $('#prompt-toggle').setAttribute('aria-label', (promptDisclosureOpen ? 'Свернуть' : 'Развернуть') + ' примеры запросов к нейросети');
  $('#prompt-toggle').setAttribute('aria-expanded', String(novice && promptDisclosureOpen));
  $('#prompt-toggle-label').textContent = promptDisclosureOpen ? 'Свернуть' : 'Развернуть';
  $('#prompt-panel').hidden = !expanded;
  fitPromptAreas();
}
function promptNumber(task, prompt) {
  return prompt.code ? String(Number(prompt.code.slice(1)))
    : String(taskList.flatMap((t) => t.prompts || []).indexOf(prompt) + 1);
}
function renderPrompts(preferredTask) {
  const novice = ['simple', 'steps'].includes(activeWorkspace),
    section = $('#task-prompts'), target = $(novice ? '#simple-prompt-slot' : '#expert-prompt-slot'),
    plan = novice ? simplePlan() : searchPlan(),
    inferred = novice && simpleIsTopic(plan) ? [taskMap.get('text')].filter(Boolean) : plan.tasks,
    ids = new Set([...(novice ? [] : S.types), ...inferred.map((task) => task.id)]),
    items = taskList.flatMap((task) => (task.prompts || []).filter((prompt) => {
      const bound = prompt.forTools?.find((id) => plan.tools.has(id)), inTask = ids.has(task.id);
      if (prompt.forTools && !bound && !(inTask && prompt.subjectAliases)) return false;
      if (!inTask && !(bound && !ids.size)) return false;
      return matchesSubjectScope(prompt.subjectAliases, plan, bound, false);
    }).map((prompt) => ({task, prompt, key: task.id + '/' + prompt.id}))),
    signature = JSON.stringify(items.map((item) => item.key));
  if (section.parentElement !== target) target.append(section);
  if (promptWorkspace !== activeWorkspace) {
    if (promptWorkspace) promptPositions.set(promptWorkspace, activePromptKey);
    promptWorkspace = activeWorkspace;
    activePromptKey = promptPositions.get(promptWorkspace) || '';
    promptDisclosureOpen = false;
  }
  if (!items.length || (activeWorkspace === 'steps' && guidedStep !== 3)) promptDisclosureOpen = false;
  section.hidden = !items.length || activeWorkspace === 'first';
  $('#task-selection-label').textContent = S.types.size ? 'Выбрано: ' + S.types.size : 'Все задачи';
  if (signature !== promptSelection) {
    promptSelection = signature;
    $('#prompt-list').innerHTML = items.map(({task: t, prompt: p, key}) =>
      `<article class="prompt-item" data-task-prompt="${esc(t.id)}" data-prompt-item="${esc(key)}" data-prompt-number="${esc(promptNumber(t, p))}" data-prompt-task-name="${esc(t.name)}" aria-label="${esc(t.name)}" hidden><div class="prompt-entry">${p.title && p.title !== 'Готовый пример' ? `<p class="prompt-example-title">${esc(p.title)}</p>` : ''}<p class="prompt-note">${esc(p.note || '')}</p><div class="prompt-text-actions"><label for="prompt-text-${esc(key)}">Запрос</label><button type="button" class="copy-prompt" data-copy-prompt="${esc(key)}" aria-label="Скопировать запрос для задачи ${esc(t.name)}">Скопировать</button></div><textarea id="prompt-text-${esc(key)}" data-prompt-key="${esc(key)}" aria-label="Пример для задачи ${esc(t.name)}" rows="1" spellcheck="false">${esc(promptDrafts.get(key) ?? p.text)}</textarea><span class="copy-status" role="status" aria-live="polite"></span></div></article>`
    ).join('');
  }
  const preferred = typeof preferredTask === 'string' ? items.findIndex((item) => item.task.id === preferredTask) : -1,
    retained = items.findIndex((item) => item.key === activePromptKey);
  showPrompt(preferred >= 0 ? preferred : retained >= 0 ? retained : 0);
  syncPromptDisclosure();
}
async function copyPrompt(button) {
  const entry = button.closest('.prompt-entry'),
    area = entry.querySelector('textarea'),
    status = entry.querySelector('.copy-status');
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(area.value);
      copied = true;
    }
  } catch (_) {}
  if (!copied) {
    fitPromptArea(area);
    area.focus();
    area.select();
    try {
      copied = document.execCommand('copy');
    } catch (_) {}
  }
  status.textContent = copied
    ? 'Запрос скопирован'
    : 'Текст выделен — нажмите Ctrl+C или выберите «Копировать».';
  button.textContent = copied ? 'Скопировано' : 'Выделено';
  setTimeout(() => {
    if (button.isConnected) button.textContent = 'Скопировать';
  }, 1800);
}
