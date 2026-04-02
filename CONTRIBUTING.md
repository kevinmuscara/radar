# Contributing to Radar

Thanks for your interest in contributing.

## Ground Rules

- Be respectful and constructive.
- Keep pull requests focused and small when possible.
- Document behavior changes in README updates when relevant.
- Follow the Code of Conduct in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Build CSS:

```bash
npm run build:css
```

4. Run the app locally:

```bash
node index.js
```

Optional style watcher:

```bash
npm run watch:css
```

## Branch and Commit Guidelines

- Create feature branches from `main`.
- Use descriptive branch names, for example:
  - `feature/add-rss-filtering`
  - `fix/import-validation`
- Write clear commit messages in imperative mood.

## Pull Request Checklist

- Code is formatted and readable.
- New/changed behavior is documented.
- Manual verification steps are included in PR description.
- No secrets or sensitive data are committed.
- UI changes include screenshots when relevant.

## Suggested PR Template

Include:
- What changed
- Why it changed
- How it was tested
- Any migration or compatibility notes

## Reporting Bugs

When opening a bug report, include:
- Environment (OS, Node.js version)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Logs or screenshots (if applicable)

## Feature Requests

For feature requests, include:
- Problem statement
- Proposed solution
- Alternative approaches considered
- School/team workflow impact

## Code Style

- JavaScript style follows existing project conventions.
- Keep functions cohesive and avoid unrelated refactors in the same PR.
- Use meaningful names for routes, settings, and database fields.

## Security Issues

Do not open public issues for sensitive vulnerabilities.
Follow [SECURITY.md](SECURITY.md) for responsible disclosure.
