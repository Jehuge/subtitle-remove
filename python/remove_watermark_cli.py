#!/usr/bin/env python3
"""
命令行接口：用于从 Tauri 调用去水印功能
接收 JSON 输入，输出 base64 编码的图片
"""
import sys
import json
import base64
import io
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from python.lama_inpaint import LamaInpaint
from python import config
from PIL import Image, ImageDraw, ImageFilter
import numpy as np


def remove_watermark_cli(input_data: str, boxes: list) -> str:
    """
    处理去水印请求
    
    Args:
        input_data: base64 编码的图片数据（可能包含 data:image/...;base64, 前缀）
        boxes: [[x1, y1, x2, y2], ...] 框选区域列表
    
    Returns:
        base64 编码的结果图片（包含 data:image/png;base64, 前缀）
    """
    # 解码 base64 图片
    if ',' in input_data:
        input_data = input_data.split(',')[1]
    
    image_bytes = base64.b64decode(input_data)
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    w, h = image.size
    
    # 构造掩膜
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for box in boxes:
        if len(box) != 4:
            continue
        x1, y1, x2, y2 = box
        # 边缘扩张
        x1 = max(0, int(x1) - config.WATERMARK_AREA_DEVIATION_PIXEL)
        y1 = max(0, int(y1) - config.WATERMARK_AREA_DEVIATION_PIXEL)
        x2 = min(w, int(x2) + config.WATERMARK_AREA_DEVIATION_PIXEL)
        y2 = min(h, int(y2) + config.WATERMARK_AREA_DEVIATION_PIXEL)
        draw.rectangle([x1, y1, x2, y2], fill=255)
    
    # 优化策略：Smart Crop -> Inpaint -> Paste
    mask_bbox = mask.getbbox()
    
    if mask_bbox is None:
        final_img = image
    else:
        # 扩大包围盒以获取 Context
        x1, y1, x2, y2 = mask_bbox
        bw, bh = x2 - x1, y2 - y1
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        
        new_bw = max(bw * 2.0, bw + 128)
        new_bh = max(bh * 2.0, bh + 128)
        
        nx1 = max(0, int(cx - new_bw / 2))
        ny1 = max(0, int(cy - new_bh / 2))
        nx2 = min(w, int(cx + new_bw / 2))
        ny2 = min(h, int(cy + new_bh / 2))
        
        crop_box = (nx1, ny1, nx2, ny2)
        
        # Crop & Inpaint (TTA)
        crop_img = image.crop(crop_box)
        crop_mask = mask.crop(crop_box)
        
        lama = LamaInpaint()
        
        # TTA 步骤 1: 原始方向推理
        res1 = lama(np.array(crop_img), np.array(crop_mask))
        
        # TTA 步骤 2: 水平翻转推理
        crop_img_flip = crop_img.transpose(Image.FLIP_LEFT_RIGHT)
        crop_mask_flip = crop_mask.transpose(Image.FLIP_LEFT_RIGHT)
        
        res2_flip = lama(np.array(crop_img_flip), np.array(crop_mask_flip))
        res2 = np.array(Image.fromarray(res2_flip).transpose(Image.FLIP_LEFT_RIGHT))
        
        # 融合两次推理结果
        final_res = (res1.astype(np.float32) + res2.astype(np.float32)) / 2.0
        final_res = np.clip(final_res, 0, 255).astype(np.uint8)
        
        crop_result_img = Image.fromarray(final_res)
        
        # 细节增强
        crop_result_img = crop_result_img.filter(ImageFilter.UnsharpMask(radius=2, percent=100, threshold=3))
        
        # Paste back
        inpainted_canvas = image.copy()
        inpainted_canvas.paste(crop_result_img, (nx1, ny1))
        
        # 最终融合
        mask_blur = mask.filter(ImageFilter.GaussianBlur(radius=3))
        final_img = Image.composite(inpainted_canvas, image, mask_blur)
    
    # 转换为 base64
    buf = io.BytesIO()
    final_img.save(buf, format='PNG')
    buf.seek(0)
    result_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    return 'data:image/png;base64,' + result_base64


if __name__ == '__main__':
    # 从标准输入读取 JSON
    try:
        input_json = json.loads(sys.stdin.read())
        image_data = input_json['image_data']
        boxes = input_json['boxes']
        
        result = remove_watermark_cli(image_data, boxes)
        print(result)
    except Exception as e:
        print(f'ERROR: {str(e)}', file=sys.stderr)
        sys.exit(1)

