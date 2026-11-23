import sys
t=open('template9.html',encoding='utf-8').read()
f=open('fonts.css',encoding='utf-8').read()
x=open('textpart.js',encoding='utf-8').read()
assert '/*FONTS*/' in t and '/*TEXTPART*/' in t
t=t.replace('/*FONTS*/',f).replace('/*TEXTPART*/',x).replace('/*ERASE*/',open('erase.js',encoding='utf-8').read()).replace('/*ERASER*/',open('eraser.js',encoding='utf-8').read())
out=sys.argv[1]
import os;os.makedirs(os.path.dirname(out),exist_ok=True)
open(out,'w',encoding='utf-8').write(t)
print(out,len(t))
