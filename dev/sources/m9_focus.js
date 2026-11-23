/* ================= Phase 5: وضع التركيز التعليمي (M9b) =================
   وضع عرض هادئ للأنشطة التفاعلية:
   - ثلاثة مستويات (بسيط / متوسط / كامل) تُخفي عناصر الواجهة تدريجيًا.
   - عزل النشاط (تعتيم + إبراز بطاقات محددة و/أو خط الأعداد) — حالة عرض فقط.
   - إخفاء بطاقات مؤقت (جلسة فقط: لا يُحفظ في الملف ولا يظهر في التصدير).
   - تكبير بطاقة/بطاقات كعرض تقديمي مؤقت فوق الصفحة (لا يغيّر المستند).
   - حماية النشاط: منع الحذف/التكرار/القفل/التلوين وفتح قوائم الإدارة.
   - خروج آمن: زر صغير ثابت بضغطة مطوّلة ~٢ ثانية أو Escape مطوّلًا.
   كل حالة التركيز خارج مستند v2 تمامًا (لا تدخل exportDoc/الحفظ). */

const FOCUS_PREFS_KEY='sabourati-focus-v1';
const FOCUS={
  on:false,level:1,protect:true,dim:.55,
  allow:{pen:true,erase:true,select:true,nline:true},
  iso:{active:false,cards:new Set(),nline:false},
  hidden:new Set(),
  picking:null,pickSet:null,isoBackup:null,
  zoomIds:null
};
let FOCUS_PREFS={level:1,dim:.55,pen:true,erase:true,select:true,nline:true,protect:true};

function focusLoadPrefs(){
  try{
    const raw=localStorage.getItem(FOCUS_PREFS_KEY);
    if(raw){const p=JSON.parse(raw);
      if(p&&typeof p==='object'){
        if(p.level===1||p.level===2||p.level===3)FOCUS_PREFS.level=p.level;
        if(typeof p.dim==='number'&&p.dim>=.2&&p.dim<=.85)FOCUS_PREFS.dim=p.dim;
        ['pen','erase','select','nline','protect'].forEach(k=>{if(typeof p[k]==='boolean')FOCUS_PREFS[k]=p[k]});
      }
    }
  }catch(e){/* وضع خاص/امتلاء: نستخدم الافتراضيات */}
}
function focusSavePrefs(){
  try{localStorage.setItem(FOCUS_PREFS_KEY,JSON.stringify(FOCUS_PREFS))}catch(e){}
}

/* مزامنة جسور العرض مع القالب: لا تُستدعى الحالة داخل renderPage إلا عبرهما */
function syncFocusRender(){
  FOCUS_HIDDEN=FOCUS.hidden;
  const show=(FOCUS.on||FOCUS.picking)&&FOCUS.iso.active&&(FOCUS.iso.cards.size>0||FOCUS.iso.nline);
  FOCUS_DIM=show?{on:true,alpha:FOCUS.dim,cards:FOCUS.iso.cards,nline:FOCUS.iso.nline}:null;
}

/* ---------- واجهة المستويات ---------- */
function applyFocusUI(){
  const b=document.body;
  b.classList.toggle('focusing',FOCUS.on);
  b.classList.remove('f1','f2','f3','fP');
  if(FOCUS.on){b.classList.add('f'+FOCUS.level);if(FOCUS.protect)b.classList.add('fP')}
  const show=(id,on)=>{const el=$(id);if(el)el.style.display=on?'':'none'};
  const ids=['bar','tbar','pgbar','tbHandle','toolPen','toolHl','toolErase','toolSelect','toolShape','toolText','toolImage','toolTeach','colorBtn','clear','pgAdd','pgNum'];
  ids.forEach(id=>show(id,true));
  const ug=document.querySelector('#tbar .tg.hg');if(ug)ug.style.display='';
  if(!FOCUS.on){placeFocusBar();return}
  show('bar',false);
  const pp=$('pgPanel');if(pp)pp.hidden=true;
  const L=FOCUS.level;
  if(L===1){
    ['toolTeach','toolImage','toolShape','toolText','clear'].forEach(id=>show(id,false));
  }else if(L===2){
    ['pgbar','tbHandle','toolTeach','toolHl','toolShape','toolText','toolImage','clear','colorBtn'].forEach(id=>show(id,false));
    if(ug)ug.style.display='none';
    show('toolPen',!!FOCUS.allow.pen);
    show('toolErase',!!FOCUS.allow.erase);
    show('toolSelect',!!FOCUS.allow.select);
  }else{
    ['tbar','pgbar'].forEach(id=>show(id,false));
  }
  if(FOCUS.protect){['toolTeach','clear','pgAdd','pgNum'].forEach(id=>show(id,false))}
  placeFocusBar();
}

