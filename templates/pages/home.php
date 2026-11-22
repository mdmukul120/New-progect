<?php
/**
 * Homepage.
 *
 * @var array<string,mixed> $recent
 * @var array<int,array<string,mixed>> $top10
 * @var array<int,array<string,mixed>> $upcomingTitles
 * @var array<string,array<string,mixed>> $rails
 * @var array<int,array<string,mixed>> $collections
 * @var array<int,array<string,mixed>> $ott
 * @var array<int,array<string,mixed>> $genres
 * @var array<int,array<string,mixed>> $notices
 * @var array<string,int> $counts
 * @var array<string,mixed> $site
 */
$hero = $top10[0] ?? null;
$heroB = $top10[1] ?? null;
$heroCandidates = array_slice(array_merge($top10, $recent['items']), 0, 3);
$heroCandidates = array_values(array_filter($heroCandidates, static fn (array $row): bool => !empty($row['poster'])));
$heroSlides = array_slice($heroCandidates, 0, 3);
$pageNo = (int) ($page ?? 1);
?>
<div class="hero shell">
  <div class="hero-grid">
    <div class="hero-main">
      <?php if ($heroSlides !== []): ?>
        <div class="hero-slides" id="heroSlides">
          <?php foreach ($heroSlides as $index => $slide): ?>
            <div class="hero-slide<?= $index === 0 ? ' is-active' : '' ?>">
              <a class="hero-bg" href="/<?= e($slide['type']) ?>/<?= e($slide['slug']) ?>"
                 aria-label="<?= e($slide['title']) ?>"
                 style="background-image:url('<?= e($slide['poster']) ?>')"></a>
              <div class="hero-body">
                <span class="hero-kicker"><?= !empty($slide['is_pinned']) ? '📌 Pinned pick' : '🔥 Trending now' ?></span>
                <?php if ($index === 0): ?>
                  <h1 class="hero-title"><?= e($slide['title']) ?></h1>
                <?php else: ?>
                  <p class="hero-title"><?= e($slide['title']) ?></p>
                <?php endif; ?>
                <div class="hero-meta">
                  <?php if (!empty($slide['rating'])): ?><span class="fact is-gold">⭐ <?= e(number_format((float) $slide['rating'], 1)) ?></span><?php endif; ?>
                  <?php if (!empty($slide['year'])): ?><span class="fact"><?= (int) $slide['year'] ?></span><?php endif; ?>
                  <?php if (!empty($slide['quality'])): ?><span class="fact is-brand"><?= e($slide['quality']) ?></span><?php endif; ?>
                  <?php if (!empty($slide['language'])): ?><span class="fact"><?= e($slide['language']) ?></span><?php endif; ?>
                  <span class="fact">👁 <?= e(format_views((int) $slide['views'])) ?> views</span>
                </div>
                <div class="hero-actions">
                  <a class="btn btn-primary" href="/<?= e($slide['type']) ?>/<?= e($slide['slug']) ?>">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                    Watch / Download
                  </a>
                  <a class="btn btn-ghost" href="/type/<?= $slide['type'] === 'movie' ? 'movies' : 'series' ?>">More like this</a>
                </div>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
        <?php if (count($heroSlides) > 1): ?>
          <div class="hero-dots" id="heroDots" role="tablist" aria-label="Featured titles">
            <?php foreach ($heroSlides as $index => $slide): ?>
              <button type="button" class="<?= $index === 0 ? 'is-active' : '' ?>" role="tab"
                      aria-label="Show <?= e($slide['title']) ?>" aria-selected="<?= $index === 0 ? 'true' : 'false' ?>"></button>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      <?php else: ?>
        <div class="hero-body">
          <span class="hero-kicker">Fresh start</span>
          <h1 class="hero-title">Your library is empty</h1>
          <p class="muted">Run <code>php bin/console.php migrate --seed</code> to import the catalogue.</p>
        </div>
      <?php endif; ?>
    </div>

    <aside class="hero-side" aria-label="Top 10 this week">
      <h3>🏆 Top 10 this week <a href="/trending">View all</a></h3>
      <div class="rank-list">
        <?php foreach (array_slice($top10, 0, 7) as $index => $item): ?>
          <a class="rank-item" href="/<?= e($item['type']) ?>/<?= e($item['slug']) ?>">
            <span class="rank-num"><?= $index + 1 ?></span>
            <img class="rank-thumb" src="<?= e($item['poster'] ?: $site['placeholder']) ?>"
                 alt="" width="40" height="56" loading="lazy" decoding="async" referrerpolicy="no-referrer"
                 onerror="this.onerror=null;this.src='<?= e($site['placeholder']) ?>'">
            <span class="rank-title"><?= e($item['title']) ?></span>
            <span class="rank-views"><?= e(format_views((int) $item['views'])) ?></span>
          </a>
        <?php endforeach; ?>
      </div>
    </aside>
  </div>

  <?php if ($notices !== []): ?>
    <div class="notice" data-notice-board role="status">
      <span class="notice-label">📢 Notice</span>
      <div class="notice-track">
        <?php foreach ($notices as $index => $notice): ?>
          <div class="notice-item<?= $index === 0 ? ' is-active' : '' ?>"><?= e($notice['message']) ?></div>
        <?php endforeach; ?>
      </div>
      <?php if (count($notices) > 1): ?>
        <div class="notice-dots">
          <?php foreach ($notices as $index => $notice): ?>
            <button type="button" class="<?= $index === 0 ? 'is-active' : '' ?>" aria-label="Notice <?= $index + 1 ?>"></button>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  <?php endif; ?>
