function openDialog(dialog, button) {
  returnFocus = button;
  dialog.showModal();
  dialog.querySelector('.dialog-body').scrollTop = 0;
  document.body.classList.add('dialog-open');
  syncDialogScrollbar(dialog);
  requestAnimationFrame(() => syncDialogScrollbar(dialog));
}
function syncDialogScrollbar(dialog) {
  if (!dialog.open) return;
  const body = dialog.querySelector('.dialog-body'), rail = dialog.querySelector('.dialog-scrollbar');
  if (!rail) return;
  const max = Math.max(0, body.scrollHeight - body.clientHeight), visible = max > 1;
  rail.hidden = !visible;
  body.parentElement.classList.toggle('is-scrollable', visible);
  if (!visible) return;
  const track = rail.querySelector('.dialog-scroll-track'), thumb = rail.querySelector('.dialog-scroll-thumb'),
    size = Math.min(track.clientHeight, Math.max(24, track.clientHeight * body.clientHeight / body.scrollHeight)),
    fraction = Math.max(0, Math.min(1, body.scrollTop / max));
  thumb.style.height = size + 'px';
  thumb.style.transform = 'translateY(' + (track.clientHeight - size) * fraction + 'px)';
  rail.setAttribute('aria-valuemax', Math.ceil(max));
  rail.setAttribute('aria-valuenow', Math.round(body.scrollTop));
  rail.setAttribute('aria-valuetext', Math.round(fraction * 100) + '%');
  rail.dataset.atStart = String(fraction < .001);
  rail.dataset.atEnd = String(fraction > .999);
}
function initDialogScrollbars() {
  for (const dialog of document.querySelectorAll('dialog')) {
    const body = dialog.querySelector('.dialog-body');
    if (!body) continue;
    const shell = document.createElement('div'), rail = document.createElement('div');
    shell.className = 'dialog-content';
    body.before(shell);
    shell.append(body, rail);
    body.id ||= dialog.id + '-content';
    body.tabIndex = 0;
    rail.className = 'dialog-scrollbar';
    rail.hidden = true;
    rail.tabIndex = 0;
    rail.setAttribute('role', 'scrollbar');
    rail.setAttribute('aria-label', 'Прокрутка содержимого окна');
    rail.setAttribute('aria-controls', body.id);
    rail.setAttribute('aria-orientation', 'vertical');
    rail.setAttribute('aria-valuemin', '0');
    rail.innerHTML = '<span class="dialog-scroll-arrow dialog-scroll-up" aria-hidden="true">' + icon('chevron') + '</span><span class="dialog-scroll-track"><span class="dialog-scroll-thumb"></span></span><span class="dialog-scroll-arrow dialog-scroll-down" aria-hidden="true">' + icon('chevron') + '</span>';
    const sync = () => syncDialogScrollbar(dialog);
    body.addEventListener('scroll', sync, { passive: true });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => requestAnimationFrame(sync)).observe(body);
    new MutationObserver(sync).observe(body, { childList: true, subtree: true, characterData: true });
    addEventListener('resize', sync);
    rail.addEventListener('keydown', (event) => {
      const amount = { ArrowDown: 40, ArrowUp: -40, PageDown: body.clientHeight * .85, PageUp: -body.clientHeight * .85 }[event.key];
      if (amount !== undefined) body.scrollTop += amount;
      else if (event.key === 'Home') body.scrollTop = 0;
      else if (event.key === 'End') body.scrollTop = body.scrollHeight;
      else return;
      event.preventDefault();
      sync();
    });
    let dragOffset = null;
    const move = (clientY) => {
      const track = rail.querySelector('.dialog-scroll-track').getBoundingClientRect(),
        thumb = rail.querySelector('.dialog-scroll-thumb').getBoundingClientRect(),
        travel = track.height - thumb.height;
      if (travel > 0) body.scrollTop = Math.max(0, Math.min(1, (clientY - track.top - dragOffset) / travel)) * (body.scrollHeight - body.clientHeight);
    };
    rail.addEventListener('pointerdown', (event) => {
      rail.focus({ preventScroll: true });
      if (event.target.closest('.dialog-scroll-up')) { body.scrollTop -= body.clientHeight * .85; return; }
      if (event.target.closest('.dialog-scroll-down')) { body.scrollTop += body.clientHeight * .85; return; }
      const thumb = rail.querySelector('.dialog-scroll-thumb').getBoundingClientRect();
      dragOffset = event.target.closest('.dialog-scroll-thumb') ? event.clientY - thumb.top : thumb.height / 2;
      rail.setPointerCapture(event.pointerId);
      move(event.clientY);
      event.preventDefault();
    });
    rail.addEventListener('pointermove', (event) => { if (dragOffset !== null) move(event.clientY); });
    rail.addEventListener('pointerup', () => { dragOffset = null; });
    rail.addEventListener('pointercancel', () => { dragOffset = null; });
    rail.addEventListener('lostpointercapture', () => { dragOffset = null; });
  }
}
function openDetails(id, button, functionId) {
  const t = D.tools.find((x) => x.id === id);
  if (!t) return;
  $('#details-title').textContent = t.name;
  $('#details-content').innerHTML =
    `<p class="dialog-intro">${esc(t.description)}</p>${t.functions.map((f) => `<section class="capability-detail" data-detail-function="${f.id}"><h3>${icon(capabilityIcon(f))}${esc(capabilityLabel(f))}${f.mode === 'local' ? ' · локально' : ''}</h3><div class="detail-badges"><span class="access-tag ${priceGroup(f)}">${esc(priceGroup(f) === 'online-free' ? freeAccessLabel(t) : groupLabel[priceGroup(f)])}</span><span class="detail-price">${esc(priceGroup(f) === 'online-free' && t.freeAccessLabel ? t.freeAccessLabel : modeLabel[f.mode])}</span>${f.region === 'check' ? '<span class="access-tag availability-unknown">Доступ уточнить</span>' : isRestricted(f) ? '<span class="access-tag rf-limited">Есть ограничения работы в РФ</span>' : ''}</div><p class="detail-description">${esc(f.name)}. ${esc(f.description)}</p><div class="rating-box"><strong>Качество ${f.quality.level}/5 · ${esc(f.quality.name)}</strong><p><b>Оцениваем:</b> ${esc(f.quality.scope)} ${esc(f.quality.reason)}</p></div><p class="detail-difficulty"><b>Сложность ${f.difficulty.level}/5 · ${esc(f.difficulty.name)}.</b> ${esc(f.difficulty.reason)}</p><dl class="detail-facts"><dt>Без оплаты</dt><dd>${esc(f.free)}</dd><dt>Платно</dt><dd>${esc(f.paid)}</dd><dt>Доступ из РФ</dt><dd>${esc(f.region_detail)}</dd></dl>${f.hardware ? `<div class="hardware"><b>${esc(f.hardware.label)}</b><p>${esc(f.hardware.detail)}</p></div>` : ''}<nav class="source-links" aria-label="Ссылки для ${esc(f.name)}"><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">Открыть инструмент ↗</a>${f.sources.map((k) => `<a href="${esc(D.sources[k].url)}" target="_blank" rel="noopener noreferrer">${esc(D.sources[k].title)}</a>`).join('')}</nav></section>`).join('')}`;
  openDialog($('#details-dialog'), button);
  if (functionId) {
    const section = [...$('#details-content').querySelectorAll('[data-detail-function]')].find(
      (e) => e.dataset.detailFunction === functionId,
    );
    if (section) {
      section.tabIndex = -1;
      section.classList.add('targeted-function');
      section.focus({ preventScroll: true });
      section.scrollIntoView({ block: 'start' });
    }
  }
}
