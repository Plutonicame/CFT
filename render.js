// Fonctions de rendu

// ════════════════════════════════════════════════════════
//  RENDER FUNCTIONS
// ════════════════════════════════════════════════════════
function renderAll() {
  const {rev,exp,trd,net} = calcKPI();
  // Budget mensuel = 10% de l'argent net du mois en cours (revenus + trading - dépenses
  // DU MOIS), et non 10% de la fortune totale accumulée.
  const monthKPI = calcMonthKPI(currentMonthIdx());
  const budget = Math.max(monthKPI.net, 0) * 0.10;
  // Onglet "PNL" : widgets simples inchangés.
  const kpisPNL = [
    {l:'Gains totaux',  v:fmt(rev+trd), c:CLR.pos},
    {l:'Trading PNL',   v:fmt(trd),     c:CLR.charts[2]},
    {l:'Dépenses',      v:fmt(exp),     c:CLR.neg},
    {l:'Budget mensuel (10%)', v:fmt(budget), c:CLR.pos},
  ];
  renderKPI('kpi1', kpisPNL);
  renderTopBoxes();
  renderDataTable();
  renderPNL();
  renderFortune();
}

// ── Boîte partagée : nom + total en haut, bouton d'agrandissement, transactions en dessous ─────
function catBoxHTML(label, total, colorHex, entries) {
  const sign = total < 0 ? '-' : '+';
  const txHtml = entries.length
    ? entries.map(e => {
        // Couleur par catégorie : trading = bleu, dépenses = rouge, tout le reste = vert.
        const amtColor = e.cat === 'trading' ? CLR.charts[2]
          : (CATS[e.cat] && CATS[e.cat].sign < 0) ? CLR.neg
          : CLR.pos;
        const showNeg = (CATS[e.cat] && CATS[e.cat].sign < 0) || e.amt < 0;
        return '<div class="tx">'
          +'<div><div class="tx-desc">'+escHtml(e.desc)+'</div><div class="tx-mo">'+MO[e.month]+'</div></div>'
          +'<div class="tx-amt" style="color:'+amtColor+'">'+(showNeg?'-':'+')+fmt(Math.abs(e.amt))+'</div>'
          +'</div>';
      }).join('')
    : '<div class="tx-empty">Aucune transaction</div>';
  return '<div class="cat-card">'
    +'<div class="cat-box-head">'
    +'<div class="cat-box-head-left"><div class="cat-name">'+label+'</div>'
    +'<button type="button" class="box-expand-btn" onclick="toggleBoxExpand(this)" title="Voir toutes les transactions"><i class="ti ti-chevron-down"></i></button></div>'
    +'<div class="cat-amount" style="color:'+colorHex+'">'+sign+fmt(Math.abs(total))+'</div>'
    +'</div>'
    +'<div class="tx-list">'+txHtml+'</div>'
    +'</div>';
}

// Agrandit/réduit la liste de transactions d'une boîte, avec défilement à la souris.
function toggleBoxExpand(btn) {
  const card = btn.closest('.cat-card');
  if (!card) return;
  const list = card.querySelector('.tx-list');
  if (!list) return;
  const expanded = list.classList.toggle('expanded');
  const icon = btn.querySelector('i');
  if (icon) icon.className = expanded ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
  btn.title = expanded ? 'Réduire' : 'Voir toutes les transactions';
}

// ── Les 3 boîtes du haut : Gains totaux, Dépenses, Trading PNL ───────
function renderTopBoxes() {
  const el = document.getElementById('kpi0');
  if (!el) return;
  const {rev,exp,trd} = calcKPI();
  // Toutes les transactions (pas seulement les 4 dernières) — la vue repliée
  // n'en montre que le haut, le bouton agrandir permet de tout voir en défilant.
  const gainEntries  = rows().filter(e => CATS[e.cat] && CATS[e.cat].sign > 0).slice().reverse();
  const expEntries   = rows().filter(e => e.cat === 'depenses').slice().reverse();
  const tradeEntries = rows().filter(e => e.cat === 'trading').slice().reverse();
  el.innerHTML =
      catBoxHTML('Gains totaux', rev+trd, CLR.pos, gainEntries)
    + catBoxHTML('Dépenses', -exp, CLR.neg, expEntries)
    + catBoxHTML('Trading PNL', trd, CLR.charts[2], tradeEntries);
}



