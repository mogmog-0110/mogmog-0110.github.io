// Particle System for Star Field (Small, Subtle, with Twinkle)
// Based on IMPLEMENTATION.md v3.1

class ParticleSystem {
    constructor() {
        this.points = null;
        this.count = this.isMobile() ? 1000 : 2000;  // Smaller count
        this.positions = null;
        this.velocities = null;

        this.init();
    }

    isMobile() {
        return window.innerWidth < 768;
    }

    init() {
        // Geometry
        const geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        const brightness = new Float32Array(this.count);

        // Initialize particle positions, velocities, sizes, and brightness
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            // Random position in a sphere (far distance: 80-200)
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const radius = 80 + Math.random() * 120;

            this.positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            this.positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            this.positions[i3 + 2] = radius * Math.cos(phi);

            // Very small velocities for slow drift
            this.velocities[i3] = (Math.random() - 0.5) * 0.001;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.001;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.001;

            // Varied sizes (some larger, some smaller)
            const sizeVariation = Math.random();
            if (sizeVariation > 0.85) {
                // 15% are larger stars
                sizes[i] = Math.random() * 2.5 + 2.0;
            } else if (sizeVariation > 0.7) {
                // 15% are medium stars
                sizes[i] = Math.random() * 1.5 + 1.0;
            } else {
                // 70% are small stars
                sizes[i] = Math.random() * 1.0 + 0.3;
            }

            // Brightness variation
            brightness[i] = Math.random() * 0.5 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));

        // Material with custom shader for twinkle effect
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: `
                uniform float uTime;
                uniform float uPixelRatio;
                attribute float size;
                attribute float brightness;
                varying float vBrightness;

                void main() {
                    vBrightness = brightness;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                    // Twinkle effect
                    float twinkle = sin(uTime * 2.0 + position.x * 5.0) * 0.3 + 0.7;

                    gl_PointSize = size * uPixelRatio * (100.0 / -mvPosition.z) * twinkle;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vBrightness;

                void main() {
                    float dist = length(gl_PointCoord - 0.5);
                    if (dist > 0.5) discard;

                    // Soft circular gradient
                    float alpha = smoothstep(0.5, 0.0, dist) * vBrightness * 0.8;

                    // Slightly warm color tint
                    vec3 color = mix(vec3(1.0), vec3(1.0, 0.95, 0.9), 0.3);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geometry, material);
    }

    update() {
        const time = performance.now() * 0.001;
        const positions = this.points.geometry.attributes.position.array;

        // Update particle positions with slow drift
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            positions[i3] += this.velocities[i3];
            positions[i3 + 1] += this.velocities[i3 + 1];
            positions[i3 + 2] += this.velocities[i3 + 2];

            // Wrap around if particles drift too far
            for (let j = 0; j < 3; j++) {
                const idx = i3 + j;
                if (Math.abs(positions[idx]) > 200) {
                    positions[idx] = -positions[idx] * 0.5;
                }
            }
        }

        this.points.geometry.attributes.position.needsUpdate = true;

        // Update shader time for twinkle effect
        this.points.material.uniforms.uTime.value = time;

        // Very slow rotation
        this.points.rotation.y += 0.0001;
    }
}
