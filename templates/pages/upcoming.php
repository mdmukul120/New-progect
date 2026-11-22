<?php
/**
 * Upcoming release calendar.
 *
 * @var array<int,array<string,mixed>> $items
 * @var array<string,mixed> $site
 */
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1>🗓 Upcoming releases</h1>
      <p><?= count($items) ?> titles on the calendar</p>
    </div>
  </div>

  <?php if ($items === []): ?>
    <div class="empty-state"><b>No upcoming titles</b><span>Check back soon.</span></div>
  <?php else: ?>
    <div class="card-grid">
      <?php foreach ($items as $item): ?>
        <?= $view->partial('partials/card', ['item' => $item, 'site' => $site]) ?>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
