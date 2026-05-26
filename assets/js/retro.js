// retro.js — レトロ題画面の軽量スクリプト。
// 重い Three.js シーンを置き換え、ページ遷移の黒フェードだけ引き継ぐ。

(function () {
  // ページ内リンク以外への遷移時に黒フェード（白フラッシュ防止 + 場面転換感）。
  function setupPageFade() {
    document.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') ||
          href.startsWith('mailto:') || link.target === '_blank') {
        return;
      }
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var fade = document.createElement('div');
        fade.style.cssText =
          'position:fixed;inset:0;background:#0d0f1a;opacity:0;' +
          'transition:opacity .22s steps(4);z-index:10000;pointer-events:none;';
        document.body.appendChild(fade);
        requestAnimationFrame(function () { fade.style.opacity = '1'; });
        setTimeout(function () { window.location.href = href; }, 220);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPageFade);
  } else {
    setupPageFade();
  }
})();
