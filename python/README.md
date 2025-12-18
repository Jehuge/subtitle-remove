# Python 后端

此目录包含 Python 后端代码，用于图片去水印处理。

## 文件说明

- `lama_inpaint.py` - LaMa 模型封装，提供图片修复功能
- `config.py` - 配置文件，包含模型路径等设置
- `remove_watermark_cli.py` - **命令行接口**，用于 Tauri 应用调用
- `app.py` - **旧的 FastAPI Web 服务**（已迁移到 Tauri 架构，保留作为备用）

## 使用方式

### Tauri 应用（推荐）

Tauri 应用通过 `remove_watermark_cli.py` 调用 Python 后端：

```bash
# 通过 Tauri 应用使用
npm run tauri:dev
```

### FastAPI Web 服务（备用）

如果需要运行独立的 Web 服务：

```bash
# 从项目根目录运行
python python/app.py
```

访问 `http://localhost:8000` 查看 Web 界面。

**注意**：FastAPI 版本需要 `static/index.html` 文件存在。

## 模型文件

模型文件位于 `models/big-lama/` 目录中。

