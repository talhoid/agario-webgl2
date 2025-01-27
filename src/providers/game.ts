import type { Quadtree } from "@/physics/quadtree";
import type { Entity } from "@/physics/entity";
import type { Provider } from "./provider";
import type { Game } from "../../game";
import type { Camera } from "@/rendering/camera";

export class GameProvider implements Provider {
	private resources: Map<string, unknown> = new Map();

	register(resource: "quadtree", value: Quadtree<Entity>): void;
	register(resource: "game", value: Game): void;
	register(resource: "camera", value: Camera): void;
	register(resource: string, value: unknown): void {
		this.resources.set(resource, value);
	}

	provide(resource: "quadtree"): Quadtree<Entity>;
	provide(resource: "game"): Game;
	provide(resource: "camera"): Camera;
	provide(resource: string): unknown {
		return this.resources.get(resource);
	}
}
