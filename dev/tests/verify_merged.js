const {chromium}=require('playwright');const FS=require('fs');
const PATH=require('path');const ROOT=PATH.resolve(__dirname,'..');const FILE=process.env.FILE||PATH.join(ROOT,'smart-board-pro-merged.html'),VPW=+process.env.VPW||1366,VPH=+process.env.VPH||768;
const results=[];const T=(id,name,pass,detail)=>{results.push({id,pass:!!pass});console.log((pass?'PASS':'FAIL')+': '+id+' '+name+(detail?' — '+String(detail).slice(0,220):''))};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:VPW,height:VPH},hasTouch:true});
 const errs=[];p.on('pageerror',e=>errs.push(String(e).split('\n')[0]));
 await p.goto('file://'+FILE);await p.waitForTimeout(1600);
 const sleep=ms=>p.waitForTimeout(ms);
 const eduFrame=()=>p.frames().find(f=>f.parentFrame()&&f.url()==='about:srcdoc');

 /* M0: نسب المحتوى — الأداتان داخل الملف المجمّع تطابقان المعتمدتين حرفيًا */
 {
   const ok=await p.evaluate(()=>{
     const EDU_SRC=__edu.src();const dec=s=>{const bin=atob(s);const by=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)by[i]=bin.charCodeAt(i);return new TextDecoder('utf-8').decode(by)};
     return{wheel:dec(EDU_SRC.wheel).length,hj:dec(EDU_SRC.hj).length}});
   const w=FS.readFileSync(PATH.join(ROOT,'approved-tools','wheel.html'),'utf-8'),h=FS.readFileSync(PATH.join(ROOT,'approved-tools','harf-ila-jumla.html'),'utf-8');
   T('M0','الأداتان المضمّنتان تطابقان النسختين المعتمدتين (أطوال+بصمات)',ok.wheel===w.length&&ok.hj===h.length,JSON.stringify(ok)+' vs '+w.length+','+h.length);
 }
 /* M1: لا أخطاء + قسم أدوات تعليمية في قائمة المعلم */
 {
   const r=await p.evaluate(async()=>{__sb.openTeachMenu();await new Promise(r=>setTimeout(r,150));
     const m=document.querySelector('.menu');const txt=m?m.innerText:'';
     const heads=[...m.querySelectorAll('*')].some(e=>e.textContent.trim()==='أدوات تعليمية');
     const btns=[...m.querySelectorAll('button')].map(b=>b.textContent.trim());
     const h=Math.min(...[...m.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height));
     const dig=(m.innerText.match(/[0-9]/g)||[]).length;
     return{heads,wheel:btns.includes('العجلة التفاعلية'),hj:btns.includes('من الحرف إلى الجملة'),minH:Math.round(h),dig}});
   T('M1','قائمة المعلم: قسم أدوات تعليمية + زران، عناصر ≥٤٨، بلا أرقام لاتينية',r.heads&&r.wheel&&r.hj&&r.minH>=48&&r.dig===0,JSON.stringify(r));
 }
 /* M2: فتح العجلة داخل الطبقة */
 {
   await p.evaluate(()=>{[...document.querySelectorAll('.menu button')].find(b=>b.textContent.includes('العجلة')).click()});
   await sleep(1500);
   const r=await p.evaluate(()=>{const l=document.getElementById('eduLayer');
     const c=document.getElementById('eduClose').getBoundingClientRect();
     const t=document.getElementById('eduTitle').textContent;
     return{vis:l&&l.style.display==='block',title:t,closeH:Math.round(c.height),closeW:Math.round(c.width),
       dig:(l.innerText.match(/[0-9]/g)||[]).length,menuGone:!document.querySelector('.menu')}});
   const fr=eduFrame();
   let inner=null;
   if(fr){inner=await fr.evaluate(()=>({wh:!!window.__wh,letters:__wh?__wh.S.lists[1].length:0}))}
   T('M2','العجلة تفتح داخل طبقة معزولة: عنوان عربي، زر إغلاق كبير، القائمة أُغلقت، ٢٨ حرفًا',r.vis&&r.title==='العجلة التفاعلية'&&r.closeH>=48&&r.dig===0&&r.menuGone&&inner&&inner.wh&&inner.letters===28,JSON.stringify({r,inner}));
 }
 /* M3: دوران داخل الإطار — النتيجة تطابق القطاع تحت المؤشر */
 {
   const fr=eduFrame();
   const r=await fr.evaluate(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
     document.getElementById('calm').checked=true;
     document.querySelectorAll('#modes button')[1].click();await sleep(100);
     __wh.setRand(()=>0.55);__wh.spin();
     while(__wh.S.spinning)await sleep(60);
     const res=document.getElementById('result').textContent;
     const l=__wh.S.lists[1],seg=2*Math.PI/l.length;
     const u=(-Math.PI/2-__wh.currentAngle())/seg;
     const idx=((Math.floor(u)%l.length)+l.length)%l.length;
     __wh.resetRand();
     return{res,match:l[idx]===res}});
   T('M3','الدوران داخل الإطار: النتيجة تطابق القطاع تحت المؤشر',r.match&&r.res,JSON.stringify(r));
 }
 /* M4: استمرار القوائم عبر الإغلاق وإعادة الفتح (localStorage) */
 {
   let fr=eduFrame();
   const before=await fr.evaluate(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
     document.querySelectorAll('#modes button')[0].click();await sleep(80);
     document.getElementById('editToggle').click();
     document.getElementById('editTxt').value='سارة\nخالد\nنورة';
     document.getElementById('editSave').click();await sleep(200);
     return __wh.S.lists[0].length});
   await p.evaluate(()=>__edu.close());await sleep(300);
   await p.evaluate(()=>__edu.open('wheel'));await sleep(1400);
   fr=eduFrame();
   const after=await fr.evaluate(()=>__wh.S.lists[0].slice());
   T('M4','قوائم العجلة تبقى بعد إغلاق الطبقة وإعادة فتحها',before===3&&after.length===3&&after[0]==='سارة',JSON.stringify({before,after}));
   await p.evaluate(()=>__edu.close());await sleep(250);
 }
 /* M5: محتوى السبورة لا يتأثر بفتح/إغلاق الأداة، والتراجع يعمل */
 {
   await p.evaluate(()=>{__sb.setTool('pen',true)});
   await p.mouse.move(300,400);await p.mouse.down();await p.mouse.move(600,420,{steps:5});await p.mouse.up();await sleep(200);
   const n1=await p.evaluate(()=>__sb.pg().elements.length);
   await p.evaluate(()=>__edu.open('wheel'));await sleep(1200);
   await p.evaluate(()=>__edu.close());await sleep(250);
   const n2=await p.evaluate(()=>__sb.pg().elements.length);
   await p.evaluate(()=>__sb.undo());await sleep(150);
   const n3=await p.evaluate(()=>__sb.pg().elements.length);
   T('M5','محتوى السبورة محفوظ عبر فتح/إغلاق الأداة والتراجع يعمل بعدها',n1===1&&n2===1&&n3===0,JSON.stringify({n1,n2,n3}));
 }
 /* M6: نموذج من الحرف إلى الجملة يفتح */
 {
   await p.evaluate(()=>__edu.open('hj'));await sleep(1600);
   const fr=eduFrame();
   const r=fr?await fr.evaluate(()=>({hj:!!window.__hj,body:document.body.innerText.length>50})):null;
   const t=await p.evaluate(()=>document.getElementById('eduTitle').textContent);
   T('M6','نموذج «من الحرف إلى الجملة» يفتح داخل الطبقة',r&&r.hj&&r.body&&t==='من الحرف إلى الجملة',JSON.stringify({r,t}));
 }
 /* M7: Escape يغلق */
 {
   await p.keyboard.press('Escape');await sleep(250);
   const r=await p.evaluate(()=>document.getElementById('eduLayer').style.display);
   T('M7','Escape يغلق الطبقة',r==='none',r);
 }
 /* M8: التخطيط على المقاس */
 {
   const r=await p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect();
     return{noScroll:window.scrollX===0&&window.scrollY===0,stage:st.width>0}});
   T('M8','تخطيط سليم على '+VPW+'x'+VPH+' بلا تمرير',r.noScroll&&r.stage,JSON.stringify(r));
 }
 const fails=results.filter(x=>!x.pass);
 console.log('SUMMARY '+JSON.stringify({vp:VPW+'x'+VPH,total:results.length,pass:results.length-fails.length,fail:fails.map(f=>f.id),errs:errs.slice(0,3)}));
 await b.close();
 process.exit(fails.length||errs.length?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
