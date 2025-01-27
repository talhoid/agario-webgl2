import {
	RectanglePool,
	Rectangle,
	type Rectangular,
} from "@/geometry/rectangle";
import type { Bounded } from "./bounded";
import { nonnull } from "@/util/nonnull";

export class Quadtree<T extends Bounded> {
	private static readonly NODE_COUNT = 4;
	private static readonly POOL: Quadtree<any>[] = [];
	private isLeaf = true;
	private midX: number = 0;
	private midY: number = 0;
	public readonly nodes: Quadtree<T>[] = new Array(4);
	private objects: T[] = [];
	public level: number;
	private root: Quadtree<T>;

	// Cache management (root node only)
	private objectCache: Map<T, Rectangle> = new Map();
	private objectNodes: Map<T, Quadtree<T>[]> = new Map();

	constructor(
		public bounds: Rectangle,
		public maxObjects: number = 10,
		public maxLevels: number = 4,
		level?: number,
		root?: Quadtree<T>
	) {
		this.root = root || this;
		this.level = level ?? 0;
		this.updateMidpoints();
	}

	static acquire<T extends Bounded>(
		bounds: Rectangle,
		maxObjects = 10,
		maxLevels = 4,
		level = 0,
		root: Quadtree<T>
	): Quadtree<T> {
		if (this.POOL.length > 0) {
			const node = nonnull(this.POOL.pop());
			node.bounds = bounds;
			node.maxObjects = maxObjects;
			node.maxLevels = maxLevels;
			node.level = level;
			node.root = root || node;
			node.isLeaf = true;
			node.objects = [];
			node.updateMidpoints();
			return node;
		}
		return new Quadtree(bounds, maxObjects, maxLevels, level, root);
	}

	private updateMidpoints(): void {
		this.midX = this.bounds.x + this.bounds.width / 2;
		this.midY = this.bounds.y + this.bounds.height / 2;
	}

	insert(object: T): void {
		let cachedBounds = this.root.objectCache.get(object);
		if (!cachedBounds) {
			cachedBounds = RectanglePool.clone(object.bounds);
			this.root.objectCache.set(object, cachedBounds);
		}

		if (!this.bounds.intersects(cachedBounds)) return;

		this.addToNode(object, cachedBounds);
	}

	private addToNode(object: T, bounds: Rectangle): void {
		if (!this.isLeaf) {
			const mask = this.getIndexMask(bounds);
			let count = 0;
			let singleIndex = -1;

			for (let i = 0; i < 4; i++) {
				if (mask & (1 << i)) {
					count++;
					singleIndex = i;
				}
			}

			if (count === 1) {
				this.nodes[singleIndex].addToNode(object, bounds);
			} else {
				for (let i = 0; i < 4; i++) {
					if (mask & (1 << i)) {
						this.nodes[i].addToNode(object, bounds);
					}
				}
			}
			return;
		}

		this.objects.push(object);
		this.root.addObjectNodeMapping(object, this);

		if (
			this.objects.length > this.maxObjects &&
			this.level < this.maxLevels
		) {
			this.split();
			this.redistributeObjects();
		}
	}

	private addObjectNodeMapping(object: T, node: Quadtree<T>): void {
		const nodes = this.root.objectNodes.get(object) || [];
		nodes.push(node);
		this.root.objectNodes.set(object, nodes);
	}

	update(object: T): void {
		const oldBounds = this.root.objectCache.get(object);
		if (!oldBounds) return;

		const newBounds = object.bounds;
		if (oldBounds.equals(newBounds)) return;

		// Remove from existing nodes
		const nodes = this.root.objectNodes.get(object) || [];
		for (const node of nodes) {
			const index = node.objects.indexOf(object);
			if (index !== -1) node.objects.splice(index, 1);
		}
		this.root.objectNodes.delete(object);
		RectanglePool.release(oldBounds);

		// Update cache and reinsert
		const newCachedBounds = RectanglePool.clone(newBounds);
		this.root.objectCache.set(object, newCachedBounds);
		this.root.insert(object);
	}

