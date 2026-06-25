请将以下内容作为 NoNo Harness Manager 的全局 UI/UX 设计原则与模块设计规范。后续开发 Agents、Skills、MCP、Memory、Knowledge、Projects、Analytics、Health Check 等页面时，必须遵守这些规范，不要每个页面各自发明一套布局。

# NoNo Harness Manager UI/UX 设计原则与模块设计规范 v1.0

## 一、产品定位

NoNo Harness Manager 不是普通后台管理系统，也不是文件浏览器。

它是 macOS 桌面端的本地 Agent Harness 控制台，用来管理：

1. Agents：本机 Agent 客户端与启动入口
2. Skills：本地技能、提示词、脚本、工作流
3. MCP：MCP Server、Tools、Resources、Prompts
4. Memory：本地记忆目录、记忆分类、记忆体检
5. Knowledge：Obsidian、VK、IMA 索引、项目知识库
6. Projects：项目维度资源绑定
7. Analytics：使用统计
8. Health Check：全局健康检查

设计目标：

用户进入每个页面后，应该立刻知道：
- 这里管理什么资源
- 当前资源数量和状态如何
- 哪些资源可用，哪些异常
- 资源能做什么
- 如何搜索、筛选、查看详情
- 如何执行当前页面最重要的操作

不要把页面做成“配置文件阅读器”或“卡片展览馆”。

---

## 二、全局设计原则

### 1. 管理台优先，不是展示墙

所有模块都应围绕“管理动作”设计，而不是单纯展示图标或卡片。

页面必须支持：
- 搜索
- 筛选
- 列表/分组
- 选中查看详情
- 状态判断
- 快捷操作
- 异常提示

不要只做大卡片网格。卡片可以用于“常用入口”或“摘要总览”，不能作为复杂资源管理的主展示方式。

---

### 2. 高频内容在主屏，低频配置进 Drawer / Sheet

以下内容属于低频配置，不应该长期占据页面主区域：

- 手动输入扫描路径
- 添加资源库
- 添加 MCP 配置
- 添加 Agent 路径
- 编辑高级参数
- 原始 JSON
- 环境变量
- 扫描深度
- 批量导入

这些内容必须放到：
- Drawer
- Sheet
- Dialog
- Collapsible section
- Secondary tab

默认页面应该优先展示资源列表、状态、搜索、详情。

---

### 3. 所有复杂模块统一使用 Split View

复杂资源管理页面统一采用：

左侧：资源列表 / 分组列表  
右侧：详情 Inspector

标准结构：

页面 Header / Toolbar
搜索与筛选
主内容 Split View
  左侧：资源列表
  右侧：详情 Inspector

适用模块：
- Agents
- Skills
- MCP
- Memory
- Knowledge
- Projects
- Health Check

Dashboard 和 Analytics 可以使用卡片和图表，但也要遵守统一视觉规范。

---

### 4. 详情页必须使用 Tabs 分层

右侧详情 Inspector 不允许把所有信息堆在一个滚动区域里。

复杂详情统一使用 Tabs：

- Overview：概览
- Config：配置
- Resources：绑定资源
- Usage：使用统计
- Health：健康检查
- Logs：日志，必要时
- Raw：原始数据，必要时

不同模块可以有自己的 Tab，但必须遵循“概览优先、配置后置、原始数据最后”的原则。

---

### 5. 用户第一眼要看到“能干什么”，不是路径

信息优先级必须是：

1. 名称
2. 中文描述：这个资源能做什么
3. 状态
4. 类型 / 分类 / 来源
5. 关键统计
6. 操作按钮
7. 路径 / 配置 / 原始数据

路径是系统信息，不是用户第一眼最关心的内容。

不要把绝对路径、JSON、命令参数放在视觉中心。

---

### 6. 页面不允许出现无意义双滚动

每个页面必须遵守：

外层：
- h-full
- flex
- flex-col
- overflow-hidden

Toolbar：
- shrink-0

主区域：
- flex-1
- min-h-0
- overflow-hidden

列表：
- overflow-auto

详情：
- overflow-auto

不要让页面整体滚动、列表滚动、详情滚动三层混在一起。双重滚动是 UI 设计里最稳定的反人类发明之一，别参与。

---

### 7. 所有模块都要支持空状态、加载状态、错误状态

