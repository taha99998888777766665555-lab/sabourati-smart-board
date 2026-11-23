
/* =====================================================================
   الوحدة ٥: الحفظ والاستعادة، التصدير (PNG/ZIP/PDF)، استيراد PDF، الحفظ التلقائي، قائمة «ملف»
   ===================================================================== */
HOOKS.dirty=()=>{S.rev=(S.rev||0)+1};
const safeName=s=>String(s||'مستند').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'_').trim().slice(0,80)||'مستند';
function download(name,blob){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.style.display='none';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000);S.m.downloads=(S.m.downloads||0)+1;S.lastDownload={name,size:blob.size,type:blob.type};
}
const ymd=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

/* ---------- حفظ وفتح ---------- */
function docJson(){return exportDoc()}
function saveDocFile(){
  const blob=new Blob([docJson()],{type:'application/json'});download(safeName(S.doc.title)+'.sabourati.json',blob);
  toast('حُفظ المستند في ملف. يمكنك فتحه لاحقًا من «ملف ← فتح مستند».');
}
async function openDocText(text,name){
  const r=importDoc(text);
  if(!r.ok){toast('تعذّر فتح الملف: '+r.errors.slice(0,2).join('، '));return false}
  if(docHasInk()&&!(await confirmBox('فتح مستند','المستند الحالي عليه عناصر وسيُستبدل بالمستند المفتوح. هل تريد المتابعة؟','فتح واستبدال')))return false;
  loadDoc(r.doc);toast('فُتح المستند «'+(r.doc.title||name||'')+'» ('+ar(r.doc.pages.length)+' صفحة)');return true;
}
$('fileOpen').onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{await openDocText(await f.text(),f.name)}catch(err){toast('تعذّرت قراءة الملف')}};

/* ---------- تجهيز الصور قبل التصدير ---------- */
async function ensureImages(pages){
  const ps=[];for(const p of pages)for(const e of p.elements)if(e.type==='image'){const r=getImg(e.asset);if(r&&!r.ready&&!r.failed)ps.push(new Promise(res=>{const t=setTimeout(res,8000);const o=r.img.onload;r.img.onload=()=>{o&&o();clearTimeout(t);res()};if(r.img.complete&&r.img.naturalWidth){r.ready=true;clearTimeout(t);res()}}))}
  await Promise.all(ps);
}
const expW=p=>Math.min(2400,Math.round(p.w*(p.w<1500?2:1.25)));
async function pageToCanvas(p){await ensureImages([p]);return renderPageToCanvas(p,expW(p))}
const canvasBlob=(c,type,q)=>new Promise(res=>c.toBlob(res,type,q));

/* ---------- ZIP (بلا ضغط) ---------- */
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function zipStore(files){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  const dt=new Date(),dosT=(dt.getHours()<<11)|(dt.getMinutes()<<5)|(dt.getSeconds()>>1),dosD=((dt.getFullYear()-1980)<<9)|((dt.getMonth()+1)<<5)|dt.getDate();
  for(const f of files){
    const nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
    const lh=new Uint8Array([0x50,0x4b,3,4,20,0,0,8,0,0,...u16(dosT),...u16(dosD),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),0,0]);
    parts.push(lh,nm,f.data);
    cd.push(new Uint8Array([0x50,0x4b,1,2,20,0,20,0,0,8,0,0,...u16(dosT),...u16(dosD),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(off)]),nm);
    off+=lh.length+nm.length+sz;
  }
  let cs=0;for(const c of cd)cs+=c.length;
  const end=new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cs),...u32(off),0,0]);
  return new Blob([...parts,...cd,end],{type:'application/zip'});
}

