// Washing Machine 3D Model (built from primitives)
// Based on IMPLEMENTATION.md

class WashingMachine extends THREE.Group {
    constructor() {
        super();

        this.name = 'washingMachine';

        // Create components
        this.body = this.createBody();
        this.doorFrame = this.createDoorFrame();
        this.windowGlass = this.createWindow();
        this.controlPanel = this.createControlPanel();
        this.legs = this.createLegs();

        // Add all components to group
        this.add(this.body);
        this.add(this.doorFrame);
        this.add(this.windowGlass);
        this.add(this.controlPanel);
        this.legs.forEach(leg => this.add(leg));

        // Add details
        this.addButtons();
        this.addDial();
    }

    createBody() {
        // Horizontal cylinder for the main body
        const geometry = new THREE.CylinderGeometry(1.5, 1.5, 2, 32);
        geometry.rotateZ(Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            color: 0xf5f0e1,  // Cream color
            metalness: 0.3,
            roughness: 0.7,
        });

        const body = new THREE.Mesh(geometry, material);
        body.castShadow = true;
        body.receiveShadow = true;

        return body;
    }

    createDoorFrame() {
        // Door frame (torus)
        const geometry = new THREE.TorusGeometry(0.8, 0.1, 16, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.2,
        });

        const frame = new THREE.Mesh(geometry, material);
        frame.position.x = 1.01;  // Position in front of the body
        frame.castShadow = true;

        return frame;
    }

    createWindow() {
        // Window glass (with custom shader)
        const geometry = new THREE.CircleGeometry(0.75, 32);

        // Placeholder material (will be replaced with shader)
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.8
        });

        const window = new THREE.Mesh(geometry, material);
        window.position.x = 1.02;

        return window;
    }

    createControlPanel() {
        const geometry = new THREE.BoxGeometry(0.3, 0.8, 0.1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xe8dcc8,
            metalness: 0.1,
            roughness: 0.8,
        });

        const panel = new THREE.Mesh(geometry, material);
        panel.position.set(1.01, 1.2, 0);
        panel.castShadow = true;

        return panel;
    }

    createLegs() {
        const legs = [];
        const positions = [
            [-0.8, -1.6, 0.6],
            [-0.8, -1.6, -0.6],
            [0.8, -1.6, 0.6],
            [0.8, -1.6, -0.6],
        ];

        positions.forEach(pos => {
            const geometry = new THREE.CylinderGeometry(0.1, 0.15, 0.2, 16);
            const material = new THREE.MeshStandardMaterial({
                color: 0x333333,
                metalness: 0.5,
                roughness: 0.5,
            });
            const leg = new THREE.Mesh(geometry, material);
            leg.position.set(...pos);
            leg.castShadow = true;
            legs.push(leg);
        });

        return legs;
    }

    addButtons() {
        // Add control buttons
        for (let i = 0; i < 3; i++) {
            const buttonGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
            const colors = [0xff4444, 0x44ff44, 0x4444ff];
            const buttonMaterial = new THREE.MeshStandardMaterial({
                color: colors[i],
                metalness: 0.6,
                roughness: 0.2,
                emissive: colors[i],
                emissiveIntensity: 0.3
            });
            const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
            button.position.set(1.01, 1.5 - i * 0.2, 0);
            button.rotation.z = Math.PI / 2;
            this.add(button);
        }
    }

    addDial() {
        // Add rotary dial
        const dialGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 32);
        const dialMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.7,
            roughness: 0.3
        });
        const dial = new THREE.Mesh(dialGeometry, dialMaterial);
        dial.position.set(1.01, 0.8, 0);
        dial.rotation.z = Math.PI / 2;
        this.add(dial);

        // Dial pointer
        const pointerGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.01);
        const pointerMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            metalness: 0.5,
            roughness: 0.5
        });
        const pointer = new THREE.Mesh(pointerGeometry, pointerMaterial);
        pointer.position.set(1.04, 0.88, 0);
        this.add(pointer);
    }

    setNebulaShader(shaderMaterial) {
        // Replace window material with nebula shader
        if (this.windowGlass && shaderMaterial) {
            this.windowGlass.material = shaderMaterial;
        }
    }

    update(time) {
        // Update window shader if it exists
        if (this.windowGlass && this.windowGlass.material.uniforms) {
            this.windowGlass.material.uniforms.uTime.value = time;
        }
    }
}
