/* ============================================================
   sw.js — Service Worker لـ «سبورتي الذكية» فقط
   - النطاق: مجلد هذا الملف (/sabourati-smart-board/) ولا يتجاوزه.
   - يخزّن ملفي التشغيل فقط (index.html و board.html) في IndexedDB
     باسم «sabourati-shell-v1» — قاعدة منفصلة عن «sabourati-pro»
     (رسومات المستخدم وبطاقاته وإعداداته) ولا يستخدم Cache API
     (حتى لا يحذفه Service Worker تطبيق التعلم على نفس النطاق).
   - لا يلمس إلا طلبات التنقل (navigate) إلى هذين الملفين.
   - «الحزمة» = index.html + board.html معًا: تُنزَّل وتُتحقَّق وتُكتب في
     معاملة IndexedDB واحدة (ذرّية فعلًا) بمعرّف حزمة واحد؛ لا تُقدَّم ملفات
     من حزمتين مختلفتين أبدًا، وتبقى آخر حزمة سليمة عند أي فشل.
   - الشبكة أولًا (مهلة ٣ ثوانٍ) ثم الحزمة المخزَّنة.
   ============================================================ */
'use strict';
const VERSION = '1';
const DB_NAME = 'sabourati-shell-v1';
const STORE = 'files';
const NET_TIMEOUT_MS = 3000;
const SCOPE = new URL('./', self.location.href).href;
const FILES = {
  'index.html': { marker: 'sabourati-gateway', minBytes: 300 },
  'board.html': { marker: 'Smart Board Pro', minBytes: 500000 }
};

/* ---------- IndexedDB (قاعدة ملفات التشغيل فقط) ---------- */
function openDb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB_NAME);              // بلا رقم إصدار: يقبل أي إصدار قائم
    q.onupgradeneeded = () => { if (!q.result.objectStoreNames.contains(STORE)) q.result.createObjectStore(STORE); };
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
/* قراءة الحزمة كاملة في معاملة قراءة واحدة (لقطة متسقة)؛ تُرجع null إن نقص أي ملف أو اختلف معرّف الحزمة */
async function dbGetPair() {
  const db = await openDb();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly'), st = tx.objectStore(STORE);
      const out = {};
      for (const k of Object.keys(FILES)) { const r = st.get(k); r.onsuccess = () => { out[k] = r.result || null; }; }
      tx.oncomplete = () => {
        const ks = Object.keys(FILES), ids = ks.map(k => out[k] && out[k].pairId);
        res(ks.every(k => out[k]) && ids[0] && ids.every(i => i === ids[0]) ? out : null);
      };
      tx.onerror = tx.onabort = () => rej(tx.error || new Error('read failed'));
    });
  } finally { db.close(); }
}
/* كتابة الحزمة كاملة في معاملة readwrite واحدة: إما الملفان معًا أو لا شيء */
function dbPutPair(recs) {
  return openDb().then(db => new Promise((res, rej) => {
    let tx;
    try {
      tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      tx.oncomplete = () => { db.close(); res(); };
      tx.onabort = () => { db.close(); rej(tx.error || new Error('abort')); };
      st.put(recs['index.html'], 'index.html');
      /*FAULT_AFTER_FIRST*/
      st.put(recs['board.html'], 'board.html');
    } catch (err) {
      try { tx && tx.abort(); } catch (_) { /* انتهت المعاملة */ }   // أي استثناء بعد أول كتابة يُلغي المعاملة كلها
      db.close(); rej(err);
    }
  }));
}

