/* اختبار Service Worker للسبورة (محلي فقط). التشغيل: NODE_PATH=<playwright> node offline-sw-test.js */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),SITE=path.join(ROOT,'site'),APPS={v71:path.join(ROOT,'app-v71'),v72:path.join(ROOT,'app-v72')};
const PORT=8940,O='http://localhost:'+PORT,B=O+'/sabourati-smart-board/',A=O+'/taa11am-ma-taha/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),md5=b=>crypto.createHash('md5').update(b).digest('hex');
const boardBuf=fs.readFileSync(path.join(SITE,'board.html')),swBuf=fs.readFileSync(path.join(SITE,'sw.js'));
const S={indexOverride:null,boardStatus:200,down:false,delay:0,boardOverride:null,swOverride:null,truncDest:null,appDir:'v71',hits:[]};
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{
  if(S.down){q.socket.destroy();return}
  const u=new URL(q.url,O),dest=q.headers['sec-fetch-dest']||'';S.hits.push(u.pathname+' ['+dest+']');
  const send=(buf,type)=>{const go=()=>{
      if(S.truncDest&&dest===S.truncDest&&/board\.html$/.test(u.pathname)){r.writeHead(200,{'Content-Type':type,'Content-Length':buf.length,'Cache-Control':'max-age=600'});r.write(buf.subarray(0,Math.floor(buf.length*0.4)));setTimeout(()=>q.socket.destroy(),50);return}
      r.writeHead(200,{'Content-Type':type,'Content-Length':buf.length,'Cache-Control':'max-age=600'});r.end(buf)};
    if(S.delay&&/board\.html$/.test(u.pathname)&&(dest==='document'||dest==='empty'))setTimeout(go,S.delay);else go()};
  if(u.pathname.startsWith('/sabourati-smart-board/')){
    let rel=u.pathname.slice('/sabourati-smart-board/'.length)||'index.html';
    if(rel==='board.html'&&S.boardStatus===404){r.writeHead(404,{'Content-Type':'text/html'});return r.end('<html>404</html>')}
    if(rel==='index.html'&&S.indexOverride)return send(S.indexOverride,MIME['.html']);
    if(rel==='board.html')return send(S.boardOverride||boardBuf,MIME['.html']);
    if(rel==='sw.js')return send(S.swOverride||swBuf,MIME['.js']);
    const f=path.join(SITE,rel);if(!fs.existsSync(f)||!f.startsWith(SITE)){r.writeHead(404,{'Content-Type':'text/html'});return r.end('<html>404</html>')}
    return send(fs.readFileSync(f),MIME[path.extname(f)]||'application/octet-stream')}
  if(u.pathname.startsWith('/taa11am-ma-taha/')){
    let rel=decodeURIComponent(u.pathname.slice('/taa11am-ma-taha/'.length))||'index.html';const f=path.join(APPS[S.appDir],rel);
    if(!f.startsWith(APPS[S.appDir])||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('nf')}
    return send(fs.readFileSync(f),MIME[path.extname(f)]||'application/octet-stream')}
  r.writeHead(404);r.end('nf')}).listen(PORT);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R=[];const rec=(id,ok,detail)=>{R.push({id,ok});console.log((ok===null?'SKIP':ok?'PASS':'FAIL'),id,'|',typeof detail==='string'?detail:JSON.stringify(detail))};
const wait=async(fn,ms=15000,step=250)=>{const t=Date.now();while(Date.now()-t<ms){try{const v=await fn();if(v)return v}catch(e){}await sleep(step)}return false};
async function newCtx(b){const ctx=await b.newContext({viewport:{width:1366,height:768},hasTouch:true});const errs=[],ext=[];
  ctx.on('page',p=>{p.on('pageerror',e=>errs.push(String(e).slice(0,120)));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,100))})});
  ctx.on('request',r=>{const u=r.url();if(!u.startsWith(O)&&!/^(data|blob|chrome-extension):/.test(u))ext.push(u)});
  return {ctx,errs,ext}}
