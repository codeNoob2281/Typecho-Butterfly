/**
 * 后台「Markdown设置 → 代码块高亮样式」实时预览。
 *
 * 作用：在 codeTheme 下拉框下方渲染「浅色模式」「深色模式」两个代码块预览，
 * 当站长切换下拉框时实时加载对应 highlight.js 主题 CSS 并刷新配色。
 *
 * 实现要点：
 * - 两个预览分别放进 Shadow DOM，隔离各自 <link> 引入的 highlight.js 主题，
 *   避免「浅色主题」和「深色主题」两份 CSS 同时作用于整页而互相覆盖。
 * - 主题文件映射由 PHP 通过 data-bf-code-theme-config 注入，避免前后端重复维护。
 * - highlight.js 按需从 CDN 加载；未就绪时先加载再渲染。
 */
(function () {
    'use strict';

    var HLJS_PROMISE = null;

    function loadScript(url) {
        if (!url) {
            return Promise.reject(new Error('empty hljs url'));
        }
        if (HLJS_PROMISE) {
            return HLJS_PROMISE;
        }
        HLJS_PROMISE = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.async = true;
            s.onload = function () {
                resolve(window.hljs);
            };
            s.onerror = function () {
                reject(new Error('failed to load hljs: ' + url));
            };
            document.head.appendChild(s);
        });
        return HLJS_PROMISE;
    }

    function ensureHljs(cfg) {
        if (window.hljs && typeof window.hljs.highlight === 'function') {
            return Promise.resolve(window.hljs);
        }
        return loadScript(cfg.hljs);
    }

    function highlightSample(hljs, code) {
        try {
            if (hljs && typeof hljs.highlight === 'function') {
                return hljs.highlight(code, { language: 'javascript', ignoreIllegals: true }).value;
            }
        } catch (e) {
            /* ignore and fall back to plain text */
        }
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function buildPreviewDom() {
        var wrap = document.createElement('div');
        wrap.className = 'bf-code-theme-preview';

        var lightCol = document.createElement('div');
        lightCol.className = 'bf-ct-col';
        var lightTitle = document.createElement('div');
        lightTitle.className = 'bf-ct-title';
        lightTitle.innerHTML = '<i class="bf-ct-dot bf-ct-dot--light"></i>浅色模式预览';
        var lightBody = document.createElement('div');
        lightBody.className = 'bf-ct-body bf-ct-body--light';
        lightBody.setAttribute('data-mode', 'light');
        lightCol.appendChild(lightTitle);
        lightCol.appendChild(lightBody);

        var darkCol = document.createElement('div');
        darkCol.className = 'bf-ct-col';
        var darkTitle = document.createElement('div');
        darkTitle.className = 'bf-ct-title';
        darkTitle.innerHTML = '<i class="bf-ct-dot bf-ct-dot--dark"></i>深色模式预览';
        var darkBody = document.createElement('div');
        darkBody.className = 'bf-ct-body bf-ct-body--dark';
        darkBody.setAttribute('data-mode', 'dark');
        darkCol.appendChild(darkTitle);
        darkCol.appendChild(darkBody);

        wrap.appendChild(lightCol);
        wrap.appendChild(darkCol);

        return {
            wrap: wrap,
            lightBody: lightBody,
            darkBody: darkBody
        };
    }

    function getShadowHost(host) {
        if (!host.__bfShadow) {
            host.__bfShadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;
        }
        return host.__bfShadow;
    }

    function renderPanel(host, cssName, highlightedHtml, cfg, fontStack) {
        var shadow = getShadowHost(host);
        var fontCss = fontStack || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        if (!shadow) {
            // Shadow DOM 不支持时退化为直接 innerHTML（老浏览器）
            host.innerHTML = "<pre style='font-family:" + fontCss + ";margin:0'><code class='hljs language-javascript' style='font-family:inherit'>" + highlightedHtml + '</code></pre>';
            return;
        }
        var cssUrl = (cfg.cdn || '') + cssName + '.min.css';
        shadow.innerHTML =
            '<link rel="stylesheet" href="' + cssUrl + '">' +
            '<style>' +
            ':host{all:initial}' +
            'pre{margin:0;font-family:' + fontCss + ' !important;font-size:12.5px;line-height:1.6}' +
            'code{font-family:inherit !important;font-size:inherit}' +
            '</style>' +
            '<pre><code class="hljs language-javascript">' + highlightedHtml + '</code></pre>';
    }

    function initPreview(select, slot) {
        if (!select || !slot || slot.getAttribute('data-bf-ready') === '1') {
            return true;
        }
        var cfg;
        try {
            cfg = JSON.parse(slot.getAttribute('data-bf-code-theme-config') || '{}');
        } catch (e) {
            cfg = {};
        }
        if (!cfg.themes) {
            cfg.themes = {};
        }
        if (!cfg.fonts) {
            cfg.fonts = {};
        }
        if (!cfg.cdn) {
            cfg.cdn = 'https://cdn.bootcdn.net/ajax/libs/highlight.js/11.11.1/styles/';
        }

        slot.setAttribute('data-bf-ready', '1');
        var dom = buildPreviewDom();
        slot.appendChild(dom.wrap);

        var highlightedHtml = '';

        function getFontStack() {
            // 每次实时读取，避免初始化时机导致 fontSelect 引用失效
            var fs = document.querySelector('select[name="codeFont"]');
            var fontValue = fs ? (fs.value || cfg.defaultFont || 'system') : (cfg.defaultFont || 'system');
            return cfg.fonts[fontValue] || cfg.fonts.system || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        }

        function update() {
            var value = select.value || 'github';
            var theme = cfg.themes[value] || cfg.themes.github || { light: 'github', dark: 'github-dark' };
            var fontStack = getFontStack();
            renderPanel(dom.lightBody, theme.light, highlightedHtml, cfg, fontStack);
            renderPanel(dom.darkBody, theme.dark, highlightedHtml, cfg, fontStack);
        }

        ensureHljs(cfg).then(function (hljs) {
            highlightedHtml = highlightSample(hljs, cfg.sample || '');
            update();
        }).catch(function () {
            highlightedHtml = highlightSample(null, cfg.sample || '');
            update();
        });

        // 事件委托：无论 select 何时被创建/移动，只要 codeTheme 或 codeFont 变化都刷新预览
        document.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !t.name) { return; }
            if (t.name === 'codeTheme' || t.name === 'codeFont') {
                update();
            }
        });
        document.addEventListener('input', function (e) {
            var t = e.target;
            if (t && t.name === 'codeFont') {
                update();
            }
        });
        return true;
    }

    function boot() {
        var select = document.querySelector('select[name="codeTheme"]');
        var slot = document.querySelector('.bf-code-theme-preview-slot');
        if (select && slot) {
            initPreview(select, slot);
            return true;
        }
        return false;
    }

    function start() {
        if (boot()) {
            return;
        }
        var tries = 0;
        var timer = window.setInterval(function () {
            tries += 1;
            if (boot() || tries > 50) {
                window.clearInterval(timer);
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
