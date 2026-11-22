<?php
/**
 * Single title page: poster, facts, built-in HTML5/Embed stream player,
 * verified direct downloads, interactive episodes, and related titles.
 *
 * @var array<string,mixed> $item
 * @var array<int,array<string,mixed>> $links
 * @var array<int,array{id:string,label:string,kind:string,url:string,qualities:array<string,string>}> $servers
 * @var array<int,array<string,mixed>> $episodes
 * @var array<string,mixed>|null $activeEpisode
 * @var int $activeEpIndex
 * @var array<int,array<string,mixed>> $related
 * @var array<int,array<string,mixed>> $breadcrumb
 * @var array<string,mixed> $site
 */
$poster = $item['poster'] ?: $site['placeholder'];
$seasons = [];
foreach ($episodes as $idx => $episode) {
    $episode['_idx'] = $idx;
    $seasons[(int) $episode['season']][] = $episode;
}

$primaryServer = $servers[0] ?? [
    'id' => 'server-fast',
    'label' => 'Server 1 · Fast HD',
    'kind' => 'video',
    'url' => '',
    'qualities' => [],
];
$nowPlayingLabel = $item['title'] . ($activeEpisode ? ' · ' . $activeEpisode['code'] : '');
$primaryDlHref = $activeEpisode['dl_href'] ?? ($links[1]['url'] ?? $links[0]['url'] ?? '#downloads');
$primaryDlDirect = $activeEpisode['stream_fast'] ?? ($links[1]['direct_url'] ?? $links[0]['direct_url'] ?? '');
$primaryDlName = $activeEpisode['filename'] ?? ($links[1]['filename'] ?? $links[0]['filename'] ?? 'video.mp4');
$showAdultGate = !empty($item['is_adult']) && empty($_COOKIE['mlbd_adult']);
?>
<?php if ($showAdultGate): ?>
<div class="age-gate" id="ageGate" role="dialog" aria-modal="true" aria-labelledby="ageGateTitle">
  <div class="age-gate-card">
    <h2 id="ageGateTitle">🔞 18+ Adult Content Warning</h2>
    <p>This title is marked for viewers aged 18 and older. Confirm your age to continue.</p>
    <div class="age-gate-actions">
      <button class="btn btn-primary" type="button" id="ageGateAccept">I am 18+ — Continue</button>
      <button class="btn btn-ghost" type="button" id="ageGateLeave">Go Back</button>
    </div>
  </div>
