/* ============================================================
   works-modal.js — Works の縮小カード / サムネから詳細モーダルを開く
   2 つのトリガを扱う:
     [data-modal="tplId"]  … 同 id の <template> を複製して表示（リッチ詳細）
     [data-img="src"]      … 画像 1 枚を拡大表示（イラスト用ライトボックス）
   ESC・×・外側クリックで閉じ、フォーカスを元に戻す。
   ============================================================ */
(function () {
    var overlay = document.getElementById('work-modal');
    if (!overlay) return;

    var content = overlay.querySelector('.modal-content');
    var closeBtn = overlay.querySelector('.modal-close');
    var lastFocus = null;

    function openPanel() {
        lastFocus = document.activeElement;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
    }

    function openTemplate(id) {
        var tpl = document.getElementById(id);
        if (!tpl || !('content' in tpl)) return;
        content.innerHTML = '';
        content.appendChild(tpl.content.cloneNode(true));
        openPanel();
    }

    function openImage(src, cap) {
        content.innerHTML = '';
        var img = document.createElement('img');
        img.className = 'media';
        img.src = src;
        img.alt = cap || '';
        content.appendChild(img);
        if (cap) {
            var p = document.createElement('p');
            p.className = 'media-caption';
            p.textContent = cap;
            content.appendChild(p);
        }
        openPanel();
    }

    function close() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        content.innerHTML = '';
        if (lastFocus) lastFocus.focus();
    }

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-modal], [data-img]');
        if (trigger) {
            e.preventDefault();
            if (trigger.hasAttribute('data-modal')) {
                openTemplate(trigger.getAttribute('data-modal'));
            } else {
                openImage(trigger.getAttribute('data-img'), trigger.getAttribute('data-cap'));
            }
            return;
        }
        if (e.target === overlay) close();
    });

    closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
})();