/* ---------- شريط التركيز المصغّر: خروج آمن + مستوى + إظهار المخفي ---------- */
function placeFocusBar(){
  const bar=$('focusbar');if(!bar)return;
  bar.style.display=FOCUS.on?'flex':'none';
  const lvl=$('focusLvl');
  if(lvl){lvl.hidden=FOCUS.level===3;lvl.textContent='المستوى: '+['','بسيط','متوسط','كامل'][FOCUS.level]}
  const rv=$('focusReveal');
  if(rv){rv.hidden=!FOCUS.hidden.size;rv.textContent='إظهار المخفي ('+ar(FOCUS.hidden.size)+')'}
}

function focusStart(){
  closeMenu();hideOpts();selClear();hideCardBar();
  const pp=$('pgPanel');if(pp)pp.hidden=true;
  FOCUS.on=true;FOCUS.level=FOCUS_PREFS.level;FOCUS.protect=FOCUS_PREFS.protect;FOCUS.dim=FOCUS_PREFS.dim;
  FOCUS.allow={pen:FOCUS_PREFS.pen,erase:FOCUS_PREFS.erase,select:FOCUS_PREFS.select,nline:FOCUS_PREFS.nline};
  const okTool=t=>{
    if(FOCUS.level===3)return true;
    if(FOCUS.level===1)return true; /* الأدوات الأساسية كلها متاحة في بسيط */
    if(t==='pen')return FOCUS.allow.pen;
    if(t==='erase')return FOCUS.allow.erase;
    if(t==='select')return FOCUS.allow.select;
    return false;
  };
  if(!okTool(S.tool))setTool(FOCUS.allow.select?'select':FOCUS.allow.pen?'pen':FOCUS.allow.erase?'erase':'select');
  applyFocusUI();fit();redrawAll();syncFocusRender();redrawDoc();
}
function focusExit(){
  FOCUS.on=false;
  FOCUS.iso.active=false;FOCUS.iso.cards.clear();FOCUS.iso.nline=false;
  FOCUS.hidden.clear();
  FOCUS.picking=null;FOCUS.pickSet=null;
  $('fpickDone').classList.remove('on');
  closeZoom();
  applyFocusUI();syncFocusRender();fit();redrawAll();
  toast('انتهى وضع التركيز — عادت كل عناصر الواجهة والبطاقات');
}
function focusSetLevel(n){
  FOCUS.level=n;FOCUS_PREFS.level=n;focusSavePrefs();
  applyFocusUI();fit();redrawAll();syncFocusRender();redrawDoc();
}

/* ---------- إخفاء / إظهار مؤقت للبطاقات ---------- */
function focusHideCard(c){
  FOCUS.hidden.add(c.id);
  hideCardBar();
  syncFocusRender();redrawDoc();placeFocusBar();
  toast('أُخفيت البطاقة مؤقتًا — تستعيدها من زر الإظهار أو بإنهاء وضع التركيز');
}
function focusRevealCard(id){
  FOCUS.hidden.delete(id);
  syncFocusRender();redrawDoc();placeFocusBar();
}
function focusRevealMenu(){
  const page=pg();
  const items=[{head:'بطاقات مخفية مؤقتًا'}];
  FOCUS.hidden.forEach(id=>{
    const c=(page.cards||[]).find(x=>x.id===id);if(!c)return;
    const label=c.text?('«'+(c.text.length>22?c.text.slice(0,22)+'…':c.text)+'»'):(c.img?'بطاقة صورة':'بطاقة نصية');
    items.push({label:label,fn:()=>focusRevealCard(id)});
  });
  items.push({label:'إظهار الكل',fn:()=>{FOCUS.hidden.clear();syncFocusRender();redrawDoc();placeFocusBar()}});
  openMenu($('focusReveal'),items);
}

