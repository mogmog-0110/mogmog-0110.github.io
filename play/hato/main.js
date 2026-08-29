/*!
 * ハトを育てよう — CEF hybrid port.
 * Novel scenes delegate to mitiru.novel (JSON-driven VM).
 * Title + game loop (actions + HUD) remain custom DOM scenes.
 */

const $ = (id) => document.getElementById(id);

// ── Scene refs ──────────────────────────────────────────────
const stageEl    = $('stage');
const titleScene = $('title-scene');
const gameScene  = $('game-scene');
const novelRoot  = $('novel-root');
const bgImg      = $('bg');
const chara      = $('chara');
const hudDayNum  = $('hud-day-num');
const hudKinniku = $('hud-kinniku');
const hudTinou   = $('hud-tinou');
const hudTaijuu  = $('hud-taijuu');
const actions    = $('actions');
const titleBtns  = $('title-buttons');
const scoreDisp  = $('score-display');
const scoreVal   = $('score-value');
const backlogBtn = $('backlog-btn');
const skipBtn    = $('skip-novel-btn');
const bgm        = $('bgm');
const daySplash  = $('day-splash');
const daySplashText = $('day-splash-text');

/// Short alias: play SE only when module loaded.
const se = (name) => globalThis.hatoSe?.play(name);

const creditsScene  = $('credits-scene');
const creditsScroll = $('credits-scroll');
const creditsSkip   = $('credits-skip');
const continuePrompt = $('continue-prompt');

// ── Persistent unlocks ──────────────────────────────────────
/// localStorage keys — keep the prefix short and game-scoped so we
/// don't collide with other mitiru-hosted games sharing origin.
const LS_ED_SEEN            = 'hato:ed-seen';
const LS_MINIGAME_UNLOCKED  = 'hato:minigame-unlocked';
const LS_MINIGAME_HIGHSCORE = 'hato:minigame-highscore';

function edSeen() {
	try { return localStorage.getItem(LS_ED_SEEN) === '1'; }
	catch { return false; }
}
function markEdSeen() {
	try { localStorage.setItem(LS_ED_SEEN, '1'); } catch {}
}

/// 盤面は 1280x720 固定。窓に収まる倍率を CSS 変数へ渡す
function fitStage() {
	const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
	document.documentElement.style.setProperty('--stage-scale', String(s));
}
window.addEventListener('resize', fitStage);
fitStage();

/// ハトドロップは Box2D をネイティブ側へ問い合わせて動く。ブラウザ単体では
/// 橋が無いので遊べない。解放済みでも出さない
function physicsAvailable() {
	return typeof window.cefQuery === 'function';
}
function minigameUnlocked() {
	if (!physicsAvailable()) return false;
	try { return localStorage.getItem(LS_MINIGAME_UNLOCKED) === '1'; }
	catch { return false; }
}
function markMinigameUnlocked() {
	try { localStorage.setItem(LS_MINIGAME_UNLOCKED, '1'); } catch {}
}

function getMinigameHighscore() {
	try { return parseInt(localStorage.getItem(LS_MINIGAME_HIGHSCORE) || '0', 10) || 0; }
	catch { return 0; }
}
function setMinigameHighscore(score) {
	try { localStorage.setItem(LS_MINIGAME_HIGHSCORE, String(score)); } catch {}
}

// ── Game state ──────────────────────────────────────────────
const state = {
	day:     1,
	val:     1,
	score:   0,
	stress:  4,
	yaruki:  5,
	tinou:   0,
	kinniku: 0,
	taijuu:  350,
	face:    'default',
};

function resetState() {
	state.day = 1; state.val = 1; state.score = 0;
	state.stress = 4; state.yaruki = 5;
	state.tinou = 0; state.kinniku = 0; state.taijuu = 350;
	state.face = 'default';
}

// ── Scene switching ─────────────────────────────────────────
function showScene(name) {
	titleScene.hidden   = (name !== 'title');
	gameScene.hidden    = (name !== 'game');
	novelRoot.hidden    = (name !== 'novel');
	scoreDisp.hidden    = (name !== 'score');
	creditsScene.hidden = (name !== 'credits');
	soloHatodrop.hidden = (name !== 'solo-hatodrop');
	backlogBtn.hidden   = (name !== 'novel');
	skipBtn.hidden      = (name !== 'novel');
}

