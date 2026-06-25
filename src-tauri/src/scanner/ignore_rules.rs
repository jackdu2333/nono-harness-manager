use ignore::WalkBuilder;
use std::path::Path;

pub fn build_walker(path: &Path, max_depth: usize) -> ignore::Walk {
    let mut builder = WalkBuilder::new(path);
    builder.max_depth(Some(max_depth));
    builder.hidden(true); // ignore hidden files
    builder.git_ignore(true); // ignore .gitignore files

    // Additional hardcoded ignore rules
    builder.filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        !matches!(
            name.as_ref(),
            "node_modules" | ".git" | "dist" | "build" | "__pycache__" | ".venv" | ".DS_Store" | "target" | "coverage"
        )
    });

    builder.build()
}
