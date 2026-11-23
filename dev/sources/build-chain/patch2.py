t=open('template11.html',encoding='utf-8').read()
def cutpart(a,b,new):
    global t
    i=t.index(a);j=t.index(b,i)+len(b)
    t=t[:i]+new+t[j:]
cutpart("function mp(){","document.getElementById('modePen').onclick=()=>{S.mode='pen';mp()};",
"function setMode(m){S.mode=m==='pen'?'pen':'both';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===S.mode)));cancelActive(null)}")
cutpart("document.querySelectorAll('[data-ink]').forEach(b=>b.onclick=()=>{S.ink=b.dataset.ink;pressGroup('[data-ink]','ink',S.ink)});","\n",
"")
cutpart("document.querySelectorAll('[data-board]').forEach(b=>b.onclick=()=>{","redrawAll()});",
"function setBoard(v){if(!SURFACES[v])return;S.board=v;pressGroup('[data-board]','board',S.board);updateSwatches();redrawAll();if(HOOKS.dirty)HOOKS.dirty()}")
cutpart("const wr=document.getElementById('width'),wv=document.getElementById('widthVal');","pb.onclick=()=>{S.pressure=!S.pressure;pb.setAttribute('aria-pressed',String(S.pressure))};","")
t=t.replace("function updateSwatches(){\n  const tone=SURFACES[S.board].tone;","function updateSwatches(){\n  const tone=SURFACES[S.board].tone;if(HOOKS.colors)HOOKS.colors();",1)
t=t.replace("setPolicy,matchScreen,","setPolicy,matchScreen,setMode,setBoard,",1)
open('template12.html','w',encoding='utf-8').write(t);print('ok')
