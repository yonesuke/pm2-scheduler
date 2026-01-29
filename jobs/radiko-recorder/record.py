# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pyradiko @ git+https://github.com/yonesuke/pyradiko.git",
#     "python-dotenv",
#     "mutagen",
# ]
# ///
"""
Radiko録音スクリプト

Usage:
    uv run record.py programs.json
"""

import argparse
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from mutagen.mp4 import MP4
from pyradiko import RadikoRecorder

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def get_last_broadcast_time(weekday: int, start_hour: int, start_minute: int, end_hour: int, end_minute: int) -> tuple[str, str]:
    """直近の放送時間を取得

    Args:
        weekday: 放送曜日 (0=月, 6=日)
        start_hour: 開始時
        start_minute: 開始分
        end_hour: 終了時
        end_minute: 終了分
    """
    now = datetime.now()
    current_weekday = now.weekday()

    days_since = (current_weekday - weekday) % 7
    target_day = now - timedelta(days=days_since)

    start = target_day.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
    end = target_day.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)

    # まだ放送が終了していない場合は前週
    if end > now:
        start -= timedelta(days=7)
        end -= timedelta(days=7)

    return start.strftime("%Y%m%d%H%M"), end.strftime("%Y%m%d%H%M")


def add_metadata(file_path: Path, metadata: dict, broadcast_date: str) -> None:
    """m4aファイルにメタデータを追加"""
    audio = MP4(file_path)

    # 放送日をYYYY-MM-DD形式に変換
    date_str = f"{broadcast_date[:4]}-{broadcast_date[4:6]}-{broadcast_date[6:8]}"

    if "title" in metadata:
        audio["\xa9nam"] = [f"{metadata['title']} ({date_str})"]
    if "artist" in metadata:
        audio["\xa9ART"] = [metadata["artist"]]
    if "album" in metadata:
        audio["\xa9alb"] = [metadata["album"]]
    if "genre" in metadata:
        audio["\xa9gen"] = [metadata["genre"]]

    audio["\xa9day"] = [date_str]

    audio.save()


def record_program(recorder: RadikoRecorder, program: dict) -> None:
    """番組を録音"""
    name = program["name"]
    station = program["station"]

    start_time, end_time = get_last_broadcast_time(
        program["weekday"],
        program["start_hour"],
        program["start_minute"],
        program["end_hour"],
        program["end_minute"],
    )

    output_dir = Path(program["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{name}_{start_time[:8]}.m4a"

    if output_file.exists():
        logger.info(f"[SKIP] {name}: {output_file} already exists")
        return

    logger.info(f"[REC] {name} | {station} | {start_time} - {end_time} | {output_file}")

    res = recorder.record(station, start_time, end_time, str(output_file))

    if res.returncode == 0:
        if "metadata" in program:
            add_metadata(output_file, program["metadata"], start_time[:8])
            logger.info(f"[OK] {name} (metadata added)")
        else:
            logger.info(f"[OK] {name}")
    else:
        logger.error(f"[FAIL] {name} (code: {res.returncode})")


def main():
    parser = argparse.ArgumentParser(description="Radiko録音スクリプト")
    parser.add_argument("config", help="番組設定JSONファイル")
    args = parser.parse_args()

    config_path = Path(args.config)
    with open(config_path) as f:
        config = json.load(f)

    recorder = RadikoRecorder()

    for program in config["programs"]:
        record_program(recorder, program)


if __name__ == "__main__":
    main()
