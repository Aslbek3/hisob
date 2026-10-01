#!/usr/bin/env bash
# Kunlik zaxira: pg_dump → backups/hisob_YYYY-MM-DD_HHMM.dump, 14 kundan eskisi o'chiriladi.
# cron:  0 3 * * *  /PATH/hisob-sayt/scripts/backup.sh >> /PATH/hisob-sayt/logs/backup.log 2>&1
# Tiklash: pg_restore --clean --no-owner -d "$DATABASE_URL" backups/hisob_....dump
#
# ⚠️ Zaxira shu serverning o'zida turadi — server yo'qolsa, zaxira ham yo'qoladi.
#    Haftada bir marta boshqa joyga (boshqa server / bulut) nusxa olish tavsiya etiladi.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
DB_URL="${DB_URL%%\?*}" # pg_dump Prisma'ning ?schema=... parametrini tushunmaydi

mkdir -p backups logs
FILE="backups/hisob_$(date +%F_%H%M).dump"

pg_dump --format=custom --no-owner "$DB_URL" > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
pg_restore --list "$FILE" > /dev/null # fayl butun va o'qiladimi — tekshiruv

find backups -name 'hisob_*.dump' -mtime +14 -delete
echo "$(date '+%F %T') OK $FILE $(du -h "$FILE" | cut -f1)"
