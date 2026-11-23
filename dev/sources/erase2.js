/* ---------- T4.١: وحدة هندسة الإصابة والقص (هندسة بحتة: لا واجهة ولا ربط بالشريط ولا تطبيق على المستند) ----------
   الحبر الفعلي لخط = اتحاد قطع قطع-ناقص مربّعية (كما يرسمها drawUpTo): كل قطعة منحنى بيزيه مربّع
   [بداية، تحكم، نهاية] بسماكة ثابتة، وبأغطية وصلات مستديرة. الممحاة = كبسولة {ax,ay,bx,by,r} بإحداثيات الصفحة.
   القاعدة: تُحذف نقطة المحور إن كانت مسافتها عن محور الكبسولة ≤ r + نصف سماكة تلك القطعة، فيلامس غطاء
   الطرف المتبقي المستدير حافة الممحاة تمامًا ولا يبقى حبر داخلها. */
const ERASE=(function(){
  const hyp=Math.hypot,TOL_FLAT=0.01,EPS=1e-9;
  const mid=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  /* قطع الخط (محليًا) كما يرسمها drawUpTo بالضبط */
  function toPieces(pts){
    const n=pts.length,out=[];if(n<2)return out;
    for(let i=1;i<=n-1;i++){
      const last=i===n-1,a=i===1?{x:pts[0].x,y:pts[0].y}:mid(pts[i-1],pts[i]),c={x:pts[i].x,y:pts[i].y};
      const b=last?{x:c.x,y:c.y}:mid(pts[i],pts[i+1]);
      const w=last?pts[i].w:(pts[i].w+pts[i+1].w)/2;
      if(last&&a.x===b.x&&a.y===b.y)continue; /* المرسِم يتخطى القطعة الأخيرة المنعدمة */
      out.push({a,c,b,w,i});
    }
    return out;
  }
  const affine=tf=>{const[A,B,C,D,E,F]=tf;const T=p=>({x:A*p.x+C*p.y+E,y:B*p.x+D*p.y+F});
    const det=A*D-B*C,s=Math.sqrt(Math.abs(det)),tr=A*A+B*B+C*C+D*D,disc=Math.sqrt(Math.max(0,tr*tr-4*det*det)),s1=Math.sqrt((tr+disc)/2),s2=Math.sqrt(Math.max(0,(tr-disc)/2));
    return{T,s,aniso:s2>0?s1/s2:Infinity}};
  function worldOf(el){
    const af=affine(el.tf);
    const dot=el.pts.length===1?{p:af.T(el.pts[0]),rad:Math.max(0.5,el.pts[0].w/2)*af.s}:null;
    const pcs=toPieces(el.pts).map(q=>({a:af.T(q.a),c:af.T(q.c),b:af.T(q.b),w:q.w*af.s,i:q.i}));
    return{pcs,dot,s:af.s,aniso:af.aniso};
  }
  const Q=(q,t)=>{const u=1-t,k0=u*u,k1=2*u*t,k2=t*t;return{x:k0*q.a.x+k1*q.c.x+k2*q.b.x,y:k0*q.a.y+k1*q.c.y+k2*q.b.y}};
  function dPS(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=t<0?0:t>1?1:t;return hyp(px-ax-t*dx,py-ay-t*dy)}
  function segInt(p,q,r,s){const d=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const d1=d(r,s,p),d2=d(r,s,q),d3=d(p,q,r),d4=d(p,q,s);return((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0))}
  function segSegDist(p,q,r,s){if(segInt(p,q,r,s))return 0;
    return Math.min(dPS(p.x,p.y,r.x,r.y,s.x,s.y),dPS(q.x,q.y,r.x,r.y,s.x,s.y),dPS(r.x,r.y,p.x,p.y,q.x,q.y),dPS(s.x,s.y,p.x,p.y,q.x,q.y))}
  function flatten(q,tol){const dd=hyp(q.a.x-2*q.c.x+q.b.x,q.a.y-2*q.c.y+q.b.y),n=clamp(Math.ceil(Math.sqrt(dd/(4*(tol||TOL_FLAT)))),1,128),o=[];for(let k=0;k<=n;k++)o.push(Q(q,k/n));return o}
  const capBox=c=>[Math.min(c.ax,c.bx)-c.r,Math.min(c.ay,c.by)-c.r,Math.max(c.ax,c.bx)+c.r,Math.max(c.ay,c.by)+c.r];
  /* قطعة بعيدة عن الكبسولة؟ (صندوق نقاطها الثلاث ± نصف السماكة ± نصف قطر الممحاة لا يتقاطع مع صندوق الكبسولة) */
  const pieceFar=(q,cb,pad)=>{const x0=Math.min(q.a.x,q.c.x,q.b.x)-pad,x1=Math.max(q.a.x,q.c.x,q.b.x)+pad,y0=Math.min(q.a.y,q.c.y,q.b.y)-pad,y1=Math.max(q.a.y,q.c.y,q.b.y)+pad;return x1<cb[0]||x0>cb[2]||y1<cb[1]||y0>cb[3]};
  const validCap=c=>c&&[c.ax,c.ay,c.bx,c.by,c.r].every(Number.isFinite)&&c.r>0;
  /* هل يوجد حبر للخط داخل الكبسولة؟ gap = أقصر مسافة بين الحبر وحافة الممحاة (سالبة = تداخل) */
  function hitStroke(el,cap){
    if(!validCap(cap))return{hit:false,gap:Infinity};
    const wb=worldBBox(el),cb=capBox(cap);
    if(wb[2]<cb[0]||wb[0]>cb[2]||wb[3]<cb[1]||wb[1]>cb[3])return{hit:false,gap:Infinity,quick:true};
    const W=worldOf(el);
    if(W.dot){const g=dPS(W.dot.p.x,W.dot.p.y,cap.ax,cap.ay,cap.bx,cap.by)-W.dot.rad-cap.r;return{hit:g<=0,gap:g}}
    const A={x:cap.ax,y:cap.ay},B={x:cap.bx,y:cap.by};let gap=Infinity;
    for(const q of W.pcs){if(pieceFar(q,cb,q.w/2+TOL_FLAT+1e-6)&&gap<Infinity)continue;const pl=flatten(q);let m=Infinity;for(let k=0;k<pl.length-1;k++){const d=segSegDist(pl[k],pl[k+1],A,B);if(d<m)m=d}
      if(pl.length===1)m=dPS(pl[0].x,pl[0].y,A.x,A.y,B.x,B.y);
      const g=m-q.w/2-cap.r;if(g<gap)gap=g}
    return{hit:gap<=TOL_FLAT,gap};
  }
  /* مسافة نقطة عن الحبر (سالبة = داخل الحبر): للاختبارات */
  function inkDist(el,p){
    const W=worldOf(el);if(W.dot)return hyp(p.x-W.dot.p.x,p.y-W.dot.p.y)-W.dot.rad;
    let best=Infinity;for(const q of W.pcs){const pl=flatten(q,0.003);let m=Infinity;for(let k=0;k<pl.length-1;k++){const d=dPS(p.x,p.y,pl[k].x,pl[k].y,pl[k+1].x,pl[k+1].y);if(d<m)m=d}
      const g=m-q.w/2;if(g<best)best=g}
    return best;
  }
  /* فترات t المحذوفة من قطعة عالمية: f(t)=dist(B(t),axis)-(r+w/2) ≤ 0؛ مسح تكيّفي مضمون بحد ليبشيتز */
  function erasedIv(q,cap,margin){
    const reach=cap.r+q.w/2+(margin||0),sp=2*Math.max(hyp(q.c.x-q.a.x,q.c.y-q.a.y),hyp(q.b.x-q.c.x,q.b.y-q.c.y),1e-9);
    const f=t=>{const p=Q(q,t);return dPS(p.x,p.y,cap.ax,cap.ay,cap.bx,cap.by)-reach};
    const L=hyp(q.c.x-q.a.x,q.c.y-q.a.y)+hyp(q.b.x-q.c.x,q.b.y-q.c.y);
    const K=Math.max(4,Math.min(256,Math.ceil(L/(0.5*Math.max(reach,0.5)))+2));
    const T=[],F=[];
    const scan=(t0,f0,t1,f1,d)=>{
      /* يضيف نقاط العينة بين الطرفين حتى يثبت أن لا عبور مفقود */
      const safe=Math.min(f0,f1)>sp*(t1-t0)/2;
      if((f0>0&&f1>0&&safe)||d>14||(f0<=0&&f1<=0&&d>=2)||((f0<=0)!==(f1<=0)&&d>=3))return;
      const tm=(t0+t1)/2,fm=f(tm);scan(t0,f0,tm,fm,d+1);T.push(tm);F.push(fm);scan(tm,fm,t1,f1,d+1)};
    let tp=0,fp=f(0);T.push(0);F.push(fp);
    for(let k=1;k<=K;k++){const t=k/K,ft=f(t);scan(tp,fp,t,ft,0);T.push(t);F.push(ft);tp=t;fp=ft}
    const out=[];let open=null;
    const root=(ta,fa,tb,fb)=>{let lo=ta,hi=tb,flo=fa;for(let it=0;it<50;it++){const m=(lo+hi)/2,fm=f(m);if((fm<=0)===(flo<=0)){lo=m;flo=fm}else hi=m}return(lo+hi)/2};
    for(let k=0;k<T.length;k++){
      const inside=F[k]<=0;
      if(k===0){if(inside)open=0}
      else{const pin=F[k-1]<=0;
        if(!pin&&inside){open=root(T[k-1],F[k-1],T[k],F[k])}
        else if(pin&&!inside){out.push([open,root(T[k-1],F[k-1],T[k],F[k])]);open=null}}
    }
    if(open!==null)out.push([open,1]);
    return out;
  }
  function complement(iv){const r=[];let pos=0;for(const[a,b]of iv){if(a>pos+1e-7)r.push([pos,a]);pos=Math.max(pos,b)}if(pos<1-1e-7)r.push([pos,1]);return r}
  /* تجميع الشظايا المتصلة عبر القطع: {k0,t0,k1,t1} (فهارس مصفوفة القطع) */
  function fragmentsOf(ivs){
    const fr=[];let last=null;
    for(let k=0;k<ivs.length;k++){
      for(const[s,e]of complement(ivs[k])){
        if(s<=1e-9&&last&&last.k1===k-1&&last.t1>=1-1e-9){last.k1=k;last.t1=e}
        else{last={k0:k,t0:s,k1:k,t1:e};fr.push(last)}
      }
    }
    return fr;
  }
  /* أقصى مسافة (أحادية الاتجاه) من نقاط P إلى خط متعدد Pl: البحث بالقوة الغاشمة (للمرجعية والاختبار) */
  function dirBrute(P,Pl){let m=0;for(const p of P){let b=Infinity;if(Pl.length===1)b=hyp(p.x-Pl[0].x,p.y-Pl[0].y);for(let k=0;k<Pl.length-1;k++){const v=dPS(p.x,p.y,Pl[k].x,Pl[k].y,Pl[k+1].x,Pl[k+1].y);if(v<b)b=v}if(b>m)m=b}return m}
  /* نفسها لكن بشبكة تجزئة: تكلفة خطية تقريبًا بدل التربيعية (مطلوب للخطوط الطويلة)؛ النتيجة مطابقة تمامًا */
  function dirGrid(P,Pl){
    if(Pl.length<24||P.length<24)return dirBrute(P,Pl);
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const q of Pl){if(q.x<x0)x0=q.x;if(q.x>x1)x1=q.x;if(q.y<y0)y0=q.y;if(q.y>y1)y1=q.y}
    let SL=0;for(let k=0;k<Pl.length-1;k++)SL+=hyp(Pl[k+1].x-Pl[k].x,Pl[k+1].y-Pl[k].y);const c=Math.max(0.5,Math.min(8,3*SL/(Pl.length-1)||1)),cols=Math.floor((x1-x0)/c)+1,rows=Math.floor((y1-y0)/c)+1;
    if(!(cols>0&&rows>0)||cols*rows>4e6)return dirBrute(P,Pl);
    const cells=new Map(),cx=x=>Math.floor((x-x0)/c),cy=y=>Math.floor((y-y0)/c);
    for(let k=0;k<Pl.length-1;k++){const a=Pl[k],b=Pl[k+1];const ax=cx(Math.min(a.x,b.x)),bx=cx(Math.max(a.x,b.x)),ay=cy(Math.min(a.y,b.y)),by=cy(Math.max(a.y,b.y));
      for(let y=ay;y<=by;y++)for(let x=ax;x<=bx;x++){const key=y*cols+x;let l=cells.get(key);if(!l){l=[];cells.set(key,l)}l.push(k)}}
    let m=0;const maxR=Math.max(cols,rows);
    for(const p of P){let b=Infinity;const pcx=cx(p.x),pcy=cy(p.y);
      for(let r=0;r<=maxR;r++){
        /* حلقة تشيبيشيف نصف قطرها r حول خلية النقطة (النقطة قد تقع خارج الشبكة: نقصّ الحلقة على حدودها) */
        const ya=pcy-r,yb=pcy+r,xa=pcx-r,xb=pcx+r;
        for(let y=Math.max(0,ya);y<=Math.min(rows-1,yb);y++){
          const edgeRow=(y===ya||y===yb);
          for(let x=Math.max(0,xa);x<=Math.min(cols-1,xb);x+=(edgeRow||r===0?1:Math.max(1,xb-xa))){
            if(!edgeRow&&x!==xa&&x!==xb)continue;
            const l=cells.get(y*cols+x);if(!l)continue;
            for(const k of l){const v=dPS(p.x,p.y,Pl[k].x,Pl[k].y,Pl[k+1].x,Pl[k+1].y);if(v<b)b=v}}}
        if(b<=Math.min(p.x-(x0+(pcx-r)*c),(x0+(pcx+r+1)*c)-p.x,p.y-(y0+(pcy-r)*c),(y0+(pcy+r+1)*c)-p.y))break;
        if(r>=48&&b===Infinity){b=Infinity;break}
      }
      if(b===Infinity){for(let k=0;k<Pl.length-1;k++){const v=dPS(p.x,p.y,Pl[k].x,Pl[k].y,Pl[k+1].x,Pl[k+1].y);if(v<b)b=v}}
      if(b>m)m=b}
    return m;
  }
  function hausdorff(A,B){return Math.max(dirGrid(A,B),dirGrid(B,A))}
  function hausdorffBrute(A,B){return Math.max(dirBrute(A,B),dirBrute(B,A))}
  const samp=(q,t0,t1,n)=>{const o=[];for(let k=0;k<=n;k++)o.push(Q(q,t0+(t1-t0)*k/n));return o};
  /* جزء [t0,t1] من قطعة بيزيه */
  const sub=(q,t0,t1)=>{const P=t=>Q(q,t),a=P(t0),b=P(t1),c={x:(1-t0)*(1-t1)*q.a.x+(t0+t1-2*t0*t1)*q.c.x+t0*t1*q.b.x,y:(1-t0)*(1-t1)*q.a.y+(t0+t1-2*t0*t1)*q.c.y+t0*t1*q.b.y};return{a,c,b,w:q.w}};
  /* سلسلة قطع من قائمة نقاط (كما يرسمها drawUpTo) */
  const chainOf=pts=>toPieces(pts);
  function samplePieces(ps,n){const o=[];for(const q of ps){const L=hyp(q.c.x-q.a.x,q.c.y-q.a.y)+hyp(q.b.x-q.c.x,q.b.y-q.c.y);o.push(...samp(q,0,1,Math.min(64,Math.max(n,Math.ceil(L/1.2)))))}return o}/* عينات تكيّفية: خطأ الوتر أقل من ~٠٫٠٣ حتى للقطع الطويلة */
  /* بناء نقاط الشظية محليًا: الجزء الداخلي يحتفظ بالنقاط الأصلية حرفيًا، والقصّان بنقطة طرف على المنحنى */
  function buildSimple(el,lp,fr){
    const p=el.pts,n=p.length,q0=lp[fr.k0],q1=lp[fr.k1],i0=q0.i,i1=q1.i;
    const P0=Q(q0,fr.t0),pts=[{x:P0.x,y:P0.y,w:q0.w}];
    const endFinal=fr.k1===lp.length-1&&fr.t1>=1-1e-9&&i1===n-1;
    if(fr.k0===fr.k1&&!endFinal){
      const s=sub(q0,fr.t0,fr.t1);pts.push({x:s.c.x,y:s.c.y,w:q0.w},{x:s.b.x,y:s.b.y,w:q0.w});
    }else{
      for(let i=i0;i<=i1;i++)pts.push({x:p[i].x,y:p[i].y,w:p[i].w});
      if(!endFinal){const E=Q(q1,fr.t1);pts.push({x:E.x,y:E.y,w:i1<n-1?Math.min(q1.w,p[i1+1].w):p[n-1].w})}
    }
    if(pts.length<2)pts.push({x:pts[0].x,y:pts[0].y,w:pts[0].w});
    return pts;
  }
  /* الهدف: الشظية كمنحنى هدف (قطع عالمية مجتزأة) لقياس الانحراف */
  function targetPieces(lp,fr){
    const o=[];for(let k=fr.k0;k<=fr.k1;k++){const t0=k===fr.k0?fr.t0:0,t1=k===fr.k1?fr.t1:1;o.push(t0===0&&t1===1?lp[k]:sub(lp[k],t0,t1))}
    return o;
  }
  const lenOf=ps=>{let L=0;for(const q of ps){const pl=flatten(q,0.25);for(let k=0;k<pl.length-1;k++)L+=hyp(pl[k+1].x-pl[k].x,pl[k+1].y-pl[k].y)}return L};
  function deviation(pts,tgt){
    const ch=chainOf(pts);if(!ch.length)return 0;
    const a=samplePieces(ch,4),b=samplePieces(tgt,4);
    return hausdorff(a,b);
  }
  /* انحراف القصّ البسيط: النقاط الداخلية حرفية، فالفرق محصور في أول قطعتين وآخر ثلاث؛ تُقاس هناك فقط (الشظايا الطويلة) */
  function devFast(pts,tgt){
    const ch=chainOf(pts),m=ch.length,T=tgt.length;
    if(m<9||T<7||m!==T+1)return deviation(pts,tgt);
    const h=hausdorff(samplePieces(ch.slice(0,2),8),samplePieces(tgt.slice(0,2),8));
    const t=hausdorff(samplePieces(ch.slice(m-3),8),samplePieces(tgt.slice(T-2),8));
    return Math.max(h,t);
  }
  /* إعادة أخذ عينات الشظية كاملة (احتياط عندما يتجاوز انحراف القصّ البسيط الحد) */
  function buildResampled(el,lp,fr,eps){
    const tgt=targetPieces(lp,fr),pl=[],wd=[];
    for(let j=0;j<tgt.length;j++){const f=flatten(tgt[j],0.003);for(let k=0;k<f.length;k++){if(j>0&&k===0)continue;pl.push(f[k]);wd.push(tgt[j].w)}}
    const cum=[0];for(let k=1;k<pl.length;k++)cum.push(cum[k-1]+hyp(pl[k].x-pl[k-1].x,pl[k].y-pl[k-1].y));
    const total=cum[cum.length-1];let best=null;
    /* الانحناء عند رؤوس الخط المسطّح (تغيّر الزاوية ÷ الطول)، ثم أقصاه ضمن نافذة ±٦ وحدات */
    const kap=new Array(pl.length).fill(0);
    for(let k=1;k<pl.length-1;k++){const ax=pl[k].x-pl[k-1].x,ay=pl[k].y-pl[k-1].y,bx=pl[k+1].x-pl[k].x,by=pl[k+1].y-pl[k].y,la=hyp(ax,ay),lb=hyp(bx,by);
      if(la>1e-9&&lb>1e-9){const th=Math.abs(Math.atan2(ax*by-ay*bx,ax*bx+ay*by));kap[k]=th/((la+lb)/2)}}
    const kmx=new Array(pl.length).fill(0);
    {let lo=0,hi=0;for(let k=0;k<pl.length;k++){while(cum[k]-cum[lo]>6)lo++;if(hi<k)hi=k;while(hi+1<pl.length&&cum[hi+1]-cum[k]<=6)hi++;let m=0;for(let t=lo;t<=hi;t++)if(kap[t]>m)m=kap[t];kmx[k]=m}}
    const at=(s,j)=>{while(j<cum.length-2&&cum[j+1]<s)j++;const span=cum[j+1]-cum[j]||1,u=clamp((s-cum[j])/span,0,1);return{j,x:pl[j].x+(pl[j+1].x-pl[j].x)*u,y:pl[j].y+(pl[j+1].y-pl[j].y)*u,w:Math.min(wd[j],wd[Math.min(j+1,wd.length-1)])}};
    for(const f of[1/4,1/8,1/16,1/32]){
      const tau=eps*f,pts=[];let s=0,j=0;
      while(true){const r=at(s,j);j=r.j;pts.push({x:r.x,y:r.y,w:r.w});if(s>=total)break;
        const kk=kmx[Math.min(j,kmx.length-1)],h=clamp(Math.sqrt(8*tau/Math.max(kk,1e-6)),0.25,12);
        s=Math.min(total,s+h);if(total-s<0.05)s=total}
      if(pts.length<2)pts.push({x:pts[0].x,y:pts[0].y,w:pts[0].w});
      const dv=deviation(pts,tgt);best={pts,dev:dv,h:f};if(dv<=eps)break;
    }
    return best;
  }
  function invAffine(tf){const[A,B,C,D,E,F]=tf,det=A*D-B*C;return p=>({x:(D*(p.x-E)-C*(p.y-F))/det,y:(-B*(p.x-E)+A*(p.y-F))/det})}
  /* محلّي ← عالمي للمنحنى الهدف: نقيس في الإحداثيات المحلية (التحويل الأفيني يحفظ الأعراض النسبية للخطأ)؛
     لذا يُحوَّل الحد eps إلى المحلي بقسمته على مقياس التحويل. */
  /* القص: يُرجع {status:'miss'|'removed'|'split', frags:[{pts,len,dev,resampled}], stats} */
  function splitStroke(el,cap,opts){
    opts=opts||{};const eps=opts.eps!=null?opts.eps:0.1,mf=opts.minFrag||{mode:'half'};/* القرار ٤: نصف السماكة مبدئيًا مع حماية التفاصيل الصغيرة */
    if(!validCap(cap))return{status:'miss',frags:[],stats:{}};
    const h=hitStroke(el,cap);if(!h.hit)return{status:'miss',frags:[],stats:{gap:h.gap}};
    const W=worldOf(el);
    if(W.dot)return{status:'removed',frags:[],stats:{dot:true,gap:h.gap}};
    const mg=opts.margin!=null?opts.margin:0.2,cbx=capBox(cap),ivs=W.pcs.map(q=>pieceFar(q,cbx,q.w/2+mg+TOL_FLAT+1e-6)?[]:erasedIv(q,cap,mg));
    if(!ivs.some(v=>v.length))return{status:'miss',frags:[],stats:{gap:h.gap,touchMiss:true}};
    const lp=toPieces(el.pts),fr=fragmentsOf(ivs),out=[];let resampled=0,dropped=0,maxDev=0;
    const sc=W.s||1,Lall=lenOf(W.pcs),small=Lall<=Math.max(mf.smallLen||48,(mf.smallFactor||4)*Math.max(...W.pcs.map(q=>q.w)));/* صغير: طول ≤ ٤٨ وحدة أو ≤ ٤× السماكة */
    for(const f of fr){
      const tgtL=targetPieces(lp,f),Lw=lenOf(W.pcs.slice(f.k0,f.k1+1).map((q,j)=>{const t0=j===0?f.t0:0,t1=f.k0+j===f.k1?f.t1:1;return t0===0&&t1===1?q:sub(q,t0,t1)}));
      const wFrag=lp[f.k0].w*sc;
      let thr=mf.mode==='half'?wFrag/2:mf.mode==='fixed'?(mf.len||0):1e-3;
      if(thr>1e-3&&mf.protectSmall!==false&&small)thr=1e-3;/* خط صغير (نقطة حرف/حركة/علامة): لا يُحذف منه شيء تلقائيًا */
      if(Lw<Math.max(thr,1e-3)){dropped++;continue}
      let pts=buildSimple(el,lp,f),dev=devFast(pts,tgtL)*sc,rs=false;
      if(dev>eps){const r=buildResampled(el,lp,f,eps/sc);if(r&&r.dev*sc<dev){pts=r.pts;dev=r.dev*sc;rs=true;resampled++}}
      if(dev>maxDev)maxDev=dev;
      out.push({pts,len:Lw,dev,resampled:rs,k0:f.k0,t0:f.t0,k1:f.k1,t1:f.t1});
    }
    return{status:out.length?'split':'removed',frags:out,stats:{gap:h.gap,resampled,dropped,maxDev,aniso:W.aniso>1.001}};
  }
  const mkStroke=(el,pts,id)=>{const e={id,type:'stroke',color:el.color,tf:el.tf.slice(),pts};if(el.hl)e.hl=true;e.bbox=strokeBBox(e);return e};
  /* تخطيط عملية محو لكبسولة واحدة على صفحة: يُرجع رقاعًا (add/remove) دون تطبيقها */
  function planErase(page,cap,mode,opts){
    opts=opts||{};const newId=opts.newId||(()=>uid('s'));
    const q=capBox(cap),cand=idxQuery(page,q[0],q[1],q[2],q[3]),hits=[];
    for(const el of cand){if(el.type!=='stroke')continue;
      if(mode==='whole'){if(hitStroke(el,cap).hit)hits.push({el,res:{status:'removed',frags:[]}})}
      else{const r=splitStroke(el,cap,opts);if(r.status!=='miss')hits.push({el,res:r})}}
    if(!hits.length)return{ops:[],stats:{touched:0,removed:0,fragments:0,candidates:cand.length}};
    const idx=new Map();page.elements.forEach((e,i)=>idx.set(e,i));
    hits.sort((a,b)=>idx.get(b.el)-idx.get(a.el));
    const ops=[];let fragments=0,removed=0,ptsAdded=0;
    for(const{el,res}of hits){const i=idx.get(el);ops.push({op:'remove',pageId:page.id,el,index:i});removed++;
      res.frags.forEach((f,j)=>{const e=mkStroke(el,f.pts,newId());ops.push({op:'add',pageId:page.id,el:e,index:i+j});fragments++;ptsAdded+=f.pts.length})}
    return{ops,stats:{touched:hits.length,removed,fragments,ptsAdded,candidates:cand.length}};
  }
  return{toPieces,worldOf,hitStroke,inkDist,erasedIv,splitStroke,mkStroke,planErase,flatten,capBox,Q,dPS,deviation,devFast,sub,TOL_FLAT,hausdorff,hausdorffBrute};
})();

