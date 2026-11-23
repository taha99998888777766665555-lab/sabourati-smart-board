const Z=require('./zlib.js');const {sleep,FS}=Z;
const ONLY=process.env.ONLY?process.env.ONLY.split(','):null;
const R={};const TESTS=[];
const T=(id,name,scope,fn)=>TESTS.push({id,name,scope,fn});
const near=(a,b,t)=>Math.abs(a-b)<=t;
const png1=async p=>p.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=80;const x=c.getContext('2d');x.fillStyle='#d32f2f';x.fillRect(0,0,120,80);x.fillStyle='#1976d2';x.fillRect(30,20,60,40);return c.toDataURL('image/png')});
const dl=async(p,fn)=>{const [d]=await Promise.all([p.waitForEvent('download',{timeout:60000}),p.evaluate(fn)]);const path=require('path').join(require('os').tmpdir(),'sb_dl_'+Date.now()+'_'+d.suggestedFilename().replace(/[^\w.؀-ۿ-]/g,'_'));await d.saveAs(path);return{path,name:d.suggestedFilename(),buf:FS.readFileSync(path)}};

T('Z01','قلم: رسم، تراجع/إعادة، بكسل','A',async p=>{
 await Z.drag(p,[[300,300],[500,330],[700,300]]);const a=await Z.els(p);const c1=await Z.px(p,500,330);
 await p.evaluate(()=>__sb.undo());const b=await Z.els(p);const c2=await Z.px(p,500,330);await p.evaluate(()=>__sb.redo());const d=await Z.els(p);
 return[a.length===1&&c1[0]<80&&b.length===0&&c2[0]>240&&d.length===1,JSON.stringify({a:a.length,c1,b:b.length,c2,d:d.length})]});
T('Z02','قلم التمييز: شفافية ثابتة، لا تراكم عند التقاطع، الطبقة الحية','A',async p=>{
 await Z.tool(p,'hl');const q=await Z.S2(p,300,300);await p.mouse.move(q.x,q.y);await p.mouse.down();const q2=await Z.S2(p,600,300);await p.mouse.move(q2.x,q2.y,{steps:5});
 const op=await p.evaluate(()=>document.getElementById('live').style.opacity);await p.mouse.up();await sleep(50);
 const op2=await p.evaluate(()=>document.getElementById('live').style.opacity);
 await Z.drag(p,[[300,500],[700,500],[500,420],[500,600]],{steps:6});     // يقاطع نفسه عند (500,500)
 const cross=await Z.px(p,500,500),side=await Z.px(p,400,500),only=await Z.px(p,450,300);const e=await Z.els(p);
 const ok=op==='0.4'&&op2===''&&e.length===2&&e.every(x=>x.hl)&&only[0]>240&&only[2]<200&&only[2]>60&&near(cross[0],side[0],3)&&near(cross[2],side[2],3);
 return[ok,JSON.stringify({op,op2,only,cross,side})]});
T('Z03','أشكال: كل الأنواع، دائرة بالمركز، نسب ثابتة، لمسة بلا سحب','A',async p=>{
 await Z.tool(p,'shape');const kinds=['line','arrow','rect','ellipse','triangle','rtriangle','diamond'];const out={};
 let y=150;for(const k of kinds){await p.evaluate(k=>{__sb.S.shapeKind=k},k);await Z.drag(p,[[300,y],[520,y+60]]);y+=100}
 await p.evaluate(()=>{__sb.S.shapeKind='circle'});await Z.drag(p,[[1000,300],[1080,300]]);
 await p.evaluate(()=>{__sb.S.shapeKind='rect';__sb.S.shapeLock=true});await Z.drag(p,[[1200,600],[1300,650]]);await p.evaluate(()=>{__sb.S.shapeLock=false});
 await Z.tap(p,900,900);
 const e=await Z.els(p);const ks=e.map(x=>x.kind);
 const circ=e[7],sq=e[8];const cw=circ.bbox[2]-circ.bbox[0],ch=circ.bbox[3]-circ.bbox[1];const sw=sq.bbox[2]-sq.bbox[0],sh=sq.bbox[3]-sq.bbox[1];
 await p.evaluate(()=>{__sb.S.fill=true;__sb.S.shapeKind='ellipse'});await Z.drag(p,[[100,800],[300,900]]);const fillPx=await Z.px(p,200,850);await p.evaluate(()=>{__sb.S.fill=false});
 const h=await Z.hist(p);
 return[e.length===9&&JSON.stringify(ks.slice(0,8))===JSON.stringify([...kinds,'ellipse'])&&near(cw,ch,1)&&near(cw,2*80+8,2)&&near(sw,sh,1)&&fillPx[0]<250&&h.u===10,JSON.stringify({ks,cw,ch,sw,sh,fillPx,h})]});
