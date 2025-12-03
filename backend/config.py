import os
from pathlib import Path


# 当前项目根目录：remote-waterdemo
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# LaMa 模型路径（迁移到当前项目的 backend/models/big-lama）
LAMA_MODEL_PATH = PROJECT_ROOT / "backend" / "models" / "big-lama"


def ensure_lama_merged() -> None:
    """
    如果 big-lama.pt 不存在，但存在 fs_manifest.csv 和 big-lama_x.pt 分片，
    则在本地直接顺序拼接生成 big-lama.pt（无需依赖 fsplit 包）。
    """
    if not LAMA_MODEL_PATH.exists():
        return

    big_lama_pt = LAMA_MODEL_PATH / "big-lama.pt"
    manifest = LAMA_MODEL_PATH / "fs_manifest.csv"

    if big_lama_pt.exists():
        return
    if not manifest.exists():
        return

    # 简单按照清单顺序把文件拼接起来
    with open(manifest, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f.readlines()[1:] if line.strip()]

    part_files: list[Path] = []
    for line in lines:
        # 每行形如：filename,filesize,encoding,header
        name = line.split(",")[0]
        part_path = LAMA_MODEL_PATH / name
        if part_path.exists():
            part_files.append(part_path)

    if not part_files:
        return

    with open(big_lama_pt, "wb") as out_f:
        for p in part_files:
            with open(p, "rb") as in_f:
                while True:
                    chunk = in_f.read(1024 * 1024)
                    if not chunk:
                        break
                    out_f.write(chunk)


# 模块导入时尝试合并一次
ensure_lama_merged()


# 掩膜边缘“扩张”像素，避免框得太紧导致边缘残留
WATERMARK_AREA_DEVIATION_PIXEL = 6
