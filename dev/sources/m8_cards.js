
/* =====================================================================
   الوحدة ٨: البطاقات التعليمية التفاعلية (المرحلة الرابعة)
   بطاقات نصية ورقمية وصورية على مستوى الصفحة (page.cards): لا تدخل في
   عناصر الرسم فلا تمسّها أدوات القلم/الممحاة، وتُحرَّك وتُغيَّر فقط
   بأداة التحديد وهي غير مقفلة. تُحفظ مع الصفحة وتظهر في التصدير.
   أرقام البطاقات الرقمية مشرقية (٠١٢٣٤٥٦٧٨٩) حصرًا.
   ===================================================================== */
const CARD_FONT="'PlexAr',Tahoma,'Segoe UI','DejaVu Sans',sans-serif";
/* ألوان هادئة مريحة (تعليم خاص): خلفيات فاتحة غير صارخة */
const CARD_BGS=[['#fffdf5','عاجي'],['#f1f7ee','أخضر هادئ'],['#eef5fb','أزرق هادئ'],['#fdf1f4','وردي هادئ'],['#f4f1fb','بنفسجي هادئ'],['#fff7e8','رملي']];
const cardById=id=>{const cs=pg().cards||[];for(const c of cs)if(c.id===id)return c;return null};

/* ---------- التفاف النص داخل البطاقة ---------- */
const CARD_MX=document.createElement('canvas').getContext('2d');
function cardWrap(text,fs,maxW){
  CARD_MX.font='600 '+fs+'px '+CARD_FONT;const lines=[];
  for(const para of String(text).split('\n')){
    let cur='';for(const w of para.split(' ')){const t=cur?cur+' '+w:w;
      if(!cur||CARD_MX.measureText(t).width<=maxW)cur=t;else{lines.push(cur);cur=w}}
    lines.push(cur);
  }
  return lines;
}

/* ---------- رسم بطاقة واحدة (يُستدعى من renderPage فيدخل التصدير تلقائيًا) ---------- */
function drawCard(ctx,c,surface){
  const tone=(SURFACES[surface]&&SURFACES[surface].tone)||'light';
  const line=tone==='dark'?'rgba(255,255,255,.55)':'#5b6b7a';
  ctx.save();
  ctx.beginPath();const r=16;if(ctx.roundRect)ctx.roundRect(c.x,c.y,c.w,c.h,r);else ctx.rect(c.x,c.y,c.w,c.h);
  ctx.fillStyle=c.bg||'#fffdf5';ctx.fill();
  ctx.lineWidth=2.5;ctx.strokeStyle=line;ctx.stroke();
  if(c.type==='image'){
    const pad=12,bw=c.w-2*pad,bh=c.h-2*pad,g=getImg(c.asset);
    if(g&&g.ready){
      const ratio=c.ratio||(c.w/c.h);let iw=bw,ih=iw/ratio;if(ih>bh){ih=bh;iw=ih*ratio}
      ctx.drawImage(g.img,c.x+(c.w-iw)/2,c.y+(c.h-ih)/2,iw,ih);
    }else{ctx.fillStyle='rgba(120,130,140,.18)';ctx.fillRect(c.x+pad,c.y+pad,bw,bh)}
  }else{
    const fs=c.fs||64,lines=cardWrap(c.text,fs,c.w-28),lh=fs*1.5;
    ctx.font='600 '+fs+'px '+CARD_FONT;ctx.fillStyle='#20303c';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.direction=dirOf(lines[0]||'')==='rtl'?'rtl':'ltr';
    const y0=c.y+c.h/2-((lines.length-1)*lh)/2;
    lines.forEach((ln,i)=>{if(ln)ctx.fillText(ln,c.x+c.w/2,y0+i*lh)});
  }
  /* مقبض تغيير الحجم (الزاوية السفلى اليسرى) */
  ctx.beginPath();ctx.arc(c.x,c.y+c.h,9,0,6.2832);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=line;ctx.stroke();
  ctx.beginPath();ctx.moveTo(c.x-4,c.y+c.h+2);ctx.lineTo(c.x+4,c.y+c.h-2);ctx.stroke();
  /* شارة القفل */
  if(c.locked){
    const lx=c.x+c.w-20,ly=c.y+18;
    ctx.strokeStyle='#8a6d00';ctx.fillStyle='#f9d54a';ctx.lineWidth=2;
    ctx.beginPath();ctx.rect(lx-8,ly-4,16,13);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(lx,ly-4,6,Math.PI,0);ctx.stroke();
  }
  ctx.restore();
}
function drawCards(ctx,cards,surface){for(const c of cards)drawCard(ctx,c,surface)}

