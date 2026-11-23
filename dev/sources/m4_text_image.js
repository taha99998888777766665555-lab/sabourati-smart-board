
/* =====================================================================
   الوحدة ٤: النص العربي (يمين لليسار، حركات، تحرير) والصور
   ===================================================================== */
const TXF="'PlexAr',Tahoma,'Segoe UI','DejaVu Sans',sans-serif";
const TXC=document.createElement('canvas').getContext('2d');
const TXL=new WeakMap();let FONT_GEN=0;
const RTL_RE=/[֐-ࣿיִ-﷿ﹰ-﻿]/;
function dirOf(s){for(const ch of s){if(RTL_RE.test(ch))return'rtl';if(/[A-Za-z]/.test(ch))return'ltr'}return'rtl'}
const fontOf=(size,bold)=>(bold?'600 ':'400 ')+size+'px '+TXF;
function layoutText(el){
  const key=el.text+'\u0001'+el.size+'\u0001'+(el.bold?1:0)+'\u0001'+(el.boxW||0);let c=TXL.get(el);
  if(c&&c.key===key&&c.fg===FONT_GEN)return c;
  TXC.font=fontOf(el.size,el.bold);const lh=el.size*1.65,lines=[];
  for(const para of el.text.split('\n')){
    if(!el.boxW){lines.push(para);continue}
    let cur='';for(const w of para.split(' ')){const t=cur?cur+' '+w:w;if(!cur||TXC.measureText(t).width<=el.boxW)cur=t;else{lines.push(cur);cur=w}}
    lines.push(cur);
  }
  let mw=0;for(const l of lines){const w=TXC.measureText(l).width;if(w>mw)mw=w}
  c={key,fg:FONT_GEN,lines,lh,w:el.boxW||Math.max(mw,el.size*0.6),h:lines.length*lh};TXL.set(el,c);return c;
}
const textBox=el=>{const L=layoutText(el);return[el.x,el.y,el.x+L.w,el.y+L.h]};
ELEMENT_TYPES.text={
  bbox:textBox,lbox:textBox,
  render(ctx,el,env){
    const L=layoutText(el);ctx.save();ctx.font=fontOf(el.size,el.bold);ctx.fillStyle=resolveColor(el.color,env.surface);ctx.textBaseline='middle';
    L.lines.forEach((ln,i)=>{if(!ln)return;const d=dirOf(ln);ctx.direction=d;ctx.textAlign=d==='rtl'?'right':'left';ctx.fillText(ln,d==='rtl'?el.x+L.w:el.x,el.y+(i+0.5)*L.lh)});
    ctx.restore();
  },
  validate(raw,E,path){
    if(typeof raw.text!=='string'||raw.text.length>20000||!raw.text.length){E.push(path+': نص غير صالح');return null}
    if(!fin(raw.x)||!fin(raw.y)||Math.abs(raw.x)>LIM.coord||Math.abs(raw.y)>LIM.coord){E.push(path+': موضع النص غير صالح');return null}
    if(!fin(raw.size)||raw.size<4||raw.size>2000){E.push(path+': حجم الخط غير صالح');return null}
    if(raw.boxW!==undefined&&(!fin(raw.boxW)||raw.boxW<0||raw.boxW>LIM.coord)){E.push(path+': عرض الصندوق غير صالح');return null}
    if(raw.bold!==undefined&&typeof raw.bold!=='boolean'){E.push(path+': سمك الخط غير صالح');return null}
    if(typeof raw.color!=='string'||!COLOR_RE.test(raw.color)){E.push(path+': لون غير صالح');return null}
    const tf=readTf(raw,E,path);if(!tf)return null;
    const el={id:raw.id,type:'text',text:raw.text,x:raw.x,y:raw.y,size:raw.size,boxW:raw.boxW||0,bold:!!raw.bold,color:raw.color,tf};el.bbox=textBox(el);return el;
  },
  serialize(el){return{id:el.id,type:'text',text:el.text,x:r3(el.x),y:r3(el.y),size:r3(el.size),boxW:r3(el.boxW||0),bold:!!el.bold,color:el.color,tf:el.tf.map(r3)}}
};
/* بعد تحميل الخط المدمج: إعادة قياس النصوص (الحدود تعتمد على الخط) */
function relayoutAllText(){
  FONT_GEN++;let any=false;
  for(const p of S.doc.pages){for(const e of p.elements)if(e.type==='text'){e.bbox=textBox(e);any=true}PIDX.delete(p)}
  if(any)redrawAll();
}
try{Promise.all([document.fonts.load(fontOf(40,false),'مرحبا'),document.fonts.load(fontOf(40,true),'مرحبا')]).then(relayoutAllText).catch(()=>{})}catch(e){}
on('load',()=>{setTimeout(relayoutAllText,0)});

