import type { Entity } from "@/2d/physics/entity";
import { Cell } from "@/2d/rendering/cell";
import type { Behavior } from "@/behaviors/behavior";
import { GameProvider } from "@/providers/game";

export class ConsumptionBehavior implements Behavior {
	private frameCount = 0;
	private readonly UPDATE_FREQUENCY = 2; // Update every N frames
	private readonly MIN_SIZE_RATIO = 1.1; // Bigger cell needs to be 10% larger
    private readonly MIN_DEPTH_RATIO = .9; 

	animate(object: Entity): void {
		if (!(object.provider instanceof GameProvider)) return;
		if (!(object.shape instanceof Cell)) return;

		// Only check every N frames
		this.frameCount++;
		if (this.frameCount % this.UPDATE_FREQUENCY !== 0) return;

		const cell = object.shape;

		// Get quadtree from provider instead of cell
		const quadtree = object.provider.provide("quadtree");
		const nearbyObjects = quadtree.retrieve(object.bounds);

		for (const nearbyObject of nearbyObjects) {
			if (
				!(nearbyObject.shape instanceof Cell) ||
				nearbyObject === object
			)
				continue;

			// Quick size-based rejection
			if (cell.radius < nearbyObject.shape.radius * this.MIN_SIZE_RATIO)
				continue;

			this.checkAndConsume(
				object as Entity<Cell, GameProvider>,
				nearbyObject as Entity<Cell, GameProvider>
			);
		}
	}

	private checkAndConsume(
		object: Entity<Cell, GameProvider>,
		other: Entity<Cell, GameProvider>
	) {
		const cell = object.shape;
		const otherCell = other.shape;

		// Square distance check for performance
		const dx = cell.position.x - otherCell.position.x;
		const dy = cell.position.y - otherCell.position.y;
		const distanceSquared = dx * dx + dy * dy;

		// Size-based consumption check
		if (cell.radius > otherCell.radius * this.MIN_SIZE_RATIO) {
			const consumeRadius = cell.radius * this.MIN_DEPTH_RATIO - otherCell.radius;
			if (distanceSquared < consumeRadius * consumeRadius) {
				this.consumeCell(object, other);
			}
		}
	}

	private consumeCell(
		object: Entity<Cell, GameProvider>,
		other: Entity<Cell, GameProvider>
	) {
		const cell = object.shape;
		const otherCell = other.shape;

		// Add mass to consuming cell
		cell.mass += otherCell.mass;

		// Clear consumed cell
		otherCell.mass = 0;

		// Request removal from game
		const game = object.provider?.provide("game");
		if (game) {
			game.destroy(other);
		}
	}
}
