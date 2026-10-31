function initWorkspace() {
  for (const b of document.querySelectorAll('button[data-workspace]'))
    b.addEventListener('click', () => setWorkspace(b.dataset.workspace));
  const choose = () => {
    const anchor = location.hash.slice(1),
      sectionMode = {
        'catalog': 'catalog',
        'first-request': 'first',
        'simple-workspace': 'simple',
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
    const allowedQueryMode = ['simple', 'catalog', 'expert', 'first'].includes(queryMode)
      ? queryMode
      : 'simple';
    return params.get('view') || (catalogLink ? 'catalog' : allowedQueryMode);
  };
  setWorkspace(choose(), false);
  addEventListener('hashchange', () => {
    readSimpleHash();
    setWorkspace(choose(), false);
  });
}
