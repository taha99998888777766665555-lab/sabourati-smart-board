
/* =====================================================================
   الإصدار التشغيلي — الوحدة ١: بنية الأدوات، الألوان، لوحة الخيارات، الأشكال، اختبار الإصابة
   ===================================================================== */
const CB={};function on(n,f){(CB[n]=CB[n]||[]).push(f);HOOKS[n]=(...a)=>{for(const g of CB[n])g(...a)}}
const $=id=>document.getElementById(id);
const stageEl=$('stage');
Object.assign(S,{hlInk:'#ffd600',hlWidth:28,shapeKind:'rect',fill:false,shapeLock:false,textSize:56,textBold:false});
Object.assign(S.m,{shapesMade:0});

/* ---------- رسائل وقوائم وتأكيد ---------- */
const toastEl=$('toast');let toastT=0;
function toast(msg,action,ms){
  clearTimeout(toastT);toastEl.innerHTML='';const s=document.createElement('span');s.textContent=msg;toastEl.appendChild(s);
  if(action){const b=document.createElement('button');b.className='btn';b.textContent=action.label;b.onclick=()=>{toastEl.hidden=true;action.fn()};toastEl.appendChild(b)}
  toastEl.hidden=false;announce(msg);toastT=setTimeout(()=>{toastEl.hidden=true},ms||(action?9000:3500));
}
const cfDlg=$('cfDlg');let cfRes=null;
function confirmBox(title,msg,okLabel){
  return new Promise(res=>{$('cfT').textContent=title;$('cfMsg').textContent=msg;$('cfOk').textContent=okLabel||'موافق';cfDlg.hidden=false;cfRes=res;$('cfNo').focus()});
}
function cfDone(v){if(!cfRes)return;cfDlg.hidden=true;const r=cfRes;cfRes=null;r(v)}
$('cfOk').onclick=()=>cfDone(true);$('cfNo').onclick=()=>cfDone(false);
let menuEl=null;
function closeMenu(){if(menuEl){menuEl.remove();menuEl=null}document.querySelectorAll('[aria-haspopup][aria-expanded=true]').forEach(b=>b.setAttribute('aria-expanded','false'))}
/* items: [{label,fn,pressed,disabled,head,sep,html}] */
function openMenu(anchor,items,opts){
  closeMenu();const m=document.createElement('div');m.className='menu';m.setAttribute('role','menu');menuEl=m;
  for(const it of items){
    if(it.sep){m.appendChild(document.createElement('hr'));continue}
    if(it.head){const h=document.createElement('div');h.className='mh';h.textContent=it.head;m.appendChild(h);continue}
    if(it.node){m.appendChild(it.node);continue}
    const b=document.createElement('button');b.className='mi';b.setAttribute('role','menuitem');b.textContent=it.label;if(it.pressed!==undefined)b.setAttribute('aria-pressed',String(!!it.pressed));if(it.disabled)b.disabled=true;
    b.onclick=()=>{if(!it.keep)closeMenu();it.fn&&it.fn()};m.appendChild(b);
  }
  document.body.appendChild(m);
  const r=anchor.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
  let x=(opts&&opts.side==='start')?r.left:r.right-mw,y=r.bottom+6;
  if(opts&&opts.above){y=r.top-mh-6}
  if(anchor.closest&&anchor.closest('#tbar')&&(TB.dock==='right'||TB.dock==='left')){x=TB.dock==='right'?r.left-mw-8:r.right+8;y=r.top}
  if(y+mh>vh-6)y=Math.max(6,Math.min(r.top-mh-6,vh-6-mh));if(y<6)y=6;
  x=Math.max(6,Math.min(x,vw-mw-6));m.style.left=x+'px';m.style.top=y+'px';
  anchor.setAttribute('aria-expanded','true');const f=m.querySelector('button');if(f&&!(opts&&opts.noFocus))f.focus();
  return m;
}
document.addEventListener('pointerdown',e=>{if(menuEl&&!menuEl.contains(e.target)&&!e.target.closest('[aria-haspopup]'))closeMenu()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!cfDlg.hidden)cfDone(false);closeMenu();hideOpts()}});

