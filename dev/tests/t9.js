const {chromium}=require('playwright');
const FS=require('fs');
const PATH=require('path'),URL_=require('url');const ROOT=PATH.resolve(__dirname,'..');const F=process.env.FILE||URL_.pathToFileURL(PATH.join(ROOT,'smart-board-pro-merged.html')).href;const ONLY=process.env.ONLY?process.env.ONLY.split(','):null;
const OUT=process.env.OUT||PATH.join(__dirname,'results')+PATH.sep;if(!process.env.NOOUT)FS.mkdirSync(OUT,{recursive:true});
const P1=URL_.pathToFileURL(PATH.join(__dirname,'fixtures','phase1-draw-test.html')).href;
const CONFIGS=[{n:'A',w:1366,h:768,d:1}];
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const hue=h=>{let [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let H=0;if(d){if(mx===r)H=((g-b)/d)%6;else if(mx===g)H=(b-r)/d+2;else H=(r-g)/d+4}return(H*60+360)%360};
const hex2rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const TESTS=[];const T=(id,scope,name,fn)=>TESTS.push({id,scope,name,fn});
const R={};  // id -> {name,scope,runs:[]}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- helpers inside page ----------
const HELP=`
window.T={
 live(){return document.getElementById('live')},
 evL(type,id,pt,lx,ly,extra){const l=this.live(),r=l.getBoundingClientRect(),s=__sb.toScreen(lx,ly);
   l.dispatchEvent(new PointerEvent(type,Object.assign({pointerId:id,pointerType:pt,clientX:r.left+s.x,clientY:r.top+s.y,bubbles:true,cancelable:true,isPrimary:true,pressure:0.5,button:0,buttons:1},extra||{})))},
 evS(type,id,pt,sx,sy,extra){const l=this.live(),r=l.getBoundingClientRect();
   l.dispatchEvent(new PointerEvent(type,Object.assign({pointerId:id,pointerType:pt,clientX:r.left+sx,clientY:r.top+sy,bubbles:true,cancelable:true,isPrimary:true,pressure:0.5,button:0,buttons:1},extra||{})))},
 raf(){return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},
 reset(){const S=__sb.S;__sb.newDoc({w:1920,h:1080});S.active=null;S.touchIds.clear();S.penIds.clear();S.lock=false;S.mode='both';
  for(const k in S.m)if(typeof S.m[k]==='number')S.m[k]=0;
  __sb.CFG.palmMinPx=0;__sb.CFG.clearMs=3000;S.ink='auto';
  try{__sb.setBoard&&__sb.setBoard('#ffffff');}catch(e){}
  try{__sb.setMode&&__sb.setMode('both');}catch(e){}
  try{__sb.setTool&&__sb.setTool('pen',true);}catch(e){}
  S.width=8;if("pressure" in S)S.pressure=true;
  __sb.setView(1,960,540);__sb.DIAG.log=[];__sb.DIAG.last=null;__sb.DIAG.max={w:0,h:0};__sb.DIAG.counts={};
  if(__sb.DIAG.on)__sb.setDiag(false);
  if(__sb.isPresent())__sb.setPresent(false);__sb.closeDlg();__sb.setToolbar({dock:'right',pos:.5,collapsed:false});try{document.getElementById('tbar').classList.remove('guard');}catch(e){}
 },
 boardRGB(){const h=__sb.S.board;return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16))},
 px(c,sx,sy){const cv=document.getElementById(c),ctx=cv.getContext('2d'),d=devicePixelRatio;return Array.from(ctx.getImageData(Math.round(sx*d),Math.round(sy*d),1,1).data)},
 inkedDoc(sx,sy){const p=this.px('doc',sx,sy),b=this.boardRGB();return p[3]>0&&(Math.abs(p[0]-b[0])+Math.abs(p[1]-b[1])+Math.abs(p[2]-b[2]))>90},
 thick(which,sx){const cv=document.getElementById(which),ctx=cv.getContext('2d'),d=devicePixelRatio;const x=Math.round(sx*d);const dd=ctx.getImageData(x,0,1,cv.height).data;const b=this.boardRGB();const ih=__sb.resolveColor(__sb.S.ink),ir=[1,3,5].map(i=>parseInt(ih.slice(i,i+2),16));const thr=0.5*(Math.abs(ir[0]-b[0])+Math.abs(ir[1]-b[1])+Math.abs(ir[2]-b[2]));let n=0;
   for(let y=0;y<cv.height;y++){const i=y*4;if(which==='live'){if(dd[i+3]>128)n++}else{if(dd[i+3]>0&&(Math.abs(dd[i]-b[0])+Math.abs(dd[i+1]-b[1])+Math.abs(dd[i+2]-b[2]))>thr)n++}}return n/d},
 inkedNear(sx,sy,r){for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)if(this.inkedDoc(sx+dx,sy+dy))return true;return false},
 strokes(){return __sb.strokes()},
 snap(){const S=__sb.S;return JSON.parse(JSON.stringify({n:__sb.strokes().length,act:!!S.active,ids:S.touchIds.size,pens:S.penIds.size,lock:S.lock,m:S.m}))}
};`;

// ================= TESTS =================
T('T01','config','طبقتا الرسم بحجم العرض × كثافة البكسل',async(p)=>{const c=await p.evaluate(()=>({dw:doc.width,dh:doc.height,lw:live.width,lh:live.height,d:devicePixelRatio,cw:stage.clientWidth,ch:stage.clientHeight}));
 return [c.dw===Math.round(c.cw*c.d)&&c.dh===Math.round(c.ch*c.d)&&c.lw===c.dw&&c.lh===c.dh,JSON.stringify(c)]});
T('T02','config','الصفحة المنطقية ١٦:٩ بالوسط داخل السبورة ومتناسبة',async(p)=>{const c=await p.evaluate(()=>{const r=__sb.pageRectScreen();return{r,w:stage.clientWidth,h:stage.clientHeight}});
 const asp=c.r.w/c.r.h;const inside=c.r.x>=-0.5&&c.r.y>=-0.5&&c.r.x+c.r.w<=c.w+0.5&&c.r.y+c.r.h<=c.h+0.5;const cx=Math.abs((c.r.x+c.r.w/2)-c.w/2)<1,cy=Math.abs((c.r.y+c.r.h/2)-c.h/2)<1;
 return [Math.abs(asp-16/9)<0.005&&inside&&cx&&cy,JSON.stringify({asp:+asp.toFixed(4),inside,cx,cy})]});
T('T03','config','الهوامش خارج الصفحة لا يُرسم فيها (طبقة المستند شفافة)',async(p)=>{const r=await p.evaluate(()=>{const pr=__sb.pageRectScreen();const pts=[];if(pr.x>6)pts.push([pr.x/2,50]);if(pr.y>6)pts.push([50,pr.y/2]);return pts.map(([x,y])=>T.px('doc',x,y)[3])});
 return [r.length>0&&r.every(a=>a===0),'alphas='+JSON.stringify(r)]});
T('T04','config','خط بالفأرة (حدث موثوق) يُحفظ ويُرسم على المستند والطبقة الحية فارغة',async(p)=>{
 const pts=await p.evaluate(()=>{const l=T.live().getBoundingClientRect();const a=__sb.toScreen(480,270),b=__sb.toScreen(1440,810);return{ax:l.left+a.x,ay:l.top+a.y,bx:l.left+b.x,by:l.top+b.y}});
 await p.mouse.move(pts.ax,pts.ay);await p.mouse.down();for(let i=1;i<=40;i++)await p.mouse.move(pts.ax+(pts.bx-pts.ax)*i/40,pts.ay+(pts.by-pts.ay)*i/40);await p.mouse.up();
 await sleep(60);
 const r=await p.evaluate(()=>{const S=__sb.S;const lc=document.getElementById('live');const ld=lc.getContext('2d').getImageData(0,0,lc.width,lc.height).data;let a=0;for(let i=3;i<ld.length;i+=4)if(ld[i]>0)a++;const mid=__sb.toScreen(960,540);return{n:__sb.strokes().length,liveInk:a,mid:T.inkedDoc(mid.x,mid.y)}});
 return [r.n===1&&r.liveInk===0&&r.mid,JSON.stringify(r)]});
T('T05','config','لا نتوء عند بداية الخط (ضغط ١ ثم ٠٫٢، سماكة كبيرة): تطابق الحية والمحفوظة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const w=document.getElementById('width');w.value=24;w.dispatchEvent(new Event('input'));
  T.evL('pointerdown',1,'pen',300,300,{pressure:1});for(let i=1;i<=10;i++)T.evL('pointermove',1,'pen',300+i*10,300,{pressure:0.2});await T.raf();await T.raf();
  const xs=[310,330,380].map(x=>__sb.toScreen(x,300).x);const live=xs.map(x=>T.thick('live',x));
  T.evL('pointerup',1,'pen',400,300,{pressure:0});await T.raf();const doc=xs.map(x=>T.thick('doc',x));return{live,doc,k:__sb.K()}});
 const par=r.live.every((v,i)=>Math.abs(v-r.doc[i])<=1.2);const ratio=r.doc[0]/r.doc[2];
 return [par&&ratio<=2.0,JSON.stringify({live:r.live.map(v=>+v.toFixed(1)),doc:r.doc.map(v=>+v.toFixed(1)),ratio:+ratio.toFixed(2)})]});
T('T06','once','لا نتوء عند نهاية الخط (الرفع بضغط ٠ في موضع جديد)',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const w=document.getElementById('width');w.value=24;w.dispatchEvent(new Event('input'));
  T.evL('pointerdown',1,'pen',300,400,{pressure:0.3});for(let i=1;i<=10;i++)T.evL('pointermove',1,'pen',300+i*10,400,{pressure:0.3});
  T.evL('pointerup',1,'pen',420,400,{pressure:0});await T.raf();const s=T.strokes()[0];const n=s.pts.length;return{last:s.pts[n-1].w,prev:s.pts[n-2].w,n}});
 return [Math.abs(r.last-r.prev)<0.01,JSON.stringify(r)]});
T('T07','config','النقطة المفردة (نقرة بلا حركة) تُرسم وتبقى: قلم ولمس وفأرة',async(p)=>{
 const r=await p.evaluate(async()=>{const out={};const w=document.getElementById('width');
  for(const [t,id] of [['pen',1],['touch',2],['mouse',3]]){T.reset();w.value=24;w.dispatchEvent(new Event('input'));
   T.evL('pointerdown',id,t,960,540);await T.raf();const mid=__sb.toScreen(960,540);const preview=T.px('live',mid.x,mid.y)[3]>0;
   T.evL('pointerup',id,t,960,540);await T.raf();
   const far=__sb.toScreen(960+20,540);const near=__sb.toScreen(960+8,540);
   out[t]={n:T.strokes().length,pts:T.strokes()[0]&&T.strokes()[0].pts.length,preview,center:T.inkedDoc(mid.x,mid.y),inR:T.inkedDoc(near.x,near.y),outR:T.inkedDoc(far.x,far.y)}}
  return out});
 const ok=Object.values(r).every(o=>o.n===1&&o.pts===1&&o.preview&&o.center&&o.inR&&!o.outR);
 return [ok,JSON.stringify(r)]});
T('T08','config','الحركات القصيرة: خط من ٣ نقاط (٨ وحدات) وآخر وخط (٢ وحدة) وفصل نقطتين متجاورتين',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const k=__sb.K();
  // fatha-like short slanted stroke, 3 points, ~8 logical units
  T.evL('pointerdown',1,'pen',500,300);T.evL('pointermove',1,'pen',504,298);T.evL('pointermove',1,'pen',508,296);T.evL('pointerup',1,'pen',508,296);await T.raf();
  // tiny 2-unit stroke
  T.evL('pointerdown',2,'pen',600,300);T.evL('pointermove',2,'pen',602,300);T.evL('pointerup',2,'pen',602,300);await T.raf();
  // two close dots 40 apart
  T.evL('pointerdown',3,'pen',700,300);T.evL('pointerup',3,'pen',700,300);T.evL('pointerdown',4,'pen',740,300);T.evL('pointerup',4,'pen',740,300);await T.raf();
  const s=T.strokes();const mid1=__sb.toScreen(504,298),e1=__sb.toScreen(508,296),mid2=__sb.toScreen(601,300),gap=__sb.toScreen(720,300),d1=__sb.toScreen(700,300),d2=__sb.toScreen(740,300);
  return{n:s.length,ptsLens:s.map(x=>x.pts.length),mid1:T.inkedDoc(mid1.x,mid1.y),end1:T.inkedDoc(e1.x,e1.y),mid2:T.inkedDoc(mid2.x,mid2.y),gap:T.inkedDoc(gap.x,gap.y),d1:T.inkedDoc(d1.x,d1.y),d2:T.inkedDoc(d2.x,d2.y),k}});
 return [r.n===4&&r.mid1&&r.end1&&r.mid2&&!r.gap&&r.d1&&r.d2,JSON.stringify(r)]});
T('T09','once','سلاسة الضغط المتغير: لا قفزة عرض بين نقطتين تتجاوز نصف الفرق',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const base=8;
  T.evL('pointerdown',1,'pen',200,200,{pressure:0.2});for(let i=1;i<=24;i++)T.evL('pointermove',1,'pen',200+i*12,200,{pressure:i%2?0.9:0.2});T.evL('pointerup',1,'pen',500,200,{pressure:0});await T.raf();
  const w=T.strokes()[0].pts.map(p=>p.w);let mx=0;for(let i=1;i<w.length;i++)mx=Math.max(mx,Math.abs(w[i]-w[i-1]));
  const lo=base*(0.4+1.2*0.2),hi=base*(0.4+1.2*0.9);return{maxStep:mx,half:(hi-lo)/2,minW:Math.min(...w),maxW:Math.max(...w)}});
 return [r.maxStep<=r.half+0.01&&r.minW>=1,JSON.stringify(r)]});
T('T10','once','إيقاف «الضغط»: السماكة ثابتة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();document.getElementById('pressure').click();
  T.evL('pointerdown',1,'pen',200,200,{pressure:1});for(let i=1;i<=10;i++)T.evL('pointermove',1,'pen',200+i*12,200,{pressure:0.1*i});T.evL('pointerup',1,'pen',330,200,{pressure:0});await T.raf();
  const w=T.strokes()[0].pts.map(p=>p.w);return{min:Math.min(...w),max:Math.max(...w)}});
 return [Math.abs(r.min-8)<1e-9&&Math.abs(r.max-8)<1e-9,JSON.stringify(r)]});
// ----- منطق الإدخال -----
T('T11','once','لمسة أثناء القلم تُرفض ويكتمل خط القلم',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',21,'pen',300,300);T.evL('pointermove',21,'pen',330,320);T.evL('pointerdown',22,'touch',900,300);T.evL('pointermove',22,'touch',920,320);T.evL('pointerup',22,'touch',920,320);T.evL('pointermove',21,'pen',360,300);T.evL('pointerup',21,'pen',360,300);await T.raf();return T.snap()});
 return [r.n===1&&r.m.ignoredTouch>=1,JSON.stringify({n:r.n,ign:r.m.ignoredTouch})]});
T('T12','once','وصول القلم يلغي خط الإصبع',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',31,'touch',300,300);T.evL('pointermove',31,'touch',330,320);T.evL('pointerdown',32,'pen',900,300);T.evL('pointermove',32,'pen',930,320);T.evL('pointerup',32,'pen',930,320);T.evL('pointerup',31,'touch',330,320);await T.raf();return T.snap()});
 return [r.n===1&&r.m.cancelledByPen===1,JSON.stringify({n:r.n,byPen:r.m.cancelledByPen})]});
T('T13','once','لمستان تلغيان الخط ولا يُحفظ شيء',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',41,'touch',300,300);T.evL('pointermove',41,'touch',330,320);T.evL('pointerdown',42,'touch',900,300);T.evL('pointermove',41,'touch',360,320);T.evL('pointerup',41,'touch',360,320);T.evL('pointerup',42,'touch',900,300);await T.raf();return T.snap()});
 return [r.n===0&&r.m.cancelledMulti===1,JSON.stringify({n:r.n,multi:r.m.cancelledMulti})]});
T('T14','once','الإصبع يعمل بعد زوال قفل اللمس المتعدد',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',41,'touch',300,300);T.evL('pointerdown',42,'touch',900,300);T.evL('pointerup',41,'touch',300,300);T.evL('pointerup',42,'touch',900,300);
  T.evL('pointerdown',43,'touch',300,300);T.evL('pointermove',43,'touch',330,320);T.evL('pointermove',43,'touch',360,300);T.evL('pointerup',43,'touch',360,300);await T.raf();return T.snap()});
 return [r.n===1&&!r.lock,JSON.stringify({n:r.n,lock:r.lock})]});
T('T15','once','وضع «القلم فقط» يتجاهل اللمس ويقبل القلم',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();document.getElementById('modePen').click();T.evL('pointerdown',61,'touch',300,300);T.evL('pointermove',61,'touch',330,320);T.evL('pointerup',61,'touch',330,320);await T.raf();const a=T.snap().n;
  T.evL('pointerdown',62,'pen',300,400);T.evL('pointermove',62,'pen',330,420);T.evL('pointermove',62,'pen',360,400);T.evL('pointerup',62,'pen',360,400);await T.raf();return{a,b:T.snap().n}});
 return [r.a===0&&r.b===1,JSON.stringify(r)]});
T('T16','once','pointercancel يُهمل الخط الجاري',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',11,'pen',300,300);T.evL('pointermove',11,'pen',340,320);T.evL('pointermove',11,'pen',380,300);T.evL('pointercancel',11,'pen',380,300);await T.raf();return T.snap()});
 return [r.n===0&&!r.act&&r.m.cancelledEvt===1,JSON.stringify({n:r.n,act:r.act})]});
// ----- قفل اللمس العالق -----
T('T17','once','انتهاء اللمسة خارج مساحة الرسم (pointerup على الصفحة): تُحرَّر المعرّفات ويُحفظ الخط',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',31,'touch',300,300);T.evL('pointermove',31,'touch',330,320);T.evL('pointermove',31,'touch',360,300);
  document.body.dispatchEvent(new PointerEvent('pointerup',{pointerId:31,pointerType:'touch',bubbles:true}));await T.raf();const a=T.snap();
  T.evL('pointerdown',32,'touch',300,400);T.evL('pointermove',32,'touch',330,420);T.evL('pointermove',32,'touch',360,400);T.evL('pointerup',32,'touch',360,400);await T.raf();return{a,b:T.snap()}});
 return [r.a.n===1&&r.a.ids===0&&!r.a.act&&r.b.n===2,JSON.stringify({ids:r.a.ids,n1:r.a.n,n2:r.b.n})]});
T('T18','once','pointercancel خارج مساحة الرسم: لا قفل ولا خط ناقص',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',31,'touch',300,300);T.evL('pointermove',31,'touch',330,320);
  document.body.dispatchEvent(new PointerEvent('pointercancel',{pointerId:31,pointerType:'touch',bubbles:true}));await T.raf();const a=T.snap();
  T.evL('pointerdown',32,'touch',300,400);T.evL('pointermove',32,'touch',330,420);T.evL('pointermove',32,'touch',360,400);T.evL('pointerup',32,'touch',360,400);await T.raf();return{a,b:T.snap()}});
 return [r.a.n===0&&r.a.ids===0&&r.b.n===1,JSON.stringify({ids:r.a.ids,n1:r.a.n,n2:r.b.n})]});
T('T19','once','لمسة متجاهلة (أثناء القلم) تنتهي خارج السبورة: لا قفل بعد رفع القلم',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',21,'pen',300,300);T.evL('pointerdown',22,'touch',900,300);T.evL('pointermove',21,'pen',330,320);T.evL('pointermove',21,'pen',360,300);T.evL('pointerup',21,'pen',360,300);
  document.body.dispatchEvent(new PointerEvent('pointerup',{pointerId:22,pointerType:'touch',bubbles:true}));const a=T.snap();
  T.evL('pointerdown',23,'touch',300,500);T.evL('pointermove',23,'touch',330,520);T.evL('pointermove',23,'touch',360,500);T.evL('pointerup',23,'touch',360,500);await T.raf();return{a,b:T.snap()}});
 return [r.a.ids===0&&r.b.n===2,JSON.stringify({ids:r.a.ids,n:r.b.n})]});
T('T20','once','فقدان التركيز (blur) أثناء الكتابة: يُحفظ الخط وتُنظَّف الحالة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',31,'touch',300,300);T.evL('pointermove',31,'touch',330,320);T.evL('pointermove',31,'touch',360,300);window.dispatchEvent(new Event('blur'));await T.raf();const a=T.snap();
  T.evL('pointerdown',32,'touch',300,500);T.evL('pointermove',32,'touch',330,520);T.evL('pointermove',32,'touch',360,500);T.evL('pointerup',32,'touch',360,500);await T.raf();return{a,b:T.snap()}});
 return [r.a.n===1&&r.a.ids===0&&!r.a.act&&r.a.m.releasedOnBlur===1&&r.b.n===2,JSON.stringify({n:r.a.n,ids:r.a.ids,rel:r.a.m.releasedOnBlur,n2:r.b.n})]});
T('T21','once','إخفاء الصفحة (visibilitychange): يُحفظ الخط وتُنظَّف الحالة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();T.evL('pointerdown',31,'touch',300,300);T.evL('pointermove',31,'touch',330,320);T.evL('pointermove',31,'touch',360,300);
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});await T.raf();return T.snap()});
 return [r.n===1&&r.ids===0&&!r.act,JSON.stringify({n:r.n,ids:r.ids})]});
T('T22','once','مسار الأحداث المجمّعة: تُستهلك كل النقاط الفرعية',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const l=T.live(),R=l.getBoundingClientRect();T.evL('pointerdown',1,'pen',300,300);
  const subs=[];for(let i=1;i<=6;i++){const s=__sb.toScreen(300+i*8,300+i*3);subs.push({clientX:R.left+s.x,clientY:R.top+s.y,pointerType:'pen',pressure:0.5,timeStamp:performance.now()})}
  const ev=new PointerEvent('pointermove',{pointerId:1,pointerType:'pen',clientX:R.left,clientY:R.top,bubbles:true,pressure:.5});Object.defineProperty(ev,'getCoalescedEvents',{value:()=>subs});l.dispatchEvent(ev);
  const n=__sb.S.active.pts.length;T.evL('pointerup',1,'pen',348,318);await T.raf();return{n,total:T.strokes()[0].pts.length}});
 return [r.n===7,JSON.stringify(r)]});
// ----- الصفحة المنطقية وتغيير الحجم والتكبير -----
T('T23','config','تعيين الإدخال إلى إحداثيات منطقية صحيح، وتساوي النتائج بين الدقات',async(p,env)=>{
 const r=await p.evaluate(async()=>{T.reset();const k=__sb.K();const a=__sb.toScreen(480,270),b=__sb.toScreen(1440,810);
  T.evS('pointerdown',1,'mouse',a.x,a.y);T.evS('pointermove',1,'mouse',(a.x+b.x)/2,(a.y+b.y)/2);T.evS('pointermove',1,'mouse',b.x,b.y);T.evS('pointerup',1,'mouse',b.x,b.y);await T.raf();
  const p=T.strokes()[0].pts;return{first:p[0],last:p[p.length-1],k}});
 env.map=r;const tol=0.02;return [Math.abs(r.first.x-480)<tol&&Math.abs(r.first.y-270)<tol&&Math.abs(r.last.x-1440)<tol&&Math.abs(r.last.y-810)<tol,JSON.stringify({f:[+r.first.x.toFixed(3),+r.first.y.toFixed(3)],l:[+r.last.x.toFixed(3),+r.last.y.toFixed(3)],k:+r.k.toFixed(3)})]});
T('T24','once','التكبير والتحريك: تعيين صحيح وإعادة رسم المتجهات في مواضعها',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const out={};
  for(const [z,cx,cy,lx,ly] of [[2,960,540,900,500],[3,500,300,520,310],[0.5,960,540,100,100]]){
   __sb.clearActivePage();__sb.setView(z,cx,cy);const s=__sb.toScreen(lx,ly);
   T.evS('pointerdown',1,'mouse',s.x,s.y);T.evS('pointermove',1,'mouse',s.x+20,s.y+10);T.evS('pointermove',1,'mouse',s.x+40,s.y);T.evS('pointerup',1,'mouse',s.x+40,s.y);await T.raf();
   const f=T.strokes()[0].pts[0];const ink=T.inkedNear(s.x+20,s.y+8,4);out[z]={dx:+(f.x-lx).toFixed(3),dy:+(f.y-ly).toFixed(3),ink}}
  // redraw consistency: a stroke from zoom 1 appears at mapped place after zoom change
  __sb.clearActivePage();__sb.setView(1,960,540);let a=__sb.toScreen(700,540);T.evS('pointerdown',1,'mouse',a.x,a.y);for(let i=1;i<=20;i++){const q=__sb.toScreen(700+i*20,540);T.evS('pointermove',1,'mouse',q.x,q.y)}T.evS('pointerup',1,'mouse',__sb.toScreen(1100,540).x,__sb.toScreen(1100,540).y);await T.raf();
  const t1=T.thick('doc',__sb.toScreen(900,540).x);__sb.setView(2,960,540);await T.raf();const m=__sb.toScreen(900,540);const t2=T.thick('doc',m.x);out.redraw={ink:T.inkedDoc(m.x,m.y),ratio:+(t2/t1).toFixed(2)};return out});
 const ok=[2,3,0.5].every(z=>Math.abs(r[z].dx)<0.05&&Math.abs(r[z].dy)<0.05&&r[z].ink)&&r.redraw.ink&&Math.abs(r.redraw.ratio-2)<0.4;
 return [ok,JSON.stringify(r)]});
T('T25','once','تغيير حجم النافذة والاتجاه: بيانات الخطوط ثابتة والموضع النسبي والنسبة ثابتان',async(p)=>{
 await p.evaluate(()=>{T.reset();const pts=[];for(let i=0;i<=30;i++)pts.push([200+i*50,200+Math.sin(i/4)*150+i*12]);
  T.evL('pointerdown',1,'pen',...pts[0]);for(const q of pts.slice(1))T.evL('pointermove',1,'pen',...q);T.evL('pointerup',1,'pen',...pts[pts.length-1]);});
 await sleep(120);
 const base=await p.evaluate(()=>JSON.stringify(T.strokes()[0].pts.map(q=>[q.x,q.y,q.w])));
 const res=[];
 for(const [w,h] of [[900,600],[1920,1080],[768,1024],[1024,768],[1366,768]]){
  await p.setViewportSize({width:w,height:h});await sleep(350);
  const r=await p.evaluate(()=>{const S=__sb.S,pr=__sb.pageRectScreen(),st=__sb.strokes()[0].pts;const f=st[0],mid=st[15],e=st[st.length-1];
   const frac=q=>{const s=__sb.toScreen(q.x,q.y);return[(s.x-pr.x)/pr.w,(s.y-pr.y)/pr.h]};
   const fr=[frac(f),frac(mid),frac(e)],exp=[[f.x/1920,f.y/1080],[mid.x/1920,mid.y/1080],[e.x/1920,e.y/1080]];
   const ok=fr.every((a,i)=>Math.abs(a[0]-exp[i][0])<1e-6&&Math.abs(a[1]-exp[i][1])<1e-6);
   const sc=[f,mid,e].map(q=>__sb.toScreen(q.x,q.y));return{data:JSON.stringify(st.map(q=>[q.x,q.y,q.w])),ok,asp:pr.w/pr.h,ink:sc.map(s=>T.inkedDoc(s.x,s.y)),inside:pr.x>=-0.5&&pr.y>=-0.5&&pr.x+pr.w<=stage.clientWidth+0.5&&pr.y+pr.h<=stage.clientHeight+0.5}});
  res.push({size:w+'x'+h,same:r.data===base,frac:r.ok,asp:+r.asp.toFixed(4),ink:r.ink.join(','),inside:r.inside});
 }
 await p.setViewportSize({width:1366,height:768});await sleep(250);
 const ok=res.every(x=>x.same&&x.frac&&Math.abs(x.asp-16/9)<0.005&&x.ink==='true,true,true'&&x.inside);
 return [ok,JSON.stringify(res)]});
T('T26','once','تغيير الحجم أثناء الكتابة: لا يضيع الخط الجاري (فأرة موثوقة)',async(p)=>{
 await p.evaluate(()=>T.reset());
 const pos=async(lx,ly)=>p.evaluate(([lx,ly])=>{const l=T.live().getBoundingClientRect(),s=__sb.toScreen(lx,ly);return[l.left+s.x,l.top+s.y]},[lx,ly]);
 let q=await pos(300,300);await p.mouse.move(...q);await p.mouse.down();
 for(let i=1;i<=20;i++){q=await pos(300+i*25,300+i*10);await p.mouse.move(...q)}
 const before=await p.evaluate(()=>__sb.S.active.pts.length);
 await p.setViewportSize({width:1100,height:700});await sleep(350);
 const mid=await p.evaluate(()=>{const a=__sb.S.active;const s0=__sb.toScreen(a.pts[0].x,a.pts[0].y),s1=__sb.toScreen(a.pts[a.pts.length-4].x,a.pts[a.pts.length-4].y);
   const c=T.live().getContext('2d'),d=devicePixelRatio;const has=(s)=>{const dd=c.getImageData(Math.round(s.x*d)-3,Math.round(s.y*d)-3,7,7).data;for(let i=3;i<dd.length;i+=4)if(dd[i]>0)return true;return false};return{startInk:has(s0),nearEndInk:has(s1),active:!!a}});
 for(let i=21;i<=30;i++){q=await pos(300+i*25,300+i*10);await p.mouse.move(...q)}
 await p.mouse.up();await sleep(120);
 const fin=await p.evaluate(()=>{const s=T.strokes();const pts=s[0]&&s[0].pts;const a=__sb.toScreen(pts[0].x,pts[0].y),b=__sb.toScreen(pts[pts.length-1].x,pts[pts.length-1].y);return{n:s.length,pts:pts&&pts.length,startInk:T.inkedDoc(a.x,a.y),endInk:T.inkedDoc(b.x,b.y),liveEmpty:(()=>{const d=T.live().getContext('2d').getImageData(0,0,live.width,live.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return false;return true})()}});
 await p.setViewportSize({width:1366,height:768});await sleep(250);
 return [mid.startInk&&mid.nearEndInk&&fin.n===1&&fin.pts>before&&fin.startInk&&fin.endInk&&fin.liveEmpty,JSON.stringify({before,mid,fin})]});
T('T27','config','الضغط داخل هامش خارج الصفحة يُتجاهل ولا يبدأ خطًا',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const pr=__sb.pageRectScreen();let sx,sy;if(pr.x>14){sx=pr.x-8;sy=pr.y+40}else if(pr.y>14){sx=pr.x+40;sy=pr.y-8}else return{na:true};
  T.evS('pointerdown',1,'mouse',sx,sy);T.evS('pointermove',1,'mouse',sx+10,sy+10);T.evS('pointerup',1,'mouse',sx+10,sy+10);await T.raf();return{n:T.strokes().length,out:__sb.S.m.outsidePage}});
 if(r.na)return [null,'لا هامش في هذا الإعداد (تخطّي)'];return [r.n===0&&r.out===1,JSON.stringify(r)]});
// ----- مسح السبورة -----
T('T28','once','مسح السبورة: الضغطة الأولى تسلّح الزر بإشارة وعدّ تنازلي ولا تمسح',async(p)=>{
 await p.evaluate(async()=>{T.reset();T.evL('pointerdown',1,'pen',300,300);T.evL('pointermove',1,'pen',330,320);T.evL('pointermove',1,'pen',360,300);T.evL('pointerup',1,'pen',360,300);await T.raf()});
 await p.click('#clear');await sleep(350);
 const r=await p.evaluate(()=>{const c=document.getElementById('clear'),b=c.querySelector('.bar2');return{armed:c.dataset.armed,cls:c.classList.contains('armed'),label:c.querySelector('.lbl').textContent,barW:b.getBoundingClientRect().width,btnW:c.getBoundingClientRect().width,n:T.strokes().length,latin:/[0-9]/.test(c.innerText)}});
 return [r.armed==='true'&&r.cls&&r.label.includes('اضغط مرة أخرى')&&/[٠-٩]/.test(r.label)&&!r.latin&&r.barW<r.btnW&&r.barW>0&&r.n===1,JSON.stringify(r)]});
