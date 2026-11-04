import {
  _decorator, Component, Node, UITransform, Label, Color, Graphics, Button,
  Widget, SafeArea, view, ResolutionPolicy, sys, game, Game, BlockInputEvents,
} from 'cc';
import { GameManager, getRecipe } from './core/GameCore';
import { RecipeBookUI } from './RecipeBookUI';
import { uiLabel, uiPanel, uiButton } from './ui/UiFactory';
const { ccclass } = _decorator;

/** Attach once to the template's Canvas; all child UI is generated at runtime. */
@ccclass('GameUI')
export class GameUI extends Component {
  private model!: GameManager;
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
    this.panel('Backdrop', 0, 0, 720, 1280, '#160c30');
    this.panel('NeonSign', 0, 475, 630, 150, '#6b174e');
    this.label('今晚摆个摊', 0, 500, 48, '#ffcc5c');
    this.label('NIGHT MARKET · 烟火小铺', 0, 445, 23, '#54eedc');
    this.coins = this.label('', 0, 355, 34, '#ffcc5c');
    this.label('✦ 夜市开张 · 香气满街 ✦', 0, 255, 28, '#f887cf');
    this.customer = this.label('', 0, 115, 32, '#ffffff');
    this.panel('Stall', 0, -55, 600, 170, '#b73564');
    this.label('夜 市 百 味 / 现 点 现 做', 0, -35, 36, '#ffdd77');
    this.label('━━━━━━━━━━━━', 0, -95, 34, '#55e3cf');
    this.details = this.label('', 0, -195, 28, '#ffffff');
    this.panel('ProgressTrack', 0, -260, 540, 20, '#432856');
    const progress = new Node('Progress'); progress.layer = this.market.layer; this.market.addChild(progress);
    progress.setPosition(-270, -270); this.progress = progress.addComponent(Graphics);
    [this.cookButton, this.cookLabel] = this.button('制作烤肠', -335, '#dd3f88', () => this.model.cook());
    [this.upgradeButton, this.upgradeLabel] = this.button('', -435, '#246f79', () => this.model.upgrade());
    [, this.bookLabel] = this.button('菜谱收藏册', -535, '#53345b', () => {
      this.market.active = false; this.book.root.active = true;
    });
    this.status = this.label('', 0, -615, 18, '#e9b8dd');
    this.book = new RecipeBookUI(this.stage, this.model.snapshot, () => {
      this.book.root.active = false; this.market.active = true;
    }, () => this.render());
    this.notice = new Node('UnlockNotice'); this.notice.layer = this.stage.layer; this.stage.addChild(this.notice);
    this.notice.addComponent(UITransform).setContentSize(720, 1280);
    this.notice.addComponent(BlockInputEvents);
    uiPanel(this.notice, 'ModalBackdrop', 0, 0, 720, 1280, '#160c30e8');
    uiPanel(this.notice, 'Modal', 0, 0, 650, 350, '#52234e');
    uiLabel(this.notice, '✦ 新菜谱解锁 ✦', 0, 100, 40, '#ffd16c');
    this.noticeText = uiLabel(this.notice, '', 0, 20, 30, '#ffffff');
    uiButton(this.notice, '收进收藏册', -100, '#dd3f88', () => { this.notice.active = false; });
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
  private onShow(): void { this.paused = false; }
  update(dt: number): void {
    if (!this.model || this.paused) return;
    this.model.tick(dt); this.render();
  }
  private render(): void {
    const scale = Math.min(this.safe.width / 720, this.safe.height / 1280);
    this.stage.setScale(scale, scale, 1);
    const s = this.model.snapshot; const o = s.order;
    this.coins.string = `金币  ${s.coins}`;
    this.customer.string = !o || o.state === 'EXITED' ? '灯火通明，等候新顾客…' :
      o.state === 'WAITING' ? `顾客：来份${getRecipe(o.recipeId).name}！ +${o.income}` :
      o.state === 'COOKING' ? `制作${getRecipe(o.recipeId).name} · ${o.remaining.toFixed(1)} 秒` : `出餐啦！ +${o.income} 金币`;
    this.cookLabel.string = o ? `制作${getRecipe(o.recipeId).name}` : '等待顾客';
    this.details.string = `摊位 Lv.${s.stallLevel}  ·  烤肠 ${s.income} 金币/单`;
    this.cookButton.interactable = o?.state === 'WAITING';
    this.upgradeButton.interactable = s.upgradeCost !== null && s.coins >= s.upgradeCost;
    this.upgradeLabel.string = s.upgradeCost === null ? '已满级 Lv.10' : `升级摊位 · ${s.upgradeCost} 金币`;
    this.progress.clear(); this.progress.fillColor = new Color('#54eedc');
    const fraction = o?.state === 'COOKING' ? 1 - o.remaining / o.duration : o?.state === 'SERVED' ? 1 : 0;
    this.progress.rect(0, 0, 540 * fraction, 20); this.progress.fill();
    this.status.string = s.saveStatus === 'unavailable' ? '存档暂不可用，本次进度仅保留在内存' :
      s.saveStatus === 'recovered' ? '存档异常，已安全恢复初始摊位' : '自动存档 · 今晚也要好好营业';
    this.bookLabel.string = `菜谱收藏册 · ${s.recipes.filter(recipe => recipe.unlocked).length}/${s.recipes.length}`;
    this.book.render(s);
    if (!this.notice.active && s.unlockNotifications.length) {
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
