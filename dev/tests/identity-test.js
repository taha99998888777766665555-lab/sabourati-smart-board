/* اختبار الهوية الجديدة (محلي): الشريط + نافذة «عن السبورة» + سلامة الأدوات. FILE_NEW و FILE_OLD ملفان محليان */
const {chromium}=require('playwright');const URL_=require('url');
const NEW=URL_.pathToFileURL(process.env.FILE_NEW).href,OLD=URL_.pathToFileURL(process.env.FILE_OLD).href;
const R=[];const rec=(id,ok,d)=>{R.push({id,ok});console.log(ok?'PASS':'FAIL',id,'|',typeof d==='string'?d:JSON.stringify(d))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();
async function open(url,w,h){const p=await b.newPage({viewport:{width:w,height:h}});p.__errs=[];p.__ext=[];
 p.on('pageerror',e=>p.__errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.__errs.push(m.text())});
 p.on('request',r=>{const u=r.url();if(!u.startsWith('file:')&&!u.startsWith('data:')&&!u.startsWith('blob:'))p.__ext.push(u)});
 await p.goto(url);await sleep(900);return p}
const barInfo=p=>p.evaluate(()=>{const bar=document.getElementById('bar'),br=bar.getBoundingClientRect(),c=document.getElementById('credit');
 const R=e=>{const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom}};
 const vis=[...bar.querySelectorAll('.brand,#pageInfo,#credit,#autosaveInd,.sp')].filter(e=>e.getClientRects().length&&!e.hidden&&getComputedStyle(e).display!=='none');
 const rs=vis.map(e=>({id:e.id||e.className,...R(e)})).sort((a,b)=>a.l-b.l);let ov=[];for(let i=1;i<rs.length;i++)if(rs[i].l<rs[i-1].r-0.5)ov.push([rs[i-1].id,rs[i].id]);
 const out=[...bar.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.hidden).filter(e=>{const r=e.getBoundingClientRect();return r.left<br.left-0.5||r.right>br.right+0.5||r.bottom>br.bottom+0.5||r.top<br.top-0.5}).map(e=>e.id||e.tagName);
 return{creditHidden:c.hidden,ov,out,sw:bar.scrollWidth,cw:bar.clientWidth,h:br.height,tagGone:!document.querySelector('.tag')&&!/نسخة تشغيلية/.test(document.body.innerText),
  brandShown:getComputedStyle(document.querySelector('.brandtxt')).display!=='none',svgShown:!!document.querySelector('.brand svg').getClientRects().length,
  hz:getComputedStyle(c).writingMode,btnsOK:[...bar.querySelectorAll('button')].every(e=>{const r=e.getBoundingClientRect();return r.width>=47.5&&r.height>=47.5})}});
// 1) أحجام مختلفة
for(const [w,h] of [[1920,1080],[1366,768],[1280,720],[1100,700],[1024,768],[900,700],[860,700],[800,700],[600,800],[480,800]]){
 const p=await open(NEW,w,h);const i=await barInfo(p);
 const need=await p.evaluate(()=>{const c=document.getElementById('credit');const wasH=c.hidden;c.hidden=false;const n=c.offsetWidth;c.hidden=wasH;return n});
 const ok=i.ov.length===0&&i.out.length===0&&i.sw<=i.cw&&i.h===52&&i.tagGone&&i.svgShown&&i.btnsOK&&i.hz==='horizontal-tb'&&p.__errs.length===0&&p.__ext.length===0&&(w<=960?!i.brandShown:i.brandShown);
 rec('S-bar-'+w,ok,{...i,need,errs:p.__errs,ext:p.__ext});
 if(w===1366||w===1920)rec('S-credit-shown-'+w,!i.creditHidden,'الاسم ظاهر عند اتساع الشاشة');
 if(w<=900)rec('S-credit-hidden-or-fits-'+w,i.creditHidden||(i.ov.length===0&&i.out.length===0),'الاسم إما مخفي أو يتسع دون تداخل');if(w<=800)rec('S-credit-hidden-'+w,i.creditHidden,'الاسم مخفي عند ضيق المساحة');
 await p.close()}
