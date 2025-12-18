#!/bin/bash
# 测试 Python 后端是否能正常工作

echo "测试 Python 后端..."
cd "$(dirname "$0")"

# 测试 Python 脚本是否存在
if [ ! -f "python/remove_watermark_cli.py" ]; then
    echo "❌ Python 脚本不存在: python/remove_watermark_cli.py"
    exit 1
fi

echo "✅ Python 脚本存在"

# 测试 Python 是否能导入模块
cd python
python3 -c "
import sys
sys.path.insert(0, '..')
try:
    from python import config
    from python.lama_inpaint import LamaInpaint
    print('✅ Python 模块导入成功')
except Exception as e:
    print(f'❌ Python 模块导入失败: {e}')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo "✅ 后端测试通过！"
else
    echo "❌ 后端测试失败"
    exit 1
fi

