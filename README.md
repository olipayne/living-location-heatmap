# Living Location Heatmap

A private, static GitHub Pages app for exploring where to live in a city from personal amenity preferences.

## What it does

- Starts on Amsterdam, but can geocode and analyse any city/place.
- Pulls public amenity data live from OpenStreetMap Overpass.
- Lets you drag and reorder preference filters such as parks, supermarkets, public transport, healthcare, schools, cafes, sports, and avoiding nightlife.
- Scores map grid cells locally in the browser; no backend or user tracking.
- Renders a heatmap overlay plus amenity markers and best-scoring cells.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm test
npm run build
```

## Deployment

The repository uses GitHub Actions to build the static Vite site and deploy it to GitHub Pages.