T('Z04','تحديد: لمسة، تحريك (بلا أشباح)، تغيير حجم، تحديد إطاري، نسخ/لصق/تكرار/حذف/ترتيب/تدوير/لون، تراجع','A',async p=>{
 await Z.tool(p,'shape');await p.evaluate(()=>{__sb.S.shapeKind='rect'});await Z.drag(p,[[300,300],[500,400]]);await Z.drag(p,[[700,300],[900,400]]);
 await Z.tool(p,'select');await Z.tap(p,300,350);const s1=await p.evaluate(()=>__sb.SEL.ids.size);
 // تحريك: سحب من حافة العنصر (بعيدًا عن المقابض)
 const before=(await Z.els(p))[0].tf;await Z.drag(p,[[350,330],[450,480]]);const e1=await Z.els(p);const old=await Z.px(p,300,350),nw=await Z.px(p,400,500);const h1=await Z.hist(p);
 const moved=near(e1[0].tf[4]-before[4],100,1.5)&&near(e1[0].tf[5]-before[5],150,1.5);
 await p.evaluate(()=>__sb.undo());const e2=await Z.els(p);const old2=await Z.px(p,300,350);await p.evaluate(()=>__sb.redo());
 // تغيير الحجم: مقبض الزاوية السفلية اليمنى للمحدَّد
 const bb=await p.evaluate(()=>{const b=__sb.unionBox(__sb.selEls());return b});const k=await p.evaluate(()=>__sb.K());
 await Z.drag(p,[[bb[2],bb[3]],[bb[2]+50,bb[3]+50]]);const e3=await Z.els(p);const grow=e3[0].tf[0]>e1[0].tf[0]*1.05&&e3[0].tf[3]>1.05;
 // تحديد إطاري
 await Z.drag(p,[[150,150],[1000,700]]);const ms=await p.evaluate(()=>__sb.SEL.ids.size);
 const n0=(await Z.els(p)).length;
 await p.evaluate(()=>{__sb.selCopy();__sb.selPaste()});const n1=(await Z.els(p)).length;
 await p.evaluate(()=>__sb.selDup());const n2=(await Z.els(p)).length;
 await p.evaluate(()=>__sb.selDelete());const n3=(await Z.els(p)).length;await p.evaluate(()=>__sb.undo());const n4=(await Z.els(p)).length;
 await p.evaluate(()=>{__sb.selAll();__sb.selOrder(false)});const ord=(await Z.els(p)).map(x=>x.id);
 await p.evaluate(()=>{__sb.selAll();__sb.recolorSel('#d81b60')});const col=(await Z.els(p))[0].color;
 const bw0=await p.evaluate(()=>{const b=__sb.unionBox(__sb.selEls());return[b[2]-b[0],b[3]-b[1]]});await p.evaluate(()=>__sb.selRotate());const bw1=await p.evaluate(()=>{const b=__sb.unionBox(__sb.selEls());return[b[2]-b[0],b[3]-b[1]]});
 const ok=s1===1&&moved&&h1.u===3&&old[0]>240&&nw[0]<120&&e2[0].tf[4]===before[4]&&old2[0]<120&&grow&&ms===2&&n1===n0+2&&n2===n1+2&&n3===n2-2&&n4===n2&&col==='#d81b60'&&near(bw1[0],bw0[1],2)&&near(bw1[1],bw0[0],2);
 return[ok,JSON.stringify({s1,moved,h1,old,nw,old2,grow,ms,n:[n0,n1,n2,n3,n4],col,bw0,bw1})]});
