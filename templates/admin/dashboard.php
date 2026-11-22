<?php
/**
 * @var array<string,int> $stats
 * @var array<int,array<string,mixed>> $byType
 * @var array<int,array<string,mixed>> $topEndpoints
 * @var array<int,array<string,mixed>> $recentTitles
 */
?>
<div class="topbar">
  <div>
    <h1>Dashboard</h1>
    <p>Live snapshot of the catalogue and API traffic</p>
  </div>
  <div style="display:flex;gap:8px">
    <a class="btn btn-ghost btn-sm" href="/api/index.json" target="_blank" rel="noopener">API index</a>
    <a class="btn btn-sm" href="/admin/titles">Manage titles</a>
  </div>
</div>

<div class="cards">
  <div class="stat"><b><?= number_format($stats['titles']) ?></b><span>Titles</span></div>
  <div class="stat"><b><?= e(format_views($stats['views'])) ?></b><span>Total views</span></div>
  <div class="stat"><b><?= number_format($stats['episodes']) ?></b><span>Episodes</span></div>
  <div class="stat"><b><?= number_format($stats['endpoints']) ?></b><span>API endpoints</span></div>
  <div class="stat"><b><?= number_format($stats['requests_24h']) ?></b><span>API calls / 24h</span></div>
  <div class="stat"><b><?= number_format($stats['avg_ms']) ?> ms</b><span>Avg response</span></div>
</div>

<div style="display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
  <section class="panel">
    <header><h2>Catalogue by type</h2></header>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Type</th><th>Titles</th></tr></thead>
        <tbody>
        <?php foreach ($byType as $row): ?>
          <tr><td><span class="pill"><?= e($row['type']) ?></span></td><td><?= (int) $row['total'] ?></td></tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <header><h2>Busiest endpoints (24h)</h2></header>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Path</th><th>Hits</th><th>Avg</th></tr></thead>
        <tbody>
        <?php if ($topEndpoints === []): ?>
          <tr><td colspan="3" class="muted">No API traffic recorded yet.</td></tr>
        <?php endif; ?>
        <?php foreach ($topEndpoints as $row): ?>
          <tr>
            <td class="mono"><?= e($row['path']) ?></td>
            <td><?= (int) $row['hits'] ?></td>
            <td><?= (int) $row['avg_ms'] ?> ms</td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>
</div>

<section class="panel">
  <header>
    <h2>Recently updated titles</h2>
    <a class="btn btn-ghost btn-sm" href="/admin/titles">All titles</a>
  </header>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Title</th><th>Type</th><th>Views</th><th>Updated</th></tr></thead>
      <tbody>
      <?php foreach ($recentTitles as $row): ?>
        <tr>
          <td><a href="/<?= e($row['type']) ?>/<?= e($row['slug']) ?>" target="_blank" rel="noopener"><?= e($row['title']) ?></a></td>
          <td><span class="pill"><?= e($row['type']) ?></span></td>
          <td><?= e(format_views((int) $row['views'])) ?></td>
          <td class="muted"><?= e(time_ago((string) $row['updated_at'])) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
