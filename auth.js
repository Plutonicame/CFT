// Connexion Google (Supabase Auth)

// ════════════════════════════════════════════════════════
//  CLIENT SUPABASE
// ════════════════════════════════════════════════════════
// La clé "anon" est publique par conception : la sécurité repose sur le RLS des tables.
// Ne jamais mettre ici la clé "service_role".
const SUPABASE_URL      = 'https://kmvaektplyinzqirptqq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttdmFla3RwbHlpbnpxaXJwdHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NTEwNzgsImV4cCI6MjEwODIyNzA3OH0.4Tb0RLwlTmrMngbrFxbV84oog-85I9LhwGauwtfsQao';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// URL de retour après Google : la racine de l'appli (sans index.html, sans ?code=)
function appUrl() {
  return location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
}

// ════════════════════════════════════════════════════════
//  ÉCRAN DE CONNEXION
// ════════════════════════════════════════════════════════
function showLogin(msg) {
  document.getElementById('loginScreen').classList.remove('hide');
  document.getElementById('loginLoading').style.display = 'none';
  document.getElementById('loginBtn').style.display = 'flex';
  document.getElementById('loginError').textContent = msg || '';
}
function hideLogin() {
  document.getElementById('loginScreen').classList.add('hide');
}

async function signInGoogle() {
  document.getElementById('loginError').textContent = '';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appUrl() }
  });
  if (error) showLogin('Connexion impossible : ' + error.message);
}

async function signOut() {
  await sb.auth.signOut();
  location.reload();
}
