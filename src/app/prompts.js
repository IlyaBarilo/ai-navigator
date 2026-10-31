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
function renderPrompts() {
  const signature = [...S.types].join(',');
  $('#task-prompts').hidden = !S.types.size;
  $('#task-selection-label').textContent = S.types.size ? 'Выбрано: ' + S.types.size : 'Все задачи';
  if (signature === promptSelection) return;
  promptSelection = signature;
  const selected = [...S.types].map((id) => taskMap.get(id));
  $('#prompt-list').innerHTML = selected
    .map(
      (t) =>
        `<article class="prompt-card" data-task-prompt="${t.id}"><div class="prompt-heading"><div><small>Задача</small><h3>${esc(t.name)}</h3></div></div>${(
          t.prompts || []
        )
          .map((p) => {
            const key = t.id + '/' + p.id;
            return `<div class="prompt-entry"><button type="button" class="copy-prompt" data-copy-prompt="${esc(key)}" aria-label="Скопировать запрос для задачи ${esc(t.name)}">Скопировать</button><details ${selected.length === 1 ? 'open' : ''}><summary>Посмотреть и изменить пример${p.title && p.title !== 'Готовый пример' ? ': ' + esc(p.title) : ''}</summary><p class="prompt-note">${esc(p.note || '')}</p><textarea data-prompt-key="${esc(key)}" aria-label="Пример для задачи ${esc(t.name)}" rows="1" spellcheck="false">${esc(promptDrafts.get(key) ?? p.text)}</textarea></details><span class="copy-status" role="status" aria-live="polite"></span></div>`;
          })
          .join('')}</article>`,
    )
    .join('');
  fitPromptAreas();
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
    entry.querySelector('details').open = true;
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
