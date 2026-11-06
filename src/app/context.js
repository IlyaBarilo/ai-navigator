const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
const category = new Map(D.categories.map((x) => [x.id, x])),
  group = new Map(D.groups.map((x) => [x.id, x]));
const taskList = Array.isArray(D.tasks)
  ? D.tasks
  : D.categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.id,
      rule: { anyCategories: [c.id] },
      prompts: [],
    }));
const taskMap = new Map(taskList.map((t) => [t.id, t]));
const taskGroups = Array.isArray(D.taskGroups)
  ? D.taskGroups
  : [
      { id: 'general', name: 'Общие возможности' },
      { id: 'teaching', name: 'Задачи педагога' },
    ];
const taskGroupMap = new Map(taskGroups.map((g) => [g.id, g]));
let taskPickerExpanded = false;
const promptDrafts = new Map();
let promptSelection = '', activePromptKey = '';
let promptWorkspace = '', promptDisclosureOpen = false;
const promptPositions = new Map();
const groupRank = new Map(D.groups.map((x, i) => [x.id, i]));
const groupLabel = {
  'online-free': 'Бесплатно / с лимитами',
  'online-paid': 'Платно',
  local: 'Локально',
};
const filterGroupLabel = {
  ...groupLabel,
  'online-free': 'Бесплатно онлайн / с лимитами',
  local: 'Бесплатно локально / У меня игровая видеокарта',
};
const priceGroup = (f) =>
  f.mode === 'local' ? 'local' : f.mode === 'paid' ? 'online-paid' : 'online-free';
const isRestricted = (f) => f.region === 'blocked' || f.region === 'challenge';
const modeLabel = {
  free: 'Бесплатно',
  limited: 'Ограниченно бесплатно',
  paid: 'Платно',
  local: 'Локальный запуск',
};
const icon = (name, extra = '') =>
  `<svg class="icon ${extra}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
const qualityScore = (f) => f.quality.level ?? 0;
const qualityLabel = (f) => f.quality.level === null ? 'Качество не оценено' : 'Качество ' + f.quality.level + '/5 · ' + f.quality.name;
const stars = (n, full = true) => n === null
  ? `<span class="quality-unrated" aria-label="Качество не оценено">${full ? 'Качество не оценено' : 'Не оценено'}</span>`
  : `<span class="mini-rating" role="img" aria-label="Качество ${n} из 5">${Array.from({ length: 5 }, (_, i) => icon('star', i < n ? 'filled' : 'empty')).join('')}${full ? `<span class="numeric">${n}/5</span>` : ''}</span>`;
const normalize = (s) => String(s).toLocaleLowerCase('ru').replaceAll('ё', 'е');
