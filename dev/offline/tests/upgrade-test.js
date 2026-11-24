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
/* ===== اختبار الترقية من المنشور (12b8…) إلى الجديد ===== */
const OLDBUF=fs.readFileSync('/tmp/sb2/offline/site/board.html');
const NEWMD5=md5(boardBuf),OLDMD5=md5(OLDBUF);
const uiOf=p=>p.evaluate(()=>({tag:!!document.querySelector('.tag'),about:!!document.getElementById('aboutBtn'),credit:!!document.getElementById('credit'),title:document.querySelector('.bar h1').textContent.trim()}));
(async()=>{const b=await chromium.launch();
rec('U0 بصمات الخادم: القديم=المنشور 12b8… والجديد=المختبَر',OLDMD5==='12b8030494f8fe01acbd8d17376ba0c8'&&NEWMD5===process.env.EXPECT_MD5,{OLDMD5,NEWMD5});
/* U1: مستخدم حالي على النسخة المنشورة */
S.boardOverride=OLDBUF;let c=await newCtx(b);let p=await c.ctx.newPage();
await p.goto(B);await p.waitForURL(/board\.html/,{timeout:15000}).catch(()=>{});await sleep(2000);
await wait(()=>p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/sabourati-smart-board/');return r&&r.active}),15000);await p.reload();await sleep(1500);
const ui1=await uiOf(p).catch(()=>null);
rec('U1a المستخدم على النسخة القديمة (فيها الوسم، دون زر عن)',!!ui1&&ui1.tag&&!ui1.about,ui1);
const d0=await draw(p);await sleep(3500);const pro0=await proHash(p);let info=await shellInfo(p);
rec('U1b رسم/بطاقة محفوظان في sabourati-pro والمخزَّن = بايتات القديمة',!!pro0&&pro0.len>200&&info.files['board.html'].sha===sha(OLDBUF),{d0,pro:pro0&&pro0.len});
await p.close();
/* U2: نُشر الجديد؛ المستخدم يفتح الرابط بالاتصال العادي دون مسح بيانات */
S.boardOverride=null;S.hits.length=0;
p=await c.ctx.newPage();await p.goto(B);await p.waitForURL(/board\.html/,{timeout:15000}).catch(()=>{});await sleep(2500);
let ui2=await uiOf(p).catch(()=>null);
rec('U2a أول فتح بعد النشر يُظهر النسخة الجديدة مباشرة (دون مسح بيانات ودون إعادة تحميل يدوي)',!!ui2&&!ui2.tag&&ui2.about&&ui2.credit,ui2);
info=await shellInfo(p);rec('U2b المخزَّن للعمل دون إنترنت تحدّث إلى بايتات الجديد (زوج متّسق)',info.files['board.html'].sha===sha(boardBuf)&&info.files['index.html']&&JSON.stringify(info.files['board.html'].fields).includes('pairId'),{n:Object.keys(info.files)});
const rs=await restore(p);const st=await state(p).catch(()=>null);const pro1=await proHash(p);
rec('U2c بيانات المستخدم السابقة سليمة بعد الترقية وتُستعاد (رسوم+بطاقات)',rs&&!!st&&st.strokes>=d0.strokes&&st.cards>=d0.cards&&!!pro1&&pro1.len>=pro0.len,{restoreOffered:rs,before:d0,after:st,len:[pro0.len,pro1&&pro1.len]});
/* U3: دون إنترنت: نافذة عن + رسم + تراجع + حفظ + استعادة */
await offline(c.ctx,true);await p.reload({timeout:15000});await sleep(1500);
rec('U3a إعادة تحميل دون إنترنت بالنسخة الجديدة',await ready(p)&&(await uiOf(p)).about,'');
await p.click('#aboutBtn');await sleep(250);
const op=await p.evaluate(()=>{const d=document.getElementById('aboutDlg'),t=d.innerText;return{open:!d.hidden,name:t.includes('أ/ طه محمد'),title:t.includes('سبورتي الذكية'),noTag:!/نسخة تشغيلية/.test(t)}});
await p.keyboard.press('Escape');await sleep(200);const cl=await p.evaluate(()=>document.getElementById('aboutDlg').hidden);
await p.click('#aboutBtn');await sleep(150);await p.click('#aboutClose');await sleep(150);const cl2=await p.evaluate(()=>document.getElementById('aboutDlg').hidden);
rec('U3b نافذة «عن السبورة» تُفتح وتُغلق (Esc وزر الإغلاق) دون إنترنت',op.open&&op.name&&op.title&&op.noTag&&cl&&cl2,{op,cl,cl2});
await restore(p);const s0=await state(p);
await p.evaluate(()=>{__sb.synthEv('pointerdown',9,300,250);for(let i=1;i<=12;i++)__sb.synthEv('pointermove',9,300+i*25,250+(i%3)*8);__sb.synthEv('pointerup',9,610,260)});await sleep(300);
const s1=await state(p);await p.keyboard.press('Control+z');await sleep(300);const s2=await state(p);await p.keyboard.press('Control+y');await sleep(300);const s3=await state(p);
rec('U3c رسم ثم تراجع ثم إعادة دون إنترنت',s1.strokes===s0.strokes+1&&s2.strokes===s0.strokes&&s3.strokes===s0.strokes+1,{s0,s1,s2,s3});
await sleep(3500);const pro2=await proHash(p);await p.reload({timeout:15000});await sleep(1500);await restore(p);const s4=await state(p);
rec('U3d حفظ تلقائي دون إنترنت ثم إعادة تحميل واستعادة: يعود الرسم الجديد مع القديم',s4.strokes===s3.strokes&&s4.cards>=s3.cards&&!!pro2&&pro2.sha!==pro1.sha,{s3,s4});
const tools=await toolsWork(p).catch(e=>({err:String(e)}));rec('U3e الأدوات (خط الأعداد، العجلة) دون إنترنت بالنسخة الجديدة',tools.nline===true&&tools.wheel===true,tools);
await offline(c.ctx,false);
rec('U4 لا أخطاء جافاسكربت ولا طلبات خارجية طوال الترقية',c.errs.length===0&&c.ext.length===0,{errs:c.errs.slice(0,4),ext:c.ext.slice(0,4)});
/* U5: أداء: زمن التحميل وزمن الرسم القديم مقابل الجديد */
async function perf(over){S.boardOverride=over;const cc=await newCtx(b);const out={load:[],draw:[]};
 for(let i=0;i<5;i++){const pg=await cc.ctx.newPage();const t=Date.now();await pg.goto(B+'board.html');await wait(()=>ready(pg),15000,50);out.load.push(Date.now()-t);
  out.draw.push(await pg.evaluate(()=>{const t=performance.now();for(let k=0;k<4;k++){__sb.synthEv('pointerdown',9,300,300+k*40);for(let i=1;i<=250;i++)__sb.synthEv('pointermove',9,300+i*3,300+k*40+Math.sin(i/9)*20);__sb.synthEv('pointerup',9,1050,300+k*40)}return performance.now()-t}));await pg.close()}
 await cc.ctx.close();const med=a=>[...a].sort((x,y)=>x-y)[2];return{load:med(out.load),draw:Math.round(med(out.draw))}}
const po=await perf(OLDBUF),pn=await perf(null);
rec('U5 الأداء: زمن التحميل والرسم للجديد ≤ ١٫٢٥× القديم (وسيط ٥ تشغيلات)',pn.load<=po.load*1.25+80&&pn.draw<=po.draw*1.25+20,{old:po,new:pn});
const f=R.filter(x=>x.ok===false);console.log('\nUPGRADE TOTAL',R.length,'FAIL',f.length,f.map(x=>x.id).join(' | '));await b.close();srv.close();process.exit(f.length?1:0)})();
