// The HTML shell contains no personal information: all lead rows are fetched
// from the CRM API after the independent administrator session is validated.
export const dashboardHtml = String.raw`<!doctype html>
<html lang="uk"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>MathLab — заявки CRM</title>
<style>
:root{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#13234d}
*{box-sizing:border-box}body{margin:0;background:#f2f5fb;font-size:14px}
main{max-width:1500px;margin:28px auto;padding:14px}
h1{font-size:clamp(21px,3vw,29px);margin:0}
.panel{padding:20px;background:#fff;border-radius:15px;box-shadow:0 7px 30px #0a235313}
.actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:15px}
.actions.top{justify-content:space-between}
button,select{font:inherit;min-height:39px;border-radius:8px;padding:8px 12px;cursor:pointer}
button{background:#3157e5;color:#fff;border:0;font-weight:650}
button:disabled{opacity:.55;cursor:not-allowed}
button.danger{background:#b72c35}button.light{background:#eaf0fa;color:#173268}
button.small{padding:7px 9px;font-size:13px;min-height:34px}
select,textarea{border:1px solid #c9d3e5;background:white}
label{font-weight:600}
.toolbar-group{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:1280px;font-size:13px}
td,th{padding:11px 9px;text-align:left;vertical-align:top;border-bottom:1px solid #e2e9f1}
th{white-space:nowrap;background:#f6f8fc}
td{overflow-wrap:anywhere;max-width:255px}
td:nth-child(3),td:nth-child(4){white-space:nowrap}
tr:nth-child(even) td{background:#fbfcfe}
a{color:#2853bb}
textarea{font:inherit;width:175px;min-height:65px;max-width:100%;padding:7px;border-radius:7px}
td select{max-width:145px}
td button{margin-bottom:5px}
.note{font-size:12px;color:#65758e}
.notice{min-height:22px;color:#a32323;font-weight:600}
.notice.success{color:#176242}
input[type=checkbox]{width:18px;height:18px;accent-color:#3157e5;cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #82adfa;outline-offset:2px}
@media(max-width:700px){main{margin:10px auto;padding:8px}.panel{padding:12px}.actions{gap:8px}}
</style></head>
<body><main>
<div class="actions top"><h1>MathLab — заявки</h1><button id="logout" class="light" type="button">Вийти</button></div>
<section class="panel" aria-label="Управління заявками">
<div class="actions">
<label for="filter">Статус:</label>
<select id="filter"><option value="">Усі</option><option value="new">Нові</option>
<option value="in_progress">У роботі</option><option value="completed">Завершені</option>
<option value="cancelled">Скасовані</option></select>
<button id="reload" class="light" type="button">Оновити</button>
<div class="toolbar-group">
<label for="format">Експорт:</label>
<select id="format" aria-label="Формат CSV"><option value="excel">CSV для Excel (;)</option><option value="comma">CSV з комами (,)</option></select>
<button id="export" type="button">Завантажити CSV</button>
</div>
</div>
<div class="actions">
<button id="delete-selected" class="danger" type="button" disabled>Видалити вибрані (0)</button>
<span id="count" class="note">Завантаження…</span>
</div>
<p id="message" class="notice" role="status" aria-live="polite"></p>
<div class="scroll">
<table aria-label="Список заявок">
<thead><tr><th><input type="checkbox" id="select-all" aria-label="Вибрати всі заявки на цій сторінці"></th>
<th>Дата</th><th>Ім'я та Прізвище</th><th>Телефон</th><th>e-mail</th>
<th>Мета / джерело</th><th>Статус</th><th>Примітка</th><th>Telegram</th><th>Дії</th></tr></thead>
<tbody id="rows"></tbody></table></div>
<p class="note">Таблиця показує останні 50 заявок за вибраним статусом. Експорт охоплює всі заявки за цим фільтром (до 10 000). Видалення з D1 є незворотним.</p>
</section></main>
<script>
const tableBody=document.getElementById('rows');
const info=document.getElementById('message');
const chosen=new Set();
const statuses=[['new','Нова'],['in_progress','У роботі'],['completed','Завершена'],['cancelled','Скасована']];
let visible=[];
let busy=false;

function notify(text, success=false){info.textContent=text;info.classList.toggle('success',success);}
function cell(row,text){
 const td=document.createElement('td');td.textContent=String(text??'');row.append(td);return td;
}
function updateSelection(){
 const all=document.getElementById('select-all');
 const selected=visible.filter(row=>chosen.has(row.id)).length;
 const button=document.getElementById('delete-selected');
 button.textContent='Видалити вибрані ('+selected+')';
 button.disabled=busy||selected===0;
 all.checked=visible.length>0&&selected===visible.length;
 all.indeterminate=selected>0&&selected<visible.length;
 all.disabled=busy||visible.length===0;
 document.getElementById('count').textContent='Показано: '+visible.length+'. Вибрано: '+selected;
}
function render(leads){
 visible=leads;chosen.clear();tableBody.replaceChildren();
 if(!visible.length){const tr=document.createElement('tr');const td=cell(tr,'За вибраним фільтром заявок немає.');td.colSpan=10;tableBody.append(tr);}
 for(const lead of visible){
  const tr=document.createElement('tr');
  const selectTd=cell(tr,'');
  const check=document.createElement('input');check.type='checkbox';
  check.setAttribute('aria-label','Вибрати заявку '+lead.name);check.checked=false;
  check.addEventListener('change',()=>{if(check.checked)chosen.add(lead.id);else chosen.delete(lead.id);updateSelection();});
  selectTd.append(check);
  cell(tr,lead.created_at);
  cell(tr,lead.name);
  cell(tr,lead.phone);
  cell(tr,lead.email);
  cell(tr,[lead.intent,lead.source].filter(Boolean).join(' / '));
  const statusTd=cell(tr,'');const select=document.createElement('select');
  select.setAttribute('aria-label','Статус заявки '+lead.name);
  for(const item of statuses){const option=document.createElement('option');option.value=item[0];option.textContent=item[1];select.append(option);}
  select.value=lead.status;statusTd.append(select);
  const noteTd=cell(tr,'');const note=document.createElement('textarea');
  note.setAttribute('aria-label','Примітка до заявки '+lead.name);note.value=lead.admin_note||'';note.maxLength=2000;noteTd.append(note);
  cell(tr,lead.telegram_status);
  const actions=cell(tr,'');
  const save=document.createElement('button');save.type='button';save.className='small';save.textContent='Зберегти';
  save.addEventListener('click',async()=>{
    save.disabled=true;notify('');
    try{
      const response=await fetch('/admin/api/leads/'+encodeURIComponent(lead.id),{
        method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',
        body:JSON.stringify({status:select.value,admin_note:note.value})
      });
      if(response.status===401){location.replace('/admin/login');return;}
      if(!response.ok)throw Error('save');
      notify('Зміни збережено.',true);
    }catch{notify('Не вдалося зберегти заявку.');}
    finally{save.disabled=false;}
  });
  const remove=document.createElement('button');remove.type='button';remove.className='small danger';remove.textContent='Видалити';
  remove.setAttribute('aria-label','Видалити заявку '+lead.name);
  remove.addEventListener('click',async()=>{
    if(!confirm('Безповоротно видалити заявку від '+lead.name+'?'))return;
    remove.disabled=true;notify('');
    try{
      const response=await fetch('/admin/api/leads/'+encodeURIComponent(lead.id),{
        method:'DELETE',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:'{}'
      });
      if(response.status===401){location.replace('/admin/login');return;}
      if(!response.ok)throw Error('delete');
      await load();
      notify('Заявку видалено з бази.',true);
    }catch{notify('Не вдалося видалити заявку.');remove.disabled=false;}
  });
  actions.append(save,document.createTextNode(' '),remove);
  tableBody.append(tr);
 }
 updateSelection();
}
async function load(){
 notify('');chosen.clear();visible=[];updateSelection();
 try{
  const status=document.getElementById('filter').value;
  const path='/admin/api/leads'+(status?'?status='+encodeURIComponent(status):'');
  const response=await fetch(path,{credentials:'same-origin'});
  if(response.status===401){location.replace('/admin/login');return;}
  if(!response.ok)throw Error('load');
  const payload=await response.json();render(payload.leads);
 }catch{notify('Не вдалося завантажити заявки.');tableBody.replaceChildren();updateSelection();}
}
document.getElementById('select-all').addEventListener('change',event=>{
 for(const lead of visible){if(event.target.checked)chosen.add(lead.id);else chosen.delete(lead.id);}
 tableBody.querySelectorAll('input[type=checkbox]').forEach(input=>{input.checked=event.target.checked;});
 updateSelection();
});
document.getElementById('delete-selected').addEventListener('click',async()=>{
 const ids=visible.filter(item=>chosen.has(item.id)).map(item=>item.id);
 if(!ids.length||busy)return;
 if(!confirm('Безповоротно видалити '+ids.length+' вибраних заявок із бази D1?'))return;
 busy=true;updateSelection();notify('');
 try{
  const response=await fetch('/admin/api/leads/bulk-delete',{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({ids})
  });
  if(response.status===401){location.replace('/admin/login');return;}
  if(!response.ok)throw Error('bulk-delete');
  const result=await response.json();
  await load();notify('Видалено заявок: '+result.deleted+'.',true);
 }catch{notify('Не вдалося видалити вибрані заявки.');}
 finally{busy=false;updateSelection();}
});
document.getElementById('export').addEventListener('click',()=>{
 const status=document.getElementById('filter').value;
 const format=document.getElementById('format').value;
 const params=new URLSearchParams({format});
 if(status)params.set('status',status);
 const link=document.createElement('a');link.href='/admin/api/leads/export?'+params.toString();
 link.style.display='none';document.body.append(link);link.click();link.remove();
});
document.getElementById('filter').addEventListener('change',load);
document.getElementById('reload').addEventListener('click',load);
document.getElementById('logout').addEventListener('click',async()=>{
 await fetch('/admin/api/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
 location.replace('/admin/login');
});
load();
</script></body></html>`;
