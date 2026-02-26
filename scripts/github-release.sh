#!/bin/bash

# Extract the new version from package.json
NEW_VERSION=$(node -p "require('./package.json').version")
TAG="v$NEW_VERSION"

echo "Creating GitHub release for $TAG..."

# Extract the latest CHANGELOG entry (everything between the first two version headers)
CHANGELOG_CONTENT=$(awk '/^### \[/ {if (++count == 2) exit} count == 1' CHANGELOG.md)

# Create GitHub release with the CHANGELOG content
gh release create "$TAG" \
	--title "$TAG" \
	--notes "$CHANGELOG_CONTENT" \
	--verify-tag

echo "✓ GitHub release created: $TAG"
