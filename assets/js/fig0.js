/* ============================================================
   fig.0 — SDF raymarching / 輪郭線 + ハッチング（銅版画風）
   外部モデル・外部ライブラリなし。球と gyroid の交差で
   手続き的に形状を作り、陰影は線の密度だけで表現する。
   光源方向はカーソルに追従する。
   WebGL が使えない環境では静的画像にフォールバック。
   ============================================================ */
(function () {
    var canvas = document.getElementById('fig0');
    if (!canvas) return;

    function fallback() {
        var img = document.createElement('img');
        img.className = 'fig-fallback';
        img.src = 'images/sdf-face/threshold_maps.webp';
        img.alt = 'SDF 顔影のしきい値マップ（静的フォールバック画像）';
        canvas.replaceWith(img);
    }

    var gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) { fallback(); return; }

    var VS = [
        'attribute vec2 aPos;',
        'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
    ].join('\n');

    var FS = [
        'precision highp float;',
        'uniform vec2 uRes;',
        'uniform float uTime;',
        'uniform vec3 uLight;',
        '',
        'mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }',
        '',
        'float map(vec3 p) {',
        '    p.xz *= rot(uTime * 0.22);',
        '    p.xy *= rot(0.35);',
        '    float sph = length(p) - 1.05;',
        '    vec3 q = p * 4.6;',
        '    float gyr = abs(dot(sin(q), cos(q.zxy))) / 4.6 - 0.045;',
        '    return max(sph, gyr);',
        '}',
        '',
        'vec3 normalAt(vec3 p) {',
        '    vec2 e = vec2(0.0015, 0.0);',
        '    return normalize(vec3(',
        '        map(p + e.xyy) - map(p - e.xyy),',
        '        map(p + e.yxy) - map(p - e.yxy),',
        '        map(p + e.yyx) - map(p - e.yyx)));',
        '}',
        '',
        'float hatch(vec2 q, float ang, float freq) {',
        '    vec2 dir = vec2(cos(ang), sin(ang));',
        '    float d = abs(fract(dot(q, dir) * freq) - 0.5) * 2.0;',
        '    return smoothstep(0.42, 0.30, d);',
        '}',
        '',
        'void main() {',
        '    vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;',
        '    vec3 ro = vec3(0.0, 0.0, 3.1);',
        '    vec3 rd = normalize(vec3(uv, -2.1));',
        '',
        '    float t = 0.0; float hit = -1.0;',
        '    for (int i = 0; i < 110; i++) {',
        '        vec3 p = ro + rd * t;',
        '        float d = map(p);',
        '        if (d < 0.0012) { hit = 1.0; break; }',
        '        t += d * 0.7;',
        '        if (t > 6.0) break;',
        '    }',
        '',
        '    float ink = 0.0;',
        '    if (hit > 0.0) {',
        '        vec3 p = ro + rd * t;',
        '        vec3 n = normalAt(p);',
        '        float fres = clamp(dot(n, -rd), 0.0, 1.0);',
        '        float tone = clamp(dot(n, normalize(uLight)), 0.0, 1.0);',
        '',
        '        /* 輪郭線：視線と直交する面 */',
        '        ink = max(ink, smoothstep(0.30, 0.16, fres));',
        '',
        '        /* ハッチング：トーンに応じて線を重ねる */',
        '        vec2 hq = gl_FragCoord.xy / uRes.y;',
        '        float b1 = smoothstep(0.66, 0.52, tone);',
        '        float b2 = smoothstep(0.40, 0.28, tone);',
        '        float b3 = smoothstep(0.18, 0.08, tone);',
        '        ink = max(ink, hatch(hq,  0.785, 64.0) * b1 * 0.82);',
        '        ink = max(ink, hatch(hq, -0.785, 64.0) * b2 * 0.88);',
        '        ink = max(ink, hatch(hq,  0.12, 88.0) * b3 * 0.95);',
        '    }',
        '',
        '    vec3 paper = vec3(0.988, 0.988, 0.984);',
        '    vec3 inkCol = vec3(0.102, 0.110, 0.122);',
        '    gl_FragColor = vec4(mix(paper, inkCol, ink), 1.0);',
        '}'
    ].join('\n');

    function compile(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
        return s;
    }

    var vs = compile(gl.VERTEX_SHADER, VS);
    var fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { fallback(); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback(); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uLight = gl.getUniformLocation(prog, 'uLight');

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var light = [0.5, 0.65, 0.6];
    var target = light.slice();
    var hasPointer = false;
    var visible = true;

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(canvas.clientWidth * dpr);
        var h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    window.addEventListener('pointermove', function (e) {
        hasPointer = true;
        var r = canvas.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var x = Math.max(-1.2, Math.min(1.2, (e.clientX - cx) / (r.width * 0.6)));
        var y = Math.max(-1.2, Math.min(1.2, (cy - e.clientY) / (r.height * 0.6)));
        target = [x, y, 0.55];
    }, { passive: true });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
        }).observe(canvas);
    }

    var start = performance.now();

    function frame(now) {
        requestAnimationFrame(frame);
        if (!visible) return;
        resize();
        var t = (now - start) / 1000;
        if (!hasPointer) {
            target = [
                Math.cos(t * 0.3) * 0.55,
                0.5 + Math.sin(t * 0.17) * 0.3,
                0.6
            ];
        }
        for (var i = 0; i < 3; i++) light[i] += (target[i] - light[i]) * 0.06;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, reduceMotion ? 0.0 : t);
        gl.uniform3f(uLight, light[0], light[1], light[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    requestAnimationFrame(frame);
})();
