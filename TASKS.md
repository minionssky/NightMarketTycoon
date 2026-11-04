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
- [x] MockAdService、唯一请求 ID、异步竞争/重复回调去重与失败处理（核心/浏览器验证）
- [x] 免费离线收益、4 小时上限、北京时间每日三任务、兼容存档和领取事务
- [x] 浏览器与 Cocos RewardsUI 源码同步、官方类型检查、非覆盖式导入
- [x] 微信安全配置示例、只读预检与本机验收清单
- [ ] Cocos/微信任务与离线生命周期、真实设备验证
- [ ] 在满足平台条件后接入真实广告
- [ ] 微信开发者工具构建、真机测试

## Issue #9：真实工程集成验收
- [x] 基于 Phase 4 最新提交检查分支链与工具环境
- [x] 非覆盖式源码/编辑器扩展安装器、自动 Canvas/Camera/GameUI 挂载源码
- [x] 官方 API 类型检查、扩展 TypeScript 编译、L1 契约/进程/安全测试
- [x] 真实构建执行器、独立输出与日志校验、当前 blocked 分级证据
- [ ] L2：合法 Creator 项目存在，扩展真实执行、引擎编译与运行验证
- [ ] L3：实际微信小游戏构建与开发者工具预览/账号权限验证
- [ ] L4：真机玩法、安全区、触摸、后台恢复、性能验证
- [ ] L5：真实广告（本次不要求，继续禁用）

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

### 2026-11-04 · Issue #7 / Phase 4

开始已核对 PR #2、#4、#6：均 open / 未合并。分支 `codex/issue-7-monetization`
从第三阶段 `origin/codex/issue-5-neon-visuals` 最新 `2dfcd6f` 创建，新 PR base 指向该分支。
未从旧 main 重写，未自动合并任何 PR。原经营、菜谱、霓虹视觉和简洁模式保留。

交付：
- 离线基础 0.1 金币/秒 × 1.2^(L-1)，最多 4 小时，整数/有限时间校验、单调水位，
  普通免费领取和自愿额外一倍分开；完整区间只结算一次，超过上限的时间不能刷新分段再领。
- 北京时间 UTC+8 自然日任务：5 单/15 单/收取 300 金币，奖励 30/80/60；
  迁移不把历史数据当进度，任务奖励不推动任务自身，所有新增收入仍推动统一累计收入解锁。
- IRewardAdService、Mock 完成/提前关闭/失败/重复回调，两种自愿入口与唯一 request ID；
  busy 保护、异步锁定原订单金额、领奖与 receipt 原子保存、刷新旧实例 revision 检查。
- 保留 v1 键与 version，新增可选 progress schema=1；经营字段与 notifiedRecipeIds 保留，
  新字段损坏只重建新状态，不发历史任务/广告奖励。真实广告适配器仅环境检查并明确 disabled。
- 浏览器和 Cocos 动态 RewardsUI 同步有入口、进度、普通领取、Mock 结果切换、关闭/取消和失败提示；
  导入器扩展至八份源码，仍预检全部目标并拒绝覆盖。
- 新增 MONETIZATION.md、WECHAT_BUILD.md、wechat.example.json、只读预检脚本；CI 保存预检 JSON。

