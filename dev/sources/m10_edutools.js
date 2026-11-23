/* ===== أدوات تعليمية مستقلة داخل طبقة معزولة (إضافة بحتة للمرحلة السادسة والنموذج) =====
   لا تمس أي منطق قائم: تضيف قسمًا في قائمة المعلم وتفتح الأداتين المعتمدتين حرفيًا داخل iframe. */
const EDU={layer:null,iframe:null,title:null,current:null};
function eduDecode(b64){const bin=atob(b64);const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes)}
function eduEnsureLayer(){if(EDU.layer)return EDU.layer;
  const layer=document.createElement('div');layer.id='eduLayer';
  layer.style.cssText='position:fixed;inset:0;z-index:4000;display:none;background:rgba(15,35,40,.45);direction:rtl';
  const box=document.createElement('div');box.id='eduBox';
  box.style.cssText='position:absolute;inset:12px;background:#f6f4ee;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden';
  const head=document.createElement('div');
  head.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 14px;background:#fffdf8;border-bottom:1px solid #e2ded2';
  const title=document.createElement('div');title.id='eduTitle';
  title.style.cssText='font-size:19px;font-weight:700;color:#0b5e68;flex:1';
  const close=document.createElement('button');close.id='eduClose';close.type='button';
  close.textContent='إغلاق ✕';close.setAttribute('aria-label','إغلاق الأداة والعودة إلى السبورة');
  close.style.cssText='min-height:52px;min-width:120px;font-size:18px;border-radius:12px;border:1.5px solid #0f6b5c;background:#0f6b5c;color:#fff;font-family:inherit;cursor:pointer';
  close.onclick=closeEduTool;
  head.append(title,close);
  const fr=document.createElement('iframe');fr.id='eduFrame';
  fr.style.cssText='flex:1;border:0;width:100%;background:#fff';
  box.append(head,fr);layer.appendChild(box);document.body.appendChild(layer);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&EDU.layer&&EDU.layer.style.display==='block')closeEduTool()});
  EDU.layer=layer;EDU.iframe=fr;EDU.title=title;
  return layer}
/* رقعة عرض وقت الفتح (لا تغيّر بايتات الأداتين المعتمدتين): تخفي العنوان الداخلي المكرر وعبارة النموذج المستقل داخل الإطار، فيبقى عنوان الطبقة هو الوحيد. */
const EDU_PATCH='<style>header h1,header .tag{display:none!important}</style>';
function openEduTool(which){const l=eduEnsureLayer();
  EDU.current=which;
  EDU.title.textContent=which==='wheel'?'العجلة التفاعلية':'من الحرف إلى الجملة';
  EDU.iframe.srcdoc=eduDecode(EDU_SRC[which]).replace('</head>',EDU_PATCH+'</head>');
  l.style.display='block'}
function closeEduTool(){if(!EDU.layer)return;
  EDU.layer.style.display='none';EDU.iframe.srcdoc='';EDU.current=null}
window.__edu={open:openEduTool,close:closeEduTool,state:EDU,decode:eduDecode,src:()=>EDU_SRC};