每个页面必须设计：

1. Empty State
   - 标题
   - 说明
   - 主操作按钮
   - 次操作按钮

2. Loading State
   - Skeleton 或简洁 loading
   - 不要整页空白

3. Error State
   - 错误摘要
   - 可能原因
   - 修复建议
   - 重试按钮

4. Disabled State
   - 操作不可用时说明原因

不要出现“页面空白但不知道发生了什么”。

---

### 8. 视觉统一，不要每页像不同产品

全局统一：

- Sidebar
- Header
- Toolbar
- Search
- Filter
- List item
- Status badge
- Detail inspector
- Tabs
- Drawer
- Empty state
- Code block
- Toast
- Dialog

不要每个页面写一套新的卡片、按钮、输入框样式。

---

## 三、全局布局规范

### 1. App Shell

整体结构：

Sidebar + Main Content

Sidebar：
- 固定宽度，建议 260px 到 300px
- 顶部显示 NoNo Harness
- 右侧放主题切换按钮
- 中间主导航
- 底部 Settings
- 当前页面高亮清晰

Main Content：
- 占满剩余空间
- 页面内部统一使用 Header + Content
- 不允许页面内容贴边

---

### 2. Sidebar 规范

Sidebar 用于一级模块导航。

必须包含：

- Dashboard
- Agents
- Skills
- MCP
- Memory
- Knowledge
- Projects
- Analytics
- Health Check
- Settings

顶部：

NoNo Harness + Theme Toggle

主题切换支持：
- System
- Light
- Dark

Sidebar 不放具体业务操作，比如“扫描目录”“添加 Skill”。这些放在对应页面 Toolbar。

---

### 3. Page Header / Toolbar 规范

每个模块顶部都必须有 Header。

标准内容：

左侧：
- 页面图标
- 页面标题
- 一句话说明
- 统计摘要

右侧：
- 当前页面主要操作按钮
- 刷新
- 添加 / 扫描 / 自动发现等

下方或同一行：
- 搜索框
- 筛选器
- 分组切换
- 排序

Header 高度应克制，不要超过 140px。

不要把路径输入框固定放在 Header 里。路径输入属于 Drawer / Sheet 内容。

---

### 4. 主体区域规范

主体区域优先使用：

List + Detail Inspector

左侧列表宽度：
- 45% 到 60%

右侧详情宽度：
- 40% 到 55%

如果窗口较窄：
- 详情 Inspector 可收起
- 点击列表项进入详情
- 或 Drawer 形式展示详情

---

## 四、组件规范

### 1. 列表项 List Item

标准结构：

第一行：
- 图标
- 名称
- 状态 badge
- 主操作按钮，可选

第二行：
- 中文描述，不超过两行

第三行：
- Meta chips
  - 类型
  - 来源
  - 分类
  - 数量
  - 最近时间

示例：

Codex                       Active
代码执行 Agent，用于项目开发、代码修改和命令行任务。
CLI · 可启动 · 配置 ~/.codex · 最近启动 今天 10:42

---

### 2. 卡片 Card

卡片只用于：

- Dashboard 总览指标
- Pinned / 常用入口
- 统计摘要
- 空状态引导
- 少量精选资源

卡片不用于：

- 大量资源主列表
- MCP Server 主展示
- Agent 主展示
- Skills 主展示
- Memory 文件主展示

卡片高度必须克制。不要做空旷大卡片。

---

### 3. Detail Inspector

右侧详情面板标准结构：

顶部：
- 图标
- 名称
- 状态 badge
- 描述
- 主操作按钮

中部：
- Tabs

底部或 Tab 内：
- 详细字段
- 配置
- 统计
- 健康结果

信息顺序：

Overview > Resources > Config > Usage > Health > Logs > Raw

---

### 4. Status Badge

状态必须统一。

全局状态枚举：

- active：可用
- disabled：禁用
- broken：异常
- missing_path：路径缺失
- not_installed：未安装
- warning：警告
- draft：草稿
- archived：归档
- unknown：未知

视觉规则：

- active：绿色，小点 + badge
- warning / missing_path：黄色
- broken：红色
- disabled / archived / unknown：灰色
- draft：中性色

状态颜色要克制，不要大面积高饱和。

---

### 5. Search / Filter

每个资源管理页必须有搜索。

