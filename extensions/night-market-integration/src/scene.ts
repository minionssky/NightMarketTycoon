import { join } from 'node:path';
import type * as Engine from 'cc';

export function load(): void {}
export function unload(): void {}

/** Runs only inside Creator's scene process. Tests inject a contract double, not a Cocos runtime. */
export function populateScene(cc: typeof Engine) {
  const scene = cc.director.getScene();
  if (!scene || scene.name !== 'MainGame') throw new Error('Open an editor-created scene saved as MainGame first.');
  const GameUI = cc.js.getClassByName('GameUI') as Engine.Constructor<Engine.Component> | undefined;
  if (!GameUI) throw new Error('GameUI is not registered. Wait for Creator script compilation; inspect Console errors.');
  const Probe = cc.js.getClassByName('NightMarketRuntimeProbe') as Engine.Constructor<Engine.Component> | undefined;
  if (!Probe) throw new Error('NightMarketRuntimeProbe is not registered. Import all integration scripts and wait for compilation.');
  const existing = scene.children.filter(node => node.getComponent(GameUI));
  if (existing.length) {
    if (existing.length !== 1 || !existing[0].getComponent(cc.Canvas)) throw new Error('Existing GameUI is ambiguous or has no Canvas.');
    const hadProbe = !!existing[0].getComponent(Probe);
    if (!hadProbe) existing[0].addComponent(Probe);
    return { status: hadProbe ? 'already-configured' : 'probe-added', canvasUuid: existing[0].uuid, sceneName: scene.name };
  }
  const roots = scene.children;
  let canvasNode: Engine.Node | undefined;
  let camera: Engine.Camera | undefined;
  if (roots.length) {
    const node = roots[0];
    const knownCanvas = roots.length === 1 && node.name === 'Canvas' && node.getComponent(cc.Canvas) &&
      node.getComponents(cc.Component).every(component => component instanceof cc.Canvas || component instanceof cc.UITransform || component instanceof cc.Widget) &&
      node.children.length === 1;
    const cameraNode = knownCanvas ? node.children[0] : undefined;
    const knownCamera = cameraNode?.getComponent(cc.Camera) && cameraNode.children.length === 0 &&
      cameraNode.getComponents(cc.Component).every(component => component instanceof cc.Camera || component instanceof cc.UITransform);
    if (!knownCanvas || !knownCamera) throw new Error('Refusing non-empty/custom scene. Use an empty scene or untouched 2D Canvas+Camera template.');
    canvasNode = node; camera = cameraNode!.getComponent(cc.Camera)!;
  }
  const created = !canvasNode;
  canvasNode ??= new cc.Node('NightMarketCanvas');
  try {
    canvasNode.layer = cc.Layers.Enum.UI_2D;
    const transform = canvasNode.getComponent(cc.UITransform) ?? canvasNode.addComponent(cc.UITransform);
    transform.setContentSize(720, 1280);
    const canvas = canvasNode.getComponent(cc.Canvas) ?? canvasNode.addComponent(cc.Canvas);
    if (!camera) {
      const node = new cc.Node('UICamera'); node.layer = cc.Layers.Enum.UI_2D; canvasNode.addChild(node);
      camera = node.addComponent(cc.Camera);
    }
    camera.node.setPosition(0, 0, 1000);
    camera.projection = cc.Camera.ProjectionType.ORTHO; camera.orthoHeight = 640;
    camera.near = 0; camera.far = 2000; camera.visibility = cc.Layers.Enum.UI_2D;
    camera.clearFlags = cc.Camera.ClearFlag.SOLID_COLOR;
    camera.clearColor = new cc.Color('#24133E');
    canvas.cameraComponent = camera; canvas.alignCanvasWithScreen = true;
    canvasNode.addComponent(GameUI); canvasNode.addComponent(Probe);
    if (created) scene.addChild(canvasNode);
    return { status: 'configured', sceneName: scene.name, canvasUuid: canvasNode.uuid, cameraUuid: camera.node.uuid,
      designResolution: { width: 720, height: 1280 }, component: 'GameUI' };
  } catch (error) {
    if (created) canvasNode.destroy();
    throw error;
  }
}
export const methods = {
  populate() {
    // Documented Creator scene-script module lookup. Not imported by the browser or the game bundle.
    module.paths.push(join(Editor.App.path, 'node_modules'));
    return populateScene(require('cc') as typeof Engine);
  },
};