// 1b) مؤشر الحفظ التلقائي ظاهر: لا تجاوز في الشريط من ٦٤٠ بكسل فصاعدًا، وعلى الأقل مثل النسخة المعتمدة دونه
for(const w of [1920,1366,1100,1024,960,900,860,800,780,720,700,660,640,600,480]){
 const meas=async url=>{const p=await open(url,w,768);await p.mouse.move(300,300);await p.mouse.down();for(let k=0;k<20;k++)await p.mouse.move(300+k*20,300+(k%3)*9);await p.mouse.up();await sleep(2400);
  const r=await p.evaluate(()=>{const bar=document.getElementById('bar');return{ind:!document.getElementById('autosaveInd').hidden,over:bar.scrollWidth-bar.clientWidth}});await p.close();return r};
 const n=await meas(NEW),o=await meas(OLD);rec('S-autosave-visible-'+w,n.ind&&(w>=640?n.over===0:n.over<=o.over),{new:n,old:o})}
// 2) نافذة عن السبورة + التفاعل
{const p=await open(NEW,1366,768);
 const els=()=>p.evaluate(()=>__sb.pg().elements.length),hist=()=>p.evaluate(()=>({u:__sb.HIST.undo.length,r:__sb.HIST.redo.length}));
 const draw=async(y)=>{await p.mouse.move(400,y);await p.mouse.down();for(let k=1;k<=10;k++)await p.mouse.move(400+k*30,y+(k%2)*10);await p.mouse.up();await sleep(150)};
 await draw(300);const e1=await els(),h1=await hist();
 await p.click('#aboutBtn');await sleep(200);
 const op=await p.evaluate(()=>{const d=document.getElementById('aboutDlg'),t=d.innerText;return{open:!d.hidden,hasName:t.includes('أ/ طه محمد'),hasTitle:t.includes('سبورتي الذكية'),hasSub:t.includes('بيئة تعليمية تفاعلية'),hasDesc:t.includes('مساحة للكتابة والرسم'),noTag:!/نسخة تشغيلية|للتجربة/.test(t),focus:document.activeElement.id,aria:d.getAttribute('aria-modal'),lbl:d.getAttribute('aria-labelledby')}});
 rec('A-open-content',op.open&&op.hasName&&op.hasTitle&&op.hasSub&&op.hasDesc&&op.noTag&&op.focus==='aboutClose'&&op.aria==='true',op);
 await p.keyboard.press('Control+z');await p.keyboard.press('p');await p.keyboard.press('e');await p.keyboard.press('Control+y');await sleep(150);
 const e2=await els(),h2=await hist();
 rec('A-modal-blocks-undo-and-shortcuts',e2===e1&&h2.u===h1.u&&h2.r===h1.r&&await p.evaluate(()=>!document.getElementById('aboutDlg').hidden),{e1,e2,h1,h2});
 await p.keyboard.press('Escape');await sleep(150);
 const cl=await p.evaluate(()=>({hidden:document.getElementById('aboutDlg').hidden,focus:document.activeElement.id}));
 rec('A-esc-closes-focus-returns',cl.hidden&&cl.focus==='aboutBtn',cl);
 await p.click('#aboutBtn');await sleep(100);await p.click('#aboutClose');await sleep(100);
 rec('A-close-button',await p.evaluate(()=>document.getElementById('aboutDlg').hidden),'');
 await p.click('#aboutBtn');await sleep(100);const eb=await els();await draw(420);await sleep(150);
 rec('A-backdrop-closes-and-draws-nothing',await p.evaluate(()=>document.getElementById('aboutDlg').hidden)&&(await els())===eb,{eb});
 const e3=await els();await draw(520);const e4=await els();
 rec('A-draw-works-after-close',e4===e3+1,{e3,e4});
 await p.keyboard.press('Control+z');await sleep(150);rec('A-undo-works-after-close',(await els())===e3,'');
 // وضع العرض: الشريط كله مخفي
 await p.evaluate(()=>__sb.setPresent(true));await sleep(200);
 rec('A-present-hides-bar-and-credit',await p.evaluate(()=>getComputedStyle(document.getElementById('bar')).display==='none'),'');
 await p.evaluate(()=>__sb.setPresent(false));await sleep(200);
 // مستند جديد ما زال يعمل
 await p.click('#newBtn');await sleep(150);const nd=await p.evaluate(()=>!document.getElementById('newDlg').hidden);await p.keyboard.press('Escape');await sleep(100);
 rec('A-newdoc-dialog-still-works',nd&&await p.evaluate(()=>document.getElementById('newDlg').hidden),'');
 rec('A-no-errors-no-external',p.__errs.length===0&&p.__ext.length===0,{errs:p.__errs,ext:p.__ext});
 await p.close()}
