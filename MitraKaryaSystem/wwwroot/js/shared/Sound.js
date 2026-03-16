/* ========================================================================
   MksSound – lightweight scan feedback sounds using Web Audio API
   No external files needed – tones are generated programmatically.
   Usage:  MksSound.success()   – short "beep" on successful scan
           MksSound.error()     – short "buzz" on failed scan
   ======================================================================== */
const MksSound = (function () {
    let ctx = null;

    function getCtx() {
        if (!ctx) {
            try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch (e) { return null; }
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function beep(freq, duration, type, vol) {
        const c = getCtx();
        if (!c) return;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol || 0.3, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + duration);
    }

    return {
        success: function () {
            beep(1200, 0.12, 'sine', 0.25);
            setTimeout(function () { beep(1600, 0.10, 'sine', 0.20); }, 100);
        },
        error: function () {
            beep(200, 0.20, 'square', 0.30);
            setTimeout(function () { beep(150, 0.25, 'square', 0.25); }, 180);
        }
    };
})();
