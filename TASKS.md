# 开发任务与验收记录

状态说明：`[ ]` 未完成；`[x]` 已验证完成。只有真实验证后才能勾选。

## Phase 0：工程初始化
- [ ] 使用 Cocos Creator 3.8 LTS 建立合法的 2D 工程
- [ ] 配置竖屏设计与微信小游戏构建目标
- [ ] 创建 MainGame 场景并成功预览
- [x] 保持 README、AGENTS、PRD 与代码一致

## Phase 1：最小经营闭环（最高优先级）
- [x] GameConfig 与类型定义
- [x] EconomyManager、UpgradeManager
- [x] OrderManager 单订单状态机（WAITING → COOKING → SERVED → EXITED）
- [x] SaveManager 与损坏数据恢复
- [x] GameManager 核心编排（自动化测试通过）
- [ ] 可交互 Cocos GameUI 引擎运行验证（动态 UI 源码与官方 3.8.8 API 类型检查已完成）
- [x] 订单 2 秒计时、结算只触发一次
- [x] 10 级升级与金币扣除
- [x] 20 单连续操作和存档恢复测试
- [ ] Cocos 编辑器实际预览验证

## Phase 2：菜谱收集
- [x] RecipeConfig、RecipeManager
- [x] 烤肠（初始）、奶茶（累计收入 500）、炸串（累计收入 2000）
- [x] RecipeBookUI 浏览器交互：已解锁、未解锁、详细信息、进度与返回
- [x] Cocos RecipeBookUI 动态源码与官方 3.8.8 UI 类型检查
- [ ] Cocos RecipeBookUI 编辑器实际交互/安全区验证
- [x] 图鉴与经营商品共用解锁状态
- [x] 兼容 Phase 1 存档，覆盖重复解锁测试

## Phase 3：视觉效果
- [x] 浏览器国潮霓虹夜市主界面与两种 Q 版顾客
- [x] Cocos 同源矢量/动态 UI 源码与官方 3.8.8 类型检查
- [x] 浏览器烹饪特效、单次金币反馈、升级特效及 Cocos 对应源码
- [x] 浏览器 320/390/720 布局、动效降级与节点数量检查
- [ ] Cocos/微信视觉、触摸、安全区、真机性能与构建验证

## Phase 4：变现与微信构建
- [ ] MockAdService、奖励发放去重与失败处理
- [ ] 完整营业任务与离线收益
- [ ] 在满足平台条件后接入真实广告
- [ ] 微信开发者工具构建、真机测试

## 验证日志
- 初始化：文档建立；尚未运行游戏、构建或测试。

### 2026-11-04 · Issue #1 / Phase 0–1

环境：Linux，Node v24.22.1，npm 11.9.0，TypeScript 5.9.3，
官方 @cocos/creator-types 3.8.8，Playwright 1.56.1，系统 Chromium。

已执行：
- `npm ci --cache /tmp/nightmarket-npm --ignore-scripts`：按锁文件安装依赖。
- `npm run typecheck`：独立核心严格检查 + Cocos UI 官方类型检查均通过。
- `npm test`：11 项通过，0 失败。覆盖 1 秒到店/2 秒制作、100 次重复点击、
  重复 tick 不重复结算、20 连单得到 200 金币、Lv1–10 公式与扣费、金币不足、满级、
  等待/制作中升级锁定参数、重启不补发订单、损坏/非法存档、存储异常重试、
  快照隔离和导入脚本的拒绝覆盖/版本校验。
- 浏览器端到端验证结果见下方追加记录。

交付：独立核心 `assets/scripts/core/GameCore.ts`、动态 `GameUI.ts`、
共享核心的浏览器演示、非覆盖式 Cocos 源码导入脚本、GitHub Actions 验证流程。
导入器测试使用临时 manifest 夹具，仅验证文件操作，**没有生成或验证真实 Cocos 工程**。

