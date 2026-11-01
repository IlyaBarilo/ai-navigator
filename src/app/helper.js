// Original viewport-aware guide. It observes the local interface and never scrolls or focuses it.
function initMobileHelper() {
  const key = 'barilo.ai-catalog.helper.v1', mobile = matchMedia('(max-width: 600px)'),
    reduced = matchMedia('(prefers-reduced-motion: reduce)'), guide = $('#mobile-helper'),
    toggle = $('#helper-toggle'), message = $('#helper-message'),
    controls = toggle.parentElement, input = $('#simple-query'), flightDuration = 1700;
  let enabled = false, stage = 'input', signature = '', oldQuery = null, frame = 0,
    timer = 0, timerStage = '', active = false, launch = true, animation = null;
  try { enabled = localStorage.getItem(key) === 'true'; } catch (_) {}
  const viewport = () => {
    const v = window.visualViewport;
    return { left: v?.offsetLeft || 0, top: v?.offsetTop || 0,
      width: v?.width || innerWidth, height: v?.height || innerHeight };
  };
  const rect = (element) => element.getBoundingClientRect();
  function visible(r, v) { return r.width > 0 && r.height > 0 && r.top >= v.top + 6 && r.bottom <= v.top + v.height - 6; }
  function cancelTimer() { clearTimeout(timer); timer = 0; timerStage = ''; }
  function setStage(value) { if (stage !== value) { cancelTimer(); stage = value; } }
  function syncToggle() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = enabled ? 'Отключить помощника' : 'Включить помощника';
    toggle.setAttribute('aria-label', toggle.title);
  }
  function setEnabled(value, persist = true) {
    enabled = value; syncToggle(); cancelTimer();
    if (persist) { try { localStorage.setItem(key, String(enabled)); } catch (_) {} }
    if (!enabled) { animation?.cancel(); guide.hidden = true; }
    else launch = true;
    queue();
  }
  function fitControls() {
    controls.classList.remove('compact-display-controls');
    if (!mobile.matches || !toggle.getClientRects().length) return;
    const buttons = [$('#theme-toggle'), toggle, $('#text-size-toggle')],
      required = buttons.reduce((sum, button) => sum + rect(button).width, 0) +
        2 * (parseFloat(getComputedStyle(controls).columnGap) || 0);
    controls.classList.toggle('compact-display-controls', required > controls.clientWidth + 1);
  }
  function queue() { if (!frame) frame = requestAnimationFrame(updateGuide); }
  function say(text) {
    if (message.textContent !== text) { message.textContent = text; queue(); }
  }
  function arm(name, delay, next) {
    if (timerStage === name) return;
    cancelTimer(); timerStage = name;
    timer = setTimeout(() => { timer = 0; timerStage = ''; if (active && stage === name) { setStage(next); queue(); } }, delay);
  }
  function place(x, y, v, small = false) {
    guide.classList.toggle('helper-small', small);
    const w = guide.offsetWidth, h = guide.offsetHeight;
    x = Math.max(v.left + 8, Math.min(v.left + v.width - w - 8, x));
    y = Math.max(v.top + 8, Math.min(v.top + v.height - h - 8, y));
    const target = `translate(${x}px, ${y}px)`, previous = getComputedStyle(guide).transform;
    if (guide.style.transform === target && !launch) return;
    let from = previous === 'none' ? target : previous;
    if (launch) {
      const brand = rect($('.brand > svg'));
      from = `translate(${brand.left + brand.width / 2 - w + 21}px, ${brand.top + brand.height / 2 - h + 21}px)`;
      launch = false;
    }
    animation?.cancel(); guide.style.transform = target; guide.dataset.moving = 'false';
    if (!reduced.matches && from !== target && typeof guide.animate === 'function') {
      const m = new DOMMatrix(from), midpoint = `translate(${(m.e + x) / 2 + 12}px, ${(m.f + y) / 2 - 12}px)`;
      guide.dataset.moving = 'true';
      animation = guide.animate([{ transform: from }, { transform: midpoint }, { transform: target }],
        { duration: flightDuration, easing: 'cubic-bezier(.2,.7,.2,1)' });
      animation.onfinish = () => { guide.dataset.moving = 'false'; };
    }
  }
  function updateGuide() {
    frame = 0; fitControls();
    active = enabled && mobile.matches && document.body.dataset.workspace === 'simple' && !document.querySelector('dialog[open]');
    if (!active) { guide.hidden = true; cancelTimer(); return; }
    const q = P.q.trim(), nextSignature = JSON.stringify([q, P.access, P.rfOnly]),
      count = $('#simple-live-results').hidden ? 0 : $('#simple-results').children.length,
      hasTask = !!$('#simple-task-hints [data-simple-task]') || simplePlan().tools.size > 0;
    if (nextSignature !== signature) {
      const queryChanged = q !== oldQuery;
      signature = nextSignature; oldQuery = q; cancelTimer();
      if (!q) setStage('input');
      else if (!count) setStage('refine');
      else if (hasTask) setStage(queryChanged || stage === 'refine' || stage === 'input' ? 'access' : 'results');
      else setStage('input');
    }
    const config = {
      input: { target: input, text: 'Введите текст', hint: 'Введите текст' },
      refine: { target: input, text: 'Инструмент не найден. Дополните описание', hint: 'Дополните описание' },
      access: { target: $('[data-simple-access="free-online"]'), text: 'Выберите доступность', hint: 'выберите доступность' },
      results: { target: $('#simple-title-3'), text: 'Посмотрите результат', hint: 'посмотрите результат' },
      training: { target: $('#simple-learning button'), text: 'Могу помочь пользоваться ИИ-чатами. Пройдите обучение', hint: 'Могу помочь пользоваться ИИ-чатами' },
    }[stage];
    guide.hidden = false; guide.classList.remove('helper-small', 'helper-dock');
    guide.dataset.stage = stage;
    const v = viewport(), r = rect(config.target);
    const inView = visible(r, v);
    const obstacles = [rect(input), rect($('.masthead')), r];
    if (stage === 'access') for (const button of document.querySelectorAll('#simple-access-choices button')) obstacles.push(rect(button));
    const free = (y) => y >= v.top + 6 && y + guide.offsetHeight <= v.top + v.height - 6 &&
      !obstacles.some((box) => box.width && box.top < y + guide.offsetHeight + 6 && box.bottom > y - 6);
    const near = () => {
      const above = r.top - guide.offsetHeight - 8, below = r.bottom + 8;
      return (stage === 'input' || stage === 'refine' ? [above] : [below, above]).find(free);
    };
    if (inView) {
      say(config.text);
      let y = near();
      if (y === undefined) { guide.classList.add('helper-dock'); y = near(); }
      if (y !== undefined) {
        guide.dataset.waiting = 'false';
        place(r.right - guide.offsetWidth, y, v);
        const travel = reduced.matches ? 0 : flightDuration;
        if (stage === 'access') arm('access', 1000 + travel, 'results');
        if (stage === 'results') arm('results', 2800 + travel, 'training');
        return;
      }
    }
    cancelTimer(); guide.dataset.waiting = 'true';
    const above = r.top < v.top + 6, direction = above ? 'вверх' : 'вниз',
      hint = stage === 'training' ? `${config.hint}. Прокрутите ${direction}` :
        stage === 'refine' ? `Инструмент не найден. Прокрутите ${direction} и дополните описание` :
          `Прокрутите ${direction} — ${config.hint.toLocaleLowerCase('ru')}`;
    say(inView ? config.text : hint);
    const edge = () => {
      const top = v.top + 8, bottom = v.top + v.height - guide.offsetHeight - 8;
      return (above ? [top, bottom] : [bottom, top]).find(free);
    };
    let y = edge();
    if (y === undefined) {
      guide.classList.add('helper-dock');
      y = edge();
    }
    if (y === undefined) { guide.classList.remove('helper-dock'); guide.classList.add('helper-small'); y = edge(); }
    if (y === undefined) { guide.hidden = true; return; }
    place(v.left + v.width - guide.offsetWidth - 8, y, v);
  }
  toggle.addEventListener('click', () => setEnabled(!enabled));
  $('#helper-dismiss').addEventListener('click', () => setEnabled(false));
  const observer = new MutationObserver(queue);
  observer.observe($('#simple-workspace'), { childList: true, subtree: true, characterData: true });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-workspace'] });
  for (const dialog of document.querySelectorAll('dialog')) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
  window.visualViewport?.addEventListener('resize', queue); window.visualViewport?.addEventListener('scroll', queue);
  mobile.addEventListener('change', queue); reduced.addEventListener('change', queue);
  addEventListener('storage', (event) => { if (event.key === key) setEnabled(event.newValue === 'true', false); });
  if (typeof ResizeObserver === 'function') new ResizeObserver(queue).observe(controls);
  syncToggle(); queue();
}
