/* novel_glue.js: C++ が指した台本をノベル VM に流し、終わりを C++ へ返す。
 *
 * C++ は進行だけを持ち、文字送り・履歴・既読スキップはエンジンのノベル VM
 * (mitiru.novel) が持つ。その間をつなぐのがこのファイル。
 *
 * 受け取る値:
 *   view.novel.seq    増えたら新しい台本を流す合図
 *   view.novel.kind   台本の URL。行動の反応だけは "act"
 *   view.novel.bg     "act" のときの背景
 *   view.novel.line   "act" のときのハトの台詞
 *   view.novel.extra  ふつうの結末で太りすぎのときだけ足す一言
 *
 * 返す値:
 *   novel.done        台本を最後まで送り終えた
 */
(function () {
	'use strict';

	// 短い台詞を連打で飛ばせないように、行ごとに送りを止める
	var PER_LINE_LOCK_MS = 140;
	var SCENE_LOCK_MS = 260;

	var root = document.getElementById('novel-root');
	var mounted = false;
	var lastSeq = 0;
	var latest = { kind: '', bg: '', line: '', extra: '' };

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

	/// 行動の反応は台本ファイルを持たない。背景 1 枚と台詞 1 行から組む。
	function actScript() {
		return {
			id: 'hato-act',
			lines: [
				{ type: 'bg', path: latest.bg },
				{ speaker: 'ハト', text: latest.line },
			],
		};
	}

	/// 同梱した台本を返す。実行時に取りに行かないのは、Release の CEF が
	/// file:// の fetch と XHR を塞ぐため（配布物だけ導入で止まる）。
	function loadScript(path) {
		var all = window.hatoScripts || {};
		return all[path] ? JSON.parse(JSON.stringify(all[path])) : null;
	}

	function resolveScript() {
		if (latest.kind === 'act') { return actScript(); }
		var script = loadScript(latest.kind);
		if (!script) {
			window.hatoNovel.lastError = '台本が同梱されていない: ' + latest.kind;
			return null;
		}
		if (latest.extra) {
			script.lines = script.lines.concat([
				{ speaker: 'あなた', text: latest.extra },
			]);
		}
		return script;
	}

	// 中を外から見えるようにしておく。C++ と VM の間で値が落ちたとき、
	// どちらの側で止まったかを probe.py から 1 行で確かめられる
	window.hatoNovel = { latest: latest, plays: 0, lastError: '', seqSeen: 0 };

	/// 台本名が届くのを待ってから流す。onStateChange の保持値は購読した順に
	/// 配信されるとは限らないので、seq が先に来て kind が空のことがある。
	/// 順序に頼らず、揃うまで短く待つ
	function playWhenReady(tries) {
		if (!latest.kind) {
			if (tries > 0) { setTimeout(function () { playWhenReady(tries - 1); }, 30); }
			else { window.hatoNovel.lastError = '台本名が来ない'; }
			return;
		}
		play();
	}

	function play() {
		window.hatoNovel.plays += 1;
		if (!ensureMounted()) {
			window.hatoNovel.lastError = 'mount できない';
			return;
		}
		var script = resolveScript();
		if (!script) { return; }
		mitiru.novel.setSkipMode('off');
		Promise.resolve(mitiru.novel.load(script)).catch(function (e) {
			window.hatoNovel.lastError = 'load: ' + e;
		}).then(function () {
			var onEnd = function () {
				root.removeEventListener('novel:script:end', onEnd);
				mitiru.dispatch('novel.done');
			};
			root.addEventListener('novel:script:end', onEnd);
			mitiru.novel.advance();
		});
	}

	function watch(key, field) {
		mitiru.onStateChange(key, function (v) { latest[field] = v || ''; });
	}

	function boot() {
		if (!window.mitiru || !window.mitiru.onStateChange) {
			setTimeout(boot, 30);
			return;
		}
		watch('view.novel.kind',  'kind');
		watch('view.novel.bg',    'bg');
		watch('view.novel.line',  'line');
		watch('view.novel.extra', 'extra');
		// 送りも C++ から来る。ページ内のクリックではなくこちらを正にすると、
		// 入力台本だけで頭から終わりまで流せる
		var lastAdvance = 0;
		mitiru.onStateChange('view.novel.advance', function (n) {
			if (n === lastAdvance) { return; }
			lastAdvance = n;
			if (mounted) { mitiru.novel.advance(); }
		});
		mitiru.onStateChange('view.novel.seq', function (seq) {
			if (seq === lastSeq) { return; }
			lastSeq = seq;
			window.hatoNovel.seqSeen = seq;
			playWhenReady(20);
		});
		document.getElementById('backlog-btn')
			.addEventListener('click', function () { mitiru.novel.openBacklog(); });
		document.getElementById('skip-novel-btn')
			.addEventListener('click', function () { mitiru.novel.setSkipMode('all'); });
	}

	boot();
})();
