import { Node, UITransform, Label, Color } from 'cc';
import type { GameManager, RecipeId } from './core/GameCore';
import { uiLabel, uiPanel, uiButton } from './ui/UiFactory';

/** Runtime collection screen. All unlock and economic data come from the shared snapshot. */
export class RecipeBookUI {
  readonly root: Node;
  private selected: RecipeId = 'sausage';
  private progress: Label;
  private rows = new Map<RecipeId, { title: Label; condition: Label }>();
  private name: Label;
  private metadata: Label;
  private description: Label;
  private stats: Label;
  private condition: Label;

  constructor(parent: Node, snapshot: GameManager['snapshot'], onBack: () => void, onChange: () => void) {
    this.root = new Node('RecipeBookUI'); this.root.layer = parent.layer; parent.addChild(this.root);
    this.root.addComponent(UITransform).setContentSize(720, 1280);
    uiPanel(this.root, 'CollectionBackdrop', 0, 0, 720, 1280, '#190e30');
    uiLabel(this.root, '夜市百味录', 0, 545, 44, '#ffd16c');
    this.progress = uiLabel(this.root, '', 0, 475, 27, '#54eedc');
    snapshot.recipes.forEach((recipe, index) => {
      const [button, title] = uiButton(this.root, '', 335 - index * 180, '#3d2049', () => {
        this.selected = recipe.id; onChange();
      }, 630, 145);
      title.node.setPosition(0, 25);
      title.node.getComponent(UITransform)!.setContentSize(590, 50);
      const condition = uiLabel(button.node, '', 0, -32, 22, '#e0bfd6');
      condition.node.getComponent(UITransform)!.setContentSize(590, 50);
      this.rows.set(recipe.id, { title, condition });
    });
    uiPanel(this.root, 'RecipeDetail', 0, -290, 650, 310, '#301635');
    this.name = uiLabel(this.root, '', 0, -180, 32, '#ffda82');
    this.metadata = uiLabel(this.root, '', 0, -225, 20, '#54eedc');
    this.description = uiLabel(this.root, '', 0, -270, 21, '#e2b4d1');
    this.stats = uiLabel(this.root, '', 0, -330, 23, '#ffffff');
    this.condition = uiLabel(this.root, '', 0, -400, 22, '#e2b4d1');
    uiButton(this.root, '← 返回经营', -530, '#246f79', onBack);
    this.root.active = false;
  }
  render(snapshot: GameManager['snapshot']): void {
    const count = snapshot.recipes.filter(recipe => recipe.unlocked).length;
    this.progress.string = `已收集 ${count}/${snapshot.recipes.length} · 累计收入 ${snapshot.totalEarned}`;
    for (const recipe of snapshot.recipes) {
      const row = this.rows.get(recipe.id)!;
      row.title.string = `${recipe.unlocked ? '✦' : '◇'} ${recipe.name} · ${recipe.unlocked ? '已解锁' : '未解锁'}`;
      row.title.color = new Color(this.selected === recipe.id ? '#ffd16c' : recipe.unlocked ? '#ffffff' : '#bca7c9');
      row.condition.string = recipe.unlocked ? `${recipe.rarity} · 查看详情` :
        `累计 ${recipe.unlock.amount} 金币解锁 · 还差 ${recipe.remainingToUnlock}`;
    }
    const recipe = snapshot.recipes.find(recipe => recipe.id === this.selected)!;
    this.name.string = recipe.name;
    this.metadata.string = `${recipe.chapter} / ${recipe.rarity}`;
    this.description.string = recipe.description;
    this.stats.string = `基础 ${recipe.basePrice} 金币 / ${recipe.baseDuration} 秒\n当前 Lv.${snapshot.stallLevel}：${recipe.income} 金币 / ${recipe.duration} 秒`;
    this.condition.string = recipe.unlocked ? '已解锁 · 已加入夜市轮换订单' :
      `累计收入 ${recipe.unlock.amount} 解锁（还差 ${recipe.remainingToUnlock}）`;
  }
}
