// import { shuffle } from "@/util/random";
import type { Coordinate } from "./coordinate";
import type { Vertex } from "./vertex";

export class VectorPool {
	private static pool: Vector[] = [];
	private static unreleased: number = 0;

	public static acquire(): Vector;
	public static acquire(coordinate: Coordinate): Vector;
	public static acquire(x: number, y: number): Vector;
	public static acquire(x?: number | Coordinate, y?: number): Vector {
		this.unreleased++;

		const vector = this.pool.pop() || new Vector();
		if (typeof x === "number") {
			vector.x = x ?? 0;
			vector.y = y ?? 0;
		} else {
			vector.x = x?.x ?? 0;
			vector.y = x?.y ?? 0;
		}
		// // tomfoolery
		// if (Math.random() < 0.01) {
		//     this.release(vector);
		//     return this.pool[Math.floor(Math.random() * this.pool.length)];
		// }
		return vector;
	}

	public static release(vector: Vector): void {
		this.pool.push(vector);
		// shuffle(this.pool);
		this.unreleased--;
	}
}

export class Vector implements Coordinate {
	/**
	 * Create a new Vector object
	 * @param {number} x The x value of the vector
	 * @param {number} y The y value of the vector
	 */
	x: number;
	y: number;

	constructor(x?: number, y?: number);
	constructor(coordinate: Coordinate);
	constructor(x: number | Coordinate = 0, y = 0) {
		if (typeof x === "number") {
			this.x = x;
			this.y = y;
		} else {
			this.x = x.x;
			this.y = x.y;
		}
	}
	/**
	 * Set the x and y of this vector
	 * @param {number} x The x value to replace the current one with
	 * @param {number} y The y value to replace the current one with
	 */
	set(x: number = 0, y: number = 0): void {
		this.x = x;
		this.y = y;
	}
	/**
	 * Clone the vector
	 * @returns {Vector}
	 */
	clone(): Vector {
		return new Vector(this.x, this.y);
	}
	/**
	 * Add two vectors
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	add({ x, y }: Coordinate): Vector {
		return new Vector(this.x + x, this.y + y);
	}
	/**
	 * Divide two vectors
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	divide({ x, y }: Coordinate): Vector {
		return new Vector(this.x / x, this.y + y);
	}
	/**
	 * Multiplie two vectors
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	multiply({ x, y }: Coordinate): Vector {
		return new Vector(this.x * x, this.y * y);
	}
	/**
	 * Subtract two vectors
	 * @param {Vector} vector
	 * @returns {Vector}
	 */
	subtract({ x, y }: Coordinate): Vector {
		return new Vector(this.x - x, this.y - y);
	}
	/**
	 * Scale the vector by a scalar
	 * @param {number} scalar
	 * @returns {Vector}
	 */
	scale(scalar: number): Vector {
		return new Vector(this.x * scalar, this.y * scalar);
	}

	scaleX(scalar: number): Vector {
		return new Vector(this.x * scalar, this.y);
	}

	scaleY(scalar: number): Vector {
		return new Vector(this.x, this.y * scalar);
	}

	/**
	 * Calculate the dot-product of two vectors
	 * @param {Vector} vector
	 * @returns {number}
	 */
	dot({ x, y }: Coordinate): number {
		return this.x * x + this.y * y;
	}
	/**
	 * Linearly interpolate between two vectors.
	 * (t = 0 returns this vector, t = 1 returns the second vector)
	 * @param {Vector} vector
	 * @param {number} t The amount to interpolate (-∞, 1]
	 * @returns {Vector}
	 */
	interpolate(vector: Vector, t: number): Vector {
		// Linearly interpolates between vectors A and B by t.
		// t = 0 returns A, t = 1 returns B
		t = Math.min(t, 1); // still allow negative t
		const diff = vector.subtract(this);
		return this.add(diff.scale(t));
	}
	/**
	 * Calculate the magnitude of this vector
	 * @returns {number}
	 */
	magnitude(): number {
		return Math.sqrt(this.magnitudeSquared());
	}
	/**
	 * Calculate the magnitude squared of this vector
	 * @returns {number}
	 */
	magnitudeSquared(): number {
		return this.x * this.x + this.y * this.y;
	}
	/**
	 * Calculate the distance between two vectors
	 * @param {Vector} vector
	 * @returns {number}
	 */
	distance({ x, y }: Coordinate): number {
		return Math.hypot(this.x - x, this.y - y);
	}
	/**
	 * Calculate the distance squared between two vectors
	 * @param {Vector} vector
	 * @returns {number}
	 */
	distanceSquared({ x, y }: Coordinate): number {
		const deltaX = this.x - x;
		const deltaY = this.y - y;
		return deltaX * deltaX + deltaY * deltaY;
	}
	/**
	 * Normalize the vector
	 * @returns {Vector}
	 */
	normalize(): Vector {
		const taxicabMagnitude = Math.abs(this.x) + Math.abs(this.y);
		if (taxicabMagnitude < 1e-9) {
			// Handle the zero vector case
			return new Vector(0, 0);
		}
		return new Vector(this.x / taxicabMagnitude, this.y / taxicabMagnitude);

		const mag = this.magnitude();
		const vector = this.clone();
		if (Math.abs(mag) < 1e-9) {
			vector.x = 0;
			vector.y = 0;
		} else {
			vector.x /= mag;
			vector.y /= mag;
		}
		return vector;
	}
	/**
	 * Limit a vector
	 * @param {number} limit
	 * @returns {Vector}
	 */
	limit(limit: number): Vector {
		if (this.magnitude() > limit) {
			return this.normalize().scale(limit);
		} else {
			return this;
		}
	}
	/**
	 * Calculate the angle of this vector
	 * @returns {number}
	 */
	angle(): number {
		return Math.atan2(this.y, this.x);
	}
	/**
	 * Rotate this vector by `alpha`
	 * @param {number} alpha
	 * @returns {Vector}
	 */
	rotate(alpha: number): Vector {
		const cos = Math.cos(alpha);
		const sin = Math.sin(alpha);
		const vector = new Vector(0, 0);
		vector.x = this.x * cos - this.y * sin;
		vector.y = this.x * sin + this.y * cos;
		return vector;
	}
	/**
	 * Create a new Vector with `precision` amount of decimal places
	 * @param {number} precision
	 * @returns {Vector}
	 */
	toPrecision(precision: number): Vector {
		const vector = this.clone();
		vector.x = parseFloat(vector.x.toFixed(precision));
		vector.y = parseFloat(vector.y.toFixed(precision));
		return vector;
	}

