
/* =====================================================================
   الوحدة ٦: أدوات المعلم — مسطرة، منقلة، ستارة، مؤقت، خلفيات الصفحة (سطور/مربعات/نقاط)
   كلها طبقات عرض فوق السبورة: لا تدخل المستند ولا التصدير. ما يظهر منها لا يتغير بالتكبير (مقاييس الشاشة).
   ===================================================================== */
const ovl=$('ovl');
const TT={ruler:null,proto:null,curtain:null,timer:null,bgAll:false};
const CM=96/2.54;   /* بكسل CSS لكل سنتيمتر بافتراض ٩٦ نقطة/بوصة؛ تقريبي ويعتمد على معايرة الشاشة */
function tfStr(o,w,h){return 'translate('+o.cx+'px,'+o.cy+'px) rotate('+o.ang+'rad) translate('+(-w/2)+'px,'+(-h/2)+'px)'}
function stagePt(e){const r=stageEl.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
const SVGNS='http://www.w3.org/2000/svg';
function svgEl(n,a,txt){const e=document.createElementNS(SVGNS,n);for(const k in a)e.setAttribute(k,a[k]);if(txt!==undefined)e.textContent=txt;return e}
function mkBtn(label,cls,fn){const b=document.createElement('button');b.className='btn '+(cls||'');b.textContent=label;b.onclick=fn;b.addEventListener('pointerdown',e=>e.stopPropagation());return b}
/* سحب عام: يحرّك مركز الجسم */
function dragMove(el,o,onMove){
  el.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;e.preventDefault();e.stopPropagation();const p0=stagePt(e),c0={x:o.cx,y:o.cy};
    try{el.setPointerCapture(e.pointerId)}catch(_){}
    const mv=ev=>{if(ev.pointerId!==e.pointerId)return;const p=stagePt(ev);o.cx=c0.x+p.x-p0.x;o.cy=c0.y+p.y-p0.y;onMove()};
    const up=ev=>{if(ev.pointerId!==e.pointerId)return;el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};
    el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  });
}
function dragRotate(h,o,onMove){
  h.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();try{h.setPointerCapture(e.pointerId)}catch(_){}
    const mv=ev=>{if(ev.pointerId!==e.pointerId)return;const p=stagePt(ev);o.ang=Math.atan2(p.y-o.cy,p.x-o.cx);onMove()};
    const up=ev=>{if(ev.pointerId!==e.pointerId)return;h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up)};
    h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
  });
}
const darkBoard=()=>SURFACES[S.board].tone==='dark';

