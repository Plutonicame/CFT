// Liaison TJP (journal de trading) : import automatique du PnL en transactions « Trading »
// Le jeton TJP est stocké UNIQUEMENT dans la table Supabase `tjp_link` (protégée par RLS),
// jamais dans ce code, jamais dans le dépôt, jamais dans l'URL après le retour de TJP, jamais dans les logs.

const TJP_APP_URL = 'https://plutonicame.github.io/TradingJournalPro/';
const TJP_API_URL = 'https://ghjashqgwlaofjubzrcp.supabase.co/functions/v1/cashflow-pnl';
const TJP_STATE_KEY = 'tjp_state';

let tjpLink = null;       // { token, accounts, status, linked_at, last_sync_at } ou null
let tjpBusy = false;
let tjpNote = null;       // { ok:boolean, text:string } message affiché dans la boîte
let tjpPending = null;    // jeton reçu au retour de TJP, en attente d'enregistrement
let tjpFlash = null;

// ════════════════════════════════════════════════════════
//  RETOUR DE TJP : lecture du fragment (#tjp_token=… / #tjp_error=…)
//  Exécuté dès le chargement : on vérifie le state PUIS on efface le hash immédiatement.
// ════════════════════════════════════════════════════════
(function captureTjpHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw || (raw.indexOf('tjp_token') < 0 && raw.indexOf('tjp_error') < 0)) return;
  const p = new URLSearchParams(raw);
  const expected = sessionStorage.getItem(TJP_STATE_KEY);
  // Le jeton ne doit jamais rester dans l'URL
  history.replaceState(null, '', location.pathname + location.search);
  if (!expected || p.get('state') !== expected) return;   // state inconnu : on ignore tout
  sessionStorage.removeItem(TJP_STATE_KEY);
  if (p.get('tjp_token')) {
    let accounts = [];
    try {
      const a = JSON.parse(p.get('accounts') || '[]');
      if (Array.isArray(a)) accounts = a.filter(x => x && x.id != null).map(x => ({ id: String(x.id), name: String(x.name || x.id) }));
    } catch (e) {}
    const token = p.get('tjp_token');
    if (/^tjpc_/.test(token)) tjpPending = { token, accounts };
  } else if (p.get('tjp_error')) {
    tjpFlash = { ok: false, text: 'Autorisation refusée dans TJP : aucune liaison créée.' };
  }
})();

// ════════════════════════════════════════════════════════
//  CONNEXION
// ════════════════════════════════════════════════════════
function connectTjp() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(TJP_STATE_KEY, state);
  location.href = TJP_APP_URL + '?cashflow_link=1'
    + '&return=' + encodeURIComponent(appUrl())
    + '&state=' + state
    + '&label=' + encodeURIComponent('Cashflow Tracker');
}

async function tjpLoadLink() {
  const { data, error } = await sb.from('tjp_link').select('token,accounts,status,linked_at,last_sync_at').maybeSingle();
  if (error) throw error;
  tjpLink = data || null;
}

async function tjpSaveLink(token, accounts) {
  const row = { user_id: currentUser.id, token, accounts, status: 'active', linked_at: new Date().toISOString(), last_sync_at: null };
  const { error } = await sb.from('tjp_link').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
  tjpLink = { token, accounts, status: 'active', linked_at: row.linked_at, last_sync_at: null };
}

