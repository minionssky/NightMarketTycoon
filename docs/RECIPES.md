# Phase 2 · 夜市百味录

## 开发基线

开始开发时 PR #2 仍为 open / unmerged；本分支 `codex/issue-3-recipes` 直接基于
其 head `b81e6a9`（`codex/issue-1-phase-0-1`），不是从旧 main 重写核心。
本次 PR 以第一阶段分支为 base，只呈现 Phase 2 差异；应先审阅合并 PR #2，
再将 Phase 2 PR 改为面向更新后的 main。不要自动合并任何 PR。

## 统一数据与经济规则

`assets/scripts/core/GameCore.ts` 中的只读 `RecipeConfig` 是唯一菜谱配置。
章节和稀有度当前是展示字段，不引入随机性或掉落机制。

| ID | 菜名 | 基础金币 | 基础秒数 | 累计收入解锁 |
| --- | --- | ---: | ---: | ---: |
| sausage | 烤肠 | 10 | 2 | 0 |
| milk_tea | 奶茶 | 25 | 4 | 500 |
| fried_skewer | 炸串 | 45 | 5 | 2000 |

每种菜谱的收益为 `Math.round(basePrice * 1.2 ** (L - 1))`；
制作时间为 `baseDuration * factor`，Lv1–3 factor=1，Lv4–6 为 0.9，Lv7–10 为 0.8。
升级费用与等级上限沿用 Phase 1。GameConfig.baseIncome 保留为烤肠配置的兼容别名。

`RecipeManager` 根据经营账本的 `totalEarned` 查询解锁、生成图鉴快照、检查阈值，
订单池也使用同一管理器的 `unlockedRecipes`，UI 不存储额外的 unlocked 状态。
花费金币只改变 coins，不降低 totalEarned。业务快照为副本，底层配置冻结。

订单使用一个会话内轮换游标，按配置顺序从已解锁列表选择；每次创建一单才前进。
仅烤肠时一直生成烤肠；三种均解锁时为烤肠→奶茶→炸串→循环。
新菜谱只影响后续订单，不改写当前订单。创建时锁定 recipeId、收入和时长，
WAITING 或 COOKING 中升级均不会改变当前单。
重启不恢复进行中订单或游标，不补发进行中订单奖励；新会话从烤肠开始。
Phase 4 新增显式领取的离线收益与任务/Mock 额外收入，统一计入 totalEarned 并使用同一解锁管理器，见 `MONETIZATION.md`。

## 解锁事件与兼容存档

键仍是 `night_market_save_v1`，version 仍是 1；新增可选字段 `notifiedRecipeIds`。
不存储第二份 unlockedRecipeIds，不清除旧版合法的金币、等级、累计收入、订单数与时间戳。
加载旧版数据时按累计收入惰性推导解锁。没有已读记录的已解锁新菜谱会提示一次。

- `checkUnlocks` 返回这次跨阈值产生的 `recipe-unlocked` 事件；重复检查不重复产生事件。
- `snapshot.unlockNotifications` 是待展示通知，按配置顺序排队。无论当前在图鉴还是经营页都可弹出。
- 两种 UI 在**弹窗实际显示时**调用 `acknowledgeRecipeUnlock` 并保存已读状态；
  即使未点击关闭便重启，也不重复同一通知。多条消息逐条展示，不覆盖当前弹窗。
- 有效的 acknowledged ID 必须已知、非初始菜谱且收入达到阈值；未知 ID、重复 ID、
  未解锁 ID、非数组等新字段错误只修复该字段，不清空合法经营数据。
- 写存档失败时本次会话仍去重，保留内存进度并提示存储异常；后续保存重试。
  存储一直不可用或进程在写入前崩溃时，无法保证跨进程已读记录持久化。
- 整体损坏存档或非法经营字段仍沿用 Phase 1 的默认恢复逻辑。

## 两端 UI 与验证

浏览器：经营页进入“菜谱收藏册”，可点击三种菜谱，查看章节、稀有度、基础/当前等级
售价和耗时、解锁条件及差额，再返回经营；已收集进度从 1/3 到 3/3。
Cocos：同等功能由动态 `RecipeBookUI` 生成；`UiFactory` 统一创建控件并继承父节点 layer，
`GameUI` 负责页面切换、共享核心和一次性通知，无额外属性拖拽绑定。
打开图鉴或弹窗不会暂停前台制作；切后台仍使用 Phase 1 的保存和暂停逻辑。

```sh
npm ci
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:browser
# 或 CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
npm run preview
```

自动化浏览器测试使用真实 Chromium 和虚拟时钟，覆盖第一阶段经营回归、图鉴交互、
边界解锁、订单轮换、旧存档迁移、通知未关闭重启去重、320/390/720 宽度无横向溢出。
截图输出至 `artifacts/recipe-book-locked.png`、`artifacts/recipe-book-complete.png`。

Phase 1 原升级测试的夹具由 coins/totalEarned=1000 改为 400，使其仍只解锁烤肠，
保留所有原价/原时长断言；否则新的合法轮换会让第二单变成奶茶。新增测试单独覆盖
奶茶和炸串在 WAITING/COOKING 中跨 Lv4/Lv7 的参数锁定，未通过削弱断言掩盖回归。

本环境无 Creator，只有 TS/官方 3.8.8 UI 类型检查与浏览器验证；Cocos 工程、编辑器
图鉴预览、引擎内点击与安全区、微信构建/真机均**未验证**。接入步骤见 `COCOS_SETUP.md`。
