# 2D Hoops (HTML5 Canvas)

A simple 2D basketball shooting game with basic physics, backboard/rim collisions, and scoring.

## Run locally

- Option A: Open `index.html` directly in your browser.
- Option B: Serve via a local server (recommended):

```bash
# Python 3
python3 -m http.server 8000 --directory /workspace/hoops
# then open http://127.0.0.1:8000 in your browser
```

## Controls

- Move: A/D or ←/→
- Jump: W or ↑ or Space
- Shoot: Hold J or K to charge, release to shoot
- Reset: R
- Mute: M or click the speaker button

## Notes

- Scoring: The ball must pass down through the rim window to count.
- Best score is saved to `localStorage`.