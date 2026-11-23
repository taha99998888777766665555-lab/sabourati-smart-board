
/* =====================================================================
   الوحدة ٢: الصفحات (إضافة/نسخ/حذف/نقل/تنقل) والعرض (تكبير/تحريك/قرص)
   ===================================================================== */
/* ---------- نسخ العناصر والصفحات ---------- */
function cloneEl(el,keepId){
  const c=JSON.parse(JSON.stringify(el));c.tf=el.tf.slice();if(!keepId)c.id=uid('e');
  if(c.bbox)c.bbox=c.bbox.slice();delete c.bbox0;return c;
}
function clonePage(p){
  const np=newPage(p.w,p.h,p.background.surface);np.background.type=p.background.type||'plain';
  if(p.background.opts)np.background.opts=JSON.parse(JSON.stringify(p.background.opts));
  if(p.nline)np.nline=JSON.parse(JSON.stringify(p.nline));
  if(p.cards)np.cards=p.cards.map(c=>{const n=JSON.parse(JSON.stringify(c));n.id=uid('c');return n});
  np.elements=p.elements.map(e=>cloneEl(e));np.view={zoom:1,cx:p.w/2,cy:p.h/2};return np;
}
const blankLike=p=>{const np=newPage(p.w,p.h,p.background.surface);np.background.type=p.background.type||'plain';if(p.background.opts)np.background.opts=JSON.parse(JSON.stringify(p.background.opts));if(p.nline)np.nline=JSON.parse(JSON.stringify(p.nline));return np};

/* ---------- عمليات الصفحات (كلها قابلة للتراجع) ---------- */
function addPageAfter(){const i=S.doc.activePage,np=blankLike(pg());if(S.doc.pages.length>=LIM.pages){toast('بلغ المستند الحد الأقصى للصفحات');return false}
  return commitPageOps('إضافة صفحة',[{op:'pageAdd',pageId:np.id,index:i+1,page:np}],np.id)}
function duplicatePage(i){i=i==null?S.doc.activePage:i;if(S.doc.pages.length>=LIM.pages){toast('بلغ المستند الحد الأقصى للصفحات');return false}
  const np=clonePage(S.doc.pages[i]);return commitPageOps('نسخ صفحة',[{op:'pageAdd',pageId:np.id,index:i+1,page:np}],np.id)}
function deletePage(i){
  i=i==null?S.doc.activePage:i;const P=S.doc.pages;
  if(P.length<2){toast('لا يمكن حذف الصفحة الوحيدة. استخدم «مسح» لتفريغها.');return false}
  const pg0=P[i];return commitPageOps('حذف صفحة',[{op:'pageDel',pageId:pg0.id,index:i,page:pg0}],null);
}
function movePage(i,j){
  const P=S.doc.pages;if(j<0||j>=P.length||i===j)return false;const pg0=P[i];
  return commitPageOps('نقل صفحة',[{op:'pageDel',pageId:pg0.id,index:i,page:pg0},{op:'pageAdd',pageId:pg0.id,index:j,page:pg0}],pg0.id);
}
const goPage=i=>{if(i<0||i>=S.doc.pages.length)return false;return setActivePage(i)};
$('pgPrev').onclick=()=>goPage(S.doc.activePage-1);
$('pgNext').onclick=()=>goPage(S.doc.activePage+1);
$('pgAdd').onclick=()=>addPageAfter();

/* ---------- لوحة الصفحات ---------- */
const pgPanel=$('pgPanel');let pgThumbGen=0;
function renderPanel(){
  const gen=++pgThumbGen,P=S.doc.pages,cur=S.doc.activePage;
  pgPanel.innerHTML='';
  const hd=document.createElement('div');hd.className='ph';
  const mk=(txt,fn,dis)=>{const b=document.createElement('button');b.className='btn';b.textContent=txt;b.disabled=!!dis;b.onclick=fn;hd.appendChild(b);return b};
  mk('إضافة صفحة',()=>{addPageAfter()});mk('نسخ الصفحة',()=>{duplicatePage()});mk('حذف الصفحة',()=>{deletePage()},P.length<2);
  mk('نقل للأمام',()=>{movePage(cur,cur-1)},cur===0);mk('نقل للخلف',()=>{movePage(cur,cur+1)},cur===P.length-1);mk('إغلاق',()=>{pgPanel.hidden=true});
  const g=document.createElement('div');g.className='grid';g.setAttribute('role','list');
  pgPanel.append(hd,g);
  P.forEach((p,i)=>{
    const th=document.createElement('button');th.className='thumb';th.setAttribute('role','listitem');th.setAttribute('aria-current',String(i===cur));th.setAttribute('aria-label','صفحة '+ar(i+1));
    const cv=document.createElement('canvas');const tw=150;cv.width=tw;cv.height=Math.max(1,Math.round(tw*p.h/p.w));
    const lab=document.createElement('span');lab.textContent='صفحة '+ar(i+1);th.append(cv,lab);th.onclick=()=>{goPage(i);pgPanel.hidden=true};g.appendChild(th);
    requestAnimationFrame(()=>{if(gen!==pgThumbGen)return;try{const x=cv.getContext('2d');x.setTransform(cv.width/p.w,0,0,cv.width/p.w,0,0);renderPage(x,p,undefined,true)}catch(_){}});
  });
}
$('pgNum').onclick=()=>{if(pgPanel.hidden){pgPanel.hidden=false;renderPanel()}else pgPanel.hidden=true};
function updPgInfo(){
  const n=S.doc.pages.length,i=S.doc.activePage;
  $('pgNum').textContent='صفحة '+ar(i+1)+' من '+ar(n);
  $('pgPrev').disabled=i<=0;$('pgNext').disabled=i>=n-1;
  if(!pgPanel.hidden)renderPanel();
}
on('pages',updPgInfo);on('info',updPgInfo);