搜索框 placeholder 格式：

- Agents：搜索 Agent 名称、类型、路径...
- Skills：搜索技能名称、描述、分类...
- MCP：搜索 MCP、工具、描述...
- Memory：搜索记忆标题、内容摘要、路径...
- Knowledge：搜索知识库、文档、项目...
- Projects：搜索项目名称、仓库路径...
- Health Check：搜索问题、资源、严重等级...

筛选器最少包括：
- 类型
- 状态
- 来源 / 分类，按模块决定

---

### 6. Drawer / Sheet

Drawer 用于低频配置。

适用场景：

- 添加资源库
- 扫描目录
- 添加 Agent
- 添加 MCP
- 编辑启动配置
- 高级筛选
- 批量操作
- 原始配置查看

Drawer 宽度建议：
- 420px 到 560px

不要让 Drawer 承担主页面功能。Drawer 是辅助，不是主舞台。

---

### 7. Code Block / Config Block

展示命令、JSON、YAML、环境变量时必须使用 code block。

要求：

- monospace 字体
- 浅灰或深灰背景
- 圆角 8px
- 可复制
- 长内容换行或横向滚动，但不要撑破页面
- 敏感值默认打码

敏感 key 包含以下关键词时必须 mask：

- KEY
- TOKEN
- SECRET
- PASSWORD
- AUTH
- CREDENTIAL

示例：

MEMOS_API_KEY = ••••••••

不要把敏感环境变量输出到 console 或日志。

---

## 五、主题与视觉规范

### 1. 主题模式

全局支持：

- System
- Light
- Dark

默认：
- System

用户选择必须持久化。

主题切换入口：
- Sidebar 顶部 NoNo Harness 右侧
- Settings 中也可提供完整设置

---

### 2. 浅色主题

浅色主题不要用刺眼纯白铺满。

建议：

- App background：#F7F7F8
- Sidebar background：#FFFFFF 或 #F9FAFB
- Card background：#FFFFFF
- Primary text：#111827
- Secondary text：#6B7280
- Border：#E5E7EB
- Muted background：#F3F4F6
- Selected nav：#F1F2F4
- Accent：蓝紫或系统蓝，克制使用

---

### 3. 深色主题

深色主题不要全黑死黑。

建议：

- App background：#0B0B0D
- Sidebar background：#111114
- Card background：#18181B
- Primary text：#F4F4F5
- Secondary text：#A1A1AA
- Border：#27272A
- Muted background：#1F1F23
- Selected nav：#27272A

---

### 4. 颜色使用原则

颜色只用于：

- 状态
- 选中
- 主要操作
- 风险提示
- 轻量分类

不要给每个模块搞一套花里胡哨的颜色。Harness Manager 应该像工具，不像糖果店。

---

### 5. 可访问性

要求：

- 文本与背景有足够对比度
- 状态不能只靠颜色表达，必须有文本或图标
- hover / selected / disabled 状态清晰
- 小字体不要低于 12px
- 正文建议 14px 到 15px
- 页面标题建议 24px 到 30px

---

## 六、模块设计原则

## 1. Dashboard 设计原则

Dashboard 是全局总览，不是 Coming Soon 大墓碑。

目标：

让用户看到整个 Harness 状态。

必须展示：

- Agents 数量和异常数
- Skills 数量和缺失描述数
- MCP Server 数量和异常数
- Memory 状态和体检分数
- Knowledge 数量
- 最近使用资源
- 最近健康问题

布局：

- 顶部总览卡片
- 中部最近活动
- 右侧健康问题
- 底部资源趋势，后续

不要做：
- 大面积空白
- 只有 Coming Soon
- 没有任何可操作入口

---

## 2. Agents 页面设计原则

Agents 页面是“本地 Agent 客户端控制台”。

用户第一眼要知道：

- 有哪些 Agent
- 哪些能启动
- 哪些是 CLI / App / IDE Plugin
- 配置路径在哪
- 最近是否使用
- 有没有路径缺失或不可启动

推荐结构：

Header / Toolbar
Pinned Agents 快速启动区
Agent List
Agent Detail Inspector

主展示方式：
- 高信息密度列表
- 分组列表

卡片只用于：
- Pinned Agents 快速启动

详情 Tabs：

- Overview
- Launch
- Resources
- Usage
- Health

