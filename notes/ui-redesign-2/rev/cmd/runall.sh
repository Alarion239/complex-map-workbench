#!/bin/zsh
D="${0:A:h}"
for f in cap_desk_false cap_desk_true cap_phone_false cap_phone_true cap_sbs_false cap_sbs_true; do echo "== $f"; "$D/../../cdp-rev/q.sh" "$D/$f.js" | head -c 1500; echo; done
