import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyDevice, deviceTypeLabel } from "../worker/crm-device.mjs";
import { makeCsv } from "../worker/crm-records.mjs";
import { dashboardHtml } from "../worker/crm-dashboard.mjs";
import { storeLead } from "../worker/crm-leads.mjs";

const request = (userAgent, mobileHint) => {
  const headers = {};
  if (userAgent !== undefined) headers["User-Agent"] = userAgent;
  if (mobileHint !== undefined) headers["Sec-CH-UA-Mobile"] = mobileHint;
  return new Request("https://preview.example/api/lead", { headers });
};

test("classifies common smartphone, tablet, desktop and smart TV user agents", () => {
  const examples = [
    ["mobile", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"],
    ["mobile", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"],
    ["tablet", "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"],
    ["tablet", "Mozilla/5.0 (Linux; Android 13; SM-T500) AppleWebKit/537.36 Safari/537.36"],
    ["tablet", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Mobile/15E148"],
    ["desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36"],
    ["desktop", "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 Safari/605.1.15"],
    ["desktop", "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/128.0"],
    ["tv", "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36"],
    ["tv", "Mozilla/5.0 (Linux; Android 10; AFTT) AppleWebKit/537.36"],
    ["tv", "Mozilla/5.0 (Roku/DVP-11.5)"],
    ["unknown", "Mozilla/5.0"],
    ["unknown", "Googlebot/2.1 (+http://www.google.com/bot.html)"],
  ];
  for (const [category, userAgent] of examples) {
    assert.equal(classifyDevice(request(userAgent)), category, userAgent);
  }
});

test("Client Hint only distinguishes mobile positively; unknown remains unknown", () => {
  assert.equal(classifyDevice(request(undefined, "?1")), "mobile");
  assert.equal(classifyDevice(request(undefined, "?0")), "unknown");
  assert.equal(classifyDevice(request(undefined)), "unknown");
  assert.equal(classifyDevice(request("Mozilla/5.0 (iPad; CPU OS 17) Mobile/15E148", "?1")), "tablet");
  assert.equal(classifyDevice(request("Mozilla/5.0 (SMART-TV; Tizen 6.0)", "?1")), "tv");
  assert.equal(deviceTypeLabel("mobile"), "Мобільний");
  assert.equal(deviceTypeLabel("desktop"), "Комп’ютер");
  assert.equal(deviceTypeLabel("tablet"), "Планшет");
  assert.equal(deviceTypeLabel("tv"), "Телевізор");
  assert.equal(deviceTypeLabel("unknown"), "Невідомо");
  assert.equal(deviceTypeLabel(undefined), "Невідомо");
  assert.equal(deviceTypeLabel("unsupported"), "Невідомо");
});

test("D1 lead stores the server-derived category, not a client-provided device type", async () => {
  let recorded;
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          assert.match(sql, /^INSERT INTO leads /);
          recorded = values;
          return { run: async () => ({ success: true }) };
        },
      };
    },
  };
  // Ignore the post-insert Telegram status UPDATE in this test's fake database.
  const storage = {
    prepare(sql) {
      if (sql.startsWith("UPDATE")) return {bind:()=>({run:async()=>({success:true})})};
      return db.prepare(sql);
    },
  };
  const data = { name:"Тест Пристрій", phone:"0931234567", email:"test@example.com",
    intent:"Перевірка", device_type:"tv", website:"" };
  const response = await storeLead(new Request("https://preview.example/api/lead", {
    method:"POST", headers:{ "Content-Type":"application/json", "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    body:JSON.stringify(data),
  }), { LEADS_DB:storage });
  assert.equal(response.status,200);
  assert.equal(recorded.length,7);
  assert.equal(recorded[6],"desktop");
  assert.ok(!recorded.includes("tv"));
});

test("CRM table and both CSV exports show localized device category, including old leads", () => {
  assert.match(dashboardHtml, /<th>e-mail<\/th><th>Пристрій<\/th>/);
  assert.match(dashboardHtml, /cell\(tr,Object\.prototype\.hasOwnProperty\.call\(deviceNames,lead\.device_type\)/);
  const base = {
    id:"123", created_at:"2026-10-13T08:00:00Z", name:"Тест Приклад",
    phone:"0931234567", email:"test@example.com", intent:"Проба",
    source:"/", status:"new", admin_note:"", telegram_status:"sent",
  };
  const all = ["mobile","desktop","tablet","tv","unknown", undefined];
  const rows = all.map(value => ({...base, device_type:value}));
  for (const format of ["excel","comma"]) {
    const csv = makeCsv(rows, format);
    assert.match(csv, /"Пристрій"/);
    for (const label of ["Мобільний","Комп’ютер","Планшет","Телевізор","Невідомо"]) {
      assert.ok(csv.includes('"' + label + '"'), label + " missing from " + format);
    }
    assert.ok(!csv.includes("user-agent"));
  }
});

test("D1 migration only adds the device column; it does not delete existing leads", () => {
  const sql = readFileSync(new URL("../migrations/0002_lead_device_type.sql", import.meta.url), "utf8");
  assert.match(sql, /^ALTER TABLE leads\s+ADD COLUMN device_type TEXT NOT NULL DEFAULT 'unknown'/);
  assert.match(sql, /CHECK \(device_type IN \('mobile', 'desktop', 'tablet', 'tv', 'unknown'\)\)/);
  assert.doesNotMatch(sql, /\b(?:DROP|DELETE|TRUNCATE)\b/i);
});