禁止：
- 只做大卡片网格
- 只展示名称、类型、active
- 把路径输入框固定在页面顶部
- 允许任意 shell 命令执行

---

## 3. Skills 页面设计原则

Skills 页面是“能力资产库”。

用户第一眼要知道：

- 有多少技能
- 每个技能能做什么
- 来自哪个资源库
- 类型和分类是什么
- 哪些缺少描述
- 哪些可复用

推荐结构：

Header / Toolbar
Skill List
Skill Detail Inspector
Skill Source Drawer

主展示方式：
- 列表
- 名称 + 中文描述 + 类型 + 分类 + 状态

资源库管理：
- 放 Drawer
- 不固定占用顶部空间

详情 Tabs：

- Overview
- Metadata
- Content
- Usage
- Health

信息优先级：

1. 技能名称
2. 中文描述
3. 类型 / 分类 / 状态
4. 来源资源库
5. 操作
6. 路径
7. 原始 Markdown / YAML

禁止：
- 顶部长期展示资源库大卡片
- 列表只显示名称和路径
- 让路径比描述更显眼
- 自动联网生成描述
- 执行脚本

---

## 4. MCP 页面设计原则

MCP 页面是“MCP 资产管理台”，不是配置文件阅读器。

用户第一眼要知道：

- 有哪些 MCP Server
- 哪些可用
- 它们暴露了哪些 Tools / Resources / Prompts
- 来源于哪个配置
- 有没有环境变量缺失或风险

推荐结构：

Header / Toolbar
MCP Server List
MCP Detail Inspector
MCP Scan Drawer

主展示方式：
- 高信息密度列表
- 不使用小卡片网格作为主视图

详情 Tabs：

- Overview
- Tools
- Resources
- Prompts
- Config
- Usage
- Health

配置展示原则：

- command / args / env 放 Config Tab
- env 敏感值默认打码
- 原始 JSON 放折叠区域或 Raw 区
- 不要把配置参数放在首屏中心

禁止：
- 窄卡片网格
- 大量文本被截断
- 环境变量明文展示
- 启动 MCP Server，除非后续阶段明确实现
- 原始 JSON 堆满详情页

---

## 5. Memory 页面设计原则

Memory 页面是“本地记忆资产与健康中心”。

用户第一眼要知道：

- 当前链接了哪些记忆目录
- 记忆如何分类
- 文件数量和体积
- 最近更新时间
- 记忆健康分数
- 是否有重复、冲突、过期、损坏

推荐结构：

Header / Toolbar
Memory Source List / Memory Category List
Memory Detail Inspector
Health Check Summary

主展示方式：

左侧：
- 记忆目录
- 记忆分类
- 体检分数

中间或主列表：
- 记忆条目列表

右侧：
- 记忆详情 / 体检问题

记忆分类：

- 长期记忆
- 用户偏好
- 会话摘要
- Rollout Summary
- 项目记忆
- Closeout
- 临时记忆
- 异常记忆
- 归档记忆

详情 Tabs：

- Overview
- Content Preview
- Related Projects
- Health
- Raw

体检项：

- 路径是否存在
- 文件是否可读
- 格式是否正确
- 分类是否缺失
- 是否重复
- 是否冲突
- 是否过期
- 是否过大
- 是否被失效 Agent 引用

禁止：
- 把 Memory 做成普通文件浏览器
- 默认读取并展示大量隐私内容
- 自动上传记忆内容
- 把隐私内容写入日志

---

## 6. Knowledge 页面设计原则

Knowledge 页面是“知识库资产管理台”。

用户第一眼要知道：

- 有哪些知识库
- 是通用知识库还是项目知识库
- 文档数量
- 最近更新时间
- 是否已索引
- 绑定哪些项目

推荐结构：

Header / Toolbar
Knowledge Base List
Knowledge Detail Inspector

知识库类型：

- Obsidian Vault
- VK Project Knowledge
- IMA Local Index
- Project Docs
- Wiki
- Learning Materials

Scope：

- general
- project_only

内置原则：

- IMA 是默认云端知识库
- VK 是本地项目知识库，只保留正在进行的项目资料

详情 Tabs：

- Overview
- Documents
- Projects
- Index
- Health

