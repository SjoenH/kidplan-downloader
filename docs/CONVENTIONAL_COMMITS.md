# Handling Non-Conventional Commits

## How It Works

**Good news!** The conventional commits setup handles old non-conventional commits gracefully.

### What Happens with Old Commits

`standard-version` only analyzes commits **since the last git tag**. This means:

- ✅ All commits before v1.1.0 are **ignored**
- ✅ Only new commits (after v1.1.0) need to follow conventional commits format
- ✅ Old commit messages don't need to be changed
- ✅ The CHANGELOG will only include conventional commits going forward

### Example

Current situation:
```
v1.1.0 (tag)
  ↓
19675b8 build: setup conventional commits...  ← conventional ✓
f61923d Bump version to 1.1.0                 ← not conventional (but before tag)
28be476 Fix security vulnerability...         ← not conventional (but before tag)
16c5123 Add dark mode support...              ← not conventional (but before tag)
...
v1.0.3 (tag)
```

When you run `npm run release`:
- It looks at commits from v1.1.0 to HEAD
- Finds: `build: setup conventional commits...` and `fix: resolve standard-version...`
- Generates CHANGELOG with only these commits
- Determines new version based on these commits

### Going Forward

**All new commits must follow conventional commits format**, enforced by the commit-msg hook:

```bash
✅ git commit -m "feat: add new feature"
✅ git commit -m "fix: resolve bug"
❌ git commit -m "Add new feature"  # Will be rejected by hook
```

### If You Need to Bypass the Hook

In rare cases (emergency fixes, etc.), you can bypass with `--no-verify`:

```bash
git commit -m "Emergency fix" --no-verify
```

But this is **not recommended** as it breaks the automatic versioning.

## Testing

You can test the release process safely:

```bash
# Dry run - shows what would happen without making changes
npx standard-version --dry-run

# See what the CHANGELOG would look like
npx standard-version --dry-run 2>&1 | grep -A 50 "CHANGELOG"
```

## Summary

✅ **No problems with old commits** - they're safely ignored
✅ **Fresh start from v1.1.0** - only new commits matter
✅ **Automatic enforcement** - hooks prevent non-conventional commits
✅ **Safe testing** - use --dry-run to preview releases