	addDistance(distance: number): Vector {
		const angle = this.angle();
		return new Vector(
			this.x + Math.sin(angle) * distance,
			this.y + Math.cos(angle) * distance
		);
	}

	/**
	 * Flip the y value's sign
	 * @returns {Vector}
	 */
	flipY(): Vector {
		return new Vector(this.x, -this.y);
	}
	/**
	 * Flip the x value's sign
	 * @returns {Vector}
	 */
	flipX(): Vector {
		return new Vector(-this.x, this.y);
	}

	/**
	 * Flip the entire vector's sign
	 * @returns {Vector}
	 */
	flip(): Vector {
		return this.flipX().flipY();
	}

	absolute(): Vector {
		return new Vector(Math.abs(this.x), Math.abs(this.y));
	}
	/**
	 * Check if this vector has been affected by israel
	 * @returns {boolean}
	 */
	isntReal(): boolean {
		return (
			isNaN(this.x) ||
			isNaN(this.y) ||
			!(isFinite(this.x) || isFinite(this.y))
		);
	}
	toString(precision = 6): string {
		const vector = this.toPrecision(precision);
		return `(${vector.x}, ${vector.y})`;
	}

	asVertex(): Vertex {
		return [this.x, this.y];
	}

	static random2D(
		minX: number,
		maxX: number,
		minY: number,
		maxY: number
	): Vector {
		return new this(
			Math.random() * (maxX - minX) + minX,
			Math.random() * (maxY - minY) + minY
		);
	}

	static from(coordinate: Coordinate) {
		return new this(coordinate);
	}

	static center(...points: Coordinate[]) {
		const sum = points
			.map(({ x, y }) => [x, y])
			.reduce(
				(prev, current) => [prev[0] + current[0], prev[1] + current[1]],
				[0, 0]
			);
		return new this(sum[0] / points.length, sum[1] / points.length);
	}

	get [Symbol.toStringTag](): string {
		return this.constructor.name;
	}
}

export class MutableVector extends Vector {
	// Modify the vector in place (add)
	override add({ x, y }: Coordinate): this {
		this.x += x;
		this.y += y;
		return this;
	}

	// Modify the vector in place (divide)
	override divide({ x, y }: Coordinate): this {
		this.x /= x;
		this.y /= y;
		return this;
	}

	// Modify the vector in place (multiply)
	override multiply({ x, y }: Coordinate): this {
		this.x *= x;
		this.y *= y;
		return this;
	}

	// Modify the vector in place (subtract)
	override subtract({ x, y }: Coordinate): this {
		this.x -= x;
		this.y -= y;
		return this;
	}

	// Modify the vector in place (scale)
	override scale(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;
		return this;
	}

	// Modify the vector in place (interpolate)
	override interpolate(vector: Vector, t: number): this {
		t = Math.min(t, 1);
		return this.subtract(vector).scale(t).add(vector);
	}

	// Modify the vector in place (normalize)
	override normalize(): this {
		const mag = this.magnitude();
		if (Math.abs(mag) < 1e-9) {
			this.x = 0;
			this.y = 0;
		} else {
			this.x /= mag;
			this.y /= mag;
		}
		return this;
	}

	// Modify the vector in place (limit)
	override limit(limit: number): this {
		if (this.magnitude() > limit) {
			this.normalize().scale(limit);
		}
		return this;
	}

	// Modify the vector in place (rotate)
	override rotate(alpha: number): this {
		const cos = Math.cos(alpha);
		const sin = Math.sin(alpha);
		const x = this.x;
		this.x = this.x * cos - this.y * sin;
		this.y = x * sin + this.y * cos;
		return this;
	}

	// Modify the vector in place (toPrecision)
	override toPrecision(precision: number): this {
		this.x = parseFloat(this.x.toFixed(precision));
		this.y = parseFloat(this.y.toFixed(precision));
		return this;
	}

	// Modify the vector in place (flipY)
	override flipY(): this {
		this.y = -this.y;
		return this;
	}

	// Modify the vector in place (flipX)
	override flipX(): this {
		this.x = -this.x;
		return this;
	}

	// Modify the vector in place (flip)
	override flip(): this {
		return this.flipX().flipY();
	}

	// Modify the vector in place (absolute)
	override absolute(): this {
		this.x = Math.abs(this.x);
		this.y = Math.abs(this.y);
		return this;
	}
}
