// Nebula Fragment Shader
// Creates a swirling nebula effect inside the washing machine window

uniform float time;
uniform vec2 resolution;

varying vec2 vUv;

// Simple noise function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// 2D Noise based on Morgan McGuire @morgan3d
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

// Fractal Brownian Motion
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;

    for (int i = 0; i < 6; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 st = vUv;

    // Center coordinates
    vec2 center = st - 0.5;
    float dist = length(center);

    // Create circular mask for window
    float mask = smoothstep(0.5, 0.48, dist);

    // Rotate coordinates over time (washing machine spin)
    float angle = time * 0.3;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rotatedSt = rotation * center + 0.5;

    // Create swirling effect
    float swirl = atan(center.y, center.x) + time * 0.5;
    vec2 swirlSt = rotatedSt + vec2(cos(swirl), sin(swirl)) * 0.1;

    // Generate nebula patterns with multiple octaves
    float n1 = fbm(swirlSt * 3.0 + time * 0.1);
    float n2 = fbm(swirlSt * 5.0 - time * 0.15);
    float n3 = fbm(swirlSt * 7.0 + time * 0.08);

    // Combine noise patterns
    float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Create color gradient (purple to blue to pink)
    vec3 color1 = vec3(0.4, 0.2, 0.8); // Purple
    vec3 color2 = vec3(0.2, 0.4, 0.9); // Blue
    vec3 color3 = vec3(0.9, 0.3, 0.6); // Pink

    vec3 color = mix(color1, color2, pattern);
    color = mix(color, color3, n2);

    // Add brightness variation
    color *= (0.5 + pattern * 0.5);

    // Add some "stars" or bright spots
    float stars = step(0.95, noise(swirlSt * 20.0));
    color += stars * vec3(1.0, 1.0, 1.0) * 0.5;

    // Fade out towards edges
    color *= smoothstep(0.5, 0.2, dist);

    // Apply mask and output
    gl_FragColor = vec4(color, mask);
}