const soloHatodrop     = $('solo-hatodrop-scene');
const soloHatodropSlot = $('solo-hatodrop-slot');
const soloHatodropHs   = $('solo-hatodrop-hs');
const soloHatodropExit = $('solo-hatodrop-exit');
const hatodropTitleBtn = $('hatodrop-title-btn');
const hatodropHsLabel  = $('hatodrop-highscore');

// ── Character sprite (game loop) ────────────────────────────
function charaPath() {
	const map = {
		default:  'normal_hato.png',
		angry:    'okoru_hato.png',
		tokeru:   'tokeru_hato.png',
		hutoru:   'hutoru_hato.png',
		garigari: 'garigari.png',
	};
	return `assets/chara/${map[state.face] || map.default}`;
}

/// Show a "+1" / "-10" popup next to a stat row and play blip.
function showHudPopup(statEl, delta) {
	if (!statEl || delta === 0) return;
	const row = statEl.parentElement;
	const pop = document.createElement('span');
	pop.className = 'hud-popup ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : 'day');
	pop.textContent = (delta > 0 ? '+' : '') + delta;
	row.appendChild(pop);
	setTimeout(() => pop.remove(), 900);
	se(delta > 0 ? 'stat-up' : 'stat-down');
}

function updateHud(deltas) {
	// Fire popups BEFORE swapping the text so the number pop feels in sync.
	if (deltas) {
		if (deltas.kinniku) showHudPopup(hudKinniku, deltas.kinniku);
		if (deltas.tinou)   showHudPopup(hudTinou,   deltas.tinou);
		if (deltas.taijuu)  showHudPopup(hudTaijuu,  deltas.taijuu);
	}
	hudDayNum.textContent  = state.day;
	hudKinniku.textContent = state.kinniku;
	hudTinou.textContent   = state.tinou;
	hudTaijuu.textContent  = state.taijuu;
	chara.src = charaPath();
}

/// Brief "Day N" splash between actions. Day 7 reads "Last Day".
const DAY_SPLASH_DURATION_MS = 1700;

function playDaySplash(day) {
	// Reset CSS animations by cloning child nodes. Must re-query the text
	// element AFTER replacement since the original ref points at the orphan.
	daySplash.hidden = false;
	daySplash.style.animation = 'none';
	void daySplash.offsetWidth;
	daySplash.style.animation = '';
	for (const child of Array.from(daySplash.children)) {
		const clone = child.cloneNode(true);
		child.replaceWith(clone);
	}
	const textEl = daySplash.querySelector('.day-splash-text');
	if (textEl) {
		textEl.textContent = (day >= 7) ? 'Last Day' : `Day ${day}`;
	}
	se('day');
	return new Promise((resolve) => {
		setTimeout(() => {
			daySplash.hidden = true;
			resolve();
		}, DAY_SPLASH_DURATION_MS);
	});
}

/// Schedule random blinks for the chara sprite while game-scene is active.
let _blinkTimer = null;
function startCharaBlinks() {
	stopCharaBlinks();
	const blinkOnce = () => {
		if (gameScene.hidden) return;
		chara.classList.add('blink');
		setTimeout(() => chara.classList.remove('blink'), 180);
	};
	const schedule = () => {
		_blinkTimer = setTimeout(() => {
			blinkOnce();
			schedule();
		}, 3500 + Math.random() * 3000);
	};
	schedule();
}
function stopCharaBlinks() {
	if (_blinkTimer) { clearTimeout(_blinkTimer); _blinkTimer = null; }
}

// ── Novel VM helpers ────────────────────────────────────────
let _novelMounted = false;

/// Engine now owns H-01..H-05 + input lockout (post-merge 2026-04-25):
///   H-01 UI clear on load  ── built into novel.load()
///   H-02 bgFit option      ── passed to novel.mount({bgFit:'contain'})
///   H-05 textbox stylable  ── default inline styles minimised
///   bonus: input lockout   ── novel.setInputLockout({...}) +
///                             novel.inputLocked() replaces our custom impl.

