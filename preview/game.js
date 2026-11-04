import { GameManager, getRecipe } from '/core.js';
import { mountVisuals, foodIcon } from '/visuals.js';
const visuals = mountVisuals(document.getElementById('visual-scene'));
let quality = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'low' : 'full';
try { const saved = localStorage.getItem('night_market_visual_quality'); if (saved === 'low' || saved === 'full') quality = saved; } catch {}
const model = new GameManager({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
const elements = Object.fromEntries(['coins', 'customer', 'details', 'progress', 'cook', 'upgrade', 'status'].map(id => [id, document.getElementById(id)]));
let selectedRecipe = 'sausage';
const book = document.getElementById('recipe-book'), market = document.getElementById('market');
const dialog = document.getElementById('unlock-dialog');
const cards = new Map();
for (const recipe of model.snapshot.recipes) {
  const card = document.createElement('button'); card.className = 'recipe-card'; card.dataset.recipeId = recipe.id;
  const name = document.createElement('span'), condition = document.createElement('small');
  const copy = document.createElement('span'); copy.className = 'card-copy'; copy.append(name, condition);
  const icon = foodIcon(recipe.id, !recipe.unlocked);
  card.append(icon, copy); document.getElementById('recipe-list').append(card);
  card.addEventListener('click', () => { selectedRecipe = recipe.id; render(); });
  cards.set(recipe.id, { card, name, condition, unlocked: recipe.unlocked });
}
let bookRenderKey = '';
function renderBook(s) {
  const key = `${s.totalEarned}:${s.stallLevel}:${selectedRecipe}`;
  if (bookRenderKey === key) return;
  bookRenderKey = key;
  const count = s.recipes.filter(r => r.unlocked).length;
  document.getElementById('book-count').textContent = `${count}/${s.recipes.length}`;
  document.getElementById('book-progress').textContent = `已收集 ${count}/${s.recipes.length} · 累计收入 ${s.totalEarned} 金币`;
  for (const recipe of s.recipes) {
    const row = cards.get(recipe.id), { card, name, condition } = row;
    if (row.unlocked !== recipe.unlocked) {
      card.querySelector('svg').replaceWith(foodIcon(recipe.id, !recipe.unlocked)); row.unlocked = recipe.unlocked;
    }
    card.classList.toggle('locked', !recipe.unlocked); card.setAttribute('aria-pressed', String(selectedRecipe === recipe.id));
    name.textContent = `${recipe.unlocked ? '✦' : '◇'} ${recipe.name}`;
    condition.textContent = recipe.unlocked ? `${recipe.rarity} · 已解锁 · 查看详情` :
      `累计收入 ${recipe.unlock.amount} 金币解锁 · 还差 ${recipe.remainingToUnlock}`;
  }
  const recipe = s.recipes.find(r => r.id === selectedRecipe);
  const artKey = `${recipe.id}:${recipe.unlocked}`;
  const detailArt = document.getElementById('detail-art');
  if (detailArt.dataset.key !== artKey) { detailArt.replaceChildren(foodIcon(recipe.id, !recipe.unlocked)); detailArt.dataset.key = artKey; }
  document.getElementById('recipe-rarity').textContent = `${recipe.chapter} / ${recipe.rarity}`;
  document.getElementById('recipe-name').textContent = recipe.name;
  document.getElementById('recipe-description').textContent = recipe.description;
  document.getElementById('recipe-stats').textContent = `基础 ${recipe.basePrice} 金币 / ${recipe.baseDuration} 秒 · 当前 Lv.${s.stallLevel}：${recipe.income} 金币 / ${recipe.duration} 秒`;
  document.getElementById('recipe-condition').textContent = recipe.unlocked ? '已解锁 · 已加入夜市轮换订单' :
    `尚未解锁 · 累计收入达到 ${recipe.unlock.amount} 金币（还差 ${recipe.remainingToUnlock}）`;
}
function render(dt = 0) {
  const s = model.snapshot, o = s.order;
  elements.coins.textContent = s.coins;
  document.getElementById('level').textContent = `Lv.${s.stallLevel}`;
  document.getElementById('quality').textContent = `动效：${quality === 'full' ? '完整' : '简洁'}`;
  document.getElementById('quality').setAttribute('aria-pressed', String(quality === 'low'));
  visuals.update(s, dt, quality);
  elements.customer.textContent = !o || o.state === 'EXITED' ? '灯火通明，等候新顾客…' :
    o.state === 'WAITING' ? `顾客：来份${getRecipe(o.recipeId).name}！ +${o.income}` :
    o.state === 'COOKING' ? `制作${getRecipe(o.recipeId).name} · ${o.remaining.toFixed(1)} 秒` : `出餐啦！ +${o.income} 金币`;
  elements.cook.textContent = o ? `制作${getRecipe(o.recipeId).name}` : '等待顾客';
  elements.details.textContent = `摊位 Lv.${s.stallLevel} · 烤肠 ${s.income} 金币/单 · 累计 ${s.totalOrders} 单`;
  elements.progress.value = o?.state === 'COOKING' ? 1 - o.remaining / o.duration : o?.state === 'SERVED' ? 1 : 0;
  elements.cook.disabled = o?.state !== 'WAITING';
  elements.upgrade.disabled = s.upgradeCost === null || s.coins < s.upgradeCost;
  elements.upgrade.textContent = s.upgradeCost === null ? '已满级 Lv.10' : `升级摊位 · ${s.upgradeCost} 金币`;
  elements.status.textContent = s.saveStatus === 'unavailable' ? '存档暂不可用，本次进度仅保留在内存' :
    s.saveStatus === 'recovered' ? '存档异常，已安全恢复初始摊位' : '自动存档 · 今晚也要好好营业';
  renderBook(s);
  if (!dialog.open && s.unlockNotifications.length) {
    const event = s.unlockNotifications[0];
    document.getElementById('unlock-message').textContent = `${getRecipe(event.recipeId).name}已加入收藏册与经营订单！`;
    dialog.showModal(); model.acknowledgeRecipeUnlock(event.recipeId);
  }
}
document.getElementById('quality').addEventListener('click', () => {
  quality = quality === 'full' ? 'low' : 'full';
  try { localStorage.setItem('night_market_visual_quality', quality); } catch {}
  render();
});
document.getElementById('open-book').addEventListener('click', () => {
  market.hidden = true; book.hidden = false; render(); document.getElementById('close-book').focus();
});
document.getElementById('close-book').addEventListener('click', () => {
  book.hidden = true; market.hidden = false; document.getElementById('open-book').focus();
});
document.getElementById('dismiss-unlock').addEventListener('click', () => dialog.close());
elements.cook.addEventListener('click', () => { model.cook(); render(); });
elements.upgrade.addEventListener('click', () => { model.upgrade(); render(); });
let last = performance.now();
function frame(now) {
  const dt = document.hidden ? 0 : Math.max(0, (now - last) / 1000);
  if (!document.hidden) model.tick(dt);
  last = now; render(dt); requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden) model.save(); });
window.addEventListener('pagehide', () => model.save());
render(); requestAnimationFrame(frame);
