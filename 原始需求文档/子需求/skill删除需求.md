请调整 Skill 删除策略。当前“删除 Harness 索引，不删除本地文件”不符合 Skill 资产管理工具的真实管理需求，因为下次扫描后 Skill 会重新出现。请将删除能力改成分层操作：

一、保留三个操作

1. 归档 Skill
- 不删除本地文件。
- 只设置 is_archived = 1。
- 默认列表隐藏。
- 适合暂时不用但未来可能还要的 Skill。

2. 从 Harness 移除索引
- 只删除数据库中的 skills 记录。
- 不删除本地文件。
- 放在更多菜单或高级操作里。
- 文案必须说明：本地文件仍然存在，下次扫描可能重新出现。
- 适合处理扫描误识别。

3. 删除本地源文件
- 删除 Skill 对应的本地文件或 Skill 文件夹。
- 删除成功后，同时删除 Harness 索引。
- 这是主要的真实删除动作。
- 必须二次确认。

二、删除范围判断

需要区分 Skill 的删除目标：

1. 如果 Skill 来自单文件：
- 例如 .md / .py / .sh / .js / .ts
- 删除该文件。

2. 如果 Skill 来自标准 Skill 目录：
- 目录下包含 skill.yaml / skill.json / SKILL.md / README.md 等。
- 优先删除整个 Skill 目录。
- 但必须在确认弹窗中明确展示将删除的目录路径。

3. 如果无法可靠判断是单文件还是独立 Skill 目录：
- 不允许直接删除目录。
- 只允许删除当前 entry_file。
- 或提示用户在 Finder 中打开手动处理。

三、强制安全规则

删除本地源文件前必须校验：

1. 路径必须属于已授权的 skill_source.path 目录下。
2. 不能删除 skill_source 根目录本身。
3. 不能删除 /、home 根目录、Documents、Desktop、Downloads 等高层目录。
4. 不能删除 .ssh、.gnupg、Keychains、Messages、Mail 等敏感目录。
5. 不能跟随 symlink 删除真实目标。
6. 如果目标是 symlink，只删除 symlink 本身，或者直接拒绝。
7. 删除目录时必须限制为 Skill 自己的目录，不能删除资源库根目录。
8. 删除前后都要记录 audit / usage event。

四、删除方式

优先实现：
- move_to_trash / 移到废纸篓

如果当前技术栈暂时不方便接系统 Trash：
- 可以先实现永久删除
- 但 UI 必须明确写“永久删除本地文件，无法通过 Harness 恢复”
- 需要二次确认

建议后端命令命名：

delete_skill_source_file(skill_id, mode)

mode:
- trash
- permanent

第一阶段可以只实现 permanent，但 UI 文案必须非常明确。
更推荐优先实现 trash。

五、确认弹窗

删除本地源文件时必须使用 AlertDialog，不要用二次点击按钮代替。

弹窗内容：

标题：
删除本地 Skill 文件？

正文：
此操作会删除本地源文件，并从 Harness 索引中移除。删除后该 Skill 不会在下次扫描中重新出现。

展示：
- Skill 名称
- 删除目标类型：文件 / 目录
- 删除路径
- 是否可恢复：移到废纸篓 / 永久删除

用户必须勾选：
我理解此操作会删除本地文件

如果是永久删除，要求输入 Skill 名称确认。

按钮：
取消
移到废纸篓 / 永久删除

六、usage event

新增 action：
- archive
- remove_index
- delete_source_file
- move_source_to_trash

注意：
删除本地文件成功后，再删除 Harness 索引。
如果文件删除失败，不要删除索引。

七、UI 调整

SkillDetail 底部危险操作区改成：

普通操作：
- 打开目录
- 复制路径
- 复制引用

管理操作：
- 归档 / 取消归档

危险操作：
- 从 Harness 移除索引
- 删除本地源文件

删除本地源文件要比“移除索引”更明确，但不能误触。

八、验收标准

1. 归档 Skill 后默认列表隐藏，本地文件仍存在。
2. 移除索引后本地文件仍存在，下次扫描可能重新出现。
3. 删除本地源文件后，本地文件或目录真的被删除。
4. 删除本地源文件成功后，对应 Harness 索引也被删除。
5. 删除失败时不删除索引。
6. 删除前弹窗展示 Skill 名称、删除路径、删除类型。
7. 删除目录时不会删除资源库根目录。
8. 不允许删除授权 skill_source 外的路径。
9. 不允许删除敏感目录。
10. usage_events 能记录 archive / remove_index / delete_source_file。