function ensureNovelMounted() {
	if (_novelMounted) return;
	if (!globalThis.mitiru?.novel) {
		console.error('[hato] mitiru.novel not loaded');
		return;
	}
	// H-02: 4:3 hand-drawn assets need contain instead of cover.
	// bonus: engine-owned input lockout replaces our custom scheduler.
	mitiru.novel.mount(novelRoot, { bgFit: 'contain' });
	mitiru.novel.setInputLockout({
		sceneTransitionMs: SCENE_TRANSITION_LOCK_MS,
		perLineMs:         PER_LINE_LOCK_MS,
	});
	_novelMounted = true;

	// SE hooks on line start (lockout now handled by engine).
	novelRoot.addEventListener('novel:line:start', (e) => {
		const line = e.detail?.line || {};
		if (line.type === 'flash') se('shout');
	});

	// Click on novel root advances, but respect the engine's lockout.
	novelRoot.addEventListener('click', (e) => {
		if (e.target.closest('.overlay-btn')) return;
		if (e.target.closest('[data-novel-backlog]')) return;
		if (mitiru.novel.inputLocked()) {
			e.stopPropagation(); e.preventDefault(); return;
		}
		mitiru.novel.advance();
	}, true);

	backlogBtn.addEventListener('click', () => mitiru.novel.showBacklog());
	skipBtn.addEventListener('click', () => {
		if (mitiru.novel.inputLocked()) return;
		mitiru.novel.setSkipMode('all');
	});

	// Click outside log items closes the backlog (mouse-driven UX).
	// Backlog DOM is: div[data-novel-backlog] > ul > li[data-backlog-index].
	// Closing on anything that is NOT a backlog item (incl. ul padding and
	// the backdrop itself) feels natural. The li's own click handler still
	// fires first and triggers jumpTo before hideBacklog() runs, so items
	// keep their rewind behavior.
	const backlogEl = novelRoot.querySelector('[data-novel-backlog]');
	if (backlogEl) {
		backlogEl.addEventListener('click', (e) => {
			if (!e.target.closest('[data-backlog-index]')) {
				mitiru.novel.hideBacklog();
			}
		});
	}

	// Keyboard shortcuts (also gated by lockout).
	document.addEventListener('keydown', (e) => {
		if (novelRoot.hidden) return;
		if (mitiru.novel.inputLocked()) return;
		if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			mitiru.novel.advance();
		} else if (e.key === 'l' || e.key === 'L') {
			mitiru.novel.showBacklog();
		} else if (e.key === 'Escape') {
			mitiru.novel.hideBacklog();
		}
	});
}

/// Lockout duration after a scene transition — long enough that trailing
/// clicks from the previous screen cannot race into the novel VM.
/// Tuned against rapid-click (80ms interval) double-tap patterns.
const SCENE_TRANSITION_LOCK_MS = 700;

/// After each line's typewriter starts, block advance for this long so a
/// user rhythmically clicking cannot chain-skip through short lines.
const PER_LINE_LOCK_MS = 140;

function playScript(scriptOrUrl) {
	return new Promise(async (resolve) => {
		ensureNovelMounted();
		if (!_novelMounted) { resolve(); return; }

		mitiru.novel.setSkipMode('off');
		// Engine clears UI and arms sceneTransitionMs lockout on load().
		await mitiru.novel.load(scriptOrUrl);
		showScene('novel');

		const onEnd = () => {
			novelRoot.removeEventListener('novel:script:end', onEnd);
			resolve();
		};
		novelRoot.addEventListener('novel:script:end', onEnd);

		mitiru.novel.advance();   // kick off first line
	});
}

/// Helper: flag the unlock once per ED completion. Called from sceneCredits
/// on its natural end OR when the player skips credits.
function unlockMinigameOnEd() {
	markEdSeen();
	markMinigameUnlocked();
}

// ── Parameter helpers (literal port of func.ks) ─────────────
function stressZouka() {
	state.stress += 1;
	if (state.stress >= 8) state.face = 'angry';
}
function stressGenshou() {
	state.stress -= 1;
	if (state.stress < 0) state.stress = 0;
	if (state.stress < 8 && state.face === 'angry') state.face = 'default';
}
function yarukiZouka() {
	state.yaruki += 1;
	if (state.yaruki >= 7)      state.val = 2;
	else if (state.yaruki <= 2) state.val = 0;
	else                        state.val = 1;
	if (state.yaruki > 2 && state.face === 'tokeru') state.face = 'default';
}
function yarukiGenshou() {
	state.yaruki -= 1;
	if (state.yaruki < 0) state.yaruki = 0;
	if (state.yaruki <= 2) { state.val = 0; state.face = 'tokeru'; }
}
function taijuuZouka()  { state.taijuu += 10; applyTaijuuFace(); }
function taijuuGenshou(){ state.taijuu -= 10; applyTaijuuFace(); }
function applyTaijuuFace() {
	if (state.taijuu >= 380) {
		if (state.face !== 'angry' && state.face !== 'tokeru') state.face = 'hutoru';
	} else if (state.taijuu >= 320) {
		if (state.face === 'hutoru' || state.face === 'garigari') state.face = 'default';
	} else {
		if (state.face !== 'angry' && state.face !== 'tokeru') state.face = 'garigari';
	}
}

