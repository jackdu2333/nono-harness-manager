use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use std::fs;
use std::path::Path;

pub struct SkillDescriptionResult {
    pub description: Option<String>,
    pub category: Option<String>,
    pub source: String,
    pub confidence: String,
}

#[derive(serde::Deserialize)]
struct SkillFrontmatter {
    description: Option<String>,
    category: Option<String>,
}

struct ParsedFrontmatter {
    description: Option<String>,
    category: Option<String>,
}

fn extract_from_frontmatter(file_path: &Path) -> Option<ParsedFrontmatter> {
    let content = fs::read_to_string(file_path).ok()?;
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return None;
    }

    let mut parts = content.splitn(3, "---");
    parts.next(); // Skip empty prefix
    if let Some(frontmatter) = parts.next() {
        if let Ok(meta) = serde_yaml::from_str::<SkillFrontmatter>(frontmatter) {
            return Some(ParsedFrontmatter {
                description: meta.description.map(|d| d.trim().to_string()),
                category: meta.category.map(|c| c.trim().to_string()),
            });
        }
    }
    None
}

fn extract_from_markdown(file_path: &Path) -> Option<String> {
    let content = match fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(_) => return None,
    };

    let parser = Parser::new(&content);
    let mut in_target_heading = false;
    let mut in_paragraph = false;
    let mut text_buffer = String::new();
    let mut extracted_texts = Vec::new();
    let mut current_heading = String::new();
    let mut under_target = false;

    for event in parser {
        match event {
            Event::Start(Tag::Heading { .. }) => {
                in_target_heading = true;
                current_heading.clear();
                under_target = false;
            }
            Event::End(TagEnd::Heading(_)) => {
                let heading_text = current_heading.trim().to_lowercase();
                if heading_text.contains("description")
                    || heading_text.contains("描述")
                    || heading_text.contains("overview")
                    || heading_text.contains("用途")
                    || heading_text.contains("简介")
                {
                    under_target = true;
                } else {
                    under_target = false;
                }
                in_target_heading = false;
            }
            Event::Start(Tag::Paragraph) => {
                in_paragraph = true;
                text_buffer.clear();
            }
            Event::End(TagEnd::Paragraph) => {
                in_paragraph = false;
                if under_target && !text_buffer.trim().is_empty() {
                    extracted_texts.push(text_buffer.trim().to_string());
                }
                text_buffer.clear();
            }
            Event::Text(text) | Event::Code(text) => {
                if in_target_heading {
                    current_heading.push_str(&text);
                } else if in_paragraph {
                    text_buffer.push_str(&text);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if in_paragraph {
                    text_buffer.push(' ');
                }
            }
            _ => {}
        }
    }

    for text in extracted_texts {
        if text.len() > 10 {
            let mut summary = text;
            if summary.chars().count() > 300 {
                summary = summary.chars().take(300).collect();
                summary.push_str("...");
            }
            return Some(summary);
        }
    }

    None
}

pub fn extract_skill_description(
    skill_name: &str,
    skill_dir: &Path,
    skill_entry_file: &Option<String>,
    metadata_description: Option<&str>,
) -> SkillDescriptionResult {
    if let Some(desc) = metadata_description {
        if !desc.trim().is_empty() {
            return SkillDescriptionResult {
                description: Some(desc.trim().to_string()),
                category: None,
                source: "metadata".to_string(),
                confidence: "high".to_string(),
            };
        }
    }

    let mut candidates = Vec::new();
    if let Some(entry_file) = skill_entry_file {
        candidates.push(skill_dir.join(entry_file));
    }
    candidates.push(skill_dir.join("README.md"));
    candidates.push(skill_dir.join("readme.md"));

    // 1. Try YAML frontmatter first
    for path in &candidates {
        if path.exists() {
            if let Some(parsed) = extract_from_frontmatter(path) {
                if parsed.description.is_some() || parsed.category.is_some() {
                    let mut summary = parsed.description.unwrap_or_default();
                    if !summary.is_empty() && summary.chars().count() > 300 {
                        summary = summary.chars().take(300).collect();
                        summary.push_str("...");
                    }
                    return SkillDescriptionResult {
                        description: if summary.is_empty() {
                            None
                        } else {
                            Some(summary)
                        },
                        category: parsed.category,
                        source: "frontmatter".to_string(),
                        confidence: "high".to_string(),
                    };
                }
            }
        }
    }

    // 2. Try Markdown AST extraction (looking for # Description headings)
    for path in &candidates {
        if path.exists() {
            if let Some(desc) = extract_from_markdown(path) {
                return SkillDescriptionResult {
                    description: Some(desc),
                    category: None,
                    source: "markdown".to_string(),
                    confidence: "medium".to_string(),
                };
            }
        }
    }

    SkillDescriptionResult {
        description: Some(format!(
            "暂无描述。系统推测其用途可能与 {} 相关。",
            skill_name
        )),
        category: None,
        source: "filename_guess".to_string(),
        confidence: "low".to_string(),
    }
}
