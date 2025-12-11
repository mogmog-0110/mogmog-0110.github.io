// Page Scene - Scene for other pages (portfolio, research, creation, skills)
// Same cosmic background + stars + distant washing machine + CRT filter

class PageScene {
    constructor(pageConfig) {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.crtPass = null;
        this.particles = null;
        this.washingMachine = null;
        this.config = pageConfig;

        this.init();
        this.setupPostProcessing();
        this.animate();
    }

    init() {
        // Scene with deep black background
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050508);
        this.scene.fog = new THREE.Fog(0x050508, 50, 200);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        this.camera.position.set(0, 0, 15);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const canvas = document.getElementById('cosmic-canvas');
        if (canvas) {
            canvas.appendChild(this.renderer.domElement);
        }

        // Lights
        this.setupLights();

        // Star particles (必須)
        this.particles = new ParticleSystem();
        this.scene.add(this.particles.points);

        // Washing machine (遠くに小さく)
        this.washingMachine = new CoinLaundryMachine();
        this.washingMachine.position.set(...this.config.position);
        this.washingMachine.scale.setScalar(this.config.scale);
        this.scene.add(this.washingMachine);

        // Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        // Ambient light (very dim)
        const ambientLight = new THREE.AmbientLight(0x222233, 0.3);
        this.scene.add(ambientLight);

        // Main directional light (cool white)
        const mainLight = new THREE.DirectionalLight(0xfff5e0, 0.8);
        mainLight.position.set(10, 5, 10);
        this.scene.add(mainLight);

        // Fill light (subtle blue)
        const fillLight = new THREE.DirectionalLight(0x88c8ff, 0.15);
        fillLight.position.set(-5, 0, 5);
        this.scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
        rimLight.position.set(0, 3, -5);
        this.scene.add(rimLight);
    }

    setupPostProcessing() {
        // Check if EffectComposer is available
        if (typeof THREE.EffectComposer === 'undefined') {
            console.warn('EffectComposer not available, CRT effect will be disabled');
            return;
        }

        // Create composer
        this.composer = new THREE.EffectComposer(this.renderer);

        // Render pass - renders the entire scene (including washing machine)
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // CRT filter pass - applies to everything rendered by renderPass
        this.crtPass = new THREE.ShaderPass(CRTShader);
        this.crtPass.renderToScreen = true;  // Ensure this is the final output
        this.composer.addPass(this.crtPass);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    update() {
        const time = performance.now() * 0.001;

        // Update particles
        if (this.particles) {
            this.particles.update();
        }

        // Update washing machine (tumbling for other pages)
        if (this.washingMachine) {
            this.washingMachine.rotation.x = Math.sin(time * 0.2) * 0.15;
            this.washingMachine.rotation.y = time * 0.08;
            this.washingMachine.rotation.z = Math.sin(time * 0.25) * 0.12;

            this.washingMachine.update(time);
        }

        // Update CRT effect time
        if (this.crtPass) {
            this.crtPass.uniforms.uTime.value = time;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Page configurations (洗濯機を上部に配置)
const pageConfigs = {
    portfolio: {
        position: [4, 3.5, -6],  // 右上に配置
        scale: 0.4
    },
    research: {
        position: [-4, 3.5, -6],  // 左上に配置
        scale: 0.4
    },
    creation: {
        position: [0, 4, -7],  // 中央上に配置
        scale: 0.4
    },
    skills: {
        position: [3, 3.5, -6],  // 右上に配置
        scale: 0.4
    }
};

// Initialize based on page
function initPageScene() {
    const pageName = document.body.dataset.page;
    const config = pageConfigs[pageName];

    if (config) {
        new PageScene(config);
    } else {
        console.error('Unknown page:', pageName);
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageScene);
} else {
    initPageScene();
}

// Smooth fade in
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});
