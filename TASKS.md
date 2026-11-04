# 开发任务与验收记录

状态说明：`[ ]` 未完成；`[x]` 已验证完成。只有真实验证后才能勾选。

## Phase 0：工程初始化
- [ ] 使用 Cocos Creator 3.8 LTS 建立合法的 2D 工程
- [ ] 配置竖屏设计与微信小游戏构建目标
- [ ] 创建 MainGame 场景并成功预览
- [ ] 保持 README、AGENTS、PRD 与代码一致

## Phase 1：最小经营闭环（最高优先级）
- [ ] GameConfig 与类型定义
- [ ] EconomyManager、UpgradeManager
- [ ] OrderManager 单订单状态机（WAITING → COOKING → SERVED → EXITED）
- [ ] SaveManager 与损坏数据恢复
- [ ] GameManager 与可交互 GameUI
- [ ] 订单 2 秒计时、结算只触发一次
- [ ] 10 级升级与金币扣除
- [ ] 20 单连续操作和存档恢复测试
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