// ── PNL chart ─────────────────────────────────────────
function renderPNL() {
  // Affiche tous les mois qui ont au moins une entrée, ou les 12 mois pour les années passées
  const allEntries = rows();
  const maxMonth = allEntries.length > 0 ? Math.max(...allEntries.map(e => e.month)) + 1 : months();
  const m = Math.max(months(), maxMonth);
  const labels = MO.slice(0, m);
  let cum = 0;
  const cumD = Array.from({length:m}, (_,i) => {
    let n = 0; Object.keys(CATS).forEach(k => { n += CATS[k].sign * msum(k,i); }); cum += n; return Math.round(cum);
  });
  // Trading cumulé : le total ne retombe pas à zéro chaque mois, il reste au
  // niveau atteint (ex: +100 reste affiché tant qu'aucun nouveau trade n'est ajouté).
  let cumTrd = 0;
  const trdD = Array.from({length:m}, (_,i) => { cumTrd += msum('trading',i); return Math.round(cumTrd); });
  // Dépenses cumulées (positives) : le total ne retombe pas à zéro chaque mois,
  // il continue d'augmenter avec les dépenses passées.
  let cumExp = 0;
  const expD = Array.from({length:m}, (_,i) => { cumExp += msum('depenses',i); return Math.round(cumExp); });
  const gc = 'rgba(255,255,255,.05)', tc = 'rgba(255,255,255,.3)';
  if (pChart) { pChart.destroy(); pChart = null; }
  pChart = new Chart(document.getElementById('pnlCanvas'), {
    type:'line',
    data:{ labels, datasets:[
      {label:'PNL cumulé', data:cumD, borderColor:CLR.charts[0], backgroundColor:ha(CLR.charts[0],.1), fill:true, tension:.4, pointRadius:4, pointBackgroundColor:CLR.charts[0], borderWidth:2.5},
      {label:'Trading', data:trdD, borderColor:CLR.charts[2], fill:false, tension:.4, pointRadius:4, pointBackgroundColor:CLR.charts[2], borderWidth:2, pointStyle:'triangle'},
      {label:'Dépenses', data:expD, borderColor:CLR.neg, fill:false, tension:.4, pointRadius:4, pointBackgroundColor:CLR.neg, borderWidth:2, pointStyle:'rectRot'},
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>{ const v=c.raw; return ' '+c.dataset.label+' : '+(v<0?'-':'')+fmt(Math.abs(v)); }}}
      },
      scales:{
        x:{grid:{color:gc}, ticks:{color:tc, font:{size:11,family:'Inter'}, autoSkip:false}},
        y:{grid:{color:gc}, ticks:{color:tc, font:{size:11,family:'Inter'}, callback:v=>{ const a=Math.abs(v); return (v<0?'-':'')+(a>=1000?(a/1000).toFixed(0)+'k':a)+'€'; }}}
      }
    }
  });
  // legend
  const leg = document.getElementById('pnlLegend');
  if (leg) leg.innerHTML = [
    ['<span style="display:inline-block;width:20px;height:2px;background:'+CLR.charts[0]+';border-radius:2px;vertical-align:middle"></span>','PNL cumulé'],
    ['<span style="display:inline-block;width:20px;height:2px;background:'+CLR.charts[2]+';border-radius:2px;vertical-align:middle"></span>','Trading'],
    ['<span style="display:inline-block;width:20px;height:2px;background:'+CLR.neg+';border-radius:2px;vertical-align:middle"></span>','Dépenses'],
  ].map(([icon,txt])=>'<div class="leg-item">'+icon+'<span>'+txt+'</span></div>').join('');
}