/* ---------- محرر النص (طبقة فوق السبورة) ---------- */
let txEd=null,txAct=null,txCtx=null;
const txEdOpen=()=>!!txEd;
function tfScale(el){return Math.sqrt(Math.abs(detOf(el.tf)))||1}
function openTextEditor(ctx){
  hideTextEditor(true);txCtx=ctx;const el=ctx.el;
  const ta=document.createElement('textarea');ta.id='txEd';ta.setAttribute('dir','auto');ta.setAttribute('aria-label','محرر النص');ta.spellcheck=false;ta.setAttribute('lang','ar');
  const size=el?el.size*tfScale(el):S.textSize,fs=size*K();
  ta.style.fontSize=Math.max(14,fs)+'px';ta.style.fontWeight=(el?el.bold:S.textBold)?'600':'400';
  ta.style.color=resolveColor(el?el.color:S.ink,'#ffffff')==='#f5f5f5'?'#111':resolveColor(el?el.color:S.ink,'#ffffff');
  ta.value=el?el.text:'';
  stageEl.appendChild(ta);
  let sx,sy,rightAnchored;
  if(el){const b=worldBBox(el),a=toScreen(b[0],b[1]),c=toScreen(b[2],b[3]);sx=a.x;sy=a.y;ta.style.width=Math.max(160,c.x-a.x+30)+'px';ta.style.height=Math.max(48,c.y-a.y+10)+'px';ta.style.left=Math.max(4,sx-4)+'px';ta.style.top=Math.max(4,sy-4)+'px'}
  else{const a=toScreen(ctx.p.x,ctx.p.y),w=Math.min(stageEl.clientWidth-16,Math.max(220,Math.min(420,a.x-8)));ta.style.width=w+'px';ta.style.height=Math.max(48,fs*1.8)+'px';
    ta.style.left=Math.max(4,Math.min(a.x-w,stageEl.clientWidth-w-4))+'px';ta.style.top=Math.max(4,Math.min(a.y,stageEl.clientHeight-80))+'px'}
  const act=document.createElement('div');act.id='txAct';
  const ok=document.createElement('button');ok.className='btn on';ok.textContent='تم';ok.id='txOk';ok.onclick=()=>commitTextEditor();
  const no=document.createElement('button');no.className='btn';no.textContent='إلغاء';no.id='txNo';no.onclick=()=>hideTextEditor(false);
  act.append(ok,no);stageEl.appendChild(act);
  const tr=ta.getBoundingClientRect(),sr=stageEl.getBoundingClientRect();
  act.style.left=Math.max(4,Math.min(tr.left-sr.left,stageEl.clientWidth-130))+'px';act.style.top=Math.max(4,Math.min(tr.bottom-sr.top+6,stageEl.clientHeight-56))+'px';
  txEd=ta;txAct=act;ta.focus();selbar.hidden=true;
  ta.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();hideTextEditor(false)}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commitTextEditor()}e.stopPropagation()});
  ta.addEventListener('pointerdown',e=>e.stopPropagation());act.addEventListener('pointerdown',e=>e.stopPropagation());
}
function hideTextEditor(commit){
  if(!txEd)return;
  if(commit)commitTextEditor();
  if(txEd){txEd.remove();txAct.remove();txEd=null;txAct=null;txCtx=null}
}
function commitTextEditor(){
  if(!txEd)return;const ctx=txCtx,txt=txEd.value.replace(/\r/g,'').replace(/\s+$/,'');
  txEd.remove();txAct.remove();txEd=null;txAct=null;txCtx=null;
  const P=pg();
  if(!ctx.el){
    if(!txt.trim()){return}
    const el={id:uid('e'),type:'text',text:txt,x:ctx.p.x,y:ctx.p.y,size:S.textSize,boxW:0,bold:S.textBold,color:S.ink,tf:IDENT.slice()};
    const L=layoutText(el);if(dirOf(txt.split('\n')[0])==='rtl')el.x=ctx.p.x-L.w;el.bbox=textBox(el);
    commitOps('نص',[{op:'add',pageId:P.id,el,index:P.elements.length}]);return;
  }
  const el=ctx.el,idx=P.elements.indexOf(el);if(idx<0)return;
  if(!txt.trim()){commitOps('حذف النص',[{op:'remove',pageId:P.id,el,index:idx}]);selRefresh();return}
  if(txt===el.text){selRefresh();return}
  const oldW=layoutText(el).w,n2=Object.assign({},el,{text:txt}),newW=layoutText(n2).w,rtl=dirOf(txt.split('\n')[0])==='rtl';
  const nx=rtl?el.x+oldW-newW:el.x;
  commitOps('تعديل النص',[{op:'set',pageId:P.id,id:el.id,before:{text:el.text,x:el.x},after:{text:txt,x:nx}}]);selRefresh();
}
function editText(el){if(!el||el.type!=='text'||el.locked)return;openTextEditor({el})}
HOOKS.preDown=(e,p)=>{if(txEd){commitTextEditor();return true}return false};
const TEXT_H={move(e,st){st.cur=pt(e)},up(st){
  if(scrDist(st.p0,st.cur||st.p0)>10)return;
  const hit=topHit(st.p0.x,st.p0.y,10);
  if(hit&&hit.type==='text')openTextEditor({el:hit});else openTextEditor({el:null,p:st.p0});
},cancel(){}};
TOOLS.text={down(e,p,t){beginH(e,t,TEXT_H,{p0:p,cur:p})}};

