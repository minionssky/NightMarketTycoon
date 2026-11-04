import { Palette, Motion, backdropArt, stallArt, counterArt, lanternArt, characterArt, foodArt, VisualDirector } from '/visual-style.js';
const ns = 'http://www.w3.org/2000/svg';
function element(tag, attrs = {}) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
function paint(parent, shapes) {
  for (const shape of shapes) {
    let node;
    if (shape.kind === 'rect') node = element('rect', { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: shape.radius });
    if (shape.kind === 'ellipse') node = element('ellipse', { cx: shape.x, cy: shape.y, rx: shape.width, ry: shape.height });
    if (shape.kind === 'path') node = element('path', { d: `M${shape.points.map(p => p.join(',')).join('L')}Z` });
    if (shape.kind === 'text') {
      node = element('text', { x: shape.x, y: shape.y, 'font-size': shape.size, 'text-anchor': 'middle', 'font-weight': 700 });
      node.textContent = shape.text;
    }
    node.setAttribute('fill', shape.fill);
    if (shape.stroke) { node.setAttribute('stroke', shape.stroke); node.setAttribute('stroke-width', shape.lineWidth); }
    parent.append(node);
  }
}
export function foodIcon(id, locked = false) {
  const icon = element('svg', { viewBox: '-80 -80 160 160', 'aria-hidden': 'true', class: 'food-icon' });
  const shapes = foodArt(id);
  paint(icon, locked ? shapes.map(s => ({ ...s, fill: '#645575' })) : shapes);
  return icon;
}
export function mountVisuals(svg) {
  const group = id => { const node = element('g', { id }); svg.append(node); return node; };
  paint(group('backdrop-layer'), backdropArt());
  const stall = group('stall-layer'); paint(stall, stallArt());
  const lanterns = [group('lantern-left'), group('lantern-right')];
  lanterns.forEach(g => paint(g, lanternArt()));
  const chef = group('chef-layer'); paint(chef, characterArt(0, true, true)); chef.setAttribute('transform', 'translate(245 400)');
  const guest = group('guest-layer');
  const food = group('food-layer');
  paint(group('counter-layer'), counterArt());
  const heat = group('heat-layer');
  const particles = Array.from({ length: Motion.maxParticles }, () => {
    const node = element('path', { d: 'M-8,0 Q-16,-14 0,-35 Q16,-12 8,0 Z', fill: Palette.gold }); heat.append(node); return node;
  });
  const reward = group('reward-layer');
  const rewardLabel = element('text', { id: 'reward-label', x: 0, y: 0, fill: Palette.gold, 'font-size': 38, 'font-weight': 900, 'text-anchor': 'middle' });
  reward.append(rewardLabel);
  const flash = group('upgrade-flash'); paint(flash, [{ kind: 'text', x: 360, y: 180, text: '✦ 升级成功 ✦', size: 34, fill: Palette.cream }]);
  const director = new VisualDirector(); let characterKey = '', recipe = '';
  return {
    update(snapshot, dt, quality) {
      const frame = director.sample(snapshot, dt, quality), order = snapshot.order;
      svg.dataset.state = order?.state || 'ARRIVING'; svg.dataset.quality = quality;
      svg.dataset.variant = String(frame.variant);
      if (document.getElementById('market').hidden) return;
      const key = `${frame.variant}:${frame.happy}`;
      if (key !== characterKey) { guest.replaceChildren(); paint(guest, characterArt(frame.variant, frame.happy)); characterKey = key; }
      guest.setAttribute('visibility', frame.guestVisible ? 'visible' : 'hidden');
      guest.setAttribute('transform', `translate(${frame.guestX} ${frame.guestY})`);
      stall.setAttribute('transform', `translate(270 245) scale(${frame.signScale}) translate(-270 -245)`);
      lanterns.forEach((node, i) => node.setAttribute('transform', `translate(${i ? 640 : 60} 40) rotate(${frame.lanternAngle * (i ? -1 : 1)})`));
      if (recipe !== (order?.recipeId || 'sausage')) {
        recipe = order?.recipeId || 'sausage'; food.replaceChildren(); paint(food, foodArt(recipe));
      }
      food.setAttribute('transform', `translate(280 445) rotate(-35) scale(${frame.cooking && quality === 'full' ? .7 + .025 * Math.sin(frame.phase * 4) : .7})`);
      heat.setAttribute('visibility', frame.cooking && quality === 'full' ? 'visible' : 'hidden');
      particles.forEach((node, i) => {
        const rise = ((frame.phase + i / particles.length) % 1) * 60;
        node.setAttribute('transform', `translate(${230 + i * 18} ${477 - rise}) scale(${frame.steam ? .6 : 1})`);
        node.setAttribute('opacity', String(.9 - rise / 90)); node.setAttribute('fill', frame.steam ? Palette.cream : i % 2 ? Palette.pink : Palette.gold);
      });
      reward.setAttribute('visibility', frame.rewardVisible ? 'visible' : 'hidden');
      reward.setAttribute('transform', `translate(360 ${360 - frame.rewardRise})`);
      rewardLabel.textContent = `✦ +${frame.rewardAmount}`;
      flash.setAttribute('visibility', frame.upgradeVisible ? 'visible' : 'hidden');
      document.getElementById('hud').style.transform = `scale(${frame.hudScale})`;
    },
  };
}
