import numpy as np, os, sys
D = sys.argv[1]; fs = 48000
ld = lambda n: np.fromfile(os.path.join(D, n + '.f32'), dtype=np.float32).reshape(-1, 2).astype(np.float64)
for n in ['zero_order1', 'exportDone_x', 'turn_dir1', 'morphEnd_x', 'pole_order1']:
    x, d = ld(n + '_full'), ld(n + '_dry'); w = x - d
    env = lambda s: np.sqrt(np.convolve((s**2).sum(axis=1), np.ones(480)/480, mode='same'))
    ed, ew = env(d), env(w); pk = ed.max()
    first = np.where(ew > ed)[0]; first = [i for i in first if ed[i] > 0 or ew[i] > pk*1e-4]
    t_cross = (first[0]/fs - 0.01) if first else None
    lvl_at = lambda t: 20*np.log10(ew[int((t+0.01)*fs)]/pk + 1e-12)
    print(f'{n:14s} wet peak re dry peak {20*np.log10(ew.max()/pk):6.1f} dB; wet rises above dry at {t_cross if t_cross is None else round(t_cross,3)} s, where the wet is {lvl_at(t_cross) if t_cross else float("nan"):6.1f} dB re dry peak')
