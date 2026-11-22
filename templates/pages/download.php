<?php
/**
 * Dedicated download page (kept for compatibility with old /download links).
 *
 * @var array<string,mixed> $item
 * @var array<int,array<string,mixed>> $links
 * @var array<string,mixed> $site
 */
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1>⬇️ <?= e($item['title']) ?></h1>
      <p>Choose a quality below — every link opens directly, no shortener.</p>
    </div>
  </div>

  <?php if ($links === []): ?>
    <div class="empty-state">
      <b>Links are being processed</b>
      <span>Try again in a few minutes, or open the <a href="/<?= e($item['type']) ?>/<?= e($item['slug']) ?>">title page</a>.</span>
    </div>
  <?php else: ?>
    <div class="download-list">
      <?php foreach ($links as $link): ?>
        <div class="download-row">
          <div class="dl-main">
            <b><?= e($link['label']) ?></b>
            <small><?= e(trim(($link['quality'] ?? '') . ' • ' . ($link['size'] ?? ''), ' •')) ?></small>
          </div>
          <a class="btn btn-primary" href="<?= e($link['url']) ?>" rel="noopener nofollow" target="_blank">Download</a>
        </div>
      <?php endforeach; ?>
    </div>
    <p class="mt-4"><a class="section-link" href="/<?= e($item['type']) ?>/<?= e($item['slug']) ?>">← Back to title details</a></p>
  <?php endif; ?>
</div>