/* ---------- الألوان ---------- */
const COLORS=[['auto','تلقائي (يتباين مع السبورة)'],['sem:red','أحمر'],['sem:blue','أزرق'],['sem:green','أخضر'],['#ef6c00','برتقالي'],['#8e24aa','بنفسجي'],['#d81b60','وردي'],['#00838f','فيروزي'],['#6d4c41','بني'],['#fbc02d','أصفر'],['#757575','رمادي'],['#000000','أسود ثابت'],['#ffffff','أبيض ثابت']];
const HL_COLORS=[['#ffd600','أصفر'],['#69f0ae','أخضر'],['#ff80ab','وردي'],['#40c4ff','أزرق سماوي'],['#ffab40','برتقالي']];
const colorCss=c=>c==='auto'?'linear-gradient(135deg,'+PALETTE.auto.light+' 50%,'+PALETTE.auto.dark+' 50%)':resolveColor(c,S.board);
const toolColor=()=>S.tool==='hl'?S.hlInk:S.ink;
function setColor(c){
  if(recolorMode){recolorSel(c);return}
  if(S.tool==='hl')S.hlInk=c;else S.ink=c;
  updColorDot();if(!optsEl.hidden)renderOpts();
}
function updColorDot(){$('colorDot').style.background=colorCss(toolColor())}
on('colors',updColorDot);

