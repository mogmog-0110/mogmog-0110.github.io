// Coin Laundry Machine - Business-type washing machine
// Deep red (#8B2020) + Black + Large window (radius 0.7) + Handle

class CoinLaundryMachine extends THREE.Group {
    constructor() {
        super();

        this.name = 'coinLaundryMachine';

        // Create components
        this.body = this.createBody();
        this.frontPanel = this.createFrontPanel();
        this.controlPanel = this.createControlPanel();
        this.door = this.createDoor();
        this.windowGlass = this.createWindowGlass();
        this.handle = this.createHandle();
        this.base = this.createBase();
        this.legs = this.createLegs();

        // Add all components
        this.add(this.body);
        this.add(this.frontPanel);
        this.add(this.controlPanel);
        this.add(this.door);
        this.add(this.windowGlass);
        this.add(this.handle);
        this.add(this.base);
        this.legs.forEach(leg => this.add(leg));

        // Add buttons to control panel
        this.addButtons();
    }

    createBody() {
        // Black box (sides and back)
        const geometry = new THREE.BoxGeometry(2.0, 2.5, 1.8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.3,
            roughness: 0.8,
        });
        const body = new THREE.Mesh(geometry, material);
        body.position.y = 0;
        body.castShadow = true;
        body.receiveShadow = true;
        return body;
    }

    createFrontPanel() {
        // Deep red front panel (#8B2020)
        const geometry = new THREE.BoxGeometry(2.02, 2.0, 0.1);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B2020,  // Deep red
            metalness: 0.2,
            roughness: 0.6,
        });
        const panel = new THREE.Mesh(geometry, material);
        panel.position.set(0, -0.25, 0.9);
        panel.castShadow = true;
        return panel;
    }

    createControlPanel() {
        // Upper control panel (beige #d4c4b0)
        const geometry = new THREE.BoxGeometry(2.02, 0.5, 0.15);
        const material = new THREE.MeshStandardMaterial({
            color: 0xd4c4b0,  // Beige
            metalness: 0.1,
            roughness: 0.5,
        });
        const panel = new THREE.Mesh(geometry, material);
        panel.position.set(0, 1.0, 0.92);
        panel.castShadow = true;
        return panel;
    }

    addButtons() {
        // Add buttons and LEDs to control panel
        const buttonGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
        const buttonMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.5,
            roughness: 0.3
        });

        for (let i = 0; i < 3; i++) {
            const button = new THREE.Mesh(buttonGeom, buttonMat);
            button.rotation.x = Math.PI / 2;
            button.position.set(-0.5 + i * 0.3, 1.0, 1.0);
            this.add(button);
        }

        // Add LED indicator
        const ledGeom = new THREE.BoxGeometry(0.15, 0.08, 0.01);
        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            metalness: 0.1,
            roughness: 0.2
        });
        const led = new THREE.Mesh(ledGeom, ledMat);
        led.position.set(0.6, 1.0, 1.0);
        this.add(led);
    }

    createDoor() {
        // Round door frame (chrome) - LARGE (radius 0.7)
        const geometry = new THREE.TorusGeometry(0.7, 0.08, 16, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xC0C0C0,
            metalness: 0.9,
            roughness: 0.1,
        });
        const door = new THREE.Mesh(geometry, material);
        door.position.set(0, -0.3, 0.96);
        door.castShadow = true;
        return door;
    }

    createWindowGlass() {
        // Window interior (dark + subtle swirl) - LARGE (radius 0.65)
        const geometry = new THREE.CircleGeometry(0.65, 32);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec2 vUv;

                void main() {
                    vec2 uv = vUv - 0.5;
                    float dist = length(uv);

                    // Dark background
                    vec3 darkColor = vec3(0.03, 0.03, 0.05);

                    // Very subtle swirl (barely visible laundry silhouette)
                    float angle = atan(uv.y, uv.x);
                    float spiral = sin(angle * 2.0 + dist * 3.0 - uTime * 0.3);
                    spiral = spiral * 0.5 + 0.5;
                    spiral *= smoothstep(0.65, 0.1, dist);

                    vec3 color = darkColor + spiral * 0.05;

                    // Subtle reflection highlight
                    float highlight = pow(1.0 - dist, 5.0) * 0.1;
                    color += highlight;

                    gl_FragColor = vec4(color, 1.0);
                }
            `,
        });

        const glass = new THREE.Mesh(geometry, material);
        glass.position.set(0, -0.3, 0.97);
        return glass;
    }

    createHandle() {
        // Handle (horizontal bar + top/bottom mounts on right side of window)
        const handleGroup = new THREE.Group();

        const handleMat = new THREE.MeshStandardMaterial({
            color: 0x666666,  // Darker chrome
            metalness: 0.8,
            roughness: 0.2,
        });

        // Main bar (horizontal)
        const barGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 16);
        const bar = new THREE.Mesh(barGeom, handleMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0.85, -0.3, 1.0);
        bar.castShadow = true;
        handleGroup.add(bar);

        // Top mount
        const mountGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.08, 16);
        const topMount = new THREE.Mesh(mountGeom, handleMat);
        topMount.position.set(0.85, -0.15, 0.98);
        topMount.castShadow = true;
        handleGroup.add(topMount);

        // Bottom mount
        const bottomMount = new THREE.Mesh(mountGeom, handleMat);
        bottomMount.position.set(0.85, -0.45, 0.98);
        bottomMount.castShadow = true;
        handleGroup.add(bottomMount);

        return handleGroup;
    }

    createBase() {
        // Lower base platform
        const geometry = new THREE.BoxGeometry(2.1, 0.2, 1.9);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.3,
            roughness: 0.7,
        });
        const base = new THREE.Mesh(geometry, material);
        base.position.set(0, -1.35, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        return base;
    }

    createLegs() {
        const legs = [];
        const positions = [
            [-0.8, -1.55, 0.7],
            [0.8, -1.55, 0.7],
            [-0.8, -1.55, -0.7],
            [0.8, -1.55, -0.7],
        ];

        const geometry = new THREE.CylinderGeometry(0.08, 0.1, 0.2, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.5,
            roughness: 0.5,
        });

        positions.forEach(pos => {
            const leg = new THREE.Mesh(geometry, material);
            leg.position.set(...pos);
            leg.castShadow = true;
            legs.push(leg);
        });

        return legs;
    }

    update(time) {
        // Update window shader
        this.windowGlass.material.uniforms.uTime.value = time;
    }
}