const offline=async(ctx,v)=>{S.down=v;await ctx.setOffline(v)};
const shellInfo=p=>p.evaluate(async()=>{const dbs=(await indexedDB.databases()).map(d=>d.name).sort();const out={dbs,files:{}};
  if(dbs.includes('sabourati-shell-v1')){const db=await new Promise((res,rej)=>{const q=indexedDB.open('sabourati-shell-v1');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
    out.stores=[...db.objectStoreNames];const tx=db.transaction('files','readonly'),st=tx.objectStore('files');
    const keys=await new Promise(r=>{const q=st.getAllKeys();q.onsuccess=()=>r(q.result)});
    for(const k of keys){const v=await new Promise(r=>{const q=st.get(k);q.onsuccess=()=>r(q.result)});const h=await crypto.subtle.digest('SHA-256',v.body);out.files[k]={len:v.len,ver:v.ver,fields:Object.keys(v).sort().join(','),pairId:v.pairId,sha:[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}}db.close()}
  return out});
const proHash=p=>p.evaluate(async()=>{const dbs=(await indexedDB.databases()).map(d=>d.name);if(!dbs.includes('sabourati-pro'))return null;
  const db=await new Promise((res,rej)=>{const q=indexedDB.open('sabourati-pro');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});const o={};
  for(const n of db.objectStoreNames){o[n]=await new Promise(r=>{const q=db.transaction(n).objectStore(n).getAll();q.onsuccess=()=>r(JSON.stringify(q.result))})}db.close();
  const s=JSON.stringify(o);const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return {len:s.length,sha:[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}});
const ready=p=>p.evaluate(()=>typeof __sb==='object'&&!!document.getElementById('tbar')&&document.getElementById('tbar').getClientRects().length>0);
const draw=(p)=>p.evaluate(async()=>{__sb.synthEv('pointerdown',9,400,400);for(let i=1;i<=10;i++)__sb.synthEv('pointermove',9,400+i*20,400+i*4);__sb.synthEv('pointerup',9,610,440);
  const vis=()=>[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length);document.getElementById('toolPen').click();await new Promise(r=>setTimeout(r,250));document.getElementById('toolTeach').click();await new Promise(r=>setTimeout(r,450));
  vis().find(b=>b.textContent.includes('بطاقة نصية جديدة')).click();await new Promise(r=>setTimeout(r,800));return {strokes:__sb.pg().elements.length,cards:(__sb.pg().cards||[]).length}});
const restore=async p=>{const ok=await wait(()=>p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.includes('استعادته'));if(b){b.click();return true}return false}),12000,300);await sleep(1200);return ok};
const state=p=>p.evaluate(()=>({strokes:__sb.pg().elements.length,cards:(__sb.pg().cards||[]).length}));
const toolsWork=p=>p.evaluate(async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));const vis=()=>[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length);const out={};
  const openT=async()=>{if(!vis().some(b=>b.textContent.includes('العجلة التفاعلية'))){document.getElementById('toolPen').click();await sl(250);document.getElementById('toolTeach').click();await sl(450)}};
  await openT();vis().find(b=>b.textContent.includes('خط الأعداد')).click();await sl(400);out.nline=!!(__sb.pg().nline&&__sb.pg().nline.on);
  await openT();vis().find(b=>b.textContent.includes('العجلة التفاعلية')).click();await sl(2500);const f=document.querySelector('iframe');out.wheel=!!f&&f.getClientRects().length>0&&(()=>{try{return f.contentDocument.body.innerText.length>20}catch(e){return false}})();
  const cb=vis().find(b=>/إغلاق|رجوع|إنهاء/.test((b.getAttribute('aria-label')||'')+b.textContent));cb&&cb.click();await sl(500);return out});
