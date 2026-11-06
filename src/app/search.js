// Original small, editable synonym index. No remote search or third-party dictionary.
const searchOptions = D.search || {};
const synonymGroups = (searchOptions.synonymGroups || []).map((g) => ({
  canonical: normalize(g.canonical),
  words: new Set((g.words || []).map(normalize)),
  prefixes: (g.prefixes || []).map(normalize),
}));
const stopWords = new Set((searchOptions.stopWords || []).map(normalize));
function searchWords(value) {
  return (normalize(value).match(/[\p{L}\p{N}]+/gu) || [])
    .filter((w) => !stopWords.has(w))
    .map((w) => {
      const synonym = synonymGroups.find(
        (g) =>
          w === g.canonical || g.words.has(w) || g.prefixes.some((prefix) => w.startsWith(prefix)),
      );
      return synonym ? synonym.canonical : w;
    });
}
// Original local query planner. Lesson context is separate from tool/feature constraints.
const queryFilters = searchOptions.queryFilters || [],
  technicalTerms = new Set((searchOptions.technicalTerms || []).flatMap(searchWords));
// A generic capability fragment such as Agent is not an independent product name.
const genericCapabilityQueries = new Set(D.categories.map((c) => searchWords(c.name).join(' ')));
const toolQueries = D.tools.flatMap((t) =>
  [
    ...new Set(
      [t.name, ...t.aliases]
        .flatMap((label) => label.split(/[·→+]/)[0].split('/'))
        .map((label) => searchWords(label).join(' '))
        .filter(
          (label) =>
            label &&
            (!genericCapabilityQueries.has(label) || label === searchWords(t.name).join(' ')),
        ),
    ),
  ].map((label) => ({ tool: t, terms: label.split(' ') })),
);
const nameWords = new Set(toolQueries.flatMap((x) => x.terms));
const functionSearchCache = new WeakMap();
let cachedQuery = null,
  cachedSearchPlan = null;
const mostSpecific = (candidates) =>
  candidates.filter(
    (c) =>
      !candidates.some(
        (other) =>
          other.terms.length > c.terms.length && c.terms.every((w) => other.terms.includes(w)),
      ),
  );