// ── Fortune ───────────────────────────────────────────
function renderFortune() {
  const {rev,exp,trd,net} = calcKPI();
  document.getElementById('fortSplit').innerHTML =
    '<div class="fort-card"><div class="fort-card-label">Total gains</div><div class="fort-card-value" style="color:'+CLR.pos+'">+'+fmt(rev+trd)+'</div></div>'
    +'<div class="fort-card"><div class="fort-card-label">Total dépenses</div><div class="fort-card-value" style="color:'+CLR.neg+'">-'+fmt(exp)+'</div></div>'
    +'<div class="fort-card"><div class="fort-card-label">Fortune nette</div><div class="fort-card-value" style="color:'+(net>=0?CLR.pos:CLR.neg)+'">'+fmtS(net)+'</div></div>';

  const rows2 = Object.keys(CATS).map(k => ({
    key: k,
    label: CATS[k].label,
    val: k === 'trading' ? trd : (CATS[k].sign < 0 ? -catTotal(k) : catTotal(k)),
  }));
  const rowsHtml = rows2.map(r => {
    // Couleur par catégorie : trading = bleu, sinon vert/rouge selon le signe.
    const color = r.key === 'trading' ? CLR.charts[2] : (r.val>=0 ? CLR.pos : CLR.neg);
    return '<div class="fort-row">'
    +'<div class="fort-row-label">'+r.label+'</div>'
    +'<div class="fort-row-val" style="color:'+color+'">'+(r.val>=0?'+':'')+fmt(r.val)+'</div>'
    +'</div>';
  }).join('');
  document.getElementById('fortRows').innerHTML = rowsHtml
    + '<div class="fort-total">'
    + '<div class="fort-total-label">Fortune nette</div>'
    + '<div class="fort-total-val" style="color:'+(net>=0?CLR.pos:CLR.neg)+'">'+fmtS(net)+'</div>'
    + '</div>';

  const allE = rows();
  const maxMo = allE.length > 0 ? Math.max(...allE.map(e => e.month)) + 1 : months();
  const m = Math.max(months(), maxMo);
  const labels = MO.slice(0, m);
  let c2 = 0;
  const cumF = Array.from({length:m}, (_,i) => {
    let n=0; Object.keys(CATS).forEach(k=>{ n+=CATS[k].sign*msum(k,i); }); c2+=n; return Math.round(c2);
  });
  const gc = 'rgba(255,255,255,.05)', tc = 'rgba(255,255,255,.3)';
  if (fChart) { fChart.destroy(); fChart = null; }
  fChart = new Chart(document.getElementById('fortCanvas'), {
    type:'bar',
    data:{ labels, datasets:[{
      label:'Fortune', data:cumF,
      backgroundColor: cumF.map(v => v>=0 ? ha(CLR.pos,.2) : ha(CLR.neg,.2)),
      borderColor: cumF.map(v => v>=0 ? CLR.pos : CLR.neg),
      borderWidth:1.5, borderRadius:5,
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>{ const v=c.raw; return ' '+(v<0?'-':'')+fmt(Math.abs(v)); }}}},
      scales:{
        x:{grid:{color:gc}, ticks:{color:tc, font:{size:11,family:'Inter'}, autoSkip:false}},
        y:{grid:{color:gc}, ticks:{color:tc, font:{size:11,family:'Inter'}, callback:v=>{ const a=Math.abs(v); return (v<0?'-':'')+(a>=1000?(a/1000).toFixed(0)+'k':a)+'€'; }}}
      }
    }
  });

  renderFortuneArea();
  renderPie();
}

