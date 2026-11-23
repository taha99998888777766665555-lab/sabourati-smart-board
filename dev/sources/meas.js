const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:768}});
await p.goto(process.argv[2]);await p.waitForTimeout(700);if(process.argv[3])await p.evaluate(()=>__sb.setTool('erase'));
console.log(JSON.stringify(await p.evaluate(()=>{const t=document.getElementById('tbar'),r=t.getBoundingClientRect(),c=document.getElementById('clear').getBoundingClientRect();return{tbTop:r.top,tbH:r.height,scrollH:t.scrollHeight,clearBottom:c.bottom,vh:innerHeight,present:document.getElementById('presentTb').getBoundingClientRect().bottom}})));await b.close()})();