T('Z05','صفحات: إضافة/نسخ/حذف/نقل/تنقل مع تراجع وحفظ المحتوى','A',async p=>{
 await Z.drag(p,[[300,300],[600,300]]);
 await p.click('#pgAdd');await sleep(80);const a=await p.evaluate(()=>({n:__sb.S.doc.pages.length,i:__sb.S.doc.activePage,e:__sb.pg().elements.length}));
 await Z.drag(p,[[300,400],[600,400]]);await Z.drag(p,[[300,500],[600,500]]);
 await p.evaluate(()=>__sb.duplicatePage());const b=await p.evaluate(()=>({n:__sb.S.doc.pages.length,i:__sb.S.doc.activePage,e:__sb.pg().elements.length,ids:__sb.pg().elements.map(x=>x.id)}));
 const orig=await p.evaluate(()=>__sb.S.doc.pages[1].elements.map(x=>x.id));const distinct=b.ids.every(id=>!orig.includes(id));
 await p.evaluate(()=>__sb.movePage(2,0));const c=await p.evaluate(()=>({i:__sb.S.doc.activePage,first:__sb.S.doc.pages[0].elements.length}));
 await p.evaluate(()=>__sb.undo());const d=await p.evaluate(()=>({i:__sb.S.doc.activePage,n:__sb.S.doc.pages.length}));
 await p.evaluate(()=>__sb.deletePage());const e=await p.evaluate(()=>__sb.S.doc.pages.length);await p.evaluate(()=>__sb.undo());const f=await p.evaluate(()=>({n:__sb.S.doc.pages.length,e:__sb.pg().elements.length}));
 await p.evaluate(()=>{__sb.undo();__sb.undo()});const g=await p.evaluate(()=>__sb.S.doc.pages.length);
 await p.evaluate(()=>{__sb.redo();__sb.redo()});const h2=await p.evaluate(()=>__sb.S.doc.pages.length);
 await p.click('#pgNum');await sleep(300);const th=await p.evaluate(()=>document.querySelectorAll('#pgPanel .thumb').length);
 await p.evaluate(()=>{document.getElementById('pgPanel').hidden=true;__sb.goPage(0)});await p.keyboard.press('PageDown');await sleep(50);const nav=await p.evaluate(()=>__sb.S.doc.activePage);
 const lastDel=await (async()=>{await p.evaluate(()=>{while(__sb.S.doc.pages.length>1)__sb.deletePage()});await p.evaluate(()=>__sb.deletePage());return p.evaluate(()=>__sb.S.doc.pages.length)})();
 return[a.n===2&&a.i===1&&a.e===0&&b.n===3&&b.e===2&&distinct&&c.i===0&&c.first===2&&d.n===3&&e===2&&f.n===3&&f.e===2&&g>=1&&th===3&&nav===1&&lastDel===1,JSON.stringify({a,b,c,d,e,f,g,h2,th,nav,lastDel})]});
T('Z06','نص عربي: إدراج، يمين-يسار، حركات، تعديل، حذف بإفراغ، تراجع','A',async p=>{
 await Z.tool(p,'text');await Z.tap(p,900,300);await sleep(100);const open1=await p.evaluate(()=>__sb.txEdOpen());
 await p.keyboard.type('بِسْمِ اللَّهِ الرَّحْمَٰنِ');await p.keyboard.press('Enter');await p.keyboard.type('Test سطر ثانٍ ٣');await p.click('#txOk');await sleep(100);
 const e=(await Z.els(p)).filter(x=>x.type==='text');const t=e[0];
 const dark=await p.evaluate(()=>{const el=__sb.pg().elements[0],b=el.bbox,c=document.getElementById('doc'),a=__sb.toScreen(b[0],b[1]),z=__sb.toScreen(b[2],b[3]),dpr=devicePixelRatio,d=c.getContext('2d').getImageData(Math.floor(a.x*dpr),Math.floor(a.y*dpr),Math.ceil((z.x-a.x)*dpr),Math.ceil((z.y-a.y)*dpr)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<100)n++;return n});
 const L=await p.evaluate(()=>{const el=__sb.pg().elements[0],l=__sb.layoutText(el);return{lines:l.lines.length,w:l.w,rtlFirst:__sb.dirOf(l.lines[0]),rtlSecond:__sb.dirOf(l.lines[1])}});
 // تعديل بنقرتين بأداة التحديد
 await Z.tool(p,'select');const cx=(t.wb[0]+t.wb[2])/2,cy=(t.wb[1]+t.wb[3])/2;{const q=await Z.S2(p,cx,cy);await p.mouse.move(q.x,q.y);await p.mouse.down();await p.mouse.up();await p.mouse.down();await p.mouse.up();}await sleep(120);const open2=await p.evaluate(()=>__sb.txEdOpen());
 await p.evaluate(()=>{const ta=document.getElementById('txEd');ta.value='نص معدَّل';});await p.click('#txOk');await sleep(80);
 const e2=(await Z.els(p)).filter(x=>x.type==='text')[0];const h=await Z.hist(p);
 await p.evaluate(()=>__sb.undo());const e3=(await Z.els(p)).filter(x=>x.type==='text')[0];
 await p.evaluate(()=>{__sb.redo();const el=__sb.pg().elements[0];__sb.editText(el);document.getElementById('txEd').value='  ';});await p.click('#txOk');await sleep(80);const n4=(await Z.els(p)).length;
 return[open1&&e.length===1&&t.text.includes('الرَّحْمَٰنِ')&&dark>200&&L.lines===2&&L.rtlFirst==='rtl'&&L.rtlSecond==='ltr'&&open2&&e2.text==='نص معدَّل'&&h.u===2&&e3.text.startsWith('بِسْمِ')&&n4===0,JSON.stringify({open1,open2,dark,L,txt:e2&&e2.text,h,n4})]});
