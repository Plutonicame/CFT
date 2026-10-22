// Couleurs

// ════════════════════════════════════════════════════════
//  COULEURS
// ════════════════════════════════════════════════════════
const DFLTS = {
  pos:'#22d3a0', neg:'#f43f5e',
  charts:['#22d3a0','#888780','#3b9eff'],
  cats:{
    revenus:{bg:'#0d2e22',ic:'#22d3a0',bar:'#22d3a0'},
    trading:{bg:'#0d1e35',ic:'#3b9eff',bar:'#3b9eff'},
    investissement:{bg:'#2a1c09',ic:'#f59e0b',bar:'#f59e0b'},
    epargne:{bg:'#1a1535',ic:'#a78bfa',bar:'#a78bfa'},
    depot:{bg:'#1a1a24',ic:'#888780',bar:'#888780'},
    argent:{bg:'#0d2e22',ic:'#2dd4bf',bar:'#2dd4bf'},
    depenses:{bg:'#2d0f0f',ic:'#f43f5e',bar:'#f43f5e'},
  }
};
let CLR = JSON.parse(JSON.stringify(DFLTS));

function ha(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function applyCSSColors() {
  document.documentElement.style.setProperty('--pos', CLR.pos);
  document.documentElement.style.setProperty('--neg', CLR.neg);
}
function setColor(k, v) { CLR[k] = v; applyCSSColors(); syncSwatches(); renderAll(); }
function setChart(i, v) { CLR.charts[i] = v; syncSwatches(); renderAll(); }
function setCatColor(cat, prop, v) { CLR.cats[cat][prop] = v; CATS[cat][prop] = v; syncSwatches(); renderAll(); }
function resetColors() {
  const customCats = {};
  Object.keys(CATS).forEach(k => { if (!DFLTS.cats[k]) customCats[k] = JSON.parse(JSON.stringify(CLR.cats[k])); });
  CLR = JSON.parse(JSON.stringify(DFLTS));
  Object.assign(CLR.cats, customCats);
  Object.keys(CATS).forEach(k => {
    if (CLR.cats[k]) { CATS[k].bg = CLR.cats[k].bg; CATS[k].ic = CLR.cats[k].ic; CATS[k].bar = CLR.cats[k].bar; }
  });
  applyCSSColors(); buildCatSwatches(); syncSwatches(); renderAll();
}
function setSwatch(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.cp-swatch-preview').style.background = val;
  el.querySelector('input').value = val;
}
function syncSwatches() {
  setSwatch('sw-pos', CLR.pos);
  setSwatch('sw-neg', CLR.neg);
  CLR.charts.forEach((c,i) => setSwatch('sw-c'+i, c));
  Object.keys(CLR.cats).forEach(cat => {
    ['bg','ic','bar'].forEach(p => setSwatch('sw-'+cat+'-'+p, CLR.cats[cat][p]));
  });
}
function buildCatSwatches() {
  let html = '';
  Object.keys(CATS).forEach(cat => {
    const c = CATS[cat];
    html += '<div style="margin-bottom:1rem">'
      + '<div style="font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:.5rem;display:flex;align-items:center;gap:8px">'
      + '<i class="ti '+c.icon+'" style="color:'+c.ic+'"></i>'+c.label+'</div>'
      + '<div style="display:flex;gap:10px">'
      + '<div><div class="cp-lbl" style="font-size:10px;text-align:center;margin-bottom:4px">Fond</div>'
      + '<label class="cp-swatch" id="sw-'+cat+'-bg"><div class="cp-swatch-preview" style="background:'+c.bg+'"></div><input type="color" value="'+c.bg+'" oninput="setCatColor(\''+cat+'\',\'bg\',this.value)"></label></div>'
      + '<div><div class="cp-lbl" style="font-size:10px;text-align:center;margin-bottom:4px">Icône</div>'
      + '<label class="cp-swatch" id="sw-'+cat+'-ic"><div class="cp-swatch-preview" style="background:'+c.ic+'"></div><input type="color" value="'+c.ic+'" oninput="setCatColor(\''+cat+'\',\'ic\',this.value)"></label></div>'
      + '<div><div class="cp-lbl" style="font-size:10px;text-align:center;margin-bottom:4px">Barre</div>'
      + '<label class="cp-swatch" id="sw-'+cat+'-bar"><div class="cp-swatch-preview" style="background:'+c.bar+'"></div><input type="color" value="'+c.bar+'" oninput="setCatColor(\''+cat+'\',\'bar\',this.value)"></label></div>'
      + '</div></div>';
  });
  document.getElementById('catSwatches').innerHTML = html;
}
function openPanel()  { document.getElementById('colorPanel').classList.add('open'); document.getElementById('overlay').classList.add('on'); }
function closePanel() { document.getElementById('colorPanel').classList.remove('open'); document.getElementById('overlay').classList.remove('on'); }
