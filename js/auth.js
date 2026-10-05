/* Autenticação local (capa de login). Estrutura pronta para um verifyRemote no futuro. */
const AUTH_KEY = "anota-conta-auth-v1";
const SESSAO_KEY = "anota-conta-sessao";
const AUTH_ITER = 310000;
const AUTH_MIN = 4;

function authBytesToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, "0")).join("");
}
function authHexToBytes(h) {
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}
function authSaltAleatorio() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return authBytesToHex(b);
}
function authIguais(a, b) {
  const sa = String(a || ""), sb = String(b || "");
  let dif = sa.length ^ sb.length;
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) dif |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  return dif === 0;
}

async function authDerivar(senha, saltHex, iter = AUTH_ITER) {
  if (!(window.crypto && crypto.subtle)) throw new Error("sem-crypto");
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: authHexToBytes(saltHex), iterations: iter },
    chave, 256
  );
  return authBytesToHex(bits);
}

function lerAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.hash || !o.salt || !o.iter) return null;
    return o;
  } catch (_) { return null; }
}

function temSenhaLocal() { return !!lerAuth(); }

/** Verifica a senha contra o hash PBKDF2 salvo neste aparelho. */
async function verifyLocal(senha) {
  const auth = lerAuth();
  if (!auth) return false;
  const hex = await authDerivar(senha, auth.salt, auth.iter);
  return authIguais(hex, auth.hash);
}

/**
 * Stub para login remoto no futuro (API / banco).
 * Hoje só indica que o remoto não está disponível.
 */
async function verifyRemote(_senha) {
  return { ok: false, motivo: "remoto-indisponivel" };
}

async function criarSenhaLocal(senha) {
  if (String(senha || "").length < AUTH_MIN) throw new Error("curta");
  const salt = authSaltAleatorio();
  const hash = await authDerivar(senha, salt);
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    versao: 1,
    iter: AUTH_ITER,
    salt,
    hash,
    criadoEm: new Date().toISOString()
  }));
  return hash;
}

async function trocarSenhaLocal(atual, nova) {
  if (!(await verifyLocal(atual))) return false;
  if (String(nova || "").length < AUTH_MIN) throw new Error("curta");
  await criarSenhaLocal(nova);
  return true;
}

function tokenSessao() {
  const auth = lerAuth();
  return auth ? "v1:" + auth.hash.slice(0, 16) : "";
}

function sessaoAberta() {
  const t = tokenSessao();
  return !!t && sessionStorage.getItem(SESSAO_KEY) === t;
}

function abrirSessao() {
  const t = tokenSessao();
  if (t) sessionStorage.setItem(SESSAO_KEY, t);
}

function fecharSessao() {
  sessionStorage.removeItem(SESSAO_KEY);
}
