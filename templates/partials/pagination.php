<?php
/**
 * Server-side pagination. No "load more" ad triggers.
 *
 * @var int $page
 * @var int $pages
 * @var string $paginationBase
 * @var string|null $paginationSuffix
 */
$page = max(1, (int) $page);
$pages = max(1, (int) $pages);
if ($pages < 2) {
    return;
}

$suffix = (string) ($paginationSuffix ?? '');
$window = 2;
$numbers = [];
for ($i = 1; $i <= $pages; $i++) {
    if ($i === 1 || $i === $pages || abs($i - $page) <= $window) {
        $numbers[] = $i;
    }
}

$link = static fn (int $n): string => url($paginationBase . $n . $suffix);
?>
<nav class="pagination" aria-label="Pagination">
  <?php if ($page > 1): ?>
    <a href="<?= e($link($page - 1)) ?>" rel="prev" aria-label="Previous page">← Prev</a>
  <?php else: ?>
    <span class="is-disabled" aria-disabled="true">← Prev</span>
  <?php endif; ?>

  <?php $previous = 0; ?>
  <?php foreach ($numbers as $number): ?>
    <?php if ($previous !== 0 && $number - $previous > 1): ?>
      <span class="ellipsis">…</span>
    <?php endif; ?>
    <?php if ($number === $page): ?>
      <span class="is-current" aria-current="page"><?= $number ?></span>
    <?php else: ?>
      <a href="<?= e($link($number)) ?>"><?= $number ?></a>
    <?php endif; ?>
    <?php $previous = $number; ?>
  <?php endforeach; ?>

  <?php if ($page < $pages): ?>
    <a href="<?= e($link($page + 1)) ?>" rel="next" aria-label="Next page">Next →</a>
  <?php else: ?>
    <span class="is-disabled" aria-disabled="true">Next →</span>
  <?php endif; ?>
</nav>
