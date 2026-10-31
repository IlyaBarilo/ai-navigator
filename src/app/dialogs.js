function openDialog(dialog, button) {
  returnFocus = button;
  dialog.showModal();
  dialog.querySelector('.dialog-body').scrollTop = 0;
  document.body.classList.add('dialog-open');
}
function openDetails(id, button, functionId) {
  const t = D.tools.find((x) => x.id === id);
  if (!t) return;
  $('#details-title').textContent = t.name;
  $('#details-content').innerHTML =
    `<p class="dialog-intro">${esc(t.description)}</p>${t.functions.map((f) => `<section class="capability-detail" data-detail-function="${f.id}"><h3>${icon(f.category)}${esc(category.get(f.category).name)}${f.mode === 'local' ? ' · локально' : ''}</h3><div class="detail-badges"><span class="access-tag ${priceGroup(f)}">${esc(priceGroup(f) === 'online-free' ? freeAccessLabel(t) : groupLabel[priceGroup(f)])}</span><span class="detail-price">${esc(priceGroup(f) === 'online-free' && t.freeAccessLabel ? t.freeAccessLabel : modeLabel[f.mode])}</span>${f.region === 'check' ? '<span class="access-tag availability-unknown">Доступ уточнить</span>' : isRestricted(f) ? '<span class="access-tag rf-limited">Есть ограничения РФ</span>' : ''}</div><p class="detail-description">${esc(f.name)}. ${esc(f.description)}</p><div class="rating-box"><strong>Качество ${f.quality.level}/5 · ${esc(f.quality.name)}</strong><p><b>Оцениваем:</b> ${esc(f.quality.scope)} ${esc(f.quality.reason)}</p></div><p class="detail-difficulty"><b>Сложность ${f.difficulty.level}/5 · ${esc(f.difficulty.name)}.</b> ${esc(f.difficulty.reason)}</p><dl class="detail-facts"><dt>Без оплаты</dt><dd>${esc(f.free)}</dd><dt>Платно</dt><dd>${esc(f.paid)}</dd><dt>Доступ из РФ</dt><dd>${esc(f.region_detail)}</dd></dl>${f.hardware ? `<div class="hardware"><b>${esc(f.hardware.label)}</b><p>${esc(f.hardware.detail)}</p></div>` : ''}<nav class="source-links" aria-label="Ссылки для ${esc(f.name)}"><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">Открыть инструмент ↗</a>${f.sources.map((k) => `<a href="${esc(D.sources[k].url)}" target="_blank" rel="noopener noreferrer">${esc(D.sources[k].title)}</a>`).join('')}</nav></section>`).join('')}`;
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
