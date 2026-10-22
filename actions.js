// Navigation, années, ajout d'entrées et catégories

// ════════════════════════════════════════════════════════
//  NAV & YEAR
// ════════════════════════════════════════════════════════
function goTab(idx, btn) {
  document.querySelectorAll('.pg').forEach((p,i) => p.classList.toggle('on', i===idx));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  if (idx===1) setTimeout(renderPNL,60);
  if (idx===2) setTimeout(renderFortune,60);
}

// ── Sélecteur d'année (année libre, saisie manuelle) ───
function renderYrSwitch() {
  const el = document.getElementById('yrSwitch');
  if (!el) return;
  el.innerHTML = '<span class="yr-current">'+yr+'</span>'
    + '<button class="yr-edit-btn" onclick="startYrEdit()" title="Changer d\'année"><i class="ti ti-calendar-event"></i></button>';
}
function startYrEdit() {
  const el = document.getElementById('yrSwitch');
  if (!el) return;
  el.innerHTML = '<input type="number" id="yrInput" class="yr-input" value="'+yr+'">'
    + '<button class="yr-edit-btn" onclick="confirmYrEdit()" title="Valider"><i class="ti ti-check"></i></button>';
  const inp = document.getElementById('yrInput');
  if (inp) {
    inp.focus(); inp.select();
    inp.addEventListener('keydown', e => { if (e.key==='Enter') confirmYrEdit(); });
  }
}
function confirmYrEdit() {
  const inp = document.getElementById('yrInput');
  const v = inp ? parseInt(inp.value) : NaN;
  if (!isNaN(v) && v > 1900 && v < 3000) yr = v;
  renderYrSwitch();
  renderAll();
}

// ════════════════════════════════════════════════════════
//  ADD
// ════════════════════════════════════════════════════════
function doAdd() {
  const cat   = document.getElementById('aCat').value;
  const desc  = document.getElementById('aDesc').value.trim() || 'Entrée';
  const month = parseInt(document.getElementById('aMon').value);
  let amt     = parseFloat(document.getElementById('aAmt').value) || 0;
  // Les catégories de type "dépense" (sign < 0) sont toujours stockées en magnitude
  // positive : le signe négatif est appliqué automatiquement au calcul/affichage.
  // Sans ça, saisir "-30" au lieu de "30" annule le signe deux fois (bug de calcul).
  if (CATS[cat] && CATS[cat].sign < 0) amt = Math.abs(amt);
  if (!DB[yr]) DB[yr] = [];
  DB[yr].push({cat,desc,month,amt});
  document.getElementById('aDesc').value = '';
  document.getElementById('aAmt').value  = '';
  renderAll();
}

// ════════════════════════════════════════════════════════
//  NOUVELLE CATÉGORIE (nouvelle source de revenu / dépense)
// ════════════════════════════════════════════════════════
const NEW_CAT_COLORS = ['#22d3a0','#3b9eff','#f59e0b','#a78bfa','#2dd4bf','#f472b6','#facc15','#38bdf8','#fb923c','#4ade80'];
let newCatColorIdx = 0;

function toggleNewCat() {
  const box = document.getElementById('newCatBox');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}
function slugifyCat(str) {
  const base = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/(^_+|_+$)/g,'');
  return 'cat_' + (base || Date.now());
}
function createCategory() {
  const nameInp = document.getElementById('ncName');
  const name = nameInp.value.trim();
  if (!name) { nameInp.focus(); return; }
  const sign = 1;

  let key = slugifyCat(name), base = key, n = 1;
  while (CATS[key]) key = base + '_' + (n++);

  const color = NEW_CAT_COLORS[newCatColorIdx % NEW_CAT_COLORS.length];
  newCatColorIdx++;

  CATS[key] = { label:name, icon:'ti-tag', bg:color+'22', ic:color, bar:color, sign };
  CLR.cats[key] = { bg:CATS[key].bg, ic:color, bar:color };

  selectCat(key);

  nameInp.value = '';
  document.getElementById('newCatBox').style.display = 'none';
  buildCatSwatches();
  syncSwatches();
}

// ── Menu déroulant personnalisé (catégorie) avec suppression inline ──
function toggleCatDropdown() {
  const menu = document.getElementById('aCatMenu');
  if (!menu) return;
  const open = menu.style.display !== 'none';
  menu.style.display = open ? 'none' : 'block';
  if (!open) renderCatSelect();
}
function renderCatSelect() {
  const cur = document.getElementById('aCat').value;
  const labelEl = document.getElementById('aCatLabel');
  if (labelEl && CATS[cur]) labelEl.textContent = CATS[cur].label;

  const menu = document.getElementById('aCatMenu');
  if (!menu) return;
  menu.innerHTML = Object.keys(CATS).map(k =>
    '<div class="custom-select-opt'+(k===cur?' sel':'')+'">'
    + '<span class="custom-select-opt-name" onclick="selectCat(\''+k+'\')">'+CATS[k].label+'</span>'
    + '<button type="button" class="chip-del" onclick="event.stopPropagation(); deleteCategory(\''+k+'\')" title="Supprimer cette catégorie">&times;</button>'
    + '</div>'
  ).join('');
}
function selectCat(key) {
  document.getElementById('aCat').value = key;
  const labelEl = document.getElementById('aCatLabel');
  if (labelEl && CATS[key]) labelEl.textContent = CATS[key].label;
  const menu = document.getElementById('aCatMenu');
  if (menu) menu.style.display = 'none';
}
document.addEventListener('click', e => {
  const wrap = document.getElementById('aCatWrap');
  const menu = document.getElementById('aCatMenu');
  if (wrap && menu && !wrap.contains(e.target)) menu.style.display = 'none';
});

function deleteCategory(key) {
  if (!CATS[key]) return;
  if (Object.keys(CATS).length <= 1) { alert('Il doit rester au moins une catégorie.'); return; }

  let count = 0;
  Object.keys(DB).forEach(y => { count += (DB[y]||[]).filter(e => e.cat===key).length; });
  const label = CATS[key].label;
  const msg = count > 0
    ? 'Supprimer la catégorie "'+label+'" supprimera aussi '+count+' transaction'+(count>1?'s':'')+' associée'+(count>1?'s':'')+'. Continuer ?'
    : 'Supprimer la catégorie "'+label+'" ?';
  if (!confirm(msg)) return;

  Object.keys(DB).forEach(y => { DB[y] = (DB[y]||[]).filter(e => e.cat!==key); });
  delete CATS[key];
  delete CLR.cats[key];

  if (document.getElementById('aCat').value === key) {
    const remaining = Object.keys(CATS);
    if (remaining.length) selectCat(remaining[0]);
  }

  autoSave();
  buildCatSwatches();
  syncSwatches();
  renderCatSelect();
  renderAll();
}
