// Export and deletion run only after the CRM's authenticated router authorizes the request.
import { respond } from "./crm-leads.mjs";
import { deviceTypeLabel } from "./crm-device.mjs";

export const validLeadId = value =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

const LIMIT = 10000;
const CHUNK = 500;

function quoteCsv(value, delimiter) {
  let text = String(value ?? "").replace(/\r\n?/g, "\n");
  // Prevent spreadsheet formula injection through names, notes, email or intent.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function phoneCsv(value) {
  const original = String(value ?? "").trim();
  // Excel can strip leading zeroes and '+' from imported phone numbers.
  // This strictly validated constant-string formula preserves their displayed form.
  if (original && /^[0-9+()\-\s]+$/.test(original)) {
    return '"' + ('="' + original + '"').replace(/"/g, '""') + '"';
  }
  return quoteCsv(original);
}

const columns = ["Дата", "Ім’я та Прізвище", "Телефон", "e-mail", "Пристрій", "Мета", "Джерело", "Статус", "Примітка", "Telegram", "ID"];
const fields = ["created_at", "name", "phone", "email", "device_type", "intent", "source", "status", "admin_note", "telegram_status", "id"];

export function makeCsv(rows, format = "excel") {
  if (!["excel", "comma"].includes(format)) throw new RangeError("Unknown CSV format");
  const delimiter = format === "excel" ? ";" : ",";
  const lines = [];
  if (format === "excel") lines.push("sep=;");
  lines.push(columns.map(x => quoteCsv(x)).join(delimiter));
  for (const row of rows) {
    lines.push(fields.map(field => field === "phone" ? phoneCsv(row[field]) : quoteCsv(field === "device_type" ? deviceTypeLabel(row[field]) : row[field])).join(delimiter));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export async function exportLeads(request, env, status) {
  const format = new URL(request.url).searchParams.get("format") || "excel";
  if (!["excel", "comma"].includes(format)) return respond({ error: "invalid_format" }, 400);
  const collected = [];
  try {
    for (let offset = 0; offset <= LIMIT; offset += CHUNK) {
      const size = offset === LIMIT ? 1 : CHUNK;
      const sql = status
        ? "SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
        : "SELECT * FROM leads ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
      const stmt = status
        ? env.LEADS_DB.prepare(sql).bind(status, size, offset)
        : env.LEADS_DB.prepare(sql).bind(size, offset);
      const { results } = await stmt.all();
      const batch = results ?? [];
      if (offset === LIMIT && batch.length) return respond({ error: "csv_export_limit_10000" }, 413);
      collected.push(...batch);
      if (batch.length < size) break;
    }
    const body = makeCsv(collected, format);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mathlab-leads-' + date + '.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("CRM CSV export failed");
    return respond({ error: "database_export_failed" }, 503);
  }
}

export async function deleteOneLead(env, id) {
  if (!validLeadId(id)) return respond({ error: "invalid_id" }, 400);
  try {
    const result = await env.LEADS_DB.prepare("DELETE FROM leads WHERE id = ?").bind(id).run();
    return respond({ ok: true, deleted: result.meta?.changes ?? 0 });
  } catch {
    console.error("CRM single delete failed");
    return respond({ error: "database_delete_failed" }, 503);
  }
}

export async function deleteSelectedLeads(request, env) {
  let body;
  try {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new Error();
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new Error();
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 4096) throw new Error();
    body = JSON.parse(text);
  } catch { return respond({ error: "invalid_request" }, 400); }
  if (!body || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 50 ||
      body.ids.some(id => !validLeadId(id)) || new Set(body.ids).size !== body.ids.length) {
    return respond({ error: "invalid_ids" }, 400);
  }
  const placeholders = body.ids.map(() => "?").join(",");
  try {
    const result = await env.LEADS_DB.prepare("DELETE FROM leads WHERE id IN (" + placeholders + ")")
      .bind(...body.ids).run();
    return respond({ ok: true, deleted: result.meta?.changes ?? 0 });
  } catch {
    console.error("CRM bulk delete failed");
    return respond({ error: "database_delete_failed" }, 503);
  }
}
