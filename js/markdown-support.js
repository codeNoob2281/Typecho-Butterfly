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
      // 以图表原始宽度展示；仅当原始宽度超过正文容器时，由 max-width:100% 等比缩小。
      // 这样小图不会被强行拉大，大图也不会溢出产生横向滚动。
      var viewBox = svg.viewBox && svg.viewBox.baseVal;
      if (viewBox && viewBox.width) {
        svg.style.width = Math.ceil(viewBox.width) + 'px';
      } else {
        svg.style.width = 'auto';
      }
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    });
  }

  var lightbox = null;

  // 根据当前是否放大，切换鼠标指针：原状显示“放大”图标，放大状态显示“缩小”图标。
  function updateLightboxZoomCursor() {
    if (!lightbox || !lightbox.holder || !lightbox.holder.classList) {
      return;
    }
    var zoomed = lightbox.zoomBaseline != null ||
      (lightbox.fit > 0 && lightbox.scale > lightbox.fit * 1.001);
    if (zoomed) {
      lightbox.holder.classList.add('is-zoomed');
    } else {
      lightbox.holder.classList.remove('is-zoomed');
    }
  }

  function applyLightboxTransform() {
    if (!lightbox) {
      return;
    }
    lightbox.holder.style.transform = 'translate(' + lightbox.tx + 'px,' + lightbox.ty + 'px) scale(' + lightbox.scale + ')';
    updateLightboxZoomCursor();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.root.hidden) {
      return;
    }
    lightbox.root.hidden = true;
    lightbox.holder.innerHTML = '';
    lightbox.scale = 1;
    lightbox.tx = 0;
    lightbox.ty = 0;
    lightbox.zoomBaseline = null;
    if (lightbox.animTimer) {
      clearTimeout(lightbox.animTimer);
      lightbox.animTimer = null;
    }
    if (lightbox.holder && lightbox.holder.classList) {
      lightbox.holder.classList.remove('is-animating');
      lightbox.holder.classList.remove('is-dragging');
      lightbox.holder.classList.remove('is-zoomed');
    }
    document.documentElement.style.overflow = lightbox.prevOverflow || '';
    document.body.style.overflow = lightbox.prevBodyOverflow || '';
  }

  function ensureLightbox() {
    if (lightbox) {
      return lightbox;
    }

    var root = document.createElement('div');
    root.className = 'bf-mermaid-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Mermaid 图表全屏预览');
    root.hidden = true;

    var stage = document.createElement('div');
    stage.className = 'bf-mermaid-lightbox__stage';

    var holder = document.createElement('div');
    holder.className = 'bf-mermaid-lightbox__holder';
    stage.appendChild(holder);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'bf-mermaid-lightbox__close';
    close.setAttribute('aria-label', '关闭');
    close.innerHTML = '&times;';

    root.appendChild(stage);
    root.appendChild(close);
    document.body.appendChild(root);

    lightbox = {
      root: root,
      stage: stage,
      holder: holder,
      close: close,
      scale: 1,
      tx: 0,
      ty: 0,
      fit: 1,
      zoomBaseline: null,
      animTimer: null,
      prevOverflow: '',
      prevBodyOverflow: ''
    };

    close.addEventListener('click', closeLightbox);

    root.addEventListener('wheel', function (event) {
      if (root.hidden) {
        return;
      }
      event.preventDefault();
      var factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      lightbox.zoomBaseline = null; // 手动缩放后，点击切换基于新的视图重新开始
      stopLightboxAnimation();
      zoomToPoint(lightbox.scale * factor, event.clientX, event.clientY);
      applyLightboxTransform();
    }, { passive: false });

    var pointers = {};
    var dragStart = null;
    var pinchStart = null;
    var tapInfo = null;

    function pointerDistance(a, b) {
      var dx = a.x - b.x;
      var dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function pointerCount() {
      return Object.keys(pointers).length;
    }

    function pointerMidpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    // holder 未变换时的中心（stage 铺满视口且用 flex 居中，故等于 stage 中心）。
    function viewCenter() {
      if (stage && typeof stage.getBoundingClientRect === 'function') {
        var rect = stage.getBoundingClientRect();
        if (rect && rect.width && rect.height) {
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
      }
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    // 围绕屏幕坐标 (fx, fy) 缩放：反算 translate，使该点下的内容在缩放前后始终停留在原处，
    // 从而避免放大/缩小时图像发生漂移。
    function zoomToPoint(newScale, fx, fy) {
      var s0 = lightbox.scale || lightbox.fit;
      newScale = Math.min(10, Math.max(lightbox.fit * 0.5, newScale));
      if (!s0 || !isFinite(newScale)) {
        return;
      }
      var center = viewCenter();
      var ax = fx - center.x;
      var ay = fy - center.y;
      var ratio = newScale / s0;
      lightbox.tx = ax - ratio * (ax - lightbox.tx);
      lightbox.ty = ay - ratio * (ay - lightbox.ty);
      lightbox.scale = newScale;
    }

    function stopLightboxAnimation() {
      holder.classList.remove('is-animating');
      if (lightbox.animTimer) {
        clearTimeout(lightbox.animTimer);
        lightbox.animTimer = null;
      }
    }

    // 点击放大/缩小时加过渡动画；拖拽/双指/滚轮则保持实时无动画。
    function animateLightboxTransform() {
      holder.classList.add('is-animating');
      void holder.offsetWidth; // 强制回流，确保 transition 从当前状态开始
      applyLightboxTransform();
      if (lightbox.animTimer) {
        clearTimeout(lightbox.animTimer);
      }
      lightbox.animTimer = setTimeout(function () {
        holder.classList.remove('is-animating');
        lightbox.animTimer = null;
      }, 280);
    }

    // 手势响应区域放大到整个全屏蒙版（root），而不是仅图表本身（holder）。
    // 移动端图表较小时，双指落点很容易超出手图表范围；若只监听 holder，
    // 第二根手指会丢失，从而把双指缩放误判为单指拖动。
    function isCloseControl(target) {
      return !!(target && close.contains(target));
    }

    function isOnBackdrop(target) {
      return !(target === holder || holder.contains(target));
    }

    // 点击局部放大：以点击位置为中心放大到约 2.5 倍；再次点击恢复到点击前的视图（缩小回原状态）。
    function toggleZoomAt(px, py) {
      if (lightbox.zoomBaseline) {
        var baseline = lightbox.zoomBaseline;
        lightbox.zoomBaseline = null;
        lightbox.scale = baseline.scale;
        lightbox.tx = baseline.tx;
        lightbox.ty = baseline.ty;
        animateLightboxTransform();
        return;
      }

      var fromScale = lightbox.scale || lightbox.fit;
      var target = Math.min(10, Math.max(fromScale * 2.5, lightbox.fit * 2.5));
      if (target <= fromScale + 0.0001) {
        return; // 已接近最大缩放，无需再放大
      }

      lightbox.zoomBaseline = { scale: lightbox.scale, tx: lightbox.tx, ty: lightbox.ty };
      zoomToPoint(target, px, py);
      animateLightboxTransform();
    }

    root.addEventListener('pointerdown', function (event) {
      if (root.hidden) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      if (isCloseControl(event.target)) {
        return; // 关闭按钮交由自身的 click 处理
      }

      stopLightboxAnimation();

      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      try {
        root.setPointerCapture(event.pointerId);
      } catch (error) {
        // 忽略
      }

      if (pointerCount() === 1) {
        dragStart = { x: event.clientX, y: event.clientY, tx: lightbox.tx, ty: lightbox.ty };
        pinchStart = null;
        tapInfo = {
          x: event.clientX,
          y: event.clientY,
          maxPointers: 1,
          moved: false,
          onBackdrop: isOnBackdrop(event.target)
        };
        holder.classList.add('is-dragging');
      } else if (pointerCount() === 2) {
        var points = Object.keys(pointers).map(function (key) { return pointers[key]; });
        var mid = pointerMidpoint(points[0], points[1]);
        var center = viewCenter();
        pinchStart = {
          distance: pointerDistance(points[0], points[1]),
          scale: lightbox.scale,
          tx: lightbox.tx,
          ty: lightbox.ty,
          bx: mid.x - center.x,
          by: mid.y - center.y
        };
        dragStart = null;
        if (tapInfo) {
          tapInfo.maxPointers = 2;
        }
      }

      event.preventDefault();
    });

    root.addEventListener('pointermove', function (event) {
      if (root.hidden || !(event.pointerId in pointers)) {
        return;
      }

      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(pointers);

      if (tapInfo) {
        if (ids.length > tapInfo.maxPointers) {
          tapInfo.maxPointers = ids.length;
        }
        if (!tapInfo.moved &&
            (Math.abs(event.clientX - tapInfo.x) > 10 || Math.abs(event.clientY - tapInfo.y) > 10)) {
          tapInfo.moved = true;
        }
      }

      if (ids.length >= 2 && pinchStart) {
        var points = ids.map(function (key) { return pointers[key]; });
        var distance = pointerDistance(points[0], points[1]);
        var newScale = pinchStart.scale * (distance / (pinchStart.distance || 1));
        newScale = Math.min(10, Math.max(lightbox.fit * 0.5, newScale));
        var ratio = pinchStart.scale ? (newScale / pinchStart.scale) : 1;
        var mid = pointerMidpoint(points[0], points[1]);
        var center = viewCenter();
        // 以「起始双指中点下的内容」为锚点，跟随当前中点移动并缩放，
        // 既支持双指拖动平移，也避免双指缩放时图像漂移。
        lightbox.tx = (mid.x - center.x) - ratio * (pinchStart.bx - pinchStart.tx);
        lightbox.ty = (mid.y - center.y) - ratio * (pinchStart.by - pinchStart.ty);
        lightbox.scale = newScale;
        lightbox.zoomBaseline = null; // 双指缩放后，点击切换基于新的视图重新开始
        applyLightboxTransform();
      } else if (ids.length === 1 && dragStart) {
        lightbox.tx = dragStart.tx + (event.clientX - dragStart.x);
        lightbox.ty = dragStart.ty + (event.clientY - dragStart.y);
        applyLightboxTransform();
      }

      event.preventDefault();
    });

    var endPointer = function (event) {
      if (event && event.pointerId in pointers) {
        delete pointers[event.pointerId];
      }

      // 点击空白蒙版（非拖动、非缩放）关闭全屏预览
      if (pointerCount() === 0 && tapInfo && !tapInfo.moved &&
          tapInfo.maxPointers === 1 && tapInfo.onBackdrop) {
        tapInfo = null;
        dragStart = null;
        holder.classList.remove('is-dragging');
        closeLightbox();
        return;
      }

      // 点击图表（非拖动、非缩放）：以点击位置局部放大；再次点击恢复原状态
      if (pointerCount() === 0 && tapInfo && !tapInfo.moved &&
          tapInfo.maxPointers === 1 && !tapInfo.onBackdrop) {
        var tapX = tapInfo.x;
        var tapY = tapInfo.y;
        tapInfo = null;
        dragStart = null;
        holder.classList.remove('is-dragging');
        toggleZoomAt(tapX, tapY);
        return;
      }

      if (pointerCount() < 2) {
        pinchStart = null;
      }

      if (pointerCount() === 0) {
        dragStart = null;
        tapInfo = null;
        holder.classList.remove('is-dragging');
      } else if (pointerCount() === 1) {
        var key = Object.keys(pointers)[0];
        var point = pointers[key];
        dragStart = { x: point.x, y: point.y, tx: lightbox.tx, ty: lightbox.ty };
        if (tapInfo) {
          tapInfo.maxPointers = 2; // 多指抬起后，剩余单指不再视为点击
        }
      }
    };

    root.addEventListener('pointerup', endPointer);
    root.addEventListener('pointercancel', endPointer);
    root.addEventListener('pointerleave', function (event) {
      if (event.pointerType === 'mouse') {
        endPointer(event);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !root.hidden) {
        closeLightbox();
      }
    });

    return lightbox;
  }

  function openLightbox(sourceSvg) {
    var lb = ensureLightbox();
    var svg = sourceSvg.cloneNode(true);

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.maxWidth = 'none';
    svg.style.height = 'auto';

    lb.holder.innerHTML = '';
    lb.holder.appendChild(svg);
    lb.root.hidden = false;

    lb.prevOverflow = document.documentElement.style.overflow;
    lb.prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    var viewBox = svg.viewBox && svg.viewBox.baseVal;
    var width = viewBox && viewBox.width ? viewBox.width : (sourceSvg.getBoundingClientRect().width || 800);
    var height = viewBox && viewBox.height ? viewBox.height : (sourceSvg.getBoundingClientRect().height || 600);

    svg.style.width = Math.ceil(width) + 'px';
    svg.style.height = Math.ceil(height) + 'px';

    var availableWidth = Math.max(window.innerWidth * 0.94, 200);
    var availableHeight = Math.max(window.innerHeight * 0.86, 160);
    var fit = Math.min(availableWidth / width, availableHeight / height);
    if (!isFinite(fit) || fit <= 0) {
      fit = 1;
    }

    lb.fit = fit;
    lb.scale = fit;
    lb.tx = 0;
    lb.ty = 0;
    lb.zoomBaseline = null;
    applyLightboxTransform();
  }

  function bindMermaidZoom() {
    var nodes = document.querySelectorAll('#article-container .mermaid');
    Array.prototype.slice.call(nodes).forEach(function (box) {
      if (!box._bfZoomBound) {
        box._bfZoomBound = true;
        box.setAttribute('title', '点击全屏查看');
        box.addEventListener('click', function () {
          var svg = box.querySelector('svg');
          if (svg) {
            openLightbox(svg);
          }
        });
      }

      if (!box.querySelector('.bf-mermaid-zoom-hint')) {
        var hint = document.createElement('span');
        hint.className = 'bf-mermaid-zoom-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 9V4h5v2H6v3H4zm11-5h5v5h-2V6h-3V4zM4 15h2v3h3v2H4v-5zm14 3v-3h2v5h-5v-2h3z"/></svg>';
        box.appendChild(hint);
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
      bindMermaidZoom();
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
      '#article-container .mermaid{position:relative;margin:1.2em 0;overflow-x:auto;}',
      '#article-container .mermaid svg{display:block;margin:0 auto;max-width:100% !important;height:auto !important;}',
      '#article-container .mermaid[data-mermaid-src]:not([data-mermaid-processed="1"]){white-space:pre-wrap;font-family:inherit;}',
      '#article-container .mermaid .bf-mermaid-zoom-hint{position:absolute;top:8px;right:10px;display:none;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:rgba(0,0,0,.45);color:#fff;opacity:0;transition:opacity .2s;z-index:2;pointer-events:none;}',
      '@media (min-width:992px){#article-container .mermaid{cursor:zoom-in;}#article-container .mermaid:hover .bf-mermaid-zoom-hint{display:flex;opacity:1;}}',
      '@media (max-width:991px){#article-container .mermaid .bf-mermaid-zoom-hint{display:flex;opacity:.75;}}',
      '#article-container .katex-display{overflow-x:auto;overflow-y:hidden;padding:.2em 0;}',
      '.bf-mermaid-lightbox{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(12,14,18,.86);touch-action:none;overscroll-behavior:none;}',
      '.bf-mermaid-lightbox[hidden]{display:none !important;}',
      '.bf-mermaid-lightbox__stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;}',
      '.bf-mermaid-lightbox__holder{transform-origin:center center;will-change:transform;cursor:zoom-in;padding:16px;border-radius:12px;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.45);pointer-events:auto;touch-action:none;}',
      '.bf-mermaid-lightbox__holder.is-zoomed{cursor:zoom-out;}',
      '.bf-mermaid-lightbox__holder.is-dragging{cursor:grabbing;}',
      '.bf-mermaid-lightbox__holder.is-animating{transition:transform .26s cubic-bezier(.22,.61,.36,1);}',
      '.bf-mermaid-lightbox__holder svg{display:block;background:transparent;}',
      'html[data-theme="dark"] .bf-mermaid-lightbox__holder{background:#0f1115;}',
      '.bf-mermaid-lightbox__close{position:fixed;top:20px;right:24px;width:44px;height:44px;border:none;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:30px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;z-index:2;}',
      '.bf-mermaid-lightbox__close:hover{background:rgba(255,255,255,.3);}'
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
      closeLightbox();
      window.setTimeout(renderAll, 60);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