// ── Action script builders (conditional dialogue) ───────────
function buildActionScript(name) {
	switch (name) {
	case 'asobu':
		return {
			id: 'hato-asobu',
			lines: [
				{type:'bg', path:'assets/bg/asobu.png'},
				{speaker:'ハト', text: state.stress >= 7 ? 'ぴょおおおおおおお' : 'くるっぽ～くるっぽ～'},
			],
		};
	case 'benkyou':
		return {
			id: 'hato-benkyou',
			lines: [
				{type:'bg', path:'assets/bg/benkyou.png'},
				{speaker:'ハト', text: state.tinou >= 7 ? 'ポ（……眼光紙背に徹す……）' : 'あうーあうー'},
			],
		};
	case 'gohan':
		return {
			id: 'hato-gohan',
			lines: [
				{type:'bg', path:'assets/bg/esa.png'},
				{speaker:'ハト', text: state.taijuu >= 380
					? 'がつがつがつがつがつがつがつがつがつがつがつがつ'
					: 'うまうま'},
			],
		};
	case 'kinntore':
		return {
			id: 'hato-kinntore',
			lines: [
				{type:'bg', path:'assets/bg/training.png'},
				{speaker:'ハト', text: state.kinniku >= 7
					? 'くるっぽー！（パワーーーーーーーーーーーー！！）'
					: 'ほろ……ほろ……'},
			],
		};
	case 'sikaru':
		return {
			id: 'hato-sikaru',
			lines: [
				{type:'bg', path:'assets/bg/hato_torauma.png'},
				{speaker:'ハト', text: state.yaruki <= 3 ? 'ぽぅ（ごめん）' : 'ほ（えぇ）'},
			],
		};
	}
	return {id:'hato-noop', lines:[]};
}

function applyActionEffects(name) {
	const before = { kinniku: state.kinniku, tinou: state.tinou, taijuu: state.taijuu };
	switch (name) {
	case 'asobu':    stressGenshou(); yarukiGenshou(); break;
	case 'benkyou':  stressZouka();   state.tinou   += state.val; break;
	case 'gohan':    stressGenshou(); taijuuZouka(); break;
	case 'kinntore': taijuuGenshou(); state.kinniku += state.val; break;
	case 'sikaru':   stressZouka();   yarukiZouka(); break;
	}
	state.day += 1;
	return {
		kinniku: state.kinniku - before.kinniku,
		tinou:   state.tinou   - before.tinou,
		taijuu:  state.taijuu  - before.taijuu,
	};
}

// ── App lifecycle ───────────────────────────────────────────
/// Ask the C++ shell to terminate the process. In a plain browser context
/// (no cefQuery), fall back to window.close() / about:blank navigation.
function quitApp() {
	if (typeof window.cefQuery === 'function') {
		try {
			window.cefQuery({
				request: 'app:quit|',
				onSuccess: () => {},
				onFailure: () => {},
			});
			return;
		} catch {}
	}
	try { window.close(); } catch {}
	try { location.href = 'about:blank'; } catch {}
}

// ── Scenes ──────────────────────────────────────────────────
async function sceneTitle() {
	stopCharaBlinks();
	showScene('title');

	// Surface the hatodrop shortcut once unlocked.
	if (minigameUnlocked()) {
		hatodropTitleBtn.hidden = false;
		const hs = getMinigameHighscore();
		hatodropHsLabel.textContent = hs > 0 ? `High: ${hs.toLocaleString('ja-JP')}` : '';
	} else {
		hatodropTitleBtn.hidden = true;
	}

	return new Promise((resolve) => {
		const titleHandler = (e) => {
			const b = e.target.closest('.title-btn');
			if (!b) return;
			titleBtns.removeEventListener('click', titleHandler);
			hatodropTitleBtn.removeEventListener('click', dropHandler);
			globalThis.hatoSe?.unlock();
			se('click');
			playBgm();
			if (b.dataset.title === 'start') { resolve('start'); sceneIntro(); }
			else { quitApp(); }
		};
		const dropHandler = () => {
			titleBtns.removeEventListener('click', titleHandler);
			hatodropTitleBtn.removeEventListener('click', dropHandler);
			globalThis.hatoSe?.unlock();
			se('click');
			playBgm();
			resolve('hatodrop');
			sceneSoloHatodrop();
		};
		titleBtns.addEventListener('click', titleHandler);
		hatodropTitleBtn.addEventListener('click', dropHandler);
	});
}

