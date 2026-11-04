# Phase 3 · 国潮霓虹夜市视觉规范

## 基线与授权

开始时 PR #2、#4 均 open / 未合并。本分支 `codex/issue-5-neon-visuals` 直接基于
Phase 2 head `217a727`，PR base 指向 `codex/issue-3-recipes`。前序 PR 和新 PR 均不自动合并。
`GameCore.ts` 的经济、订单、解锁与存档代码保持原文；本阶段只读取其快照实现表现。

所有场景、顾客、摊主、食品、图鉴图标均为本仓库新增程序绘制的原创几何图形，
由 `assets/scripts/ui/effects/VisualStyle.ts` 的函数可复现生成。不使用商业游戏截图、
外链图片、第三方字体、下载的插画或来源不明素材。文字使用平台系统字体；本次未新增外部美术许可依赖。
新增源码与图形按仓库代码一起提供，未擅自添加或变更整个仓库的开源许可证。

## 色板

| Token | 色值 | 用途 |
| --- | --- | --- |
| night | #24133E | 夜空、主界面底色 |
| purple | #8C41F6 | 霓虹、顾客服装 |
| pink | #FF3F94 | 主要 CTA、灯笼、棚顶、火花 |
| gold | #FFB347 | 金币、招牌、进度、升级反馈 |
| cream | #FFF2D8 | Logo、气泡、主要文字、蒸汽 |
| mint | #71EFDB | 详情条件、辅助信息 |

Palette 是跨平台图形颜色来源。浏览器 CSS 变量保留同名颜色用于 DOM 控件；
Cocos 控件采用 Palette 与少量更暗的辅助颜色。避免用发光背景替代可读文字。

## 布局与分层

参考舞台 720×1280、竖屏。顶部 Logo/金币/等级；中景夜市与订单气泡；下方进度、
制作、升级、图鉴。主 CTA 保持玫红实色底与暖白文字；不足金币或制作中呈禁用态。
动画不覆盖按钮，视觉图形不承接业务点击。

图形场景局部坐标 720×650，正 X 向右、正 Y 向下。共享图形是 rect、ellipse、path、text：

1. Backdrop：夜空、月亮、楼房窗灯、远景小灯牌、路面。
2. Stall：暖色棚顶、条纹檐口、霓虹招牌、支柱；灯笼单独为两组节点。
3. Chef / Customer：原创大头小身体摊主与顾客；两种形态为丸子头紫衣、帽子青衣。
4. Food / Counter：三种食品独立图形、柜台前景，保留人物与菜品层次。
5. Heat / Reward / Upgrade：最多 6 个可见火焰或蒸汽、一个金币浮字、一个升级提示。
6. HUD / Order / Controls / Book / Notice：交互 UI 与通知独立，继续读取同一业务快照。

顾客使用订单 ID 交替选择形态与服装，便于复用、复现和测试，不影响菜谱轮换。
完成时切换笑脸；图鉴使用同源食品图标、剪影、稀有度与霓虹边框，保持原详情和返回操作。
原收藏册保留页面式进入/返回；解锁通知仍为独立可关闭弹窗，没有将整幅插画贴作 UI。

浏览器以 SVG group 渲染矢量层、DOM 渲染可交互控件；Cocos 以原生 Graphics/Label/
UITransform 渲染同一图形数据。Cocos 的 VectorArt 把正向下坐标转换为引擎正向上坐标，
不引入 DOM、SVG 解析器、WebGL 自定义着色器或浏览器动效库。

## 动画时序

`Motion` 中统一配置时长（秒），`VisualDirector` 是仅观察快照的轻量时间线：

| 表现 | 配置/触发 | 规则 |
| --- | --- | --- |
| 顾客入场 | enter=0.4，新订单 ID | 右侧滑入，等待时约 3 单位轻浮动 |
| 顾客完成离场 | departDelay=0.4，depart=0.6 | SERVED 切笑脸后离开，EXITED 隐藏；不延迟核心下一单 |
| 灯牌脉冲 | pulse=2.8 | 约 1.2% 缩放，不做高频闪烁 |
| 灯笼轻摆 | sway=3.6 | 左右最多 4 度，无复杂寻路 |
| 烹饪火焰/蒸汽 | COOKING | 烤肠/炸串使用暖色火焰；奶茶使用暖白蒸汽 |
| 金币浮字/短光感 | reward=0.9，totalOrders 增长 | 显示当前单已锁定收益及星光符号，最多上浮 70 单位 |
| 升级闪光/数值跳动 | upgrade=0.65，等级增长 | 显示升级文字光感，HUD 最多放大 8% |