</div>
<?php endif; ?>

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
             onerror="this.onerror=null;this.src='<?= e($site['placeholder']) ?>'">
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
          <?= e($item['synopsis'] ?: $item['title'] . ' — full details, instant HD stream player, verified download mirrors and episode list. Served with zero ads, zero popups and zero redirect loops.') ?>
        </p>

        <div class="hero-actions">
          <a class="btn btn-primary" href="#watch" data-watch-now>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            Watch now
          </a>
          <?php if ($links !== []): ?>
            <a class="btn btn-ghost" href="#downloads">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M12 4v10M7 12l5 5 5-5M5 20h14"/>
              </svg>
              Download
            </a>
          <?php endif; ?>
          <button class="btn btn-ghost" type="button" data-copy="<?= e(($site['url'] ?? '') . '/' . $item['type'] . '/' . $item['slug']) ?>">Copy link</button>
        </div>
      </div>
    </div>
  </article>

  <?php if ($servers !== []): ?>
  <section class="section" id="watch" aria-labelledby="watchHeading">
    <div class="section-head">
      <div>
        <h2 id="watchHeading">🎬 Watch Online</h2>
        <p class="section-sub" id="nowPlayingLabel">Now playing: <?= e($nowPlayingLabel) ?></p>
      </div>
    </div>

    <div class="player-card" id="mlbdPlayer"
         data-title-base="<?= e($item['title']) ?>"
         data-slug="<?= e($item['slug']) ?>"
         data-servers="<?= e((string) json_encode($servers, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) ?>">
      <div class="player-toolbar">
        <div class="player-servers" role="tablist" aria-label="Streaming servers">
          <?php foreach ($servers as $sIdx => $srv): ?>
            <button type="button"
                    class="chip<?= $sIdx === 0 ? ' is-active' : '' ?>"
                    data-server-idx="<?= $sIdx ?>"
                    role="tab"
                    aria-selected="<?= $sIdx === 0 ? 'true' : 'false' ?>">
              ▶ <?= e($srv['label']) ?>
            </button>
          <?php endforeach; ?>
        </div>

        <div class="player-qualities" id="playerQualities" aria-label="Stream quality">
          <?php foreach ($primaryServer['qualities'] as $qLabel => $qUrl): ?>
            <button type="button"
                    class="chip<?= $qLabel === '720p' ? ' is-active' : '' ?>"
                    data-quality="<?= e($qLabel) ?>"
                    data-quality-src="<?= e($qUrl) ?>">
              <?= e($qLabel) ?>
            </button>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="player-stage">
        <video id="mlbdVideo"
               <?= $primaryServer['kind'] === 'video' ? '' : 'class="hidden"' ?>
               controls
               playsinline
               preload="metadata"
               poster="<?= e($poster) ?>"
               src="<?= e($primaryServer['kind'] === 'video' ? $primaryServer['url'] : '') ?>">
          Your browser does not support HTML5 video. Use the download button below.
        </video>
        <iframe id="mlbdFrame"
                <?= $primaryServer['kind'] === 'iframe' ? '' : 'class="hidden"' ?>
                src="<?= e($primaryServer['kind'] === 'iframe' ? $primaryServer['url'] : 'about:blank') ?>"
                title="<?= e($item['title']) ?> player"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
                referrerpolicy="no-referrer"></iframe>
      </div>

      <div class="player-bar">
        <div class="player-ep-nav">
          <?php if ($episodes !== []): ?>
            <button class="btn btn-ghost" type="button" id="prevEpBtn" <?= $activeEpIndex <= 0 ? 'disabled' : '' ?>>⏮ Prev Ep</button>
            <button class="btn btn-ghost" type="button" id="nextEpBtn" <?= $activeEpIndex >= count($episodes) - 1 ? 'disabled' : '' ?>>Next Ep ⏭</button>
          <?php else: ?>
            <span class="muted" style="font-size:12.5px">Tip: double-click video for fullscreen, or switch to Server 2 if slow.</span>
          <?php endif; ?>
        </div>
        <a class="btn btn-primary"
           id="playerDownloadBtn"
           href="<?= e($primaryDlHref) ?>"
           download="<?= e($primaryDlName) ?>"
           data-download-direct="<?= e($primaryDlDirect) ?>"
           data-download-name="<?= e($primaryDlName) ?>">
          ⬇ Download HD (.mp4)
        </a>
      </div>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($episodes !== []): ?>
  <section class="section" id="episodes" aria-labelledby="episodeHeading">
    <div class="section-head">
      <div>
        <h2 id="episodeHeading">📺 Episodes</h2>
        <p class="section-sub">Click any episode to play immediately · <?= count($episodes) ?> episodes across <?= count($seasons) ?> season(s)</p>
      </div>
    </div>
    <div class="stack">
      <?php foreach ($seasons as $season => $list): ?>
        <div class="panel">
          <b>Season <?= (int) $season ?></b>
          <div class="ep-chips mt-2">
            <?php foreach ($list as $episode): ?>
              <?php $epIdx = (int) $episode['_idx']; ?>
              <a class="ep-chip<?= $epIdx === $activeEpIndex ? ' is-active' : '' ?>"
                 href="?ep=<?= e($episode['code']) ?>#watch"
                 data-ep-index="<?= $epIdx ?>"
                 data-ep-code="<?= e($episode['code']) ?>"
                 data-ep-name="<?= e($episode['name'] ?: 'Episode ' . $episode['episode']) ?>"
                 data-stream-fast="<?= e($episode['stream_fast']) ?>"
                 data-stream-hd="<?= e($episode['stream_hd']) ?>"
                 data-stream-cinema="<?= e($episode['stream_cinema']) ?>"
                 data-dl-href="<?= e($episode['dl_href']) ?>"
                 data-dl-name="<?= e($episode['filename']) ?>"
                 title="Play <?= e($episode['code'] . ' — ' . ($episode['name'] ?: 'Episode ' . $episode['episode'])) ?>">
                E<?= str_pad((string) $episode['episode'], 2, '0', STR_PAD_LEFT) ?>
              </a>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($links !== []): ?>
  <section class="section" id="downloads" aria-labelledby="downloadHeading">
    <div class="section-head">
      <div>
        <h2 id="downloadHeading">⬇️ Download links</h2>
        <p class="section-sub">Direct, verified `.mp4` mirrors — one-click save or play, no shorteners, no ad-gate</p>
      </div>
    </div>
    <div class="download-list">
      <?php foreach ($links as $link): ?>
        <div class="download-row">
          <div class="dl-main">
            <b><?= e($link['label']) ?></b>
            <small><?= e(trim(($link['quality'] ?? '') . ' • ' . ($link['size'] ?? ''), ' •')) ?></small>
          </div>
          <div class="dl-actions">
            <?php if (!empty($link['play_url'])): ?>
              <button class="btn btn-ghost" type="button"
                      data-play-src="<?= e($link['play_url']) ?>"
                      data-play-label="<?= e($link['label']) ?>">▶ Play</button>
            <?php endif; ?>
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