/* ---------- إصابة: 'rsz' مقبض الحجم، 'move' جسم البطاقة ---------- */
function cardHit(p,card){
  if(Math.hypot(p.x-card.x,p.y-(card.y+card.h))<=22)return 'rsz';
  if(p.x>=card.x&&p.x<=card.x+card.w&&p.y>=card.y&&p.y<=card.y+card.h)return 'move';
  return null;
}
function cardHitTop(p){const cs=pg().cards||[];for(let i=cs.length-1;i>=0;i--){if(FOCUS_HIDDEN.has(cs[i].id))continue;const m=cardHit(p,cs[i]);if(m)return{card:cs[i],mode:m}}return null}

/* ---------- قيد داخل الصفحة (للبطاقات الجديدة والتفاعل اليدوي فقط؛ المحفوظ يُفتح كما هو) ---------- */
function cardClamp(P,c,x,y,w,h){
  w=clamp(w,90,P.w);h=clamp(h,70,P.h);
  if(c&&c.type==='image'&&c.ratio){h=w/c.ratio;if(h>P.h){h=P.h;w=h*c.ratio}if(h<70){h=70;w=Math.min(P.w,h*c.ratio)}}
  x=clamp(x,0,Math.max(0,P.w-w));y=clamp(y,0,Math.max(0,P.h-h));
  return{x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)};
}
function cardGeom(P,st){
  const c=cardById(st.cid),dx=st.cur.x-st.p0.x,dy=st.cur.y-st.p0.y;
  if(st.mode==='move')return cardClamp(P,c,st.c0.x+dx,st.c0.y+dy,st.c0.w,st.c0.h);
  let w=st.c0.w-dx,h=st.c0.h+dy;
  if(c&&c.type==='image'&&c.ratio){w=Math.max(90,w);h=w/c.ratio}
  const g=cardClamp(P,c,0,0,w,h);
  return cardClamp(P,c,st.c0.x+st.c0.w-g.w,st.c0.y,g.w,g.h);
}

/* ---------- معالج التحريك/تغيير الحجم بأداة التحديد ---------- */
const CARD_H={
  move(e,st){st.cur=pt(e);if(!st.moved&&scrDist(st.p0,st.cur)<4)return;st.moved=true},
  flush(st){
    clearLive();if(!st.moved)return;
    const P=pg(),c=cardById(st.cid);if(!c)return;
    withPage(lctx,()=>drawCard(lctx,Object.assign({},c,cardGeom(P,st)),P.background.surface));
  },
  up(st){
    clearLive();const P=pg(),c=cardById(st.cid);if(!c)return;
    if(!st.moved){selectCard(st.cid);return}
    Object.assign(c,cardGeom(P,st));
    HOOKS.dirty();redrawDoc();if(!pgPanel.hidden)renderPanel();placeCardBar();
  },
  cancel(st){clearLive();redrawDoc()},
  redraw(st){}
};

