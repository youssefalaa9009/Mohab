#!/bin/sh
# Back up the production database and uploaded photos. Run on the VPS from the
# directory holding docker-compose.yml, e.g. nightly from cron:
#
#   15 3 * * * cd /srv/quattro && ./scripts/backup.sh >> backups/backup.log 2>&1
#
# Keeps the last KEEP_DAYS days locally. Copy backups/ off the server too
# (rclone, rsync, object storage) — a backup on the same disk is not a backup.
#
# Restore:
#   docker compose exec -T db pg_restore -U quattro -d quattro --clean --if-exists < backups/db-DATE.dump
#   docker compose run --rm -T --entrypoint sh -v "$PWD/backups:/b" app \
#     -c 'tar xzf /b/uploads-DATE.tgz -C /app/uploads'
set -eu

KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p backups

docker compose exec -T db pg_dump -U quattro -d quattro --format=custom > "backups/db-$STAMP.dump"
docker compose run --rm -T --no-deps --entrypoint sh -v "$PWD/backups:/b" app \
  -c "tar czf /b/uploads-$STAMP.tgz -C /app/uploads ."

find backups -name 'db-*.dump' -mtime "+$KEEP_DAYS" -delete
find backups -name 'uploads-*.tgz' -mtime "+$KEEP_DAYS" -delete
echo "$(date -Iseconds) backup ok: db-$STAMP.dump uploads-$STAMP.tgz"
