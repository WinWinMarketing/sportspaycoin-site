# SportsPayCoin

Marketing site for SportsPayCoin (SPC), a Solana-based payment token for sports.

## Pages
- `index.html`: Home (live SOL chart, stats, tokenomics teaser)
- `tokenomics.html`: Full tokenomics breakdown
- `whitepaper.html`: Whitepaper

## Stack
Static site, pure HTML / CSS / JS. No build step.

- Live SOL price + 24h chart pulled from the public CoinGecko API (no key, CORS-enabled)
- 3D coin rendered with Three.js (CDN via importmap)
- Animated stats and donut chart hand-rolled in `script.js`

## Run locally
Open `index.html` in a browser, or serve the folder with any static server:

```
python -m http.server 8000
```

## Deploy
Hosted on GitHub Pages from the `main` branch root.