/* ---------- شريط إجراءات البطاقة المحددة ---------- */
let CARD_SEL=null;
const cardbar=document.createElement('div');
cardbar.id='cardbar';
cardbar.style.cssText='position:absolute;z-index:12;background:var(--ui-card,#fff);border:1px solid var(--ui-line,#999);border-radius:14px;box-shadow:0 6px 22px rgba(0,0,0,.3);display:none;flex-wrap:wrap;gap:4px;padding:5px;max-width:calc(100% - 16px);justify-content:center';
stageEl.appendChild(cardbar);
cardbar.addEventListener('pointerdown',e=>e.stopPropagation());
const cbtn=(label,fn,al)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.style.cssText='min-height:48px;min-width:48px;font-size:14px;padding:0 10px';b.textContent=label;b.setAttribute('aria-label',al||label);b.onclick=fn;return b};
function selectCard(id){CARD_SEL=id;showCardBar()}
function hideCardBar(){CARD_SEL=null;cardbar.style.display='none'}
function showCardBar(){
  const c=cardById(CARD_SEL);if(!c){hideCardBar();return}
  cardbar.innerHTML='';
  const prot=FOCUS.on&&FOCUS.protect;
  if(!prot){
    if(!FOCUS.on){
      if(c.type!=='image')cardbar.appendChild(cbtn('تعديل',()=>cardEdit(c),'تعديل محتوى البطاقة'));
      cardbar.appendChild(cbtn('تكرار',()=>cardDup(c)));
      cardbar.appendChild(cbtn(c.locked?'فتح القفل':'قفل',()=>cardToggleLock(c)));
      cardbar.appendChild(cbtn('حذف',()=>cardDel(c)));
      cardbar.appendChild(cbtn('اللون',()=>cardColorMenu(c),'لون خلفية البطاقة'));
      if(c.type!=='image'){cardbar.appendChild(cbtn('أ−',()=>cardFont(c,-1),'تصغير خط البطاقة'));cardbar.appendChild(cbtn('أ+',()=>cardFont(c,1),'تكبير خط البطاقة'))}
    }
    cardbar.appendChild(cbtn('إخفاء',()=>focusHideCard(c),'إخفاء مؤقت عن العرض — لا تُحذف البطاقة، وتعود بزر الإظهار أو بإنهاء وضع التركيز'));
  }
  cardbar.appendChild(cbtn('✕',()=>hideCardBar(),'إغلاق شريط البطاقة'));
  cardbar.style.display='flex';placeCardBar();
}
function placeCardBar(){
  const c=cardById(CARD_SEL);
  if(!c||S.tool!=='select'){cardbar.style.display='none';return}
  cardbar.style.display='flex';
  const a=toScreen(c.x,c.y),b=toScreen(c.x+c.w,c.y+c.h);
  const w=cardbar.offsetWidth,h=cardbar.offsetHeight,M=8,sw=stageEl.clientWidth,sh=stageEl.clientHeight;
  let x=(a.x+b.x)/2-w/2,y=a.y-h-14;if(y<M)y=b.y+14;
  if(y+h>sh-M)y=Math.max(M,Math.min(sh-h-M,a.y+8));
  cardbar.style.left=Math.max(M,Math.min(x,sw-w-M))+'px';cardbar.style.top=Math.max(M,y)+'px';
}
on('live',()=>{if(CARD_SEL)placeCardBar()});
on('pages',()=>hideCardBar());on('load',()=>hideCardBar());

