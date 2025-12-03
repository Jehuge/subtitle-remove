## 图片 AI 去水印 Demo（remote-waterdemo）

一个针对**固定位置水印**的轻量级 Demo：前端支持矩形多选圈定水印区域，后端用 LaMa (big-lama) 的 inpaint 能力进行高质量填补，在线返回去水印后的图片。

### 特性

- **多区域选择**：前端任意拖拽多个矩形框，支持实时预览和撤销。
- **LaMa Inpaint**：加载 `backend/models/big-lama` 中的权重，自动合并分片文件。
- **纯 FastAPI**：简单 REST API，可直接嵌入其他系统或部署到云端。

### 项目结构

```
remote-waterdemo/
├── app.py                    # FastAPI 入口
├── backend/
│   ├── config.py             # 模型路径、掩膜膨胀等配置
│   ├── lama_inpaint.py       # 调用 big-lama 进行 inpaint
│   └── models/
│       └── big-lama/         # big-lama.pt 与分片、manifest
├── static/
│   └── index.html            # 简易 Web 前端
├── requirements.txt
└── README.md
```

### 前置条件

- Python 3.11+
- pip / virtualenv
- LaMa big-lama 权重（已附在 `backend/models/big-lama`；若需要重新获取，参考下文）
- 建议 GPU + PyTorch CUDA（CPU 亦可运行，但速度较慢）

### 安装依赖

```bash
cd remote-waterdemo
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 模型权重

仓库已自带 `backend/models/big-lama`，其中包含：

- `big-lama.pt`：完整权重
- `big-lama_*.pt`：LaMa 官方提供的分片
- `fs_manifest.csv`：描述分片顺序，`backend/config.py` 会在分片存在但 `big-lama.pt` 缺失时自动拼接

如需重新下载或更新模型，可前往 [advimman/lama](https://github.com/advimman/lama) 获取最新权重，然后放到 `backend/models/big-lama` 目录即可。

### 启动服务

```bash
python app.py
```

启动后访问 `http://127.0.0.1:8000`，即可看到前端页面，上传图片 -> 框选水印 -> 下载结果。

### API 速览

- `GET /`：返回内置的 `static/index.html`
- `POST /api/remove_watermark`
  - `file`：图片文件
  - `boxes`：JSON 字符串（示例：`[[x1,y1,x2,y2], ...]`），坐标基于图片原尺寸
  - 返回：去水印后的 PNG（二进制流）

### 常见问题

1. **模型太大怎么办？** 可只保留 `big-lama.pt` 并删除分片；也可反向，仅保留分片，程序会在启动时自动合并。
2. **CPU 是否可跑？** 可以，但等待时间会更长，建议使用 GPU 环境。
3. **想集成到已有系统？** 只需复用 `POST /api/remove_watermark` 接口，前端可自定义实现。

