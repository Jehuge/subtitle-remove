# Tauri 架构重构说明

本项目已重构为使用 **Tauri** 架构，前端使用 **React + TypeScript**，后端使用 **Python**（通过 Tauri Sidecar 调用）。

## 架构说明

### 技术栈

- **前端**: React 18 + TypeScript + Vite
- **桌面框架**: Tauri 2.0
- **后端**: Python 3.9+ (LaMa 模型)
- **构建工具**: Vite + Cargo

### 项目结构

```
subtitle-remove/
├── front/                  # React 前端源码
│   ├── src/
│   │   ├── App.tsx        # 主应用组件
│   │   ├── App.css        # 样式文件
│   │   ├── main.tsx       # 入口文件
│   │   └── index.css      # 全局样式
│   ├── index.html         # HTML 入口
│   ├── package.json       # 前端 Node.js 依赖
│   ├── vite.config.ts     # Vite 配置
│   └── tsconfig.json      # TypeScript 配置
├── tauri/                 # Tauri Rust 后端
│   ├── src/
│   │   └── main.rs        # Rust 主文件（处理 Tauri 命令）
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置文件
├── backend/               # Python 后端
│   ├── remove_watermark_cli.py  # 命令行接口脚本
│   ├── lama_inpaint.py    # LaMa 模型封装
│   ├── config.py          # 配置
│   └── models/            # 模型文件
└── package.json           # 根目录 Node.js 配置（Tauri CLI）
```

## 安装依赖

### 1. 安装 Node.js 依赖

```bash
# 安装根目录依赖（Tauri CLI）
npm install

# 安装前端依赖
cd front
npm install
cd ..
```

### 2. 安装 Python 依赖

```bash
# 使用现有的虚拟环境或创建新的
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 安装 Rust 和 Tauri CLI

```bash
# 安装 Rust (如果未安装)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
npm install -g @tauri-apps/cli
```

## 开发模式

### 启动开发服务器

```bash
npm run tauri:dev
```

这将：
1. 启动 Vite 开发服务器（前端）
2. 编译 Rust 代码
3. 启动 Tauri 应用窗口

### 仅启动前端（用于调试）

```bash
cd front
npm run dev
```

访问 `http://localhost:1420` 查看前端界面（但无法调用后端功能）。

## 构建生产版本

### 构建应用

```bash
npm run tauri:build
```

构建产物位于 `tauri/target/release/` 目录。

### 平台特定说明

- **macOS**: 生成 `.app` 文件和 `.dmg` 安装包
- **Windows**: 生成 `.exe` 安装程序
- **Linux**: 生成 `.AppImage` 或 `.deb` 包

## 工作原理

### 数据流

1. **前端 (React)**: 用户上传图片并框选水印区域
2. **Tauri 命令**: 前端调用 `remove_watermark` 命令，传递 base64 图片和框选数据
3. **Rust 后端**: 接收数据，调用 Python 脚本
4. **Python 后端**: 处理图片，使用 LaMa 模型去除水印
5. **返回结果**: Python 输出 base64 编码的结果图片，通过 Rust 返回给前端
6. **前端显示**: React 组件显示处理后的图片

### 关键文件说明

#### `tauri/src/main.rs`

定义了 Tauri 命令：
- `remove_watermark`: 调用 Python 脚本处理去水印
- `save_file`: 保存文件（当前未使用，使用浏览器下载）

#### `backend/remove_watermark_cli.py`

Python 命令行接口，接收 JSON 输入：
```json
{
  "image_data": "data:image/png;base64,...",
  "boxes": [[x1, y1, x2, y2], ...]
}
```

输出 base64 编码的结果图片。

## 常见问题

### 1. Python 未找到

确保系统已安装 Python 3，并且 `python3` 命令可用。在 Windows 上可能需要使用 `python` 而不是 `python3`。

**解决方案**: 修改 `tauri/src/main.rs` 中的 `Command::new("python3")` 为 `Command::new("python")`。

### 2. 模型文件路径错误

确保 `backend/models/big-lama/` 目录存在且包含模型文件。

### 3. 构建失败

- 检查 Rust 版本：`rustc --version`（需要 1.70+）
- 检查 Node.js 版本：`node --version`（需要 18+）
- 清理构建缓存：`npm run tauri clean`

### 4. 开发时 Python 模块导入错误

确保在开发模式下，Python 可以找到 `backend` 模块。脚本会在运行时将 `backend` 目录添加到 `sys.path`。

## 迁移说明

### 从 FastAPI 版本迁移

原有的 `app.py` 和 `static/index.html` 已保留，但不再使用。新架构使用：

- **前端**: React 组件 (`src/App.tsx`)
- **后端通信**: Tauri 命令 (`tauri/src/main.rs`)
- **Python 处理**: CLI 脚本 (`backend/remove_watermark_cli.py`)

### 优势

1. **体积小**: Tauri 应用体积远小于 Electron
2. **性能强**: Rust 处理系统调用，性能优异
3. **安全性**: 原生系统 API 交互，更安全
4. **跨平台**: 一套代码支持 macOS、Windows、Linux

## 下一步

- [ ] 添加应用图标
- [ ] 优化错误处理
- [ ] 添加进度条显示
- [ ] 支持批量处理
- [ ] 添加设置界面

## 参考资源

- [Tauri 官方文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [Vite 文档](https://vitejs.dev/)

