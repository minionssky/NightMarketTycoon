import type { GameManager, RecipeId } from '../../core/GameCore';

/** Original procedural art. No engine, DOM, external artwork or business mutations. */
export const Palette = Object.freeze({ night: '#24133E', purple: '#8C41F6', pink: '#FF3F94',
  gold: '#FFB347', cream: '#FFF2D8', mint: '#71EFDB', ink: '#140C26', skin: '#FFD5B1' });
export const Motion = Object.freeze({ enter: .4, departDelay: .4, depart: .6, reward: .9, upgrade: .65,
  pulse: 2.8, sway: 3.6, maxParticles: 6 });
export type VisualQuality = 'full' | 'low';
export interface Shape {
  kind: 'rect' | 'ellipse' | 'path' | 'text'; x: number; y: number;
  width?: number; height?: number; radius?: number; fill: string;
  stroke?: string; lineWidth?: number; points?: readonly (readonly [number, number])[];
  text?: string; size?: number;
}
const rect = (x: number, y: number, width: number, height: number, fill: string, radius = 0): Shape =>
  ({ kind: 'rect', x, y, width, height, fill, radius });
const ellipse = (x: number, y: number, width: number, height: number, fill: string): Shape =>
  ({ kind: 'ellipse', x, y, width, height, fill });
const path = (points: readonly (readonly [number, number])[], fill: string): Shape =>
  ({ kind: 'path', x: 0, y: 0, points, fill });
const text = (x: number, y: number, value: string, fill: string, size: number): Shape =>
  ({ kind: 'text', x, y, text: value, fill, size });