/* ---------- PDF (يُكتب مباشرة: صفحة = صورة JPEG) ---------- */
async function buildPDF(pages,onProg){
  const enc=new TextEncoder(),chunks=[],offs=[];let pos=0;
  const push=u=>{chunks.push(u);pos+=u.length},pushS=s=>push(enc.encode(s));
  push(new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10]));
  const N=2+pages.length*3;
  const obj=(n,fn)=>{offs[n]=pos;pushS(n+' 0 obj\n');fn();pushS('\nendobj\n')};
  obj(1,()=>pushS('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2,()=>pushS('<< /Type /Pages /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] /Count '+pages.length+' >>'));
  for(let i=0;i<pages.length;i++){
    if(onProg)onProg(i);
    const p=pages[i],cv=await pageToCanvas(p),blob=await canvasBlob(cv,'image/jpeg',0.92),jpg=new Uint8Array(await blob.arrayBuffer());
    const s=842/Math.max(p.w,p.h),w=+(p.w*s).toFixed(2),h=+(p.h*s).toFixed(2),n=3+i*3,cnt='q '+w+' 0 0 '+h+' 0 0 cm /Im0 Do Q';
    obj(n,()=>pushS('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im0 '+(n+2)+' 0 R >> >> /Contents '+(n+1)+' 0 R >>'));
    obj(n+1,()=>pushS('<< /Length '+cnt.length+' >>\nstream\n'+cnt+'\nendstream'));
    obj(n+2,()=>{pushS('<< /Type /XObject /Subtype /Image /Width '+cv.width+' /Height '+cv.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');push(jpg);pushS('\nendstream')});
  }
  const xr=pos;let x='xref\n0 '+(N+1)+'\n0000000000 65535 f \n';
  for(let n=1;n<=N;n++)x+=String(offs[n]).padStart(10,'0')+' 00000 n \n';
  pushS(x+'trailer\n<< /Size '+(N+1)+' /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
}
const bar=$('pgbar');
async function withBusy(msg,fn){bar.classList.add('busy');if(msg)toast(msg,null,60000);try{return await fn()}finally{bar.classList.remove('busy')}}
async function exportPNGPage(){return withBusy('جارٍ تجهيز الصورة…',async()=>{const p=pg(),c=await pageToCanvas(p),b=await canvasBlob(c,'image/png');download(safeName(S.doc.title)+'-صفحة'+(S.doc.activePage+1)+'.png',b);toast('صُدّرت الصفحة كصورة PNG')})}
async function exportPNGAll(){return withBusy('جارٍ تجهيز الصور…',async()=>{
  const files=[];for(let i=0;i<S.doc.pages.length;i++){const c=await pageToCanvas(S.doc.pages[i]),b=await canvasBlob(c,'image/png');files.push({name:safeName(S.doc.title)+'-صفحة'+String(i+1).padStart(2,'0')+'.png',data:new Uint8Array(await b.arrayBuffer())})}
  download(safeName(S.doc.title)+'-صور.zip',zipStore(files));toast('صُدّرت '+ar(files.length)+' صفحة داخل ملف ZIP')})}
async function exportPDF(current){return withBusy('جارٍ تجهيز PDF…',async()=>{
  const pages=current?[pg()]:S.doc.pages,b=await buildPDF(pages,i=>{toastEl.firstChild&&(toastEl.firstChild.textContent='جارٍ تجهيز PDF: صفحة '+ar(i+1)+' من '+ar(pages.length))});
  download(safeName(S.doc.title)+'.pdf',b);toast('صُدّر ملف PDF ('+ar(pages.length)+' صفحة). كل صفحة تُحفظ كصورة، فالنص داخلها غير قابل للتحديد.')})}

/* ---------- استيراد PDF ---------- */
let pdfLibP=null;
function loadPdfLib(){
  if(pdfLibP)return pdfLibP;
  pdfLibP=new Promise((res,rej)=>{
    try{
      const s=document.createElement('script');s.textContent=$('pdfjsSrc').textContent;document.head.appendChild(s);
      const lib=window.pdfjsLib||window['pdfjs-dist/build/pdf'];if(!lib)throw new Error('مكتبة PDF غير متاحة');
      lib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([$('pdfjsWorker').textContent],{type:'text/javascript'}));res(lib);
    }catch(e){pdfLibP=null;rej(e)}
  });
  return pdfLibP;
}
async function importPdfFile(file){
  if(!file)return;
  await withBusy('جارٍ فتح ملف PDF…',async()=>{
    try{
      const lib=await loadPdfLib(),buf=await file.arrayBuffer(),doc=await lib.getDocument({data:buf}).promise;
      const n=doc.numPages,cap=80;
      if(n>cap&&!(await confirmBox('ملف PDF كبير','يحتوي الملف على '+ar(n)+' صفحة. سيُدرَج أول '+ar(cap)+' صفحة فقط. هل تريد المتابعة؟','إدراج')))return;
      const m=Math.min(n,cap),newPages=[],A=S.doc.assets;
      for(let i=1;i<=m;i++){
        toastEl.firstChild&&(toastEl.firstChild.textContent='جارٍ تحويل الصفحة '+ar(i)+' من '+ar(m));toastEl.hidden=false;
        const page=await doc.getPage(i),v1=page.getViewport({scale:1}),lh=1080,lw=clamp(Math.round(lh*v1.width/v1.height),LIM.pageMin,LIM.pageMax);
        const sc=Math.min(1800/v1.height,2400/v1.width),vp=page.getViewport({scale:sc}),cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);
        const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
        await page.render({canvasContext:cx,viewport:vp}).promise;
        const data=cv.toDataURL('image/jpeg',0.85),aid=putAsset({mime:'image/jpeg',data,w:cv.width,h:cv.height});
        const np=newPage(lw,lh,'#ffffff'),el={id:uid('e'),type:'image',asset:aid,w:lw,h:lh,tf:IDENT.slice(),locked:true};el.bbox=imgBox(el);np.elements.push(el);newPages.push(np);
        page.cleanup&&page.cleanup();
      }
      const at=S.doc.activePage+1,ops=[];
      newPages.forEach((p,k)=>ops.push({op:'pageAdd',pageId:p.id,index:at+k,page:p}));
      const cur=pg();if(S.doc.pages.length===1&&!cur.elements.length)ops.push({op:'pageDel',pageId:cur.id,index:0,page:cur});
      /* الحذف أولًا إن وُجد صفحة فارغة وحيدة (تعذّر ترك المستند بلا صفحات): نرتّب الإضافات قبل الحذف */
      if(!commitPageOps('إدراج PDF',ops,newPages[0].id))throw new Error('تعذّر إدراج الصفحات');
      toast('أُدرجت '+ar(m)+' صفحة من PDF. اكتب فوقها بالقلم.');
    }catch(e){toast('تعذّر فتح PDF: '+(e&&e.message||'ملف غير صالح'))}
  });
}
$('filePdf').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)importPdfFile(f)};