// ── Solo hatodrop scene (unlocked after first ED clear) ────
async function sceneSoloHatodrop() {
	showScene('solo-hatodrop');
	hatodropTitleBtn.hidden = true;

	let currentScore = 0;
	const unsubScore = globalThis.hatoDrop?.onScoreChange?.((s) => {
		currentScore = s;
	}) || (() => {});
	const unsubGameOver = globalThis.hatoDrop?.onGameOver?.((finalScore) => {
		const prev = getMinigameHighscore();
		if (finalScore > prev) {
			setMinigameHighscore(finalScore);
			soloHatodropHs.textContent = finalScore.toLocaleString('ja-JP');
		}
	}) || (() => {});

	soloHatodropHs.textContent = getMinigameHighscore().toLocaleString('ja-JP');

	try {
		await globalThis.hatoDrop.mount(soloHatodropSlot);
		globalThis.hatoDrop.start();
	} catch (e) {
		console.info('[hato] solo-hatodrop mount failed:', e.message);
	}

	return new Promise((resolve) => {
		const onExit = () => {
			soloHatodropExit.removeEventListener('click', onExit);
			se('click');
			unsubScore(); unsubGameOver();

			// Commit score if it beats high before teardown.
			const prev = getMinigameHighscore();
			if (currentScore > prev) setMinigameHighscore(currentScore);

			globalThis.hatoDrop?.destroy?.().catch(() => {});
			resolve();
			sceneTitle();
		};
		soloHatodropExit.addEventListener('click', onExit);
	});
}

function playBgm() {
	bgm.volume = 0.5;
	bgm.play().catch(() => {});
}

async function sceneIntro() {
	resetState();
	await playScript('data/novels/intro.json');
	await sceneGameLoop();
}

async function sceneGameLoop() {
	showScene('game');
	bgImg.src = 'assets/bg/siro.png';
	updateHud();
	startCharaBlinks();

	const action = await new Promise((resolve) => {
		const handler = (e) => {
			const b = e.target.closest('.action-btn');
			if (!b) return;
			actions.removeEventListener('click', handler);
			se(`action-${b.dataset.action}`);
			resolve(b.dataset.action);
		};
		actions.addEventListener('click', handler);
	});

	stopCharaBlinks();
	const script = buildActionScript(action);
	await playScript(script);
	const deltas = applyActionEffects(action);

	if (state.stress >= 10)  return endingEscape();
	if (state.taijuu <= 300) return endingDeath();

	if (state.day > 7) return endingJudge();

	// Show the day transition, then resume game loop with popups.
	showScene('game');
	bgImg.src = 'assets/bg/siro.png';
	chara.src = charaPath();
	await playDaySplash(state.day);
	updateHud(deltas);   // popups animate after splash so they're visible
	return sceneGameLoop();
}

// ── Endings ─────────────────────────────────────────────────
async function endingEscape() {
	se('ending-bad');
	await playScript('data/novels/ending_escape.json');
	sceneTitle();
}

async function endingDeath() {
	se('ending-bad');
	await playScript('data/novels/ending_death.json');
	sceneTitle();
}

async function endingJudge() {
	await playScript('data/novels/ending_judge.json');

	// Score calculation (func.ks *judge)
	state.score = (state.tinou * 1000) + (state.kinniku * 1000)
	            - (state.stress * 100) + (state.yaruki * 100);

	if (state.tinou >= 5)        { state.score += 2000; await endingOwl(); }
	else if (state.kinniku >= 5) { state.score += 2000; await endingMuscle(); }
	else                         { await endingNormal(); }
}

async function endingOwl()    { se('ending-good'); await playScript('data/novels/ending_owl.json');    await sceneScore(); }
async function endingMuscle() { se('ending-good'); await playScript('data/novels/ending_muscle.json'); await sceneScore(); }

async function endingNormal() {
	se('ending-good');
	// ending_normal base script, then optional "太りすぎ" line
	await playScript({
		id: 'hato-ending-normal-dyn',
		lines: [
			{type:'bg', path:'assets/bg/hutuu.png'},
			{speaker:'あなた', text:'やっぱりふつうが一番だよね！'},
			{speaker:'ハト',   text:'くるっぽー'},
			...(state.taijuu >= 400
				? [{speaker:'あなた', text:'でもちょっと太りすぎかな'}]
				: []),
		],
	});
	await sceneScore();
}

