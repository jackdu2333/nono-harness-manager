# Skills 页面筛选能力与列表展示优化需求

## 一、背景

当前 Skills 页面已经具备基础列表、搜索、Summary Chips、详情页、分类、来源、状态、待整理、待进化、疑似重复等能力。

但目前存在两个主要问题：

1. 筛选能力不足
   - Skills 已经有来源属性和分类属性，但页面无法按来源筛选。
   - 无法区分“Skill 来源于哪个客户端目录”和“Skill 适合哪个 Agent 客户端使用”。
   - 无法组合筛选，例如：
     - 只看 Codex 安装的 Skills。
     - 只看 Codex 能用的 Skills。
     - 只看 Codex 能用的文档办公 Skills。
     - 只看 Codex 来源且未分类的 Skills。

2. 列表展示不够稳定
   - Category 和 Updated 列宽不固定，视觉漂移。
   - 分类文字容易换行，影响扫描效率。
   - 日期列不稳定。
   - 当前筛选状态不够明显。
   - 疑似重复数量过高，重复检测规则需要收敛。
   - 500+ Skills 场景下，页面需要更像资产管理表格，而不是普通列表。

本次目标不是重构整个 Skills 页面，而是在现有页面基础上增强“多维筛选 + 稳定列表展示”。

---

## 二、产品目标

将 Skills 页面从“技能列表”升级为“多维 Skill 资产浏览页”。

用户应该能够快速完成：

1. 按来源查看 Skills。
2. 按适用客户端查看 Skills。
3. 按分类查看 Skills。
4. 按来源 + 分类 + 状态组合筛选。
5. 按适用客户端 + 分类组合筛选。
6. 在列表中稳定浏览 500+ Skills。
7. 快速判断 Skill 的名称、描述、来源、适用客户端、分类、更新时间。
8. 保持 Dashboard / Analytics / Health Check 的职责边界，不把 Skills 页面做成统计大屏。

---

## 三、核心概念定义

### 1. 来源 Source

来源表示 Skill 是从哪里扫描出来的。

例如：

- Codex Skills 目录
- Claude Code Skills 目录
- WorkBuddy Skills 目录
- 通用 Skills 目录
- 项目 Skills 目录
- 手动添加资源库

来源字段可以由以下信息推导：

- skills.source_id
- skill_sources.name
- skill_sources.path
- skill_sources.source_type

示例：

```text
来源：Codex
路径：~/.codex/skills