</div>

<?php if ($upcomingTitles !== []): ?>
<section class="section shell" aria-labelledby="upcomingHeading">
  <div class="section-head">
    <div>
      <h2 id="upcomingHeading">🗓 Upcoming / Release soon</h2>
      <p class="section-sub">Release calendar, sorted by date</p>
    </div>
    <a class="section-link" href="/upcoming">Full calendar →</a>
  </div>
  <div class="upcoming-track">
    <?php foreach ($upcomingTitles as $item): ?>
      <?php
      $release = $item['release_date'] ? strtotime((string) $item['release_date']) : null;
      ?>
      <article class="upcoming-card">
        <div class="upcoming-poster">
          <img src="<?= e($item['poster'] ?: $site['placeholder']) ?>"
               alt="<?= e($item['title']) ?>" width="120" height="180" loading="lazy" decoding="async"
               referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='<?= e($site['placeholder']) ?>'">
          <?php if ($release): ?>
            <span class="upcoming-date">
              <b><?= date('j', $release) ?></b>
              <span><?= date('M', $release) ?></span>
            </span>
          <?php endif; ?>
        </div>
        <a class="upcoming-name" href="/<?= e($item['type']) ?>/<?= e($item['slug']) ?>"><?= e($item['title']) ?></a>
      </article>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<section class="section shell" aria-labelledby="recentHeading">
  <div class="section-head">
    <div>
      <h2 id="recentHeading">🆕 Recently updated</h2>
      <p class="section-sub"><?= (int) $recent['total'] ?> titles · page <?= $pageNo ?> of <?= (int) $recent['pages'] ?></p>
    </div>
    <a class="section-link" href="/latest">Browse all →</a>
  </div>

  <?php if ($recent['items'] === []): ?>
    <div class="empty-state">
      <b>No titles yet</b>
      <span>Import the catalogue with <code>php bin/console.php migrate --seed</code>.</span>
    </div>
  <?php else: ?>
    <div class="card-grid">
      <?php foreach ($recent['items'] as $item): ?>
        <?= $view->partial('partials/card', ['item' => $item, 'site' => $site]) ?>
      <?php endforeach; ?>
    </div>
    <?= $view->partial('partials/pagination', [
        'page' => $recent['page'],
        'pages' => $recent['pages'],
        'paginationBase' => '/page/',
    ]) ?>
  <?php endif; ?>
</section>

