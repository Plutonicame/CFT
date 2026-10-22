// Données

// ════════════════════════════════════════════════════════
//  DONNÉES
// ════════════════════════════════════════════════════════
const MO = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MO_F = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const CATS = {
  revenus:        { label:'Revenus',        icon:'ti-trending-up',   bg:'#0d2e22', ic:'#22d3a0', bar:'#22d3a0', sign: 1 },
  trading:        { label:'Trading',        icon:'ti-chart-candle',  bg:'#0d1e35', ic:'#3b9eff', bar:'#3b9eff', sign: 1 },
  investissement: { label:'Investissement', icon:'ti-building-bank', bg:'#2a1c09', ic:'#f59e0b', bar:'#f59e0b', sign: 1 },
  epargne:        { label:'Épargne',        icon:'ti-piggy-bank',    bg:'#1a1535', ic:'#a78bfa', bar:'#a78bfa', sign: 1 },
  depot:          { label:'Dépôt compte',   icon:'ti-wallet',        bg:'#1a1a24', ic:'#888780', bar:'#888780', sign: 1 },
  argent:         { label:'Argent liquide', icon:'ti-cash',          bg:'#0d2e22', ic:'#2dd4bf', bar:'#2dd4bf', sign: 1 },
  depenses:       { label:'Dépenses',       icon:'ti-receipt',       bg:'#2d0f0f', ic:'#f43f5e', bar:'#f43f5e', sign:-1 },
};

// Copie des catégories par défaut (sert à initialiser un nouveau compte)
const DEFAULT_CATS = JSON.parse(JSON.stringify(CATS));

// Les données viennent maintenant de Supabase (voir storage.js)
const DB = {};
