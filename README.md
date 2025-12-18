# AI 图片去水印工具

一个基于 **Tauri** 架构的桌面应用，使用 LaMa (big-lama) 模型进行高质量图片去水印处理。

## 特性

- 🎨 **现代化界面**：基于 React + TypeScript 构建的流畅 UI
- 🚀 **高性能**：Tauri 架构，体积小、启动快、性能强
- 🖼️ **多区域选择**：支持拖拽多个矩形框选择水印区域
- 🤖 **AI 修复**：使用 LaMa 模型进行高质量图片修复
- 💾 **跨平台**：支持 macOS、Windows、Linux

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **桌面框架**：Tauri 2.0
- **后端**：Python 3.9+ (LaMa 模型)
- **构建工具**：Vite + Cargo

## 项目结构

```
subtitle-remove/
├── front/                  # React 前端
│   ├── src/               # React 源码
│   ├── index.html          # HTML 入口
│   ├── package.json        # 前端依赖
│   └── vite.config.ts      # Vite 配置
├── tauri/                  # Tauri Rust 后端
│   ├── src/
│   │   └── main.rs        # Rust 主文件
│   ├── Cargo.toml         # Rust 依赖
│   └── tauri.conf.json    # Tauri 配置
├── python/                 # Python 后端
│   ├── remove_watermark_cli.py  # CLI 接口
│   ├── lama_inpaint.py    # LaMa 模型封装
│   ├── config.py          # 配置
│   └── models/            # 模型文件
│       └── big-lama/      # LaMa 模型权重
├── package.json           # 根目录配置
└── requirements.txt       # Python 依赖
```

## 前置要求

- **Node.js** 18+ 和 npm
- **Python** 3.9+ 和 pip
- **Rust** 1.70+ ([安装指南](https://rustup.rs/))
- **系统依赖**：
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - Windows: Microsoft Visual Studio C++ Build Tools

## 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url>
cd subtitle-remove
```

### 2. 安装 Node.js 依赖

```bash
# 安装根目录依赖（Tauri CLI）
npm install

# 安装前端依赖
cd front && npm install && cd ..
```

### 3. 安装 Python 依赖

```bash
# 创建虚拟环境（如果还没有）
python -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 4. 安装 Rust（如果未安装）

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 使用方法

### 开发模式

```bash
npm run tauri:dev
```

这将启动开发服务器并打开 Tauri 应用窗口。

### 仅前端开发（用于 UI 调试）

```bash
cd front
npm run dev
```

访问 `http://localhost:1420` 查看前端界面（但无法调用后端功能）。

### 构建应用

```bash
npm run tauri:build
```

构建产物位于 `tauri/target/release/` 目录。

## 模型文件

项目已包含 LaMa 模型文件在 `python/models/big-lama/` 目录中：

- `big-lama.pt`：完整模型权重
- `big-lama_*.pt`：分片文件（如果完整文件不存在，会自动合并）
- `fs_manifest.csv`：分片清单文件

如需重新下载模型，可前往 [advimman/lama](https://github.com/advimman/lama) 获取最新权重。

## 工作原理

1. **前端 (React)**：用户上传图片并框选水印区域
2. **Tauri 命令**：前端调用 `remove_watermark` 命令，传递图片和框选数据
3. **Rust 后端**：接收数据，调用 Python 脚本
4. **Python 后端**：使用 LaMa 模型处理图片，去除水印
5. **返回结果**：处理后的图片通过 Rust 返回给前端显示

## 常见问题

### Python 未找到

确保系统已安装 Python 3，并且 `python3` 命令可用。在 Windows 上可能需要使用 `python` 而不是 `python3`。

**解决方案**：修改 `tauri/src/main.rs` 中的 `Command::new("python3")` 为 `Command::new("python")`。

### 模型文件缺失

确保 `python/models/big-lama/big-lama.pt` 文件存在。如果只有分片文件，程序会在首次运行时自动合并。

### Rust 编译错误

```bash
# 更新 Rust
rustup update

# 清理构建缓存
cd tauri
cargo clean
cd ..
```

### 权限问题（macOS/Linux）

如果遇到权限问题，确保脚本有执行权限：

```bash
chmod +x python/remove_watermark_cli.py
```

### 构建失败

- 检查 Rust 版本：`rustc --version`（需要 1.70+）
- 检查 Node.js 版本：`node --version`（需要 18+）
- 清理构建缓存：`npm run tauri clean`

## 开发

### 项目结构说明

- `front/`：React 前端代码，使用 Vite 构建
- `tauri/`：Tauri Rust 后端，处理系统调用和 Python 脚本执行
- `python/`：Python 后端，包含 LaMa 模型和图片处理逻辑

### 修改代码

- **前端**：修改 `front/src/` 中的 React 组件
- **Rust 后端**：修改 `tauri/src/main.rs` 中的命令处理
- **Python 后端**：修改 `python/` 中的处理逻辑

## 许可证

[添加你的许可证]

## 贡献

欢迎提交 Issue 和 Pull Request！
