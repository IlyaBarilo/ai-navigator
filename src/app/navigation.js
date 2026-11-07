const pickerModes = ['steps', 'simple', 'catalog'],
  pickerModeNames = { steps: 'По шагам', simple: 'Просто', catalog: 'Эксперт' };
let previousPickerMode = 'steps';
function syncModeToggle() {
  if (pickerModes.includes(activeWorkspace)) previousPickerMode = activeWorkspace;
  const current = pickerModeNames[previousPickerMode],
    nextMode = activeWorkspace === 'first' ? previousPickerMode : pickerModes[(pickerModes.indexOf(previousPickerMode) + 1) % pickerModes.length],
    description = activeWorkspace === 'first'
      ? 'Вернуться в режим «' + current + '».'
      : 'Режим: ' + current + '. Нажмите для режима ' + pickerModeNames[nextMode] + '.';
  $('#mode-label').textContent = current;
  $('#mode-toggle').title = description;
  $('#mode-toggle').setAttribute('aria-label', description);
}
function initWorkspace() {
  $('#mode-toggle').addEventListener('click', () => {
    const next = activeWorkspace === 'first' ? previousPickerMode : pickerModes[(pickerModes.indexOf(activeWorkspace) + 1) % pickerModes.length];
    setWorkspace(next);
  });
  for (const b of document.querySelectorAll('button[data-workspace]'))
    b.addEventListener('click', () => setWorkspace(b.dataset.workspace));
  const choose = () => {
    const anchor = location.hash.slice(1),
      sectionMode = {
        'catalog': 'catalog',
        'first-request': 'first',
        'simple-workspace': 'simple',
        'steps': 'steps',
      }[anchor];
    if (sectionMode) return sectionMode;
    const params = new URLSearchParams(anchor);
    const catalogLink = [
      'types',
      'groups',
      'quality',
      'difficulty',
      'q',
      'sort',
      'rf',
      'exact',
    ].some((key) => params.has(key));
    const queryMode = new URLSearchParams(location.search).get('view');
    const allowedQueryMode = ['steps', 'simple', 'catalog', 'expert', 'first'].includes(queryMode)
      ? queryMode
      : 'steps';
    return params.get('view') || (catalogLink ? 'catalog' : allowedQueryMode);
  };
  setWorkspace(choose(), false);
  const restoreLocation = (fromCache = false) => {
    if (fromCache || !location.hash) restoreSimplePreferences();
    readSimpleHash();
    if (!location.hash) guidedStep = 1;
    else readGuidedStep();
    setWorkspace(choose(), false);
  };
  addEventListener('hashchange', () => restoreLocation());
  addEventListener('pageshow', (event) => {
    if (event.persisted) restoreLocation(true);
  });
}