/* ---------- المسطرة ---------- */
const RL=Math.round(16*CM)+80,RT=78;
function toggleRuler(){
  if(TT.ruler){TT.ruler.el.remove();TT.ruler=null;return false}
  const o={cx:Math.max(RL/2+10,stageEl.clientWidth/2),cy:Math.min(stageEl.clientHeight-120,stageEl.clientHeight*0.62),ang:0};
  const el=document.createElement('div');el.className='ruler';el.setAttribute('role','img');el.setAttribute('aria-label','مسطرة');el.style.cssText='left:0;top:0;width:'+RL+'px;height:'+RT+'px;transform-origin:0 0';
  const svg=svgEl('svg',{width:RL,height:RT,viewBox:'0 0 '+RL+' '+RT});
  svg.appendChild(svgEl('rect',{x:0,y:0,width:RL,height:RT,rx:8,fill:'rgba(255,236,170,.88)',stroke:'#8a6d00','stroke-width':2}));
  const x0=70;
  for(let mm=0;mm<=160;mm++){const x=x0+mm*CM/10,maj=mm%10===0,mid=mm%5===0;if(x>RL-12)break;
    svg.appendChild(svgEl('line',{x1:x,x2:x,y1:0,y2:maj?22:mid?15:9,stroke:'#5d4600','stroke-width':maj?2:1.2}));
    if(maj)svg.appendChild(svgEl('text',{x:x,y:42,'text-anchor':'middle','font-size':16,fill:'#3d2f00','font-family':'PlexAr,sans-serif'},ar(mm/10)))}
  svg.appendChild(svgEl('text',{x:RL-40,y:66,'text-anchor':'middle','font-size':13,fill:'#5d4600','font-family':'PlexAr,sans-serif'},'سم تقريبي'));
  el.appendChild(svg);
  const rh=document.createElement('div');rh.className='rot';rh.title='اسحب لتدوير المسطرة';rh.setAttribute('aria-label','تدوير المسطرة');rh.style.cssText='position:absolute;right:-30px;top:'+(RT/2-24)+'px;width:48px;height:48px;border-radius:50%;background:#8a6d00;color:#fff;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;font-size:22px';rh.textContent='⟳';
  const cl=mkBtn('✕','',()=>toggleRuler());cl.setAttribute('aria-label','إغلاق المسطرة');cl.style.cssText='position:absolute;left:8px;top:'+(RT/2-24)+'px;min-width:48px;padding:0';
  el.append(rh,cl);ovl.appendChild(el);TT.ruler={el,o,w:RL,h:RT};
  const ap=()=>{el.style.transform=tfStr(o,RL,RT)};ap();dragMove(el,o,ap);dragRotate(rh,o,ap);return true;
}
/* التقاط القلم بحافة المسطرة: الخط يصير مستقيمًا على الحافة */
function rulerEdgeFor(sp,pad){
  const R=TT.ruler;if(!R)return null;const o=R.o,dx=sp.x-o.cx,dy=sp.y-o.cy,c=Math.cos(-o.ang),s=Math.sin(-o.ang),lx=dx*c-dy*s,ly=dx*s+dy*c;
  if(Math.abs(lx)>RL/2+pad)return null;
  const dTop=Math.abs(ly+RT/2),dBot=Math.abs(ly-RT/2);
  if(Math.min(dTop,dBot)>pad)return null;
  return{o,side:dTop<dBot?-1:1};
}
HOOKS.snapFor=p=>{if(!TT.ruler)return null;const sp=toScreen(p.x,p.y);return rulerEdgeFor(sp,34)};
HOOKS.snapPt=(q,sn)=>{
  const sp=toScreen(q.x,q.y),o=sn.o,dx=sp.x-o.cx,dy=sp.y-o.cy,c=Math.cos(-o.ang),s=Math.sin(-o.ang);let lx=dx*c-dy*s;
  lx=Math.max(-RL/2,Math.min(RL/2,lx));const ly=sn.side*RT/2,ca=Math.cos(o.ang),sa=Math.sin(o.ang);
  const sx=o.cx+lx*ca-ly*sa,sy=o.cy+lx*sa+ly*ca,L=toLogical(sx,sy);q.x=L.x;q.y=L.y;
};

