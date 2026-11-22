<?php
/**
 * Single title page: poster, facts, downloads, episodes, related.
 *
 * @var array<string,mixed> $item
 * @var array<int,array<string,mixed>> $links
 * @var array<int,array<string,mixed>> $episodes
 * @var array<int,array<string,mixed>> $related
 * @var array<int,array<string,mixed>> $breadcrumb
 * @var array<string,mixed> $site
 */
$poster = $item['poster'] ?: $site['placeholder'];
$seasons = [];
foreach ($episodes as $episode) {
    $seasons[(int) $episode['season']][] = $episode;
}
?>
<div class="shell">
  <nav class="card-meta mt-2" aria-label="Breadcrumb" style="padding-top:14px">
    <?php foreach ($breadcrumb as $index => $crumb): ?>
      <?php if ($index > 0): ?><span class="dot"></span><?php endif; ?>
      <?php if ($index === count($breadcrumb) - 1): ?>
        <span><?= e($crumb['name']) ?></span>
      <?php else: ?>
        <a href="<?= e($crumb['url']) ?>"><?= e($crumb['name']) ?></a>
      <?php endif; ?>
    <?php endforeach; ?>
  </nav>

  <article class="title-hero" data-title-slug="<?= e($item['slug']) ?>" data-title-name="<?= e($item['title']) ?>"
           data-title-poster="<?= e($poster) ?>" data-title-type="<?= e($item['type']) ?>"
           data-title-url="/<?= e($item['type']) ?>/<?= e($item['slug']) ?>">
    <div class="title-hero-bg" style="background-image:url('<?= e($poster) ?>')"></div>
    <div class="title-hero-inner">
      <div class="title-poster">
        <img src="<?= e($poster) ?>" alt="<?= e($item['title']) ?>" width="210" height="315"
             fetchpriority="high" referrerpolicy="no-referrer"
             onerror="this.src='<?= e($site['placeholder']) ?>'">
      </div>

      <div class="title-info">
        <h1><?= e($item['title']) ?></h1>

        <div class="title-facts">
          <?php if (!empty($item['rating'])): ?><span class="fact is-gold">⭐ <?= e(number_format((float) $item['rating'], 1)) ?> / 10</span><?php endif; ?>
          <?php if (!empty($item['year'])): ?><span class="fact"><?= (int) $item['year'] ?></span><?php endif; ?>
          <?php if (!empty($item['quality'])): ?><span class="fact is-brand"><?= e($item['quality']) ?></span><?php endif; ?>
          <?php if (!empty($item['language_raw']) || !empty($item['language'])): ?><span class="fact">🗣 <?= e($item['language_raw'] ?: ucfirst((string) $item['language'])) ?></span><?php endif; ?>
          <?php if (!empty($item['runtime'])): ?><span class="fact">⏱ <?= e($item['runtime']) ?></span><?php endif; ?>
          <span class="fact">👁 <?= e(format_views((int) $item['views'])) ?> views</span>
          <span class="fact">🕒 <?= e(time_ago((string) $item['updated_at'])) ?></span>
          <?php if (($item['status'] ?? '') === 'ongoing'): ?><span class="fact is-brand">⏳ Ongoing</span><?php endif; ?>
          <?php if (!empty($item['ep_label'])): ?><span class="fact is-brand"><?= e($item['ep_label']) ?></span><?php endif; ?>
        </div>

        <?php if (!empty($item['genres'])): ?>
          <div class="chips" style="padding:0">
            <?php foreach ($item['genres'] as $genre): ?>
              <a class="chip" href="/genre/<?= e($genre) ?>"><?= e(ucfirst(str_replace('-', ' ', (string) $genre))) ?></a>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>

        <p class="title-synopsis">
          <?= e($item['synopsis'] ?: $item['title'] . ' — full details, verified download mirrors and episode list. Served with zero ads, zero popups and zero redirect loops.') ?>
        </p>

        <div class="hero-actions">
          <?php if ($links !== []): ?>
            <a class="btn btn-primary" href="#downloads">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M12 4v10M7 12l5 5 5-5M5 20h14"/>
              </svg>
              Download now
            </a>
          <?php endif; ?>
          <button class="btn btn-ghost" type="button" data-copy="<?= e(($site['url'] ?? '') . '/' . $item['type'] . '/' . $item['slug']) ?>">Copy link</button>
        </div>
      </div>
    </div>
  </article>

  <?php if ($links !== []): ?>
  <section class="section" id="downloads" aria-labelledby="downloadHeading">
    <div class="section-head">
      <div>
        <h2 id="downloadHeading">⬇️ Download links</h2>
        <p class="section-sub">Direct, verified mirrors — no shorteners, no ad-gate</p>
      </div>
    </div>
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
  </section>
  <?php endif; ?>

  <?php if ($episodes !== []): ?>
  <section class="section" aria-labelledby="episodeHeading">
    <div class="section-head">
      <div>
        <h2 id="episodeHeading">📺 Episodes</h2>
        <p class="section-sub"><?= count($episodes) ?> episodes across <?= count($seasons) ?> season(s)</p>
      </div>
    </div>
    <div class="stack">
      <?php foreach ($seasons as $season => $list): ?>
        <div class="panel">
          <b>Season <?= (int) $season ?></b>
          <div class="ep-chips mt-2">
            <?php foreach ($list as $episode): ?>
              <span class="ep-chip" title="<?= e($episode['name'] ?: 'Episode ' . $episode['episode']) ?>">
                E<?= str_pad((string) $episode['episode'], 2, '0', STR_PAD_LEFT) ?>
              </span>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($related !== []): ?>
  <section class="section" aria-labelledby="relatedHeading">
    <div class="section-head">
      <div>
        <h2 id="relatedHeading">🍿 You may also like</h2>
      </div>
    </div>
    <div class="card-grid">
      <?php foreach ($related as $row): ?>
        <?= $view->partial('partials/card', ['item' => $row, 'site' => $site]) ?>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>
</div>

<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@type' => $item['type'] === 'movie' ? 'Movie' : 'TVSeries',
    'name' => $item['title'],
    'image' => $poster,
    'url' => ($site['url'] ?? '') . '/' . $item['type'] . '/' . $item['slug'],
    'description' => $item['synopsis'] ?: $item['title'],
    'inLanguage' => $item['language'],
    'datePublished' => $item['release_date'],
    'aggregateRating' => !empty($item['rating']) ? [
        '@type' => 'AggregateRating',
        'ratingValue' => (float) $item['rating'],
        'bestRating' => 10,
        'ratingCount' => max(1, (int) round((int) $item['views'] / 120)),
    ] : null,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