/* ---------- هندسة: إصابة العناصر ---------- */
const detOf=tf=>tf[0]*tf[3]-tf[1]*tf[2];
function toLocal(el,x,y){const[a,b,c,d,e,f]=el.tf,D=a*d-b*c;return[(d*(x-e)-c*(y-f))/D,(-b*(x-e)+a*(y-f))/D]}
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=t<0?0:t>1?1:t;return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))}
function shapeGeom(el){
  const l=Math.min(el.x0,el.x1),r=Math.max(el.x0,el.x1),t=Math.min(el.y0,el.y1),b=Math.max(el.y0,el.y1),cx=(l+r)/2,cy=(t+b)/2;
  switch(el.kind){
    case'rect':return{poly:[[l,t],[r,t],[r,b],[l,b]],closed:true};
    case'triangle':return{poly:[[cx,t],[r,b],[l,b]],closed:true};
    case'rtriangle':return{poly:[[l,t],[l,b],[r,b]],closed:true};
    case'diamond':return{poly:[[cx,t],[r,cy],[cx,b],[l,cy]],closed:true};
    case'ellipse':return{ell:[cx,cy,(r-l)/2,(b-t)/2]};
    default:return{poly:[[el.x0,el.y0],[el.x1,el.y1]],closed:false};
  }
}
function polyDist(poly,closed,x,y){let m=1e18;const n=poly.length;for(let i=0;i<(closed?n:n-1);i++){const a=poly[i],b=poly[(i+1)%n];m=Math.min(m,segDist(x,y,a[0],a[1],b[0],b[1]))}return m}
function inPoly(poly,x,y){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
/* tol: بوحدات الصفحة */
function hitElement(el,x,y,tol){
  if(el.locked)return false;
  const sc=Math.sqrt(Math.abs(detOf(el.tf)))||1,tl=tol/sc;
  if(el.type==='stroke')return ERASE.hitStroke(el,{ax:x,ay:y,bx:x,by:y,r:tol}).hit;
  const[lx,ly]=toLocal(el,x,y);
  if(el.type==='shape'){
    const g=shapeGeom(el),hw=el.w/2+tl;
    if(g.ell){const[cx,cy,rx,ry]=g.ell;if(rx<1e-6||ry<1e-6)return Math.hypot(lx-cx,ly-cy)<=hw;const f=Math.hypot((lx-cx)/rx,(ly-cy)/ry);if(Math.abs(f-1)*Math.min(rx,ry)<=hw)return true;return !!el.fill&&f<1}
    if(polyDist(g.poly,g.closed,lx,ly)<=hw)return true;
    return !!el.fill&&g.closed&&inPoly(g.poly,lx,ly);
  }
  const b=el.bbox0||ELEMENT_TYPES[el.type].lbox(el);
  return lx>=b[0]-tl&&lx<=b[2]+tl&&ly>=b[1]-tl&&ly<=b[3]+tl;
}
function hitCap(el,cap){
  const r=cap.r,len=Math.hypot(cap.bx-cap.ax,cap.by-cap.ay),n=Math.max(1,Math.ceil(len/Math.max(2,r/2)));
  for(let i=0;i<=n;i++){const t=i/n;if(hitElement(el,cap.ax+(cap.bx-cap.ax)*t,cap.ay+(cap.by-cap.ay)*t,r))return true}
  return false;
}
/* أعلى عنصر عند نقطة (بوحدات الصفحة) */
function topHit(x,y,tolPx){
  const P=pg(),tol=tolPx/K(),list=idxQuery(P,x-tol,y-tol,x+tol,y+tol);
  for(let i=list.length-1;i>=0;i--)if(hitElement(list[i],x,y,tol))return list[i];
  return null;
}

/* ---------- نوع العنصر: شكل ---------- */
const SHAPE_KINDS=[['line','خط'],['arrow','سهم'],['rect','مستطيل'],['ellipse','بيضاوي'],['triangle','مثلث'],['rtriangle','قائم الزاوية'],['diamond','معين'],['circle','دائرة بالمركز']];
const SHAPE_SET=new Set(['line','arrow','rect','ellipse','triangle','rtriangle','diamond']);
function readTf(raw,E,path){
  if(raw.tf===undefined)return IDENT.slice();
  if(!Array.isArray(raw.tf)||raw.tf.length!==6||!raw.tf.every(v=>fin(v)&&Math.abs(v)<=LIM.coord)){E.push(path+': مصفوفة التحويل غير صالحة');return null}
  if(Math.abs(raw.tf[0]*raw.tf[3]-raw.tf[1]*raw.tf[2])<1e-9){E.push(path+': مصفوفة التحويل منعدمة (تقييس صفري)');return null}
  return raw.tf.slice();
}
const arrowHead=w=>Math.max(16,w*3.5);
function shapeBBox(el){
  const pad=el.w/2+(el.kind==='arrow'?arrowHead(el.w):0);
  return[Math.min(el.x0,el.x1)-pad,Math.min(el.y0,el.y1)-pad,Math.max(el.x0,el.x1)+pad,Math.max(el.y0,el.y1)+pad];
}
ELEMENT_TYPES.shape={
  bbox:shapeBBox,lbox:shapeBBox,
  render(ctx,el,env){
    const col=resolveColor(el.color,env.surface);ctx.strokeStyle=col;ctx.lineWidth=el.w;ctx.lineJoin='round';ctx.lineCap='round';
    const g=shapeGeom(el);ctx.beginPath();
    if(g.ell){const[cx,cy,rx,ry]=g.ell;ctx.ellipse(cx,cy,Math.max(0.01,rx),Math.max(0.01,ry),0,0,Math.PI*2)}
    else{g.poly.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));if(g.closed)ctx.closePath()}
    if(el.kind==='arrow'){
      const a=Math.atan2(el.y1-el.y0,el.x1-el.x0),h=arrowHead(el.w);
      ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x1-h*Math.cos(a-0.45),el.y1-h*Math.sin(a-0.45));
      ctx.moveTo(el.x1,el.y1);ctx.lineTo(el.x1-h*Math.cos(a+0.45),el.y1-h*Math.sin(a+0.45));
    }
    if(el.fill&&(g.ell||g.closed)){ctx.save();ctx.globalAlpha=0.2;ctx.fillStyle=col;ctx.fill();ctx.restore()}
    ctx.stroke();
  },
  validate(raw,E,path){
    if(!SHAPE_SET.has(raw.kind)){E.push(path+': نوع شكل غير معروف');return null}
    for(const k of['x0','y0','x1','y1'])if(!fin(raw[k])||Math.abs(raw[k])>LIM.coord){E.push(path+': إحداثيات الشكل غير صالحة');return null}
    if(!fin(raw.w)||raw.w<=0||raw.w>LIM.wMax){E.push(path+': سماكة الشكل غير صالحة');return null}
    if(typeof raw.color!=='string'||!COLOR_RE.test(raw.color)){E.push(path+': لون غير صالح');return null}
    if(raw.fill!==undefined&&typeof raw.fill!=='boolean'){E.push(path+': تعبئة غير صالحة');return null}
    const tf=readTf(raw,E,path);if(!tf)return null;
    const el={id:raw.id,type:'shape',kind:raw.kind,x0:raw.x0,y0:raw.y0,x1:raw.x1,y1:raw.y1,w:raw.w,color:raw.color,fill:!!raw.fill,tf};el.bbox=shapeBBox(el);return el;
  },
  serialize(el){return{id:el.id,type:'shape',kind:el.kind,x0:r3(el.x0),y0:r3(el.y0),x1:r3(el.x1),y1:r3(el.y1),w:r3(el.w),color:el.color,fill:!!el.fill,tf:el.tf.map(r3)}}
};