/* ---------- الحفظ التلقائي (IndexedDB) ---------- */
const AUTO={sig:'',busy:false,saved:0,error:null};
function idb(){return new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('IndexedDB غير متاح'));const r=indexedDB.open('sabourati-pro',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbSet(k,v){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>{d.close();res()};t.onerror=()=>{d.close();rej(t.error)}})}
async function idbGet(k){const d=await idb();return new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>{d.close();res(q.result)};q.onerror=()=>{d.close();rej(q.error)}})}
const docSig=()=>S.doc.id+'|'+(S.rev||0)+'|'+S.doc.pages.length+'|'+S.doc.title+'|'+S.doc.pages.map(p=>p.background.type+p.background.surface).join(',');
function updAutosaveInd(state){
  const e=document.getElementById('autosaveInd');if(!e)return;
  e.hidden=false;
  if(state==='saving'){e.classList.remove('err');e.textContent='جارٍ الحفظ التلقائي محليًا…'}
  else if(state==='saved'){e.classList.remove('err');const t=new Date();e.textContent='حُفظ تلقائيًا في المتصفح '+ar(t.getHours())+':'+ar(String(t.getMinutes()).padStart(2,'0'))}
  else if(state==='error'){e.classList.add('err');e.textContent='تعذّر الحفظ التلقائي المحلي'}
}
async function autosaveNow(){
  if(window.__SB_NOAUTO||AUTO.busy||S.active)return false;
  const empty=!S.doc.pages.some(p=>p.elements.length>0);
  const sig=docSig();if(sig===AUTO.sig)return false;
  if(empty&&!(S.rev>0)){AUTO.sig=sig;return false}   /* لا نستبدل نسخة محفوظة بمستند فارغ لم يُمسّ */
  AUTO.busy=true;updAutosaveInd('saving');
  try{await idbSet('autosave',{t:Date.now(),json:docJson()});AUTO.sig=sig;AUTO.saved++;AUTO.error=null;updAutosaveInd('saved');return true}
  catch(e){AUTO.error=String(e&&e.message||e);updAutosaveInd('error');return false}
  finally{AUTO.busy=false}
}
setInterval(()=>{autosaveNow()},2500);
async function offerRestore(){
  if(window.__SB_NOAUTO)return;
  try{
    const r=await idbGet('autosave');if(!r||!r.json)return;
    const chk=importDoc(r.json);if(!chk.ok||!chk.doc.pages.some(p=>p.elements.length))return;
    if(S.rev>0||docHasInk())return;
    const when=new Date(r.t).toLocaleString('ar-EG');
    toast('يوجد مستند محفوظ تلقائيًا ('+when+').',{label:'استعادته',fn:()=>{loadDoc(chk.doc);AUTO.sig=docSig();toast('استُعيد المستند المحفوظ تلقائيًا')}},20000);
  }catch(e){}
}
setTimeout(offerRestore,600);
window.addEventListener('pagehide',()=>{autosaveNow()});

