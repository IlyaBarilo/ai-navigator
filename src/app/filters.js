function matches(t, f) {
  if (S.rfOnly && isRestricted(f)) return false;
  if (S.groups.size && !S.groups.has(priceGroup(f))) return false;
  if (f.quality.level < S.quality) return false;
  if (S.difficulty && f.difficulty.level > S.difficulty) return false;
  const plan = searchPlan();
  if (!matchesPresentation(f, plan.presentation)) return false;
  if (plan.tools.size && !plan.tools.has(t.id)) return false;
  if (!matchesQueryConditions(f, plan.filters)) return false;
  const terms = plan.terms;
  if (!terms.length) return true;
  const hay = searchableWords(t, f);
  return terms.every((w) => hay.some((token) => token.includes(w)));
}
function taskFunctions(task, eligible) {
  eligible = eligible.filter(
    (f) =>
      (!f.forTasks || f.forTasks.includes(task.id)) && !(f.excludeTasks || []).includes(task.id),
  );
  const rule = task.rule || {};
  if (rule.allCategories?.length) {
    if (!rule.allCategories.every((c) => eligible.some((f) => f.category === c))) return [];
    return eligible.filter((f) => rule.allCategories.includes(f.category));
  }
  return eligible.filter(
    (f) =>
      (rule.anyCategories || []).includes(f.category) ||
      (rule.anyTags || []).some((tag) => (f.tags || []).includes(tag)),
  );
}
function selectedMatches(t, accept = () => true) {
  const eligible = t.functions.filter((f) => accept(f) && matches(t, f));
  const requested = searchPlan().tasks;
  function matchTasks(tasks) {
    const ids = new Set(),
      taskNames = [];
    for (const task of tasks) {
      const matched = taskFunctions(task, eligible);
      if (matched.length) {
        taskNames.push(task.name);
        matched.forEach((f) => ids.add(f.id));
      }
    }
    return { matched: eligible.filter((f) => ids.has(f.id)), taskNames };
  }
  const manual = S.types.size
    ? matchTasks([...S.types].map((id) => taskMap.get(id)))
    : { matched: eligible, taskNames: [] };
  const fromSearch = requested.length
    ? matchTasks(requested)
    : { matched: eligible, taskNames: [] };
  if (!manual.matched.length || !fromSearch.matched.length)
    return { tool: t, matched: [], taskNames: [] };
  if (!S.types.size) return { tool: t, ...fromSearch };
  if (!requested.length) return { tool: t, ...manual };
  const ids = new Set([...manual.matched, ...fromSearch.matched].map((f) => f.id));
  return {
    tool: t,
    matched: eligible.filter((f) => ids.has(f.id)),
    taskNames: [...new Set([...manual.taskNames, ...fromSearch.taskNames])],
  };
}
