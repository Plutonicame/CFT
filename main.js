// Initialisation et service worker

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════
loadSaved(); // Charge les données sauvegardées si elles existent
sanitizeExpenseSigns(); // Corrige les montants de dépenses mal signés
autoSave(); // Persiste la correction
applyCSSColors();
buildCatSwatches();
syncSwatches();
renderYrSwitch();
renderCatSelect();
renderAll();

// ── PWA : enregistrement du service worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
