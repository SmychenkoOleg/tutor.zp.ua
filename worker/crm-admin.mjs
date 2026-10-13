import { configured, passwordMatches, hasSession, createSession, setCookie, deleteCookie, sameOrigin } from "./crm-auth.mjs";
import { loginHtml, dashboardHtml } from "./crm-admin-ui.mjs";
import { respond } from "./crm-leads.mjs";

const STATUSES = new Set(["new", "in_progress", "completed", "cancelled"]);
const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const html = source => new Response(source, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" } });
const redirect = to => new Response(null, { status: 303, headers: { ...noStore, Location: to } });
const forbidden = () => respond({ error: "not_authorized" }, 401);

export async function handleAdmin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/admin")) return null;
  if (!env.LEADS_DB?.prepare || !configured(env)) {
    return new Response("CRM is not configured", { status: 503, headers: noStore });
  }

  if (path === "/admin") return redirect("/admin/leads");
  if (request.method === "GET" && path === "/admin/login") {
    return await hasSession(request, env) ? redirect("/admin/leads") : html(loginHtml);
  }
  if (request.method === "POST" && path === "/admin/api/login") {
    if (!sameOrigin(request)) return respond({ error: "invalid_origin" }, 403);
    let body;
    try {
      if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw Error();
      if (Number(request.headers.get("content-length") || 0) > 2048) throw Error();
      const raw = await request.text();
      if (raw.length > 2048) throw Error();
      body = JSON.parse(raw);
    } catch { return respond({ error: "invalid_request" }, 400); }
    if (!(await passwordMatches(body?.password, env))) return forbidden();
    const token = await createSession(env);
    return respond({ ok: true }, 200, { "Set-Cookie": setCookie(token) });
  }

  if (!(await hasSession(request, env))) {
    if (request.method === "GET" && path === "/admin/leads") return redirect("/admin/login");
    return forbidden();
  }

  if (request.method === "GET" && path === "/admin/leads") return html(dashboardHtml);
  if (request.method === "POST" && path === "/admin/api/logout") {
    if (!sameOrigin(request)) return respond({ error: "invalid_origin" }, 403);
    return respond({ ok: true }, 200, { "Set-Cookie": deleteCookie() });
  }

  if (request.method === "GET" && path === "/admin/api/leads") {
    const status = url.searchParams.get("status");
    if (status && !STATUSES.has(status)) return respond({ error: "invalid_status" }, 400);
    try {
      const statement = status
        ? env.LEADS_DB.prepare("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT 50").bind(status)
        : env.LEADS_DB.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT 50");
      const { results } = await statement.all();
      return respond({ leads: results ?? [] });
    } catch {
      console.error("CRM list query failed");
      return respond({ error: "database_query_failed" }, 503);
    }
  }

  const match = /^\/admin\/api\/leads\/([0-9a-f-]{36})$/.exec(path);
  if (match && request.method === "PATCH") {
    if (!sameOrigin(request)) return respond({ error: "invalid_origin" }, 403);
    let change;
    try {
      if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw Error();
      if (Number(request.headers.get("content-length") || 0) > 4096) throw Error();
      const raw = await request.text();
      if (raw.length > 4096) throw Error();
      change = JSON.parse(raw);
    } catch { return respond({ error: "invalid_request" }, 400); }
    if (!change || !STATUSES.has(change.status) ||
        typeof change.admin_note !== "string" || change.admin_note.length > 2000) {
      return respond({ error: "invalid_changes" }, 400);
    }
    try {
      const result = await env.LEADS_DB.prepare(
        "UPDATE leads SET status = ?, admin_note = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
      ).bind(change.status, change.admin_note, match[1]).run();
      return respond({ ok: true, updated: result.meta?.changes ?? 0 });
    } catch {
      console.error("CRM update query failed");
      return respond({ error: "database_update_failed" }, 503);
    }
  }

  return respond({ error: "not_found" }, 404);
}
