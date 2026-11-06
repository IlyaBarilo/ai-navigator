function readCatalog() {
  let D;
  try {
    D = JSON.parse(document.getElementById('catalog-data').textContent);
    if (!Array.isArray(D.tools) || !Array.isArray(D.categories) || !Array.isArray(D.groups))
      throw Error('Проверьте разделы tools, categories и groups.');
    const names = new Set(),
      ids = new Set();
    for (const t of D.tools) {
      if (!t.id || !t.name || !t.description || !Array.isArray(t.functions) || !t.functions.length)
        throw Error('У инструмента нужны id, name, description и functions.');
      if (names.has(t.id)) throw Error('Повторяется id инструмента: ' + t.id);
      names.add(t.id);
      if (!/^https:\/\//.test(t.url))
        throw Error('У ' + t.name + ' нужна ссылка https в поле url.');
      for (const f of t.functions) {
        if (!f.id || ids.has(f.id))
          throw Error('У ' + t.name + ' отсутствует или повторяется id возможности.');
        ids.add(f.id);
        if (
          !D.categories.some((x) => x.id === f.category) ||
          !['free', 'limited', 'paid', 'local'].includes(f.mode) ||
          !['ru', 'available', 'check', 'blocked', 'challenge', 'local'].includes(f.region)
        )
          throw Error('У ' + t.name + ' проверьте category, mode и region.');
        if (f.displayLabel !== undefined &&
            (typeof f.displayLabel !== 'string' || !f.displayLabel.trim()))
          throw Error('У ' + t.name + ' displayLabel должен быть непустой подписью.');
        if (f.displayIcon !== undefined &&
            (!/^[a-z0-9-]+$/.test(f.displayIcon) || !document.getElementById('icon-' + f.displayIcon)))
          throw Error('У ' + t.name + ' displayIcon должен обозначать встроенный значок.');
        if (f.delivery !== undefined) {
          const delivery = f.delivery, formats = D.search?.presentation?.formats || [],
            methods = ['download', 'save-code', 'browser-print', 'integration', 'local-build', 'web'];
          if (!delivery || !Array.isArray(delivery.outputs) ||
              typeof delivery.requirements !== 'string' ||
              (delivery.note !== undefined && typeof delivery.note !== 'string') ||
              delivery.outputs.some((o) => !o || !formats.some((x) => x.id === o.format) ||
                !methods.includes(o.method) || !['yes', 'no', 'unknown'].includes(o.editable) ||
                !Array.isArray(o.sources) || !o.sources.length || !o.sources.every((s) => D.sources?.[s]) ||
                (o.note !== undefined && typeof o.note !== 'string')))
            throw Error('У ' + t.name + ' проверьте delivery: формат, способ, редактируемость и источники.');
        }
        if (
          !f.quality ||
          !f.difficulty ||
          ![f.quality.level, f.difficulty.level].every(
            (n) => Number.isInteger(n) && n >= 1 && n <= 5,
          )
        )
          throw Error(
            'У ' + t.name + ' оценки quality.level и difficulty.level должны быть от 1 до 5.',
          );
        if (
          !Array.isArray(f.sources) ||
          !f.sources.every((k) => D.sources?.[k]) ||
          !/^https:\/\//.test(f.url)
        )
          throw Error('У ' + t.name + ' проверьте sources и ссылку https в url.');
      }
    }
    if (D.tasks) {
      if (!Array.isArray(D.tasks)) throw Error('Раздел tasks должен быть списком задач.');
      const taskGroupIds = new Set(['general', 'teaching']);
      if (D.taskGroups) {
        if (!Array.isArray(D.taskGroups))
          throw Error('Раздел taskGroups должен быть списком групп задач.');
        taskGroupIds.clear();
        for (const g of D.taskGroups) {
          if (!/^[a-z0-9-]+$/.test(g.id) || !g.name || taskGroupIds.has(g.id))
            throw Error('Проверьте id и name в taskGroups.');
          taskGroupIds.add(g.id);
        }
      }
      const taskIds = new Set(), promptCodes = new Set();
      for (const task of D.tasks) {
        if (
          !/^[a-z0-9-]+$/.test(task.id) ||
          taskIds.has(task.id) ||
          !task.name ||
          !Array.isArray(task.prompts)
        )
          throw Error('Проверьте id, name и prompts в tasks.');
        taskIds.add(task.id);
        if (task.group && !taskGroupIds.has(task.group))
          throw Error('Неизвестная группа задачи ' + task.name + ' — проверьте taskGroups.');
        if (!/^[a-z0-9-]+$/.test(task.icon))
          throw Error('В tasks.icon нужен служебный код значка.');
        for (const c of [...(task.rule?.anyCategories || []), ...(task.rule?.allCategories || [])])
          if (!D.categories.some((x) => x.id === c))
            throw Error('Неизвестная категория в правиле задачи ' + task.name);
        const keys = new Set();
        for (const example of task.prompts) {
          if (
            !/^[a-z0-9-]+$/.test(example.id) ||
            keys.has(example.id) ||
            typeof example.text !== 'string'
          )
            throw Error('Проверьте id и text примера для ' + task.name);
          keys.add(example.id);
          // Older readable catalogs may not yet carry prompt references.
          if (example.code !== undefined || example.revision !== undefined) {
            if (!/^P[0-9]{3,}$/.test(example.code) || promptCodes.has(example.code) ||
                !Number.isSafeInteger(example.revision) || example.revision < 1)
              throw Error('Проверьте уникальный code и положительный revision примера для ' + task.name);
            promptCodes.add(example.code);
          }
        }
        if (
          task.searchAliases &&
          (!Array.isArray(task.searchAliases) ||
            task.searchAliases.some((x) => typeof x !== 'string'))
        )
          throw Error('Проверьте searchAliases задачи ' + task.name);
      }
    }
    if (D.search) {
      if (D.search.presentation) {
        const p = D.search.presentation;
        if (!Array.isArray(p.formats) || new Set(p.formats.map((x) => x.id)).size !== p.formats.length ||
            p.formats.some((f) => !/^[a-z0-9-]+$/.test(f.id) || typeof f.name !== 'string' ||
              !Array.isArray(f.aliases) || f.aliases.some((a) => typeof a !== 'string' || !a.trim())) ||
            ['editableAliases', 'directAliases', 'sourcePrefixes', 'sourceFillers'].some((k) =>
              !Array.isArray(p[k]) || p[k].some((a) => typeof a !== 'string' || !a.trim())))
          throw Error('Проверьте форматы и формулировки в search.presentation.');
      }
      if (
        !Array.isArray(D.search.synonymGroups) ||
        !Array.isArray(D.search.stopWords) ||
        D.search.stopWords.some((x) => typeof x !== 'string')
      )
        throw Error('Проверьте словарь search.');
      for (const g of D.search.synonymGroups)
        if (
          typeof g.canonical !== 'string' ||
          !g.canonical.trim() ||
          !Array.isArray(g.words) ||
          !Array.isArray(g.prefixes) ||
          [...g.words, ...g.prefixes].some((x) => typeof x !== 'string' || !x.trim())
        )
          throw Error('Проверьте слова и основы в search.synonymGroups.');
    }
  } catch (error) {
    const message = document.createElement('div');
    message.id = 'catalog-data-error';
    message.className = 'data-error';
    const title = document.createElement('h2');
    title.textContent = 'Проверьте описания в HTML';
    const text = document.createElement('p');
    text.textContent =
      'Не удалось прочитать блок «ДАННЫЕ КАТАЛОГА». Проверьте кавычки, запятые и обязательные поля. Сохраните исправления и обновите страницу.';
    const detail = document.createElement('pre');
    detail.textContent = error.message;
    message.append(title, text, detail);
    document.querySelector('#cards').replaceChildren(message);
    document.querySelector('.filter-panel').hidden = true;
    document.querySelector('.result-actions').hidden = true;
    document.querySelector('#result-count').textContent = 'Ошибка данных';
    document.querySelector('#total-tools').textContent = '—';
    return;
  }
  return D;
}
