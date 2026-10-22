// Initialisation, connexion et service worker

let appStarted = false;

async function startApp(session) {
  if (appStarted) return;
  appStarted = true;
  currentUser = session.user;
  setSyncState('saving');

  try {
    await loadRemote();
    setSyncState('ok');
    // Premier lancement : on envoie les catégories par défaut (et l'import éventuel)
    autoSave();
  } catch (e) {
    console.error('Chargement Supabase :', e);
    dataLoaded = false;                 // pas d'écriture tant que le chargement n'a pas réussi
    loadCache();
    setSyncState('offline');
  }

  hideLogin();
  applyCSSColors();
  buildCatSwatches();
  syncSwatches();
  renderYrSwitch();
  const first = Object.keys(CATS)[0];
  if (first) selectCat(first);
  renderCatSelect();
  renderAll();
}

// Session déjà ouverte (ou retour de Google) ?
sb.auth.getSession().then(({ data }) => {
  if (data.session) startApp(data.session);
  else showLogin();
});
// setTimeout : on évite d'appeler Supabase directement dans le callback d'auth
sb.auth.onAuthStateChange((event, session) => {
  if (session && !appStarted) setTimeout(() => startApp(session), 0);
});

// ── PWA : enregistrement du service worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
