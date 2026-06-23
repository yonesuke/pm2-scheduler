#!/bin/bash
# mp3ファイルをAAC 64kbps ステレオのm4aに変換するスクリプト
# 変換成功後に元のmp3を削除する
#
# Usage:
#   bash convert_mp3_to_m4a.sh [--dry-run]

RECORDINGS_DIR="$(dirname "$0")/recordings"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[DRY RUN] 実際の変換は行いません"
fi

# ファイル一覧を配列に格納（bash 3.2互換）
files=()
while IFS= read -r f; do
    files+=("$f")
done < <(find "$RECORDINGS_DIR" -name "*.mp3" | sort)

total=${#files[@]}
converted=0
skipped=0
failed=0
i=0

for mp3_file in "${files[@]}"; do
    i=$((i + 1))
    m4a_file="${mp3_file%.mp3}.m4a"

    if [[ -f "$m4a_file" ]]; then
        echo "[$i/$total] [SKIP] $(basename "$m4a_file")"
        skipped=$((skipped + 1))
        continue
    fi

    if $DRY_RUN; then
        echo "[$i/$total] [DRY] $(basename "$mp3_file") → $(basename "$m4a_file")"
        converted=$((converted + 1))
        continue
    fi

    echo -n "[$i/$total] [CONV] $(basename "$mp3_file") → $(basename "$m4a_file") ... "

    tmp_file="${m4a_file%.m4a}.tmp.m4a"
    if ffmpeg -nostdin -hide_banner -loglevel error -i "$mp3_file" \
        -vn -c:a aac -b:a 64k -movflags +faststart \
        -y "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$m4a_file"
        rm "$mp3_file"
        echo "OK"
        converted=$((converted + 1))
    else
        rm -f "$tmp_file"
        echo "FAIL"
        failed=$((failed + 1))
    fi
done

echo ""
echo "=== 結果 ==="
echo "合計: $total"
echo "変換: $converted"
echo "スキップ: $skipped"
echo "失敗: $failed"