function presentationRequest(query, tasks) {
  const options = searchOptions.presentation || {}, raw = normalize(query).match(/[\p{L}\p{N}]+/gu) || [],
    hasPhrase = (phrase) => {
      const terms = normalize(phrase).match(/[\p{L}\p{N}]+/gu) || [];
      return terms.length && raw.some((_, i) => terms.every((word, j) => raw[i + j] === word));
    },
    mentioned = (options.formats || []).filter((f) => f.aliases.some(hasPhrase)),
    requested = mentioned.filter((f) => f.aliases.some((alias) => {
      const terms = normalize(alias).match(/[\p{L}\p{N}]+/gu) || [];
      return raw.some((_, i) => {
        if (!terms.every((word, j) => raw[i + j] === word)) return false;
        let before = i - 1;
        while (before >= 0 && (options.sourceFillers || []).includes(raw[before])) before--;
        return !(options.sourcePrefixes || []).includes(raw[before]);
      });
    })),
    active = tasks.some((t) => t.id === 'slides') ||
      (!tasks.length && requested.some((f) => f.id === 'pptx'));
  return {
    active: active && (requested.length > 0 || (options.editableAliases || []).some(hasPhrase) || (options.directAliases || []).some(hasPhrase)),
    formats: active ? requested.map((f) => f.id) : [],
    editable: active && (options.editableAliases || []).some(hasPhrase),
    direct: active && (options.directAliases || []).some(hasPhrase),
    words: active ? [...mentioned.flatMap((f) => f.aliases.filter(hasPhrase).flatMap(searchWords)),
      ...(options.editableAliases || []).filter(hasPhrase).flatMap(searchWords),
      ...(options.directAliases || []).filter(hasPhrase).flatMap(searchWords)] : [],
  };
}
function presentationOutputs(f, request) {
  return (f.delivery?.outputs || []).filter((o) =>
    (!request?.editable || o.editable === 'yes') &&
    (!request?.direct || o.method === 'download') &&
    (!request?.formats.length || request.formats.includes(o.format)));
}
function matchesPresentation(f, request) {
  if (!request?.active) return true;
  if (f.category !== 'slides') return false;
  const outputs = presentationOutputs(f, request);
  return request.formats.length ? request.formats.every((format) => outputs.some((o) => o.format === format)) : outputs.length > 0;
}
function presentationRequestLabel(request) {
  const formats = (searchOptions.presentation?.formats || []).filter((f) => request.formats.includes(f.id)).map((f) => f.name);
  return [...formats, ...(request.editable ? ['редактируемый результат'] : []), ...(request.direct ? ['скачивание файла'] : [])].join(' · ');
}
function searchPlan() {
  if (cachedQuery === S.q) return cachedSearchPlan;
  const words = [...new Set(searchWords(S.q))],
    contains = (terms) => terms.length && terms.every((w) => words.includes(w));
  const brands = mostSpecific(toolQueries.filter((x) => contains(x.terms)));
  const filterCandidates = queryFilters
    .flatMap((filter) =>
      filter.aliases.map((alias) => ({ filter, terms: [...new Set(searchWords(alias))] })),
    )
    .filter((x) => contains(x.terms));
  const filters = [
    ...new Map(mostSpecific(filterCandidates).map((x) => [x.filter.id, x.filter])).values(),
  ];
  const checks = (searchOptions.checkConditions || []).filter((c) =>
    c.aliases.some((alias) => contains(searchWords(alias))),
  );
  const reserved = new Set([
    ...brands.flatMap((x) => x.terms),
    ...mostSpecific(filterCandidates).flatMap((x) => x.terms),
    ...checks.flatMap((c) => c.aliases.flatMap(searchWords).filter((w) => words.includes(w))),
  ]);
  const taskWords = words.filter((w) => !reserved.has(w)),
    candidates = [];
  for (const task of taskList)
    for (const alias of [task.name, ...(task.searchAliases || [])]) {
      const terms = [...new Set(searchWords(alias))];
      if (terms.length && terms.every((w) => taskWords.includes(w)))
        candidates.push({ task, terms });
    }
  const selected = mostSpecific(candidates),
    tasks = [...new Map(selected.map((x) => [x.task.id, x.task])).values()],
    presentation = presentationRequest(S.q, tasks);
  if (presentation.active && !tasks.length && taskMap.has('slides')) tasks.push(taskMap.get('slides'));
  const consumed = new Set([...reserved, ...selected.flatMap((x) => x.terms), ...presentation.words]),
    remaining = words.filter((w) => !consumed.has(w));
  const terms = tasks.length
    ? remaining.filter(
        (w) =>
          technicalTerms.has(w) ||
          (w.length >= 3 && [...nameWords].some((name) => name.startsWith(w))),
      )
    : remaining;
  cachedQuery = S.q;
  cachedSearchPlan = {
    tasks,
    terms,
    context: remaining.filter((w) => !terms.includes(w)),
    tools: new Set(brands.map((x) => x.tool.id)),
    filters,
    checks,
    presentation,
  };
  return cachedSearchPlan;
}
function matchesQueryConditions(f, filters) {
  const price = filters.filter((x) => x.group === 'price'),
    location = filters.filter((x) => x.group === 'location');
  return (
    (!price.length ||
      price.some((x) => (x.id === 'free' ? f.mode !== 'paid' : f.mode === 'paid'))) &&
    (!location.length ||
      location.some((x) => (x.id === 'local' ? f.mode === 'local' : f.mode !== 'local')))
  );
}
function renderSearchFeedback() {
  const plan = searchPlan(),
    box = $('#search-feedback');
  let text = !S.q
    ? 'Напишите задачу своими словами или название сервиса. Например: «тест по физике для 7 класса».'
    : plan.tasks.length
      ? 'Подбор по задаче: ' + plan.tasks.map((t) => t.name).join(' + ') + '.'
      : 'Поиск по названиям и описаниям инструментов.';
  if (plan.filters.length)
    text += ' Условия из поиска: ' + plan.filters.map((f) => f.name).join(', ') + '.';
  if (plan.context.length)
    text += ' Предмет, класс и тему можно уточнить в задании для выбранного сервиса.';
  if (plan.checks.length) text += ' ' + plan.checks.map((c) => c.message).join(' ');
  if (plan.presentation.active) text += ' Требуемый результат: ' + presentationRequestLabel(plan.presentation) + '. Неподтверждённые форматы не включены.';
  $('#search-controls').hidden = !plan.tasks.some((t) => t.prompts?.length);
  box.querySelector('p').textContent = text;
  box.querySelector('.search-task-actions').innerHTML = plan.tasks
    .filter((t) => t.prompts?.length)
    .map(
      (t) =>
        `<button type="button" class="search-task-action" data-search-task="${esc(t.id)}">${plan.tasks.length === 1 ? 'Показать пример запроса' : 'Пример: ' + esc(t.name)}</button>`,
    )
    .join('');
}
function searchableWords(t, f) {
  if (!functionSearchCache.has(f))
    functionSearchCache.set(
      f,
      searchWords(
        [
          t.name,
          t.description,
          ...t.aliases,
          f.name,
          category.get(f.category).name,
          f.description,
          f.free,
          f.paid,
          f.region_detail,
          f.quality.scope,
          f.hardware?.label || '',
          f.hardware?.detail || '',
          ...(f.delivery?.outputs || []).map((o) => o.format),
        ].join(' '),
      ),
    );
  return functionSearchCache.get(f);
}
