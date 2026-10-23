# Review measurements (notes/sound/review-sound.md). Usage, with a CDP kit copy whose parent dir has a wav/ folder:
#   q.sh render_cues.js; q.sh render_voices.js; q.sh guards.js   (renders raw float32 stereo 48 kHz into ../wav)
#   python3 analyse.py <wav dir> cues|voice|glide|sim|hsweep ; python3 room_tail.py <wav dir>
# Loudness: BS.1770 K-weighting, max momentary (400 ms). Phone model: 4th-order Butterworth HP at 550 Hz; laptop: 250 Hz.
import numpy as np, os, sys, glob
D = sys.argv[1]; fs = 48000
def load(n):
    a = np.fromfile(os.path.join(D, n + '.f32'), dtype=np.float32).reshape(-1, 2).astype(np.float64)
    return a
def biquad_H(b, a, f):
    z = np.exp(-1j * 2 * np.pi * f / fs)
    return (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
# BS.1770 K-weighting (48 kHz coefficients)
K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
K2 = ([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621])
def hp(fc, q):
    w = 2 * np.pi * fc / fs; al = np.sin(w) / (2 * q); c = np.cos(w)
    return ([(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al])
def filt(x, sections):
    n = len(x); N = 1 << int(np.ceil(np.log2(n + 4096)))
    X = np.fft.rfft(x, N, axis=0); f = np.fft.rfftfreq(N, 1 / fs); H = np.ones_like(f, dtype=complex)
    for b, a in sections: H *= biquad_H(b, a, f)
    return np.fft.irfft(X * H[:, None], N, axis=0)[:n]
KW = [K1, K2]
LAPTOP = [hp(250, 0.541), hp(250, 1.307)]   # 4th-order Butterworth HP at 250 Hz
PHONE = [hp(550, 0.541), hp(550, 1.307)]    # 4th-order Butterworth HP at 550 Hz
def lufs_m(x, win=0.4):
    # max momentary loudness (BS.1770, 400 ms window, 10 ms hop), stereo sum
    p = (x ** 2).sum(axis=1); w = int(win * fs); c = np.concatenate([[0], np.cumsum(p)])
    if len(p) < w: return -0.691 + 10 * np.log10(c[-1] / w + 1e-30)
    m = (c[w:] - c[:-w])[::480] / w
    return -0.691 + 10 * np.log10(m.max() + 1e-30)
def centroid(x):
    m = x.mean(axis=1); S = np.abs(np.fft.rfft(m)) ** 2; f = np.fft.rfftfreq(len(m), 1 / fs)
    return (S * f).sum() / S.sum()
def dur40(x):
    a = np.abs(x).max(axis=1); pk = a.max(); i = np.where(a > pk * 0.01)[0]
    return (i[-1] - int(0.01 * fs)) / fs if len(i) else 0
if sys.argv[2] == 'cues':
    names = sorted(set(os.path.basename(f)[:-9] for f in glob.glob(os.path.join(D, '*_full.f32'))))
    order = ['snap_x','toggleOn_x','toggleOff_x','stepAdd_x','stepRemove_x','view_k0','view_k1','view_k2','exportDone_x','error_x','cut_x','zero_order1','zero_order2','zero_order3','pole_order1','pole_order2','preFound_x','preLost_x','contour_k-6','contour_k0','contour_k3','contour_k8','morphStart_x','morphTick_t0','morphTick_t0.5','morphTick_t1','morphEnd_x','turn_dir1','turn_dir-1']
    print(f"{'cue':16s} {'peak':>6s} {'LUFSm':>6s} {'Kw50':>6s} {'lap':>6s} {'phone':>6s} {'ph-K':>5s} {'cent':>6s} {'d40':>5s} {'DRR':>6s} {'pan0+':>6s}")
    for n in order:
        if n not in names: continue
        x = load(n + '_full'); d = load(n + '_dry'); pn = load(n + '_pan')
        pk = 20 * np.log10(np.abs(x).max())
        xk = filt(x, KW); L = lufs_m(xk); L50 = lufs_m(xk, 0.05)
        Llap = lufs_m(filt(x, KW + LAPTOP)); Lph = lufs_m(filt(x, KW + PHONE))
        wet = x - d; drr = 10 * np.log10((d ** 2).sum() / max((wet ** 2).sum(), 1e-30))
        panloss = 10 * np.log10((pn ** 2).sum() / (x ** 2).sum())
        print(f"{n:16s} {pk:6.1f} {L:6.1f} {L50:6.1f} {Llap:6.1f} {Lph:6.1f} {Lph-L:5.1f} {centroid(x):6.0f} {dur40(x)*1000:5.0f} {drr:6.1f} {panloss:6.2f}")
if sys.argv[2] == 'voice':
    print('Shepard voice, rising 0.5 turn/s, pan 0 (through its panner):')
    for la in [-8, -4, -2, -1, 0, 1, 2, 4, 8]:
        x = load(f'voice_la{la}')[int(0.3*fs):int(3.0*fs)]
        xk = filt(x, KW)
        # loudness over the steady part
        Lint = -0.691 + 10*np.log10((xk**2).sum(axis=1).mean())
        Lph = -0.691 + 10*np.log10((filt(x, KW+PHONE)**2).sum(axis=1).mean())
        rms = 10*np.log10((x**2).mean(axis=0).sum()/2)
        print(f'  ln|F| = {la:3d}: RMS/ch {rms:6.1f} dBFS  integrated {Lint:6.1f} LUFS  phone {Lph:6.1f}  centroid {centroid(x):6.0f} Hz  peak {20*np.log10(np.abs(x).max()):6.1f}')
    a = load('voice_la0')[int(0.3*fs):int(3.0*fs)]; b = load('curve_la0')[int(0.3*fs):int(3.0*fs)]
    la_ = -0.691 + 10*np.log10((filt(a, KW)**2).sum(axis=1).mean()); lb = -0.691 + 10*np.log10((filt(b, KW)**2).sum(axis=1).mean())
    print(f'live voice ln|F|=0: {la_:.1f} LUFS; listen-along buffer same F: {lb:.1f} LUFS; difference {lb-la_:+.1f} dB')
    vb = load('voice_bell'); vo = load('voice_only_ref'); bell = vb - vo
    print('turn bell alone peak', 20*np.log10(np.abs(bell).max()), 'max LUFS-M', lufs_m(filt(bell, KW)), ' voice LUFS-M', lufs_m(filt(vo, KW)))
    # band energies around the bell's partials in the 150 ms after onset
    s0, s1 = int(1.5*fs), int(1.65*fs)
    def band(x, lo, hi):
        m = x[s0:s1].mean(axis=1) * np.hanning(s1-s0); S = np.abs(np.fft.rfft(m, 1<<15))**2; f = np.fft.rfftfreq(1<<15, 1/fs)
        return 10*np.log10(S[(f>=lo)&(f<hi)].sum()+1e-30)
    for lo, hi, nm in [(1080, 1280, 'D6 band'), (1620, 1900, 'A6 band'), (480, 650, 'voice ~C5 band')]:
        print(f'  {nm}: bell {band(bell, lo, hi):6.1f} dB, voice {band(vo, lo, hi):6.1f} dB')
    # where are the voice partials at t = 1.5 s? phi = 0.5*1.4 = 0.7 -> partials at 32.7*2^(k+0.7)
    print('  voice partials at 1.5 s:', [round(32.7032*2**(k+0.7)) for k in range(3, 7)])
if sys.argv[2] == 'glide':
    for rate in [1, 4, 12]:
        for kind in ['tau', 'lin']:
            x = load(f'glide_{kind}_{rate}')[:, 0]
            N = len(x); X = np.fft.fft(x); h = np.zeros(N); h[0] = 1; h[1:N//2] = 2; h[N//2] = 1
            z = np.fft.ifft(X * h); ph = np.unwrap(np.angle(z)); f = np.diff(ph) * fs / (2*np.pi)
            t = (np.arange(len(f)) + 0.5) / fs
            # ideal: 500 * 2^(rate*0.25 * (t - 0.1)) (lin is ahead by one frame; tau lags ~12 ms) -- compare the cents velocity
            cents = 1200*np.log2(np.maximum(f, 1))
            seg = (t > 0.25) & (t < (0.6 if rate == 12 else 1.9))
            c = cents[seg]; tt = t[seg]
            # smooth the 1-sample IF noise with a 2 ms boxcar, then remove the best linear fit
            k = int(0.002*fs); cs = np.convolve(c, np.ones(k)/k, mode='same')[k:-k]; ts = tt[k:-k]
            p = np.polyfit(ts, cs, 1); r = cs - np.polyval(p, ts)
            # 60 Hz component of the residual
            R = np.abs(np.fft.rfft(r * np.hanning(len(r)))); fr = np.fft.rfftfreq(len(r), 1/fs)
            i60 = np.argmin(abs(fr - 60))
            print(f'  {kind:3s} rate {rate*0.25:5.2f} oct/s: slope {p[0]:7.1f} c/s, residual ripple p-p {r.max()-r.min():5.1f} cents, rms {r.std():5.2f} cents')
if sys.argv[2] == 'height':
    x = load('height_sweep')[:, 0]
    N = len(x); X = np.fft.fft(x); h = np.zeros(N); h[0] = 1; h[1:N//2] = 2; h[N//2] = 1
    for la in [-6, -4, -2, -1, 0, 1, 2, 4, 6]:
        f = 440*2**(1.5*np.tanh(la/3)); print(f'  ln|F| {la:3d}: height tone {f:7.1f} Hz')
if sys.argv[2] == 'sim':
    order = ['snap_x','toggleOn_x','toggleOff_x','stepAdd_x','stepRemove_x','view_k0','exportDone_x','error_x','cut_x','zero_order1','pole_order1','preFound_x','preLost_x','contour_k3','morphStart_x','morphTick_t1','morphEnd_x','turn_dir1','turn_dir-1']
    edges = 100 * 2 ** (np.arange(0, 6.4, 1/6)); hop = int(0.01*fs); win = 1024
    def feat(n):
        x = load(n + '_dry').mean(axis=1)[int(0.01*fs):int(0.61*fs)]
        F = []
        for s in range(0, len(x) - win, hop):
            S = np.abs(np.fft.rfft(x[s:s+win] * np.hanning(win)))**2; f = np.fft.rfftfreq(win, 1/fs)
            F.append([S[(f >= edges[i]) & (f < edges[i+1])].sum() + 1e-20 for i in range(len(edges)-1)])
        F = 10*np.log10(np.array(F)); F = np.maximum(F, F.max() - 50) - (F.max() - 50)
        return F[:45]   # first 450 ms
    fe = {n: feat(n) for n in order}
    def sim(a, b):
        A, B = fe[a].ravel(), fe[b].ravel(); return (A @ B) / np.sqrt((A @ A) * (B @ B))
    pairs = sorted(((sim(a, b), a, b) for i, a in enumerate(order) for b in order[i+1:]), reverse=True)
    for s, a, b in pairs[:12]: print(f'  {s:.3f}  {a:14s} {b}')
if sys.argv[2] == 'hsweep':
    x = load('height_sweep')
    for la in [-6, -4, -2, 0, 2, 4, 6]:
        t = 0.1 + (la + 6) / 3; seg = x[int((t-0.15)*fs):int((t+0.15)*fs)]
        L = -0.691 + 10*np.log10((filt(seg, KW)**2).sum(axis=1).mean()); Lp = -0.691 + 10*np.log10((filt(seg, KW+PHONE)**2).sum(axis=1).mean())
        f = 440*2**(1.5*np.tanh(la/3))
        print(f'  ln|F| {la:3d}: {f:6.0f} Hz  {L:6.1f} LUFS  phone {Lp:6.1f}')
