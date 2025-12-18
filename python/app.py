import io
from typing import List

import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from PIL import Image, ImageDraw

from . import config
from .lama_inpaint import LamaInpaint


app = FastAPI(title="Image Watermark Remover (LaMa Demo)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


lama = LamaInpaint()


@app.get("/", response_class=HTMLResponse)
async def index():
    # 注意：此文件是旧的 FastAPI 服务，用于 Web 部署
    # Tauri 版本使用 front/ 目录中的 React 前端
    # 如果需要使用此服务，请确保 static/index.html 存在
    try:
        with open("../static/index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>FastAPI 服务已迁移到 Tauri 架构</h1><p>请使用 Tauri 应用或更新 static/index.html 路径</p>",
            status_code=200
        )


@app.post("/api/remove_watermark")
async def remove_watermark(
    file: UploadFile = File(...),
    boxes: str = Form(...),
):
    """
    file: 图片文件
    boxes: JSON 字符串，如 [[x1,y1,x2,y2], ...]，坐标基于前端原始显示尺寸
    """
    import json

    raw_bytes = await file.read()
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    w, h = image.size

    # 解析前端传来的矩形框
    try:
        box_list: List[List[float]] = json.loads(boxes)
    except Exception:
        box_list = []

    # 构造掩膜
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for box in box_list:
        if len(box) != 4:
            continue
        x1, y1, x2, y2 = box
        # 边缘扩张一点，避免残留边缘
        x1 = max(0, int(x1) - config.WATERMARK_AREA_DEVIATION_PIXEL)
        y1 = max(0, int(y1) - config.WATERMARK_AREA_DEVIATION_PIXEL)
        x2 = min(w, int(x2) + config.WATERMARK_AREA_DEVIATION_PIXEL)
        y2 = min(h, int(y2) + config.WATERMARK_AREA_DEVIATION_PIXEL)
        draw.rectangle([x1, y1, x2, y2], fill=255)

    # 优化策略：Smart Crop -> Inpaint -> Paste
    # 1. 获取 Mask 的有效包围盒
    mask_bbox = mask.getbbox()

    if mask_bbox is None:
        final_img = image
    else:
        # 2. 扩大包围盒以获取 Context
        # 扩大一定比例，保证模型能看到足够的背景信息
        x1, y1, x2, y2 = mask_bbox
        bw, bh = x2 - x1, y2 - y1
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

        # 扩展策略：至少保证有一定 context，通常 2 倍左右视野较好
        # 并保证最小有一定的尺寸，以免太小无法推断
        new_bw = max(bw * 2.0, bw + 128)
        new_bh = max(bh * 2.0, bh + 128)

        nx1 = max(0, int(cx - new_bw / 2))
        ny1 = max(0, int(cy - new_bh / 2))
        nx2 = min(w, int(cx + new_bw / 2))
        ny2 = min(h, int(cy + new_bh / 2))

        crop_box = (nx1, ny1, nx2, ny2)

        # 3. Crop & Inpaint (引入 TTA - Test Time Augmentation)
        crop_img = image.crop(crop_box)
        crop_mask = mask.crop(crop_box)

        # TTA 步骤 1: 原始方向推理
        res1 = lama(np.array(crop_img), np.array(crop_mask))

        # TTA 步骤 2: 水平翻转推理 (从另一个角度“看”图片，互补盲区)
        crop_img_flip = crop_img.transpose(Image.FLIP_LEFT_RIGHT)
        crop_mask_flip = crop_mask.transpose(Image.FLIP_LEFT_RIGHT)
        
        res2_flip = lama(np.array(crop_img_flip), np.array(crop_mask_flip))
        # 将翻转后的结果再翻转回来
        res2 = np.array(Image.fromarray(res2_flip).transpose(Image.FLIP_LEFT_RIGHT))

        # 融合两次推理结果 (取平均值，消除随机伪影，提升平滑度)
        final_res = (res1.astype(np.float32) + res2.astype(np.float32)) / 2.0
        final_res = np.clip(final_res, 0, 255).astype(np.uint8)

        crop_result_img = Image.fromarray(final_res)

        # 细节增强：对修复结果进行适度锐化，使其纹理更清晰，接近原图质感
        # UnsharpMask 参数：radius=2, percent=100, threshold=3 是比较通用的轻微锐化参数
        from PIL import ImageFilter
        crop_result_img = crop_result_img.filter(ImageFilter.UnsharpMask(radius=2, percent=100, threshold=3))

        # 4. Paste back
        # 创建一个全图画布，将修复好的局部贴回去
        inpainted_canvas = image.copy()
        inpainted_canvas.paste(crop_result_img, (nx1, ny1))

        # 5. 最终融合：使用羽化的 Mask 进行混合，保证边缘自然且非 Mask 区域无损
        # 减小羽化半径，使边缘过渡更精细，减少“光晕”感
        mask_blur = mask.filter(ImageFilter.GaussianBlur(radius=3))
        final_img = Image.composite(inpainted_canvas, image, mask_blur)

    buf = io.BytesIO()
    final_img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": 'inline; filename="inpainted.png"'},
    )


if __name__ == "__main__":
    import uvicorn
    import sys
    from pathlib import Path
    
    # 添加项目根目录到路径，以便导入模块
    project_root = Path(__file__).parent.parent
    sys.path.insert(0, str(project_root))
    
    # 注意：这是旧的 FastAPI Web 服务
    # 新的 Tauri 架构使用 python/remove_watermark_cli.py
    # 从项目根目录运行时使用：uvicorn python.app:app --host 0.0.0.0 --port 8000
    uvicorn.run("python.app:app", host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    import uvicorn
    import sys
    from pathlib import Path
    
    # 添加项目根目录到路径，以便导入 python 模块
    project_root = Path(__file__).parent.parent
    sys.path.insert(0, str(project_root))
    
    # 注意：这是旧的 FastAPI Web 服务
    # 新的 Tauri 架构使用 python/remove_watermark_cli.py
    uvicorn.run("python.app:app", host="0.0.0.0", port=8000, reload=False)
