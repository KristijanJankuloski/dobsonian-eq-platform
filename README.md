# Dobsonian EQ Platform Calculator

Angular + Angular Material + three.js app that calculates the dimensions of a circular-segment equatorial platform for a Dobsonian telescope from its dimensions and your latitude.

- Live site: https://kristijanjankuloski.github.io/dobsonian-eq-platform/
- Specification: [docs/SPEC.md](docs/SPEC.md)
- Development rules for contributors and agents: [docs/development/angular-development.md](docs/development/angular-development.md)

## What it does

Enter your latitude, the weights and centre-of-gravity heights of the scope and mount, the mount base width and the platform thickness. The app shows the platform dimensions, the north bearing segment (with a marking-out sketch) and the south pivot position, optional worm-drive and direct-drive calculations, and an interactive 3D view. Inputs are saved in the browser and in the page address, so a link shares your numbers. Metric units only.

## Development

```
npm install
npm start                       # dev server on http://localhost:4200
npx ng test --watch=false       # unit tests
npx ng build                    # production build into dist/
```

## Deployment

Pushes to `master` run `.github/workflows/ci.yml`, which tests, builds with the repository name as the base path and deploys to GitHub Pages. Pull requests run the same tests and build without deploying. In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.
