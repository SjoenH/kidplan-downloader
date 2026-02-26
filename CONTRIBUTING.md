# Conventional Commits & Semantic Versioning

This project uses [Conventional Commits](https://www.conventionalcommits.org/) with automatic semantic versioning.

## Commit Message Format

Each commit message consists of a **header**, a **body** (optional), and a **footer** (optional):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of the following:

- **feat**: A new feature (bumps MINOR version)
- **fix**: A bug fix (bumps PATCH version)
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, etc)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or correcting tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Breaking Changes

Add `BREAKING CHANGE:` in the footer or add `!` after the type to bump MAJOR version:

```
feat!: remove support for old API

BREAKING CHANGE: The old API has been completely removed
```

## Making Commits

### Option 1: Interactive (Recommended)

Use commitizen for an interactive prompt:

```bash
npm run commit
```

### Option 2: Manual

Write the commit message following the format:

```bash
git commit -m "feat: add dark mode support"
git commit -m "fix: resolve login button issue"
```

## Hooks

- **commit-msg**: Validates commit message format
- **pre-commit**: Runs type checking and build

## Creating Releases

### Automatic (Recommended)

Let standard-version determine the version based on commits:

```bash
npm run release
```

This will:
1. Analyze commits since last release
2. Determine new version (major/minor/patch)
3. Update version in package.json, Cargo.toml, tauri.conf.json
4. Generate/update CHANGELOG.md
5. Create a git commit and tag
6. **Push to GitHub with tags**
7. **Automatically create a GitHub release with CHANGELOG notes**

All in one command!

### Manual Version Override

Force a specific version bump:

```bash
npm run release:patch  # 1.1.0 -> 1.1.1
npm run release:minor  # 1.1.0 -> 1.2.0
npm run release:major  # 1.1.0 -> 2.0.0
```

### Preview Release (Dry Run)

See what would happen without making any changes:

```bash
npm run release:dry-run
```

## Examples

```bash
# Feature commits (MINOR bump)
git commit -m "feat: add user authentication"
git commit -m "feat(ui): implement dark mode toggle"

# Fix commits (PATCH bump)
git commit -m "fix: resolve memory leak in image loader"
git commit -m "fix(download): handle network timeouts"

# Breaking change (MAJOR bump)
git commit -m "feat!: redesign settings API"

# Other commits (no version bump)
git commit -m "docs: update installation guide"
git commit -m "chore: update dependencies"
git commit -m "style: format code with prettier"
```

## Workflow

1. Make your changes
2. Stage files: `git add .`
3. Commit with conventional format: `npm run commit` (or `git commit -m "type: message"`)
4. Push: `git push`
5. When ready to release: `npm run release` (creates version, CHANGELOG, tag, pushes, and creates GitHub release automatically!)
6. Done! Check GitHub releases page for the new release with CHANGELOG notes