// ── Fortune — courbe style aire (verte) ────────────────
function renderFortuneArea() {
  const canvas = document.getElementById('fortAreaCanvas');
  if (!canvas) return;
  const allE = rows();
  const maxMo = allE.length > 0 ? Math.max(...allE.map(e => e.month)) + 1 : months();
  const m = Math.max(months(), maxMo);
  const labels = MO.slice(0, m);
  let c = 0;
  const cumF = Array.from({length:m}, (_,i) => {
    let n=0; Object.keys(CATS).forEach(k=>{ n+=CATS[k].sign*msum(k,i); }); c+=n; return Math.round(c);
  });
  const gc = 'rgba(255,255,255,.05)', tc = 'rgba(255,255,255,.3)';
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, ha(CLR.pos, .35));
  grad.addColorStop(1, ha(CLR.pos, 0));

  if (fAreaChart) { fAreaChart.destroy(); fAreaChart = null; }
  fAreaChart = new Chart(canvas, {
    type:'line',
    data:{ labels, datasets:[{
      data: cumF, borderColor: CLR.pos, backgroundColor: grad, fill:true,
      tension:.45, borderWidth:3, pointRadius:0, pointHoverRadius:5,
      pointHoverBackgroundColor: CLR.pos, pointHoverBorderColor:'#fff',
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>' '+fmtS(c.raw)}}
      },
      scales:{
        x:{grid:{display:false}, ticks:{color:tc, font:{size:11,family:'Inter'}}},
        y:{grid:{color:gc}, ticks:{color:tc, font:{size:11,family:'Inter'}, callback:v=> new Intl.NumberFormat('fr-FR').format(v)+' €'}}
      }
    }
  });
}

// ── Fortune — camembert des sources de revenus ─────────
function renderPie() {
  const canvas = document.getElementById('pieCanvas');
  if (!canvas) return;
  const incomeCats = Object.keys(CATS).filter(k => CATS[k].sign > 0);
  const vals = incomeCats.map(k => Math.max(catTotal(k), 0));
  const total = vals.reduce((a,b) => a+b, 0);
  const colors = incomeCats.map(k => CLR.cats[k].bar);

  if (pieChart) { pieChart.destroy(); pieChart = null; }
  pieChart = new Chart(canvas, {
    type:'doughnut',
    data:{ labels: incomeCats.map(k => CATS[k].label), datasets:[{
      data: vals, backgroundColor: colors, borderColor:'#13131a', borderWidth:2, hoverOffset:6,
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>{ const v=c.raw; const pct = total>0 ? (v/total*100).toFixed(1) : '0.0'; return ' '+c.label+' : '+fmt(v)+' ('+pct+'%)'; }}}
      }
    }
  });

  const leg = document.getElementById('pieLegend');
  if (leg) {
    if (!total) { leg.innerHTML = '<p style="color:var(--txt3);font-size:12px">Aucune donnée.</p>'; }
    else {
      leg.innerHTML = incomeCats.map((k,i) => {
        const v = vals[i], pct = (v/total*100).toFixed(1);
        return '<div class="pie-leg-item">'
          + '<span class="pie-leg-name">'+CATS[k].label+'</span>'
          + '<span class="pie-leg-val">'+fmt(v)+' · '+pct+'%</span>'
          + '</div>';
      }).join('');
    }
  }
}