T('Z07','صور: إدراج PNG، أصل، تحريك، حفظ واستعادة، حذف الأصل غير المستخدم من الملف','A',async p=>{
 const data=await png1(p);const buf=Buffer.from(data.split(',')[1],'base64');
 await p.setInputFiles('#fileImg',{name:'a.png',mimeType:'image/png',buffer:buf});await sleep(600);
 const e=(await Z.els(p)).filter(x=>x.type==='image');const as=await p.evaluate(()=>Object.keys(__sb.S.doc.assets).length);const tl=await p.evaluate(()=>__sb.S.tool);
 const px=await Z.px(p,(e[0].wb[0]+e[0].wb[2])/2,(e[0].wb[1]+e[0].wb[3])/2);
 const j=await p.evaluate(()=>__sb.exportDoc());const imp=await p.evaluate(j=>{const r=__sb.importDoc(j);return{ok:r.ok,a:r.ok?Object.keys(r.doc.assets).length:0,errs:r.errors}},j);
 await p.evaluate(()=>{__sb.undo()});const j2=await p.evaluate(()=>__sb.exportDoc());const noAsset=Object.keys(JSON.parse(j2).assets).length===0;
 return[e.length===1&&as===1&&tl==='select'&&px[2]>150&&px[0]<80&&imp.ok&&imp.a===1&&noAsset,JSON.stringify({n:e.length,as,tl,px,imp,noAsset})]});
