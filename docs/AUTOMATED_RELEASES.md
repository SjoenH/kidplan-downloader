# Automated Release Workflow with GitHub Integration

## Overview

Yes! **CHANGELOG will be automatically added to GitHub releases**. The entire workflow is now fully automated.

## What Happens When You Run `npm run release`

1. ✅ **Analyzes commits** since last tag (v1.1.0)
2. ✅ **Determines version bump** based on commit types
3. ✅ **Updates versions** in:
   - package.json
   - src-tauri/Cargo.toml
   - src-tauri/tauri.conf.json
4. ✅ **Generates CHANGELOG.md** with all conventional commits
5. ✅ **Creates git commit** with version changes
6. ✅ **Creates git tag** (e.g., v1.2.0)
7. ✅ **Pushes to GitHub** with tags
8. ✅ **Creates GitHub release** with CHANGELOG notes automatically!

## Complete Workflow

### Daily Development

```bash
# 1. Make your changes
# 2. Stage and commit
git add .
npm run commit  # Interactive conventional commits helper

# 3. Push
git push
```

### Creating a Release

```bash
# Just run this one command - it does everything!
npm run release
```

That's it! The release will appear on GitHub with the CHANGELOG automatically.

### Manual Version Control

```bash
npm run release:patch  # Bug fixes (1.1.0 → 1.1.1)
npm run release:minor  # New features (1.1.0 → 1.2.0)
npm run release:major  # Breaking changes (1.1.0 → 2.0.0)
```

### Preview Before Release

```bash
npm run release:dry-run  # See what would happen
```

## Example Release Output

When you run `npm run release`, you'll see:

```
✔ bumping version in package.json from 1.1.0 to 1.2.0
✔ bumping version in src-tauri/Cargo.toml from 1.1.0 to 1.2.0
✔ bumping version in src-tauri/tauri.conf.json from 1.1.0 to 1.2.0
✔ created CHANGELOG.md
✔ outputting changes to CHANGELOG.md
✔ committing package.json and src-tauri files and CHANGELOG.md
✔ tagging release v1.2.0
✔ pushing to origin with tags
Creating GitHub release for v1.2.0...
✓ GitHub release created: v1.2.0
```

## CHANGELOG Format in GitHub Releases

The GitHub release will automatically include nicely formatted notes like:

```markdown
### Features

* add dark mode support ([abc1234](https://github.com/...))
* add user authentication ([def5678](https://github.com/...))

### Bug Fixes

* resolve login button issue ([ghi9012](https://github.com/...))

### Build System

* update dependencies ([jkl3456](https://github.com/...))
```

## Benefits

✅ **Fully automated** - One command does everything
✅ **Consistent releases** - No manual mistakes
✅ **Professional CHANGELOG** - Automatically generated and formatted
✅ **GitHub integration** - Releases appear immediately on GitHub
✅ **Semantic versioning** - Automatic based on commit types
✅ **Commit links** - Every change links to its commit

## What About Old Commits?

No problem! The system only looks at commits since the last tag (v1.1.0), so all old non-conventional commits are safely ignored.

## Safety Features

- **Dry run**: Preview changes without committing
- **Commit hooks**: Validate commits before they're made
- **Build verification**: Pre-commit hook runs TypeScript build

## Files Involved

- `.versionrc.json` - Configuration for standard-version
- `scripts/github-release.sh` - Script to create GitHub releases
- `scripts/cargo-version-updater.cjs` - Updates Cargo.toml version
- `CHANGELOG.md` - Automatically generated and updated
- `CONTRIBUTING.md` - Usage guide for developers

## Summary

**Yes, CHANGELOG is automatically added to GitHub releases!** 🎉

Just run `npm run release` and everything happens automatically:
- Version bumping
- CHANGELOG generation
- Git commit and tag
- Push to GitHub
- GitHub release creation with CHANGELOG notes

It's a complete, hands-off release workflow!
