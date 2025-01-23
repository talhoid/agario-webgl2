import Stats from "./util/stats";
import { nonnull } from "./util/nonnull";
import { randomByte, randomInt } from "./util/random";
import { RGBAColor } from "./2d/rendering/color";
import { Entity } from "./2d/physics/entity";
import { VerletPhysics } from "./2d/physics/physics";
import { Cell } from "./2d/rendering/cell";
import type { Coordinate } from "./2d/geometry/coordinate";
import { RectanglePool } from "./2d/geometry/rectangle";
import { Game } from "./game";
// import { CellCollisionBehavior } from "./behaviors/collision";
import { random } from "./util/math";
import { ConsumptionBehavior } from "./behaviors/consumption";
import { memoize } from "./util/memo";
import { Vector, VectorPool } from "./2d/geometry/vector";

const canvas = nonnull(document.querySelector("canvas"));
const loader = nonnull(document.querySelector("div.loader"));
const worldBounds = RectanglePool.acquire(0, 0, 25600, 25600);

const game = new Game(canvas, worldBounds);

const food: Entity[] = new Array(1250 * 5).fill(undefined).map(
	() =>
		new Entity({
			color: new RGBAColor(randomByte(), randomByte(), randomByte(), 255),
			position: worldBounds.randomPoint(),
			shape: new Cell(1),
		})
);

const viruses: Entity[] = new Array(400).fill(undefined).map(
	() =>
		new Entity({
			color: new RGBAColor(0, 240, 0, 255),
			position: worldBounds.randomPoint(),
			shape: new Cell(143, true),
		})
);

// const viruses: Object[] = new Array(400).fill(undefined).map(
// 	() =>
// 		new Object({
// 			color: new RGBAColor(randomByte(), randomByte(), randomByte(), 255),
// 			position: worldBounds.randomPoint(),
// 			shape: new Cell(random(130, 154), true),
// 			physics: new VerletPhysics(),
// 		})
// );

const cell = new Entity({
	color: new RGBAColor(randomByte(), randomByte(), randomByte(), 128),
	position: worldBounds.randomPoint(),
	shape: new Cell(10),
	physics: new VerletPhysics(),
	behaviors: [new ConsumptionBehavior()],
});

const mouse: Coordinate = {
	x: -1,
	y: -1,
};

document.addEventListener("DOMContentLoaded", main);
document.addEventListener("mousemove", (event) => {
	mouse.x = event.clientX;
	mouse.y = event.clientY;
});
let userPaused = false;
let userLagged = false;
document.addEventListener("keydown", (event) => {
	switch (event.key) {
		case " ":
			game[userPaused ? "unpause" : "pause"]();
			userPaused = !userPaused;
			break;
		case ".":
			game.step();
			break;
		case "x":
			game.accumulator = 0;
			break;
		case "l":
			game[userLagged ? "unlag" : "lag"]();
			userLagged = !userLagged;
			break;
	}
});
document.addEventListener("visibilitychange", function () {
	if (document.hidden) game.pause();
	if (!document.hidden) game[userPaused ? "pause" : "unpause"]();
});

game.setMainCharacter(cell);

const MAX_VELOCITY = 1400;

function main() {
	const stats = new Stats();
	document.body.appendChild(stats.container);

	const calculateSpeed = memoize((radius) => {
		return (30 * 1.6) / Math.pow(radius, 0.32);
	});

	const totalDamper = 0.5;

	game.hooks.update.push({
		run() {
			const mouseWorldPos = VectorPool.acquire(
				game.camera.screenToWorld(mouse)
			);
			const toMouse = mouseWorldPos.subtract(cell.position);
			const distance = toMouse.magnitude();
			const radius = cell.shape.radius;

			// Tiny dead zone (1% of radius, min 2 units)
			const deadZone = Math.max(radius * 0.01, 2);

			if (distance < deadZone) {
				cell.physics.velocity = VectorPool.acquire(); // Full stop
				return;
			}

			// Calculate speed scaling through entire radius
			const slowingRange = radius - deadZone;
			let speedFactor = 1;

			if (distance < radius) {
				// Smoothly ramp speed from 0% to 100% across radius
				speedFactor = Math.min((distance - deadZone) / slowingRange, 1);
			}

			const direction = toMouse.normalize();
			const effectiveSpeed =
				calculateSpeed(radius) * speedFactor * totalDamper;

			cell.physics.velocity = direction
				.scale(effectiveSpeed)
				.limit(MAX_VELOCITY);
		},
		position: "begin",
	});

	game.add(...food);
	game.add(...viruses);
	game.add(cell);

	game.hooks.update.push({
		run: stats.update.bind(stats),
		position: "end",
	});

	game.update();

	setTimeout(() => {
		loader.remove();
		canvas.classList.remove("hidden");
		document.getElementById("error")?.remove();
	}, 125);
}