async function tjpDisconnect() {
  if (!tjpLink || tjpBusy) return;
  if (!confirm('Déconnecter TJP ?\nLes synchronisations automatiques s\'arrêteront.')) return;
  let n = 0;
  Object.keys(DB).forEach(y => { n += (DB[y] || []).filter(e => e.tjp).length; });
  let purge = false;
  if (n > 0) purge = confirm('Supprimer aussi les ' + n + ' transactions importées depuis TJP ?\n\nOK = les supprimer\nAnnuler = les garder (marquées « TJP », non modifiables)');
  tjpBusy = true; renderTjp();
  try {
    const { error } = await sb.from('tjp_link').delete().eq('user_id', currentUser.id);
    if (error) throw error;
    tjpLink = null;
    if (purge) {
      const r = await sb.from('transactions').delete().not('tjp_import_id', 'is', null);
      if (r.error) throw r.error;
      Object.keys(DB).forEach(y => {
        DB[y] = (DB[y] || []).filter(e => {
          if (e.tjp) { if (e.id != null) snap.tx.delete(e.id); return false; }
          return true;
        });
      });
      writeCache();
    }
    tjpNote = { ok: true, text: purge ? 'TJP déconnecté, transactions importées supprimées.' : 'TJP déconnecté, transactions importées conservées.' };
  } catch (e) {
    console.error('TJP déconnexion :', e && e.message);
    tjpNote = { ok: false, text: 'Déconnexion impossible (réseau ?). Réessaie.' };
  } finally {
    tjpBusy = false; renderTjp(); renderAll();
  }
}

