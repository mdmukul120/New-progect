<?php
/**
 * Human-friendly API documentation, generated from the endpoint registry.
 *
 * @var array<string,array<int,array<string,mixed>>> $groups
 * @var int $total
 * @var string $base
 */
$categoryLabels = [
    'core' => '🧩 Core',
    'catalogue' => '🎬 Catalogue',
    'discovery' => '🔎 Discovery',
    'taxonomy' => '🏷 Taxonomy',
    'meta' => '📊 Meta',
];
?>
<div class="shell">
  <div class="listing-head">
    <div>
      <h1>🧩 Public JSON API</h1>
      <p><?= (int) $total ?> endpoints · base <code><?= e($base) ?></code> · rate limit 90 req/min per IP</p>
    </div>
    <a class="section-link" href="/api/index.json">Open index.json →</a>
  </div>

  <div class="panel mt-4">
    <b>Response envelope</b>
    <pre class="mono" style="overflow-x:auto;color:var(--text-2);margin:8px 0 0">{ "ok": true, "data": …, "meta": { "total": 104, "page": 1 } }</pre>
    <p class="muted mt-2 mb-0" style="font-size:12.5px">
      Errors return <code>{ "ok": false, "error": { "code": "not_found", "message": "…" } }</code> with a matching HTTP status.
    </p>
  </div>

  <?php foreach ($groups as $category => $endpoints): ?>
    <section class="section" aria-labelledby="cat-<?= e($category) ?>">
      <div class="section-head">
        <div>
          <h2 id="cat-<?= e($category) ?>"><?= e($categoryLabels[$category] ?? ucfirst($category)) ?></h2>
        </div>
      </div>
      <div class="download-list">
        <?php foreach ($endpoints as $endpoint): ?>
          <div class="download-row" style="grid-template-columns:minmax(0,1fr)">
            <div class="dl-main">
              <b><span class="badge badge-new" style="margin-right:6px"><?= e($endpoint['method']) ?></span>
                 <code><?= e($endpoint['path']) ?></code></b>
              <small><?= e($endpoint['summary']) ?></small>
              <?php if (!empty($endpoint['params'])): ?>
                <small class="mono" style="color:var(--text-3);margin-top:4px">
                  params: <?= e($endpoint['params']) ?>
                </small>
              <?php endif; ?>
            </div>
            <div class="mt-2">
              <a class="btn btn-ghost" href="<?= e($endpoint['sample'] ?: $endpoint['path']) ?>" target="_blank" rel="noopener">Try it</a>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endforeach; ?>
</div>
