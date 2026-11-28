(function () {
    var sectionMap = [
        { id: 'cids', title: '文章置顶及公共部分', desc: '集中管理置顶文章、静态资源、外链行为、基础展示和常用站点信息。', selector: '#cids' },
        { id: 'pjax', title: 'PJAX 设置', desc: '处理页面无刷新切换与 PJAX 回调逻辑。', selector: '#pjax' },
        { id: 'friends', title: '友情链接设置', desc: '配置友链来源模式、友链内容和懒加载占位图。', selector: '#friends' },
        { id: 'reward', title: '打赏功能', desc: '控制全局打赏展示与打赏二维码信息。', selector: '#reward' },
        { id: 'aside', title: '侧边栏显示设置', desc: '配置首页和文章页侧边栏模块的显示与排序范围。', selector: '#aside' },
        { id: 'beautifyBlock', title: '美化选项', desc: '控制顶图、代码块、提示弹窗、侧栏时钟等视觉增强项。', selector: '#beautifyBlock' },
        { id: 'ShowLive2D', title: 'Live2D 设置', desc: '管理 Live2D 展示、弹窗位置、鼠标特效与首页副标题等功能。', selector: '#ShowLive2D' },
        { id: 'otherCustom', title: '其他自定义内容', desc: '包括导航栏链接、认证用户、自定义 CSS / JS / Head / Footer 等。', selector: '#otherCustom' },
        { id: 'markdown', title: 'Markdown设置', desc: '控制文章内容中的数学公式（KaTeX）、Mermaid 图表渲染以及代码块 highlight.js 高亮配色。', selector: '#markdown' },
        { id: 'CustomColor', title: '自定义颜色', desc: '管理主题色、暗色模式与实验性自定义色板。', selector: '#CustomColor' },
        { id: 'captchaVerify', title: '评论验证码', desc: '管理 reCAPTCHA、hCaptcha 与 Cloudflare Turnstile 配置。', selector: '#captchaVerify' },
        { id: 'cache', title: '缓存设置', desc: '控制主题缓存方式和默认缓存有效期。', selector: '#cache' }
    ];

    function isValidHash(hash) {
        return sectionMap.some(function (item) {
            return '#' + item.id === hash;
        });
    }

    function normalizeHash(hash) {
        return isValidHash(hash) ? hash : '#cids';
    }

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function matchesSelector(element, selector) {
        if (!element || !selector) {
            return false;
        }

        if (typeof element.matches === 'function' && element.matches(selector)) {
            return true;
        }

        return !!qs(selector, element);
    }

    function getMainColumn() {
        return qs('.typecho-page-main [role="form"]') || qs('.typecho-page-main > div');
    }

    function getConfigForm(column) {
        var forms = qsa('form', column).filter(function (form) {
            return form.id !== 'themeBackup';
        });

        for (var i = 0; i < forms.length; i++) {
            if (qs('#cids', forms[i]) && qs('#cache', forms[i])) {
                return forms[i];
            }
        }

        return forms[0] || null;
    }

    function getFormBlocks(form) {
        return Array.prototype.slice.call(form.children).filter(function (item) {
            return item.classList && item.classList.contains('typecho-option');
        });
    }

    function getSubmitBlock(form) {
        return Array.prototype.slice.call(form.children).filter(function (item) {
            return item.classList && item.classList.contains('typecho-option-submit');
        })[0] || null;
    }

    function applyAutofillIgnore(root) {
        if (!root) {
            return;
        }

        root.setAttribute('autocomplete', 'off');

        qsa('input, textarea, select', root).forEach(function (field) {
            field.setAttribute('data-bwignore', 'true');
            field.setAttribute('data-lpignore', 'true');
            field.setAttribute('data-1p-ignore', 'true');
            field.setAttribute('data-form-type', 'other');

            if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                field.setAttribute('autocomplete', 'off');
                field.setAttribute('autocapitalize', 'off');
                field.setAttribute('autocorrect', 'off');
                field.setAttribute('spellcheck', 'false');
            }
        });
    }

    function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').toLowerCase();
    }

    function getSearchTokens(keyword) {
        return normalizeText(keyword).split(' ').filter(function (token) {
            return !!token;
        });
    }

    function matchesAllTokens(text, tokens) {
        if (!tokens.length) {
            return true;
        }

        return tokens.every(function (token) {
            return text.indexOf(token) !== -1;
        });
    }

    function getSectionConfig(sectionId) {
        for (var i = 0; i < sectionMap.length; i++) {
            if (sectionMap[i].id === sectionId) {
                return sectionMap[i];
            }
        }

        return null;
    }

    function buildItemSearchText(item) {
        var chunks = [item.textContent || ''];

        qsa('input, textarea, select', item).forEach(function (field) {
            if (field.name) {
                chunks.push(field.name);
            }

            if (field.id) {
                chunks.push(field.id);
            }

            if (field.getAttribute('placeholder')) {
                chunks.push(field.getAttribute('placeholder'));
            }
        });

        return normalizeText(chunks.join(' '));
    }

    function setupSearchIndex(form) {
        qsa('.theme-setting-section', form).forEach(function (section) {
            var sectionId = section.getAttribute('data-section') || '';
            var config = getSectionConfig(sectionId);
            var sectionTexts = [];

            if (config) {
                sectionTexts.push(config.id, config.title, config.desc);
            }

            section.setAttribute('data-search-text', normalizeText(sectionTexts.join(' ')));

            qsa('.theme-setting-section-body > .typecho-option', section).forEach(function (item) {
                item.setAttribute('data-search-text', buildItemSearchText(item));
            });
        });
    }

    function createSearchPanel() {
        var panel = document.createElement('section');
        panel.className = 'theme-config-panel theme-config-search-panel';

        var label = document.createElement('label');
        label.className = 'theme-config-search-label';
        label.setAttribute('for', 'themeConfigSearchInput');
        label.textContent = '搜索设置';

        var control = document.createElement('div');
        control.className = 'theme-config-search-control';

        var input = document.createElement('input');
        input.type = 'search';
        input.id = 'themeConfigSearchInput';
        input.className = 'theme-config-search-input';
        input.placeholder = '输入关键字，如评论、导航栏、PJAX';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');

        var clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'theme-config-search-clear';
        clear.textContent = '清空';
        clear.hidden = true;

        var status = document.createElement('div');
        status.className = 'theme-config-search-status';
        status.setAttribute('aria-live', 'polite');
        status.textContent = '可按设置标题、说明文字、字段名搜索';

        control.appendChild(input);
        control.appendChild(clear);
        panel.appendChild(label);
        panel.appendChild(control);
        panel.appendChild(status);

        return {
            panel: panel,
            input: input,
            clear: clear,
            status: status
        };
    }

    function setSearchNavState(sectionId, visibleCount, hasQuery) {
        var link = qs('.mtoc a[href="#' + sectionId + '"]');
        if (!link) {
            return;
        }

        var isMatch = hasQuery && visibleCount > 0;
        link.classList.toggle('is-search-hidden', hasQuery && !isMatch);
        link.classList.toggle('is-search-match', isMatch);

        if (isMatch) {
            link.setAttribute('data-search-count', String(visibleCount));
        } else {
            link.removeAttribute('data-search-count');
        }
    }

    function updateSearchStatus(status, hasQuery, matchedSections, matchedItems) {
        if (!status) {
            return;
        }

        if (!hasQuery) {
            status.textContent = '可按设置标题、说明文字、字段名搜索';
            return;
        }

        if (!matchedItems) {
            status.textContent = '未找到相关设置，请换个关键字试试';
            return;
        }

        status.textContent = '找到 ' + matchedItems + ' 个相关设置，分布在 ' + matchedSections + ' 个分组';
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildHighlightRegex(tokens) {
        var uniqueTokens = [];

        tokens.forEach(function (token) {
            if (uniqueTokens.indexOf(token) === -1) {
                uniqueTokens.push(token);
            }
        });

        uniqueTokens.sort(function (a, b) {
            return b.length - a.length;
        });

        if (!uniqueTokens.length) {
            return null;
        }

        return new RegExp('(' + uniqueTokens.map(function (token) {
            return escapeRegExp(token);
        }).join('|') + ')', 'gi');
    }

    function clearKeywordHighlights(root) {
        qsa('mark.theme-config-keyword-highlight', root).forEach(function (mark) {
            var parent = mark.parentNode;
            if (!parent) {
                return;
            }

            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            parent.normalize();
        });
    }

    function collectHighlightTextNodes(element) {
        var nodes = [];
        var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node || !node.nodeValue || !node.nodeValue.replace(/\s+/g, '')) {
                    return NodeFilter.FILTER_REJECT;
                }

                var parent = node.parentNode;
                if (!parent || !parent.tagName) {
                    return NodeFilter.FILTER_ACCEPT;
                }

                var tagName = parent.tagName.toUpperCase();
                if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'TEXTAREA' || tagName === 'OPTION' || tagName === 'MARK') {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        });

        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        return nodes;
    }

    function highlightTextNode(node, regex) {
        if (!node || !node.parentNode || !regex) {
            return;
        }

        var text = node.nodeValue;
        regex.lastIndex = 0;
        if (!regex.test(text)) {
            return;
        }

        regex.lastIndex = 0;
        var fragment = document.createDocumentFragment();
        var lastIndex = 0;
        var match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            var mark = document.createElement('mark');
            mark.className = 'theme-config-keyword-highlight';
            mark.textContent = match[0];
            fragment.appendChild(mark);

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        node.parentNode.replaceChild(fragment, node);
    }

    function updateKeywordHighlights(tokens) {
        var shell = qs('#themeConfigShell');
        if (!shell) {
            return;
        }

        clearKeywordHighlights(shell);

        var regex = buildHighlightRegex(tokens);
        if (!regex) {
            return;
        }

        qsa('.mtoc a, .theme-setting-section-header h3, .theme-setting-section-header p, .theme-setting-section-body .typecho-label, .theme-setting-section-body .description, .theme-setting-section-body .multiline label, .theme-setting-section-body li > label', shell).forEach(function (element) {
            collectHighlightTextNodes(element).forEach(function (node) {
                highlightTextNode(node, regex);
            });
        });
    }

    function bindSearch(form, updateFloatingSubmit) {
        var sidebarInner = qs('.theme-config-sidebar-inner');
        var navPanel = qs('.set_toc', sidebarInner);
        if (!form || !sidebarInner || !navPanel) {
            return;
        }

        setupSearchIndex(form);

        var search = createSearchPanel();
        sidebarInner.insertBefore(search.panel, navPanel);

        var input = search.input;
        var clear = search.clear;
        var status = search.status;
        var shell = qs('#themeConfigShell');
        var backupForm = qs('#themeBackup');
        var submit = qs('.theme-config-form .typecho-option-submit');
        var sections = qsa('.theme-setting-section', form);

        function clearActiveState() {
            qsa('.mtoc a').forEach(function (link) {
                link.classList.remove('theme-nav-active');
            });

            sections.forEach(function (section) {
                section.classList.remove('is-active');
            });

            if (backupForm) {
                backupForm.classList.remove('is-active');
            }
        }

        function applySearch() {
            var tokens = getSearchTokens(input.value);
            var hasQuery = tokens.length > 0;
            var matchedSections = 0;
            var matchedItems = 0;
            var firstMatchedHash = null;

            if (shell) {
                shell.classList.toggle('is-searching', hasQuery);
            }

            sections.forEach(function (section) {
                var sectionId = section.getAttribute('data-section') || '';
                var sectionText = section.getAttribute('data-search-text') || '';
                var revealAll = hasQuery && matchesAllTokens(sectionText, tokens);
                var visibleCount = 0;

                qsa('.theme-setting-section-body > .typecho-option', section).forEach(function (item) {
                    var matched = !hasQuery || revealAll || matchesAllTokens(item.getAttribute('data-search-text') || '', tokens);
                    item.classList.toggle('is-search-hidden', hasQuery && !matched);

                    if (matched) {
                        visibleCount += 1;
                    }
                });

                var sectionMatched = !hasQuery || visibleCount > 0;
                section.classList.toggle('is-search-match', hasQuery && sectionMatched);

                if (hasQuery && sectionMatched) {
                    matchedSections += 1;
                    matchedItems += visibleCount;
                    if (!firstMatchedHash) {
                        firstMatchedHash = '#' + sectionId;
                    }
                }

                setSearchNavState(sectionId, visibleCount, hasQuery);
            });

            clear.hidden = !hasQuery;

            if (!hasQuery) {
                sections.forEach(function (section) {
                    section.classList.remove('is-search-match');
                });

                qsa('.theme-setting-section-body > .typecho-option', form).forEach(function (item) {
                    item.classList.remove('is-search-hidden');
                });

                var defaultHash = window.location.hash === '#themeBackup'
                    ? '#themeBackup'
                    : normalizeHash(window.location.hash || '#cids');
                setActiveNav(defaultHash);
            } else if (firstMatchedHash) {
                var currentHash = window.location.hash === '#themeBackup'
                    ? ''
                    : normalizeHash(window.location.hash || '#cids');
                var currentVisibleLink = currentHash
                    ? qs('.mtoc a[href="' + currentHash + '"]:not(.is-search-hidden)')
                    : null;

                setActiveNav(currentVisibleLink ? currentHash : firstMatchedHash);

                if (backupForm) {
                    backupForm.classList.remove('is-active');
                }

                if (submit) {
                    submit.classList.remove('is-hidden');
                }
            } else {
                clearActiveState();

                if (submit) {
                    submit.classList.remove('is-hidden');
                }
            }

            updateKeywordHighlights(tokens);
            updateSearchStatus(status, hasQuery, matchedSections, matchedItems);

            if (typeof updateFloatingSubmit === 'function') {
                updateFloatingSubmit();
            }
        }

        input.addEventListener('input', applySearch);

        clear.addEventListener('click', function () {
            input.value = '';
            applySearch();
            input.focus();
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && input.value) {
                event.preventDefault();
                input.value = '';
                applySearch();
            }
        });
    }

    function createSection(config, items) {
        var section = document.createElement('section');
        section.className = 'theme-setting-section';
        section.id = 'section-' + config.id;
        section.setAttribute('data-section', config.id);

        var header = document.createElement('div');
        header.className = 'theme-setting-section-header';

        var title = document.createElement('h3');
        title.textContent = config.title;
        header.appendChild(title);

        var desc = document.createElement('p');
        desc.textContent = config.desc;
        header.appendChild(desc);

        var body = document.createElement('div');
        body.className = 'theme-setting-section-body';
        items.forEach(function (item) {
            body.appendChild(item);
        });

        section.appendChild(header);
        section.appendChild(body);
        return section;
    }

    function groupFormItems(form) {
        if (!form || form.getAttribute('data-theme-grouped') === '1') {
            return false;
        }

        var items = getFormBlocks(form).filter(function (item) {
            return !item.classList.contains('typecho-option-submit');
        });

        if (!items.length) {
            return false;
        }

        var groups = {};
        var currentSection = 'cids';

        items.forEach(function (item) {
            for (var i = 0; i < sectionMap.length; i++) {
                if (matchesSelector(item, sectionMap[i].selector)) {
                    currentSection = sectionMap[i].id;
                    break;
                }
            }

            if (!groups[currentSection]) {
                groups[currentSection] = [];
            }
            groups[currentSection].push(item);
        });

        sectionMap.forEach(function (config) {
            if (!groups[config.id] || !groups[config.id].length) {
                return;
            }
            form.appendChild(createSection(config, groups[config.id]));
        });

        var submit = getSubmitBlock(form);
        if (submit) {
            form.appendChild(submit);
        }

        form.setAttribute('data-theme-grouped', '1');
        return true;
    }

    function setActiveNav(hash) {
        var isBackup = hash === '#themeBackup';

        qsa('.mtoc a').forEach(function (link) {
            link.classList.toggle('theme-nav-active', link.getAttribute('href') === hash);
        });

        qsa('.theme-setting-section').forEach(function (section) {
            section.classList.toggle('is-active', !isBackup && section.id === 'section-' + hash.replace('#', ''));
        });

        var backupForm = qs('#themeBackup');
        if (backupForm) {
            backupForm.classList.toggle('is-active', isBackup);
        }

        var submit = qs('.theme-config-form .typecho-option-submit');
        if (submit) {
            submit.classList.toggle('is-hidden', isBackup);
        }
    }

    function getTargetByHash(hash) {
        if (!hash) {
            return null;
        }

        if (hash === '#themeBackup') {
            return qs('#themeBackup');
        }

        return qs('#section-' + hash.replace('#', '')) || qs(hash);
    }

    function getScrollOffset() {
        return window.innerWidth < 1200 ? 92 : 42;
    }

    function getScrollAnchor(target) {
        if (!target) {
            return null;
        }

        if (target.id === 'themeBackup') {
            return target;
        }

        return qs('.theme-setting-section-header', target) || target;
    }

    function navigate(hash, savePoint) {
        setActiveNav(hash);

        var target = getTargetByHash(hash);
        if (!target) {
            return;
        }

        var anchor = getScrollAnchor(target);
        var top = Math.max(window.pageYOffset + anchor.getBoundingClientRect().top - getScrollOffset(), 0);
        window.scrollTo({ top: top, behavior: 'smooth' });

        if (history.replaceState) {
            history.replaceState(null, document.title, hash);
        } else {
            window.location.hash = hash;
        }

        if (savePoint) {
            try {
                localStorage.setItem('point', hash);
            } catch (e) {
            }
        }
    }

    function bindNavEvents() {
        qsa('.mtoc a').forEach(function (link) {
            link.addEventListener('click', function (event) {
                var hash = link.getAttribute('href');
                if (!hash) {
                    return;
                }
                event.preventDefault();
                navigate(hash, false);

                if (window.innerWidth < 1200) {
                    var nav = qs('#themeConfigNavList');
                    var toggle = qs('#themeConfigNavToggle');
                    if (nav) {
                        nav.classList.remove('is-open');
                    }
                    if (toggle) {
                        toggle.setAttribute('aria-expanded', 'false');
                        toggle.textContent = '展开功能导航';
                    }
                }
            });
        });
    }

    function bindMobileToggle() {
        var toggle = qs('#themeConfigNavToggle');
        var nav = qs('#themeConfigNavList');
        if (!toggle || !nav) {
            return;
        }

        toggle.addEventListener('click', function () {
            var isOpen = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.textContent = isOpen ? '收起功能导航' : '展开功能导航';
        });
    }

    function bindSubmitMemory(form) {
        var button = qs('.typecho-option-submit button', form);
        if (!button) {
            return;
        }

        button.addEventListener('click', function () {
            try {
                var active = qs('.mtoc a.theme-nav-active');
                localStorage.setItem('point', window.location.hash || (active ? active.getAttribute('href') : '#cids'));
            } catch (e) {
            }
        });
    }

    function setupMobileFloatingSubmit(shell, form) {
        var submit = qs('.typecho-option-submit', form);
        if (!submit) {
            return null;
        }

        var placeholder = document.createElement('div');
        placeholder.className = 'theme-config-submit-placeholder';
        submit.parentNode.insertBefore(placeholder, submit);

        function resetFloating() {
            submit.classList.remove('is-floating-mobile');
            placeholder.style.height = '0px';
            if (shell) {
                shell.classList.remove('has-floating-submit');
            }
        }

        function updateFloating() {
            if (window.innerWidth > 1199 || submit.classList.contains('is-hidden')) {
                resetFloating();
                return;
            }

            var triggerLine = window.innerHeight - 16;
            var anchorTop = placeholder.getBoundingClientRect().top;
            var shouldFloat = anchorTop > triggerLine;

            if (!shouldFloat) {
                resetFloating();
                return;
            }

            placeholder.style.height = submit.offsetHeight + 'px';
            submit.classList.add('is-floating-mobile');
            if (shell) {
                shell.classList.add('has-floating-submit');
            }
        }

        window.addEventListener('scroll', updateFloating, { passive: true });
        window.addEventListener('resize', updateFloating);
        setTimeout(updateFloating, 0);

        return updateFloating;
    }

    function syncRememberLink() {
        var point = '#cids';
        try {
            point = normalizeHash(localStorage.getItem('point') || '#cids');
        } catch (e) {
        }
        var link = qs('#point');
        if (link) {
            link.setAttribute('href', point);
        }
    }

    /* ---------- 友链弹窗表单 + 列表 CRUD ---------- */
    var friendFields = ['title', 'url', 'avatar', 'desc', 'cover', 'subtitle', 'tags', 'role'];

    function createEl(tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (typeof text !== 'undefined') {
            node.textContent = text;
        }
        return node;
    }

    function decodeFriendValue(value) {
        return (value || '').replace(/‖/g, '||').trim();
    }

    function encodeFriendValue(value) {
        return (value || '').trim().replace(/\|\|/g, '‖');
    }

    function parseFriendText(text) {
        var records = [];
        (text || '').split(/\r\n|\r|\n/).forEach(function (line) {
            if (!line.trim()) {
                return;
            }
            var parts = line.split('||');
            var record = {};
            friendFields.forEach(function (key, index) {
                record[key] = decodeFriendValue(parts[index] || '');
            });
            if (!record.role) {
                record.role = '友链';
            }
            records.push(record);
        });
        return records;
    }

    function serializeFriendRecords(records) {
        return records.map(function (record) {
            return friendFields.map(function (key) {
                return encodeFriendValue(record[key] || '');
            }).join('||');
        }).join('\n');
    }

    function createFriendModal(onSave) {
        var root = createEl('div', 'tfm-modal');
        root.hidden = true;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');

        var mask = createEl('div', 'tfm-modal-mask');
        var dialog = createEl('div', 'tfm-modal-dialog');
        var head = createEl('div', 'tfm-modal-head');
        var title = createEl('h4', 'tfm-modal-title', '添加友链');
        var close = createEl('button', 'tfm-modal-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', '关闭');
        head.appendChild(title);
        head.appendChild(close);

        var body = createEl('div', 'tfm-modal-body');
        var fields = {};
        var labels = {
            title: '博客名称 / 标题 *',
            url: '博客地址 *',
            subtitle: '副标题',
            avatar: '头像地址',
            cover: '封面地址',
            desc: '简介',
            tags: '标签列表',
            role: '身份说明'
        };
        var hints = {
            url: '如 https://example.com',
            avatar: '留空则自动生成文字头像',
            cover: '留空则使用渐变封面',
            desc: '一段介绍文字，会显示在卡片正文',
            tags: '多个标签用逗号分隔，如 Docker, 网络排障',
            role: '显示在卡片左下角，默认「友链」'
        };

        friendFields.forEach(function (key) {
            var label = createEl('label', 'tfm-field');
            if (key === 'desc' || key === 'tags' || key === 'role') {
                label.classList.add('tfm-field-wide');
            }
            label.appendChild(createEl('span', 'tfm-field-label', labels[key]));
            var input;
            if (key === 'desc') {
                input = createEl('textarea', 'tfm-field-input');
                input.rows = 4;
            } else {
                input = createEl('input', 'tfm-field-input');
                input.type = 'text';
            }
            input.setAttribute('data-field', key);
            input.setAttribute('autocomplete', 'off');
            input.setAttribute('data-bwignore', 'true');
            if (hints[key]) {
                input.placeholder = hints[key];
            }
            fields[key] = input;
            label.appendChild(input);
            body.appendChild(label);
        });

        var error = createEl('div', 'tfm-modal-error');
        error.hidden = true;
        body.appendChild(error);

        var foot = createEl('div', 'tfm-modal-foot');
        var cancel = createEl('button', 'tfm-btn tfm-btn-ghost', '取消');
        cancel.type = 'button';
        var save = createEl('button', 'tfm-btn tfm-btn-primary', '保存');
        save.type = 'button';
        foot.appendChild(cancel);
        foot.appendChild(save);

        dialog.appendChild(head);
        dialog.appendChild(body);
        dialog.appendChild(foot);
        root.appendChild(mask);
        root.appendChild(dialog);

        var editingIndex = -1;

        function hide() {
            root.hidden = true;
            document.body.classList.remove('tfm-modal-open');
            editingIndex = -1;
        }

        function show(record, index) {
            editingIndex = typeof index === 'number' ? index : -1;
            title.textContent = editingIndex >= 0 ? '编辑友链' : '添加友链';
            friendFields.forEach(function (key) {
                fields[key].value = record && record[key] ? record[key] : '';
            });
            error.hidden = true;
            root.hidden = false;
            document.body.classList.add('tfm-modal-open');
            fields.title.focus();
        }

        function submit() {
            var record = {};
            friendFields.forEach(function (key) {
                record[key] = (fields[key].value || '').trim();
            });
            if (!record.title || !record.url) {
                error.textContent = '请填写博客名称和博客地址';
                error.hidden = false;
                return;
            }
            if (!record.role) {
                record.role = '友链';
            }
            onSave(record, editingIndex);
            hide();
        }

        close.addEventListener('click', hide);
        cancel.addEventListener('click', hide);
        mask.addEventListener('click', hide);
        save.addEventListener('click', submit);
        document.addEventListener('keydown', function (event) {
            if (!root.hidden && event.key === 'Escape') {
                hide();
            }
        });

        return { root: root, show: show, hide: hide };
    }

    function setupFriendsManager(form) {
        var textarea = qs('textarea[name="Friends"]', form);
        if (!textarea || textarea.getAttribute('data-friends-managed') === '1') {
            return;
        }

        var fieldItem = textarea.parentNode;
        var wrap = createEl('div', 'tfm');
        var toolbar = createEl('div', 'tfm-toolbar');
        var addBtn = createEl('button', 'tfm-btn tfm-btn-primary', '＋ 添加友链');
        addBtn.type = 'button';
        var count = createEl('span', 'tfm-count', '共 0 条');
        var rawToggle = createEl('button', 'tfm-btn tfm-btn-ghost', '展开原始记录');
        rawToggle.type = 'button';
        toolbar.appendChild(addBtn);
        toolbar.appendChild(count);
        toolbar.appendChild(rawToggle);

        var hint = createEl('p', 'tfm-hint', '每行一条友链；点击「添加友链」用表单编辑，也可展开原始记录手动修改。字段顺序：标题 || 地址 || 头像 || 简介 || 封面 || 副标题 || 标签 || 身份。');
        var list = createEl('div', 'tfm-list');
        var empty = createEl('div', 'tfm-empty', '还没有友链，点击「添加友链」创建第一条。');
        var raw = createEl('div', 'tfm-raw');
        raw.hidden = true;
        var rawLabel = createEl('label', 'tfm-raw-label', '原始多行记录');
        raw.appendChild(rawLabel);

        wrap.appendChild(toolbar);
        wrap.appendChild(hint);
        wrap.appendChild(list);
        wrap.appendChild(empty);
        wrap.appendChild(raw);
        fieldItem.insertBefore(wrap, textarea);
        raw.appendChild(textarea);
        textarea.setAttribute('data-friends-managed', '1');
        textarea.classList.add('tfm-textarea');

        var records = parseFriendText(textarea.value);
        var syncing = false;
        var modal = createFriendModal(function (record, index) {
            if (index >= 0 && records[index]) {
                records[index] = record;
            } else {
                records.push(record);
            }
            commit();
        });

        function commit() {
            syncing = true;
            textarea.value = serializeFriendRecords(records);
            syncing = false;
            render();
        }

        function move(index, offset) {
            var target = index + offset;
            if (target < 0 || target >= records.length) {
                return;
            }
            var current = records[index];
            records[index] = records[target];
            records[target] = current;
            commit();
        }

        function render() {
            list.innerHTML = '';
            count.textContent = '共 ' + records.length + ' 条';
            empty.hidden = records.length > 0;

            records.forEach(function (record, index) {
                var row = createEl('div', 'tfm-row');

                var thumb = createEl('div', 'tfm-row-thumb');
                if (record.cover) {
                    thumb.style.backgroundImage = 'url("' + record.cover.replace(/"/g, '%22') + '")';
                } else {
                    thumb.classList.add('is-fallback');
                }
                thumb.textContent = record.title ? record.title.charAt(0) : '?';
                row.appendChild(thumb);

                var main = createEl('div', 'tfm-row-main');
                var name = createEl('div', 'tfm-row-title', record.title || '(未命名)');
                main.appendChild(name);
                var meta = createEl('div', 'tfm-row-meta', (record.subtitle ? record.subtitle + ' · ' : '') + (record.url || '未填写地址'));
                main.appendChild(meta);
                if (record.tags) {
                    main.appendChild(createEl('div', 'tfm-row-tags', record.tags));
                }
                row.appendChild(main);

                var actions = createEl('div', 'tfm-row-actions');
                var editBtn = createEl('button', 'tfm-mini', '编辑');
                editBtn.type = 'button';
                editBtn.addEventListener('click', function () {
                    modal.show(record, index);
                });
                var upBtn = createEl('button', 'tfm-mini', '↑');
                upBtn.type = 'button';
                upBtn.title = '上移';
                upBtn.addEventListener('click', function () {
                    move(index, -1);
                });
                var downBtn = createEl('button', 'tfm-mini', '↓');
                downBtn.type = 'button';
                downBtn.title = '下移';
                downBtn.addEventListener('click', function () {
                    move(index, 1);
                });
                var delBtn = createEl('button', 'tfm-mini tfm-mini-danger', '删除');
                delBtn.type = 'button';
                delBtn.addEventListener('click', function () {
                    if (window.confirm('确定删除友链「' + (record.title || '未命名') + '」吗？')) {
                        records.splice(index, 1);
                        commit();
                    }
                });
                actions.appendChild(editBtn);
                actions.appendChild(upBtn);
                actions.appendChild(downBtn);
                actions.appendChild(delBtn);
                row.appendChild(actions);

                list.appendChild(row);
            });
        }

        function syncFromTextarea() {
            if (syncing) {
                return;
            }
            records = parseFriendText(textarea.value);
            render();
        }

        textarea.addEventListener('input', syncFromTextarea);
        textarea.addEventListener('change', syncFromTextarea);
        addBtn.addEventListener('click', function () {
            modal.show(null, -1);
        });
        rawToggle.addEventListener('click', function () {
            raw.hidden = !raw.hidden;
            rawToggle.textContent = raw.hidden ? '展开原始记录' : '收起原始记录';
        });

        document.body.appendChild(modal.root);
        render();
    }

    function initThemeConfig() {
        var mainColumn = getMainColumn();
        var content = qs('#themeConfigContent');
        if (!mainColumn || !content) {
            return;
        }

        var form = getConfigForm(mainColumn);
        if (!form) {
            return;
        }

        applyAutofillIgnore(form);
        applyAutofillIgnore(qs('#themeBackup'));

        mainColumn.classList.remove('col-tb-8', 'col-tb-offset-2');
        mainColumn.classList.add('col-tb-12');

        form.classList.add('theme-config-form');
        content.innerHTML = '';
        content.appendChild(form);

        var shell = qs('#themeConfigShell');
        if (shell) {
            shell.classList.add('is-ready');
        }

        if (!groupFormItems(form)) {
            return;
        }

        setupFriendsManager(form);
        bindNavEvents();
        bindMobileToggle();
        bindSubmitMemory(form);
        syncRememberLink();
        var updateFloatingSubmit = setupMobileFloatingSubmit(shell, form);
        bindSearch(form, updateFloatingSubmit);

        var initialHash = normalizeHash(window.location.hash || '#cids');

        setTimeout(function () {
            navigate(initialHash, false);
            if (typeof updateFloatingSubmit === 'function') {
                updateFloatingSubmit();
            }
        }, 80);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeConfig);
    } else {
        initThemeConfig();
    }
})();
