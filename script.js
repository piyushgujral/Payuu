/* ====================================================
   PAYUU LIVE DASHBOARD - MASTER JAVASCRIPT ENGINE
   Connected to Firebase Realtime Database & Auth
   ==================================================== */

const STATUS = {
    AWAITING_PAYMENT: "Awaiting Payment",
    AWAITING_VERIFICATION: "Awaiting Verification",
    APPROVED: "Approved",
    REJECTED: "Rejected"
};

const DEFAULT_SETTINGS = {
    websiteName: "Payuu Live",
    streamerName: "Payuu Live",
    tagline: "Every contribution helps upgrade the stream, improve the gaming setup, and create better content for the community. Thank you for being part of the journey! ❤️🎮",
    logoUrl: "assets/images/logo.png",
    faviconUrl: "assets/images/favicon.png",
    
    upiId: "payalgupta545757-1@okicici",
    qrCodeUrl: "",
    suggestedAmounts: [40, 50, 100, 250, 500, 1000],
    minAmount: 40,
    maxAmount: 50000,
    
    goalTarget: 10000,
    goalTitle: "Monthly Goal",
    currencySymbol: "₹",
    thankYouMessage: "Your payment request has been submitted. Please wait while Payuu verifies your payment.",
    fallbackMessage: "Supported the stream!",
    
    socials: {
        kick: "https://kick.com/payuu-25",
        instagram: "https://www.instagram.com/payuulive",
        youtube: "https://www.youtube.com/@payuulive",
        discord: "https://discord.gg/nSZCe9mS62",
        facebook: "",
        twitter: "",
        website: ""
    },
    
    overlay: {
        duration: 6,
        confetti: true,
        sound: true,
        volume: 0.8,
        animation: "bounce"
    },

    voice: {
        enabled: true,
        language: "en-IN",
        gender: "female",
        volume: 0.9,
        pitch: 1.2,
        rate: 1.0
    },

    emailNotifications: {
        enabled: true,
        serviceId: "",
        templateId: "",
        publicKey: "",
        senderName: "Payuu Live Dashboard",
        replyTo: "support@payuulive.com",
        subject: "🔔 New Support Request - Payuu Live"
    },
    
    homeTexts: {
        welcomeTitle: "PAYUU LIVE",
        welcomeSubtitle: "CREATOR SUPPORT DASHBOARD",
        supportBtnText: "SUPPORT NOW",
        footerText: "Made with ❤️ by Payuu Live"
    }
};

const STATE = {
    goalTarget: 10000,
    goalCurrent: 0,
    selectedAmount: 50,
    topSupporter: { name: "No Top Supporter", amount: 0, isPinned: false },
    upiId: "payalgupta545757-1@okicici",
    payeeName: "Payuu Live",
    approvedSupporters: [],
    pendingQueue: [],
    adminList: [],
    auditLogs: [],
    notificationLogs: [],
    activeSubmission: null,
    settings: { ...DEFAULT_SETTINGS },
    currentAdmin: null
};

let qrCodeInstance = null;

function dismissWelcomeScreen() {
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.classList.add('hidden');
}

function switchAdminTab(tabName) {
    if (tabName === 'settings' && STATE.currentAdmin && STATE.currentAdmin.role !== 'owner') {
        alert("Access Denied: Only Owners can access Settings and Administrator Management.");
        return;
    }

    if ((tabName === 'logs' || tabName === 'audit') && STATE.currentAdmin && STATE.currentAdmin.role === 'viewer') {
        alert("Access Denied: Viewers cannot view Logs.");
        return;
    }

    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.style.display = 'none');

    const selectedBtn = document.getElementById(`tab-btn-${tabName}`);
    const selectedContent = document.getElementById(`tab-content-${tabName}`);

    if (selectedBtn) selectedBtn.classList.add('active');
    if (selectedContent) selectedContent.style.display = 'block';
}

