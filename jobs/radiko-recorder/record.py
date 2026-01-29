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

# スクリプトのディレクトリにある.envを読み込む
SCRIPT_DIR = Path(__file__).parent
load_dotenv(SCRIPT_DIR / ".env")

# ログディレクトリ設定
LOG_DIR = SCRIPT_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ログ設定
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# フォーマッタ
formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(funcName)s:%(lineno)d - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# コンソールハンドラ
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# ファイルハンドラ（日付ごとのログファイル）
log_file = LOG_DIR / f"record_{datetime.now().strftime('%Y%m%d')}.log"
file_handler = logging.FileHandler(log_file, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)


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

    logger.debug(f"Processing program: {name}")
    logger.debug(f"Program config: {json.dumps(program, ensure_ascii=False, indent=2)}")

    start_time, end_time = get_last_broadcast_time(
        program["weekday"],
        program["start_hour"],
        program["start_minute"],
        program["end_hour"],
        program["end_minute"],
    )
    logger.debug(f"Calculated broadcast time: {start_time} - {end_time}")

    output_dir = Path(program["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{name}_{start_time[:8]}.m4a"

    if output_file.exists():
        file_size = output_file.stat().st_size / (1024 * 1024)  # MB
        logger.info(f"[SKIP] {name}: {output_file} already exists ({file_size:.1f}MB)")
        return

    logger.info(f"[REC] {name} | {station} | {start_time} - {end_time} | {output_file}")
    logger.debug(f"Starting ffmpeg recording...")

    res = recorder.record(station, start_time, end_time, str(output_file))

    logger.debug(f"ffmpeg return code: {res.returncode}")
    if res.stdout:
        logger.debug(f"ffmpeg stdout: {res.stdout.decode()[:1000]}")

    if res.returncode == 0:
        if output_file.exists():
            file_size = output_file.stat().st_size / (1024 * 1024)  # MB
            logger.debug(f"Output file size: {file_size:.1f}MB")

        if "metadata" in program:
            logger.debug(f"Adding metadata: {program['metadata']}")
            add_metadata(output_file, program["metadata"], start_time[:8])
            logger.info(f"[OK] {name} (metadata added, {file_size:.1f}MB)")
        else:
            logger.info(f"[OK] {name} ({file_size:.1f}MB)")
    else:
        logger.error(f"[FAIL] {name} (code: {res.returncode})")
        if res.stderr:
            stderr_text = res.stderr.decode()
            logger.error(f"stderr: {stderr_text}")
        if res.stdout:
            stdout_text = res.stdout.decode()
            logger.debug(f"stdout: {stdout_text}")


def main():
    logger.info("=" * 60)
    logger.info("Radiko Recorder started")
    logger.debug(f"Python version: {__import__('sys').version}")
    logger.debug(f"Script directory: {SCRIPT_DIR}")
    logger.debug(f"Log file: {log_file}")

    parser = argparse.ArgumentParser(description="Radiko録音スクリプト")
    parser.add_argument("config", help="番組設定JSONファイル")
    args = parser.parse_args()

    config_path = Path(args.config)
    logger.info(f"Loading config: {config_path}")

    with open(config_path) as f:
        config = json.load(f)

    program_count = len(config["programs"])
    logger.info(f"Found {program_count} program(s) to process")
    logger.debug(f"Programs: {[p['name'] for p in config['programs']]}")

    recorder = RadikoRecorder()
    logger.debug("RadikoRecorder initialized")

    for i, program in enumerate(config["programs"], 1):
        logger.info(f"--- Processing {i}/{program_count}: {program['name']} ---")
        try:
            record_program(recorder, program)
        except Exception as e:
            logger.exception(f"Unexpected error recording {program['name']}: {e}")

    logger.info("Radiko Recorder finished")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
