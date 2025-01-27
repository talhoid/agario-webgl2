import type { Entity } from "@/physics/entity";
import { Cell } from "@/rendering/cell";
import type { Behavior } from "./behavior";
import { GameProvider } from "@/providers/game";

export class CellCollisionBehavior implements Behavior {
	animate(object: Entity): void {
		if (object.provider instanceof GameProvider) {
			if (object.shape instanceof Cell) {
				const cell = object.shape;
				const quadtree = object.provider.provide("quadtree");
				const nearbyObjects = quadtree.retrieve(cell.bounds);
				for (const nearbyObject of nearbyObjects) {
					if (
						nearbyObject.shape instanceof Cell &&
						nearbyObject !== object
					) {
						const otherCell = nearbyObject.shape;
						const distanceSquared = cell.position.distanceSquared(
							otherCell.position
						);
						const combinedRadius = cell.radius + otherCell.radius;
						if (distanceSquared < combinedRadius * combinedRadius) {
							this.handleCollision(
								object as Entity<Cell>,
								nearbyObject as Entity<Cell>,
								distanceSquared
							);
						}
					}
				}
			}
		}
	}

	handleCollision(
		object: Entity<Cell>,
		other: Entity<Cell>,
		distanceSquared: number
	) {
		const cell = object.shape;
		const otherCell = other.shape;
		const distance = Math.sqrt(distanceSquared);
		const combinedRadius = cell.radius + otherCell.radius;

		// Calculate the direction vector between this object and the colliding object
		const direction = otherCell.position
			.subtract(cell.position)
			.normalize();

		// Adjust the ratio to favor larger overlaps for smaller objects
		const sizeDifference = cell.radius - otherCell.radius;
		const ratio = 1 + (sizeDifference / cell.radius) * 0.3; // Increased multiplier for stronger effect

		// Calculate the overlap distance
		const overlap = (combinedRadius - distance) * 0.5 * ratio;

		// Move objects apart proportionally to their radius
		const thisMove = direction.scale(
			-overlap * (otherCell.radius / combinedRadius)
		);
		const objectMove = direction.scale(
			overlap * (cell.radius / combinedRadius)
		);

		// Update positions
		object.position = object.position.add(thisMove);
		other.position = other.position.add(objectMove);
	}
}
