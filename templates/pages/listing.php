<?php
/**
 * Generic archive page (type / language / genre / collection / ott).
 *
 * @var array<string,mixed> $result
 * @var string $heading
 * @var string $basePath
 * @var string $sort
 * @var array<string,mixed> $site
 */
$sorts = [
    'recent' => 'Recently updated',
    'views' => 'Most viewed',
    'rating' => 'Top rated',
    'latest' => 'Newest published',
    'title' => 'A → Z',
    'year' => 'Year',
];
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1><?= e($heading) ?></h1>
      <p><?= (int) $result['total'] ?> titles · page <?= (int) $result['page'] ?> of <?= (int) $result['pages'] ?></p>
    </div>
  </div>

  <form class="filters" method="get" action="<?= e($basePath) ?>">
    <label class="hidden" for="sortSelect">Sort by</label>
    <select class="select" id="sortSelect" name="sort" data-auto-submit>
      <?php foreach ($sorts as $value => $label): ?>
        <option value="<?= e($value) ?>" <?= $sort === $value ? 'selected' : '' ?>><?= e($label) ?></option>
      <?php endforeach; ?>
    </select>
    <noscript><button class="btn btn-ghost" type="submit">Apply</button></noscript>
  </form>

  <?php if ($result['items'] === []): ?>
    <div class="empty-state">
      <b>Nothing here yet</b>
      <span>Try another category or use the search box above.</span>
    </div>
  <?php else: ?>
    <div class="card-grid">
      <?php foreach ($result['items'] as $item): ?>
        <?= $view->partial('partials/card', ['item' => $item, 'site' => $site]) ?>
      <?php endforeach; ?>
    </div>
    <?= $view->partial('partials/pagination', [
        'page' => $result['page'],
        'pages' => $result['pages'],
        'paginationBase' => $paginationBase,
        'paginationSuffix' => $paginationSuffix ?? '',
    ]) ?>
  <?php endif; ?>
</div>
