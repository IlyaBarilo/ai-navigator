const reliabilityRank = (t) => (t.reliability?.level === 'high' ? 1 : 0);
const reliabilityLabel = (t) =>
  t.reliability?.label || (reliabilityRank(t) ? 'Высокая' : 'Обычная');
const reliabilityReason = (t) => t.reliability?.reason || 'Редакционная оценка автора каталога.';
const freeAccessLabel = (t) => t.freeAccessLabel || 'Бесплатно / с лимитами';
function getVisible(accept) {
  const visible = D.tools.map((t) => selectedMatches(t, accept)).filter((x) => x.matched.length);
  const score = (x) => Math.max(...x.matched.map((f) => f.quality.level)),
    difficulty = (x) => Math.min(...x.matched.map((f) => f.difficulty.level)),
    access = (x) => Math.min(...x.matched.map((f) => groupRank.get(priceGroup(f))));
  visible.sort((a, b) => {
    if (S.sort === 'name') return a.tool.name.localeCompare(b.tool.name, 'ru');
    if (S.sort === 'quality')
      return (
        score(b) - score(a) ||
        difficulty(a) - difficulty(b) ||
        reliabilityRank(b.tool) - reliabilityRank(a.tool) ||
        a.tool.name.localeCompare(b.tool.name, 'ru')
      );
    if (S.sort === 'difficulty')
      return (
        difficulty(a) - difficulty(b) ||
        score(b) - score(a) ||
        reliabilityRank(b.tool) - reliabilityRank(a.tool) ||
        a.tool.name.localeCompare(b.tool.name, 'ru')
      );
    const musicOnly = S.types.size === 1 && (S.types.has('music') || S.types.has('song'));
    const songSearchOnly =
      !S.types.size &&
      searchPlan().tasks.length === 1 &&
      ['song', 'music'].includes(searchPlan().tasks[0].id);
    if (musicOnly || songSearchOnly) {
      if (a.tool.id === 'suno') return -1;
      if (b.tool.id === 'suno') return 1;
    }
    return (
      access(a) - access(b) ||
      score(b) - score(a) ||
      difficulty(a) - difficulty(b) ||
      reliabilityRank(b.tool) - reliabilityRank(a.tool) ||
      a.tool.name.localeCompare(b.tool.name, 'ru')
    );
  });
  return visible;
}
function capabilityVariant(f) {
  if (f.variant) return f.variant;
  return f.mode === 'local'
    ? 'Локально'
    : f.id === 'chatgpt-work'
      ? 'Work'
      : f.id === 'claude-code'
        ? 'Claude Code'
        : f.id === 'qwen-code'
          ? 'Qwen Code'
          : f.id === 'qwen-research'
            ? 'Deep Research'
            : f.id === 'leo-agent'
              ? 'Leo Agent'
              : f.id === 'krea-agent'
                ? 'Krea Agent'
                : f.id === 'kimi-agent'
                  ? 'Work / Agent'
                  : 'Онлайн';
}
function extraCapability(t, f) {
  const access =
    f.region === 'check'
      ? 'Доступ из РФ уточнить.'
      : isRestricted(f)
        ? 'Есть ограничения доступа из РФ.'
        : '';
  const hint = `${category.get(f.category).name} · ${capabilityVariant(f)}\n${f.name}\n${modeLabel[f.mode]} · Качество: ${f.quality.level}/5 · Сложность: ${f.difficulty.level}/5\n${access}${access ? ' ' : ''}Не входит в текущий подбор. Нажмите, чтобы открыть условия.`;
  return `<button type="button" class="extra-capability" data-function="${f.id}" data-details="${t.id}" data-focus-function="${f.id}" title="${esc(hint)}" aria-label="${esc(hint)}">${icon(f.category)}</button>`;
}
function card({ tool: t, matched, taskNames = [] }) {
  const matchIDs = new Set(matched.map((f) => f.id));
  const additional = t.functions.filter((f) => !matchIDs.has(f.id));
  const unknownAccess = matched.some((f) => f.region === 'check'),
    restrictedAccess = matched.some(isRestricted);
  const groups = [...new Set(matched.map((f) => priceGroup(f)))].sort(
    (a, b) => groupRank.get(a) - groupRank.get(b),
  );
  const levels = matched.map((f) => f.difficulty.level),
    lo = Math.min(...levels),
    hi = Math.max(...levels);
  const domain = new URL(t.url).hostname.replace(/^www\./, '');
  return `<article class="tool-card" data-tool="${t.id}"><div class="card-top"><h3>${esc(t.name)}</h3><span class="card-mark" title="${esc(category.get(matched[0].category).name)}">${icon(matched[0].category)}</span></div><p class="card-description">${esc(t.description)}</p>${taskNames.length ? `<p class="card-task-fit"><b>Подходит:</b> ${esc(taskNames.join(' · '))}</p>` : ''}<ul class="capability-list" aria-label="Подходящие возможности ${esc(t.name)}">${matched.map((f) => `<li class="capability matched" data-function="${f.id}" title="${esc(f.quality.scope)}">${icon(f.category)}<span class="cap-label">${esc(category.get(f.category).name)}<small>${esc(capabilityVariant(f))}</small></span>${stars(f.quality.level)}</li>`).join('')}</ul>${additional.length ? `<div class="extra-capabilities" role="group" aria-label="Другие возможности ${esc(t.name)}, вне текущего подбора"><span class="extra-capabilities-label">Также есть</span>${additional.map((f) => extraCapability(t, f)).join('')}</div>` : ''}<div class="card-access">${groups.map((g) => `<span class="access-tag ${g}">${esc(g === 'online-free' ? freeAccessLabel(t) : groupLabel[g])}</span>`).join('')}${unknownAccess ? '<span class="access-tag availability-unknown" data-availability="check">Доступ уточнить</span>' : ''}${restrictedAccess ? '<span class="access-tag rf-limited" data-availability="restricted">Есть ограничения РФ</span>' : ''}</div><div class="card-difficulty"><span>Сложность</span><span class="difficulty-rating"><span class="difficulty-symbols" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => icon('diamond', i < hi ? 'filled' : 'empty')).join('')}</span><span class="difficulty-value">${lo === hi ? lo : lo + '–' + hi}/5</span></span></div><div class="card-footer"><button class="details-button" type="button" data-details="${t.id}" aria-label="Возможности и условия: ${esc(t.name)}">Возможности и условия</button><a class="open-link" href="${esc(matched[0].url)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть ${esc(t.name)}" title="${esc(domain)}">Открыть ${icon('arrow')}</a></div></article>`;
}
function update(save = true) {
  for (const b of document.querySelectorAll('[data-type]'))
    b.setAttribute('aria-pressed', S.types.has(b.dataset.type));
  for (const b of document.querySelectorAll('[data-group]'))
    b.setAttribute('aria-pressed', S.groups.has(b.dataset.group));
  $('.all-types').setAttribute('aria-pressed', !S.types.size);
  $('.all-groups').setAttribute('aria-pressed', !S.groups.size);
  for (const b of document.querySelectorAll('#quality-stars button')) {
    const v = +b.dataset.quality;
    b.setAttribute('aria-checked', v === S.quality);
    b.tabIndex = v === S.quality ? 0 : -1;
    b.classList.toggle('filled', v > 0 && v <= S.quality);
  }
  $('#quality-value').textContent = S.quality ? S.quality + '/5' : '';
  $('#quality-value').hidden = !S.quality;
  $('#quality-value').setAttribute('aria-label', 'Качество от ' + S.quality + ' из 5');
  for (const b of document.querySelectorAll('#difficulty-filter [data-difficulty]')) {
    const v = +b.dataset.difficulty;
    b.setAttribute('aria-checked', v === S.difficulty);
    b.tabIndex = v === S.difficulty ? 0 : -1;
    if (v) {
      b.classList.toggle('filled', v <= S.difficulty);
    }
  }
  $('#difficulty-value').textContent = S.difficulty ? S.difficulty + '/5' : '';
  $('#difficulty-value').hidden = !S.difficulty;
  $('#difficulty-value').setAttribute('aria-label', 'Сложность до ' + S.difficulty + ' из 5');
  if ($('#search').value !== S.q) $('#search').value = S.q;
  $('#sort').value = S.sort;
  $('#rf-filter').setAttribute('aria-pressed', S.rfOnly);
  const selected = !!(
    S.types.size ||
    !(S.groups.size === 1 && S.groups.has('online-free')) ||
    S.quality ||
    S.difficulty ||
    S.q ||
    S.sort !== 'recommended' ||
    !S.rfOnly
  );
  $('#reset').disabled = !selected;
  const visible = getVisible();
  $('#cards').innerHTML = visible.map(card).join('');
  $('#cards').hidden = !visible.length;
  $('#empty').hidden = !!visible.length;
  $('#result-count').textContent = visible.length + ' из ' + D.tools.length;
  updateHeroCount(visible.length);
  const inferred = searchPlan().tasks;
  renderSearchFeedback();
  const parts = [
    S.types.size
      ? [...S.types].map((x) => taskMap.get(x).name).join(' + ')
      : inferred.length
        ? inferred.map((t) => t.name).join(' + ')
        : 'Все задачи',
    S.groups.size ? [...S.groups].map((x) => groupLabel[x]).join(' + ') : 'Все условия доступа',
  ];
  if (S.types.size && inferred.length)
    parts.push('Задача из поиска: ' + inferred.map((t) => t.name).join(' + '));
  parts.push(
    S.rfOnly ? 'Доступно в РФ · неподтверждённое отмечено' : 'Включая сервисы с ограничениями РФ',
  );
  if (searchPlan().filters.length)
    parts.push(
      'Из поиска: ' +
        searchPlan()
          .filters.map((f) => f.name)
          .join(', '),
    );
  if (S.quality) parts.push('Качество от ' + S.quality + '/5');
  if (S.difficulty) parts.push('Сложность до ' + S.difficulty + '/5');
  if (S.q) parts.push('Поиск: «' + S.q + '»');
  const named = searchPlan().tools.size > 0,
    hasQuery = !!S.q;
  $('#empty-title').textContent = named
    ? 'Сервис найден, но не подходит под выбранные условия'
    : hasQuery
      ? 'По запросу и выбранным условиям нет результатов'
      : 'Таких сочетаний пока нет';
  $('#empty-message').textContent =
    hasQuery && !inferred.length && !named
      ? 'Попробуйте название сервиса или задачу: «тест по физике», «изменить фото», «презентация». Также проверьте выбранные условия доступа.'
      : 'Попробуйте изменить доступ, стоимость, качество, сложность или выбранные задачи. Условия поиска и фильтров учитываются вместе.';
  $('#active-summary').textContent = parts.join(' · ');
  renderPrompts();
  layoutTaskPicker();
  if (save) {
    writeHash();
    savePreferences();
  }
}
