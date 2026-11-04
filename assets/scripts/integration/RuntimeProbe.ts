import { _decorator, Component, Canvas, UITransform, VERSION, sys, view } from 'cc';
import { GameUI } from '../GameUI';
const { ccclass, executionOrder } = _decorator;

/** Optional integration observer. No gameplay actions, rewards or storage writes. */
@ccclass('NightMarketRuntimeProbe')
@executionOrder(1000)
export class RuntimeProbe extends Component {
  start(): void { this.scheduleOnce(() => this.capture(), 1.25); }
  capture(): void {
    const snapshot = this.node.getComponent(GameUI)?.getValidationSnapshot();
    const stage = this.node.getChildByName('SafeArea')?.getChildByName('NightMarket');
    const market = stage?.getChildByName('Market');
    const camera = this.node.getComponent(Canvas)?.cameraComponent;
    const transform = this.node.getComponent(UITransform);
    const checks = {
      gameInitialized: !!snapshot,
      customerObserved: !!snapshot?.order,
      recipesAvailable: snapshot?.recipes.length === 3,
      tasksAvailable: snapshot?.tasks.length === 3,
      marketCreated: !!market?.getChildByName('NightMarketScene'),
      bookCreated: !!stage?.getChildByName('RecipeBookUI'),
      rewardsCreated: !!stage?.getChildByName('RewardsUI'),
      uiCameraConfigured: !!camera && (camera.visibility & this.node.layer) !== 0,
      canvasSized: !!transform && transform.width > 0 && transform.height > 0,
    };
    console.log('[NightMarketRuntimeEvidence]', JSON.stringify({ schema: 1,
      scope: 'initialization-observation-only', engineVersion: VERSION, platform: sys.platform,
      os: sys.os, osVersion: sys.osVersion, visibleSize: view.getVisibleSize(), checks,
      orderState: snapshot?.order?.state ?? null,
      // Observing components is not proof of rendered pixels, working touches or real-device performance.
      visualAndTouchValidated: false, devicePerformanceValidated: false,
    }));
  }
}
