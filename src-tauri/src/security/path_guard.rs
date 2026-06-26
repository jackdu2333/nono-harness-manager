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

// ===== Deletion guards (子需求 §三) =====

/// High-level directories that must never be deletion targets. 子需求 §三
const FORBIDDEN_DELETE_TOP_DIRS: &[&str] = &[
    "Documents",
    "Desktop",
    "Downloads",
    "Pictures",
    "Music",
    "Movies",
    "Applications",
    ".config",
    ".codex",
    ".agents",
    ".claude",
];

/// Validate a deletion target. Stricter than scan validation because deletion
/// is irreversible. 子需求 §三 强制安全规则.
///
/// Rules:
/// 1. Path must resolve (no broken symlinks for the target itself).
/// 2. Reject symlinks — never follow them to delete the real target.
/// 3. Must be inside an authorized source root (caller passes the list).
/// 4. Cannot be the source root itself.
/// 5. Cannot be /, home root, or high-level dirs.
/// 6. Cannot be inside sensitive dirs (.ssh, .gnupg, Keychains, etc).
pub fn validate_delete_target(
    target_input: &str,
    authorized_roots: &[String],
) -> Result<PathBuf, String> {
    let candidate = expand_home(target_input)?;

    // Reject symlinks — never resolve through them for deletion.
    let metadata = std::fs::symlink_metadata(&candidate)
        .map_err(|e| format!("无法访问删除目标: {}", e))?;
    if metadata.file_type().is_symlink() {
        return Err("拒绝删除 symlink：请手动处理或先移除链接".to_string());
    }

    // Canonicalize only after confirming it's not a symlink.
    let canonical = candidate
        .canonicalize()
        .map_err(|e| format!("无法解析删除目标路径: {}", e))?;

    // Must not be root or home root.
    if canonical == Path::new("/") {
        return Err("禁止删除系统根目录 /".to_string());
    }

    if let Some(home) = dirs::home_dir().and_then(|p| p.canonicalize().ok()) {
        if canonical == home {
            return Err("禁止删除用户 home 根目录".to_string());
        }

        // Reject high-level top dirs under home.
        for top in FORBIDDEN_DELETE_TOP_DIRS {
            let top_path = home.join(top);
            if canonical == top_path {
                return Err(format!("禁止删除高层目录: {}", top));
            }
        }

        // Reject sensitive dirs.
        for sensitive in SENSITIVE_HOME_SUBPATHS {
            let sensitive_path = home.join(sensitive);
            if canonical == sensitive_path || canonical.starts_with(&sensitive_path) {
                return Err(format!("禁止删除敏感目录: {}", sensitive));
            }
        }
    }

    // Must be inside at least one authorized source root.
    let inside_authorized = authorized_roots.iter().any(|root_input| {
        if let Ok(root) = expand_home(root_input) {
            if let Ok(root_canonical) = root.canonicalize() {
                // Must be strictly inside, not equal to the root itself.
                return canonical != root_canonical && canonical.starts_with(&root_canonical);
            }
        }
        false
    });

    if !inside_authorized {
        return Err("删除目标不在任何已授权的 skill_source 目录内".to_string());
    }

    Ok(canonical)
}

/// Determine whether a path is a standard Skill directory (contains
/// skill.yaml / skill.json / SKILL.md / README.md). 子需求 §二.
pub fn is_skill_directory(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    let indicators = [
        "skill.yaml",
        "skill.json",
        "skill.md",
        "SKILL.md",
        "readme.md",
        "README.md",
    ];
    indicators.iter().any(|name| path.join(name).exists())
}

#[cfg(test)]
mod delete_tests {
    use super::*;

    #[test]
    fn delete_guard_rejects_high_level_and_sensitive_paths() {
        let home = dirs::home_dir().expect("home directory should exist for tests");
        let authorized = vec![home.join(".agents/skills").to_string_lossy().to_string()];

        assert!(validate_delete_target("/", &authorized).is_err());
        assert!(validate_delete_target(home.to_string_lossy().as_ref(), &authorized).is_err());
        assert!(
            validate_delete_target(home.join("Documents").to_string_lossy().as_ref(), &authorized)
                .is_err()
        );
        assert!(
            validate_delete_target(home.join("Desktop").to_string_lossy().as_ref(), &authorized)
                .is_err()
        );
        assert!(
            validate_delete_target(home.join(".ssh").to_string_lossy().as_ref(), &authorized)
                .is_err()
        );
    }

    #[test]
    fn delete_guard_rejects_paths_outside_authorized_roots() {
        let home = dirs::home_dir().expect("home directory should exist for tests");
        let authorized = vec![home.join(".agents/skills").to_string_lossy().to_string()];

        // A temp file outside the authorized root should be rejected.
        let temp = std::env::temp_dir().join("harness_delete_test_outside.txt");
        std::fs::write(&temp, "test").expect("write temp file");
        assert!(validate_delete_target(temp.to_string_lossy().as_ref(), &authorized).is_err());
        let _ = std::fs::remove_file(&temp);
    }
}
