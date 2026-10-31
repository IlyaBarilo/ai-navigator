// Original generated theme control: The theme is independent of filter resets.
const THEME_STORAGE_KEY = 'barilo.ai-catalog.theme.v1';
function applyTheme(theme, persist = false) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const button = document.getElementById('theme-toggle');
  button.setAttribute('aria-pressed', dark);
  button.title = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
  button.querySelector('.theme-label').textContent = dark ? 'Тёмная' : 'Светлая';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#171c30' : '#f5f7fc';
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (_) {}
  }
}
applyTheme(document.documentElement.dataset.theme);
document
  .getElementById('theme-toggle')
  .addEventListener('click', () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true),
  );
// Original text-size control. New 100% uses the author-selected former 150% base.
const TEXT_SCALE_KEY = 'barilo.ai-catalog.text-scale.v2',
  TEXT_SCALES = [100, 120, 150, 50, 75];
function applyTextScale(value, persist = false) {
  const size = TEXT_SCALES.includes(Number(value)) ? Number(value) : 100,
    next = TEXT_SCALES[(TEXT_SCALES.indexOf(size) + 1) % TEXT_SCALES.length];
  document.documentElement.dataset.textScale = String(size);
  document.documentElement.style.setProperty('--ui-text-scale', String(size / 100));
  const button = document.getElementById('text-size-toggle');
  document.getElementById('text-size-label').textContent = size + '%';
  button.title = 'Размер текста: ' + size + '%. Следующий: ' + next + '%.';
  button.setAttribute('aria-label', 'Размер текста ' + size + '%. Нажмите для ' + next + '%.');
  if (persist) {
    try {
      localStorage.setItem(TEXT_SCALE_KEY, String(size));
    } catch (_) {}
  }
  requestAnimationFrame(() => dispatchEvent(new Event('resize')));
}
applyTextScale(document.documentElement.dataset.textScale);
document.getElementById('text-size-toggle').addEventListener('click', () => {
  const index = TEXT_SCALES.indexOf(Number(document.documentElement.dataset.textScale));
  applyTextScale(TEXT_SCALES[(index + 1) % TEXT_SCALES.length], true);
});