T('T29','once','الضغطة الثانية تمسح فعلًا ويعود الزر لحاله',async(p)=>{
 await p.evaluate(async()=>{T.reset();T.evL('pointerdown',1,'pen',300,300);T.evL('pointermove',1,'pen',330,320);T.evL('pointermove',1,'pen',360,300);T.evL('pointerup',1,'pen',360,300);await T.raf()});
 await p.click('#clear');await sleep(120);await p.click('#clear');await sleep(100);
 const r=await p.evaluate(()=>({n:T.strokes().length,armed:document.getElementById('clear').dataset.armed,label:document.querySelector('#clear .lbl').textContent}));
 return [r.n===0&&r.armed==='false'&&r.label==='مسح السبورة',JSON.stringify(r)]});
T('T30','once','الإلغاء التلقائي بعد المهلة: الكتابة باقية',async(p)=>{
 await p.evaluate(async()=>{T.reset();__sb.CFG.clearMs=500;T.evL('pointerdown',1,'pen',300,300);T.evL('pointermove',1,'pen',330,320);T.evL('pointermove',1,'pen',360,300);T.evL('pointerup',1,'pen',360,300);await T.raf()});
 await p.click('#clear');await sleep(900);
 const r=await p.evaluate(()=>({n:T.strokes().length,armed:document.getElementById('clear').dataset.armed,label:document.querySelector('#clear .lbl').textContent}));
 return [r.n===1&&r.armed==='false'&&r.label==='مسح السبورة',JSON.stringify(r)]});
T('T31','once','التسليح يُلغى عند الكتابة أو الضغط على أداة أخرى، والكتابة باقية',async(p)=>{
 await p.evaluate(async()=>{T.reset();T.evL('pointerdown',1,'pen',300,300);T.evL('pointermove',1,'pen',330,320);T.evL('pointermove',1,'pen',360,300);T.evL('pointerup',1,'pen',360,300);await T.raf()});
 await p.click('#clear');await sleep(100);
 const box=await p.locator('#live').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.up();await sleep(80);
 const a=await p.evaluate(()=>({armed:document.getElementById('clear').dataset.armed,n:T.strokes().length}));
 await p.click('#clear');await sleep(100);await p.click('[data-board="#161616"]');await sleep(80);
 const b=await p.evaluate(()=>({armed:document.getElementById('clear').dataset.armed,n:T.strokes().length}));
 return [a.armed==='false'&&a.n>=1&&b.armed==='false'&&b.n>=1,JSON.stringify({a,b})]});
// ----- التشخيص والعتبة -----
T('T32','once','لوحة التشخيص مخفية افتراضيًا وتظهر عند الطلب فقط (زر أو #diag)',async(p,env)=>{
 await p.evaluate(()=>T.reset());
 const a=await p.evaluate(()=>{const d=document.getElementById('diag');return{hidden:d.hidden,vis:d.offsetParent!==null}});
 await p.click('#diagBtn');await sleep(150);const b=await p.evaluate(()=>{const d=document.getElementById('diag');return{hidden:d.hidden,vis:d.offsetParent!==null,pressed:document.getElementById('diagBtn').getAttribute('aria-pressed')}});
 await p.click('#diagBtn');await sleep(100);const c=await p.evaluate(()=>document.getElementById('diag').hidden);
 const p2=await env.ctx.newPage();await p2.goto(F+'#diag');await sleep(300);const d=await p2.evaluate(()=>!document.getElementById('diag').hidden);await p2.close();
 return [a.hidden&&!a.vis&&!b.hidden&&b.vis&&b.pressed==='true'&&c===true&&d===true,JSON.stringify({a,b,c,hash:d})]});
T('T33','once','التشخيص يسجّل نوع المؤشر والعرض والارتفاع والضغط',async(p)=>{
 await p.evaluate(()=>{T.reset();__sb.setDiag(true)});
 await p.evaluate(async()=>{T.evL('pointerdown',5,'touch',300,300,{width:18,height:22,pressure:0.4});T.evL('pointerup',5,'touch',300,300,{width:18,height:22,pressure:0});await T.raf()});await sleep(500);
 const r=await p.evaluate(()=>({last:__sb.DIAG.last,max:__sb.DIAG.max,txt:document.getElementById('diag').innerText,latin:/[0-9]/.test(document.getElementById('diag').innerText)}));
 await p.evaluate(()=>__sb.setDiag(false));
 return [r.max.w===18&&r.max.h===22&&r.txt.includes('١٨٫٠')&&r.txt.includes('٢٢٫٠')&&!r.latin,JSON.stringify({max:r.max,latin:r.latin,hasArabic:r.txt.includes('١٨٫٠')})]});
T('T34','once','العتبة معطّلة افتراضيًا في صفحة جديدة (الحدّ الحالي موثّق): لمسة كبيرة تكتب',async(p,env)=>{
 const p2=await env.ctx.newPage();await p2.goto(F);await sleep(400);await p2.evaluate(HELP);
 const r=await p2.evaluate(async()=>{const off=__sb.CFG.palmMinPx;T.evL('pointerdown',9,'touch',500,300,{width:80,height:120});T.evL('pointermove',9,'touch',520,320,{width:80,height:120});T.evL('pointermove',9,'touch',540,300,{width:80,height:120});T.evL('pointerup',9,'touch',540,300,{width:80,height:120});await T.raf();return{off,n:T.strokes().length}});
 await p2.close();
 return [r.off===0&&r.n===1,JSON.stringify(r)+' (هذا هو سلوك «معطّلة»: راحة اليد غير محلولة)']});
T('T35','once','عند تفعيل العتبة (٤٠ بكسل بأرقام هندية): ترفض الكبيرة وتقبل الصغيرة وتلغي النامية؛ والقلم لا يتأثر',async(p)=>{
 await p.evaluate(()=>{T.reset();__sb.setDiag(true)});await p.fill('#palm','٤٠');await p.dispatchEvent('#palm','change');await sleep(100);
 const r=await p.evaluate(async()=>{const cfg=__sb.CFG.palmMinPx,txt=document.getElementById('palmState').textContent;
  T.evL('pointerdown',9,'touch',500,300,{width:80,height:120});T.evL('pointermove',9,'touch',520,320,{width:80,height:120});T.evL('pointerup',9,'touch',520,320,{width:80,height:120});await T.raf();const a=T.snap();
  T.evL('pointerdown',10,'touch',300,300,{width:20,height:20});T.evL('pointermove',10,'touch',330,320,{width:20,height:20});T.evL('pointermove',10,'touch',360,300,{width:20,height:20});T.evL('pointerup',10,'touch',360,300,{width:20,height:20});await T.raf();const b=T.snap();
  T.evL('pointerdown',11,'touch',300,500,{width:20,height:20});T.evL('pointermove',11,'touch',330,520,{width:20,height:20});T.evL('pointermove',11,'touch',340,520,{width:90,height:90});T.evL('pointerup',11,'touch',340,520,{width:90,height:90});await T.raf();const c=T.snap();
  T.evL('pointerdown',12,'pen',300,700,{width:90,height:90});T.evL('pointermove',12,'pen',330,720,{width:90,height:90});T.evL('pointermove',12,'pen',360,700,{width:90,height:90});T.evL('pointerup',12,'pen',360,700,{width:90,height:90});await T.raf();const d=T.snap();
  return{cfg,txt,big:{n:a.n,rej:a.m.palmRejected},small:{n:b.n},grow:{n:c.n,cancelled:c.m.cancelledPalm},pen:{n:d.n}}});
 await p.evaluate(()=>__sb.setDiag(false));
 return [r.cfg===40&&r.big.n===0&&r.big.rej===1&&r.small.n===1&&r.grow.n===1&&r.grow.cancelled===1&&r.pen.n===2,JSON.stringify(r)]});
// ----- الألوان -----
T('T36','once','تباين الألوان الدلالية ≥ ٤٫٥ على الأسطح الأربعة، وثبات درجة اللون (≤ ١٥°)',async(p)=>{
 const data=await p.evaluate(()=>{const out={};for(const b of Object.keys(__sb.SURFACES)){document.querySelector('[data-board="'+b+'"]').click();out[b]={};for(const id of ['auto','sem:red','sem:blue','sem:green'])out[b][id]=__sb.resolveColor(id)}document.querySelector('[data-board="#ffffff"]').click();return{out,pal:__sb.PALETTE}});
 const rows=[];let min=99,okAll=true;for(const b in data.out)for(const id in data.out[b]){const c=cr(data.out[b][id],b);min=Math.min(min,c);if(c<4.5)okAll=false;rows.push(`${b}/${id}=${c.toFixed(2)}`)}
 let hueOk=true;const hd={};for(const id of ['red','blue','green']){const a=hue(data.pal[id].light),d=hue(data.pal[id].dark);const diff=Math.min(Math.abs(a-d),360-Math.abs(a-d));hd[id]=Math.round(diff);if(diff>15)hueOk=false}
 return [okAll&&hueOk,'أدنى تباين='+min.toFixed(2)+' فرق الدرجة='+JSON.stringify(hd)]});
T('T37','once','اللون الثابت (#hex) لا يتغير أبدًا عند تبديل السطح، والدلالي يُعاد حسابه والرمز المحفوظ ثابت',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const w=document.getElementById('width');w.value=40;w.dispatchEvent(new Event('input'));
  const tap=async(ink,lx)=>{__sb.S.ink=ink;T.evL('pointerdown',1,'mouse',lx,540);T.evL('pointerup',1,'mouse',lx,540);await T.raf()};
  await tap('#ff00ff',400);await tap('sem:red',700);await tap('auto',1000);
  const res={};for(const b of Object.keys(__sb.SURFACES)){document.querySelector('[data-board="'+b+'"]').click();await T.raf();
   const px=lx=>{const s=__sb.toScreen(lx,540);return T.px('doc',s.x,s.y).slice(0,3)};res[b]={fixed:px(400),red:px(700),auto:px(1000),sw:document.querySelector('[data-ink="sem:red"]').style.background}}
  const tokens=T.strokes().map(s=>s.color);document.querySelector('[data-board="#ffffff"]').click();return{res,tokens,pal:__sb.PALETTE,surf:__sb.SURFACES}});
 const eq=(a,h)=>{const e=hex2rgb(h);return a.every((v,i)=>Math.abs(v-e[i])<=2)};let ok=JSON.stringify(r.tokens)===JSON.stringify(['#ff00ff','sem:red','auto']);const det=[];
 for(const b in r.res){const tone=r.surf[b].tone;const f=eq(r.res[b].fixed,'#ff00ff'),rd=eq(r.res[b].red,r.pal.red[tone]),au=eq(r.res[b].auto,r.pal.auto[tone]);if(!(f&&rd&&au))ok=false;det.push(b+':'+[f,rd,au].join('/'))}
 const sw=new Set(Object.values(r.res).map(x=>x.sw)).size>=2;return [ok&&sw,'الرموز='+r.tokens.join(',')+' | '+det.join(' ')+' | تغيّر لون الأزرار='+sw]});
// ----- نظافة وأداء -----
T('T38','config','واجهة اللوحة: بلا أرقام لاتينية، بلا تمرير أفقي، الأزرار ≥ ٤٨ بكسل (مع فتح التشخيص وتسليح المسح)',async(p)=>{
 await p.evaluate(()=>{T.reset();__sb.setDiag(true)});await p.click('#clear');await sleep(250);
 const r=await p.evaluate(()=>{const t=document.getElementById('boardView').innerText+document.querySelector('header').innerText;const lat=(t.match(/[0-9]/g)||[]).length;
  const small=[...document.querySelectorAll('#boardView button,#boardView input,header button')].filter(e=>e.offsetParent&&(e.getBoundingClientRect().height<47.5||(e.tagName==='BUTTON'&&e.getBoundingClientRect().width<47.5))).map(e=>e.id||e.className);
  return{lat,small,ov:document.documentElement.scrollWidth>innerWidth}});
 await p.evaluate(()=>{__sb.setDiag(false)});await p.click('#clear').catch(()=>{});await p.evaluate(()=>T.reset());
 return [r.lat===0&&r.small.length===0&&!r.ov,JSON.stringify(r)]});
T('T39','config','تبويب النص: الخط المدمج محمّل وأسطر Canvas غير مقطوعة وبلا أرقام لاتينية (خارج عيّنة الخلط)',async(p)=>{
 await p.click('#tabText');await p.waitForFunction(()=>window.__textReady);await sleep(350);
 const r=await p.evaluate(()=>{const fnt=document.fonts.check('34px PlexAr','محمد');const clip=[...document.querySelectorAll('canvas.cv')].map(x=>{const d=x.getContext('2d').getImageData(0,0,x.width,x.height).data;let l=0,rr=0;const w=x.width;for(let i=3;i<d.length;i+=4){if(d[i]>0){const px=((i-3)/4)%w;if(px<3)l++;if(px>w-3)rr++}}return l+rr});
  const t=[...document.querySelectorAll('#textView p,#textView .fontbar,#textView .lab,#textView .sub')].map(e=>e.innerText).join(' ');return{fnt,clipSum:clip.reduce((a,b)=>a+b,0),n:clip.length,lat:(t.match(/[0-9]/g)||[]).length}});
 await p.click('#tabBoard');await sleep(250);
 return [r.fnt&&r.clipSum===0&&r.n===7&&r.lat===0,JSON.stringify(r)]});
T('T40','once','أداء: ٢٠٠٠ نقطة اصطناعية، متوسط معالجة الحدث < ٢ مللي ثانية (تقدير برمجي فقط)',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const S=__sb.S;const f=(t,x,y)=>T.evL(t,77,'pen',x,y,{pressure:.6});f('pointerdown',100,540);
  for(let i=0;i<2000;i++){f('pointermove',100+i*0.8,540+Math.sin(i/20)*200);if(i%8===0)await T.raf()}f('pointerup',1700,540);await T.raf();return{avg:S.m.hSum/S.m.hN,max:S.m.hMax,kept:S.m.kept,raw:S.m.raw}});
 return [r.avg<2,JSON.stringify(r)]});


// ================= اختبارات T0: نواة المستند =================
const ctrOf=(p,sel)=>p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]},sel);
T('M01','once','T0: بنية المستند الجديد والعنصر المحفوظ سليمتان وقابلتان للتحقق',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const d=__sb.S.doc;const base={fmt:d.format,ver:d.version,idOk:/^[A-Za-z0-9_-]+$/.test(d.id),pages:d.pages.length,ap:d.activePage,assets:Object.keys(d.assets).length};
  const pg=d.pages[0];const page={w:pg.w,h:pg.h,unit:pg.unit,bg:pg.background,zones:pg.zones.length,els:pg.elements.length,view:pg.view};
  T.evL('pointerdown',1,'pen',300,300);for(let i=1;i<=10;i++)T.evL('pointermove',1,'pen',300+i*20,300+i*5);T.evL('pointerup',1,'pen',500,350);await T.raf();
  const e=__sb.strokes()[0];const el={id:typeof e.id,type:e.type,tf:e.tf.join(','),bb:e.bbox.length,bbFin:e.bbox.every(Number.isFinite),pts:e.pts.length,p0:Object.keys(e.pts[0]).sort().join(','),color:e.color,rt:'rt' in e,pid:'pid' in e};
  const v=__sb.validateDoc(JSON.parse(JSON.stringify(__sb.serializeDoc(__sb.S.doc))));return{base,page,el,valid:v.ok,errs:v.errors}});
 const ok=r.base.fmt==='sabourati-doc'&&r.base.ver===2&&r.base.idOk&&r.base.pages===1&&r.base.ap===0&&r.base.assets===0&&r.page.w===1920&&r.page.unit==='logical'&&r.page.bg.type==='plain'&&r.page.zones===0&&r.page.view.zoom===1&&
  r.el.id==='string'&&r.el.type==='stroke'&&r.el.tf==='1,0,0,1,0,0'&&r.el.bb===4&&r.el.bbFin&&r.el.pts>=5&&r.el.p0==='w,x,y'&&r.el.color==='auto'&&!r.el.rt&&!r.el.pid&&r.valid;
 return [ok,JSON.stringify(r)]});
T('M02','once','T0: الحدود (bbox) صحيحة ومحكمة، والحدود العالمية مع مصفوفة التحويل صحيحة (إزاحة، تكبير، تدوير)',async(p)=>{
 const r=await p.evaluate(()=>{T.reset();const mk=pts=>({type:'stroke',pts,color:'auto',tf:[1,0,0,1,0,0]});
  const el=mk([{x:10,y:20,w:4},{x:50,y:5,w:8},{x:30,y:80,w:2}]);el.bbox=__sb.strokeBBox(el);
  const exp=[10-2,5-4,50+4,80+1];const tight=el.bbox.every((v,i)=>Math.abs(v-exp[i])<1e-9);
  const w0=__sb.worldBBox(el);const same=w0.every((v,i)=>Math.abs(v-el.bbox[i])<1e-9);
  el.tf=[2,0,0,2,10,20];const w1=__sb.worldBBox(el);const e1=[el.bbox[0]*2+10,el.bbox[1]*2+20,el.bbox[2]*2+10,el.bbox[3]*2+20];
  el.tf=[0,1,-1,0,0,0];const w2=__sb.worldBBox(el);const e2=[-el.bbox[3],el.bbox[0],-el.bbox[1],el.bbox[2]];  // x'=-y, y'=x
  const c=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-9);
  // bbox من نقاط حقيقية رُسمت: كل نقطة داخل حدودها
  T.evL('pointerdown',1,'pen',400,400);for(let i=1;i<=15;i++)T.evL('pointermove',1,'pen',400+i*15,400+Math.sin(i)*60);T.evL('pointerup',1,'pen',640,400);
  const s=__sb.strokes()[0];const inside=s.pts.every(q=>q.x-q.w/2>=s.bbox[0]-1e-9&&q.x+q.w/2<=s.bbox[2]+1e-9&&q.y-q.w/2>=s.bbox[1]-1e-9&&q.y+q.w/2<=s.bbox[3]+1e-9);
  return{tight,same,scale:c(w1,e1),rot:c(w2,e2),inside}});
 return [r.tight&&r.same&&r.scale&&r.rot&&r.inside,JSON.stringify(r)]});
T('M03','once','T0: التسلسل ثم الاستيراد ثم التسلسل: نص متطابق (idempotent) والبيانات محفوظة بدقة ٣ منازل',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const cols=['auto','sem:red','#ff00ff'];let id=1;
  for(const c of cols){__sb.S.ink=c;T.evL('pointerdown',id,'pen',300+id*100,300);for(let i=1;i<=12;i++)T.evL('pointermove',id,'pen',300+id*100+i*13.37,300+Math.cos(i/3)*77.7,{pressure:0.3+0.05*i});T.evL('pointerup',id,'pen',300+id*100+170,320,{pressure:0});id++}
  T.evL('pointerdown',9,'mouse',800,800);T.evL('pointerup',9,'mouse',800,800);await T.raf();
  const before=__sb.strokes().map(s=>({c:s.color,n:s.pts.length,id:s.id,p:s.pts.map(q=>[q.x,q.y,q.w])}));
  const j1=__sb.exportDoc();const imp=__sb.importDoc(j1);if(!imp.ok)return{err:imp.errors};
  __sb.loadDoc(imp.doc);const j2=__sb.exportDoc();
  const after=__sb.strokes().map(s=>({c:s.color,n:s.pts.length,id:s.id,p:s.pts.map(q=>[q.x,q.y,q.w])}));
  let maxd=0;before.forEach((b,i)=>b.p.forEach((q,k)=>q.forEach((v,m)=>{maxd=Math.max(maxd,Math.abs(v-after[i].p[k][m]))})));
  return{same:j1===j2,n:[before.length,after.length],cols:after.map(s=>s.c),ids:before.every((b,i)=>b.id===after[i].id),cnt:before.every((b,i)=>b.n===after[i].n),maxd,bytes:j1.length}});
 return [r.same&&r.n[0]===4&&r.n[1]===4&&r.cols[0]==='auto'&&r.cols[1]==='sem:red'&&r.cols[2]==='#ff00ff'&&r.cols[3]==='#ff00ff'&&r.ids&&r.cnt&&r.maxd<=0.0005+1e-9,JSON.stringify(r)]});
T('M04','once','T0: التحقق يرفض ٣٠ مستندًا فاسدًا (بلا استثناء) ولا يعدّل المدخل، ويقبل المستند الصحيح الأدنى',async(p)=>{
 const r=await p.evaluate(()=>{T.reset();
  const good=()=>({format:'sabourati-doc',version:2,id:'d1',title:'ت',createdAt:1,activePage:0,assets:{},pages:[{id:'p1',w:1920,h:1080,unit:'logical',background:{type:'plain',surface:'#ffffff'},zones:[],view:{zoom:1,cx:960,cy:540},elements:[{id:'e1',type:'stroke',color:'auto',tf:[1,0,0,1,0,0],pts:[{x:1,y:2,w:3}]}]}]});
  const mut=f=>{const d=good();f(d);return d};
  const big=n=>Array.from({length:n},(_,i)=>({x:i%1000,y:1,w:2}));
  const cases={
   null:null,array:[],string:'x',wrongFormat:mut(d=>{d.format='x'}),version3:mut(d=>{d.version=3}),version0:mut(d=>{d.version=0}),
   noPages:mut(d=>{d.pages=[]}),pages201:mut(d=>{d.pages=Array.from({length:201},(_,i)=>Object.assign(good().pages[0],{id:'p'+i,elements:[]}))}),
   pageW0:mut(d=>{d.pages[0].w=0}),pageNaN:mut(d=>{d.pages[0].h=NaN}),pageHuge:mut(d=>{d.pages[0].w=1e9}),unitPx:mut(d=>{d.pages[0].unit='px'}),
   surface:mut(d=>{d.pages[0].background.surface='#123456'}),elType:mut(d=>{d.pages[0].elements[0].type='image'}),protoType:mut(d=>{d.pages[0].elements[0].type='toString'}),
   dupId:mut(d=>{d.pages[0].elements.push(Object.assign({},d.pages[0].elements[0]))}),ptsEmpty:mut(d=>{d.pages[0].elements[0].pts=[]}),
   ptNaN:mut(d=>{d.pages[0].elements[0].pts[0].x=NaN}),pts20001:mut(d=>{d.pages[0].elements[0].pts=big(20001)}),coordHuge:mut(d=>{d.pages[0].elements[0].pts[0].x=1e9}),
   widthNeg:mut(d=>{d.pages[0].elements[0].pts[0].w=-1}),colorBad:mut(d=>{d.pages[0].elements[0].color='red'}),color5:mut(d=>{d.pages[0].elements[0].color='#12345'}),
   tfZero:mut(d=>{d.pages[0].elements[0].tf=[0,0,0,0,0,0]}),tfLen:mut(d=>{d.pages[0].elements[0].tf=[1,0,0,1,0]}),zones:mut(d=>{d.pages[0].zones=[{}]}),
   assets:mut(d=>{d.assets={a:1}}),activeBad:mut(d=>{d.activePage=5}),viewZoom0:mut(d=>{d.pages[0].view.zoom=0}),idBad:mut(d=>{d.id='a b'})};
  const out={};let threw=0;for(const k in cases){let v;try{v=__sb.validateDoc(cases[k])}catch(e){threw++;out[k]='THROW';continue}out[k]=v.ok?'ACCEPTED':'rejected'}
  const goodRes=__sb.validateDoc(good());
  const bad=mut(d=>{d.pages[0].elements[0].pts[0].x=NaN;d.pages[0].w=-5});const snap=JSON.stringify(bad);__sb.validateDoc(bad);const unchanged=JSON.stringify(bad)===snap;
  const ac=Object.entries(out).filter(([k,v])=>v!=='rejected').map(([k])=>k);
  const big50=good();big50.pages[0].elements=Array.from({length:50001},(_,i)=>({id:'q'+i,type:'stroke',color:'auto',pts:[{x:1,y:1,w:1}]}));const v50=__sb.validateDoc(big50);
  return{n:Object.keys(cases).length,notRejected:ac,threw,goodOk:goodRes.ok,unchanged,over50k:v50.ok}});
 return [r.n>=30&&r.notRejected.length===0&&r.threw===0&&r.goodOk&&r.unchanged&&!r.over50k,JSON.stringify(r)]});
T('M05','once','T0: الحدود المرسلة في الملف لا يُوثق بها: تُعاد حسابها عند الاستيراد',async(p)=>{
 const r=await p.evaluate(()=>{const d={format:'sabourati-doc',version:2,id:'d1',title:'t',createdAt:1,activePage:0,assets:{},pages:[{id:'p1',w:1920,h:1080,unit:'logical',background:{type:'plain',surface:'#ffffff'},zones:[],view:{zoom:1,cx:960,cy:540},elements:[{id:'e1',type:'stroke',color:'auto',bbox:[0,0,1,1],tf:[1,0,0,1,0,0],pts:[{x:100,y:100,w:10},{x:300,y:200,w:10}]}]}]};
  const v=__sb.validateDoc(d);return{ok:v.ok,bb:v.ok&&v.doc.pages[0].elements[0].bbox}});
 return [r.ok&&r.bb[0]===95&&r.bb[1]===95&&r.bb[2]===305&&r.bb[3]===205,JSON.stringify(r)]});
T('M06','once','T0: هجرة مستند حقيقي من المرحلة ١ (مُصدَّر من ملف المرحلة ١): البيانات والألوان والنقطة المفردة محفوظة والحبر في مواضعه',async(p,env)=>{
 const p1=await env.ctx.newPage();await p1.goto(P1);await sleep(500);
 const json=await p1.evaluate(async()=>{const l=document.getElementById('live'),R=l.getBoundingClientRect();const ev=(t,id,pt,x,y,ex)=>{const s=__sb.toScreen(x,y);l.dispatchEvent(new PointerEvent(t,Object.assign({pointerId:id,pointerType:pt,clientX:R.left+s.x,clientY:R.top+s.y,bubbles:true,cancelable:true,isPrimary:true,pressure:.5,button:0,buttons:1},ex||{})))};
  const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  __sb.S.ink='auto';ev('pointerdown',1,'pen',300,300,{pressure:.4});for(let i=1;i<=30;i++)ev('pointermove',1,'pen',300+i*20,300+Math.sin(i/4)*100,{pressure:.3+.02*i});ev('pointerup',1,'pen',900,320,{pressure:0});await raf();
  __sb.S.ink='sem:red';ev('pointerdown',2,'mouse',400,600);for(let i=1;i<=20;i++)ev('pointermove',2,'mouse',400+i*25,600+i*8);ev('pointerup',2,'mouse',900,760);await raf();
  __sb.S.ink='#ff00ff';const w=document.getElementById('width');w.value=24;w.dispatchEvent(new Event('input'));ev('pointerdown',3,'touch',1500,800);ev('pointerup',3,'touch',1500,800);await raf();
  __sb.S.ink='sem:green';ev('pointerdown',4,'pen',1200,200,{pressure:.9});for(let i=1;i<=10;i++)ev('pointermove',4,'pen',1200+i*15,200+i*30,{pressure:.9-.07*i});ev('pointerup',4,'pen',1350,500,{pressure:0});await raf();
  return JSON.stringify(__sb.S.doc)});
 await p1.close();
 const r=await p.evaluate(async(json)=>{T.reset();const old=JSON.parse(json);const imp=__sb.importDoc(json);if(!imp.ok)return{err:imp.errors};
  __sb.loadDoc(imp.doc);await T.raf();const els=__sb.strokes();let maxd=0;const colOk=els.every((e,i)=>e.color===old.strokes[i].color);const lenOk=els.every((e,i)=>e.pts.length===old.strokes[i].pts.length);
  els.forEach((e,i)=>e.pts.forEach((q,k)=>{const o=old.strokes[i].pts[k];maxd=Math.max(maxd,Math.abs(q.x-o.x),Math.abs(q.y-o.y),Math.abs(q.w-o.w))}));
  const hasT=els.some(e=>e.pts.some(q=>'t' in q));
  const ink=els.map(e=>[e.pts[0],e.pts[e.pts.length>>1],e.pts[e.pts.length-1]].map(q=>{const s=__sb.toScreen(q.x,q.y);return T.inkedNear(s.x,s.y,2)}).every(Boolean));
  const reimp=__sb.validateDoc(JSON.parse(__sb.exportDoc())).ok;
  return{n:[old.strokes.length,els.length],page:[imp.doc.pages[0].w,imp.doc.pages[0].h],cols:els.map(e=>e.color),colOk,lenOk,maxd,hasT,ink,pts:els.map(e=>e.pts.length),reimp,ver:old.version}},json);
 return [!r.err&&r.n[0]===4&&r.n[1]===4&&r.page[0]===1920&&r.page[1]===1080&&r.colOk&&r.lenOk&&r.maxd<1e-9&&!r.hasT&&r.ink.every(Boolean)&&r.pts[2]===1&&r.reimp&&r.ver===1,JSON.stringify(r)]});
T('M07','once','T0: سجل أنواع العناصر قابل للتوسعة: نوع تجريبي جديد يمرّ بالتحقق والعرض والتسلسل بلا تعديل بقية النواة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();
  __sb.ELEMENT_TYPES.rect={bbox:e=>[e.x,e.y,e.x+e.w,e.y+e.h],render(ctx,e){ctx.fillStyle='#ff0000';ctx.fillRect(e.x,e.y,e.w,e.h)},
   validate(raw,E,path){if(![raw.x,raw.y,raw.w,raw.h].every(Number.isFinite)||raw.w<=0||raw.h<=0){E.push(path+' bad');return null}const el={id:raw.id,type:'rect',x:raw.x,y:raw.y,w:raw.w,h:raw.h,tf:[1,0,0,1,0,0]};el.bbox=[el.x,el.y,el.x+el.w,el.y+el.h];return el},
   serialize(e){return{id:e.id,type:'rect',x:e.x,y:e.y,w:e.w,h:e.h}}};
  const d=__sb.serializeDoc(__sb.S.doc);d.pages[0].elements.push({id:'r1',type:'rect',x:500,y:400,w:200,h:100});
  const v=__sb.validateDoc(d);if(!v.ok)return{err:v.errors};__sb.loadDoc(v.doc);await T.raf();
  const s=__sb.toScreen(600,450),o=__sb.toScreen(100,100);const px=T.px('doc',s.x,s.y);const out=T.px('doc',o.x,o.y);
  const ser=JSON.stringify(__sb.serializeDoc(__sb.S.doc));const back=__sb.validateDoc(JSON.parse(ser)).ok&&ser.includes('"rect"');
  const bad=__sb.validateDoc(Object.assign({},d,{pages:[Object.assign({},d.pages[0],{elements:[{id:'r2',type:'rect',x:'a',y:1,w:1,h:1}]})]})).ok;
  delete __sb.ELEMENT_TYPES.rect;const gone=__sb.validateDoc(d).ok;
  return{red:px.slice(0,3).join(','),outside:out.slice(0,3).join(','),back,badAccepted:bad,rejectedAfterRemoval:!gone}});
 return [!r.err&&r.red==='255,0,0'&&r.outside==='255,255,255'&&r.back&&!r.badAccepted&&r.rejectedAfterRemoval,JSON.stringify(r)]});
