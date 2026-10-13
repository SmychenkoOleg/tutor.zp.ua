import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const content = JSON.parse(
  readFileSync(new URL("../content/site.json", import.meta.url), "utf8"),
);

test("production Worker renders home page with CMS content and SEO", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("production-test", String(process.pid));
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200, "Home page must respond with HTTP 200");
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html\s[^>]*lang="uk"/, "HTML language must be Ukrainian");
  assert.ok(html.includes(`<title>${content.seo.title}</title>`), "CMS title must be rendered");
  for (const [label, value] of [
    ["SEO description", content.seo.description],
    ["hero headline", content.hero.headline],
    ["hero eyebrow", content.hero.eyebrow],
    ["contact telephone", content.contact.phoneHref],
    ["FAQ question", content.faq.items[0].question],
  ]) {
    assert.ok(html.includes(value), `${label} must appear in rendered HTML`);
  }
  assert.match(html, /href="\/privacy-policy"/, "Privacy policy link must exist");
});
