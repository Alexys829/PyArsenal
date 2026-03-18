use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("pyarsenal");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn tools_dir() -> PathBuf {
    let dir = data_dir().join("tools");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn installed_db_path() -> PathBuf {
    data_dir().join("installed.json")
}

pub fn catalog_cache_path() -> PathBuf {
    data_dir().join("catalog_cache.json")
}
