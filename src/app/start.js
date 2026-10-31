$('#legal-open').addEventListener('click', (e) => openDialog($('#legal-dialog'), e.currentTarget));
restorePreferences();
initControls();
update(false);
savePreferences();
initSimple();
initFirstRequest();
initWorkspace();
