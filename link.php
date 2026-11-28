<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<?php
/**
 * 友链
 *
 * @package custom
 */

if (!function_exists('butterfly_parse_friend_record')) {
    /**
     * 解析单行友链记录。
     * 字段顺序：标题 || 地址 || 头像 || 简介 || 封面 || 副标题 || 标签 || 身份
     * 前 4 个字段与旧版「博客名称 || 博客地址 || 博客头像 || 博客简介」保持一致，
     * 因此存量数据无需迁移。字段值里的 || 用 ‖ 转义。
     */
    function butterfly_parse_friend_record($line)
    {
        $keys = array('title', 'url', 'avatar', 'desc', 'cover', 'subtitle', 'tags', 'role');
        $parts = explode('||', $line);
        $record = array();

        foreach ($keys as $index => $key) {
            $value = isset($parts[$index]) ? $parts[$index] : '';
            $record[$key] = trim(str_replace('‖', '||', $value));
        }

        if ($record['role'] === '') {
            $record['role'] = '友链';
        }

        return $record;
    }
}

if (!function_exists('butterfly_friend_tags')) {
    /** 把「标签1,标签2」拆成数组 */
    function butterfly_friend_tags($text)
    {
        $tags = preg_split('/[,，、]/', $text);
        $result = array();
        foreach ($tags as $tag) {
            $tag = trim($tag);
            if ($tag !== '') {
                $result[] = $tag;
            }
        }
        return $result;
    }
}

$this->need('includes/page_header.php');
?>
<main class="layout" id="content-inner">
<div id="page">
<div id="article-container">
    <div class="flink">
<?php $this->content(); ?>
<?php if ($this->options->friendset == 1) : ?>
<?php
    if (array_key_exists('Links', Typecho_Plugin::export()['activated'])) {
        $errorimg = Helper::options()->themeUrl . '/img/friend_404.gif';
        $shuffle = Helper::options()->linksshuffle;
        $link_limit = Helper::options()->linksIndexNum;
        $Links = Links_Plugin::output("
        <div class='flink-list-item'>
        <a target='_blank' href='{url}'>
        <div class='flink-item-icon'>
        <img onerror=\"this.onerror=null;this.src='{$errorimg}'\" src='{GetLazyLoad()}' data-lazy-src='{image}' alt='{name}' title='{name}' class='entered'/></div>
        <div class='flink-item-name'>{name}</div>
        <div class='flink-item-desc' title='{description}'>{description}</div>
        </a></div>");
        echo '<div class="flink-list">';
        for ($i = 0; $i < count($Links); $i++) {
            echo $Links[$i];
        }
        echo '</div>';
    }
?>
<?php else : ?>
<?php
    $friendsRaw = $this->options->Friends;
    $records = array();
    if ($friendsRaw && strpos($friendsRaw, '||') !== false) {
        foreach (preg_split('/\r\n|\r|\n/', $friendsRaw) as $line) {
            $line = trim($line);
            if ($line !== '') {
                $records[] = butterfly_parse_friend_record($line);
            }
        }
    }

    if ($records) :
        $errorimg = Helper::options()->themeUrl . '/img/friend_404.gif';
        $lazyimg = GetLazyLoad();
?>
    <div class="flink-card-list">
<?php foreach ($records as $index => $record) : ?>
<?php
        $title = htmlspecialchars($record['title'], ENT_QUOTES, 'UTF-8');
        $url = htmlspecialchars($record['url'], ENT_QUOTES, 'UTF-8');
        $subtitle = htmlspecialchars($record['subtitle'], ENT_QUOTES, 'UTF-8');
        $safeSubtitle = $subtitle !== '' ? $subtitle : $title;
        $avatar = htmlspecialchars($record['avatar'], ENT_QUOTES, 'UTF-8');
        $cover = htmlspecialchars($record['cover'], ENT_QUOTES, 'UTF-8');
        $desc = nl2br(htmlspecialchars($record['desc'], ENT_QUOTES, 'UTF-8'));
        $role = htmlspecialchars($record['role'], ENT_QUOTES, 'UTF-8');
        $number = sprintf('%02d', $index + 1);
        $letter = function_exists('mb_substr')
            ? mb_substr($record['title'], 0, 1, 'UTF-8')
            : substr($record['title'], 0, 1);
        $letter = htmlspecialchars($letter, ENT_QUOTES, 'UTF-8');
?>
        <article class="flink-card-item">
            <a class="flink-card-cover<?php echo $cover === '' ? ' is-fallback' : ''; ?>"<?php echo $cover !== '' ? ' style="background-image:url(\'' . $cover . '\')"' : ''; ?> href="<?php echo $url; ?>" target="_blank" rel="noopener noreferrer" aria-label="<?php echo $title; ?>">
                <span class="flink-card-cover-subtitle"><?php echo $safeSubtitle; ?></span>
                <span class="flink-card-cover-open">打开首页 ↗</span>
            </a>
            <div class="flink-card-body">
                <div class="flink-card-head">
                    <div class="flink-card-avatar">
<?php if ($avatar !== '') : ?>
                        <img src="<?php echo htmlspecialchars($lazyimg, ENT_QUOTES, 'UTF-8'); ?>" data-lazy-src="<?php echo $avatar; ?>" onerror="this.onerror=null;this.src='<?php echo $errorimg; ?>'" alt="<?php echo $title; ?>" class="entered" />
<?php else : ?>
                        <span class="flink-card-letter"><?php echo $letter; ?></span>
<?php endif; ?>
                    </div>
                    <div class="flink-card-titles">
                        <h3 class="flink-card-title"><a href="<?php echo $url; ?>" target="_blank" rel="noopener noreferrer"><?php echo $title; ?></a></h3>
<?php if ($subtitle !== '') : ?>
                        <p class="flink-card-subtitle"><?php echo $subtitle; ?></p>
<?php endif; ?>
                    </div>
                    <span class="flink-card-index" aria-hidden="true"><?php echo $number; ?></span>
                </div>
<?php if ($desc !== '') : ?>
                <p class="flink-card-desc"><?php echo $desc; ?></p>
<?php endif; ?>
<?php $tags = butterfly_friend_tags($record['tags']); ?>
<?php if ($tags) : ?>
                <div class="flink-card-tags">
<?php foreach ($tags as $tag) : ?>
                    <span class="flink-card-tag"><?php echo htmlspecialchars($tag, ENT_QUOTES, 'UTF-8'); ?></span>
<?php endforeach; ?>
                </div>
<?php endif; ?>
                <div class="flink-card-foot">
                    <span class="flink-card-role"><?php echo $role; ?></span>
                    <a class="flink-card-visit" href="<?php echo $url; ?>" target="_blank" rel="noopener noreferrer">访问站点 ↗</a>
                </div>
            </div>
        </article>
<?php endforeach; ?>
    </div>
<?php endif; ?>
<?php endif; ?>
    </div>
</div>

<?php $this->need('includes/comments.php'); ?>
</div>
<?php $this->need('includes/sidebar.php'); ?>
</main>
<!-- end #main-->
<?php $this->need('footer.php'); ?>
