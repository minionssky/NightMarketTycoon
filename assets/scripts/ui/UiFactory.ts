import { Node, UITransform, Label, Color, Graphics, Button } from 'cc';

export function uiLabel(parent: Node, text: string, x: number, y: number, size: number, color: string): Label {
  const node = new Node('Text'); node.layer = parent.layer; parent.addChild(node); node.setPosition(x, y);
  node.addComponent(UITransform).setContentSize(650, 70);
  const label = node.addComponent(Label); label.string = text; label.fontSize = size;
  label.lineHeight = size + 6; label.color = new Color(color);
  label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK; return label;
}
export function uiPanel(parent: Node, name: string, x: number, y: number, width: number, height: number, color: string): Node {
  const node = new Node(name); node.layer = parent.layer; parent.addChild(node); node.setPosition(x, y);
  node.addComponent(UITransform).setContentSize(width, height);
  const graphics = node.addComponent(Graphics); graphics.fillColor = new Color(color);
  graphics.roundRect(-width / 2, -height / 2, width, height, 18); graphics.fill(); return node;
}
export function uiButton(parent: Node, text: string, y: number, color: string, action: () => unknown,
  width = 580, height = 86): [Button, Label] {
  const node = uiPanel(parent, 'Button', 0, y, width, height, color);
  const button = node.addComponent(Button);
  const label = uiLabel(node, text, 0, 0, 32, '#ffffff');
  label.node.getComponent(UITransform)!.setContentSize(width - 24, height - 12);
  node.on(Node.EventType.TOUCH_END, () => { if (button.interactable) action(); });
  return [button, label];
}