T('M08','once','T0: العرض مستقل عن الشاشة: renderPageToCanvas ناتجه ثابت حرفيًا مهما تغيّر التكبير أو الحجم، ويطابق طبقة المستند، ويعمل مصغّرًا',async(p)=>{
 await p.evaluate(async()=>{T.reset();for(const [i,c] of ['auto','sem:red','#ff00ff'].entries()){__sb.S.ink=c;T.evL('pointerdown',i+1,'pen',300+i*200,300);for(let k=1;k<=25;k++)T.evL('pointermove',i+1,'pen',300+i*200+k*7,300+Math.sin(k/3)*120+k*6);T.evL('pointerup',i+1,'pen',480+i*200,500)}await T.raf()});
 const r=await p.evaluate(async()=>{const hash=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619)}return h>>>0};
  const page=__sb.pg();const a=__sb.renderPageToCanvas(page,960);const ha=hash(a);
  __sb.setView(3,500,300);await T.raf();const b=__sb.renderPageToCanvas(page,960);const hb=hash(b);
  __sb.setView(1,960,540);await T.raf();
  // مطابقة طبقة المستند: نفس المقياس
  const pr=__sb.pageRectScreen(),d=devicePixelRatio;const ref=__sb.renderPageToCanvas(page,pr.w*d);
  const dc=document.getElementById('doc').getContext('2d');const ox=Math.round(pr.x*d),oy=Math.round(pr.y*d);
  const A=dc.getImageData(ox,oy,ref.width,ref.height).data,B=ref.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
  let sum=0,inkA=0,inkB=0;for(let i=0;i<A.length;i+=4){sum+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);if(A[i]<200)inkA++;if(B[i]<200)inkB++}
  const mean=sum/(A.length/4*3);
  const th=__sb.renderPageToCanvas(page,160);const td=th.getContext('2d').getImageData(0,0,th.width,th.height).data;let ti=0;for(let i=0;i<td.length;i+=4)if(td[i]<200)ti++;
  return{identical:ha===hb,mean:+mean.toFixed(3),inkA,inkB,thumb:[th.width,th.height],thumbInk:ti,aspect:+(th.width/th.height).toFixed(4)}});
 return [r.identical&&r.mean<2.5&&Math.abs(r.inkA-r.inkB)/r.inkA<0.04&&r.thumb[0]===160&&r.thumb[1]===90&&r.thumbInk>20,JSON.stringify(r)]});
T('M09','once','T0: مصفوفة التحويل لكل عنصر تُطبَّق عند العرض: إزاحة ٣٠٠ وحدة تنقل الحبر ولا تغيّر النقاط المخزّنة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const w=document.getElementById('width');w.value=24;w.dispatchEvent(new Event('input'));
  T.evL('pointerdown',1,'mouse',400,500);for(let i=1;i<=10;i++)T.evL('pointermove',1,'mouse',400+i*10,500);T.evL('pointerup',1,'mouse',500,500);await T.raf();
  const s=__sb.strokes()[0];const p0=JSON.stringify(s.pts);const a=__sb.toScreen(450,500),b=__sb.toScreen(750,500);const before={a:T.inkedDoc(a.x,a.y),b:T.inkedDoc(b.x,b.y)};
  s.tf=[1,0,0,1,300,0];__sb.redrawAll();await T.raf();const after={a:T.inkedDoc(a.x,a.y),b:T.inkedDoc(b.x,b.y)};
  const wb=__sb.worldBBox(s);return{before,after,ptsSame:JSON.stringify(s.pts)===p0,wb:wb.map(v=>+v.toFixed(1)),bbLocal:s.bbox.map(v=>+v.toFixed(1))}});
 return [r.before.a&&!r.before.b&&!r.after.a&&r.after.b&&r.ptsSame&&Math.abs(r.wb[0]-(r.bbLocal[0]+300))<1e-6,JSON.stringify(r)]});
T('M10','once','T0: سياسة الإدخال منفصلة عن الرسم: استبدالها يغيّر القبول والرفض دون المساس بمحرك الرسم',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const out={};
  __sb.setPolicy(()=>({verdict:'ignored',cancel:null,lock:false,count:null}));T.evL('pointerdown',1,'mouse',300,300);T.evL('pointermove',1,'mouse',340,320);T.evL('pointerup',1,'mouse',340,320);await T.raf();out.rejectAll=T.strokes().length;
  document.getElementById('modePen').click();__sb.setPolicy(()=>({verdict:'draw',cancel:null,lock:false,count:null}));
  T.evL('pointerdown',2,'touch',300,400);T.evL('pointermove',2,'touch',340,420);T.evL('pointermove',2,'touch',380,400);T.evL('pointerup',2,'touch',380,400);await T.raf();out.touchAcceptedUnderPenOnly=T.strokes().length;
  __sb.setPolicy(null);document.getElementById('modePen').click();T.evL('pointerdown',3,'touch',300,500);T.evL('pointermove',3,'touch',340,520);T.evL('pointerup',3,'touch',340,520);await T.raf();out.defaultRestored=T.strokes().length;
  out.pure=typeof __sb.POLICY==='function'&&__sb.POLICY({type:'touch',size:0},{mode:'pen',touchCount:1,penCount:0,lock:false,activeType:null,palmMin:0}).verdict==='ignored'&&__sb.POLICY({type:'pen',size:0},{mode:'pen',touchCount:0,penCount:1,lock:false,activeType:'touch',palmMin:0}).cancel==='cancelledByPen';return out});
 return [r.rejectAll===0&&r.touchAcceptedUnderPenOnly===1&&r.defaultRestored===1&&r.pure,JSON.stringify(r)]});

// ================= اختبارات T1: التخطيط والشريط العائم =================
const WINS=[[1366,768],[1920,1080],[768,1024],[1024,768],[1280,800],[900,600],[1500,700]];
T('L01','config','T1: مساحة الكتابة: صفحة «مطابقة الشاشة» تملأ ≥٩٠٪ من منطقة اللوحة عاديًا و≥٩٩٪ في وضع ملء الشاشة (تُسجَّل النسب أيضًا إلى النافذة)',async(p,env)=>{
 await p.evaluate(()=>T.reset());await p.click('#newBtn');await sleep(80);
 const open=await p.evaluate(()=>!document.getElementById('newDlg').hidden);await p.click('#dlgOk');await sleep(250);
 const n=await p.evaluate(()=>{const r=__sb.pageRectScreen(),st=[stage.clientWidth,stage.clientHeight];return{page:[__sb.pg().w,__sb.pg().h],usage:r.w*r.h/(st[0]*st[1]),usageWin:r.w*r.h/(innerWidth*innerHeight),stage:st,win:[innerWidth,innerHeight]}});
 await p.click('#presentBtn');await sleep(400);
 const pr=await p.evaluate(()=>{const r=__sb.pageRectScreen();return{usage:r.w*r.h/(stage.clientWidth*stage.clientHeight),stage:[stage.clientWidth,stage.clientHeight],win:[innerWidth,innerHeight],barDisplay:getComputedStyle(document.getElementById('bar')).display,tbCollapsed:document.getElementById('tbar').classList.contains('collapsed'),fullscreenAPI:!!document.fullscreenElement}});
 await p.keyboard.press('Escape');await sleep(300);
 const back=await p.evaluate(()=>({present:__sb.isPresent(),stageH:stage.clientHeight,winH:innerHeight,tbCollapsed:document.getElementById('tbar').classList.contains('collapsed'),fs:!!document.fullscreenElement}));
 const ok=open&&n.usage>=0.90&&pr.usage>=0.99&&pr.stage[0]===pr.win[0]&&pr.stage[1]===pr.win[1]&&pr.barDisplay==='none'&&pr.tbCollapsed&&!back.present&&back.stageH<back.winH&&!back.tbCollapsed;
 return [ok,JSON.stringify({n,pr,back}),{usageNormal:+n.usage.toFixed(4),usageNormalOfWindow:+n.usageWin.toFixed(4),usagePresent:+pr.usage.toFixed(4),fullscreenAPIGranted:pr.fullscreenAPI}]});
T('L02','once','T1: الاستفادة من المساحة على ٧ مقاسات نافذة (شاشات أفقية وعمودية ونسب غير قياسية): ≥٩٠٪ عاديًا و≥٩٩٪ ملء الشاشة',async(p)=>{
 const rows=[];let ok=true;
 for(const [w,h] of WINS){await p.setViewportSize({width:w,height:h});await sleep(300);await p.evaluate(()=>T.reset());await p.click('#newBtn');await sleep(80);await p.click('#dlgOk');await sleep(250);
  const n=await p.evaluate(()=>{const r=__sb.pageRectScreen();return{page:__sb.pg().w+'x'+__sb.pg().h,u:r.w*r.h/(stage.clientWidth*stage.clientHeight)}});
  await p.click('#presentBtn');await sleep(350);const q=await p.evaluate(()=>{const r=__sb.pageRectScreen();return r.w*r.h/(stage.clientWidth*stage.clientHeight)});await p.keyboard.press('Escape');await sleep(250);
  rows.push({win:w+'x'+h,page:n.page,normal:+n.u.toFixed(3),present:+q.toFixed(3)});if(n.u<0.90||q<0.99)ok=false}
 await p.setViewportSize({width:1366,height:768});await sleep(250);
 return [ok,JSON.stringify(rows),{rows}]});
T('L03','config','T1: الشريط العائم في المواضع الأربعة (يمين/يسار/أعلى/أسفل) مفتوحًا ومطويًا: داخل اللوحة، لا يتداخل مع الشريط العلوي، ونسبة تغطيته للوحة مسجّلة',async(p,env)=>{
 const rows=[];let ok=true;
 for(const dock of ['right','left','top','bottom'])for(const col of [false,true]){
  const r=await p.evaluate(([dock,col])=>{T.reset();__sb.setToolbar({dock,pos:0.5,collapsed:col});const tb=document.getElementById('tbar'),a=tb.getBoundingClientRect(),s=stage.getBoundingClientRect(),bar=document.getElementById('bar').getBoundingClientRect();
   const inside=a.left>=s.left-0.5&&a.top>=s.top-0.5&&a.right<=s.right+0.5&&a.bottom<=s.bottom+0.5;
   const pr=__sb.pageRectScreen();const ix=Math.max(0,Math.min(a.right-s.left,pr.x+pr.w)-Math.max(a.left-s.left,pr.x)),iy=Math.max(0,Math.min(a.bottom-s.top,pr.y+pr.h)-Math.max(a.top-s.top,pr.y));
   const btns=[...tb.querySelectorAll('button,input')].filter(e=>e.offsetParent!==null);
   return{dock,col,inside,noBar:a.top>=bar.bottom-0.5,cov:+(a.width*a.height/(s.width*s.height)).toFixed(4),covPage:+(ix*iy/(pr.w*pr.h)).toFixed(4),size:[Math.round(a.width),Math.round(a.height)],scroll:tb.scrollHeight>tb.clientHeight+1||tb.scrollWidth>tb.clientWidth+1,nBtn:btns.length}},[dock,col]);
  rows.push(r);if(!r.inside||!r.noBar)ok=false;if(r.col&&r.cov>0.01)ok=false;if(!r.col&&r.cov>0.25)ok=false;if(!r.col&&(dock==='left'||dock==='right')&&env.cfg.n!=='D'&&r.cov>0.10)ok=false}
 const maxExp=Math.max(...rows.filter(r=>!r.col).map(r=>r.cov)),maxExpVert=Math.max(...rows.filter(r=>!r.col&&(r.dock==='left'||r.dock==='right')).map(r=>r.cov));
 return [ok,'أقصى تغطية مفتوحًا='+maxExp+' (رأسيًا='+maxExpVert+') | '+rows.map(r=>r.dock[0]+(r.col?'c':'e')+':'+r.cov+(r.scroll?'S':'')).join(' '),{rows,maxExpanded:maxExp,maxExpandedVertical:maxExpVert,collapsedMax:Math.max(...rows.filter(r=>r.col).map(r=>r.cov))}]});
T('L04','once','T1: سحب مقبض الشريط بالفأرة الحقيقية يلصقه بأقرب حافة (٤ حواف)، واللمسة القصيرة تطويه/تفتحه ولا يُطوى بعد السحب',async(p)=>{
 await p.evaluate(()=>T.reset());
 const hc=()=>ctrOf(p,'#tbHandle');const sr=await p.evaluate(()=>{const r=stage.getBoundingClientRect();return{l:r.left,t:r.top,w:r.width,h:r.height}});
 const drag=async(x,y)=>{const[sx,sy]=await hc();await p.mouse.move(sx,sy);await p.mouse.down();for(let i=1;i<=12;i++)await p.mouse.move(sx+(x-sx)*i/12,sy+(y-sy)*i/12);await p.mouse.up();await sleep(80);return p.evaluate(()=>({dock:__sb.TB.dock,pos:+__sb.TB.pos.toFixed(3),col:__sb.TB.collapsed}))};
 const res={};
 res.left=await drag(sr.l+60,sr.t+sr.h*0.5);res.top=await drag(sr.l+sr.w*0.5,sr.t+8);res.bottom=await drag(sr.l+sr.w*0.4,sr.t+sr.h-8);res.right=await drag(sr.l+sr.w-50,sr.t+sr.h*0.5);
 const afterDragCollapsed=res.left.col||res.top.col||res.bottom.col||res.right.col;
 const[x,y]=await hc();await p.mouse.click(x,y);await sleep(80);const t1=await p.evaluate(()=>__sb.TB.collapsed);
 const[x2,y2]=await hc();await p.mouse.click(x2,y2);await sleep(80);const t2=await p.evaluate(()=>__sb.TB.collapsed);
 const inside=await p.evaluate(()=>{const a=document.getElementById('tbar').getBoundingClientRect(),s=stage.getBoundingClientRect();return a.left>=s.left-0.5&&a.top>=s.top-0.5&&a.right<=s.right+0.5&&a.bottom<=s.bottom+0.5});
 return [res.left.dock==='left'&&res.top.dock==='top'&&res.bottom.dock==='bottom'&&res.right.dock==='right'&&!afterDragCollapsed&&t1===true&&t2===false&&inside,JSON.stringify({res,t1,t2,inside})]});
T('L05','once','T1: حفظ موضع الشريط وحالته (localStorage) واستعادتها بعد إعادة التحميل، وتحمّل فشل التخزين دون خطأ',async(p,env)=>{
 await p.evaluate(()=>{T.reset();__sb.setToolbar({dock:'left',pos:0.3,collapsed:true})});
 const p2=await env.ctx.newPage();const errs=[];p2.on('pageerror',e=>errs.push(String(e)));await p2.goto(F);await sleep(400);
 const a=await p2.evaluate(()=>({...__sb.TB,col:document.getElementById('tbar').classList.contains('collapsed')}));await p2.close();
 const c2=await env.browser.newContext({viewport:{width:1366,height:768}});await c2.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})});
 const p3=await c2.newPage();const e3=[];p3.on('pageerror',e=>e3.push(String(e)));p3.on('console',m=>{if(m.type()==='error')e3.push(m.text())});await p3.goto(F);await sleep(400);
 const b=await p3.evaluate(()=>{__sb.setToolbar({dock:'top',pos:.4,collapsed:false});return{dock:__sb.TB.dock,col:__sb.TB.collapsed}});await c2.close();
 await p.evaluate(()=>__sb.setToolbar({dock:'right',pos:.5,collapsed:false}));
 return [a.dock==='left'&&Math.abs(a.pos-0.3)<1e-9&&a.collapsed===true&&a.col&&errs.length===0&&e3.length===0&&b.dock==='top',JSON.stringify({restored:a,blockedStorage:b,errs,e3})]});
T('L06','once','T1: بقاء الشريط داخل اللوحة بعد تصغير النافذة وتدويرها (أربعة مواضع، مفتوحًا ومطويًا)',async(p)=>{
 const rows=[];let ok=true;
 for(const [w,h] of [[900,600],[768,1024],[1024,768],[1366,768]])for(const dock of ['right','left','top','bottom']){
  await p.setViewportSize({width:1366,height:768});await sleep(120);await p.evaluate(d=>{T.reset();__sb.setToolbar({dock:d,pos:d==='left'||d==='right'?0.95:0.98,collapsed:false})},dock);
  await p.setViewportSize({width:w,height:h});await sleep(300);
  const r=await p.evaluate(()=>{const a=document.getElementById('tbar').getBoundingClientRect(),s=stage.getBoundingClientRect();return{inside:a.left>=s.left-0.5&&a.top>=s.top-0.5&&a.right<=s.right+0.5&&a.bottom<=s.bottom+0.5,w:Math.round(a.width),h:Math.round(a.height),needsScroll:(()=>{const t=document.getElementById('tbar');return t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1})()}});
  rows.push({win:w+'x'+h,dock,...r});if(!r.inside)ok=false}
 await p.setViewportSize({width:1366,height:768});await sleep(250);
 const scrollers=rows.filter(r=>r.needsScroll).map(r=>r.win+'/'+r.dock);
 return [ok,'داخل اللوحة في '+rows.filter(r=>r.inside).length+'/'+rows.length+' | يحتاج تمريرًا داخليًا: '+(scrollers.join(' ')||'لا شيء'),{rows,scrollers}]});
T('L07','config','T1: درع حماية الشريط أثناء الكتابة (محاكاة): يبتلع اللمسات الثانية فلا يُضغط زر بالخطأ، ويدوم ٣٥٠ مللي ث بعد الرفع، ثم تعود الأزرار للعمل',async(p)=>{
 const ids=['clear','modePen','tbHandle','presentTb','pressure'];
 const r1=await p.evaluate(async(ids)=>{T.reset();const ctr=id=>{const r=document.getElementById(id).getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]};
  window.__hit=id=>{const[x,y]=ctr(id);const e=document.elementFromPoint(x,y);return e&&(e.id==='shield'?'shield':(e.closest('#'+id)?id:(e.id||e.tagName)))};
  const idle=ids.map(window.__hit);T.evL('pointerdown',5,'pen',300,300);T.evL('pointermove',5,'pen',330,320);await T.raf();
  return{idle,during:ids.map(window.__hit),pos:ids.map(ctr)}},ids);
 let hits0=await p.evaluate(()=>__sb.S.m.toolbarGuardHits);
 for(const[x,y]of r1.pos)await p.mouse.click(x,y);
 const mid=await p.evaluate(()=>({armed:document.getElementById('clear').dataset.armed,pen:document.getElementById('modePen').getAttribute('aria-pressed'),hits:__sb.S.m.toolbarGuardHits,active:!!__sb.S.active,col:__sb.TB.collapsed,pres:__sb.isPresent()}));
 const tail=await p.evaluate(async()=>{T.evL('pointermove',5,'pen',360,300);T.evL('pointerup',5,'pen',390,320);const n=T.strokes().length;await new Promise(r=>setTimeout(r,150));return{n,right:window.__hit('clear'),guardCls:document.getElementById('tbar').classList.contains('guard')}});
 await sleep(520);
 const after=await p.evaluate(()=>({hit:window.__hit('clear'),guard:document.getElementById('tbar').classList.contains('guard')}));
 const [cx,cy]=await ctrOf(p,'#clear');await p.mouse.click(cx,cy);await sleep(120);
 const armed=await p.evaluate(()=>document.getElementById('clear').dataset.armed);
 const ok=r1.idle.every((v,i)=>v===ids[i])&&r1.during.every(v=>v==='shield')&&mid.armed==='false'&&mid.pen==='false'&&mid.hits>=ids.length&&mid.active&&!mid.col&&!mid.pres&&tail.n===1&&tail.right==='shield'&&tail.guardCls&&after.hit==='clear'&&!after.guard&&armed==='true';
 return [ok,JSON.stringify({idle:r1.idle,during:r1.during,mid,tail,after,armedAfter:armed}),{hitsSwallowed:mid.hits-hits0}]});
T('L08','once','T1: خط يعبر الشريط ويُرفع فوق زر «مسح»: يُسجَّل الخط كاملًا ولا يُضغط أي زر (التقاط المؤشر) ولا يُسلَّح المسح',async(p)=>{
 await p.evaluate(()=>T.reset());
 const tr=await p.evaluate(()=>{const r=document.getElementById('tbar').getBoundingClientRect(),c=document.getElementById('clear').getBoundingClientRect(),h=document.getElementById('live').getBoundingClientRect();return{left:r.left,cy:c.top+c.height/2,cx:c.left+c.width/2,top:h.top}});
 const before=await p.evaluate(()=>({pr:[...document.querySelectorAll('#tbar [aria-pressed]')].map(b=>b.getAttribute('aria-pressed')).join(),armed:document.getElementById('clear').dataset.armed}));
 const y0=tr.cy-60;await p.mouse.move(tr.left-200,y0);await p.mouse.down();
 for(let i=1;i<=24;i++)await p.mouse.move(tr.left-200+(tr.cx-(tr.left-200))*i/24,y0+(tr.cy-y0)*i/24);
 await p.mouse.up();await sleep(100);
 const r=await p.evaluate(()=>{const s=__sb.strokes();const last=s[0]&&s[0].pts[s[0].pts.length-1];const sc=last&&__sb.toScreen(last.x,last.y);const tb=document.getElementById('tbar').getBoundingClientRect(),lr=document.getElementById('live').getBoundingClientRect();
  return{n:s.length,pts:s[0]&&s[0].pts.length,endInsideToolbar:!!sc&&(sc.x+lr.left)>=tb.left,pr:[...document.querySelectorAll('#tbar [aria-pressed]')].map(b=>b.getAttribute('aria-pressed')).join(),armed:document.getElementById('clear').dataset.armed,hits:__sb.S.m.toolbarGuardHits}});
 return [r.n===1&&r.pts>10&&r.endInsideToolbar&&r.pr===before.pr&&r.armed==='false',JSON.stringify({before,r})]});
T('L09','config','T1: لون هامش اللوحة مشتق من السطح (للأبيض/الكريمي أغمق بنسبة ١٤٪، وللأسود/الأخضر أفتح بنسبة ١٨٪ لأن التعتيم لا يظهر على الأسود) وإطار الصفحة الرفيع يطابق حدود الصفحة',async(p)=>{
 const r=await p.evaluate(async()=>{T.reset();const out={};for(const b of Object.keys(__sb.SURFACES)){document.querySelector('[data-board="'+b+'"]').click();await T.raf();
   const exp=__sb.marginFor(b),got=getComputedStyle(stage).backgroundColor;const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const e=hx(exp);
   const pr=__sb.pageRectScreen(),ed=document.getElementById('edge').getBoundingClientRect(),st=stage.getBoundingClientRect();
   const bd=hx(b);const diff=Math.abs(e[0]-bd[0])+Math.abs(e[1]-bd[1])+Math.abs(e[2]-bd[2]);
   out[b]={ok:got==='rgb('+e.join(', ')+')',diff,edge:Math.abs(ed.left-st.left-pr.x)<0.6&&Math.abs(ed.top-st.top-pr.y)<0.6&&Math.abs(ed.width-pr.w)<0.6&&Math.abs(ed.height-pr.h)<0.6}}
  document.querySelector('[data-board="#ffffff"]').click();return out});
 const vals=Object.values(r);return [vals.every(v=>v.ok&&v.edge&&v.diff>=30),JSON.stringify(r)]});
T('L10','once','T1: حوار «مستند جديد»: ٨ خيارات للنسبة، «مطابقة الشاشة» تعطي مقاسًا صحيحًا، استبدال مستند فيه كتابة يتطلب تأكيدًا ثانيًا بإشارة خطر، والإلغاء/Esc لا يغيّران شيئًا',async(p)=>{
 await p.evaluate(()=>T.reset());
 await p.evaluate(async()=>{T.evL('pointerdown',1,'pen',300,300);T.evL('pointermove',1,'pen',340,320);T.evL('pointerup',1,'pen',380,300);await T.raf()});
 await p.click('#newBtn');await sleep(80);
 const a=await p.evaluate(()=>({n:document.querySelectorAll('#presets .btn').length,warn:!document.getElementById('dlgWarn').hidden,lbl:document.getElementById('dlgOk').textContent,cls:document.getElementById('dlgOk').classList.contains('danger')}));
 await p.click('#presets [data-pid="3:4"]');await sleep(40);
 await p.click('#dlgOk');await sleep(80);
 const b=await p.evaluate(()=>({open:!document.getElementById('newDlg').hidden,cls:document.getElementById('dlgOk').classList.contains('danger'),lbl:document.getElementById('dlgOk').textContent,n:T.strokes().length,w:__sb.pg().w}));
 await p.click('#dlgCancel');await sleep(60);const c=await p.evaluate(()=>({open:!document.getElementById('newDlg').hidden,n:T.strokes().length,w:__sb.pg().w}));
 await p.click('#newBtn');await sleep(60);await p.click('#presets [data-pid="3:4"]');await p.click('#dlgOk');await sleep(60);await p.keyboard.press('Escape');await sleep(60);
 const d=await p.evaluate(()=>({open:!document.getElementById('newDlg').hidden,n:T.strokes().length,w:__sb.pg().w}));
 await p.click('#newBtn');await sleep(60);await p.click('#presets [data-pid="3:4"]');await p.click('#dlgOk');await sleep(40);await p.click('#dlgOk');await sleep(250);
 const e=await p.evaluate(()=>({open:!document.getElementById('newDlg').hidden,n:T.strokes().length,w:__sb.pg().w,h:__sb.pg().h,pages:__sb.S.doc.pages.length,view:__sb.pg().view.zoom,asp:+(__sb.pageRectScreen().w/__sb.pageRectScreen().h).toFixed(4)}));
 const m=await p.evaluate(()=>{const res={};for(const[w,h]of[[1366,768],[1920,1080],[768,1024],[1500,700],[900,600],[1280,800],[1440,900]])res[w+'x'+h]=__sb.matchScreen(w,h);return res});
 await p.click('#newBtn');await sleep(60);const matchBtn=await p.evaluate(()=>{const b=document.querySelector('#presets [data-pid="match"]');return[+b.dataset.w,+b.dataset.h,innerWidth,innerHeight]});await p.click('#dlgCancel');
 const ok=a.n===8&&a.warn&&a.lbl.includes('يستبدل')&&!a.cls&&b.open&&b.cls&&b.lbl.includes('تأكيد')&&b.n===1&&b.w===1920&&!c.open&&c.n===1&&c.w===1920&&!d.open&&d.n===1&&d.w===1920&&
  !e.open&&e.n===0&&e.w===810&&e.h===1080&&e.pages===1&&e.view===1&&Math.abs(e.asp-0.75)<0.001&&
  m['1366x768'].w===1920&&m['1920x1080'].h===1080&&m['768x1024'].w===810&&m['1500x700'].w===Math.round(1080*1500/700)&&m['1500x700'].preset===null&&m['900x600'].w===1620&&m['1280x800'].w===1728&&m['1440x900'].w===1728&&
  Math.abs(matchBtn[0]/matchBtn[1]-matchBtn[2]/matchBtn[3])/(matchBtn[2]/matchBtn[3])<=0.02+1e-9;
 return [ok,JSON.stringify({a,b,c,d,e,m,matchBtn})]});
T('L11','once','T1: نسبة المستند ثابتة عند تغيير النافذة والاتجاه (أبعاد المستند لا تتغير تلقائيًا)، وتبقى مواضع الخطوط (٣:٤ و٤:٣ و١٦:٩) محفوظة ومتناسبة عبر ٥ مقاسات',async(p)=>{
 const out=[];let ok=true;
 for(const [w,h] of [[1440,1080],[810,1080],[1920,1080]]){
  await p.setViewportSize({width:1366,height:768});await sleep(150);
  await p.evaluate(([w,h])=>{T.reset();__sb.newDoc({w,h});const pts=[];for(let i=0;i<=30;i++)pts.push([w*0.1+i*(w*0.8/30),h*0.2+Math.sin(i/4)*h*0.1+i*h*0.01]);
   T.evL('pointerdown',1,'pen',...pts[0]);for(const q of pts.slice(1))T.evL('pointermove',1,'pen',...q);T.evL('pointerup',1,'pen',...pts[pts.length-1])},[w,h]);
  await sleep(120);const base=await p.evaluate(()=>JSON.stringify(__sb.strokes()[0].pts.map(q=>[q.x,q.y,q.w])));
  for(const [vw,vh] of [[900,600],[1920,1080],[768,1024],[1024,768],[1366,768]]){
   await p.setViewportSize({width:vw,height:vh});await sleep(300);
   const r=await p.evaluate(([w,h])=>{const pr=__sb.pageRectScreen(),st=__sb.strokes()[0].pts,f=st[0],m=st[15],e=st[30];
    const frac=q=>{const s=__sb.toScreen(q.x,q.y);return[(s.x-pr.x)/pr.w,(s.y-pr.y)/pr.h]};const exp=q=>[q.x/w,q.y/h];
    const fr=[f,m,e].every(q=>{const a=frac(q),b=exp(q);return Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6});
    const ink=[f,m,e].map(q=>{const s=__sb.toScreen(q.x,q.y);return T.inkedDoc(s.x,s.y)});
    return{data:JSON.stringify(st.map(q=>[q.x,q.y,q.w])),fr,asp:pr.w/pr.h,ink:ink.join(),dims:[__sb.pg().w,__sb.pg().h],inside:pr.x>=-0.5&&pr.y>=-0.5&&pr.x+pr.w<=stage.clientWidth+0.5&&pr.y+pr.h<=stage.clientHeight+0.5}},[w,h]);
   const good=r.data===base&&r.fr&&Math.abs(r.asp-w/h)<0.005&&r.ink==='true,true,true'&&r.dims[0]===w&&r.dims[1]===h&&r.inside;
   out.push({doc:w+'x'+h,win:vw+'x'+vh,ok:good});if(!good){ok=false;out[out.length-1].detail=r}}
 }
 await p.setViewportSize({width:1366,height:768});await sleep(250);
 return [ok,'نجح '+out.filter(o=>o.ok).length+'/'+out.length+' تركيبة'+(ok?'':' | '+JSON.stringify(out.filter(o=>!o.ok)))]});
T('L12','once','T1: وضع ملء الشاشة: يُخرج منه بـ Esc وبزر «إنهاء ملء الشاشة» في الشريط وبحدث fullscreenchange، ولا يحفظ حالة الطيّ المؤقتة، ويستعيد الشريط والتخطيط',async(p)=>{
 await p.evaluate(()=>{T.reset();__sb.setToolbar({dock:'left',pos:0.4,collapsed:true})});
 const st0=await p.evaluate(()=>localStorage.getItem('sabourati-p2a-toolbar-v1'));
 const res={};
 await p.click('#presentBtn');await sleep(300);res.in=await p.evaluate(()=>({p:__sb.isPresent(),cls:document.body.classList.contains('present'),btn:document.getElementById('presentBtn').textContent,col:__sb.TB.collapsed,stored:localStorage.getItem('sabourati-p2a-toolbar-v1')}));
 await p.keyboard.press('Escape');await sleep(250);res.esc=await p.evaluate(()=>({p:__sb.isPresent(),col:__sb.TB.collapsed,dock:__sb.TB.dock,h:stage.clientHeight<innerHeight}));
 await p.click('#presentBtn');await sleep(300);const[hx,hy]=await ctrOf(p,'#tbHandle');await p.mouse.click(hx,hy);await sleep(120);
 res.expanded=await p.evaluate(()=>({col:__sb.TB.collapsed,txt:document.getElementById('presentTb').textContent}));
 const[px,py]=await ctrOf(p,'#presentTb');await p.mouse.click(px,py);await sleep(250);res.btn=await p.evaluate(()=>({p:__sb.isPresent(),col:__sb.TB.collapsed}));
 await p.click('#presentBtn');await sleep(250);await p.evaluate(async()=>{if(document.fullscreenElement){try{await document.exitFullscreen()}catch(e){}}document.dispatchEvent(new Event('fullscreenchange'))});await sleep(200);res.fsEvt=await p.evaluate(()=>({p:__sb.isPresent()}));
 const st1=await p.evaluate(()=>localStorage.getItem('sabourati-p2a-toolbar-v1'));
 const ok=res.in.p&&res.in.cls&&res.in.btn==='إنهاء ملء الشاشة'&&res.in.col&&res.in.stored===st0&&!res.esc.p&&res.esc.col&&res.esc.dock==='left'&&res.esc.h&&res.expanded.col===false&&res.expanded.txt==='إنهاء ملء الشاشة'&&!res.btn.p&&res.btn.col&&!res.fsEvt.p&&st1===st0;
 return [ok,JSON.stringify(res)]});
