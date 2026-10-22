// Synchronisation Supabase (tables categories / transactions / user_settings)
// + export JSON manuel + cache local de secours (lecture hors-ligne)

// ════════════════════════════════════════════════════════
//  EXPORT JSON — copie de sauvegarde des données
// ════════════════════════════════════════════════════════
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
//  ÉTAT
// ════════════════════════════════════════════════════════
const LEGACY_KEY = 'cashflow_db_v1';          // ancien stockage 100 % local
let currentUser = null;
let dataLoaded  = false;                      // true seulement si le chargement distant a réussi
let syncTimer = null, syncing = false, syncAgain = false;
// Ce qui est déjà côté serveur (pour ne renvoyer que les différences)
const snap = { tx: new Map(), cats: new Map(), settings: '' };

const txSig  = (e, y) => JSON.stringify([parseInt(y), e.month, e.cat, e.desc, e.amt]);
const catSig = k => { const c = CATS[k]; return JSON.stringify([c.label, c.icon, c.bg, c.ic, c.bar, c.sign]); };
const settingsObj = () => ({ pos: CLR.pos, neg: CLR.neg, charts: CLR.charts });

function setSyncState(state) {
  const el = document.getElementById('syncState');
  if (!el) return;
  const map = {
    ok:      ['ti-cloud-check',  'Synchronisé',                       'var(--pos)'],
    saving:  ['ti-cloud-upload', 'Synchronisation…',                  'var(--txt2)'],
    error:   ['ti-cloud-off',    'Échec de synchronisation (nouvel essai automatique)', 'var(--neg)'],
    offline: ['ti-cloud-off',    'Hors-ligne : lecture seule',        'var(--neg)'],
  };
  const [icon, title, color] = map[state];
  el.innerHTML = '<i class="ti ' + icon + '"></i>';
  el.title = title; el.style.color = color;
}

// ════════════════════════════════════════════════════════
//  CHARGEMENT
// ════════════════════════════════════════════════════════
function resetCats(catRows) {
  Object.keys(CATS).forEach(k => delete CATS[k]);
  Object.keys(CLR.cats).forEach(k => delete CLR.cats[k]);
  catRows.forEach(r => {
    CATS[r.key] = { label: r.label, icon: r.icon, bg: r.bg, ic: r.ic, bar: r.bar, sign: r.sign };
    CLR.cats[r.key] = { bg: r.bg, ic: r.ic, bar: r.bar };
  });
}

function applySettings(colors) {
  if (!colors) return;
  if (colors.pos) CLR.pos = colors.pos;
  if (colors.neg) CLR.neg = colors.neg;
  if (Array.isArray(colors.charts) && colors.charts.length === 3) CLR.charts = colors.charts.slice();
}

async function fetchAllTransactions() {
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('transactions')
      .select('id,year,month,cat,descr,amt,tjp_import_id').order('id').range(from, from + 999);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

// Anciennes données du navigateur (avant Supabase), pour un premier import
function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    let n = 0; Object.keys(parsed).forEach(y => { n += (parsed[y] || []).length; });
    return n ? { data: parsed, count: n } : null;
  } catch (e) { return null; }
}

function importLegacy(legacy) {
  Object.keys(legacy.data).forEach(y => {
    const list = (legacy.data[y] || []).map(e => {
      // Catégorie inconnue (ancienne catégorie perso non sauvegardée) : on la recrée
      if (!CATS[e.cat]) {
        CATS[e.cat] = { label: e.cat, icon: 'ti-tag', bg: '#1a1a24', ic: '#888780', bar: '#888780', sign: 1 };
        CLR.cats[e.cat] = { bg: '#1a1a24', ic: '#888780', bar: '#888780' };
      }
      return { cat: e.cat, desc: e.desc || 'Entrée', month: e.month, amt: Number(e.amt) || 0 };
    });
    DB[parseInt(y)] = list;
  });
}

async function loadRemote() {
  const [cr, sr, tx] = await Promise.all([
    sb.from('categories').select('*'),
    sb.from('user_settings').select('colors').maybeSingle(),
    fetchAllTransactions()
  ]);
  if (cr.error) throw cr.error;
  if (sr.error) throw sr.error;

  Object.keys(DB).forEach(y => delete DB[y]);
  snap.tx.clear(); snap.cats.clear(); snap.settings = '';

  if (cr.data.length === 0 && tx.length === 0) {
    // Premier lancement avec ce compte : catégories par défaut (+ import éventuel de l'ancien stockage local)
    resetCats(Object.keys(DEFAULT_CATS).map(k => Object.assign({ key: k }, DEFAULT_CATS[k])));
    const legacy = readLegacy();
    if (legacy && confirm('Des données locales (' + legacy.count + ' transactions) ont été trouvées sur cet appareil.\nLes importer dans ton compte ?')) {
      importLegacy(legacy);
    }
  } else {
    resetCats(cr.data);
    tx.forEach(r => {
      const y = r.year;
      if (!DB[y]) DB[y] = [];
      const e = { id: r.id, cat: r.cat, desc: r.descr, month: r.month, amt: Number(r.amt) };
      if (r.tjp_import_id) e.tjp = r.tjp_import_id;   // importée depuis TJP : non modifiable
      DB[y].push(e);
      snap.tx.set(r.id, txSig(e, y));
    });
    Object.keys(CATS).forEach(k => snap.cats.set(k, catSig(k)));
    applySettings(sr.data && sr.data.colors);
    snap.settings = JSON.stringify(settingsObj());
  }
  sanitizeExpenseSigns();
  dataLoaded = true;
}

