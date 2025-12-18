# 快速开始指南

## 前置要求

1. **Node.js** 18+ 和 npm
2. **Python** 3.9+ 和 pip
3. **Rust** 1.70+ (安装: https://rustup.rs/)
4. **系统依赖**:
   - macOS: Xcode Command Line Tools
   - Linux: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
   - Windows: Microsoft Visual Studio C++ Build Tools

## 安装步骤

### 1. 克隆/进入项目目录

```bash
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
# 激活虚拟环境（如果存在）
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 4. 安装 Tauri CLI（全局，可选）

```bash
npm install -g @tauri-apps/cli
```

## 运行

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

访问 http://localhost:1420

## 构建

### 构建应用

```bash
npm run tauri:build
```

构建产物位于 `tauri/target/release/`。

## 故障排除

### Python 未找到

如果遇到 "Python 未找到" 错误：

1. 确认 Python 已安装：`python3 --version` 或 `python --version`
2. 在 Windows 上，可能需要修改 `tauri/src/main.rs` 中的 `Command::new("python3")` 为 `Command::new("python")`

### 模型文件缺失

确保 `python/models/big-lama/big-lama.pt` 文件存在。如果只有分片文件，程序会自动合并。

### Rust 编译错误

```bash
# 更新 Rust
rustup update

# 清理构建缓存
npm run tauri clean
```

### 权限问题（macOS/Linux）

如果遇到权限问题，确保脚本有执行权限：

```bash
chmod +x python/remove_watermark_cli.py
```

## 下一步

查看 [README-TAURI.md](./README-TAURI.md) 了解详细架构说明。