/* ---------- بدء حالة نشطة لأداة ذات معالج ---------- */
function beginH(e,t,h,extra){
  e.preventDefault();try{liveC.setPointerCapture(e.pointerId)}catch(_){}
  const st=Object.assign({id:'h',h,rt:{ptype:t,pid:e.pointerId,t0:performance.now(),redo:false}},extra);
  S.active=st;updGuard();return st;
}
const scrDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)*K();

/* ---------- أداة الأشكال ---------- */
function shapeFromDrag(kind,a,b,lock){
  let x1=b.x,y1=b.y;
  if(kind==='circle'){const r=Math.hypot(b.x-a.x,b.y-a.y);return{kind:'ellipse',x0:a.x-r,y0:a.y-r,x1:a.x+r,y1:a.y+r}}
  if(lock){
    if(kind==='line'||kind==='arrow'){const ang=Math.round(Math.atan2(y1-a.y,x1-a.x)/(Math.PI/12))*(Math.PI/12),L=Math.hypot(x1-a.x,y1-a.y);x1=a.x+L*Math.cos(ang);y1=a.y+L*Math.sin(ang)}
    else{const s=Math.max(Math.abs(x1-a.x),Math.abs(y1-a.y));x1=a.x+Math.sign(x1-a.x||1)*s;y1=a.y+Math.sign(y1-a.y||1)*s}
  }
  return{kind,x0:a.x,y0:a.y,x1,y1};
}
function newShape(g){const el={id:uid('e'),type:'shape',kind:g.kind,x0:g.x0,y0:g.y0,x1:g.x1,y1:g.y1,w:S.width,color:S.ink,fill:S.fill,tf:IDENT.slice()};el.bbox=shapeBBox(el);return el}
const SHAPE_H={
  move(e,st){const q=pt(e);st.b=q;st.lock=S.shapeLock||e.shiftKey},
  flush(st){
    clearLive();const g=shapeFromDrag(st.kind,st.a,st.b,st.lock),el=newShape(g);
    withPage(lctx,()=>ELEMENT_TYPES.shape.render(lctx,el,{surface:S.board}));
    if(st.kind==='circle'){const q=toScreen(st.a.x,st.a.y),r=Math.hypot(st.b.x-st.a.x,st.b.y-st.a.y);
      lctx.save();lctx.setTransform(DPR,0,0,DPR,0,0);lctx.font='600 15px PlexAr,sans-serif';lctx.fillStyle=SURFACES[S.board].tone==='dark'?'#fff':'#111';lctx.fillText('نق = '+ar(Math.round(r)),q.x+6,q.y-8);
      lctx.beginPath();lctx.arc(q.x,q.y,3,0,6.2832);lctx.fill();lctx.restore()}
  },
  up(st){
    clearLive();
    if(scrDist(st.a,st.b)<6)return;
    const el=newShape(shapeFromDrag(st.kind,st.a,st.b,st.lock));const P=pg();
    if(commitOps('شكل',[{op:'add',pageId:P.id,el,index:P.elements.length}]))S.m.shapesMade++;
  },
  cancel(st){clearLive()}
};
TOOLS.shape={down(e,p,t){beginH(e,t,SHAPE_H,{kind:S.shapeKind,a:{x:p.x,y:p.y},b:{x:p.x,y:p.y},lock:false});schedule()}};

/* ---------- أداة اليد (تحريك الصفحة) ---------- */
const HAND_H={
  move(e,st){const dx=(e.clientX-st.sx)/K(),dy=(e.clientY-st.sy)/K();const v=pg().view;setViewClamped(v.zoom,st.cx-dx,st.cy-dy)},
  up(st){},cancel(st){}
};
TOOLS.hand={anywhere:true,down(e,p,t){const v=pg().view;beginH(e,t,HAND_H,{sx:e.clientX,sy:e.clientY,cx:v.cx,cy:v.cy})}};

