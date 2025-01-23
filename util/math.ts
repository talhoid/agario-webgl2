import type { Vertex } from "@/2d/geometry/vertex";

export const random = (min: number, max: number): number =>
	Math.random() * (max - min + 1) + min;
export const clamp = (x: number, min: number, max: number) =>
	Math.min(Math.max(x, min), max);
export const lerp = (a: number, b: number, alpha: number) =>
	a + alpha * (b - a);
export const circle = (numPoints: number, radius: number, range?: number): Vertex[] =>
	Array(numPoints | 0)
		.fill(1)
		.map((x, y) => x + y)
		.map((i, _) => {
			const angle = ((range ?? Math.PI * 2) * i) / numPoints;
			const x = radius * Math.cos(angle);
			const y = radius * Math.sin(angle);
			return [x, y];
		});
export const roundup = (x: number, mult: number) => Math.ceil(x/mult)*mult;