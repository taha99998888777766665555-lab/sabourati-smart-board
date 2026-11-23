
/* =====================================================================
   الوحدة ٧: خط الأعداد التعليمي (المرحلة الثالثة)
   كائن صفحة مستقل عن عناصر الرسم: لا تمسّه أدوات القلم/الممحاة،
   ولا يتحرك إلا بأداة التحديد وهو غير مقفل. أرقامه مشرقية حصرًا.
   ===================================================================== */
const NL_FONT='PlexAr,sans-serif';
function nlTicks(nl){return Math.floor((nl.end-nl.start)/nl.step)+1}
function nlValAt(nl,i){return nl.start+i*nl.step}
function nlTickX(nl,i){return nl.x+ (nl.w*i)/(nlTicks(nl)-1||1)}
/* رسم خط الأعداد على سياق صفحة (إحداثيات منطقية) — يُستدعى من renderPage فيدخل التصدير تلقائيًا */
function drawNline(ctx,nl,surface){
  const H=NL_H,pad=26,ticks=nlTicks(nl);
  const tone=(SURFACES[surface]&&SURFACES[surface].tone)||'light',ink=tone==='dark'?'#f0f0f0':'#1b1b1b',card=tone==='dark'?'rgba(20,20,20,0.85)':'rgba(255,255,255,0.88)',acc='#c62828';
  const yA=nl.y+H/2,x0=nl.x,x1=nl.x+nl.w;
  ctx.save();
  /* بطاقة خلفية خفيفة */
  ctx.fillStyle=card;ctx.strokeStyle=tone==='dark'?'rgba(255,255,255,0.35)':'rgba(30,60,120,0.35)';ctx.lineWidth=1.5;
  ctx.beginPath();const r=14;if(ctx.roundRect)ctx.roundRect(nl.x-pad,nl.y,nl.w+2*pad,H,r);else ctx.rect(nl.x-pad,nl.y,nl.w+2*pad,H);
  ctx.fill();ctx.stroke();
  /* المحور */
  ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,yA);ctx.lineTo(x1,yA);ctx.stroke();
  /* رأس سهم في الطرفين */
  ctx.fillStyle=ink;
  ctx.beginPath();ctx.moveTo(x0,yA);ctx.lineTo(x0+12,yA-6);ctx.lineTo(x0+12,yA+6);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(x1,yA);ctx.lineTo(x1-12,yA-6);ctx.lineTo(x1-12,yA+6);ctx.closePath();ctx.fill();
  /* العلامات والأرقام المشرقية */
  const gap=nl.w/(ticks-1||1),fs=Math.max(12,Math.min(24,gap*0.42));
  ctx.font='600 '+fs+'px '+NL_FONT;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let i=0;i<ticks;i++){
    const tx=nlTickX(nl,i);
    ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tx,yA-9);ctx.lineTo(tx,yA+9);ctx.stroke();
    ctx.fillStyle=ink;ctx.fillText(ar(nlValAt(nl,i)),tx,yA+9+fs+4);
  }
  /* تمييز الموضع الحالي */
  if(nl.pos>=0&&nl.pos<ticks){
    const tx=nlTickX(nl,nl.pos);
    ctx.strokeStyle=acc;ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(tx,yA,17,0,6.2832);ctx.stroke();
    ctx.fillStyle=acc;ctx.beginPath();ctx.arc(tx,yA,5,0,6.2832);ctx.fill();
    ctx.font='700 '+Math.max(14,fs)+'px '+NL_FONT;ctx.fillStyle=acc;ctx.fillText(ar(nlValAt(nl,nl.pos)),tx,nl.y+ (fs+2));
  }
  /* مقبضا الطرفين (تغيير الحجم) */
  ctx.fillStyle='#fff';ctx.strokeStyle=ink;ctx.lineWidth=2;
  for(const hx of [x0,x1]){ctx.beginPath();ctx.arc(hx,yA,7,0,6.2832);ctx.fill();ctx.stroke()}
  /* شارة القفل */
  if(nl.locked){
    const lx=nl.x-pad+14,ly=nl.y+16;
    ctx.strokeStyle='#8a6d00';ctx.fillStyle='#f9d54a';ctx.lineWidth=2;
    ctx.beginPath();ctx.rect(lx-8,ly-4,16,13);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(lx,ly-4,6,Math.PI,0);ctx.stroke();
  }
  ctx.restore();
}
/* إصابة: 'l'/'r' مقبضا الحجم، 'move' جسم الخط، null خارجه */
function nlHit(p,nl){
  if(!nl||!nl.on)return null;
  const H=NL_H,pad=26,yA=nl.y+H/2,hr=20;
  if(Math.hypot(p.x-nl.x,p.y-yA)<=hr)return 'l';
  if(Math.hypot(p.x-(nl.x+nl.w),p.y-yA)<=hr)return 'r';
  if(p.x>=nl.x-pad&&p.x<=nl.x+nl.w+pad&&p.y>=nl.y&&p.y<=nl.y+H)return 'move';
  return null;
}
/* إظهار/إخفاء من قائمة المعلم */
function toggleNline(){
  const P=pg();
  if(!P.nline){const w=Math.min(1200,Math.max(200,P.w-160));P.nline={on:1,x:Math.round((P.w-w)/2),y:Math.round(P.h*0.55),w,start:0,end:20,step:1,locked:0,pos:-1}}
  else P.nline.on=P.nline.on?0:1;
  HOOKS.dirty();redrawDoc();if(!pgPanel.hidden)renderPanel();
}
/* إبقاء الخط ومقبضيه داخل الصفحة عند التحريك/تغيير الحجم (لا يمسّ المحفوظ في المستندات) */
function nlClampGeom(P,x,y,w){
  w=Math.min(Math.max(200,w),P.w);
  x=Math.min(Math.max(0,x),P.w-w);y=Math.min(Math.max(0,y),P.h-NL_H);
  return{x:Math.round(x),y:Math.round(y),w:Math.round(w)};
}
function setNl(k,v){
  const P=pg();if(!P.nline)return;
  const nl=Object.assign({},P.nline);nl[k]=v;
  const n=normNline(nl);if(!n)return;
  P.nline=n;HOOKS.dirty();redrawDoc();if(!pgPanel.hidden)renderPanel();
}
function nlNav(dir){
  const P=pg();if(!P.nline||!P.nline.on)return;const t=nlTicks(P.nline);
  let pos=P.nline.pos;
  if(pos<0)pos=dir>0?0:t-1;else pos=Math.min(t-1,Math.max(0,pos+dir));
  setNl('pos',pos);
}
/* معالج التحريك/تغيير الحجم بأداة التحديد (لا تراجع — مثل إعدادات الخلفية) */
const NLINE_H={
  move(e,st){st.cur=pt(e);if(!st.moved&&scrDist(st.p0,st.cur)<4)return;st.moved=true},
  flush(st){
    clearLive();
    if(!st.moved)return;
    const P=pg(),nl=P.nline;if(!nl)return;
    const t=Object.assign({},nl),dx=st.cur.x-st.p0.x;
    let g;
    if(st.mode==='move')g=nlClampGeom(P,st.nl0.x+dx,st.nl0.y+(st.cur.y-st.p0.y),st.nl0.w);
    else if(st.mode==='r')g=nlClampGeom(P,st.nl0.x,st.nl0.y,st.nl0.w+dx);
    else g=nlClampGeom(P,st.nl0.x+dx,st.nl0.y,st.nl0.w-dx);
    t.x=g.x;t.y=g.y;t.w=g.w;
    withPage(lctx,()=>drawNline(lctx,t,pg().background.surface));
  },
  up(st){
    clearLive();
    if(!st.moved)return;
    const P=pg(),nl=P.nline;if(!nl)return;
    const dx=st.cur.x-st.p0.x;
    let g;
    if(st.mode==='move')g=nlClampGeom(P,st.nl0.x+dx,st.nl0.y+(st.cur.y-st.p0.y),st.nl0.w);
    else if(st.mode==='r')g=nlClampGeom(P,st.nl0.x,st.nl0.y,st.nl0.w+dx);
    else g=nlClampGeom(P,st.nl0.x+dx,st.nl0.y,st.nl0.w-dx);
    P.nline=Object.assign({},nl,g);HOOKS.dirty();redrawDoc();if(!pgPanel.hidden)renderPanel();
  },
  cancel(st){clearLive();redrawDoc()},
  redraw(st){}
};
/* لوحة إعدادات خط الأعداد داخل قائمة المعلم */
function nlSettingsNode(){
  const nl=pg().nline,w=document.createElement('div');
  w.style.cssText='padding:4px 10px 8px;display:flex;flex-direction:column;gap:2px';
  const mkRow=(label,inp,valEl)=>{const r=document.createElement('div');r.style.cssText='display:flex;align-items:center;gap:8px';
    const l=document.createElement('span');l.textContent=label;l.style.cssText='min-width:96px;font-size:13px';inp.style.flex='1 1 auto';r.append(l,inp,valEl);return r};
  const mkSlider=(label,min,max,val,fn)=>{const i=document.createElement('input');i.type='range';i.min=min;i.max=max;i.value=val;i.setAttribute('aria-label',label);
    const v=document.createElement('span');v.textContent=ar(val);v.style.cssText='min-width:34px;text-align:center;font-size:13px';
    i.oninput=()=>{v.textContent=ar(+i.value);fn(+i.value)};return mkRow(label,i,v)};
  w.appendChild(mkSlider('رقم البداية',-50,50,nl.start,v=>setNl('start',v)));
  w.appendChild(mkSlider('رقم النهاية',1,100,nl.end,v=>setNl('end',v)));
  w.appendChild(mkSlider('مقدار الزيادة',1,10,nl.step,v=>setNl('step',v)));
  /* القفل */
  const lk=document.createElement('button');lk.type='button';lk.className='mi';lk.style.minHeight='48px';
  lk.textContent='قفل خط الأعداد (منع التحريك)';lk.setAttribute('aria-pressed',String(!!nl.locked));
  lk.onclick=()=>{setNl('locked',nl.locked?0:1);openTeachMenu()};
  w.appendChild(lk);
  /* التنقل وتمييز الأعداد (لشرح العد والجمع والطرح) */
  const nav=document.createElement('div');nav.style.cssText='display:flex;align-items:center;gap:8px;margin-top:2px';
  const cur=document.createElement('span');cur.style.cssText='flex:1;text-align:center;font-size:15px;font-weight:700';
  cur.textContent=nl.pos>=0?'الموضع: '+ar(nlValAt(nl,nl.pos)):'بلا تمييز';
  const mkB=(t,fn,dis)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.disabled=!!dis;
    b.style.cssText='min-height:48px;min-width:72px;border-radius:10px;border:1.5px solid #888;background:#fff;font-size:15px';
    b.setAttribute('aria-label',t);b.onclick=fn;return b};
  nav.appendChild(mkB('▶ السابق',()=>{nlNav(-1);openTeachMenu()},nl.pos===0));
  nav.appendChild(cur);
  nav.appendChild(mkB('التالي ◀',()=>{nlNav(1);openTeachMenu()},nl.pos>=0&&nl.pos>=nlTicks(nl)-1));
  w.appendChild(nav);
  if(nl.pos>=0){const c=document.createElement('button');c.type='button';c.textContent='إخفاء التمييز';
    c.style.cssText='min-height:48px;border-radius:10px;border:1.5px solid #888;background:#fff;margin-top:4px';
    c.onclick=()=>{setNl('pos',-1);openTeachMenu()};w.appendChild(c)}
  return w;
}