/* ---------- الصور ---------- */
const IMGS=new Map();let imgRedrawT=0;
function getImg(id){
  let r=IMGS.get(id);if(r)return r;
  const a=S.doc.assets&&S.doc.assets[id];if(!a)return null;
  r={img:new Image(),ready:false};IMGS.set(id,r);
  r.img.onload=()=>{r.ready=true;clearTimeout(imgRedrawT);imgRedrawT=setTimeout(()=>{redrawDoc();HOOKS.thumbs&&HOOKS.thumbs()},16)};
  r.img.onerror=()=>{r.failed=true};r.img.src=a.data;return r;
}
const imgBox=el=>[0,0,el.w,el.h];
ELEMENT_TYPES.image={
  bbox:imgBox,lbox:imgBox,
  render(ctx,el,env){
    const r=getImg(el.asset);
    if(r&&r.ready)ctx.drawImage(r.img,0,0,el.w,el.h);
    else{ctx.save();ctx.fillStyle='rgba(120,130,140,.18)';ctx.fillRect(0,0,el.w,el.h);ctx.restore()}
  },
  validate(raw,E,path){
    if(typeof raw.asset!=='string'||!ID_RE.test(raw.asset)){E.push(path+': معرّف أصل الصورة غير صالح');return null}
    if(!fin(raw.w)||!fin(raw.h)||raw.w<=0||raw.h<=0||raw.w>LIM.coord||raw.h>LIM.coord){E.push(path+': مقاس الصورة غير صالح');return null}
    if(raw.locked!==undefined&&typeof raw.locked!=='boolean'){E.push(path+': علامة القفل غير صالحة');return null}
    const tf=readTf(raw,E,path);if(!tf)return null;
    const el={id:raw.id,type:'image',asset:raw.asset,w:raw.w,h:raw.h,tf};if(raw.locked)el.locked=true;el.bbox=imgBox(el);return el;
  },
  serialize(el){const o={id:el.id,type:'image',asset:el.asset,w:r3(el.w),h:r3(el.h),tf:el.tf.map(r3)};if(el.locked)o.locked=true;return o}
};
on('load',()=>{IMGS.clear()});
function fileToAsset(file,maxSide,quality){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      try{
        const w0=im.naturalWidth,h0=im.naturalHeight;if(!w0||!h0)throw new Error('صورة فارغة');
        const sc=Math.min(1,maxSide/Math.max(w0,h0)),w=Math.max(1,Math.round(w0*sc)),h=Math.max(1,Math.round(h0*sc));
        const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
        const mime=file.type==='image/jpeg'?'image/jpeg':'image/png';
        res({mime,data:c.toDataURL(mime,quality),w,h});
      }catch(e){rej(e)}finally{URL.revokeObjectURL(url)}
    };
    im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('تعذّرت قراءة الصورة'))};im.src=url;
  });
}
function putAsset(a){
  const id=uid('a');if(Object.keys(S.doc.assets).length>=LIM.assets)throw new Error('عدد الأصول يتجاوز الحد');
  S.doc.assets[id]=a;return id;
}
async function insertImageFile(file){
  try{
    if(!file||!/^image\//.test(file.type)){toast('الملف ليس صورة');return}
    const a=await fileToAsset(file,2400,0.9),id=putAsset(a),P=pg();
    const sc=Math.min(0.6*P.w/a.w,0.6*P.h/a.h),w=a.w*sc,h=a.h*sc,c=toLogical(W/2,H/2),cx=clamp(c.x,w/2,P.w-w/2),cy=clamp(c.y,h/2,P.h-h/2);
    const el={id:uid('e'),type:'image',asset:id,w,h,tf:[1,0,0,1,cx-w/2,cy-h/2]};el.bbox=imgBox(el);
    getImg(id);commitOps('صورة',[{op:'add',pageId:P.id,el,index:P.elements.length}]);
    setTool('select',true);selSet([el]);toast('أُدرجت الصورة. اسحبها لتحريكها أو اسحب المقابض لتغيير حجمها.');
  }catch(e){toast('تعذّر إدراج الصورة: '+(e&&e.message||'خطأ')) }
}
$('toolImage').onclick=()=>{$('fileImg').value='';$('fileImg').click()};
$('fileImg').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)insertImageFile(f)};
