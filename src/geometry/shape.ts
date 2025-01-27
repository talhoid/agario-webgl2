import type { Provider } from "@/providers/provider";
import type { Rectangle } from         "./rectangle";
import type { Vector } from               "./vector";
import type { Vertex } from               "./vertex";

export interface Shape {
    position: Vector;
	vertices: Vertex[];
    size: number;
    bounds: Rectangle;
    setProvider(provider: Provider): void;
    removeProvider(): void;
    destroy(): void;
    refresh?(): void;
}
