import type { Entity } from "@/physics/entity";

export interface Behavior {
	animate(object: Entity): void;
}