T('Z08','حفظ/استعادة: كل أنواع العناصر وصفحات وخلفيات، رفض الملفات المعطوبة','A',async p=>{
 await Z.drag(p,[[300,300],[500,320]]);await Z.tool(p,'hl');await Z.drag(p,[[300,400],[600,400]]);await Z.tool(p,'shape');await p.evaluate(()=>{__sb.S.shapeKind='arrow'});await Z.drag(p,[[300,500],[600,600]]);
 await Z.tool(p,'text');await Z.tap(p,1000,300);await p.keyboard.type('اختبار');await p.click('#txOk');await sleep(60);
 const data=await png1(p);await p.setInputFiles('#fileImg',{name:'a.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});await sleep(500);
 await p.evaluate(()=>{__sb.addPageAfter();__sb.setBackground('grid')});
 const r=await p.evaluate(()=>{const j=__sb.exportDoc(),o=__sb.importDoc(j);if(!o.ok)return{ok:false,errs:o.errors};const j2=JSON.stringify(__sb.serializeDoc(o.doc));return{ok:true,same:j===j2,pages:o.doc.pages.length,bg:o.doc.pages[1].background.type,len:j.length}});
 const bad=await p.evaluate(()=>{const base=JSON.parse(__sb.exportDoc());const mk=f=>{const c=JSON.parse(JSON.stringify(base));f(c);return __sb.importDoc(JSON.stringify(c)).ok};
  return{kind:mk(c=>{c.pages[0].elements.find(e=>e.type==='shape').kind='zzz'}),asset:mk(c=>{c.pages[0].elements.find(e=>e.type==='image').asset='nope'}),text:mk(c=>{c.pages[0].elements.find(e=>e.type==='text').text=''}),dup:mk(c=>{c.pages[0].elements[1].id=c.pages[0].elements[0].id}),bg:mk(c=>{c.pages[0].background.type='spiral'}),ver:mk(c=>{c.version=3}),hl:mk(c=>{c.pages[0].elements[1].hl='yes'}),mime:mk(c=>{const k=Object.keys(c.assets)[0];c.assets[k].mime='text/html'}),tf:mk(c=>{c.pages[0].elements.find(e=>e.type==='shape').tf=[0,0,0,0,0,0]}),ok:mk(c=>{})}});
 const loaded=await p.evaluate(()=>{const o=__sb.importDoc(__sb.exportDoc());__sb.loadDoc(o.doc);return{n:__sb.pg().elements.length,pages:__sb.S.doc.pages.length,types:[...new Set(__sb.S.doc.pages[0].elements.map(e=>e.type))].sort().join()}});
 return[r.ok&&r.same&&r.pages===2&&r.bg==='grid'&&!bad.kind&&!bad.asset&&!bad.text&&!bad.dup&&!bad.bg&&!bad.ver&&!bad.hl&&!bad.mime&&!bad.tf&&bad.ok&&loaded.types==='image,shape,stroke,text',JSON.stringify({r,bad,loaded})]});
T('Z09','PDF: تصدير ثم استيراد (pdf.js)، صفحات مقفلة، كتابة فوقها، خطوة تراجع واحدة','A',async p=>{
 await Z.drag(p,[[300,300],[500,300]]);await p.evaluate(()=>{__sb.addPageAfter()});await Z.drag(p,[[300,300],[500,330]]);
 const b64=await p.evaluate(async()=>{const b=await __sb.buildPDF(__sb.S.doc.pages);const u=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)});
 const buf=Buffer.from(b64,'base64');const head=buf.slice(0,5).toString(),tail=buf.slice(-6).toString();
 await p.evaluate(()=>{__sb.newDoc({w:1440,h:1080})});await sleep(100);
 await p.setInputFiles('#filePdf',{name:'t.pdf',mimeType:'application/pdf',buffer:buf});
 await p.waitForFunction(()=>__sb.S.doc.pages.length===2,null,{timeout:30000}).catch(()=>{});await sleep(800);
 const r=await p.evaluate(()=>({n:__sb.S.doc.pages.length,w:__sb.pg().w,h:__sb.pg().h,el:__sb.pg().elements.map(e=>({t:e.type,l:!!e.locked})),assets:Object.keys(__sb.S.doc.assets).length,u:__sb.HIST.undo.length}));
 const px=await Z.px(p,300,300);
 await Z.tool(p,'select');await Z.tap(p,400,400);const sel=await p.evaluate(()=>__sb.SEL.ids.size);
 await Z.tool(p,'pen');await Z.drag(p,[[300,700],[700,720]]);const e=await Z.els(p);
 await Z.tool(p,'erase');await Z.drag(p,[[200,200],[900,900]]);const e2=await Z.els(p);
 return[head==='%PDF-'&&tail.includes('%%EOF')&&r.n===2&&r.el[0].t==='image'&&r.el[0].l&&r.u===1&&sel===0&&e.length===2&&e2.some(x=>x.type==='image'&&x.locked),JSON.stringify({head,r,px,sel,e:e.length,e2:e2.length})]});
T('Z10','ممحاة: أشكال ونصوص وصور تُمحى كاملة، خطوط جزئيًا، خطوة واحدة، المقفل لا يُمحى','A',async p=>{
 await Z.tool(p,'shape');await p.evaluate(()=>{__sb.S.shapeKind='rect'});await Z.drag(p,[[300,200],[500,300]]);
 await Z.tool(p,'text');await Z.tap(p,900,200);await p.keyboard.type('نص للمحو');await p.click('#txOk');await sleep(60);
 await Z.tool(p,'pen');await Z.drag(p,[[300,600],[800,600]],{steps:12});
 await Z.tool(p,'erase');await p.evaluate(()=>{__sb.S.eraser.r=20;__sb.S.eraser.mode='partial'});
 const n0=(await Z.els(p)).length;
 await Z.drag(p,[[400,150],[400,320]]);                        // يقطع الشكل
 const t=(await Z.els(p)).find(x=>x.type==='text');await Z.drag(p,[[(t.bbox[0]+t.bbox[2])/2,t.bbox[1]-30],[(t.bbox[0]+t.bbox[2])/2,t.bbox[3]+30]]);
 await Z.drag(p,[[550,560],[550,640]]);                         // يقص الخط إلى قطعتين
 const e=await Z.els(p);const h=await Z.hist(p);
 const strokes=e.filter(x=>x.type==='stroke').length;
 await p.evaluate(()=>{__sb.undo();__sb.undo();__sb.undo()});const e2=await Z.els(p);
 return[n0===3&&e.filter(x=>x.type!=='stroke').length===0&&strokes===2&&h.u===6&&e2.length===3,JSON.stringify({n0,after:e.map(x=>x.type),h,undone:e2.length})]});
T('Z11','عرض: عجلة التكبير تحت المؤشر، تحريك، قرص بإصبعين، حدود التكبير','A',async p=>{
 const q=await Z.S2(p,960,540);await p.mouse.move(q.x,q.y);const L0=await p.evaluate(()=>__sb.toLogical(...(()=>{const r=document.getElementById('live').getBoundingClientRect();return[window.__mx-r.left,window.__my-r.top]})()));
 await p.evaluate(([x,y])=>{window.__mx=x;window.__my=y},[q.x,q.y]);
 const before=await p.evaluate(([x,y])=>{const r=document.getElementById('live').getBoundingClientRect();return __sb.toLogical(x-r.left,y-r.top)},[q.x,q.y]);
 await p.keyboard.down('Control');await p.mouse.wheel(0,-400);await p.mouse.wheel(0,-300);await p.keyboard.up('Control');await sleep(100);
 const z1=await p.evaluate(()=>__sb.pg().view.zoom);
 const after=await p.evaluate(([x,y])=>{const r=document.getElementById('live').getBoundingClientRect();return __sb.toLogical(x-r.left,y-r.top)},[q.x,q.y]);
 const cy0=await p.evaluate(()=>__sb.pg().view.cy);await p.mouse.wheel(0,200);await sleep(80);const cy1=await p.evaluate(()=>__sb.pg().view.cy);await p.evaluate(()=>__sb.viewReset());
 // قرص
 const r=await p.evaluate(()=>{const c=document.getElementById('live'),rc=c.getBoundingClientRect(),ev=(t,id,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:rc.left+x,clientY:rc.top+y,bubbles:true,cancelable:true,isPrimary:id===21,button:0,buttons:1}));
  const z0=__sb.pg().view.zoom;ev('pointerdown',21,500,300);ev('pointerdown',22,700,300);for(let i=1;i<=10;i++){ev('pointermove',21,500-i*20,300);ev('pointermove',22,700+i*20,300)}
  const z=__sb.pg().view.zoom;ev('pointerup',21,300,300);ev('pointerup',22,900,300);return{z0,z,n:__sb.pg().elements.length}});
 await p.evaluate(()=>__sb.zoomAt(100,0,0));const zmax=await p.evaluate(()=>__sb.pg().view.zoom);await p.evaluate(()=>__sb.zoomAt(0.0001,0,0));const zmin=await p.evaluate(()=>__sb.pg().view.zoom);
 await p.evaluate(()=>__sb.viewReset());await p.click('#zIn');await sleep(40);const zi=await p.evaluate(()=>__sb.pg().view.zoom);await p.click('#zVal');await sleep(40);const zr=await p.evaluate(()=>__sb.pg().view.zoom);
 const lab=await p.evaluate(()=>document.getElementById('zVal').textContent);
 return[z1>1.5&&near(before.x,after.x,3)&&near(before.y,after.y,3)&&r.z>r.z0*1.5&&r.n===0&&zmax===8&&zmin===0.2&&near(zi,1.25,0.01)&&zr===1&&cy1>cy0&&!/[0-9]/.test(lab),JSON.stringify({cy0,cy1,z1,before,after,r,zmax,zmin,zi,zr,lab})]});
