/* Autenticação local (capa de login). Estrutura pronta para um verifyRemote no futuro. */
const AUTH_KEY = "anota-conta-auth-v1";
const SESSAO_KEY = "anota-conta-sessao";
const AUTH_ITER = 310000;
const AUTH_MIN = 8;

const AUTH_REGRAS_MSG = "A nova senha precisa ter: no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.";

/** Regras só para senha NOVA (criar / trocar). Senha atual não passa por isso. */
function senhaForte(senha) {
  const s = String(senha || "");
  return s.length >= AUTH_MIN
    && /[A-Z]/.test(s)
    && /[0-9]/.test(s)
    && /[^A-Za-z0-9]/.test(s);
}

/* Senha padrão do preview: hash PBKDF2-SHA256 pré-calculado (texto não fica no código). */
const AUTH_PADRAO = {
  versao: 1,
  iter: AUTH_ITER,
  salt: "7a8dbcd98774558b7d1fd6e491ababe0",
  hash: "6e13b51b85c31b8f2e3e5253f8fa7a4797146db876d34f55139aefea4d5db871",
  criadoEm: "2026-10-05T00:00:00.000Z",
  padrao: true
};

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

/** Garante hash no aparelho: se ainda não houver senha salva, grava a padrão do preview. */
function garantirSenhaPadrao() {
  if (lerAuth()) return lerAuth();
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...AUTH_PADRAO }));
  return lerAuth();
}

function temSenhaLocal() {
  return !!garantirSenhaPadrao();
}

/** Verifica a senha contra o hash PBKDF2 salvo neste aparelho. */
async function verifyLocal(senha) {
  const auth = garantirSenhaPadrao();
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
  if (!senhaForte(senha)) throw new Error("fraca");
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
  await criarSenhaLocal(nova);
  return true;
}

function tokenSessao() {
  const auth = garantirSenhaPadrao();
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
