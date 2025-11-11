// Terminal effects and animations

document.addEventListener('DOMContentLoaded', function() {
    // Add scanline effect
    addScanlineEffect();
    
    // Add random glitch effect
    addGlitchEffect();
    
    // Add particle effects
    addParticles();
});

// Add subtle scanline overlay
function addScanlineEffect() {
    const scanline = document.createElement('div');
    scanline.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
            to bottom,
            transparent 50%,
            rgba(0, 217, 255, 0.02) 50%
        );
        background-size: 100% 4px;
        pointer-events: none;
        z-index: 9999;
        animation: scanlines 8s linear infinite;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes scanlines {
            0% { transform: translateY(0); }
            100% { transform: translateY(4px); }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(scanline);
}

// Random glitch effect on title
function addGlitchEffect() {
    const title = document.querySelector('.terminal-title');
    if (!title) return;
    
    setInterval(() => {
        if (Math.random() > 0.95) {
            title.style.textShadow = '2px 0 #ff00ff, -2px 0 #00ffff';
            title.style.transform = 'translate(' + (Math.random() * 2 - 1) + 'px, ' + (Math.random() * 2 - 1) + 'px)';
            
            setTimeout(() => {
                title.style.textShadow = '0 0 10px rgba(0, 217, 255, 0.8)';
                title.style.transform = 'translate(0, 0)';
            }, 100);
        }
    }, 2000);
}

// Add floating particles
function addParticles() {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
    `;
    
    // Create multiple particles
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 3 + 1;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        const startX = Math.random() * 100;
        
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, rgba(0, 217, 255, 0.8), transparent);
            border-radius: 50%;
            top: 100%;
            left: ${startX}%;
            animation: float ${duration}s linear ${delay}s infinite;
            box-shadow: 0 0 ${size * 2}px rgba(0, 217, 255, 0.5);
        `;
        
        container.appendChild(particle);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes float {
            0% {
                transform: translateY(0) translateX(0);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% {
                transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
                opacity: 0;
            }
        }
    `;
    
    document.head.appendChild(style);
    document.body.insertBefore(container, document.body.firstChild);
}

// Add hover effect to navigation items
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('mouseenter', function() {
        this.style.borderColor = '#00ffff';
    });
    
    item.addEventListener('mouseleave', function() {
        this.style.borderColor = '#00d9ff';
    });
});

// Add click effect
document.addEventListener('click', function(e) {
    const ripple = document.createElement('div');
    ripple.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(0, 217, 255, 0.8);
        border-radius: 50%;
        pointer-events: none;
        left: ${e.clientX - 10}px;
        top: ${e.clientY - 10}px;
        animation: ripple 0.6s ease-out;
        z-index: 10000;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(3);
                opacity: 0;
            }
        }
    `;
    
    if (!document.querySelector('style[data-ripple]')) {
        style.setAttribute('data-ripple', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

// Add typing indicator on page load
window.addEventListener('load', function() {
    const cursor = document.querySelector('.cursor');
    if (cursor) {
        setTimeout(() => {
            cursor.style.animation = 'blink 1s step-end infinite';
        }, 2000);
    }
});
