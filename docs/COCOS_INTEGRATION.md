# Issue #9 · Creator 工程集成与分级验证

## 当前结果

基线是 Phase 4 `8573f30`。PR #2/#4/#6/#8 开发开始时均 open，集成分支基于
`codex/issue-7-monetization`，不重写玩法，不自动合并。AppID 保持 `wx3f8534584b5b98af`，真实广告禁用。

实际主机为 Debian 13 / Linux x64，PATH 和已检查的常见安装位置没有 Creator 或微信开发者工具，
仓库也没有编辑器创建的正式工程。官方安装文档列出 Windows/macOS 的 Dashboard 支持环境；
本次不把非官方 Linux 移植版或裸引擎源码当成 Creator 3.8 编辑器。

| 级别 | 当前状态 | 证据范围 |
| --- | --- | --- |
| L1 | 已验证 | 官方类型检查、编辑器扩展 TypeScript 编译、50 项单测、11 项 Chromium E2E |
| L2 | blocked | 没有真实项目创建、编辑器场景生成执行、引擎编译/运行或 Creator 预览 |
| L3 | blocked | 没有微信小游戏构建产物、开发者工具预览或账号授权结果 |
| L4 | 未验证 | 没有设备安全区、触摸、后台恢复、FPS/内存证据 |
| L5 | 不要求/禁用 | 未接入真实广告 |

`npm run validate:cocos` 已实际执行：退出码 2，报告中 command/process/output 均为 null，
明确记录没有启动引擎。实际报告位于 `artifacts/integration/<唯一运行目录>/report.json`。
CI 递归上传该目录。CI 允许预期的 blocked，不代表 L2–L4 通过。

## 本次新增的可执行工具

- `prepare:cocos`：编译扩展并安装 9 份游戏/探针源码 + 扩展 package.json、2 份 JS，共 12 个目标文件。
  全部预检后才写入；目标字节完全相同则跳过，不同则拒绝；拒绝符号链接目标/祖先，不覆盖用户资源。
  不创建假的 package.json、场景、prefab、meta、场景 UUID 或 Creator 设置。
- `night-market-integration` 编辑器扩展：打开编辑器已保存的 MainGame 场景，用真实 cc API 创建
  Canvas/UITransform/UI Camera 并挂载已有 GameUI 和只读 RuntimeProbe；最终由编辑器 save-scene 序列化。
- `NightMarketRuntimeProbe`：进入真正引擎运行后 1.25 秒记录初始化观测，不模拟触摸、不改经营或存档。
  记录引擎版本、系统、画布/相机、顾客是否出现、三菜谱/三任务以及图鉴/奖励节点是否存在。
- `validate:cocos`：校验真实导出构建配置与场景 meta UUID，启动显式指定/发现的 Creator，完整保存
  命令、退出码和日志；只接受官方成功退出码 36，并验证本次新目录中的微信产物。
  不把普通进程退出 0、旧文件或 Node 夹具算作引擎成功。

`compile:editor` 生成的 CommonJS 扩展是可安装的编译输出，但仍只属于 L1。
CI 单独上传 `compiled-editor-extension-L1-only`，未把它命名为微信游戏包。

## 本机最少步骤（需要 Windows/macOS、Creator 和授权账号）

需要 Node 24+、Creator 3.8 LTS（推荐 3.8.8），以及微信开发者工具。

1. 用官方 Dashboard/编辑器创建 **Empty (2D)** 工程；不要把本仓库直接当作已有引擎项目。
   在仓库运行：

   ```sh
   npm ci
   npm run prepare:cocos -- /absolute/path/to/NightMarketCocos --dry-run
   npm run prepare:cocos -- /absolute/path/to/NightMarketCocos
   ```

   dry-run 不写目标工程（仍会在本仓库编译扩展）。不同版本源码不会被强制覆盖；
   旧导入项目请先备份，使用新工程或人工处理差异后重试，没有 force/删除用户文件模式。
2. 回到 Creator 等待资源导入与脚本编译。进入 **扩展 → 扩展管理器 → 项目**，启用/刷新
   `night-market-integration`。由编辑器新建空场景，或使用未改动的 2D Canvas+Camera 模板，
   保存为 `assets/night-market/MainGame.scene`，先保存其他未保存改动。