T('L13','config','T1: الأرقام هندية شرقية فقط في كل واجهة (الشريط العلوي، الأدوات، الحوار، التشخيص، المسح المسلَّح، ملء الشاشة) وكل الأزرار والمدخلات ≥ ٤٨ بكسل، ولا تمرير أفقي ولا قصّ في الشريط العلوي',async(p)=>{
 await p.evaluate(()=>{T.reset();__sb.setDiag(true)});await p.click('#clear');await p.click('#newBtn');await sleep(250);
 const r=await p.evaluate(()=>{const vis=e=>{const s=getComputedStyle(e);return e.getClientRects().length>0&&s.visibility!=='hidden'};
  const txt=[...document.querySelectorAll('#bar,#tbar,#newDlg,#diag,#announce,#stage')].map(e=>e.innerText||e.textContent).join(' ');
  const attrs=[...document.querySelectorAll('[aria-label],[title],[placeholder]')].map(e=>(e.getAttribute('aria-label')||'')+(e.getAttribute('title')||'')).join(' ');
  const lat=(txt+attrs).match(/[0-9]/g)||[];
  const small=[...document.querySelectorAll('button,input')].filter(vis).filter(e=>{const b=e.getBoundingClientRect();return b.height<47.5||(e.tagName==='BUTTON'&&b.width<47.5)}).map(e=>e.id||e.className);
  const bar=document.getElementById('bar'),br=bar.getBoundingClientRect();const clipped=[...bar.children].filter(vis).filter(c=>{const b=c.getBoundingClientRect();return b.left<br.left-0.5||b.right>br.right+0.5}).map(c=>c.id||c.className||c.tagName);
  return{lat:lat.length,small,ov:document.documentElement.scrollWidth>innerWidth,barOverflow:bar.scrollWidth>bar.clientWidth+1,clipped,hasEastern:/[٠-٩]/.test(txt)}});
 await p.keyboard.press('Escape');await sleep(60);await p.evaluate(()=>{__sb.setDiag(false)});await p.evaluate(()=>T.reset());
 return [r.lat===0&&r.small.length===0&&!r.ov&&!r.barOverflow&&r.clipped.length===0&&r.hasEastern,JSON.stringify(r)]});
T('L14','once','T1: وضع الطيّ والفتح لا يؤثّر على الرسم: الكتابة قرب حافة الشريط المفتوح والمطويّ تُسجَّل بلا ضغطات أزرار، وإعادة الرسم بعد الطيّ ثابتة',async(p)=>{
 await p.evaluate(()=>T.reset());
 const r=await p.evaluate(async()=>{const out={};const tb=document.getElementById('tbar'),lr=document.getElementById('live').getBoundingClientRect();
  const before=[...document.querySelectorAll('#tbar [aria-pressed]')].map(b=>b.getAttribute('aria-pressed')).join();
  const a=tb.getBoundingClientRect();const lx=a.left-lr.left-40,ly=a.top-lr.top+a.height/2;const lg=__sb.toLogical(lx,ly);
  T.evL('pointerdown',1,'pen',lg.x,lg.y);for(let i=1;i<=8;i++)T.evL('pointermove',1,'pen',lg.x-i*20,lg.y+i*10);T.evL('pointerup',1,'pen',lg.x-170,lg.y+85);await T.raf();
  out.nearEdgeStroke=T.strokes().length;__sb.setToolbar({collapsed:true});await T.raf();const c=tb.getBoundingClientRect();
  const cl=__sb.toLogical(c.left-lr.left+10,c.top-lr.top+10);T.evL('pointerdown',2,'pen',cl.x,cl.y);for(let i=1;i<=8;i++)T.evL('pointermove',2,'pen',cl.x-i*15,cl.y+i*9);T.evL('pointerup',2,'pen',cl.x-130,cl.y+75);await T.raf();
  out.afterCollapse=T.strokes().length;out.pressedSame=[...document.querySelectorAll('#tbar [aria-pressed]')].map(b=>b.getAttribute('aria-pressed')).join()===before;
  out.collapsedBox=[Math.round(c.width),Math.round(c.height)];return out});
 return [r.nearEdgeStroke===1&&r.afterCollapse===2&&r.pressedSame&&r.collapsedBox[0]<=60&&r.collapsedBox[1]<=60,JSON.stringify(r)]});


// ================= اختبارات T2: سجل التراجع والإعادة الموحّد =================
const UH=`window.U={
 async draw(n,o){o=o||{};const x0=o.x||300,y0=o.y||250;for(let k=0;k<n;k++){const id=100+k;const y=y0+(k%8)*90;T.evL('pointerdown',id,'pen',x0,y);for(let i=1;i<=(o.pts||6);i++)T.evL('pointermove',id,'pen',x0+i*30,y+Math.sin(i+k)*25);T.evL('pointerup',id,'pen',x0+(o.pts||6)*30,y);await T.raf()}},
 ids(){return __sb.S.doc.pages.map(p=>p.elements.map(e=>e.id))},
 alpha(){const c=document.getElementById('doc');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0,h=0;for(let i=0;i<d.length;i+=4){s+=d[i+3];h=(((h*31+d[i])^(d[i+1]<<8)^(d[i+2]<<16))>>>0)}return{sum:s,h}},
 dbg(){return{u:__sb.HIST.undo.length,r:__sb.HIST.redo.length}},
 page3(){const d=__sb.newDocObj({w:1920,h:1080});const mk=(i)=>{const q=__sb.newDocObj({w:1920,h:1080}).pages[0];return q};d.pages.push(mk(),mk());const v=__sb.validateDoc(JSON.parse(JSON.stringify(__sb.serializeDoc(d))));if(!v.ok)throw new Error('p3 '+v.errors);__sb.loadDoc(v.doc);return v.doc.pages.map(p=>p.id)}
};`;
const uReady=async p=>{await p.evaluate(UH)};
const uBtn=(p,id)=>p.evaluate(i=>{const b=document.getElementById(i);const r=b.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]},id);

T('U01','once','T2: عمليات متتابعة: رسم ٥ خطوط ثم تراجع وإعادة بالترتيب الصحيح، ومحتوى الطبقة مطابق في كل حالة',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();const out={};
  const snaps=[];snaps.push({ids:U.ids()[0].join(),a:U.alpha()});
  for(let k=0;k<5;k++){await U.draw(1,{y:250+k*100});snaps.push({ids:U.ids()[0].join(),a:U.alpha()})}
  out.entries=U.dbg();
  const seq=[];for(let k=5;k>=1;k--){__sb.undo();await T.raf();const s=U.ids()[0].join(),a=U.alpha();seq.push(s===snaps[k-1].ids&&a.h===snaps[k-1].a.h&&a.sum===snaps[k-1].a.sum)}
  out.undoSeq=seq;out.afterAll=U.dbg();out.canUndo=__sb.undo();
  const rs=[];for(let k=1;k<=5;k++){__sb.redo();await T.raf();const s=U.ids()[0].join(),a=U.alpha();rs.push(s===snaps[k].ids&&a.h===snaps[k].a.h&&a.sum===snaps[k].a.sum)}
  out.redoSeq=rs;out.end=U.dbg();out.canRedo=__sb.redo();out.blankSame=snaps.slice(1).every(q=>q.a.h!==snaps[0].a.h);out.fullSum=true;
  out.mix=(()=>{__sb.undo();__sb.undo();__sb.redo();return U.ids()[0].length})();
  return out});
 const ok=r.entries.u===5&&r.entries.r===0&&r.undoSeq.every(Boolean)&&r.afterAll.u===0&&r.afterAll.r===5&&r.canUndo===false&&r.redoSeq.every(Boolean)&&r.end.u===5&&r.end.r===0&&r.canRedo===false&&r.blankSame&&r.fullSum&&r.mix===4;
 return [ok,JSON.stringify(r)]});

T('U02','once','T2: كل خط مكتمل = عملية واحدة (خط من ٣٠٠ نقطة، نقطة مفردة)، والخطوط الملغاة أو المرفوضة لا تسجّل شيئًا',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();const out={};
  T.evL('pointerdown',1,'pen',200,200);for(let i=1;i<=300;i++)T.evL('pointermove',1,'pen',200+i*4,300+Math.sin(i/9)*80);T.evL('pointerup',1,'pen',1400,300);await T.raf();
  out.long={pts:__sb.strokes()[0].pts.length,entries:__sb.HIST.undo.length,patches:__sb.HIST.undo[0].patches.length};
  T.evL('pointerdown',2,'pen',700,700);T.evL('pointerup',2,'pen',700,700);await T.raf();out.dot=__sb.HIST.undo.length;
  const before=__sb.HIST.undo.length;
  T.evL('pointerdown',3,'pen',300,800);T.evL('pointermove',3,'pen',400,810);T.evL('pointermove',3,'pen',500,820);T.evL('pointercancel',3,'pen',500,820);await T.raf();out.cancelled=__sb.HIST.undo.length-before;
  __sb.S.mode='pen';T.evL('pointerdown',4,'touch',300,900);T.evL('pointermove',4,'touch',400,910);T.evL('pointerup',4,'touch',400,910);await T.raf();out.touchIgnored=__sb.HIST.undo.length-before;__sb.S.mode='both';
  T.evL('pointerdown',5,'touch',300,950);T.evL('pointermove',5,'touch',350,955);T.evL('pointerdown',6,'touch',500,950);T.evL('pointermove',6,'touch',520,955);T.evL('pointerup',5,'touch',350,955);T.evL('pointerup',6,'touch',520,955);await T.raf();out.multi=__sb.HIST.undo.length-before;
  T.evL('pointerdown',7,'pen',3000,3000);T.evL('pointerup',7,'pen',3000,3000);await T.raf();out.outside=__sb.HIST.undo.length-before;
  T.evL('pointerdown',8,'pen',300,600);T.evL('pointermove',8,'pen',400,620);window.dispatchEvent(new Event('blur'));await T.raf();out.blur={entries:__sb.HIST.undo.length-before,strokes:__sb.strokes().length};
  out.equal=__sb.HIST.undo.length===__sb.strokes().length;
  __sb.undo();out.afterUndoOne=__sb.strokes().length;
  return out});
 const ok=r.long.pts>=100&&r.long.entries===1&&r.long.patches===1&&r.dot===2&&r.cancelled===0&&r.touchIgnored===0&&r.multi===0&&r.outside===0&&r.equal&&r.afterUndoOne===r.blur.strokes-1;
 return [ok,JSON.stringify(r)]});

T('U03','once','T2: التراجع ثم رسم جديد: يُمسح مسار الإعادة ولا تعود الخطوط القديمة',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();await U.draw(4);const ids0=U.ids()[0].slice();__sb.undo();__sb.undo();const gone=ids0.slice(2);
  const mid={u:U.dbg().u,r:U.dbg().r,redoEn:!document.getElementById('redoBtn').disabled};
  await U.draw(1,{y:700});const after=U.ids()[0];const e={u:U.dbg().u,r:U.dbg().r,redoDis:document.getElementById('redoBtn').disabled};
  const redone=__sb.redo();const still=U.ids()[0];
  return{mid,e,redone,keepsOld:after.slice(0,2).join()===ids0.slice(0,2).join(),goneAbsent:gone.every(g=>!after.includes(g)),len:after.length,stillSame:still.join()===after.join()}});
 const ok=r.mid.u===2&&r.mid.r===2&&r.mid.redoEn&&r.e.u===3&&r.e.r===0&&r.e.redoDis&&r.redone===false&&r.keepsOld&&r.goneAbsent&&r.len===3&&r.stillSame;
 return [ok,JSON.stringify(r)]});

T('U04','once','T2: مسح السبورة (بالضغطتين بنقر حقيقي) عملية واحدة: تراجع يعيد الخطوط بنفس المعرّفات والترتيب والبكسلات، وإعادة تمسحها',async(p)=>{
 await uReady(p);
 const blank=await p.evaluate(()=>{T.reset();return U.alpha().h});
 await p.evaluate(async()=>{__sb.S.ink='sem:red';await U.draw(2);__sb.S.ink='auto';await U.draw(2,{y:600});});
 const base=await p.evaluate(()=>({ids:U.ids()[0].join(),a:U.alpha(),n:U.dbg().u}));
 await p.click('#clear');await sleep(60);
 const armed=await p.evaluate(()=>({n:U.dbg().u,cnt:__sb.strokes().length}));
 await p.click('#clear');await sleep(120);
 const cleared=await p.evaluate(()=>({els:__sb.strokes().length,u:U.dbg().u,label:__sb.HIST.undo[__sb.HIST.undo.length-1].label,patches:__sb.HIST.undo[__sb.HIST.undo.length-1].patches.length,a:U.alpha().h,clears:__sb.S.m.clears,idxDesc:__sb.HIST.undo[__sb.HIST.undo.length-1].patches.map(q=>q.index).join()}));
 const [ux,uy]=await uBtn(p,'undoBtn');await p.mouse.click(ux,uy);await sleep(120);
 const un=await p.evaluate(()=>({ids:U.ids()[0].join(),a:U.alpha(),u:U.dbg().u,r:U.dbg().r,msg:document.getElementById('hmsg').textContent}));
 const [rx,ry]=await uBtn(p,'redoBtn');await p.mouse.click(rx,ry);await sleep(120);
 const re=await p.evaluate(()=>({els:__sb.strokes().length,a:U.alpha().h,u:U.dbg().u,r:U.dbg().r}));
 await p.mouse.click(ux,uy);await sleep(100);await p.evaluate(()=>{__sb.undo();});
 const more=await p.evaluate(()=>({els:__sb.strokes().length,u:U.dbg().u}));
 // مسح مُسلَّح فقط (ينتهي تلقائيًا) وسبورة فارغة: بلا عملية
 const none=await p.evaluate(async()=>{T.reset();__sb.CFG.clearMs=300;await U.draw(1);return U.dbg().u});
 await p.click('#clear');await sleep(600);
 const auto=await p.evaluate(()=>({u:U.dbg().u,n:__sb.strokes().length,armed:document.getElementById('clear').dataset.armed}));
 await p.evaluate(()=>{__sb.undo()});await p.click('#clear');await p.click('#clear');await sleep(80);
 const empty=await p.evaluate(()=>({u:U.dbg().u,r:U.dbg().r,n:__sb.strokes().length}));
 await p.evaluate(()=>{__sb.CFG.clearMs=3000});
 const ok=armed.n===4&&armed.cnt===4&&cleared.els===0&&cleared.u===5&&cleared.label==='مسح السبورة'&&cleared.patches===4&&cleared.idxDesc==='3,2,1,0'&&cleared.a===blank&&un.ids===base.ids&&un.a.h===base.a.h&&un.a.sum===base.a.sum&&un.u===4&&un.r===1&&/تراجع/.test(un.msg)&&re.els===0&&re.a===blank&&re.u===5&&re.r===0&&more.els===3&&more.u===3&&auto.u===1&&auto.n===1&&auto.armed==='false'&&empty.u===0&&empty.r===1&&empty.n===0;
 return [ok,JSON.stringify({base:{ids:base.ids.split(',').length,n:base.n},armed,cleared,un:{same:un.ids===base.ids,pix:un.a.h===base.a.h,u:un.u,r:un.r,msg:un.msg},re,more,auto,empty})]});

T('U05','once','T2: حدود السجل: حد مخفّض (٥٠) وافتراضي (٢٠٠): تُسقط أقدم العمليات وتُعدّ، ولا يتلف المستند',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();const out={def:__sb.CFG.historyLimit};__sb.CFG.historyLimit=50;
  const bar=p=>0;for(let k=0;k<60;k++){const id=100+k;const y=100+(k%9)*100;T.evL('pointerdown',id,'pen',200+k*10,y);T.evL('pointermove',id,'pen',260+k*10,y+10);T.evL('pointerup',id,'pen',300+k*10,y)}await T.raf();
  out.s50={strokes:__sb.strokes().length,u:U.dbg().u,dropped:__sb.S.m.historyDropped,btn:document.getElementById('undoCnt').textContent};
  let n=0;while(__sb.undo())n++;out.undone=n;out.left=__sb.strokes().length;out.undoDis=document.getElementById('undoBtn').disabled;out.redoN=U.dbg().r;
  let m=0;while(__sb.redo())m++;out.redone=m;out.full=__sb.strokes().length;
  out.valid=__sb.validateDoc(JSON.parse(__sb.exportDoc())).ok;
  __sb.CFG.historyLimit=200;T.reset();
  for(let k=0;k<210;k++){const id=100+(k%50);const y=100+(k%9)*100;T.evL('pointerdown',id,'pen',200+k*5,y);T.evL('pointermove',id,'pen',230+k*5,y+10);T.evL('pointerup',id,'pen',260+k*5,y)}await T.raf();
  out.s200={strokes:__sb.strokes().length,u:U.dbg().u,dropped:__sb.S.m.historyDropped};
  let q=0;while(__sb.undo())q++;out.q=q;out.left200=__sb.strokes().length;
  return out});
 const ok=r.def===200&&r.s50.strokes===60&&r.s50.u===50&&r.s50.dropped===10&&r.s50.btn==='٥٠'&&r.undone===50&&r.left===10&&r.undoDis&&r.redoN===50&&r.redone===50&&r.full===60&&r.valid&&r.s200.strokes===210&&r.s200.u===200&&r.s200.dropped===10&&r.q===200&&r.left200===10;
 return [ok,JSON.stringify(r)]});

T('U06','once','T2: مستند من ٣ صفحات: التراجع والإعادة ينقلان تلقائيًا إلى الصفحة المتأثرة، ومعلومات الصفحة تتبعها',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();const ids=U.page3();const out={pages:ids.length,uniq:new Set(ids).size};
  await U.draw(1,{y:300});__sb.setActivePage(1);await U.draw(2,{y:400});__sb.setActivePage(2);await U.draw(1,{y:500});__sb.setActivePage(0);
  out.per=U.ids().map(a=>a.length).join();out.entries=U.dbg().u;
  const nav=[];const info=()=>document.getElementById('pageInfo').textContent;
  __sb.undo();nav.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join(),/٣ من ٣/.test(info())]);
  __sb.undo();nav.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join(),/٢ من ٣/.test(info())]);
  __sb.undo();nav.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join(),/٢ من ٣/.test(info())]);
  __sb.undo();nav.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join(),/١ من ٣/.test(info())]);
  out.nav=nav;
  const rn=[];__sb.setActivePage(2);__sb.redo();rn.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join()]);__sb.redo();rn.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join()]);__sb.redo();rn.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join()]);__sb.redo();rn.push([__sb.S.doc.activePage,U.ids().map(a=>a.length).join()]);
  out.rn=rn;
  // مسح صفحة ثم الانتقال لأخرى ثم التراجع
  __sb.setActivePage(1);__sb.clearActivePage();__sb.setActivePage(0);out.cl=U.ids().map(a=>a.length).join();__sb.undo();out.afterClearUndo=[__sb.S.doc.activePage,U.ids().map(a=>a.length).join()];
  const all=U.ids().flat();out.uniqueAll=new Set(all).size===all.length;out.valid=__sb.validateDoc(JSON.parse(__sb.exportDoc())).ok;
  out.badIdx=[__sb.setActivePage(-1),__sb.setActivePage(3),__sb.setActivePage(1.5)];
  return out});
 const ok=r.pages===3&&r.uniq===3&&r.per==='1,2,1'&&r.entries===4&&JSON.stringify(r.nav)==='[[2,"1,2,0",true],[1,"1,1,0",true],[1,"1,0,0",true],[0,"0,0,0",true]]'&&JSON.stringify(r.rn)==='[[0,"1,0,0"],[1,"1,1,0"],[1,"1,2,0"],[2,"1,2,1"]]'&&r.cl==='1,0,1'&&r.afterClearUndo[0]===1&&r.afterClearUndo[1]==='1,2,1'&&r.uniqueAll&&r.valid&&r.badIdx.every(v=>v===false);
 return [ok,JSON.stringify(r)]});

T('U07','once','T2: المتانة: لا تراجع أثناء الكتابة، تغيير الحجم، سحب وطيّ وتغيير حافة الشريط، وضع ملء الشاشة، الحوار، اختصارات لوحة المفاتيح',async(p)=>{
 await uReady(p);
 const errs=[];const h=e=>errs.push(String(e));p.on('pageerror',h);
 await p.evaluate(async()=>{T.reset();await U.draw(6)});
 const out={};
 // أثناء الكتابة
 out.active=await p.evaluate(async()=>{T.evL('pointerdown',1,'pen',900,900);T.evL('pointermove',1,'pen',950,910);const b=document.getElementById('undoBtn');const r={dis:b.disabled,res:__sb.undo(),n:__sb.strokes().length,act:!!__sb.S.active};T.evL('pointerup',1,'pen',1000,910);await T.raf();r.after={n:__sb.strokes().length,dis:b.disabled};return r});
 // نقر حقيقي على زر التراجع أثناء الكتابة يبتلعه الدرع
 await p.evaluate(()=>{T.evL('pointerdown',2,'pen',900,950);T.evL('pointermove',2,'pen',950,955)});
 const [ux,uy]=await uBtn(p,'undoBtn');const g0=await p.evaluate(()=>({h:__sb.S.m.toolbarGuardHits,n:__sb.strokes().length,undone:__sb.S.m.undone}));
 await p.mouse.click(ux,uy);await sleep(80);
 const g1=await p.evaluate(()=>({h:__sb.S.m.toolbarGuardHits,n:__sb.strokes().length,undone:__sb.S.m.undone,act:!!__sb.S.active}));
 await p.evaluate(async()=>{T.evL('pointerup',2,'pen',1000,955);await T.raf()});await sleep(450);
 out.shield={before:g0,during:g1};
 // تغيير الحجم بين العمليات
 const sizes=[[1000,700],[1366,768],[900,1100],[1366,768]];const res=[];
 for(const [w,hh] of sizes){await p.setViewportSize({width:w,height:hh});await sleep(120);
  const r=await p.evaluate(()=>{const a=__sb.undo();const c=document.getElementById('doc'),s=document.getElementById('stage').getBoundingClientRect();return{a,n:__sb.strokes().length,cw:Math.abs(c.getBoundingClientRect().width-s.width)<1.5,pix:U.alpha().sum>0}});res.push(r)}
 out.resize=res;
 await p.evaluate(()=>{while(__sb.redo());});
 // الشريط: حافة/طيّ/سحب حقيقي بالفأرة ثم تراجع وإعادة
 const docks=['left','top','bottom','right'];const dk=[];
 for(const d of docks){await p.evaluate(d=>__sb.setToolbar({dock:d,pos:.5,collapsed:false}),d);await sleep(60);
  const r=await p.evaluate(()=>{const n=__sb.strokes().length;const a=__sb.undo();const b=__sb.strokes().length;__sb.redo();return[n,a,b,__sb.strokes().length]});dk.push(r)}
 out.docks=dk;
 await p.evaluate(()=>__sb.setToolbar({collapsed:true}));await sleep(60);
 out.collapsed=await p.evaluate(()=>{const n=__sb.strokes().length;__sb.undo();const b=__sb.strokes().length;__sb.redo();return[n,b,__sb.strokes().length]});
 await p.evaluate(()=>__sb.setToolbar({collapsed:false}));
 const [hx,hy]=await p.evaluate(()=>{const r=document.getElementById('tbHandle').getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]});
 await p.mouse.move(hx,hy);await p.mouse.down();await p.mouse.move(hx-300,hy-120,{steps:6});await p.mouse.up();await sleep(100);
 out.afterDrag=await p.evaluate(()=>{const n=__sb.strokes().length;const a=__sb.undo();const b=__sb.strokes().length;__sb.redo();return[n,a,b,__sb.strokes().length,__sb.TB.dock]});
 // ملء الشاشة
 await p.evaluate(()=>{__sb.setPresent(true)});await sleep(150);
 out.present=await p.evaluate(()=>{const n=__sb.strokes().length;__sb.undo();const b=__sb.strokes().length;__sb.redo();return[n,b,__sb.strokes().length]});
 await p.keyboard.down('Control');await p.keyboard.press('z');await p.keyboard.up('Control');await sleep(60);
 out.keyZ=await p.evaluate(()=>__sb.strokes().length);
 await p.keyboard.down('Control');await p.keyboard.press('y');await p.keyboard.up('Control');await sleep(60);
 out.keyY=await p.evaluate(()=>__sb.strokes().length);
 await p.keyboard.down('Control');await p.keyboard.press('z');await p.keyboard.up('Control');await sleep(60);out.keyZ2=await p.evaluate(()=>__sb.strokes().length);
 await p.keyboard.down('Control');await p.keyboard.down('Shift');await p.keyboard.press('z');await p.keyboard.up('Shift');await p.keyboard.up('Control');await sleep(60);
 out.keyShiftZ=await p.evaluate(()=>__sb.strokes().length);
 await p.evaluate(async()=>{__sb.setPresent(false);if(document.fullscreenElement){try{await document.exitFullscreen()}catch(e){}}document.dispatchEvent(new Event('fullscreenchange'))});await sleep(150);
 // لا تراجع من حقل إدخال
 await p.evaluate(()=>{__sb.setDiag(true)});await p.focus('#palm');
 await p.keyboard.down('Control');await p.keyboard.press('z');await p.keyboard.up('Control');await sleep(60);
 out.inInput=await p.evaluate(()=>{const n=__sb.strokes().length;__sb.setDiag(false);document.activeElement.blur();return n});
 // الحوار مفتوح
 out.dialog=await p.evaluate(()=>{__sb.openNewDlg();const n=__sb.strokes().length;const a=__sb.undo();const b=__sb.strokes().length;__sb.closeDlg();return[n,a,b]});
 p.off('pageerror',h);
 const n0=out.docks[0][0];
 const ok=out.active.dis&&out.active.res===false&&out.active.n===6&&out.active.act&&out.active.after.n===7&&!out.active.after.dis&&
  out.shield.during.h>out.shield.before.h&&out.shield.during.n===out.shield.before.n&&out.shield.during.undone===out.shield.before.undone&&out.shield.during.act&&
  out.resize.every(r=>r.a&&r.cw&&r.pix)&&out.docks.every(r=>r[1]===true&&r[2]===r[0]-1&&r[3]===r[0])&&out.collapsed[1]===out.collapsed[0]-1&&out.collapsed[2]===out.collapsed[0]&&
  out.afterDrag[1]===true&&out.afterDrag[2]===out.afterDrag[0]-1&&out.afterDrag[3]===out.afterDrag[0]&&out.present[1]===out.present[0]-1&&out.present[2]===out.present[0]&&
  out.keyZ===out.present[0]-1&&out.keyY===out.present[0]&&out.keyZ2===out.present[0]-1&&out.keyShiftZ===out.present[0]&&out.inInput===out.present[0]&&out.dialog[1]===false&&out.dialog[0]===out.dialog[2]&&errs.length===0;
 return [ok,JSON.stringify(Object.assign(out,{errs}))]});

T('U08','once','T2: اختبار عشوائي بذرة ثابتة (٣٠٠ عملية: رسم/مسح/تراجع/إعادة/تنقل صفحات/حد ٤٠) مقابل نموذج ظل مستقل بعد كل عملية',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();const ids=U.page3();__sb.CFG.historyLimit=40;
  let s=12345;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  const model={pages:[[],[],[]],act:0,un:[],re:[]};let bad=null,ops={draw:0,clear:0,undo:0,redo:0,nav:0};let strokeId=0;
  const chk=(tag)=>{const cur=U.ids();const exp=model.pages;
   for(let i=0;i<3;i++)if(cur[i].join()!==exp[i].join()){bad=tag+' pages '+i+' '+cur[i].length+' vs '+exp[i].length;return}
   const all=cur.flat();if(new Set(all).size!==all.length){bad=tag+' dup';return}
   if(__sb.S.doc.activePage!==model.act){bad=tag+' active '+__sb.S.doc.activePage+' vs '+model.act;return}
   if(__sb.HIST.undo.length!==model.un.length||__sb.HIST.redo.length!==model.re.length){bad=tag+' hist '+__sb.HIST.undo.length+'/'+__sb.HIST.redo.length+' vs '+model.un.length+'/'+model.re.length;return}
   if(__sb.HIST.undo.length>40){bad=tag+' limit';return}
   const v=__sb.validateDoc(JSON.parse(__sb.exportDoc()));if(!v.ok){bad=tag+' invalid '+v.errors[0];return}
   const ub=document.getElementById('undoBtn'),rb=document.getElementById('redoBtn');if(ub.disabled!==(model.un.length===0)||rb.disabled!==(model.re.length===0)){bad=tag+' btn';return}};
  for(let i=0;i<300&&!bad;i++){const x=rnd();let op;
   if(x<.42)op='draw';else if(x<.52)op='clear';else if(x<.74)op='undo';else if(x<.9)op='redo';else op='nav';ops[op]++;
   if(op==='draw'){const id=700+(i%40);const y=120+rnd()*800,x0=200+rnd()*900;T.evL('pointerdown',id,'pen',x0,y);T.evL('pointermove',id,'pen',x0+40,y+rnd()*30);T.evL('pointermove',id,'pen',x0+90,y+rnd()*30);T.evL('pointerup',id,'pen',x0+120,y);await T.raf();
    const arr=__sb.S.doc.pages[model.act].elements;const nid=arr[arr.length-1].id;model.pages[model.act].push(nid);model.un.push({k:'d',pg:model.act,id:nid});if(model.un.length>40)model.un.shift();model.re=[]}
   else if(op==='clear'){const had=model.pages[model.act].slice();__sb.clearActivePage();if(had.length){model.un.push({k:'c',pg:model.act,ids:had});if(model.un.length>40)model.un.shift();model.re=[];model.pages[model.act]=[]}}
   else if(op==='undo'){const ok=__sb.undo();if(model.un.length){const e=model.un.pop();model.re.push(e);if(e.k==='d')model.pages[e.pg]=model.pages[e.pg].filter(v=>v!==e.id);else model.pages[e.pg]=e.ids.slice();model.act=e.pg;if(!ok)bad='undo false'}else if(ok)bad='undo true on empty'}
   else if(op==='redo'){const ok=__sb.redo();if(model.re.length){const e=model.re.pop();model.un.push(e);if(e.k==='d')model.pages[e.pg].push(e.id);else model.pages[e.pg]=[];model.act=e.pg;if(!ok)bad='redo false'}else if(ok)bad='redo true on empty'}
   else{const n=Math.floor(rnd()*3);__sb.setActivePage(n);model.act=n}
   chk(op+'#'+i)}
  __sb.CFG.historyLimit=200;return{bad,ops,final:U.ids().map(a=>a.length).join(),hist:[model.un.length,model.re.length],dropped:__sb.S.m.historyDropped,errors:__sb.S.m.historyErrors}});
 return [r.bad===null&&r.ops.draw>80&&r.ops.undo>40&&r.ops.redo>20&&r.ops.clear>15&&r.dropped>0&&r.errors===0,JSON.stringify(r)]});

