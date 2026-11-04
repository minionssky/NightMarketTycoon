import {
  _decorator, Component, Node, UITransform, Label, Color, Graphics, Button,
  Widget, SafeArea, view, ResolutionPolicy, sys, game, Game, BlockInputEvents, UIOpacity,
} from 'cc';
import { GameManager, getRecipe, MockAdService } from './core/GameCore';
import { RecipeBookUI } from './RecipeBookUI';
import { RewardsUI } from './RewardsUI';
import { uiLabel, uiPanel, uiButton } from './ui/UiFactory';
import { NightMarketScene } from './ui/effects/NightMarketScene';
import { Palette } from './ui/effects/VisualStyle';
import type { VisualQuality } from './ui/effects/VisualStyle';
const { ccclass } = _decorator;

/** Attach once to the template's Canvas; all child UI is generated at runtime. */
@ccclass('GameUI')
export class GameUI extends Component {
  private model!: GameManager;
  private rewards!: RewardsUI;
  private tasksLabel!: Label;
  private offlineLabel!: Label;
  private scene!: NightMarketScene;
  private quality: VisualQuality = 'full';
  private qualityLabel!: Label;
  private levelLabel!: Label;
  private stage!: Node;
  private market!: Node;
  private book!: RecipeBookUI;
  private bookLabel!: Label;
  private notice!: Node;
  private noticeText!: Label;
  private cookLabel!: Label;
  private safe!: UITransform;
  private coins!: Label;
  private customer!: Label;
  private details!: Label;
  private status!: Label;
  private cookButton!: Button;
  private upgradeButton!: Button;
  private upgradeLabel!: Label;
  private progress!: Graphics;
  private paused = false;

