import type { Coordinate } from "@/geometry/coordinate";
import type { Drawable } from "./drawable";
import { Rectangle, RectanglePool } from "@/geometry/rectangle";
import type { Shape } from "@/geometry/shape";
import type { Vertex } from "@/geometry/vertex";
import { Vector, VectorPool } from "@/geometry/vector";
import type { GameProvider } from "@/providers/game";
import type { Quadtree } from "@/physics/quadtree";
import { Entity } from "@/physics/entity";
import { roundup } from "@/util/math";
// Add new imports

// Add at top of file

type Point = Coordinate & { radius: number };

export class Cell implements Drawable, Shape {
	// Required public interface
	public isVirus: boolean = false;
	public isAgitated: boolean = false;
	public position: Vector = VectorPool.acquire();
	private static readonly LOOKUP_SIZE = 720;
	private static readonly SIN_LOOKUP = new Float32Array(this.LOOKUP_SIZE).map(
		(_, i) => Math.sin((i * 2 * Math.PI) / this.LOOKUP_SIZE)
	);

	// Core properties - private
	#points: Point[] = [];
	#pointsAcc: number[] = [];
	#radius: number;

	#mass: number = 0;
	#vertices: Vertex[] = [];
	#bounds: Rectangle = RectanglePool.acquire(0, 0, 0, 0);

	// Internal state
	private quadtree: Quadtree<Entity> | null = null;
	private quadtreeCache: Entity<Cell>[] = [];
	private provider: GameProvider | null = null;
	private frameCount: number = 0;
	private boundsInvalidated = true;
	private prevIndices: number[] = [];
	private nextIndices: number[] = [];
	private lastNumPoints: number | null = null;

	constructor(mass: number, virus: boolean = false) {
		this.#mass = mass;
		this.#radius = Math.max(0, Math.sqrt(mass * 100) >> 0);
		this.isVirus = virus;
		this.#createPoints();
		this.#updateBounds();
		this.refresh();
	}

	// Public interface
	public get mass(): number {
		return this.#mass;
	}
	public set mass(value: number) {
		this.#mass = value;
		this.#radius = Math.max(0, Math.sqrt(value * 100) >> 0);
		this.boundsInvalidated = true;
	}

	public get vertices(): Vertex[] {
		return this.#vertices;
	}
	public get radius(): number {
		return this.#radius;
	}
	public get points(): Point[] {
		return this.#points;
	}

	public get bounds(): Rectangle {
		if (this.boundsInvalidated) {
			this.#updateBounds();
		}
		return this.#bounds;
	}

