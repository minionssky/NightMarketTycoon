/** Engine-free domain. Seconds are elapsed foreground gameplay time, never wall time. */
export const GameConfig = Object.freeze({
  saveKey: 'night_market_save_v1', version: 1, maxLevel: 10,
  get baseIncome(): number { return Sausage.basePrice; },
  incomeGrowth: 1.2, baseUpgradeCost: 50, upgradeGrowth: 1.5,
  arrivalSeconds: 1,
});
export type RecipeId = 'sausage' | 'milk_tea' | 'fried_skewer';
export interface RecipeDefinition {
  readonly id: RecipeId; readonly name: string; readonly basePrice: number;
  readonly baseDuration: number; readonly chapter: string; readonly rarity: string;
  readonly description: string;
  readonly unlock: Readonly<{ kind: 'totalEarned'; amount: number }>;
}
const defineRecipe = (recipe: RecipeDefinition): RecipeDefinition =>
  Object.freeze({ ...recipe, unlock: Object.freeze(recipe.unlock) });
/** The only recipe registry; catalog and orders both query RecipeManager. */
export const RecipeConfig: readonly RecipeDefinition[] = Object.freeze([
  defineRecipe({ id: 'sausage', name: '烤肠', basePrice: 10, baseDuration: 2,
    chapter: '第一章 · 烟火街头', rarity: '寻常美味', description: '炭火翻烤，外脆里嫩。夜市的第一口香气。',
    unlock: { kind: 'totalEarned', amount: 0 } }),
  defineRecipe({ id: 'milk_tea', name: '奶茶', basePrice: 25, baseDuration: 4,
    chapter: '第一章 · 烟火街头', rarity: '人气招牌', description: '茶香与奶香交融，为热闹的夜晚添一口甜。',
    unlock: { kind: 'totalEarned', amount: 500 } }),
  defineRecipe({ id: 'fried_skewer', name: '炸串', basePrice: 45, baseDuration: 5,
    chapter: '第一章 · 烟火街头', rarity: '夜市珍味', description: '金黄酥脆，撒上香料，一串接一串。',
    unlock: { kind: 'totalEarned', amount: 2000 } }),
]);
export const Sausage = RecipeConfig[0];
export function getRecipe(id: RecipeId): RecipeDefinition {
  const recipe = RecipeConfig.find(recipe => recipe.id === id);
  if (!recipe) throw new RangeError('Unknown recipe');
  return recipe;
}
export interface RecipeUnlockEvent { readonly type: 'recipe-unlocked'; readonly recipeId: RecipeId }
export interface RecipeEntry extends RecipeDefinition {
  readonly unlocked: boolean; readonly remainingToUnlock: number;
  readonly income: number; readonly duration: number;
}
export class RecipeManager {
  private totalEarned: number;
  private notified = new Set<RecipeId>();
  constructor(totalEarned: number, notified: unknown = []) {
    this.totalEarned = totalEarned;
    for (const id of RecipeManager.sanitizeNotified(notified, totalEarned)) this.notified.add(id);
  }
  static sanitizeNotified(value: unknown, totalEarned: number): RecipeId[] {
    return RecipeConfig.filter(recipe => recipe.unlock.amount > 0 && recipe.unlock.amount <= totalEarned &&
      Array.isArray(value) && value.includes(recipe.id)).map(recipe => recipe.id);
  }
  isUnlocked(id: RecipeId): boolean { return getRecipe(id).unlock.amount <= this.totalEarned; }
  get unlockedRecipes(): readonly RecipeDefinition[] {
    return RecipeConfig.filter(recipe => this.isUnlocked(recipe.id));
  }
  get notifiedRecipeIds(): RecipeId[] { return RecipeConfig.filter(r => this.notified.has(r.id)).map(r => r.id); }
  get notifications(): RecipeUnlockEvent[] {
    return this.unlockedRecipes.filter(r => r.unlock.amount > 0 && !this.notified.has(r.id))
      .map(r => ({ type: 'recipe-unlocked', recipeId: r.id }));
  }
  /** Pull events: only the first threshold crossing emits. Pending UI notices remain until acknowledged. */
  checkUnlocks(totalEarned: number): RecipeUnlockEvent[] {
    const before = new Set(this.unlockedRecipes.map(recipe => recipe.id));
    this.totalEarned = Math.max(this.totalEarned, totalEarned);
    return this.unlockedRecipes.filter(recipe => !before.has(recipe.id))
      .map(recipe => ({ type: 'recipe-unlocked', recipeId: recipe.id }));
  }
  acknowledge(id: RecipeId): boolean {
    if (!this.notifications.some(event => event.recipeId === id)) return false;
    this.notified.add(id); return true;
  }
  catalog(level: number): RecipeEntry[] {
    return RecipeConfig.map(recipe => ({ ...recipe, unlocked: this.isUnlocked(recipe.id),
      remainingToUnlock: Math.max(0, recipe.unlock.amount - this.totalEarned),
      income: EconomyManager.income(level, recipe.id), duration: EconomyManager.duration(level, recipe.id) }));
  }
}
export type OrderState = 'WAITING' | 'COOKING' | 'SERVED' | 'EXITED';
export interface Order {
  readonly id: number; readonly recipeId: RecipeId; readonly income: number;
  readonly duration: number; readonly state: OrderState; readonly remaining: number;
}
export interface SaveData {
  version: number; coins: number; stallLevel: number; totalEarned: number;
  totalOrders: number; lastSaveTime: number; notifiedRecipeIds?: RecipeId[];
}
export interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface AdService { showRewarded(): Promise<boolean> } // No ad integration in Phase 1.
export const freshSave = (): SaveData => ({
  version: GameConfig.version, coins: 0, stallLevel: 1, totalEarned: 0,
  totalOrders: 0, lastSaveTime: 0, notifiedRecipeIds: [],
});
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export class SaveManager {
  private storage: Storage;
  status: 'ok' | 'recovered' | 'unavailable' = 'ok';
  constructor(storage: Storage) { this.storage = storage; }
  load(): SaveData {
    try {
      const raw = this.storage.getItem(GameConfig.saveKey);
      if (raw === null) return freshSave();
      const d = JSON.parse(raw) as SaveData | null;
      if (!d || d.version !== GameConfig.version || !natural(d.coins) ||
          !natural(d.stallLevel) || d.stallLevel < 1 || d.stallLevel > GameConfig.maxLevel ||
          !natural(d.totalEarned) || d.totalEarned < d.coins ||
          !natural(d.totalOrders) || !natural(d.lastSaveTime)) {
        this.status = 'recovered'; return freshSave();
      }
      // Whitelist fields; an old active order must never be restored or paid again.
      return { version: d.version, coins: d.coins, stallLevel: d.stallLevel,
        totalEarned: d.totalEarned, totalOrders: d.totalOrders, lastSaveTime: d.lastSaveTime,
        notifiedRecipeIds: RecipeManager.sanitizeNotified(d.notifiedRecipeIds, d.totalEarned) };
    } catch { this.status = 'recovered'; return freshSave(); }
  }
  save(data: SaveData, now: number): boolean {
    try {
      this.storage.setItem(GameConfig.saveKey, JSON.stringify({ ...data, lastSaveTime: now }));
      this.status = 'ok'; return true;
    } catch { this.status = 'unavailable'; return false; }
  }
}
export class EconomyManager {
  static income(level: number, recipeId: RecipeId = Sausage.id): number {
    return Math.round(getRecipe(recipeId).basePrice * GameConfig.incomeGrowth ** (level - 1));
  }
  static duration(level: number, recipeId: RecipeId = Sausage.id): number {
    return getRecipe(recipeId).baseDuration * (level <= 3 ? 1 : level <= 6 ? 0.9 : 0.8);
  }
}
export class UpgradeManager {
  static cost(level: number): number | null {
    return level >= GameConfig.maxLevel ? null :
      Math.round(GameConfig.baseUpgradeCost * GameConfig.upgradeGrowth ** (level - 1));
  }
}
export class OrderManager {
  private current: Order | null = null;
  private arrival: number = GameConfig.arrivalSeconds;
  private nextId = 1;
  private recipeCursor = 0;
  get order(): Order | null { return this.current ? { ...this.current } : null; }
  cook(): boolean {
    if (this.current?.state !== 'WAITING') return false;
    this.current = { ...this.current, state: 'COOKING' }; return true;
  }
  /** Returns a reward once, only on the COOKING -> SERVED edge. */
  tick(dt: number, level: number, recipes: readonly RecipeDefinition[] = [Sausage]): number | null {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid elapsed seconds');
    if (!this.current || this.current.state === 'EXITED') {
      this.arrival = Math.max(0, this.arrival - dt);
      if (this.arrival <= 1e-9) {
        const recipe = recipes[this.recipeCursor++ % recipes.length];
        if (!recipe) throw new RangeError('At least one unlocked recipe is required');
        this.current = { id: this.nextId++, recipeId: recipe.id, state: 'WAITING',
          income: EconomyManager.income(level, recipe.id), duration: EconomyManager.duration(level, recipe.id),
          remaining: EconomyManager.duration(level, recipe.id) };
      }
      return null;
    }
    if (this.current.state === 'COOKING') {
      const remaining = Math.max(0, this.current.remaining - dt);
      this.current = { ...this.current, remaining };
      if (remaining <= 1e-9) {
        this.current = { ...this.current, remaining: 0, state: 'SERVED' };
        this.arrival = GameConfig.arrivalSeconds;
        return this.current.income;
      }
    } else if (this.current.state === 'SERVED') {
      this.arrival = Math.max(0, this.arrival - dt);
      if (this.arrival <= 1e-9) this.current = { ...this.current, state: 'EXITED' };
    }
    return null;
  }
}
export class GameManager {
  private data: Omit<SaveData, 'notifiedRecipeIds'>;
  private recipes: RecipeManager;
  private orders = new OrderManager();
  private saves: SaveManager;
  private now: () => number;
  constructor(storage: Storage, now: () => number = Date.now) {
    this.saves = new SaveManager(storage); this.now = now;
    const { notifiedRecipeIds, ...data } = this.saves.load();
    this.data = data; this.recipes = new RecipeManager(data.totalEarned, notifiedRecipeIds);
  }
  get snapshot() {
    return { ...this.data, notifiedRecipeIds: this.recipes.notifiedRecipeIds,
      recipes: this.recipes.catalog(this.data.stallLevel), unlockNotifications: this.recipes.notifications,
      order: this.orders.order, income: EconomyManager.income(this.data.stallLevel),
      upgradeCost: UpgradeManager.cost(this.data.stallLevel), saveStatus: this.saves.status };
  }
  cook(): boolean { return this.orders.cook(); }
  tick(seconds: number): void {
    const reward = this.orders.tick(seconds, this.data.stallLevel, this.recipes.unlockedRecipes);
    if (reward !== null) {
      this.data.coins += reward; this.data.totalEarned += reward; this.data.totalOrders++;
      this.recipes.checkUnlocks(this.data.totalEarned); this.save();
    }
  }
  acknowledgeRecipeUnlock(id: RecipeId): boolean {
    if (!this.recipes.acknowledge(id)) return false;
    this.save(); return true;
  }
  upgrade(): boolean {
    const cost = UpgradeManager.cost(this.data.stallLevel);
    if (cost === null || this.data.coins < cost) return false;
    this.data.coins -= cost; this.data.stallLevel++; this.save(); return true;
  }
  save(): boolean {
    const timestamp = this.now();
    if (!natural(timestamp)) return false;
    if (!this.saves.save({ ...this.data, notifiedRecipeIds: this.recipes.notifiedRecipeIds }, timestamp)) return false;
    this.data.lastSaveTime = timestamp; return true;
  }
}