function playDingSound() {
    try {
        if (!STATE.settings.overlay.sound) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const vol = Number(STATE.settings.overlay.volume || 0.8);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch(e){}
}

function applySettingsToUI(s) {
    if (!s) return;
    STATE.settings = { ...DEFAULT_SETTINGS, ...s };
    const cfg = STATE.settings;

    document.getElementById('page-title').textContent = `${cfg.websiteName} | Official Creator Support Hub`;
    document.getElementById('dyn-nav-brand').innerHTML = `${escapeHtml(cfg.websiteName)} <span>LIVE</span>`;
    document.getElementById('dyn-welcome-title').textContent = cfg.homeTexts.welcomeTitle || cfg.websiteName;
    document.getElementById('dyn-welcome-subtitle').textContent = cfg.homeTexts.welcomeSubtitle;
    document.getElementById('dyn-hero-title').textContent = cfg.websiteName;
    document.getElementById('dyn-hero-tagline').textContent = cfg.tagline;

    if (cfg.logoUrl) {
        document.querySelectorAll('.dynamic-logo').forEach(img => img.src = cfg.logoUrl);
    }
    if (cfg.faviconUrl) {
        document.getElementById('favicon-link').href = cfg.faviconUrl;
    }

    STATE.upiId = cfg.upiId;
    STATE.payeeName = cfg.streamerName;
    STATE.goalTarget = Number(cfg.goalTarget || 10000);
    document.getElementById('upi-id-text').textContent = cfg.upiId;
    document.getElementById('dyn-goal-title').textContent = cfg.goalTitle;
    document.getElementById('dyn-btn-text').textContent = cfg.homeTexts.supportBtnText;
    document.getElementById('warn-min-amt').textContent = cfg.minAmount;

    document.querySelectorAll('.curr-sym').forEach(el => el.textContent = cfg.currencySymbol || '₹');

    if (cfg.emailNotifications && cfg.emailNotifications.publicKey && window.emailjs) {
        try {
            emailjs.init(cfg.emailNotifications.publicKey);
        } catch (e) { console.error("EmailJS Init Error:", e); }
    }

    const tiersContainer = document.getElementById('tier-cards-container');
    if (tiersContainer && Array.isArray(cfg.suggestedAmounts)) {
        const tierLabels = ["Rookie 🎮", "Gamer ⭐", "Pro 🔥", "Elite 💎", "Champion 👑", "Legend 🏆"];
        const tierBadges = ["🎮", "⭐", "🔥", "💎", "👑", "🏆"];
        
        tiersContainer.innerHTML = '';
        cfg.suggestedAmounts.forEach((amt, idx) => {
            const card = document.createElement('div');
            card.className = `donation-card ${amt === STATE.selectedAmount ? 'active' : ''}`;
            card.setAttribute('data-value', amt);
            card.innerHTML = `
                <div class="tier-badge-icon">${tierBadges[idx % tierBadges.length]}</div>
                <div class="tier-amount-display"><span class="curr-sym">${cfg.currencySymbol || '₹'}</span>${amt}</div>
                <div class="tier-name-label">${tierLabels[idx % tierLabels.length]}</div>
            `;
            card.addEventListener('click', () => {
                document.querySelectorAll('.donation-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                STATE.selectedAmount = Number(amt);
                const customInput = document.getElementById('custom-amount');
                if (customInput) customInput.value = '';
                document.getElementById('amount-warning').style.display = 'none';
                updateRealQRCode();
            });
            tiersContainer.appendChild(card);
        });
    }

    if (cfg.socials) {
        const k = cfg.socials;
        if (k.kick) {
            document.getElementById('nav-link-kick').href = k.kick;
            document.getElementById('foot-link-kick').href = k.kick;
            document.getElementById('social-card-kick').href = k.kick;
            document.getElementById('btn-kick-sidebar').href = k.kick;
        }
        if (k.instagram) {
            document.getElementById('nav-link-insta').href = k.instagram;
            document.getElementById('foot-link-insta').href = k.instagram;
            document.getElementById('social-card-insta').href = k.instagram;
        }
        if (k.youtube) {
            document.getElementById('nav-link-yt').href = k.youtube;
            document.getElementById('foot-link-yt').href = k.youtube;
            document.getElementById('social-card-yt').href = k.youtube;
        }
        if (k.discord) {
            document.getElementById('nav-link-discord').href = k.discord;
            document.getElementById('foot-link-discord').href = k.discord;
            document.getElementById('social-card-discord').href = k.discord;
        }
    }

    document.getElementById('dyn-footer-brand').textContent = cfg.websiteName;
    document.getElementById('dyn-footer-copy-brand').textContent = cfg.websiteName;
    document.getElementById('dyn-footer-love-text').textContent = cfg.homeTexts.footerText;
    document.getElementById('dyn-thankyou-desc').innerHTML = `${escapeHtml(cfg.thankYouMessage)}<br>Please wait while ${escapeHtml(cfg.streamerName)} verifies your payment.`;

    renderUI();
}

function renderUI() {
    STATE.goalCurrent = STATE.approvedSupporters.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    
    // FEATURE 5: PINNED SUPPORTER OVERRIDE FOR TOP SUPPORTER CARD
    let pinnedItem = STATE.approvedSupporters.find(item => item.pinned === true);
    let highestItem = { name: "No Top Supporter", amount: 0, isPinned: false };

    if (pinnedItem) {
        highestItem = { name: pinnedItem.name, amount: Number(pinnedItem.amount), isPinned: true };
    } else {
        STATE.approvedSupporters.forEach(item => {
            if (Number(item.amount) > highestItem.amount) {
                highestItem = { name: item.name, amount: Number(item.amount), isPinned: false };
            }
        });
    }
    STATE.topSupporter = highestItem;

    const sym = STATE.settings.currencySymbol || '₹';

    const raisedEl = document.getElementById('raised-text');
    const targetEl = document.getElementById('target-text');
    const percentageEl = document.getElementById('percentage-text');
    const remainingEl = document.getElementById('remaining-text');
    const goalBar = document.getElementById('goal-bar');

    if (raisedEl) raisedEl.textContent = `${sym}${STATE.goalCurrent.toLocaleString()}`;
    if (targetEl) targetEl.textContent = `Target ${sym}${STATE.goalTarget.toLocaleString()}`;
    
    const percentage = Math.min(Math.round((STATE.goalCurrent / STATE.goalTarget) * 100), 100);
    const remaining = Math.max(STATE.goalTarget - STATE.goalCurrent, 0);

    if (goalBar) goalBar.style.width = `${percentage}%`;
    if (percentageEl) percentageEl.textContent = `${percentage}% Completed`;
    if (remainingEl) remainingEl.textContent = `${sym}${remaining.toLocaleString()} Remaining`;

    const statSupporters = document.getElementById('stat-total-supporters');
    const statRaised = document.getElementById('stat-total-raised');
    const statHighest = document.getElementById('stat-highest-donation');

    if (statSupporters) statSupporters.textContent = STATE.approvedSupporters.length;
    if (statRaised) statRaised.textContent = `${sym}${STATE.goalCurrent.toLocaleString()}`;
    if (statHighest) statHighest.textContent = `${sym}${STATE.topSupporter.amount.toLocaleString()}`;

    const topNameEl = document.getElementById('top-name');
    const topAmountEl = document.getElementById('top-amount');
    const topAvatarEl = document.getElementById('top-avatar-letter');
    const topBadgeEl = document.getElementById('top-supporter-badge');

    if (topNameEl) topNameEl.textContent = STATE.topSupporter.name;
    if (topAmountEl) topAmountEl.textContent = `${sym}${STATE.topSupporter.amount.toLocaleString()}`;
    if (topAvatarEl) {
        topAvatarEl.textContent = STATE.topSupporter.name !== "No Top Supporter" ? STATE.topSupporter.name.charAt(0).toUpperCase() : "?";
    }
    if (topBadgeEl) {
        topBadgeEl.textContent = STATE.topSupporter.isPinned ? "📌 PINNED" : "LEGEND";
    }

    const feed = document.getElementById('supporters-feed');
    if (feed) {
        feed.innerHTML = '';
        if (STATE.approvedSupporters.length === 0) {
            feed.innerHTML = '<div style="color: var(--text-sub); font-size:0.8rem; text-align:center;">No recent superchats yet.</div>';
        } else {
            // Display Pinned First, then latest
            const displayFeedList = [...STATE.approvedSupporters].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
            displayFeedList.slice(0, 10).forEach(s => {
                const card = document.createElement('div');
                card.className = 'feed-card';
                card.innerHTML = `
                    <div class="feed-card-header">
                        <span class="feed-card-user">${s.pinned ? '📌 ' : ''}${escapeHtml(s.name)}</span>
                        <span class="feed-card-amount">${sym}${s.amount}</span>
                    </div>
                    <div class="feed-card-body">${escapeHtml(s.msg || STATE.settings.fallbackMessage)}</div>
                `;
                feed.appendChild(card);
            });
        }
    }

    renderPendingQueue();
    renderApprovedAdminList();
    renderAdminsList();
    renderNotificationLogs();
    renderAuditLogs();
    updateRealQRCode();
}

function updateRealQRCode() {
    const container = document.getElementById('qr-container');
    if (!container) return;

    if (STATE.settings.qrCodeUrl) {
        container.innerHTML = `<img src="${STATE.settings.qrCodeUrl}" alt="UPI QR Code" style="width:100%; height:100%; object-fit:contain;">`;
    } else {
        const upiString = `upi://pay?pa=${STATE.upiId}&pn=${encodeURIComponent(STATE.payeeName)}&am=${STATE.selectedAmount}&cu=INR`;
        if (!qrCodeInstance) {
            container.innerHTML = '';
            qrCodeInstance = new QRCode(container, {
                text: upiString,
                width: 144,
                height: 144,
                colorDark : "#050E1A",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.M
            });
        } else {
            qrCodeInstance.clear();
            qrCodeInstance.makeCode(upiString);
        }
    }
}

function renderPendingQueue() {
    const queueContainer = document.getElementById('pending-queue-list');
    if (!queueContainer) return;
    queueContainer.innerHTML = '';

    if (STATE.pendingQueue.length === 0) {
        queueContainer.innerHTML = '<div style="color: var(--text-sub); font-size:0.8rem; margin-top:5px;">No pending requests in queue.</div>';
        return;
    }

    const sym = STATE.settings.currencySymbol || '₹';
    STATE.pendingQueue.forEach((item, index) => {
        const firstLetter = item.name ? item.name.charAt(0).toUpperCase() : '?';
        const card = document.createElement('div');
        card.className = 'admin-card';

        let statusClass = 'awaiting-verif';
        if (item.status === STATUS.AWAITING_PAYMENT) statusClass = 'awaiting-pay';

        card.innerHTML = `
            <div class="admin-card-header">
                <div class="admin-user-info">
                    <div class="admin-avatar">${firstLetter}</div>
                    <div>
                        <div class="admin-name">${escapeHtml(item.name)}</div>
                        <div class="admin-time"><i class="fa-regular fa-clock"></i> ${item.timeSubmitted || 'Just now'}</div>
                    </div>
                </div>
                <div class="status-pill ${statusClass}">${item.status || STATUS.AWAITING_VERIFICATION}</div>
            </div>

            <div class="admin-card-body">
                <div class="admin-message">"${escapeHtml(item.msg || 'No message provided.')}"</div>
                <div class="admin-amount">${sym}${Number(item.amount).toLocaleString()}</div>
            </div>

            <div class="admin-actions-row">
                <button class="btn-admin-act details" onclick="viewRequestDetails(${index})"><i class="fa-solid fa-eye"></i> Details</button>
                <button class="btn-admin-act approve" onclick="approveSuperchat('${item._key}', ${index})"><i class="fa-solid fa-check"></i> Approve</button>
                <button class="btn-admin-act reject" onclick="rejectSuperchat('${item._key}')"><i class="fa-solid fa-xmark"></i> Reject</button>
            </div>
        `;
        queueContainer.appendChild(card);
    });
}

// MODULE 2: EXPANDED APPROVED SUPER CHAT LIST WITH SEARCH, FILTERS, SORT & PIN
function renderApprovedAdminList() {
    const approvedContainer = document.getElementById('approved-admin-list');
    if (!approvedContainer) return;

    // Read Filter Inputs
    const searchVal = (document.getElementById('approved-search-input')?.value || '').toLowerCase();
    const filterDate = document.getElementById('approved-filter-date')?.value || 'all';
    const sortBy = document.getElementById('approved-sort-by')?.value || 'newest';

    let list = [...STATE.approvedSupporters];

    // FEATURE 6: SEARCH FILTER
    if (searchVal) {
        list = list.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchVal)) ||
            (item.msg && item.msg.toLowerCase().includes(searchVal)) ||
            (item.amount && String(item.amount).includes(searchVal))
        );
    }

    // FEATURE 7: DATE FILTERS
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - (7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (filterDate === 'today') {
        list = list.filter(item => (item.approvedAt || item.timestamp || 0) >= todayStart);
    } else if (filterDate === 'yesterday') {
        list = list.filter(item => {
            const t = item.approvedAt || item.timestamp || 0;
            return t >= yesterdayStart && t < todayStart;
        });
    } else if (filterDate === 'week') {
        list = list.filter(item => (item.approvedAt || item.timestamp || 0) >= weekStart);
    } else if (filterDate === 'month') {
        list = list.filter(item => (item.approvedAt || item.timestamp || 0) >= monthStart);
    }

    // FEATURE 8: SORTING
    list.sort((a, b) => {
        // Pinned item stays at the top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        if (sortBy === 'oldest') return (a.approvedAt || 0) - (b.approvedAt || 0);
        if (sortBy === 'highest') return Number(b.amount) - Number(a.amount);
        if (sortBy === 'lowest') return Number(a.amount) - Number(b.amount);
        if (sortBy === 'alpha') return (a.name || '').localeCompare(b.name || '');
        return (b.approvedAt || 0) - (a.approvedAt || 0); // Default 'newest'
    });

    // FEATURE 10: UPDATE LIVE SUMMARY STATS
    const count = list.length;
    const total = list.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const avg = count > 0 ? Math.round(total / count) : 0;
    const highest = count > 0 ? Math.max(...list.map(item => Number(item.amount || 0))) : 0;

    const sym = STATE.settings.currencySymbol || '₹';
    if (document.getElementById('app-stat-count')) document.getElementById('app-stat-count').textContent = count;
    if (document.getElementById('app-stat-total')) document.getElementById('app-stat-total').textContent = `${sym}${total.toLocaleString()}`;
    if (document.getElementById('app-stat-avg')) document.getElementById('app-stat-avg').textContent = `${sym}${avg.toLocaleString()}`;
    if (document.getElementById('app-stat-highest')) document.getElementById('app-stat-highest').textContent = `${sym}${highest.toLocaleString()}`;

    approvedContainer.innerHTML = '';

    if (list.length === 0) {
        approvedContainer.innerHTML = '<div style="color: var(--text-sub); font-size:0.8rem; margin-top:5px;">No matching approved supporters found.</div>';
        return;
    }

    const isOwner = STATE.currentAdmin && STATE.currentAdmin.role === 'owner';

    list.forEach((item) => {
        const firstLetter = item.name ? item.name.charAt(0).toUpperCase() : '?';
        const dateFormatted = item.dateSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : 'N/A');
        const timeFormatted = item.timeSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

        const card = document.createElement('div');
        card.className = 'admin-card';
        if (item.pinned) card.style.border = "1px solid var(--gold-primary)";

        card.innerHTML = `
            <div class="admin-card-header">
                <div class="admin-user-info">
                    <div class="admin-avatar" style="border-color: #10B981; color: #10B981;">${firstLetter}</div>
                    <div>
                        <div class="admin-name">${item.pinned ? '📌 ' : ''}${escapeHtml(item.name)}</div>
                        <div class="admin-time"><i class="fa-solid fa-calendar-day"></i> ${dateFormatted} ${timeFormatted}</div>
                    </div>
                </div>
                <div class="status-pill" style="background: rgba(16, 185, 129, 0.18); color: #10B981; border: 1px solid #10B981;">APPROVED</div>
            </div>

            <div class="admin-card-body">
                <div class="admin-message">"${escapeHtml(item.msg || 'No message provided.')}"</div>
                <div class="admin-amount">${sym}${Number(item.amount).toLocaleString()}</div>
            </div>

            <div class="admin-actions-row" style="flex-wrap: wrap; gap: 5px;">
                <button class="btn-admin-act details" onclick="openEditApprovedModalByKey('${item._key}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="btn-admin-act details" onclick="resendAlert('${item._key}')"><i class="fa-solid fa-rotate"></i> Re-Alert</button>
                <button class="btn-admin-act details" onclick="duplicateSuperchat('${item._key}')"><i class="fa-solid fa-clone"></i> Duplicate</button>
                ${isOwner ? `
                    <button class="btn-admin-act details" onclick="togglePinSupporter('${item._key}', ${!item.pinned})" style="background: rgba(255, 215, 0, 0.15); color: var(--gold-primary); border: 1px solid var(--gold-primary);">
                        <i class="fa-solid fa-thumbtack"></i> ${item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                ` : ''}
                <button class="btn-admin-act reject" onclick="deleteApprovedSuperchatPrompt('${item._key}')"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        `;
        approvedContainer.appendChild(card);
    });
}

