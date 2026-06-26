**Dashboard 不能做成“把 Agents / Skills / MCP 的数字再抄一遍”的垃圾堆**，那不叫 Dashboard，那叫数据复读机，人类已经发明表格了，不必再发明一遍。

我回顾一下你这个客户端的需求演化：

最开始你想做的是 **Skill 管理器**。后来扩展成 **Harness 客户端**，包含 Agents、Skills、MCP、Memory、Knowledge、Projects、Analytics、Health Check。但最近你又把核心目标收回来：**先把已有 Skills 管好，知道有哪些、干什么、怎么分类、哪些常用、哪些该清理、哪些该进化。**

所以现在 Dashboard 的定位应该是：

**每天打开 App 后，告诉你“现在最值得处理什么”，并给你入口。**

不是统计中心。不是报表页。不是功能目录。  
完整统计归 Analytics，异常诊断归 Health Check，具体整理归 Skills 页面。

研究里讲 dashboard / analytics 的价值重点在 “actionable insight”，也就是能转化成行动的洞察，而不是单纯堆指标；这对你这里非常关键，因为你的 Dashboard 如果只显示 Total 506、Agents 8、MCP 12，那就是一块会发光的废话板。  另外，dashboard 设计研究也指出常见仪表盘容易围绕指标和维度反复组织，所以我们更要避免在 Dashboard 里重复 Analytics 的活儿。 

---

## **Dashboard 应该解决的 4 个问题**

我建议 Dashboard 只回答这 4 个问题：

1. **我的 Harness 当前是否健康？**  
    有没有扫描失败、路径失效、危险配置、MCP 异常。
2. **我今天最该整理什么？**  
    缺描述、未分类、疑似重复、待进化、长期没用的 Skills。
3. **我常用入口在哪里？**  
    继续整理 Skills、扫描资源库、打开常用 Agent、查看 Proposals。
4. **最近发生了什么？**  
    最近扫描、编辑、归档、删除、启动 Agent、MCP 发现。

就这四个。别再塞别的。软件不是火锅，不是什么都加进去就更香。

---

# **我建议的 Dashboard 结构**

## **1. 顶部：今日状态栏**

放一句人能看懂的话，而不是一排冷冰冰的数字。

例如：

```text
今天有 23 个 Skills 需要整理，3 个 MCP 配置需要检查，暂无严重风险。
```

下方放 3 个轻量状态 chip：

```text
Skills 待整理 23
MCP 异常 3
Proposals 待确认 2
```

这些 chip 点击后跳转到对应页面和筛选条件。

注意：这里只显示**需要行动的数字**，不是所有总数。  
总数放 Analytics 或各模块页面，不要 Dashboard 里重复展示。

---

## **2. 主卡片：继续整理 Skills**

这是当前阶段 Dashboard 的主角。

你现在的产品重心是 Skill 管理，所以首页最重要的卡片应该是：

```text
继续整理 Skills

缺描述：12
未分类：35
待进化：8
疑似重复：5

[进入 Skills 整理]
```

点击后跳转 `/skills`，并默认进入上次停留的筛选视图，或者进入 `needs_review`。

这个卡片的意义不是展示“你有多少 Skills”，而是回答：

下一步该处理哪些 Skills？

这比 “Total 506” 有用多了。Total 506 只会让人类短暂兴奋，然后立刻失去人生方向。

---

## **3. 次级卡片：系统可用性**

这个区域只展示会影响使用的东西：

```text
系统可用性

Agents：8 个已发现，3 个可启动
MCP：12 个已发现，2 个需检查
Skill Sources：5 个资源库，1 个最近扫描失败
```

每一项都必须可点击：

- Agents 跳 `/agents`
- MCP 跳 `/mcp`
- Skill Sources 跳 Skills 资源库管理 Drawer 或 Skills 页面

这里不要展示完整列表。Dashboard 只负责提示和跳转。

---

## **4. 待处理队列**

这是 Dashboard 最应该有的东西。

可以叫：

```text
待处理
```

里面显示最多 5 条，不要无限滚动：

