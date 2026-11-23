const {chromium}=require('playwright');const FS=require('fs');const FS_=FS;
const PATH=require('path'),OS=require('os'),URL_=require('url');const ROOT=PATH.resolve(__dirname,'..');const RESULTS=process.env.OUT||PATH.join(__dirname,'results')+PATH.sep;FS_.mkdirSync(RESULTS,{recursive:true});const DEFAULT_FILE=PATH.join(ROOT,'smart-board-pro-merged.html');
const FILE=process.env.FILE||DEFAULT_FILE;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CONFIGS=[{n:'A',w:1366,h:768,d:1},{n:'B',w:1920,h:1080,d:1},{n:'C',w:1366,h:768,d:2},{n:'D',w:768,h:1024,d:1}];
async function open(cfg,opts){
  opts=opts||{};const b=opts.browser||await chromium.launch();
  const ctx=await b.newContext({viewport:{width:cfg.w,height:cfg.h},deviceScaleFactor:cfg.d,hasTouch:true,acceptDownloads:true});
  if(!opts.auto)await ctx.addInitScript(()=>{window.__SB_NOAUTO=true});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('CE '+m.text())});
  await p.goto(URL_.pathToFileURL(FILE).href);await sleep(500);
  p.b=b;p.ctx=ctx;return p;
}
// logical -> client coords
const S2=(p,x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('live').getBoundingClientRect(),q=__sb.toScreen(x,y);return{x:r.left+q.x,y:r.top+q.y}},[x,y]);
async function drag(p,pts,o){o=o||{};const q=[];for(const [x,y] of pts)q.push(await S2(p,x,y));
  await p.mouse.move(q[0].x,q[0].y);await p.mouse.down();for(let i=1;i<q.length;i++)await p.mouse.move(q[i].x,q[i].y,{steps:o.steps||4});await p.mouse.up();await sleep(o.wait==null?40:o.wait)}
const tap=async(p,x,y)=>{const q=await S2(p,x,y);await p.mouse.move(q.x,q.y);await p.mouse.down();await p.mouse.up();await sleep(40)};
const els=p=>p.evaluate(()=>__sb.pg().elements.map(e=>({id:e.id,type:e.type,kind:e.kind,hl:!!e.hl,text:e.text,bbox:e.bbox.map(v=>Math.round(v)),wb:__sb.worldBBox(e).map(v=>Math.round(v)),tf:e.tf.map(v=>Math.round(v*100)/100),locked:!!e.locked,color:e.color})));
const hist=p=>p.evaluate(()=>({u:__sb.HIST.undo.length,r:__sb.HIST.redo.length}));
const click=async(p,sel)=>{await p.click(sel);await sleep(60)};
const tool=async(p,t)=>{await p.evaluate(t=>__sb.setTool(t,true),t);await sleep(40)};
// pixel at logical on doc canvas
const px=(p,x,y)=>p.evaluate(([x,y])=>{const c=document.getElementById('doc'),q=__sb.toScreen(x,y),d=c.getContext('2d').getImageData(Math.round(q.x*devicePixelRatio),Math.round(q.y*devicePixelRatio),1,1).data;return[d[0],d[1],d[2],d[3]]},[x,y]);
module.exports={chromium,FS,FILE,sleep,CONFIGS,open,S2,drag,tap,els,hist,click,tool,px};
