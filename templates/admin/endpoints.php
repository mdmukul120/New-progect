<?php
/**
 * @var array<string,array<int,array<string,mixed>>> $groups
 * @var int $total
 */
?>
<div class="topbar">
  <div>
    <h1>API endpoints</h1>
    <p><?= (int) $total ?> registered endpoints (source of truth: <code>database/seed.php</code>)</p>
  </div>
  <a class="btn btn-ghost btn-sm" href="/api" target="_blank" rel="noopener">Open public docs</a>
</div>

<?php foreach ($groups as $category => $endpoints): ?>
  <section class="panel">
    <header><h2><?= e(ucfirst($category)) ?></h2><span class="pill"><?= count($endpoints) ?></span></header>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Method</th><th>Path</th><th>Summary</th><th>Params</th></tr></thead>
        <tbody>
        <?php foreach ($endpoints as $endpoint): ?>
          <tr>
            <td><span class="pill pill-get"><?= e($endpoint['method']) ?></span></td>
            <td class="mono"><a href="<?= e($endpoint['path']) ?>" target="_blank" rel="noopener"><?= e($endpoint['path']) ?></a></td>
            <td><?= e($endpoint['summary']) ?></td>
            <td class="mono muted"><?= e($endpoint['params'] ?: '—') ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>
<?php endforeach; ?>
