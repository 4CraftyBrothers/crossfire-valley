export interface ViewportHandlers {
  onTap(clientX: number, clientY: number): void;
  onHover(clientX: number, clientY: number): void;
  onHoverEnd(): void;
}

const TAP_SLOP = 8;
const MAX_ZOOM = 3;

/**
 * Pan/pinch/wheel camera over the board. The content element is placed at
 * its natural (logical) size and moved with a CSS transform, so children
 * positioned in logical pixels follow the camera for free. Single-finger
 * drags pan, two fingers pinch, a still tap is forwarded as a board tap.
 */
export class BoardViewport {
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private cw = 1;
  private ch = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pan: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
  private pinch: { dist: number; scale: number; mid: { x: number; y: number }; tx: number; ty: number } | null = null;

  constructor(
    private el: HTMLElement,
    private content: HTMLElement,
    private h: ViewportHandlers,
  ) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e, false));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && this.pointers.size === 0) h.onHoverEnd();
    });
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    new ResizeObserver(() => this.onResize()).observe(el);
  }

  setContentSize(w: number, h: number): void {
    this.cw = w;
    this.ch = h;
    this.content.style.width = `${w}px`;
    this.content.style.height = `${h}px`;
  }

  private fitScale(): number {
    const vw = this.el.clientWidth || 1;
    const vh = this.el.clientHeight || 1;
    return Math.min(vw / this.cw, vh / this.ch);
  }

  fit(): void {
    this.scale = this.fitScale();
    this.clamp();
    this.apply();
  }

  /** Show the board at least `tilePx` per tile, centered on a tile. */
  frame(tileX: number, tileY: number, tilePx: number, tile: number): void {
    const fit = this.fitScale();
    this.scale = Math.min(Math.max(fit, tilePx / tile), Math.max(MAX_ZOOM, fit));
    this.tx = this.el.clientWidth / 2 - (tileX + 0.5) * tile * this.scale;
    this.ty = this.el.clientHeight / 2 - (tileY + 0.5) * tile * this.scale;
    this.clamp();
    this.apply();
  }

  /** Pan (no zoom change) so a tile sits in the middle of the view. */
  centerOn(tileX: number, tileY: number, tile: number): void {
    this.tx = this.el.clientWidth / 2 - (tileX + 0.5) * tile * this.scale;
    this.ty = this.el.clientHeight / 2 - (tileY + 0.5) * tile * this.scale;
    this.clamp();
    this.apply();
  }

  private zoomAt(cx: number, cy: number, next: number): void {
    const fit = this.fitScale();
    const s = Math.min(Math.max(next, fit), Math.max(MAX_ZOOM, fit));
    const px = (cx - this.tx) / this.scale;
    const py = (cy - this.ty) / this.scale;
    this.scale = s;
    this.tx = cx - px * s;
    this.ty = cy - py * s;
    this.clamp();
    this.apply();
  }

  private clamp(): void {
    const vw = this.el.clientWidth;
    const vh = this.el.clientHeight;
    const sw = this.cw * this.scale;
    const sh = this.ch * this.scale;
    this.tx = sw <= vw ? (vw - sw) / 2 : Math.min(0, Math.max(vw - sw, this.tx));
    this.ty = sh <= vh ? (vh - sh) / 2 : Math.min(0, Math.max(vh - sh, this.ty));
  }

  private apply(): void {
    this.content.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  private onResize(): void {
    if (this.el.clientWidth === 0) return;
    if (this.scale < this.fitScale()) this.fit();
    else {
      this.clamp();
      this.apply();
    }
  }

  private local(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private isUiTarget(e: Event): boolean {
    return (e.target as HTMLElement | null)?.closest('button, .popup, #tutorial, .modal') !== null;
  }

  private down(e: PointerEvent): void {
    if (this.isUiTarget(e)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.el.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.pan = { x: p.x, y: p.y, tx: this.tx, ty: this.ty, moved: false };
      this.pinch = null;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: this.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        tx: this.tx,
        ty: this.ty,
      };
      this.pan = null;
    }
  }

  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && e.buttons === 0 && !this.isUiTarget(e)) this.h.onHover(e.clientX, e.clientY);
      return;
    }
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);

    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const fit = this.fitScale();
      const s = Math.min(Math.max((this.pinch.scale * dist) / this.pinch.dist, fit), Math.max(MAX_ZOOM, fit));
      // Keep the content point that started under the fingers' midpoint under it.
      const px = (this.pinch.mid.x - this.pinch.tx) / this.pinch.scale;
      const py = (this.pinch.mid.y - this.pinch.ty) / this.pinch.scale;
      this.scale = s;
      this.tx = mid.x - px * s;
      this.ty = mid.y - py * s;
      this.clamp();
      this.apply();
      return;
    }

    if (this.pan && this.pointers.size === 1) {
      const dx = p.x - this.pan.x;
      const dy = p.y - this.pan.y;
      if (!this.pan.moved && Math.hypot(dx, dy) > TAP_SLOP) this.pan.moved = true;
      if (this.pan.moved) {
        this.tx = this.pan.tx + dx;
        this.ty = this.pan.ty + dy;
        this.clamp();
        this.apply();
      } else if (e.pointerType === 'mouse') {
        this.h.onHover(e.clientX, e.clientY);
      }
    }
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.has(e.pointerId)) return;
    const wasPan = this.pan;
    const count = this.pointers.size;
    this.pointers.delete(e.pointerId);
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    if (this.pinch) {
      if (this.pointers.size < 2) {
        this.pinch = null;
        const rest = [...this.pointers.values()][0];
        // A finger lifting after a pinch must not register as a tap.
        this.pan = rest ? { x: rest.x, y: rest.y, tx: this.tx, ty: this.ty, moved: true } : null;
      }
      return;
    }

    this.pan = null;
    if (wasPan && count === 1 && !cancelled && !wasPan.moved) this.h.onTap(e.clientX, e.clientY);
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    this.zoomAt(p.x, p.y, this.scale * Math.exp(-e.deltaY * 0.0015));
  }
}
