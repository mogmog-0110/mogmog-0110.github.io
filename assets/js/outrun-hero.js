/* ============================================================
   outrun-hero.js — OutRun 風 一人称ドライブ hero (synthwave / WebGL)
   ネオングリッドの路面が手前へ流れ（前進）、2D ヤシが迫り、
   夕日へ向かって疾走する一人称視点。車は出さない（自分が運転席）。
   hero 要素 (.outrun-hero) にスコープして 100vh ぶんだけ描く。
   ============================================================ */
import * as THREE from 'three';

const hero = document.querySelector('.outrun-hero');
const canvas = document.getElementById('or-gl');
if (hero && canvas) {
  const W = () => hero.clientWidth;
  const H = () => hero.clientHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1240, 40, 130);
  const camera = new THREE.PerspectiveCamera(64, W() / H(), 0.1, 400);
  camera.position.set(0, 1.9, 7);

  // ── ネオングリッドの路面（synthwave 定番。アスファルト/白破線は無し）──
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; varying float vF;
      void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz;
        vec4 mv=modelViewMatrix*vec4(position,1.0); vF=-mv.z;
        gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `precision highp float; varying vec3 vW; varying float vF; uniform float uTime;
      void main(){
        float x=vW.x, z=vW.z - uTime*16.0;                 // 手前へ流れる＝前進
        float fade=clamp(1.0-(vF-3.0)/120.0,0.0,1.0);      // 地平(夕日)まで伸ばして収束
        vec2 cell=abs(fract(vec2(x,z)*vec2(0.16,0.11)-0.5)-0.5);
        float l=min(cell.x,cell.y);
        float line=smoothstep(0.045,0.0,l);
        float glow=smoothstep(0.22,0.0,l)*0.5;
        vec3 gc=mix(vec3(1.0,0.16,0.62), vec3(0.30,0.95,1.0), clamp(vF/58.0,0.0,1.0)); // 手前マゼンタ→奥シアン
        float a=(line+glow)*fade;
        gl_FragColor=vec4(gc*(0.55+line), a); }`,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), gridMat);
  road.rotation.x = -Math.PI / 2;
  scene.add(road);

  // ── ヤシの木（2D 影絵）。canvas で濃紺シルエットを描き Sprite で道の両脇を流す ──
  function palmTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 170;
    const x = c.getContext('2d'); x.translate(64, 0); x.fillStyle = '#160a2e';
    x.beginPath(); x.moveTo(-5, 170); x.quadraticCurveTo(3, 95, 1, 46); x.lineTo(7, 46);
    x.quadraticCurveTo(9, 95, 6, 170); x.closePath(); x.fill();
    const tx = 4, ty = 46;
    for (let i = 0; i < 7; i++) {
      const a = (-Math.PI * 0.95) + (i / 6) * (Math.PI * 0.9), len = 44 + (i % 2) * 8;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len + 18;
      const mx = tx + Math.cos(a) * len * 0.5, my = ty + Math.sin(a) * len * 0.5 - 6;
      x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(mx, my, ex, ey);
      x.quadraticCurveTo(mx + 4, my + 8, tx, ty + 4); x.closePath(); x.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  const palmTex = palmTexture(); const palms = []; const PALM_N = 14, PALM_GAP = 12;
  for (let i = 0; i < PALM_N; i++) {
    const side = (i % 2 === 0) ? -1 : 1;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: palmTex, transparent: true, depthWrite: false }));
    sp.scale.set(9, 12, 1);
    sp.position.set(side * (8 + Math.random() * 2.5), 5.5, -10 - i * PALM_GAP);
    palms.push(sp); scene.add(sp);
  }

  function resize() {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  }
  addEventListener('resize', resize);

  let t = 0;
  let running = true;
  // hero が画面外なら描画を止めて省電力（スクロール後）
  const io = new IntersectionObserver((es) => { running = es[0].isIntersecting; },
    { threshold: 0.01 });
  io.observe(hero);

  function animate() {
    requestAnimationFrame(animate);
    if (!running) return;
    t += 1 / 60; gridMat.uniforms.uTime.value = t;
    for (const p of palms) { p.position.z += 1.2; if (p.position.z > 12) p.position.z -= PALM_N * PALM_GAP; }
    // 水平は固定（左右揺れ無し）= 道路の消失点が常に太陽のド真ん中へ収束する。
    camera.position.x = 0;
    camera.position.y = 1.9 + Math.sin(t * 6.0) * 0.05;     // 路面の振動（上下のみ）
    // 上向き ~7° にして地平線を画面 61%（CSS の太陽底・空グラデの境）へ一致させる
    camera.lookAt(0, 10.0, -60);
    renderer.render(scene, camera);
  }
  animate();
}
