#!/usr/bin/env python3
"""
图片格式转换和压缩 CLI 工具
接收 JSON 输入，输出 base64 编码的转换后图片
"""

import sys
import json
import base64
from io import BytesIO
from PIL import Image

def convert_image_cli(input_data: str, target_format: str, quality: int = None, compression_level: int = None, quantize: bool = False) -> str:
    """
    转换图片格式并压缩
    
    Args:
        input_data: base64 编码的图片数据（包含 data:image/...;base64, 前缀）
        target_format: 目标格式 ('jpg', 'png', 'webp')
        quality: 质量参数（用于 JPG 和 WebP，1-100）
        compression_level: 压缩级别（用于 PNG，0-9）
    
    Returns:
        base64 编码的转换后图片数据（包含 data:image/...;base64, 前缀）
    """
    try:
        # 解析 base64 数据
        if ',' in input_data:
            header, data = input_data.split(',', 1)
        else:
            data = input_data
            header = 'data:image/png;base64'
        
        # 解码 base64
        image_bytes = base64.b64decode(data)
        
        # 打开图片
        image = Image.open(BytesIO(image_bytes))
        original_mode = image.mode
        
        # 如果是 RGBA 模式且目标格式是 JPG，需要转换为 RGB
        if target_format.lower() == 'jpg' or target_format.lower() == 'jpeg':
            if image.mode in ('RGBA', 'LA', 'P'):
                # 创建白色背景
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = rgb_image
            elif image.mode != 'RGB':
                image = image.convert('RGB')
        
        # 准备输出
        output = BytesIO()
        
        # 根据格式保存
        if target_format.lower() == 'jpg' or target_format.lower() == 'jpeg':
            quality = quality if quality is not None else 85
            image.save(output, format='JPEG', quality=quality, optimize=True)
            mime_type = 'image/jpeg'
        elif target_format.lower() == 'png':
            compression_level = compression_level if compression_level is not None else 9
            # 对于 PNG，优化压缩策略
            # 如果原图是 RGB 模式（如 JPG），保持 RGB 模式可以减小文件大小
            # 如果原图有透明通道，保持 RGBA 模式
            if image.mode == 'RGBA' or original_mode in ('RGBA', 'LA', 'P'):
                # 保持 RGBA 模式
                pass
            else:
                # RGB 模式，确保是 RGB 格式（不是 RGBA）
                if image.mode != 'RGB':
                    image = image.convert('RGB')
            
            # 如果启用颜色量化，可以减少颜色数量以减小文件大小
            if quantize and image.mode == 'RGB':
                # 转换为调色板模式（最多 256 色），可以显著减小文件大小
                # 使用高质量量化算法
                image = image.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
                # 保持调色板模式（P 模式）可以进一步减小 PNG 文件大小
            
            # 使用最高压缩级别和优化选项
            # compress_level: 0-9, 9 是最小文件大小
            # optimize: 启用额外的优化
            image.save(output, format='PNG', compress_level=compression_level, optimize=True)
            mime_type = 'image/png'
        elif target_format.lower() == 'webp':
            quality = quality if quality is not None else 85
            image.save(output, format='WEBP', quality=quality, method=6)
            mime_type = 'image/webp'
        else:
            raise ValueError(f"不支持的格式: {target_format}")
        
        # 编码为 base64
        output_bytes = output.getvalue()
        base64_output = base64.b64encode(output_bytes).decode('utf-8')
        
        # 返回带前缀的 base64 数据
        return f"data:{mime_type};base64,{base64_output}"
    
    except Exception as e:
        raise Exception(f"图片转换失败: {str(e)}")


def main():
    """主函数：从 stdin 读取 JSON，处理并输出结果"""
    try:
        # 从 stdin 读取 JSON 输入
        input_json_str = sys.stdin.read()
        input_data = json.loads(input_json_str)
        
        # 提取参数
        image_data = input_data.get('image_data', '')
        target_format = input_data.get('target_format', 'jpg')
        quality = input_data.get('quality')
        compression_level = input_data.get('compression_level')
        quantize = input_data.get('quantize', False)
        
        if not image_data:
            raise ValueError("缺少 image_data 参数")
        
        # 执行转换
        result = convert_image_cli(
            image_data,
            target_format,
            quality=quality,
            compression_level=compression_level,
            quantize=quantize
        )
        
        # 输出结果
        print(result)
        sys.stdout.flush()
    
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

