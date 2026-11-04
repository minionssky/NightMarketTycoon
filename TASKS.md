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
- [ ] RecipeConfig、RecipeManager
- [ ] 烤肠（初始）、奶茶（累计收入 500）、炸串（累计收入 2000）
- [ ] RecipeBookUI：已解锁、未解锁、详细信息
- [ ] 图鉴与经营商品共用解锁状态
- [ ] 兼容 Phase 1 存档，覆盖重复解锁测试

## Phase 3：视觉效果
- [ ] 国潮霓虹夜市主界面与 Q 版顾客
- [ ] 高饱和烹饪特效、金币反馈、升级特效
- [ ] 多屏幕适配与性能检查

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