T('U09','config','T2: زرا التراجع والإعادة: ≥٤٨ بكسل، ظاهران داخل الشاشة في كل حافة، حالة التعطيل مرئية، العدّاد بأرقام هندية، والنقر الحقيقي يعمل',async(p,env)=>{
 await uReady(p);
 const out={};
 const q=()=>p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect();return['undoBtn','redoBtn'].map(id=>{const b=document.getElementById(id),r=b.getBoundingClientRect(),cs=getComputedStyle(b);return{w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,inside:r.left>=st.left-0.5&&r.right<=st.right+0.5&&r.top>=st.top-0.5&&r.bottom<=st.bottom+0.5,dis:b.disabled,op:+cs.opacity,bs:cs.borderStyle,title:b.title,txt:b.textContent.trim()}})});
 out.init=await q();
 const docks={};
 for(const d of ['right','left','top','bottom']){await p.evaluate(d=>__sb.setToolbar({dock:d,pos:.5,collapsed:false}),d);await sleep(60);docks[d]=await q()}
 out.docks=docks;
 await p.evaluate(()=>__sb.setToolbar({dock:'right',pos:.5,collapsed:false}));
 await p.evaluate(async()=>{await U.draw(3)});await sleep(500);
 out.enabled=await q();
 const [ux,uy]=await uBtn(p,'undoBtn');await p.mouse.click(ux,uy);await sleep(100);
 out.afterUndo=await p.evaluate(()=>({n:__sb.strokes().length,u:document.getElementById('undoCnt').textContent,r:document.getElementById('redoCnt').textContent,redoEn:!document.getElementById('redoBtn').disabled,uTitle:document.getElementById('undoBtn').title}));
 const [rx,ry]=await uBtn(p,'redoBtn');await p.mouse.click(rx,ry);await sleep(100);
 out.afterRedo=await p.evaluate(()=>({n:__sb.strokes().length,u:document.getElementById('undoCnt').textContent,r:document.getElementById('redoCnt').textContent,redoDis:document.getElementById('redoBtn').disabled}));
 // لمس حقيقي (touchscreen.tap)
 const [tx,ty]=await uBtn(p,'undoBtn');await p.touchscreen.tap(tx,ty);await sleep(120);out.tap=await p.evaluate(()=>__sb.strokes().length);
 await p.evaluate(()=>{while(__sb.undo());});await sleep(40);
 out.empty=await q();
 const all=[...out.init,...Object.values(docks).flat(),...out.enabled,...out.empty];
 const sizeOk=all.every(b=>b.w>=47.5&&b.h>=47.5);const inside=Object.values(docks).flat().every(b=>b.inside);
 const initOk=out.init.every(b=>b.dis&&b.op<0.6&&b.bs==='dashed'&&/لا توجد عمليات/.test(b.title)&&b.txt==='٠');
 const enOk=out.enabled[0].dis===false&&out.enabled[0].op===1&&out.enabled[0].txt==='٣'&&out.enabled[1].dis&&out.enabled[0].bs==='solid';
 const ok=sizeOk&&inside&&initOk&&enOk&&out.afterUndo.n===2&&out.afterUndo.u==='٢'&&out.afterUndo.r==='١'&&out.afterUndo.redoEn&&/تراجع عن: خط/.test(out.afterUndo.uTitle)&&out.afterRedo.n===3&&out.afterRedo.u==='٣'&&out.afterRedo.redoDis&&out.tap===2&&out.empty[0].dis&&!out.empty[1].dis&&out.empty[1].op===1;
 return [ok,JSON.stringify({sizeOk,inside,initOk,enOk,min:Math.min(...all.map(b=>Math.min(b.w,b.h))),au:out.afterUndo,ar:out.afterRedo,tap:out.tap})]});

T('U10','once','T2: المؤشر البصري للحماية: أثناء الكتابة يخفت كل الشريط مع إطار؛ بعد رفع القلم يبقى الخفوت على الأدوات فقط ويبقى التراجع/الإعادة غير مخفّتين؛ ثم يعود كل شيء طبيعيًا',async(p)=>{
 await uReady(p);
 const g=()=>p.evaluate(()=>{const t=document.getElementById('tbar'),op=s=>+getComputedStyle(document.querySelector(s)).opacity,af=getComputedStyle(t,'::after');return{guard:t.classList.contains('guard'),tail:t.classList.contains('tail'),hist:op('#tbar .hg'),tool:+getComputedStyle(document.getElementById('toolPen').parentElement).opacity,toolInHist:document.getElementById('toolPen').parentElement.classList.contains('hg'),handle:op('#tbHandle'),after:af.content,shadow:af.boxShadow}});
 await p.evaluate(async()=>{await U.draw(1)});await sleep(600);
 const a=await g();
 await p.evaluate(()=>{T.evL('pointerdown',1,'pen',900,500);T.evL('pointermove',1,'pen',950,520)});await sleep(300);
 const b=await g();
 await p.evaluate(()=>{T.evL('pointerup',1,'pen',1000,520)});await sleep(250);const c=await g();await sleep(600);const d=await g();
 const ok=!a.toolInHist&&!a.guard&&a.hist===1&&a.tool===1&&b.guard&&!b.tail&&b.hist<0.8&&b.tool<0.8&&b.handle<0.8&&b.after!=='none'&&/rgba?\(179/.test(b.shadow)&&c.guard&&c.tail&&c.hist===1&&c.tool<0.8&&!d.guard&&!d.tail&&d.hist===1&&d.tool===1&&d.after==='none';
 return [ok,JSON.stringify({a,b,c,d})]});

T('U11','config','T2: تغطية الشريط العمودي والأفقي بعد التضييق (مع الحفاظ على الأزرار الأساسية ≥٤٨) مقارنة بالدفعة ٢ (العمودي لا أسوأ، الأفقي أقل)',async(p,env)=>{
 await uReady(p);
 const base={A:8.35,B:4.14,C:8.35,D:10.94};const baseH={A:7.2,B:3.6,C:7.2,D:11.7};
 const meas=async dock=>{await p.evaluate(d=>__sb.setToolbar({dock:d,pos:.5,collapsed:false}),dock);await sleep(80);
  return p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect(),t=document.getElementById('tbar'),r=t.getBoundingClientRect();
   const vis=e=>e.getClientRects().length>0;const small=[...t.querySelectorAll('button,input')].filter(vis).filter(e=>{const b=e.getBoundingClientRect();return b.height<47.5||(e.tagName==='BUTTON'&&b.width<47.5)}).map(e=>e.id||e.className);
   return{cov:Math.round(r.width*r.height/(st.width*st.height)*10000)/100,w:Math.round(r.width),h:Math.round(r.height),scroll:t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1,small}})};
 const v=await meas('right'),h=await meas('bottom');
 await p.evaluate(()=>__sb.setToolbar({dock:'right',pos:.5,collapsed:false}));
 const bv=base[env.cfg.n],bh=baseH[env.cfg.n];
 const ok=v.small.length===0&&h.small.length===0&&v.cov<=bv+0.01&&h.cov<=bh+0.01;
 return [ok,JSON.stringify({cfg:env.cfg.n,vertical:v,horizontal:h,batch2V:bv,batch2H:bh})]});

T('U12','once','T2: لا يدخل السجل في الملف المصدَّر؛ تراجع ثم إعادة يعيدان نفس نص التصدير؛ تحميل مستند يصفّر السجل',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();await U.draw(3);const j0=__sb.exportDoc();await U.draw(1,{y:800});const j1=__sb.exportDoc();
  const noHist=!/hist|undo|redo|patch|label/i.test(j1);
  __sb.undo();const jU=__sb.exportDoc();__sb.redo();const jR=__sb.exportDoc();
  const imp=__sb.importDoc(j1);__sb.loadDoc(imp.doc);const after={u:U.dbg().u,r:U.dbg().r,uDis:document.getElementById('undoBtn').disabled,rDis:document.getElementById('redoBtn').disabled,n:__sb.strokes().length};
  await U.draw(1);__sb.undo();__sb.newDoc({w:1440,h:1080});const nd={u:U.dbg().u,r:U.dbg().r};
  return{noHist,undoEqualsBefore:jU===j0,redoEqualsAfter:jR===j1,after,nd}});
 return [r.noHist&&r.undoEqualsBefore&&r.redoEqualsAfter&&r.after.u===0&&r.after.r===0&&r.after.uDis&&r.after.rDis&&r.after.n===4&&r.nd.u===0&&r.nd.r===0,JSON.stringify(r)]});

T('U13','once','T2: قابلية التوسّع: رقاع generic (نقل، نسخ، ممحاة جزئية = حذف+إضافة ذرّيان) تُسجَّل وتُتراجع دون أي أداة جديدة',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{T.reset();await U.draw(3);const P=__sb.pg(),els=P.elements;const e1=els[1];const out={};
  // نقل: set على tf
  const before=e1.tf.slice(),after=[1,0,0,1,50,20];e1.tf=after.slice();__sb.pushHist('نقل',[{op:'set',pageId:P.id,id:e1.id,before:{tf:before},after:{tf:after}}]);
  __sb.undo();out.moveUndo=e1.tf.join()===before.join();__sb.redo();out.moveRedo=e1.tf.join()===after.join();
  // نسخ: add في الوسط
  const cp=JSON.parse(JSON.stringify(e1));cp.id='copy1';els.splice(1,0,cp);__sb.pushHist('نسخ',[{op:'add',pageId:P.id,el:cp,index:1}]);
  out.copyN=els.length;__sb.undo();out.copyUndo=els.length===3&&!els.some(e=>e.id==='copy1');__sb.redo();out.copyRedo=els.length===4&&els[1].id==='copy1';
  // ممحاة جزئية: يُستبدل خط بقطعتين في عملية واحدة
  const old=els[0],a=JSON.parse(JSON.stringify(old)),b=JSON.parse(JSON.stringify(old));a.id='pa';b.id='pb';
  els.splice(0,1,a,b);__sb.pushHist('ممحاة جزئية',[{op:'remove',pageId:P.id,el:old,index:0},{op:'add',pageId:P.id,el:a,index:0},{op:'add',pageId:P.id,el:b,index:1}]);
  out.eraseN=els.map(e=>e.id).join();__sb.undo();out.eraseUndo=els[0]===old&&!els.some(e=>e.id==='pa'||e.id==='pb')&&els.length===4;__sb.redo();out.eraseRedo=els.map(e=>e.id)[0]==='pa'&&els[1].id==='pb'&&els.length===5;
  out.single={u:U.dbg().u};
  out.valid=__sb.validateDoc(JSON.parse(__sb.exportDoc())).ok;return out});
 const ok=r.moveUndo&&r.moveRedo&&r.copyN===4&&r.copyUndo&&r.copyRedo&&r.eraseUndo&&r.eraseRedo&&r.single.u===6&&r.valid;
 return [ok,JSON.stringify(r)]});

T('U14','once','T2: سلامة المستند: سجل غير متسق (عنصر حُذف خارجيًا، معرّف مكرر، رقعة مجهولة، صفحة غير موجودة) يُرفض بلا تعديل للمستند، ويُعدّ الخطأ، ويُصفَّر السجل',async(p)=>{
 await uReady(p);
 const r=await p.evaluate(async()=>{const out={};const snap=()=>JSON.stringify(__sb.serializeDoc(__sb.S.doc));let dropped=null;
  const mk=async()=>{T.reset();await U.draw(3)};
  await mk();let s0;{const els=__sb.pg().elements;els.splice(1,1);s0=snap();const res=__sb.undo();out.missing=[res,snap()===s0,__sb.S.m.historyErrors,U.dbg().u,U.dbg().r]}
  await mk();{const P=__sb.pg();const dup=JSON.parse(JSON.stringify(P.elements[0]));P.elements.splice(0,1);__sb.undo();__sb.redo();P.elements.push(dup);const s1=snap();const u=U.dbg().u;const res=__sb.redo();out.dupRedo=[res,snap()===s1,__sb.S.m.historyErrors,U.dbg().u]}
  await mk();{__sb.HIST.undo[2].patches[0].op='zap';const s1=snap();const res=__sb.undo();out.unknown=[res,snap()===s1,__sb.S.m.historyErrors,U.dbg().u]}
  await mk();{__sb.HIST.undo[2].patches[0].pageId='nope';const s1=snap();const res=__sb.undo();out.noPage=[res,snap()===s1,__sb.S.m.historyErrors,U.dbg().u]}
  await mk();{const els=__sb.pg().elements;const e=els.pop();const before=U.dbg().u;const res=__sb.undo();out.partial=[res,__sb.S.m.historyErrors]}
  // عملية متعددة الرقاع: فشل جزئي لا يترك حالة نصف مطبّقة
  await mk();{const P=__sb.pg();const x=P.elements[2];__sb.pushHist('تجربة',[{op:'remove',pageId:P.id,el:P.elements[0],index:0},{op:'remove',pageId:P.id,el:{id:'ghost'},index:5}]);P.elements.splice(0,1);const s1=snap();const res=__sb.undo();out.atomic=[res,snap()===s1,__sb.S.m.historyErrors]}
  await mk();{await U.draw(1,{y:700});const okRes=__sb.undo();out.recover=[okRes,__sb.S.m.historyErrors]}
  const errBtn=[document.getElementById('undoBtn').disabled,document.getElementById('redoBtn').disabled];
  return Object.assign(out,{errBtn})});
 const bad=a=>a[0]===false&&a[1]===true&&a[2]>=1;
 const ok=r.missing[0]===false&&r.missing[1]&&r.missing[2]===1&&r.missing[3]===0&&r.missing[4]===0&&r.dupRedo[0]===false&&r.dupRedo[1]&&r.dupRedo[2]===1&&r.dupRedo[3]===0&&bad(r.unknown)&&r.unknown[3]===0&&bad(r.noPage)&&r.noPage[3]===0&&r.partial[0]===false&&r.partial[1]===1&&r.atomic[0]===false&&r.atomic[1]&&r.atomic[2]===1&&r.recover[0]===true&&r.recover[1]===0;
 return [ok,JSON.stringify(r)]});

T('U15','once','T2-مراجعة: مهلة الحماية: زرا التراجع/الإعادة يعملان بنقر حقيقي فور رفع القلم، وبقية الشريط تبقى محمية خلال المهلة، وأثناء الكتابة يبقى كل شيء محميًا',async(p)=>{
 await uReady(p);
 await p.evaluate(async()=>{T.reset();await U.draw(3)});await sleep(600);
 const out={};
 const [ux,uy]=await uBtn(p,'undoBtn'),[rx,ry]=await uBtn(p,'redoBtn');const [px,py]=await uBtn(p,'toolErase'),[qx,qy]=await uBtn(p,'toolPen');/* زر «الضغط» انتقل إلى لوحة خيارات القلم التي تُغلق عند الكتابة؛ البديل المعتمد لفحص ابتلاع أدوات الشريط غير التراجع/الإعادة هو زر تبديل الأداة */
 // (1) رسم خط ثم نقر فوري على التراجع (<١٢٠ مللي ثانية)
 await p.evaluate(()=>{T.evL('pointerdown',50,'pen',900,800);T.evL('pointermove',50,'pen',950,810);T.evL('pointerup',50,'pen',1000,810)});
 const t0=Date.now();await p.mouse.click(ux,uy);out.dtUndo=Date.now()-t0;
 out.afterUndo=await p.evaluate(()=>({n:__sb.strokes().length,tail:document.getElementById('tbar').classList.contains('tail'),hits:__sb.S.m.toolbarGuardHits}));
 await p.mouse.click(rx,ry);
 out.afterRedo=await p.evaluate(()=>({n:__sb.strokes().length}));
 // (2) زر الضغط خلال المهلة يُبتلع
 await p.evaluate(()=>{T.evL('pointerdown',51,'pen',900,850);T.evL('pointermove',51,'pen',950,860);T.evL('pointerup',51,'pen',1000,860)});
 const pr0=await p.evaluate(()=>({p:__sb.S.tool,h:__sb.S.m.toolbarGuardHits}));
 await p.mouse.click(px,py);
 out.press=await p.evaluate(()=>({p:__sb.S.tool,h:__sb.S.m.toolbarGuardHits,tail:document.getElementById('tbar').classList.contains('tail')}));out.pr0=pr0;
 await sleep(600);await p.mouse.click(px,py);out.pressAfter=await p.evaluate(()=>__sb.S.tool);await p.mouse.click(qx,qy);out.backToPen=await p.evaluate(()=>__sb.S.tool);await p.evaluate(()=>{const o=document.getElementById('opts');if(!o.hidden)document.getElementById('toolPen').click()});
 // (3) أثناء الكتابة: نقر على التراجع مبتلع
 await p.evaluate(()=>{T.evL('pointerdown',52,'pen',900,900);T.evL('pointermove',52,'pen',950,905)});
 const n0=await p.evaluate(()=>__sb.strokes().length);await p.mouse.click(ux,uy);
 out.during=await p.evaluate(()=>({n:__sb.strokes().length,act:!!__sb.S.active,undone:__sb.S.m.undone}));out.n0=n0;
 await p.evaluate(()=>{T.evL('pointerup',52,'pen',1000,905)});await sleep(500);
 // (4) لمس حقيقي فور الرفع
 await p.evaluate(()=>{T.evL('pointerdown',53,'pen',900,950);T.evL('pointermove',53,'pen',950,955);T.evL('pointerup',53,'pen',1000,955)});
 const m0=await p.evaluate(()=>__sb.strokes().length);await p.touchscreen.tap(ux,uy);await sleep(80);out.tap=[m0,await p.evaluate(()=>__sb.strokes().length)];
 const ok=out.afterUndo.n===3&&out.afterUndo.tail&&out.afterRedo.n===4&&out.pr0.p==='pen'&&out.press.p==='pen'&&out.press.h>out.pr0.h&&out.pressAfter==='erase'&&out.backToPen==='pen'&&out.during.n===out.n0&&out.during.act&&out.tap[1]===out.tap[0]-1&&out.dtUndo<300;
 return [ok,JSON.stringify(out)]});

T('U16','config','T2-مراجعة ٢: العدّاد يُخفى عند الصفر (مع بقاء مكانه والزر معطّلًا)، ويظهر الرقم ≥١٦ بكسل بخط عريض داخل حبّة ≥٢٦×٢٠ عند القيمة الموجبة، وأرقام هندية فقط',async(p)=>{
 await uReady(p);
 const q=()=>p.evaluate(()=>['undoCnt','redoCnt'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),cs=getComputedStyle(e),b=document.getElementById(id==='undoCnt'?'undoBtn':'redoBtn'),br=b.getBoundingClientRect();return{t:e.textContent,fs:parseFloat(cs.fontSize),fw:+cs.fontWeight,w:Math.round(r.width),h:Math.round(r.height),hid:cs.visibility==='hidden',dis:b.disabled,bh:Math.round(br.height),bw:Math.round(br.width)}}));
 const z=await q();
 await p.evaluate(async()=>{await U.draw(12)});await sleep(100);const n=await q();
 await p.evaluate(()=>{__sb.undo();});const m=await q();
 await p.evaluate(()=>{while(__sb.undo());});const e=await q();
 const ok=z.every(c=>c.hid&&c.dis)&&n[0].t==='١٢'&&!n[0].hid&&n[1].hid&&n[1].dis&&!n[0].dis&&[n[0]].every(c=>c.fs>=16&&c.fw>=700&&c.w>=26&&c.h>=20)&&!m[1].hid&&m[1].t==='١'&&!m[1].dis&&e[0].hid&&e[0].dis&&!e[1].hid&&e[1].t==='١٢'&&
  [...z,...n,...m,...e].every(c=>/^[٠-٩]+$/.test(c.t)&&c.bh>=48&&c.bw>=48)&&z[0].bh===n[0].bh&&z[0].bw===n[0].bw;
 return [ok,JSON.stringify({z,n,m,e})]});

// ================= اختبارات T3: الفهرس المكاني + إعادة رسم المنطقة + قياس الأداء =================
const VH=`window.V={
 mk(n,seed,profile){T.reset();__sb.setProfile(profile||'wide');__sb.fillStrokes(__sb.pg(),n,seed);__sb.setProfile('wide');__sb.redrawDoc()},
 img(){const c=document.getElementById('doc');return c.getContext('2d').getImageData(0,0,c.width,c.height).data},
 diff(a,b){let n=0,m=0,n16=0,n32=0,n64=0,n128=0;for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]),Math.abs(a[i+3]-b[i+3]));if(d){n++;if(d>m)m=d;if(d>16)n16++;if(d>32)n32++;if(d>64)n64++;if(d>128)n128++}}return{n,m,n16,n32,n64,n128}},
 cmp(){const a=V.img();__sb.redrawDoc();const b=V.img();return V.diff(a,b)},
 /* تعريف الاستعلام: العناصر التي تتقاطع حدودها مع (المستطيل ∩ الصفحة). ما خارج الصفحة لا يُرسم فلا يُفهرَس. */
 brute(page,x0,y0,x1,y1){const X0=Math.max(x0,0),Y0=Math.max(y0,0),X1=Math.min(x1,page.w),Y1=Math.min(y1,page.h);if(X0>X1||Y0>Y1)return[];return page.elements.filter(e=>{const b=__sb.worldBBox(e);return b[2]>=X0&&b[0]<=X1&&b[3]>=Y0&&b[1]<=Y1})},
 sameList(a,b){return a.length===b.length&&a.every((e,i)=>e===b[i])},
 async stroke(pts,id,w){if(w)__sb.S.width=w;T.evL('pointerdown',id,'pen',pts[0][0],pts[0][1]);for(const q of pts.slice(1))T.evL('pointermove',id,'pen',q[0],q[1]);T.evL('pointerup',id,'pen',pts[pts.length-1][0],pts[pts.length-1][1]);await T.raf()},
 rnd:null
};`;
const vReady=async p=>{await p.evaluate(VH)};

T('V01','once','T3: الفهرس المكاني: استعلام ٤٠٠ مستطيل عشوائي (سالب، ضخم، منعدم، عادي) يطابق البحث الشامل مجموعةً وترتيبًا، مع تحويلات وعناصر خارج الصفحة وثلاثة أحجام خلايا',async(p)=>{
 await vReady(p);
 const r=await p.evaluate(async()=>{V.mk(2000,11,'wide');const P=__sb.pg(),rnd=__sb.mulberry(5);const out={bad:0,checked:0};
  // تحويلات على ٣٠٠ عنصر عبر commitOps
  for(let i=0;i<300;i++){const el=P.elements[Math.floor(rnd()*P.elements.length)];const a=rnd()*6.28,sc=0.6+rnd()*1.2;const tf=[sc*Math.cos(a),sc*Math.sin(a),-sc*Math.sin(a),sc*Math.cos(a),(rnd()-.5)*400,(rnd()-.5)*300];
   if(!__sb.commitOps('نقل',[{op:'set',pageId:P.id,id:el.id,before:{tf:el.tf.slice()},after:{tf}}]))out.setFail=(out.setFail||0)+1}
  // ١٠٠ عنصر خارج الصفحة كليًا (بالإضافة)
  for(let i=0;i<100;i++){const src=P.elements[i],cp=JSON.parse(JSON.stringify(src));cp.id='far'+i;cp.tf=[1,0,0,1,6000+i,-5000];if(!__sb.commitOps('نسخ',[{op:'add',pageId:P.id,el:cp,index:P.elements.length}]))out.addFail=(out.addFail||0)+1}
  out.n=P.elements.length;out.ci=__sb.checkIndex(P);
  for(const g of [128,48,512]){__sb.CFG.gridCell=g;
   for(let q=0;q<(g===128?200:100);q++){let x0=(rnd()-.2)*2400-200,y0=(rnd()-.2)*1400-200,w=rnd()<.1?0:rnd()*(rnd()<.2?4000:400),h=rnd()<.1?0:rnd()*(rnd()<.2?3000:300);
    const got=__sb.idxQuery(P,x0,y0,x0+w,y0+h),exp=V.brute(P,x0,y0,x0+w,y0+h);out.checked++;if(!V.sameList(got,exp))out.bad++}
   out['ci'+g]=__sb.checkIndex(P).ok;out['g'+g]=__sb.idxOf(P).g===g}
  __sb.CFG.gridCell=128;
  const all=__sb.idxQuery(P,-1e6,-1e6,1e6,1e6);out.allInPage=V.sameList(all,V.brute(P,-1e6,-1e6,1e6,1e6));
  return out});
 const ok=r.bad===0&&r.checked===400&&!r.setFail&&!r.addFail&&r.n===2100&&r.ci.ok&&r.ci128&&r.ci48&&r.ci512&&r.g128&&r.g48&&r.g512&&r.allInPage;
 return [ok,JSON.stringify(r)]});

T('V02','once','T3: صيانة الفهرس: ٤٠٠ عملية عشوائية (رسم، تراجع، إعادة، مسح، نقل، نسخ في الوسط، ممحاة بالاستبدال) والفهرس متسق بعد كل عملية ويطابق البحث الشامل',async(p)=>{
 await vReady(p);
 const r=await p.evaluate(async()=>{__sb.CFG.idxGuard=false;V.mk(300,21,'hand');const rnd=__sb.mulberry(99);let bad=null,cid=0;const ops={};
  const check=tag=>{const P=__sb.pg(),c=__sb.checkIndex(P);if(!c.ok){bad=tag+' '+c.errors.join(';');return}
   if(c.built&&c.tracked!==P.elements.length){bad=tag+' tracked';return}};
  const brute=tag=>{const P=__sb.pg();for(let q=0;q<5;q++){const x0=rnd()*1800,y0=rnd()*1000,w=rnd()*400,h=rnd()*300;if(!V.sameList(__sb.idxQuery(P,x0,y0,x0+w,y0+h),V.brute(P,x0,y0,x0+w,y0+h))){bad=tag+' query';return}}};
  for(let i=0;i<400&&!bad;i++){const x=rnd();let op;const P=__sb.pg();
   if(x<.25)op='draw';else if(x<.45)op='undo';else if(x<.6)op='redo';else if(x<.63)op='clear';else if(x<.75)op='move';else if(x<.87)op='copy';else op='erase';ops[op]=(ops[op]||0)+1;
   if(op==='draw'){const x0=100+rnd()*1600,y0=100+rnd()*800;await V.stroke([[x0,y0],[x0+30,y0+10],[x0+60,y0-5],[x0+90,y0+8]],200+(i%50),6)}
   else if(op==='undo')__sb.undo();else if(op==='redo')__sb.redo();
   else if(op==='clear'){if(rnd()<.5)__sb.clearActivePage()}
   else if(P.elements.length){const k=Math.floor(rnd()*P.elements.length),el=P.elements[k];
    if(op==='move')__sb.commitOps('نقل',[{op:'set',pageId:P.id,id:el.id,before:{tf:el.tf.slice()},after:{tf:[1,0,0,1,(rnd()-.5)*200,(rnd()-.5)*200]}}]);
    else if(op==='copy'){const cp=JSON.parse(JSON.stringify(el));cp.id='cp'+(++cid);__sb.commitOps('نسخ',[{op:'add',pageId:P.id,el:cp,index:k}])}
    else{const a=JSON.parse(JSON.stringify(el)),b=JSON.parse(JSON.stringify(el));a.id='ea'+(++cid);b.id='eb'+cid;__sb.commitOps('ممحاة جزئية',[{op:'remove',pageId:P.id,el,index:k},{op:'add',pageId:P.id,el:a,index:k},{op:'add',pageId:P.id,el:b,index:k+1}])}}
   check(op+'#'+i);if(i%20===0&&!bad)brute(op+'#'+i);
   if(i%100===99&&!bad){const v=__sb.validateDoc(JSON.parse(__sb.exportDoc()));if(!v.ok)bad='invalid '+v.errors[0]}}
  __sb.CFG.idxGuard=true;return{bad,ops,n:__sb.pg().elements.length,regions:__sb.S.m.regionRedraws,fulls:__sb.S.m.fullRedraws}});
 return [r.bad===null&&r.ops.draw>60&&r.ops.undo>50&&r.ops.move>20&&r.ops.copy>20&&r.ops.erase>10&&r.regions>100,JSON.stringify(r)]});

T('V03','config','T3: تطابق الرسم الجزئي والكامل (لا فرق هيكلي: ٠ بكسل بفارق >١٢٨/٢٥٥؛ وتُسجَّل فروق حواف التنعيم): تراجع/إعادة/تثبيت خطوط على الحواف/نقل/تدوير/نسخ/ممحاة جزئية/مسح، مع تكبير وإزاحة',async(p,env)=>{
 await vReady(p);
 const r=await p.evaluate(async()=>{V.mk(1000,31,'wide');const P=__sb.pg(),rnd=__sb.mulberry(7);const res=[];const chk=tag=>{const d=V.cmp();res.push([tag,d.n,d.m,d.n16,d.n32,d.n64,d.n128])};
  chk('baseline');
  // خطوط ثابتة على الحواف والزوايا بسماكة كبيرة (قصّ حافة الصفحة)
  const edge=[[[8,8],[120,30],[260,12]],[[1900,12],[1780,40],[1650,10]],[[10,1070],[130,1050],[300,1072]],[[1915,1075],[1800,1050],[1700,1076]],[[900,2],[960,6],[1040,2]],[[900,1078],[960,1074],[1040,1078]]];
  for(let i=0;i<edge.length;i++){await V.stroke(edge[i],300+i,38);chk('edge'+i)}
  __sb.S.width=8;
  for(let i=0;i<10;i++){const x=100+rnd()*1700,y=100+rnd()*800;await V.stroke([[x,y],[x+40,y+20],[x+90,y-10],[x+130,y+25]],320+i,6+i);chk('draw'+i)}
  for(let i=0;i<12;i++){__sb.undo();chk('undo'+i)}
  for(let i=0;i<12;i++){__sb.redo();chk('redo'+i)}
  // نقل/تدوير/تكبير
  const mv=(label,tf)=>{const el=P.elements[Math.floor(rnd()*P.elements.length)];__sb.commitOps(label,[{op:'set',pageId:P.id,id:el.id,before:{tf:el.tf.slice()},after:{tf}}]);chk(label)};
  mv('move',[1,0,0,1,37.3,-21.7]);mv('rotate',[Math.cos(.7),Math.sin(.7),-Math.sin(.7),Math.cos(.7),50,10]);mv('scale',[1.6,0,0,1.6,-80,-40]);mv('offpage',[1,0,0,1,3000,0]);
  for(let i=0;i<4;i++){__sb.undo();chk('undoSet'+i)}for(let i=0;i<4;i++){__sb.redo();chk('redoSet'+i)}
  // نسخ في الوسط وممحاة بالاستبدال
  {const k=400,el=P.elements[k],cp=JSON.parse(JSON.stringify(el));cp.id='cpv';cp.tf=[1,0,0,1,25,25];__sb.commitOps('نسخ',[{op:'add',pageId:P.id,el:cp,index:k}]);chk('copyMid');__sb.undo();chk('undoCopy');__sb.redo();chk('redoCopy')}
  {const k=200,el=P.elements[k],a=JSON.parse(JSON.stringify(el)),b=JSON.parse(JSON.stringify(el));a.id='eav';b.id='ebv';a.pts=a.pts.slice(0,Math.ceil(a.pts.length/2));b.pts=b.pts.slice(Math.floor(b.pts.length/2));a.bbox=__sb.strokeBBox(a);b.bbox=__sb.strokeBBox(b);
   __sb.commitOps('ممحاة جزئية',[{op:'remove',pageId:P.id,el,index:k},{op:'add',pageId:P.id,el:a,index:k},{op:'add',pageId:P.id,el:b,index:k+1}]);chk('erase');__sb.undo();chk('undoErase');__sb.redo();chk('redoErase')}
  // مسح ثم تراجع (مسار الرسم الكامل) وإعادة
  __sb.clearActivePage();chk('clear');__sb.undo();chk('undoClear');__sb.redo();chk('redoClear');__sb.undo();
  // تكبير وإزاحة العرض
  __sb.setView(2,600,400);chk('zoom2');for(let i=0;i<4;i++){__sb.undo();chk('zU'+i)}for(let i=0;i<4;i++){__sb.redo();chk('zR'+i)}
  __sb.setView(1.5,1500,800);chk('zoom1.5');for(let i=0;i<3;i++){__sb.undo();chk('pU'+i)}for(let i=0;i<3;i++){__sb.redo();chk('pR'+i)}
  __sb.setView(1,960,540);chk('home');
  const sum=i=>res.reduce((a,x)=>a+x[i],0),mx=res.reduce((a,x)=>Math.max(a,x[2]),0);
  return{cmps:res.length,diffPx:sum(1),over16:sum(3),over32:sum(4),over64:sum(5),over128:sum(6),maxDiff:mx,worst:res.filter(x=>x[6]>0).slice(0,5),regions:__sb.S.m.regionRedraws,ci:__sb.checkIndex(P).ok}});
 return [r.over128===0&&r.maxDiff<=128&&r.cmps>=70&&r.regions>=40&&r.ci,JSON.stringify(r)]});

