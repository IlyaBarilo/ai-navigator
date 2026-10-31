const STORAGE_KEY = 'barilo.ai-catalog.preferences.v1';
const S = {
  types: new Set(),
  groups: new Set(['online-free']),
  quality: 0,
  difficulty: 0,
  q: '',
  sort: 'recommended',
  rfOnly: true,
};
let returnFocus = null,
  activeWorkspace = 'catalog';
function applyPreferences(p = {}) {
  if (!p || typeof p !== 'object') p = {};
  S.types = new Set((Array.isArray(p.types) ? p.types : []).filter((x) => taskMap.has(x)));
  S.groups = new Set(
    (Array.isArray(p.groups) ? p.groups : ['online-free']).filter(
      (x) => x !== 'online-paid' && group.has(x),
    ),
  );
  S.quality = Number.isInteger(p.quality) ? Math.max(0, Math.min(5, p.quality)) : 0;
  S.difficulty = Number.isInteger(p.difficulty) ? Math.max(0, Math.min(5, p.difficulty)) : 0;
  S.q = typeof p.q === 'string' ? p.q.slice(0, 200) : '';
  S.sort = ['recommended', 'quality', 'difficulty', 'name'].includes(p.sort)
    ? p.sort
    : 'recommended';
  S.rfOnly = typeof p.rfOnly === 'boolean' ? p.rfOnly : true;
}
function savePreferences() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        types: [...S.types],
        groups: [...S.groups],
        quality: S.quality,
        difficulty: S.difficulty,
        q: S.q,
        sort: S.sort,
        rfOnly: S.rfOnly,
      }),
    );
  } catch (_) {}
}
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('view') === 'simple') return false;
  if (
    !['types', 'groups', 'quality', 'difficulty', 'q', 'sort', 'rf', 'exact'].some((k) => p.has(k))
  )
    return false;
  applyPreferences({
    types: (p.get('types') || '').split(','),
    groups: (p.get('groups') || '').split(','),
    quality: parseInt(p.get('quality'), 10) || 0,
    difficulty: parseInt(p.get('difficulty'), 10) || 0,
    q: p.get('q') || '',
    sort: p.get('sort') || 'recommended',
    rfOnly: p.get('rf') !== '0',
  });
  return true;
}
function restorePreferences() {
  try {
    applyPreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch (_) {
    applyPreferences();
  }
  readHash();
}
function writeHash() {
  if (activeWorkspace === 'simple') {
    writeSimpleHash();
    return;
  }
  const p = new URLSearchParams();
  if (S.types.size) p.set('types', [...S.types].join(','));
  p.set('groups', [...S.groups].join(','));
  if (S.quality) p.set('quality', S.quality);
  if (S.difficulty) p.set('difficulty', S.difficulty);
  if (S.q) p.set('q', S.q);
  if (S.sort !== 'recommended') p.set('sort', S.sort);
  if (!S.rfOnly) p.set('rf', '0');
  p.set('view', activeWorkspace === 'first' ? 'first' : 'catalog');
  try {
    history.replaceState(null, '', location.pathname + location.search + (p.size ? '#' + p : ''));
  } catch (_) {}
}
