import { Node, UITransform, Graphics, Color } from 'cc';
import { uiLabel } from '../UiFactory';
import type { Shape } from './VisualStyle';

/** Positive-down authored coordinates -> native Cocos positive-up graphics. No DOM or SVG runtime. */
export function vectorArt(parent: Node, name: string, shapes: readonly Shape[]): Node {
  const node = new Node(name); node.layer = parent.layer; parent.addChild(node);
  node.addComponent(UITransform).setContentSize(720, 650);
  redrawArt(node, shapes); return node;
}
export function redrawArt(node: Node, shapes: readonly Shape[]): void {
  node.destroyAllChildren();
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics); g.clear();
  for (const shape of shapes) {
    if (shape.kind === 'text') {
      uiLabel(node, shape.text ?? '', shape.x, -shape.y + (shape.size ?? 20) * .35, shape.size ?? 20, shape.fill);
      continue;
    }
    g.fillColor = new Color(shape.fill);
    if (shape.kind === 'rect') g.roundRect(shape.x, -shape.y - shape.height!, shape.width!, shape.height!, shape.radius ?? 0);
    if (shape.kind === 'ellipse') g.ellipse(shape.x, -shape.y, shape.width!, shape.height!);
    if (shape.kind === 'path' && shape.points?.length) {
      g.moveTo(shape.points[0][0], -shape.points[0][1]);
      for (const point of shape.points.slice(1)) g.lineTo(point[0], -point[1]);
      g.close();
    }
    g.fill();
    if (shape.stroke) { g.strokeColor = new Color(shape.stroke); g.lineWidth = shape.lineWidth ?? 2; g.stroke(); }
  }
}
