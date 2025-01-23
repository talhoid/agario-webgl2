import { circle } from "@/util/math";
import { RectanglePool } from "./rectangle";
import type { Shape } from "./shape";
import type { Vertex } from "./vertex";
import { Vector, VectorPool } from "./vector";
import type { Provider } from "@/providers/provider";

export class Circle implements Shape {
	position: Vector = VectorPool.acquire();

	constructor(public radius: number, public numPoints: number) {}

	setProvider(_provider: Provider) {}

	removeProvider(): void {}

	destroy(): void {}

	get vertices(): Vertex[] {
		const points = circle(this.numPoints, this.radius);
		const center: Vertex = [0, 0];
		return [center].concat(points).concat(points[0]);
	}

	get size() {
		return this.radius;
	}

	get vertexLength() {
		return this.numPoints + 2;
	}

	get bounds() {
		return RectanglePool.acquire(
			-this.radius,
			-this.radius,
			this.radius * 2,
			this.radius * 2
		);
	}

	// get physicalBounds() {
	//     return this.bounds;
	// }
}
