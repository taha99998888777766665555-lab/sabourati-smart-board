# سجل الإصدارات المنشورة (gh-pages) وطريقة الرجوع

| الإصدار | Commit على gh-pages | المحتوى | ملاحظة |
|---|---|---|---|
| ١ — السبورة بلا عمل دون إنترنت | `bbf0e8afc519e4fa4507b2a8144aca5deb153376` | `index.html` (= السبورة المعتمدة، MD5 `12b8030494f8fe01acbd8d17376ba0c8`) + `.nojekyll` | نسخة احتياطية محفوظة أيضًا في الفرع `backup/gh-pages-pre-offline` |
| ٢ — العمل دون إنترنت (تجريبي منضبط) | `a7b64a8a1061732d6c6cc9c5d68d18389ba7959e` | `index.html` (بوابة) + `board.html` (= المعتمدة) + `sw.js` + `.nojekyll` | |

## الرجوع الفوري إلى الإصدار ١
```
git fetch origin
git checkout gh-pages
git reset --hard bbf0e8afc519e4fa4507b2a8144aca5deb153376
git push --force-with-lease origin gh-pages
```
بعد الرجوع يبقى الـ Service Worker المسجَّل في متصفحات من زاروا الإصدار ٢، وهو يستمر بتقديم آخر حزمة مخزَّنة. لإلغائه يجب نشر `sw.js` بديل يقوم بـ `self.registration.unregister()` وحذف قاعدة `sabourati-shell-v1` (يُجهَّز عند الحاجة فقط).
