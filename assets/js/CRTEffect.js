// CRT (Cathode Ray Tube) Retro Filter
// Scanlines, noise, chromatic aberration, vignette, warm tint
// Based on IMPLEMENTATION.md v3.1

const CRTShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uScanlineIntensity: { value: 0.35 },      // Even stronger scanlines (0.25 -> 0.35)
        uNoiseIntensity: { value: 0.12 },         // More visible noise (0.08 -> 0.12)
        uVignetteIntensity: { value: 0.5 },       // Stronger vignette (0.4 -> 0.5)
        uChromaticAberration: { value: 0.004 },   // More visible aberration (0.003 -> 0.004)
        uDistortion: { value: 0.08 },             // CRT screen curvature distortion
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uScanlineIntensity;
        uniform float uNoiseIntensity;
        uniform float uVignetteIntensity;
        uniform float uChromaticAberration;
        uniform float uDistortion;
        varying vec2 vUv;

        // Noise function
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec2 uv = vUv;

            // === CRT Screen Curvature ===
            vec2 centered = uv * 2.0 - 1.0;
            float r2 = centered.x * centered.x + centered.y * centered.y;
            uv = uv + centered * r2 * uDistortion;

            // === Chromatic Aberration ===
            float aberration = uChromaticAberration;
            vec2 dir = uv - 0.5;
            float dist = length(dir);

            float r = texture2D(tDiffuse, uv + dir * aberration).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - dir * aberration).b;

            vec3 color = vec3(r, g, b);

            // === Enhanced Scanlines with alternating pattern ===
            float scanline = sin(uv.y * 600.0) * 0.5 + 0.5;
            scanline = pow(scanline, 2.0) * uScanlineIntensity;
            color -= scanline;

            // Slow moving scanline effect
            float movingScanline = sin(uv.y * 300.0 - uTime * 3.0) * 0.03;
            color -= movingScanline;

            // === Film Grain Noise ===
            float noise = random(uv + uTime * 0.1) * uNoiseIntensity;
            color += noise - uNoiseIntensity * 0.5;

            // === Vignette (edge darkening) ===
            float vignette = 1.0 - dist * uVignetteIntensity * 2.0;
            vignette = clamp(vignette, 0.0, 1.0);
            vignette = pow(vignette, 2.0);
            color *= vignette;

            // === Warm tint (slight reddish for retro look) ===
            color.r *= 1.05;
            color.b *= 0.95;

            // === Phosphor glow simulation ===
            color = pow(color, vec3(0.95));

            gl_FragColor = vec4(color, 1.0);
        }
    `,
};
