/* novel_glue.js: C++ が指した台本をノベル VM に流し、終わりを C++ へ返す。
 *
 * C++ は進行だけを持ち、文字送り・履歴・既読スキップはエンジンのノベル VM
 * (mitiru.novel) が持つ。その間をつなぐのがこのファイル。
 *
 * 受け取る値:
 *   view.novel.cue      seq と台本の指示を \x1f で連ねた 1 本の文字列。
 *                       seq / kind / bg / line / extra の順。購読値の配信順は
 *                       保証されないので、1 本にまとめて同時に受け取る
 *   view.novel.advance  増えたら 1 行送る
 *
 * 返す値:
 *   novel.done          台本を最後まで送り終えた
 */
(function () {
	'use strict';

	// 短い台詞を連打で飛ばせないように、行ごとに送りを止める
	var PER_LINE_LOCK_MS = 140;
	var SCENE_LOCK_MS = 260;

	var root = document.getElementById('novel-root');
	var mounted = false;
	var lastSeq = 0;
	var lastAdvance = 0;

	// 中を外から見えるようにしておく。C++ と VM のどちら側で値が落ちたかを
	// probe.py から 1 行で確かめられる
	window.hatoNovel = { cue: null, plays: 0, lastError: '' };

	function ensureMounted() {
		if (mounted || !window.mitiru || !window.mitiru.novel) { return mounted; }
		// 手描きの 4:3 素材なので cover だと端が切れる
		mitiru.novel.mount(root, { bgFit: 'contain' });
		mitiru.novel.setInputLockout({
			sceneTransitionMs: SCENE_LOCK_MS,
			perLineMs: PER_LINE_LOCK_MS,
		});
		root.addEventListener('novel:line:start', function (e) {
			var line = (e.detail && e.detail.line) || {};
			if (window.hatoSe && line.speaker) { hatoSe.play('click'); }
		});
		mounted = true;
		return true;
	}

	function parseCue(raw) {
		var p = String(raw || '').split('\x1f');
		return { seq: parseInt(p[0], 10) || 0, kind: p[1] || '',
		         bg: p[2] || '', line: p[3] || '', extra: p[4] || '' };
	}

	/// 行動の反応は台本ファイルを持たない。背景 1 枚と台詞 1 行から組む。
	function actScript(cue) {
		return {
			id: 'hato-act',
			lines: [
				{ type: 'bg', path: cue.bg },
				{ speaker: 'ハト', text: cue.line },
			],
		};
	}

	/// 同梱した台本を返す。実行時に取りに行かないのは、Release の CEF が
	/// file:// の fetch と XHR を塞ぐため。
	function resolveScript(cue) {
		if (cue.kind === 'act') { return actScript(cue); }
		var all = window.hatoScripts || {};
		if (!all[cue.kind]) {
			window.hatoNovel.lastError = '台本が同梱されていない: ' + cue.kind;
			return null;
		}
		var script = JSON.parse(JSON.stringify(all[cue.kind]));
		if (cue.extra) {
			script.lines = script.lines.concat([
				{ speaker: 'あなた', text: cue.extra },
			]);
		}
		return script;
	}

	function play(cue) {
		window.hatoNovel.plays += 1;
		if (!ensureMounted()) {
			window.hatoNovel.lastError = 'mount できない';
			return;
		}
		var script = resolveScript(cue);
		if (!script) { return; }
		mitiru.novel.setSkipMode('off');
		// 読み込みに失敗したときは送らない。VM には前の台本が残っているので、
		// 送るとそちらが先頭から流れ直す
		Promise.resolve(mitiru.novel.load(script)).then(function () {
			var onEnd = function () {
				root.removeEventListener('novel:script:end', onEnd);
				mitiru.dispatch('novel.done');
			};
			root.addEventListener('novel:script:end', onEnd);
			mitiru.novel.advance();
		}, function (e) {
			window.hatoNovel.lastError = 'load: ' + e;
		});
	}

	function boot() {
		if (!window.mitiru || !window.mitiru.onStateChange) {
			setTimeout(boot, 30);
			return;
		}
		// 送りも C++ から来る。ページ内のクリックではなくこちらを正にすると、
		// 入力台本だけで頭から終わりまで流せる
		mitiru.onStateChange('view.novel.advance', function (n) {
			if (n === lastAdvance) { return; }
			lastAdvance = n;
			if (mounted) { mitiru.novel.advance(); }
		});
		mitiru.onStateChange('view.novel.cue', function (raw) {
			var cue = parseCue(raw);
			window.hatoNovel.cue = cue;
			if (cue.seq === lastSeq || cue.seq === 0) { return; }
			lastSeq = cue.seq;
			play(cue);
		});
		document.getElementById('backlog-btn')
			.addEventListener('click', function () { mitiru.novel.openBacklog(); });
		document.getElementById('skip-novel-btn')
			.addEventListener('click', function () { mitiru.novel.setSkipMode('all'); });
	}

	boot();
})();