// ── Data table ────────────────────────────────────────
function renderDataTable() {
  const entries = DB[yr] || [];
  const tbl = document.getElementById('dataTable');
  if (!tbl) return;
  if (!entries.length) { tbl.innerHTML = '<p style="color:var(--txt3);padding:2rem 0;text-align:center">Aucune donnée.</p>'; return; }

  let html = '';
  Object.keys(CATS).forEach(cat => {
    const catEntries = entries.filter(e => e.cat === cat);
    if (!catEntries.length) return;
    const isExp = CATS[cat].sign < 0;
    const total = catEntries.reduce((s,e) => s+e.amt, 0);
    const hdrColor = cat === 'trading' ? CLR.charts[2] : (isExp ? 'var(--neg)' : 'var(--pos)');
    html += '<div class="tbl-section">'
      + '<div class="tbl-cat-hdr" onclick="toggleSection(\'tbl-body-'+cat+'\',\'tbl-arrow-'+cat+'\')">'
      + '<span class="tbl-cat-lbl">'+CATS[cat].label+'</span>'
      + '<span class="tbl-cat-info">'+catEntries.length+' ligne'+(catEntries.length>1?'s':'')+' &nbsp;·&nbsp; <span style="color:'+hdrColor+';">'+(isExp?'-':'')+fmt(Math.abs(total))+'</span></span>'
      + '<button class="clear-cat-btn" onclick="event.stopPropagation();delAllCat('+yr+',\''+cat+'\')" title="Tout supprimer"><i class="ti ti-trash" style="font-size:11px;margin-right:3px"></i>Tout vider</button>'
      + '<i class="ti ti-chevron-right tbl-cat-arrow" id="tbl-arrow-'+cat+'"></i>'
      + '</div>'
      + '<div class="tbl-body" id="tbl-body-'+cat+'">'
      + '<div class="tbl-header">'
      + '<div class="tbl-hcell">Description</div>'
      + '<div class="tbl-hcell">Mois</div>'
      + '<div class="tbl-hcell">Catégorie</div>'
      + '<div class="tbl-hcell" style="text-align:right">Montant €</div>'
      + '<div class="tbl-hcell"></div>'
      + '</div>';

    catEntries.forEach(e => {
      const gi = entries.indexOf(e);
      const moOpts = MO.map((mo,i) => '<option value="'+i+'"'+(i===e.month?' selected':'')+'>'+mo+'</option>').join('');
      const catOpts = Object.keys(CATS).map(k => '<option value="'+k+'"'+(k===e.cat?' selected':'')+'>'+CATS[k].label+'</option>').join('');
      html += '<div class="tbl-row">'
        + '<div><input class="cell-inp" value="'+escHtml(e.desc)+'" onchange="upd('+yr+','+gi+',\'desc\',this.value)" style="min-width:80px"></div>'
        + '<div><select class="cell-sel" onchange="upd('+yr+','+gi+',\'month\',parseInt(this.value));renderAll()">'+moOpts+'</select></div>'
        + '<div><select class="cell-sel" onchange="upd('+yr+','+gi+',\'cat\',this.value);renderAll()">'+catOpts+'</select></div>'
        + '<div><input class="cell-inp" type="number" value="'+e.amt+'" onchange="upd('+yr+','+gi+',\'amt\',parseFloat(this.value)||0)" onblur="renderAll()" style="text-align:right"></div>'
        + '<div style="text-align:center"><button class="del-btn" onclick="del('+yr+','+gi+')"><i class="ti ti-trash"></i></button></div>'
        + '</div>';
    });
    html += '</div></div>';
  });
  tbl.innerHTML = html;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toggleSection(bodyId, arrowId) {
  const body = document.getElementById(bodyId), arrow = document.getElementById(arrowId);
  if (!body) return;
  body.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
}
function upd(y, idx, field, val) {
  if (DB[y] && DB[y][idx]) {
    DB[y][idx][field] = val;
    // Même normalisation que doAdd() : si le montant ou la catégorie change,
    // on force une magnitude positive pour les catégories de type "dépense".
    const entry = DB[y][idx];
    if (CATS[entry.cat] && CATS[entry.cat].sign < 0) entry.amt = Math.abs(entry.amt);
  }
  autoSave();
}
function del(y, idx) {
  if (!DB[y]) return;
  const openSections = [];
  document.querySelectorAll('.tbl-body.open').forEach(el => openSections.push(el.id));
  DB[y].splice(idx, 1);
  autoSave();
  renderAll();
  openSections.forEach(id => {
    const body = document.getElementById(id);
    const cat = id.replace('tbl-body-', '');
    const arrow = document.getElementById('tbl-arrow-' + cat);
    if (body) { body.classList.add('open'); }
    if (arrow) { arrow.classList.add('open'); }
  });
}
function delAllCat(y, cat) {
  if (!DB[y]) return;
  // Garde les sections ouvertes avant le re-render
  const openSections = [];
  document.querySelectorAll('.tbl-body.open').forEach(el => openSections.push(el.id));
  // Supprime toutes les entrées de cette catégorie pour cette année
  DB[y] = DB[y].filter(e => e.cat !== cat);
  autoSave();
  renderAll();
  // Réouvre les sections (sauf celle qu'on vient de vider si elle n'existe plus)
  openSections.forEach(id => {
    const body = document.getElementById(id);
    const c = id.replace('tbl-body-', '');
    const arrow = document.getElementById('tbl-arrow-' + c);
    if (body) { body.classList.add('open'); }
    if (arrow) { arrow.classList.add('open'); }
  });
}
