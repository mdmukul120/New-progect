# HyperFrames — HTML in, MP4 out

Repo: https://github.com/heygen-com/hyperframes (HeyGen, Apache-2.0)

`index.html` is a HyperFrames-style composition (scene + chart block +
kinetic captions). Render it:

```bash
npx skills add heygen-com/hyperframes
npx hyperframes init my-video
cp index.html my-video/
cd my-video
npx hyperframes preview   # live preview in browser
npx hyperframes render    # -> MP4 (needs Node 22+ and FFmpeg)
```

Requirements: Node.js 22+, FFmpeg. Cloud render is also available
(`hyperframes cloud render`).

Watch the video demo: `videos/10_hyperframes.mp4`
