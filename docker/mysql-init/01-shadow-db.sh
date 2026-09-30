#!/bin/sh
# Development only. `prisma migrate dev` replays migrations in a temporary "shadow" database named
# prisma_migrate_shadow_db_<id>, and the app user cannot create databases. Grant it rights on that
# name pattern only, nothing else. Runs once, when the mysql-data volume is first created.
set -eu

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e \
  "GRANT ALL PRIVILEGES ON \`prisma\\_migrate\\_shadow\\_db\\_%\`.* TO '${MYSQL_USER}'@'%';"