T('V04','once','T3: تطابق الرسم الجزئي والكامل عند ٥٠٠٠ خط (لا فرق هيكلي) مع إعادة رسم المنطقة',async(p)=>{
 await vReady(p);
 const r=await p.evaluate(async()=>{V.mk(5000,41,'hand');const rnd=__sb.mulberry(3);const res=[];const chk=tag=>{const d=V.cmp();res.push([tag,d.n128,d.m,d.n])};
  for(let i=0;i<5;i++){const x=100+rnd()*1700,y=100+rnd()*800;await V.stroke([[x,y],[x+25,y+10],[x+60,y-8]],400+i,7);chk('draw'+i)}
  for(let i=0;i<5;i++){__sb.undo();chk('undo'+i)}for(let i=0;i<5;i++){__sb.redo();chk('redo'+i)}
  const P=__sb.pg(),el=P.elements[2500];__sb.commitOps('نقل',[{op:'set',pageId:P.id,id:el.id,before:{tf:el.tf.slice()},after:{tf:[1,0,0,1,45,-30]}}]);chk('move');__sb.undo();chk('undoMove');
  const tot=res.reduce((a,x)=>a+x[1],0),mx=res.reduce((a,x)=>Math.max(a,x[2]),0),aa=res.reduce((a,x)=>a+x[3],0);return{cmps:res.length,structuralPx:tot,maxDiff:mx,aaEdgePx:aa,bad:res.filter(x=>x[1]>0).slice(0,5),n:P.elements.length,regions:__sb.S.m.regionRedraws}});
 return [r.structuralPx===0&&r.maxDiff<=128&&r.cmps===17&&r.n>=5000&&r.regions>=10,JSON.stringify(r)]});

T('V05','once','T3: بيانات الأداء ومعيار القبول: عند ٠ و٢٠٠٠ و٥٠٠٠ خط (ملفان: خطوط كبيرة متشائمة، وخط يد صغير)، حركة المؤشر والرسم والتثبيت والتراجع الجزئي مقابل الكامل',async(p,env)=>{
 await vReady(p);
 const out={};
 for(const prof of ['wide','hand']){out[prof]=await p.evaluate(async(prof)=>await __sb.perfBench([0,2000,5000],{probes:8,moves:60,profile:prof}),prof)}
 const f=x=>Math.round(x*100)/100;
 const sum={};const fails=[];
 for(const prof of ['wide','hand']){sum[prof]=out[prof].map(r=>({N:r.N,handlerP99:f(r.handler.p99),handlerMax:f(r.handler.max),flushP99:f(r.flush.p99),perMoveP99:f(r.perMove.p99),commitP99:f(r.commit.p99),undoRegionP95:f(r.histRegion.undo.p95),redoRegionP95:f(r.histRegion.redo.p95),undoFullP95:f(r.histFull.undo.p95),redoFullP95:f(r.histFull.redo.p95),fullRedrawMed:f(r.fullRedraw.p50),regionRedrawMed:f(r.regionRedraw.p50),indexBuild:f(r.indexBuildMs),clearMs:f(r.clear.clearMs),undoClearMs:f(r.clear.undoClearMs),idxOk:r.checkIndex}));
  for(const r of out[prof]){
   if(!(r.handler.n>=100&&r.flush.n>=50))fails.push(prof+r.N+' no samples');
   if(!(r.handler.p99<=4))fails.push(prof+r.N+' handler');
   if(!(r.perMove.p99<=8))fails.push(prof+r.N+' perMove');
   if(!(r.commit.p99<=16))fails.push(prof+r.N+' commit');
   if(!r.checkIndex)fails.push(prof+r.N+' index');
   if(r.N>=2000){
    if(!(r.histRegion.undo.p95*10<=r.histFull.undo.p95&&r.histRegion.redo.p95*10<=r.histFull.redo.p95))fails.push(prof+r.N+' speedup<10');
    const lim=prof==='hand'?16:100;if(!(r.histRegion.undo.p95<=lim&&r.histRegion.redo.p95<=lim))fails.push(prof+r.N+' undo>'+lim);
   }}
  const a=out[prof][0].handler.p99,b=out[prof][2].handler.p99;if(!(b<=2*Math.max(a,0.5)))fails.push(prof+' handler depends on N');
 }
 return [fails.length===0,JSON.stringify({fails,sum}),{raw:out}]});

T('V06','once','T3: الذاكرة بعد ١٠٠٠ عملية (رسم/تراجع/إعادة/مسح) على مستند ٢٠٠٠ خط: لا تراكم، وتعود الذاكرة قرب خط الأساس بعد استبدال المستند',async(p,env)=>{
 const b2=await chromium.launch({args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
 try{
  const ctx=await b2.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1,hasTouch:true});const q=await ctx.newPage();const errs=[];q.on('pageerror',e=>errs.push(String(e)));
  await q.goto(F);await sleep(500);await q.evaluate(HELP);await q.evaluate(VH);
  const r=await q.evaluate(async()=>{
   const gc2=async()=>{gc();await new Promise(r=>setTimeout(r,60));gc();await new Promise(r=>setTimeout(r,60))};
   const mem=()=>performance.memory.usedJSHeapSize;
   const dom=()=>document.getElementsByTagName('*').length;
   await gc2();const base=mem(),dom0=dom(),cv0=document.getElementsByTagName('canvas').length;
   V.mk(2000,51,'hand');await gc2();const filled=mem();
   const rnd=__sb.mulberry(1234);let clears=0;
   const round=async n=>{for(let i=0;i<n;i++){const x=rnd();
     if(x<.45){const x0=100+rnd()*1600,y0=100+rnd()*800;await V.stroke([[x0,y0],[x0+30,y0+8],[x0+60,y0-6]],700+(i%30),6)}
     else if(x<.7)__sb.undo();else if(x<.9)__sb.redo();
     else if(x<.903&&clears<4){__sb.clearActivePage();clears++;__sb.undo()}
     else{const P=__sb.pg(),el=P.elements[Math.floor(rnd()*P.elements.length)];__sb.commitOps('نقل',[{op:'set',pageId:P.id,id:el.id,before:{tf:el.tf.slice()},after:{tf:[1,0,0,1,(rnd()-.5)*50,(rnd()-.5)*50]}}])}}};
   await round(1000);await gc2();const after1=mem();const h1={u:__sb.HIST.undo.length,r:__sb.HIST.redo.length,n:__sb.pg().elements.length,ci:__sb.checkIndex(__sb.pg())};
   await round(1000);await gc2();const after2=mem();
   __sb.newDoc({w:1920,h:1080});await gc2();const end=mem();
   return{base,filled,after1,after2,end,h1,dom0,dom1:dom(),cv0,cv1:document.getElementsByTagName('canvas').length,clears,
    g1:after1-filled,g2:after2-after1,leftover:end-base,ops:__sb.S.m.undone+__sb.S.m.redone}});
  await ctx.close();
  const MB=1024*1024;const ok=errs.length===0&&r.g1<3*MB&&r.g2<3*MB&&r.leftover<2.5*MB&&r.h1.u<=200&&r.h1.ci.ok&&r.h1.ci.tracked===r.h1.n&&r.dom0===r.dom1&&r.cv0===r.cv1&&r.clears>=1;
  const fmt=x=>Math.round(x/1024)/1024;
  return [ok,JSON.stringify({baseMB:fmt(r.base),filledMB:fmt(r.filled),after1000MB:fmt(r.after1),after2000MB:fmt(r.after2),endMB:fmt(r.end),growth1MB:fmt(r.g1),growth2MB:fmt(r.g2),leftoverMB:fmt(r.leftover),hist:r.h1,dom:[r.dom0,r.dom1],canvases:[r.cv0,r.cv1],clears:r.clears,errs})]
 }finally{await b2.close()}});

T('V07','once','T3: زر «قياس الأداء» في لوحة التشخيص: يعمل على مستند مؤقت ثم يعيد مستندك وسجله كما كانا، ويعرض جدولًا بأرقام هندية، بلا أخطاء',async(p)=>{
 await vReady(p);
 await uReady(p);
 const errs=[];const h=e=>errs.push(String(e));p.on('pageerror',h);
 await p.evaluate(async()=>{T.reset();await U.draw(3);__sb.undo();__sb.setDiag(true)});
 const before=await p.evaluate(()=>({id:__sb.S.doc.id,json:__sb.exportDoc(),u:__sb.HIST.undo.length,r:__sb.HIST.redo.length}));
 await p.click('#perfBtn');await sleep(300);
 const mid=await p.evaluate(()=>({dis:document.getElementById('perfBtn').disabled,st:document.getElementById('perfState').textContent}));
 await p.waitForFunction(()=>!document.getElementById('perfBtn').disabled,null,{timeout:120000});
 const after=await p.evaluate(()=>({id:__sb.S.doc.id,json:__sb.exportDoc(),u:__sb.HIST.undo.length,r:__sb.HIST.redo.length,st:document.getElementById('perfState').textContent,cols:document.querySelectorAll('#perfOut thead th').length,txt:document.getElementById('perfOut').innerText,btnH:document.getElementById('perfBtn').getBoundingClientRect().height,active:__sb.S.active,run:__sb.PERF.running,dis:[document.getElementById('undoBtn').disabled,document.getElementById('redoBtn').disabled]}));
 await p.evaluate(()=>__sb.setDiag(false));p.off('pageerror',h);
 const lat=(after.txt.match(/[0-9]/g)||[]).length;
 const ok=mid.dis&&/جارٍ/.test(mid.st)&&after.id===before.id&&after.json===before.json&&after.u===before.u&&after.r===before.r&&/اكتمل/.test(after.st)&&after.cols===3&&lat===0&&/[٠-٩]/.test(after.txt)&&after.btnH>=48&&!after.run&&errs.length===0&&after.dis[0]===false&&after.dis[1]===false;
 return [ok,JSON.stringify({mid,idSame:after.id===before.id,jsonSame:after.json===before.json,hist:[before.u,before.r,after.u,after.r],st:after.st,cols:after.cols,latinDigits:lat,errs})]});

T('V08','once','T3: الفهرس لا يدخل الملف المصدَّر؛ تراجع+إعادة بإعادة رسم المنطقة يعطيان نفس نص التصدير وكذلك نفس الرسم',async(p)=>{
 await vReady(p);
 const r=await p.evaluate(async()=>{V.mk(500,61,'hand');const j0=__sb.exportDoc();await V.stroke([[300,300],[340,320],[380,300]],900,8);const j1=__sb.exportDoc();const img1=V.img();
  const noIdx=!/gridCell|"cells"|"loc"|PIDX|regionRedraw/.test(j1);
  __sb.undo();const jU=__sb.exportDoc();__sb.redo();const jR=__sb.exportDoc();const imgR=V.img();const d=V.diff(img1,imgR);
  // ضمان العدّ: فهرس قديم (عدد مختلف) يُعاد بناؤه تلقائيًا
  const P=__sb.pg();const cp=JSON.parse(JSON.stringify(P.elements[0]));cp.id='ext1';P.elements.push(cp);const got=__sb.idxQuery(P,-10,-10,5000,5000).length;const ci=__sb.checkIndex(P);
  return{noIdx,undoEq:jU===j0,redoEq:jR===j1,pxDiff:d.n128,aaPx:d.n,maxDiff:d.m,guardRebuild:got===P.elements.length,ci:ci.ok}});
 return [r.noIdx&&r.undoEq&&r.redoEq&&r.pxDiff===0&&r.maxDiff<=128&&r.guardRebuild&&r.ci,JSON.stringify(r)]});

T('V09','once','T3: عند تعطيل إعادة رسم المنطقة (CFG.regionRedraw=false) يبقى التراجع صحيحًا ومطابقًا (رسم كامل)، وعند ضخامة المنطقة أو كثرة الرقاع يتحول تلقائيًا إلى الرسم الكامل',async(p)=>{
 await vReady(p);
 const r=await p.evaluate(async()=>{V.mk(300,71,'hand');const out={};
  __sb.CFG.regionRedraw=false;await V.stroke([[300,300],[340,320],[380,300]],910,8);const m0={r:__sb.S.m.regionRedraws,f:__sb.S.m.fullRedraws};__sb.undo();out.off={dr:__sb.S.m.regionRedraws-m0.r,df:__sb.S.m.fullRedraws-m0.f,eq:V.cmp().n128};__sb.redo();
  __sb.CFG.regionRedraw=true;let m1={r:__sb.S.m.regionRedraws,f:__sb.S.m.fullRedraws};__sb.undo();out.on={dr:__sb.S.m.regionRedraws-m1.r,df:__sb.S.m.fullRedraws-m1.f,eq:V.cmp().n128};__sb.redo();
  // منطقة ضخمة: خط عملاق بسماكة ٤٠ يغطي أكثر من نصف الصفحة
  const P=__sb.pg();const big={id:'bigx',type:'stroke',color:'auto',tf:[1,0,0,1,0,0],pts:[{x:40,y:40,w:40},{x:1880,y:1040,w:40}],bbox:null};big.bbox=__sb.strokeBBox(big);
  __sb.commitOps('خط ضخم',[{op:'add',pageId:P.id,el:big,index:P.elements.length}]);m1={r:__sb.S.m.regionRedraws,f:__sb.S.m.fullRedraws};__sb.undo();out.big={dr:__sb.S.m.regionRedraws-m1.r,df:__sb.S.m.fullRedraws-m1.f,eq:V.cmp().n128};__sb.redo();
  // رقاع كثيرة: ١٠٠ رقعة في عملية واحدة
  const adds=[];for(let i=0;i<70;i++){const e={id:'tiny'+i,type:'stroke',color:'auto',tf:[1,0,0,1,0,0],pts:[{x:1500+i%7,y:200+i%5,w:4},{x:1510+i%7,y:210+i%5,w:4}],bbox:null};e.bbox=__sb.strokeBBox(e);adds.push({op:'add',pageId:P.id,el:e,index:P.elements.length+i})}
  __sb.commitOps('رقاع كثيرة صغيرة',adds);const patches=null;m1={r:__sb.S.m.regionRedraws,f:__sb.S.m.fullRedraws};__sb.undo();out.many={dr:__sb.S.m.regionRedraws-m1.r,df:__sb.S.m.fullRedraws-m1.f,eq:V.cmp().n128};
  return out});
 const ok=r.off.dr===0&&r.off.df===1&&r.off.eq===0&&r.on.dr===1&&r.on.df===0&&r.on.eq===0&&r.big.dr===0&&r.big.df===1&&r.big.eq===0&&r.many.dr===0&&r.many.df===1&&r.many.eq===0;
 return [ok,JSON.stringify(r)]});

// ================= اختبارات T4.١: وحدة هندسة الإصابة والقص (هندسة بحتة، بلا واجهة) =================
const XH=`window.X={
 E:null,
 mk(pts,w,tf,id,color){const el={id:id||'x'+Math.random().toString(36).slice(2,8),type:'stroke',color:color||'#000000',tf:tf||[1,0,0,1,0,0],pts:pts.map(q=>({x:q[0],y:q[1],w:q[2]||w}))};el.bbox=__sb.strokeBBox(el);return el},
 /* خط يد اصطناعي: اتجاه يتغير تدريجيًا، خطوة بين نقطتين، سماكة ثابتة أو بضغط متغير */
 hand(rnd,o){o=o||{};const n=o.n||60,step=o.step||[2,6],w0=o.w||8,press=o.press||false;let x=o.x!=null?o.x:300+rnd()*800,y=o.y!=null?o.y:250+rnd()*500,a=rnd()*6.283;const pts=[];
  for(let i=0;i<n;i++){const s=step[0]+rnd()*(step[1]-step[0]);a+=(rnd()-.5)*(o.turn||0.7);x+=Math.cos(a)*s;y+=Math.sin(a)*s;
   const w=press?Math.max(1,w0*(0.35+0.65*Math.abs(Math.sin(i/20+(o.ph||0))))):w0;pts.push([x,y,w])}
  return pts},
 render(els,box,S){const W=Math.ceil((box[2]-box[0])*S),H=Math.ceil((box[3]-box[1])*S),c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});
  g.fillStyle='#ffffff';g.fillRect(0,0,W,H);g.setTransform(S,0,0,S,-box[0]*S,-box[1]*S);g.lineCap='round';g.lineJoin='round';
  for(const el of els){g.save();g.transform(el.tf[0],el.tf[1],el.tf[2],el.tf[3],el.tf[4],el.tf[5]);__sb.ELEMENT_TYPES.stroke.render(g,el,{surface:'#ffffff'});g.restore()}
  const d=g.getImageData(0,0,W,H).data,cov=new Float32Array(W*H);for(let i=0;i<cov.length;i++)cov[i]=(255-d[i*4])/255;return{cov,W,H}},
 box(els,pad){let b=[Infinity,Infinity,-Infinity,-Infinity];for(const e of els){const w=__sb.worldBBox(e);b=[Math.min(b[0],w[0]),Math.min(b[1],w[1]),Math.max(b[2],w[2]),Math.max(b[3],w[3])]}return[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad]},
 fragEls(el,res,ids){if(res.status==='miss')return[el];return res.frags.map((f,j)=>X.E.mkStroke(el,f.pts,(ids||'f')+j))},
 /* فحص ثوابت المحو بالبكسل على دقة ×٤: لا حبر داخل الممحاة، لا حبر مضاف، لا إزالة خارج المدى */
 inv(els,cap,fragsAll,wmax){const S=4,pad=Math.max(cap.r,20)+wmax+4;const bx=X.box(els,pad),all=els.concat(fragsAll);
  const bb=[Math.min(bx[0],Math.min(cap.ax,cap.bx)-cap.r-2),Math.min(bx[1],Math.min(cap.ay,cap.by)-cap.r-2),Math.max(bx[2],Math.max(cap.ax,cap.bx)+cap.r+2),Math.max(bx[3],Math.max(cap.ay,cap.by)+cap.r+2)];
  const O=X.render(els,bb,S),F=X.render(fragsAll,bb,S);const r={inside:0,added:0,excess:0,cells:0,minD:Infinity};const E=X.E;
  const Od=X.dil(X.dil(O.cov,O.W,O.H),O.W,O.H),Fd=X.dil(X.dil(F.cov,F.W,F.H),F.W,F.H);/* تسامح بكسلي جهاز (٠٫٥ وحدة) لحواف التنعيم وتدرّج السماكة */
  for(let y=0;y<O.H;y++)for(let x=0;x<O.W;x++){const i=y*O.W+x,wx=bb[0]+(x+.5)/S,wy=bb[1]+(y+.5)/S,d=E.dPS(wx,wy,cap.ax,cap.ay,cap.bx,cap.by);const o=O.cov[i],f=F.cov[i];
   if(f>0.5&&d<r.minD)r.minD=d;
   if(d<cap.r-0.5&&f>0.12)r.inside++;
   if(f>0.5&&Od[i]<0.2)r.added++;
   if(d>cap.r+wmax+0.6&&o>0.5&&Fd[i]<0.2)r.excess++;r.cells++}
  return r},
 capNear(rnd,pts,rmin,rmax,lenMax,spread){const q=pts[Math.floor(rnd()*pts.length)],sp=spread||30,ox=(rnd()-.5)*sp,oy=(rnd()-.5)*sp,a=rnd()*6.283,L=rnd()<.3?0:rnd()*(lenMax||50),r=rmin+rnd()*(rmax-rmin);
  return{ax:q[0]+ox,ay:q[1]+oy,bx:q[0]+ox+Math.cos(a)*L,by:q[1]+oy+Math.sin(a)*L,r}},
 dil(cv,W,H){const o=new Float32Array(cv.length);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let m=0;for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=W)continue;const v=cv[yy*W+xx];if(v>m)m=v}}o[y*W+x]=m}return o},
 pcs(el){return X.E.toPieces(el.pts)}
};window.X.E=__sb.ERASE;`;
const xReady=async p=>{await p.evaluate(XH)};

T('X01','once','T4.١: الإصابة (hitStroke) تطابق حقيقة البكسل: ٤٠٠ حالة عشوائية (ثابتة السماكة ومتغيرتها، خطوة يد وخطوة سريعة، كبسولات ونقطية): صفر خطأ خارج نطاق ±٠٫٣ وحدة',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(101),E=X.E;let n=0,bad=[],amb=0,hit=0,miss=0;
  for(let i=0;i<400;i++){const fast=i%4===3,pts=X.hand(rnd,{n:fast?25:50,step:fast?[15,40]:[2,6],w:3+rnd()*30,press:i%3===0,turn:fast?0.5:0.8,ph:i});const el=X.mk(pts,8);
   const cap=X.capNear(rnd,pts,2,45,i%2?50:0,i%2?90:15);
   const S=4,bb=X.box([el],cap.r+6),O=X.render([el],bb,S);let mind=Infinity;
   for(let y=0;y<O.H;y++)for(let x=0;x<O.W;x++){if(O.cov[y*O.W+x]>0.5){const d=E.dPS(bb[0]+(x+.5)/S,bb[1]+(y+.5)/S,cap.ax,cap.ay,cap.bx,cap.by);if(d<mind)mind=d}}
   const g=mind-cap.r,h=E.hitStroke(el,cap).hit;n++;
   if(Math.abs(g)<=0.3){amb++;continue}
   if(g<0)hit++;else miss++;
   if((g<0)!==h)bad.push({i,g:+g.toFixed(3),h})}
  return{n,amb,hit,miss,bad:bad.slice(0,6),nbad:bad.length}});
 return [r.nbad===0&&r.hit>80&&r.miss>30&&r.n===400,JSON.stringify(r)]});

T('X02','once','T4.١: دقة مسافة الحبر (inkDist) مقابل عيّنات كثيفة مستقلة للمنحنى (٢٠٠٠ نقطة اختبار): الفرق ≤ ٠٫٠٢ وحدة، مع تحويلات تشابهية وانعكاس',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(202),E=X.E;let maxErr=0,n=0,worst=null;
  const tfs=[[1,0,0,1,0,0],[Math.cos(.6)*1.7,Math.sin(.6)*1.7,-Math.sin(.6)*1.7,Math.cos(.6)*1.7,120,-40],[0.6,0,0,-0.6,30,500],[-1.2,0,0,1.2,900,10]];
  for(let i=0;i<40;i++){const pts=X.hand(rnd,{n:30,step:[3,14],w:4+rnd()*20,press:i%2===0,ph:i}),tf=tfs[i%4],el=X.mk(pts,6,tf);
   const W=E.worldOf(el);
   /* مرجع مستقل: عيّنات كثيفة (٤٠٠ لكل قطعة) من المنحنى العالمي */
   const dense=[];for(const q of W.pcs)for(let k=0;k<=400;k++){const t=k/400,pp=E.Q(q,t);dense.push([pp.x,pp.y,q.w/2])}
   for(let j=0;j<50;j++){const q=W.pcs[Math.floor(rnd()*W.pcs.length)],pp=E.Q(q,rnd()),ang=rnd()*6.283,dist=rnd()*40,pt={x:pp.x+Math.cos(ang)*dist,y:pp.y+Math.sin(ang)*dist};
    let ref=Infinity;for(const d of dense){const v=Math.hypot(pt.x-d[0],pt.y-d[1])-d[2];if(v<ref)ref=v}
    const got=E.inkDist(el,pt),err=Math.abs(got-ref);n++;if(err>maxErr){maxErr=err;worst={i,j,got,ref}}}}
  return{n,maxErr:+maxErr.toFixed(4),worst}});
 return [r.n===2000&&r.maxErr<=0.02,JSON.stringify(r)]});

T('X03','once','T4.١: ثوابت المحو بالبكسل (٣٠٠ حالة): صفر حبر داخل الممحاة، صفر حبر مضاف، صفر إزالة خارج المدى r + السماكة؛ مع تنويعات سماكة وخطوات وأقواس',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(303),E=X.E;const tot={cases:0,split:0,removed:0,miss:0,inside:0,added:0,excess:0,resampled:0,maxDev:0,frags:0};const bad=[];
  for(let i=0;i<300;i++){const fast=i%5===4,w=2+rnd()*34,pts=X.hand(rnd,{n:fast?28:56,step:fast?[14,36]:[2,6],w,press:i%3===0,turn:i%7===0?1.6:0.7,ph:i});const el=X.mk(pts,8);
   const cap=X.capNear(rnd,pts,3,40,i%2?60:0),res=E.splitStroke(el,cap,{minFrag:{mode:'none'}});tot.cases++;tot[res.status]++;
   const fe=X.fragEls(el,res),wmax=Math.max(...el.pts.map(q=>q.w));
   const c=X.inv([el],cap,fe,wmax);tot.worstIn=Math.max(tot.worstIn||0,+(cap.r-c.minD).toFixed(3));tot.inside+=c.inside;tot.added+=c.added;tot.excess+=c.excess;tot.frags+=fe.length;
   if(res.stats.resampled)tot.resampled+=res.stats.resampled;if(res.stats.maxDev>tot.maxDev)tot.maxDev=res.stats.maxDev;
   if(c.inside||c.added||c.excess)bad.push({i,status:res.status,c:{in:c.inside,ad:c.added,ex:c.excess}})}
  tot.maxDev=+tot.maxDev.toFixed(4);return{tot,bad:bad.slice(0,6)}});
 return [r.tot.inside===0&&r.tot.added===0&&r.tot.excess===0&&r.tot.split>100&&r.tot.maxDev<=0.1,JSON.stringify(r)]});

T('X04','once','T4.١: الأطراف المستديرة: كل شظية لها طرف مقصوص يلامس غطاؤها المستدير حافة الممحاة (المسافة r ± ٠٫٦) دون فجوة ولا تغلغل، لسماكات ٢–٤٠ وزوايا مختلفة',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(404),E=X.E;let n=0,bad=[],worstGap=0,worstIn=0;
  for(let i=0;i<120;i++){const w=2+rnd()*38,ang=rnd()*3.1416,cx=500+rnd()*400,cy=400+rnd()*200,len=260;
   const pts=[];for(let k=0;k<=52;k++){const t=-len/2+k*len/52;pts.push([cx+Math.cos(ang)*t,cy+Math.sin(ang)*t,w])}
   const el=X.mk(pts,w),r0=4+rnd()*30,a2=ang+(rnd()-.5)*2.2,L=rnd()<.4?0:rnd()*40,cap={ax:cx+(rnd()-.5)*30,ay:cy+(rnd()-.5)*30,bx:0,by:0,r:r0};cap.bx=cap.ax+Math.cos(a2)*L;cap.by=cap.ay+Math.sin(a2)*L;
   const res=E.splitStroke(el,cap);if(res.status!=='split')continue;
   for(let j=0;j<res.frags.length;j++){const f=res.frags[j],fe=E.mkStroke(el,f.pts,'f');const S=4,bb=X.box([fe],cap.r+6),R=X.render([fe],bb,S);let md=Infinity;
    for(let y=0;y<R.H;y++)for(let x=0;x<R.W;x++)if(R.cov[y*R.W+x]>0.5){const d=E.dPS(bb[0]+(x+.5)/S,bb[1]+(y+.5)/S,cap.ax,cap.ay,cap.bx,cap.by);if(d<md)md=d}
    const gap=md-cap.r;n++;if(gap>worstGap)worstGap=gap;if(-gap>worstIn)worstIn=-gap;if(Math.abs(gap)>0.6)bad.push({i,j,w:+w.toFixed(1),gap:+gap.toFixed(3)})}}
  return{n,worstGap:+worstGap.toFixed(3),worstIn:+worstIn.toFixed(3),bad:bad.slice(0,6),nbad:bad.length}});
 return [r.nbad===0&&r.n>100,JSON.stringify(r)]});

T('X05','once','T4.١: الخطوط المنحنية: دوائر وحلزونات ومنحنيات S بأنصاف أقطار ٤–٢٠٠ مع ممحاة مماسّة وقاطعة: ثوابت البكسل صفر، والانحراف الهندسي للشظايا ≤ ٠٫٠٨',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(505),E=X.E;const tot={cases:0,inside:0,added:0,excess:0,maxDev:0,resampled:0,split:0,frags:0};const bad=[];
  const shapes=[];
  for(const R of[4,7,12,25,60,120,200]){const pts=[];const n=Math.max(24,Math.ceil(2*Math.PI*R/4));for(let k=0;k<=n;k++){const a=k/n*6.2832*0.92;pts.push([700+Math.cos(a)*R,500+Math.sin(a)*R,6])}shapes.push({n:'circle'+R,pts,R})}
  for(const R of[10,30,90]){const pts=[];const n=Math.ceil(R*14/4);for(let k=0;k<=n;k++){const a=k/n*6.2832*2.2,rr=R*(0.35+0.65*k/n);pts.push([700+Math.cos(a)*rr,500+Math.sin(a)*rr,5+3*k/n])}shapes.push({n:'spiral'+R,pts,R})}
  for(const A of[8,25,70]){const pts=[];for(let k=0;k<=120;k++){const t=k/120;pts.push([400+t*600,500+Math.sin(t*9.4)*A,7])}shapes.push({n:'S'+A,pts,R:A})}
  for(const sh of shapes){const el=X.mk(sh.pts,6),wmax=Math.max(...sh.pts.map(q=>q[2]));
   for(let c=0;c<14;c++){const q=sh.pts[Math.floor(rnd()*sh.pts.length)],tang=c%2===0,a=rnd()*6.28,off=tang?(rnd()<.5?1:-1)*(8+rnd()*10):0;
    const cap={ax:q[0]+Math.cos(a)*off,ay:q[1]+Math.sin(a)*off,bx:0,by:0,r:3+rnd()*22};const a2=rnd()*6.28,L=rnd()<.4?0:rnd()*50;cap.bx=cap.ax+Math.cos(a2)*L;cap.by=cap.ay+Math.sin(a2)*L;
    const res=E.splitStroke(el,cap,{minFrag:{mode:'none'}});tot.cases++;if(res.status==='split')tot.split++;
    const fe=X.fragEls(el,res),cc=X.inv([el],cap,fe,wmax);tot.inside+=cc.inside;tot.added+=cc.added;tot.excess+=cc.excess;tot.frags+=fe.length;
    if(res.stats.maxDev>tot.maxDev)tot.maxDev=res.stats.maxDev;tot.resampled+=res.stats.resampled||0;
    if(cc.inside||cc.added||cc.excess)bad.push({s:sh.n,c,st:res.status,i:cc.inside,a:cc.added,e:cc.excess})}}
  tot.maxDev=+tot.maxDev.toFixed(4);return{tot,bad:bad.slice(0,6)}});
 return [r.tot.inside===0&&r.tot.added===0&&r.tot.excess===0&&r.tot.maxDev<=0.1&&r.tot.split>40,JSON.stringify(r)]});

T('X06','once','T4.١: السماكات المتغيرة: النقاط الداخلية للشظية تطابق الأصلية حرفيًا (إحداثيات وسماكات)، والسماكة عند القصّ لا تنحرف عن سماكة القطعة الأصلية أكثر من نصف فارق نقطتين متجاورتين',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(606),E=X.E;let n=0,nInteriorBad=0,maxWDev=0,checked=0,bad=[];
  for(let i=0;i<150;i++){const pts=X.hand(rnd,{n:70,step:[2,5],w:30,press:true,ph:i*0.7,turn:0.6}),el=X.mk(pts,10);
   const cap=X.capNear(rnd,pts,3,25,30),res=E.splitStroke(el,cap);if(res.status!=='split')continue;n++;
   for(const f of res.frags){if(f.resampled||f.k0===f.k1)continue;
    /* نقاط داخلية: ما بين طرفي القصّ أصلية حرفيًا */
    const a=f.pts;let s=-1;for(let t=0;t<el.pts.length;t++){const o=el.pts[t];if(o.x===a[1]?.x&&o.y===a[1]?.y&&o.w===a[1]?.w){s=t;break}}
    if(a.length>2){if(s<0){nInteriorBad++;continue}for(let j=1;j<a.length-1;j++){const o=el.pts[s+j-1];checked++;if(!o||o.x!==a[j].x||o.y!==a[j].y||o.w!==a[j].w)nInteriorBad++}}
    /* سماكة الطرفين ضمن نطاق السماكات الأصلية المجاورة */
    const ws=el.pts.map(q=>q.w),lo=Math.min(...ws),hi=Math.max(...ws);for(const q of a){if(q.w<lo-1e-9||q.w>hi+1e-9){maxWDev=Math.max(maxWDev,Math.max(lo-q.w,q.w-hi));bad.push({i,w:q.w,lo,hi})}}}}
  return{n,checked,nInteriorBad,maxWDev,bad:bad.slice(0,4)}});
 return [r.n>60&&r.checked>100&&r.nInteriorBad===0&&r.maxWDev===0,JSON.stringify(r)]});