// 3) مطابقة الخطوط والألوان + مقارنة الأدوات بالنسخة المعتمدة
{const pn=await open(NEW,1366,768),po=await open(OLD,1366,768);
 const sty=await pn.evaluate(()=>{const g=(e,k)=>getComputedStyle(e)[k];const h=document.querySelector('.bar h1'),s=document.querySelector('.brandtxt small'),c=document.getElementById('credit'),cb=c.querySelector('b'),ab=document.getElementById('aboutBtn'),br=document.getElementById('bar');
  return{h1:[g(h,'fontSize'),g(h,'color'),g(h,'fontWeight'),g(h,'fontFamily').split(',')[0]],sub:[g(s,'fontSize'),g(s,'color')],credit:[g(c,'fontSize'),g(c,'color'),g(c,'height'),g(c,'paddingLeft')],name:[g(cb,'color'),g(cb,'fontWeight')],about:[g(ab,'borderTopColor'),g(ab,'backgroundColor'),g(ab,'color'),ab.getBoundingClientRect().width],bar:[g(br,'backgroundColor'),g(br,'borderBottomColor'),br.getBoundingClientRect().height],svg:[document.querySelector('.brand svg').getBoundingClientRect().width]}});
 const want={h1:['21px','rgb(29, 39, 51)','600','PlexAr'],sub:['11.5px','rgb(77, 90, 102)'],credit:['13px','rgb(74, 85, 97)','28px','16px'],name:['rgb(15, 107, 92)','600'],about:['rgb(15, 107, 92)','rgb(234, 243, 241)','rgb(15, 107, 92)'],bar:['rgb(255, 255, 255)','rgb(207, 214, 221)',52]};
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const ok=eq(sty.h1,want.h1)&&eq(sty.sub,want.sub)&&eq(sty.credit,want.credit)&&eq(sty.name,want.name)&&eq(sty.about.slice(0,3),want.about)&&eq(sty.bar,want.bar)&&sty.svg[0]===36&&sty.about[3]>=48;
 rec('M-match-preview-tokens',ok,sty);
 const snap=p=>p.evaluate(()=>{const r=e=>{const x=e.getBoundingClientRect();return[Math.round(x.left),Math.round(x.top),Math.round(x.width),Math.round(x.height)]};
  const ids=[...document.querySelectorAll('#tbar button,#tbar [id],#pgbar button,#stage,#boardView')].map(e=>(e.id||e.className||e.tagName)+':'+r(e).join(','));return ids});
 const a=await snap(pn),o=await snap(po);rec('M-tools-geometry-identical',eq(a,o),{n:a.length,diff:a.filter((x,i)=>x!==o[i]).slice(0,5)});
 const tl=p=>p.evaluate(()=>Object.keys(__sb.TOOLS||{}).join(','));rec('M-tool-list-identical',eq(await tl(pn),await tl(po)),await tl(pn));
 await pn.close();await po.close()}
const f=R.filter(x=>!x.ok);console.log('\nTOTAL',R.length,'PASS',R.length-f.length,'FAIL',f.length,f.map(x=>x.id).join(','));
await b.close();process.exit(f.length?1:0)})();
