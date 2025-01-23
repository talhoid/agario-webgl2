import { mat4 } from "gl-matrix";
import { Rectangle, RectanglePool } from "../geometry/rectangle";
import type { Coordinate } from "@/2d/geometry/coordinate";
import type { Entity } from "../physics/entity";

export class Camera {
    private targetPosition: Coordinate;
    private targetZoom: number;
    private readonly dampingFactor: number;
    private readonly zoomBounds: { min: number; max: number };
    private readonly paddingRatio: number;
    private matrixDirty = true;
    private cachedMatrix = mat4.create();
    public visibleBounds: Rectangle;
    public position: Coordinate;
    public zoom: number;

    constructor(
        public readonly worldBounds: Rectangle,
        public readonly viewport: Rectangle,
        options: {
            damping?: number;
            zoomLimits?: { min?: number; max?: number };
            padding?: number;
        } = {}
    ) {
        const {
            damping = 0.01,
            zoomLimits = { min: 0.1, max: 10 },
            padding = 0.2
        } = options;

        const worldCenter = this.calculateWorldCenter();
        const initialZoom = this.calculateInitialZoom();

        this.position = { ...worldCenter };
        this.targetPosition = { ...worldCenter };
        this.zoom = initialZoom;
        this.targetZoom = initialZoom;
        this.dampingFactor = damping;
        this.zoomBounds = {
            min: zoomLimits.min ?? 0.1,
            max: zoomLimits.max ?? 10
        };
        this.paddingRatio = padding;
        this.visibleBounds = RectanglePool.acquire();
        this.updateVisibleBounds();
    }

    update(deltaTime: number): void {
        this.applySmoothing(deltaTime);
        // this.enforceWorldBounds();
        this.updateVisibleBounds();
        this.matrixDirty = true;
    }

    private applySmoothing(deltaTime: number): void {
        const alpha = 1 - Math.exp(-deltaTime * this.dampingFactor);
        this.position.x += (this.targetPosition.x - this.position.x) * alpha;
        this.position.y += (this.targetPosition.y - this.position.y) * alpha;
        this.zoom += (this.targetZoom - this.zoom) * alpha;
    }

    private enforceWorldBounds(): void {
        const halfViewportWidth = (this.viewport.width / this.zoom) / 2;
        const halfViewportHeight = (this.viewport.height / this.zoom) / 2;

        this.position.x = Math.max(
            this.worldBounds.x + halfViewportWidth,
            Math.min(
                this.worldBounds.x + this.worldBounds.width - halfViewportWidth,
                this.position.x
            )
        );

        this.position.y = Math.max(
            this.worldBounds.y + halfViewportHeight,
            Math.min(
                this.worldBounds.y + this.worldBounds.height - halfViewportHeight,
                this.position.y
            )
        );
    }

    private updateVisibleBounds(): void {
        const topLeft = this.screenToWorld({ x: 0, y: 0 });
        const bottomRight = this.screenToWorld({
            x: this.viewport.width,
            y: this.viewport.height,
        });

        this.visibleBounds.set(
            Math.min(topLeft.x, bottomRight.x),
            Math.min(topLeft.y, bottomRight.y),
            Math.abs(bottomRight.x - topLeft.x),
            Math.abs(bottomRight.y - topLeft.y)
        );
    }

    worldToScreen(worldPos: Coordinate): Coordinate {
        const viewportCenterX = this.viewport.width / 2;
        const viewportCenterY = this.viewport.height / 2;
        
        return {
            x: (worldPos.x - this.position.x) * this.zoom + viewportCenterX,
            y: (worldPos.y - this.position.y) * -this.zoom + viewportCenterY
        };
    }

    screenToWorld(screenPos: Coordinate): Coordinate {
        const viewportCenterX = this.viewport.width / 2;
        const viewportCenterY = this.viewport.height / 2;
        
        return {
            x: (screenPos.x - viewportCenterX) / this.zoom + this.position.x,
            y: (screenPos.y - viewportCenterY) / -this.zoom + this.position.y
        };
    }

    getTransformationMatrix(): mat4 {
        if (!this.matrixDirty) return this.cachedMatrix;

        mat4.identity(this.cachedMatrix);
        mat4.ortho(
            this.cachedMatrix,
            0,
            this.viewport.width,
            this.viewport.height,
            0,
            -1,
            1
        );

        mat4.translate(this.cachedMatrix, this.cachedMatrix, [
            this.viewport.width / 2,
            this.viewport.height / 2,
            0
        ]);

        mat4.scale(this.cachedMatrix, this.cachedMatrix, [
            this.zoom,
            -this.zoom,
            1
        ]);

        mat4.translate(this.cachedMatrix, this.cachedMatrix, [
            -this.position.x,
            -this.position.y,
            0
        ]);

        this.matrixDirty = false;
        return this.cachedMatrix;
    }

    moveTo(x: number, y: number): void {
        this.targetPosition = { x, y };
        this.matrixDirty = true;
    }

    followAtPercentage(target: Entity, viewportWidthPercentage: number): void {
        this.moveTo(target.position.x, target.position.y);
        
        const desiredWidth = this.viewport.width * (viewportWidthPercentage / 100);
        const requiredZoom = desiredWidth / target.size;
        
        this.zoomTo(requiredZoom);
    }
    

    zoomTo(zoom: number): void {
        this.targetZoom = Math.max(this.zoomBounds.min, 
            Math.min(this.zoomBounds.max, zoom));
        this.matrixDirty = true;
    }

    follow(target: Entity): void {
        this.followAtPercentage(target, 5)
        // this.moveTo(target.position.x, target.position.y);
        // // this.zoomToFit(target.bounds);
    }

    private zoomToFit(bounds: Rectangle): void {
        const paddingX = bounds.width * this.paddingRatio;
        const paddingY = bounds.height * this.paddingRatio;
        
        const requiredWidth = bounds.width + paddingX * 2;
        const requiredHeight = bounds.height + paddingY * 2;
        
        const zoomX = this.viewport.width / requiredWidth;
        const zoomY = this.viewport.height / requiredHeight;
        
        this.zoomTo(Math.min(zoomX, zoomY));
    }

    private calculateWorldCenter(): Coordinate {
        return {
            x: this.worldBounds.x + this.worldBounds.width / 2,
            y: this.worldBounds.y + this.worldBounds.height / 2
        };
    }

    private calculateInitialZoom(): number {
        const scaleX = this.viewport.width / this.worldBounds.width;
        const scaleY = this.viewport.height / this.worldBounds.height;
        return Math.min(scaleX, scaleY) * 0.9;
    }

    release(): void {
        RectanglePool.release(this.visibleBounds);
    }
}