# Agent instructions

- Product spec: [docs/SPEC.md](docs/SPEC.md). Metric units only.
- Before creating or changing anything in the Angular app, read [docs/development/angular-development.md](docs/development/angular-development.md) and follow it.

## Workflow

- **All changes go through pull requests.** Never commit or push directly to `master`, including docs and one-line fixes.
- Create a branch from an up-to-date `master`, commit there, push it, and open a PR against `master`.
- Keep a PR to one topic. Describe what changed and what was verified (build, tests) in the PR body.
- Do not merge your own PR; the owner merges.
- If a PR has already been merged, do not push more commits to its branch. Branch again from `master` and open a new PR.
