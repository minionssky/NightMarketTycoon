# 今晚摆个摊 · NightMarketTycoon

微信小游戏项目：**国潮霓虹夜市 × Q版角色 × 高饱和美食特效**。

## 产品方向
- 游戏类型：2D 竖屏模拟经营 + 菜谱收集
- 目标平台：微信小游戏
- 计划技术栈：Cocos Creator 3.8 LTS + TypeScript
- 核心循环：顾客到店 → 点击制作 → 出餐得金币 → 升级摊位 → 解锁菜谱
- 广告：首个可运行版本仅使用 Mock 服务，不接真实广告
- 美术：霓虹灯牌、紫/玫红/橙金配色、Q版顾客、烧烤火焰与金币特效

## 当前状态
**Phase 0–2 已交付经营核心、三种菜谱收集、浏览器图鉴与 Cocos 动态 UI 源码。** 当前云端缺少 Cocos Creator，正式工程初始化、场景预览及微信构建仍未验证。详见 [验证日志](TASKS.md) 和 [Cocos 接入步骤](docs/COCOS_SETUP.md)。

## 开发流程
1. Codex 读取 [AGENTS.md](AGENTS.md)、[docs/PRD.md](docs/PRD.md)、[TASKS.md](TASKS.md)。
2. 在装有 Cocos Creator 3.8 LTS 的本地开发环境建立合法的 2D 项目。
3. 先完成单商品单摊位最小经营闭环，再扩展菜谱、美术和商业化。
4. 每阶段记录实际验证结果，不宣称未执行的编辑器预览或微信真机测试已完成。

## 开发目标
第一阶段实现：单顾客订单、2 秒制作、金币结算、10 级升级、存档恢复。
第二阶段实现：烤肠/奶茶/炸串菜谱解锁及图鉴。
后续增加霓虹夜市视觉、特效、离线收益与微信广告。

## 安全
不要提交微信 AppSecret、广告平台密钥、个人访问令牌或其他敏感凭据。

## 运行与验证

需要 Node.js 24+。在仓库根目录运行：

```sh
npm ci
npm run typecheck
npm test
npm run preview
```

浏览器打开 `http://127.0.0.1:4173`，可进行下单、制作、结算、升级、菜谱图鉴与存档恢复。
此演示直接使用同一 TS 核心，但不是 Cocos 引擎预览。

自动化浏览器测试：`npx playwright install --with-deps chromium` 后执行 `npm run test:browser`。
已有系统 Chromium 可用 `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`。

Cocos Creator 3.8 LTS 接入：先在编辑器创建 Empty (2D) 工程，再执行
`npm run import:cocos -- /absolute/path/to/project`；由编辑器创建 MainGame 场景，
将 GameUI 挂到 Canvas 一次即可生成交互 UI。导入脚本拒绝覆盖已有脚本。
完整步骤与尚未执行的验收见 [COCOS_SETUP.md](docs/COCOS_SETUP.md)。

## Phase 2 菜谱收集

点击“菜谱收藏册”查看已收集进度、未解锁条件和菜谱详情，点击“返回经营”继续摆摊。
初始只有烤肠；累计收入达到 500 解锁奶茶、2000 解锁炸串。消费金币不会影响解锁。
订单按配置顺序轮换已解锁菜谱，创建时锁定该商品的等级收益与制作时间。
解锁提示显示时即记录已读，正常保存后重启不会重复；旧版 v1 存档保留全部经营数据。
详细规则、迁移约定及验证方式见 [RECIPES.md](docs/RECIPES.md)。
