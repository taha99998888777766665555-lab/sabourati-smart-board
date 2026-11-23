# ملاحظات إصلاح المسارات (نسخة عمل — لم يُمسّ HTML ولا الوحدات)

بصمة الملف الناتج: 12b8030494f8fe01acbd8d17376ba0c8 (مطابقة للمعتمدة، تُبنى من أي مجلد).

- `sources/build2.py`: كل المسارات نسبية لموقع الملف نفسه؛ الناتج الافتراضي `build-out/smart-board-pro-merged.html` أو أول وسيط في سطر الأوامر؛ مكتبة pdf.js من `sources/pdfjs/`.
- `tests/zlib.js` و`zt.js` و`t9.js` و`verify_merged.js` و`shot-asm.js`: الملف الافتراضي هو `smart-board-pro-merged.html` في جذر الحزمة؛ `FILE` يتجاوزه؛ النتائج في `tests/results/`؛ التنزيلات المؤقتة في مجلد النظام المؤقت.
- جديد: `tests/fixtures/phase1-draw-test.html` (يحتاجه M06 فقط) و`tests/package.json`.
- لا اعتماد على /tmp/sbp-assembly ولا /mnt/user-data.

التشغيل: `cd tests && NODE_PATH=<مسار playwright> node verify_merged.js` (وكذلك zt.js وt9.js وshot-asm.js).

نتائج التشغيل من داخل الحزمة: verify_merged ٩/٩ على ٣ مقاسات؛ Z ٢٦/٢٦؛ t9 (الفرعي): M06 وU01 وX11 ناجحة؛ U10/U15/X14/Y05/Y07 كما هي (انظر STEP2-FINDINGS.md).

## الملفات المتغيرة عن الحزمة المستلَمة
- `sources/build2.py` (مسارات)
- `tests/zlib.js`, `tests/zt.js`, `tests/verify_merged.js`, `tests/shot-asm.js` (مسارات)
- `tests/t9.js` (مسارات + تحديث U10 وU15 وY05)
- جديد: `tests/fixtures/phase1-draw-test.html`, `tests/package.json`, `PATH-FIX-NOTES.md`, `STEP2-FINDINGS.md`
- لم يتغير: `smart-board-pro-merged.html` (12b8030494f8fe01acbd8d17376ba0c8) وكل وحدات `sources/` الأخرى و`approved-tools/`.