  start(): void {
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);
    this.model = new GameManager(sys.localStorage);
    const safe = new Node('SafeArea'); safe.layer = this.node.layer; this.node.addChild(safe);
    this.safe = safe.addComponent(UITransform);
    const widget = safe.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    widget.updateAlignment(); safe.addComponent(SafeArea);
    this.stage = new Node('NightMarket'); this.stage.layer = safe.layer; safe.addChild(this.stage);
    this.stage.addComponent(UITransform).setContentSize(720, 1280);
    this.market = new Node('Market'); this.market.layer = this.stage.layer; this.stage.addChild(this.market);
    this.market.addComponent(UITransform).setContentSize(720, 1280);
    this.panel('Backdrop', 0, 0, 720, 1280, Palette.night);
    this.label('今晚摆个摊', 0, 555, 54, Palette.cream);
    this.label('一口烟火，收集城市的夜晚', 0, 495, 22, Palette.gold);
    const [, qualityLabel] = uiButton(this.market, '动效：完整', 610, '#49305F', () => {
      this.quality = this.quality === 'full' ? 'low' : 'full';
      try { sys.localStorage.setItem('night_market_visual_quality', this.quality); } catch { /* optional preference */ }
      this.render();
    }, 190, 42);
    this.qualityLabel = qualityLabel; qualityLabel.fontSize = 20;
    qualityLabel.node.parent!.setPosition(220, 610);
    try {
      const quality = sys.localStorage.getItem('night_market_visual_quality');
      if (quality === 'full' || quality === 'low') this.quality = quality;
    } catch { /* gameplay storage errors remain handled by SaveManager */ }
    this.panel('Wallet', -130, 425, 320, 75, '#3F2452');
    this.panel('Level', 205, 425, 240, 75, '#3F2452');
    this.coins = this.label('', -130, 425, 35, Palette.gold);
    this.coins.node.getComponent(UITransform)!.setContentSize(300, 70);
    this.levelLabel = this.label('', 205, 425, 29, Palette.cream);
    this.levelLabel.node.getComponent(UITransform)!.setContentSize(220, 70);
    this.scene = new NightMarketScene(this.market);
    const [tasksButton, tasksLabel] = uiButton(this.market, '任务', 360, '#50345F', () => this.rewards.open('tasks'), 300, 48);
    tasksButton.node.setPosition(-165, 360); this.tasksLabel = tasksLabel; tasksLabel.fontSize = 22;
    const [offlineButton, offlineLabel] = uiButton(this.market, '离线收益', 360, '#50345F', () => this.rewards.open('offline'), 300, 48);
    offlineButton.node.setPosition(165, 360); this.offlineLabel = offlineLabel; offlineLabel.fontSize = 22;
    this.panel('OrderBubble', 175, 160, 320, 110, Palette.cream);
    this.customer = this.label('', 175, 160, 25, '#522B4F');
    this.customer.node.getComponent(UITransform)!.setContentSize(300, 98);
    this.details = this.label('', 0, -255, 23, Palette.cream);
    this.panel('ProgressTrack', 0, -310, 580, 16, '#523164');
    const progress = new Node('Progress'); progress.layer = this.market.layer; this.market.addChild(progress);
    progress.setPosition(-290, -318); this.progress = progress.addComponent(Graphics);
    [this.cookButton, this.cookLabel] = this.button('制作烤肠', -385, Palette.pink, () => this.model.cook());
    [this.upgradeButton, this.upgradeLabel] = this.button('', -485, '#573980', () => this.model.upgrade());
    [, this.bookLabel] = this.button('菜谱收藏册', -575, '#3A254D', () => {
      this.market.active = false; this.book.root.active = true;
    });
    this.bookLabel.node.parent!.getComponent(UITransform)!.setContentSize(580, 68);
    this.status = this.label('', 0, -625, 17, '#CEADCB');
    this.book = new RecipeBookUI(this.stage, this.model.snapshot, () => {
      this.book.root.active = false; this.market.active = true;
    }, () => this.render());
    this.rewards = new RewardsUI(this.stage, this.model, new MockAdService(), () => this.render());
    this.notice = new Node('UnlockNotice'); this.notice.layer = this.stage.layer; this.stage.addChild(this.notice);
    this.notice.addComponent(UITransform).setContentSize(720, 1280);
    this.notice.addComponent(BlockInputEvents);
    uiPanel(this.notice, 'ModalBackdrop', 0, 0, 720, 1280, '#160c30e8');
    uiPanel(this.notice, 'Modal', 0, 0, 650, 350, '#52234e');
    uiLabel(this.notice, '✦ 新菜谱解锁 ✦', 0, 100, 40, Palette.gold);
    this.noticeText = uiLabel(this.notice, '', 0, 20, 30, '#ffffff');
    uiButton(this.notice, '收进收藏册', -100, Palette.pink, () => { this.notice.active = false; });
    this.notice.active = false;
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.render();
  }
  private label(text: string, x: number, y: number, size: number, color: string): Label {
    return uiLabel(this.market, text, x, y, size, color);
  }
  private panel(name: string, x: number, y: number, width: number, height: number, color: string): Node {
    return uiPanel(this.market, name, x, y, width, height, color);
  }
  private button(text: string, y: number, color: string, action: () => unknown): [Button, Label] {
    return uiButton(this.market, text, y, color, () => { action(); this.render(); });
  }
  private onHide(): void { this.paused = true; this.model.save(); }
  private onShow(): void { this.model.resume(); this.paused = false; }
  update(dt: number): void {
    if (!this.model || this.paused) return;
    this.model.tick(dt); this.render(dt);
  }
  private render(dt = 0): void {
    const scale = Math.min(this.safe.width / 720, this.safe.height / 1280);
    this.stage.setScale(scale, scale, 1);
    const s = this.model.snapshot; const o = s.order;
    this.coins.string = `金币  ${s.coins}`;
    this.levelLabel.string = `摊位 Lv.${s.stallLevel}`;
    this.qualityLabel.string = `动效：${this.quality === 'full' ? '完整' : '简洁'}`;
    const hudScale = this.scene.update(s, dt, this.quality);
    this.coins.node.setScale(hudScale, hudScale, 1); this.levelLabel.node.setScale(hudScale, hudScale, 1);
    this.customer.string = !o || o.state === 'EXITED' ? '灯火通明，等候新顾客…' :
      o.state === 'WAITING' ? `顾客：来份${getRecipe(o.recipeId).name}！ +${o.income}` :
      o.state === 'COOKING' ? `制作${getRecipe(o.recipeId).name} · ${o.remaining.toFixed(1)} 秒` : `出餐啦！ +${o.income} 金币`;
    this.cookLabel.string = o ? `制作${getRecipe(o.recipeId).name}` : '等待顾客';
    this.details.string = `摊位 Lv.${s.stallLevel}  ·  烤肠 ${s.income} 金币/单`;
    this.cookButton.interactable = o?.state === 'WAITING';
    this.upgradeButton.interactable = s.upgradeCost !== null && s.coins >= s.upgradeCost;
    this.cookButton.node.getComponent(UIOpacity)!.opacity = this.cookButton.interactable ? 255 : 135;
    this.upgradeButton.node.getComponent(UIOpacity)!.opacity = this.upgradeButton.interactable ? 255 : 135;
    this.upgradeLabel.string = s.upgradeCost === null ? '已满级 Lv.10' : `升级摊位 · ${s.upgradeCost} 金币`;
    this.progress.clear(); this.progress.fillColor = new Color(Palette.gold);
    const fraction = o?.state === 'COOKING' ? 1 - o.remaining / o.duration : o?.state === 'SERVED' ? 1 : 0;
    this.progress.rect(0, 0, 580 * fraction, 16); this.progress.fill();
    this.status.string = s.saveStatus === 'unavailable' ? '存档暂不可用，本次进度仅保留在内存' :
      s.saveStatus === 'recovered' ? '存档异常，已安全恢复初始摊位' : '自动存档 · 今晚也要好好营业';
    this.bookLabel.string = `菜谱收藏册 · ${s.recipes.filter(recipe => recipe.unlocked).length}/${s.recipes.length}`;
    this.book.render(s); this.rewards.render();
    this.tasksLabel.string = `任务${s.tasks.some(task => task.ready) ? ' · 可领' : ''}`;
    this.offlineLabel.string = `离线收益${s.offline && !s.offline.baseClaimed ? ' · 可领' : ''}`;
    if (!this.rewards.root.active && !this.notice.active && s.unlockNotifications.length) {
      const event = s.unlockNotifications[0];
      this.noticeText.string = `${getRecipe(event.recipeId).name}已加入图鉴与经营！`;
      this.notice.active = true; this.model.acknowledgeRecipeUnlock(event.recipeId);
    }
  }
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.onHide, this); game.off(Game.EVENT_SHOW, this.onShow, this);
    this.model?.save();
  }
}
