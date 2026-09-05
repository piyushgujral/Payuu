/* ===================================================================
   PAYUU LIVE PLATFORM V40 - UTILITIES & SOUND MANAGER
   =================================================================== */

// Global Sound Manager Engine
class SoundManager {
    constructor() {
        this.volume = 0.8;
        this.muted = false;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, Number(vol)));
    }

    setMuted(isMuted) {
        this.muted = Boolean(isMuted);
    }

    playChime() {
        if (this.muted) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, ctx.currentTime);
            gain1.gain.setValueAtTime(0.35 * this.volume, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.8);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.15);
            gain2.gain.setValueAtTime(0.4 * this.volume, ctx.currentTime + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.15);
            osc2.stop(ctx.currentTime + 1.25);
        } catch (e) {}
    }

    playMilestoneFanfare() {
        if (this.muted) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
                gain.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.12 + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + idx * 0.12);
                osc.stop(ctx.currentTime + idx * 0.12 + 0.6);
            });
        } catch(e) {}
    }
}

window.soundManager = new SoundManager();

// Text Typing Effect Utility
window.typeTextEffect = function(element, text, speed = 40) {
    if (!element) return;
    element.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(timer);
        }
    }, speed);
};

// Number Counter Roll Utility
window.animateNumberRoll = function(element, targetNum, prefix = '₹', duration = 900) {
    if (!element) return;
    const startTime = performance.now();

    function updateNum(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(targetNum * progress);
        element.textContent = `${prefix}${current.toLocaleString()}`;
        if (progress < 1) {
            requestAnimationFrame(updateNum);
        }
    }
    requestAnimationFrame(updateNum);
};

// HTML Escaper
window.escapeHtml = function(text) {
    return text ? text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) : '';
};