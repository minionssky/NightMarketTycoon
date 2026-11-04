import { Node, UITransform, Label, Color } from 'cc';
import type { GameManager, RecipeId } from './core/GameCore';
import { uiLabel, uiPanel, uiButton } from './ui/UiFactory';
import { foodArt, Palette } from './ui/effects/VisualStyle';
import { vectorArt, redrawArt } from './ui/effects/VectorArt';

/** Runtime collection screen. All unlock and economic data come from the shared snapshot. */
export class RecipeBookUI {
  readonly root: Node;
  private selected: RecipeId = 'sausage';
  private progress: Label;
  private rows = new Map<RecipeId, { title: Label; condition: Label; art: Node; unlocked: boolean }>();
  private detailArt: Node;
  private detailKey = '';
  private name: Label;
  private metadata: Label;
  private description: Label;
  private stats: Label;
  private condition: Label;

  constructor(parent: Node, snapshot: GameManager['snapshot'], onBack: () => void, onChange: () => void) {
    this.root = new Node('RecipeBookUI'); this.root.layer = parent.layer; parent.addChild(this.root);
    this.root.addComponent(UITransform).setContentSize(720, 1280);
    uiPanel(this.root, 'CollectionBackdrop', 0, 0, 720, 1280, Palette.night);
    uiLabel(this.root, '夜市百味录', 0, 545, 44, Palette.gold);
    this.progress = uiLabel(this.root, '', 0, 475, 27, '#54eedc');
    snapshot.recipes.forEach((recipe, index) => {
      const [button, title] = uiButton(this.root, '', 335 - index * 180, '#432653', () => {
        this.selected = recipe.id; onChange();
      }, 630, 145);
      title.node.setPosition(65, 25);
      title.node.getComponent(UITransform)!.setContentSize(460, 50);
      const condition = uiLabel(button.node, '', 65, -32, 22, '#e0bfd6');
      condition.node.getComponent(UITransform)!.setContentSize(460, 50);
      const art = vectorArt(button.node, 'RecipeSilhouette', foodArt(recipe.id).map(shape =>
        recipe.unlocked ? shape : { ...shape, fill: '#645575' }));
      art.setPosition(-245, 0); art.setScale(.48, .48, 1);
      uiLabel(button.node, '✦', 280, 44, 20, Palette.gold).node.getComponent(UITransform)!.setContentSize(32, 32);
      this.rows.set(recipe.id, { title, condition, art, unlocked: recipe.unlocked });
    });
    uiPanel(this.root, 'RecipeDetail', 0, -290, 650, 310, '#3B234C');
    this.detailArt = vectorArt(this.root, 'DetailFood', []);
    this.detailArt.setPosition(-255, -205); this.detailArt.setScale(.48, .48, 1);
    this.name = uiLabel(this.root, '', 45, -180, 32, '#ffda82');
    this.name.node.getComponent(UITransform)!.setContentSize(460, 60);
    this.metadata = uiLabel(this.root, '', 45, -225, 20, '#54eedc');
    this.metadata.node.getComponent(UITransform)!.setContentSize(470, 50);
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
      if (row.unlocked !== recipe.unlocked) {
        redrawArt(row.art, foodArt(recipe.id).map(shape => recipe.unlocked ? shape : { ...shape, fill: '#645575' }));
        row.unlocked = recipe.unlocked;
      }
      row.title.string = `${recipe.unlocked ? '✦' : '◇'} ${recipe.name} · ${recipe.unlocked ? '已解锁' : '未解锁'}`;
      row.title.color = new Color(this.selected === recipe.id ? Palette.gold : recipe.unlocked ? '#ffffff' : '#bca7c9');
      row.condition.string = recipe.unlocked ? `${recipe.rarity} · 查看详情` :
        `累计 ${recipe.unlock.amount} 金币解锁 · 还差 ${recipe.remainingToUnlock}`;
    }
    const recipe = snapshot.recipes.find(recipe => recipe.id === this.selected)!;
    const key = `${recipe.id}:${recipe.unlocked}`;
    if (this.detailKey !== key) {
      redrawArt(this.detailArt, foodArt(recipe.id).map(shape => recipe.unlocked ? shape : { ...shape, fill: '#645575' }));
      this.detailKey = key;
    }
    this.name.string = recipe.name;
    this.metadata.string = `${recipe.chapter} / ${recipe.rarity}`;
    this.description.string = recipe.description;
    this.stats.string = `基础 ${recipe.basePrice} 金币 / ${recipe.baseDuration} 秒\n当前 Lv.${snapshot.stallLevel}：${recipe.income} 金币 / ${recipe.duration} 秒`;
    this.condition.string = recipe.unlocked ? '已解锁 · 已加入夜市轮换订单' :
      `累计收入 ${recipe.unlock.amount} 解锁（还差 ${recipe.remainingToUnlock}）`;
  }
}