/* ---------- عمليات البطاقات ---------- */
function cardDup(c){
  const P=pg(),cs=P.cards;if(!cs||cs.length>=60){toast('بلغت البطاقات الحد الأقصى في هذه الصفحة');return null}
  const n=JSON.parse(JSON.stringify(c));n.id=uid('c');
  const g=cardClamp(P,n,n.x+40,n.y+40,n.w,n.h);n.x=g.x;n.y=g.y;
  cs.push(n);HOOKS.dirty();redrawDoc();selectCard(n.id);toast('كُرّرت البطاقة',null,1500);return n;
}
async function cardDel(c){
  if(!(await confirmBox('حذف بطاقة','حذف هذه البطاقة من الصفحة؟','حذف')))return false;
  const cs=pg().cards,i=cs.indexOf(c);if(i<0)return false;
  cs.splice(i,1);hideCardBar();HOOKS.dirty();redrawDoc();return true;
}
function cardToggleLock(c){c.locked=c.locked?0:1;HOOKS.dirty();redrawDoc();showCardBar()}
function cardFont(c,d){c.fs=clamp((c.fs||64)+d*8,24,160);HOOKS.dirty();redrawDoc();placeCardBar()}
function cardColorMenu(c){
  const w=document.createElement('div');w.style.cssText='display:flex;gap:6px;padding:8px';
  for(const[col,name]of CARD_BGS){
    const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',name);b.title=name;
    b.style.cssText='width:48px;height:48px;border-radius:10px;border:2.5px solid '+(c.bg===col?'#0f6b5c':'#888')+';background:'+col;
    b.setAttribute('aria-pressed',String(c.bg===col));
    b.onclick=()=>{c.bg=col;HOOKS.dirty();redrawDoc();closeMenu();placeCardBar()};
    w.appendChild(b);
  }
  openMenu(cardbar,[{head:'لون خلفية البطاقة'},{node:w}]);
}
/* تعديل المحتوى: نص أو رقم (الأرقام تُحوَّل إلى مشرقية) */
function cardEdit(c){
  const ta=document.createElement('textarea');ta.value=c.text;ta.rows=3;ta.spellcheck=false;ta.setAttribute('lang','ar');ta.setAttribute('dir','auto');
  ta.setAttribute('aria-label','محتوى البطاقة');
  ta.style.cssText='width:240px;max-width:80vw;font-size:20px;padding:8px;border-radius:10px;border:1.5px solid #888;font-family:'+CARD_FONT;
  ta.addEventListener('keydown',e=>e.stopPropagation());
  const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;padding:4px 8px 8px;justify-content:center';
  const ok=cbtn('تم',()=>{
    let v=ta.value.replace(/\r/g,'').replace(/\s+$/,'');if(!v.trim()){toast('محتوى البطاقة فارغ');return}
    if(c.type==='number')v=ar(v);
    c.text=v.slice(0,300);HOOKS.dirty();redrawDoc();closeMenu();placeCardBar();
  });
  const no=cbtn('إلغاء',()=>closeMenu());
  row.append(ok,no);
  const w=document.createElement('div');w.style.cssText='display:flex;flex-direction:column;gap:2px;padding-top:8px';
  w.append(ta,row);
  openMenu(cardbar,[{head:c.type==='number'?'رقم أو عملية بسيطة (أرقام مشرقية)':'نص البطاقة (حرف / مقطع / كلمة / جملة قصيرة)'},{node:w}],{noFocus:true});
  ta.focus();ta.select();
}

/* ---------- إضافة بطاقة من قائمة المعلم ---------- */
const cardImgInp=document.createElement('input');
cardImgInp.type='file';cardImgInp.id='cardImg';cardImgInp.accept='image/*';cardImgInp.style.display='none';
document.body.appendChild(cardImgInp);
cardImgInp.onchange=e=>{const f=e.target.files&&e.target.files[0];cardImgInp.value='';if(f)addCard('image',f)};
async function addCard(type,file){
  const P=pg(),cs=P.cards||(P.cards=[]);
  if(cs.length>=60){toast('بلغت البطاقات الحد الأقصى في هذه الصفحة');return null}
  const ctr=toLogical(W/2,H/2),off=(cs.length%5)*36;
  if(type==='image'){
    if(!file)return null;
    try{
      const a=await fileToAsset(file,1600,0.85),aid=putAsset(a);
      const ratio=a.w/a.h;let w=Math.min(340,P.w*0.5),h=w/ratio;if(h>P.h*0.5){h=P.h*0.5;w=h*ratio}
      const g=cardClamp(P,{type:'image',ratio},ctr.x-w/2+off,ctr.y-h/2+off,w,h);
      const card={id:uid('c'),type:'image',asset:aid,ratio,x:g.x,y:g.y,w:g.w,h:g.h,fs:64,bg:'#fffdf5',locked:0};
      cs.push(card);getImg(aid);HOOKS.dirty();redrawDoc();
      setTool('select',true);selectCard(card.id);toast('أُضيفت بطاقة الصورة. اسحبها بأداة التحديد.');
      return card;
    }catch(e){toast('تعذّرت قراءة الصورة');return null}
  }
  const txt=type==='number'?ar(7):'كلمة';
  const g=cardClamp(P,{type},ctr.x-140+off,ctr.y-60+off,280,120);
  const card={id:uid('c'),type,text:txt,x:g.x,y:g.y,w:g.w,h:g.h,fs:type==='number'?72:56,bg:CARD_BGS[cs.length%CARD_BGS.length][0],locked:0};
  cs.push(card);HOOKS.dirty();redrawDoc();
  setTool('select',true);selectCard(card.id);
  toast('أُضيفت البطاقة. اسحبها بأداة التحديد وعدّلها من شريطها.');
  return card;
}