实际执行（Node v24.22.1 / TypeScript 5.9.3 / Cocos 类型 3.8.8 / 系统 Chromium）：
- `npm run typecheck`：核心与全部 Cocos UI 官方 API 类型检查通过。
- `npm test`：41 项通过，0 失败（前序 25 项 + Phase 4 核心 14 项 + 微信预检 2 项）。
  覆盖离线 0/倒退/非法时间/4 小时上限、刷新重复领取、旧/损坏新字段迁移，
  每日三任务达标/日切/倒退/恢复/只领一次、Mock 完成/跳过/失败/重复/异常，
  异步竞争及制作/升级期间金额锁定、旧回调不覆盖新存档、写失败无奖励且可重试。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`：11 项通过，0 失败，约 45 秒。
  原 8 项全部保留；新增 3 项验证离线免费领取、Mock 关闭/失败重试与重复回调一次发奖、
  解锁一致、任务断点恢复和只领一次、三宽度任务面板、存储失败提示/重试。
- 已查看 artifacts/phase4/offline-390.png、tasks-320.png；另生成 tasks-390/720.png，
  原三组视觉截图继续生成；既有 CI upload-artifact 递归上传整个 artifacts 目录。
- `node scripts/wechat-preflight.mjs`：实际退出码 2、status=blocked，规划配置有效，
  缺少 Creator、微信开发者工具、正式引擎工程和实际授权 AppID。buildValidated/deviceValidated 均 false。
- `git diff --check`：通过。AGENTS.md、docs/PRD.md 未修改。

未验证/边界：无 Creator 和微信开发者工具，未执行合法工程创建、引擎预览、
实际构建、触摸/安全区、后台返回、真机 FPS/内存/GPU 或真实广告开通/回调。
浏览器与类型检查不等于 Cocos 微信小游戏通过；真实广告、微信构建和真机项保持未勾选。
本地时间与存档不是服务端反作弊，也不支持多窗口并行营业；不包含后端、支付或发布审核。
新 PR 的实际 CI 状态另以 GitHub Actions 为准。

### 2026-11-04 · AppID 补充

已将用户提供的 `wx3f8534584b5b98af` 写入 `config/wechat.json`，预检默认读取项目配置；
`wechat.example.json` 继续保留可复用占位模板。真实广告继续关闭，没有增加 AppSecret。
重新运行预检：AppID 格式阻塞已解除，但仍因缺少 Creator、微信开发者工具及正式工程返回 blocked / 退出码 2。
平台账号权限、实际构建及真机仍未验证。预检测试同步覆盖项目 AppID 与占位模板。
- AppID 补充验证：`npm run typecheck` 通过；`npm test` 41 项通过、0 失败；`git diff --check` 通过。

### 2026-11-04 · Issue #9 / Cocos 工程集成

基线：PR #2/#4/#6/#8 均 open / 未合并；`codex/issue-9-cocos-integration`
从最新 Phase 4 `8573f305bf1efbff66ae0c2aa89525e582483c74` 创建，base 为 codex/issue-7-monetization。
没有重开发玩法，也不自动合并。AGENTS.md、docs/PRD.md、GameCore.ts 保持原文；
GameUI 仅增加只读观测接口，现有经济、订单、菜谱和奖励逻辑未改。

实际环境：Debian GNU/Linux 13 / Linux x64，Node v24.22.1。
检查 PATH、/opt、/usr/local 及常见工具位置，未发现 CocosCreator、creator、微信开发者工具或 Wine，
没有编辑器创建的正式工程或导出构建配置。官方 Dashboard 安装文档列出 Windows/macOS，
本次未拿非官方 Linux 移植、裸引擎或浏览器模拟冒充 Creator。

新增可执行交付：
- `prepare:cocos`：预检 9 份源码 + 扩展 manifest/2 份编译 JS（12 个目标），同内容跳过、
  不同内容/符号链接拒绝，任一目标冲突时不执行后续新写入；不生成场景/meta/假资源 UUID。
- 编辑器扩展：针对编辑器已保存的 MainGame，检查脚本已注册/场景干净，自动配置 Canvas、
  原生 UI 相机、GameUI 和只读 RuntimeProbe；由真实编辑器 snapshot/save-scene 保存。
  自定义场景拒绝修改。扩展的真实菜单执行本环境未验证。
- RuntimeProbe：只在真正 Cocos 运行后观测初始化、顾客、模块节点、画布/相机并输出标记 JSON；
  不开新订单、不点击/领奖、不写存档，观测结果不等于触摸/视觉/设备性能通过。
- `validate:cocos`：用真实编辑器导出配置及 meta UUID，shell=false 启动 Creator，保存 argv/退出码/完整日志，
  强制本次独立输出，接受官方成功码 36 且检查实际微信文件/AppID/portrait；普通 0 或旧文件不算成功。
- COCOS_INTEGRATION.md 提供本机命令、最少授权/保存步骤、官方接口链接、L1–L5 证据边界。
  CI 上传真实 blocked 报告及单独命名的 L1 编译扩展产物。

实际命令与结果：
- `npm run compile:editor`：真实生成扩展 CommonJS，TypeScript 编译成功；**不是引擎/游戏编译**。
- `npm run typecheck`：业务、UI、运行探针及扩展按官方 @cocos/creator-types 3.8.8 检查通过。
- `npm test`：50 项通过、0 失败，前序 41 项 + 集成 9 项。
  新增测试均为 L1：引擎/IPC 契约替身、安装预检/幂等/拒绝覆盖/符号链接，导出配置/UUID 契约，
  子进程日志/异常、0 与 36 成功码区分、微信输出字段和全新输出目录。
  临时 filesystem/Node 进程夹具不是合法引擎工程，不作为 L2/L3 证据，不上传为游戏包。
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`：11 项通过、0 失败，约 44.6 秒，未更改既有 E2E。
- `npm run validate:cocos`：实际返回退出码 2、status=blocked；command/process/output 为 null，
  没有引擎进程、引擎日志或游戏产物。实际 JSON 写入 artifacts/integration/<唯一运行目录>/report.json。
- `git diff --check`：通过。

验收状态：L1 已验证；L2 blocked；L3 blocked；L4 未验证；L5 禁用/不要求。
没有真实引擎截图、微信工具预览、设备测试或性能结果。下一步需在支持的本机安装/登录 Creator，
用编辑器新建项目/保存 MainGame、启用项目扩展，然后导出实际微信构建配置并执行验证脚本；
微信开发者工具登录/扫码与设备仍需用户本机授权。完整步骤见 COCOS_INTEGRATION.md。

- 补充可复现检查：`npm ci --cache /tmp/nightmarket-npm --ignore-scripts` 后重新 typecheck / npm test，通过；未把扩展 TS 编译结果记为引擎编译。
