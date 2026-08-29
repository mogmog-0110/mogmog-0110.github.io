"use strict";
// ミノ形状（スポーン姿勢、4×2 グリッド内のセル）。色クラス = type % 4
const SHAPES = [
  [[0,1],[1,1],[2,1],[3,1]], // I
  [[1,0],[2,0],[1,1],[2,1]], // O
  [[1,0],[0,1],[1,1],[2,1]], // T
  [[1,0],[2,0],[0,1],[1,1]], // S
  [[0,0],[1,0],[1,1],[2,1]], // Z
  [[0,0],[0,1],[1,1],[2,1]], // J
  [[2,0],[0,1],[1,1],[2,1]], // L
];

// シェイプの外接矩形だけを格子にする（空白セルで間延びさせない）
function renderMino(el, type, px) {
  el.innerHTML = "";
  if (type < 0 || type > 6) { return; }
  const cells = SHAPES[type];
  const xs = cells.map(c => c[0]);
  const ys = cells.map(c => c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 + 1;
  const h = Math.max(...ys) - y0 + 1;
  el.style.gridTemplateColumns = "repeat(" + w + ", " + px + "px)";
  el.style.gridAutoRows = px + "px";
  const occ = new Set(cells.map(c => (c[1] - y0) * w + (c[0] - x0)));
  const rad = Math.max(3, Math.round(px * 0.24)); // 角丸はセルサイズに比例
  for (let i = 0; i < w * h; i++) {
    const d = document.createElement("div");
    if (occ.has(i)) {
      d.className = "cell c" + (type % 4);
      d.style.borderRadius = rad + "px";
    }
    el.appendChild(d);
  }
}

const $ = id => document.getElementById(id);
let last = { next: -2, next2: -2, hold: -2, score: 0, pad: "?", lv: 0,
             tspin: 0, gstate: "" };

// 接続パッドの機種でボタングリフを出し分ける（PromptFont のコードポイント）
const PAD_SETS = {
  ps:   { move: "↢", rotr: "⇣", rotl: "⇢", hard: "⇡",
          hold: "↰↱", soft: "↡",
          pause: "⇨", ok: "⇣", back: "⇢", tut: "↰" },
  xbox: { move: "≾", rotr: "⇓", rotl: "⇒", hard: "⇑",
          hold: "↘↙", soft: "≽",
          pause: "⇸", ok: "⇓", back: "⇒", tut: "↘" },
};

function applyPad(pad) {
  const pp = PAD_SETS[pad];
  document.querySelectorAll(".padonly").forEach(el => {
    el.style.display = pp ? "" : "none";
  });
  if (!pp) { return; }
  $("gmove").textContent = pp.move;
  $("grotr").textContent = pp.rotr;
  $("grotl").textContent = pp.rotl;
  $("ghold").textContent = pp.hold;
  $("gsoft").textContent = pp.soft;
  $("ghard").textContent = pp.hard;
  $("gpause").textContent = pp.pause;
  $("gok2").textContent = pp.ok;
  $("gback2").textContent = pp.back;
  $("gok3").textContent = pp.ok;       // ポーズ: 続ける
  $("gback3").textContent = pp.back;   // ポーズ: タイトルへ
  $("gquit3").textContent = pp.pause;  // ポーズ: やめる（BACK/SHARE）
  // 確認 / 操作説明 / タイトルの専用グリフ
  const tset = (id, v) => { const e = $(id); if (e) { e.textContent = v; } };
  tset("tcmove", pp.move); tset("tcrotr", pp.rotr); tset("tcrotl", pp.rotl);
  tset("tchold", pp.hold);
  tset("tcsoft", pp.soft); tset("tchard", pp.hard);
  tset("tcpause", pp.pause);
  tset("gok5", pp.ok);
  tset("tutBackG", pp.back); // チュートリアルの「もどる」パッド表記
}

function scorePop(delta) {
  const p = document.createElement("div");
  p.className = "pop";
  p.style.left = "150px";
  p.style.top = "70px";
  p.textContent = "+" + delta.toLocaleString() + " ★";
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}

// 一発演出: アニメ class を付け直して再生（同じ class の再付与で再生されないため）
function popOnce(id) {
  const el = $(id);
  if (!el) { return; }
  el.classList.remove("show");
  void el.offsetWidth; // リフローを強制してアニメをリセット
  el.classList.add("show");
}

// 新記録の紙吹雪: 一度だけ生成して #confetti を表示
const CF_COLORS = ["#f23a55", "#ffd23e", "#46b8ff", "#4ed964", "#ff7da4", "#b558d8"];
let confettiBuilt = false;
function startConfetti() {
  const box = $("confetti");
  if (!box) { return; }
  if (!confettiBuilt) {
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("div");
      c.className = "cf";
      c.style.left = (Math.random() * 100) + "%";
      c.style.background = CF_COLORS[i % CF_COLORS.length];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      c.style.animationDelay = (Math.random() * 1.2) + "s";
      c.style.width = (7 + Math.random() * 7) + "px";
      box.appendChild(c);
    }
    confettiBuilt = true;
  }
  box.style.display = "block";
}
function stopConfetti() {
  const box = $("confetti");
  if (box) { box.style.display = "none"; }
}