/* ---------- قائمة «ملف» ---------- */
function openFileMenu(){
  const inp=document.createElement('input');inp.type='text';inp.value=S.doc.title;inp.maxLength=80;inp.setAttribute('aria-label','اسم المستند');inp.oninput=()=>{S.doc.title=inp.value.slice(0,LIM.title);HOOKS.dirty()};
  inp.addEventListener('keydown',e=>e.stopPropagation());
  openMenu($('fileBtn'),[
    {head:'اسم المستند'},{node:inp},{sep:1},
    {label:'مستند جديد…',fn:()=>openNewDlg()},
    {label:'فتح مستند محفوظ (ملف)…',fn:()=>{$('fileOpen').value='';$('fileOpen').click()}},
    {label:'حفظ المستند في ملف',fn:saveDocFile},{sep:1},
    {label:'إدراج صورة…',fn:()=>{$('fileImg').value='';$('fileImg').click()}},
    {label:'إدراج ملف PDF…',fn:()=>{$('filePdf').value='';$('filePdf').click()}},{sep:1},
    {label:'تصدير الصفحة صورة (PNG)',fn:exportPNGPage},
    {label:'تصدير كل الصفحات صورًا (ZIP)',fn:exportPNGAll},
    {label:'تصدير الصفحة الحالية PDF',fn:()=>exportPDF(true)},
    {label:'تصدير كل الصفحات PDF',fn:()=>exportPDF(false)},{sep:1},
    {head:'نوع الإدخال'},
    {label:'قلم وإصبع',pressed:S.mode==='both',fn:()=>setMode('both')},
    {label:'القلم فقط (اللمس للتكبير والتحريك)',pressed:S.mode==='pen',fn:()=>setMode('pen')},
  ]);
}
$('fileBtn').setAttribute('aria-haspopup','true');$('fileBtn').onclick=()=>{if(menuEl)closeMenu();else openFileMenu()};
$('backBoard').onclick=()=>show('board');