<?php if ($collections !== []): ?>
<section class="section shell" aria-labelledby="collectionsHeading">
  <div class="section-head">
    <div>
      <h2 id="collectionsHeading">🗂 Curated collections</h2>
      <p class="section-sub">Hand-picked universes and marathons</p>
    </div>
    <a class="section-link" href="/collections">All collections →</a>
  </div>
  <div class="tile-grid">
    <?php foreach ($collections as $collection): ?>
      <a class="tile" href="/collection/<?= e($collection['slug']) ?>">
        <h3><?= e($collection['name']) ?></h3>
        <span><?= (int) $collection['titles_count'] ?> titles</span>
      </a>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<?php foreach ($rails as $key => $rail): ?>
  <?php if ($rail['items'] === []) { continue; } ?>
  <section class="section shell" aria-labelledby="rail-<?= e($key) ?>">
    <div class="section-head">
      <div>
        <h2 id="rail-<?= e($key) ?>"><?= e($rail['title']) ?></h2>
      </div>
      <a class="section-link" href="<?= e($rail['href'] ?: '/type/movies') ?>">See all →</a>
    </div>
    <div class="rail">
      <div class="rail-track">
        <?php foreach ($rail['items'] as $item): ?>
          <?= $view->partial('partials/card', ['item' => $item, 'site' => $site]) ?>
        <?php endforeach; ?>
      </div>
    </div>
  </section>
<?php endforeach; ?>

<?php if ($ott !== []): ?>
<section class="section shell" aria-labelledby="ottHeading">
  <div class="section-head">
    <div>
      <h2 id="ottHeading">📡 Watch by OTT</h2>
      <p class="section-sub">Every platform, one index</p>
    </div>
    <a class="section-link" href="/ott">All platforms →</a>
  </div>
  <div class="ott-grid">
    <?php foreach (array_slice($ott, 0, 12) as $platform): ?>
      <a class="ott-card" href="/ott/<?= e($platform['slug']) ?>">
        <?php if (!empty($platform['logo'])): ?>
          <img src="<?= e($platform['logo']) ?>" alt="" width="34" height="34"
               loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <?php endif; ?>
        <span>
          <b><?= e($platform['name']) ?></b>
          <small><?= (int) $platform['titles_count'] ?> titles</small>
        </span>
      </a>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<?php if ($genres !== []): ?>
<section class="section shell" aria-labelledby="genresHeading">
  <div class="section-head">
    <div>
      <h2 id="genresHeading">🎭 Browse by genre</h2>
      <p class="section-sub">From action to survival</p>
    </div>
  </div>
  <div class="chips">
    <?php foreach ($genres as $genre): ?>
      <a class="chip" href="/genre/<?= e($genre['slug']) ?>"><?= e(ucfirst($genre['name'])) ?> <span class="chip-badge"><?= (int) $genre['titles_count'] ?></span></a>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<script>
(function () {
  var wrap = document.getElementById('heroSlides');
  var dots = document.getElementById('heroDots');
  if (!wrap || !dots) return;
  var slides = Array.prototype.slice.call(wrap.querySelectorAll('.hero-slide'));
  var buttons = Array.prototype.slice.call(dots.querySelectorAll('button'));
  if (slides.length < 2) return;
  var index = 0, timer = null;

  function show(next, manual) {
    slides[index].classList.remove('is-active');
    buttons[index].classList.remove('is-active');
    buttons[index].setAttribute('aria-selected', 'false');
    index = (next + slides.length) % slides.length;
    slides[index].classList.add('is-active');
    buttons[index].classList.add('is-active');
    buttons[index].setAttribute('aria-selected', 'true');
    if (manual) restart();
  }
  function restart() {
    clearInterval(timer);
    timer = setInterval(function () { show(index + 1, false); }, 7000);
  }
  buttons.forEach(function (btn, i) {
    btn.addEventListener('click', function () { show(i, true); });
  });
  wrap.addEventListener('mouseenter', function () { clearInterval(timer); });
  wrap.addEventListener('mouseleave', restart);
  restart();
})();
</script>