window.hud = {
  update(s) {
    if (s.pad !== last.pad) { applyPad(s.pad); last.pad = s.pad; }
    // 操作ガイドは本編プレイ中だけ左下に出す
    $("helpBox").style.display = (s.gstate === "play") ? "" : "none";
    $("score").textContent = s.score.toLocaleString();
    if (s.score > last.score) { scorePop(s.score - last.score); }
    last.score = s.score;
    $("hudbest").textContent = (s.best || 0).toLocaleString();
    $("lines").textContent = s.lines;
    $("lv").textContent = s.lv;
    // レベルアップ / T スピンの一発演出（再生のたびに class を付け直す）
    const playingNow = s.gstate === "play";
    if (playingNow && (s.lv || 0) > (last.lv || 0)) { popOnce("lvUpPop"); }
    last.lv = s.lv || 0;
    if (playingNow && s.tspin === 1 && last.tspin !== 1) { popOnce("tspinPop"); }
    last.tspin = s.tspin || 0;
    $("time").textContent =
      Math.floor(s.time / 60) + ":" + String(s.time % 60).padStart(2, "0");
    // ── WAVE の縦レール ──
    // 「いま何の相か」「次に何が来るか」「あと何秒か」は 1 つの情報なので、
    // 表示も 1 つにする。区間の高さがそのまま時間の長さ
    const segOf = s.cyc < 1500 ? 0 : s.cyc < 3000 ? 1 : s.cyc < 3900 ? 2 : 3;
    for (let i = 0; i < 4; i++) {
      $("ws" + i).className = "wseg" + (i === segOf ? " on" : "");
      $("wl" + i).className = "wlab" + (i === segOf ? " on" : "");
    }
    const posPct = (s.cyc / 4800 * 100).toFixed(2) + "%";
    $("waveMark").style.top = posPct;
    $("waveSec").style.top = posPct;
    // 次の相までの秒。周期 4800F を 0-1500 凍結 / -3000 硬ゼリー /
    // -3900 柔ゼリー / -4200 液状化 / -4800 回復（再結晶は cyc 4341 付近）で刻む
    let evSec;
    if (s.phase === "frozen") {
      // 再結晶直後（cyc > 1500）は次の周期のゼリー化までを数える
      evSec = Math.ceil(((s.cyc > 1500 ? 4800 + 1500 : 1500) - s.cyc) / 60);
    } else if (s.cyc < 3000) {
      evSec = Math.ceil((3000 - s.cyc) / 60);
    } else if (s.cyc < 3900) {
      evSec = Math.ceil((3900 - s.cyc) / 60);
    } else {
      evSec = Math.max(0, Math.ceil((4341 - s.cyc) / 60));
    }
    $("waveSec").textContent = s.gstate === "title" ? "" : evSec + " 秒";
    $("wave").className = "box" + ((evSec <= 5 && s.gstate === "play") ? " near" : "");
    // 連鎖ポップ: chain>=2 でフィールド中央に CHAIN ×N を出す（出る瞬間だけ再生）
    const ch = $("chain");
    if ((s.chain || 0) >= 2 && s.chain !== last.chain) {
      ch.textContent = "CHAIN ×" + s.chain;
      ch.style.visibility = "visible";
      ch.style.animation = "none"; void ch.offsetWidth; ch.style.animation = "";
    } else if ((s.chain || 0) < 2) {
      ch.style.visibility = "hidden";
    }
    last.chain = s.chain || 0;
    if (s.next !== last.next) { renderMino($("next"), s.next, 24); last.next = s.next; }
    if (s.next2 !== last.next2) { renderMino($("next2"), s.next2, 16); last.next2 = s.next2; }
    if (s.hold !== last.hold) { renderMino($("hold"), s.hold, 24); last.hold = s.hold; }
    $("remix").style.visibility = s.remix ? "visible" : "hidden";
    $("combo").style.visibility = s.combo > 1 ? "visible" : "hidden";
    $("combo").textContent = s.combo > 1 ? ("COMBO ×" + s.combo) : "";
    const playing = s.gstate === "play";
    // タイトル / 確認 / 操作説明 / リザルト画面
    $("title").style.display = s.gstate === "title" ? "flex" : "none";
    if (s.gstate === "title") {
      $("tm0").className = "menuItem" + ((s.tsel || 0) === 0 ? " sel" : "");
      $("tm1").className = "menuItem" + ((s.tsel || 0) === 1 ? " sel" : "");
    }
    $("ask").style.display = s.gstate === "ask" ? "flex" : "none";
    if (s.gstate === "ask") {
      $("ab0").className = "askBtn" + ((s.asel || 0) === 0 ? " sel" : "");
      $("ab1").className = "askBtn" + ((s.asel || 0) === 1 ? " sel" : "");
    }
    $("ctrl").style.display = s.gstate === "ctrl" ? "flex" : "none";
    $("result").style.display = s.gstate === "result" ? "flex" : "none";
    if (s.gstate === "result") {
      const rh1 = document.querySelector("#resultBox h1");
      rh1.textContent = "結果";
      rh1.style.color = "#2e8fe8";
      $("newrec").style.display = s.newrec ? "block" : "none";
      $("rscore").textContent = s.score.toLocaleString();
      $("rlines").textContent = s.lines;
      $("rtime").textContent =
        Math.floor(s.time / 60) + ":" + String(s.time % 60).padStart(2, "0");
      $("rbest").textContent = s.best.toLocaleString();
    }
    // 新記録の紙吹雪: リザルトに入った最初の 1 回だけ撒く
    if (s.gstate === "result" && last.gstate !== "result") {
      if (s.newrec) { startConfetti(); } else { stopConfetti(); }
    } else if (s.gstate !== "result") {
      stopConfetti();
    }
    last.gstate = s.gstate;
    $("pause").style.display = s.gstate === "pause" ? "flex" : "none";
    // オプション画面
    $("options").style.display = s.gstate === "opt" ? "flex" : "none";
    if (s.gstate === "opt") {
      $("obarBgm").style.width = (s.optbgm || 0) + "%";
      $("obarSe").style.width = (s.optse || 0) + "%";
      $("ovalBgm").textContent = (s.optbgm || 0);
      $("ovalSe").textContent = (s.optse || 0);
      $("ovalShake").textContent = s.optshake ? "ON" : "OFF";
      for (let i = 0; i < 3; i++) {
        $("orow" + i).className = "orow" + (s.optsel === i ? " sel" : "");
      }
    }
    // チュートリアル: 1 ページずつ大きなキャプション + 説明対象のハイライト
    // （進行と段階 s.tut は C++ のタイムラインが担当）
    // hi: 強調する対象の DOM 要素 id（null=なし）。対象要素に .tut-hi クラスを
    // 当てて光らせる（floating 枠は合成スケールでずれるため、要素直付けで一致）
    const TUT_PAGES = [
      { t: "ようこそ。これは<b>溶けて固まる</b><br>不思議な落ちものパズル", hi: null },
      { t: "<b>カチカチ</b>の間は普通の落ちものパズル<br>横<b>1列</b>そろえると消える", hi: null },
      { t: "WAVEが進むとブロックが<b>ゼリー</b>に<br>やわらかくても横<b>1列</b>で消える", hi: "wave" },
      { t: "さらにやわらかくなると<br>形が崩れて垂れてくる", hi: null },
      { t: "<b>液体</b>になると溶けて流れる<br>同じ色を壁から壁までつなぐと消える", hi: null },
      { t: "冷えるとまた<b>固く</b>なる", hi: null },
      { t: "固い<b>大地</b>の上でもラインを消せる<br><b>1列</b>消すと<b>下の大地も崩れる</b>（得点は半分）", hi: null },
      { t: "続けて消えると<b>連鎖</b><br>WAVEを読んで大連鎖を狙う", hi: "wave" },
    ];
    if (s.gstate === "tut") {
      $("tut").style.display = "block";
      const pg = TUT_PAGES[Math.min(s.tut, TUT_PAGES.length - 1)];
      $("tutText").innerHTML = pg.t;
      // 対象要素そのものに光彩クラスを当てる（座標計算なし＝常にぴたり一致）
      const hiId = pg.hi || null;
      if (last.tutHiId !== hiId) {
        if (last.tutHiId) { const p = $(last.tutHiId); if (p) { p.classList.remove("tut-hi"); } }
        if (hiId) { const t = $(hiId); if (t) { t.classList.add("tut-hi"); } }
        last.tutHiId = hiId;
      }
      // 進行ドット
      const dots = $("tutDots");
      if (dots.children.length !== TUT_PAGES.length) {
        dots.innerHTML = "";
        for (let i = 0; i < TUT_PAGES.length; i++) {
          const d = document.createElement("div"); d.className = "d"; dots.appendChild(d);
        }
      }
      for (let i = 0; i < TUT_PAGES.length; i++) {
        dots.children[i].className = "d" + (i === Math.min(s.tut, TUT_PAGES.length - 1) ? " on" : "");
      }
    } else {
      $("tut").style.display = "none";
      if (last.tutHiId) { const p = $(last.tutHiId); if (p) { p.classList.remove("tut-hi"); } last.tutHiId = null; }
    }
  }
};