T('Z12','أدوات المعلم: مسطرة (استقامة)، منقلة، ستارة، مؤقت، خلفيات، لون السبورة','A',async p=>{
 await p.evaluate(()=>__sb.toggleRuler());const rr=await p.evaluate(()=>{const R=__sb.TT.ruler;return{cx:R.o.cx,cy:R.o.cy,w:R.w,h:R.h}});
 // حافة المسطرة العليا: y = cy - h/2 (بإحداثيات الشاشة داخل المسرح)
 const sr=await p.evaluate(()=>{const r=document.getElementById('live').getBoundingClientRect();return{l:r.left,t:r.top}});
 const y=rr.cy-rr.h/2;await p.mouse.move(sr.l+rr.cx-200,sr.t+y-10);await p.mouse.down();for(let i=0;i<=20;i++)await p.mouse.move(sr.l+rr.cx-200+i*20,sr.t+y-10+Math.sin(i)*9);await p.mouse.up();await sleep(60);
 const st=(await p.evaluate(()=>__sb.pg().elements[0].pts.map(q=>[q.x,q.y])));let maxd=0;{const a=st[0],b=st[st.length-1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);for(const q of st)maxd=Math.max(maxd,Math.abs((q[0]-a[0])*dy-(q[1]-a[1])*dx)/L)}
 await p.evaluate(()=>__sb.toggleRuler());const rgone=await p.evaluate(()=>!__sb.TT.ruler&&!document.querySelector('.ruler'));
 const pr=await p.evaluate(()=>{__sb.toggleProto();return!!document.querySelector('.proto svg text')});await p.evaluate(()=>__sb.toggleProto());
 const cu=await p.evaluate(()=>{__sb.toggleCurtain();const c=__sb.TT.curtain;const h0=c.el.offsetHeight;c.size=0.2;c.lay();return{h0,h1:c.el.offsetHeight,sh:document.getElementById('stage').clientHeight}});await p.evaluate(()=>__sb.toggleCurtain());
 const tm=await p.evaluate(async()=>{__sb.toggleTimer();const d=document.getElementById('timerDigits'),t0=d.textContent;const btn=[...document.querySelectorAll('.timer .btn')].find(b=>b.textContent==='ابدأ');btn.click();await new Promise(r=>setTimeout(r,1300));const t1=d.textContent;
   const w=[...document.querySelectorAll('.timer .btn')].find(b=>b.textContent==='إيقاف مؤقت');w&&w.click();return{t0,t1,hasPause:!!w}});await p.evaluate(()=>__sb.toggleTimer());
 const bg={};for(const k of['plain','lines','grid','dots']){await p.evaluate(k=>__sb.setBackground(k),k);const pos={plain:[54,300],lines:[300,81],grid:[54,300],dots:[54,54]};bg[k]=(await Z.px(p,...pos[k]))[0]}
 await p.evaluate(()=>__sb.setBoard('#161616'));const dk=await Z.px(p,5,5);await p.evaluate(()=>__sb.setBoard('#ffffff'));
 return[maxd<0.6&&rgone&&pr&&cu.h1<cu.h0&&tm.t0==='٠٥:٠٠'&&tm.t1!==tm.t0&&bg.plain===255&&bg.lines<250&&bg.grid<250&&bg.dots<250&&dk[0]<40,JSON.stringify({maxd,rgone,pr,cu,tm,bg,dk})]});
