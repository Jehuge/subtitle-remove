# Windows 打包说明

## 当前状态

✅ Windows 可执行文件已成功编译：
- 位置：`tauri/target/x86_64-pc-windows-gnu/release/subtitle-remove.exe`
- 大小：18MB
- 架构：x86_64 (64位)

⚠️ 在 macOS 上无法创建 Windows 安装程序（需要 NSIS/WiX，只能在 Windows 上运行）

## 方案一：使用 GitHub Actions（推荐）

已创建 GitHub Actions workflow，可以在 Windows 环境中自动构建：

1. 推送代码到 GitHub
2. 在 GitHub 仓库的 Actions 标签页中运行 "Build Windows" workflow
3. 构建完成后下载安装包（.msi 或 .exe）

Workflow 文件：`.github/workflows/build-windows.yml`

## 方案二：在 Windows 系统上构建

如果您有 Windows 系统，可以直接在 Windows 上构建：

```bash
# 1. 安装 Node.js 和 Rust
# 2. 安装 Tauri CLI
npm install -g @tauri-apps/cli

# 3. 安装依赖
npm install
cd front && npm install && cd ..

# 4. 构建
npm run tauri:build
```

## 方案三：使用当前生成的可执行文件

当前已生成的可执行文件可以直接使用，但需要手动包含资源文件：

1. 将 `subtitle-remove.exe` 复制到 Windows 系统
2. 将 `python/` 目录放在与 `subtitle-remove.exe` 相同的目录中
3. 确保 Windows 系统已安装 Python 3

## 注意事项

- 可执行文件需要与 `python/` 目录在同一目录下
- Windows 系统需要安装 Python 3
- 模型文件（393MB）需要包含在 `python/models/big-lama/` 目录中

