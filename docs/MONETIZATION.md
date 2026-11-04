# Phase 4 · 离线收益、每日任务与自愿 Mock 激励

## 开发基线与范围

开发前 PR #2、#4、#6 均 open / 未合并。`codex/issue-7-monetization` 从第三阶段最新
head `2dfcd6f` 创建，PR base 指向 `codex/issue-5-neon-visuals`，不从旧 main 重写，
不自动合并任何 PR。保留原订单状态机、菜谱轮换、图鉴、原创夜市场景及降级动效。

当前只有本地可验证业务和 Mock 广告。没有接入真实广告、登录、后端、支付或线上审核。

## 离线计算与领取

MonetizationConfig 是离线参数来源：基础 0.1 金币/秒，最多计入 14400 秒（4 小时）。

```text
elapsedSeconds = floor(max(0, now - cursor) / 1000)
seconds = min(elapsedSeconds, 14400)
amount = floor(seconds * 0.1 * 1.2 ** (stallLevel - 1))
```

时间使用整数毫秒。0 时长、倒退产生 0 收益；负数、NaN、Infinity、不安全整数或超过
ECMAScript 日期范围的时间拒绝计时。有效旧版 lastSaveTime 是初次离线起点，0 表示首次
启动、不从 1970 年计算收益。恢复/前台返回时锁定等级、金额和完整区间，超过 4 小时的
部分直接丢弃，cursor 推进到区间末尾，不能刷新再领取被上限截掉的时间。

离线普通收益通过“免费领取普通收益”手动领取，不自动加钱，不要求广告。
领取后的同一区间及 receipt 跨刷新保留。未领取的普通收益保留，不被后续返回覆盖；
普通已领后，下一次有收益的真实返回可创建新区间，不要求先观看旧区间广告。
这时旧区间尚未领取的自愿额外奖励失效。打开/关闭 UI 面板不计算新的离线区间。

前台 tick 更新时间水位；退出/隐藏时保存。返回时调用 resume，再恢复前台计时。
lastSaveTime/cursor 只前进，不因调回时钟而降低。时间早于水位时不能领奖。
这是纯客户端时钟与本地存档约束，不是服务端反作弊，也不支持用多个窗口同时经营。

## 收入、解锁和任务的统一口径

| 来源 | coins / totalEarned | 当日收取金币 | totalOrders / 当日订单 |
| --- | --- | --- | --- |
| 正常订单 | 增加一次 | 增加 | 增加一次 |
| 离线普通收益 | 增加一次 | 增加 | 不增加 |
| Mock 完成的额外奖励 | 增加一次 | 增加 | 不增加 |
| 每日任务奖励 | 增加一次 | 不增加，防止任务自己推动任务 | 不增加 |
| 升级花费 | 只扣 coins | 不减少 | 不改变 |

所有新收入均通过 RecipeManager 更新累计收入解锁，不复制解锁状态。
不恢复/补发进行中订单，不伪造离线订单。视觉金币反馈仍基于真实订单完成；
额外领奖在面板显示明确文字与新余额。

## 每日任务

周期为北京时间 UTC+8 的自然日（午夜重置），不依赖浏览器或机器的本地时区，也不按 UTC 午夜。

| 任务 ID | 本周期目标 | 固定免费奖励 |
| --- | --- | ---: |
| orders_5 | 完成 5 单 | 30 金币 |
| orders_15 | 完成 15 单 | 80 金币 |
| coins_300 | 累计收取 300 金币 | 60 金币 |

旧版历史订单/总收入不进入新周期进度。新的合法订单/收入记录在独立日计数中；
当天每任务只能领取一次，领取 ID 为 `task:<day>:<taskId>`。
在线跨午夜和重启均会检查新周期；向后调时钟不会退回旧周期或清除领取记录。
任务进度、奖励、已领取/未达标状态在两端面板可见，所有任务可不看广告直接领取。