async function sceneScore() {
	await playScript({
		id: 'hato-score',
		lines: [
			{speaker:'', text:`今回のスコアは……\n${state.score.toLocaleString('ja-JP')}\nでした！`},
			{speaker:'', text:'遊んでくれてありがとう'},
		],
	});
	showScene('score');
	scoreVal.textContent = state.score.toLocaleString('ja-JP');
	await new Promise((r) => setTimeout(r, 3500));
	await sceneCredits();
}

// ── Credits scene ───────────────────────────────────────────
async function sceneCredits() {
	showScene('credits');
	buildCredits();

	creditsSkip.hidden = false;
	creditsSkip.classList.toggle('instant', edSeen());

	// Launch hatodrop in the minigame slot in parallel with the scroll.
	// Bridge missing (plain browser) is fine — module renders its own error.
	const slot = document.getElementById('minigame-slot');
	let hatodropActive = false;
	try {
		if (!physicsAvailable()) { throw new Error('physics bridge unavailable'); }
		await globalThis.hatoDrop.mount(slot);
		globalThis.hatoDrop.start();
		hatodropActive = true;
	} catch (e) {
		console.info('[hato] minigame unavailable:', e.message);
	}

	// Start scroll animation
	creditsScroll.classList.remove('playing');
	void creditsScroll.offsetWidth;  // reflow
	creditsScroll.classList.add('playing');

	return new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			creditsScroll.classList.remove('playing');
			creditsSkip.hidden = true;
			unlockMinigameOnEd();   // ED-seen + minigame unlocked
			resolve();
		};

		const onEnd = () => {
			creditsScroll.removeEventListener('animationend', onEnd);
			finish();
		};
		creditsScroll.addEventListener('animationend', onEnd);

		creditsSkip.onclick = () => {
			creditsScroll.removeEventListener('animationend', onEnd);
			se('click');
			finish();
		};
	}).then(async () => {
		// Tear down minigame if it was running.
		if (hatodropActive) {
			try { await globalThis.hatoDrop.destroy(); } catch {}
			hatodropActive = false;
		}

		// Hide credits scene so the prompt overlay isn't polluted by the
		// scroll snapping back to its initial transform after class removal.
		creditsScene.hidden = true;

		continuePrompt.hidden = false;
		const choice = await new Promise((resolve) => {
			const handler = (e) => {
				const b = e.target.closest('.continue-btn');
				if (!b) return;
				continuePrompt.removeEventListener('click', handler);
				se('click');
				resolve(b.dataset.continue);
			};
			continuePrompt.addEventListener('click', handler);
		});
		continuePrompt.hidden = true;
		// Phase Y: both choices go to title; Phase Z will route 'yes' to
		// standalone hatodrop.
		await sceneTitle();
	});
}

function buildCredits() {
	creditsScroll.innerHTML = CREDITS_DATA.map(renderCreditBlock).join('');
}

function renderCreditBlock(block) {
	switch (block.kind) {
	case 'title':
		return `<div class="title-block">
			<div class="title-main">${block.main}</div>
			<div class="title-sub">${block.sub}</div>
		</div>`;
	case 'spacer-big':   return `<div class="spacer-big"></div>`;
	case 'spacer-small': return `<div class="spacer-small"></div>`;
	case 'credit':
		return `<div class="credit-block">
			<div class="credit-role">${block.role}</div>
			<div class="credit-name">${block.name}</div>
		</div>`;
	case 'section':
		return `<div class="credit-section">${block.label}</div>`;
	case 'name-list':
		return `<div class="credit-name-list">${
			block.names.map(n => `<div class="credit-name">${n}</div>`).join('')
		}</div>`;
	case 'footer':
		return `<div class="credit-footer">${block.text}</div>`;
	case 'footer-small':
		return `<div class="credit-footer-small">${block.text}</div>`;
	case 'image':
		return `<div class="credit-image-block">
			<img src="${block.src}" alt="${block.alt || ''}" loading="lazy">
			${block.caption ? `<div class="credit-image-caption">${block.caption}</div>` : ''}
		</div>`;
	default: return '';
	}
}

