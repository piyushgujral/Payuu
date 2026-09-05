/* ===================================================================
   PAYUU LIVE PLATFORM V40 - GOLDEN NEBULA PARTICLES
   =================================================================== */

window.initGoldenParticles = function() {
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
};