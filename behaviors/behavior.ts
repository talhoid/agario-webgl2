import type { Entity } from "@/2d/physics/entity";

export interface Behavior {
	animate(object: Entity): void;
}

