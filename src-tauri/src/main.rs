// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 在应用启动时，可以在这里初始化 Python 后端
            // 注意：Python 后端将通过 Sidecar 在需要时启动
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

