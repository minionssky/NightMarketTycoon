import { Node, UITransform, Label } from 'cc';
import type { GameManager } from '../../core/GameCore';
import { uiLabel } from '../UiFactory';
import { vectorArt, redrawArt } from './VectorArt';
import { Palette, Motion, VisualDirector, backdropArt, stallArt, counterArt, lanternArt, characterArt, foodArt } from './VisualStyle';
import type { VisualQuality } from './VisualStyle';

/** Bounded procedural scene, sampled by the owning component's single update loop. */
export class NightMarketScene {
  readonly root: Node;
  private director = new VisualDirector();
  private stall: Node;
  private lanterns: Node[];
  private guest: Node;
  private food: Node;
  private heat: Node[];
  private steam: Node[];
  private reward: Label;
  private flash: Label;
  private characterKey = '';
  private recipe = '';

  constructor(parent: Node) {
    this.root = new Node('NightMarketScene'); this.root.layer = parent.layer; parent.addChild(this.root);
    this.root.addComponent(UITransform).setContentSize(720, 650);
    this.root.setPosition(-324, 370); this.root.setScale(.9, .9, 1);
    vectorArt(this.root, 'Backdrop', backdropArt());
    this.stall = vectorArt(this.root, 'Stall', stallArt());
    this.lanterns = [vectorArt(this.root, 'LanternLeft', lanternArt()), vectorArt(this.root, 'LanternRight', lanternArt())];
    const chef = vectorArt(this.root, 'Chef', characterArt(0, true, true)); chef.setPosition(245, -400);
    this.guest = vectorArt(this.root, 'Customer', []);
    this.food = vectorArt(this.root, 'Food', []);
    vectorArt(this.root, 'Counter', counterArt());
    this.heat = Array.from({ length: Motion.maxParticles }, (_, i) => vectorArt(this.root, 'Flame', [{
      kind: 'path', x: 0, y: 0, points: [[-8, 0], [0, -35], [8, 0]], fill: i % 2 ? Palette.pink : Palette.gold,
    }]));
    this.steam = Array.from({ length: Motion.maxParticles }, () => vectorArt(this.root, 'Steam', [{
      kind: 'ellipse', x: 0, y: -16, width: 5, height: 17, fill: Palette.cream,
    }]));
    this.reward = uiLabel(this.root, '', 360, -360, 38, Palette.gold);
    this.flash = uiLabel(this.root, '✦ 升级成功 ✦', 360, -180, 34, Palette.cream);
  }
  update(snapshot: GameManager['snapshot'], dt: number, quality: VisualQuality): number {
    const frame = this.director.sample(snapshot, dt, quality), order = snapshot.order;
    if (!this.root.activeInHierarchy) return 1;
    const key = `${frame.variant}:${frame.happy}`;
    if (key !== this.characterKey) { redrawArt(this.guest, characterArt(frame.variant, frame.happy)); this.characterKey = key; }
    this.guest.active = frame.guestVisible; this.guest.setPosition(frame.guestX, -frame.guestY);
    this.stall.setScale(frame.signScale, frame.signScale, 1);
    this.stall.setPosition(270 * (1 - frame.signScale), -245 * (1 - frame.signScale));
    this.lanterns.forEach((node, index) => {
      node.setPosition(index ? 640 : 60, -40); node.angle = frame.lanternAngle * (index ? 1 : -1);
    });
    const recipe = order?.recipeId ?? 'sausage';
    if (recipe !== this.recipe) { redrawArt(this.food, foodArt(recipe)); this.recipe = recipe; }
    this.food.setPosition(280, -445); this.food.angle = 35;
    const scale = frame.cooking && quality === 'full' ? .7 + .025 * Math.sin(frame.phase * 4) : .7;
    this.food.setScale(scale, scale, 1);
    for (let i = 0; i < Motion.maxParticles; i++) {
      const rise = ((frame.phase + i / Motion.maxParticles) % 1) * 60;
      this.heat[i].active = frame.cooking && quality === 'full' && !frame.steam;
      this.steam[i].active = frame.cooking && quality === 'full' && frame.steam;
      this.heat[i].setPosition(230 + i * 18, -477 + rise);
      this.steam[i].setPosition(230 + i * 18, -477 + rise);
    }
    this.reward.node.active = frame.rewardVisible; this.reward.string = `✦ +${frame.rewardAmount}`;
    this.reward.node.setPosition(360, -360 + frame.rewardRise);
    this.flash.node.active = frame.upgradeVisible;
    return frame.hudScale;
  }
}