/* ---------- تبديل الأدوات ---------- */
const TOOL_BTN={pen:'toolPen',hl:'toolHl',erase:'toolErase',select:'toolSelect',shape:'toolShape',text:'toolText',hand:'toolHand'};
const TOOL_NAME={pen:'القلم',hl:'قلم التمييز',erase:'الممحاة',select:'التحديد',shape:'الأشكال',text:'النص',hand:'تحريك الصفحة'};
const CUR={pen:'crosshair',hl:'crosshair',erase:'none',select:'default',shape:'crosshair',text:'text',hand:'grab'};
function setTool(t,noOpts){
  if(!TOOL_BTN[t])t='pen';
  cancelActive(null);hideTextEditor(true);
  const was=S.tool;S.tool=t;
  for(const k in TOOL_BTN)$(TOOL_BTN[k]).setAttribute('aria-pressed',String(k===t));
  liveC.style.cursor=CUR[t];clearLive();if(HOOKS.live)HOOKS.live();
  if(was==='select'&&t!=='select')selClear();
  updColorDot();recolorMode=false;
  if(noOpts)hideOpts();
  announce(TOOL_NAME[t]);
}
function setEraseMode(m){S.eraser.mode=m==='whole'?'whole':'partial';if(!optsEl.hidden&&S.tool==='erase')renderOpts()}
let recolorMode=false;