/* ---------- المنقلة ---------- */
const PR=190;
function toggleProto(){
  if(TT.proto){TT.proto.el.remove();TT.proto=null;return false}
  const PW=2*PR+60,PH=PR+70,o={cx:stageEl.clientWidth/2,cy:Math.min(stageEl.clientHeight-80,stageEl.clientHeight*0.7),ang:0};
  const el=document.createElement('div');el.className='proto';el.setAttribute('role','img');el.setAttribute('aria-label','منقلة');el.style.cssText='left:0;top:0;width:'+PW+'px;height:'+PH+'px;transform-origin:0 0';
  const cx=PW/2,cy=PR+20,svg=svgEl('svg',{width:PW,height:PH,viewBox:'0 0 '+PW+' '+PH});
  svg.appendChild(svgEl('path',{d:'M'+(cx-PR)+' '+cy+' A'+PR+' '+PR+' 0 0 1 '+(cx+PR)+' '+cy+' L'+(cx+PR)+' '+(cy+22)+' L'+(cx-PR)+' '+(cy+22)+' Z',fill:'rgba(190,230,255,.80)',stroke:'#1a5f8a','stroke-width':2}));
  for(let a=0;a<=180;a++){const r=a*Math.PI/180,len=a%10===0?18:a%5===0?12:7,x1=cx-Math.cos(r)*PR,y1=cy-Math.sin(r)*PR,x2=cx-Math.cos(r)*(PR-len),y2=cy-Math.sin(r)*(PR-len);
    svg.appendChild(svgEl('line',{x1,y1,x2,y2,stroke:'#12425f','stroke-width':a%10===0?1.8:1}));
    if(a%10===0){const rr=PR-34,tx=cx-Math.cos(r)*rr,ty=cy-Math.sin(r)*rr+5;svg.appendChild(svgEl('text',{x:tx,y:ty,'text-anchor':'middle','font-size':14,fill:'#0d3149','font-family':'PlexAr,sans-serif'},ar(a)))}}
  svg.appendChild(svgEl('line',{x1:cx-PR-10,x2:cx+PR+10,y1:cy,y2:cy,stroke:'#12425f','stroke-width':2}));svg.appendChild(svgEl('circle',{cx,cy,r:5,fill:'#c62828'}));
  el.appendChild(svg);
  const rh=document.createElement('div');rh.style.cssText='position:absolute;left:'+(PW-24)+'px;top:'+(cy-24)+'px;width:48px;height:48px;border-radius:50%;background:#1a5f8a;color:#fff;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;font-size:22px';rh.textContent='⟳';rh.title='اسحب لتدوير المنقلة';rh.setAttribute('aria-label','تدوير المنقلة');
  const cl=mkBtn('✕','',()=>toggleProto());cl.setAttribute('aria-label','إغلاق المنقلة');cl.style.cssText='position:absolute;left:'+(cx-24)+'px;top:'+(cy-90)+'px;min-width:48px;padding:0';
  el.append(rh,cl);ovl.appendChild(el);const R={el,o,w:PW,h:PH,cx,cy};TT.proto=R;
  /* المركز عند نقطة الأساس */
  const ap=()=>{el.style.transform='translate('+o.cx+'px,'+o.cy+'px) rotate('+o.ang+'rad) translate('+(-cx)+'px,'+(-cy)+'px)'};ap();dragMove(el,o,ap);dragRotate(rh,o,ap);return true;
}

/* ---------- الستارة ---------- */
const CUR_SIDES=[['bottom','من الأسفل'],['top','من الأعلى'],['right','من اليمين'],['left','من اليسار']];
function toggleCurtain(){
  if(TT.curtain){TT.curtain.el.remove();TT.curtain=null;return false}
  const el=document.createElement('div');el.className='curtain';el.setAttribute('role','region');el.setAttribute('aria-label','ستارة لإخفاء جزء من السبورة');
  const gr=document.createElement('div');gr.className='grip';gr.setAttribute('aria-label','اسحب لكشف الشاشة');gr.textContent='اسحب لكشف السبورة';
  const sb=mkBtn('الجهة','',()=>{const i=CUR_SIDES.findIndex(s=>s[0]===C.side);C.side=CUR_SIDES[(i+1)%4][0];C.size=0.55;lay()});sb.style.cssText='position:absolute;min-width:48px;z-index:3;right:12px;bottom:12px;font-size:14px';
  const cl=mkBtn('✕ إغلاق','',()=>toggleCurtain());cl.style.cssText='position:absolute;min-width:48px;z-index:3;left:12px;bottom:12px;font-size:14px';
  const msg=document.createElement('span');msg.textContent='الستارة تخفي هذا الجزء';msg.style.fontSize='18px';
  el.append(msg,gr,sb,cl);ovl.appendChild(el);const C={el,side:'bottom',size:0.55};TT.curtain=C;
  function lay(){
    const sw=stageEl.clientWidth,sh=stageEl.clientHeight,s=C.size,st=el.style,g=gr.style;
    st.left=st.right=st.top=st.bottom='auto';st.width=st.height='';g.left=g.right=g.top=g.bottom='auto';g.width=g.height='';
    if(C.side==='bottom'||C.side==='top'){st.left='0';st.width='100%';st.height=Math.round(s*sh)+'px';st[C.side]='0';g.left='20%';g.width='60%';g.height='44px';g[C.side==='bottom'?'top':'bottom']='0';sb.style[C.side==='bottom'?'bottom':'top']='12px';sb.style[C.side==='bottom'?'top':'bottom']='auto'}
    else{st.top='0';st.height='100%';st.width=Math.round(s*sw)+'px';st[C.side]='0';g.top='20%';g.height='60%';g.width='44px';g[C.side==='right'?'left':'right']='0';gr.style.writingMode='vertical-rl'}
    if(C.side==='bottom'||C.side==='top')gr.style.writingMode='';
  }
  lay();C.lay=lay;
  gr.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();try{gr.setPointerCapture(e.pointerId)}catch(_){}
    const mv=ev=>{if(ev.pointerId!==e.pointerId)return;const p=stagePt(ev),sw=stageEl.clientWidth,sh=stageEl.clientHeight;
      C.size=Math.max(0.06,Math.min(1,C.side==='bottom'?(sh-p.y)/sh:C.side==='top'?p.y/sh:C.side==='right'?(sw-p.x)/sw:p.x/sw));lay()};
    const up=ev=>{if(ev.pointerId!==e.pointerId)return;gr.removeEventListener('pointermove',mv);gr.removeEventListener('pointerup',up);gr.removeEventListener('pointercancel',up)};
    gr.addEventListener('pointermove',mv);gr.addEventListener('pointerup',up);gr.addEventListener('pointercancel',up);
  });
  return true;
}
new ResizeObserver(()=>{if(TT.curtain)TT.curtain.lay()}).observe(stageEl);