// ════════════════════════════════════════════════════════
//  APPEL À L'API PnL
// ════════════════════════════════════════════════════════
const TJP_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function tjpFetch(token) {
  let res;
  try {
    res = await fetch(TJP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  } catch (e) { return { kind: 'network' }; }
  if (res.status === 401) return { kind: 'invalid' };
  if (!res.ok) return { kind: 'server', status: res.status };
  let j;
  try { j = await res.json(); } catch (e) { return { kind: 'bad' }; }
  if (!j || !Array.isArray(j.trades) || !Array.isArray(j.accounts)) return { kind: 'bad' };

  const want = new Map();   // dédoublonnage par id
  for (const t of j.trades) {
    if (!t || typeof t.id !== 'string' || !t.id || typeof t.date !== 'string' || !TJP_DATE_RE.test(t.date)
        || typeof t.amount !== 'number' || !isFinite(t.amount)) return { kind: 'bad' };
    const year = parseInt(t.date.slice(0, 4), 10), month = parseInt(t.date.slice(5, 7), 10) - 1;
    if (year < 1900 || year > 2999 || month < 0 || month > 11) return { kind: 'bad' };
    const name = String(t.account_name || 'Compte');
    want.set(t.id, {
      tjp_import_id: t.id,
      year, month,
      cat: 'trading',
      descr: 'TJP · ' + name + ' · ' + t.date.slice(8, 10) + '/' + t.date.slice(5, 7),
      amt: Math.round(t.amount * 100) / 100
    });
  }
  const accounts = j.accounts.filter(a => a && a.id != null).map(a => ({ id: String(a.id), name: String(a.name || a.id) }));
  return { kind: 'ok', want, accounts };
}

// ════════════════════════════════════════════════════════
//  SYNCHRONISATION
// ════════════════════════════════════════════════════════
async function fetchImportedRows() {
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('transactions')
      .select('id,year,month,cat,descr,amt,tjp_import_id')
      .not('tjp_import_id', 'is', null).order('id').range(from, from + 999);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function ensureTradingCat() {
  if (CATS.trading) return;
  const d = DEFAULT_CATS.trading;
  CATS.trading = Object.assign({}, d);
  CLR.cats.trading = { bg: d.bg, ic: d.ic, bar: d.bar };
  const { error } = await sb.from('categories').upsert(
    { user_id: currentUser.id, key: 'trading', label: d.label, icon: d.icon, bg: d.bg, ic: d.ic, bar: d.bar, sign: d.sign },
    { onConflict: 'user_id,key' });
  if (error) throw error;
  snap.cats.set('trading', catSig('trading'));
  buildCatSwatches(); syncSwatches(); renderCatSelect();
}

// Remplace en mémoire les transactions importées par celles du serveur
function replaceLocalImported(rowsFromServer) {
  Object.keys(DB).forEach(y => {
    DB[y] = (DB[y] || []).filter(e => {
      if (e.tjp) { if (e.id != null) snap.tx.delete(e.id); return false; }
      return true;
    });
  });
  rowsFromServer.forEach(r => {
    if (!DB[r.year]) DB[r.year] = [];
    const e = { id: r.id, cat: r.cat, desc: r.descr, month: r.month, amt: Number(r.amt), tjp: r.tjp_import_id };
    DB[r.year].push(e);
    snap.tx.set(r.id, txSig(e, r.year));
  });
}

const tjpSleep = ms => new Promise(r => setTimeout(r, ms));

async function tjpSync(manual) {
  if (tjpBusy || !tjpLink || tjpLink.status !== 'active' || !dataLoaded || !currentUser) return;
  tjpBusy = true; tjpNote = null; renderTjp();
  try {
    const r = await tjpFetch(tjpLink.token);

    if (r.kind === 'invalid') {
      // Jeton inconnu ou révoqué : liaison marquée comme déconnectée, RIEN n'est supprimé
      tjpLink.status = 'revoked';
      await sb.from('tjp_link').update({ status: 'revoked' }).eq('user_id', currentUser.id);
      tjpNote = { ok: false, text: 'Le jeton TJP n\'est plus valide (révoqué ?). Clique sur « Reconnecter TJP ».' };
      return;
    }
    if (r.kind !== 'ok') {
      // Réseau, 5xx, réponse illisible : on ne touche à aucune donnée
      const why = r.kind === 'network' ? 'TJP injoignable (réseau ?)'
        : r.kind === 'server' ? 'TJP a répondu avec une erreur (' + r.status + ')'
        : 'Réponse de TJP invalide';
      tjpNote = { ok: false, text: why + '. Aucune donnée modifiée, nouvel essai plus tard.' };
      return;
    }

    // On attend la fin d'une éventuelle synchro classique en cours
    for (let i = 0; i < 40 && syncing; i++) await tjpSleep(250);

    await ensureTradingCat();
    const existing = await fetchImportedRows();
    const exMap = new Map(existing.map(x => [x.tjp_import_id, x]));

    const upserts = [];
    r.want.forEach((w, id) => {
      const x = exMap.get(id);
      if (!x || x.year !== w.year || x.month !== w.month || x.cat !== w.cat || x.descr !== w.descr || Number(x.amt) !== w.amt) {
        upserts.push(Object.assign({ user_id: currentUser.id }, w));
      }
    });
    const deleteIds = existing.filter(x => !r.want.has(x.tjp_import_id)).map(x => x.id);

    // Ajouts / mises à jour d'abord (si ça échoue, rien n'est supprimé)
    for (const part of chunk(upserts, 500)) {
      const { error } = await sb.from('transactions').upsert(part, { onConflict: 'user_id,tjp_import_id' });
      if (error) throw error;
    }
    for (const part of chunk(deleteIds, 200)) {
      const { error } = await sb.from('transactions').delete().in('id', part);
      if (error) throw error;
    }

    replaceLocalImported(await fetchImportedRows());
    writeCache();

    const now = new Date().toISOString();
    const { error } = await sb.from('tjp_link')
      .update({ accounts: r.accounts, last_sync_at: now }).eq('user_id', currentUser.id);
    if (error) throw error;
    tjpLink.accounts = r.accounts; tjpLink.last_sync_at = now;

    tjpNote = { ok: true, text: r.want.size + ' trade' + (r.want.size > 1 ? 's' : '') + ' synchronisé' + (r.want.size > 1 ? 's' : '')
      + ' (' + upserts.length + ' ajouté/modifié, ' + deleteIds.length + ' supprimé).' };
  } catch (e) {
    console.error('TJP synchro :', e && e.message);   // jamais le jeton
    tjpNote = { ok: false, text: 'Synchronisation TJP échouée. Aucune donnée supprimée.' };
  } finally {
    tjpBusy = false;
    renderTjp(); renderAll();
  }
}

// ════════════════════════════════════════════════════════
//  INTERFACE
// ════════════════════════════════════════════════════════
function renderTjp() {
  const el = document.getElementById('tjpBox');
  if (!el) return;
  let html = '<div class="tjp-head"><div class="tjp-title"><i class="ti ti-plug-connected"></i> TJP · journal de trading</div>';
  const spin = tjpBusy ? '<span class="tjp-spin">Synchronisation…</span>' : '';

  if (!dataLoaded) {
    html += '</div><div class="tjp-sub">Indisponible hors-ligne.</div>';
  } else if (!tjpLink) {
    html += '<div class="tjp-actions">' + spin
      + '<button type="button" class="tjp-btn tjp-btn-main" onclick="connectTjp()"' + (tjpBusy ? ' disabled' : '') + '><i class="ti ti-link"></i>Connecter TJP</button></div></div>'
      + '<div class="tjp-sub">Importe automatiquement ton PnL de trading (date et montant uniquement).</div>';
  } else if (tjpLink.status === 'revoked') {
    html += '<div class="tjp-actions">'
      + '<button type="button" class="tjp-btn tjp-btn-main" onclick="connectTjp()"><i class="ti ti-link"></i>Reconnecter TJP</button>'
      + '<button type="button" class="tjp-btn" onclick="tjpDisconnect()"><i class="ti ti-unlink"></i>Déconnecter</button></div></div>'
      + '<div class="tjp-sub tjp-bad">Liaison expirée ou révoquée.</div>';
  } else {
    const names = (tjpLink.accounts || []).map(a => '<span class="tjp-chip">' + escHtml(a.name) + '</span>').join('');
    const last = tjpLink.last_sync_at
      ? new Date(tjpLink.last_sync_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
      : 'jamais';
    html += '<div class="tjp-actions">' + spin
      + '<button type="button" class="tjp-btn tjp-btn-main" onclick="tjpSync(true)"' + (tjpBusy ? ' disabled' : '') + '><i class="ti ti-refresh"></i>Synchroniser TJP</button>'
      + '<button type="button" class="tjp-btn" onclick="tjpDisconnect()"' + (tjpBusy ? ' disabled' : '') + '><i class="ti ti-unlink"></i>Déconnecter</button></div></div>'
      + '<div class="tjp-sub"><span class="tjp-ok"><i class="ti ti-circle-check"></i> TJP connecté</span> · Dernière synchro : ' + last + '</div>'
      + (names ? '<div class="tjp-chips">' + names + '</div>' : '');
  }
  if (tjpNote) html += '<div class="tjp-note ' + (tjpNote.ok ? 'tjp-ok' : 'tjp-bad') + '">' + escHtml(tjpNote.text) + '</div>';
  el.innerHTML = html;
}

// Appelé une fois l'app démarrée (voir main.js)
async function tjpInit() {
  if (!dataLoaded) { renderTjp(); return; }
  try {
    await tjpLoadLink();
  } catch (e) {
    console.error('TJP lecture liaison :', e && e.message);
    tjpNote = { ok: false, text: 'Impossible de lire la liaison TJP.' };
    renderTjp(); return;
  }
  if (tjpFlash) { tjpNote = tjpFlash; tjpFlash = null; }
  if (tjpPending) {
    const p = tjpPending; tjpPending = null;
    try {
      await tjpSaveLink(p.token, p.accounts);
      tjpNote = { ok: true, text: 'TJP connecté. Import en cours…' };
      renderTjp();
      await tjpSync(true);
    } catch (e) {
      console.error('TJP enregistrement liaison :', e && e.message);
      tjpNote = { ok: false, text: 'Liaison reçue mais non enregistrée. Réessaie « Connecter TJP ».' };
      renderTjp();
    }
    return;
  }
  renderTjp();
  if (tjpLink && tjpLink.status === 'active') await tjpSync(false);
}
