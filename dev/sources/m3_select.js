
/* =====================================================================
   الوحدة ٣: التحديد والتحريك وتغيير الحجم والنسخ والحذف والترتيب
   كل العمليات تمرّ عبر commitOps (رقاع set/add/remove) فتُسجَّل في سجل التراجع الموحّد.
   ===================================================================== */
const SEL={ids:new Set()};
const CLIP={els:[],n:0};
const selbar=$('selbar');
const selEls=()=>pg().elements.filter(e=>SEL.ids.has(e.id)&&!e.locked);
function unionBox(els){let r=null;for(const e of els){const b=worldBBox(e);r=r?[Math.min(r[0],b[0]),Math.min(r[1],b[1]),Math.max(r[2],b[2]),Math.max(r[3],b[3])]:b.slice()}return r}
function selClear(){SEL.ids.clear();selRefresh()}
function selSet(list){SEL.ids=new Set(list.map(e=>e.id));selRefresh()}
function compose(T,tf){const[a,b,c,d,e,f]=tf;return[T[0]*a+T[2]*b,T[1]*a+T[3]*b,T[0]*c+T[2]*d,T[1]*c+T[3]*d,T[0]*e+T[2]*f+T[4],T[1]*e+T[3]*f+T[5]]}
const isTouch=e=>e&&e.pointerType==='touch';

/* ---------- مقابض الصندوق (إحداثيات الشاشة) ---------- */
function boxScreen(b){const a=toScreen(b[0],b[1]),c=toScreen(b[2],b[3]);return[a.x,a.y,c.x,c.y]}
function handlePts(sb){
  const[x0,y0,x1,y1]=sb,mx=(x0+x1)/2,my=(y0+y1)/2;
  return[{k:'tl',x:x0,y:y0,ax:1,ay:1},{k:'t',x:mx,y:y0,ax:null,ay:1},{k:'tr',x:x1,y:y0,ax:0,ay:1},{k:'r',x:x1,y:my,ax:0,ay:null},
         {k:'br',x:x1,y:y1,ax:0,ay:0},{k:'b',x:mx,y:y1,ax:null,ay:0},{k:'bl',x:x0,y:y1,ax:1,ay:0},{k:'l',x:x0,y:my,ax:1,ay:null}];
}
function handleAt(b,e){
  const r=liveC.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,rad=isTouch(e)?28:16;
  let best=null,bd=1e9;for(const h of handlePts(boxScreen(b))){const d=Math.hypot(h.x-sx,h.y-sy);if(d<=rad&&d<bd){bd=d;best=h}}
  return best;
}

/* ---------- رسم التحديد على الطبقة الحية ---------- */
function drawBoxOverlay(b){
  const sb=boxScreen(b),ctx=lctx,dark=SURFACES[S.board].tone==='dark';
  ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.lineWidth=1.6;ctx.setLineDash([6,4]);ctx.strokeStyle=dark?'rgba(140,220,255,.95)':'rgba(15,107,92,.95)';
  ctx.strokeRect(sb[0],sb[1],sb[2]-sb[0],sb[3]-sb[1]);ctx.setLineDash([]);
  ctx.fillStyle='#fff';ctx.lineWidth=2;
  for(const h of handlePts(sb)){ctx.beginPath();ctx.rect(h.x-6,h.y-6,12,12);ctx.fill();ctx.stroke()}
  ctx.restore();
}
function drawSel(){
  if(S.tool!=='select'||S.active)return;
  const els=selEls();if(!els.length)return;drawBoxOverlay(unionBox(els));
}
function placeSelBar(){
  const els=(S.tool==='select'&&!S.active&&!HIDE)?selEls():[];
  if(!els.length||txEdOpen()){selbar.hidden=true;return}
  selbar.hidden=false;
  const sb=boxScreen(unionBox(els)),w=selbar.offsetWidth,h=selbar.offsetHeight,M=8,sw=stageEl.clientWidth,sh=stageEl.clientHeight;
  let x=(sb[0]+sb[2])/2-w/2,y=sb[1]-h-14;if(y<M)y=sb[3]+14;
  if(y+h>sh-M)y=Math.max(M,Math.min(sh-h-M,sb[1]+8));
  selbar.style.left=Math.max(M,Math.min(x,sw-w-M))+'px';selbar.style.top=Math.max(M,y)+'px';
}
function selRefresh(){
  const P=pg(),have=new Set(P.elements.map(e=>e.id));for(const id of [...SEL.ids])if(!have.has(id))SEL.ids.delete(id);
  if(S.tool==='select'&&!S.active){clearLive();if(HOOKS.live)HOOKS.live()}
  placeSelBar();
}
on('live',()=>{drawSel();placeSelBar()});
on('hist',selRefresh);on('pages',()=>{SEL.ids.clear();selbar.hidden=true});on('load',()=>{SEL.ids.clear()});on('guard',()=>placeSelBar());

