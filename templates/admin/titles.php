<?php
/**
 * @var array<string,mixed> $result
 * @var string $q
 * @var string $csrf
 */
?>
<div class="topbar">
  <div>
    <h1>Titles</h1>
    <p><?= (int) $result['total'] ?> records · page <?= (int) $result['page'] ?> of <?= (int) $result['pages'] ?></p>
  </div>
  <form method="get" action="/admin/titles" style="display:flex;gap:8px">
    <input type="search" name="q" value="<?= e($q) ?>" placeholder="Search titles…" style="min-width:220px">
    <button class="btn btn-ghost btn-sm" type="submit">Search</button>
  </form>
</div>

<?php if (isset($_GET['saved'])): ?><div class="flash flash-ok">Title saved.</div><?php endif; ?>
<?php if (isset($_GET['deleted'])): ?><div class="flash flash-ok">Title deleted.</div><?php endif; ?>
<?php if (isset($_GET['csrf'])): ?><div class="flash flash-err">Security token expired — nothing was changed. Please retry.</div><?php endif; ?>

<section class="panel">
  <header><h2>Add / edit a title</h2></header>
  <div class="panel-body">
    <form method="post" action="/admin/titles/save" class="form-grid">
      <input type="hidden" name="_token" value="<?= e($csrf) ?>">
      <label>ID (blank = create new)<input type="number" name="id" placeholder="new"></label>
      <label>Title<input type="text" name="title" required></label>
      <label>Slug (auto)<input type="text" name="slug" placeholder="auto-from-title"></label>
      <label>Type
        <select name="type">
          <option value="movie">Movie</option>
          <option value="series">Series</option>
          <option value="anime">Anime</option>
          <option value="drama">Drama</option>
          <option value="animation">Animation</option>
        </select>
      </label>
      <label>Year<input type="number" name="year" min="1900" max="2100"></label>
      <label>Quality<input type="text" name="quality" placeholder="WEB-DL / HDTC / 1080p"></label>
      <label>Language<input type="text" name="language" placeholder="Hindi"></label>
      <label>Rating (0-10)<input type="text" name="rating" placeholder="7.4"></label>
      <label>Status
        <select name="status">
          <option value="completed">Completed</option>
          <option value="ongoing">Ongoing</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </label>
      <label>Episode label<input type="text" name="ep_label" placeholder="S05 | Ep 1-9 Added"></label>
      <label>Episode state
        <select name="ep_state">
          <option value="">—</option>
          <option value="added">Added</option>
          <option value="completed">Completed</option>
          <option value="part">Part</option>
        </select>
      </label>
      <label class="span-2">Poster URL<input type="url" name="poster" placeholder="https://…"></label>
      <label class="span-2">Video / Stream / Download URL (optional MP4, YouTube, Drive)<input type="url" name="video_url" placeholder="https://…/movie.mp4 or YouTube / Google Drive link"></label>
      <label class="span-2">Genres (comma separated slugs)<input type="text" name="genres" placeholder="action,thriller"></label>
      <label class="span-2">Synopsis<textarea name="synopsis" rows="3"></textarea></label>
      <div class="check"><input type="checkbox" name="is_adult" value="1" id="c_adult"><label for="c_adult">18+ content</label></div>
      <div class="check"><input type="checkbox" name="is_new" value="1" id="c_new"><label for="c_new">Mark as new</label></div>
      <div class="check"><input type="checkbox" name="is_pinned" value="1" id="c_pin"><label for="c_pin">Pin on homepage</label></div>
      <div style="grid-column:1/-1"><button class="btn" type="submit">Save title</button></div>
    </form>
  </div>
</section>

<section class="panel">
  <header><h2>All titles</h2></header>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>ID</th><th>Title</th><th>Type</th><th>Lang</th><th>Views</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
      <?php foreach ($result['items'] as $row): ?>
        <tr>
          <td class="mono"><?= (int) $row['id'] ?></td>
          <td><a href="/<?= e($row['type']) ?>/<?= e($row['slug']) ?>" target="_blank" rel="noopener"><?= e($row['title']) ?></a></td>
          <td><span class="pill"><?= e($row['type']) ?></span></td>
          <td><?= e($row['language'] ?: '—') ?></td>
          <td><?= e(format_views((int) $row['views'])) ?></td>
          <td><?= e($row['status']) ?></td>
          <td>
            <form method="post" action="/admin/titles/delete" onsubmit="return confirm('Delete this title?');">
              <input type="hidden" name="_token" value="<?= e($csrf) ?>">
              <input type="hidden" name="id" value="<?= (int) $row['id'] ?>">
              <button class="btn btn-danger btn-sm" type="submit">Delete</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php if ((int) $result['pages'] > 1): ?>
    <div class="panel-body" style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <?php $adminBase = '/admin/titles?' . ($q !== '' ? 'q=' . rawurlencode($q) . '&' : '') . 'page='; ?>
      <span>Page <?= (int) $result['page'] ?> of <?= (int) $result['pages'] ?></span>
      <div style="display:flex;gap:8px">
        <?php if ((int) $result['page'] > 1): ?>
          <a class="btn btn-ghost btn-sm" href="<?= e($adminBase . ((int) $result['page'] - 1)) ?>">← Prev</a>
        <?php endif; ?>
        <?php if ((int) $result['page'] < (int) $result['pages']): ?>
          <a class="btn btn-ghost btn-sm" href="<?= e($adminBase . ((int) $result['page'] + 1)) ?>">Next →</a>
        <?php endif; ?>
      </div>
    </div>
  <?php endif; ?>
</section>