/* ---------- أدوات ---------- */
function keyFor(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return null;
  const href = u.origin + u.pathname;
  if (href === SCOPE || href === SCOPE + 'index.html') return 'index.html';
  if (href === SCOPE + 'board.html') return 'board.html';
  return null;
}
function hasMarker(buf, marker) {
  const head = new TextDecoder('utf-8').decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 60000)));
  return head.indexOf(marker) !== -1;
}
/* يقرأ الاستجابة كاملة ويتحقق منها؛ يرمي إن انقطع التنزيل أو لم تكن الصفحة المتوقعة */
async function readVerified(key, res, pairId) {
  const spec = FILES[key];
  if (!res || res.status !== 200 || res.redirected) throw new Error('bad status');
  const ct = res.headers.get('content-type') || '';
  if (ct.indexOf('text/html') === -1) throw new Error('bad type');
  const body = await res.arrayBuffer();           // يرمي إن انقطع التنزيل
  if (body.byteLength < spec.minBytes || !hasMarker(body, spec.marker)) throw new Error('bad body');
  return { body, type: ct, ver: VERSION, pairId, ts: Date.now(), len: body.byteLength };
}
/* ينزّل الملفين معًا ويتحقق من كليهما؛ لا يُكتب شيء قبل نجاح الاثنين */
async function fetchPair(cacheMode) {
  const pairId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const keys = Object.keys(FILES);
  const recs = await Promise.all(keys.map(async k =>
    readVerified(k, await fetch(SCOPE + k, { cache: cacheMode, credentials: 'same-origin' }), pairId)));
  const out = {}; keys.forEach((k, i) => { out[k] = recs[i]; });
  return out;
}
let inflight = null;                               // تحديث واحد في وقت واحد
let lastGateway = null;                            // حزمة حديثة بعد زيارة البوابة (لتفادي تنزيل مزدوج في قفزة index→board)
const GATEWAY_REUSE_MS = 10000;
function refreshPair(cacheMode) {
  if (inflight) return inflight;
  inflight = (async () => {
    try { const recs = await fetchPair(cacheMode); await dbPutPair(recs); return recs; }
    finally { inflight = null; }
  })();
  return inflight;
}
function toResponse(rec) {
  return new Response(rec.body, { status: 200, headers: { 'Content-Type': rec.type || 'text/html; charset=utf-8' } });
}

/* ---------- التثبيت: حزمة كاملة أو فشل التثبيت (فتبقى النسخة السابقة) ---------- */
self.addEventListener('install', e => { e.waitUntil(refreshPair('reload')); });   // يتجاوز كاش HTTP
/* لا skipWaiting ولا clients.claim: لا يتبدّل الـ worker تحت معلّم في منتصف حصة */
self.addEventListener('activate', () => { /* لا شيء يُحذف: لا نملك كاشًا قديمًا */ });

/* ---------- الجلب ----------
   تُنزَّل الحزمة كاملة وتُتحقق قبل تسليم أي ملف منها أو تخزينها؛ فإن انقطعت الشبكة أو جاءت
   صفحة غير متوقعة (بوابة واي-فاي، 404، تنزيل مبتور) أو فشلت الكتابة تُقدَّم آخر حزمة مخزَّنة سليمة.
   لا يُقدَّم ملف من حزمة وآخر من حزمة أخرى. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const key = keyFor(req.url);
  if (!key) return;
  let fresh;
  if (key === 'board.html' && lastGateway && Date.now() - lastGateway.t < GATEWAY_REUSE_MS) {
    fresh = Promise.resolve(lastGateway.recs);     // قفزة البوابة → السبورة: لا تنزيل ثانٍ
    lastGateway = null;
  } else {
    fresh = refreshPair('no-cache');               // إعادة تحقق من الخادم (ETag) لا كاش HTTP لـ ١٠ دقائق
    if (key === 'index.html') fresh.then(recs => { lastGateway = { t: Date.now(), recs }; }, () => {});
  }
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith((async () => {
    const timeout = new Promise(r => setTimeout(() => r(null), NET_TIMEOUT_MS));
    let recs = null;
    try { recs = await Promise.race([fresh, timeout]); } catch (_) { recs = null; }
    if (recs) return toResponse(recs[key]);
    const stored = await dbGetPair().catch(() => null);
    if (stored) return toResponse(stored[key]);    // آخر حزمة سليمة
    try { return toResponse((await fresh)[key]); } // لا حزمة مخزنة: ننتظر التنزيل الكامل
    catch (_) { return fetch(req.url); }           // وإلا نُظهر ما تعيده الشبكة فعلًا
  })());
});
