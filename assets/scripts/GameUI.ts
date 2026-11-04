import {
  _decorator, Component, Node, UITransform, Label, Color, Graphics, Button,
  Widget, SafeArea, view, ResolutionPolicy, sys, game, Game,
} from 'cc';
import { GameManager } from './core/GameCore';
const { ccclass } = _decorator;

/** Attach once to the template's Canvas; all child UI is generated at runtime. */
@ccclass('GameUI')
export class GameUI extends Component {
  private model!: GameManager;
  private stage!: Node;
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
    const safe = new Node('SafeArea'); this.node.addChild(safe);
    this.safe = safe.addComponent(UITransform);
    const widget = safe.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    widget.updateAlignment(); safe.addComponent(SafeArea);
    this.stage = new Node('NightMarket'); safe.addChild(this.stage);
    this.stage.addComponent(UITransform).setContentSize(720, 1280);
    this.panel('Backdrop', 0, 0, 720, 1280, '#160c30');
    this.panel('NeonSign', 0, 475, 630, 150, '#6b174e');
    this.label('今晚摆个摊', 0, 500, 48, '#ffcc5c');
    this.label('NIGHT MARKET · 烤肠小铺', 0, 445, 23, '#54eedc');
    this.coins = this.label('', 0, 355, 34, '#ffcc5c');
    this.label('✦ 夜市开张 · 香气满街 ✦', 0, 255, 28, '#f887cf');
    this.customer = this.label('', 0, 115, 32, '#ffffff');
    this.panel('Stall', 0, -55, 600, 170, '#b73564');
    this.label('热 烤 肠  /  滋 滋 香', 0, -35, 36, '#ffdd77');
    this.label('━━━━━━━━━━━━', 0, -95, 34, '#55e3cf');
    this.details = this.label('', 0, -195, 28, '#ffffff');
    this.panel('ProgressTrack', 0, -260, 540, 20, '#432856');
    const progress = new Node('Progress'); this.stage.addChild(progress);
    progress.setPosition(-270, -270); this.progress = progress.addComponent(Graphics);
    this.cookButton = this.button('制作烤肠', -355, '#dd3f88', () => this.model.cook())[0];
    [this.upgradeButton, this.upgradeLabel] = this.button('', -465, '#246f79', () => this.model.upgrade());
    this.status = this.label('', 0, -565, 22, '#e9b8dd');
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.render();
  }
  private label(text: string, x: number, y: number, size: number, color: string, parent = this.stage): Label {
    const node = new Node('Text'); parent.addChild(node); node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(650, 70);
    const label = node.addComponent(Label); label.string = text; label.fontSize = size;
    label.lineHeight = size + 6; label.color = new Color(color);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK; return label;
  }
  private panel(name: string, x: number, y: number, width: number, height: number, color: string): Node {
    const node = new Node(name); this.stage.addChild(node); node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const g = node.addComponent(Graphics); g.fillColor = new Color(color);
    g.roundRect(-width / 2, -height / 2, width, height, 18); g.fill(); return node;
  }
  private button(text: string, y: number, color: string, action: () => unknown): [Button, Label] {
    const node = this.panel('Button', 0, y, 580, 86, color);
    const button = node.addComponent(Button);
    const label = this.label(text, 0, 0, 32, '#ffffff', node);
    node.on(Node.EventType.TOUCH_END, () => { if (button.interactable) { action(); this.render(); } }, this);
    return [button, label];
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
      o.state === 'WAITING' ? `顾客：来份烤肠！ +${o.income}` :
      o.state === 'COOKING' ? `制作中 · ${o.remaining.toFixed(1)} 秒` : `出餐啦！ +${o.income} 金币`;
    this.details.string = `摊位 Lv.${s.stallLevel}  ·  每单 ${s.income} 金币`;
    this.cookButton.interactable = o?.state === 'WAITING';
    this.upgradeButton.interactable = s.upgradeCost !== null && s.coins >= s.upgradeCost;
    this.upgradeLabel.string = s.upgradeCost === null ? '已满级 Lv.10' : `升级摊位 · ${s.upgradeCost} 金币`;
    this.progress.clear(); this.progress.fillColor = new Color('#54eedc');
    const fraction = o?.state === 'COOKING' ? 1 - o.remaining / o.duration : o?.state === 'SERVED' ? 1 : 0;
    this.progress.rect(0, 0, 540 * fraction, 20); this.progress.fill();
    this.status.string = s.saveStatus === 'unavailable' ? '存档暂不可用，本次进度仅保留在内存' :
      s.saveStatus === 'recovered' ? '存档异常，已安全恢复初始摊位' : '自动存档 · 今晚也要好好营业';
  }
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.onHide, this); game.off(Game.EVENT_SHOW, this.onShow, this);
    this.model?.save();
  }
}
