// Export JSON et sauvegarde automatique (localStorage)

// ════════════════════════════════════════════════════════
//  EXPORT JSON — copie de sauvegarde des données
// ════════════════════════════════════════════════════════
// Les données sont déjà enregistrées automatiquement dans le navigateur (voir plus bas).
// Ce bouton télécharge en plus une copie de sauvegarde au format JSON.
function saveToFile() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'cashflow_data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ════════════════════════════════════════════════════════
//  AUTOSAVE — localStorage (persiste entre les ouvertures)
// ════════════════════════════════════════════════════════
const STORAGE_KEY = 'cashflow_db_v1';

function autoSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  } catch(e) { /* silencieux */ }
}

function loadSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(y => { DB[parseInt(y)] = parsed[y]; });
      return true;
    }
  } catch(e) { /* silencieux */ }
  return false;
}

// Sauvegarde automatique quand on quitte / ferme la page
window.addEventListener('beforeunload', () => { autoSave(); });
// Sauvegarde aussi quand la page passe en arrière-plan (mobile, changement d'onglet)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoSave(); });

// Corrige les entrées déjà enregistrées où un montant de dépense aurait été
// saisi en négatif (ex: -30 au lieu de 30), ce qui faussait Fortune nette.
function sanitizeExpenseSigns() {
  Object.keys(DB).forEach(y => {
    (DB[y]||[]).forEach(e => {
      if (CATS[e.cat] && CATS[e.cat].sign < 0) e.amt = Math.abs(e.amt);
    });
  });
}