/* ---------- عمليات على المحدَّد ---------- */
function offsetClone(el,dx,dy){const c=cloneEl(el);c.tf=compose([1,0,0,1,dx,dy],c.tf);c.bbox=ELEMENT_TYPES[c.type].bbox(c);return c}
function addClones(list,label){
  const P=pg(),base=P.elements.length,ops=list.map((c,i)=>({op:'add',pageId:P.id,el:c,index:base+i}));
  if(commitOps(label,ops)){SEL.ids=new Set(list.map(c=>c.id));selRefresh();return true}return false;
}
function selCopy(){const els=selEls();if(!els.length)return false;CLIP.els=els.map(e=>cloneEl(e,true));CLIP.n=0;toast('نُسخ '+ar(els.length)+' عنصر');return true}
function selPaste(){
  if(!CLIP.els.length){toast('لا يوجد شيء منسوخ');return false}
  CLIP.n++;const d=36*CLIP.n;return addClones(CLIP.els.map(e=>offsetClone(e,d,d)),'لصق');
}
function selDup(){const els=selEls();if(!els.length)return false;return addClones(els.map(e=>offsetClone(e,40,40)),'تكرار')}
function selDelete(){
  const els=selEls();if(!els.length)return false;const P=pg(),idx=new Map();P.elements.forEach((e,i)=>idx.set(e,i));
  const ops=els.map(e=>({op:'remove',pageId:P.id,el:e,index:idx.get(e)})).sort((a,b)=>b.index-a.index);
  SEL.ids.clear();const ok=commitOps('حذف',ops);selRefresh();return ok;
}
function selCut(){if(!selCopy())return false;return selDelete()}
function selOrder(front){
  const els=selEls();if(!els.length)return false;const P=pg(),idx=new Map();P.elements.forEach((e,i)=>idx.set(e,i));
  const sorted=els.slice().sort((a,b)=>idx.get(a)-idx.get(b)),rem=sorted.map(e=>({op:'remove',pageId:P.id,el:e,index:idx.get(e)})).reverse();
  const n=P.elements.length-sorted.length,add=sorted.map((e,i)=>({op:'add',pageId:P.id,el:e,index:front?n+i:i}));
  const ok=commitOps(front?'إلى الأمام':'إلى الخلف',rem.concat(add));selRefresh();return ok;
}
function selRotate(){
  const els=selEls();if(!els.length)return false;const b=unionBox(els),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  /* دوران ٩٠° مع عقارب الساعة حول مركز المحدَّد: (x,y) → (cx-(y-cy), cy+(x-cx)) */
  const T=[0,1,-1,0,cx+cy,cy-cx],P=pg();
  const ops=els.map(e=>({op:'set',pageId:P.id,id:e.id,before:{tf:e.tf.slice()},after:{tf:compose(T,e.tf)}}));
  const ok=commitOps('تدوير',ops);selRefresh();return ok;
}
function recolorSel(c){
  const els=selEls().filter(e=>e.type==='stroke'||e.type==='shape'||e.type==='text');
  if(!els.length){toast('لا يوجد في المحدَّد ما يقبل تغيير اللون');return false}
  const P=pg(),ops=els.map(e=>({op:'set',pageId:P.id,id:e.id,before:{color:e.color},after:{color:c}}));
  const ok=commitOps('تغيير اللون',ops);recolorMode=false;hideOpts();selRefresh();return ok;
}
function selAll(){setTool('select',true);selSet(pg().elements.filter(e=>!e.locked));}
const SB_ITEMS=[['نسخ',selCopy],['قص',selCut],['لصق',selPaste],['تكرار',selDup],['حذف',selDelete],['للأمام',()=>selOrder(true)],['للخلف',()=>selOrder(false)],['تدوير ٩٠°',selRotate],['لون',()=>{recolorMode=true;renderOpts();optsEl.hidden=false;placeOpts()}]];
for(const[n,fn]of SB_ITEMS){const b=document.createElement('button');b.className='btn';b.textContent=n;b.dataset.act=n;b.onclick=()=>{fn()};selbar.appendChild(b)}
selbar.addEventListener('pointerdown',e=>e.stopPropagation());