export function backdropArt(): Shape[] {
  const shapes: Shape[] = [rect(0, 0, 720, 650, Palette.night), ellipse(570, 62, 42, 42, Palette.gold),
    ellipse(583, 50, 39, 39, Palette.night)];
  for (let i = 0; i < 14; i++) shapes.push(ellipse((i * 113 + 31) % 720, 20 + (i * 37) % 180, 2, 2, '#B49DCB'));
  for (let i = 0; i < 8; i++) {
    const height = 160 + (i * 43) % 100, x = i * 100 - 20;
    shapes.push(rect(x, 320 - height, 85, height, i % 2 ? '#34204E' : '#2D1B47', 3));
    for (let j = 0; j < 6; j++) shapes.push(rect(x + 12 + (j % 2) * 36,
      335 - height + Math.floor(j / 2) * 38, 14, 19, j % 3 ? '#694270' : '#C87B74', 2));
  }
  shapes.push(rect(18, 146, 42, 115, '#5C2368', 5), text(39, 181, '夜', Palette.pink, 27),
    text(39, 219, '市', Palette.gold, 27), rect(630, 194, 65, 35, '#502E70', 3),
    text(662, 217, '茶', Palette.mint, 24), rect(0, 495, 720, 155, '#342041'));
  for (let i = 0; i < 6; i++) shapes.push(rect(0, 505 + i * 28, 720, 2, '#452C4F'));
  shapes.push(ellipse(358, 605, 325, 18, '#23172F'), ellipse(560, 557, 86, 13, '#23172F'));
  return shapes;
}
export function stallArt(): Shape[] {
  const shapes: Shape[] = [rect(89, 315, 15, 210, '#C66454'), rect(441, 315, 15, 210, '#C66454'),
    path([[62, 310], [118, 267], [429, 267], [480, 310]], Palette.pink), rect(62, 310, 418, 40, '#C92F68', 6)];
  for (let i = 0; i < 9; i++) shapes.push(rect(65 + i * 46, 310, 24, 40, i % 2 ? '#F68467' : Palette.gold, 3));
  shapes.push(rect(114, 215, 315, 61, Palette.ink, 12),
    { ...rect(120, 221, 303, 49, Palette.ink, 9), stroke: Palette.gold, lineWidth: 2 },
    text(270, 255, '烟 火 小 铺', Palette.cream, 31));
  return shapes;
}
export function counterArt(): Shape[] {
  return [rect(67, 480, 411, 31, Palette.gold, 7), rect(82, 511, 380, 89, '#AE4C52', 6),
    rect(96, 525, 352, 60, '#7E3150', 5), text(273, 566, '一 口 烟 火 · 一 夜 好 生 意', Palette.cream, 19),
    rect(119, 600, 20, 18, '#55223F'), rect(408, 600, 20, 18, '#55223F')];
}
export function lanternArt(): Shape[] {
  return [rect(-1, 0, 2, 24, Palette.gold), ellipse(0, 58, 27, 38, Palette.pink),
    ellipse(0, 58, 12, 37, '#F87686'), rect(-17, 21, 34, 6, Palette.gold, 3),
    rect(-17, 90, 34, 6, Palette.gold, 3), rect(-2, 96, 4, 23, Palette.gold),
    text(0, 68, '福', Palette.cream, 23)];
}
export function characterArt(variant: number, happy = false, chef = false): Shape[] {
  const bun = variant % 2 === 0, coat = bun ? Palette.purple : '#2F9C99';
  const shapes: Shape[] = [rect(-32, 75, 24, 29, '#382848', 8), rect(8, 75, 24, 29, '#382848', 8),
    rect(-42, 7, 84, 80, chef ? '#F3985A' : coat, 23),
    ellipse(-47, 35, 15, 34, Palette.skin), ellipse(47, 35, 15, 34, Palette.skin),
    ellipse(-58, -44, 12, 17, Palette.skin), ellipse(58, -44, 12, 17, Palette.skin),
    ellipse(0, -49, 61, 61, '#28213B'), ellipse(0, -37, 57, 48, Palette.skin),
    path([[-58, -57], [-44, -87], [33, -94], [59, -59], [26, -71], [6, -51], [-11, -75]], '#28213B')];
  if (chef) shapes.push(rect(-48, -112, 96, 37, Palette.cream, 12),
    ellipse(-29, -116, 26, 25, Palette.cream), ellipse(10, -124, 33, 28, Palette.cream),
    rect(-27, 21, 54, 60, Palette.cream, 8), rect(-30, 38, 60, 5, '#D76456'));
  else if (bun) shapes.push(ellipse(-47, -93, 22, 22, '#28213B'), ellipse(47, -93, 22, 22, '#28213B'),
    rect(-65, -94, 30, 6, Palette.pink, 3), rect(35, -94, 30, 6, Palette.pink, 3));
  else shapes.push(rect(-57, -98, 114, 25, Palette.gold, 10), rect(-10, -83, 77, 8, '#DA7D48', 4));
  shapes.push(ellipse(-22, -39, 5, happy ? 2 : 7, '#302037'), ellipse(22, -39, 5, happy ? 2 : 7, '#302037'),
    ellipse(-35, -20, 10, 5, '#EF9E9C'), ellipse(35, -20, 10, 5, '#EF9E9C'),
    ellipse(0, -16, happy ? 12 : 7, happy ? 7 : 3, '#B94B65'));
  return shapes;
}
export function foodArt(id: RecipeId): Shape[] {
  if (id === 'milk_tea') return [path([[-34, -32], [34, -32], [27, 42], [-27, 42]], '#F2BA79'),
    rect(-37, -39, 74, 11, '#FF3F94', 5), rect(9, -65, 7, 48, Palette.mint, 2),
    ...[-18, 0, 17, -10, 12].map((x, i) => ellipse(x, 19 + (i % 2) * 12, 5, 5, '#49324A'))];
  if (id === 'fried_skewer') return [rect(-4, -60, 8, 120, '#E3A85D', 3),
    ...[-34, 0, 34].flatMap(y => [rect(-30, y - 13, 60, 26, Palette.gold, 10), rect(-22, y - 8, 6, 16, '#ED6D3F', 2)])];
  return [rect(-4, -65, 8, 130, '#E3A85D', 3), rect(-27, -51, 54, 97, '#FF613E', 24),
    ...[-23, 0, 23].map(y => path([[-18, y], [14, y - 10], [17, y - 4], [-15, y + 6]], '#FFB347'))];
}
export interface VisualFrame {
  quality: VisualQuality; variant: number; happy: boolean; guestVisible: boolean;
  guestX: number; guestY: number; signScale: number; lanternAngle: number;
  cooking: boolean; steam: boolean; phase: number; rewardVisible: boolean;
  rewardAmount: number; rewardRise: number; upgradeVisible: boolean; hudScale: number;
}
/** One bounded visual timeline; it observes snapshots and never calls the game or storage. */
export class VisualDirector {
  private initialized = false;
  private orderId: number | null = null;
  private orderState: string | undefined;
  private orders = 0;
  private level = 1;
  private elapsed = 0;
  private orderAge = 0;
  private stateAge = 0;
  private rewardAge = Infinity;
  private upgradeAge = Infinity;
  private rewardAmount = 0;
  sample(snapshot: GameManager['snapshot'], dt: number, quality: VisualQuality): VisualFrame {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid visual delta');
    const order = snapshot.order;
    this.elapsed = (this.elapsed + dt) % 3600;
    this.orderAge += dt; this.stateAge += dt; this.rewardAge += dt; this.upgradeAge += dt;
    if (order?.id !== this.orderId) { this.orderId = order?.id ?? null; this.orderAge = 0; }
    if (order?.state !== this.orderState) { this.orderState = order?.state; this.stateAge = 0; }
    if (this.initialized && snapshot.totalOrders > this.orders) {
      this.rewardAge = 0; this.rewardAmount = order?.income ?? 0;
    }
    if (this.initialized && snapshot.stallLevel > this.level) this.upgradeAge = 0;
    this.orders = snapshot.totalOrders; this.level = snapshot.stallLevel; this.initialized = true;
    const moving = quality === 'full';
    const enter = Math.min(1, this.orderAge / Motion.enter);
    const exit = order?.state === 'EXITED' ? 1 : order?.state === 'SERVED' ?
      Math.max(0, Math.min(1, (this.stateAge - Motion.departDelay) / Motion.depart)) : 0;
    return { quality, variant: (order?.id ?? 1) % 2, happy: order?.state === 'SERVED',
      guestVisible: !!order && order.state !== 'EXITED', guestX: moving ? 555 + 245 * (1 - enter) ** 2 + 250 * exit : 555,
      guestY: moving ? 430 + 3 * Math.sin(this.elapsed * 3) : 430,
      signScale: moving ? 1 + .012 * Math.sin(this.elapsed * Math.PI * 2 / Motion.pulse) : 1,
      lanternAngle: moving ? 4 * Math.sin(this.elapsed * Math.PI * 2 / Motion.sway) : 0,
      cooking: order?.state === 'COOKING', steam: order?.recipeId === 'milk_tea', phase: moving ? this.elapsed * 3 : 0,
      rewardVisible: this.rewardAge < Motion.reward, rewardAmount: this.rewardAmount,
      rewardRise: moving ? 70 * Math.min(1, this.rewardAge / Motion.reward) : 0,
      upgradeVisible: this.upgradeAge < Motion.upgrade,
      hudScale: moving && this.upgradeAge < Motion.upgrade ? 1 + .08 * Math.sin(this.upgradeAge / Motion.upgrade * Math.PI) : 1 };
  }
}
