// Three screens share the original simple matcher and its access preferences.
let guidedStep = 1;
function guidedQueryCount(beforeAccess = guidedStep === 1) {
  const plan = simplePlan(), meaningful = P.q.trim() &&
    (plan.tasks.length || plan.tools.size || plan.terms.length || plan.filters.length);
  return meaningful ? simpleVisible({ beforeAccess }).length : 0;
}
function readGuidedStep() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('view') !== 'steps') return;
  const step = Number(params.get('step'));
  guidedStep = P.q.trim() && [1, 2, 3].includes(step) ? step : 1;
}
function renderGuided() {
  const guided = activeWorkspace === 'steps', root = $('#simple-workspace'),
    learning = $('#simple-learning'), results = $('#simple-live-results'), controls = $('#guided-controls');
  if (!guided) {
    root.setAttribute('aria-label', 'Простой подбор инструментов');
    if (activeWorkspace === 'catalog') $('#catalog-learning-slot').append(learning);
    else results.insertBefore(learning, $('#simple-results-note'));
    root.append(controls);
    delete document.body.dataset.guidedStep;
    return;
  }
  if (!P.q.trim()) guidedStep = 1;
  document.body.dataset.guidedStep = String(guidedStep);
  root.setAttribute('aria-label', 'Подбор инструментов по шагам');
  const count = guidedQueryCount(), canContinue = Boolean(P.q.trim()) && count > 0;
  $('#guided-query-found').textContent = count;
  $('#guided-query-total').textContent = D.tools.length;
  $('#guided-count-explainer').textContent = guidedStep === 1
    ? 'По описанию, до выбора доступа.'
    : 'С учётом выбранного доступа.';
  $('#guided-status').textContent = 'По шагам · Шаг ' + guidedStep + ' из 3';
  for (const marker of document.querySelectorAll('[data-guided-marker]')) {
    if (Number(marker.dataset.guidedMarker) === guidedStep) marker.setAttribute('aria-current', 'step');
    else marker.removeAttribute('aria-current');
  }
  results.insertBefore(learning, $('#simple-results-note'));
  if (guidedStep === 3) results.insertBefore(controls, $('#simple-results-note'));
  else $('#' + (guidedStep === 1 ? 'simple-input-page' : 'simple-access-page')).append(controls);
  $('#guided-back').hidden = guidedStep === 1;
  $('#guided-back').textContent = guidedStep === 3 ? '← Назад к доступу' : '← Назад к описанию';
  $('#guided-edit-query').hidden = guidedStep !== 3;
  $('#guided-next').hidden = guidedStep === 3;
  $('#guided-next').disabled = !canContinue;
  $('#guided-next').textContent = guidedStep === 1 ? 'Далее' : 'Показать результаты →';
  $('#guided-input-hint').hidden = guidedStep === 3 || canContinue;
  $('#guided-input-hint').textContent = guidedStep === 2
    ? 'С такими условиями нейросети не найдены. Измените доступ или вернитесь к описанию.'
    : P.q.trim()
      ? 'Нейросети не найдены. Дополните описание или выберите другой пример.'
      : 'Напишите задачу или выберите пример, чтобы перейти дальше.';
}
function goGuidedStep(step) {
  if (activeWorkspace !== 'steps') return;
  if (step > guidedStep && guidedQueryCount() === 0) return;
  guidedStep = P.q.trim() ? Math.max(1, Math.min(3, step)) : 1;
  renderSimple();
  writeSimpleHash();
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#simple-title-' + guidedStep).focus({ preventScroll: true });
}
function initGuided() {
  readGuidedStep();
  $('#guided-next').addEventListener('click', () => goGuidedStep(guidedStep + 1));
  $('#guided-back').addEventListener('click', () => goGuidedStep(guidedStep - 1));
  $('#guided-edit-query').addEventListener('click', () => goGuidedStep(1));
}