/* ---------- المؤقت ---------- */
function beep(){
  try{const A=window.AudioContext||window.webkitAudioContext,c=new A();for(let i=0;i<3;i++){const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=0.2;o.connect(g);g.connect(c.destination);o.start(c.currentTime+i*0.45);o.stop(c.currentTime+i*0.45+0.25)}setTimeout(()=>c.close(),2200)}catch(e){}
}
const mmss=sec=>{sec=Math.max(0,Math.ceil(sec));return ar(String(Math.floor(sec/60)).padStart(2,'0'))+':'+ar(String(sec%60).padStart(2,'0'))};
function toggleTimer(){
  if(TT.timer){clearInterval(TT.timer.iv);TT.timer.el.remove();TT.timer=null;return false}
  const T={el:document.createElement('div'),rem:300,total:300,run:false,end:0,x:0,y:0,iv:0,done:false,beeps:0};TT.timer=T;
  const el=T.el;el.className='timer';el.setAttribute('role','timer');el.style.left=Math.max(8,stageEl.clientWidth-300)+'px';el.style.top='70px';
  const th=document.createElement('div');th.className='th';th.textContent='المؤقت — اسحب من هنا';const cl=mkBtn('✕','',()=>toggleTimer());cl.setAttribute('aria-label','إغلاق المؤقت');cl.style.marginInlineStart='auto';th.appendChild(cl);
  const dg=document.createElement('div');dg.className='digits';dg.id='timerDigits';dg.setAttribute('aria-live','off');
  const tr=document.createElement('div');tr.className='tr';
  const upd=()=>{dg.textContent=mmss(T.rem);el.classList.toggle('done',T.done);startB.textContent=T.run?'إيقاف مؤقت':'ابدأ'};
  const setSec=s=>{T.rem=Math.max(0,s);T.total=Math.max(T.total,T.rem);T.done=false;if(T.run)T.end=Date.now()+T.rem*1000;upd()};
  const startB=mkBtn('ابدأ','on',()=>{if(T.done){T.rem=T.total;T.done=false}
    if(T.run){T.run=false;T.rem=Math.max(0,(T.end-Date.now())/1000)}else{if(T.rem<=0)T.rem=T.total||60;T.run=true;T.end=Date.now()+T.rem*1000}upd()});
  tr.append(startB,mkBtn('صفّر','',()=>{T.run=false;T.done=false;T.rem=T.total=300;upd()}),mkBtn('+١ د','',()=>{T.total+=60;setSec((T.run?(T.end-Date.now())/1000:T.rem)+60)}),mkBtn('−١ د','',()=>setSec((T.run?(T.end-Date.now())/1000:T.rem)-60)),
    mkBtn('٣ د','',()=>{T.total=180;T.run=false;T.rem=180;T.done=false;upd()}),mkBtn('٥ د','',()=>{T.total=300;T.run=false;T.rem=300;T.done=false;upd()}),mkBtn('١٠ د','',()=>{T.total=600;T.run=false;T.rem=600;T.done=false;upd()}));
  el.append(th,dg,tr);ovl.appendChild(el);upd();
  const o={cx:0,cy:0};
  th.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();e.stopPropagation();const p0=stagePt(e),l0=el.offsetLeft,t0=el.offsetTop;try{th.setPointerCapture(e.pointerId)}catch(_){}
    const mv=ev=>{if(ev.pointerId!==e.pointerId)return;const p=stagePt(ev);el.style.left=Math.max(0,Math.min(stageEl.clientWidth-el.offsetWidth,l0+p.x-p0.x))+'px';el.style.top=Math.max(0,Math.min(stageEl.clientHeight-el.offsetHeight,t0+p.y-p0.y))+'px'};
    const up=ev=>{if(ev.pointerId!==e.pointerId)return;th.removeEventListener('pointermove',mv);th.removeEventListener('pointerup',up);th.removeEventListener('pointercancel',up)};
    th.addEventListener('pointermove',mv);th.addEventListener('pointerup',up);th.addEventListener('pointercancel',up)});
  T.iv=setInterval(()=>{
    if(T.run){const r=(T.end-Date.now())/1000;if(r<=0){T.run=false;T.rem=0;T.done=true;beep();T.beeps++}else T.rem=r;upd()}
  },200);
  return true;
}