	private split(): void {
		const subWidth = this.bounds.width / 2;
		const subHeight = this.bounds.height / 2;
		const x = this.bounds.x;
		const y = this.bounds.y;
		const nextLevel = this.level + 1;

		this.nodes[0] = Quadtree.acquire(
			RectanglePool.acquire(this.midX, y, subWidth, subHeight),
			this.maxObjects,
			this.maxLevels,
			nextLevel,
			this.root
		);

		this.nodes[1] = Quadtree.acquire(
			RectanglePool.acquire(x, y, subWidth, subHeight),
			this.maxObjects,
			this.maxLevels,
			nextLevel,
			this.root
		);

		this.nodes[2] = Quadtree.acquire(
			RectanglePool.acquire(x, this.midY, subWidth, subHeight),
			this.maxObjects,
			this.maxLevels,
			nextLevel,
			this.root
		);

		this.nodes[3] = Quadtree.acquire(
			RectanglePool.acquire(this.midX, this.midY, subWidth, subHeight),
			this.maxObjects,
			this.maxLevels,
			nextLevel,
			this.root
		);

		this.isLeaf = false;
	}

	private getIndexMask(bounds: Rectangular): number {
		const left = bounds.x;
		const right = left + bounds.width;
		const top = bounds.y;
		const bottom = top + bounds.height;

		const overlapsTop = top < this.midY;
		const overlapsBottom = bottom > this.midY;
		const overlapsLeft = left < this.midX;
		const overlapsRight = right > this.midX;

		let mask = 0;
		if (overlapsTop && overlapsRight) mask |= 1 << 0;
		if (overlapsLeft && overlapsTop) mask |= 1 << 1;
		if (overlapsLeft && overlapsBottom) mask |= 1 << 2;
		if (overlapsRight && overlapsBottom) mask |= 1 << 3;

		return mask;
	}

	private redistributeObjects(): void {
		const objects = this.objects;
		this.objects = [];

		for (const obj of objects) {
			const cachedBounds = nonnull(this.root.objectCache.get(obj));
			const mask = this.getIndexMask(cachedBounds);
			for (let i = 0; i < 4; i++) {
				if (mask & (1 << i)) {
					this.nodes[i].addToNode(obj, cachedBounds);
				}
			}
			this.root.objectNodes.delete(obj);
		}
	}

	retrieve(queryBounds: Rectangular): T[] {
		const result: T[] = [];
		this.retrieveInto(queryBounds, result, new Set());
		return result;
	}

	private retrieveInto(
		queryBounds: Rectangular,
		result: T[],
		seen: Set<T>
	): void {
		for (const obj of this.objects) {
			if (!seen.has(obj)) {
				seen.add(obj);
				result.push(obj);
			}
		}

		if (!this.isLeaf) {
			const mask = this.getIndexMask(queryBounds);
			for (let i = 0; i < 4; i++) {
				if (mask & (1 << i)) {
					this.nodes[i].retrieveInto(queryBounds, result, seen);
				}
			}
		}
	}

	public clear(): void {
		this.objects.forEach((obj) => {
			const nodes = this.root.objectNodes.get(obj);
			if (nodes) {
				const index = nodes.indexOf(this);
				if (index !== -1) nodes.splice(index, 1);
				if (nodes.length === 0) {
					this.root.objectNodes.delete(obj);
					RectanglePool.release(
						nonnull(this.root.objectCache.get(obj))
					);
					this.root.objectCache.delete(obj);
				}
			}
		});

		this.objects.length = 0;

		if (!this.isLeaf) {
			for (let i = 0; i < Quadtree.NODE_COUNT; i++) {
				if (this.nodes[i]) {
					this.nodes[i].clear();
					Quadtree.POOL.push(this.nodes[i]);
					RectanglePool.release(this.nodes[i].bounds);
				}
			}
			this.nodes.fill(null as any);
			this.isLeaf = true;
		}
	}

	public remove(object: T): void {
		const root = this.root;
		if (!root.objectCache.has(object)) return;

		// Remove from all containing nodes
		const nodes = root.objectNodes.get(object);
		if (nodes) {
			for (const node of nodes) {
				const index = node.objects.indexOf(object);
				if (index !== -1) {
					node.objects.splice(index, 1);
				}
			}
			root.objectNodes.delete(object);
		}

		// Clean up cache
		const cachedBounds = root.objectCache.get(object);
		if (cachedBounds) {
			RectanglePool.release(cachedBounds);
			root.objectCache.delete(object);
		}
	}
}
