// career-walk.js — 「経歴を歩く」横スクロール。
// サチが 2022 → 現在 を左→右に歩き、看板に重なると経歴情報が開く。
// 依存ゼロ（素 Canvas）。キーボード + タッチ対応。SKIP は HTML 側に常設。

(function () {
  'use strict';

  // ── 経歴マイルストーン（看板）。x は世界座標（px）──
  var MILESTONES = [
    { x: 360,  year: '2022', tag: 'START', icon: '🎓',
      title: '会津大学 入学', body: 'コンピュータ理工学部へ。ここから全部はじまった。' },
    { x: 760,  year: '2022', tag: 'TEAM', icon: '🕹',
      title: 'Down into...（初チーム開発）', body: 'チーム5人 / 2ヶ月。蒼翔祭2022・コミックマーケット101 で頒布。' },
    { x: 1180, year: '2023', tag: 'LEADER', icon: '⭐',
      title: '416 — 初めてのプロジェクトリーダー', body: 'チーム2人 / 2ヶ月。CS サマーキャンプ リーダー（1年目）。C103 頒布。' },
    { x: 1620, year: '2024', tag: 'TOOL', icon: '🛠',
      title: '劇場版ぱんドドド', body: 'チーム6人 / リーダー（2年連続）。自作ステージ制作ツールも開発。' },
    { x: 2080, year: '2025', tag: 'SHIP', icon: '🐸',
      title: 'かえるクレープへようこそ（Godot）', body: 'コミックマーケット106 で体験版を無料配布。代表作。' },
    { x: 2520, year: '2025', tag: 'ENGINE', icon: '⚙',
      title: 'MitiruEngine 開発開始', body: '必要な道具が無いなら作る。C++20 ヘッダオンリー自作ゲームエンジン。' },
    { x: 2980, year: '2025', tag: 'PAPER', icon: '📄',
      title: 'BDA 2025 論文発表（第一著者）', body: '剛体物理で化学現象を再現。Springer LNCS に出版。' },
    { x: 3420, year: '2026', tag: 'WORK', icon: '💼',
      title: '株式会社 Live2D（Cubism SDK for Native）', body: 'C++ プロダクションコードの保守・不具合対応。グラフィック API 実務。' },
  ];
  var GOAL_X = 3860;
  var WORLD_W = GOAL_X + 360;

  var GROUND_H = 90;          // 地面の高さ（画面下から）
  var SCALE = 4;              // ドットの拡大率
  var SPEED = 3.4;            // 歩行速度（world px / frame）
  var REACH = 70;             // 看板に反応する距離

  var canvas, ctx, panel, panelTitle, panelBody, hudFill, hudYear, promptEl, doneEl;
  var W = 0, H = 0;
  var started = false, paused = false, finished = false;
  var raf = 0;
  var keys = {};
  var touch = { left: false, right: false, act: false };

  var hero = { x: 120, y: 0, facing: 1, phase: 0, moving: false };
  var camX = 0;

  // ── 起動 ───────────────────────────────────────────
  function start() {
    if (started) { return; }
    started = true;
    var sec = document.getElementById('game');
    if (sec) { sec.style.display = 'block'; sec.scrollIntoView({ behavior: 'smooth' }); }
    bind();
    resize();
    loop();
  }
  window.startCareerWalk = start;

  // #game 直リンク（共有 / 検証）で自動開始する
  function autoStart() { if (location.hash === '#game') { start(); } }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart);
  } else {
    autoStart();
  }

  function el(id) { return document.getElementById(id); }

  function bind() {
    canvas = el('game-canvas');
    ctx = canvas.getContext('2d');
    panel = el('game-panel');
    panelTitle = el('game-panel-title');
    panelBody = el('game-panel-body');
    hudFill = el('hud-fill');
    hudYear = el('hud-year');
    promptEl = el('game-prompt');
    doneEl = el('game-done');

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey(true));
    window.addEventListener('keyup', onKey(false));

    // タッチボタン
    bindHold('btn-left', function (v) { touch.left = v; });
    bindHold('btn-right', function (v) { touch.right = v; });
    bindTap('btn-act', interact);

    el('game-panel-close').addEventListener('click', closePanel);
    canvas.addEventListener('click', interact); // クリックでも調べる
  }

  function onKey(down) {
    return function (e) {
      var k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', ' ', 'w', 'a', 'd'].indexOf(k) >= 0) {
        e.preventDefault();
      }
      keys[k] = down;
      if (down && (k === 'arrowup' || k === ' ' || k === 'w')) { interact(); }
      if (down && k === 'escape') { closePanel(); }
    };
  }

  function bindHold(id, set) {
    var b = el(id); if (!b) { return; }
    ['mousedown', 'touchstart'].forEach(function (ev) {
      b.addEventListener(ev, function (e) { e.preventDefault(); set(true); }, { passive: false });
    });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) {
      b.addEventListener(ev, function () { set(false); });
    });
  }
  function bindTap(id, fn) {
    var b = el(id); if (!b) { return; }
    b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
  }

  function resize() {
    if (!canvas) { return; }
    var r = canvas.getBoundingClientRect();
    W = canvas.width = Math.floor(r.width);
    H = canvas.height = Math.floor(r.height);
    ctx.imageSmoothingEnabled = false;
    hero.y = H - GROUND_H;
  }

  // ── ループ ─────────────────────────────────────────
  function loop() {
    raf = requestAnimationFrame(loop);
    update();
    render();
  }

  function update() {
    if (paused || finished) { hero.moving = false; return; }
    var left = keys['arrowleft'] || keys['a'] || touch.left;
    var right = keys['arrowright'] || keys['d'] || touch.right;
    hero.moving = false;
    if (left && !right) { hero.x -= SPEED; hero.facing = -1; hero.moving = true; }
    if (right && !left) { hero.x += SPEED; hero.facing = 1; hero.moving = true; }
    hero.x = Math.max(40, Math.min(WORLD_W - 40, hero.x));
    if (hero.moving) { hero.phase += 0.18; }

    camX = Math.max(0, Math.min(WORLD_W - W, hero.x - W * 0.42));

    // 進捗 HUD（2022 → NOW）
    var p = Math.max(0, Math.min(1, hero.x / GOAL_X));
    if (hudFill) { hudFill.style.width = (p * 100).toFixed(1) + '%'; }
    if (hudYear) {
      var nearest = nearestMilestone();
      hudYear.textContent = (hero.x >= GOAL_X - 40) ? 'NOW'
        : (nearest ? nearest.year : '2022');
    }

    // 看板の近接プロンプト
    var m = nearestMilestone();
    var near = m && Math.abs((m.x) - hero.x) < REACH;
    if (promptEl) { promptEl.classList.toggle('on', !!near && !paused); }
    hero._near = near ? m : null;

    // ゴール到達
    if (hero.x >= GOAL_X - 30 && !finished) { finish(); }
  }

  function nearestMilestone() {
    var best = null, bd = 1e9;
    for (var i = 0; i < MILESTONES.length; i++) {
      var d = Math.abs(MILESTONES[i].x - hero.x);
      if (d < bd) { bd = d; best = MILESTONES[i]; }
    }
    return best;
  }

  function interact() {
    if (!started || paused || finished) { return; }
    var m = hero._near;
    if (!m) { return; }
    m.visited = true;
    panelTitle.textContent = m.year + ' ・ ' + m.title;
    panelBody.textContent = m.body;
    panel.classList.add('on');
    paused = true;
  }
  function closePanel() {
    if (panel) { panel.classList.remove('on'); }
    paused = false;
  }

  function finish() {
    finished = true;
    if (doneEl) { doneEl.classList.add('on'); }
    if (promptEl) { promptEl.classList.remove('on'); }
  }

  // ── 描画 ───────────────────────────────────────────
  var COL = {
    sky1: '#161a2b', sky2: '#0d0f1a',
    hillFar: '#1c2240', hillNear: '#252c52',
    ground: '#1f2540', groundTop: '#3a4470',
    post: '#6d769e', sign: '#161a2b', signBd: '#4be1d2',
    amber: '#ffcf4a', cyan: '#4be1d2', magenta: '#ff5d8f', ink: '#eef1ff'
  };

  function render() {
    if (!ctx) { return; }
    // 空
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.sky1); g.addColorStop(1, COL.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 星（パララックス・点）
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (var s = 0; s < 60; s++) {
      var sx = (s * 137 - camX * 0.2) % WORLD_W;
      if (sx < 0) { sx += WORLD_W; }
      if (sx < W) { ctx.fillRect(sx, (s * 53) % (H - GROUND_H - 40), 2, 2); }
    }

    // 遠景の丘（パララックス）
    drawHills(camX * 0.3, COL.hillFar, H - GROUND_H + 10, 70);
    drawHills(camX * 0.55, COL.hillNear, H - GROUND_H + 20, 46);

    // 地面
    ctx.fillStyle = COL.ground;
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = COL.groundTop;
    ctx.fillRect(0, H - GROUND_H, W, 4);
    // 地面のドット目地
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (var gx = -(camX % 32); gx < W; gx += 32) { ctx.fillRect(gx, H - GROUND_H + 12, 2, GROUND_H - 12); }

    // 看板
    for (var i = 0; i < MILESTONES.length; i++) { drawSign(MILESTONES[i]); }

    // ゴール旗
    drawGoal();

    // サチ
    drawHero();
  }

  function drawHills(off, color, baseY, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 16) {
      var wx = x + off;
      var y = baseY - Math.abs(Math.sin(wx * 0.004)) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  function drawSign(m) {
    var sx = Math.round(m.x - camX);
    if (sx < -120 || sx > W + 120) { return; }
    var baseY = H - GROUND_H;
    // 支柱
    ctx.fillStyle = COL.post;
    ctx.fillRect(sx - 3, baseY - 78, 6, 78);
    // 看板パネル
    var bw = 132, bh = 52, bx = sx - bw / 2, by = baseY - 134;
    ctx.fillStyle = m.visited ? '#202747' : COL.sign;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = m.visited ? COL.amber : COL.signBd;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    // 年 + アイコン
    ctx.fillStyle = COL.amber;
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(m.year, bx + 10, by + 10);
    ctx.font = '20px sans-serif';
    ctx.fillText(m.icon, bx + bw - 32, by + 12);
    // タグ
    ctx.fillStyle = m.visited ? COL.amber : COL.cyan;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(m.tag, bx + 10, by + 30);
    // 訪問済みチェック
    if (m.visited) {
      ctx.fillStyle = COL.amber;
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText('✓', bx + bw - 18, by + 30);
    }
  }

  function drawGoal() {
    var sx = Math.round(GOAL_X - camX);
    if (sx < -60 || sx > W + 60) { return; }
    var baseY = H - GROUND_H;
    ctx.fillStyle = COL.post;
    ctx.fillRect(sx - 2, baseY - 150, 4, 150);
    // 旗（チェッカー）
    var fy = baseY - 150;
    for (var r = 0; r < 5; r++) {
      for (var c = 0; c < 6; c++) {
        ctx.fillStyle = ((r + c) % 2) ? COL.magenta : COL.ink;
        ctx.fillRect(sx + 2 + c * 7, fy + r * 7, 7, 7);
      }
    }
    ctx.fillStyle = COL.amber;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('NOW', sx - 14, baseY - 172);
  }

  // サチ（紫ドレス + 白エプロンのメイド・矩形ドット）
  function drawHero() {
    var sx = Math.round(hero.x - camX);
    var feetY = H - GROUND_H;
    var p = SCALE;
    var bob = (hero.moving && Math.floor(hero.phase) % 2 === 0) ? -p : 0;
    var top = feetY - 16 * p + bob;

    ctx.save();
    ctx.translate(sx, 0);
    if (hero.facing < 0) { ctx.scale(-1, 1); }

    function px(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x * p, top + y * p, w * p, h * p); }

    // 髪
    px(-4, 0, 8, 4, '#2a2030');
    // 顔
    px(-3, 3, 6, 4, '#ffd9b0');
    // 目
    px(0, 4, 2, 1, '#2a2030');
    // ドレス（紫・台形）
    px(-3, 7, 6, 5, '#b85cff');
    px(-4, 10, 8, 2, '#a64df0');
    // エプロン（白）
    px(-2, 7, 4, 4, '#f4f0ff');
    // 腕
    px(-5, 7, 1, 3, '#ffd9b0');
    px(4, 7, 1, 3, '#ffd9b0');
    // 脚（歩行で交互）
    var swing = hero.moving ? (Math.floor(hero.phase) % 2 === 0 ? 1 : -1) : 0;
    px(-2 + swing, 12, 2, 4, '#2a2030');
    px(1 - swing, 12, 2, 4, '#2a2030');

    ctx.restore();
  }
})();
