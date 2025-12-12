// Main initialization script
// Deep black space + subtle star particles + red washing machine

let cosmicScene;
let particleSystem;
let coinLaundryMachine;

// Update washing machine position based on device width
function updateWashingMachinePosition() {
    if (!coinLaundryMachine) return;

    const isMobile = window.innerWidth <= 1024;
    if (isMobile) {
        // Center the washing machine on mobile/tablet
        coinLaundryMachine.position.set(0, 0.5, 0);
    } else {
        // Move to the left on desktop
        coinLaundryMachine.position.set(-4.2, 0, 0);
    }
}

function init() {
    // Show loading screen
    const loadingScreen = document.getElementById('loading-screen');

    try {
        // Check if THREE.js is loaded
        if (typeof THREE === 'undefined') {
            throw new Error('THREE.js library is not loaded. Please check your internet connection.');
        }

        console.log('THREE.js loaded successfully, version:', THREE.REVISION);

        // Initialize cosmic scene (black space)
        cosmicScene = new CosmicScene();

        // Create and add particle system (small, subtle stars)
        particleSystem = new ParticleSystem();
        cosmicScene.addParticles(particleSystem);

        // Create coin laundry machine
        coinLaundryMachine = new CoinLaundryMachine();
        // Position washing machine based on device width
        updateWashingMachinePosition();
        cosmicScene.addWashingMachine(coinLaundryMachine);

        // Update position on resize
        window.addEventListener('resize', updateWashingMachinePosition);

        // Hide loading screen after a short delay
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);

        // Setup navigation interactions
        setupNavigation();

    } catch (error) {
        console.error('Error initializing scene:', error);
        console.error('Error stack:', error.stack);
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div class="loader">
                    <p style="color: #ff6666;">Error loading scene</p>
                    <p style="font-size: 0.9rem; color: #ffb366;">${error.message}</p>
                    <p style="font-size: 0.8rem; margin-top: 1rem;">Please check the console for details</p>
                </div>
            `;
        }
    }
}

function setupNavigation() {
    // Navigation menu (no click on canvas - this is pure WebGL art)
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Don't interfere with hash links or external links
            if (href && !href.startsWith('#') && !href.startsWith('http')) {
                e.preventDefault();

                // Fade out animation before navigation (black screen, no white flash)
                const fadeOverlay = document.createElement('div');
                fadeOverlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #050508;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: 10000;
                    pointer-events: none;
                `;
                document.body.appendChild(fadeOverlay);

                // Trigger fade
                requestAnimationFrame(() => {
                    fadeOverlay.style.opacity = '1';
                });

                setTimeout(() => {
                    window.location.href = href;
                }, 300);
            }
        });
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Remove any loading artifacts
window.addEventListener('load', () => {
    // Page is already visible, just ensure everything is ready
    document.body.style.visibility = 'visible';
});
