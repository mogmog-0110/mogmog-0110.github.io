// Jupiter Background - Full-screen shader background
class JupiterBackground {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.mesh = null;

        this.init();
    }

    init() {
        // Full-screen plane geometry
        const geometry = new THREE.PlaneGeometry(2, 2);

        // Jupiter shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uMouse: { value: new THREE.Vector2(0, 0) }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            depthWrite: false,
            depthTest: false
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.frustumCulled = false;

        // Create separate camera for background
        this.bgCamera = new THREE.Camera();
        this.bgScene = new THREE.Scene();
        this.bgScene.add(this.mesh);
    }

    getVertexShader() {
        return `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;
    }

    getFragmentShader() {
        return `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            varying vec2 vUv;

            // Simplex 3D Noise
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

                vec3 i  = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);

                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);

                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;

                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;

                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);

                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);

                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);

                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));

                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);

                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;

                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }

            // Jupiter bands
            float jupiterBands(vec2 uv) {
                float bands = 0.0;

                // Horizontal bands
                bands += sin(uv.y * 8.0 + uTime * 0.02) * 0.3;
                bands += sin(uv.y * 16.0 - uTime * 0.01) * 0.15;
                bands += sin(uv.y * 32.0 + uTime * 0.005) * 0.075;

                // Distort with noise
                float noise = snoise(vec3(uv * 2.0, uTime * 0.05));
                bands += noise * 0.2;

                return bands;
            }

            // Great Red Spot (swirl)
            float greatRedSpot(vec2 uv, vec2 center, float size) {
                vec2 d = uv - center;
                float dist = length(d);

                if (dist > size) return 0.0;

                // Spiral rotation
                float angle = atan(d.y, d.x);
                float spiral = angle + dist * 10.0 - uTime * 0.3;

                // Spiral pattern
                float pattern = sin(spiral * 3.0) * 0.5 + 0.5;
                pattern *= smoothstep(size, size * 0.3, dist);

                return pattern;
            }

            void main() {
                vec2 uv = vUv;

                // Aspect ratio correction
                float aspect = uResolution.x / uResolution.y;
                uv.x *= aspect;

                // Bands
                float bands = jupiterBands(uv);

                // Great Red Spot (center-upper)
                vec2 spotCenter = vec2(aspect * 0.5, 0.55);
                float spot = greatRedSpot(uv, spotCenter, 0.4);

                // Color mixing (warm tones)
                vec3 darkBand = vec3(0.545, 0.412, 0.078);   // #8B6914
                vec3 lightBand = vec3(0.910, 0.835, 0.639);  // #E8D5A3
                vec3 orange = vec3(0.831, 0.584, 0.416);     // #D4956A
                vec3 cream = vec3(0.961, 0.925, 0.843);      // #F5ECD7

                // Band colors
                vec3 color = mix(darkBand, lightBand, bands * 0.5 + 0.5);

                // Overlay Great Red Spot
                color = mix(color, orange, spot * 0.7);

                // Vignette (edge darkening)
                vec2 center = vec2(0.5 * aspect, 0.5);
                float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - center));
                color *= vignette * 0.3 + 0.7;

                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }

    update(time, mouseX = 0, mouseY = 0) {
        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uMouse.value.set(mouseX, mouseY);
    }

    render() {
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.renderer.render(this.bgScene, this.bgCamera);
    }

    onResize(width, height) {
        this.mesh.material.uniforms.uResolution.value.set(width, height);
    }
}