/// The full credits data. ~95% "shiggy" with occasional gag variants.
const CREDITS_DATA = [
	{ kind: 'title', main: 'ハトを育てよう', sub: 'Original by shiggy (2023)' },
	{ kind: 'spacer-big' },

	{ kind: 'section', label: 'PRODUCTION' },
	{ kind: 'credit', role: 'Director',                     name: 'shiggy' },
	{ kind: 'credit', role: 'Executive Producer',           name: 'shiggy' },
	{ kind: 'credit', role: 'General Producer',             name: 'shiggy' },
	{ kind: 'credit', role: 'Line Producer',                name: 'shiggy' },
	{ kind: 'credit', role: 'Associate Producer',           name: 'shiggy' },
	{ kind: 'credit', role: 'Assistant Producer',           name: 'shiggy' },
	{ kind: 'credit', role: 'Assistant to Mr. shiggy',      name: 'shiggy' },
	{ kind: 'credit', role: 'Creative Director',            name: 'shiggy' },

	{ kind: 'section', label: 'ART' },
	{ kind: 'credit', role: 'Art Director',                 name: 'shiggy' },
	{ kind: 'credit', role: 'Character Designer',           name: 'shiggy' },
	{ kind: 'credit', role: 'Character Modeler',            name: 'shiggy' },
	{ kind: 'credit', role: 'Background Artist',            name: 'shiggy' },
	{ kind: 'credit', role: 'Background Painter',           name: 'shiggy' },
	{ kind: 'credit', role: 'Concept Artist',               name: 'shiggy' },
	{ kind: 'credit', role: 'Texture Artist',               name: 'shiggy' },
	{ kind: 'credit', role: 'UI Designer',                  name: 'shiggy' },
	{ kind: 'credit', role: 'Icon Designer',                name: 'shiggy' },

	{ kind: 'section', label: 'ENGINEERING' },
	{ kind: 'credit', role: 'Lead Programmer',              name: 'shiggy' },
	{ kind: 'credit', role: 'Gameplay Programmer',          name: 'shiggy' },
	{ kind: 'credit', role: 'Graphics Programmer',          name: 'shiggy' },
	{ kind: 'credit', role: 'Network Programmer',           name: 'shiggy' },
	{ kind: 'credit', role: 'Tools Programmer',             name: 'shiggy' },
	{ kind: 'credit', role: 'Engine Programmer',            name: 'shiggy' },
	{ kind: 'credit', role: 'Build Engineer',               name: 'shiggy' },

	{ kind: 'section', label: 'AUDIO' },
	{ kind: 'credit', role: 'Sound Director',               name: 'shiggy' },
	{ kind: 'credit', role: 'SE Designer',                  name: 'shiggy' },
	{ kind: 'credit', role: 'Audio Mastering',              name: 'shiggy' },

	{ kind: 'section', label: 'WRITING' },
	{ kind: 'credit', role: 'Scenario Writer',              name: 'shiggy' },
	{ kind: 'credit', role: 'Script Editor',                name: 'shiggy' },
	{ kind: 'credit', role: 'Dialogue Polish',              name: 'shiggy' },

	{ kind: 'section', label: 'LOCALIZATION' },
	{ kind: 'credit', role: 'Localization Director',        name: 'shiggy' },
	{ kind: 'credit', role: 'JP → EN',                      name: 'shiggy' },
	{ kind: 'credit', role: 'JP → ZH',                      name: 'shiggy' },
	{ kind: 'credit', role: 'JP → KO',                      name: 'shiggy' },
	{ kind: 'credit', role: 'Cultural Consultant',          name: 'shiggy' },

	{ kind: 'section', label: 'QA' },
	{ kind: 'credit', role: 'QA Lead',                      name: 'shiggy' },
	{ kind: 'credit', role: 'QA Tester #1',                 name: 'shiggy' },
	{ kind: 'credit', role: 'QA Tester #2',                 name: 'shiggy' },
	{ kind: 'credit', role: 'QA Tester #3',                 name: 'shiggy' },
	{ kind: 'credit', role: 'Bug Report Filer',             name: 'shiggy' },

	{ kind: 'section', label: 'BUSINESS' },
	{ kind: 'credit', role: 'Legal Counsel',                name: 'shiggy' },
	{ kind: 'credit', role: 'IP Counsel',                   name: 'shiggy' },
	{ kind: 'credit', role: 'Tax Accountant',               name: 'shiggy' },
	{ kind: 'credit', role: 'General Accountant',           name: 'shiggy' },
	{ kind: 'credit', role: 'Marketing Director',           name: 'shiggy' },
	{ kind: 'credit', role: 'Social Media Manager',         name: 'shiggy' },
	{ kind: 'credit', role: 'Community Manager',            name: 'shiggy' },
	{ kind: 'credit', role: 'PR Representative',            name: 'shiggy' },
	{ kind: 'credit', role: 'Customer Support',             name: 'shiggy' },

	{ kind: 'section', label: 'STUDIO OPERATIONS' },
	{ kind: 'credit', role: 'Office Manager',               name: 'shiggy' },
	{ kind: 'credit', role: 'Catering (Coffee)',            name: 'shiggy' },
	{ kind: 'credit', role: 'Catering (Lunch)',             name: 'shiggy' },
	{ kind: 'credit', role: 'Catering (Dinner)',            name: 'shiggy' },
	{ kind: 'credit', role: 'Driver',                       name: 'shiggy' },
	{ kind: 'credit', role: 'Chauffeur',                    name: 'shiggy' },
	{ kind: 'credit', role: 'Janitor',                      name: 'shiggy' },
	{ kind: 'credit', role: 'Night Security',               name: 'shiggy' },
	{ kind: 'credit', role: 'Day Security',                 name: 'shiggy' },
	{ kind: 'credit', role: 'Office Plant Care',            name: 'shiggy' },
	{ kind: 'credit', role: 'Studio Cat',                   name: 'shiggy' },
	{ kind: 'credit', role: 'Studio Dog',                   name: 'shiggy' },

	{ kind: 'section', label: 'WELLNESS' },
	{ kind: 'credit', role: 'Therapist',                    name: 'shiggy' },
	{ kind: 'credit', role: 'Motivational Speaker',         name: 'shiggy' },
	{ kind: 'credit', role: 'Meditation Coach',             name: 'shiggy' },
	{ kind: 'credit', role: 'Feng Shui Consultant',         name: 'shiggy' },
	{ kind: 'credit', role: 'Personal Trainer',             name: 'shiggy' },
	{ kind: 'credit', role: 'Nutritionist',                 name: 'shiggy' },

	{ kind: 'section', label: 'CEREMONIAL' },
	{ kind: 'credit', role: 'Stunt Coordinator',            name: 'shiggy' },
	{ kind: 'credit', role: 'Stunt Double',                 name: 'shiggy' },
	{ kind: 'credit', role: 'Event Planner',                name: 'shiggy' },
	{ kind: 'credit', role: 'Swag Designer',                name: 'shiggy' },
	{ kind: 'credit', role: 'Box Art Designer',             name: 'shiggy' },
	{ kind: 'credit', role: 'Manual Writer',                name: 'shiggy' },
	{ kind: 'credit', role: 'Tutorial Designer',            name: 'shiggy' },
	{ kind: 'credit', role: 'Achievement Designer',         name: 'shiggy' },
	{ kind: 'credit', role: 'Accessibility Consultant',     name: 'shiggy' },

	{ kind: 'spacer-big' },

	{ kind: 'section', label: 'SPECIAL THANKS' },
	{ kind: 'name-list', names: [
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
		'shiggy',
	]},

	{ kind: 'spacer-big' },

	{ kind: 'section', label: 'UNUSED EVENT ART' },
	{ kind: 'image', src: 'assets/unused/event_01.png', alt: 'unused event CG 1' },
	{ kind: 'image', src: 'assets/unused/event_02.png', alt: 'unused event CG 2' },
	{ kind: 'image', src: 'assets/unused/event_03.png', alt: 'unused event CG 3' },
	{ kind: 'image', src: 'assets/unused/event_04.png', alt: 'unused event CG 4' },
	{ kind: 'image', src: 'assets/unused/event_05.png', alt: 'unused event CG 5' },

	{ kind: 'spacer-big' },

	{ kind: 'section', label: 'VERY SPECIAL THANKS' },
	{ kind: 'name-list', names: ['YOU'] },

	{ kind: 'spacer-big' },
	{ kind: 'spacer-big' },

	{ kind: 'footer-small', text: 'Powered by' },
	{ kind: 'footer',       text: 'MitiruEngine' },
	{ kind: 'spacer-small' },
	{ kind: 'footer-small', text: 'Built with the MitiruEngine hybrid runtime.' },
	{ kind: 'footer-small', text: 'All rights reserved.' },
	{ kind: 'spacer-big' },
	{ kind: 'footer-small', text: 'Thank you for playing.' },
	{ kind: 'spacer-big' },
];

// ── Debug slice + boot ──────────────────────────────────────
if (globalThis.mitiru?.debug?.register) {
	mitiru.debug.register('hatoproject', () => ({
		scene: (novelRoot.hidden === false) ? 'novel'
		     : (gameScene.hidden === false) ? 'game'
		     : (titleScene.hidden === false) ? 'title'
		     : 'score',
		...state,
	}));
}

console.info('[HatoProject] boot');
sceneTitle();