function renderAdminsList() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;
    container.innerHTML = '';

    if (!STATE.adminList || STATE.adminList.length === 0) {
        container.innerHTML = '<div style="color: var(--text-sub); font-size: 0.8rem;">No registered administrators found.</div>';
        return;
    }

    STATE.adminList.forEach(admin => {
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.innerHTML = `
            <div class="admin-card-header">
                <div>
                    <div class="admin-name">${escapeHtml(admin.email)}</div>
                    <div class="admin-time">Role: <strong style="color: var(--gold-primary); text-transform: uppercase;">${admin.role}</strong></div>
                </div>
                <div class="status-pill" style="background: ${admin.active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${admin.active ? '#10B981' : '#EF4444'};">
                    ${admin.active ? 'ACTIVE' : 'DISABLED'}
                </div>
            </div>
            <div class="admin-actions-row">
                <button class="btn-admin-act details" onclick="toggleAdminStatus('${admin._key}', ${!admin.active})">
                    <i class="fa-solid fa-power-off"></i> ${admin.active ? 'Disable' : 'Enable'}
                </button>
                <button class="btn-admin-act reject" onclick="removeAdminRecord('${admin._key}')">
                    <i class="fa-solid fa-user-xmark"></i> Remove
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderNotificationLogs() {
    const container = document.getElementById('notification-logs-list');
    if (!container) return;
    container.innerHTML = '';

    if (!STATE.notificationLogs || STATE.notificationLogs.length === 0) {
        container.innerHTML = '<div style="color: var(--text-sub); font-size: 0.8rem; padding: 10px;">No notification logs recorded yet.</div>';
        return;
    }

    STATE.notificationLogs.forEach(log => {
        const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : "Just Now";
        const isSuccess = log.status === "SENT";
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.style.padding = "10px";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                <div>
                    <strong>To:</strong> ${escapeHtml(log.recipient)} <br>
                    <span style="color: var(--text-sub); font-size: 0.72rem;">Supporter: ${escapeHtml(log.supporterName)} (₹${log.amount}) - ${dateStr}</span>
                </div>
                <div class="status-pill" style="background: ${isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isSuccess ? '#10B981' : '#EF4444'}; border: 1px solid ${isSuccess ? '#10B981' : '#EF4444'}; font-size: 0.65rem;">
                    ${isSuccess ? 'SENT' : 'FAILED'}
                </div>
            </div>
            ${log.error ? `<div style="font-size: 0.7rem; color: #EF4444; margin-top: 5px;">Error: ${escapeHtml(String(log.error))}</div>` : ''}
        `;
        container.appendChild(card);
    });
}

