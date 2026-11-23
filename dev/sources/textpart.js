/* ---------- اختبار النص العربي ---------- */
const SAMPLES=[
 ['حروف متصلة','محمد يكتب الدرس في الكراسة'],
 ['حركات','بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'],
 ['حركات وتنوين','كَتَبَ الوَلَدُ دَرْسًا جَمِيلًا'],
 ['أرقام هندية','٠١٢٣٤٥٦٧٨٩'],
 ['خليط عربي ولاتيني (عيّنة)','درس Math رقم ٣ في صفحة ١٢'],
 ['اتجاه وعلامات ترقيم','هل أنهيتَ الواجب؟ (نعم) – ٣/٤'],
 ['جملة طويلة','نتعلم اليوم الحروف والأرقام ونكتب بخط واضح ونرتب الكلمات معًا'],
];
let tf='embedded';
const FONT_EMB="'PlexAr'",FONT_SYS="Tahoma,'Segoe UI','DejaVu Sans',sans-serif";
function fam(){return tf==='embedded'?FONT_EMB+','+FONT_SYS:FONT_SYS}
function renderText(){
  const tb=document.getElementById('tt');
  document.documentElement.style.setProperty('--tf',fam());
  tb.innerHTML=SAMPLES.map((s,i)=>'<div class="row"><div class="lab">'+s[0]+'</div><div class="sub">رسم Canvas (ما سيظهر في المحرك)</div><canvas class="cv" data-i="'+i+'"></canvas><div class="sub">نص HTML عادي (للمقارنة)</div><div class="htmlline" dir="rtl">'+s[1]+'</div></div>').join('');
  const run=()=>{document.querySelectorAll('canvas.cv').forEach(c=>{
    const r=c.getBoundingClientRect(),d=window.devicePixelRatio||1;
    c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);
    const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,r.width,r.height);
    x.direction='rtl';x.textAlign='right';x.textBaseline='middle';
    x.font='34px '+fam();const mw=x.measureText(SAMPLES[+c.dataset.i][1]).width;
    const size=Math.max(14,Math.min(34,Math.floor(34*(r.width-24)/mw)));  /* يصغَّر الخط ليتسع السطر، ويُطبَّق الحجم نفسه على نص HTML المقابل */
    c.parentElement.querySelector('.htmlline').style.fontSize=size+'px';
    x.fillStyle='#1b1b1b';x.font=size+'px '+fam();
    x.fillText(SAMPLES[+c.dataset.i][1],r.width-10,r.height/2);
  })};
  (document.fonts&&document.fonts.load?Promise.all([document.fonts.load("34px PlexAr"),document.fonts.load("600 34px PlexAr")]).catch(()=>{}):Promise.resolve()).then(()=>{run();window.__textReady=true});
  document.getElementById('fontInfo').textContent='الخط المحمّل: '+(tf==='embedded'?(document.fonts&&document.fonts.check('34px PlexAr','محمد')?'نعم':'لا'):'خط النظام');
}
function setFont(k){tf=k;document.getElementById('fontEmbedded').classList.toggle('on',k==='embedded');document.getElementById('fontSystem').classList.toggle('on',k==='system');document.getElementById('fontEmbedded').setAttribute('aria-pressed',String(k==='embedded'));document.getElementById('fontSystem').setAttribute('aria-pressed',String(k==='system'));renderText()}
document.getElementById('fontEmbedded').onclick=()=>setFont('embedded');
document.getElementById('fontSystem').onclick=()=>setFont('system');

