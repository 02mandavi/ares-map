#!/usr/bin/env bash
# Push the committed A.R.E.S. source to the 'source' branch of 02mandavi/ares-map. The live site stays on 'main' (built dist).
# Uploads only what is committed in the nasa repo (HEAD), limited to the paths below: commit first, then run  bash ares-map/tools/push-source.sh
set -euo pipefail
cd "$(dirname "$0")/../.."                      # nasa/
URL=https://github.com/02mandavi/ares-map.git
PATHS=(ares-map ARES_*.md explainer images)     # HANDOFF.md, thinking/ and .claude/ stay private
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/source-index"
git read-tree --empty
git ls-tree -r HEAD -- "${PATHS[@]}" | git update-index --index-info
tree=$(git write-tree); rm -f "$GIT_INDEX_FILE"
parent=()
if git fetch -q "$URL" source 2>/dev/null; then
  [ "$(git rev-parse FETCH_HEAD^{tree})" = "$tree" ] && { echo "source branch already up to date"; exit 0; }
  parent=(-p FETCH_HEAD)
fi
msg="Source snapshot of nasa $(git rev-parse --short HEAD): $(git log -1 --format=%s)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
c=$(git -c user.name=02mandavi -c user.email=126599851+02mandavi@users.noreply.github.com commit-tree "$tree" "${parent[@]}" -m "$msg")
git push "$URL" "$c:refs/heads/source"
echo "pushed $c to source"