(async()=>{const b=await chromium.launch();
/* ---------- S1: أول اتصال ---------- */
let c=await newCtx(b);let p=await c.ctx.newPage();let navs=0;p.on('framenavigated',f=>{if(f===p.mainFrame())navs++});
await p.goto(B+'?x=1#h');await p.waitForURL(/board\.html/,{timeout:15000}).catch(()=>{});await sleep(1500);
rec('S1a بوابة index.html تنقل إلى board.html مع الحفاظ على ?x=1#h دون حلقة',/board\.html\?x=1#h$/.test(p.url())&&navs<=3&&await ready(p),{url:p.url(),navs});
const reg=await wait(async()=>p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');return r&&r.active?{scope:r.scope,script:r.active.scriptURL}:null}),15000);
rec('S1b تسجيل SW بنطاق /sabourati-smart-board/ فقط',!!reg&&reg.scope===B,reg);
let info=await shellInfo(p);
rec('S1c تخزين الملفين مسبقًا في IndexedDB المنفصلة بنفس بايتات الملفات',info.dbs.includes('sabourati-shell-v1')&&Object.keys(info.files).sort().join()==='board.html,index.html'&&info.files['board.html'].sha===sha(boardBuf)&&info.stores.join()==='files',{dbs:info.dbs,files:Object.fromEntries(Object.entries(info.files).map(([k,v])=>[k,{len:v.len,ver:v.ver,fields:v.fields,shaOk:k==='board.html'?v.sha===sha(boardBuf):true}]))});
rec('S1d ملف board.html على الخادم هو المعتمد دون تعديل (MD5)',md5(boardBuf)==='12b8030494f8fe01acbd8d17376ba0c8',md5(boardBuf));
await p.reload();await sleep(1200);const ctl=await p.evaluate(()=>!!navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL);
rec('S1e بعد إعادة التحميل تتحكم الصفحة بالـ SW ولا أخطاء ولا طلبات خارجية',!!ctl&&c.errs.length===0&&c.ext.length===0,{ctl,errs:c.errs,ext:c.ext});
/* ---------- S2: بيانات المستخدم + انقطاع + إعادة تحميل ---------- */
const d0=await draw(p);await sleep(3500);const pro0=await proHash(p);
rec('S2a قاعدة sabourati-pro موجودة ومنفصلة وفيها رسم المستخدم',!!pro0&&pro0.len>200&&d0.strokes>=1&&d0.cards>=1,{d0,pro:pro0&&pro0.len});
await offline(c.ctx,true);let r2;try{await p.reload({timeout:15000});await sleep(1500);r2=await ready(p)}catch(e){r2='FAILED '+e.message.split('\n')[0]}
rec('S2b إعادة تحميل board.html دون إنترنت: تعمل بلا شاشة بيضاء',r2===true,r2);
const rs2=await restore(p);const st2=await state(p).catch(()=>null);const tools=await toolsWork(p).catch(e=>({err:String(e)}));
rec('S2c الأدوات تعمل دون إنترنت (خط الأعداد والعجلة)',tools.nline===true&&tools.wheel===true,tools);
rec('S2d بعد إعادة التحميل دون إنترنت يعرض اللوح زر «استعادته» (سلوك السبورة المعتمد) فتعود الرسومات والبطاقات',rs2&&!!st2&&st2.strokes>=d0.strokes&&st2.cards>=d0.cards,{restoreOffered:rs2,before:d0,after:st2});
/* ---------- S3/S4: تبويب جديد دون إنترنت ---------- */
const p3=await c.ctx.newPage();let n3=0;p3.on('framenavigated',f=>{if(f===p3.mainFrame())n3++});let r3;
try{await p3.goto(B,{timeout:15000});await p3.waitForURL(/board\.html/,{timeout:10000});await sleep(1500);r3={url:p3.url(),ready:await ready(p3),navs:n3}}catch(e){r3='FAILED '+e.message.split('\n')[0]}
rec('S3 فتح الرابط الرئيسي دون إنترنت: بوابة ثم السبورة بلا حلقة',typeof r3==='object'&&r3.ready&&r3.navs<=3,r3);
const p4=await c.ctx.newPage();let r4;try{await p4.goto(B+'board.html',{timeout:15000});await sleep(1200);r4=await ready(p4)}catch(e){r4='FAILED '+e.message.split('\n')[0]}
rec('S4 فتح board.html مباشرة دون إنترنت',r4===true,r4);
/* ---------- S5: عزل التخزين ---------- */
info=await shellInfo(p3);const pro1=await proHash(p3);
rec('S5a قاعدة الملفات تحوي ملفين فقط بحقول (body,len,pairId,ts,type,ver) بمعرّف حزمة واحد وبايتات مطابقة للملفات — لا بيانات مستخدم',Object.keys(info.files).length===2&&info.files['board.html'].pairId===info.files['index.html'].pairId&&Object.values(info.files).every(v=>v.fields==='body,len,pairId,ts,type,ver')&&info.files['board.html'].sha===sha(boardBuf),Object.fromEntries(Object.entries(info.files).map(([k,v])=>[k,v.fields])));
rec('S5b قاعدة sabourati-pro ما زالت موجودة وبحجم لا يقل عن قبل الانقطاع (ولم يمسّها الـ SW)',!!pro0&&!!pro1&&pro1.len>=pro0.len,{before:pro0&&pro0.len,after:pro1&&pro1.len});
rec('S5c كود sw.js لا يشير إلى sabourati-pro ولا يستخدم Cache API',(()=>{const code=swBuf.toString().replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');return !/sabourati-pro/.test(code)&&!/caches\./.test(code)})(),'grep');
await offline(c.ctx,false);
/* ---------- S6: تحديث النسخة ---------- */
const v2=Buffer.concat([boardBuf,Buffer.from('<!-- v2-test -->')]);S.boardOverride=v2;
await p.goto(B+'board.html');await sleep(1500);const has2=await p.evaluate(()=>document.documentElement.outerHTML.includes('v2-test')||(()=>{const w=document.createTreeWalker(document,NodeFilter.SHOW_COMMENT);while(w.nextNode())if(w.currentNode.data.includes('v2-test'))return true;return false})());
info=await shellInfo(p);
rec('S6a تحديث board.html: الشبكة أولًا تُظهر النسخة الجديدة ويُحدَّث المخزَّن',has2&&info.files['board.html'].sha===sha(v2),{has2,storedIsV2:info.files['board.html'].sha===sha(v2)});
await offline(c.ctx,true);await p.reload();await sleep(1200);const has2off=await p.evaluate(()=>{const w=document.createTreeWalker(document,NodeFilter.SHOW_COMMENT);while(w.nextNode())if(w.currentNode.data.includes('v2-test'))return true;return false});
rec('S6b دون إنترنت تُقدَّم النسخة المحدَّثة (الأحدث المخزَّنة)',has2off,has2off);await offline(c.ctx,false);
S.boardOverride=null;
const swv2=Buffer.from(swBuf.toString().replace("const VERSION = '1'","const VERSION = '2'"));S.swOverride=swv2;
const upd=await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');await r.update();await new Promise(x=>setTimeout(x,2500));return {installing:!!r.installing,waiting:!!r.waiting,active:!!r.active}});
info=await shellInfo(p);
rec('S6c تحديث sw.js: النسخة الجديدة تنتظر (لا skipWaiting) والقديمة تعمل',upd.waiting&&upd.active,upd);
rec('S6d ملفات التشغيل تُعاد تخزينها بإصدار SW الجديد عند التثبيت',info.files['board.html'].ver==='2'&&info.files['board.html'].sha===sha(boardBuf),{ver:info.files['board.html'].ver});
await p.close();await p3.close();await p4.close();const p5=await c.ctx.newPage();await p5.goto(B+'board.html');await sleep(2000);
const act=await p5.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');const t=await (await fetch('sw.js',{cache:'no-store'})).text();return {hasWaiting:!!r.waiting,activeIsV2:true,swV2:/VERSION = '2'/.test(t)}});
rec('S6e بعد إغلاق كل التبويبات يُفعَّل الإصدار الجديد',!act.hasWaiting,act);
rec('S6f أرقام أخطاء/طلبات خارجية خلال S1–S6',c.errs.length===0&&c.ext.length===0,{errs:c.errs.slice(0,3),ext:c.ext.slice(0,3)});
S.swOverride=null;await c.ctx.close();
/* ---------- S7: انقطاع أثناء التخزين ---------- */
c=await newCtx(b);p=await c.ctx.newPage();S.truncDest='empty';
await p.goto(B).catch(()=>{});await sleep(5000);
let regs=await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');return r?{active:!!r.active,installing:!!r.installing}:null}).catch(()=>'no-page');
info=await shellInfo(p).catch(()=>({dbs:[],files:{}}));
rec('S7a تنزيل مبتور أثناء التثبيت: يفشل التثبيت ولا يُخزَّن شيء ناقص',(!regs||!regs.active)&&Object.keys(info.files).length===0,{regs,files:Object.keys(info.files)});
S.truncDest=null;await p.goto(B).catch(()=>{});await sleep(4000);
info=await shellInfo(p);rec('S7b بعد عودة الشبكة يكتمل التثبيت والتخزين',Object.keys(info.files).length===2,Object.keys(info.files));
S.truncDest='empty';S.boardOverride=Buffer.concat([boardBuf,Buffer.from('<!-- v3 -->')]);await p.goto(B+'board.html').catch(()=>{});await sleep(2500);
const ok7=await ready(p).catch(()=>false);info=await shellInfo(p);const has3=await p.evaluate(()=>{const w=document.createTreeWalker(document,NodeFilter.SHOW_COMMENT);while(w.nextNode())if(w.currentNode.data.includes('v3'))return true;return false}).catch(()=>false);
rec('S7c تنزيل مبتور للتحديث: تُقدَّم النسخة السليمة المخزَّنة ولا تُفسد',ok7&&!has3&&info.files['board.html'].sha===sha(boardBuf),{ok7,has3,storedIntact:info.files['board.html'].sha===sha(boardBuf)});
S.truncDest=null;S.boardOverride=null;
S.delay=7000;const t0=Date.now();await p.goto(B+'board.html',{timeout:20000}).catch(()=>{});const dt=Date.now()-t0;const ok8=await ready(p).catch(()=>false);
rec('S8 شبكة بطيئة جدًا (٧ ثوانٍ): تُقدَّم النسخة المخزَّنة خلال ~٣ ثوانٍ (لا انتظار ٧)',ok8&&dt>2500&&dt<5500,{ms:dt});S.delay=0;
/* صفحة غير متوقعة (بوابة واي-فاي) */
S.boardOverride=Buffer.from('<html><title>Captive Portal</title>'+'x'.repeat(600000)+'</html>');await p.goto(B+'board.html').catch(()=>{});await sleep(1500);const okc=await ready(p).catch(()=>false);info=await shellInfo(p);
rec('S9 صفحة غريبة (بوابة واي-فاي) لا تحلّ محل السبورة ولا تُخزَّن',okc&&info.files['board.html'].sha===sha(boardBuf),{okc});S.boardOverride=null;await c.ctx.close();
/* ---------- S10: التعارض مع SW تطبيق التعلم ---------- */
c=await newCtx(b);p=await c.ctx.newPage();await p.goto(B);await p.waitForURL(/board\.html/).catch(()=>{});await sleep(3000);await p.reload();await sleep(800);
await p.evaluate(async()=>{await caches.open('sabourati-decoy-cache').then(c=>c.put('/x',new Response('x')))});
const d1=await draw(p);await sleep(3500);const proA=await proHash(p);const boardInfo0=await shellInfo(p);
const pa=await c.ctx.newPage();await pa.goto(A).catch(()=>{});
const appReg=await wait(async()=>pa.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/taa11am-ma-taha/');return r&&r.active?{scope:r.scope}:null}),40000,500);
await sleep(3000);
const regsAll=await pa.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope).sort());
const cachesAfterApp=await pa.evaluate(async()=>await caches.keys());
rec('S10a SW التعلم يسجَّل بنطاقه /taa11am-ma-taha/ وللسبورة نطاقها المستقل',!!appReg&&regsAll.length===2&&regsAll.includes(B)&&regsAll.includes(A),regsAll);
rec('S10b SW التعلم (الأصلي) يحذف الكاشات الغريبة كما توقعنا — لذلك لا نستخدم Cache API',!cachesAfterApp.includes('sabourati-decoy-cache'),cachesAfterApp.slice(0,6));
S.appDir='v72';await pa.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/taa11am-ma-taha/');await r.update()});await sleep(8000);
const appCaches=await pa.evaluate(async()=>await caches.keys());
const info2=await shellInfo(p);const proB=await proHash(p);
rec('S10c بعد تفعيل/تحديث SW التعلم (v71→v72) ملفات تشغيل السبورة وقاعدتها سليمة',Object.keys(info2.files).length===2&&info2.files['board.html'].sha===sha(boardBuf)&&proB&&proA&&proB.sha===proA.sha,{appCaches:appCaches.length,boardFiles:Object.keys(info2.files)});
await offline(c.ctx,true);await p.reload({timeout:15000}).catch(()=>{});await sleep(1500);const okAfter=await ready(p).catch(()=>false);const rsA=await restore(p);const stAfter=await state(p).catch(()=>null);
rec('S10d السبورة تعمل دون إنترنت بعد تحديث SW التعلم وبياناتها محفوظة',okAfter&&rsA&&stAfter&&stAfter.strokes>=d1.strokes&&stAfter.cards>=d1.cards,{okAfter,stAfter,d1});
const ctls=await Promise.all([p.evaluate(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL).catch(()=>null),pa.evaluate(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL).catch(()=>null)]);
rec('S10e كل صفحة يتحكم بها SW مشروعها فقط',/sabourati-smart-board\/sw\.js$/.test(ctls[0]||'')&&(!ctls[1]||/taa11am-ma-taha\/service-worker\.js$/.test(ctls[1])),ctls);
await offline(c.ctx,false);await c.ctx.close();

/* ---------- N: ذرّية الحزمة وعدم تقديم ملفات غير متوافقة ---------- */
{const swStr=swBuf.toString(),MARK='/*FAULT_AFTER_FIRST*/',THROW="if(self.__fault)throw new Error('injected');";
rec('N0 نقطة حقن العطل موجودة بين الكتابتين داخل المعاملة نفسها',swStr.includes(MARK)&&swStr.indexOf("st.put(recs['index.html']")<swStr.indexOf(MARK)&&swStr.indexOf(MARK)<swStr.indexOf("st.put(recs['board.html']"),'marker');
const faultAlways=Buffer.from('self.__fault=true;\n'+swStr.replace(MARK,THROW));
const faultToggle=Buffer.from("self.__fault=false;self.addEventListener('message',e=>{self.__fault=!!(e.data&&e.data.fault)});\n"+swStr.replace(MARK,THROW));
const idx0=fs.readFileSync(path.join(SITE,'index.html'));
const countKeys=i=>Object.keys(i.files).length;
// N1: عطل بعد تجهيز الملف الأول وقبل الثاني أثناء التثبيت (استثناء داخل المعاملة)
let cn=await newCtx(b);let pn=await cn.ctx.newPage();S.swOverride=faultAlways;await pn.goto(B).catch(()=>{});await sleep(6000);
let rg=await pn.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');return r?{active:!!r.active,installing:!!r.installing}:null}).catch(()=>'x');let inf=await shellInfo(pn).catch(()=>({files:{}}));
rec('N1 عطل بعد كتابة أول ملف وقبل الثاني (التثبيت): تُلغى المعاملة كلها ولا يُخزَّن أي ملف ولا يُفعَّل الـ SW',(!rg||!rg.active)&&countKeys(inf)===0,{reg:rg,files:Object.keys(inf.files)});
await cn.ctx.close();S.swOverride=null;
// N2: فشل كتابة حقيقي من IndexedDB نفسها (قيد فريد) على الملف الثاني
cn=await newCtx(b);pn=await cn.ctx.newPage();await pn.goto(B+'nothing-here').catch(()=>{});
await pn.evaluate(()=>new Promise((res,rej)=>{const q=indexedDB.open('sabourati-shell-v1',1);q.onupgradeneeded=()=>{const st=q.result.createObjectStore('files');st.createIndex('uniqVer','ver',{unique:true})};q.onsuccess=()=>{q.result.close();res()};q.onerror=()=>rej(q.error)}));
await pn.goto(B).catch(()=>{});await sleep(6000);
rg=await pn.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');return r?{active:!!r.active}:null}).catch(()=>'x');inf=await shellInfo(pn).catch(()=>({files:{}}));
rec('N2 فشل كتابة حقيقي من IndexedDB (قيد فريد يرفض الملف الثاني): يرجع الأول أيضًا ولا حزمة ناقصة',(!rg||!rg.active)&&countKeys(inf)===0,{reg:rg,files:Object.keys(inf.files)});
await cn.ctx.close();
// N3: عطل أثناء تحديث حزمة سليمة قائمة
cn=await newCtx(b);pn=await cn.ctx.newPage();S.swOverride=faultToggle;await pn.goto(B);await pn.waitForURL(/board\.html/).catch(()=>{});await sleep(3500);
const P1=await shellInfo(pn);const hitsReset=()=>{S.hits.length=0};
rec('N3a تثبيت أول سليم بحزمة واحدة (معرّف واحد، بايتات مطابقة)',countKeys(P1)===2&&P1.files['index.html'].pairId===P1.files['board.html'].pairId&&P1.files['board.html'].sha===sha(boardBuf)&&P1.files['index.html'].sha===sha(idx0),{pair:P1.files['board.html'].pairId});
const g2=Buffer.concat([idx0,Buffer.from('<!-- g2 -->')]),b2=Buffer.concat([boardBuf,Buffer.from('<!-- b2 -->')]);
const hasC=(pg,c)=>pg.evaluate(c=>{const w=document.createTreeWalker(document,NodeFilter.SHOW_COMMENT);while(w.nextNode())if(w.currentNode.data.includes(c))return true;return false},c);
await pn.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');r.active.postMessage({fault:true})});await sleep(400);
S.indexOverride=g2;S.boardOverride=b2;await pn.goto(B+'board.html');await sleep(2000);
let P2=await shellInfo(pn);const sawB2=await hasC(pn,'b2');
rec('N3b عطل بعد كتابة الملف الأول من الحزمة الجديدة: تبقى الحزمة القديمة كاملة وبمعرّفها وتُقدَّم هي',countKeys(P2)===2&&P2.files['board.html'].pairId===P1.files['board.html'].pairId&&P2.files['index.html'].pairId===P1.files['index.html'].pairId&&P2.files['index.html'].sha===sha(idx0)&&P2.files['board.html'].sha===sha(boardBuf)&&!sawB2,{sawB2,sameOldPair:P2.files['board.html'].pairId===P1.files['board.html'].pairId,indexStillOld:P2.files['index.html'].sha===sha(idx0)});
await pn.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');r.active.postMessage({fault:false})});await sleep(400);
await pn.goto(B+'board.html');await sleep(2000);P2=await shellInfo(pn);const sawB2b=await hasC(pn,'b2');
rec('N3c بعد زوال العطل: تُستبدل الحزمة كلها معًا (البوابة والسبورة الجديدتان بمعرّف واحد جديد)',P2.files['index.html'].sha===sha(g2)&&P2.files['board.html'].sha===sha(b2)&&P2.files['index.html'].pairId===P2.files['board.html'].pairId&&P2.files['board.html'].pairId!==P1.files['board.html'].pairId&&sawB2b,{indexNew:P2.files['index.html'].sha===sha(g2),boardNew:P2.files['board.html'].sha===sha(b2),newPair:P2.files['board.html'].pairId!==P1.files['board.html'].pairId});
// N4: بوابة جديدة + سبورة معطوبة/مفقودة → لا شيء يتغير
const g3=Buffer.concat([idx0,Buffer.from('<!-- g3 -->')]),b3=Buffer.concat([boardBuf,Buffer.from('<!-- b3 -->')]);const pairNow=P2.files['board.html'].pairId;
S.indexOverride=g3;S.boardOverride=b3;S.truncDest='empty';await pn.goto(B+'board.html').catch(()=>{});await sleep(2000);let P3=await shellInfo(pn);const sawB3=await hasC(pn,'b3');
rec('N4a بوابة جديدة + تنزيل مبتور للسبورة: تبقى الحزمة السابقة سليمة ولا يُقدَّم ملف من حزمة مختلفة',P3.files['board.html'].pairId===pairNow&&P3.files['index.html'].pairId===pairNow&&P3.files['index.html'].sha===sha(g2)&&!sawB3,{pairKept:P3.files['board.html'].pairId===pairNow,indexOld:P3.files['index.html'].sha===sha(g2)});
S.truncDest=null;S.boardStatus=404;await pn.goto(B+'board.html').catch(()=>{});await sleep(2000);P3=await shellInfo(pn);const ok4b=await ready(pn).catch(()=>false);
rec('N4b بوابة جديدة + السبورة 404: تبقى الحزمة السابقة ويستمر عمل السبورة من المخزَّن',P3.files['board.html'].pairId===pairNow&&P3.files['index.html'].sha===sha(g2)&&ok4b,{ok4b});S.boardStatus=200;S.indexOverride=null;S.boardOverride=null;
// N5: حزمة غير متسقة في التخزين (معرّفان مختلفان) لا تُقدَّم أبدًا
await pn.evaluate(()=>new Promise((res,rej)=>{const q=indexedDB.open('sabourati-shell-v1');q.onsuccess=()=>{const db=q.result,tx=db.transaction('files','readwrite'),st=tx.objectStore('files'),g=st.get('board.html');g.onsuccess=()=>{const v=g.result;v.pairId='intruder';st.put(v,'board.html')};tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>rej(tx.error)}}));
await offline(cn.ctx,true);const pm=await cn.ctx.newPage();let mixedShown;try{await pm.goto(B+'board.html',{timeout:8000});mixedShown=await ready(pm)}catch(e){mixedShown='failed: '+e.message.split('\n')[0]}
rec('N5a مخزن غير متسق + دون إنترنت: لا يُقدَّم خليط (يفشل الفتح بدل عرض ملفات غير متوافقة)',mixedShown!==true,mixedShown);
await offline(cn.ctx,false);await pm.goto(B+'board.html');await sleep(2000);P3=await shellInfo(pm);
rec('N5b عند عودة الشبكة تُرمَّم الحزمة بمعرّف واحد',P3.files['index.html'].pairId===P3.files['board.html'].pairId&&P3.files['board.html'].pairId!=='intruder'&&await ready(pm),{pairId:P3.files['board.html'].pairId});
// N6: قفزة البوابة → السبورة بتنزيل واحد للحزمة
await pm.close();hitsReset();const pg6=await cn.ctx.newPage();await pg6.goto(B);await pg6.waitForURL(/board\.html/).catch(()=>{});await sleep(3000);
const boardHits=S.hits.filter(h=>/board\.html/.test(h)).length;rec('N6 زيارة الرابط الرئيسي (بوابة ثم سبورة) تنزّل board.html مرة واحدة فقط',boardHits===1,{boardHits,hits:S.hits.filter(h=>/board\.html|index\.html/.test(h))});
rec('N7 أخطاء/طلبات خارجية في اختبارات N',cn.errs.filter(e=>!/injected|Failed to load resource|404/.test(e)).length===0&&cn.ext.length===0,{errs:cn.errs.slice(0,4),ext:cn.ext.length});
await cn.ctx.close();S.swOverride=null}
const f=R.filter(x=>x.ok===false).length;console.log('SUMMARY total',R.length,'pass',R.filter(x=>x.ok).length,'fail',f);
fs.writeFileSync(path.join(ROOT,'tests','last-run.json'),JSON.stringify(R));await b.close();srv.close()})().catch(e=>{console.log('FATAL',e);process.exit(1)});