/* ---------- اختيار بطاقات (للعزل أو التكبير) ---------- */
function startPick(kind){
  closeMenu();hideCardBar();selClear();
  FOCUS.picking=kind;
  FOCUS.pickSet=new Set(kind==='iso'&&FOCUS.iso.active?FOCUS.iso.cards:[]);
  if(kind==='zoom'){FOCUS.isoBackup={active:FOCUS.iso.active,cards:new Set(FOCUS.iso.cards),nline:FOCUS.iso.nline}}
  const d=$('fpickDone');d.classList.add('on');
  d.textContent=kind==='iso'?'تم — تثبيت العزل':'تم — تكبير المحدد';
  toast(kind==='iso'?'المس البطاقات التي تريد إبرازها، ثم اضغط «تم»':'المس البطاقة أو البطاقات لتكبيرها، ثم اضغط «تم»');
  if(kind==='iso'&&FOCUS.pickSet.size){FOCUS.iso.cards=FOCUS.pickSet;syncFocusRender();redrawDoc()}
}
function focusPickToggle(id){
  if(!FOCUS.pickSet)return;
  if(FOCUS.pickSet.has(id))FOCUS.pickSet.delete(id);else FOCUS.pickSet.add(id);
  /* معاينة حية بالتعتيم لكلا النمطين */
  FOCUS.isoBackup=FOCUS.picking==='iso'?FOCUS.isoBackup:FOCUS.isoBackup;
  FOCUS.iso={active:FOCUS.pickSet.size>0,cards:FOCUS.pickSet,nline:false};
  syncFocusRender();redrawDoc();
}
function focusCancelPick(){
  if(!FOCUS.picking)return;
  if(FOCUS.picking==='zoom'&&FOCUS.isoBackup)FOCUS.iso=FOCUS.isoBackup;
  else if(FOCUS.picking==='iso'){FOCUS.iso={active:false,cards:new Set(),nline:false}}
  FOCUS.picking=null;FOCUS.pickSet=null;FOCUS.isoBackup=null;
  $('fpickDone').classList.remove('on');
  syncFocusRender();redrawDoc();
}
function finishPick(){
  const kind=FOCUS.picking;
  if(!kind)return;
  const ids=new Set(FOCUS.pickSet||[]);
  $('fpickDone').classList.remove('on');
  if(kind==='iso'){
    FOCUS.picking=null;FOCUS.pickSet=null;
    FOCUS.iso={active:ids.size>0,cards:ids,nline:false};
    syncFocusRender();redrawDoc();
    toast(ids.size?'تم عزل النشاط — البطاقات المحددة بارزة':'لا بطاقات محددة — أُلغي العزل');
  }else{
    if(FOCUS.isoBackup)FOCUS.iso=FOCUS.isoBackup;
    FOCUS.picking=null;FOCUS.pickSet=null;FOCUS.isoBackup=null;
    syncFocusRender();redrawDoc();
    if(ids.size)openZoom(ids);else toast('لم تُحدد أي بطاقة للتكبير');
  }
}

/* ---------- تكبير النشاط: عرض تقديمي مؤقت (غير تفاعلي) ---------- */
function openZoom(ids){
  FOCUS.zoomIds=new Set(ids);
  drawZoom();
  $('fzoom').classList.add('on');
}
function closeZoom(){
  FOCUS.zoomIds=null;
  const z=$('fzoom');if(z)z.classList.remove('on');
}
function drawZoom(){
  const z=$('fzoom'),cv=$('fzoomCv');if(!z||!cv||!FOCUS.zoomIds)return;
  const page=pg();
  const cards=(page.cards||[]).filter(c=>FOCUS.zoomIds.has(c.id)&&!FOCUS.hidden.has(c.id));
  if(!cards.length){closeZoom();return}
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  cards.forEach(c=>{x0=Math.min(x0,c.x);y0=Math.min(y0,c.y);x1=Math.max(x1,c.x+c.w);y1=Math.max(y1,c.y+c.h)});
  const bw=x1-x0,bh=y1-y0,pad=26;
  const stage=$('stage');
  const sw=stage.clientWidth||1280,sh=stage.clientHeight||800;
  const scale=Math.max(.2,Math.min(2.4,(sw*.82)/bw,(sh*.82)/bh));
  const dw=Math.round((bw+pad*2)*scale),dh=Math.round((bh+pad*2)*scale);
  cv.style.width=dw+'px';cv.style.height=dh+'px';
  cv.width=Math.round(dw*DPR);cv.height=Math.round(dh*DPR);
  const x=cv.getContext('2d');
  x.setTransform(scale*DPR,0,0,scale*DPR,(pad-x0)*scale*DPR,(pad-y0)*scale*DPR);
  cards.forEach(c=>drawCard(x,c,c.w,c.h,page.background.surface));
}

