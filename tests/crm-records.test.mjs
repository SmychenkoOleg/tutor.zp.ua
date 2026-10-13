import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";
import { readFileSync } from "node:fs";
import { makeCsv } from "../worker/crm-records.mjs";
import { handleAdmin } from "../worker/crm-admin.mjs";
import { createSession, setCookie } from "../worker/crm-auth.mjs";
import { dashboardHtml } from "../worker/crm-dashboard.mjs";

const origin = "https://preview.example";
const secrets = {
  LEADS_ADMIN_PASSWORD: "unit-test-only-password-keep-off-production",
  LEADS_SESSION_SECRET: "unit-test-only-session-secret-at-least-32",
};
const ids = Array.from({length:75},(_,i)=>"11111111-1111-4111-8111-"+String(i+1).padStart(12,"0"));
const sampleRows = () => ids.map((id,i)=>({
  id, created_at:"2026-10-13T08:00:00Z",
  name: i===0 ? "=2+3" : "Тест Заявка " + i,
  phone:i===0?"0931234567":"+380 (93) 123-45-67",
  email:"test"+i+"@example.com",
  intent:"Підготовка до НМТ",
  source:"/",
  status: i%2===0?"new":"in_progress",
  telegram_status:"sent",
  admin_note:i===0?"+SUM(1,1)":"Нотатка",
}));
function fakeDb(rows=sampleRows()){
  const prepare=sql=>({
    bind(...args){this.args=args;return this;},
    async all(){
      const args=this.args||[];
      let selected=rows.slice();
      if(sql.includes("WHERE status = ?")) selected=selected.filter(r=>r.status===args[0]);
      if(sql.includes("OFFSET ?")) {
        const size=args[args.length-2], offset=args[args.length-1];
        return { results:selected.slice(offset,offset+size) };
      }
      return {results:selected.slice(0,50)};
    },
    async run(){
      if(sql.startsWith("DELETE FROM leads WHERE id IN")) {
        const previous=rows.length;
        const deletedIds=new Set(this.args);
        rows.splice(0,rows.length,...rows.filter(r=>!deletedIds.has(r.id)));
        return {meta:{changes:previous-rows.length}};
      }
      if(sql.startsWith("DELETE FROM leads WHERE id = ?")) {
        const previous=rows.length;
        rows.splice(0,rows.length,...rows.filter(r=>r.id!==this.args[0]));
        return {meta:{changes:previous-rows.length}};
      }
      throw Error("Unexpected SQL "+sql);
    }
  });
  return {prepare,rows};
}
function request(path,method="GET",data,headers={}){
  return new Request(origin+path,{method,headers:{
    ...headers,...(data!==undefined?{"Content-Type":"application/json",Origin:origin}:{})
  },body:data===undefined?undefined:JSON.stringify(data)});
}
async function sessionHeaders(env){
  const value=await createSession(env);
  return {Cookie:setCookie(value).split(";")[0]};
}