	#updateBounds(): void {
		RectanglePool.release(this.#bounds);
		this.#bounds = RectanglePool.acquire(
			-this.radius,
			-this.radius,
			this.radius * 2,
			this.radius * 2
		); // circle bounds from this.#radius
		this.boundsInvalidated = false;
	}

	public get vertexLength(): number {
		return this.#points.length + 2;
	}

	public get size(): number {
		return this.radius;
	}

	// Provider interface
	public setProvider(provider: GameProvider): void {
		this.provider = provider;
		this.quadtree = provider.provide("quadtree");
	}

	public removeProvider(): void {
		this.provider = null;
		this.quadtree = null;
	}

	// Lifecycle methods
	public refresh(): void {
		if (this.#points.length !== this.#getNumPoints()) {
			this.#createPoints();
		}
		this.#movePoints();
	}

	public destroy(): void {
		this.#points.length = 0;
		this.#pointsAcc.length = 0;
		RectanglePool.release(this.#bounds);
	}

	// Private implementation
	private static sin(angle: number): number {
		const normalizedAngle = angle % (2 * Math.PI);
		const index =
			(((normalizedAngle >= 0
				? normalizedAngle
				: normalizedAngle + 2 * Math.PI) *
				Cell.LOOKUP_SIZE) /
				(2 * Math.PI)) |
			0;
		return Cell.SIN_LOOKUP[index];
	}

	private static cos(angle: number): number {
		return Cell.sin(angle + Math.PI / 2);
	}

	#getNumPoints(): number {
		const zoom = this.provider?.provide("camera").zoom ?? 1;
		let points = 10;

		if (this.radius < 20) points = 0;
		if (this.isVirus) points = 30;

		let radiusFactor = this.radius;

		if (!this.isVirus) {
			radiusFactor *= Math.min(1, Math.pow(zoom, 0.5));

			const maxPointsBasedOnZoom = Math.max(
				5,
				Math.min(30, 15 / Math.pow(zoom, 0.5))
			);
			points = Math.min(points, maxPointsBasedOnZoom);
		}

		radiusFactor = this.isVirus
			? radiusFactor
			: Math.pow(radiusFactor, 0.9);

		let finalPoints = Math.max(Math.floor(radiusFactor), points);
		finalPoints = !this.isVirus
			? Math.floor(Math.sqrt(20 * finalPoints))
			: roundup(finalPoints, 2) - 20;
		return finalPoints;
	}

	#createPoints() {
		const numPoints = this.#getNumPoints();
		if (numPoints <= 0) {
			this.#points.length = 0;
			this.#pointsAcc.length = 0;
			return;
		}

		if (numPoints !== this.lastNumPoints) {
			this.prevIndices = Array.from(
				{ length: numPoints },
				(_, i) => (i - 1 + numPoints) % numPoints
			);
			this.nextIndices = Array.from(
				{ length: numPoints },
				(_, i) => (i + 1) % numPoints
			);
			this.lastNumPoints = numPoints;
			this.#createPoints();
		}

		while (this.#points.length > numPoints) {
			this.#points.pop();
			this.#pointsAcc.pop();
		}

		if (this.#points.length === 0 && numPoints > 0) {
			this.#points.push({ radius: this.radius, x: 0, y: 0 });
			this.#pointsAcc.push(Math.random() - 0.5);
		}

		while (this.#points.length < numPoints) {
			const randIndex = Math.floor(Math.random() * this.#points.length);
			const point = this.#points[randIndex];
			this.#points.splice(randIndex, 0, {
				radius: point.radius,
				x: point.x,
				y: point.y,
			});
			this.#pointsAcc.splice(randIndex, 0, this.#pointsAcc[randIndex]);
		}
	}

	public hasPointNear(position: Coordinate, maxDistanceSq: number): boolean {
		const dx = position.x - this.position.x;
		const dy = position.y - this.position.y;
		const distanceSqToCenter = dx * dx + dy * dy;
		const radiusPlus5 = this.radius + 5;

		if (distanceSqToCenter > radiusPlus5 * radiusPlus5) {
			return false;
		}

		for (const point of this.points) {
			const pDx = dx - point.x;
			const pDy = dy - point.y;
			const distanceSq = pDx * pDx + pDy * pDy;
			if (distanceSq < maxDistanceSq) {
				return true;
			}
		}

		return false;
	}

	#movePoints() {
		const timestamp = this.frameCount * 16;
		const numPoints = this.#points.length;
		const angleStep = (Math.PI * 2) / numPoints;
		const isVirusFactor = this.isVirus
			? 0
			: ((100 / 1000 + timestamp / 10000) % Math.PI) * 2;

		if (this.quadtree && this.radius > 15) {
			if (this.frameCount % 24 === 1) {
				const bounds = this.bounds.translate(this.position);
				this.quadtreeCache = this.quadtree
					.retrieve(bounds)
					.filter(
						(obj): obj is Entity<Cell> =>
							!obj.destroyed &&
							obj.shape instanceof Cell &&
							obj.shape !== this
					);
				RectanglePool.release(bounds);
			}
			this.frameCount++;
		}

		for (let i = 0; i < numPoints; ++i) {
			const prevAcc = this.#pointsAcc[this.prevIndices[i]];
			const nextAcc = this.#pointsAcc[this.nextIndices[i]];
			const randomAdjustment =
				(Math.random() - 0.5) * (this.isAgitated ? 3 : 1);

			this.#pointsAcc[i] += randomAdjustment;
			this.#pointsAcc[i] *= 0.7;
			this.#pointsAcc[i] = Math.min(
				10,
				Math.max(-10, this.#pointsAcc[i])
			);
			this.#pointsAcc[i] =
				(prevAcc + nextAcc + 8 * this.#pointsAcc[i]) / 10;
		}

		const currentPositionX = this.position.x;
		const currentPositionY = this.position.y;
		const quadtreeBounds = this.quadtree?.bounds;

		for (let j = 0; j < numPoints; ++j) {
			let radius = this.#points[j].radius;
			const prevRadius = this.#points[this.prevIndices[j]].radius;
			const nextRadius = this.#points[this.nextIndices[j]].radius;

			if (this.radius > 15 && this.quadtreeCache.length > 0) {
				const currentX = this.#points[j].x + currentPositionX;
				const currentY = this.#points[j].y + currentPositionY;
				let bounce = false;

				// Check if current point is outside quadtree bounds
				if (quadtreeBounds) {
					bounce =
						currentX < quadtreeBounds.x ||
						currentX > quadtreeBounds.x + quadtreeBounds.width ||
						currentY < quadtreeBounds.y ||
						currentY > quadtreeBounds.y + quadtreeBounds.height;
				}

				if (!bounce) {
					for (const obj of this.quadtreeCache) {
						const objShape = obj.shape as Cell;
						if (
							objShape.hasPointNear(
								{ x: currentX, y: currentY },
								25
							)
						) {
							bounce = true;
							break;
						}
					}
				}

				if (bounce) {
					if (this.#pointsAcc[j] > 0) this.#pointsAcc[j] = 0;
					this.#pointsAcc[j] -= 1;
				}
			}

			radius += this.#pointsAcc[j];
			radius = Math.max(0, radius);

			radius = this.isAgitated
				? (19 * radius + this.radius) / 20
				: (12 * radius + this.radius) / 13;

			this.#points[j].radius =
				(prevRadius + nextRadius + 8 * radius) / 10;

			const angle = angleStep * j;
			let adjustedRadius = this.#points[j].radius;

			if (this.isVirus && j % 2 === 0) {
				adjustedRadius += 5;
			}

			this.#points[j].x =
				Cell.cos(angle + isVirusFactor) * adjustedRadius;
			this.#points[j].y =
				Cell.sin(angle + isVirusFactor) * adjustedRadius;
		}

		if (this.#vertices.length !== this.vertexLength) {
			this.#vertices = new Array(this.vertexLength);
		}
		this.#vertices[0] = [0, 0];
		for (let i = 0; i < this.#points.length; i++) {
			this.#vertices[i + 1] = [this.#points[i].x, this.#points[i].y];
		}
		this.#vertices[this.vertexLength - 1] = [
			this.#points[0].x,
			this.#points[0].y,
		];
	}
}
