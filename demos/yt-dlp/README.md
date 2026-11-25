# yt-dlp — real demo (actually run)

Repo: https://github.com/yt-dlp/yt-dlp

Installed with pip and verified in this sandbox:

```bash
pip install yt-dlp
yt-dlp --version        # -> 2026.11.23 (see version.txt)
yt-dlp --help           # full help (see help.txt)
yt-dlp --list-extractors | wc -l   # -> 1752 extractors
```

## Commands to try yourself

```bash
# basic download (best video + best audio, merged to mp4)
yt-dlp -f 'bv*+ba/b' --merge-output-format mp4 URL

# audio only
yt-dlp -x --audio-format mp3 URL

# subtitles (Bengali + English, as SRT)
yt-dlp --write-subs --sub-langs bn,en --convert-subs srt URL

# inspect metadata / formats without downloading
yt-dlp --dump-json URL | jq .title
yt-dlp --list-formats URL

# playlist / archive
yt-dlp --download-archive downloaded.txt URL
```

Note: YouTube downloads need internet access to youtube.com, which is
blocked in the build sandbox — so the demo here proves the CLI works
(version + 1752 extractors) rather than downloading a YouTube file.
Run the commands above on your own machine to download.

Watch the video demo: `videos/06_yt-dlp.mp4`
