import re,sys
t=open('template9.html',encoding='utf-8').read()
def rep(old,new,cnt=1):
    global t
    n=t.count(old)
    assert n==cnt,('count',n,old[:70])
    t=t.replace(old,new)
# ---- title/tag
rep('<title>سبورتي الذكية – اختبار المرحلة ٢ (الدفعة ٤ – استجابة الممحاة)</title>','<title>سبورتي الذكية | Smart Board Pro</title>')
# ---- LIM/CFG
rep("const LIM={pages:200,","const LIM={assetBytes:400e6,assets:400,pages:200,")
# ---- hooks + HIDE
rep("let idc=0;const uid=","const HOOKS={};let HIDE=null;\nlet idc=0;const uid=")
# ---- vStroke hl + tf helper
rep("  const el={id:raw.id,type:'stroke',pts,color:raw.color,tf};el.bbox=strokeBBox(el);return el}",
"  if(raw.hl!==undefined&&typeof raw.hl!=='boolean'){E.push(path+': علامة التمييز غير صالحة');return null}\n  const el={id:raw.id,type:'stroke',pts,color:raw.color,tf};if(raw.hl)el.hl=true;el.bbox=strokeBBox(el);return el}")
rep("    render(ctx,el,env){drawUpTo(ctx,el,{next:1,prevMid:el.pts[0],dotDone:false},true,env.surface)},",
"    render(ctx,el,env){if(el.hl){drawHL(ctx,el,env.surface);return}drawUpTo(ctx,el,{next:1,prevMid:el.pts[0],dotDone:false},true,env.surface)},")
rep("    serialize(el){return{id:el.id,type:'stroke',color:el.color,tf:el.tf.map(r3),pts:el.pts.map(p=>({x:r3(p.x),y:r3(p.y),w:r3(p.w)}))}}",
"    serialize(el){const o={id:el.id,type:'stroke',color:el.color,tf:el.tf.map(r3),pts:el.pts.map(p=>({x:r3(p.x),y:r3(p.y),w:r3(p.w)}))};if(el.hl)o.hl=true;return o}")
# drawHL after drawUpTo def
rep("const freshCur=st=>",
"""/* قلم التمييز: مسار واحد بعرض ثابت وشفافية ثابتة (لا يتراكم السواد عند تقاطع المقاطع) */
function drawHL(ctx,el,surface){
  const p=el.pts,col=resolveColor(el.color,surface),w=p.reduce((a,q)=>a+q.w,0)/p.length;
  ctx.save();ctx.globalAlpha=0.4;ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=w;ctx.lineCap='round';ctx.lineJoin='round';
  if(p.length===1){ctx.beginPath();ctx.arc(p[0].x,p[0].y,Math.max(0.5,w/2),0,Math.PI*2);ctx.fill()}
  else{ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);let pm=p[0];
    for(let i=1;i<p.length-1;i++){const m={x:(p[i].x+p[i+1].x)/2,y:(p[i].y+p[i+1].y)/2};ctx.quadraticCurveTo(p[i].x,p[i].y,m.x,m.y);pm=m}
    const l=p[p.length-1];ctx.quadraticCurveTo(l.x,l.y,l.x,l.y);ctx.stroke()}
  ctx.restore();
}
const freshCur=st=>""")
# ---- validateDoc: backgrounds + assets
rep("  if(!raw.assets||typeof raw.assets!=='object'||Array.isArray(raw.assets)||Object.keys(raw.assets).length>0)err('الأصول (صور وغيرها) غير مدعومة في هذا الإصدار');",
"  const assets=vAssets(raw.assets,err);")
rep("    if(!bg||bg.type!=='plain'||!SURFACES[bg.surface]){err(pp+': خلفية غير مدعومة');return}",
"    if(!bg||!BG_TYPES.includes(bg.type)||!SURFACES[bg.surface]){err(pp+': خلفية غير مدعومة');return}")
rep("    pages.push({id:rp.id,w:rp.w,h:rp.h,unit:'logical',background:{type:'plain',surface:bg.surface},zones:[],elements:els,view:{zoom:v.zoom,cx:v.cx,cy:v.cy}});",
"    for(const el of els)if(el.type==='image'&&!assets[el.asset])err(ep0(pp)+': صورة بلا أصل');\n    pages.push({id:rp.id,w:rp.w,h:rp.h,unit:'logical',background:{type:bg.type,surface:bg.surface},zones:[],elements:els,view:{zoom:v.zoom,cx:v.cx,cy:v.cy}});")
rep("pages,activePage:raw.activePage,assets:{}}};","pages,activePage:raw.activePage,assets}};")
rep("function serializeDoc(doc){","""const BG_TYPES=['plain','lines','grid','dots'];
const ep0=s=>s;
function vAssets(raw,err){
  const out={};if(raw===undefined||raw===null)return out;
  if(typeof raw!=='object'||Array.isArray(raw)){err('قسم الأصول غير صالح');return out}
  const ks=Object.keys(raw);if(ks.length>LIM.assets){err('عدد الأصول يتجاوز الحد');return out}
  let tot=0;
  for(const k of ks){const a=raw[k];
    if(!ID_RE.test(k)||!a||typeof a!=='object'||!/^image\\/(png|jpeg|webp)$/.test(a.mime)||typeof a.data!=='string'||!a.data.startsWith('data:'+a.mime+';base64,')||!Number.isInteger(a.w)||!Number.isInteger(a.h)||a.w<1||a.h<1||a.w>16384||a.h>16384){err('أصل غير صالح: '+k);continue}
    tot+=a.data.length;if(tot>LIM.assetBytes){err('حجم الأصول يتجاوز الحد');break}
    out[k]={mime:a.mime,data:a.data,w:a.w,h:a.h}}
  return out;
}
function serializeDoc(doc){""")
rep("createdAt:doc.createdAt,activePage:doc.activePage,assets:{},\n    pages:doc.pages.map(pg=>({id:pg.id,w:pg.w,h:pg.h,unit:'logical',background:{type:'plain',surface:pg.background.surface},zones:[],",
"createdAt:doc.createdAt,activePage:doc.activePage,assets:usedAssets(doc),\n    pages:doc.pages.map(pg=>({id:pg.id,w:pg.w,h:pg.h,unit:'logical',background:{type:pg.background.type||'plain',surface:pg.background.surface},zones:[],")
rep("const exportDoc=()=>JSON.stringify(serializeDoc(S.doc));","""function usedAssets(doc){const u=new Set();for(const p of doc.pages)for(const e of p.elements)if(e.type==='image')u.add(e.asset);const o={};for(const k of u)if(doc.assets&&doc.assets[k])o[k]=doc.assets[k];return o}
const exportDoc=()=>JSON.stringify(serializeDoc(S.doc));""")
# ---- drawBackground patterns
rep("function drawBackground(ctx,page){ctx.fillStyle=page.background.surface;ctx.fillRect(0,0,page.w,page.h)}",
"""function drawBackground(ctx,page){
  ctx.fillStyle=page.background.surface;ctx.fillRect(0,0,page.w,page.h);
  const ty=page.background.type;if(!ty||ty==='plain')return;
  const dark=SURFACES[page.background.surface].tone==='dark',c=dark?'rgba(255,255,255,0.20)':'rgba(30,60,120,0.20)',g=BG_STEP;
  ctx.save();ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=1.5;ctx.beginPath();
  if(ty==='lines'){for(let y=g*1.5;y<page.h;y+=g){ctx.moveTo(0,y);ctx.lineTo(page.w,y)}ctx.stroke()}
  else if(ty==='grid'){for(let y=g;y<page.h;y+=g){ctx.moveTo(0,y);ctx.lineTo(page.w,y)}for(let x=g;x<page.w;x+=g){ctx.moveTo(x,0);ctx.lineTo(x,page.h)}ctx.stroke()}
  else if(ty==='dots'){for(let y=g;y<page.h;y+=g)for(let x=g;x<page.w;x+=g){ctx.moveTo(x+2.4,y);ctx.arc(x,y,2.4,0,6.2832)}ctx.fill()}
  ctx.restore();
}
const BG_STEP=54;""")
# ---- renderPage HIDE
rep("  for(const el of (list||page.elements)){const T=ELEMENT_TYPES[el.type];if(!T)continue;",
"  for(const el of (list||page.elements)){if(HIDE&&HIDE.has(el))continue;const T=ELEMENT_TYPES[el.type];if(!T)continue;")
# ---- redrawLive hook
rep("  if(st){st.rt.cur=freshCur(st);withPage(lctx,()=>{drawUpTo(lctx,st,st.rt.cur,false,S.board);if(st.pts.length>=2&&st.rt.cur.next===1)drawDot(lctx,resolveColor(st.color,S.board),st.pts[0])});st.rt.redo=false}",
"  if(st&&st.pts&&!st.h&&!st.er){st.rt.cur=freshCur(st);withPage(lctx,()=>{drawUpTo(lctx,st,st.rt.cur,false,S.board);if(st.pts.length>=2&&st.rt.cur.next===1)drawDot(lctx,resolveColor(st.color,S.board),st.pts[0])});st.rt.redo=false}\n  else if(st&&st.h&&st.h.redraw)st.h.redraw(st);\n  if(HOOKS.live)HOOKS.live();")
# ---- targetW
rep("function targetW(e,last){\n  const base=S.width;","function targetW(e,last){\n  if(S.tool==='hl')return S.hlWidth;\n  const base=S.width;")
# ---- flush/cancel/commit/move/release with handler tools
rep("  if(st&&st.er){eraseFlush(st);pending=[];return}","  if(st&&st.h){if(st.h.flush)st.h.flush(st);pending=[];return}\n  if(st&&st.er){eraseFlush(st);pending=[];return}")
rep("  if(S.active.er){eraseCancel(S.active);if(reason)S.m[reason]++;return}",
"  if(S.active.h){const a=S.active;S.active=null;if(a.h.cancel)a.h.cancel(a);if(rafId){cancelAnimationFrame(rafId);rafId=0}pending=[];clearLive();if(HOOKS.live)HOOKS.live();if(reason)S.m[reason]++;updGuard();return}\n  if(S.active.er){eraseCancel(S.active);if(reason)S.m[reason]++;return}")
rep("  if(st.er){commitErase(st);return}\n  if(rafId)","  if(st.h){if(rafId){cancelAnimationFrame(rafId);rafId=0}pending=[];S.active=null;try{st.h.up(st)}finally{updGuard()}return}\n  if(st.er){commitErase(st);return}\n  if(rafId)")
rep("  if(st.rt.ptype==='touch'&&CFG.palmMinPx>0&&sizeOf(e)>=CFG.palmMinPx){cancelActive('cancelledPalm');return}\n  if(st.er){eraseMove(e,st);return}",
"  if(st.rt.ptype==='touch'&&CFG.palmMinPx>0&&sizeOf(e)>=CFG.palmMinPx){cancelActive('cancelledPalm');return}\n  if(st.h){st.h.move(e,st);schedule();return}\n  if(st.er){eraseMove(e,st);return}")
rep("  if(st.er)eraseMove(e,st);else addPoint(e);\n  commitActive();","  if(st.h)st.h.move(e,st);else if(st.er)eraseMove(e,st);else addPoint(e);\n  commitActive();")
# ---- pointerdown dispatch
rep("  if(!insidePage(p)){S.m.outsidePage++;return}\n  e.preventDefault();",
"  const TL=TOOLS[S.tool];\n  if(HOOKS.preDown&&HOOKS.preDown(e,p))return;\n  if(!insidePage(p)&&!(TL&&TL.anywhere)){S.m.outsidePage++;return}\n  e.preventDefault();")
rep("  if(S.tool==='erase'){eraseBegin(e,p,t);return}\n  const st=",
"  if(S.tool==='erase'){eraseBegin(e,p,t);return}\n  if(TL){TL.down(e,p,t);return}\n  const st=")
rep("  st.rt.cur=freshCur(st);S.active=st;updGuard();\n  withPage(lctx,",
"  if(S.tool==='hl'){st.hl=true;st.color=S.hlInk}\n  if(HOOKS.snapFor){const sn=HOOKS.snapFor(p);if(sn){st.snap=sn;HOOKS.snapPt(p,sn)}}\n  st.rt.cur=freshCur(st);S.active=st;updGuard();\n  withPage(lctx,")
rep("  const q=pt(e);S.m.raw++;\n  const last=st.pts[st.pts.length-1];","  const q=pt(e);S.m.raw++;if(st.snap)HOOKS.snapPt(q,st.snap);\n  const last=st.pts[st.pts.length-1];")
# live alpha for highlighter in updGuard
rep("function updGuard(){\n  updHist();","function updGuard(){\n  updHist();liveC.style.opacity=(S.active&&S.active.hl)?'0.4':'';if(HOOKS.guard)HOOKS.guard();")
# TOOLS registry declared early
rep("const HOOKS={};let HIDE=null;","const HOOKS={};let HIDE=null;const TOOLS={};")
# ---- applyOps: page ops + generic bbox; precheck page ops
rep("""function precheck(ops){
  const sim=new Map();
  for(const o of ops){
    const page=S.doc.pages.find(p=>p.id===o.pageId);if(!page)return false;""",
"""function precheck(ops){
  const sim=new Map(),pids=S.doc.pages.map(p=>p.id);
  for(const o of ops){
    if(o.op==='pageAdd'){if(!(o.index>=0&&o.index<=pids.length)||pids.includes(o.page.id))return false;pids.splice(o.index,0,o.page.id);continue}
    if(o.op==='pageDel'){if(pids[o.index]!==o.page.id||pids.length<2)return false;pids.splice(o.index,1);continue}
    const page=S.doc.pages.find(p=>p.id===o.pageId);if(!page)return false;""")