动画没有任何发奖、修改等级或写经营存档的回调。首次观察已恢复的金币/等级时只建立基线，
不重播奖励/升级；重复 render 或 tick 不会重新启动同一反馈。核心计时和单次结算仍由
GameManager / OrderManager 完成，图鉴切换期间前台制作可继续。

## 性能与降级

- 两端首页提供“动效：完整 / 简洁”按钮。独立偏好键 `night_market_visual_quality` 仅记录
  full/low，不改动 `night_market_save_v1`。写偏好失败不阻止营业。
- 浏览器首次无显式偏好时遵循 prefers-reduced-motion；Cocos 无浏览器媒体查询，默认 full，
  可在首页切 low。没有声称自动检测低端微信设备。
- low 模式固定招牌、灯笼和顾客位置，隐藏粒子，停止食品摆动和 HUD 缩放；
  保留静态制作图形、状态/进度、金币/升级文字反馈，业务时长与收益完全相同。
- 每端一个既有 update/requestAnimationFrame，不给每个粒子创建定时器或无限 tween。
  图形在角色形态/表情、菜谱或锁定状态改变时重建，普通帧只更新变换/可见性。
- Cocos 预建 6 个火焰和 6 个蒸汽节点，最多 6 个同时可见；浏览器只预建 6 个路径。
  金币与升级反馈各复用一个节点。隐藏经营页面时只推进观察时间线，跳过图形更新。
- 图鉴 DOM 只在收入、等级、选择改变时更新；远景不每帧重绘。未增加模糊滤镜、视频、
  外链素材、骨骼动画、3D 效果或大量全屏半透明叠层。
- 自动化检查了图形节点数量上限和多单后的不增长；未进行微信 FPS、内存、GPU 或低端真机性能实测。

## 响应式与安全区

浏览器使用 viewport-fit=cover 和 env(safe-area-inset-*)，小高度屏幕压缩场景与辅助排版，
不裁切 CTA；验收尺寸为 320×568、390×844、720×1280。桌面最大内容宽度 450。
Cocos 仍使用 720×1280、SafeArea + Widget 等比适配；按钮在安全区内容内。

浏览器测试证明所测 viewport 中无横向溢出、三个 CTA 可见/不重叠及入口/返回可点击。
这些结果不能替代微信真机刘海、底部手势区或 Cocos 相机/触摸/安全区验证。

## 资源命名与替换清单

当前无需额外纹理文件。将来接入授权素材时可放到 `assets/textures/night-market/`，
按以下命名及独立图层替换，避免破坏交互或把业务文字烘焙进图：

| 预留命名 | 当前来源 | 替换约定 |
| --- | --- | --- |
| nm_bg_skyline | backdropArt | 720×650 场景远景，可裁切，不含按钮 |
| nm_stall_canopy / nm_counter | stallArt / counterArt | 单独前后景，保留遮挡顺序 |
| nm_lantern | lanternArt | 顶部悬挂点为旋转原点 |
| nm_customer_bun / nm_customer_cap / nm_chef | characterArt | 脚底、头部对齐统一；至少保留两种顾客 |
| nm_food_sausage / nm_food_milk_tea / nm_food_fried_skewer | foodArt | 160×160 图标参考，锁定剪影需同尺寸 |
| nm_fx_flame / nm_fx_steam / nm_fx_coin | 原生小图形 | 保留数量/时长上限，不通过动画回调结算 |

每项替换附来源 URL、作者、许可证或自有创作记录，确认修改和发布权限，避免商业游戏截屏。
通过编辑器导入真实资源后提交其合法 meta，不手工伪造场景或 UUID。
`npm run import:cocos -- /path/to/editor-created-project` 现复制 9 份源码（含 Phase 4 UI 与集成探针），预检目标并拒绝覆盖用户文件；自动集成见 COCOS_INTEGRATION.md。
旧导入目录存在时请先备份或使用新建工程；本阶段不引入自动覆盖旧工程的模式。

## 可复现验证与截图

```sh
npm ci
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:browser
# 已有系统 Chromium：CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
npm run preview
```

`tests/browser/visuals.test.mjs` 生成三组实际截图，每组包含 320/390/720 三个宽度：
`artifacts/visuals/ordinary-*.png`、`cooking-*.png`、`catalog-*.png`。
CI 现有 upload-artifact 上传整个 artifacts 目录，截图不作为手写素材提交。

测试使用真实 Chromium + 虚拟时钟，覆盖点击制作/升级/图鉴、快速连击、特效可见性、
顾客变化、刷新恢复、简洁模式、系统减少动态效果偏好，以及第一至二阶段回归。
Cocos 官方 3.8.8 类型检查只验证 API 使用；无编辑器/微信设备时，合法工程初始化、
引擎视觉预览、触摸、真实安全区、后台恢复、构建与真机性能一律保留未验证。
