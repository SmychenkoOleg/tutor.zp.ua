// Additional CRM authentication; separate from preview-site password.
const COOKIE = "__Host-mathlab_admin";
const LIFE = 7200;
const encoder = new TextEncoder();
const SHA = async x => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(x)));
function equals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export function configured(env) {
  return typeof env.LEADS_ADMIN_PASSWORD === "string" && env.LEADS_ADMIN_PASSWORD.length >= 24 &&
    typeof env.LEADS_SESSION_SECRET === "string" && env.LEADS_SESSION_SECRET.length >= 32;
}
export async function passwordMatches(password, env) {
  return configured(env) && typeof password === "string" &&
    password.length <= 1024 && equals(await SHA(password), await SHA(env.LEADS_ADMIN_PASSWORD));
}
async function mac(payload, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, "0")).join("");
}
export async function createSession(env, timestamp = Date.now()) {
  const payload = Math.floor(timestamp / 1000) + "." + crypto.randomUUID();
  return payload + "." + await mac(payload, env.LEADS_SESSION_SECRET);
}
export async function hasSession(request, env, timestamp = Date.now()) {
  if (!configured(env)) return false;
  const found = (request.headers.get("cookie") ?? "").split(";").map(x => x.trim())
    .find(x => x.startsWith(COOKIE + "="));
  if (!found) return false;
  const token = found.slice(COOKIE.length + 1);
  const match = /^(\d{10,12}\.[0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const issued = Number(match[1].split(".")[0]);
  const now = Math.floor(timestamp / 1000);
  if (!Number.isSafeInteger(issued) || issued > now + 10 || now - issued > LIFE) return false;
  return equals(await SHA(match[2]), await SHA(await mac(match[1], env.LEADS_SESSION_SECRET)));
}
export function setCookie(token) {
  return COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + LIFE;
}
export function deleteCookie() {
  return COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
export function sameOrigin(request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