rep("""  for(const o of ops){
    const page=S.doc.pages.find(p=>p.id===o.pageId);
    if(o.op==='add')""","""  for(const o of ops){
    if(o.op==='pageAdd'){S.doc.pages.splice(o.index,0,o.page);continue}
    if(o.op==='pageDel'){S.doc.pages.splice(o.index,1);continue}
    const page=S.doc.pages.find(p=>p.id===o.pageId);
    if(o.op==='add')""")
rep("Object.assign(el,o.after);if(el.type==='stroke')el.bbox=strokeBBox(el);idxUpdate(page,el)}","Object.assign(el,o.after);el.bbox=ELEMENT_TYPES[el.type].bbox(el);idxUpdate(page,el)}")
rep("""function invertPatch(p){
  if(p.op==='add')""","""function invertPatch(p){
  if(p.op==='pageAdd')return{op:'pageDel',pageId:p.pageId,index:p.index,page:p.page};
  if(p.op==='pageDel')return{op:'pageAdd',pageId:p.pageId,index:p.index,page:p.page};
  if(p.op==='add')""")
# histStep: page ops + hook
rep("  const idx=S.doc.pages.findIndex(p=>p.id===ent.pageId);\n  if(idx>=0&&idx===S.doc.activePage)redrawAfterOps(ops,idx);",
"  if(ops.some(o=>o.op==='pageAdd'||o.op==='pageDel')){pageStructureChanged(ops);updHist();flashMsg((dir<0?'تراجع عن: ':'إعادة: ')+ent.label);return true}\n  const idx=S.doc.pages.findIndex(p=>p.id===ent.pageId);\n  if(idx>=0&&idx===S.doc.activePage)redrawAfterOps(ops,idx);")
rep("  updHist();\n  flashMsg((dir<0?'تراجع عن: ':'إعادة: ')+ent.label);\n  return true;\n}",
"  updHist();if(HOOKS.hist)HOOKS.hist();\n  flashMsg((dir<0?'تراجع عن: ':'إعادة: ')+ent.label);\n  return true;\n}")
# pageStructureChanged + commitPageOps after commitOps def
rep("histBtns.u.onclick=undo;histBtns.r.onclick=redo;","""/* بعد أي تغيير في بنية الصفحات (إضافة/حذف/نقل): ضبط الصفحة النشطة وإعادة العرض */
function pageStructureChanged(ops,focusId){
  const P=S.doc.pages;let ai=focusId?P.findIndex(p=>p.id===focusId):-1;
  if(ai<0){const cur=S.doc.pages[S.doc.activePage];ai=cur?S.doc.activePage:Math.min(S.doc.activePage,P.length-1)}
  /* الصفحة النشطة قد أُزيلت: ننتقل إلى أقرب صفحة */
  S.doc.activePage=clamp(ai,0,P.length-1);cancelActive(null);W=0;H=0;fit();redrawAll();syncUI();if(HOOKS.pages)HOOKS.pages();
}
function commitPageOps(label,ops,focusId){
  if(histBusy()||!ops.length||!precheck(ops))return false;
  applyOps(ops);pushHist(label,ops);pageStructureChanged(ops,focusId);return true;
}
histBtns.u.onclick=undo;histBtns.r.onclick=redo;""")
# setActivePage hook
rep("  if(S.doc.activePage!==i){S.doc.activePage=i;W=0;H=0;fit();syncUI()}\n  redrawAll();return true;","  if(S.doc.activePage!==i){S.doc.activePage=i;W=0;H=0;fit();syncUI()}\n  redrawAll();if(HOOKS.pages)HOOKS.pages();return true;")
# loadDoc hook
rep("  cancelActive(null);S.doc=d;resetHist();\n  W=0;H=0;fit();redrawAll();syncUI();","  cancelActive(null);S.doc=d;resetHist();if(HOOKS.load)HOOKS.load();\n  W=0;H=0;fit();redrawAll();syncUI();if(HOOKS.pages)HOOKS.pages();")
# present UI icon button
rep("function updPresentUI(){for(const b of presentBtns)b.textContent=present?'إنهاء ملء الشاشة':'ملء الشاشة'}",
"function updPresentUI(){for(const b of presentBtns){const tx=present?'إنهاء ملء الشاشة':'ملء الشاشة';if(b.classList.contains('ic')){b.title=tx;b.setAttribute('aria-label',tx);b.setAttribute('aria-pressed',String(present))}else b.textContent=tx}}")
# newDocObj with assets map (already assets:{})
# marker for modules
rep("/*ERASE*//*ERASER*/\nwindow.__sb={","/*ERASE*//*ERASER*//*MODS*/\nwindow.__sb={")
rep("setPresent,openNewDlg,closeDlg,isPresent:()=>present,marginFor,updGuard};","setPresent,openNewDlg,closeDlg,isPresent:()=>present,marginFor,updGuard,HOOKS,TOOLS,commitPageOps,pageStructureChanged,drawHL,usedAssets,BG_TYPES};\n/*MODS2*/")
open('template10.html','w',encoding='utf-8').write(t)
print('ok',len(t))