/* ---------- العرض: تكبير وتحريك ---------- */
const ZMIN=0.2,ZMAX=8;
function setViewClamped(zoom,cx,cy){
  const P=pg(),v=P.view;zoom=clamp(zoom,ZMIN,ZMAX);cx=clamp(cx,0,P.w);cy=clamp(cy,0,P.h);
  v.zoom=zoom;v.cx=cx;v.cy=cy;redrawAll();
}
function zoomAt(f,sx,sy){
  /* الحفاظ على النقطة تحت المؤشر */
  const v=pg().view,L=toLogical(sx,sy),nz=clamp(v.zoom*f,ZMIN,ZMAX),nk=fitScale()*nz;
  setViewClamped(nz,L.x-(sx-W/2)/nk,L.y-(sy-H/2)/nk);
}
const zoomCenter=f=>zoomAt(f,W/2,H/2);
function viewReset(){const P=pg();setViewClamped(1,P.w/2,P.h/2)}
$('zIn').onclick=()=>zoomCenter(1.25);$('zOut').onclick=()=>zoomCenter(0.8);$('zVal').onclick=viewReset;
function updZoom(){$('zVal').textContent=ar(Math.round(pg().view.zoom*100))+'٪'}
on('live',updZoom);
liveC.addEventListener('wheel',e=>{
  e.preventDefault();const r=liveC.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;
  if(e.ctrlKey||e.metaKey)zoomAt(Math.exp(-e.deltaY*(e.deltaMode?0.05:0.0022)),sx,sy);
  else{const v=pg().view,k=K(),dx=(e.shiftKey?e.deltaY:e.deltaX)/k,dy=(e.shiftKey?0:e.deltaY)/k;setViewClamped(v.zoom,v.cx+dx,v.cy+dy)}
},{passive:false});
/* قرص بإصبعين: تكبير وتحريك (يعمل في كل الأدوات ويلغي الخط الجاري، كما تفعل السياسة الحالية) */
const TPTS=new Map();let pinch=null;
function tp2(){const a=[...TPTS.values()];return a.length>=2?[a[0],a[1]]:null}
liveC.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  const r=liveC.getBoundingClientRect();TPTS.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});
  const two=tp2();if(two&&!pinch){
    if(S.active)cancelActive('cancelledMulti');
    const v=pg().view,mx=(two[0].x+two[1].x)/2,my=(two[0].y+two[1].y)/2;
    pinch={d0:Math.max(8,Math.hypot(two[0].x-two[1].x,two[0].y-two[1].y)),z0:v.zoom,L0:toLogical(mx,my),n:TPTS.size};
  }
},true);
liveC.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch'||!TPTS.has(e.pointerId))return;
  const r=liveC.getBoundingClientRect();TPTS.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});
  if(!pinch)return;const two=tp2();if(!two)return;
  const mx=(two[0].x+two[1].x)/2,my=(two[0].y+two[1].y)/2,d=Math.hypot(two[0].x-two[1].x,two[0].y-two[1].y);
  const nz=clamp(pinch.z0*d/pinch.d0,ZMIN,ZMAX),nk=fitScale()*nz;
  setViewClamped(nz,pinch.L0.x-(mx-W/2)/nk,pinch.L0.y-(my-H/2)/nk);
},true);
const tpEnd=e=>{if(e.pointerType!=='touch')return;TPTS.delete(e.pointerId);if(TPTS.size<2)pinch=null};
liveC.addEventListener('pointerup',tpEnd,true);liveC.addEventListener('pointercancel',tpEnd,true);
window.addEventListener('blur',()=>{TPTS.clear();pinch=null});
/* مفاتيح */
document.addEventListener('keydown',e=>{
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='+'||e.key==='='){zoomCenter(1.25)}else if(e.key==='-'){zoomCenter(0.8)}else if(e.key==='0'){viewReset()}
  else if(e.key==='PageDown'){goPage(S.doc.activePage+1)}else if(e.key==='PageUp'){goPage(S.doc.activePage-1)}
});
