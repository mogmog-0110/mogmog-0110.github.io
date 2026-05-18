(function () {
    const SCROLL_THRESHOLD = 400;

    function init() {
        const button = document.createElement('button');
        button.className = 'back-to-top';
        button.setAttribute('aria-label', 'ページ先頭に戻る');
        button.innerHTML = '↑';
        button.addEventListener('click', function () {
            const scroller = document.querySelector('.ui-overlay');
            if (scroller && scroller.scrollTop > 0) {
                scroller.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        document.body.appendChild(button);

        const scroller = document.querySelector('.ui-overlay') || window;

        function update() {
            const y = scroller === window
                ? (window.scrollY || document.documentElement.scrollTop)
                : scroller.scrollTop;
            if (y > SCROLL_THRESHOLD) {
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
            }
        }

        if (scroller === window) {
            window.addEventListener('scroll', update, { passive: true });
        } else {
            scroller.addEventListener('scroll', update, { passive: true });
        }
        update();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
