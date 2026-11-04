import { claimMessage } from '/core.js';

/** DOM presentation only. All amounts, progress, eligibility and receipts come from GameManager. */
export function mountMonetization(model, ad, onChange) {
  const dialog = document.getElementById('rewards-dialog');
  const message = document.getElementById('reward-status');
  const taskRows = new Map();
  for (const task of model.snapshot.tasks) {
    const row = document.createElement('div'); row.className = 'task-row';
    const label = document.createElement('p'), button = document.createElement('button');
    button.dataset.task = task.id;
    button.addEventListener('click', () => { message.textContent = claimMessage(model.claimTask(task.id)); onChange(); });
    row.append(label, button); document.getElementById('task-list').append(row); taskRows.set(task.id, { label, button });
  }
  function open(tab) {
    document.getElementById('tasks-panel').hidden = tab !== 'tasks';
    document.getElementById('offline-panel').hidden = tab !== 'offline';
    document.getElementById('rewards-title').textContent = tab === 'tasks' ? '今晚营业任务' : '离线烟火收益';
    message.textContent = ''; dialog.showModal(); update(model.snapshot);
  }
  document.getElementById('open-tasks').addEventListener('click', () => open('tasks'));
  document.getElementById('open-offline').addEventListener('click', () => open('offline'));
  document.getElementById('close-rewards').addEventListener('click', () => { dialog.close(); onChange(); });
  document.getElementById('claim-offline').addEventListener('click', () => { message.textContent = claimMessage(model.claimOffline()); onChange(); });
  async function request(placement) {
    message.textContent = 'Mock 模拟处理中，可取消或关闭面板；不影响正常经营';
    ad.mode = document.getElementById('mock-mode').value;
    const result = model.requestAd(placement, ad); onChange();
    message.textContent = claimMessage(await result); onChange();
  }
  document.getElementById('offline-ad').addEventListener('click', () => { void request('offline_double'); });
  document.getElementById('order-ad').addEventListener('click', () => { void request('order_bonus'); });
  function update(s) {
    document.getElementById('open-offline').textContent = `离线收益${s.offline && !s.offline.baseClaimed ? ' · 可领' : ''}`;
    document.getElementById('open-tasks').textContent = `任务${s.tasks.some(t => t.ready) ? ' · 可领' : ''}`;
    document.getElementById('daily-period').textContent = `北京时间每日重置 · 今日 ${s.progress.daily.orders} 单 / 收取 ${s.progress.daily.coins} 金币`;
    for (const task of s.tasks) {
      const row = taskRows.get(task.id); row.label.textContent = `${task.name} · ${task.progress}/${task.target} · 奖励 ${task.reward} 金币`;
      row.button.disabled = !task.ready; row.button.textContent = task.claimed ? '已领取' : task.ready ? '领取' : '未达标';
    }
    const offline = s.offline;
    document.getElementById('offline-summary').textContent = offline ?
      `离线计入 ${offline.seconds} 秒（最多 4 小时）· Lv.${offline.level} · ${offline.amount} 金币${offline.baseClaimed ? ' · 普通收益已领' : ''}` : '暂无离线收益，回来后可在这里免费领取。';
    document.getElementById('claim-offline').disabled = !offline || offline.baseClaimed;
    document.getElementById('claim-offline').textContent = offline?.baseClaimed ? '普通收益已领取' : '免费领取普通收益';
    document.getElementById('offline-ad').disabled = !offline?.baseClaimed || offline.bonusClaimed || s.adBusy;
    document.getElementById('offline-ad').textContent = offline?.bonusClaimed ? '额外一倍已领取' : '自愿 Mock 模拟 · 额外一倍';
    document.getElementById('order-ad').disabled = !s.orderBonus || s.orderBonus.claimed || s.adBusy;
    document.getElementById('order-ad').textContent = s.orderBonus ?
      s.orderBonus.claimed ? '本单额外奖励已领取' : `自愿 Mock 模拟 · 本单额外 ${s.orderBonus.amount} 金币` : '完成一单后可领取额外奖励';
  }
  return { update, get open() { return dialog.open; } };
}
