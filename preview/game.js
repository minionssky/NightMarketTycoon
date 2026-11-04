import { GameManager } from '/core.js';
const model = new GameManager({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
const elements = Object.fromEntries(['coins', 'customer', 'details', 'progress', 'cook', 'upgrade', 'status'].map(id => [id, document.getElementById(id)]));
function render() {
  const s = model.snapshot, o = s.order;
  elements.coins.textContent = s.coins;
  elements.customer.textContent = !o || o.state === 'EXITED' ? '灯火通明，等候新顾客…' :
    o.state === 'WAITING' ? `顾客：来份烤肠！ +${o.income}` :
    o.state === 'COOKING' ? `制作中 · ${o.remaining.toFixed(1)} 秒` : `出餐啦！ +${o.income} 金币`;
  elements.details.textContent = `摊位 Lv.${s.stallLevel} · 每单 ${s.income} 金币 · 累计 ${s.totalOrders} 单`;
  elements.progress.value = o?.state === 'COOKING' ? 1 - o.remaining / o.duration : o?.state === 'SERVED' ? 1 : 0;
  elements.cook.disabled = o?.state !== 'WAITING';
  elements.upgrade.disabled = s.upgradeCost === null || s.coins < s.upgradeCost;
  elements.upgrade.textContent = s.upgradeCost === null ? '已满级 Lv.10' : `升级摊位 · ${s.upgradeCost} 金币`;
  elements.status.textContent = s.saveStatus === 'unavailable' ? '存档暂不可用，本次进度仅保留在内存' :
    s.saveStatus === 'recovered' ? '存档异常，已安全恢复初始摊位' : '自动存档 · 今晚也要好好营业';
}
elements.cook.addEventListener('click', () => { model.cook(); render(); });
elements.upgrade.addEventListener('click', () => { model.upgrade(); render(); });
let last = performance.now();
function frame(now) {
  if (!document.hidden) model.tick(Math.max(0, (now - last) / 1000));
  last = now; render(); requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden) model.save(); });
window.addEventListener('pagehide', () => model.save());
render(); requestAnimationFrame(frame);