// FEATURE 11: RENDER AUDIT LOGS
function renderAuditLogs() {
    const container = document.getElementById('audit-logs-list');
    if (!container) return;
    container.innerHTML = '';

    if (!STATE.auditLogs || STATE.auditLogs.length === 0) {
        container.innerHTML = '<div style="color: var(--text-sub); font-size: 0.8rem; padding: 10px;">No audit logs recorded yet.</div>';
        return;
    }

    STATE.auditLogs.forEach(log => {
        const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : "Just Now";
        const card = document.createElement('div');
        card.className = 'admin-card';
        card.style.padding = "10px";

        card.innerHTML = `
            <div style="font-size: 0.8rem;">
                <div style="display: flex; justify-content: space-between;">
                    <strong style="color: var(--gold-primary);">${escapeHtml(log.action)}</strong>
                    <span style="color: var(--text-sub); font-size: 0.7rem;">${dateStr}</span>
                </div>
                <div style="font-size: 0.75rem; margin-top: 4px;">
                    <strong>Admin:</strong> ${escapeHtml(log.adminEmail)} | <strong>Supporter:</strong> ${escapeHtml(log.supporterName)} (₹${log.amount})
                </div>
                ${log.details ? `<div style="font-size: 0.7rem; color: var(--text-sub); margin-top: 2px;">${escapeHtml(log.details)}</div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleAdminStatus(key, newActiveState) {
    if (window.firebaseDB) {
        window.firebaseDB.toggleAdminActive(key, newActiveState).then(() => {
            alert("Administrator status updated.");
        });
    }
}

function removeAdminRecord(key) {
    if (confirm("Are you sure you want to remove this administrator?") && window.firebaseDB) {
        window.firebaseDB.deleteAdmin(key).then(() => {
            alert("Administrator removed successfully.");
        });
    }
}

function populateSettingsForm() {
    const s = STATE.settings;
    document.getElementById('set-website-name').value = s.websiteName || '';
    document.getElementById('set-streamer-name').value = s.streamerName || '';
    document.getElementById('set-tagline').value = s.tagline || '';
    document.getElementById('set-upi-id').value = s.upiId || '';
    document.getElementById('set-suggested-amounts').value = Array.isArray(s.suggestedAmounts) ? s.suggestedAmounts.join(', ') : '';
    document.getElementById('set-min-amount').value = s.minAmount || 40;
    document.getElementById('set-max-amount').value = s.maxAmount || 50000;
    document.getElementById('set-goal-target').value = s.goalTarget || 10000;
    document.getElementById('set-goal-title').value = s.goalTitle || '';
    document.getElementById('set-currency-symbol').value = s.currencySymbol || '₹';
    document.getElementById('set-thankyou-msg').value = s.thankYouMessage || '';

    if (s.emailNotifications) {
        document.getElementById('set-email-enabled').value = String(s.emailNotifications.enabled !== false);
        document.getElementById('set-emailjs-service').value = s.emailNotifications.serviceId || '';
        document.getElementById('set-emailjs-template').value = s.emailNotifications.templateId || '';
        document.getElementById('set-emailjs-publickey').value = s.emailNotifications.publicKey || '';
        document.getElementById('set-email-sender-name').value = s.emailNotifications.senderName || 'Payuu Live Dashboard';
        document.getElementById('set-email-reply-to').value = s.emailNotifications.replyTo || 'support@payuulive.com';
        document.getElementById('set-email-subject').value = s.emailNotifications.subject || '🔔 New Support Request - Payuu Live';
    }

    if (s.voice) {
        document.getElementById('set-voice-enabled').value = String(s.voice.enabled !== false);
        document.getElementById('set-voice-language').value = s.voice.language || 'en-IN';
        document.getElementById('set-voice-gender').value = s.voice.gender || 'female';
        document.getElementById('set-voice-volume').value = s.voice.volume !== undefined ? s.voice.volume : 0.9;
        document.getElementById('set-voice-rate').value = s.voice.rate || 1.0;
    }

    if (s.socials) {
        document.getElementById('set-social-kick').value = s.socials.kick || '';
        document.getElementById('set-social-insta').value = s.socials.instagram || '';
        document.getElementById('set-social-yt').value = s.socials.youtube || '';
        document.getElementById('set-social-discord').value = s.socials.discord || '';
        document.getElementById('set-social-fb').value = s.socials.facebook || '';
        document.getElementById('set-social-twitter').value = s.socials.twitter || '';
        document.getElementById('set-social-website').value = s.socials.website || '';
    }

    if (s.overlay) {
        document.getElementById('set-overlay-duration').value = s.overlay.duration || 6;
        document.getElementById('set-overlay-volume').value = s.overlay.volume || 0.8;
        document.getElementById('set-overlay-confetti').value = String(s.overlay.confetti);
        document.getElementById('set-overlay-sound').value = String(s.overlay.sound);
        document.getElementById('set-overlay-animation').value = s.overlay.animation || 'bounce';
    }

    if (s.homeTexts) {
        document.getElementById('set-welcome-title').value = s.homeTexts.welcomeTitle || '';
        document.getElementById('set-welcome-subtitle').value = s.homeTexts.welcomeSubtitle || '';
        document.getElementById('set-btn-text').value = s.homeTexts.supportBtnText || '';
        document.getElementById('set-footer-text').value = s.homeTexts.footerText || '';
    }
}

function sendAdminEmailNotification(submissionData) {
    const emailCfg = STATE.settings.emailNotifications;
    if (!emailCfg || emailCfg.enabled === false) return;
    if (!emailCfg.serviceId || !emailCfg.templateId || !window.emailjs) return;

    if (window.firebaseDB && window.firebaseDB.getActiveAdminEmails) {
        window.firebaseDB.getActiveAdminEmails((adminEmails) => {
            if (!adminEmails || adminEmails.length === 0) return;

            const currentDate = new Date().toLocaleDateString();
            const currentTime = submissionData.timeSubmitted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dashboardUrl = `${window.location.origin}${window.location.pathname}`;

            adminEmails.forEach(adminEmail => {
                const templateParams = {
                    to_email: adminEmail,
                    email_to: adminEmail,
                    sender_name: emailCfg.senderName || "Payuu Live Dashboard",
                    reply_to: emailCfg.replyTo || "support@payuulive.com",
                    subject: emailCfg.subject || "🔔 New Support Request - Payuu Live",
                    supporter_name: submissionData.name,
                    amount: submissionData.amount,
                    message: submissionData.msg || "No message provided.",
                    date: currentDate,
                    time: currentTime,
                    status: "Awaiting Approval",
                    dashboard_url: dashboardUrl
                };

                emailjs.send(emailCfg.serviceId, emailCfg.templateId, templateParams)
                    .then(() => {
                        window.firebaseDB.logNotificationAttempt({
                            recipient: adminEmail,
                            supporterName: submissionData.name,
                            amount: submissionData.amount,
                            status: "SENT"
                        });
                    })
                    .catch((err) => {
                        console.error("EmailJS Notification Failed for " + adminEmail + ":", err);
                        const warningBadge = document.getElementById('email-status-warning');
                        if (warningBadge) warningBadge.style.display = 'inline-block';

                        window.firebaseDB.logNotificationAttempt({
                            recipient: adminEmail,
                            supporterName: submissionData.name,
                            amount: submissionData.amount,
                            status: "FAILED",
                            error: err.text || err.message || JSON.stringify(err)
                        });
                    });
            });
        });
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) resolve(null);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function approveSuperchat(key, index) {
    const item = STATE.pendingQueue[index];
    if (!item) return;

    if (window.firebaseDB) {
        window.firebaseDB.approveSupport(key, item).then((approvedKey) => {
            window.firebaseDB.pushOverlayAlert(item, approvedKey);

            window.firebaseDB.logAuditAction({
                adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                action: "Approve Request",
                supporterName: item.name,
                amount: item.amount,
                details: `Approved support request from queue`
            });

            if (STATE.settings.overlay.confetti) {
                try {
                    confetti({
                        particleCount: 80,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                } catch(e){}
            }
        }).catch(err => console.error("Approval Error:", err));
    }
}

function rejectSuperchat(key) {
    const item = STATE.pendingQueue.find(i => i._key === key);
    if (window.firebaseDB) {
        window.firebaseDB.rejectSupport(key).then(() => {
            if (item) {
                window.firebaseDB.logAuditAction({
                    adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                    action: "Reject Request",
                    supporterName: item.name,
                    amount: item.amount,
                    details: `Rejected pending support request`
                });
            }
        }).catch(err => console.error("Rejection Error:", err));
    }
}

// FEATURE 1: OPEN EDIT APPROVED MODAL
function openEditApprovedModalByKey(key) {
    const item = STATE.approvedSupporters.find(s => s._key === key);
    if (!item) return;

    document.getElementById('edit-record-key').value = item._key;
    document.getElementById('edit-supporter-name').value = item.name;
    document.getElementById('edit-supporter-amount').value = item.amount;
    document.getElementById('edit-supporter-message').value = item.msg || '';
    document.getElementById('edit-supporter-date').value = item.dateSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : '');
    document.getElementById('edit-supporter-time').value = item.timeSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

    const modal = document.getElementById('edit-approved-modal');
    if (modal) modal.classList.add('active');
}

// FEATURE 2: DELETE SUPER CHAT WITH CONFIRMATION
function deleteApprovedSuperchatPrompt(key) {
    const item = STATE.approvedSupporters.find(s => s._key === key);
    if (!item) return;

    const confirmMsg = `Delete Super Chat?\nName: ${item.name}\nAmount: ₹${item.amount}\n\nClick OK to confirm deletion.`;
    if (!confirm(confirmMsg)) return;

    if (window.firebaseDB) {
        window.firebaseDB.deleteApprovedSupport(key).then(() => {
            window.firebaseDB.logAuditAction({
                adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                action: "Delete Super Chat",
                supporterName: item.name,
                amount: item.amount,
                details: "Deleted approved superchat record"
            });
            alert("Super Chat deleted successfully.");
        }).catch(err => {
            console.error("Delete Error:", err);
            alert("Failed to delete record.");
        });
    }
}

// FEATURE 3: RE ALERT
function resendAlert(key) {
    const item = STATE.approvedSupporters.find(s => s._key === key);
    if (!item) return;

    if (window.firebaseDB) {
        window.firebaseDB.pushOverlayAlert(item, key).then(() => {
            window.firebaseDB.logAuditAction({
                adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                action: "Re-Alert",
                supporterName: item.name,
                amount: item.amount,
                details: "Pushed overlay alert again"
            });
            alert("Alert Successfully Sent");
        }).catch(err => {
            console.error("Resend Error:", err);
            alert("Failed to resend alert.");
        });
    }
}

// FEATURE 4: DUPLICATE SUPER CHAT
function duplicateSuperchat(key) {
    const item = STATE.approvedSupporters.find(s => s._key === key);
    if (!item) return;

    if (window.firebaseDB) {
        window.firebaseDB.duplicateSupport(item).then(() => {
            window.firebaseDB.logAuditAction({
                adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                action: "Duplicate Super Chat",
                supporterName: item.name,
                amount: item.amount,
                details: "Created a duplicated approved record"
            });
            alert("Super Chat duplicated successfully!");
        }).catch(err => {
            console.error("Duplicate Error:", err);
            alert("Failed to duplicate Super Chat.");
        });
    }
}

// FEATURE 5: PIN SUPPORTER
function togglePinSupporter(key, newPinState) {
    const item = STATE.approvedSupporters.find(s => s._key === key);
    if (!item || !window.firebaseDB) return;

    if (newPinState) {
        window.firebaseDB.pinSupporter(key).then(() => {
            window.firebaseDB.logAuditAction({
                adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                action: "Pin Supporter",
                supporterName: item.name,
                amount: item.amount,
                details: "Pinned supporter to top of leaderboard"
            });
            alert(`📌 ${item.name} pinned to top!`);
        });
    } else {
        window.firebaseDB.unpinSupporter(key).then(() => {
            window.firebaseDB.logAuditAction({
                adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                action: "Unpin Supporter",
                supporterName: item.name,
                amount: item.amount,
                details: "Unpinned supporter"
            });
            alert(`Unpinned ${item.name}.`);
        });
    }
}

// FEATURE 9: EXPORT FUNCTIONALITY (CSV, EXCEL, PDF/PRINT)
function getFilteredApprovedData() {
    const searchVal = (document.getElementById('approved-search-input')?.value || '').toLowerCase();
    const filterDate = document.getElementById('approved-filter-date')?.value || 'all';

    let list = [...STATE.approvedSupporters];

    if (searchVal) {
        list = list.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchVal)) ||
            (item.msg && item.msg.toLowerCase().includes(searchVal)) ||
            (item.amount && String(item.amount).includes(searchVal))
        );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - (7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (filterDate === 'today') {
        list = list.filter(item => (item.approvedAt || item.timestamp || 0) >= todayStart);
    } else if (filterDate === 'yesterday') {
        list = list.filter(item => {
            const t = item.approvedAt || item.timestamp || 0;
            return t >= yesterdayStart && t < todayStart;
        });
    } else if (filterDate === 'week') {
        list = list.filter(item => (item.approvedAt || item.timestamp || 0) >= weekStart);
    } else if (filterDate === 'month') {
        list = list.filter(item => (item.approvedAt || item.timestamp || 0) >= monthStart);
    }

    return list;
}

function exportApprovedToCSV() {
    const list = getFilteredApprovedData();
    if (list.length === 0) {
        alert("No data available to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Date,Time,Supporter,Amount,Message,Status,Approved By\n";

    list.forEach(item => {
        const dateStr = item.dateSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : 'N/A');
        const timeStr = item.timeSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A');
        const nameClean = `"${(item.name || '').replace(/"/g, '""')}"`;
        const msgClean = `"${(item.msg || '').replace(/"/g, '""')}"`;
        const approvedBy = `"${(STATE.currentAdmin ? STATE.currentAdmin.email : 'Admin')}"`;

        csvContent += `${dateStr},${timeStr},${nameClean},${item.amount},${msgClean},Approved,${approvedBy}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PayuuLive_Superchats_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportApprovedToExcel() {
    const list = getFilteredApprovedData();
    if (list.length === 0) {
        alert("No data available to export.");
        return;
    }

    let htmlTable = `<table border="1"><tr><th>Date</th><th>Time</th><th>Supporter</th><th>Amount (INR)</th><th>Message</th><th>Status</th><th>Approved By</th></tr>`;

    list.forEach(item => {
        const dateStr = item.dateSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : 'N/A');
        const timeStr = item.timeSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A');
        const approvedBy = STATE.currentAdmin ? STATE.currentAdmin.email : 'Admin';

        htmlTable += `<tr><td>${escapeHtml(dateStr)}</td><td>${escapeHtml(timeStr)}</td><td>${escapeHtml(item.name)}</td><td>${item.amount}</td><td>${escapeHtml(item.msg || '')}</td><td>Approved</td><td>${escapeHtml(approvedBy)}</td></tr>`;
    });

    htmlTable += `</table>`;

    const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PayuuLive_Superchats_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportApprovedToPDF() {
    const list = getFilteredApprovedData();
    if (list.length === 0) {
        alert("No data available to export.");
        return;
    }

    const printWin = window.open('', '', 'width=900,height=650');
    let printContent = `
        <html>
        <head>
            <title>Payuu Live - Super Chats Export</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
                h2 { color: #07192F; border-bottom: 2px solid #FFD700; padding-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 12px; }
                th { background: #07192F; color: #FFD700; }
                tr:nth-child(even) { background: #f9f9f9; }
            </style>
        </head>
        <body>
            <h2>Payuu Live - Approved Super Chats Report</h2>
            <p>Generated Date: ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Supporter Name</th>
                        <th>Amount</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Approved By</th>
                    </tr>
                </thead>
                <tbody>
    `;

    list.forEach(item => {
        const dateStr = item.dateSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : 'N/A');
        const timeStr = item.timeSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A');
        const approvedBy = STATE.currentAdmin ? STATE.currentAdmin.email : 'Admin';

        printContent += `
            <tr>
                <td>${escapeHtml(dateStr)}</td>
                <td>${escapeHtml(timeStr)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>₹${item.amount}</td>
                <td>${escapeHtml(item.msg || '-')}</td>
                <td>Approved</td>
                <td>${escapeHtml(approvedBy)}</td>
            </tr>
        `;
    });

    printContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    printWin.document.write(printContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 500);
}

function viewRequestDetails(index) {
    const item = STATE.pendingQueue[index];
    if (!item) return;

    const sym = STATE.settings.currencySymbol || '₹';
    const detailsBody = document.getElementById('details-content-body');
    if (detailsBody) {
        detailsBody.innerHTML = `
            <p><strong>Supporter Name:</strong> ${escapeHtml(item.name)}</p>
            <p><strong>Amount:</strong> ${sym}${Number(item.amount).toLocaleString()}</p>
            <p><strong>Message:</strong> "${escapeHtml(item.msg || 'N/A')}"</p>
            <p><strong>Time Submitted:</strong> ${item.timeSubmitted || 'N/A'}</p>
            <p><strong>Current Status:</strong> ${item.status || STATUS.AWAITING_VERIFICATION}</p>
            <p><strong>Payee UPI ID:</strong> ${STATE.upiId}</p>
        `;
    }

    const modal = document.getElementById('details-modal');
    if (modal) modal.classList.add('active');
}

function applyRolePermissions() {
    const isOwner = STATE.currentAdmin && STATE.currentAdmin.role === 'owner';
    const isModOrOwner = STATE.currentAdmin && (STATE.currentAdmin.role === 'owner' || STATE.currentAdmin.role === 'moderator');
    
    document.querySelectorAll('.owner-only').forEach(el => {
        el.style.display = isOwner ? '' : 'none';
    });

    document.querySelectorAll('.mod-owner-only').forEach(el => {
        el.style.display = isModOrOwner ? '' : 'none';
    });

    document.getElementById('admin-email-display').textContent = STATE.currentAdmin ? STATE.currentAdmin.email : 'N/A';
    document.getElementById('admin-role-display').textContent = STATE.currentAdmin ? STATE.currentAdmin.role : 'N/A';
}

function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    const authModal = document.getElementById('google-auth-modal');

    if (panel.classList.contains('active')) {
        panel.classList.remove('active');
    } else {
        if (STATE.currentAdmin) {
            panel.classList.add('active');
            applyRolePermissions();
            populateSettingsForm();
        } else {
            if (authModal) authModal.classList.add('active');
        }
    }
}

function escapeHtml(text) {
    return text ? text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])) : '';
}

function initGoldenParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    });

    const particles = Array.from({length: 45}, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 2.2 + 0.8,
        alpha: Math.random() * 0.6 + 0.3,
        speedY: - (Math.random() * 0.4 + 0.15),
        speedX: (Math.random() - 0.5) * 0.3
    }));

    function animateParticles() {
        ctx.clearRect(0, 0, w, h);

        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;

            if (p.y < -10) p.y = h + 10;
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;

            const radGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
            radGlow.addColorStop(0, 'rgba(255, 230, 102, ' + Math.max(0, p.alpha) + ')');
            radGlow.addColorStop(0.4, 'rgba(255, 199, 0, ' + Math.max(0, p.alpha * 0.6) + ')');
            radGlow.addColorStop(1, 'rgba(255, 199, 0, 0)');

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
            ctx.fillStyle = radGlow;
            ctx.fill();
        });

        requestAnimationFrame(animateParticles);
    }

    animateParticles();
}

function initFirebaseListeners() {
    if (window.firebaseDB) {
        window.firebaseDB.listenPending((pendingList) => {
            STATE.pendingQueue = pendingList;
            renderPendingQueue();
        });

        window.firebaseDB.listenApproved((approvedList) => {
            STATE.approvedSupporters = approvedList;
            renderUI();
        });

        window.firebaseDB.listenSettings((settingsData) => {
            if (settingsData) {
                applySettingsToUI(settingsData);
            } else {
                applySettingsToUI(DEFAULT_SETTINGS);
            }
        });

        window.firebaseDB.listenAdmins((adminsList) => {
            STATE.adminList = adminsList;
            renderAdminsList();
        });

        window.firebaseDB.listenNotificationLogs((logsList) => {
            STATE.notificationLogs = logsList;
            renderNotificationLogs();
        });

        window.firebaseDB.listenAuditLogs((auditList) => {
            STATE.auditLogs = auditList;
            renderAuditLogs();
        });

        window.firebaseDB.onAuthStateChanged((user) => {
            const panel = document.getElementById('admin-panel');
            const authModal = document.getElementById('google-auth-modal');

            if (user && user.email) {
                window.firebaseDB.checkAdminStatus(user.email, (adminRecord) => {
                    if (adminRecord && adminRecord.active === true) {
                        STATE.currentAdmin = adminRecord;
                        if (authModal) authModal.classList.remove('active');
                        applyRolePermissions();
                        populateSettingsForm();
                    } else {
                        STATE.currentAdmin = null;
                        window.firebaseDB.signOut();
                        if (panel) panel.classList.remove('active');
                        alert("Access Denied. You are not an authorised administrator.");
                    }
                });
            } else {
                STATE.currentAdmin = null;
                if (panel) panel.classList.remove('active');
            }
        });
    }
}

// EVENT BINDINGS
document.addEventListener('DOMContentLoaded', () => {
    initGoldenParticles();
    initFirebaseListeners();

    const enterBtn = document.getElementById('btn-enter-dashboard');
    if (enterBtn) enterBtn.addEventListener('click', dismissWelcomeScreen);

    const adminToggleBtn = document.getElementById('toggle-admin-btn');
    if (adminToggleBtn) adminToggleBtn.addEventListener('click', toggleAdminPanel);

    const googleLoginBtn = document.getElementById('btn-google-login');
    const closeLoginBtn = document.getElementById('btn-close-login');
    const authModal = document.getElementById('google-auth-modal');

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            if (window.firebaseDB) {
                window.firebaseDB.signInWithGoogle().catch(err => {
                    console.error("Auth Error:", err);
                    alert("Google Sign-In failed.");
                });
            }
        });
    }

    if (closeLoginBtn && authModal) {
        closeLoginBtn.addEventListener('click', () => authModal.classList.remove('active'));
    }

    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (window.firebaseDB) {
                window.firebaseDB.signOut().then(() => {
                    document.getElementById('admin-panel').classList.remove('active');
                    alert("Logged out successfully.");
                });
            }
        });
    }

    // SEARCH & FILTER INPUT EVENT LISTENERS (MODULE 2)
    const approvedSearch = document.getElementById('approved-search-input');
    const approvedDateFilter = document.getElementById('approved-filter-date');
    const approvedSortBy = document.getElementById('approved-sort-by');

    if (approvedSearch) approvedSearch.addEventListener('input', renderApprovedAdminList);
    if (approvedDateFilter) approvedDateFilter.addEventListener('change', renderApprovedAdminList);
    if (approvedSortBy) approvedSortBy.addEventListener('change', renderApprovedAdminList);

    // EXPORT BUTTONS BINDING (MODULE 2)
    const btnCsv = document.getElementById('btn-export-csv');
    const btnExcel = document.getElementById('btn-export-excel');
    const btnPdf = document.getElementById('btn-export-pdf');

    if (btnCsv) btnCsv.addEventListener('click', exportApprovedToCSV);
    if (btnExcel) btnExcel.addEventListener('click', exportApprovedToExcel);
    if (btnPdf) btnPdf.addEventListener('click', exportApprovedToPDF);

    // EDIT APPROVED SUPER CHAT FORM SUBMIT (MODULE 2)
    const editApprovedForm = document.getElementById('edit-approved-form');
    const editModal = document.getElementById('edit-approved-modal');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    if (cancelEditBtn && editModal) {
        cancelEditBtn.addEventListener('click', () => editModal.classList.remove('active'));
    }

    if (editApprovedForm) {
        editApprovedForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const key = document.getElementById('edit-record-key').value;
            const name = document.getElementById('edit-supporter-name').value.trim();
            const amount = parseFloat(document.getElementById('edit-supporter-amount').value);
            const msg = document.getElementById('edit-supporter-message').value.trim();
            const dateSubmitted = document.getElementById('edit-supporter-date').value.trim();
            const timeSubmitted = document.getElementById('edit-supporter-time').value.trim();

            if (!name || isNaN(amount) || amount <= 0) {
                alert("Please fill valid Name and Amount.");
                return;
            }

            if (window.firebaseDB && key) {
                window.firebaseDB.updateApprovedSupportDetail(key, {
                    name, amount, msg, dateSubmitted, timeSubmitted
                }).then(() => {
                    window.firebaseDB.logAuditAction({
                        adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                        action: "Edit Super Chat",
                        supporterName: name,
                        amount: amount,
                        details: `Updated details for record ${key}`
                    });

                    if (editModal) editModal.classList.remove('active');
                    alert("Super Chat updated successfully!");
                }).catch(err => {
                    console.error("Update Error:", err);
                    alert("Failed to update record.");
                });
            }
        });
    }

    const addAdminBtn = document.getElementById('btn-add-admin');
    if (addAdminBtn) {
        addAdminBtn.addEventListener('click', () => {
            const email = document.getElementById('new-admin-email').value.trim();
            const role = document.getElementById('new-admin-role').value;

            if (!email) {
                alert("Please enter a valid administrator email.");
                return;
            }

            if (window.firebaseDB) {
                window.firebaseDB.saveAdmin({ email, role, active: true }).then(() => {
                    document.getElementById('new-admin-email').value = '';
                    alert(`Administrator ${email} configured successfully!`);
                });
            }
        });
    }

    const testEmailBtn = document.getElementById('btn-test-email');
    if (testEmailBtn) {
        testEmailBtn.addEventListener('click', () => {
            if (!STATE.currentAdmin || STATE.currentAdmin.role !== 'owner') {
                alert("Access Denied: Only Owners can trigger Test Emails.");
                return;
            }

            const testSampleData = {
                name: "Test Supporter",
                amount: 500,
                msg: "This is a sample test email notification from Payuu Live Dashboard.",
                timeSubmitted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            sendAdminEmailNotification(testSampleData);
            alert("Test email dispatched to active administrators!");
        });
    }

    const testVoiceBtn = document.getElementById('btn-test-voice');
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', () => {
            if (!('speechSynthesis' in window)) {
                alert("Speech Synthesis is not supported in this browser.");
                return;
            }
            window.speechSynthesis.cancel();

            const lang = document.getElementById('set-voice-language').value || 'en-IN';
            const gender = document.getElementById('set-voice-gender').value || 'female';
            const volume = parseFloat(document.getElementById('set-voice-volume').value) || 0.9;
            const rate = parseFloat(document.getElementById('set-voice-rate').value) || 1.0;

            let testText = lang.startsWith('hi') 
                ? "यह एक वॉयस टेस्ट संदेश है। पेयु लाइव सपोर्ट काम कर रहा है।" 
                : "New Support! ShadowSlayer supported 500 rupees. Message: Keep up the awesome streams!";

            const utterance = new SpeechSynthesisUtterance(testText);
            utterance.lang = lang;
            utterance.volume = volume;
            utterance.rate = rate;
            utterance.pitch = gender === 'female' ? 1.2 : 0.8;

            const voices = window.speechSynthesis.getVoices();
            const matched = voices.find(v => v.lang === lang || v.lang.replace('_', '-').startsWith(lang.split('-')[0]));
            if (matched) utterance.voice = matched;

            window.speechSynthesis.speak(utterance);
        });
    }

    const copyBtn = document.getElementById('copy-upi-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(STATE.upiId);
            alert('UPI ID copied to clipboard!');
        });
    }

    const closeModalBtn = document.getElementById('close-modal-btn');
    const thankyouModal = document.getElementById('thankyou-modal');
    if (closeModalBtn && thankyouModal) {
        closeModalBtn.addEventListener('click', () => thankyouModal.classList.remove('active'));
    }

    const closeDetailsBtn = document.getElementById('close-details-btn');
    const detailsModal = document.getElementById('details-modal');
    if (closeDetailsBtn && detailsModal) {
        closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('active'));
    }

    const openAddModalBtn = document.getElementById('btn-open-add-modal');
    const addModal = document.getElementById('add-superchat-modal');
    const cancelAddBtn = document.getElementById('cancel-add-btn');
    const addForm = document.getElementById('add-superchat-form');

    if (openAddModalBtn && addModal) {
        openAddModalBtn.addEventListener('click', () => {
            addForm.reset();
            addModal.classList.add('active');
        });
    }

    if (cancelAddBtn && addModal) {
        cancelAddBtn.addEventListener('click', () => addModal.classList.remove('active'));
    }

    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('add-supporter-name').value.trim();
            const amount = parseFloat(document.getElementById('add-supporter-amount').value);
            const msg = document.getElementById('add-supporter-message').value.trim();

            if (!name || isNaN(amount) || amount <= 0) {
                alert("Please fill valid Name and Amount.");
                return;
            }

            if (window.firebaseDB && firebase && firebase.database) {
                const approvedRef = firebase.database().ref("approvedSupport").push();
                const payload = {
                    id: approvedRef.key,
                    name: name,
                    amount: Number(amount),
                    msg: msg || "",
                    status: "Approved",
                    approvedAt: firebase.database.ServerValue.TIMESTAMP,
                    pinned: false
                };

                approvedRef.set(payload).then(() => {
                    window.firebaseDB.pushOverlayAlert(payload, approvedRef.key);

                    window.firebaseDB.logAuditAction({
                        adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                        action: "Add Super Chat",
                        supporterName: name,
                        amount: amount,
                        details: "Manually added approved superchat"
                    });

                    addModal.classList.remove('active');
                    addForm.reset();
                    alert("Super Chat added and alert sent to stream!");
                }).catch(err => {
                    console.error("Error adding superchat:", err);
                    alert("Failed to add Super Chat.");
                });
            }
        });
    }

    const settingsForm = document.getElementById('admin-settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (STATE.currentAdmin && STATE.currentAdmin.role !== 'owner') {
                alert("Access Denied: Only Owners can modify settings.");
                return;
            }

            const logoFile = document.getElementById('set-logo-file').files[0];
            const faviconFile = document.getElementById('set-favicon-file').files[0];
            const qrFile = document.getElementById('set-qr-file').files[0];

            let logoUrl = STATE.settings.logoUrl;
            let faviconUrl = STATE.settings.faviconUrl;
            let qrCodeUrl = STATE.settings.qrCodeUrl;

            try {
                if (logoFile) logoUrl = await fileToBase64(logoFile);
                if (faviconFile) faviconUrl = await fileToBase64(faviconFile);
                if (qrFile) qrCodeUrl = await fileToBase64(qrFile);

                const suggestedRaw = document.getElementById('set-suggested-amounts').value;
                const suggestedArray = suggestedRaw.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);

                const updatedSettings = {
                    websiteName: document.getElementById('set-website-name').value.trim(),
                    streamerName: document.getElementById('set-streamer-name').value.trim(),
                    tagline: document.getElementById('set-tagline').value.trim(),
                    logoUrl: logoUrl,
                    faviconUrl: faviconUrl,

                    upiId: document.getElementById('set-upi-id').value.trim(),
                    qrCodeUrl: qrCodeUrl,
                    suggestedAmounts: suggestedArray.length > 0 ? suggestedArray : DEFAULT_SETTINGS.suggestedAmounts,
                    minAmount: Number(document.getElementById('set-min-amount').value) || 40,
                    maxAmount: Number(document.getElementById('set-max-amount').value) || 50000,

                    goalTarget: Number(document.getElementById('set-goal-target').value) || 10000,
                    goalTitle: document.getElementById('set-goal-title').value.trim(),
                    currencySymbol: document.getElementById('set-currency-symbol').value.trim() || '₹',
                    thankYouMessage: document.getElementById('set-thankyou-msg').value.trim(),

                    emailNotifications: {
                        enabled: document.getElementById('set-email-enabled').value === 'true',
                        serviceId: document.getElementById('set-emailjs-service').value.trim(),
                        templateId: document.getElementById('set-emailjs-template').value.trim(),
                        publicKey: document.getElementById('set-emailjs-publickey').value.trim(),
                        senderName: document.getElementById('set-email-sender-name').value.trim(),
                        replyTo: document.getElementById('set-email-reply-to').value.trim(),
                        subject: document.getElementById('set-email-subject').value.trim()
                    },

                    voice: {
                        enabled: document.getElementById('set-voice-enabled').value === 'true',
                        language: document.getElementById('set-voice-language').value,
                        gender: document.getElementById('set-voice-gender').value,
                        volume: Number(document.getElementById('set-voice-volume').value) || 0.9,
                        rate: Number(document.getElementById('set-voice-rate').value) || 1.0
                    },

                    socials: {
                        kick: document.getElementById('set-social-kick').value.trim(),
                        instagram: document.getElementById('set-social-insta').value.trim(),
                        youtube: document.getElementById('set-social-yt').value.trim(),
                        discord: document.getElementById('set-social-discord').value.trim(),
                        facebook: document.getElementById('set-social-fb').value.trim(),
                        twitter: document.getElementById('set-social-twitter').value.trim(),
                        website: document.getElementById('set-social-website').value.trim()
                    },

                    overlay: {
                        duration: Number(document.getElementById('set-overlay-duration').value) || 6,
                        volume: Number(document.getElementById('set-overlay-volume').value) || 0.8,
                        confetti: document.getElementById('set-overlay-confetti').value === 'true',
                        sound: document.getElementById('set-overlay-sound').value === 'true',
                        animation: document.getElementById('set-overlay-animation').value
                    },

                    homeTexts: {
                        welcomeTitle: document.getElementById('set-welcome-title').value.trim(),
                        welcomeSubtitle: document.getElementById('set-welcome-subtitle').value.trim(),
                        supportBtnText: document.getElementById('set-btn-text').value.trim(),
                        footerText: document.getElementById('set-footer-text').value.trim()
                    }
                };

                if (window.firebaseDB) {
                    await window.firebaseDB.saveSettings(updatedSettings);

                    window.firebaseDB.logAuditAction({
                        adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                        action: "Settings Change",
                        supporterName: "N/A",
                        amount: 0,
                        details: "Updated site configuration settings"
                    });

                    alert("Settings updated successfully across the site!");
                }
            } catch (err) {
                console.error("Error saving settings:", err);
                alert("Failed to save settings. Please try again.");
            }
        });
    }

    const restoreDefaultsBtn = document.getElementById('btn-restore-defaults');
    if (restoreDefaultsBtn) {
        restoreDefaultsBtn.addEventListener('click', () => {
            if (STATE.currentAdmin && STATE.currentAdmin.role !== 'owner') {
                alert("Access Denied: Only Owners can restore defaults.");
                return;
            }
            const confirmReset = confirm("Are you sure you want to restore default settings?");
            if (confirmReset && window.firebaseDB) {
                window.firebaseDB.resetSettings(DEFAULT_SETTINGS).then(() => {
                    window.firebaseDB.logAuditAction({
                        adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                        action: "Restore Default Settings",
                        supporterName: "N/A",
                        amount: 0,
                        details: "Restored settings to default values"
                    });
                    populateSettingsForm();
                    alert("Default settings restored successfully.");
                });
            }
        });
    }

    const resetStatsBtn = document.getElementById('btn-reset-stats');
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', () => {
            if (STATE.currentAdmin && STATE.currentAdmin.role !== 'owner') {
                alert("Access Denied: Only Owners can reset stream statistics.");
                return;
            }
            const confirmReset = confirm("Are you sure you want to reset all stream statistics? This action cannot be undone.");
            if (confirmReset) {
                resetStatsBtn.disabled = true;
                resetStatsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

                if (window.firebaseDB && firebase && firebase.database) {
                    const p1 = firebase.database().ref("approvedSupport").remove();
                    const p2 = firebase.database().ref("overlayQueue").remove();

                    Promise.all([p1, p2]).then(() => {
                        window.firebaseDB.logAuditAction({
                            adminEmail: STATE.currentAdmin ? STATE.currentAdmin.email : "System",
                            action: "Reset Statistics",
                            supporterName: "N/A",
                            amount: 0,
                            details: "Cleared all approved support and overlay queue records"
                        });
                        STATE.approvedSupporters = [];
                        renderUI();
                        alert("Statistics have been reset successfully.");
                    }).finally(() => {
                        resetStatsBtn.disabled = false;
                        resetStatsBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset Stats';
                    });
                }
            }
        });
    }

    const cursorGlow = document.getElementById('cursor-glow');
    if (cursorGlow) {
        window.addEventListener('mousemove', (e) => {
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';
        });
    }

    document.querySelectorAll('.tilt-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width/2;
            const y = e.clientY - rect.top - rect.height/2;
            card.style.transform = `rotateY(${x/25}deg) rotateX(${-y/25}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'rotateY(0deg) rotateX(0deg)';
        });
    });

    const customInput = document.getElementById('custom-amount');
    const warningEl = document.getElementById('amount-warning');

    if (customInput) {
        customInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const minAmt = STATE.settings.minAmount || 40;
            const maxAmt = STATE.settings.maxAmount || 50000;

            if (!val || val < minAmt || val > maxAmt) {
                if (warningEl) warningEl.style.display = 'block';
                STATE.selectedAmount = minAmt;
            } else {
                if (warningEl) warningEl.style.display = 'none';
                STATE.selectedAmount = val;
                document.querySelectorAll('.donation-card').forEach(c => c.classList.remove('active'));
            }
            updateRealQRCode();
        });
    }

    const msgArea = document.getElementById('supporter-message');
    const charCounter = document.getElementById('char-count');
    if (msgArea && charCounter) {
        msgArea.addEventListener('input', (e) => {
            charCounter.textContent = e.target.value.length;
        });
    }

    const form = document.getElementById('tip-form');
    const confirmModal = document.getElementById('confirm-payment-modal');
    const btnPaidYes = document.getElementById('btn-paid-yes');
    const btnPaidCancel = document.getElementById('btn-paid-cancel');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nameInput = document.getElementById('supporter-name');
            const msgInput = document.getElementById('supporter-message');

            const name = nameInput ? nameInput.value.trim() : '';
            const msg = msgInput ? msgInput.value.trim() : '';
            const amount = STATE.selectedAmount;
            const minAmt = STATE.settings.minAmount || 40;

            if (!name || !amount || amount < minAmt) {
                alert(`Please enter a valid name and amount (Minimum ${STATE.settings.currencySymbol || '₹'}${minAmt}).`);
                return;
            }

            playDingSound();

            const now = new Date();
            const timeSubmitted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            STATE.activeSubmission = {
                name,
                amount: Number(amount),
                msg,
                timeSubmitted,
                status: STATUS.AWAITING_VERIFICATION
            };

            const note = `${name}: ${msg}`.substring(0, 50);
            const upiUrl = `upi://pay?pa=${encodeURIComponent(STATE.upiId)}&pn=${encodeURIComponent(STATE.payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

            try { window.location.href = upiUrl; } catch(err){}

            setTimeout(() => {
                if (confirmModal) confirmModal.classList.add('active');
            }, 600);
        });
    }

    if (btnPaidYes) {
        btnPaidYes.addEventListener('click', () => {
            if (confirmModal) confirmModal.classList.remove('active');

            if (STATE.activeSubmission && window.firebaseDB) {
                window.firebaseDB.addPendingSupport(STATE.activeSubmission).then(() => {
                    sendAdminEmailNotification(STATE.activeSubmission);

                    STATE.activeSubmission = null;

                    const nameInput = document.getElementById('supporter-name');
                    const msgInput = document.getElementById('supporter-message');
                    if (nameInput) nameInput.value = '';
                    if (msgInput) msgInput.value = '';
                    if (charCounter) charCounter.textContent = '0';

                    const thankyouModal = document.getElementById('thankyou-modal');
                    if (thankyouModal) thankyouModal.classList.add('active');
                }).catch(err => {
                    console.error("Firebase Add Pending Error:", err);
                    alert("Unable to submit request. Please check connection.");
                });
            }
        });
    }

    if (btnPaidCancel) {
        btnPaidCancel.addEventListener('click', () => {
            if (confirmModal) confirmModal.classList.remove('active');
            STATE.activeSubmission = null;
        });
    }
});