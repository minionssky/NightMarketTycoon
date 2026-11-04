/** Engine-free domain. Seconds are elapsed foreground gameplay time, never wall time. */
export const GameConfig = Object.freeze({
  saveKey: 'night_market_save_v1', version: 1, maxLevel: 10,
  baseIncome: 10, incomeGrowth: 1.2, baseUpgradeCost: 50, upgradeGrowth: 1.5,
  arrivalSeconds: 1,
});
export type RecipeId = 'sausage'; // Phase 2 extends this ID and supplies one recipe registry.
export interface RecipeDefinition { readonly id: RecipeId; readonly name: string }
export const Sausage: RecipeDefinition = Object.freeze({ id: 'sausage', name: '烤肠' });
export type OrderState = 'WAITING' | 'COOKING' | 'SERVED' | 'EXITED';
export interface Order {
  readonly id: number; readonly recipeId: RecipeId; readonly income: number;
  readonly duration: number; readonly state: OrderState; readonly remaining: number;
}
export interface SaveData {
  version: number; coins: number; stallLevel: number; totalEarned: number;
  totalOrders: number; lastSaveTime: number;
}
export interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface AdService { showRewarded(): Promise<boolean> } // No ad integration in Phase 1.
export const freshSave = (): SaveData => ({
  version: GameConfig.version, coins: 0, stallLevel: 1, totalEarned: 0,
  totalOrders: 0, lastSaveTime: 0,
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
        totalEarned: d.totalEarned, totalOrders: d.totalOrders, lastSaveTime: d.lastSaveTime };
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
  static income(level: number): number {
    return Math.round(GameConfig.baseIncome * GameConfig.incomeGrowth ** (level - 1));
  }
  static duration(level: number): number { return level <= 3 ? 2 : level <= 6 ? 1.8 : 1.6; }
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
  get order(): Order | null { return this.current ? { ...this.current } : null; }
  cook(): boolean {
    if (this.current?.state !== 'WAITING') return false;
    this.current = { ...this.current, state: 'COOKING' }; return true;
  }
  /** Returns a reward once, only on the COOKING -> SERVED edge. */
  tick(dt: number, level: number): number | null {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid elapsed seconds');
    if (!this.current || this.current.state === 'EXITED') {
      this.arrival = Math.max(0, this.arrival - dt);
      if (this.arrival <= 1e-9) {
        this.current = { id: this.nextId++, recipeId: Sausage.id, state: 'WAITING',
          income: EconomyManager.income(level), duration: EconomyManager.duration(level),
          remaining: EconomyManager.duration(level) };
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
  private data: SaveData;
  private orders = new OrderManager();
  private saves: SaveManager;
  private now: () => number;
  constructor(storage: Storage, now: () => number = Date.now) {
    this.saves = new SaveManager(storage); this.now = now; this.data = this.saves.load();
  }
  get snapshot() {
    return { ...this.data, order: this.orders.order, income: EconomyManager.income(this.data.stallLevel),
      upgradeCost: UpgradeManager.cost(this.data.stallLevel), saveStatus: this.saves.status };
  }
  cook(): boolean { return this.orders.cook(); }
  tick(seconds: number): void {
    const reward = this.orders.tick(seconds, this.data.stallLevel);
    if (reward !== null) {
      this.data.coins += reward; this.data.totalEarned += reward; this.data.totalOrders++;
      this.save();
    }
  }
  upgrade(): boolean {
    const cost = UpgradeManager.cost(this.data.stallLevel);
    if (cost === null || this.data.coins < cost) return false;
    this.data.coins -= cost; this.data.stallLevel++; this.save(); return true;
  }
  save(): boolean {
    const timestamp = this.now();
    if (!natural(timestamp)) return false;
    if (!this.saves.save(this.data, timestamp)) return false;
    this.data.lastSaveTime = timestamp; return true;
  }
}