未验证/阻塞：当前无 Cocos Creator，因此合法工程初始化、MainGame 场景生成、
编辑器预览与实际 Cocos 构建未执行；微信开发者工具、微信真机、设备安全区、
后台恢复均未执行。不能将浏览器 DOM 演示或类型检查作为这些项目通过的证据。
Phase 0 的前三项和 Cocos 引擎运行验收保留未勾选。
下一步环境配置、最少场景操作与微信构建步骤见 `docs/COCOS_SETUP.md`。

浏览器最终验证：
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`：1 项端到端测试通过，0 失败，
  约 17.4 秒。真实 Chromium 页面 + Playwright 虚拟时钟驱动 20 单，验证制作期间禁用按钮、
  重复 click 无重复奖励、倒计时进度、200 金币结算、升级后 Lv2/150 金币、刷新恢复、
  损坏存档恢复和 320/390/720 宽度无横向溢出；页面脚本错误为 0。
- 已检查截图 `artifacts/browser-demo.png`（浏览器玩法演示，非 Cocos 截图）。
- 浏览器测试中修正了进度条取值 API，以及损坏存档需在新页面加载前注入的测试时机
  （旧页面 pagehide 会保存内存进度）；最终全部通过。
- `git diff --check`：通过。`AGENTS.md`、`docs/PRD.md` 保持原文。
- 新增 GitHub Actions 流程；云端 CI 状态以 PR 检查结果为准，不以本地通过代替。

### 2026-11-04 · Issue #3 / Phase 2

开发前已检查 PR #2：open、未合并，head 为 `b81e6a9`。
分支 `codex/issue-3-recipes` 基于 `origin/codex/issue-1-phase-0-1` 创建；
没有从旧 main 重写第一阶段核心。Phase 2 PR 以第一阶段分支为 base，只审查增量。

实现：
- 只读 RecipeConfig：ID、菜名、基础价格/时间、章节、稀有度、解锁条件与描述。
- RecipeManager 是经营订单池和图鉴的共同来源；按累计收入推导三种解锁，花钱不回锁。
- 订单按已解锁配置顺序轮换，创建时锁定该商品在当前等级的收益和耗时。
- 保留 v1 键与版本，新增可选 notifiedRecipeIds，只记录已读提示，不另存 unlocked 状态。
  旧存档经营字段不变，新字段非法时只修复新字段；通知显示即记录已读并保存。
- 浏览器收藏册和 Cocos RecipeBookUI 动态源码同步包含入口、返回、进度、条件、详情及弹窗。
- Cocos 通用控件工厂显式继承父节点 layer；导入脚本扩展至四份源码，仍拒绝覆盖已有文件。

实际验证（Node v24.22.1 / TypeScript 5.9.3 / 官方 Cocos 类型 3.8.8 / 系统 Chromium）：
- `npm run typecheck`：核心严格检查与全部 Cocos 动态 UI 类型检查通过。
- `npm test`：21 项通过，0 失败（第一阶段 11 项 + 菜谱 10 项）。
  覆盖 499/500、1999/2000，跳跃解锁/重复检查、花费不回锁、旧存档字段保留、
  新字段损坏修复、通知去重/重启、实际结算解锁、三菜谱轮换、Lv1–10 公式、
  奶茶/炸串在等待和制作中跨 Lv4/Lv7 升级锁定、存储失败重试和快照隔离。
- 原烤肠升级测试夹具 coins/totalEarned 从 1000 改为 400，保持只解锁烤肠，
  原收入与耗时断言全部保留；多商品情形由新增测试覆盖。导入器测试相应验证四份源码。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`：5 项通过，0 失败，约 27.3 秒。
  真实 Chromium + Playwright 虚拟时钟：原 20 连单回归、初始图鉴 1/3、锁定详情、
  320/390/720 宽度、500 解锁奶茶并制作/升级锁定、1999 跨阈值解锁炸串并制作、
  图鉴 3/3、旧存档迁移、弹窗未关闭即刷新不重复；所有页面脚本错误为 0。
- 已检查 `artifacts/recipe-book-locked.png` 和 `artifacts/recipe-book-complete.png`。
- `git diff --check`：通过。AGENTS.md、docs/PRD.md 未修改。

