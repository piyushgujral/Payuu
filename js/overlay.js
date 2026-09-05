/* ====================================================
   PAYUU LIVE DASHBOARD - STREAM OVERLAY ENGINE
   ==================================================== */

const overlayQueue = [];
let isDisplayingAlert = false;
let milestoneReached = { 25: false, 50: false, 75: false, 100: false };

let siteSettings = {
    websiteName: "Payuu Live",
    streamerName: "Payuu Live",
    currencySymbol: "₹",
    goalTarget: 10000,
    overlay: {
        duration: 12,
        confetti: true,
        sound: true,
        volume: 0.8,
        animation: "bounce",
        showProgressBar: true
    },
    voice: {
        enabled: true,
        language: "en-IN",
        gender: "female",
        volumePct: 90,
        pitch: 1.2,
        rate: 1.0,
        pauseMs: 500,
        script: "🔥 New Support Received!\n\n{SupporterName} has supported the stream.\n\nAmount: {Currency}{Amount}.\n\n{Message}\n\nThank you for supporting {WebsiteName}."
    }
};

if (window.firebaseDB && window.firebaseDB.listenSettings) {
    window.firebaseDB.listenSettings((s) => {
        if (s) {
            siteSettings = { ...siteSettings, ...s };
            if (s.theme && window.themeEngine) {
                window.themeEngine.setTheme(s.theme);
            }
            if (s.overlay && window.soundManager) {
                window.soundManager.setVolume(s.overlay.volume !== undefined ? s.overlay.volume : 0.8);
                window.soundManager.setMuted(s.overlay.sound === false);
            }
        }
    });
}

function checkGoalMilestones(currentRaised, targetGoal) {
    if (!targetGoal || targetGoal <= 0) return;
    const pct = Math.min(Math.round((currentRaised / targetGoal) * 100), 100);

    const milestones = [25, 50, 75, 100];
    milestones.forEach(m => {
        if (pct >= m && !milestoneReached[m]) {
            milestoneReached[m] = true;
            triggerMilestoneCelebration(m);
        }
    });
}

function triggerMilestoneCelebration(milestonePct) {
    if (window.soundManager) window.soundManager.playMilestoneFanfare();
    try {
        confetti({
            particleCount: 120,
            spread: 100,
            origin: { y: 0.4 },
            colors: ['#FFD700', '#00F0FF', '#FF007F', '#10B981']
        });
    } catch(e) {}
}

function processNextOverlayAlert() {
    if (isDisplayingAlert || overlayQueue.length === 0) return;

    isDisplayingAlert = true;
    const currentItem = overlayQueue.shift();

    const card = document.getElementById('alert-card');
    const nameEl = document.getElementById('alert-name');
    const amountEl = document.getElementById('alert-amount');
    const msgEl = document.getElementById('alert-message');
    const goalBox = document.getElementById('overlay-goal-box');
    const goalBar = document.getElementById('overlay-goal-bar');
    const goalPctEl = document.getElementById('overlay-goal-pct');

    const sym = siteSettings.currencySymbol || "₹";

    // 1. Supporter Typing Animation & Number Roll
    if (window.typeTextEffect) window.typeTextEffect(nameEl, currentItem.name || "Anonymous", 35);
    if (window.animateNumberRoll) window.animateNumberRoll(amountEl, Number(currentItem.amount || 0), sym, 800);

    if (currentItem.msg && currentItem.msg.trim()) {
        msgEl.style.display = "block";
        msgEl.textContent = `"${currentItem.msg.trim()}"`;
    } else {
        msgEl.style.display = "none";
    }

    // 2. Play Sound Chime & Confetti
    if (window.soundManager) window.soundManager.playChime();
    if (siteSettings.overlay?.confetti !== false) {
        try {
            confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
        } catch(e){}
    }

    // 3. Goal Progress Bar in Overlay
    if (siteSettings.overlay?.showProgressBar && goalBox && goalBar) {
        goalBox.style.display = "block";
        const currentRaised = Number(currentItem.totalRaised) || Number(currentItem.amount) || 0;
        const target = Number(siteSettings.goalTarget) || 10000;
        const pct = Math.min(Math.round((currentRaised / target) * 100), 100);
        goalBar.style.width = `${pct}%`;
        if (goalPctEl) goalPctEl.textContent = `${pct}%`;

        checkGoalMilestones(currentRaised, target);
    } else if (goalBox) {
        goalBox.style.display = "none";
    }

    card.classList.remove('exiting');
    card.classList.add('active');

    // 4. Voice Speech
    if (window.voiceManagerEngine) {
        window.voiceManagerEngine.speak(currentItem, siteSettings, () => {
            console.log("Overlay Voice Speech completed.");
        });
    }

    const displayDuration = (siteSettings.overlay?.duration || 12) * 1000;

    setTimeout(() => {
        if (window.voiceManagerEngine) window.voiceManagerEngine.stop();

        card.classList.remove('active');
        card.classList.add('exiting');

        setTimeout(() => {
            if (window.firebaseDB && window.firebaseDB.removeOverlayAlert && currentItem._key) {
                window.firebaseDB.removeOverlayAlert(currentItem._key);
            }
            isDisplayingAlert = false;
            processNextOverlayAlert();
        }, 600);
    }, displayDuration);
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.firebaseDB && window.firebaseDB.listenOverlay) {
        window.firebaseDB.listenOverlay((data, key) => {
            if (data) {
                overlayQueue.push({ ...data, _key: key });
                processNextOverlayAlert();
            }
        });
    }
});