```text
1. 12 个 Skills 缺少描述
2. 35 个 Skills 未分类
3. 5 组疑似重复 Skills
4. 8 个 Skills 标记为待进化
5. 2 个 MCP 配置缺少说明
```

每条右侧一个按钮：

```text
处理
```

点击进入对应模块筛选。

这比什么趋势图有用。趋势图是给老板看的，待处理是给干活的人看的。你这个工具是你自己用，不必给自己装老板。

---

## **5. 最近活动**

显示最近 8 条 Harness 内操作：

```text
最近活动

10:42 编辑了 Skill 描述：web-artifacts-builder
10:30 归档了 Skill：old-prompt-tool
10:12 扫描 Skills 资源库：Default Skills
09:58 自动发现 MCP：QoderCN
09:40 启动 Agent：Codex
```

数据来源：

- `resource_usage_events`
- scan_logs
- agent launch events
- proposal events

如果暂时没接口，就先做空状态：

```text
暂无最近活动
开始整理 Skills 后，这里会显示你的操作记录。
```

不要伪造假活动。假数据是 UI 世界的泡沫经济。

---

## **6. 快捷操作区**

最多 4 个按钮：

```text
整理 Skills
扫描 Skills
自动发现 Agents
自动发现 MCP
```

不要放 10 个按钮。按钮太多就等于没有重点。

未来可以加：

```text
查看 Proposals
运行 Health Check
```

但当前阶段别塞满。

---

# **Dashboard 不应该放什么**

这些不要放 Dashboard：

1. 不放完整 Skills 排行榜  
    这个属于 Analytics。
2. 不放趋势图  
    这个也属于 Analytics。
3. 不放所有 Agents 列表  
    属于 Agents 页面。
4. 不放所有 MCP 列表  
    属于 MCP 页面。
5. 不放复杂 Health Check 明细  
    属于 Health Check 页面。
6. 不放 Projects / Memory / Knowledge 大入口墙  
    现在它们还不是核心，别在首页抢注意力。
7. 不放 Coming Soon 模块宣传  
    用户打开首页不是来看未来主义海报的。

---

# **我建议的 Dashboard 版式**

```text
Dashboard
本地 Harness 今日状态与待处理事项

[今日状态句子]
今天有 23 个 Skills 需要整理，3 个 MCP 配置需要检查，暂无严重风险。

┌──────────────────────────────┐
│ 继续整理 Skills               │  主卡片，占左侧 60%
│ 缺描述 12  未分类 35          │
│ 待进化 8   疑似重复 5         │
│ [进入整理]                    │
└──────────────────────────────┘

┌──────────────┐ ┌──────────────┐
│ 系统可用性   │ │ 快捷操作      │
│ Agents 8     │ │ 整理 Skills   │
│ MCP 12       │ │ 扫描 Skills   │
│ Sources 5    │ │ 发现 Agents   │
└──────────────┘ └──────────────┘

┌──────────────────────────────┐
│ 待处理                         │
│ 12 个 Skills 缺描述     [处理] │
│ 35 个 Skills 未分类     [处理] │
│ 5 组疑似重复            [处理] │
└──────────────────────────────┘

┌──────────────────────────────┐
│ 最近活动                       │
│ 10:42 编辑 Skill 描述          │
│ 10:12 扫描 Skills 资源库       │
└──────────────────────────────┘
```

---

# **当前阶段 Dashboard MVP**

我建议第一版只做这些：

## **必做**

- 今日状态一句话
- Skills 待处理主卡片
- 系统可用性小卡片
- 快捷操作
- 待处理队列
- 最近活动空状态或真实 usage_events

## **暂不做**

- 趋势图
- 排行榜
- 全模块完整统计
- AI 建议
- 图谱
- 项目作战台
- Memory/Knowledge 内容聚合

---

# **给开发的提示词**