/* ---------- لوحة الخيارات العائمة ---------- */
const optsEl=$('opts');
function hideOpts(){optsEl.hidden=true;recolorMode=false}
function placeOpts(){
  if(optsEl.hidden)return;
  const sr=stageEl.getBoundingClientRect(),tr=tbar.getBoundingClientRect(),M=8;
  const pb=document.getElementById('pgbar');const pbr=pb&&!pb.hidden?pb.getBoundingClientRect():null;
  const maxB=pbr?pbr.top-sr.top-M:sr.height-M;
  const d=TB.dock;let yMin=M;
  if(d==='top')yMin=tr.bottom-sr.top+M;
  optsEl.style.maxHeight=Math.max(120,maxB-yMin)+'px';
  const w=optsEl.offsetWidth,h=optsEl.offsetHeight;
  let x,y;
  if(d==='right'){x=tr.left-sr.left-w-M;y=tr.top-sr.top}
  else if(d==='left'){x=tr.right-sr.left+M;y=tr.top-sr.top}
  else if(d==='bottom'){x=(tr.left+tr.right)/2-sr.left-w/2;y=tr.top-sr.top-h-M}
  else{x=(tr.left+tr.right)/2-sr.left-w/2;y=tr.bottom-sr.top+M}
  x=Math.max(M,Math.min(x,sr.width-w-M));y=Math.max(yMin,Math.min(y,maxB-h));
  optsEl.style.left=x+'px';optsEl.style.top=y+'px';
}
function swatchRow(list,cur,fn){
  const row=document.createElement('div');row.className='swrow';
  for(const[c,n]of list){const b=document.createElement('button');b.className='sw';b.style.background=c==='auto'?colorCss('auto'):(c[0]==='#'?c:colorCss(c));b.setAttribute('aria-label',n);b.title=n;b.setAttribute('aria-pressed',String(c===cur));b.dataset.ink=c;b.onclick=()=>fn(c);row.appendChild(b)}
  return row;
}
function addHead(t){const h=document.createElement('h3');h.textContent=t;optsEl.appendChild(h)}
function slider(label,min,max,val,fn,id){
  const r=document.createElement('div');r.className='optrow';
  const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type='range';i.min=min;i.max=max;i.value=val;if(id)i.id=id;i.setAttribute('aria-label',label);
  const v=document.createElement('span');v.className='val';v.textContent=ar(val);i.oninput=()=>{v.textContent=ar(+i.value);fn(+i.value)};
  r.append(l,i,v);optsEl.appendChild(r);return i;
}
function toggle(label,on,fn,id){
  const b=document.createElement('button');b.className='btn';b.textContent=label;b.setAttribute('aria-pressed',String(!!on));if(id)b.id=id;b.onclick=()=>{const v=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(v));fn(v)};
  optsEl.appendChild(b);b.style.margin='6px 6px 0 0';return b;
}
function customColor(){
  const w=document.createElement('div');w.className='optrow';w.style.marginTop='6px';
  const l=document.createElement('label');l.textContent='لون مخصص';const i=document.createElement('input');i.type='color';i.setAttribute('aria-label','لون مخصص');i.value='#2e7d32';
  i.oninput=()=>setColor(i.value.toLowerCase());w.append(l,i);optsEl.appendChild(w);
}
function renderOpts(){
  optsEl.innerHTML='';const t=S.tool;
  if(recolorMode){addHead('لون العناصر المحدَّدة');optsEl.appendChild(swatchRow(COLORS,null,setColor));customColor();return}
  const title=document.createElement('h3');title.textContent={pen:'القلم',hl:'قلم التمييز',erase:'الممحاة',select:'التحديد',shape:'الأشكال',text:'النص',hand:'تحريك الصفحة'}[t];optsEl.appendChild(title);
  if(t==='pen'||t==='shape'||t==='text'){addHead('اللون');optsEl.appendChild(swatchRow(COLORS,S.ink,setColor));customColor()}
  if(t==='hl'){addHead('اللون');optsEl.appendChild(swatchRow(HL_COLORS,S.hlInk,setColor));customColor()}
  if(t==='pen'){addHead('السماكة');slider('السماكة',2,40,S.width,v=>{S.width=v},'width');toggle('الضغط',S.pressure,v=>{S.pressure=v},'pressure')}
  if(t==='shape'){
    addHead('نوع الشكل');const g=document.createElement('div');g.className='shapegrid';
    for(const[k,n]of SHAPE_KINDS){const b=document.createElement('button');b.className='btn';b.textContent=n;b.dataset.kind=k;b.setAttribute('aria-pressed',String(S.shapeKind===k));b.onclick=()=>{S.shapeKind=k;renderOpts()};g.appendChild(b)}
    optsEl.appendChild(g);addHead('سماكة الحدّ');slider('السماكة',2,30,S.width,v=>{S.width=v},'width');
    toggle('تعبئة شفافة',S.fill,v=>{S.fill=v},'fillTg');toggle('نسب ثابتة (مربع/دائرة/زاوية ١٥°)',S.shapeLock,v=>{S.shapeLock=v},'lockTg');
  }
  if(t==='hl'){addHead('السماكة');slider('السماكة',10,70,S.hlWidth,v=>{S.hlWidth=v},'hlw')}
  if(t==='text'){addHead('حجم الخط');slider('الحجم',16,220,S.textSize,v=>{S.textSize=v},'tsize');toggle('خط عريض',S.textBold,v=>{S.textBold=v},'tbold')}
  if(t==='erase'){
    addHead('نوع المحو');const r=document.createElement('div');r.className='optrow';
    for(const[m,n]of[['partial','محو جزئي'],['whole','محو كامل']]){const b=document.createElement('button');b.className='btn';b.textContent=n;b.dataset.m=m;b.setAttribute('aria-pressed',String(S.eraser.mode===m));b.onclick=()=>setEraseMode(m);r.appendChild(b)}
    optsEl.appendChild(r);addHead('حجم الممحاة');slider('الحجم',4,60,S.eraser.r,v=>{S.eraser.r=v},'eraseSize');
    const n=document.createElement('p');n.className='small';n.textContent='الأشكال والنصوص والصور تُمحى كاملة عند لمسها.';optsEl.appendChild(n);
  }
  if(t==='hand'||t==='select'){const n=document.createElement('p');n.className='small';n.textContent=t==='hand'?'اسحب لتحريك الصفحة. بإصبعين: تكبير وتحريك.':'المس عنصرًا لتحديده، أو اسحب على فراغ لتحديد مجموعة.';optsEl.appendChild(n)}
}
function showOpts(){renderOpts();optsEl.hidden=false;placeOpts()}
function toolClick(t){
  if(S.tool===t){if(optsEl.hidden)showOpts();else hideOpts()}
  else{setTool(t,true);if(t!=='hand')showOpts();else hideOpts()}
}
for(const k of['pen','hl','erase','select','shape','text'])$(TOOL_BTN[k]).onclick=()=>toolClick(k);
$('toolHand').onclick=()=>{if(S.tool==='hand')setTool('pen',true);else setTool('hand',true)};
$('colorBtn').onclick=()=>{if(!optsEl.hidden&&!recolorMode){hideOpts();return}recolorMode=false;if(['erase','select','hand'].includes(S.tool))setTool('pen',true);showOpts()};
/* الأداة الحالية لا تُخفى لوحتها عند فتح قائمة أخرى؛ وتُغلق عند بدء الرسم */
on('guard',()=>{if(S.active&&!optsEl.hidden)hideOpts()});
on('layoutTb',placeOpts);
window.addEventListener('resize',()=>placeOpts());
new ResizeObserver(()=>{placeOpts()}).observe(tbar);
