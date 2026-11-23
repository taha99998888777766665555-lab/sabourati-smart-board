const {chromium}=require('playwright');
(async()=>{
 const PATH=require('path'),URL_=require('url'),FS=require('fs');const ROOT=PATH.resolve(__dirname,'..');const SHOTS=PATH.join(__dirname,'results','shots');FS.mkdirSync(SHOTS,{recursive:true});const F=process.env.FILE?URL_.pathToFileURL(process.env.FILE).href:URL_.pathToFileURL(PATH.join(ROOT,'smart-board-pro-merged.html')).href;
 const sizes=[['1366x768',1366,768],['1920x1080',1920,1080],['768x1024',768,1024]];
 const br=await chromium.launch();
 for(const [nm,w,h] of sizes){
  const pg=await br.newPage({viewport:{width:w,height:h}});
  const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(F);await pg.waitForTimeout(1200);
  // open teacher menu
  await pg.evaluate(()=>{window.__sb&&window.__sb.openTeachMenu?window.__sb.openTeachMenu():document.querySelector('#teachBtn')?.click();});
  await pg.waitForTimeout(400);
  await pg.screenshot({path:PATH.join(SHOTS,'menu-'+nm+'.png')});
  // open wheel via menu item
  await pg.evaluate(()=>{window.__edu.open('wheel');});
  await pg.waitForTimeout(900);
  await pg.screenshot({path:PATH.join(SHOTS,'wheel-'+nm+'.png')});
  await pg.evaluate(()=>{window.__edu.close();});
  await pg.waitForTimeout(300);
  await pg.evaluate(()=>{window.__edu.open('hj');});
  await pg.waitForTimeout(900);
  await pg.screenshot({path:PATH.join(SHOTS,'harf-'+nm+'.png')});
  console.log(nm,'errors:',errs.length,errs[0]||'');
  await pg.close();
 }
 await br.close();
})();
