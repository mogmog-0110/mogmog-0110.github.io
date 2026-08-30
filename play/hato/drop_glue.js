// drop_glue.js はハトドロップの操作キーを C++ へ送る。
// Web 版では HTML 層のキーが WASM 側へ届く保証がないため、押している間は action を毎フレーム送る。

(function (global) {
	'use strict';
	var mitiru = global.mitiru;
	if (!mitiru || typeof mitiru.dispatch !== 'function') { return; }

	// CEF のバージョンによって code が欠落するため、キーは code、key、keyCode の 3 種類で識別する。
	var LEFT  = { codes: ['ArrowLeft', 'KeyA'],  keys: ['ArrowLeft', 'a', 'A'], nums: [37, 65] };
	var RIGHT = { codes: ['ArrowRight', 'KeyD'], keys: ['ArrowRight', 'd', 'D'], nums: [39, 68] };
	var FIRE  = { codes: ['Space', 'ArrowDown', 'KeyS'],
	              keys: [' ', 'Spacebar', 'ArrowDown', 's', 'S'], nums: [32, 40, 83] };

	function match(spec, e) {
		return spec.codes.indexOf(e.code) >= 0
		    || spec.keys.indexOf(e.key) >= 0
		    || spec.nums.indexOf(e.keyCode) >= 0;
	}

	var held = { left: false, right: false, fire: false };
	var active = false;

	mitiru.onStateChange('view.drop.visible', function (v) {
		active = (v === true || v === 1 || v === '1' || v === 'true');
		if (!active) { held.left = held.right = held.fire = false; }
	});

	function set(e, on) {
		if (match(LEFT, e))       { held.left = on; }
		else if (match(RIGHT, e)) { held.right = on; }
		else if (match(FIRE, e))  { held.fire = on; }
		else { return; }
		if (on) { e.preventDefault(); }
	}

	document.addEventListener('keydown', function (e) { if (active) { set(e, true); } });
	// 落ちものから抜けた瞬間のキーを押下状態のまま残さないため、場面にかかわらずキーの解放を拾う。
	document.addEventListener('keyup', function (e) { set(e, false); });
	global.addEventListener('blur', function () {
		held.left = held.right = held.fire = false;
	});

	// action は届いたフレームだけ真になるため、押下中は毎フレーム送る。
	(function pump() {
		global.requestAnimationFrame(pump);
		if (!active) { return; }
		if (held.left)  { mitiru.dispatch('drop.left'); }
		if (held.right) { mitiru.dispatch('drop.right'); }
		if (held.fire)  { mitiru.dispatch('drop.fire'); }
	})();
})(window);
