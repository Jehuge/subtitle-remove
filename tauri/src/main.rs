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
    // 获取资源目录（backend 目录）
    // 在开发模式下，使用项目根目录；在生产模式下，使用资源目录
    let backend_dir = if cfg!(debug_assertions) {
        // 开发模式：从 tauri 目录向上找到项目根目录
        std::env::current_dir()
            .ok()
            .and_then(|mut p| {
                // 如果当前在 tauri 目录，向上两级到项目根
                if p.ends_with("tauri") {
                    p.parent().and_then(|p| p.parent()).map(|p| p.join("backend"))
                } else {
                    // 否则尝试直接找 backend
                    Some(p.join("backend"))
                }
            })
            .or_else(|| {
                // 如果无法获取，尝试使用资源目录
                app.path_resolver()
                    .resource_dir()
                    .map(|r| r.join("backend"))
            })
            .ok_or("无法获取 backend 目录")?
    } else {
        // 生产模式：使用资源目录
        app.path_resolver()
            .resource_dir()
            .ok_or("无法获取资源目录")?
            .join("backend")
    };
    
    let script_path = backend_dir.join("remove_watermark_cli.py");
    
    // 检查脚本是否存在
    if !script_path.exists() {
        return Err(format!("Python 脚本不存在: {}", script_path.display()));
    }
    
    // 准备输入 JSON
    let input_json = serde_json::json!({
        "image_data": image_data,
        "boxes": boxes
    });
    
    let input_str = serde_json::to_string(&input_json)
        .map_err(|e| format!("序列化输入失败: {}", e))?;
    
    // 执行 Python 脚本
    let mut child = Command::new("python3")
        .arg(script_path.to_str().unwrap())
        .current_dir(&backend_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 Python 进程失败: {}。请确保已安装 Python 3", e))?;
    
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
        .setup(|app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

