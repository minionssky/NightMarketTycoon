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
  totalOrders: number; lastSaveTime: number; notifiedRecipeIds?: RecipeId[]; progress?: ProgressState;
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
  private revision: string | null = null;
  status: 'ok' | 'recovered' | 'unavailable' = 'ok';
  constructor(storage: Storage) { this.storage = storage; }
  load(): SaveData {
    try {
      const raw = this.storage.getItem(GameConfig.saveKey); this.revision = raw;
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
        totalEarned: d.totalEarned, totalOrders: d.totalOrders, lastSaveTime: validTime(d.lastSaveTime) ? d.lastSaveTime : 0,
        notifiedRecipeIds: RecipeManager.sanitizeNotified(d.notifiedRecipeIds, d.totalEarned), progress: d.progress };
    } catch { this.status = 'recovered'; return freshSave(); }
  }
  checkRevision(): 'current' | 'stale' | 'unavailable' {
    try { return this.storage.getItem(GameConfig.saveKey) === this.revision ? 'current' : 'stale'; }
    catch { return 'unavailable'; }
  }
  save(data: SaveData, now: number): boolean {
    try {
      const raw = JSON.stringify({ ...data, lastSaveTime: now });
      this.storage.setItem(GameConfig.saveKey, raw); this.revision = raw;
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
export const MonetizationConfig = Object.freeze({
  offlineCoinsPerSecond: 0.1, offlineCapSeconds: 4 * 60 * 60,
  timezoneOffsetMinutes: 480, dayMs: 86_400_000,
  maxTimestamp: 8_640_000_000_000_000 - 28_800_000,
});
export const TaskConfig = Object.freeze([
  Object.freeze({ id: 'orders_5', name: '完成 5 单', metric: 'orders', target: 5, reward: 30 }),
  Object.freeze({ id: 'orders_15', name: '完成 15 单', metric: 'orders', target: 15, reward: 80 }),
  Object.freeze({ id: 'coins_300', name: '累计收取 300 金币', metric: 'coins', target: 300, reward: 60 }),
] as const);
export type TaskId = typeof TaskConfig[number]['id'];
export type AdPlacement = 'offline_double' | 'order_bonus';
export type AdResult = { status: 'completed' | 'cancelled' | 'failed' | 'unavailable' };
export interface IRewardAdService { showRewardedAd(placement: AdPlacement): Promise<AdResult> }
export type MockAdMode = 'complete' | 'cancel' | 'error' | 'duplicate';
export class MockAdService implements IRewardAdService {
  mode: MockAdMode = 'complete';
  emittedCallbacks = 0;
  private schedule: (callback: () => void) => void;
  constructor(schedule: (callback: () => void) => void = callback => { void Promise.resolve().then(callback); }) {
    this.schedule = schedule;
  }
  showRewardedAd(_placement: AdPlacement): Promise<AdResult> {
    const mode = this.mode;
    return new Promise(resolve => this.schedule(() => {
      const result: AdResult = { status: mode === 'cancel' ? 'cancelled' : mode === 'complete' || mode === 'duplicate' ? 'completed' : 'failed' };
      this.emittedCallbacks++; resolve(result);
      if (mode === 'duplicate') { this.emittedCallbacks++; resolve(result); } // Promise settlement ignores duplicate callbacks.
    }));
  }
}
/** Deliberately disabled adapter. No production unit ID or platform callbacks are fabricated. */
export class WeChatRewardAdService implements IRewardAdService {
  readonly platformAvailable: boolean;
  readonly enabled = false;
  constructor(wxEnvironment: unknown) {
    this.platformAvailable = !!wxEnvironment && typeof (wxEnvironment as { createRewardedVideoAd?: unknown }).createRewardedVideoAd === 'function';
  }
  async showRewardedAd(_placement: AdPlacement): Promise<AdResult> { return { status: 'unavailable' }; }
}
export interface OfflineOffer {
  id: string; start: number; end: number; level: number; seconds: number; amount: number;
  baseClaimed: boolean; bonusClaimed: boolean;
}
export interface DailyProgress { day: number; orders: number; coins: number; claimed: TaskId[] }
export interface ProgressState {
  schema: 1; cursor: number; daily: DailyProgress; offline: OfflineOffer | null;
  orderOffer: { number: number; amount: number } | null; orderRewardThrough: number;
}
export type ClaimStatus = 'success' | 'not_ready' | 'already_claimed' | 'storage_error' | 'invalid_clock' | 'busy' | 'cancelled' | 'failed' | 'unavailable' | 'expired' | 'limit';
export interface ClaimResult { status: ClaimStatus; coins?: number; requestId?: string }
export const validTime = (value: unknown): value is number => natural(value) && value <= MonetizationConfig.maxTimestamp;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export class OfflineManager {
  static calculate(start: number, end: number, level: number): { seconds: number; amount: number } {
    if (!validTime(start) || !validTime(end) || !natural(level) || level < 1 || level > GameConfig.maxLevel)
      return { seconds: 0, amount: 0 };
    const seconds = Math.min(MonetizationConfig.offlineCapSeconds, Math.floor(Math.max(0, end - start) / 1000));
    return { seconds, amount: Math.floor(seconds * MonetizationConfig.offlineCoinsPerSecond * GameConfig.incomeGrowth ** (level - 1)) };
  }
}
export class DailyTaskManager {
  static day(timestamp: number): number {
    return Math.floor((timestamp + MonetizationConfig.timezoneOffsetMinutes * 60_000) / MonetizationConfig.dayMs);
  }
  static fresh(timestamp: number): DailyProgress { return { day: this.day(timestamp), orders: 0, coins: 0, claimed: [] }; }
  static entries(progress: DailyProgress) {
    return TaskConfig.map(task => ({ ...task, progress: Math.min(task.target, progress[task.metric]),
      claimed: progress.claimed.includes(task.id), ready: progress[task.metric] >= task.target && !progress.claimed.includes(task.id) }));
  }
}
const copyProgress = (state: ProgressState): ProgressState => ({ schema: 1, cursor: state.cursor,
  daily: { day: state.daily.day, orders: state.daily.orders, coins: state.daily.coins, claimed: [...state.daily.claimed] },
  offline: state.offline ? { id: state.offline.id, start: state.offline.start, end: state.offline.end,
    level: state.offline.level, seconds: state.offline.seconds, amount: state.offline.amount,
    baseClaimed: state.offline.baseClaimed, bonusClaimed: state.offline.bonusClaimed } : null,
  orderOffer: state.orderOffer ? { number: state.orderOffer.number, amount: state.orderOffer.amount } : null,
  orderRewardThrough: state.orderRewardThrough });
export class ProgressManager {
  static restore(raw: unknown, timestamp: number, lastSaveTime: number, totalOrders: number, totalEarned: number): ProgressState {
    const now = validTime(timestamp) ? timestamp : validTime(lastSaveTime) ? lastSaveTime : 0;
    const fallback: ProgressState = { schema: 1, cursor: Math.max(now, validTime(lastSaveTime) ? lastSaveTime : 0),
      daily: DailyTaskManager.fresh(now), offline: null, orderOffer: null, orderRewardThrough: 0 };
    if (raw === undefined) { fallback.cursor = validTime(lastSaveTime) && lastSaveTime > 0 ? lastSaveTime : now; return fallback; }
    if (!object(raw) || raw.schema !== 1 || !validTime(raw.cursor) || !object(raw.daily) ||
      !natural(raw.orderRewardThrough) || raw.orderRewardThrough > totalOrders) return fallback;
    const d = raw.daily;
    if (!natural(d.day) || d.day > DailyTaskManager.day(MonetizationConfig.maxTimestamp) ||
      !natural(d.orders) || d.orders > totalOrders || !natural(d.coins) || d.coins > totalEarned ||
      !Array.isArray(d.claimed) || d.claimed.length > TaskConfig.length ||
      d.claimed.some(id => !TaskConfig.some(t => t.id === id && (d[t.metric] as number) >= t.target)) ||
      new Set(d.claimed).size !== d.claimed.length) return fallback;
    if (raw.offline !== null) {
      const o = raw.offline;
      if (!object(o) || !validTime(o.start) || !validTime(o.end) || o.start > o.end || o.end > raw.cursor ||
        !natural(o.level) || !natural(o.amount) || o.amount <= 0 || !natural(o.seconds) ||
        o.id !== `offline:${o.start}:${o.end}` || typeof o.baseClaimed !== 'boolean' || typeof o.bonusClaimed !== 'boolean' ||
        (o.bonusClaimed && !o.baseClaimed)) return fallback;
      const computed = OfflineManager.calculate(o.start, o.end, o.level);
      if (o.amount !== computed.amount || o.seconds !== computed.seconds) return fallback;
    }
    if (raw.orderOffer !== null) {
      const o = raw.orderOffer;
      if (!object(o) || !natural(o.number) || o.number < 1 || o.number > totalOrders ||
        !natural(o.amount) || o.amount < 1 || o.amount > EconomyManager.income(10, 'fried_skewer')) return fallback;
    }
    const restored = copyProgress(raw as unknown as ProgressState);
    restored.cursor = Math.max(restored.cursor, validTime(lastSaveTime) ? lastSaveTime : 0);
    return restored;
  }
  static rollDay(state: ProgressState, now: number): void {
    if (validTime(now) && DailyTaskManager.day(now) > state.daily.day) state.daily = DailyTaskManager.fresh(now);
  }
  static prepareOffline(state: ProgressState, now: number, level: number): void {
    if (!validTime(now) || now < state.cursor) return;
    this.rollDay(state, now);
    const result = OfflineManager.calculate(state.cursor, now, level);
    // Keep an unclaimed base. A new eligible return can replace an unused voluntary bonus.
    if (result.amount > 0 && (!state.offline || state.offline.baseClaimed)) {
      state.offline = { id: `offline:${state.cursor}:${now}`, start: state.cursor, end: now, level, ...result,
        baseClaimed: false, bonusClaimed: false };
    }
    state.cursor = Math.max(state.cursor, now);
  }
}

export class GameManager {
  private data: Omit<SaveData, 'notifiedRecipeIds' | 'progress'>;
  private progress: ProgressState;
  private adBusy = false;
  private recipes: RecipeManager;
  private orders = new OrderManager();
  private saves: SaveManager;
  private now: () => number;
  constructor(storage: Storage, now: () => number = Date.now) {
    this.saves = new SaveManager(storage); this.now = now;
    const { notifiedRecipeIds, progress, ...data } = this.saves.load();
    this.data = data; this.recipes = new RecipeManager(data.totalEarned, notifiedRecipeIds);
    this.progress = ProgressManager.restore(progress, this.now(), data.lastSaveTime, data.totalOrders, data.totalEarned);
    ProgressManager.prepareOffline(this.progress, this.now(), data.stallLevel);
  }
  get snapshot() {
    ProgressManager.rollDay(this.progress, this.now());
    return { ...this.data, progress: copyProgress(this.progress), tasks: DailyTaskManager.entries(this.progress.daily),
      offline: this.progress.offline ? { ...this.progress.offline } : null,
      orderBonus: this.progress.orderOffer ? { ...this.progress.orderOffer,
        claimed: this.progress.orderOffer.number <= this.progress.orderRewardThrough } : null, adBusy: this.adBusy, notifiedRecipeIds: this.recipes.notifiedRecipeIds,
      recipes: this.recipes.catalog(this.data.stallLevel), unlockNotifications: this.recipes.notifications,
      order: this.orders.order, income: EconomyManager.income(this.data.stallLevel),
      upgradeCost: UpgradeManager.cost(this.data.stallLevel), saveStatus: this.saves.status };
  }
  cook(): boolean { return this.orders.cook(); }
  tick(seconds: number): void {
    const timestamp = this.now();
    ProgressManager.rollDay(this.progress, timestamp);
    if (validTime(timestamp)) this.progress.cursor = Math.max(this.progress.cursor, timestamp);
    const reward = this.orders.tick(seconds, this.data.stallLevel, this.recipes.unlockedRecipes);
    if (reward !== null) {
      if (!natural(this.data.totalOrders + 1) || !this.credit(this.data, this.progress, reward, true)) return;
      this.data.totalOrders++; this.progress.daily.orders++;
      this.progress.orderOffer = { number: this.data.totalOrders, amount: reward };
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
  /** Resume is called only on foreground return, never by opening a UI panel. */
  resume(): void { ProgressManager.prepareOffline(this.progress, this.now(), this.data.stallLevel); this.save(); }
  private credit(data: Omit<SaveData, 'notifiedRecipeIds' | 'progress'>, state: ProgressState, amount: number, daily: boolean): boolean {
    if (!natural(amount) || !natural(data.coins + amount) || !natural(data.totalEarned + amount)) return false;
    data.coins += amount; data.totalEarned += amount;
    if (daily) state.daily.coins += amount;
    return true;
  }
  private commitReward(amount: number, state: ProgressState, daily: boolean, requestId: string): ClaimResult {
    const timestamp = this.now();
    if (!validTime(timestamp) || timestamp < this.progress.cursor || DailyTaskManager.day(timestamp) < this.progress.daily.day)
      return { status: 'invalid_clock' };
    const revision = this.saves.checkRevision();
    if (revision !== 'current') return { status: revision === 'stale' ? 'expired' : 'storage_error' };
    const data = { ...this.data };
    if (!this.credit(data, state, amount, daily)) return { status: 'limit' };
    state.cursor = Math.max(state.cursor, timestamp);
    const savedAt = Math.max(data.lastSaveTime, timestamp);
    if (!this.saves.save({ ...data, notifiedRecipeIds: this.recipes.notifiedRecipeIds, progress: state }, savedAt))
      return { status: 'storage_error' };
    this.data = { ...data, lastSaveTime: savedAt }; this.progress = state;
    this.recipes.checkUnlocks(this.data.totalEarned);
    return { status: 'success', coins: amount, requestId };
  }
  claimOffline(): ClaimResult {
    const offer = this.progress.offline;
    if (!offer) return { status: 'not_ready' };
    if (offer.baseClaimed) return { status: 'already_claimed' };
    ProgressManager.rollDay(this.progress, this.now());
    const state = copyProgress(this.progress); state.offline!.baseClaimed = true;
    return this.commitReward(offer.amount, state, true, `${offer.id}:base`);
  }
  claimTask(id: TaskId): ClaimResult {
    ProgressManager.rollDay(this.progress, this.now());
    const task = DailyTaskManager.entries(this.progress.daily).find(task => task.id === id);
    if (!task) return { status: 'not_ready' };
    if (task.claimed) return { status: 'already_claimed' };
    if (!task.ready) return { status: 'not_ready' };
    const state = copyProgress(this.progress); state.daily.claimed.push(id);
    return this.commitReward(task.reward, state, false, `task:${state.daily.day}:${id}`);
  }
  async requestAd(placement: AdPlacement, service: IRewardAdService): Promise<ClaimResult> {
    if (placement !== 'offline_double' && placement !== 'order_bonus') return { status: 'not_ready' };
    if (this.adBusy) return { status: 'busy' };
    if (!validTime(this.now()) || this.now() < this.progress.cursor) return { status: 'invalid_clock' };
    const offline = this.progress.offline, order = this.progress.orderOffer;
    const offlineRequest = placement === 'offline_double';
    if (offlineRequest ? !offline?.baseClaimed : !order) return { status: 'not_ready' };
    if (offlineRequest ? offline!.bonusClaimed : order!.number <= this.progress.orderRewardThrough) return { status: 'already_claimed' };
    const requestId = offlineRequest ? `${offline!.id}:bonus` : `order:${order!.number}:bonus`;
    const amount = offlineRequest ? offline!.amount : order!.amount;
    this.adBusy = true;
    try {
      const result = await service.showRewardedAd(placement);
      if (result.status !== 'completed') return { status:
        result.status === 'cancelled' || result.status === 'unavailable' ? result.status : 'failed', requestId };
      ProgressManager.rollDay(this.progress, this.now());
      const state = copyProgress(this.progress);
      if (offlineRequest) {
        if (state.offline?.id !== offline!.id) return { status: 'expired', requestId };
        if (state.offline.bonusClaimed) return { status: 'already_claimed', requestId };
        state.offline.bonusClaimed = true;
      } else {
        if (order!.number <= state.orderRewardThrough) return { status: 'already_claimed', requestId };
        state.orderRewardThrough = order!.number;
      }
      return this.commitReward(amount, state, true, requestId);
    } catch { return { status: 'failed', requestId }; }
    finally { this.adBusy = false; }
  }
  save(): boolean {
    const timestamp = this.now();
    if (!validTime(timestamp)) return false;
    ProgressManager.rollDay(this.progress, timestamp);
    this.progress.cursor = Math.max(this.progress.cursor, timestamp);
    const savedAt = Math.max(this.data.lastSaveTime, this.progress.cursor);
    if (!this.saves.save({ ...this.data, notifiedRecipeIds: this.recipes.notifiedRecipeIds, progress: this.progress }, savedAt)) return false;
    this.data.lastSaveTime = savedAt; return true;
  }
}

export function claimMessage(result: ClaimResult): string {
  const messages: Record<ClaimStatus, string> = {
    success: `领取成功 +${result.coins ?? 0} 金币`, not_ready: '尚未满足领取条件', already_claimed: '已经领取过了',
    storage_error: '存档失败，未发奖励，请重试', invalid_clock: '系统时间异常，请校准后再试', busy: '请求处理中，请稍候',
    cancelled: '模拟广告提前关闭，普通收益不受影响', failed: '模拟广告加载失败，可重试', unavailable: '真实广告未启用',
    expired: '存档或奖励已更新，请重新进入后查看', limit: '金币已达安全上限',
  };
  return messages[result.status];
}
