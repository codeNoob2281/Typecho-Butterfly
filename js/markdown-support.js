/**
 * Butterfly 主题 - Markdown 语法支持
 * 根据后台开关，按需加载并渲染 KaTeX 数学公式与 Mermaid 图表。
 * 兼容 PJAX 无刷新跳转以及明暗主题切换。
 */
(function () {
  'use strict';

  var CONFIG = window.BUTTERFLY_MARKDOWN_CONFIG || {};
  if (!CONFIG.katex && !CONFIG.mermaid) {
    return;
  }

  var katexPromise = null;
  var mermaidPromise = null;
  var mermaidTheme = null;
  var mermaidInitialized = false;
  var mermaidRunning = false;

  // 为某个 CDN 资源地址生成备用源列表（依次尝试 jsdelivr / fastly / unpkg）。
  function buildFallbackUrls(url) {
    var urls = [];
    if (!url) {
      return urls;
    }

    urls.push(url);

    var matched = url.match(/\/npm\/(.+)$/);
    if (!matched) {
      return urls;
    }

    var path = matched[1];
    ['https://cdn.jsdelivr.net/npm/', 'https://fastly.jsdelivr.net/npm/', 'https://unpkg.com/'].forEach(function (base) {
      var candidate = base + path;
      if (urls.indexOf(candidate) === -1) {
        urls.push(candidate);
      }
    });

    return urls;
  }

  function loadCssOne(href) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('link[data-bf-md-href="' + href + '"]')) {
        resolve();
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-bf-md-href', href);
      link.onload = function () { resolve(); };
      link.onerror = function () { reject(new Error(href)); };
      document.head.appendChild(link);
    });
  }

  function loadCssList(urls) {
    var index = 0;
    function attempt() {
      if (index >= urls.length) {
        return Promise.reject(new Error('all css sources failed'));
      }
      return loadCssOne(urls[index++]).catch(attempt);
    }
    return urls.length ? attempt() : Promise.resolve();
  }

  function loadScriptOne(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-bf-md-src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute('data-bf-md-loaded') === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error(src)); });
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.setAttribute('data-bf-md-src', src);
      script.onload = function () {
        script.setAttribute('data-bf-md-loaded', '1');
        resolve();
      };
      script.onerror = function () {
        reject(new Error(src));
      };
      document.head.appendChild(script);
    });
  }

  function loadScriptList(urls) {
    var index = 0;
    function attempt() {
      if (index >= urls.length) {
        return Promise.reject(new Error('all script sources failed'));
      }
      return loadScriptOne(urls[index++]).catch(attempt);
    }
    return urls.length ? attempt() : Promise.resolve();
  }

  function ensureKatex() {
    if (!CONFIG.katex) {
      return Promise.resolve(false);
    }
    if (window.renderMathInElement) {
      return Promise.resolve(true);
    }
    if (katexPromise) {
      return katexPromise;
    }

    loadCssList(buildFallbackUrls(CONFIG.katexCss));
    katexPromise = loadScriptList(buildFallbackUrls(CONFIG.katexJs))
      .then(function () { return loadScriptList(buildFallbackUrls(CONFIG.katexAutoRenderJs)); })
      .then(function () { return !!window.renderMathInElement; })
      .catch(function (error) {
        console.warn('[Butterfly] 加载 KaTeX 失败：', error);
        katexPromise = null;
        return false;
      });

    return katexPromise;
  }

  function ensureMermaid() {
    if (!CONFIG.mermaid) {
      return Promise.resolve(false);
    }
    if (window.mermaid) {
      return Promise.resolve(true);
    }
    if (mermaidPromise) {
      return mermaidPromise;
    }

    mermaidPromise = loadScriptList(buildFallbackUrls(CONFIG.mermaidJs))
      .then(function () { return !!window.mermaid; })
      .catch(function (error) {
        console.warn('[Butterfly] 加载 Mermaid 失败：', error);
        mermaidPromise = null;
        return false;
      });

    return mermaidPromise;
  }

  function getContentRoots() {
    var article = document.getElementById('article-container');
    if (article) {
      return [article];
    }

    var postContent = document.querySelector('.post-content');
    if (postContent) {
      return [postContent];
    }

    // 首页 / 归档等列表页：渲染卡片摘要中的数学公式（Mermaid 仅在正文渲染）
    return Array.prototype.slice.call(document.querySelectorAll('.recent-post-item .content'));
  }

  function renderKatex(roots) {
    if (!window.renderMathInElement) {
      return;
    }

    roots.forEach(function (root) {
      try {
        window.renderMathInElement(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          strict: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'svg'],
          ignoredClasses: ['katex', 'katex-display', 'mermaid', 'highlight']
        });
      } catch (error) {
        console.warn('[Butterfly] KaTeX 渲染出错：', error);
      }
    });
  }

  function extractMermaidSource(element) {
    var lineNodes = element.querySelectorAll('td.code pre span.line');
    if (!lineNodes.length) {
      lineNodes = element.querySelectorAll('pre span.line');
    }
    if (lineNodes.length) {
      return Array.prototype.map.call(lineNodes, function (node) {
        return node.textContent;
      }).join('\n').replace(/\u200b/g, '').trim();
    }

    var codeElement = element.querySelector('code');
    if (codeElement) {
      return codeElement.textContent.replace(/\u200b/g, '').trim();
    }

    var preElement = element.querySelector('pre');
    if (preElement) {
      return preElement.textContent.replace(/\u200b/g, '').trim();
    }

    return element.textContent.replace(/\u200b/g, '').trim();
  }

  function convertMermaidBlocks(roots) {
    var selector = 'figure.highlight.mermaid, figure.highlight.language-mermaid, ' +
      'pre code.language-mermaid, pre code.lang-mermaid, div.mermaid';

    roots.forEach(function (root) {
      Array.prototype.slice.call(root.querySelectorAll(selector)).forEach(function (block) {
        if (block.tagName === 'DIV' && block.classList.contains('mermaid')) {
          if (!block.getAttribute('data-mermaid-src') && block.getAttribute('data-mermaid-processed') !== '1') {
            block.setAttribute('data-mermaid-src', block.textContent.replace(/\u200b/g, '').trim());
          }
          return;
        }

        var source = extractMermaidSource(block);
        if (!source) {
          return;
        }

        var container = document.createElement('div');
        container.className = 'mermaid';
        container.setAttribute('data-mermaid-src', source);
        container.textContent = source;
        block.parentNode.replaceChild(container, block);
      });
    });
  }

  function getMermaidTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
  }

  function applyMermaidSizes() {
    var nodes = document.querySelectorAll('#article-container .mermaid svg');
    Array.prototype.slice.call(nodes).forEach(function (svg) {
      try {
        var viewBox = svg.viewBox && svg.viewBox.baseVal;
        if (viewBox && viewBox.width) {
          svg.style.maxWidth = 'none';
          svg.style.width = Math.ceil(viewBox.width) + 'px';
          svg.style.height = 'auto';
        }
      } catch (error) {
        // 忽略不支持 viewBox 的旧浏览器
      }
    });
  }

  function runMermaid() {
    if (!window.mermaid || mermaidRunning) {
      return;
    }

    var theme = getMermaidTheme();
    var all = Array.prototype.slice.call(document.querySelectorAll('.mermaid[data-mermaid-src]'));
    if (!all.length) {
      mermaidTheme = theme;
      return;
    }

    var themeChanged = mermaidTheme !== null && mermaidTheme !== theme;
    if (themeChanged) {
      all.forEach(function (node) {
        node.innerHTML = node.getAttribute('data-mermaid-src') || '';
        node.removeAttribute('data-processed');
        node.removeAttribute('data-mermaid-processed');
      });
    }

    var pending = all.filter(function (node) {
      return themeChanged || node.getAttribute('data-mermaid-processed') !== '1';
    });
    mermaidTheme = theme;

    if (!pending.length) {
      return;
    }

    var finish = function () {
      pending.forEach(function (node) {
        node.setAttribute('data-mermaid-processed', '1');
      });
      applyMermaidSizes();
      mermaidRunning = false;
    };

    try {
      if (!mermaidInitialized || themeChanged) {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: theme,
          securityLevel: 'loose',
          fontFamily: 'inherit'
        });
        mermaidInitialized = true;
      }

      mermaidRunning = true;

      if (typeof window.mermaid.run === 'function') {
        var result = window.mermaid.run({ nodes: pending });
        if (result && typeof result.then === 'function') {
          result.then(finish).catch(function (error) {
            console.warn('[Butterfly] Mermaid 渲染出错：', error);
            mermaidRunning = false;
          });
        } else {
          finish();
        }
      } else if (typeof window.mermaid.init === 'function') {
        window.mermaid.init(undefined, pending);
        finish();
      } else {
        finish();
      }
    } catch (error) {
      console.warn('[Butterfly] Mermaid 渲染出错：', error);
      mermaidRunning = false;
    }
  }

  function injectStyle() {
    if (document.getElementById('bf-markdown-support-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'bf-markdown-support-style';
    style.textContent = [
      '#article-container .mermaid{margin:1.2em 0;overflow-x:auto;}',
      '#article-container .mermaid svg{display:block;margin:0 auto;max-width:none !important;height:auto !important;}',
      '#article-container .mermaid[data-mermaid-src]:not([data-mermaid-processed="1"]){white-space:pre-wrap;font-family:inherit;}',
      '#article-container .katex-display{overflow-x:auto;overflow-y:hidden;padding:.2em 0;}'
    ].join('');
    document.head.appendChild(style);
  }

  function hasMathCandidates(roots) {
    for (var i = 0; i < roots.length; i++) {
      var text = roots[i].textContent || '';
      if (text.indexOf('$') !== -1 || text.indexOf('\\(') !== -1 || text.indexOf('\\[') !== -1) {
        return true;
      }
    }
    return false;
  }

  function renderAll() {
    var roots = getContentRoots();
    if (!roots.length) {
      return;
    }

    if (CONFIG.mermaid) {
      convertMermaidBlocks(roots);
    }

    var needKatex = CONFIG.katex && hasMathCandidates(roots);
    var needMermaid = CONFIG.mermaid && !!document.querySelector('.mermaid[data-mermaid-src]');

    var tasks = [];
    if (needKatex) {
      tasks.push(ensureKatex());
    }
    if (needMermaid) {
      tasks.push(ensureMermaid());
    }

    if (!tasks.length) {
      if (CONFIG.mermaid && window.mermaid) {
        runMermaid();
      }
      return;
    }

    Promise.all(tasks).then(function () {
      if (needKatex && window.renderMathInElement) {
        renderKatex(roots);
      }
      if (CONFIG.mermaid && window.mermaid) {
        runMermaid();
      }
    });
  }

  function observeThemeChange() {
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    var lastTheme = getMermaidTheme();
    var observer = new MutationObserver(function () {
      var theme = getMermaidTheme();
      if (theme === lastTheme) {
        return;
      }
      lastTheme = theme;
      if (CONFIG.mermaid) {
        ensureMermaid().then(runMermaid);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  function init() {
    injectStyle();
    renderAll();
    observeThemeChange();

    document.addEventListener('pjax:complete', function () {
      window.setTimeout(renderAll, 60);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
