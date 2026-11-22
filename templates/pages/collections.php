<?php
/**
 * @var array<int,array<string,mixed>> $collections
 */
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1>🗂 Collections</h1>
      <p><?= count($collections) ?> curated universes &amp; marathons</p>
    </div>
  </div>

  <?php if ($collections === []): ?>
    <div class="empty-state"><b>No collections yet</b></div>
  <?php else: ?>
    <div class="tile-grid">
      <?php foreach ($collections as $collection): ?>
        <a class="tile" href="/collection/<?= e($collection['slug']) ?>">
          <h3><?= e($collection['name']) ?></h3>
          <span><?= (int) $collection['titles_count'] ?> titles</span>
        </a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
