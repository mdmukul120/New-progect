<?php
/**
 * @var array<int,array<string,mixed>> $platforms
 */
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1>📡 Watch by OTT platform</h1>
      <p><?= count($platforms) ?> platforms indexed</p>
    </div>
  </div>

  <div class="ott-grid">
    <?php foreach ($platforms as $platform): ?>
      <a class="ott-card" href="/ott/<?= e($platform['slug']) ?>">
        <?php if (!empty($platform['logo'])): ?>
          <img src="<?= e($platform['logo']) ?>" alt="" width="34" height="34" loading="lazy" referrerpolicy="no-referrer">
        <?php endif; ?>
        <span>
          <b><?= e($platform['name']) ?></b>
          <small><?= (int) $platform['titles_count'] ?> titles</small>
        </span>
      </a>
    <?php endforeach; ?>
  </div>
</div>
