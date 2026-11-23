const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:768}});
await p.goto(process.argv[2]);await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(()=>{__sb.setToolbar({dock:'bottom',pos:.5,collapsed:false});const t=document.getElementById('tbar');return{h:t.getBoundingClientRect().height,w:t.getBoundingClientRect().width,kids:[...document.getElementById('tbBody').children].map(c=>[c.id||c.getAttribute('aria-label'),Math.round(c.getBoundingClientRect().width),Math.round(c.getBoundingClientRect().height),Math.round(c.getBoundingClientRect().top)])}})));await b.close()})();
