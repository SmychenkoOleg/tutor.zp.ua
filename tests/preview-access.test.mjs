import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewWorker, PREVIEW_USERNAME } from "../worker/preview-security.mjs";

const password = "TestingOnly-Local-StrongPassword-1234";
const basic = (user, pass) => "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
const request = (path, authorization) => new Request("https://tutor-zp-ua-preview.example.test" + path, authorization ? {
  headers: { authorization },
} : undefined);
const ctx = { waitUntil() {}, passThroughOnException() {} };

function harness() {
  const calls = { application: 0, assets: 0 };
  const siteWorker = {
    async fetch() {
      calls.application++;
      return new Response("<html><body>Tutor preview</body></html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  };
  const env = {
    PREVIEW_AUTH_PASSWORD: password,
    ASSETS: {
      async fetch() {
        calls.assets++;
        return new Response("fake JavaScript asset", {
          headers: { "Content-Type": "application/javascript" },
        });
      },
    },
  };
  return { worker: createPreviewWorker(siteWorker), env, calls };
}

test("fail closed when password secret is missing or too short", async () => {
  const { worker, env, calls } = harness();
  for (const secret of [undefined, "", "too-short"]) {
    const response = await worker.fetch(request("/"), { ...env, PREVIEW_AUTH_PASSWORD: secret }, ctx);
    assert.equal(response.status, 503);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  }
  assert.equal(calls.application, 0);
  assert.equal(calls.assets, 0);
});

test("deny anonymous, incorrect and malformed Basic auth for HTML, APIs and assets", async () => {
  const { worker, env, calls } = harness();
  for (const path of ["/", "/api/lead", "/assets/index.js", "/images/hero-math.png"]) {
    for (const auth of [undefined, basic(PREVIEW_USERNAME, "wrong"), "Basic invalid%%%%"]) {
      const response = await worker.fetch(request(path, auth), env, ctx);
      assert.equal(response.status, 401, `${path}: must be protected`);
      assert.match(response.headers.get("www-authenticate") ?? "", /Basic/);
      assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
    }
  }
  assert.equal(calls.application, 0);
  assert.equal(calls.assets, 0);
});

test("authorized requests reach appropriate backend and apply security headers", async () => {
  const { worker, env, calls } = harness();
  const auth = basic(PREVIEW_USERNAME, password);
  const page = await worker.fetch(request("/", auth), env, ctx);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Tutor preview/);
  assert.match(page.headers.get("content-security-policy") ?? "", /connect-src 'self'/);
  assert.match(page.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.match(page.headers.get("cache-control") ?? "", /no-store/);

  const asset = await worker.fetch(request("/assets/app.js", auth), env, ctx);
  assert.equal(asset.status, 200);
  assert.match(await asset.text(), /fake JavaScript asset/);
  assert.equal(calls.application, 1);
  assert.equal(calls.assets, 1);
});

test("preview entrypoint authenticates before invoking real bundled site", async () => {
  const { default: liveWorker } = await import("../worker/preview-entry.mjs");
  const resp = await liveWorker.fetch(request("/"), {
    PREVIEW_AUTH_PASSWORD: password,
    ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
  }, ctx);
  assert.equal(resp.status, 401);
  assert.match(resp.headers.get("x-robots-tag") ?? "", /noindex/);
});
