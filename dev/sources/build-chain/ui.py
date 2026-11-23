import re
t=open('template10.html',encoding='utf-8').read()
def cut(a,b,new,keep_b=True):
    global t
    i=t.index(a);j=t.index(b,i)
    t=t[:i]+new+(t[j:] if keep_b else t[j+len(b):])
S='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
def ic(p):return S+p+'</svg>'
ICONS={
'pen':'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
'hl':'<path d="M9 14l6-6 4 4-6 6H9z"/><path d="M4 21h9"/>',
'erase':'<path d="M16 3l5 5-11 11H5l-2-2z"/><path d="M9 20h12"/>',
'select':'<path d="M6 3l13 8-6 2-2 6z"/>',
'shape':'<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16" cy="8" r="5"/>',
'text':'<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
'image':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 18l6-5 4 3 3-2 5 4"/>',
'teach':'<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
'trash':'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
'hand':'<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6m0-6a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3L4 14a1.5 1.5 0 0 1 3-1"/>',
'plus':'<path d="M12 5v14M5 12h14"/>','minus':'<path d="M5 12h14"/>',
'fit':'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
'prev':'<path d="M9 5l7 7-7 7"/>','next':'<path d="M15 5l-7 7 7 7"/>',
'full':'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
'pages':'<rect x="6" y="3" width="13" height="16" rx="2"/><path d="M3 7v14h12"/>',
'file':'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
}
def tbtn(id,key,label):return '<button class="btn tool" id="%s" aria-pressed="false" title="%s">%s<span>%s</span></button>'%(id,label,ic(ICONS[key]),label)
header='''<header class="bar" id="bar">
  <h1>سبورتي الذكية</h1>
  <span class="tag">نسخة تشغيلية للتجربة</span>
  <span id="pageInfo" aria-live="polite"></span>
  <span id="hmsg" aria-hidden="true"></span>
  <div class="sp">
    <button class="btn" id="fileBtn" aria-haspopup="true" aria-expanded="false">%s<span>ملف</span></button>
    <button class="btn" id="newBtn" title="مستند جديد بنسبة صفحة تختارها">مستند جديد</button>
    <button class="btn" id="presentBtn" title="إخفاء الشريط العلوي وتكبير مساحة الكتابة">ملء الشاشة</button>
    <button class="btn" id="diagBtn" aria-pressed="false" title="لوحة فحص للاختبار على الشاشة الحقيقية">تشخيص</button>
  </div>
</header>

'''%ic(ICONS['file'])
cut('<header class="bar" id="bar">','<section class="view on" id="boardView">',header)
tb='''<div id="tbar" role="toolbar" aria-label="أدوات السبورة" data-dock="right">
      <button id="tbHandle" aria-expanded="true" aria-label="شريط الأدوات: اسحبه لتحريكه، المسه لطيّه أو فتحه" title="اسحب لتحريك الشريط، المس لطيّه/فتحه"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span class="t">الأدوات</span></button>
      <div id="tbBody">
        <div class="tg hg" role="group" aria-label="التراجع والإعادة">
          <button class="btn hbtn" id="undoBtn" disabled aria-label="تراجع" title="تراجع: لا توجد عمليات"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg><span class="cnt" id="undoCnt">٠</span></button>
          <button class="btn hbtn" id="redoBtn" disabled aria-label="إعادة" title="إعادة: لا توجد عمليات"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg><span class="cnt" id="redoCnt">٠</span></button>
        </div>
        <div class="tg c2 tools" role="group" aria-label="الأدوات">
          %s%s%s%s%s%s%s%s
        </div>
        <div class="tg c2 acts" role="group" aria-label="اللون والمسح">
          <button class="btn" id="colorBtn" aria-label="اللون والخيارات" title="اللون والخيارات"><span class="dot" id="colorDot"></span></button>
          <button class="btn" id="clear" data-armed="false" aria-label="مسح السبورة"><span class="bar2"></span>%s<span class="lbl">مسح</span></button>
        </div>
      </div>
      <div class="shield" id="shield" aria-hidden="true"></div>
    </div>

    <div id="opts" role="dialog" aria-label="خيارات الأداة" hidden></div>
    <div id="selbar" role="toolbar" aria-label="عمليات على المحدَّد" hidden></div>
    <div id="pgbar" role="toolbar" aria-label="الصفحات والعرض">
      <button class="btn ic" id="pgPrev" aria-label="الصفحة السابقة" title="الصفحة السابقة">%s</button>
      <button class="btn" id="pgNum" aria-label="لوحة الصفحات" title="لوحة الصفحات">صفحة ١ من ١</button>
      <button class="btn ic" id="pgNext" aria-label="الصفحة التالية" title="الصفحة التالية">%s</button>
      <button class="btn ic" id="pgAdd" aria-label="إضافة صفحة" title="إضافة صفحة بعد الحالية">%s</button>
      <span class="sepv"></span>
      <button class="btn ic" id="zOut" aria-label="تصغير" title="تصغير">%s</button>
      <button class="btn" id="zVal" aria-label="إعادة الحجم ١٠٠٪" title="إعادة الحجم الأصلي">١٠٠٪</button>
      <button class="btn ic" id="zIn" aria-label="تكبير" title="تكبير">%s</button>
      <button class="btn ic" id="toolHand" aria-pressed="false" aria-label="تحريك الصفحة" title="تحريك الصفحة (يد)">%s</button>
      <button class="btn ic" id="presentTb" aria-label="ملء الشاشة" title="ملء الشاشة">%s</button>
    </div>
    <div id="pgPanel" hidden role="dialog" aria-label="الصفحات"></div>
    <div id="ovl" aria-hidden="false"></div>
    <div id="toast" role="status" hidden></div>

    '''%(tbtn('toolPen','pen','قلم'),tbtn('toolHl','hl','تمييز'),tbtn('toolErase','erase','ممحاة'),tbtn('toolSelect','select','تحديد'),tbtn('toolShape','shape','أشكال'),tbtn('toolText','text','نص'),tbtn('toolImage','image','صورة'),tbtn('toolTeach','teach','المعلم'),
    ic(ICONS['trash']),ic(ICONS['prev']),ic(ICONS['next']),ic(ICONS['plus']),ic(ICONS['minus']),ic(ICONS['plus']),ic(ICONS['hand']),ic(ICONS['full']))
