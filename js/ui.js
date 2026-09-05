/* ===================================================================
   PAYUU LIVE PLATFORM V40 - BASE UI & INTERACTION CONTROLLER
   =================================================================== */

window.initUIModule = function() {
    // Spotlight Cursor Tracking
    const cursorGlow = document.getElementById('cursor-glow');
    if (cursorGlow) {
        window.addEventListener('mousemove', (e) => {
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';
        });
    }

    // 3D Card Tilt Effects
    document.querySelectorAll('.glass-panel').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width/2;
            const y = e.clientY - rect.top - rect.height/2;
            card.style.transform = `rotateY(${x/30}deg) rotateX(${-y/30}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'rotateY(0deg) rotateX(0deg)';
        });
    });

    // Enter Dashboard
    const enterBtn = document.getElementById('btn-enter-dashboard');
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            const welcome = document.getElementById('welcome-screen');
            if (welcome) welcome.style.display = 'none';
        });
    }
};