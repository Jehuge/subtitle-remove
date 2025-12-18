#!/bin/bash
# Windows 打包脚本
# 此脚本在 macOS 上交叉编译 Windows 可执行文件

set -e

echo "🚀 开始打包 Windows 应用..."

# 检查依赖
if ! command -v x86_64-w64-mingw32-gcc &> /dev/null; then
    echo "❌ 错误: 未找到 x86_64-w64-mingw32-gcc"
    echo "请运行: brew install mingw-w64"
    exit 1
fi

# 构建前端
echo "📦 构建前端..."
cd front
npm run build
cd ..

# 构建 Windows 可执行文件
echo "🔨 构建 Windows 可执行文件..."
npm run tauri:build -- --target x86_64-pc-windows-gnu

# 检查结果
EXE_PATH="tauri/target/x86_64-pc-windows-gnu/release/subtitle-remove.exe"
if [ -f "$EXE_PATH" ]; then
    echo "✅ Windows 可执行文件已生成:"
    echo "   位置: $EXE_PATH"
    echo "   大小: $(du -h "$EXE_PATH" | cut -f1)"
    echo ""
    echo "⚠️  注意: 在 macOS 上无法创建 Windows 安装程序"
    echo "   要创建安装程序，请使用:"
    echo "   1. GitHub Actions (已配置 .github/workflows/build-windows.yml)"
    echo "   2. 在 Windows 系统上运行: npm run tauri:build"
    echo ""
    echo "📝 使用说明:"
    echo "   1. 将 subtitle-remove.exe 复制到 Windows 系统"
    echo "   2. 将 python/ 目录放在与 .exe 相同的目录中"
    echo "   3. 确保 Windows 系统已安装 Python 3"
else
    echo "❌ 构建失败: 可执行文件不存在"
    exit 1
fi

