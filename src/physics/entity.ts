import type { Behavior } from "@/behaviors/behavior";
import { RGBAColor, type Color } from "@/rendering/color";
import { NullPhysics, type Physics } from "@/physics/physics";
import type { Shape } from "@/geometry/shape";
import type { Vector } from "@/geometry/vector";
import type { Provider } from "@/providers/provider";
import { Rectangle } from "@/geometry/rectangle";

export class Entity<T extends Shape = Shape, Q extends Provider = Provider> {
	public physics: Physics;
	public color: Color;
	public shape: T;
	public behaviors: Behavior[];

	public destroyed: boolean = false;
	public provider: Q | null = null;
	private shapeBounds: Rectangle | null = null;

	constructor({
		physics = new NullPhysics(),
		color = new RGBAColor(0, 0, 0, 0),
		shape,
		position,
		behaviors = [],
		provider,
	}: {
		physics?: Physics;
		color?: Color;
		shape: T;
		provider?: Q | null;
		position: Vector;
		behaviors?: Behavior[];
	}) {
		physics.position = position;
		this.physics = physics;
		this.color = color;
		this.shape = shape;
		this.behaviors = behaviors;
        this.provider = provider ?? null;
	}

	refresh() {
		if (this.destroyed) return;
		if (this.shape.refresh) {
			this.shape.refresh();
		}
	}

	update(deltaTime: number) {
		this.physics.update(deltaTime);
	}

	destroy() {
		this.behaviors = [];
		this.removeProvider();
		this.destroyed = true;
		this.shape.destroy();
	}

	animate() {
		if (this.destroyed) return;
		for (const behavior of this.behaviors) {
			behavior.animate(this);
		}
		this.shape.position = this.position;
	}

	setProvider(provider: Q) {
		if (this.destroyed) return;
		this.provider = provider;
		this.shape.setProvider(provider);
	}

	removeProvider() {
		this.provider = null;
		this.shape.removeProvider();
	}

	get position() {
		return this.physics.position;
	}

	set position(position: Vector) {
		this.physics.position = position;
	}

	get bounds() {
		const bounds = this.shape.bounds;
		const staleBounds = this.shapeBounds?.id !== this.shape.bounds.id;
		if (staleBounds) {
			this.shapeBounds = bounds;
		}
		return this.shapeBounds!.translate(this.position);
	}

	get vertices() {
		return !this.destroyed
			? this.shape.vertices.map((vertex) => [
					vertex[0] + this.position.x,
					vertex[1] + this.position.y,
			  ])
			: [];
	}

	get size() {
		return this.shape.size;
	}
}