## 广告与异步去重

`IRewardAdService.showRewardedAd(placement)` 返回明确状态：completed、cancelled、failed、unavailable。
只有 completed 可以尝试发额外奖励。MockAdService 提供 complete / cancel / error / duplicate；
重复场景会实际模拟两次 resolve 回调，Promise 只接受第一次；核心仍再以请求 ID 和持久化 receipt 去重。

- `offline_double`：普通收益先领取，再自愿模拟广告获取额外一倍。ID 为
  `offline:<start>:<end>:bonus`，取消/失败不撤销普通收益。
- `order_bonus`：已完成的最新一单可自愿模拟获取该单锁定收入的额外一份。
  ID 为 `order:<lifetimeTotalOrders>:bonus`，不用会话内重启归零的订单 ID。
- 一次只允许一个广告请求，快速重复请求返回 busy。异步开始时捕获金额和订单编号，
  完成时对当前余额应用增量，不用旧余额覆盖制作/升级后的存档。
  若期间完成新订单，旧请求仍只发旧单金额，保留新单的可选入口。
- 取消、错误、异常、过期、保存失败均明确反馈；可以关闭/取消面板，普通制作不被强制阻断。
  已展示的 Mock 请求会立即异步结算；关闭面板不撤销已经完成的自愿请求。
- 未启用真实广告。WeChatRewardAdService 只检查传入环境是否存在 createRewardedVideoAd，
  enabled 恒为 false，始终返回 unavailable，不注册/伪造平台回调，不读取生产凭证。
  将来真正接入必须另行实现加载、show、onClose 完成确认、onError、取消订阅及重复事件防护，
  只能在 wx 存在且平台资质与广告位配置完成后启用并真机验证。

## 事务、迁移与损坏恢复

键仍为 night_market_save_v1，version 仍为 1。新增可选 progress（schema=1），包含：
时间 cursor、daily（day/orders/coins/claimed）、锁定 offline、最新 orderOffer、orderRewardThrough。
原 coins、stallLevel、totalEarned、totalOrders、notifiedRecipeIds 保留。
有效旧存档通过默认新状态迁移；未领取离线机会只展示，不修改旧余额。
新字段非法时仅重建新状态，不清除经营字段；损坏状态不生成历史任务奖励或补发旧订单广告奖励。
原整体损坏存档的默认恢复逻辑保留。

新增奖励先构建候选余额与 receipt，在一次 localStorage.setItem 中一起持久化，成功后才发布内存状态
和菜谱解锁。写失败不发新奖励，不消耗 receipt，可重试。正常订单原有的内存继续营业/存储重试行为保留。
每次新奖励写前还检查存档 revision；页面刷新后旧实例/旧广告回调若发现新存档则返回 expired，
不覆盖更新后的金币。该检查不是跨进程数据库 CAS，多窗口并行营业和手工篡改存档不受支持。
金额相加必须仍是安全整数，否则返回 limit。

## UI、测试与本机接入

浏览器首页与 Cocos GameUI 均有“任务”“离线收益”，对应 RewardsUI/DOM 面板有关闭/取消、
领取状态、清晰失败提示和 Mock 结果切换；领奖期间的菜谱解锁提示等待当前面板关闭后展示。
新增源代码无浏览器 DOM API 进入 Cocos。非覆盖导入器现复制九份源码（含 Issue #9 只读运行探针）；自动安装与场景挂载见 COCOS_INTEGRATION.md。

```sh
npm ci
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run check:wechat
```

最后一个命令当前预期返回 blocked / 退出码 2，不是构建成功。CI 在 artifacts/phase4 中保存
该 JSON；测试截图为 offline-390.png 和 tasks-320/390/720.png。完整本机准备与未验证事项见
`WECHAT_BUILD.md`、`COCOS_SETUP.md`。浏览器测试/官方类型检查不等于 Cocos 或微信真机通过。
