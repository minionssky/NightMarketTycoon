import { Node, UITransform, Label, Button, BlockInputEvents } from 'cc';
import { GameManager, MockAdService, claimMessage } from './core/GameCore';
import type { AdPlacement, MockAdMode, TaskId } from './core/GameCore';
import { uiLabel, uiPanel, uiButton } from './ui/UiFactory';
import { Palette } from './ui/effects/VisualStyle';

/** Runtime-only modal; all progress, eligibility and money are supplied by the shared core. */
export class RewardsUI {
  readonly root: Node;
  private tasks: Node;
  private offline: Node;
  private rows = new Map<TaskId, { label: Label; button: Button; buttonLabel: Label }>();
  private period: Label;
  private offlineSummary: Label;
  private base: Button;
  private baseLabel: Label;
  private bonus: Button;
  private bonusLabel: Label;
  private orderBonus: Button;
  private orderLabel: Label;
  private modeLabel: Label;
  private status: Label;
  private title: Label;
  private model: GameManager;
  private ad: MockAdService;
  private onChange: () => void;
  private tab: 'tasks' | 'offline' = 'tasks';

  constructor(parent: Node, model: GameManager, ad: MockAdService, onChange: () => void) {
    this.model = model; this.ad = ad; this.onChange = onChange;
    this.root = new Node('RewardsUI'); this.root.layer = parent.layer; parent.addChild(this.root);
    this.root.addComponent(UITransform).setContentSize(720, 1280); this.root.addComponent(BlockInputEvents);
    uiPanel(this.root, 'Backdrop', 0, 0, 720, 1280, Palette.night);
    uiPanel(this.root, 'RewardsWindow', 0, 0, 680, 1180, '#39234B');
    this.title = uiLabel(this.root, '', 0, 520, 42, Palette.gold);
    const tasksTab = uiButton(this.root, '营业任务', 430, '#573578', () => { this.tab = 'tasks'; this.render(); }, 300, 65)[0];
    tasksTab.node.setPosition(-165, 430);
    const offlineTab = uiButton(this.root, '离线收益', 430, '#573578', () => { this.tab = 'offline'; this.render(); }, 300, 65)[0];
    offlineTab.node.setPosition(165, 430);
    this.tasks = new Node('Tasks'); this.tasks.layer = this.root.layer; this.root.addChild(this.tasks);
    this.period = uiLabel(this.tasks, '', 0, 360, 21, Palette.cream);
    model.snapshot.tasks.forEach((task, index) => {
      const y = 275 - index * 155;
      const label = uiLabel(this.tasks, '', 0, y + 28, 25, Palette.cream);
      const [button, buttonLabel] = uiButton(this.tasks, '', y - 35, '#784166', () => {
        this.status.string = claimMessage(model.claimTask(task.id)); onChange();
      }, 580, 60);
      this.rows.set(task.id, { label, button, buttonLabel });
    });
    this.offline = new Node('Offline'); this.offline.layer = this.root.layer; this.root.addChild(this.offline);
    this.offlineSummary = uiLabel(this.offline, '', 0, 265, 27, Palette.cream);
    this.offlineSummary.node.getComponent(UITransform)!.setContentSize(610, 180);
    [this.base, this.baseLabel] = uiButton(this.offline, '', 115, Palette.pink, () => {
      this.status.string = claimMessage(model.claimOffline()); onChange();
    }, 580, 75);
    [this.bonus, this.bonusLabel] = uiButton(this.offline, '', 10, '#68418B', () => { void this.request('offline_double'); }, 580, 75);
    uiLabel(this.root, '仅本地 Mock 模拟，未启用真实微信广告\n不观看也能正常经营与免费领奖', 0, -200, 23, '#DDB9D7');
    [, this.modeLabel] = uiButton(this.root, '', -290, '#50345F', () => {
      const modes: MockAdMode[] = ['complete', 'cancel', 'error', 'duplicate'];
      this.ad.mode = modes[(modes.indexOf(this.ad.mode) + 1) % modes.length]; this.render();
    }, 580, 60);
    this.modeLabel.fontSize = 25;
    [this.orderBonus, this.orderLabel] = uiButton(this.root, '', -380, '#68418B', () => { void this.request('order_bonus'); }, 580, 70);
    this.orderLabel.fontSize = 25;
    this.status = uiLabel(this.root, '', 0, -475, 24, Palette.mint);
    this.status.node.getComponent(UITransform)!.setContentSize(610, 90);
    uiButton(this.root, '关闭 / 取消', -565, '#3C6470', () => { this.root.active = false; onChange(); }, 580, 60);
    this.root.active = false;
  }
  open(tab: 'tasks' | 'offline'): void { this.tab = tab; this.status.string = ''; this.root.active = true; this.render(); }
  private async request(placement: AdPlacement): Promise<void> {
    this.status.string = 'Mock 模拟处理中…'; const pending = this.model.requestAd(placement, this.ad); this.onChange();
    this.status.string = claimMessage(await pending); this.onChange();
  }
  render(): void {
    const s = this.model.snapshot;
    this.tasks.active = this.tab === 'tasks'; this.offline.active = this.tab === 'offline';
    this.title.string = this.tab === 'tasks' ? '今晚营业任务' : '离线烟火收益';
    this.period.string = `北京时间每日重置 · ${s.progress.daily.orders} 单 / 收取 ${s.progress.daily.coins} 金币`;
    for (const task of s.tasks) {
      const row = this.rows.get(task.id)!;
      row.label.string = `${task.name} · ${task.progress}/${task.target} · 奖励 ${task.reward}`;
      row.button.interactable = task.ready;
      row.buttonLabel.string = task.claimed ? '已领取' : task.ready ? '免费领取' : '未达标';
    }
    const o = s.offline;
    this.offlineSummary.string = o ? `计入 ${o.seconds} 秒（最多 4 小时）\nLv.${o.level} · ${o.amount} 金币${o.baseClaimed ? ' · 普通收益已领' : ''}` : '暂无离线收益\n回来后可在这里免费领取';
    this.base.interactable = !!o && !o.baseClaimed; this.baseLabel.string = o?.baseClaimed ? '普通收益已领取' : '免费领取普通收益';
    this.bonus.interactable = !!o?.baseClaimed && !o.bonusClaimed && !s.adBusy;
    this.bonusLabel.string = o?.bonusClaimed ? '额外一倍已领取' : '自愿 Mock 模拟 · 额外一倍';
    this.bonusLabel.fontSize = 26;
    this.orderBonus.interactable = !!s.orderBonus && !s.orderBonus.claimed && !s.adBusy;
    this.orderLabel.string = !s.orderBonus ? '完成一单后可领取额外奖励' : s.orderBonus.claimed ?
      '本单额外奖励已领取' : `自愿 Mock 模拟 · 本单额外 ${s.orderBonus.amount} 金币`;
    const modes: Record<MockAdMode, string> = { complete: '模拟完成', cancel: '模拟提前关闭', error: '模拟加载失败', duplicate: '模拟重复回调' };
    this.modeLabel.string = `模拟结果：${modes[this.ad.mode]}（点击切换）`;
  }
}
