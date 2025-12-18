import { useState, useRef, useEffect } from 'react';
import './App.css';
import { invoke } from '@tauri-apps/api/core';

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [history, setHistory] = useState<Box[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [tempBox, setTempBox] = useState<Box | null>(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState(-1);
  const [zoom, setZoom] = useState(1.0);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [compareMode, setCompareMode] = useState(false);

  // 绘制图片和框
  const drawImageAndBoxes = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = originalImage.width;
    canvas.height = originalImage.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);

    // 绘制已确认的框
    ctx.lineWidth = 2;
    boxes.forEach((box, index) => {
      const isSelected = index === selectedBoxIndex;
      ctx.strokeStyle = isSelected ? 'rgba(34, 197, 94, 0.95)' : 'rgba(56, 189, 248, 0.95)';
      ctx.fillStyle = isSelected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.16)';
      const { x1, y1, x2, y2 } = box;
      const w = x2 - x1;
      const h = y2 - y1;
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, w, h);

      // 绘制编号
      ctx.fillStyle = isSelected ? '#22c55e' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(x1 + 9, y1 + 9, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1120';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), x1 + 9, y1 + 9);
    });

    // 绘制临时框
    if (tempBox) {
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
      ctx.fillStyle = 'rgba(248, 250, 252, 0.12)';
      const { x1, y1, x2, y2 } = tempBox;
      const w = x2 - x1;
      const h = y2 - y1;
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, w, h);
    }
  };

  useEffect(() => {
    drawImageAndBoxes();
  }, [originalImage, boxes, tempBox, selectedBoxIndex]);

  // 保存历史记录
  const saveHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...boxes]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 撤销
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setBoxes([...history[newIndex]]);
      showToast('已撤销', 'success');
    }
  };

  // 重做
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setBoxes([...history[newIndex]]);
      showToast('已重做', 'success');
    }
  };

  // 显示提示
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatus(message);
    setStatusType(type === 'error' ? 'error' : type === 'success' ? 'success' : '');
    setTimeout(() => {
      setStatus('');
      setStatusType('');
    }, 3000);
  };

  // 加载图片
  const handleFileSelect = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            setOriginalImage(img);
            setImageFile(file);
            setBoxes([]);
            setHistory([[]]);
            setHistoryIndex(0);
            setTempBox(null);
            setSelectedBoxIndex(-1);
            setZoom(1.0);
            setResultImageUrl(null);
            showToast('图片加载成功', 'success');
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } catch (error) {
      console.error('Error selecting file:', error);
      showToast('文件选择失败', 'error');
    }
  };

  // 处理鼠标事件
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!originalImage) return;
    setSelectedBoxIndex(-1);

    const coords = getCanvasCoords(e);
    
    // 检查是否点击在已有框内
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      if (coords.x >= box.x1 && coords.x <= box.x2 && 
          coords.y >= box.y1 && coords.y <= box.y2) {
        setSelectedBoxIndex(i);
        drawImageAndBoxes();
        return;
      }
    }

    setIsDrawing(true);
    setStartPos(coords);
    setTempBox({ ...coords, x2: coords.x, y2: coords.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!originalImage) return;

    const coords = getCanvasCoords(e);

    if (!isDrawing) {
      // 更新鼠标样式
      const canvas = canvasRef.current;
      if (canvas) {
        let overBox = false;
        for (const box of boxes) {
          if (coords.x >= box.x1 && coords.x <= box.x2 && 
              coords.y >= box.y1 && coords.y <= box.y2) {
            overBox = true;
            break;
          }
        }
        canvas.style.cursor = overBox ? 'pointer' : 'crosshair';
      }
      return;
    }

    setTempBox({
      x1: Math.min(startPos.x, coords.x),
      y1: Math.min(startPos.y, coords.y),
      x2: Math.max(startPos.x, coords.x),
      y2: Math.max(startPos.y, coords.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !tempBox) return;
    setIsDrawing(false);

    const { x1, y1, x2, y2 } = tempBox;
    if (Math.abs(x2 - x1) > 4 && Math.abs(y2 - y1) > 4) {
      const newBoxes = [...boxes, { x1, y1, x2, y2 }];
      setBoxes(newBoxes);
      saveHistory();
      showToast(`已添加区域 ${newBoxes.length}`, 'success');
    } else {
      showToast('矩形太小，已自动忽略', 'error');
    }
    setTempBox(null);
    setSelectedBoxIndex(-1);
  };

  // 处理去水印
  const handleRemoveWatermark = async () => {
    if (!imageFile || boxes.length === 0) {
      showToast('请先上传图片并框选水印区域', 'error');
      return;
    }

    setIsProcessing(true);
    setStatus('正在调用 AI 去水印，这可能需要几秒钟...');

    try {
      // 读取图片文件为 base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          
          // 调用 Tauri 命令，通过 Sidecar 启动 Python 后端
          const result = await invoke<string>('remove_watermark', {
            imageData: base64,
            boxes: boxes.map(b => [b.x1, b.y1, b.x2, b.y2]),
          });

          // result 是 base64 编码的图片
          setResultImageUrl(result);
          showToast('去水印完成！', 'success');
          setIsProcessing(false);
        } catch (error) {
          console.error('Error removing watermark:', error);
          showToast('处理失败：' + (error as Error).message, 'error');
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        showToast('读取图片失败', 'error');
        setIsProcessing(false);
      };
      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('Error removing watermark:', error);
      showToast('处理失败：' + (error as Error).message, 'error');
      setIsProcessing(false);
    }
  };

  // 下载结果
  const handleDownload = async () => {
    if (!resultImageUrl) return;

    try {
      const response = await fetch(resultImageUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));
      
      // 使用浏览器下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inpainted_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('开始下载', 'success');
    } catch (error) {
      console.error('Error downloading:', error);
      showToast('下载失败', 'error');
    }
  };

  // 清空所有框
  const clearBoxes = () => {
    setBoxes([]);
    saveHistory();
    setTempBox(null);
    setSelectedBoxIndex(-1);
    showToast('已清空所有区域', 'success');
  };

  // 清除图片
  const clearImage = () => {
    if (confirm('确定要清除当前图片和所有操作吗？')) {
      setOriginalImage(null);
      setImageFile(null);
      setBoxes([]);
      setHistory([[]]);
      setHistoryIndex(0);
      setTempBox(null);
      setSelectedBoxIndex(-1);
      setZoom(1.0);
      setResultImageUrl(null);
      showToast('已清除所有内容', 'success');
    }
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBoxIndex >= 0 && selectedBoxIndex < boxes.length) {
          const newBoxes = boxes.filter((_, i) => i !== selectedBoxIndex);
          setBoxes(newBoxes);
          saveHistory();
          setSelectedBoxIndex(-1);
          showToast('已删除选中区域', 'success');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBoxIndex, boxes, historyIndex, history]);

  return (
    <div className="card">
      <div className="header">
        <div className="title-block">
          <h1>
            AI 图片去水印
            <span className="title-chip">LaMa Inpainting</span>
          </h1>
          <p>上传图片 → 框选固定水印区域 → AI 自动填充去除 → 预览与下载。</p>
          <div className="tag-row">
            <span className="tag"><span className="pill-dot"></span>基于 big-lama，高质量图片修复</span>
            <span className="tag">手动框选 · 精准控制去除区域</span>
          </div>
        </div>
        <div className="badge">
          <span>✨</span>
          高质量去水印
        </div>
      </div>

      <div className="main">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">源图片 & 框选水印</div>
            <div className="hint">点击上传，按住鼠标拖动框选水印，可多选</div>
          </div>

          <div className="upload-zone" onClick={handleFileSelect}>
            <div className="upload-icon">↑</div>
            <div className="upload-text-main">点击或拖入图片文件</div>
            <div className="upload-text-sub">支持 JPG / PNG，分辨率越高效果越好</div>
          </div>

          {originalImage && (
            <div className="canvas-wrapper">
              <div className="canvas-container">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>
            </div>
          )}

          <div className="toolbar">
            <div>
              <div>提示：可拖多次添加多个矩形框，右键或双击空白区域取消当前操作。</div>
              <div className="keyboard-hint">
                快捷键：<kbd>Ctrl+Z</kbd>撤销 <kbd>Ctrl+Y</kbd>重做 <kbd>Delete</kbd>删除选中
              </div>
            </div>
            <div className="btn-row">
              <div className="undo-redo-btns">
                <button
                  className="secondary"
                  onClick={undo}
                  disabled={historyIndex <= 0}
                >
                  ↶ 撤销
                </button>
                <button
                  className="secondary"
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                >
                  ↷ 重做
                </button>
              </div>
              <button className="secondary" onClick={clearBoxes} disabled={boxes.length === 0}>
                清空所有框
              </button>
              <button
                className="secondary"
                onClick={clearImage}
                disabled={!originalImage}
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}
              >
                🗑️ 清除图片
              </button>
            </div>
          </div>

          <div className="stats-info">
            <div className="stat-item">
              <span>图片尺寸：</span>
              <span className="stat-value">
                {originalImage ? `${originalImage.width} × ${originalImage.height}` : '-'}
              </span>
            </div>
            <div className="stat-item">
              <span>已选区域：</span>
              <span className="stat-value">{boxes.length}</span>
            </div>
            <div className="stat-item">
              <span>文件大小：</span>
              <span className="stat-value">
                {imageFile ? `${(imageFile.size / 1024).toFixed(2)} KB` : '-'}
              </span>
            </div>
          </div>

          <div className={`status ${statusType}`}>{status}</div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">AI 去水印结果</div>
            <div className="hint">点击"开始去水印"，稍等几秒钟查看效果</div>
          </div>

          <div className="result-img-wrapper">
            {resultImageUrl ? (
              <img
                src={compareMode && originalImage ? originalImage.src : resultImageUrl}
                alt="去水印结果"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="result-placeholder">
                <div className="empty-state">
                  <div className="empty-state-icon">🖼️</div>
                  <div className="empty-state-text">
                    去水印结果会显示在这里<br />
                    上传图片并框选水印后，点击按钮开始处理
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="result-controls">
            <label className="compare-toggle">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
              />
              <span>对比原图</span>
            </label>
          </div>

          <div className="meta-row">
            <div className="pill">
              当前状态：
              <span>{isProcessing ? '处理中...' : resultImageUrl ? '去水印完成' : '待上传图片'}</span>
            </div>
            <div className="btn-row">
              <button
                className="secondary"
                onClick={handleDownload}
                disabled={!resultImageUrl}
              >
                📥 下载结果
              </button>
              <button
                className="primary"
                onClick={handleRemoveWatermark}
                disabled={!imageFile || boxes.length === 0 || isProcessing}
              >
                {isProcessing ? '处理中...' : '🚀 开始去水印'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;