/* ---------- خلفية الصفحة ولون السبورة ---------- */
const BG_NAMES={plain:'سادة',lines:'سطور',grid:'مربعات',dots:'نقاط',edu:'سطور تعليمية'};
const BG_COLORS=[['auto','تلقائي'],['#1e3c78','أزرق'],['#1b7a36','أخضر'],['#b71c1c','أحمر'],['#555555','رمادي']];
function setBackground(type){
  if(!BG_TYPES.includes(type))return;
  const ps=TT.bgAll?S.doc.pages:[pg()];for(const p of ps)p.background.type=type;
  HOOKS.dirty();redrawDoc();if(!pgPanel.hidden)renderPanel();toast('خلفية الصفحة: '+BG_NAMES[type]+(TT.bgAll?' (كل الصفحات)':''),null,1500);
}
/* إعدادات السطور/المربعات: تُحفظ في background.opts وتظهر في التصدير والطباعة وتبقى مع المستند */
function setBgOpt(k,v){
  const ps=TT.bgAll?S.doc.pages:[pg()];
  for(const p of ps){const o=Object.assign({},p.background.opts);if(v==null)delete o[k];else o[k]=v;if(Object.keys(o).length)p.background.opts=o;else delete p.background.opts}
  HOOKS.dirty();redrawDoc();if(!pgPanel.hidden)renderPanel();
}
const bgOptNow=k=>{const o=pg().background.opts;return o&&o[k]};
function bgSettingsNode(cur){
  const w=document.createElement('div');w.style.cssText='padding:4px 10px 8px;display:flex;flex-direction:column;gap:2px';
  const mkRow=(label,inp,valEl)=>{const r=document.createElement('div');r.style.cssText='display:flex;align-items:center;gap:8px';
    const l=document.createElement('span');l.textContent=label;l.style.cssText='min-width:96px;font-size:13px';inp.style.flex='1 1 auto';r.append(l,inp,valEl);return r};
  const mkSlider=(label,min,max,val,fn,step)=>{const i=document.createElement('input');i.type='range';i.min=min;i.max=max;if(step)i.step=step;i.value=val;i.setAttribute('aria-label',label);
    const v=document.createElement('span');v.textContent=ar(val);v.style.cssText='min-width:34px;text-align:center;font-size:13px';
    i.oninput=()=>{v.textContent=ar(+i.value);fn(+i.value)};return mkRow(label,i,v)};
  if(cur==='lines'||cur==='edu')w.appendChild(mkSlider('المسافة بين السطور',30,240,bgOptNow('spacing')||(cur==='edu'?108:54),v=>setBgOpt('spacing',v)));
  if(cur==='grid')w.appendChild(mkSlider('حجم المربع',20,240,bgOptNow('size')||54,v=>setBgOpt('size',v)));
  const cr=document.createElement('div');cr.style.cssText='display:flex;align-items:center;gap:6px;min-height:48px';
  const cl=document.createElement('span');cl.textContent='لون السطور';cl.style.cssText='min-width:96px;font-size:13px';cr.appendChild(cl);
  for(const[c,n]of BG_COLORS){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',n);b.title=n;
    b.style.cssText='width:48px;height:48px;border-radius:10px;border:2px solid '+( (bgOptNow('color')||'auto')===c?'var(--acc,#4c8dff)':'#888')+';background:'+(c==='auto'?'linear-gradient(135deg,#1e3c78 50%,#fff 50%)':c);
    b.setAttribute('aria-pressed',String((bgOptNow('color')||'auto')===c));
    b.onclick=()=>{setBgOpt('color',c==='auto'?null:c);openTeachMenu()};cr.appendChild(b)}
  w.appendChild(cr);
  w.appendChild(mkSlider('درجة الوضوح',0.1,1,bgOptNow('opacity')!=null?bgOptNow('opacity'):1,v=>setBgOpt('opacity',v),0.05));
  return w;
}
function openTeachMenu(){
  const cur=pg().background.type||'plain';
  openMenu($('toolTeach'),[
    {head:'أدوات المعلم'},
    {label:'المسطرة (التصاق القلم بحافتها)',pressed:!!TT.ruler,fn:toggleRuler},
    {label:'المنقلة',pressed:!!TT.proto,fn:toggleProto},
    {label:'الفرجار: أشكال ← دائرة بالمركز',fn:()=>{setTool('shape',true);S.shapeKind='circle';showOpts()}},
    {label:'الستارة',pressed:!!TT.curtain,fn:toggleCurtain},
    {label:'المؤقت',pressed:!!TT.timer,fn:toggleTimer},
    {label:'وضع التركيز…',fn:openFocusSetup},{sep:1},
    {head:'خلفية الصفحة'},
    ...Object.entries(BG_NAMES).map(([k,n])=>({label:n,pressed:cur===k,fn:()=>setBackground(k)})),
    ...(cur==='lines'||cur==='grid'||cur==='edu'?[{node:bgSettingsNode(cur)}]:[]),
    {label:'تطبيق الخلفية على كل الصفحات',pressed:TT.bgAll,keep:true,fn:()=>{TT.bgAll=!TT.bgAll;openTeachMenu()}},{sep:1},
    {label:'خط الأعداد',pressed:!!(pg().nline&&pg().nline.on),keep:true,fn:()=>{toggleNline();openTeachMenu()}},
    ...(pg().nline&&pg().nline.on?[{node:nlSettingsNode()}]:[]),{sep:1},
    {head:'البطاقات التعليمية'},
    {label:'بطاقة نصية جديدة',fn:()=>addCard('text')},
    {label:'بطاقة رقمية جديدة',fn:()=>addCard('number')},
    {label:'بطاقة صورة من الجهاز…',fn:()=>cardImgInp.click()},{sep:1},
    {head:'أدوات تعليمية'},
    {label:'العجلة التفاعلية',fn:()=>openEduTool('wheel')},
    {label:'من الحرف إلى الجملة',fn:()=>openEduTool('hj')},{sep:1},
    {head:'لون السبورة'},
    ...Object.entries(SURFACES).map(([k,v])=>({label:v.name,pressed:S.board===k,fn:()=>setBoard(k)})),
  ],{above:TB.dock==='bottom'});
}
$('toolTeach').setAttribute('aria-haspopup','true');
$('toolTeach').onclick=()=>{if(menuEl)closeMenu();else openTeachMenu()};
