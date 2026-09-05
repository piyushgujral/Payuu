/* ====================================================
   PAYUU LIVE - LIKE / SUBSCRIBE / SHARE OVERLAY
   Renderer for engagement events coming through overlayQueue.
   ==================================================== */
(function () {
    'use strict';

    const CONFIGS = {
        like: { icon: '❤️', title: 'LIKE THE STREAM', message: 'Smash that Like button!' },
        subscribe: { icon: '🔔', title: 'SUBSCRIBE', message: 'Subscribe to Payuu Live and join the community!' },
        share: { icon: '📣', title: 'SHARE THE STREAM', message: 'Share the stream and help the community grow!' }
    };

    const queue = [];
    let busy = false;

    function createUI() {
        if (document.getElementById('payuu-engagement-alert')) return;

        const style = document.createElement('style');
        style.textContent = `
            #payuu-engagement-alert { position:fixed; left:50%; bottom:8%; transform:translate(-50%,30px) scale(.75); z-index:99999; width:min(720px,92vw); padding:26px 32px; text-align:center; border:2px solid #FFD700; border-radius:24px; background:rgba(7,25,47,.94); box-shadow:0 0 40px rgba(255,215,0,.55),inset 0 0 20px rgba(255,215,0,.12); color:#fff; opacity:0; pointer-events:none; transition:all .45s cubic-bezier(.34,1.56,.64,1); font-family:Poppins,Arial,sans-serif; }
            #payuu-engagement-alert.active { opacity:1; transform:translate(-50%,0) scale(1); }
            #payuu-engagement-icon { font-size:4.2rem; line-height:1; filter:drop-shadow(0 0 16px rgba(255,215,0,.7)); }
            #payuu-engagement-title { margin-top:12px; font:900 2rem/1.15 Orbitron,Arial,sans-serif; letter-spacing:1px; color:#FFD700; text-shadow:0 0 14px rgba(255,215,0,.5); }
            #payuu-engagement-message { margin-top:9px; font-size:1rem; color:#fff; }
            #payuu-engagement-brand { margin-top:13px; font-size:.72rem; letter-spacing:2px; color:#00F0FF; font-weight:800; text-transform:uppercase; }
            @media(max-width:600px){#payuu-engagement-alert{padding:20px}#payuu-engagement-icon{font-size:3rem}#payuu-engagement-title{font-size:1.35rem}#payuu-engagement-message{font-size:.85rem}}
        `;
        document.head.appendChild(style);

        const box = document.createElement('div');
        box.id = 'payuu-engagement-alert';
        box.innerHTML = '<div id="payuu-engagement-icon"></div><div id="payuu-engagement-title"></div><div id="payuu-engagement-message"></div><div id="payuu-engagement-brand">PAYUU LIVE</div>';
        document.body.appendChild(box);
    }

    function render(data, key) {
        const source = String(data?.messageSource || '');
        if (!source.startsWith('engagement_')) return false;

        const type = source.slice('engagement_'.length);
        const cfg = CONFIGS[type] || CONFIGS.like;

        if (busy) {
            queue.push({ data, key });
            return true;
        }

        const box = document.getElementById('payuu-engagement-alert');
        if (!box) {
            queue.push({ data, key });
            return true;
        }

        busy = true;

        document.getElementById('payuu-engagement-icon').textContent = cfg.icon;
        document.getElementById('payuu-engagement-title').textContent = cfg.title;
        document.getElementById('payuu-engagement-message').textContent = cfg.message;

        box.classList.remove('active');
        void box.offsetWidth;
        box.classList.add('active');

        try {
            if (typeof confetti === 'function') {
                confetti({ particleCount: 90, spread: 90, origin: { y: 0.55 } });
            }
        } catch (_) {}

        setTimeout(() => {
            box.classList.remove('active');

            setTimeout(() => {
                if (key && window.firebaseDB && typeof window.firebaseDB.removeOverlayAlert === 'function') {
                    window.firebaseDB.removeOverlayAlert(key).catch(() => {});
                }

                busy = false;
                const next = queue.shift();
                if (next) render(next.data, next.key);
            }, 500);
        }, 6000);

        return true;
    }

    window.payuuEngagementShow = render;

    document.addEventListener('DOMContentLoaded', () => {
        createUI();
        const pending = queue.splice(0);
        pending.forEach(item => render(item.data, item.key));
    });
})();