```text
请开发最小可用 Dashboard 页面，替换当前 Coming Soon 占位。

Dashboard 的定位不是 Analytics，也不是功能目录，而是“每日打开 App 后的本地 Harness 状态与待处理入口”。它只回答四个问题：
1. 当前 Harness 是否健康？
2. 今天最该处理什么？
3. 高频操作入口在哪里？
4. 最近发生了什么？

一、页面结构

1. 顶部 Header
标题：Dashboard
副标题：本地 Harness 今日状态与待处理事项

2. 今日状态句子
根据当前数据生成一句简短状态：
例如：
今天有 12 个 Skills 缺少描述，35 个 Skills 未分类，暂无严重风险。

如果没有数据：
欢迎使用 NoNo Harness。先从添加或扫描 Skills 资源库开始。

3. 继续整理 Skills 主卡片
展示当前最重要的 Skill 整理数据：
- 缺描述数量
- 未分类数量
- 待整理数量
- 待进化数量
- 疑似重复数量
- 已归档数量可不显示，或放次级

主按钮：
进入 Skills 整理

点击后跳转 /skills，并尽量保留或设置合适筛选视图。

4. 系统可用性卡片
展示：
- Agents 数量
- 可启动 Agents 数量，如果有
- MCP Servers 数量
- Skill Sources 数量
- Proposals 待处理数量，如果有接口
- Health Issues 数量，如果有接口，没有就显示“尚未启用”

这些数字必须是轻量状态，不要做趋势图。

5. 待处理队列
最多显示 5 条：
- Skills 缺描述
- Skills 未分类
- Skills 待整理
- Skills 待进化
- Skills 疑似重复
- MCP 待检查，如果有
- Proposals 待确认，如果有

每条有“处理”按钮，跳转对应页面。

6. 快捷操作
最多 4 个按钮：
- 整理 Skills
- 扫描 Skills
- 自动发现 Agents
- 自动发现 MCP

如果某个动作暂时不能直接执行，就跳转对应页面，不要做假按钮。

7. 最近活动
优先从 resource_usage_events / scan_logs / agent launch events 获取。
如果接口暂时没有，显示空状态：
暂无最近活动。开始整理 Skills 后，这里会显示你的操作记录。

二、数据边界

Dashboard 可以读取：
- skills
- skill_sources
- agents
- mcp_servers
- proposals
- usage_events / scan_logs，如果已有接口

Dashboard 不要创造假数据。
没有接口就显示空状态或“尚未启用”。

三、不要做

1. 不要做趋势图。
2. 不要做排行榜。
3. 不要做完整 Analytics。
4. 不要展示所有 Skills 列表。
5. 不要展示所有 Agents 列表。
6. 不要展示所有 MCP 列表。
7. 不要把 Memory / Knowledge / Projects 做成大入口墙。
8. 不要做 AI 自动建议。
9. 不要伪造最近活动。
10. 不要让 Dashboard 和 Analytics 职责重复。

四、视觉要求

1. Dashboard 要简洁，不要卡片过多。
2. 最重要的是“继续整理 Skills”主卡片。
3. 其他卡片只做辅助。
4. 页面打开后，用户 3 秒内知道下一步该做什么。
5. 空数据状态要友好，引导用户去扫描 Skills。
6. 保持浅色/深色主题一致。
7. 不要横向滚动。
8. 不要无限滚动大列表。

五、验收标准

1. 首页不再显示 Coming Soon。
2. Dashboard 能显示今日状态句子。
3. Dashboard 能显示 Skills 待处理主卡片。
4. Dashboard 能跳转到 Skills 页面。
5. Dashboard 能显示 Agents / MCP / Skill Sources 的基础状态。
6. Dashboard 有待处理队列。
7. Dashboard 有最近活动区域或清晰空状态。
8. Dashboard 不包含趋势图和排行榜。
9. Dashboard 不和 Analytics 重复。
10. 没有数据时也不空白。
```

---

我的最终建议很明确：

**Dashboard 不是“总数据页”，而是“下一步行动页”。**

你这个客户端现在最重要的是帮你整理 Skills，所以 Dashboard 第一版就应该围绕“今天该整理哪些 Skills”设计。等 Memory、Knowledge、Projects 真做起来以后，再把 Dashboard 扩展成更完整的 Harness 状态页。现在别急着堆功能，不然首页会变成一个圆角卡片养殖场，看着很忙，实际一点也不帮你做决定。