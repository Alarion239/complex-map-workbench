// (tests only) real-time drivers for the board: a human-like slider drag, a pointer on the plane, the interface
window.__drive = (() => {
  let r = 12345; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  async function scrub(secs) {
    // stop-and-go with reversals and flicks; events every 8–24 ms (a busy main thread), holds of 0.1–0.6 s
    const t0 = performance.now(); let T = __board.state().T, tgt = T, v = 0;
    while (performance.now() - t0 < secs * 1000) {
      if (Math.abs(tgt - T) < 0.035) { if (rnd() < 0.35) await sleep(100 + 500 * rnd()); tgt = rnd(); v = rnd() < 0.3 ? 3 + 3 * rnd() : 0.3 + 1.2 * rnd(); }
      const dt = 8 + 16 * rnd(); await sleep(dt);
      const step = Math.sign(tgt - T) * Math.min(Math.abs(tgt - T), v * dt / 1000); T += step; __board.scrubTo(T); T = __board.state().T;
    }
    __board.scrubEnd();
  }
  async function hover(secs) {
    // the rational map: orbit the double zero, graze the poles, a loop drawn twice around −1 (bells, then W)
    const cv = document.getElementById('planeCv'), b = cv.getBoundingClientRect(), w = cv.clientWidth;
    const toXY = (re, im) => [b.left + w / 2 + re * w / 3.6, b.top + w / 2 - im * w / 3.6];
    const fire = (type, re, im, btn) => { const [x, y] = toXY(re, im); cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: btn ? 1 : 0 })); };
    const t0 = performance.now(); let u = 0;
    while ((u = (performance.now() - t0) / 1000) < secs) {
      let z;
      if (u < secs * 0.35) { const rad = 0.08 + 0.3 * Math.abs(Math.sin(2 * u)), w2 = 1.2 + 2 * Math.sin(0.7 * u); z = [-1 + rad * Math.cos(6.28 * w2 * u * 0.5), rad * Math.sin(6.28 * w2 * u * 0.5)]; }
      else if (u < secs * 0.6) { const a = (u % 0.9) / 0.9; z = [-1.2 + 2.4 * a, (Math.floor(u / 0.9) % 2 ? 1 : -1) * (1 + 0.03 * Math.sin(9 * u))]; }
      else if (u < secs * 0.62) { z = [0.4, 0.6]; await sleep(1800); }
      else break;
      fire('pointermove', z[0], z[1], false); await sleep(10 + 12 * rnd());
    }
    // the loop: down, two turns around −1, up
    fire('pointerdown', -0.6, 0, true);
    for (let k = 0; k <= 120; k++) { const a = 2 * 6.2832 * k / 120; fire('pointermove', -1 + 0.4 * Math.cos(a), 0.4 * Math.sin(a), true); await sleep(14 + 6 * rnd()); }
    fire('pointerup', -0.6, 0, false); await sleep(1500); fire('pointerleave', 0, 0, false);
  }
  async function ui() {
    const click = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.click(); };
    document.getElementById('playBtn').click(); await sleep(2600);
    for (const t of document.querySelectorAll('.tg')) { click(t); await sleep(300); }
    click(document.getElementById('addStep')); await sleep(400); click(document.getElementById('addStep')); await sleep(400);
    click(document.querySelector('.chip button')); await sleep(400);
    for (const k of [1, 2, 3, 0]) { click(document.querySelector(`#viewSeg button[data-k="${k}"]`)); await sleep(250); }
    document.getElementById('fx').value = 'sin(z'; click(document.getElementById('apply')); await sleep(600);
    click(document.getElementById('exportBtn')); await sleep(1300);
    for (let i = 0; i < 6; i++) { click(document.querySelectorAll('.tg')[0]); await sleep(90); }
    await sleep(800);
  }
  return { scrub, hover, ui };
})();
