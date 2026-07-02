function clampScale(scale: number): number {
  if (scale < 0.04) return 0.04;
  if (scale > 2) return 2;
  return scale;
}

export class Camera {
  x = 0;
  y = 0;
  scale = 0.25;
  targetX = 0;
  targetY = 0;
  targetScale = 0.25;
  viewportW = 1;
  viewportH = 1;
  private snapNext = false;

  setViewport(w: number, h: number) {
    this.viewportW = w;
    this.viewportH = h;
  }

  snap() {
    this.snapNext = true;
  }

  pan(dx: number, dy: number) {
    const sx = dx / this.scale;
    const sy = dy / this.scale;
    this.x -= sx;
    this.targetX -= sx;
    this.y -= sy;
    this.targetY -= sy;
  }

  frame(minX: number, minY: number, maxX: number, maxY: number) {
    this.targetX = (minX + maxX) / 2;
    this.targetY = (minY + maxY) / 2;
    const pad = 1200;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const sx = this.viewportW / w;
    const sy = this.viewportH / h;
    this.targetScale = Math.max(0.03, Math.min(0.55, Math.min(sx, sy)));
  }

  focus(cx: number, cy: number, scale: number) {
    this.targetX = cx;
    this.targetY = cy;
    this.targetScale = clampScale(scale);
  }

  setTargetScale(scale: number) {
    this.targetScale = clampScale(scale);
  }

  update(dt: number, responsiveness = 1) {
    if (this.snapNext) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.scale = this.targetScale;
      this.snapNext = false;
      return;
    }
    const posK = 1 - Math.exp(-8 * responsiveness * dt);
    this.x += (this.targetX - this.x) * posK;
    this.y += (this.targetY - this.y) * posK;
    const scaleK = 1 - Math.exp(-4 * responsiveness * dt);
    this.scale += (this.targetScale - this.scale) * scaleK;
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: this.x + (sx - this.viewportW / 2) / this.scale,
      y: this.y + (sy - this.viewportH / 2) / this.scale,
    };
  }
}
