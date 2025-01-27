import { Entity } from "@/physics/entity";
import type { Behavior } from "./behavior";
import type { Cell } from "@/rendering/cell";
import type { GameProvider } from "@/providers/game";

export class SplitBehavior implements Behavior {
	constructor(private list: Entity<Cell, GameProvider>[]) {}
	split() {
		const add = [];
		for (const entity of this.list) {
			entity.shape.mass /= 2;
			const split = new Entity(entity);
			split.shape.mass = entity.shape.mass;
			add.push(split);
		}
		this.list.push(...add);
	}
	animate(_object: Object): void {}
}
