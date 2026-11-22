<?php
/**
 * Search results with filters.
 *
 * @var string $query
 * @var array<string,mixed> $result
 * @var array<string,string> $filters
 * @var array<int,array<string,mixed>> $languages
 * @var array<int,array<string,mixed>> $genres
 * @var array<string,mixed> $site
 */
$types = ['' => 'All types', 'movie' => 'Movies', 'series' => 'Series', 'anime' => 'Anime', 'drama' => 'Drama', 'animation' => 'Animation'];
$sorts = ['recent' => 'Recently updated', 'views' => 'Most viewed', 'rating' => 'Top rated', 'latest' => 'Newest'];
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1><?= $query !== '' ? '🔎 Results for “' . e($query) . '”' : '🔎 Search the library' ?></h1>
      <p><?= (int) $result['total'] ?> matches · page <?= (int) $result['page'] ?> of <?= (int) $result['pages'] ?></p>
    </div>
  </div>

  <form class="filters" method="get" action="/search">
    <label class="hidden" for="q">Search</label>
    <input class="select" style="min-width:220px" id="q" name="q" type="search" value="<?= e($query) ?>" placeholder="Title, language, quality…">

    <label class="hidden" for="typeFilter">Type</label>
    <select class="select" id="typeFilter" name="type" data-auto-submit>
      <?php foreach ($types as $value => $label): ?>
        <option value="<?= e($value) ?>" <?= $filters['type'] === $value ? 'selected' : '' ?>><?= e($label) ?></option>
      <?php endforeach; ?>
    </select>

    <label class="hidden" for="langFilter">Language</label>
    <select class="select" id="langFilter" name="language" data-auto-submit>
      <option value="">All languages</option>
      <?php foreach ($languages as $language): ?>
        <option value="<?= e($language['slug']) ?>" <?= $filters['language'] === $language['slug'] ? 'selected' : '' ?>>
          <?= e(strip_tags($language['label'])) ?>
        </option>
      <?php endforeach; ?>
    </select>

    <label class="hidden" for="genreFilter">Genre</label>
    <select class="select" id="genreFilter" name="genre" data-auto-submit>
      <option value="">All genres</option>
      <?php foreach ($genres as $genre): ?>
        <option value="<?= e($genre['slug']) ?>" <?= $filters['genre'] === $genre['slug'] ? 'selected' : '' ?>>
          <?= e(strip_tags($genre['label'])) ?>
        </option>
      <?php endforeach; ?>
    </select>

    <label class="hidden" for="sortFilter">Sort</label>
    <select class="select" id="sortFilter" name="sort" data-auto-submit>
      <?php foreach ($sorts as $value => $label): ?>
        <option value="<?= e($value) ?>" <?= $filters['sort'] === $value ? 'selected' : '' ?>><?= e($label) ?></option>
      <?php endforeach; ?>
    </select>

    <button class="btn btn-primary" type="submit">Search</button>
  </form>

  <?php if ($result['items'] === []): ?>
    <div class="empty-state">
      <b>No matches</b>
      <span>Try a shorter keyword, or browse <a href="/trending">trending</a> and <a href="/latest">latest</a>.</span>
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
        'paginationBase' => '/search?q=' . rawurlencode($query) . '&page=',
    ]) ?>
  <?php endif; ?>
</div>
