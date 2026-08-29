/*!
 * se.js — Web Audio synthesized SE for hato_project.
 *
 * Pure synthesis: no external files. Oscillators + gain envelope =
 * cheap blips that fit the hand-drawn absurdist tone.
 *
 * Exposed: window.hatoSe.play(name, opts?)
 * Names:
 *   click           — menu/button tap
 *   action-asobu    — playful chirp
 *   action-benkyou  — contemplative low
 *   action-gohan    — munching triplet
 *   action-kintore  — heavy thud
 *   action-sikaru   — descending scold
 *   stat-up         — ascending beep
 *   stat-down       — descending beep
 *   day             — soft chime
 *   ending-good     — major triad
 *   ending-bad      — minor descend
 *   shout           — intro !?!? burst
 */
(function(global) {
	'use strict';

	let _ctx = null;
	function ctx() {
		if (_ctx) return _ctx;
		const AC = global.AudioContext || global.webkitAudioContext;
		if (!AC) return null;
		_ctx = new AC();
		return _ctx;
	}

	let _masterVol = 0.35;

	/// Resume audio context — some browsers require user gesture before playing.
	function unlock() {
		const c = ctx();
		if (c && c.state === 'suspended') c.resume().catch(() => {});
	}

	/// Play a single tone with ADSR envelope.
	/// params: { freq, type, start=0, dur=0.15, attack=0.005, release=0.08, vol=1 }
	function tone(params) {
		const c = ctx();
		if (!c) return;
		const t0 = c.currentTime + (params.start || 0);
		const dur = params.dur ?? 0.15;
		const atk = params.attack ?? 0.005;
		// リリースが長さを超えると sustain の時刻が t0 より前になり、
		// AudioParam が負の時刻を受け取って例外になる（click は dur 0.05 < rel 0.08）
		const rel = Math.min(params.release ?? 0.08, dur);
		const vol = (params.vol ?? 1) * _masterVol;

		const osc = c.createOscillator();
		osc.type = params.type || 'sine';
		if (Array.isArray(params.freq)) {
			// Glide between two frequencies
			osc.frequency.setValueAtTime(params.freq[0], t0);
			osc.frequency.exponentialRampToValueAtTime(Math.max(1, params.freq[1]), t0 + dur);
		} else {
			osc.frequency.setValueAtTime(params.freq, t0);
		}

		const gain = c.createGain();
		gain.gain.setValueAtTime(0, t0);
		gain.gain.linearRampToValueAtTime(vol, t0 + atk);
		gain.gain.setValueAtTime(vol, Math.max(t0, t0 + dur - rel));
		gain.gain.linearRampToValueAtTime(0, t0 + dur);

		osc.connect(gain).connect(c.destination);
		osc.start(t0);
		osc.stop(t0 + dur + 0.02);
	}

	/// Play a short noise burst (for thud / crunch sounds).
	function noise(params) {
		const c = ctx();
		if (!c) return;
		const t0 = c.currentTime + (params.start || 0);
		const dur = params.dur ?? 0.08;
		const vol = (params.vol ?? 1) * _masterVol;

		const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);   // linear decay
		}
		const src = c.createBufferSource();
		src.buffer = buf;

		const filt = c.createBiquadFilter();
		filt.type = params.filterType || 'lowpass';
		filt.frequency.value = params.cutoff ?? 800;

		const gain = c.createGain();
		gain.gain.value = vol;

		src.connect(filt).connect(gain).connect(c.destination);
		src.start(t0);
	}

	const recipes = {
		click() {
			tone({ freq: 1400, type: 'triangle', dur: 0.05, vol: 0.5 });
		},

		'action-asobu'() {
			// Happy ascending arpeggio
			tone({ freq: 660, type: 'triangle', start: 0,    dur: 0.08, vol: 0.6 });
			tone({ freq: 880, type: 'triangle', start: 0.07, dur: 0.08, vol: 0.6 });
			tone({ freq: 1320, type:'triangle', start: 0.14, dur: 0.12, vol: 0.6 });
		},

		'action-benkyou'() {
			// Thoughtful low tone
			tone({ freq: 220, type: 'sine', dur: 0.25, vol: 0.5, release: 0.15 });
			tone({ freq: 165, type: 'sine', start: 0.08, dur: 0.22, vol: 0.35 });
		},

		'action-gohan'() {
			// Munching triplet
			for (let i = 0; i < 3; i++) {
				noise({ start: i * 0.07, dur: 0.05, cutoff: 600, vol: 0.5 });
			}
		},

		'action-kintore'() {
			// Heavy thud
			noise({ dur: 0.12, cutoff: 180, vol: 1.0 });
			tone({ freq: [90, 50], type: 'sine', dur: 0.18, vol: 0.6 });
		},

		'action-sikaru'() {
			// Descending scold
			tone({ freq: [700, 200], type: 'sawtooth', dur: 0.3, vol: 0.45, release: 0.2 });
		},

		'stat-up'() {
			tone({ freq: [600, 1000], type: 'triangle', dur: 0.15, vol: 0.5 });
		},

		'stat-down'() {
			tone({ freq: [600, 300], type: 'triangle', dur: 0.18, vol: 0.5 });
		},

		day() {
			// Soft bell-like chime (two sines)
			tone({ freq: 880, type: 'sine', dur: 0.45, vol: 0.35, release: 0.35 });
			tone({ freq: 1320, type:'sine', start: 0.03, dur: 0.4, vol: 0.22, release: 0.3 });
		},

		'ending-good'() {
			// Major triad arpeggio
			tone({ freq: 523, type: 'triangle', start: 0,    dur: 0.6, vol: 0.5, release: 0.4 });
			tone({ freq: 659, type: 'triangle', start: 0.12, dur: 0.55, vol: 0.5, release: 0.4 });
			tone({ freq: 784, type: 'triangle', start: 0.24, dur: 0.55, vol: 0.5, release: 0.4 });
			tone({ freq:1047, type: 'triangle', start: 0.36, dur: 0.7, vol: 0.45, release: 0.5 });
		},

		'ending-bad'() {
			// Minor descending
			tone({ freq: 440, type: 'sawtooth', dur: 0.35, vol: 0.45, release: 0.25 });
			tone({ freq: 370, type: 'sawtooth', start: 0.2, dur: 0.35, vol: 0.4 });
			tone({ freq: 294, type: 'sawtooth', start: 0.4, dur: 0.5, vol: 0.4, release: 0.4 });
		},

		shout() {
			// Short chaotic burst
			noise({ dur: 0.08, cutoff: 3000, vol: 0.8, filterType: 'highpass' });
			tone({ freq: [1800, 400], type: 'sawtooth', dur: 0.25, vol: 0.5 });
		},
	};

	global.hatoSe = {
		unlock,
		setVolume(v) { _masterVol = Math.max(0, Math.min(1, v)); },
		volume() { return _masterVol; },
		play(name) {
			const fn = recipes[name];
			if (!fn) { console.warn('[se] unknown recipe:', name); return; }
			try { fn(); } catch (e) { console.warn('[se] play failed:', e); }
		},
	};
})(window);
