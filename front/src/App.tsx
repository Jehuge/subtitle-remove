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
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [history, setHistory] = useState<Box[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [tempBox, setTempBox] = useState<Box | null>(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState(-1);
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

    // 绘制已确认的框 - 商务风格配色
    ctx.lineWidth = 2.5;
    boxes.forEach((box, index) => {
      const isSelected = index === selectedBoxIndex;
      ctx.strokeStyle = isSelected ? 'rgba(217, 172, 83, 0.95)' : 'rgba(59, 130, 246, 0.9)';
      ctx.fillStyle = isSelected ? 'rgba(217, 172, 83, 0.15)' : 'rgba(59, 130, 246, 0.12)';
      const { x1, y1, x2, y2 } = box;
      const w = x2 - x1;
      const h = y2 - y1;
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, w, h);

      // 绘制编号 - 商务风格
      ctx.fillStyle = isSelected ? '#d9ac53' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(x1 + 10, y1 + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), x1 + 10, y1 + 10);
    });

    // 绘制临时框
    if (tempBox) {
      ctx.strokeStyle = 'rgba(217, 172, 83, 0.8)';
      ctx.fillStyle = 'rgba(217, 172, 83, 0.1)';
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
    setTempBox({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y });
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
          
          console.log('[前端] 开始调用 Tauri 命令 remove_watermark');
          console.log('[前端] 图片大小:', base64.length, '字符');
          console.log('[前端] 框选区域数量:', boxes.length);
          
          // 调用 Tauri 命令，通过 Sidecar 启动 Python 后端
          const result = await invoke<string>('remove_watermark', {
            imageData: base64,
            boxes: boxes.map(b => [b.x1, b.y1, b.x2, b.y2]),
          });

          console.log('[前端] 收到结果，长度:', result.length);
          
          // result 是 base64 编码的图片
          setResultImageUrl(result);
          showToast('去水印完成！', 'success');
          setIsProcessing(false);
        } catch (error: any) {
          console.error('[前端] 调用 Tauri 命令失败:', error);
          const errorMessage = error?.message || error?.toString() || '未知错误';
          console.error('[前端] 详细错误信息:', JSON.stringify(error, null, 2));
          showToast('处理失败：' + errorMessage, 'error');
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        console.error('[前端] 读取图片文件失败');
        showToast('读取图片失败', 'error');
        setIsProcessing(false);
      };
      reader.readAsDataURL(imageFile);
    } catch (error: any) {
      console.error('[前端] 处理去水印时发生错误:', error);
      showToast('处理失败：' + (error?.message || '未知错误'), 'error');
      setIsProcessing(false);
    }
  };

  // 下载结果
  const handleDownload = async () => {
    if (!resultImageUrl) return;

    try {
      const response = await fetch(resultImageUrl);
      const blob = await response.blob();
      
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
    <div className="app-container">
      {/* 顶部导航栏 */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6v6H9z" />
              </svg>
            </div>
            <div className="logo-text">
              <h1 className="app-title">专业图片去水印</h1>
              <p className="app-subtitle">AI 智能水印去除系统</p>
            </div>
          </div>
          <div className="header-badge">
            <span className="badge-dot"></span>
            <span>LaMa 技术</span>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="app-main">
        {/* 左侧：源图片编辑区 */}
        <section className="workspace-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 className="panel-title">源图片编辑</h2>
              <span className="panel-subtitle">框选需要去除的水印区域</span>
            </div>
            <div className="panel-stats">
              <div className="stat-badge">
                <span className="stat-label">已选区域</span>
                <span className="stat-value">{boxes.length}</span>
              </div>
            </div>
          </div>

          <div className="panel-content">
            {!originalImage ? (
              <div className="upload-area" onClick={handleFileSelect}>
                <div className="upload-icon-wrapper">
                  <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="upload-text">
                  <p className="upload-primary">点击上传图片</p>
                  <p className="upload-secondary">支持 JPG、PNG 格式 • 建议使用高分辨率图片</p>
                </div>
              </div>
            ) : (
              <div className="canvas-viewport">
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

            {originalImage && (
              <div className="toolbar-section">
                <div className="toolbar-group">
                  <button
                    className="toolbar-btn"
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    title="撤销 (Ctrl+Z)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7v6h6" />
                      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                    <span>撤销</span>
                  </button>
                  <button
                    className="toolbar-btn"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    title="重做 (Ctrl+Y)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 7v6h-6" />
                      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                    </svg>
                    <span>重做</span>
                  </button>
                </div>
                <div className="toolbar-group">
                  <button
                    className="toolbar-btn secondary"
                    onClick={clearBoxes}
                    disabled={boxes.length === 0}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>清空所有</span>
                  </button>
                  <button
                    className="toolbar-btn danger"
                    onClick={clearImage}
                    disabled={!originalImage}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>重置</span>
                  </button>
                </div>
              </div>
            )}

            {originalImage && (
              <div className="image-info">
                <div className="info-item">
                  <span className="info-label">图片尺寸</span>
                  <span className="info-value">{originalImage.width} × {originalImage.height}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">文件大小</span>
                  <span className="info-value">{imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">已选区域</span>
                  <span className="info-value highlight">{boxes.length}</span>
                </div>
              </div>
            )}

            {status && (
              <div className={`status-message ${statusType}`}>
                <span>{status}</span>
              </div>
            )}
          </div>
        </section>

        {/* 右侧：结果预览区 */}
        <section className="preview-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 className="panel-title">处理结果</h2>
              <span className="panel-subtitle">AI 生成的结果预览</span>
            </div>
            <div className="panel-actions">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={compareMode}
                  onChange={(e) => setCompareMode(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">对比原图</span>
              </label>
            </div>
          </div>

          <div className="panel-content">
            <div className="preview-container">
              {resultImageUrl ? (
                <div className="preview-image-wrapper">
                  <img
                    src={compareMode && originalImage ? originalImage.src : resultImageUrl}
                    alt="Processed result"
                    className="preview-image"
                  />
                  {compareMode && (
                    <div className="compare-overlay">
                      <span>原图</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="preview-placeholder">
                  <div className="placeholder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <p className="placeholder-text">处理结果将显示在这里</p>
                  <p className="placeholder-hint">上传图片并框选区域后开始处理</p>
                </div>
              )}
            </div>

            <div className="action-section">
              <div className="status-indicator">
                <div className={`status-dot ${isProcessing ? 'processing' : resultImageUrl ? 'success' : 'idle'}`}></div>
                <span className="status-text">
                  {isProcessing ? '处理中...' : resultImageUrl ? '已完成' : '就绪'}
                </span>
              </div>
              <div className="action-buttons">
                <button
                  className="action-btn secondary"
                  onClick={handleDownload}
                  disabled={!resultImageUrl}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>下载</span>
                </button>
                <button
                  className="action-btn primary"
                  onClick={handleRemoveWatermark}
                  disabled={!imageFile || boxes.length === 0 || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <svg className="spinner" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                          <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
                          <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
                        </circle>
                      </svg>
                      <span>处理中...</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      <span>开始处理</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 底部提示栏 */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="shortcut-hints">
            <span className="hint-item">
              <kbd>Ctrl</kbd> + <kbd>Z</kbd> 撤销
            </span>
            <span className="hint-item">
              <kbd>Ctrl</kbd> + <kbd>Y</kbd> 重做
            </span>
            <span className="hint-item">
              <kbd>Delete</kbd> 删除选中
            </span>
          </div>
          <div className="footer-info">
            <span>基于 Big-LaMa 图像修复技术</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
