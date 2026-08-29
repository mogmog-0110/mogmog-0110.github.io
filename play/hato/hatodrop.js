/*!
 * hatodrop.js — watermelon-style merge game where a pigeon drops eggs.
 *
 * Physics is owned by mitiru.physics (engine-side Box2D via CEF bridge).
 * In plain browser this module errors out at mount — use the CEF build.
 *
 * Coordinate system: same pixel space as the DOM (top-left origin).
 * Gravity positive = downward.
 *
 * ── Public API ──────────────────────────────────────────────────────
 *   window.hatoDrop.mount(containerEl)    Promise<void>
 *   window.hatoDrop.start()
 *   window.hatoDrop.stop()
 *   window.hatoDrop.destroy()             Promise<void>
 *   window.hatoDrop.score()               number
 *   window.hatoDrop.onScoreChange(fn)     unsubscribe:function
 *   window.hatoDrop.onGameOver(fn)        unsubscribe:function
 */
(function(global) {
	'use strict';
	if (global.hatoDrop) return;

	// ── field geometry ──────────────────────────────────────────
	// Container is 853×720 (2/3 of the 1280 stage). Pigeon lives in the
	// top band; eggs fall in the play field beneath.
	const FIELD_W = 853;
	const FIELD_H = 720;
	const TOP_BAND = 120;           // pigeon altitude, game-over line below
	const GAMEOVER_Y = TOP_BAND + 14;
	const FLOOR_Y = FIELD_H - 20;
	const WALL_MARGIN = 16;
	const LEFT_WALL_X = WALL_MARGIN;
	const RIGHT_WALL_X = FIELD_W - WALL_MARGIN;

	// ── egg levels ──────────────────────────────────────────────
	// Colorful palette + steeper size progression so each merge feels
	// like a real upgrade. Lv7 (legendary) is the auto-clear target.
	const EGG_LEVELS = [
		{ r: 26,  color: '#ffffff', name: 'Lv1' },   // small white
		{ r: 38,  color: '#fff2a8', name: 'Lv2' },   // pale yellow
		{ r: 54,  color: '#ffc070', name: 'Lv3' },   // orange
		{ r: 72,  color: '#ff7878', name: 'Lv4' },   // pink/red
		{ r: 92,  color: '#7ec0ff', name: 'Lv5' },   // sky blue
		{ r: 116, color: '#a8e88a', name: 'Lv6' },   // mint
		{ r: 144, color: '#c890ff', name: 'legendary' },   // legendary purple
	];

	const POOP = { r: 30, glyph: '💩', name: 'poop' };

	const DROP_POOL      = [0, 0, 0, 1, 1, 2];   // Lv1/Lv2/Lv3 drops (weights 3:2:1)
	const POOP_CHANCE    = 0.03;           // 3%
	const PIGEON_SPEED   = 420;            // px/sec
	const GRAVITY_Y      = 900;            // Box2D uses positive-down here
	const DROP_COOLDOWN  = 550;            // ms between drops

	// ── module state ────────────────────────────────────────────
	let _container = null;
	let _fieldEl   = null;
	let _pigeonEl  = null;
	let _eggsLayerEl = null;
	let _scoreEl   = null;
	let _world     = null;
	let _started   = false;
	let _destroyed = false;

	// Pigeon kinematics (pure JS — not physics-driven)
	let _pigeonX = FIELD_W / 2;
	const PIGEON_Y = 4;
	const PIGEON_W = 120;
	const PIGEON_H = 108;
	let _pigeonFacing = -1;   // -1 = left (default sprite), +1 = right (flipped)
	let _pigeonAngry = false;
	let _lastFrame = 0;
	let _rafId = null;

	// Input
	const _keys = new Set();
	let _lastDropAt = 0;

	// Bodies: id → { el, level, isPoop, r, mergedOut }
	const _bodies = new Map();
	let _gameOver = false;
	let _score = 0;
	let _gameOverPending = 0;         // timestamp when stack first crossed line
	const GAMEOVER_GRACE_MS = 2000;
	let _nextLevel = 0;               // pre-decided next drop level
	let _nextEl = null;               // preview swatch element
	const _scoreListeners = [];
	const _gameOverListeners = [];

	function addScore(delta) {
		_score += delta;
		if (_scoreEl) _scoreEl.textContent = 'Score: ' + _score;
		_scoreListeners.forEach(fn => { try { fn(_score, delta); } catch {} });
	}

	// ── DOM scaffolding ─────────────────────────────────────────
	async function mount(containerEl) {
		if (_destroyed) throw new Error('hatoDrop destroyed');
		_container = containerEl;
		_container.innerHTML = '';
		_container.classList.add('hatodrop-root');

		_fieldEl = document.createElement('div');
		_fieldEl.className = 'hatodrop-field';

		// Top band with game-over line
		const topBand = document.createElement('div');
		topBand.className = 'hatodrop-top-band';
		topBand.style.height = TOP_BAND + 'px';

		const goLine = document.createElement('div');
		goLine.className = 'hatodrop-gameover-line';
		goLine.style.top = GAMEOVER_Y + 'px';

		// Pigeon sprite — scaled-down normal_hato. Flipped on right-facing.
		// Swaps to okoru_hato while pooping for the gag reaction.
		_pigeonEl = document.createElement('img');
		_pigeonEl.className = 'hatodrop-pigeon';
		_pigeonEl.src = 'assets/chara/normal_hato.png';
		_pigeonEl.alt = '';

		_eggsLayerEl = document.createElement('div');
		_eggsLayerEl.className = 'hatodrop-eggs';

		_scoreEl = document.createElement('div');
		_scoreEl.className = 'hatodrop-score';
		_scoreEl.textContent = 'Score: 0';

		// Next-drop preview at top-left.
		const nextWrap = document.createElement('div');
		nextWrap.className = 'hatodrop-next-wrap';
		const nextLabel = document.createElement('div');
		nextLabel.className = 'hatodrop-next-label';
		nextLabel.textContent = 'Next';
		_nextEl = document.createElement('div');
		_nextEl.className = 'hatodrop-next-swatch';
		nextWrap.appendChild(nextLabel);
		nextWrap.appendChild(_nextEl);

		const hint = document.createElement('div');
		hint.className = 'hatodrop-hint';
		hint.innerHTML = '← → / A D で移動、↓ / Space / クリックで卵投下';

		_fieldEl.appendChild(topBand);
		_fieldEl.appendChild(goLine);
		_fieldEl.appendChild(_eggsLayerEl);
		_fieldEl.appendChild(_pigeonEl);
		_fieldEl.appendChild(_scoreEl);
		_fieldEl.appendChild(nextWrap);
		_fieldEl.appendChild(hint);
		_container.appendChild(_fieldEl);

		// Make the field a focus target so arrow keys work even if the
		// user clicks elsewhere first.
		_fieldEl.setAttribute('tabindex', '0');

		pickNextLevel();
		positionPigeon();

		// Physics world init. In plain browser (no cefQuery) this rejects
		// and we show an error overlay instead of silently failing.
		try {
			_world = await mitiru.physics.createWorld({
				gravityX: 0, gravityY: GRAVITY_Y,
			});
		} catch (e) {
			showBridgeMissingOverlay(e);
			throw e;
		}

		// Build static boundaries: floor + two walls.
		await _world.createStaticEdge({
			x1: LEFT_WALL_X,  y1: FLOOR_Y,
			x2: RIGHT_WALL_X, y2: FLOOR_Y,
			friction: 0.5, restitution: 0.1,
		});
		await _world.createStaticEdge({
			x1: LEFT_WALL_X, y1: 0,
			x2: LEFT_WALL_X, y2: FLOOR_Y,
			friction: 0.5, restitution: 0.1,
		});
		await _world.createStaticEdge({
			x1: RIGHT_WALL_X, y1: 0,
			x2: RIGHT_WALL_X, y2: FLOOR_Y,
			friction: 0.5, restitution: 0.1,
		});

		// Subscribe to physics events.
		_world.on('bodies:update', onBodiesUpdate);
		_world.on('contact', onContact);
		_world.on('error', (err) => console.error('[hatodrop] physics:', err));
	}

	function showBridgeMissingOverlay(err) {
		if (!_fieldEl) return;
		const overlay = document.createElement('div');
		overlay.className = 'hatodrop-bridge-missing';
		overlay.innerHTML = `
			<div class="title">Physics bridge unavailable</div>
			<div class="detail">This is a plain-browser session.<br>
			Run the CEF build to play hatodrop.</div>
			<div class="small">${String(err?.message || err)}</div>
		`;
		_fieldEl.appendChild(overlay);
	}

	// ── Pigeon motion ───────────────────────────────────────────
	function positionPigeon() {
		const flipX = _pigeonFacing > 0 ? -1 : 1;
		_pigeonEl.style.transform =
			`translate(${_pigeonX - PIGEON_W / 2}px, ${PIGEON_Y}px) scaleX(${flipX})`;
	}

	function clampPigeon() {
		const minX = LEFT_WALL_X + PIGEON_W / 2;
		const maxX = RIGHT_WALL_X - PIGEON_W / 2;
		if (_pigeonX < minX) _pigeonX = minX;
		if (_pigeonX > maxX) _pigeonX = maxX;
	}

	function setPigeonAngry(angry) {
		if (_pigeonAngry === angry) return;
		_pigeonAngry = angry;
		_pigeonEl.src = angry
			? 'assets/chara/okoru_hato.png'
			: 'assets/chara/normal_hato.png';
	}

	function pickNextLevel() {
		_nextLevel = DROP_POOL[Math.floor(Math.random() * DROP_POOL.length)];
		updateNextPreview();
	}

	function updateNextPreview() {
		if (!_nextEl) return;
		const spec = EGG_LEVELS[_nextLevel];
		// Scale proportionally with a generous max so Lv5+ look distinct.
		// Drops are Lv1-3; higher tiers are reached via merging.
		const previewR = Math.min(spec.r * 0.6, 36);
		_nextEl.style.width  = (previewR * 2) + 'px';
		_nextEl.style.height = (previewR * 2) + 'px';
		_nextEl.style.background = spec.color;
	}

	// ── Egg spawning ────────────────────────────────────────────
	async function dropEgg() {
		if (!_world || _gameOver) return;
		const now = performance.now();
		if (now - _lastDropAt < DROP_COOLDOWN) return;
		_lastDropAt = now;

		const spawnY = PIGEON_Y + PIGEON_H + 10;   // just below the pigeon
		const isPoop = Math.random() < POOP_CHANCE;

		if (isPoop) {
			// Pigeon stays angry long enough for the gag to land.
			setPigeonAngry(true);
			setTimeout(() => setPigeonAngry(false), 2500);

			const id = await _world.createCircle({
				x: _pigeonX, y: spawnY, r: POOP.r,
				density: 0.8, restitution: 0.05, friction: 0.9,
				userData: 'poop',
			});
			registerBody(id, { level: -1, isPoop: true, glyph: POOP.glyph, r: POOP.r });
			globalThis.hatoSe?.play('stat-down');
			return;
		}

		const level = _nextLevel;
		const spec = EGG_LEVELS[level];
		const id = await _world.createCircle({
			x: _pigeonX, y: spawnY, r: spec.r,
			density: 1.0, restitution: 0.2, friction: 0.5,
			userData: `egg:${level}`,
		});
		registerBody(id, { level, isPoop: false, color: spec.color, r: spec.r });
		globalThis.hatoSe?.play('click');
		// Pre-decide the next drop so the preview reflects what will fall.
		pickNextLevel();
	}

	function registerBody(id, data) {
		// Create the visual element.
		const el = document.createElement('div');
		el.className = data.isPoop ? 'hatodrop-body hatodrop-poop' : 'hatodrop-body hatodrop-egg';
		el.style.width  = (data.r * 2) + 'px';
		el.style.height = (data.r * 2) + 'px';
		el.style.marginLeft = (-data.r) + 'px';
		el.style.marginTop  = (-data.r) + 'px';
		el.dataset.id = id;
		if (data.isPoop) {
			// Render glyph (💩) sized to fit the radius.
			el.style.fontSize = (data.r * 2.0) + 'px';
			el.textContent = data.glyph || '💩';
		} else {
			el.style.background = data.color;
			el.dataset.level = data.level;
		}
		_eggsLayerEl.appendChild(el);

		_bodies.set(id, { el, level: data.level, isPoop: data.isPoop, r: data.r });
	}

	// ── Physics → DOM sync ──────────────────────────────────────
	/// Track latest known position per body so contact handler can place
	/// the merged body at the midpoint of the pair.
	const _lastPos = new Map();

	function onBodiesUpdate(bodies) {
		let overLine = false;
		let nearlySettled = 0;   // bodies settled above the line
		for (const b of bodies) {
			const rec = _bodies.get(b.id);
			if (!rec || rec.mergedOut) continue;
			rec.el.style.transform =
				`translate(${b.x}px, ${b.y}px) rotate(${b.angle}rad)`;
			_lastPos.set(b.id, { x: b.x, y: b.y });
			if (b.y - rec.r < GAMEOVER_Y) {
				overLine = true;
				if (Math.abs(b.vx || 0) + Math.abs(b.vy || 0) < 8) nearlySettled++;
			}
		}

		// Sustained-over-line game-over detection. We only arm when bodies
		// are close to rest; a one-frame tall stack shouldn't lose.
		const now = performance.now();
		if (overLine && nearlySettled > 0) {
			if (_gameOverPending === 0) _gameOverPending = now;
			else if (now - _gameOverPending > GAMEOVER_GRACE_MS) triggerGameOver();
		} else {
			_gameOverPending = 0;
		}
	}

	/// Contact between two bodies. Same-level non-rotten eggs merge into
	/// the next tier. Lv7+Lv7 clears both with a bonus. Poop-touches-egg
	/// rots the egg (merge-locked).
	async function onContact(ev) {
		if (_gameOver) return;
		const a = _bodies.get(ev.a);
		const b = _bodies.get(ev.b);
		if (!a || !b || a.mergedOut || b.mergedOut) return;

		// Any contact involving poop is just a physical collision —
		// poop never merges with anything.
		if (a.isPoop || b.isPoop) return;

		// Both eggs. Merge iff same level.
		if (a.level !== b.level) return;
		const level = a.level;

		// Mark both as consumed so stray contact events can't double-merge.
		a.mergedOut = true;
		b.mergedOut = true;

		const pa = _lastPos.get(ev.a) || { x: 0, y: 0 };
		const pb = _lastPos.get(ev.b) || { x: 0, y: 0 };
		const mx = (pa.x + pb.x) / 2;
		const my = (pa.y + pb.y) / 2;

		// Destroy both and remove their visuals.
		try { await _world.destroyBody(ev.a); } catch {}
		try { await _world.destroyBody(ev.b); } catch {}
		a.el.remove(); b.el.remove();
		_bodies.delete(ev.a); _bodies.delete(ev.b);
		_lastPos.delete(ev.a); _lastPos.delete(ev.b);

		// Score: (level+1)^2 × 10  (Lv1→Lv2 = 40, Lv2→Lv3 = 90, ...)
		const mergeScore = (level + 2) * (level + 2) * 10;
		addScore(mergeScore);
		globalThis.hatoSe?.play('stat-up');

		const nextLevel = level + 1;
		if (nextLevel >= EGG_LEVELS.length) {
			// Lv7 achieved — blow it up with a bonus and don't respawn.
			addScore(5000);
			globalThis.hatoSe?.play('ending-good');
			return;
		}

		const spec = EGG_LEVELS[nextLevel];
		const id = await _world.createCircle({
			x: mx, y: my, r: spec.r,
			density: 1.0, restitution: 0.2, friction: 0.5,
			userData: `egg:${nextLevel}`,
		});
		registerBody(id, { level: nextLevel, isPoop: false, color: spec.color, r: spec.r });
	}

	function triggerGameOver() {
		if (_gameOver) return;
		_gameOver = true;
		globalThis.hatoSe?.play('ending-bad');
		const banner = document.createElement('div');
		banner.className = 'hatodrop-gameover';
		banner.innerHTML = `
			<div class="title">Game Over</div>
			<div class="sub">Score: ${_score.toLocaleString('ja-JP')}</div>
			<button class="hatodrop-retry">もう一度</button>
		`;
		_fieldEl.appendChild(banner);
		const retryBtn = banner.querySelector('.hatodrop-retry');
		retryBtn.addEventListener('click', async (e) => {
			e.stopPropagation();   // don't bubble to field click → dropEgg
			globalThis.hatoSe?.play('click');
			await restart();
		});
		_gameOverListeners.forEach(fn => { try { fn(_score); } catch {} });
	}

	/// Reset world state and rebuild boundaries to let the player retry
	/// without destroying + remounting the module.
	async function restart() {
		if (!_world) return;
		// Stop physics loop while we rebuild.
		_world.stop();
		// Remove all body elements + physics handles.
		for (const [id, rec] of _bodies) {
			try { await _world.destroyBody(id); } catch {}
			rec.el.remove();
		}
		_bodies.clear();
		_lastPos.clear();
		// Clear banner.
		const banner = _fieldEl?.querySelector('.hatodrop-gameover');
		if (banner) banner.remove();
		// Reset state.
		_score = 0;
		_gameOver = false;
		_gameOverPending = 0;
		_lastDropAt = 0;
		_pigeonX = FIELD_W / 2;
		_pigeonFacing = -1;
		_pigeonAngry = false;
		_pigeonEl.src = 'assets/chara/normal_hato.png';
		positionPigeon();
		if (_scoreEl) _scoreEl.textContent = 'Score: 0';
		pickNextLevel();
		_world.start();
		_scoreListeners.forEach(fn => { try { fn(0, 0); } catch {} });
	}

	// ── Main loop (pigeon only) ─────────────────────────────────
	function tick(ts) {
		if (!_started) return;
		const dt = _lastFrame ? Math.min(0.05, (ts - _lastFrame) / 1000) : 0;
		_lastFrame = ts;

		// Pigeon input (keys normalized to 'left'/'right' by onKeyDown)
		let dir = 0;
		if (_keys.has('left'))  dir -= 1;
		if (_keys.has('right')) dir += 1;
		if (dir !== 0) _pigeonFacing = dir;   // Face direction of travel.
		_pigeonX += dir * PIGEON_SPEED * dt;
		clampPigeon();
		positionPigeon();

		_rafId = requestAnimationFrame(tick);
	}

	// ── Input ───────────────────────────────────────────────────
	// Accept key identity via three channels — e.code (standard),
	// e.key (browser-reported name), and e.keyCode (legacy numeric) —
	// because CEF key event forwarding can miss code strings in some
	// Chromium builds and we want arrow keys to just work.

	const KEY_LEFT_CODES  = new Set(['ArrowLeft',  'KeyA']);
	const KEY_RIGHT_CODES = new Set(['ArrowRight', 'KeyD']);
	const KEY_DROP_CODES  = new Set(['Space', 'ArrowDown', 'KeyS']);
	const KEY_LEFT_KEYS   = new Set(['ArrowLeft',  'a', 'A']);
	const KEY_RIGHT_KEYS  = new Set(['ArrowRight', 'd', 'D']);
	const KEY_DROP_KEYS   = new Set([' ', 'ArrowDown', 's', 'S', 'Spacebar']);
	// Legacy numeric: Left=37, Up=38, Right=39, Down=40, Space=32, A=65, D=68, S=83
	const KEY_LEFT_CODES_NUM  = new Set([37, 65]);
	const KEY_RIGHT_CODES_NUM = new Set([39, 68]);
	const KEY_DROP_CODES_NUM  = new Set([40, 32, 83]);

	function classifyKey(e) {
		if (KEY_LEFT_CODES.has(e.code)  || KEY_LEFT_KEYS.has(e.key)  || KEY_LEFT_CODES_NUM.has(e.keyCode))  return 'left';
		if (KEY_RIGHT_CODES.has(e.code) || KEY_RIGHT_KEYS.has(e.key) || KEY_RIGHT_CODES_NUM.has(e.keyCode)) return 'right';
		if (KEY_DROP_CODES.has(e.code)  || KEY_DROP_KEYS.has(e.key)  || KEY_DROP_CODES_NUM.has(e.keyCode))  return 'drop';
		return null;
	}

	function onKeyDown(e) {
		// Debug trace — left on during Z2 shakeout so we can diagnose
		// "keys don't work" reports by reading DevTools console.
		if (globalThis.__hatoKeyDebug) {
			console.log('[hato] keydown', {code:e.code, key:e.key, keyCode:e.keyCode, started:_started});
		}
		if (!_started) return;
		const kind = classifyKey(e);
		if (!kind) return;
		if (kind === 'left')  { _keys.add('left');  e.preventDefault(); }
		if (kind === 'right') { _keys.add('right'); e.preventDefault(); }
		if (kind === 'drop')  { dropEgg();          e.preventDefault(); }
	}

	function onKeyUp(e) {
		const kind = classifyKey(e);
		if (kind === 'left' || kind === 'right') _keys.delete(kind);
	}

	function onFieldClick() {
		if (_started) dropEgg();
	}

	// ── Lifecycle ───────────────────────────────────────────────
	function start() {
		if (!_world || _started) return;
		_started = true;
		_lastFrame = 0;
		_rafId = requestAnimationFrame(tick);
		_world.start();
		// Listen on window AND document so we catch keys regardless of
		// where focus landed during scene transitions.
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup',   onKeyUp);
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('keyup',   onKeyUp);
		_fieldEl.addEventListener('click', onFieldClick);
		// Pull keyboard focus to the field so arrow keys never get
		// captured by some other element on the page.
		try { _fieldEl.focus({ preventScroll: true }); } catch {}
	}

	function stop() {
		if (!_started) return;
		_started = false;
		if (_rafId) cancelAnimationFrame(_rafId);
		_rafId = null;
		if (_world) _world.stop();
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup',   onKeyUp);
		document.removeEventListener('keydown', onKeyDown);
		document.removeEventListener('keyup',   onKeyUp);
		if (_fieldEl) _fieldEl.removeEventListener('click', onFieldClick);
	}

	async function destroy() {
		stop();
		_destroyed = true;
		_keys.clear();
		_bodies.clear();
		if (_world) {
			try { await _world.destroy(); } catch {}
			_world = null;
		}
		if (_container) {
			_container.innerHTML = '';
			_container.classList.remove('hatodrop-root');
		}
		_container = _fieldEl = _pigeonEl = _eggsLayerEl = _scoreEl = null;
	}

	// ── Observers ───────────────────────────────────────────────
	function score() { return _score; }

	function onScoreChange(fn) {
		_scoreListeners.push(fn);
		return () => {
			const i = _scoreListeners.indexOf(fn);
			if (i >= 0) _scoreListeners.splice(i, 1);
		};
	}

	function onGameOver(fn) {
		_gameOverListeners.push(fn);
		return () => {
			const i = _gameOverListeners.indexOf(fn);
			if (i >= 0) _gameOverListeners.splice(i, 1);
		};
	}

	global.hatoDrop = {
		mount, start, stop, destroy,
		score, onScoreChange, onGameOver,
	};
})(window);
