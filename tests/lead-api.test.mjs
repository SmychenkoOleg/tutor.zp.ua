import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("api-smoke", String(process.pid));
const { default: worker } = await import(workerUrl.href);

const runtime = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = {
  waitUntil() {},
  passThroughOnException() {},
};

const validLead = {
  name: "Тест Заявка",
  phone: "0931234567",
  email: "test@example.com",
  intent: "Тестове звернення",
};

async function submit(data) {
  return worker.fetch(new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }), runtime, ctx);
}

test("API rejects invalid lead fields before attempting delivery", async () => {
  const invalid = [
    { ...validLead, name: "Тест" },
    { ...validLead, phone: "0123456789" },
    { ...validLead, email: "invalid" },
  ];
  for (const body of invalid) {
    const result = await submit(body);
    assert.equal(result.status, 400);
  }
});

test("API honeypot responds safely to spam submission", async () => {
  const response = await submit({ ...validLead, website: "example.com" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("valid lead returns 503 when Telegram is deliberately not configured", async () => {
  if (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_CHAT_ID) {
    throw new Error("This smoke test must not run with live Telegram credentials.");
  }
  const response = await submit(validLead);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "telegram_not_configured" });
});
