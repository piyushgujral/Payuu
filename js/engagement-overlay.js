/* ====================================================
   PAYUU LIVE - LIKE / SUBSCRIBE / SHARE OVERLAY
   Runs inside overlay.html and displays one claimed event.
   ==================================================== */
(function () {
    'use strict';

    const clientId = 'engagement-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const queue = [];
    let busy = false;

    const configs = {
        like: { icon: '❤️', title: 'LIKE THE STREAM', message: 'Smash that Like button!' },
        subscribe: { icon: '🔔', title: 'SUBSCRIBE', message: 'Subscribe and join the Payuu Live community!' },
        share: { icon: '📣', title: 'SHARE THE STREAM', message: 'Share the stream and help the community grow!' }
    };

    function createUI() {
        if (document.getElementById('payuu-engagement-alert')) return;
        const style = document.createElement('style');
        style.textContent = `
            #payuu-engagement-alert { position:fixed; left:50%; bottom:8%; transform:translate(-50%,30px) scale(.75); z-index:99999; width:min(720px,92vw); padding:26px 32px; text-align:center; border:2px solid #FFD700; border-radius:24px; background:rgba(7,25,47,.94); box-shadow:0 0 40px rgba(255,215,0,.55), inset 0 0 20px rgba(255,215,0,.12); color:#fff; opacity:0; pointer-events:none; transition:all .45s cubic-bezier(.34,1.56,.64,1); font-family:Poppins,Arial,sans-serif; }
            #payuu-engagement-alert.active { opacity:1; transform:translate(-50%,0) scale(1); }
            #payuu-engagement-icon { font-size:4.2rem; line-height:1; filter:drop-shadow(0 0 16px rgba(255,215,0,.7)); }
            #payuu-engagement-title { margin-top:12px; font:900 2rem/1.15 Orbitron,Arial,sans-serif; letter-spacing:1px; color:#FFD700; text-shadow:0 0 14px rgba(255,215,0,.5); }
            #payuu-engagement-message { margin-top:9px; font-size:1rem; color:#fff; }
            #payuu-engagement-brand { margin-top:13px; font-size:.72rem; letter-spacing:2px; color:#00F0FF; font-weight:800; text-transform:uppercase; }
            @media(max-width:600px){#payuu-engagement-alert{padding:20px}.#payuu-engagement-icon{font-size:3rem}#payuu-engagement-title{font-size:1.35rem}#payuu-engagement-message{font-size:.85rem}}
        `;
        document.head.appendChild(style);
        const box = document.createElement('div');
        box.id = 'payuu-engagement-alert';
        box.innerHTML = '<div id="payuu-engagement-icon"></div><div id="payuu-engagement-title"></div><div id="payuu-engagement-message"></div><div id="payuu-engagement-brand">PAYUU LIVE</div>';
        document.body.appendChild(box);
    }

    function claim(key) {
        if (!window.firebase || typeof firebase.database !== 'function') return Promise.resolve(false);
        const ref = firebase.database().ref('engagementQueue/' + key);
        const now = Date.now();
        return ref.transaction(current => {
            if (!current) return;
            const claimedAt = Number(current.claimedAt || 0);
            if (current.claimedBy && (now - claimedAt) <= 90000) return;
            return { ...current, claimedBy: clientId, claimedAt: now };
        }).then(result => !!result.committed).catch(() => false);
    }

    function show(item, key) {
        if (busy) { queue.push({ item, key }); return; }
        busy = true;
        const cfg = configs[item.type] || configs.like;
        const box = document.getElementById('payuu-engagement-alert');
        document.getElementById('payuu-engagement-icon').textContent = item.icon || cfg.icon;
        document.getElementById('payuu-engagement-title').textContent = item.title || cfg.title;
        document.getElementById('payuu-engagement-message').textContent = item.message || cfg.message;
        box.classList.remove('active');
        void box.offsetWidth;
        box.classList.add('active');

        try {
            if (typeof confetti === 'function') confetti({ particleCount: 90, spread: 90, origin: { y: 0.55 } });
        } catch (_) {}

        setTimeout(() => {
            box.classList.remove('active');
            setTimeout(() => {
                if (window.firebase && typeof firebase.database === 'function') {
                    firebase.database().ref('engagementQueue/' + key).remove().catch(() => {});
                }
                busy = false;
                const next = queue.shift();
                if (next) show(next.item, next.key);
            }, 500);
        }, 6000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        createUI();
        if (!window.firebase || typeof firebase.database !== 'function') {
            console.error('Payuu Engagement Overlay: Firebase is not loaded.');
            return;
        }
        firebase.database().ref('engagementQueue').on('child_added', async snap => {
            const data = snap.val();
            if (!data || !data.type) return;
            const claimed = await claim(snap.key);
            if (claimed) show(data, snap.key);
        });
    });
})();
