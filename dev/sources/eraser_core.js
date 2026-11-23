
/* =====================================================================
   T4.٢: أداة الممحاة — استجابة فورية أثناء الحركة
   الاستراتيجية (مختارة بعد مقارنة قياسية، انظر التقرير): كل إطار يُنفِّذ القص الهندسي الدقيق ضمن ميزانية زمنية
   (CFG.eraseBudgetMs)، وما لا يتّسع له الإطار يُعرَض فورًا كمعاينة بصرية خفيفة (كبسولة بلون السطح) ويُنفَّذ في الإطارات التالية؛
   كلها في المهمة نفسها فلا يظهر إطار وسيط، ولا يعود حبر محذوف. عند الرفع يُنهى الطابور ويُسجَّل المحو كله خطوة تراجع واحدة.
   ===================================================================== */
CFG.eraseBudgetMs=6;CFG.eraseMinCaps=1;CFG.eraseLog=false;
S.tool='pen';S.eraser={mode:'partial',r:14};
Object.assign(S.m,{eraseFrames:0,eraseCaps:0,eraseQueuedMax:0,eraseFrameMsMax:0,eraseReleaseMsMax:0,eraseGestures:0});
let ERLAST=null;
function eraseOverlay(st,from){
  const q=st.queue;if(st.mode==='whole'||from>=q.length)return;
  withPage(dctx,()=>{dctx.fillStyle=S.board;dctx.strokeStyle=S.board;dctx.lineCap='round';
    for(let i=from;i<q.length;i++){const c=q[i];
      if(c.ax===c.bx&&c.ay===c.by){dctx.beginPath();dctx.arc(c.ax,c.ay,c.r,0,6.2832);dctx.fill()}
      else{dctx.lineWidth=2*c.r;dctx.beginPath();dctx.moveTo(c.ax,c.ay);dctx.lineTo(c.bx,c.by);dctx.stroke()}}});
}
function eraseCursor(p,r){
  clearLive();if(!p)return;const dark=SURFACES[S.board].tone==='dark';
  withPage(lctx,()=>{lctx.beginPath();lctx.arc(p.x,p.y,r,0,6.2832);lctx.fillStyle=dark?'rgba(255,255,255,.10)':'rgba(0,0,0,.07)';lctx.fill();
    lctx.lineWidth=1.6/K();lctx.strokeStyle=dark?'rgba(255,255,255,.85)':'rgba(0,0,0,.65)';lctx.setLineDash([5/K(),4/K()]);lctx.stroke();lctx.setLineDash([])});
}
function eraseAddCap(st,a,b){const cp={ax:a.x,ay:a.y,bx:b.x,by:b.y,r:st.r};st.queue.push(cp);if(CFG.eraseLog)(st.capsLog=st.capsLog||[]).push(cp);S.m.eraseCaps++;st.nCaps++;if(st.queue.length>S.m.eraseQueuedMax)S.m.eraseQueuedMax=st.queue.length}
function eraseBegin(e,p,t){
  e.preventDefault();try{liveC.setPointerCapture(e.pointerId)}catch(_){}
  const P=pg();
  const st={id:'er',er:true,type:'erase',pts:[],rt:{ptype:t,pid:e.pointerId,t0:performance.now(),redo:false},
    before:P.elements.slice(),pageId:P.id,last:p,cur:p,queue:[],painted:0,mode:S.eraser.mode,r:S.eraser.r,nCaps:0,frameMs:[],touched:0,frags:0};
  S.active=st;updGuard();S.m.eraseGestures++;
  eraseAddCap(st,p,p);schedule();
}
function eraseMove(e,st){
  const evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[];const list=evs.length?evs:[e];
  for(const c of list){const q=pt(c);if(Math.hypot(q.x-st.last.x,q.y-st.last.y)*K()<0.8)continue;eraseAddCap(st,st.last,q);st.last=q}
  st.cur=pt(e);schedule();
}
/* عناصر غير الخطوط (أشكال، نصوص، صور): تُمحى كاملة عند لمسها (لا قص جزئي لها). عناصر مقفلة (خلفية PDF) لا تُمحى. */
function eraseOthers(P,cap){
  const q=ERASE.capBox(cap),ops=[],cand=idxQuery(P,q[0],q[1],q[2],q[3]);
  const hit=[];for(const el of cand){if(el.type==='stroke'||el.locked)continue;if(hitCap(el,cap))hit.push(el)}
  if(!hit.length)return ops;
  const idx=new Map();P.elements.forEach((e,i)=>idx.set(e,i));hit.sort((a,b)=>idx.get(b)-idx.get(a));
  /* مؤشرات متتابعة تُحسب على مصفوفة تُطبَّق عليها عمليات الخطوط أولًا: نؤجل الحساب بعد التطبيق */
  return hit.map(el=>({op:'remove',pageId:P.id,el,index:-1}));
}
function eraseProcess(st,budget,minCaps){
  const P=pg(),t0=performance.now();let n=0,region=null;
  while(st.queue.length){
    if(n>=minCaps&&performance.now()-t0>=budget)break;
    const cap=st.queue.shift();n++;
    const plan=ERASE.planErase(P,cap,st.mode==='whole'?'whole':'partial',{newId:()=>uid('s'),minFrag:{mode:'none'}});
    const oth=eraseOthers(P,cap);
    if(plan.ops.length||oth.length){
      const r0=plan.ops.length?opsRegion(plan.ops,P):null;if(plan.ops.length)applyOps(plan.ops);
      let r=r0;
      for(const o of oth){const i=P.elements.indexOf(o.el);if(i<0)continue;const bb=worldBBox(o.el);r=r?[Math.min(r[0],bb[0]),Math.min(r[1],bb[1]),Math.max(r[2],bb[2]),Math.max(r[3],bb[3])]:bb.slice();applyOps([{op:'remove',pageId:P.id,el:o.el,index:i}]);st.touched++}
      if(r)region=region?[Math.min(region[0],r[0]),Math.min(region[1],r[1]),Math.max(region[2],r[2]),Math.max(region[3],r[3])]:r;
      st.touched+=plan.stats.touched;st.frags+=plan.stats.fragments;
    }
  }
  st.painted=Math.max(0,st.painted-n);
  if(region){
    if((Math.min(region[2],P.w)-Math.max(region[0],0))*(Math.min(region[3],P.h)-Math.max(region[1],0))>CFG.regionMaxFrac*P.w*P.h)redrawDoc();else redrawRegion(region);
    st.painted=0;    /* إعادة الرسم تمحو المعاينة: تُعاد للمتبقّي فورًا في المهمة نفسها */
  }
  return n;
}
function eraseFlush(st){
  const t0=performance.now();S.m.eraseFrames++;
  eraseProcess(st,CFG.eraseBudgetMs,CFG.eraseMinCaps);
  eraseOverlay(st,st.painted);st.painted=st.queue.length;
  eraseCursor(st.cur,st.r);
  const d=performance.now()-t0;st.frameMs.push(d);if(d>S.m.eraseFrameMsMax)S.m.eraseFrameMsMax=d;
  if(st.queue.length)schedule();    /* المتبقي يُنفَّذ في الإطار التالي */
}
function erasePatches(st){
  const before=st.before,after=pg().elements,bs=new Set(before),as=new Set(after),out=[];
  for(let i=before.length-1;i>=0;i--)if(!as.has(before[i]))out.push({op:'remove',pageId:st.pageId,el:before[i],index:i});
  for(let i=0;i<after.length;i++)if(!bs.has(after[i]))out.push({op:'add',pageId:st.pageId,el:after[i],index:i});
  return out;
}
function commitErase(st){
  if(rafId){cancelAnimationFrame(rafId);rafId=0}pending=[];
  const t0=performance.now();
  eraseProcess(st,Infinity,Infinity);                  /* إنهاء الطابور كاملًا قبل التسجيل */
  S.active=null;clearLive();
  const patches=erasePatches(st);
  if(patches.length)pushHist(st.mode==='whole'?'محو كامل':'محو جزئي',patches);   /* خطوة تراجع واحدة لكل ضربة محو */
  const rel=performance.now()-t0;if(rel>S.m.eraseReleaseMsMax)S.m.eraseReleaseMsMax=rel;
  const fm=st.frameMs.slice().sort((a,b)=>a-b);
  ERLAST={mode:st.mode,caps:st.nCaps,frames:fm.length,frameP50:fm[Math.floor(fm.length*.5)]||0,frameP95:fm[Math.floor(fm.length*.95)]||0,frameMax:fm[fm.length-1]||0,releaseMs:rel,touched:st.touched,frags:st.frags,patches:patches.length,capsLog:st.capsLog||null};
  updGuard();updHist();
}
function eraseCancel(st){
  const P=pg();
  if(rafId){cancelAnimationFrame(rafId);rafId=0}pending=[];
  P.elements.length=0;for(const e of st.before)P.elements.push(e);PIDX.delete(P);    /* استعادة المستند كما كان قبل الضربة */
  S.active=null;clearLive();redrawDoc();updGuard();updHist();
}