禁止：
- 把 Knowledge 做成完整笔记软件
- 一开始就做复杂 embedding 检索
- 默认扫描整个 Documents
- 混淆 IMA 和 VK 的职责

---

## 7. Projects 页面设计原则

Projects 页面是“项目作战台”。

用户第一眼要知道：

- 有哪些项目
- 每个项目绑定了哪些 Agent
- 用了哪些 Skills
- 用了哪些 MCP
- 关联哪些 Memory
- 关联哪些 Knowledge
- 项目健康状态如何

推荐结构：

Header / Toolbar
Project List
Project Detail Inspector

详情 Tabs：

- Overview
- Agents
- Skills
- MCP
- Memory
- Knowledge
- Activity
- Health

项目详情应该展示资源关系，而不是只展示仓库路径。

示例：

ChatHub
Agents：Codex、Claude Code
Skills：model_compare_review、github_release
MCP：github、filesystem
Memory：chathub_project_memory
Knowledge：VK/chathub

禁止：
- 只做项目路径列表
- 不展示资源绑定
- 过早做复杂图谱，第一阶段可以列表化

---

## 8. Analytics 页面设计原则

Analytics 页面是“资源使用价值判断”。

用户第一眼要知道：

- 哪些 Agent 最常用
- 哪些 Skills 最常用
- 哪些 MCP 最常用
- 哪些资源长期未使用
- 哪些资源最近变热
- 不同 Agent 使用资源的分布

推荐结构：

Header / Toolbar
Metric Cards
排行榜
趋势图
按模块筛选

核心指标：

- 启动次数
- 复制路径次数
- 复制引用次数
- 打开详情次数
- 扫描次数
- 最近使用时间
- 近 7 天 / 30 天使用量

第一阶段只统计 Harness 内部事件，不要假装知道 Agent 内部真实调用。

禁止：
- 造假统计
- 把 UI 点击次数说成真实调用次数
- 一开始做复杂 BI

---

## 9. Health Check 页面设计原则

Health Check 是“全局体检中心”。

用户第一眼要知道：

- 整体健康分
- 严重问题数量
- 哪些模块有异常
- 哪些问题需要立即处理
- 如何修复

推荐结构：

Header / Toolbar
Health Score
Issue List
Issue Detail Inspector

问题严重等级：

- critical
- error
- warning
- info

问题来源：

- Agent
- Skill
- MCP
- Memory
- Knowledge
- Project

Issue List 每项显示：

- 严重等级
- 问题标题
- 影响资源
- 简短描述
- 修复建议
- 状态

详情 Tabs：

- Overview
- Evidence
- Fix Suggestion
- Related Resources

禁止：
- 只有分数没有问题
- 只有问题没有修复建议
- 自动修复高风险问题
- 隐藏错误原因

---

## 七、各模块统一信息优先级

每个资源都应该尽量遵守这个信息顺序：

1. 名称
2. 中文描述
3. 状态
4. 类型 / 分类 / 来源
5. 关键计数
6. 最近时间
7. 操作
8. 路径
9. 配置
10. 原始数据

这条非常重要。

不要让路径、JSON、命令参数压过“这个东西能做什么”。

---

## 八、交互规范

### 1. 主操作按钮

每个页面最多 1 到 2 个主按钮。

例如：

Agents：
- 自动发现
- 添加 Agent

Skills：
- 扫描全部
- 管理资源库

MCP：
- 自动发现配置
- 扫描目录

Memory：
- 添加记忆目录
- 运行体检

Knowledge：
- 添加知识库
- 扫描索引

Projects：
- 添加项目

Health Check：
- 运行全局体检

不要每个页面顶部堆 5 个同等重量按钮。

---

### 2. 删除操作

删除必须确认。

确认内容要说明：

- 删除的是索引还是本地文件
- 是否会影响原始文件
- 是否可恢复

默认删除只删除 Harness 索引，不删除本地文件。

---

### 3. 扫描操作

扫描必须显示：

- 扫描中状态
- 扫描结果摘要
- 新增数量
- 更新数量
- 异常数量

扫描失败不能让页面崩掉。

---

### 4. 编辑操作

编辑分两类：

1. 编辑 Harness 元数据
2. 编辑本地文件

必须区分清楚。

编辑本地文件前：
- 显示路径
- 校验格式
- 保存前备份
- 保存后刷新索引

---

### 5. 启动操作

