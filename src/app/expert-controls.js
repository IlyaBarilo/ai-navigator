function initControls() {
  $('#total-tools').textContent = D.tools.length;
  $('#prompt-list').addEventListener('input', (e) => {
    if (e.target.matches('textarea[data-prompt-key]')) {
      promptDrafts.set(e.target.dataset.promptKey, e.target.value);
      fitPromptArea(e.target);
    }
  });
  $('#prompt-list').addEventListener(
    'toggle',
    (e) => {
      if (e.target.matches('details') && e.target.open)
        fitPromptArea(e.target.querySelector('textarea'));
    },
    true,
  );
  $('#prompt-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy-prompt]');
    if (b) await copyPrompt(b);
  });
  $('#task-legend').innerHTML = taskGroups
    .map(
      (g) =>
        `<span class="task-group-key" data-task-group="${esc(g.id)}"><span class="task-group-dot" aria-hidden="true"></span>${esc(g.name)}</span>`,
    )
    .join('');
  $('#type-filters').innerHTML =
    '<button class="chip all-types" type="button">Все</button>' +
    taskList
      .map((c) => {
        const group = taskGroupMap.get(c.group || 'general');
        return `<button type="button" class="chip type-chip" data-type="${c.id}" data-task-group="${esc(group?.id || 'general')}" aria-pressed="false" aria-label="${esc(c.name)} — ${esc(group?.name || 'Общие возможности')}" title="${esc(group?.name || 'Общие возможности')}. ${esc(c.prompts?.[0]?.note || c.name)}">${icon(c.icon || c.id)}${esc(c.name)}</button>`;
      })
      .join('');
  $('#task-list-toggle').addEventListener('click', () => {
    taskPickerExpanded = !taskPickerExpanded;
    layoutTaskPicker();
  });
  const groupChip = (g) =>
    `<button type="button" class="chip group-chip" data-group="${g.id}" aria-pressed="false"><span class="group-dot" aria-hidden="true"></span>${filterGroupLabel[g.id]}</button>`;
  $('#group-filters').innerHTML =
    '<button class="chip all-groups" type="button">Все</button>' +
    D.groups
      .filter((g) => g.id !== 'local' && g.id !== 'online-paid')
      .map(groupChip)
      .join('') +
    D.groups
      .filter((g) => g.id === 'local')
      .map(groupChip)
      .join('') +
    '<div class="rf-filter-row"><button id="rf-filter" type="button" class="chip rf-switch" aria-pressed="true" title="Скрывает известные ограничения доступа. Неподтверждённый доступ отмечен отдельно."><span class="rf-check" aria-hidden="true">✓</span>Доступно в РФ</button></div>';
  $('#quality-stars').innerHTML =
    '<button type="button" class="any-quality rating-any" role="radio" data-quality="0" aria-label="Любое качество" aria-checked="true">Любое</button>' +
    Array.from(
      { length: 5 },
      (_, i) =>
        `<button type="button" class="star-button rating-choice" role="radio" data-quality="${i + 1}" aria-label="Качество от ${i + 1} из 5" aria-checked="false" title="Качество от ${i + 1} из 5">${icon('star')}</button>`,
    ).join('');
  $('#type-filters').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('.all-types')) S.types.clear();
    else if (b.dataset.type) {
      S.types.has(b.dataset.type) ? S.types.delete(b.dataset.type) : S.types.add(b.dataset.type);
    }
    update();
  });
  $('#group-filters').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'rf-filter') {
      S.rfOnly = !S.rfOnly;
    } else if (b.matches('.all-groups')) S.groups.clear();
    else if (b.dataset.group) {
      S.groups.has(b.dataset.group)
        ? S.groups.delete(b.dataset.group)
        : S.groups.add(b.dataset.group);
    }
    update();
  });
  $('#quality-stars').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    S.quality = +b.dataset.quality;
    update();
  });
  $('#quality-stars').addEventListener('keydown', (e) => {
    let n = S.quality;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = Math.min(5, n + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = Math.max(0, n - 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = 5;
    else return;
    e.preventDefault();
    S.quality = n;
    update();
    $(`#quality-stars [data-quality="${n}"]`).focus();
  });
  $('#difficulty-filter').innerHTML =
    '<button type="button" class="any-difficulty rating-any" role="radio" data-difficulty="0" aria-label="Любая сложность" aria-checked="true">Любая</button>' +
    Array.from(
      { length: 5 },
      (_, i) =>
        `<button type="button" class="difficulty-button rating-choice" role="radio" data-difficulty="${i + 1}" aria-label="Сложность до ${i + 1} из 5" title="Сложность до ${i + 1}/5: ${['минимальная', 'небольшая', 'средняя', 'выше средней', 'высокая'][i]}" aria-checked="false">${icon('diamond')}</button>`,
    ).join('');
  $('#difficulty-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-difficulty]');
    if (b) {
      S.difficulty = +b.dataset.difficulty;
      update();
    }
  });
  $('#difficulty-filter').addEventListener('keydown', (e) => {
    let n = S.difficulty;
    if (['ArrowRight', 'ArrowUp'].includes(e.key)) n = Math.min(5, n + 1);
    else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) n = Math.max(0, n - 1);
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = 5;
    else return;
    e.preventDefault();
    S.difficulty = n;
    update();
    $(`#difficulty-filter [data-difficulty="${n}"]`).focus();
  });
  $('#search').addEventListener('input', () => {
    S.q = $('#search').value.slice(0, 200);
    update();
  });
  $('#search-feedback').addEventListener('click', (e) => {
    const button = e.target.closest('[data-search-task]');
    if (!button) return;
    const id = button.dataset.searchTask;
    if (!taskMap.has(id)) return;
    S.types.add(id);
    update();
    const card = [...document.querySelectorAll('[data-task-prompt]')].find(
      (c) => c.dataset.taskPrompt === id,
    );
    if (card) {
      card.querySelector('details').open = true;
      fitPromptAreas();
      card.querySelector('summary').focus({ preventScroll: true });
      card.scrollIntoView({ block: 'start' });
    }
  });
  $('#sort').addEventListener('change', () => {
    S.sort = $('#sort').value;
    update();
  });
  $('#reset').addEventListener('click', reset);
  $('#empty-reset').addEventListener('click', reset);
  $('#cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-details]');
    if (b) openDetails(b.dataset.details, b, b.dataset.focusFunction);
  });
  $('#help-open').addEventListener('click', (e) => openDialog($('#help-dialog'), e.currentTarget));
  for (const d of document.querySelectorAll('dialog')) {
    d.querySelector('.dialog-close').addEventListener('click', () => d.close());
    d.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      returnFocus?.focus();
    });
    d.addEventListener('click', (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          d.close();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (
      e.key === '/' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !document.querySelector('dialog[open]') &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
    ) {
      e.preventDefault();
      if (activeWorkspace === 'simple') {
        $('#simple-query').focus();
      } else {
        if (activeWorkspace === 'first') setWorkspace('catalog');
        $('#search').focus();
      }
    }
  });
  addEventListener('hashchange', () => {
    if (readHash()) {
      update(false);
      savePreferences();
    } else if (
      ['catalog', 'expert'].includes(new URLSearchParams(location.hash.slice(1)).get('view'))
    ) {
      restorePreferences();
      update(false);
      savePreferences();
    }
  });
  if ('ResizeObserver' in window)
    new ResizeObserver((entries) => {
      document.documentElement.style.setProperty(
        '--filter-height',
        Math.ceil(entries[0].contentRect.height + 40) + 'px',
      );
    }).observe($('.filter-panel'));
  let lastTaskWidth = 0;
  if ('ResizeObserver' in window)
    new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - lastTaskWidth) > 0.5) {
        lastTaskWidth = width;
        requestAnimationFrame(layoutTaskPicker);
      }
    }).observe($('#type-filters'));
  addEventListener('resize', layoutTaskPicker);
  addEventListener('resize', fitPromptAreas);
  document.fonts?.ready.then(() => {
    layoutTaskPicker();
    fitPromptAreas();
  });
}
// Original responsive task list. A selection larger than two rows remains fully visible.
function layoutTaskPicker() {
  const list = $('#type-filters'),
    toggle = $('#task-list-toggle');
  if (!list || !toggle) return;
  const original = [...list.children],
    inferred = new Set(searchPlan().tasks.map((t) => t.id)),
    focused = document.activeElement;
  const order = new Map(taskList.map((t, i) => [t.id, i]));
  const rank = (b) =>
    b.matches('.all-types')
      ? -3
      : !taskPickerExpanded && S.types.has(b.dataset.type)
        ? -2
        : inferred.has(b.dataset.type)
          ? -1
          : 0;
  const buttons = [...original].sort(
    (a, b) =>
      rank(a) - rank(b) || (order.get(a.dataset.type) ?? -1) - (order.get(b.dataset.type) ?? -1),
  );
  const moved = buttons.some((b, i) => b !== original[i]);
  if (moved) for (const b of buttons) list.append(b);
  for (const b of buttons) {
    b.hidden = false;
    b.classList.toggle('search-match', inferred.has(b.dataset.type));
  }
  const positions = buttons.map((b) => ({ b, top: b.offsetTop }));
  const rows = [...new Set(positions.map((x) => x.top))].sort((a, b) => a - b),
    cutoff = rows[1] ?? rows[0];
  const beyond = positions.filter((x) => x.top > cutoff + 1);
  const selectionOverflow =
    !taskPickerExpanded && beyond.some((x) => S.types.has(x.b.dataset.type));
  const hidden = taskPickerExpanded
    ? []
    : selectionOverflow
      ? buttons.filter((b) => b.dataset.type && !S.types.has(b.dataset.type))
      : beyond.map((x) => x.b);
  toggle.hidden = taskPickerExpanded ? !beyond.length : !hidden.length;
  toggle.setAttribute('aria-expanded', String(taskPickerExpanded));
  toggle.querySelector('span').textContent = taskPickerExpanded
    ? 'Свернуть список'
    : 'Показать все задачи · ещё ' + hidden.length;
  toggle.title = taskPickerExpanded
    ? 'Показать компактный список, сохранив все выбранные задачи'
    : 'Раскрыть полный список из ' + taskList.length + ' задач';
  for (const b of hidden) {
    if (b === document.activeElement) toggle.focus({ preventScroll: true });
    b.hidden = true;
  }
  if (moved && list.contains(focused)) {
    if (focused.hidden) toggle.focus({ preventScroll: true });
    else focused.focus({ preventScroll: true });
  }
  const selection = S.types.size ? 'Выбрано: ' + S.types.size : 'Все задачи';
  $('#task-selection-label').textContent = selection;
  $('#task-picker').dataset.expanded = String(taskPickerExpanded);
}
function reset() {
  applyPreferences();
  update();
}