/* ---------- قائمة إعداد التركيز (من قائمة المعلم) ---------- */
function openFocusSetup(){
  const P=FOCUS_PREFS;
  const tick=b=>(b?'✓ ':'');
  const dimRow=document.createElement('div');
  dimRow.style.cssText='display:flex;align-items:center;gap:10px;padding:6px 2px;direction:rtl';
  const dl=document.createElement('span');dl.style.cssText='font-size:13.5px;white-space:nowrap';dl.textContent='درجة التعتيم';
  const di=document.createElement('input');di.type='range';di.min='0.25';di.max='0.8';di.step='0.05';di.value=String(P.dim);di.style.flex='1';
  const dv=document.createElement('span');dv.style.cssText='font-size:13px;min-width:36px;text-align:center';dv.textContent=ar(Math.round(P.dim*100))+'٪';
  di.addEventListener('input',()=>{P.dim=parseFloat(di.value);FOCUS.dim=P.dim;focusSavePrefs();dv.textContent=ar(Math.round(P.dim*100))+'٪';syncFocusRender();redrawDoc()});
  dimRow.appendChild(dv);dimRow.appendChild(di);dimRow.appendChild(dl);
  const items=[
    {head:'مستوى التركيز'},
    {label:tick(P.level===1)+'١ · بسيط — إخفاء المشتتات، الأدوات الأساسية تبقى',keep:true,fn(){P.level=1;focusSavePrefs();openFocusSetup()}},
    {label:tick(P.level===2)+'٢ · متوسط — الأدوات التي يختارها المعلم فقط',keep:true,fn(){P.level=2;focusSavePrefs();openFocusSetup()}},
    {label:tick(P.level===3)+'٣ · كامل — النشاط فقط على الشاشة',keep:true,fn(){P.level=3;focusSavePrefs();openFocusSetup()}},
    {head:'الأدوات المسموحة في المستوى المتوسط'},
    {label:tick(P.pen)+'القلم',keep:true,fn(){P.pen=!P.pen;focusSavePrefs();openFocusSetup()}},
    {label:tick(P.erase)+'الممحاة',keep:true,fn(){P.erase=!P.erase;focusSavePrefs();openFocusSetup()}},
    {label:tick(P.select)+'التحديد وسحب البطاقات',keep:true,fn(){P.select=!P.select;focusSavePrefs();openFocusSetup()}},
    {label:tick(P.nline)+'التفاعل مع خط الأعداد',keep:true,fn(){P.nline=!P.nline;focusSavePrefs();openFocusSetup()}},
    {head:'الحماية والعرض'},
    {label:tick(P.protect)+'حماية النشاط من الحذف والتعديل',keep:true,fn(){P.protect=!P.protect;focusSavePrefs();openFocusSetup()}},
    {node:dimRow},
    {head:'عزل النشاط (اختياري)'},
    {label:'اختيار بطاقات لإبرازها بالعزل…',fn(){startPick('iso')}},
    {label:tick(FOCUS.iso.nline)+'إبراز خط الأعداد في العزل',keep:true,fn(){FOCUS.iso.nline=!FOCUS.iso.nline;if(FOCUS.iso.nline)FOCUS.iso.active=true;syncFocusRender();redrawDoc();openFocusSetup()}},
    {label:'مسح العزل',fn(){FOCUS.iso.active=false;FOCUS.iso.cards.clear();FOCUS.iso.nline=false;syncFocusRender();redrawDoc();openFocusSetup()}},
    {head:'تكبير النشاط (عرض مؤقت)'},
    {label:'اختيار بطاقات للتكبير…',fn(){startPick('zoom')}},
    {sep:true}
  ];
  if(FOCUS.on)items.push({label:'إنهاء وضع التركيز',fn:()=>{closeMenu();focusExit()}});
  else items.push({label:'بدء وضع التركيز',fn:()=>{closeMenu();focusStart()}});
  openMenu($('toolTeach'),items);
}