cut('<div id="tbar" role="toolbar"','<div id="diag" hidden>',tb)
# textView back button + inputs for files
t=t.replace('<span class="small">الخط:</span>','<button class="btn" id="backBoard">عودة إلى السبورة</button><span class="small">الخط:</span>')
t=t.replace('<div class="dlg" id="newDlg" hidden','''<input type="file" id="fileImg" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
<input type="file" id="filePdf" accept="application/pdf" hidden>
<input type="file" id="fileOpen" accept=".json,application/json" hidden>
<div class="dlg" id="cfDlg" hidden role="dialog" aria-modal="true" aria-labelledby="cfT"><div class="dlgBox"><h2 id="cfT"></h2><p id="cfMsg" class="small"></p><div class="dlgBtns"><button class="btn danger" id="cfOk">موافق</button><button class="btn" id="cfNo">إلغاء</button></div></div></div>
<div class="dlg" id="newDlg" hidden''')
# diag panel: tab buttons live inside diag
t=t.replace('<div class="drow"><button class="btn" id="perfBtn"','<div class="drow"><button class="btn" id="tabText" role="tab" aria-selected="false">اختبار النص العربي</button><button class="btn on" id="tabBoard" role="tab" aria-selected="true" hidden>لوحة الرسم</button></div>\n      <div class="drow"><button class="btn" id="perfBtn"')
css='''
/* ===== الإصدار التشغيلي: شريط الأدوات المضغوط والألواح ===== */
#tbar .tools{display:grid;grid-template-columns:repeat(2,1fr);gap:3px;width:100%}
#tbar.h .tools{display:flex;flex-wrap:nowrap;gap:3px;width:auto}
.btn.tool{flex-direction:column;gap:0;min-height:52px;min-width:48px;padding:2px 1px;font-size:12px;line-height:1.1}
.btn.tool svg{width:22px;height:22px}
#tbar.h .btn.tool{min-width:50px}
#tbar.h .btn.tool span{display:none}
#tbar.h .btn.tool{min-height:50px}
#tbar .acts{display:flex;gap:3px;width:100%}
#tbar.v .acts .btn{flex:1 1 0;min-width:48px;min-height:50px;padding:2px}
#tbar.h .acts{width:auto}
#clear{flex-direction:column;gap:0;font-size:12px;line-height:1.1}
#clear svg{width:20px;height:20px}
#clear.armed{font-size:11px}
#colorBtn .dot{display:block;width:30px;height:30px;border-radius:50%;border:3px solid var(--ui-line);background:#222}
#tbar .tg{border:0!important;padding-bottom:0}
#tbar.v .tg.hg{padding-bottom:2px}
#tbar.v #tbBody{gap:3px;padding:2px 5px 4px}
#tbar.h #tbBody{flex-wrap:nowrap}
#tbar.h .hbtn,#tbar.h #clear{min-height:50px}
#tbar.h{align-items:center}
.btn.ic{min-width:48px;padding:0}
#pgbar{position:absolute;z-index:9;left:50%;bottom:8px;transform:translateX(-50%);display:flex;gap:3px;align-items:center;flex-wrap:wrap;justify-content:center;padding:3px 5px;background:var(--ui-card);border:1px solid var(--ui-line);border-radius:14px;box-shadow:0 3px 14px rgba(0,0,0,.22);max-width:calc(100% - 16px);direction:rtl}
#pgbar .sepv{width:1px;align-self:stretch;background:var(--ui-line);margin:3px 3px}
#pgbar.busy{opacity:.45;pointer-events:none}
#zVal{min-width:64px;font-variant-numeric:tabular-nums}
#opts,#selbar,#pgPanel,.menu{position:absolute;z-index:12;background:var(--ui-card);border:1px solid var(--ui-line);border-radius:14px;box-shadow:0 6px 22px rgba(0,0,0,.3)}
#opts[hidden],#selbar[hidden],#pgPanel[hidden],.menu[hidden],#toast[hidden]{display:none!important}
#opts{padding:8px 10px;width:min(330px,calc(100% - 16px));max-height:calc(100% - 16px);overflow:auto}
#opts h3{margin:6px 0 4px;font-size:14px;color:#52606d;font-weight:600}
#opts h3:first-child{margin-top:0}
.swrow{display:flex;flex-wrap:wrap;gap:6px}
.swrow .sw{width:48px;height:48px}
.swrow input[type=color]{width:48px;height:48px;padding:2px;border-radius:50%;border:3px solid var(--ui-line);background:var(--ui-card);cursor:pointer}
.optrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.optrow input[type=range]{flex:1 1 140px}
.optrow .val{min-width:28px;text-align:center;font-weight:600}
.shapegrid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.shapegrid .btn{min-height:52px;font-size:13px;padding:2px;flex-direction:column;gap:0}
#selbar{display:flex;flex-wrap:wrap;gap:3px;padding:4px;max-width:calc(100% - 16px);justify-content:center}
#selbar .btn{min-height:48px;min-width:48px;font-size:13px;padding:0 6px;flex-direction:column;gap:0;line-height:1.1}
#selbar .btn svg{width:20px;height:20px}
#pgPanel{left:50%;bottom:72px;transform:translateX(-50%);width:min(760px,calc(100% - 16px));max-height:min(70%,520px);overflow:auto;padding:8px 10px}
#pgPanel .ph{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
#pgPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.thumb{border:3px solid var(--ui-line);border-radius:10px;padding:4px;background:var(--ui-card);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:14px}
.thumb[aria-current=true]{border-color:var(--ui-accent);box-shadow:0 0 0 2px var(--ui-accent)}
.thumb canvas{max-width:100%;height:auto;display:block;background:#fff;border-radius:4px}
.thumb .tb{display:flex;gap:3px;flex-wrap:wrap;justify-content:center}
.thumb .tb .btn{min-height:48px;min-width:48px;font-size:13px;padding:0 4px}
.menu{min-width:240px;padding:4px;display:flex;flex-direction:column;gap:2px;max-height:calc(100vh - 80px);overflow:auto;position:fixed}
.menu .mi{min-height:48px;justify-content:flex-start;border:0;background:transparent;width:100%;text-align:start;border-radius:8px;padding:0 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:16px}
.menu .mi:hover,.menu .mi:focus-visible{background:#e8efee}
.menu .mi[aria-pressed=true]{background:var(--ui-accent);color:var(--ui-accent-fg)}
.menu hr{border:0;border-top:1px solid var(--ui-line);margin:3px 0;width:100%}
.menu .mh{font-size:13px;color:#52606d;padding:4px 12px 0}
.menu input[type=text]{min-height:48px;margin:2px 4px;border:1px solid var(--ui-line);border-radius:8px;padding:0 10px;background:var(--ui-card)}
#toast{position:absolute;z-index:30;top:10px;left:50%;transform:translateX(-50%);background:#1d2733;color:#fff;border-radius:12px;padding:10px 16px;max-width:calc(100% - 24px);font-size:15px;box-shadow:0 4px 18px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center}
#toast .btn{min-height:48px;color:#1d2733}
#ovl{position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden}
#ovl>*{pointer-events:auto}
.ruler,.proto{position:absolute;touch-action:none;user-select:none;cursor:grab}
.curtain{position:absolute;background:#263238;color:#cfd8dc;display:flex;align-items:center;justify-content:center;touch-action:none;z-index:2}
.curtain .grip{position:absolute;background:#546e7a;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab;color:#fff;font-size:14px;border-radius:10px}
.timer{position:absolute;z-index:4;background:var(--ui-card);border:1px solid var(--ui-line);border-radius:16px;box-shadow:0 6px 22px rgba(0,0,0,.3);padding:6px 10px 8px;min-width:236px;touch-action:none}
.timer .th{display:flex;align-items:center;gap:6px;cursor:grab;touch-action:none;font-size:14px;color:#52606d;min-height:40px}
.timer .digits{font-size:54px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums;line-height:1.1;direction:ltr}
.timer.done .digits{color:var(--danger);animation:bl .6s steps(2) infinite}
@keyframes bl{50%{opacity:.25}}
.timer .tr{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.timer .tr .btn{min-height:48px;min-width:48px;font-size:14px;padding:0 6px}
#txEd{position:absolute;z-index:14;direction:rtl;border:2px dashed var(--ui-accent);border-radius:6px;background:rgba(255,255,255,.92);color:#111;padding:2px 4px;margin:0;resize:both;overflow:auto;line-height:1.5;font-family:'PlexAr',Tahoma,'Segoe UI',sans-serif;min-width:120px;min-height:48px;outline:none}
#txAct{position:absolute;z-index:15;display:flex;gap:4px}
#txAct .btn{min-height:48px}
body.present #pgbar{opacity:.85}
@media (max-width:700px){#pgbar .btn{min-width:48px;padding:0 6px}}
'''
t=t.replace('</style>',css+'</style>',1)
open('template11.html','w',encoding='utf-8').write(t)
print('ui ok',len(t))
