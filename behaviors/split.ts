import type { Entity } from "@/2d/physics/entity";
import type { Behavior } from "./behavior";
import type { Cell } from "@/2d/rendering/cell";
import type { GameProvider } from "@/providers/game";

export class SplitBehavior implements Behavior {
	constructor(private list: Entity<Cell, GameProvider>[]) {}
	split() {
        this.list.push()
    }
	animate(object: Object): void {}
}
