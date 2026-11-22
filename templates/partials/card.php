<?php
/**
 * Single poster card.
 *
 * @var array<string,mixed> $item
 * @var array<string,mixed> $site
 */
$url = '/' . $item['type'] . '/' . $item['slug'];
$poster = $item['poster'] ?: $site['placeholder'];
$meta = array_filter([
    $item['year'] ? (string) (int) $item['year'] : null,
    $item['language_raw'] ?: ($item['language'] ? ucfirst((string) $item['language']) : null),
]);
?>
<article class="card">
  <a class="card-poster" href="<?= e($url) ?>" aria-label="<?= e($item['title']) ?>" tabindex="-1">
    <img src="<?= e($poster) ?>" alt="<?= e($item['title']) ?>" width="160" height="240"
         loading="lazy" decoding="async" referrerpolicy="no-referrer"
         onerror="this.onerror=null;this.src='<?= e($site['placeholder']) ?>'">

    <div class="card-badges">
      <?php if (!empty($item['is_pinned'])): ?><span class="badge badge-pin">PINNED</span><?php endif; ?>
      <?php if (!empty($item['is_adult'])): ?><span class="badge badge-sex">18+</span><?php endif; ?>
      <?php if (!empty($item['is_new']) && empty($item['is_pinned'])): ?><span class="badge badge-new">NEW</span><?php endif; ?>
      <?php if (!empty($item['rating'])): ?><span class="badge badge-rating">⭐ <?= e(number_format((float) $item['rating'], 1)) ?></span><?php endif; ?>
    </div>

    <span class="card-views">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>
      </svg>
      <?= e(format_views((int) $item['views'])) ?>
    </span>

    <?php if (!empty($item['quality'])): ?>
      <span class="card-quality"><?= e($item['quality']) ?></span>
    <?php endif; ?>
  </a>

  <a class="card-title" href="<?= e($url) ?>"><?= e($item['title']) ?></a>

  <div class="card-meta">
    <?php if ($meta !== []): ?>
      <span><?= e(implode(' • ', $meta)) ?></span>
    <?php endif; ?>
    <?php if (!empty($item['ep_label'])): ?>
      <span class="card-ep<?= ($item['ep_state'] ?? '') === 'completed' ? ' is-done' : '' ?>"><?= e($item['ep_label']) ?></span>
    <?php endif; ?>
  </div>
</article>
