/* PAYUU LIVE - SINGLE MEDIA ENGAGEMENT OVERLAY */
(function () {
    'use strict';

    const TYPES = {
        like: { icon: '❤️', title: 'LIKE THE STREAM', message: 'Smash that Like button!' },
        subscribe: { icon: '🔔', title: 'SUBSCRIBE', message: 'Subscribe to Payuu Live and join the community!' },
        share: { icon: '📣', title: 'SHARE THE STREAM', message: 'Share the stream and help the community grow!' }
    };

    const queue = [];
    let busy = false;
    let activeTimer = null;
    let engagementListenerStarted = false;

    function removeStrayText() {
        try {
            const walker = document.createTreeWalker(document.body || document, NodeFilter.SHOW_TEXT);
            const remove = [];
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && node.nodeValue.includes('window.payuuEngagementShow')) remove.push(node);
            }
            remove.forEach(n => n.parentNode && n.parentNode.removeChild(n));
        } catch (_) {}
    }

    function createUI() {
        if (document.getElementById('payuu-engagement-media')) return;

        const style = document.createElement('style');
        style.id = 'payuu-engagement-media-style';
        style.textContent = `
          #payuu-engagement-media{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99999;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .35s ease,visibility .35s ease}
          #payuu-engagement-media.active{opacity:1;visibility:visible}
          .payuu-engagement-media-inner{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;max-width:90vw;max-height:90vh;text-align:center}
          .payuu-engagement-media-asset{display:block;max-width:90vw;max-height:72vh;object-fit:contain;filter:drop-shadow(0 0 25px rgba(255,215,0,.55));border-radius:18px}
          video.payuu-engagement-media-asset{background:transparent}
          .payuu-engagement-media-title{margin-top:12px;padding:8px 18px;border-radius:999px;background:rgba(7,25,47,.88);border:1px solid #FFD700;color:#FFD700;font:900 1.5rem/1.1 Orbitron,Arial,sans-serif;text-shadow:0 0 12px rgba(255,215,0,.45)}
          .payuu-engagement-media-message{margin-top:6px;color:#fff;font:700 .9rem Poppins,Arial,sans-serif;text-shadow:0 2px 8px #000}
          @media(max-width:600px){.payuu-engagement-media-asset{max-width:94vw;max-height:65vh}.payuu-engagement-media-title{font-size:1.1rem}.payuu-engagement-media-message{font-size:.75rem}}
        `;
        document.head.appendChild(style);

        const box = document.createElement('div');
        box.id = 'payuu-engagement-media';
        box.innerHTML = `<div class="payuu-engagement-media-inner"><div id="payuu-engagement-media-slot"></div><div id="payuu-engagement-media-title" class="payuu-engagement-media-title"></div><div id="payuu-engagement-media-message" class="payuu-engagement-media-message"></div><audio id="payuu-engagement-media-audio" preload="auto"></audio></div>`;
        document.body.appendChild(box);
    }

    function parseEvent(data) {
        const msg = String(data?.msg || '');
        const match = msg.match(/^\[\[PAYUU_ENGAGEMENT:(like|subscribe|share)\]\]\s*/i);
        if (!match && data?.eventType !== 'engagement') return null;
        const type = String(data?.engagementType || match?.[1] || 'like').toLowerCase();
        return {
            type,
            message: match ? msg.slice(match[0].length).trim() : String(data?.message || ''),
            mediaUrl: data?.engagementMediaUrl || data?.engagementGifUrl || '',
            mediaType: data?.engagementMediaType || '',
            soundUrl: data?.engagementSoundUrl || '',
            duration: Math.max(1, Math.min(30, Number(data?.engagementDuration || 6))),
            volume: Math.max(0, Math.min(1, Number(data?.engagementVolume ?? 1)))
        };
    }

    function clearMedia() {
        const slot = document.getElementById('payuu-engagement-media-slot');
        const audio = document.getElementById('payuu-engagement-media-audio');
        if (slot) slot.innerHTML = '';
        if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }

    function render(item) {
        const event = parseEvent(item.data);
        if (!event) return false;
        if (busy) { queue.push(item); return true; }

        createUI();
        const box = document.getElementById('payuu-engagement-media');
        const slot = document.getElementById('payuu-engagement-media-slot');
        const title = document.getElementById('payuu-engagement-media-title');
        const message = document.getElementById('payuu-engagement-media-message');
        const audio = document.getElementById('payuu-engagement-media-audio');
        if (!box || !slot) { queue.push(item); return true; }

        busy = true;
        clearMedia();
        const cfg = TYPES[event.type] || TYPES.like;
        title.textContent = cfg.title;
        message.textContent = event.message || cfg.message;

        if (event.mediaUrl) {
            const type = (event.mediaType || '').toLowerCase();
            if (type === 'video/mp4' || /\.mp4(?:\?|$)/i.test(event.mediaUrl)) {
                const video = document.createElement('video');
                video.className = 'payuu-engagement-media-asset';
                video.src = event.mediaUrl;
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true;
                video.controls = false;
                slot.appendChild(video);
                video.play().catch(() => {});
            } else {
                const img = document.createElement('img');
                img.className = 'payuu-engagement-media-asset';
                img.src = event.mediaUrl;
                img.alt = cfg.title;
                slot.appendChild(img);
            }
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'payuu-engagement-media-title';
            fallback.style.fontSize = '4rem';
            fallback.textContent = cfg.icon;
            slot.appendChild(fallback);
        }

        if (event.soundUrl) {
            audio.src = event.soundUrl;
            audio.volume = event.volume;
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }

        box.classList.remove('active');
        void box.offsetWidth;
        box.classList.add('active');
        try { if (typeof confetti === 'function') confetti({ particleCount: 90, spread: 90, origin: { y: .55 } }); } catch (_) {}

        clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
            box.classList.remove('active');
            setTimeout(() => {
                clearMedia();
                busy = false;
                const next = queue.shift();
                if (next) render(next);
            }, 350);
        }, event.duration * 1000);
        return true;
    }

    function listenEngagementQueue() {
        if (engagementListenerStarted) return;
        if (!window.firebaseDB || typeof window.firebaseDB.ref !== 'function') return;
        engagementListenerStarted = true;
        window.firebaseDB.ref('engagementQueue').limitToLast(20).on('child_added', snap => {
            const data = snap.val();
            if (!data || data.eventType !== 'engagement') return;
            render({ data, key: snap.key });
            // Remove after the event has been received so it cannot replay on refresh.
            snap.ref.remove().catch(() => {});
        });
    }

    window.payuuEngagementShow = function (data, key) { return render({ data, key }); };

    document.addEventListener('DOMContentLoaded', () => {
        removeStrayText();
        createUI();
        listenEngagementQueue();
        const pending = queue.splice(0);
        pending.forEach(render);
    });

    function waitForFirebase() {
        if (window.firebaseDB && typeof window.firebaseDB.ref === 'function') {
            listenEngagementQueue();
            return;
        }
        setTimeout(waitForFirebase, 300);
    }
    waitForFirebase();
    setTimeout(removeStrayText, 100);
})();
