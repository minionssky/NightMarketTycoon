# Phase 0–2：接入 Cocos Creator 3.8 LTS

## 当前交付与限制

本仓库交付独立 TypeScript 核心、Cocos 动态 UI 源码、导入脚本和浏览器玩法演示。
当前云端没有 Creator；**本仓库不是已由编辑器初始化并验证的正式 Cocos 工程**。
未手写 `.scene`、`.prefab`、资源 UUID 或模拟编辑器配置。官方 `@cocos/creator-types@3.8.8`
用于 UI 静态类型检查，不包含引擎运行时，不等同于构建或预览成功。

## 复现核心与浏览器验证

需要 Node.js 24+（使用原生 TypeScript 类型擦除）、npm。

```sh
npm ci
npm run typecheck
npm test
npm run preview
# 打开 http://127.0.0.1:4173
```

浏览器演示从同一个 `GameCore.ts` 动态擦除类型，未复制经济规则；服务仅监听本机。
它是独立 DOM 演示，**不是 Cocos 或微信小游戏构建**。服务使用 Node 的实验性
`stripTypeScriptTypes` API，运行时出现 ExperimentalWarning 属预期。

```sh
npx playwright install --with-deps chromium
npm run test:browser
# 若已有系统 Chromium：
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

浏览器测试使用 Playwright 虚拟时钟，实际驱动按钮、进度条和 localStorage。
截图输出 `artifacts/browser-demo.png`；CI 上传该目录，不将本地生成物提交到源码。

## 在编辑器建立真实工程（未验证）

1. 安装 Cocos Creator 3.8 LTS，建议 3.8.8，与类型声明保持一致。
2. 使用编辑器 **Empty (2D)** 模板创建新工程，例如 `/path/to/NightMarketCocos`。
   不要将当前源码仓库直接当作已初始化的 Creator 工程打开。
3. 在本仓库执行：

   ```sh
   npm run import:cocos -- /path/to/NightMarketCocos
   ```

   脚本校验编辑器工程 `package.json` 的 `creator.version` 为 3.8.x，并复制四份脚本（GameUI、RecipeBookUI、UiFactory、GameCore）到
   `assets/night-market/scripts/`；已有目标脚本会拒绝覆盖。
   此脚本只导入源码，不创建或验证工程、场景和构建设置。
4. 回到 Creator 等待资源导入与脚本编译。由编辑器创建 2D 场景并保存为 `MainGame`；
   保留模板的 Canvas、Camera 和 UI 渲染层。将 `GameUI` 添加到 **Canvas** 节点一次。
   无需绑定按钮、文本、图片或管理器属性；启动时自动生成全部子 UI。
5. 项目设计分辨率设置 720×1280。组件运行时也设置该分辨率与 SHOW_ALL；
   `SafeArea` + 全边 Widget 为内容提供安全区域，内容按 720×1280 等比缩放。
   编辑器中检查 9:16、窄屏、刘海屏，确认相机、点击区域、文字与安全区正常。
6. 将 `MainGame` 设为启动场景，浏览器预览，按下方清单验证。
7. 构建发布面板新增 **微信小游戏** 任务，启动场景选择 `MainGame`，方向选择竖屏；
   使用自己的合法 AppID（不要提交密钥）。完成构建后用微信开发者工具导入输出目录。
   记录实际编辑器版本、构建命令/配置、输出路径，再执行模拟器及真机检查。

编辑器生成的场景、资源 meta、工程与构建配置应在执行上述步骤后另行提交。
当前没有可复现的 Cocos 构建命令或成功产物，不能将 `npm run typecheck` 当作 Cocos 构建。

## 待执行验收

- 首屏有标题、金币、摊位、顾客/订单、进度条和制作/升级按钮。
- 1 秒出现首单，点击后默认 2 秒结算；制作过程中再次点击不能重发奖励。
- 出餐后等待 1 秒，经过 EXITED 后下一帧生成新顾客；一次只有一单。
- 连做 5 单后升级：50 金币扣至 0，等级到 2；当前已创建订单仍按原价结算。
- 金币不足、满级不扣钱；Lv4/7 的新订单分别为 1.8/1.6 秒。
- 退出重进恢复金币与等级；进行中订单丢弃，不补发奖励。
- 20 单连续运行、损坏存档恢复；存储不可用时仍能营业且显示告警。
- 切到后台存档并暂停计时，返回后继续；无离线收益。
- 多尺寸安全区、微信开发者工具、真机启动与交互、正式构建均需另行验证。

## 实现约定

- `GameCore.ts` 是配置、订单和经济数据唯一来源；UI 只调用 `cook / upgrade / tick`。
- 订单在创建时锁定收入和时长。只有 `COOKING → SERVED` 的边沿返回奖励，UI 不结算。
- `GameManager` 不接受外部金币修改；snapshot 返回副本。计时使用前台经过秒数。
- 存档白名单：version、coins、stallLevel、totalEarned、totalOrders、lastSaveTime、notifiedRecipeIds；
  键为 `night_market_save_v1`。数值必须是合法安全整数，等级 1–10，累计收入不能小于余额。
  非法数据恢复默认值，成功结算/升级/退出后尝试存储；写失败保留内存进度，后续保存可重试。
- Phase 2 已实现三种 RecipeConfig、RecipeManager 和图鉴；解锁统一由累计收入推导，
  只保存 notifiedRecipeIds 已读提示记录。详见 `RECIPES.md`。
  AdService 仅为可替换接口，不发放广告奖励、不接任何平台服务。

## Phase 2 新增编辑器待验项（未验证）

- 导入脚本现复制四份源码，仍然只需将 GameUI 挂载到 Canvas 一次。
  旧导入目录存在时脚本仍拒绝覆盖；请先备份，在新建空白工程或新导入目录执行。
- 点击“菜谱收藏册”，检查三张卡片、收集进度、锁定条件、详情、返回按钮。
- 以累计收入跨过 500/2000 的存档测试奶茶/炸串加入订单轮换和一次性弹窗。
- 组件生成的全部子节点继承父节点 layer；需在编辑器确认 UI 相机可见性和触摸层级。
- 检查弹窗阻止底层点击、三菜谱文字适配、刘海安全区、后台恢复和微信真机表现。
- 浏览器自动化结果不能替代上述 Cocos 引擎运行验证。
