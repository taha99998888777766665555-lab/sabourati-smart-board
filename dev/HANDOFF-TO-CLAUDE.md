# Handoff — Sabourati Smart Board (سبورتي الذكية), final assembled build

This file is the single briefing needed to continue the project. Read it fully before editing anything.

## 1. What this project is

A single-file Arabic (RTL) smart-board web app for classroom touch screens, plus two approved standalone educational tools now embedded inside it. The deliverable `smart-board-pro-merged.html` is fully self-contained (fonts, pdf.js, both tools inlined) and runs offline from `file://` by double-clicking. All testing was done in local Chromium simulation only; never claim results from a real Riotouch screen.

## 2. Package layout

```
smart-board-pro-merged.html   The final assembled app (the deliverable). md5 12b8030494f8fe01acbd8d17376ba0c8
README-RUN.txt                Offline run instructions (Arabic)
TEST-REPORT.md                Final test results and known issues (Arabic)
MANIFEST.md                   md5 of every file in this package
approved-tools/
  wheel.html                  Approved interactive wheel, frozen. md5 0e4eeeb159b86d2b24499a7990eb1482
  harf-ila-jumla.html         Approved letter-to-sentence tool, frozen. md5 eaa5ed09d59e18cda06cdca8af1ab287
sources/                      Everything needed to rebuild the merged file
  build2.py                   The build script (python3, stdlib only)
  template13.html             App shell/template
  fonts.css                   Inlined fonts (Arabic)
  m1_tools.js .. m9_focus.js  App modules, concatenated by build2.py in a fixed order
  m9_init.js                  Boot/init (must stay last in the module list)
  m10_blobs.js                base64 of the two approved tools (generated, see section 5)
  m10_edutools.js             Overlay layer that opens the tools in an iframe (added in assembly)
  textpart.js erase2.js eraser_core.js meas.js meas2.js m_export.js   Inlined support modules
  pdfjs/pdf.min.js, pdf.worker.min.js   pdf.js, inlined at build time
  build-chain/                Historical per-phase templates and patch scripts (archive, not used by build2.py)
tests/
  verify_merged.js            Integration tests M0-M8 for the merged app (node + playwright)
  zt.js, zlib.js              Z regression suite (26 runs)
  t9.js                       Large simulation suite (48 ids + globals)
  shot-asm.js                 Screenshot capture (3 viewports x 3 views)
screenshots/                  Final screenshots (menu/wheel/harf x 1366x768, 1920x1080, 768x1024)
```

## 3. Build

From inside `sources/`:

```
python3 build2.py <output-path>
```

build2.py reads `../pdfjs/node_modules/pdfjs-dist/build/{pdf.min.js,pdf.worker.min.js}` relative to `sources/`. In this package those files are in `sources/pdfjs/`; either recreate that relative layout (a `pdfjs/node_modules/pdfjs-dist/build/` directory next to `sources/`, or a symlink) or adjust the two paths in build2.py. The build is deterministic: same inputs give the same md5. Never edit the built HTML by hand; edit files in `sources/` and rebuild.

## 4. Run tests

Require Node.js and Playwright (`npm i playwright` in the tests directory). All tests load the app from `file://`.

```
# Integration (env: FILE, VPW, VPH)
FILE=/path/smart-board-pro-merged.html VPW=1366 VPH=768 node verify_merged.js

# Z suite (env: FILE, ONLY=Z01,Z03,..., NOOUT=1 to skip writing results JSON)
FILE=/path/smart-board-pro-merged.html ONLY=Z01,Z02 NOOUT=1 node zt.js

# t9 suite (env: FILE must include the file:// prefix, ONLY=..., NOOUT=1)
FILE=file:///path/smart-board-pro-merged.html ONLY=U01,U02 NOOUT=1 node t9.js
```

Always test three viewports (1366x768, 1920x1080, 768x1024). Heavy tests (V01, V05, X07, X08) take 1-2 minutes each; run t9 in chunks via ONLY. X11 hangs in the sandbox — skip it.

## 5. Regenerating m10_blobs.js after editing an approved tool

Only if the owner approves a change to a tool. Edit the tool file, then from the directory containing both tool files:

```
python3 - <<'EOF'
import base64
w=base64.b64encode(open('wheel.html','rb').read()).decode()
h=base64.b64encode(open('harf-ila-jumla.html','rb').read()).decode()
open('m10_blobs.js','w',encoding='utf-8').write(
 '/* محتوى الأداتين المعتمدتين كما هو حرفيًا (base64) */\n'
 'const EDU_SRC={\nwheel:"%s",\nhj:"%s"\n};\n'%(w,h))
EOF
```

Keep the file shape (comment line, then `const EDU_SRC={wheel:"...",hj:"..."};` with double quotes) so diffs stay minimal.

Then rebuild. Integration test M0 proves the embedded blobs are byte-identical to the approved files; keep it passing.

## 6. Architecture notes that matter

- Everything runs in one IIFE inside the single HTML file; page.evaluate cannot see internals. Test hooks are exposed on `window`: `__sb` (board), `__wh` (wheel), `__hj` (letter tool), `__edu` (overlay: open/close/state/decode/src).
- The edu overlay (`m10_edutools.js`) opens each tool in a srcdoc iframe over the board. `EDU_PATCH` is a small `<style>` injected at open time that hides the tool's internal `header h1` and `.tag` (the old "standalone prototype" banner) so the overlay header is the only title. It does NOT change the embedded bytes; the blobs stay byte-identical to the approved tools.
- Teacher menu: `m6_teacher.js` has one additive section «أدوات تعليمية» before «لون السبورة» calling `openEduTool('wheel'|'hj')`.
- localStorage keys (no collisions): app `sabourati-focus-v1`, `sabourati-p2a-toolbar-v1`; wheel `wheel-v1`; letter tool `hj-content-v1`. Note: `file://` pages share one origin in Chromium, so the tools' storage persists across pages and srcdoc iframes.
- Spin tests need a non-empty wheel list; a fresh profile starts in empty names mode — switch to letters (28 default) first. `__wh.setRand` seeds the RNG for deterministic spins.

## 7. Known issues (all pre-existing in approved phase 5, not caused by the merge)

- U10, U15, X14, Y05, Y07 fail in t9 for reasons documented in earlier phase reports (same failures on frozen p5).
- X11 hangs in the sandbox; excluded from runs.
- V05 (perf-threshold test, millisecond bounds) is flaky under sandbox load: observed 1 fail / 4 runs on the merged build and 0 / 3 on p5, with same-order metrics on both (e.g. at N=5000: commitP99 1.1ms vs 0.8ms). Recorded as a note, not a merge regression. Measure on the real device before changing any performance logic.

## 8. Rules the owner set — keep them

1. The files in `approved-tools/` and the frozen phase copies are read-only reference. Never modify them; work on copies.
2. Changes to the app are additive: new code in new modules or clearly additive sections, never rewriting approved logic without the owner's written approval.
3. After any change: rebuild, re-run integration + affected regressions on all three viewports, and report the new md5.
4. Separate pre-existing failures from new ones in every report.
5. Results come from Chromium simulation; say so. No claims about the real Riotouch screen.
6. No publishing, uploading, or merging into any repository without the owner's explicit approval.
