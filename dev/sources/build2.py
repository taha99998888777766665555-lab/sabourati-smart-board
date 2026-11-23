
import sys,os,re
# مسارات نسبية: كل القراءات من مجلد sources/ نفسه (pdf.js في sources/pdfjs/) بغض النظر عن مكان التشغيل
HERE=os.path.dirname(os.path.abspath(__file__))
out_arg=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..','build-out','smart-board-pro-merged.html')
out_arg=os.path.abspath(out_arg)
os.chdir(HERE)
t=open('template13.html',encoding='utf-8').read()
f=open('fonts.css',encoding='utf-8').read()
x=open('textpart.js',encoding='utf-8').read()
mods=''.join(open(n,encoding='utf-8').read() for n in ['m1_tools.js','m2_pages_view.js','m3_select.js','m4_text_image.js','m5_files.js','m6_teacher.js','m7_nline.js','m8_cards.js','m9_focus.js','m10_blobs.js','m10_edutools.js','m9_init.js'])
t=t.replace('/*FONTS*/',f).replace('/*TEXTPART*/',x).replace('/*ERASE*/',open('erase2.js',encoding='utf-8').read()).replace('/*ERASER*/',open('eraser_core.js',encoding='utf-8').read()).replace('/*MODS*/',mods)
exp=open('m_export.js',encoding='utf-8').read() if os.path.exists('m_export.js') else ''
t=t.replace('/*MODS2*/',exp)
pdf=open('pdfjs/pdf.min.js',encoding='utf-8').read()
wk=open('pdfjs/pdf.worker.min.js',encoding='utf-8').read()
assert '</script' not in pdf.lower() and '</script' not in wk.lower(),'script close in lib'
libs='<script type="text/plain" id="pdfjsSrc">'+pdf+'</script>\n<script type="text/plain" id="pdfjsWorker">'+wk+'</script>\n'
i=t.rindex('<script>\n(function(){')
t=t[:i]+libs+t[i:]
out=out_arg;os.makedirs(os.path.dirname(out),exist_ok=True);open(out,'w',encoding='utf-8').write(t);print(out,len(t))
