// Optional D1 integration for preview; legacy Telegram stays active until D1 is bound.
const codes = new Set(["039","050","063","066","067","068","073","075","077","089","091","092","093","094","095","096","097","098","099"]);
const nameRule = /^\p{L}+\s+\p{L}+$/u;
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
export const respond = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function storeLead(request, env, send = fetch) {
  if (!env.LEADS_DB?.prepare) return respond({ error: "database_unavailable" }, 503);
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  let data;
  try {
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw Error();
    if (Number(request.headers.get("content-length") || 0) > 8192) throw Error();
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 8192) throw Error();
    data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
  } catch { return respond({ error: "bad_request" }, 400); }
  if (data.website) return respond({ ok: true });
  const name = String(data.name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const email = String(data.email ?? "").trim();
  const intent = String(data.intent ?? "Консультація").slice(0, 150);
  const digits = phone.replace(/\D/g, "").replace(/^38/, "");
  if (!nameRule.test(name) || name.split(/\s+/).some(x => x.length > 50) ||
      digits.length !== 10 || !codes.has(digits.slice(0, 3)) ||
      email.length > 254 || !emailRule.test(email)) {
    return respond({ error: "invalid_lead" }, 400);
  }

  const id = crypto.randomUUID();
  let source = "/";
  try {
    const referer = new URL(request.headers.get("referer") || "");
    if (referer.origin === new URL(request.url).origin) source = referer.pathname.slice(0, 150);
  } catch {}
  try {
    await env.LEADS_DB.prepare("INSERT INTO leads (id,name,phone,email,intent,source) VALUES (?,?,?,?,?,?)")
      .bind(id, name, phone, email, intent, source).run();
  } catch {
    console.error("CRM insert failed");
    return respond({ error: "database_write_failed" }, 503);
  }

  // Notification is secondary: the application has already been saved.
  let delivered = false;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const message = ["ТЕСТОВА ЗАЯВКА MathLab", "Мета: " + intent,
        "Ім'я: " + name, "Телефон: " + phone, "Email: " + email].join("\n");
      const response = await send("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
      });
      delivered = response.ok;
    } catch { delivered = false; }
  }
  try {
    await env.LEADS_DB.prepare("UPDATE leads SET telegram_status = ? WHERE id = ?")
      .bind(delivered ? "sent" : "failed", id).run();
  } catch { console.error("CRM notification state update failed"); }
  return respond({ ok: true, id, telegram: delivered ? "sent" : "failed" });
}