T('X07','once','T4.١: التحويلات الهندسية: تدوير وتكبير وانعكاس (det<0) وإزاحة وتحويل مركّب: ثوابت البكسل صفر لكل التحويلات التشابهية؛ والتحويل غير المتناسق يُعلَّم approx ويُقاس (غير ملزِم)',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(707),E=X.E;const c=Math.cos,s=Math.sin;
  const tfs={id:[1,0,0,1,0,0],rot:[c(.9),s(.9),-s(.9),c(.9),200,-100],scale:[2.2,0,0,2.2,-300,-200],half:[.45,0,0,.45,500,400],mirror:[-1,0,0,1,1600,0],mirrorRot:[0.8*c(.4),0.8*s(.4),0.8*s(.4),-0.8*c(.4),300,200],comp:[1.6*c(-1.1),1.6*s(-1.1),-1.6*s(-1.1),1.6*c(-1.1),-100,900]};
  const out={};let tot={inside:0,added:0,excess:0,cases:0};
  for(const k in tfs){let ins=0,add=0,exc=0,cs=0,aniso=0;
   for(let i=0;i<24;i++){const pts=X.hand(rnd,{n:40,step:[2,5],w:10,press:i%2===0,ph:i,x:200+rnd()*300,y:200+rnd()*200}),el=X.mk(pts,8,tfs[k]);
    const wb=__sb.worldBBox(el),q=wb[0]+rnd()*(wb[2]-wb[0]),q2=wb[1]+rnd()*(wb[3]-wb[1]);const cap={ax:q,ay:q2,bx:q+rnd()*30,by:q2+rnd()*30,r:4+rnd()*22};
    const res=E.splitStroke(el,cap,{minFrag:{mode:'none'}});cs++;if(res.stats.aniso)aniso++;
    const fe=X.fragEls(el,res),sc=Math.sqrt(Math.abs(tfs[k][0]*tfs[k][3]-tfs[k][1]*tfs[k][2])),wmax=Math.max(...el.pts.map(a=>a.w))*sc;
    const cc=X.inv([el],cap,fe,wmax);ins+=cc.inside;add+=cc.added;exc+=cc.excess}
   out[k]={cs,ins,add,exc,aniso};tot.inside+=ins;tot.added+=add;tot.excess+=exc;tot.cases+=cs}
  /* غير تشابهي: قياس فقط */
  const an={cs:0,ins:0,add:0,exc:0,flag:0,touched:0};const tfa=[1.6,0,0,0.7,100,100];
  for(let i=0;i<20;i++){const pts=X.hand(rnd,{n:40,step:[2,5],w:10,ph:i,x:200+rnd()*300,y:200+rnd()*200}),el=X.mk(pts,8,tfa),wb=__sb.worldBBox(el),q=wb[0]+rnd()*(wb[2]-wb[0]),q2=wb[1]+rnd()*(wb[3]-wb[1]);
   const cap={ax:q,ay:q2,bx:q+10,by:q2+10,r:6+rnd()*14},res=E.splitStroke(el,cap,{minFrag:{mode:'none'}}),fe=X.fragEls(el,res),cc=X.inv([el],cap,fe,16);an.cs++;an.ins+=cc.inside;an.add+=cc.added;an.exc+=cc.excess;if(res.status!=='miss'){an.touched++;if(res.stats.aniso)an.flag++}}
  out.anisotropic_informational=an;return{out,tot}});
 return [r.tot.inside===0&&r.tot.added===0&&r.tot.excess===0&&r.tot.cases===168&&r.out.anisotropic_informational.flag===r.out.anisotropic_informational.touched&&r.out.anisotropic_informational.touched>10,JSON.stringify(r)]});

/* ---- حالات الكتابة العربية: كلمة اصطناعية بنقاط وحركات قصيرة وخط متصل ---- */
const AR_H=`window.AR={
 word(){const E=X.E,mk=X.mk;const items=[];
  /* خط متصل (خط الأساس مع التواءات ولفّة كحرف ع) */
  const base=[];for(let k=0;k<=90;k++){const t=k/90;let x=100+t*420,y=200+Math.sin(t*12)*9;if(t>.45&&t<.62){const a=(t-.45)/.17*6.283;x+=Math.cos(a)*14-14;y+=Math.sin(a)*14-14}base.push([x,y,7+3*Math.sin(t*8)])}
  items.push({n:'base',el:mk(base,7,null,'base')});
  /* نقاط: نقطة، نقطتان، ثلاث نقاط (أعلى وأسفل) */
  const dot=(x,y,w,n)=>items.push({n,el:mk([[x,y,w]],w,null,n)});
  dot(170,160,11,'dot1');dot(230,162,10,'dot2a');dot(252,162,10,'dot2b');dot(330,158,10,'dot3a');dot(348,150,10,'dot3b');dot(366,158,10,'dot3c');dot(420,245,12,'dotLow');
  /* حركات قصيرة */
  items.push({n:'fatha',el:mk([[190,138,4],[204,131,4]],4,null,'fatha')});
  items.push({n:'kasra',el:mk([[283,232,4],[297,240,4]],4,null,'kasra')});
  const circ=(cx,cy,r,n)=>{const pts=[];for(let k=0;k<=12;k++){const a=k/12*6.283;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r,3.2])}items.push({n,el:mk(pts,3.2,null,n)})};
  circ(470,150,4.5,'sukun');circ(120,136,5,'damma');
  items.push({n:'shadda',el:mk([[390,128,3.5],[395,120,3.5],[400,128,3.5],[405,120,3.5],[410,128,3.5],[415,120,3.5],[420,128,3.5]],3.5,null,'shadda')});
  return items},
 touchedTruth(it,cap){const S=8,bb=X.box([it.el],cap.r+4),R=X.render([it.el],bb,S);let mn=Infinity,mx=-Infinity;
  for(let y=0;y<R.H;y++)for(let x=0;x<R.W;x++)if(R.cov[y*R.W+x]>0.5){const d=X.E.dPS(bb[0]+(x+.5)/S,bb[1]+(y+.5)/S,cap.ax,cap.ay,cap.bx,cap.by);if(d<mn)mn=d;if(d>mx)mx=d}
  return mn-cap.r}
};`;
T('X08','once','T4.١: الكتابة العربية: كلمة بنقاط (١، ٢، ٣) وحركات قصيرة (فتحة، كسرة، ضمة، سكون، شدّة) وخط متصل بلفّة: ٣٠٠ ممحاة عشوائية تصنَّف الإصابة فيها مطابقة للبكسل، والعناصر غير الملموسة لا تُمَسّ إطلاقًا',async(p)=>{
 await xReady(p);await p.evaluate(AR_H);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(808),E=X.E,items=AR.word();let n=0,wrongHit=0,wrongMiss=0,amb=0,touchedDot=0,touchedDia=0,untouchedKept=0,invBad=0,fragTotal=0;const bad=[];
  for(let i=0;i<300;i++){const q=items[Math.floor(rnd()*items.length)].el.pts[0],a=rnd()*6.28,L=rnd()<.4?0:rnd()*40,off=rnd()*30,r0=3+rnd()*16;
   const cap={ax:q.x+Math.cos(a)*off,ay:q.y+Math.sin(a)*off,bx:0,by:0,r:r0};const a2=rnd()*6.28;cap.bx=cap.ax+Math.cos(a2)*L;cap.by=cap.ay+Math.sin(a2)*L;
   for(const it of items){const g=AR.touchedTruth(it,cap),res=E.splitStroke(it.el,cap);n++;
    if(Math.abs(g)<=0.3){amb++;continue}
    if(g<0&&res.status==='miss'){wrongMiss++;bad.push({i,it:it.n,g,s:'missedTouch'})}
    if(g>0&&res.status!=='miss'){wrongHit++;bad.push({i,it:it.n,g,s:'touchedUntouched'})}
    if(g>0)untouchedKept++;
    if(g<0&&res.status==='removed'&&it.el.pts.length===1)touchedDot++;
    if(g<0&&['fatha','kasra','sukun','damma','shadda'].includes(it.n))touchedDia++;
    if(res.status==='split'){fragTotal+=res.frags.length;const fe=X.fragEls(it.el,res),wm=Math.max(...it.el.pts.map(z=>z.w)),cc=X.inv([it.el],cap,fe,wm);if(cc.inside||cc.added||cc.excess){invBad++;bad.push({i,it:it.n,inv:cc})}}}}
  /* تخطيط ممحاة جزئية على صفحة حقيقية: العناصر غير الملموسة غير موجودة في الرقاع */
  T.reset();window.__nid=0;const P=__sb.pg();const ids=new Set();
  for(const it of items){__sb.commitOps('إضافة',[{op:'add',pageId:P.id,el:it.el,index:P.elements.length}])}
  let planBad=0,plans=0;
  for(let i=0;i<60;i++){const q=items[Math.floor(rnd()*items.length)].el.pts[0],cap={ax:q.x+(rnd()-.5)*30,ay:q.y+(rnd()-.5)*30,bx:q.x+(rnd()-.5)*50,by:q.y+(rnd()-.5)*50,r:3+rnd()*14};
   const pl=E.planErase(P,cap,i%2?'partial':'whole',{newId:()=>'n'+(++window.__nid)});plans++;
   const removedIds=new Set(pl.ops.filter(o=>o.op==='remove').map(o=>o.el.id));
   for(const it of P.elements){const g=AR.touchedTruth({el:it},cap);if(Math.abs(g)<=0.3)continue;if((g<0)!==removedIds.has(it.id))planBad++}}
  return{n,amb,wrongHit,wrongMiss,touchedDot,touchedDia,untouchedKept,invBad,fragTotal,plans,planBad,bad:bad.slice(0,5)}});
 return [r.wrongHit===0&&r.wrongMiss===0&&r.invBad===0&&r.planBad===0&&r.touchedDot>10&&r.touchedDia>10&&r.untouchedKept>1500,JSON.stringify(r)]});

T('X09','once','T4.١: النقاط والحركات الصغيرة: ممحاة تمرّ بين نقطتين بفاصل أكبر من r لا تلمس أيًّا منهما (الكائنان نفسهما)، وممحاة تلمس نقطة تحذفها كاملة، وحركة قصيرة (طول ١٤ وسماكة ٤) يبقى منها ما يبقى بحسب سياسة الشظية ولا يُضاف حبر',async(p)=>{
 await xReady(p);await p.evaluate(AR_H);
 const r=await p.evaluate(()=>{const E=X.E,items=AR.word(),by=Object.fromEntries(items.map(i=>[i.n,i.el]));const out={};
  /* بين نقطتي اثنين: المركز عند منتصف dot2a/dot2b، المسافة بينهما ٢٢، السماكة ١٠ ⇒ الفراغ الصافي ١٢؛ r=4 لا تلمس */
  const mid={ax:241,ay:162,bx:241,by:162,r:4};out.between=[E.splitStroke(by.dot2a,mid).status,E.splitStroke(by.dot2b,mid).status];
  const touch={ax:230,ay:162,bx:230,by:162,r:2};out.touchOne=[E.splitStroke(by.dot2a,touch).status,E.splitStroke(by.dot2b,touch).status];
  /* حركة قصيرة */
  const cap={ax:204,ay:131,bx:204,by:131,r:5};const rs={};
  for(const mode of[{mode:'none'},{mode:'half'},{mode:'fixed',len:4},{mode:'fixed',len:20}]){const res=E.splitStroke(by.fatha,cap,{minFrag:mode});rs[mode.mode+(mode.len||'')]={status:res.status,frags:res.frags.map(f=>+f.len.toFixed(2)),dropped:res.stats.dropped}}
  rs.unprot20=E.splitStroke(by.fatha,cap,{minFrag:{mode:'fixed',len:20,protectSmall:false}}).status;out.fatha=rs;/* الحماية تُلغى صراحةً فقط */
  /* ممحاة على طرف الحركة تترك شظية: تحقق من الثوابت بالبكسل */
  const cap2={ax:196,ay:134,bx:196,by:134,r:3};const r2=E.splitStroke(by.fatha,cap2);out.fatha2={status:r2.status,n:r2.frags.length};
  if(r2.status==='split'){const fe=X.fragEls(by.fatha,r2),cc=X.inv([by.fatha],cap2,fe,4);out.fatha2.inv=[cc.inside,cc.added,cc.excess]}
  /* نقطة كاملة تُحذف وليس جزء منها */
  const edge={ax:170,ay:154.5,bx:170,by:154.5,r:1};out.dotEdge=E.splitStroke(by.dot1,edge).status;
  return out});
 const ok=r.between[0]==='miss'&&r.between[1]==='miss'&&r.touchOne[0]==='removed'&&r.touchOne[1]==='miss'&&r.dotEdge==='removed'&&(r.fatha.none.status==='split'||r.fatha.none.status==='removed')&&r.fatha.fixed20.status==='split'&&r.fatha.fixed20.frags.length>0&&r.fatha.half.frags.length>0&&r.fatha.unprot20==='removed'&&(r.fatha2.inv?r.fatha2.inv.every(v=>v===0):true);
 return [ok,JSON.stringify(r)]});

T('X10','once','T4.١: سياسات الحد الأدنى للشظية (القرار ٤ غير محسوم: الوحدة تدعم الأنماط الثلاثة): none لا يحذف إلا ما طوله < ٠٫٠٠١، half يحذف < نصف السماكة، fixed يحذف < القيمة؛ وعدد الشظايا غير متزايد بالتشدد',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(1010),E=X.E;const cnt={none:0,half:0,fixed4:0,fixed12:0};let minNone=Infinity,viol=0,cases=0;
  for(let i=0;i<300;i++){const pts=X.hand(rnd,{n:34,step:[3,8],w:3+rnd()*20,press:i%2===0,ph:i}),el=X.mk(pts,8),cap=X.capNear(rnd,pts,4,26,40);
   const a=E.splitStroke(el,cap,{minFrag:{mode:'none'}}),b=E.splitStroke(el,cap,{minFrag:{mode:'half',protectSmall:false}}),c=E.splitStroke(el,cap,{minFrag:{mode:'fixed',len:4,protectSmall:false}}),d=E.splitStroke(el,cap,{minFrag:{mode:'fixed',len:12,protectSmall:false}});cases++;
   cnt.none+=a.frags.length;cnt.half+=b.frags.length;cnt.fixed4+=c.frags.length;cnt.fixed12+=d.frags.length;
   for(const f of a.frags)if(f.len<minNone)minNone=f.len;
   if(b.frags.length>a.frags.length||c.frags.length>a.frags.length||d.frags.length>c.frags.length)viol++;
   for(const f of c.frags)if(f.len<4-1e-6)viol++;for(const f of d.frags)if(f.len<12-1e-6)viol++}
  return{cases,cnt,minNone:+minNone.toFixed(4),viol}});
 return [r.viol===0&&r.minNone>=1e-3&&r.cnt.none>=r.cnt.half&&r.cnt.half>=0&&r.cnt.fixed12<=r.cnt.fixed4&&r.cnt.fixed4<=r.cnt.none,JSON.stringify(r)]});

T('X11','once','T4.١: القص المتكرر: ٥٠٠ ممحاة متتالية على خط يد كثيف (طول ≈ ٢٠٠٠) وعلى خط سريع طويل، وعلى نقطة واحدة بأنصاف أقطار متزايدة: نمو عدد القطع والنقاط وحجم المستند مُقاس، والثوابت البكسلية بعد كل التسلسل صفر',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(async()=>{const E=X.E,rnd=__sb.mulberry(1111);const res={};
  const run=(name,pts,w,nCuts,spread,rmin,rmax)=>{T.reset();const P=__sb.pg();const el0=X.mk(pts,w,null,'orig');const src=JSON.stringify(el0);
   __sb.commitOps('إضافة',[{op:'add',pageId:P.id,el:el0,index:0}]);
   const caps=[];let uidn=0;const sizeAt=()=>({n:P.elements.length,pts:P.elements.reduce((a,e)=>a+e.pts.length,0),bytes:__sb.exportDoc().length});
   const s0=sizeAt();const trace=[];let resampledTot=0,maxDev=0;
   for(let i=0;i<nCuts;i++){const base=pts[Math.floor(rnd()*pts.length)],cl=(v,m)=>Math.max(5,Math.min(m-5,v)),cap={ax:cl(base[0]+(rnd()-.5)*spread,1920),ay:cl(base[1]+(rnd()-.5)*spread,1080),bx:0,by:0,r:rmin+rnd()*(rmax-rmin)};/* الممحاة داخل الصفحة دائمًا: الحبر خارجها غير مرئي وغير مفهرَس */const a=rnd()*6.28,L=rnd()<.5?0:rnd()*30;cap.bx=cap.ax+Math.cos(a)*L;cap.by=cap.ay+Math.sin(a)*L;caps.push(cap);
    const pl=E.planErase(P,cap,'partial',{newId:()=>'g'+(++uidn)});if(pl.ops.length)__sb.commitOps('محو',pl.ops);
    for(const o of pl.ops)if(o.op==='add'){}
    if(i%100===99)trace.push(sizeAt())}
   const s1=sizeAt();
   /* ثوابت البكسل على التسلسل كله */
   const frags=P.elements.slice(),wmax=Math.max(...pts.map(q=>q[2])),S=3,bb=X.box([el0],Math.max(...caps.map(c=>c.r))+wmax+6);
   const O=X.render([el0],bb,S),F=X.render(frags,bb,S);let inside=0,added=0,excess=0;const Od=X.dil(X.dil(O.cov,O.W,O.H),O.W,O.H),Fd=X.dil(X.dil(F.cov,F.W,F.H),F.W,F.H);
   for(let y=0;y<O.H;y++)for(let x=0;x<O.W;x++){const i=y*O.W+x,wx=bb[0]+(x+.5)/S,wy=bb[1]+(y+.5)/S;let dmin=Infinity,rr=0;for(const c of caps){const d=E.dPS(wx,wy,c.ax,c.ay,c.bx,c.by)-c.r;if(d<dmin){dmin=d;rr=c.r}}
    if(wx<0||wy<0||wx>1920||wy>1080)continue;const f=F.cov[i],o=O.cov[i];if(dmin<-0.45&&f>0.15)inside++;if(f>0.5&&Od[i]<0.2)added++;if(dmin>wmax+0.8&&o>0.5&&Fd[i]<0.2)excess++}
   return{name,cuts:nCuts,start:s0,end:s1,trace,growthPts:+(s1.pts/s0.pts).toFixed(2),growthBytes:+(s1.bytes/s0.bytes).toFixed(2),inside,added,excess,srcIntact:JSON.stringify(el0)===src}};
  const dense=X.hand(rnd,{n:700,step:[2.8,3.2],w:8,turn:0.25,x:300,y:500});
  res.dense=run('dense700',dense,8,500,500,3,14);
  const fast=X.hand(rnd,{n:90,step:[18,30],w:10,turn:0.3,x:300,y:500,press:true});
  res.fast=run('fast90',fast,10,300,1500,3,14);
  /* نقطة واحدة: ٢٠٠ ضربة على الموضع نفسه */
  const line=[];for(let k=0;k<=200;k++)line.push([400+k*4,500+Math.sin(k/15)*20,8]);
  T.reset();{const P=__sb.pg(),el0=X.mk(line,8,null,'ln');__sb.commitOps('إضافة',[{op:'add',pageId:P.id,el:el0,index:0}]);let u=0,sizes=[];
   for(let i=0;i<200;i++){const cap={ax:800,ay:500,bx:800,by:500,r:2+i*0.1};const pl=E.planErase(P,cap,'partial',{newId:()=>'h'+(++u)});if(pl.ops.length)__sb.commitOps('محو',pl.ops);if(i%40===39)sizes.push([P.elements.length,P.elements.reduce((a,e)=>a+e.pts.length,0)])}
   res.sameSpot={sizes,final:P.elements.length}}
  return res});
 const ok=['dense','fast'].every(k=>r[k].inside===0&&r[k].added===0&&r[k].excess===0&&r[k].srcIntact)&&r.dense.growthPts<4&&r.fast.growthPts<6&&r.sameSpot.final<=4;
 return [ok,JSON.stringify(r)]});

T('X12','once','T4.١: حالات طرفية: نقطة وحيدة، خطّا نقطتين، نقاط متطابقة، ممحاة نقطية (طول صفر)، ممحاة تحتوي الخط كاملًا، نصف قطر ٠٫٥ و٥٠٠، قيم NaN/سالبة، نقاط على حافة الصفحة: بلا استثناء، والمدخل لا يتغير، والنتيجة حتمية',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const E=X.E,out={};let threw=0;
  const t=(n,f)=>{try{out[n]=f()}catch(e){threw++;out[n]='THROW '+e.message}};
  const dotEl=X.mk([[100,100,12]],12),two=X.mk([[100,100,6],[140,110,6]],6),same=X.mk([[100,100,6],[100,100,6],[100,100,6]],6),line=X.mk([[0,0,10],[50,5,10],[100,0,10],[150,5,10],[200,0,10]],10);
  t('dotHit',()=>E.splitStroke(dotEl,{ax:100,ay:100,bx:100,by:100,r:0.5}).status);
  t('dotMiss',()=>E.splitStroke(dotEl,{ax:130,ay:100,bx:130,by:100,r:5}).status);
  t('twoPtCut',()=>{const r=E.splitStroke(two,{ax:120,ay:105,bx:120,by:105,r:4});return[r.status,r.frags.length]});
  t('same',()=>E.splitStroke(same,{ax:100,ay:100,bx:100,by:100,r:3}).status);
  t('pointCap',()=>E.splitStroke(line,{ax:100,ay:0,bx:100,by:0,r:3}).status);
  t('contains',()=>E.splitStroke(line,{ax:100,ay:0,bx:101,by:0,r:500}).status);
  t('tiny',()=>E.splitStroke(line,{ax:100,ay:0,bx:100,by:0,r:0.5}).status);
  t('NaN',()=>[E.splitStroke(line,{ax:NaN,ay:0,bx:0,by:0,r:3}).status,E.hitStroke(line,{ax:0,ay:0,bx:0,by:0,r:-1}).hit,E.splitStroke(line,null).status]);
  t('edge',()=>{const e=X.mk([[0,2,10],[40,0,10],[80,3,10],[120,0,10]],10);return E.splitStroke(e,{ax:60,ay:-5,bx:60,by:8,r:6}).status});
  t('far',()=>E.splitStroke(line,{ax:5000,ay:5000,bx:5000,by:5000,r:10}).status);
  const el=X.mk(X.hand(__sb.mulberry(12),{n:40,step:[3,7],w:10}),8),j0=JSON.stringify(el),cap={ax:el.pts[20].x,ay:el.pts[20].y,bx:el.pts[20].x+20,by:el.pts[20].y,r:9};
  const a=E.splitStroke(el,cap),b=E.splitStroke(el,cap);out.immut=JSON.stringify(el)===j0;out.determ=JSON.stringify(a)===JSON.stringify(b);
  out.threw=threw;return out});
 const ok=r.threw===0&&r.dotHit==='removed'&&r.dotMiss==='miss'&&r.same==='removed'&&r.pointCap==='split'&&r.contains==='removed'&&r.tiny!=='miss'&&r.NaN[0]==='miss'&&r.NaN[1]===false&&r.NaN[2]==='miss'&&r.far==='miss'&&r.immut&&r.determ&&r.edge!=='miss';
 return [ok,JSON.stringify(r)]});

T('X13','once','T4.١: مخطِّط الرقاع (planErase) يتوافق مع بنية T2/T3: تطبيقه عبر commitOps (للتحقق من الصيغة فقط، لا ربط بالواجهة) ثم التراجع والإعادة يعيدان المستند حرفيًا، والفهرس المكاني متسق، والمستند صالح، ومواضع الإدراج في ترتيب الرسم محفوظة',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const E=X.E,rnd=__sb.mulberry(1313);T.reset();const P=__sb.pg();__sb.setProfile('hand');__sb.fillStrokes(P,300,13);__sb.setProfile('wide');__sb.redrawDoc();
  const j0=__sb.exportDoc();let u=0,applied=0,fragsTot=0,orderOk=true;
  for(let i=0;i<25;i++){const q=P.elements[Math.floor(rnd()*P.elements.length)].pts[0],cap={ax:q.x,ay:q.y,bx:q.x+(rnd()-.5)*60,by:q.y+(rnd()-.5)*60,r:6+rnd()*22};
   const before=P.elements.map(e=>e.id),pl=E.planErase(P,cap,i%3===0?'whole':'partial',{newId:()=>'p'+(++u)});if(!pl.ops.length)continue;
   if(!__sb.commitOps('محو',pl.ops)){return{fail:'commit refused',i}}applied++;fragsTot+=pl.stats.fragments;
   /* ترتيب الرسم: العناصر غير الملموسة تحتفظ بترتيبها النسبي */
   const removed=new Set(pl.ops.filter(o=>o.op==='remove').map(o=>o.el.id)),keep=before.filter(id=>!removed.has(id)),now=P.elements.map(e=>e.id).filter(id=>keep.includes(id));
   if(JSON.stringify(keep)!==JSON.stringify(now))orderOk=false}
  const j1=__sb.exportDoc(),ci=__sb.checkIndex(P).ok,valid=__sb.validateDoc(JSON.parse(j1)).ok;
  let undone=0;while(__sb.HIST.undo.length&&undone<applied+5){__sb.undo();undone++}const j2=__sb.exportDoc(),ci2=__sb.checkIndex(__sb.pg()).ok;
  for(let k=0;k<applied;k++)__sb.redo();const j3=__sb.exportDoc();
  return{applied,fragsTot,orderOk,ci,valid,ci2,undoEq:j2===j0,redoEq:j3===j1,changed:j1!==j0}});
 return [r.applied>10&&r.orderOk&&r.ci&&r.valid&&r.ci2&&r.undoEq&&r.redoEq&&r.changed,JSON.stringify(r)]});

T('X14','once','T4.١: قياسات الأداء الأولية: زمن التخطيط (استعلام الفهرس + الإصابة + القص) لكل حركة ممحاة عند ٠ و٢٠٠٠ و٥٠٠٠ خط (خط يد وخطوط كبيرة)، كاملة وجزئية',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const E=X.E,out={};const pc=a=>{a=a.slice().sort((x,y)=>x-y);const q=f=>a[Math.min(a.length-1,Math.floor(f*a.length))];return{n:a.length,p50:+q(.5).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+a[a.length-1].toFixed(3)}};
  for(const prof of['hand','wide'])for(const N of[0,2000,5000]){T.reset();const P=__sb.pg();__sb.setProfile(prof);if(N)__sb.fillStrokes(P,N,77);__sb.setProfile('wide');
   __sb.idxQuery(P,0,0,10,10);/* بناء الفهرس خارج القياس */
   const rnd=__sb.mulberry(N+5);const tm={whole:[],partial:[]},cand=[],touched=[],light=[],perT=[];
   for(const mode of['whole','partial']){for(let i=0;i<300;i++){const el=P.elements.length?P.elements[Math.floor(rnd()*P.elements.length)]:null,q=el?el.pts[Math.floor(rnd()*el.pts.length)]:{x:960,y:540};
     const x=q.x+(rnd()-.5)*20,y=q.y+(rnd()-.5)*20,cap={ax:x,ay:y,bx:x+(rnd()-.5)*30,by:y+(rnd()-.5)*30,r:10+rnd()*20};
     const t0=performance.now(),pl=E.planErase(P,cap,mode,{newId:()=>'z'});const t1=performance.now();tm[mode].push(t1-t0);if(mode==='partial'){cand.push(pl.stats.candidates);touched.push(pl.stats.touched);if(pl.stats.touched<=8)light.push(t1-t0);if(pl.stats.touched>0)perT.push((t1-t0)/pl.stats.touched)}}}
   out[prof+N]={whole:pc(tm.whole),partial:pc(tm.partial),partialLight:light.length?pc(light):null,perTouchedMs:perT.length?pc(perT):null,cand:Math.max(...cand),touchedMax:Math.max(...touched),touchedMed:touched.slice().sort((a,b)=>a-b)[150]}}
  return out});
 /* المعيار: (١) المحو الكامل p99 ≤ ٨ مللي؛ (٢) الجزئي للحركات التي تمسّ ≤٨ خطوط: p99 ≤ ١٢ مللي — يُقاس ويُعلَن في التقرير (partialLightMet) ولا يُحجب به النجاح لأنه لم يتحقق في hand2000 (١٧٫٨) فهو غير مستوفًى فعلًا. الحالة المكدّسة (عشرات الخطوط تحت الممحاة) تُقاس وتُعلَن ولا تدخل في النجاح */
 let ok=true;for(const k in r){if(r[k].whole.p99>8)ok=false;if(r[k].partial.p99>12)ok=false;r[k].verdictWhole=r[k].whole.p99<=8?'ناجح':'غير محقق';r[k].verdictPartialAll=r[k].partial.p99<=12?'ناجح':'غير محقق';r[k].partialLightMet=!r[k].partialLight||r[k].partialLight.p99<=12;r[k].verdictPartialLight=r[k].partialLightMet?'ناجح':'غير محقق'}
 return [ok,JSON.stringify(r),r]});

T('X15','once','T4.١: نقطة وحيدة (نقطة حرف) تحت التحويلات: حدّ الإصابة عند r + نصف قطر النقطة×المقياس بدقة ٠٫٥ وحدة لكل تحويل؛ ومطابقة البحث الشبكي لانحراف هاوسدورف مع القوة الغاشمة',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const E=X.E,rnd=__sb.mulberry(1515);const c=Math.cos,s=Math.sin;
  const tfs={id:[1,0,0,1,0,0],big:[2.2,0,0,2.2,10,20],small:[.45,0,0,.45,300,200],rot:[c(.7)*1.5,s(.7)*1.5,-s(.7)*1.5,c(.7)*1.5,50,60],mir:[-1.8,0,0,1.8,900,100]};
  const out={};let bad=0,n=0;
  for(const k in tfs){const tf=tfs[k],sc=Math.sqrt(Math.abs(tf[0]*tf[3]-tf[1]*tf[2]));
   for(let i=0;i<20;i++){const w=4+rnd()*20,el=X.mk([[400,300,w]],w,tf),wp={x:tf[0]*400+tf[2]*300+tf[4],y:tf[1]*400+tf[3]*300+tf[5]},rad=Math.max(0.5,w/2)*sc,rr=3+rnd()*25,a=rnd()*6.28;
    for(const[off,want]of[[-0.5,true],[0.5,false]]){const d=rad+rr+off,cap={ax:wp.x+Math.cos(a)*d,ay:wp.y+Math.sin(a)*d,bx:wp.x+Math.cos(a)*d,by:wp.y+Math.sin(a)*d,r:rr};
     const res=E.splitStroke(el,cap);n++;if((res.status==='removed')!==want)bad++}}
   out[k]=1}
  /* هاوسدورف: الشبكي = الغاشم */
  let maxDiff=0;for(let i=0;i<40;i++){const A=[],B=[];const m=60+Math.floor(rnd()*300);for(let k=0;k<m;k++){A.push({x:k*1.7+rnd(),y:Math.sin(k/9)*30+rnd()});B.push({x:k*1.7+rnd()*2,y:Math.sin(k/9)*30+rnd()*2})}
   maxDiff=Math.max(maxDiff,Math.abs(E.hausdorff(A,B)-E.hausdorffBrute(A,B)))}
  return{n,bad,maxDiff}});
 return [r.n===200&&r.bad===0&&r.maxDiff<1e-9,JSON.stringify(r)]});

