import json, sys, math
W = '<project>/work/xvsea'
mode = sys.argv[1]
m = json.load(open(f'{W}/test/pitchrev_cdp/rec/mk_{mode}.json'))
SC = json.load(open(f'{W}/test/fixtures/seasong_score.json'))
SN = [s for s in SC['notes'] if not s[4]]
cues = m['cues']
strs = [c for c in cues if c['str']]
ticks = [c for c in cues if not c['str']]
print('strings', len(strs), 'ticks', len(ticks), 'sounding notes', len(SN))
# group strings by time
from collections import OrderedDict
g = OrderedDict()
for c in strs: g.setdefault(round(c['t'], 6), []).append(c)
ons = list(g.items())
print('onsets', len(ons))
mid = lambda f: 69 + 12*math.log2(f/440)
t00 = ons[0][0] - SN[0][2]
worst = 0; rows = []
for i, ((t, cs), s) in enumerate(zip(ons, SN)):
    cs = sorted(cs, key=lambda c: c['m'][0][0])
    f1 = cs[0]['m'][0][0]; written = s[5]
    cents = 100*(mid(f1) - written)
    oct_ratio = cs[1]['m'][0][0]/f1 if len(cs) > 1 else None
    a1 = sum(q[1] for q in cs[0]['m'][:1]); a2 = cs[1]['m'][0][1] if len(cs)>1 else 0
    dt = (t - t00) - s[2]; worst = max(worst, abs(dt))
    # partial cents of main string
    pc = [round(1200*math.log2(q[0]/(f1*(k+1))), 2) for k, q in enumerate(cs[0]['m'])]
    rows.append(dict(i=i, t=round(t-t00,4), score=s[2], name=(s[6] or ['C','C#','D','D#','E','E#','F#','G','G#','A','A#','B'][s[5]%12]+str(s[5]//12-1)+'*'), midi=written, cents=round(cents,2), octRatio=oct_ratio, dblDb=round(20*math.log10(a2/cs[0]['m'][0][1]),1) if a2 else None, g=[c['g'] for c in cs], cap=cs[0]['cap'], partialCents=pc, nstr=len(cs)))
cc = [r['cents'] for r in rows]
print('cents vs written: min %.2f max %.2f mean %.2f' % (min(cc), max(cc), sum(cc)/len(cc)))
print('oct ratios', min(r['octRatio'] for r in rows), max(r['octRatio'] for r in rows))
print('dbl dB (octave string fundamental amp vs main fundamental amp)', sorted(set(r['dblDb'] for r in rows))[:5], '...', sorted(set(r['dblDb'] for r in rows))[-5:])
print('worst sched vs score ms', round(1000*worst, 2))
print('partial cents example', rows[0]['partialCents'], rows[0]['name'])
print('names played:', ' '.join(r['name'] for r in rows))
# repeated same-midi within ring window: detune differences
json.dump(rows, open(f'<tmp>', 'w'))
print('ticks', [(round(c['t']-t00,4), round(c['g'],3), len(c['m']), c['m'][:3]) for c in ticks])
print('tick score', SC['ticks'])
# simultaneous same-pitch strings: for each onset, earlier strings with same freq within 4 notes (cap)
same = []
for i, r in enumerate(rows):
    for j in range(max(0, i-3), i):
        if rows[j]['midi'] == r['midi']:
            same.append((rows[j]['name'], round(r['t']-rows[j]['t'],3), round(r['cents']-rows[j]['cents'],2)))
        if rows[j]['midi'] == r['midi'] + 12 or rows[j]['midi'] + 12 == r['midi']:
            same.append(('oct', rows[j]['name'], r['name'], round(r['cents']-rows[j]['cents'],2)))
print('same-pitch / octave re-strikes within 4 notes:', len(same)); print(same[:40])