T('Z13','تصدير: PNG وZIP وPDF فعلية قابلة للقراءة','A',async p=>{
 await Z.drag(p,[[300,300],[600,320]]);await p.evaluate(()=>{__sb.addPageAfter()});await Z.drag(p,[[300,400],[600,420]]);
 const a=await dl(p,()=>__sb.exportPNGPage());const sig=a.buf.slice(0,8).toString('hex');const w=a.buf.readUInt32BE(16),h=a.buf.readUInt32BE(20);
 const b=await dl(p,()=>__sb.exportPNGAll());const zsig=b.buf.slice(0,4).toString('hex');
 const c=await dl(p,()=>__sb.exportPDF(false));const pdf=c.buf.toString('latin1');const pages=(pdf.match(/\/Type \/Page /g)||[]).length;
 const zr=require('child_process').spawnSync('python3',['-c',"import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip(),len(z.namelist()))",b.path]).stdout.toString().trim();
 const ctx=p.ctx;
 return[sig==='89504e470d0a1a0a'&&w>=1000&&h>=500&&zsig==='504b0304'&&zr==='None 2'&&pdf.startsWith('%PDF-')&&pages===2&&pdf.includes('%%EOF'),JSON.stringify({sig,w,h,zsig,zr,pages,names:[a.name,b.name,c.name]})]});
T('Z14','حفظ تلقائي واستعادة بعد إعادة التحميل','A',async(p0,env)=>{
 const p=await Z.open(env.cfg,{browser:p0.b,auto:true});const ctxA=p.ctx;await Z.drag(p,[[300,300],[600,320]]);await Z.drag(p,[[300,400],[600,420]]);await sleep(3600);
 const saved=await p.evaluate(()=>__sb.AUTO.saved);const err=await p.evaluate(()=>__sb.AUTO.error);await p.close();
 const p2=await ctxA.newPage();await p2.goto('file://'+Z.FILE);await sleep(1500);
 const tt=await p2.evaluate(()=>document.getElementById('toast').hidden?'':document.getElementById('toast').innerText);
 await p2.evaluate(()=>[...document.querySelectorAll('#toast .btn')].forEach(b=>b.click()));await sleep(300);const n=await p2.evaluate(()=>__sb.pg().elements.length);await p2.close();await ctxA.close();
 return[saved>=1&&n===2&&tt.includes('استعادته'),JSON.stringify({saved,err,tt:tt.slice(0,60),n})]});
T('Z15','تخطيط: أزرار ≥٤٨، بلا تمرير، تغطية الشريط ≤ الدفعة ٢، لوحة الخيارات والشريط داخل المسرح، أرقام عربية فقط','config',async(p,env)=>{
 const base={A:8.35,B:4.14,C:8.35,D:10.94},baseH={A:7.2,B:3.6,C:7.2,D:11.7};
 const meas=async dock=>{await p.evaluate(d=>__sb.setToolbar({dock:d,pos:.5,collapsed:false}),dock);await sleep(100);
  return p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect(),t=document.getElementById('tbar'),r=t.getBoundingClientRect();const vis=e=>e.getClientRects().length>0;
   const small=[...t.querySelectorAll('button,input')].filter(vis).filter(e=>{const b=e.getBoundingClientRect();return b.height<47.5||(e.tagName==='BUTTON'&&b.width<47.5)}).map(e=>e.id||e.className);
   return{cov:Math.round(r.width*r.height/(st.width*st.height)*10000)/100,w:Math.round(r.width),h:Math.round(r.height),scroll:t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1,small,inside:r.left>=st.left-1&&r.right<=st.right+1&&r.top>=st.top-1&&r.bottom<=st.bottom+1}})};
 const v=await meas('right'),h=await meas('bottom');
 const opt={};for(const dock of['right','bottom','left','top']){await p.evaluate(d=>{__sb.setToolbar({dock:d,pos:.5,collapsed:false});__sb.setTool('shape',true);__sb.showOpts()},dock);await sleep(100);
  opt[dock]=await p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect(),o=document.getElementById('opts').getBoundingClientRect(),t=document.getElementById('tbar').getBoundingClientRect();const ov=!(o.right<=t.left||o.left>=t.right||o.bottom<=t.top||o.top>=t.bottom);
   return{inside:o.left>=st.left-1&&o.right<=st.right+1&&o.top>=st.top-1&&o.bottom<=st.bottom+1,overlapsTb:ov}});}
 await p.evaluate(()=>{__sb.hideOpts();__sb.setToolbar({dock:'right',pos:.5,collapsed:false})});
 const pb=await p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect(),b=document.getElementById('pgbar').getBoundingClientRect(),small=[...document.querySelectorAll('#pgbar button')].filter(e=>{const r=e.getBoundingClientRect();return r.width<47.5||r.height<47.5}).length;return{inside:b.left>=st.left-1&&b.right<=st.right+1&&b.bottom<=st.bottom+1,small}});
 const dig=await p.evaluate(()=>{const txt=[...document.querySelectorAll('#bar,#tbar,#pgbar')].map(e=>e.innerText+' '+[...e.querySelectorAll('[title],[aria-label]')].map(x=>(x.title||'')+(x.getAttribute('aria-label')||'')).join(' ')).join(' ');return txt.match(/[0-9]/g)||[]});
 const ok=v.small.length===0&&h.small.length===0&&!v.scroll&&!h.scroll&&v.inside&&h.inside&&v.cov<=base[env.cfg.n]+0.01&&h.cov<=baseH[env.cfg.n]+0.01&&Object.values(opt).every(o=>o.inside&&!o.overlapsTb)&&pb.inside&&pb.small===0&&dig.length===0;
 return[ok,JSON.stringify({cfg:env.cfg.n,v,h,base:[base[env.cfg.n],baseH[env.cfg.n]],opt,pb,dig:dig.slice(0,5)})]});
