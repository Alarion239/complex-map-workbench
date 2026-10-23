#!/bin/zsh
# generate the Russian caption with the i18n module, check it, compile it with pdfLaTeX and XeLaTeX (reviews i18n-7, lead-1, lead-2)
cd "${0:A:h}" || exit 1
node gen_caption.js || exit 1
for e in pdflatex xelatex; do
  f=gen_ru_$e
  $e -interaction=nonstopmode -halt-on-error $f.tex > /dev/null 2>&1; rc=$?
  echo "$e: exit $rc, errors $(grep -c '^!' $f.log), missing characters $(grep -c 'Missing character' $f.log)"
done
node pdf_info_test.js
