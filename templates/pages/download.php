<?php
/**
 * Dedicated download page (kept for compatibility with old /download links).
 *
 * @var array<string,mixed> $item
 * @var array<int,array<string,mixed>> $links
 * @var array<string,mixed> $site
 */
$watchUrl = '/' . $item['type'] . '/' . $item['slug'] . '#watch';
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1>⬇️ <?= e($item['title']) ?></h1>
      <p>Choose a quality below — one-click direct download or instant stream, zero ad-gates.</p>
    </div>
    <a class="btn btn-ghost" href="<?= e($watchUrl) ?>">▶ Watch Online</a>
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
          <div class="dl-actions">
            <a class="btn btn-ghost" href="<?= e($watchUrl) ?>">▶ Watch</a>
            <a class="btn btn-primary"
               href="<?= e($link['url']) ?>"
               download="<?= e($link['filename'] ?? '') ?>"
               <?php if (!empty($link['is_cors_download']) && !empty($link['direct_url'])): ?>
                 data-download-direct="<?= e($link['direct_url']) ?>"
                 data-download-name="<?= e($link['filename'] ?? 'video.mp4') ?>"
               <?php endif; ?>>⬇ Download</a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <p class="mt-4"><a class="section-link" href="/<?= e($item['type']) ?>/<?= e($item['slug']) ?>">← Back to title details</a></p>
  <?php endif; ?>
</div>