3. 执行菜单 **Develop → NightMarket → Populate saved MainGame scene**。
   无需逐节点创建或拖拽绑定。扩展会按 Asset Database 中真实 UUID 打开目标，
   等待项目脚本注册后挂载现有 GameUI，调用 snapshot/save-scene，保存过程报告到
   `<工程>/temp/night-market-integration/scene-*.json`。

   只接受空场景、未改动的单 Canvas+子 Camera 模板，或已经挂有唯一 GameUI 的 Canvas。
   自定义节点、重名冲突、未注册脚本、未完成导入、脏场景和不匹配版本会中止。
   已配置场景不重复创建 Canvas；缺少探针时只补只读探针，不改既有玩法节点。
4. 编辑器项目分辨率设置 720×1280；GameUI 运行时也设置此参考尺寸。
   选 MainGame，执行真实预览，查看 Console 的 `[NightMarketRuntimeEvidence]` JSON。
   该日志只证明初始化观测，仍需手动点击制作、升级、图鉴、任务、离线收益、Mock 失败/取消、动效降级，
   检查真实显示与安全区。保存截图和 Console 记录；不要把探针全 true 当作完整 L2/L4。
5. 构建面板新增微信小游戏任务，选择 MainGame 为启动场景，填已有 AppID，设置 portrait，
   真实广告保持关闭；使用 **导出配置** 保存实际配置 JSON。启动场景 UUID 必须由编辑器生成。
   关闭正在编辑同一项目的 Creator，避免项目被两个进程占用，再运行：

   ```sh
   npm run validate:cocos -- \
     --project /absolute/path/to/NightMarketCocos \
     --creator /absolute/path/to/CocosCreatorExecutable \
     --config /absolute/path/to/editor-exported-wechat-config.json \
     --devtools /absolute/path/to/WeChatDevToolsCLI
   ```

   Windows PowerShell 可将上述参数写在同一行，或用 PowerShell 的换行方式；含空格路径加引号。
   macOS Creator 可执行文件通常位于 `.app/Contents/MacOS/CocosCreator`，不是 .app 目录本身。
6. 工具仅在满足前置条件时执行以下 argv（不经 shell 拼接）：

   ```text
   <Creator> --project <project> --build configPath=<本次独立配置副本>
   ```

   原导出配置不改写；执行副本删除旧 dest，覆盖 buildPath/outputName/logDest，输出至本次全新目录。
   检查 `process.log`、`creator-build.log`、`report.json`，以及实际 `engine-output/wechatgame/`。
   检查 `game.js`、`game.json.gameOrientation=portrait`、`project.config.json.appid` 和 compileType=game。
   返回 32/34、普通 0、超时、缺文件或错误 AppID/方向都不能报告构建通过。
7. 在微信开发者工具中用有权限的账号登录，打开本次实际输出目录并预览；再扫码真机验证。
   执行器只发现开发者工具路径，不替用户登录、自动发布或把文件存在当作已预览。
   需要测试的安全区、后台恢复、性能和玩法项目见 WECHAT_BUILD.md。

当前环境缺少上述软件/工程和设备，因此步骤 1–7 中的真实编辑器/设备执行均未完成。

## 证据文件与边界

- `extensions/.../dist/*.js`：扩展 TS 编译产物，L1；源码在 src，构建输出不提交入库。
- `<工程>/temp/night-market-integration/scene-*.json`：仅真实编辑器执行菜单后才生成的配置报告，
  不等于运行通过；当前仓库环境没有该真实报告。
- Creator Console `[NightMarketRuntimeEvidence]`：只有 RuntimeProbe 真正在引擎运行后才出现，
  本次未产生真实引擎记录。探针没有自动证明视觉、触摸或设备性能。
- `artifacts/integration/<run>/report.json`：真实执行尝试记录，当前 blocked；command/process/output 为 null。
- `process.log` / `creator-build.log` / `engine-output`：只有工具真实启动构建后才会出现，当前没有。

新增测试中的 Node/IPC/引擎契约替身和临时 filesystem/进程夹具只用于检查安全逻辑、IPC 顺序、
输出校验和退出码处理；均标明 L1，在临时目录清理，不上传为 Creator/微信产物。

## 参考官方接口（2026-11-04 核对）

- [Creator 3.8 安装](https://docs.cocos.com/creator/3.8/manual/en/getting-started/install/index.html)：安装与平台前置要求。
- [扩展菜单与构建](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/first.html)：package_version=2、main、messages/menu。
- [Scene Script](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/scene-script.html)：contributions.scene.script、场景进程 cc API、JSON IPC。
- [命令行发布](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)：configPath、导出配置、输出参数与退出码。

消息契约另外按仓库锁定的 @cocos/creator-types 3.8.8 的 scene/asset-db message.d.ts 校验。