Agent 启动必须遵守安全边界：

- 只启动用户明确配置的 App 或安全 open 命令
- 不允许任意 shell
- 启动失败显示原因
- 记录 launch_count 和 last_launched_at

---

## 九、安全与隐私设计原则

### 1. 默认本地

不联网、不上传、不自动调用 AI。

### 2. 默认只读

扫描和展示默认只读。

写入必须用户明确触发。

### 3. 默认不执行

Skills、MCP、脚本都不自动执行。

### 4. 敏感内容不展示

API Key、Token、Secret 默认打码。

### 5. 日志不记录正文

不要把 Skill 内容、Memory 内容、API Key、用户路径详情写入日志。

### 6. 路径访问受控

只访问用户添加或授权的目录。

不默认扫描：
- /
- ~
- ~/.ssh
- ~/Library/Keychains
- ~/Library/Messages
- ~/Library/Mail

---

## 十、文案规范

### 1. 模块标题

统一中文标题 + 英文对象名可选。

推荐：

- Dashboard：总览
- Agents：智能体客户端
- Skills：技能管理
- MCP：MCP 服务器
- Memory：记忆系统
- Knowledge：知识库
- Projects：项目
- Analytics：使用统计
- Health Check：健康检查
- Settings：设置

### 2. 描述文案

每个页面副标题要说明用途。

示例：

Agents：
启动、配置并管理本机 Agent 客户端。

Skills：
管理本地提示词、脚本与工作流能力。

MCP：
管理 MCP Server、工具、资源与配置。

Memory：
查看本地记忆目录，分类记忆并检查健康状态。

Knowledge：
管理 Obsidian、VK 与项目知识库。

Projects：
按项目组织 Agent、Skills、MCP、Memory 与 Knowledge。

Analytics：
查看资源使用频率与价值分布。

Health Check：
检查路径、配置、权限、重复与异常资源。

---

## 十一、禁止事项总表

全局禁止：

1. 不要用大卡片网格承载复杂资源列表。
2. 不要把路径输入框固定占用页面顶部。
3. 不要把配置 JSON 放在首屏中心。
4. 不要让路径比描述更显眼。
5. 不要让每个页面使用不同布局。
6. 不要出现双重无意义滚动。
7. 不要无空状态。
8. 不要无错误状态。
9. 不要无加载状态。
10. 不要明文展示敏感环境变量。
11. 不要自动联网。
12. 不要自动执行脚本。
13. 不要默认扫描全盘。
14. 不要为了视觉效果引入大型依赖。
15. 不要提前实现不在当前阶段的复杂功能。
16. 不要把未实现功能伪装成已实现。
17. 不要把 UI 点击统计说成真实 Agent 调用统计。
18. 不要让 Agent 页面变成 Logo 墙。
19. 不要让 MCP 页面变成配置文件阅读器。
20. 不要让 Memory 页面变成普通文件浏览器。

---

## 十二、开发执行要求

以后每次开发某个页面前，必须先输出：

1. 当前页面目标
2. 当前页面主要用户任务
3. 页面布局结构
4. 信息优先级
5. 会复用哪些全局组件
6. 会新增哪些组件
7. 哪些功能本阶段不做
8. 验收标准

没有完成这 8 项确认，不要直接写代码。

每次 UI 改造必须检查：

1. 是否符合 AppShell 规范
2. 是否有 Header / Toolbar
3. 是否使用合适的 List + Inspector
4. 低频配置是否进入 Drawer / Sheet
5. 是否有搜索和筛选
6. 是否有空、加载、错误状态
7. 是否支持浅色 / 深色主题
8. 是否没有横向溢出
9. 是否没有双重滚动
10. 是否没有破坏已有业务逻辑

---

## 十三、最终设计方向总结

NoNo Harness Manager 的统一设计语言是：

“本地 Agent 资产控制台”

它应该：

- 像 macOS 工具
- 像资源管理台
- 像控制中心
- 像可诊断的资产系统

它不应该：

- 像普通后台
- 像卡片模板
- 像文件浏览器
- 像配置 JSON 查看器
- 像多个页面拼起来的 Demo

所有模块都遵守：

Header + Toolbar
List + Detail Inspector
Drawer for configuration
Tabs for detail
Description before path
Status before raw config
Local first
Safe by default