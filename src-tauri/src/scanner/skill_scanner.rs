use crate::models::skill::Skill;
use crate::models::source::SkillSource;
use crate::scanner::ignore_rules::build_walker;
use chrono::Utc;
use std::path::Path;
use uuid::Uuid;

pub fn scan_directory(source: &SkillSource) -> Vec<Skill> {
    let walker = build_walker(Path::new(&source.path), source.scan_depth as usize);
    let mut discovered_skills = Vec::new();

    for result in walker {
        match result {
            Ok(entry) => {
                if entry.file_type().map_or(false, |ft| ft.is_file()) {
                    let file_name = entry.file_name().to_string_lossy().to_lowercase();
                    let path_str = entry.path().to_string_lossy().to_string();
                    log::info!("Inspecting file: {}", path_str);

                    // Consider explicit skill definition files, READMEs, and script tools
                    if file_name == "skill.yaml"
                        || file_name == "skill.json"
                        || file_name == "skill.md"
                        || file_name == "readme.md"
                    {
                        log::info!("Discovered skill entry: {}", path_str);
                        let skill_type = if file_name.ends_with(".md") {
                            "Prompt"
                        } else {
                            "Standard"
                        };
                        discovered_skills.push(create_skill(source, entry.path(), skill_type));
                    } else if (file_name.ends_with(".py")
                        || file_name.ends_with(".sh")
                        || file_name.ends_with(".js")
                        || file_name.ends_with(".ts"))
                        && (file_name.contains("prompt")
                            || file_name.contains("workflow")
                            || file_name.contains("agent")
                            || file_name.contains("tool"))
                    {
                        log::info!("Discovered script skill: {}", path_str);
                        discovered_skills.push(create_skill(source, entry.path(), "Script"));
                    }
                }
            }
            Err(err) => {
                log::error!("Error walking directory: {}", err);
            }
        }
    }

    discovered_skills
}

use crate::scanner::description_extractor::extract_skill_description;

fn create_skill(source: &SkillSource, path: &Path, skill_type: &str) -> Skill {
    let now = Utc::now().to_rfc3339();

    // The name should be the parent directory's name
    let name = path
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });

    let parent_dir = path.parent().unwrap_or(path);
    let entry_file = path.file_name().map(|n| n.to_string_lossy().to_string());
    let desc_result = extract_skill_description(&name, parent_dir, &entry_file, None);

    Skill {
        id: Uuid::new_v4().to_string(),
        source_id: Some(source.id.clone()),
        name,
        path: path.to_string_lossy().to_string(),
        skill_type: Some(skill_type.to_string()),
        category: desc_result.category,
        subcategory: None,
        description: desc_result.description,
        description_source: Some(desc_result.source),
        description_confidence: Some(desc_result.confidence),
        description_updated_at: Some(now.clone()),
        description_is_manual: Some(0),
        summary: None,
        tags: None,
        confidence: None,
        evidence_files: None,
        manual_override: Some(0),
        last_analyzed_at: None,
        status: "active".to_string(),
        entry_file,
        metadata_path: None,
        has_metadata: 0,
        is_executable: if skill_type.contains("script") || skill_type.contains("tool") {
            1
        } else {
            0
        },
        total_usage_count: 0,
        last_used_at: None,
        last_modified_at: Some(now.clone()),
        created_at: now.clone(),
        updated_at: now,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_skill_stores_entry_file_as_file_name_only() {
        let source = SkillSource {
            id: "source-1".to_string(),
            name: "Test Source".to_string(),
            path: "/tmp/skills".to_string(),
            source_type: None,
            enabled: 1,
            scan_depth: 3,
            last_scanned_at: None,
            created_at: "now".to_string(),
            updated_at: "now".to_string(),
        };

        let skill = create_skill(&source, Path::new("/tmp/skills/demo/SKILL.md"), "Prompt");

        assert_eq!(skill.entry_file.as_deref(), Some("SKILL.md"));
    }
}
