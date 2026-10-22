// Utilitaires

// ════════════════════════════════════════════════════════
//  UTILITAIRES
// ════════════════════════════════════════════════════════
let yr = 2026, pChart = null, fChart = null, fAreaChart = null, pieChart = null;
const fmt = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const fmtS = n => (n >= 0 ? '+' : '') + fmt(n);
const rows = () => DB[yr] || [];

// Nombre de mois à afficher sur les graphiques (12 max, ou jusqu'au mois actuel pour l'année en cours)
const months = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (yr === currentYear) return now.getMonth() + 1; // mois actuel inclus
  if (yr > currentYear) return 1; // année future : au moins 1
  return 12; // années passées : 12 mois
};

const msum = (cat, m) => rows().filter(e => e.cat===cat && e.month===m).reduce((s,e) => s+e.amt, 0);
// catTotal additionne TOUTES les entrées de la catégorie, sans filtre de mois
const catTotal = cat => rows().filter(e => e.cat===cat).reduce((s,e) => s+e.amt, 0);

// Index du mois "courant" à considérer : le mois actuel pour l'année en cours,
// sinon le dernier mois affiché (décembre pour une année passée).
const currentMonthIdx = () => months() - 1;

function calcKPI() {
  let rev=0, exp=0, trd=0;
  Object.keys(CATS).forEach(k => {
    const t = catTotal(k);
    if (k==='depenses') exp += t;
    else if (k==='trading') trd += t;
    else rev += t;
  });
  return { rev, exp, trd, net: rev+trd-exp };
}

// Même calcul que calcKPI() mais limité à un seul mois (m), pour le budget mensuel.
function calcMonthKPI(m) {
  let rev=0, exp=0, trd=0;
  Object.keys(CATS).forEach(k => {
    const t = msum(k, m);
    if (k==='depenses') exp += t;
    else if (k==='trading') trd += t;
    else rev += t;
  });
  return { rev, exp, trd, net: rev+trd-exp };
}

function renderKPI(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(({l,v,c}) =>
    '<div class="kpi" style="--kpi-color:'+c+'">'
    +'<div class="kpi-label">'+l+'</div>'
    +'<div class="kpi-value" style="color:'+c+'">'+v+'</div></div>'
  ).join('');
}