// Cache local (lecture seule si le réseau est indisponible)
const cacheKey = () => 'cashflow_cache_v2_' + (currentUser ? currentUser.id : '');
function writeCache() {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ DB, CATS, colors: settingsObj() })); } catch (e) {}
}
function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey());
    if (!raw) return false;
    const c = JSON.parse(raw);
    resetCats(Object.keys(c.CATS).map(k => Object.assign({ key: k }, c.CATS[k])));
    Object.keys(DB).forEach(y => delete DB[y]);
    Object.keys(c.DB).forEach(y => { DB[parseInt(y)] = c.DB[y]; });
    applySettings(c.colors);
    return true;
  } catch (e) { return false; }
}

// ════════════════════════════════════════════════════════
//  ÉCRITURE (envoie uniquement ce qui a changé)
// ════════════════════════════════════════════════════════
function autoSave() {
  if (!currentUser) return;
  writeCache();
  if (!dataLoaded) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 500);
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

async function syncNow() {
  if (!currentUser || !dataLoaded) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    const uid = currentUser.id;

    // 1) Catégories créées / modifiées (avant les transactions : clé étrangère)
    const catRows = [];
    Object.keys(CATS).forEach(k => {
      const sig = catSig(k);
      if (snap.cats.get(k) !== sig) {
        const c = CATS[k];
        catRows.push({ row: { user_id: uid, key: k, label: c.label, icon: c.icon, bg: c.bg, ic: c.ic, bar: c.bar, sign: c.sign }, sig });
      }
    });
    if (catRows.length) {
      const { error } = await sb.from('categories').upsert(catRows.map(r => r.row), { onConflict: 'user_id,key' });
      if (error) throw error;
      catRows.forEach(r => snap.cats.set(r.row.key, r.sig));
    }

    // 2) Transactions : ajouts, modifications, suppressions
    const inserts = [], updates = [], present = new Set();
    Object.keys(DB).forEach(y => (DB[y] || []).forEach(e => {
      const sig = txSig(e, y);
      const row = { year: parseInt(y), month: e.month, cat: e.cat, descr: e.desc, amt: e.amt };
      if (e.id == null) inserts.push({ e, row: Object.assign({ user_id: uid }, row), sig });
      else {
        present.add(e.id);
        if (snap.tx.get(e.id) !== sig) updates.push({ id: e.id, row, sig });
      }
    }));
    const deletes = [...snap.tx.keys()].filter(id => !present.has(id));

    for (const part of chunk(inserts, 500)) {
      const { data, error } = await sb.from('transactions').insert(part.map(p => p.row)).select('id');
      if (error) throw error;
      part.forEach((p, i) => { p.e.id = data[i].id; snap.tx.set(data[i].id, p.sig); });
    }
    for (const part of chunk(updates, 20)) {
      const res = await Promise.all(part.map(u => sb.from('transactions').update(u.row).eq('id', u.id)));
      res.forEach(r => { if (r.error) throw r.error; });
      part.forEach(u => snap.tx.set(u.id, u.sig));
    }
    for (const part of chunk(deletes, 200)) {
      const { error } = await sb.from('transactions').delete().in('id', part);
      if (error) throw error;
      part.forEach(id => snap.tx.delete(id));
    }

    // 3) Catégories supprimées
    const gone = [...snap.cats.keys()].filter(k => !CATS[k]);
    if (gone.length) {
      const { error } = await sb.from('categories').delete().in('key', gone);
      if (error) throw error;
      gone.forEach(k => snap.cats.delete(k));
    }

    // 4) Couleurs
    const sSig = JSON.stringify(settingsObj());
    if (sSig !== snap.settings) {
      const { error } = await sb.from('user_settings')
        .upsert({ user_id: uid, colors: settingsObj(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      snap.settings = sSig;
    }
    setSyncState('ok');
  } catch (e) {
    console.error('Sync Supabase :', e);
    setSyncState('error');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 15000);   // nouvel essai automatique
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 200); }
  }
}

window.addEventListener('online', () => { if (dataLoaded) syncNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { writeCache(); if (dataLoaded) syncNow(); } });

// Corrige les montants de dépenses saisis en négatif (ex : -30 au lieu de 30)
function sanitizeExpenseSigns() {
  Object.keys(DB).forEach(y => {
    (DB[y]||[]).forEach(e => {
      if (CATS[e.cat] && CATS[e.cat].sign < 0) e.amt = Math.abs(e.amt);
    });
  });
}