test("dashboard separates contact columns and supplies independent remove/select/export controls",()=>{
  assert.match(dashboardHtml, /<th>Ім'я та Прізвище<\/th><th>Телефон<\/th><th>e-mail<\/th>/);
  assert.match(dashboardHtml, /id="select-all"/);
  assert.match(dashboardHtml, /id="delete-selected"/);
  assert.match(dashboardHtml, /id="format"/);
  assert.match(dashboardHtml, /id="export"/);
  assert.match(dashboardHtml, /method:'DELETE'/);
  assert.match(dashboardHtml, /method:'POST'/);
  assert.match(dashboardHtml, /confirm\('Безповоротно/);
  assert.match(dashboardHtml, /cell\(tr,lead.name\)/);
  assert.match(dashboardHtml, /cell\(tr,lead.phone\)/);
  assert.match(dashboardHtml, /cell\(tr,lead.email\)/);
  const script=dashboardHtml.match(/<script>([\s\S]+?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new Script(script));
});

test("Excel CSV preserves Ukrainian text, multiline notes, phone leading zeros and sanitizes formulas",()=>{
  const row=sampleRows()[0];
  row.admin_note = 'рядок 1\n=HYPERLINK("bad")';
  const csv=makeCsv([row]);
  assert.ok(csv.startsWith("\uFEFFsep=;\r\n"));
  assert.match(csv,/Ім’я та Прізвище/);
  assert.match(csv,/"'=/);
  assert.match(csv,/""0931234567""/);
  assert.match(csv,/рядок 1\n=HYPERLINK/);
  const comma=makeCsv([row],"comma");
  assert.ok(comma.startsWith("\uFEFF\"Дата\",\"Ім’я"));
  assert.doesNotMatch(comma,/sep=;/);
  assert.match(comma,/","/);
  assert.throws(()=>makeCsv([],"tsv"),/format/);
});

test("CSV includes all 75 records instead of only the displayed 50, and respects selected status",async()=>{
  const env={...secrets,LEADS_DB:fakeDb()};
  const header=await sessionHeaders(env);
  const all=await handleAdmin(request("/admin/api/leads/export", "GET",undefined,header),env);
  assert.equal(all.status,200);
  assert.match(all.headers.get("content-disposition")||"",/attachment/);
  assert.match(all.headers.get("content-type")||"",/text\/csv/);
  const csv=await all.text();
  assert.equal(csv.split("\r\n").filter(row=>row.includes("@example.com")).length,75);
  const filtered=await handleAdmin(request("/admin/api/leads/export?status=new&format=comma","GET",undefined,header),env);
  assert.equal(filtered.status,200);
  const filteredCsv=await filtered.text();
  assert.equal(filteredCsv.split("\r\n").filter(row=>row.includes("@example.com")).length,38);
  const bad=await handleAdmin(request("/admin/api/leads/export?format=pdf","GET",undefined,header),env);
  assert.equal(bad.status,400);
});

test("export and deletes reject unauthenticated users and cross-origin mutation attempts",async()=>{
  const env={...secrets,LEADS_DB:fakeDb()};
  const header=await sessionHeaders(env);
  assert.equal((await handleAdmin(request("/admin/api/leads/export"),env)).status,401);
  assert.equal((await handleAdmin(request("/admin/api/leads/"+ids[0],"DELETE"),env)).status,401);
  assert.equal((await handleAdmin(request("/admin/api/leads/bulk-delete","POST",{ids:[ids[0]]}),env)).status,401);
  const evil=new Request(origin+"/admin/api/leads/"+ids[0],{
    method:"DELETE",headers:{...header,Origin:"https://evil.example"}
  });
  assert.equal((await handleAdmin(evil,env)).status,403);
  const bulkEvil=new Request(origin+"/admin/api/leads/bulk-delete",{
    method:"POST",headers:{...header,"Content-Type":"application/json",Origin:"https://evil.example"},
    body:JSON.stringify({ids:[ids[0]]})
  });
  assert.equal((await handleAdmin(bulkEvil,env)).status,403);
  assert.equal(env.LEADS_DB.rows.length,75);
});

test("single-row deletion and selected-row deletion remove exactly the requested records",async()=>{
  const env={...secrets,LEADS_DB:fakeDb()};
  const header=await sessionHeaders(env);
  const one=await handleAdmin(request("/admin/api/leads/"+ids[0],"DELETE",{},header),env);
  assert.equal(one.status,200);
  assert.deepEqual(await one.json(),{ok:true,deleted:1});
  assert.equal(env.LEADS_DB.rows.length,74);
  const second=await handleAdmin(request("/admin/api/leads/bulk-delete","POST",{ids:[ids[1],ids[2]]},header),env);
  assert.equal(second.status,200);
  assert.equal((await second.json()).deleted,2);
  assert.equal(env.LEADS_DB.rows.length,72);
  assert.ok(env.LEADS_DB.rows.some(x=>x.id===ids[3]));
  const invalid=await handleAdmin(request("/admin/api/leads/bulk-delete","POST",{ids:[ids[3],ids[3]]},header),env);
  assert.equal(invalid.status,400);
  const oversized=await handleAdmin(request("/admin/api/leads/bulk-delete","POST",{ids:ids.slice(0,51)},header),env);
  assert.equal(oversized.status,400);
  assert.equal(env.LEADS_DB.rows.length,72);
});

test("CSV does not silently truncate more than 10,000 records",async()=>{
  // Simulate D1 returning full pages, including the 10,001st row.
  const largeRows=Array.from({length:10001},(_,i)=>({...sampleRows()[0],id:String(i).padStart(36,"0")}));
  const env={...secrets,LEADS_DB:fakeDb(largeRows)};
  const header=await sessionHeaders(env);
  const result=await handleAdmin(request("/admin/api/leads/export","GET",undefined,header),env);
  assert.equal(result.status,413);
  assert.deepEqual(await result.json(),{error:"csv_export_limit_10000"});
});