/* ---------- المعالج ---------- */
let lastTap={id:null,t:0};
const SELECT_H={
  move(e,st){
    const q=pt(e);st.cur=q;
    if(!st.moved&&scrDist(st.p0,q)<4)return;
    if(!st.moved){st.moved=true;if(st.mode!=='marquee'){HIDE=new Set(st.els);redrawDoc();selbar.hidden=true}}
    if(st.mode==='move'){const dx=q.x-st.p0.x,dy=q.y-st.p0.y;st.T=[1,0,0,1,dx,dy]}
    else if(st.mode==='scale'){
      const h=st.hnd,A=st.anchor,b=st.box;let sx=1,sy=1;
      const bw=b[2]-b[0],bh=b[3]-b[1];
      const hx=h.ax===null?null:(h.ax===1?b[0]:b[2]),hy=h.ay===null?null:(h.ay===1?b[1]:b[3]);
      if(h.ax!==null&&h.ay!==null){const vx=(hx-A.x),vy=(hy-A.y),L2=vx*vx+vy*vy||1;const s=((q.x-A.x)*vx+(q.y-A.y)*vy)/L2;sx=sy=Math.max(0.05,s)}
      else if(h.ax!==null){sx=Math.max(0.05,(q.x-A.x)/((hx-A.x)||1));}
      else{sy=Math.max(0.05,(q.y-A.y)/((hy-A.y)||1));}
      st.T=[sx,0,0,sy,A.x*(1-sx),A.y*(1-sy)];
    }
  },
  flush(st){
    clearLive();
    if(!st.moved)return;
    if(st.mode==='marquee'){
      const a=toScreen(st.p0.x,st.p0.y),c=toScreen(st.cur.x,st.cur.y),x=Math.min(a.x,c.x),y=Math.min(a.y,c.y),w=Math.abs(a.x-c.x),h=Math.abs(a.y-c.y);
      lctx.save();lctx.setTransform(DPR,0,0,DPR,0,0);lctx.fillStyle='rgba(30,120,200,.12)';lctx.strokeStyle='rgba(30,120,200,.9)';lctx.lineWidth=1.5;lctx.setLineDash([5,4]);lctx.fillRect(x,y,w,h);lctx.strokeRect(x,y,w,h);lctx.restore();return;
    }
    const T=st.T;
    withPage(lctx,()=>{for(const el of st.els){const tf=compose(T,el.tf);lctx.save();lctx.transform(tf[0],tf[1],tf[2],tf[3],tf[4],tf[5]);ELEMENT_TYPES[el.type].render(lctx,el,{surface:S.board});lctx.restore()}});
    const b=st.box,c=[[b[0],b[1]],[b[2],b[3]]].map(([x,y])=>[T[0]*x+T[2]*y+T[4],T[1]*x+T[3]*y+T[5]]);
    drawBoxOverlay([Math.min(c[0][0],c[1][0]),Math.min(c[0][1],c[1][1]),Math.max(c[0][0],c[1][0]),Math.max(c[0][1],c[1][1])]);
  },
  up(st){
    clearLive();
    if(st.mode==='marquee'){
      if(!st.moved){
        const hit=topHit(st.p0.x,st.p0.y,isTouch({pointerType:st.rt.ptype})?14:8);
        if(!hit)selClear();
      }else{
        const a=st.p0,c=st.cur,x0=Math.min(a.x,c.x),y0=Math.min(a.y,c.y),x1=Math.max(a.x,c.x),y1=Math.max(a.y,c.y);
        const list=idxQuery(pg(),x0,y0,x1,y1).filter(e=>!e.locked);selSet(list);
        if(list.length)toast('حُدّد '+ar(list.length)+' عنصر',null,1500);
      }
      selRefresh();return;
    }
    if(!st.moved){
      HIDE=null;
      /* لمسة بلا تحريك: مزدوجة على نص = تعديل */
      const now=performance.now(),el=st.tapEl;
      if(el&&lastTap.id===el.id&&now-lastTap.t<500&&el.type==='text'){lastTap={id:null,t:0};selRefresh();editText(el);return}
      lastTap={id:el?el.id:null,t:now};selRefresh();return;
    }
    const T=st.T,P=pg(),ops=st.els.map(el=>({op:'set',pageId:P.id,id:el.id,before:{tf:el.tf.slice()},after:{tf:compose(T,el.tf)}}));
    HIDE=null;
    if(!commitOps(st.mode==='move'?'نقل':'تغيير الحجم',ops))redrawDoc();
    selRefresh();
  },
  cancel(st){HIDE=null;redrawDoc();selRefresh()},
  redraw(st){}
};
TOOLS.select={anywhere:true,down(e,p,t){
  if(FOCUS.picking){const hit=cardHitTop(p);if(hit)focusPickToggle(hit.card.id);return}
  const ch=cardHitTop(p);
  if(ch){if(ch.card.locked){selectCard(ch.card.id);toast('البطاقة مقفلة — افتح القفل من شريطها',null,1500);return}
    beginH(e,t,CARD_H,{mode:ch.mode,p0:p,cur:p,cid:ch.card.id,c0:{x:ch.card.x,y:ch.card.y,w:ch.card.w,h:ch.card.h},moved:false});schedule();return}
  const nls=pg().nline;
  if(nls&&nls.on){const nh=nlHit(p,nls);
    if(nh){if(FOCUS.on&&(FOCUS.protect||!FOCUS.allow.nline))return;if(nls.locked){toast('خط الأعداد مقفل — افتح القفل من قائمة المعلم',null,1500);return}
      beginH(e,t,NLINE_H,{mode:nh,p0:p,cur:p,nl0:{x:nls.x,y:nls.y,w:nls.w},moved:false});schedule();return}}
  const els=selEls(),touch=t==='touch';let st;
  if(els.length){
    const b=unionBox(els),h=handleAt(b,e);
    if(h){
      const A={x:h.ax===null?(b[0]+b[2])/2:(h.ax===1?b[2]:b[0]),y:h.ay===null?(b[1]+b[3])/2:(h.ay===1?b[3]:b[1])};
      /* المرساة هي الزاوية/الحافة المقابلة */
      A.x=h.ax===null?(b[0]+b[2])/2:(h.ax===1?b[2]:b[0]);A.y=h.ay===null?(b[1]+b[3])/2:(h.ay===1?b[3]:b[1]);
      const H={k:h.k,ax:h.ax,ay:h.ay};
      /* h.ax==1 يعني المقبض على الحافة اليسرى ⇒ المرساة اليمنى؛ ax==0 ⇒ المقبض يمين ⇒ المرساة يسار */
      const hx=h.ax===null?null:(h.ax===1?1:0),hy=h.ay===null?null:(h.ay===1?1:0);
      st=beginH(e,t,SELECT_H,{mode:'scale',p0:p,cur:p,els,box:b,anchor:A,hnd:{ax:hx,ay:hy},moved:false});schedule();return;
    }
  }
  const hit=topHit(p.x,p.y,touch?14:8),tol=6/K();
  if(hit&&!SEL.ids.has(hit.id)){if(e.shiftKey){SEL.ids.add(hit.id)}else selSet([hit]);selRefresh()}
  else if(hit&&e.shiftKey){SEL.ids.delete(hit.id);selRefresh();return}
  const cur=selEls();
  const inside=cur.length&&(()=>{const b=unionBox(cur);return p.x>=b[0]-tol&&p.x<=b[2]+tol&&p.y>=b[1]-tol&&p.y<=b[3]+tol})();
  if(cur.length&&(hit||inside)){beginH(e,t,SELECT_H,{mode:'move',p0:p,cur:p,els:cur,box:unionBox(cur),moved:false,tapEl:hit});schedule();return}
  if(!e.shiftKey)SEL.ids.clear();
  beginH(e,t,SELECT_H,{mode:'marquee',p0:p,cur:p,els:[],moved:false});selbar.hidden=true;
}};
/* مفاتيح */
document.addEventListener('keydown',e=>{
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  const k=(e.key||'').toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod&&k==='a'){e.preventDefault();selAll();return}
  if(S.tool!=='select')return;
  if(mod&&k==='c'){e.preventDefault();selCopy()}else if(mod&&k==='x'){e.preventDefault();selCut()}else if(mod&&k==='v'){e.preventDefault();selPaste()}else if(mod&&k==='d'){e.preventDefault();selDup()}
  else if(!mod&&(e.key==='Delete'||e.key==='Backspace')){if(FOCUS.on&&FOCUS.protect)return;e.preventDefault();selDelete()}
  else if(e.key==='Escape')selClear();
});
