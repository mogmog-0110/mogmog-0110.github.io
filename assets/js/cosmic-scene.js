// Cosmic Scene - Main Three.js Scene Setup
// Deep black space with subtle star particles + CRT filter

class CosmicScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;  // For post-processing
        this.crtPass = null;   // CRT effect pass
        this.particles = null;
        this.washingMachine = null;
        this.mouse = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0 };
        this.currentRotation = { x: 0, y: 0 };

        this.init();
        this.setupPostProcessing();
        this.animate();
    }

    init() {
        // Scene with deep black background
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050508);  // Deep black
        this.scene.fog = new THREE.Fog(0x050508, 50, 150);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        this.camera.position.set(0, 0, 15);  // Further back to see the whole scene

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const canvas = document.getElementById('cosmic-canvas');
        if (canvas) {
            canvas.appendChild(this.renderer.domElement);
        }

        // Lights (minimal, cool tones)
        this.setupLights();

        // Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
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

    setupLights() {
        // Ambient light (very dim)
        const ambientLight = new THREE.AmbientLight(0x404050, 0.3);
        this.scene.add(ambientLight);

        // Main directional light (cool white)
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // Fill light (subtle blue)
        const fillLight = new THREE.DirectionalLight(0x88c8ff, 0.2);
        fillLight.position.set(-5, 0, 3);
        this.scene.add(fillLight);

        // Rim light (white, for outline)
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
        rimLight.position.set(0, -3, -5);
        this.scene.add(rimLight);
    }

    onMouseMove(event) {
        // Normalize to -1 to 1
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = (event.clientY / window.innerHeight) * 2 - 1;

        this.mouse.x = x;
        this.mouse.y = y;

        // Gentle rotation (max ±10 degrees)
        this.targetRotation.y = x * 0.1;
        this.targetRotation.x = -y * 0.1;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update composer size
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    addParticles(particleSystem) {
        this.particles = particleSystem;
        this.scene.add(particleSystem.points);
    }

    addWashingMachine(washingMachine) {
        this.washingMachine = washingMachine;
        this.scene.add(washingMachine);
    }

    update() {
        const time = performance.now() * 0.001;

        // Update particles
        if (this.particles) {
            this.particles.update();
        }

        // Update washing machine
        if (this.washingMachine) {
            // Smooth mouse tracking (lerp 0.02)
            this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.02;
            this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.02;

            // === Tumbling animation (角回転 - floating in space) ===
            const tumbleX = Math.sin(time * 0.25) * 0.12;  // Faster pitch
            const tumbleY = time * 0.1;                     // Faster constant yaw rotation
            const tumbleZ = Math.sin(time * 0.3) * 0.1;    // Faster roll

            // Combine mouse tracking with tumbling
            this.washingMachine.rotation.x = tumbleX + this.currentRotation.x;
            this.washingMachine.rotation.y = tumbleY + this.currentRotation.y;
            this.washingMachine.rotation.z = tumbleZ;

            // Floating animation (up and down)
            this.washingMachine.position.y = Math.sin(time * 0.4) * 0.15;

            // Update machine
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

        // Render with post-processing if available, otherwise normal render
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