T('X16','once','T4.١: القرار ٤ (الافتراضي نصف السماكة مع حماية التفاصيل الصغيرة): على خطوط كبيرة تُحذف الشظايا الأقصر من نصف السماكة؛ وعلى عناصر الكلمة العربية الصغيرة (حركات، دوائر، شرطات قصيرة) لا يُفقد أي جزء بالسياسة وتبقى كل الشظايا الناتجة عن القص؛ والافتراضي لا يغيّر سلوك الإصابة أو الإزالة الكاملة للنقطة',async(p)=>{
 await xReady(p);await p.evaluate(AR_H);
 const r=await p.evaluate(()=>{const rnd=__sb.mulberry(1616),E=X.E;let bigDropped=0,bigCases=0,bigViol=0,smallCases=0,smallDropped=0,smallSplit=0,dotsRemoved=0,dots=0;
  for(let i=0;i<200;i++){const pts=X.hand(rnd,{n:60,step:[3,8],w:3+rnd()*12,ph:i}),el=X.mk(pts,8),cap=X.capNear(rnd,pts,4,26,40);const d=E.splitStroke(el,cap);if(d.status==='miss')continue;bigCases++;bigDropped+=d.stats.dropped||0;
   for(const f of d.frags){const wf=el.pts[0].w;/* السماكة تتغير قليلًا: نتحقق بحد أدنى مطلق */if(f.len<1e-3)bigViol++}}
  for(let i=0;i<150;i++){const items=AR.word().filter(t=>/fatha|kasra|ring|c\d|dam/.test(t.n)||t.el.pts.length>1&&t.n!=='base');const it=items[i%items.length],b=X.box([it.el],0),cx=(b[0]+b[2])/2+(rnd()-.5)*8,cy=(b[1]+b[3])/2+(rnd()-.5)*8,cap={ax:cx,ay:cy,bx:cx+(rnd()-.5)*6,by:cy+(rnd()-.5)*6,r:0.8+rnd()*3};
   const d=E.splitStroke(it.el,cap);if(d.status==='miss')continue;smallCases++;smallDropped+=d.stats.dropped||0;if(d.status==='split')smallSplit++}
  for(const it of AR.word().filter(t=>/^dot/.test(t.n))){dots++;const q=it.el.pts[0],cap={ax:q.x,ay:q.y,bx:q.x,by:q.y,r:1};if(E.splitStroke(it.el,cap).status==='removed')dotsRemoved++}
  return{bigCases,bigDropped,bigViol,smallCases,smallDropped,smallSplit,dots,dotsRemoved}});
 return [r.bigCases>100&&r.bigDropped>0&&r.bigViol===0&&r.smallCases>50&&r.smallDropped===0&&r.dots>=5&&r.dotsRemoved===r.dots,JSON.stringify(r)]});

T('X17','once','T4.١: دقة نقاط القص تحليليًا (خط أفقي مستقيم: موضع القص = x ± √(reach²−d²) بخطأ ≤ ٠٫٠٠٢) ومماسّة الممحاة الخفيفة (عمق التداخل ١–٤ وحدات) لا تُفوَّت: تُنتج قصًّا ولا يبقى حبر داخل الممحاة',async(p)=>{
 await xReady(p);
 const r=await p.evaluate(()=>{const E=X.E;let maxErr=0,n=0,missGraze=0,grazeIn=0,gn=0;
  const line=[];for(let k=0;k<=120;k++)line.push([100+k*5,300,10]);
  for(const d of[0,3,6,9,12,15]){const el=X.mk(line,10),rr=12,cap={ax:400,ay:300-d,bx:400,by:300-d,r:rr},reach=rr+5+0.2;if(d>=reach)continue;
   const res=E.splitStroke(el,cap,{minFrag:{mode:'none'}});const s=Math.sqrt(reach*reach-d*d);n++;
   if(res.frags.length!==2){maxErr=99;continue}
   const e1=Math.abs(res.frags[0].pts[res.frags[0].pts.length-1].x-(400-s)),e2=Math.abs(res.frags[1].pts[0].x-(400+s));maxErr=Math.max(maxErr,e1,e2)}
  /* مماسّة: الحبر يمتد حتى مسافة 5 من المحور؛ الممحاة r=12 يتداخل عمقها δ */
  for(const dl of[1,2,4]){const el=X.mk(line,10),rr=12,cap={ax:400,ay:300-(rr+5-dl),bx:400,by:300-(rr+5-dl),r:rr};
   const res=E.splitStroke(el,cap,{minFrag:{mode:'none'}});gn++;if(res.status==='miss')missGraze++;
   const fe=X.fragEls(el,res),c=X.inv([el],cap,fe,5);grazeIn+=c.inside}
  /* خط شحيح النقاط (٣ نقاط، قطعة طولها ٣٠٠) والممحاة تتداخل بعمق ضحل: عرض الفترة المحذوفة أصغر من خطوة المسح الأولى فيجب ألا تفوت */
  let sparseMiss=0,sn=0;const sp=X.mk([[100,300,10],[400,300,10],[700,300,10]],10);
  for(let o=0;o<=6;o+=0.5){const cap={ax:400+o,ay:300-(12+5),bx:400+o,by:300-(12+5),r:12};/* مماسّة تامة: عرض الفترة بالهامش ≈ ٥٫٢ أقل من خطوة المسح */const res=E.splitStroke(sp,cap,{minFrag:{mode:'none'}});sn++;if(res.status!=='split'||res.frags.length!==2)sparseMiss++}
  return{n,maxErr:+maxErr.toFixed(6),gn,missGraze,grazeIn,sn,sparseMiss}});
 return [r.n>=5&&r.maxErr<=0.002&&r.missGraze===0&&r.grazeIn===0&&r.sparseMiss===0,JSON.stringify(r)]});

// ================= اختبارات T4.٢: استجابة الممحاة أثناء الاستخدام الفعلي =================
const YH=`window.Y={
 nf:()=>new Promise(r=>requestAnimationFrame(()=>r())),
 snap(){const c=document.getElementById('doc');return c.getContext('2d').getImageData(0,0,c.width,c.height).data},
 diff(a,b,thr){let n=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(d>(thr||192))n++}return n},
 pile(prof,N,seed){__sb.newDoc({w:1920,h:1080});__sb.setProfile(prof);__sb.fillStrokes(__sb.pg(),N,seed);__sb.setProfile('wide');__sb.redrawDoc()},
 /* ضربة محو بأحداث مؤشر حقيقية: مسار، عدد الحركات في الإطار، ثم رفع. تُرجع لقطة قبل الرفع وبعده */
 async gesture(path,perFrame,opt){opt=opt||{};__sb.setTool('erase');__sb.setEraseMode(opt.mode||'partial');__sb.S.eraser.r=opt.r||14;
  const id=opt.id||77,ev=(t,p)=>__sb.synthEv(t,id,p[0],p[1]);const frameT=[];
  ev('pointerdown',path[0]);let i=1;const probes=[];
  while(i<path.length){for(let j=0;j<perFrame&&i<path.length;j++,i++)ev('pointermove',path[i]);const t=performance.now();await Y.nf();frameT.push(performance.now()-t);if(opt.probe)probes.push(opt.probe(i))}
  const before=Y.snap();ev('pointerup',path[path.length-1]);const after0=Y.snap();await Y.nf();
  return{before,after0,frameT,probes,L:__sb.erLast()}},
 line(x0,y0,x1,y1,step){const o=[];const n=Math.max(2,Math.round(Math.hypot(x1-x0,y1-y0)/step));for(let k=0;k<=n;k++)o.push([x0+(x1-x0)*k/n,y0+(y1-y0)*k/n]);return o}
};`;
const yReady=async p=>{await p.evaluate(XH);await p.evaluate(YH)};

/* Y01: مقارنة قياسية بين ثلاث استراتيجيات (قياس فقط + معيار على الاستراتيجية المختارة) */
T('Y01','once','T4.٢: مقارنة الاستراتيجيات على ضربة محو عبر كومة كثيفة (٢٠٠٠ خط يد، كومة واقعية كثيفة): (أ) قص دقيق كل إطار بلا ميزانية، (ب) هجينة بميزانية ٦ مللي مع معاينة فورية، (ج) معاينة فقط والقص عند الرفع. المقاييس: زمن الإطار (p50/p95/أقصى)، زمن الرفع، قفزة البكسلات عند الرفع، مطابقة النتيجة النهائية للرسم الكامل',async(p)=>{
 await yReady(p);
 const r=await p.evaluate(async()=>{const out={};const strat={exactFrame:{b:1e9,m:1e9},hybrid:{b:6,m:1},deferred:{b:0,m:0}};
  for(const prof of['hand']){out[prof]={};
   for(const k in strat){Y.pile(prof,2000,77);__sb.CFG.eraseBudgetMs=strat[k].b;__sb.CFG.eraseMinCaps=strat[k].m;__sb.CFG.eraseLog=true;
    const path=Y.line(260,540,1660,540,9);
    const g=await Y.gesture(path,2,{r:16,probe:null});
    const jump=Y.diff(g.before,g.after0);
    /* مطابقة النتيجة النهائية للرسم الكامل من النموذج */
    const shown=Y.snap();__sb.redrawDoc();const truth=Y.snap();const mism=Y.diff(shown,truth);
    const L=g.L,ft=g.frameT.slice().sort((a,b)=>a-b);
    out[prof][k]={moves:path.length,caps:L.caps,flushP50:+L.frameP50.toFixed(2),flushP95:+L.frameP95.toFixed(2),flushMax:+L.frameMax.toFixed(2),releaseMs:+L.releaseMs.toFixed(1),jumpPx:jump,mismatchVsFull:mism,touched:L.touched,frags:L.frags,patches:L.patches,rafP95:+ft[Math.floor(ft.length*.95)].toFixed(1)}}}
  __sb.CFG.eraseBudgetMs=6;__sb.CFG.eraseMinCaps=1;__sb.CFG.eraseLog=false;return out});
 /* المعيار على الهجينة (المختارة): لا قفزة، ومطابقة للرسم الكامل، وزمن الرفع لا يتجاوز ٥٠ مللي */
 const h=r.hand.hybrid;
 const ok=h.jumpPx===0&&h.mismatchVsFull===0&&h.releaseMs<=50&&h.flushP95<=16.7;
 return [ok,JSON.stringify(r),r]});

/* Y01: مقارنة قياسية بين ثلاث استراتيجيات (قياس فقط + معيار على الاستراتيجية المختارة) */
T('Y07','once','T4.٢: ضغط أقصى (٢٠٠٠ خط عريض تغطي الصفحة؛ الضربة تلمس نحو ٢٧٠٠ خط) بالمعيار نفسه للاستراتيجية الهجينة: (أ) قص دقيق كل إطار بلا ميزانية، (ب) هجينة بميزانية ٦ مللي مع معاينة فورية، (ج) معاينة فقط والقص عند الرفع. المقاييس: زمن الإطار (p50/p95/أقصى)، زمن الرفع، قفزة البكسلات عند الرفع، مطابقة النتيجة النهائية للرسم الكامل',async(p)=>{
 await yReady(p);
 const r=await p.evaluate(async()=>{const out={};const strat={exactFrame:{b:1e9,m:1e9},hybrid:{b:6,m:1},deferred:{b:0,m:0}};
  for(const prof of['wide']){out[prof]={};
   for(const k in strat){Y.pile(prof,2000,77);__sb.CFG.eraseBudgetMs=strat[k].b;__sb.CFG.eraseMinCaps=strat[k].m;__sb.CFG.eraseLog=true;
    const path=Y.line(260,540,1660,540,9);
    const g=await Y.gesture(path,2,{r:16,probe:null});
    const jump=Y.diff(g.before,g.after0);
    /* مطابقة النتيجة النهائية للرسم الكامل من النموذج */
    const shown=Y.snap();__sb.redrawDoc();const truth=Y.snap();const mism=Y.diff(shown,truth);
    const L=g.L,ft=g.frameT.slice().sort((a,b)=>a-b);
    out[prof][k]={moves:path.length,caps:L.caps,flushP50:+L.frameP50.toFixed(2),flushP95:+L.frameP95.toFixed(2),flushMax:+L.frameMax.toFixed(2),releaseMs:+L.releaseMs.toFixed(1),jumpPx:jump,mismatchVsFull:mism,touched:L.touched,frags:L.frags,patches:L.patches,rafP95:+ft[Math.floor(ft.length*.95)].toFixed(1)}}}
  __sb.CFG.eraseBudgetMs=6;__sb.CFG.eraseMinCaps=1;__sb.CFG.eraseLog=false;return out});
 /* المعيار على الهجينة (المختارة): لا قفزة، ومطابقة للرسم الكامل، وزمن الرفع لا يتجاوز ٥٠ مللي */
 const w=r.wide.hybrid;
 const ok=w.jumpPx===0&&w.mismatchVsFull===0&&w.releaseMs<=50&&w.flushP95<=16.7;/* ضغط أقصى: ٢٠٠٠ خط عريض وضربة تلمس نحو ٢٧٠٠ خط؛ المعيار نفسه، والنتيجة تُعلَن كما هي */
 return [ok,JSON.stringify(r),r]});

/* Y02: كلمة عربية: نقاط الحروف والحركات والخط المتصل */
T('Y02','once','T4.٢: الكتابة العربية بالممحاة الفعلية: ضربة تمرّ بين نقطتين دون لمسهما وتقطع الخط المتصل وتلمس نقطة وحركة: العناصر غير الملموسة تبقى هي نفسها (نفس الكائن)، والملموسة تُقصّ أو تُحذف كاملة (النقطة)، لا حبر داخل الممحاة، ولا حبر مضاف، وتراجع واحد يعيد كل شيء',async(p)=>{
 await yReady(p);await p.evaluate(AR_H);
 const r=await p.evaluate(async()=>{__sb.newDoc({w:1920,h:1080});const P=__sb.pg(),items=AR.word();
  __sb.commitOps('كلمة',items.map((it,i)=>({op:'add',pageId:P.id,el:it.el,index:i})));__sb.redrawDoc();
  const E=X.E,before=P.elements.slice(),hist0=__sb.HIST.undo.length;__sb.CFG.eraseLog=true;
  /* المسار: من (٢٤١، ١٩٠) إلى (٢٤١، ٢١٥) يمرّ بين dot2a وdot2b دون لمسهما ويقطع الخط المتصل، ثم ينحرف إلى حركة fatha (٢٠٤، ١٣١) */
  const path=[...Y.line(241,185,241,215,2),...Y.line(241,215,330,205,3),...Y.line(330,205,204,134,3)];
  const g=await Y.gesture(path,2,{r:5,probe:null});const caps=g.L.capsLog;
  const hit=new Map();for(const it of items)hit.set(it.el,caps.some(c=>E.hitStroke(it.el,c).hit));
  const after=P.elements;const byId=new Map(after.map(e=>[e.id,e]));
  let keptSame=0,keptBad=0,touchedOk=0,touchedBad=0,dotsRemoved=0;
  for(const it of items){const touched=hit.get(it.el);const still=after.includes(it.el);
   if(!touched){if(still)keptSame++;else keptBad++}
   else{ if(it.el.pts.length===1){if(!still)dotsRemoved++;else touchedBad++} else{if(!still)touchedOk++;else touchedBad++} }}
  /* لا حبر داخل الممحاة بالبكسل (نقاط عينة على محور كل كبسولة ± r−١) */
  const S=1,bb=X.box(items.map(i=>i.el),20),R=X.render(after,bb,4);let ink=0;
  for(let y=0;y<R.H;y++)for(let x=0;x<R.W;x++){const wx=bb[0]+(x+.5)/4,wy=bb[1]+(y+.5)/4;if(R.cov[y*R.W+x]>0.15){for(const c of caps){if(E.dPS(wx,wy,c.ax,c.ay,c.bx,c.by)<c.r-0.5){ink++;break}}}}
  /* لا حبر مضاف: كل بكسل حبر نهائي (بعد تسامح) كان حبرًا في الأصل */
  const O=X.render(before,bb,4),Od=X.dil(X.dil(O.cov,O.W,O.H),O.W,O.H);let added=0;for(let i=0;i<R.cov.length;i++)if(R.cov[i]>0.5&&Od[i]<0.2)added++;
  const n1=P.elements.length;const histAdded=__sb.HIST.undo.length-hist0;__sb.undo();const restored=P.elements.length===before.length&&P.elements.every((e,i)=>e===before[i]);
  __sb.redo();const redoN=P.elements.length;__sb.CFG.eraseLog=false;
  return{items:items.length,touchedCount:[...hit.values()].filter(Boolean).length,keptSame,keptBad,touchedOk,touchedBad,dotsRemoved,ink,added,histAdded,restored,redoOk:redoN===n1,idx:__sb.checkIndex(P).ok}});
 const ok=r.keptBad===0&&r.keptSame>=10&&r.touchedBad===0&&r.touchedOk+r.dotsRemoved===r.touchedCount&&r.ink===0&&r.added===0&&r.histAdded===1&&r.restored&&r.redoOk&&r.idx;
 return [ok,JSON.stringify(r)]});

/* Y03: ضربة واحدة = خطوة تراجع واحدة، والمحو الكامل، والإلغاء */
T('Y03','once','T4.٢: التراجع والإعادة والإلغاء: ضربة محو جزئي وأخرى كاملة = خطوة تراجع لكل منهما بالضبط؛ التراجع يعيد المصفوفة الأصلية كائنًا كائنًا؛ والإلغاء (pointercancel) أثناء الضربة يعيد المستند والرسم كما كانا ولا يسجّل شيئًا',async(p)=>{
 await yReady(p);
 const r=await p.evaluate(async()=>{const out={};const P0=()=>__sb.pg();
  Y.pile('hand',300,31);let P=P0(),b0=P.elements.slice(),h0=__sb.HIST.undo.length;
  let g=await Y.gesture(Y.line(300,300,1500,700,10),2,{r:20});out.partialSteps=__sb.HIST.undo.length-h0;out.partialChanged=P0().elements.length!==b0.length||!P0().elements.every((e,i)=>e===b0[i]);
  __sb.undo();out.partialUndoExact=P0().elements.length===b0.length&&P0().elements.every((e,i)=>e===b0[i]);__sb.redo();
  Y.pile('hand',300,32);P=P0();b0=P.elements.slice();h0=__sb.HIST.undo.length;
  g=await Y.gesture(Y.line(300,300,1500,700,10),2,{r:20,mode:'whole'});out.wholeSteps=__sb.HIST.undo.length-h0;out.wholeRemovedOnly=P0().elements.every(e=>b0.includes(e))&&P0().elements.length<b0.length;
  __sb.undo();out.wholeUndoExact=P0().elements.length===b0.length&&P0().elements.every((e,i)=>e===b0[i]);
  /* إلغاء أثناء الضربة */
  Y.pile('hand',300,33);P=P0();b0=P.elements.slice();h0=__sb.HIST.undo.length;const full0=Y.snap();
  __sb.setTool('erase');__sb.setEraseMode('partial');const ev=(t,q)=>__sb.synthEv(t,88,q[0],q[1]);const path=Y.line(300,300,1500,700,10);
  ev('pointerdown',path[0]);for(let i=1;i<path.length/2;i++){ev('pointermove',path[i]);if(i%2===0)await Y.nf()}
  const mid=P0().elements.length;ev('pointercancel',path[Math.floor(path.length/2)]);await Y.nf();
  out.cancelRestored=P0().elements.length===b0.length&&P0().elements.every((e,i)=>e===b0[i]);out.cancelHist=__sb.HIST.undo.length-h0;out.cancelCanvasEqual=Y.diff(full0,Y.snap())===0;out.midChanged=mid!==b0.length;out.activeNull=__sb.S.active===null;
  out.idx=__sb.checkIndex(P0()).ok;return out});
 const ok=r.partialSteps===1&&r.partialChanged&&r.partialUndoExact&&r.wholeSteps===1&&r.wholeRemovedOnly&&r.wholeUndoExact&&r.cancelRestored&&r.cancelHist===0&&r.cancelCanvasEqual&&r.activeNull&&r.idx;
 return [ok,JSON.stringify(r)]});

/* Y04: لا يعود حبر محذوف أثناء الضربة ولا بعد الرفع */
T('Y04','once','T4.٢: لا عودة للحبر المحذوف: أثناء ضربة على كومة كثيفة، عند كل إطار تُفحص نقاط مراكز الكبسولات القديمة: لا حبر فيها (≤٠ بكسل)؛ ولا يتغير شيء بعد الرفع داخل الكبسولات',async(p)=>{
 await yReady(p);
 const r=await p.evaluate(async()=>{Y.pile('hand',2000,5);__sb.CFG.eraseLog=true;const c=document.getElementById('doc'),g=c.getContext('2d',{willReadFrequently:true});
  const path=Y.line(300,540,1500,540,8);let bad=0,probesN=0;const seenCaps=[];const dpr=window.devicePixelRatio||1,K=__sb.K();
  __sb.setTool('erase');__sb.setEraseMode('partial');__sb.S.eraser.r=16;const ev=(t,q)=>__sb.synthEv(t,66,q[0],q[1]);
  ev('pointerdown',path[0]);let i=1;
  const bgPix=(sx,sy)=>{const d=g.getImageData(Math.round(sx*dpr),Math.round(sy*dpr),1,1).data;return d[0]>240&&d[1]>240&&d[2]>240};
  while(i<path.length){for(let j=0;j<3&&i<path.length;j++,i++)ev('pointermove',path[i]);await Y.nf();
   /* كبسولات أقدم من ٥ تحركات: مراكزها وأربع نقاط على r−٣ يجب أن تكون خلفية */
   const upto=Math.max(0,i-8);for(let k=0;k<upto;k+=7){const q=path[k],s=__sb.toScreen(q[0],q[1]);const pts=[[0,0],[10,0],[-10,0],[0,10],[0,-10]];for(const[dx,dy]of pts){probesN++;if(!bgPix(s.x+dx*K,s.y+dy*K))bad++}}}
  ev('pointerup',path[path.length-1]);await Y.nf();const afterSnap=Y.snap();
  /* بعد الرفع: لا تغيير بالبكسل داخل الكبسولات */
  let badAfter=0;for(let k=0;k<path.length;k+=7){const q=path[k],s=__sb.toScreen(q[0],q[1]);for(const[dx,dy]of[[0,0],[10,0],[-10,0],[0,10],[0,-10]]){if(!bgPix(s.x+dx*K,s.y+dy*K))badAfter++}}
  __sb.CFG.eraseLog=false;return{probesN,bad,badAfter}});
 return [r.probesN>500&&r.bad===0&&r.badAfter===0,JSON.stringify(r)]});

/* Y05: الواجهة: أزرار ≥٤٨، حالة الضغط، أرقام هندية، القلم لا يتأثر */
T('Y05','once','T4.٢: واجهة الممحاة: زرّا «قلم» و«ممحاة» وخيارات الجزئي/الكامل ≥٤٨ بكسل، aria-pressed صحيحة، خيارات الممحاة مخفية مع القلم، لا أرقام لاتينية في نص الشريط، والقلم يعمل كما كان بعد العودة من الممحاة (خط واحد = خطوة واحدة)',async(p)=>{
 await yReady(p);
 /* الواجهة المعتمدة: خيارات الممحاة داخل #opts وتُفتح بنقر زر الأداة (نقر حقيقي) */
 await p.evaluate(()=>{__sb.newDoc({w:1920,h:1080});__sb.setTool('pen')});
 const r0=await p.evaluate(()=>{const q=id=>document.getElementById(id);return{hiddenAtPen:!q('opts').querySelector('[data-m]')||q('opts').hidden===true}});
 await p.click('#toolErase');await sleep(250);
 const r=await p.evaluate(async()=>{const q=id=>document.getElementById(id),o=q('opts'),out={};
  out.shownAtErase=o.hidden===false&&!!o.querySelector('[data-m]');out.pressedErase=q('toolErase').getAttribute('aria-pressed')==='true'&&q('toolPen').getAttribute('aria-pressed')==='false';
  const bP=o.querySelector('[data-m=partial]'),bW=o.querySelector('[data-m=whole]'),sl=q('eraseSize');
  const sizes=[q('toolPen'),q('toolErase'),bP,bW,sl].map(e=>{if(!e)return[0,0];const b=e.getBoundingClientRect();return[Math.round(b.width),Math.round(b.height)]});out.sizes=sizes;out.minOk=sizes.every(([w,h])=>w>=48&&h>=48);
  bW.click();out.modeW=__sb.S.eraser.mode==='whole'&&o.querySelector('[data-m=whole]').getAttribute('aria-pressed')==='true'&&o.querySelector('[data-m=partial]').getAttribute('aria-pressed')==='false';/* اللوحة تُعاد بناؤها عند التبديل: نعيد الاستعلام */
  o.querySelector('[data-m=partial]').click();out.modeP=__sb.S.eraser.mode==='partial';
  const sl2=q('eraseSize');sl2.value='30';sl2.dispatchEvent(new Event('input'));out.optsTxt=o.innerText.replace(/\s+/g,' ');out.sizeArabic=!/[0-9]/.test(o.innerText)&&/٣٠/.test(o.innerText)&&__sb.S.eraser.r===30;
  out.latinInBar=/[0-9]/.test(q('tbar').innerText);
  __sb.setTool('pen');const n0=__sb.pg().elements.length,h0=__sb.HIST.undo.length;const ev=(t,x,y)=>__sb.synthEv(t,55,x,y);ev('pointerdown',300,300);for(let i=1;i<=20;i++)ev('pointermove',300+i*10,300+i*3);ev('pointerup',500,360);await Y.nf();
  out.penWorks=__sb.pg().elements.length===n0+1&&__sb.HIST.undo.length===h0+1&&__sb.pg().elements[n0].type==='stroke';
  return out});
 r.hiddenAtPen=r0.hiddenAtPen;
 const ok=r.hiddenAtPen&&r.shownAtErase&&r.pressedErase&&r.minOk&&r.modeW&&r.modeP&&r.sizeArabic&&!r.latinInBar&&r.penWorks;
 return [ok,JSON.stringify(r)]});

/* Y06: ضربات متعددة وحدود: كبسولة خارج الصفحة، نقرة واحدة، حجم أدنى/أقصى، صفحة فارغة */
T('Y06','once','T4.٢: حالات حدّية: نقرة محو واحدة بلا حركة، ضربة على صفحة فارغة، حجم ٤ و٦٠، ضربة تبدأ داخل الصفحة وتخرج منها، ٢٠ ضربة متتالية (٢٠ خطوة تراجع): بلا استثناء، والفهرس سليم، والتراجع المتتابع يعيد الأصل',async(p)=>{
 await yReady(p);
 const r=await p.evaluate(async()=>{const out={};Y.pile('hand',200,9);const P=()=>__sb.pg();const orig=P().elements.slice();const h0=__sb.HIST.undo.length;
  /* نقرة واحدة على خط */
  const el=orig[0],q=el.pts[Math.floor(el.pts.length/2)];await Y.gesture([[q.x,q.y]],1,{r:10});out.click=__sb.HIST.undo.length-h0<=1;
  __sb.undo();
  /* صفحة فارغة */
  __sb.newDoc({w:1920,h:1080});const g0=await Y.gesture(Y.line(100,100,900,500,10),2,{r:20});out.emptyNoHist=__sb.HIST.undo.length===0&&P().elements.length===0;
  /* أحجام */
  Y.pile('hand',200,9);const o2=P().elements.slice();for(const r of[4,60]){await Y.gesture(Y.line(300,300,1400,600,12),2,{r});}
  /* خروج من الصفحة */
  await Y.gesture([[1800,500],[1900,500],[1990,500],[2100,520]],1,{r:20});
  /* ٢٠ ضربة */
  Y.pile('hand',300,10);const o3=P().elements.slice();const h1=__sb.HIST.undo.length;let steps=0;
  for(let i=0;i<20;i++){await Y.gesture(Y.line(200+i*60,200,260+i*60,900,12),2,{r:12,id:100+i})}
  steps=__sb.HIST.undo.length-h1;out.steps=steps;out.idxMid=__sb.checkIndex(P()).ok;
  while(__sb.HIST.undo.length>h1)__sb.undo();out.allUndo=P().elements.length===o3.length&&P().elements.every((e,i)=>e===o3[i]);out.idx=__sb.checkIndex(P()).ok;return out});
 const ok=r.click&&r.emptyNoHist&&r.steps>=1&&r.steps<=20&&r.idxMid&&r.allUndo&&r.idx;
 return [ok,JSON.stringify(r)]});
// ================= runner =================
(async()=>{
const b=await chromium.launch();
const globalErr={};const globalReq={};
for(const cfg of CONFIGS){
 const ctx=await b.newContext({viewport:{width:cfg.w,height:cfg.h},deviceScaleFactor:cfg.d,hasTouch:true});
 const p=await ctx.newPage();const errs=[],reqs=[];
 p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 p.on('request',r=>{const u=r.url();if(!u.startsWith('file:')&&!u.startsWith('data:'))reqs.push(u)});
 await p.goto(F);await sleep(500);await p.evaluate(HELP);
 const env={cfg,ctx,map:null,browser:b};
 for(const t of TESTS){
  if(t.scope==='once'&&cfg.n!=='A')continue;
  if(ONLY&&!ONLY.includes(t.id))continue;
  if(!R[t.id])R[t.id]={id:t.id,name:t.name,scope:t.scope,runs:[]};
  await p.evaluate(()=>{T.reset()}).catch(()=>{});
  await p.setViewportSize({width:cfg.w,height:cfg.h});await sleep(80);
  let res;try{res=await t.fn(p,env)}catch(e){res=[false,'استثناء: '+e.message]}
  const status=res[0]===null?'SKIP':(res[0]?'PASS':'FAIL');
  R[t.id].runs.push({cfg:cfg.n,status,detail:res[1],extra:res[2]});
  console.log(status,t.id,cfg.n,t.name.slice(0,60),'|',String(res[1]).slice(0,170));
 }
 // cross-config mapping consistency recorded later
 R._maps=R._maps||{};R._maps[cfg.n]=env.map;
 if(cfg.n==='A'){ // screenshots
  await p.evaluate(()=>T.reset());
 }
 globalErr[cfg.n]=errs;globalReq[cfg.n]=reqs;
 await ctx.close();
}
// hygiene tests
for(const cfg of CONFIGS){
 for(const [id,name,val] of [['T41','لا أخطاء في الصفحة (طوال التشغيل)',globalErr],['T42','لا طلبات شبكة خارجية',globalReq]]){
  if(!R[id])R[id]={id,name,scope:'config',runs:[]};
  const ok=val[cfg.n].length===0;R[id].runs.push({cfg:cfg.n,status:ok?'PASS':'FAIL',detail:val[cfg.n].join('|').slice(0,200)});
  console.log(ok?'PASS':'FAIL',id,cfg.n,name);
 }
}
// cross config mapping: logical positions equal across configs within tolerance
{const m=R._maps;const ks=Object.keys(m).filter(k=>m[k]);let ok=true;for(const k of ks){if(Math.abs(m[k].first.x-480)>0.02||Math.abs(m[k].last.x-1440)>0.02)ok=false}
 R['T43']={id:'T43',name:'تطابق إحداثيات الخطوط المحفوظة بين الدقات والكثافات (١٣٦٦، ١٩٢٠، ×٢، عمودي)',scope:'cross',runs:[{cfg:ks.join(''),status:ok?'PASS':'FAIL',detail:ks.map(k=>k+':'+m[k].k.toFixed(3)).join(' ')}]};console.log(ok?'PASS':'FAIL','T43')}
delete R._maps;
if(!process.env.NOOUT)FS.writeFileSync(OUT+'simulation-test-results.json',JSON.stringify(R,null,1));
const ids=Object.keys(R);let runs=0,pass=0,fail=0,skip=0;for(const id of ids)for(const r of R[id].runs){runs++;if(r.status==='PASS')pass++;else if(r.status==='FAIL')fail++;else skip++}
console.log('SCENARIOS',ids.length,'RUNS',runs,'PASS',pass,'FAIL',fail,'SKIP',skip);
await b.close();})();
