// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json;
use std::io::Write;
use std::process::{Command, Stdio};
use tauri::{command, Manager};

#[command]
async fn remove_watermark(
    app: tauri::AppHandle,
    image_data: String,
    boxes: Vec<Vec<f64>>,
) -> Result<String, String> {
    // 获取资源目录（python 目录）
    // 在开发模式下，使用项目根目录；在生产模式下，使用资源目录
    let backend_dir = if cfg!(debug_assertions) {
        // 开发模式：尝试多种方式找到项目根目录
        // 方法1: 从当前工作目录查找
        let mut found = std::env::current_dir()
            .ok()
            .and_then(|p| {
                // 如果当前目录包含 python 目录，直接使用
                let python_dir = p.join("python");
                if python_dir.exists() {
                    Some(python_dir)
                } else if p.ends_with("tauri") {
                    // 如果在 tauri 目录，向上找
                    p.parent().map(|p| p.join("python"))
                } else {
                    // 尝试向上查找
                    let mut current = p.clone();
                    for _ in 0..3 {
                        let python_dir = current.join("python");
                        if python_dir.exists() {
                            return Some(python_dir);
                        }
                        if let Some(parent) = current.parent() {
                            current = parent.to_path_buf();
                        } else {
                            break;
                        }
                    }
                    None
                }
            });
        
        // 方法2: 如果方法1失败，尝试使用资源目录
        if found.is_none() {
            found = app.path()
                .resource_dir()
                .ok()
                .map(|r| r.join("python"));
        }
        
        // 方法3: 使用可执行文件路径
        if found.is_none() {
            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(exe_dir) = exe_path.parent() {
                    let mut current = exe_dir.to_path_buf();
                    for _ in 0..5 {
                        let python_dir = current.join("python");
                        if python_dir.exists() {
                            found = Some(python_dir);
                            break;
                        }
                        if let Some(parent) = current.parent() {
                            current = parent.to_path_buf();
                        } else {
                            break;
                        }
                    }
                }
            }
        }
        
        found.ok_or("无法获取 python 目录，请确保 python/ 目录存在")?
    } else {
        // 生产模式：使用资源目录
        app.path()
            .resource_dir()
            .map_err(|e| format!("无法获取资源目录: {}", e))?
            .join("python")
    };
    
    let script_path = backend_dir.join("remove_watermark_cli.py");
    
    // 调试信息
    eprintln!("[DEBUG] 后端目录: {}", backend_dir.display());
    eprintln!("[DEBUG] 脚本路径: {}", script_path.display());
    
    // 检查脚本是否存在
    if !script_path.exists() {
        return Err(format!("Python 脚本不存在: {}。请确保 python/remove_watermark_cli.py 文件存在", script_path.display()));
    }
    
    // 准备输入 JSON
    let input_json = serde_json::json!({
        "image_data": image_data,
        "boxes": boxes
    });
    
    let input_str = serde_json::to_string(&input_json)
        .map_err(|e| format!("序列化输入失败: {}", e))?;
    
    // 执行 Python 脚本
    eprintln!("[DEBUG] 执行 Python 脚本: {}", script_path.display());
    eprintln!("[DEBUG] 工作目录: {}", backend_dir.display());
    
    let mut child = Command::new("python3")
        .arg(script_path.to_str().unwrap())
        .current_dir(&backend_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 Python 进程失败: {}。请确保已安装 Python 3 并且 python3 命令可用", e))?;
    
    // 写入输入数据
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input_str.as_bytes())
            .map_err(|e| format!("写入输入数据失败: {}", e))?;
        stdin.flush()
            .map_err(|e| format!("刷新输入数据失败: {}", e))?;
    }
    
    let output = child.wait_with_output()
        .map_err(|e| format!("执行 Python 脚本失败: {}", e))?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python 脚本执行失败: {}", error));
    }
    
    let result = String::from_utf8(output.stdout)
        .map_err(|e| format!("读取输出失败: {}", e))?;
    
    Ok(result.trim().to_string())
}

#[command]
async fn save_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, data)
        .map_err(|e| format!("保存文件失败: {}", e))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![remove_watermark, save_file])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

