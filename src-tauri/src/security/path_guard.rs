use std::path::{Path, PathBuf};

const SENSITIVE_HOME_SUBPATHS: &[&str] = &[
    ".ssh",
    ".gnupg",
    "Library/Keychains",
    "Library/Messages",
    "Library/Mail",
    "Library/Application Support/AddressBook",
];

pub fn validate_scan_root(input: &str) -> Result<PathBuf, String> {
    let expanded = expand_home(input)?;
    let canonical = expanded
        .canonicalize()
        .map_err(|e| format!("无法访问扫描目录: {}", e))?;

    if !canonical.is_dir() {
        return Err("扫描路径必须是目录".to_string());
    }

    if canonical == Path::new("/") {
        return Err("禁止扫描系统根目录 /".to_string());
    }

    if let Some(home) = dirs::home_dir().and_then(|p| p.canonicalize().ok()) {
        if canonical == home {
            return Err("禁止扫描用户 home 根目录".to_string());
        }

        for sensitive in SENSITIVE_HOME_SUBPATHS {
            let sensitive_path = home.join(sensitive);
            if canonical == sensitive_path || canonical.starts_with(&sensitive_path) {
                return Err(format!("禁止扫描敏感目录: {}", sensitive));
            }
        }
    }

    Ok(canonical)
}

fn expand_home(input: &str) -> Result<PathBuf, String> {
    if input == "~" {
        return dirs::home_dir().ok_or_else(|| "无法解析 home 目录".to_string());
    }

    if let Some(rest) = input.strip_prefix("~/") {
        let home = dirs::home_dir().ok_or_else(|| "无法解析 home 目录".to_string())?;
        return Ok(home.join(rest));
    }

    Ok(PathBuf::from(input))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_root_home_and_sensitive_paths() {
        assert!(validate_scan_root("/").is_err());

        let home = dirs::home_dir().expect("home directory should exist for tests");
        assert!(validate_scan_root(home.to_string_lossy().as_ref()).is_err());
        assert!(validate_scan_root(home.join(".ssh").to_string_lossy().as_ref()).is_err());
        assert!(validate_scan_root(home.join(".gnupg").to_string_lossy().as_ref()).is_err());
        assert!(
            validate_scan_root(home.join("Library/Keychains").to_string_lossy().as_ref()).is_err()
        );
        assert!(
            validate_scan_root(home.join("Library/Messages").to_string_lossy().as_ref()).is_err()
        );
        assert!(validate_scan_root(home.join("Library/Mail").to_string_lossy().as_ref()).is_err());
    }

    #[test]
    fn expands_home_and_accepts_project_subdirectory() {
        let guarded = validate_scan_root("~/Documents").expect("Documents under home is scan-safe");
        assert!(guarded.is_absolute());
        assert!(guarded.ends_with("Documents"));
    }
}