T('Z16','قائمة ملف والمعلم تُفتحان داخل الشاشة وعناصرها ≥٤٨ وبلا أرقام لاتينية','config',async(p,env)=>{
 const res={};for(const [id,fn] of [['file','openFileMenu'],['teach','openTeachMenu']]){await p.evaluate(f=>__sb[f](),fn);await sleep(100);
  res[id]=await p.evaluate(()=>{const m=document.querySelector('.menu');if(!m)return{none:true};const r=m.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;const items=[...m.querySelectorAll('button,input')].map(b=>b.getBoundingClientRect().height);return{inside:r.left>=0&&r.right<=vw&&r.top>=0&&r.bottom<=vh+1,minH:Math.round(Math.min(...items)),dig:(m.innerText.match(/[0-9]/g)||[]).length}});await p.evaluate(()=>__sb.closeMenu())}
 return[Object.values(res).every(r=>!r.none&&r.inside&&r.minH>=48&&r.dig===0),JSON.stringify(res)]});
T('Z17','لا أخطاء في الصفحة ولا طلبات شبكة خارجية','config',async(p)=>[p.errs.length===0,p.errs.slice(0,3).join('|')]);

(async()=>{
 const b=await Z.chromium.launch();
 for(const cfg of Z.CONFIGS){
  const p=await Z.open(cfg,{browser:b});const reqs=[];p.on('request',r=>{const u=r.url();if(!u.startsWith('file:')&&!u.startsWith('data:')&&!u.startsWith('blob:'))reqs.push(u)});
  for(const t of TESTS){
   if(t.scope==='A'&&cfg.n!=='A')continue;if(ONLY&&!ONLY.includes(t.id))continue;
   if(!R[t.id])R[t.id]={id:t.id,name:t.name,scope:t.scope,runs:[]};
   await p.evaluate(()=>{__sb.hideOpts();__sb.closeMenu();__sb.setTool('pen',true);__sb.newDoc({w:1920,h:1080});__sb.viewReset&&__sb.viewReset()}).catch(()=>{});await sleep(80);
   let res;try{res=await t.fn(p,{cfg})}catch(e){res=[false,'استثناء: '+e.message.split('\n')[0]]}
   if(t.id==='Z17'){res=[p.errs.length===0&&reqs.length===0,p.errs.slice(0,3).concat(reqs.slice(0,2)).join('|')]}
   R[t.id].runs.push({cfg:cfg.n,status:res[0]?'PASS':'FAIL',detail:res[1]});
   console.log(res[0]?'PASS':'FAIL',t.id,cfg.n,t.name.slice(0,50),'|',String(res[1]).slice(0,260));
  }
  await p.close();
 }
 await b.close();
 let runs=0,pass=0;for(const id in R)for(const r of R[id].runs){runs++;if(r.status==='PASS')pass++}
 console.log('SCENARIOS',Object.keys(R).length,'RUNS',runs,'PASS',pass,'FAIL',runs-pass);
 if(!process.env.NOOUT)FS.writeFileSync((()=>{const o=process.env.OUT||require('path').join(__dirname,'results')+require('path').sep;FS.mkdirSync(o,{recursive:true});return o})()+'pro-test-results.json',JSON.stringify(R,null,1));
})();