/* ---------- تهيئة DOM والأحداث ---------- */
(function initFocus(){
  const stage=$('stage');if(!stage)return;
  const bar=document.createElement('div');bar.id='focusbar';
  bar.innerHTML=
    '<button id="focusExit" aria-label="إنهاء وضع التركيز — اضغط مطولًا ثانيتين" title="اضغط مطولًا ثانيتين لإنهاء وضع التركيز">'+
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0f6b5c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>'+
    '<button class="fchip" id="focusLvl" hidden></button>'+
    '<button class="fchip" id="focusReveal" hidden></button>';
  stage.appendChild(bar);
  const done=document.createElement('button');done.id='fpickDone';done.className='fchip';stage.appendChild(done);
  const z=document.createElement('div');z.id='fzoom';
  z.innerHTML='<canvas id="fzoomCv"></canvas><button class="fchip" id="fzoomX" aria-label="إغلاق التكبير">إغلاق ✕</button>';
  stage.appendChild(z);

  focusLoadPrefs();
  FOCUS.dim=FOCUS_PREFS.dim;
  syncFocusRender();
  placeFocusBar();

  /* ضغطة مطوّلة ثانيتين على زر الخروج مع مؤشر تقدم هادئ */
  const chip=$('focusExit');
  let lpRaf=0,lpOn=false;
  const lpReset=()=>{lpOn=false;cancelAnimationFrame(lpRaf);chip.style.background=''};
  chip.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();
    try{chip.setPointerCapture(e.pointerId)}catch(_){}
    lpOn=true;const t0=performance.now();
    const tick=()=>{
      if(!lpOn)return;
      const p=Math.min(1,(performance.now()-t0)/2000);
      chip.style.background='conic-gradient(#0f6b5c '+(p*360)+'deg,var(--ui-card,#fff) 0deg)';
      if(p>=1){lpReset();focusExit();return}
      lpRaf=requestAnimationFrame(tick);
    };
    tick();
  });
  chip.addEventListener('pointerup',lpReset);
  chip.addEventListener('pointercancel',lpReset);
  chip.addEventListener('contextmenu',e=>e.preventDefault());

  $('focusLvl').addEventListener('click',()=>{
    openMenu($('focusLvl'),[
      {head:'مستوى التركيز'},
      {label:(FOCUS.level===1?'✓ ':'')+'١ · بسيط',fn(){focusSetLevel(1)}},
      {label:(FOCUS.level===2?'✓ ':'')+'٢ · متوسط',fn(){focusSetLevel(2)}},
      {label:(FOCUS.level===3?'✓ ':'')+'٣ · كامل',fn(){focusSetLevel(3)}}
    ]);
  });
  $('focusReveal').addEventListener('click',focusRevealMenu);
  done.addEventListener('click',finishPick);
  z.addEventListener('pointerdown',e=>{if(e.target!==$('fzoomX')&&e.target.tagName!=='CANVAS')return;closeZoom()});
  $('fzoomX').addEventListener('click',closeZoom);

  /* بديل لوحة المفاتيح: Escape مطوّلًا ثانيتين للخروج، وEscape يلغي وضع الاختيار/التكبير */
  let escTimer=0;
  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(FOCUS.picking&&!e.repeat){focusCancelPick();return}
    if(FOCUS.zoomIds&&!e.repeat){closeZoom();return}
    if(FOCUS.on&&!e.repeat){escTimer=setTimeout(()=>focusExit(),2000)}
  });
  window.addEventListener('keyup',e=>{if(e.key==='Escape')clearTimeout(escTimer)});
  window.addEventListener('resize',()=>{if(FOCUS.zoomIds)drawZoom()});
})();
