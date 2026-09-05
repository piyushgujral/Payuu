/* ====================================================
   PAYUU LIVE - ENGAGEMENT OVERLAY CONTROLS
   Like / Subscribe / Share trigger panel for Admin
   Uses the existing overlayQueue Firebase path so it
   works with the database rules already used by Payuu.
   ==================================================== */
(function () {
    'use strict';

    const EVENTS = {
        like: {
            icon: '❤️',
            title: 'LIKE THE STREAM',
            message: 'If you are enjoying the stream, smash that Like button!'
        },
        subscribe: {
            icon: '🔔',
            title: 'SUBSCRIBE',
            message: 'Subscribe to Payuu Live and join the community!'
        },
        share: {
            icon: '📣',
            title: 'SHARE THE STREAM',
            message: 'Share the stream with your friends and help the community grow!'
        }
    };

    function getFirebaseDatabase() {
        try {
            if (window.firebase && typeof firebase.database === 'function') {
                return firebase.database();
            }
        } catch (error) {
            console.error('Payuu Engagement: Firebase database unavailable.', error);
        }
        return null;
    }

    function triggerEngagement(type) {
        const config = EVENTS[type];
        const db = getFirebaseDatabase();

        if (!config || !db) {
            alert('Firebase is not connected. Please refresh and try again.');
            return;
        }

        const currentAdmin = window.PayuuAdminState || {};
        const adminEmail = currentAdmin.email || 'Admin';
        const ref = db.ref('overlayQueue').push();

        const payload = {
            id: ref.key,
            eventType: 'engagement',
            type,
            icon: config.icon,
            title: config.title,
            message: config.message,
            triggeredBy: adminEmail,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        const button = document.querySelector(`[data-engagement="${type}"]`);
        if (button) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '✓ SENT';
        }

        ref.set(payload)
            .then(() => {
                console.log('Payuu Engagement sent:', type, ref.key);
                if (button) {
                    setTimeout(() => {
                        button.disabled = false;
                        button.innerHTML = button.dataset.originalText || config.title;
                    }, 1200);
                }
            })
            .catch(error => {
                console.error('Payuu Engagement trigger failed:', error);
                if (button) {
                    button.disabled = false;
                    button.innerHTML = button.dataset.originalText || config.title;
                }
                alert(`Unable to send engagement overlay. ${error?.message || 'Firebase permission denied.'}`);
            });
    }

    function createControls() {
        if (document.getElementById('payuu-engagement-controls')) return;

        const adminPanel = document.getElementById('admin-panel');
        if (!adminPanel) return;

        const box = document.createElement('div');
        box.id = 'payuu-engagement-controls';
        box.className = 'payuu-engagement-controls';
        box.innerHTML = `
            <div class="payuu-engagement-title">
                <span>📣</span> STREAM ENGAGEMENT OVERLAY
            </div>
            <div class="payuu-engagement-subtitle">
                Trigger a Like, Subscribe or Share animation on the OBS overlay.
            </div>
            <div class="payuu-engagement-buttons">
                <button type="button" class="payuu-engagement-btn like" data-engagement="like">❤️ LIKE</button>
                <button type="button" class="payuu-engagement-btn subscribe" data-engagement="subscribe">🔔 SUBSCRIBE</button>
                <button type="button" class="payuu-engagement-btn share" data-engagement="share">📣 SHARE</button>
            </div>
            <div class="payuu-engagement-note">
                The OBS Browser Source is the primary display. Each event is claimed once so extra browser previews do not duplicate the alert.
            </div>
        `;

        const firstTabContent = document.getElementById('tab-content-queue');
        if (firstTabContent) {
            firstTabContent.insertBefore(box, firstTabContent.firstChild);
        } else {
            adminPanel.insertBefore(box, adminPanel.firstChild);
        }

        box.querySelectorAll('[data-engagement]').forEach(button => {
            button.addEventListener('click', () => triggerEngagement(button.dataset.engagement));
        });
    }

    function addStyles() {
        if (document.getElementById('payuu-engagement-admin-style')) return;

        const style = document.createElement('style');
        style.id = 'payuu-engagement-admin-style';
        style.textContent = `
            .payuu-engagement-controls { margin:0 0 18px; padding:16px; border:1px solid rgba(255,215,0,.35); border-radius:16px; background:linear-gradient(135deg,rgba(255,215,0,.08),rgba(0,240,255,.05)); box-shadow:0 0 22px rgba(255,215,0,.08); }
            .payuu-engagement-title { font-weight:900; letter-spacing:1px; color:#FFD700; font-size:.92rem; }
            .payuu-engagement-subtitle { color:#A0B3C6; font-size:.72rem; margin:5px 0 12px; }
            .payuu-engagement-buttons { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; }
            .payuu-engagement-btn { border:1px solid rgba(255,255,255,.2); border-radius:12px; padding:12px 8px; color:#fff; background:rgba(255,255,255,.06); cursor:pointer; font-weight:800; font-size:.78rem; transition:transform .15s ease,background .15s ease; }
            .payuu-engagement-btn:hover { transform:translateY(-2px); background:rgba(255,255,255,.12); }
            .payuu-engagement-btn:disabled { opacity:.65; cursor:wait; transform:none; }
            .payuu-engagement-btn.like { border-color:rgba(255,0,127,.55); }
            .payuu-engagement-btn.subscribe { border-color:rgba(255,215,0,.55); }
            .payuu-engagement-btn.share { border-color:rgba(0,240,255,.55); }
            .payuu-engagement-note { margin-top:9px; color:#71869b; font-size:.63rem; line-height:1.4; }
            @media(max-width:600px){ .payuu-engagement-buttons{grid-template-columns:1fr;} }
        `;
        document.head.appendChild(style);
    }

    function waitForAdmin() {
        if (!window.firebaseDB || typeof window.firebaseDB.onAuthStateChanged !== 'function') {
            setTimeout(waitForAdmin, 300);
            return;
        }

        window.firebaseDB.onAuthStateChanged(user => {
            if (!user) return;
            window.firebaseDB.checkAdminStatus(user.email, adminRecord => {
                if (!adminRecord || adminRecord.active !== true) return;
                window.PayuuAdminState = adminRecord;
                createControls();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        addStyles();
        waitForAdmin();
    });
})();