未验证：Cocos Creator 仍未安装；真实工程初始化、编辑器图鉴预览、引擎内触摸、
弹窗拦截、安全区、后台恢复，以及微信构建/开发者工具/真机都未执行。
图鉴浏览器通过、Cocos 类型检查通过不代表引擎验证通过。
规则与迁移说明见 `docs/RECIPES.md`，工程接入见 `docs/COCOS_SETUP.md`。
CI 实际状态以 Phase 2 PR 的 GitHub Actions 检查为准；未自动合并 PR。

### 2026-11-04 · Issue #5 / Phase 3

前置检查：PR #2、#4 均 open / 未合并；Phase 2 head `217a727`。
`codex/issue-5-neon-visuals` 从 `origin/codex/issue-3-recipes` 创建；
新 PR base 指向第二阶段分支，不从旧 main 重写，不自动合并前序或新 PR。

实现与范围：
- 原创程序矢量夜市、远景楼房灯牌、霓虹招牌、灯笼、暖色摊位、柜台、Q 版摊主和两种顾客。
- VisualStyle 共享色板/图形/Motion 配置；浏览器 SVG/DOM 与 Cocos Graphics/Label 两种渲染。
- 顾客入场/等待/完成离场、灯牌轻脉冲、灯笼摆动、火焰/蒸汽、金币浮字和升级 HUD 跳动。
- 图鉴霓虹收藏卡、同源食品图标、未解锁剪影与稀有度；保留全部详情、入口/返回及解锁提示。
- 完整/简洁模式，独立偏好键，不改经营存档；浏览器首次遵循系统 reduced-motion 偏好。
- 单一观察时间线、预建小量特效、隐藏经营页跳过图形更新、图鉴内容更新去重。
- 新增 docs/VISUAL_STYLE.md，列出色板、布局、动画时序、原创来源、资源命名和替换规范。
- 导入脚本复制七份源码，仍在写入前预检全部目标并拒绝覆盖用户资源。

实际验证（Node v24.22.1 / TypeScript 5.9.3 / 官方 Cocos 类型 3.8.8 / 系统 Chromium）：
- `npm run typecheck`：业务核心、共享视觉模型、全部 Cocos 动态 UI API 类型检查通过。
- `npm test`：25 项通过，0 失败（前两阶段 21 项 + 视觉 4 项）。
  新增验证：表现采样不改业务快照、两种顾客及入场离场、低动效固定变换、
  重启基线不补播金币/升级、重复观察不重启反馈、程序图形可复现及数量有界。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`：8 项通过，0 失败，约 37.1 秒。
  前两阶段 5 项继续通过；新增 3 项覆盖三种尺寸 CTA 无水平溢出/不重叠/在视口内，
  制作/升级/图鉴点击、重复制作、特效状态、不同顾客、简洁开关、刷新恢复、系统减少动态效果偏好。
- 补充视觉专测命令：`CHROMIUM_PATH=/usr/bin/chromium node --test --test-isolation=none tests/browser/visuals.test.mjs`。
  最终 3 项通过、0 失败，约 9.4 秒；含场景节点少于 400、多单后不累计增长检查。
- 实际生成九张截图：`artifacts/visuals/{ordinary,cooking,catalog}-{320,390,720}.png`；
  已查看 390 宽度普通营业/制作中/图鉴及 320 宽度普通营业截图。
  CI 既有 upload-artifact 将递归上传整个 artifacts 目录；截图非伪造，未作为游戏素材提交。
- `git diff --check` 通过；AGENTS.md、docs/PRD.md、GameCore.ts 保持原文。

未验证/限制：无 Cocos Creator，未运行引擎视觉预览、触摸/弹窗拦截、安全区、真实工程构建；
微信开发者工具、真机、后台恢复、低端设备 FPS/内存/GPU 均未实测。
浏览器可视化与 Cocos 类型检查不等于 Cocos 微信小游戏验证通过；对应验收保留未勾选。
CI 最终状态以新 PR 检查为准，未自动合并任何 PR。
