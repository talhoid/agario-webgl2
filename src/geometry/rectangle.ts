import type { Coordinate } from "./coordinate";
import { Vector } from "./vector";
import type { Vertex } from "./vertex";

export interface Rectangular {
	x: number;
	y: number;
	width: number;
	height: number;
}

export class RectanglePool {
	private static pool: Rectangle[] = [];
	private static unreleased: number = 0;
	private static id = 0;

	public static nextId(): number {
		return this.id++;
	}

	public static clone(source: Rectangular): Rectangle {
		return this.acquire(source);
	}

	public static acquire(): Rectangle;
	public static acquire(rectangular: Rectangular): Rectangle;
	public static acquire(
		x: number,
		y: number,
		width: number,
		height: number
	): Rectangle;
	public static acquire(
		x?: number | Rectangular,
		y?: number,
		width?: number,
		height?: number
	): Rectangle {
		this.unreleased++;

		const rectangle = this.pool.pop() || new Rectangle();
		rectangle.id = this.nextId();
		if (typeof x === "number") {
			rectangle.x = x ?? 0;
			rectangle.y = y ?? 0;
			rectangle.width = width ?? 0;
			rectangle.height = height ?? 0;
		} else {
			rectangle.x = x?.x ?? 0;
			rectangle.y = x?.y ?? 0;
			rectangle.width = x?.width ?? 0;
			rectangle.height = x?.height ?? 0;
		}

		return rectangle;
	}

	public static release(rectangle: Rectangle): void {
		this.pool.push(rectangle);
		this.unreleased--;
	}
}

export class Rectangle implements Rectangular {
	x: number = 0;
	y: number = 0;
	width: number = 0;
	height: number = 0;
	id: number;

	/**
	 * Creates a RectanglePool.acquire
	 * @param {number | Rectangular | boolean} [x] - The x coordinate, rectangular object, or acquisition flag
	 * @param {number} [y] - The y coordinate
	 * @param {number} [width] - The width
	 * @param {number} [height] - The height
	 */
	constructor();
	constructor(rectangular: Rectangular);
	constructor(x: number, y: number, width: number, height: number);
	constructor(
		x?: number | Rectangular | boolean,
		y?: number,
		width?: number,
		height?: number
	) {
		this.id = RectanglePool.nextId();

		if (typeof x === "number") {
			this.x = x ?? 0;
			this.y = y ?? 0;
			this.width = width ?? 0;
			this.height = height ?? 0;
		} else if (typeof x !== "boolean") {
			this.x = x?.x ?? 0;
			this.y = x?.y ?? 0;
			this.width = x?.width ?? 0;
			this.height = x?.height ?? 0;
		}
	}

	set(x: number, y: number, width: number, height: number) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	/**
	 * Returns a random point on this rectangle
	 * @returns {Vector}
	 */
	randomPoint(): Vector {
		return Vector.random2D(
			this.x,
			this.x + this.width,
			this.y,
			this.y + this.height
		);
	}

	translate(translation: Coordinate) {
		// RectanglePool.release(this);

		return RectanglePool.acquire(
			this.x + translation.x,
			this.y + translation.y,
			this.width,
			this.height
		);
	}

	contains(point: Coordinate) {
		return (
			point.x >= this.x &&
			point.x <= this.x + this.width &&
			point.y >= this.y &&
			point.y <= this.y + this.height
		);
	}

	extend(rectangle: Rectangular) {
		const halfWidthIncrease = rectangle.width / 2;
		const halfHeightIncrease = rectangle.height / 2;

		const newX = this.x - halfWidthIncrease;
		const newY = this.y - halfHeightIncrease;
		const newWidth = this.width + halfWidthIncrease;
		const newHeight = this.height + halfHeightIncrease;
		// RectanglePool.release(this);
		return RectanglePool.acquire(newX, newY, newWidth, newHeight);
	}

	/**
	 * Checks if this rectangle intersects with another rectangle.
	 * @param {Rectangular} rectangle - The rectangle to check for intersection.
	 * @returns {boolean} True if the rectangles intersect, false otherwise.
	 */
	intersects(rectangle: Rectangular) {
		return (
			this.x < rectangle.x + rectangle.width &&
			this.x + this.width > rectangle.x &&
			this.y < rectangle.y + rectangle.height &&
			this.y + this.height > rectangle.y
		);
	}

	clone() {
		return RectanglePool.acquire(this.x, this.y, this.width, this.height);
	}

	equals(rectangle: Rectangular) {
		return (
			this.x == rectangle.x &&
			this.y == rectangle.y &&
			this.width == rectangle.width &&
			this.height == rectangle.height
		);
	}

	get vertices(): Vertex[] {
		return [
			[this.x, this.y],
			[this.x + this.width, this.y],
			[this.x + this.width, this.y + this.height],
			[this.x, this.y + this.height],
		];
	}
}
