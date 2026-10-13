import assert from "node:assert/strict";
import test from "node:test";
import { storeLead } from "../worker/crm-leads.mjs";
import { handleAdmin } from "../worker/crm-admin.mjs";
import { hasSession } from "../worker/crm-auth.mjs";

const origin = "https://test.example";
const auth = {
  LEADS_ADMIN_PASSWORD: "admin-password-for-tests-only-123456",
  LEADS_SESSION_SECRET: "local-hmac-test-key-1234567890-super-long-secret",
};
const valid = {
  name: "Тест Заявка",
  phone: "0931234567",
  email: "test@example.com",
  intent: "Підготовка до НМТ",
};
function createDb() {
  const rows = [];
  const prepare = sql => ({
    bind(...values) { this.values = values; return this; },
    async run() {
      if (sql.startsWith("INSERT")) {
        const [id, name, phone, email, intent, source] = this.values;
        rows.push({ id, name, phone, email, intent, source, status: "new",
          telegram_status: "pending", admin_note: "", created_at: new Date().toISOString() });
        return { success: true };
      }
      if (sql.startsWith("UPDATE leads SET telegram_status")) {
        const [status, id] = this.values;
        const row = rows.find(x => x.id === id);
        if (row) row.telegram_status = status;
        return { success: true };
      }
      if (sql.startsWith("UPDATE leads SET status")) {
        const [status, note, id] = this.values;
        const row = rows.find(x => x.id === id);
        if (row) { row.status = status; row.admin_note = note; }
        return { meta: { changes: row ? 1 : 0 } };
      }
      throw Error("Unexpected query " + sql);
    },
    async all() {
      const status = this.values?.[0];
      return { results: rows.filter(r => !status || r.status === status) };
    },
  });
  return { prepare, rows };
}
function req(path, method = "GET", data, headers = {}) {
  const requestHeaders = { ...headers };
  if (data !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestHeaders["Origin"] = origin;
  }
  return new Request(origin + path, {
    method, headers: requestHeaders,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}
test("D1 remains unavailable unless a runtime binding exists", async () => {
  assert.equal((await storeLead(req("/api/lead", "POST", valid), {})).status, 503);
});
test("lead validation and spam honeypot do not write to D1", async () => {
  const db = createDb();
  const env = { LEADS_DB: db };
  for (const bad of [{...valid,name:"Test"}, {...valid,phone:"0000000000"}, {...valid,email:"invalid"}]) {
    const response = await storeLead(req("/api/lead", "POST", bad), env);
    assert.equal(response.status, 400);
  }
  const spam = await storeLead(req("/api/lead", "POST", { ...valid, website:"bot" }), env);
  assert.equal(spam.status, 200);
  assert.equal(db.rows.length, 0);
});
test("D1 commit is retained when Telegram is unavailable", async () => {
  const db = createDb();
  const response = await storeLead(req("/api/lead", "POST", valid), { LEADS_DB: db });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).telegram, "failed");
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].status, "new");
  assert.equal(db.rows[0].telegram_status, "failed");
});
test("D1 record and Telegram delivery status both succeed", async () => {
  const db = createDb();
  let sent = 0;
  const env = { LEADS_DB: db, TELEGRAM_BOT_TOKEN:"dummy-test-token", TELEGRAM_CHAT_ID:"123" };
  const response = await storeLead(req("/api/lead", "POST", valid), env, async () => {
    sent++;
    return { ok: true };
  });
  assert.equal(response.status, 200);
  assert.equal(sent, 1);
  assert.equal(db.rows[0].telegram_status, "sent");
});
test("admin API requires its own session; password is not enough without cookie", async () => {
  const db = createDb();
  const env = { ...auth, LEADS_DB: db };
  const anon = await handleAdmin(req("/admin/api/leads"), env);
  assert.equal(anon.status, 401);
  const bad = await handleAdmin(req("/admin/api/login", "POST", { password: "wrong" }), env);
  assert.equal(bad.status, 401);
  const cross = await handleAdmin(req("/admin/api/login", "POST", { password: auth.LEADS_ADMIN_PASSWORD },
    { Origin: "https://evil.example" }), env);
  // req() intentionally assigns same origin for JSON; test manual foreign-origin request.
  const actualCross = await handleAdmin(new Request(origin + "/admin/api/login", {
    method: "POST", headers: { "Content-Type": "application/json", Origin:"https://evil.example" },
    body: JSON.stringify({password:auth.LEADS_ADMIN_PASSWORD}),
  }), env);
  assert.equal(actualCross.status, 403);

  const login = await handleAdmin(req("/admin/api/login", "POST", { password: auth.LEADS_ADMIN_PASSWORD }), env);
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  const cookieHeader = cookie.split(";")[0];
  assert.equal(await hasSession(req("/admin/leads", "GET", undefined, { Cookie:cookieHeader }), env), true);
  const dashboard = await handleAdmin(req("/admin/leads", "GET", undefined, { Cookie:cookieHeader }), env);
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /MathLab/);
  const list = await handleAdmin(req("/admin/api/leads", "GET", undefined, { Cookie:cookieHeader }), env);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray((await list.json()).leads));

  const created = await storeLead(req("/api/lead", "POST", valid), env);
  assert.equal(created.status, 200);
  const id = db.rows[0].id;
  const changed = await handleAdmin(req("/admin/api/leads/" + id, "PATCH", {
    status: "in_progress", admin_note: "Зателефонувати завтра"
  }, { Cookie:cookieHeader }), env);
  assert.equal(changed.status, 200);
  assert.equal(db.rows[0].status, "in_progress");
  const filtered = await handleAdmin(req("/admin/api/leads?status=in_progress", "GET", undefined,
    { Cookie:cookieHeader }), env);
  assert.equal((await filtered.json()).leads.length, 1);
});
