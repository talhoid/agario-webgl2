import { nonnull } from "./src/util/nonnull";
import { Entity } from "@/physics/entity";
import { Quadtree } from "@/physics/quadtree";
import { Rectangle, RectanglePool } from "@/geometry/rectangle";
import { BoundBehavior } from "@/behaviors/bound";
import { GameProvider } from "@/providers/game";
import { Camera } from "@/rendering/camera";
import { binaryRadixSort } from "./src/util/sort";
import { PieChart } from "./chart";
import { NullPhysics } from "@/physics/physics";
import { DynamicList } from "./dynamic-list";
import { Renderer, type RenderCommand } from "@/rendering/renderer";
import { EntityRenderer } from "@/rendering/entities";
import { Grid } from "@/rendering/grid";

type Hook = {
	position: "begin" | "end";
	run: () => any;
};

type Hooks = {
	update: Hook[];
	render: Hook[];
};

export class Game {
	// Core systems
	public camera: Camera;
	private renderer: Renderer;
	private entityRenderer: EntityRenderer;
	private gridRenderer: Grid;
	public hooks: Hooks = {
		update: [],
		render: [],
	};

	// State management
	public entities = new DynamicList<Entity>();
	public paused = false;
	public lagging = false;
	private mainCharacter: Entity[] | null = null;

	// Timing/performance
	private lastTime = performance.now();
	private targetFPS = 60;
	private frameTime = 1000 / this.targetFPS;
	private accumulator = 0;
	private debugChart: PieChart;

	// Physics/spatial partitioning
	public readonly bounds: Rectangle;
	public readonly quadtree: Quadtree<Entity>;
	private provider = new GameProvider();

	constructor(canvas: HTMLCanvasElement, bounds: Rectangle) {
		this.bounds = bounds;
		this.quadtree = new Quadtree<Entity>(bounds, 10, 12);

		// Initialize rendering system
		const gl = nonnull(canvas.getContext("webgl2"));
		this.camera = new Camera(
			bounds,
			RectanglePool.acquire(0, 0, canvas.width, canvas.height)
		);
		this.renderer = new Renderer(canvas);
		this.gridRenderer = new Grid(gl);
		this.entityRenderer = new EntityRenderer(gl);

		// Setup debug overlay
		this.debugChart = this.createDebugOverlay();
		this.registerProviders();
	}

	private createDebugOverlay(): PieChart {
		const debugCanvas = document.createElement("canvas");
		debugCanvas.width = 600;
		debugCanvas.height = window.innerHeight;
		debugCanvas.style.position = "fixed";
		debugCanvas.style.top = "10px";
		debugCanvas.style.right = "10px";
		document.body.appendChild(debugCanvas);

		const chart = new PieChart(debugCanvas);
		const updateSegment = chart.addSegment("update", [
			163 / 255,
			230 / 255,
			53 / 255,
		]);
		updateSegment.addSegment("beginHooks", [1, 0, 0]);
		updateSegment.addSegment("endHooks", [0, 0, 1]);
		const renderSegment = chart.addSegment("render", [
			139 / 255,
			92 / 255,
			246 / 255,
		]);
		renderSegment.addSegment("beginHooks", [1, 0, 0]);
		renderSegment.addSegment("endHooks", [0, 0, 1]);
		chart.addSegment("idle", [0.25, 0.25, 0.25]);
		return chart;
	}

	private registerProviders(): void {
		this.provider.register("quadtree", this.quadtree);
		this.provider.register("game", this);
		this.provider.register("camera", this.camera);
	}

	public update(): void {
		const now = performance.now();
		const dt = now - this.lastTime;
		this.lastTime = now;
		if (!this.paused) this.accumulator += dt;

		this.debugChart.resetSegments();

		this.runHooks("begin", "update");
		if (!this.lagging) this.updateSimulation(now);
		if (this.mainCharacter) this.camera.follow(this.mainCharacter);
		this.renderFrame();
		this.runHooks("end", "update");

		this.debugChart.update("idle", this.frameTime - this.debugChart.total);
		this.debugChart.render();
		requestAnimationFrame(this.update.bind(this));
	}

	private updateSimulation(now: number): void {
		this.debugChart.measureTime("update", () => {
			while (
				this.accumulator >= this.frameTime &&
				performance.now() - now < this.frameTime
			) {
				for (const entity of this.entities) {
					if (entity.destroyed) continue;
					if (entity.physics instanceof NullPhysics) continue;
					entity.update(1);
					this.quadtree.update(entity);
				}

				for (const entity of this.entities) {
					entity.animate();
				}

				this.accumulator -= this.frameTime;
			}
		});
	}

	private renderFrame(): void {
		this.debugChart.measureTime("render", () => {
			this.runHooks("begin", "render");
			this.camera.update(this.frameTime);
			const matrix = this.camera.getTransformationMatrix();
			const visibleEntities = this.getVisibleEntities();
			for (const entity of visibleEntities) {
				entity.refresh();
			}

			const commands: RenderCommand[] = [
				...this.gridRenderer.getCommands(matrix),
				...this.entityRenderer.generateCommands(
					visibleEntities,
					this.camera
				),
			];

			this.renderer.execute(commands, matrix);
			this.runHooks("end", "render");
		});
	}

	private getVisibleEntities(): Entity[] {
		return binaryRadixSort(
			this.quadtree
				.retrieve(this.camera.visibleBounds)
				.filter((entity) => !entity.destroyed)
				.filter((entity) =>
					entity.bounds.intersects(this.camera.visibleBounds)
				),
			(entity) => entity.size
		);
	}

	private runHooks(
		position: "begin" | "end",
		method: "update" | "render"
	): void {
		const segment =
			position === "begin"
				? `${method}.beginHooks`
				: `${method}.endHooks`;
		this.debugChart.measureTime(segment, () => {
			for (const h of this.hooks[method]) {
				if (h.position === position) {
					h.run();
				}
			}
		});
	}

	// Public API
	public add(...entities: Entity[]): void {
		for (const entity of entities) {
			entity.behaviors.push(new BoundBehavior(this.bounds));
			entity.setProvider(this.provider);
			entity.refresh();
			this.quadtree.insert(entity);
		}
		this.entities.push(...entities);
	}

	public destroy(...entities: Entity[]): void {
		for (const entity of entities) {
			this.quadtree.remove(entity);
			entity.destroy();
		}
		this.entities.remove(...entities);
	}

	public setMainCharacter(entities: Entity[]): void {
		this.mainCharacter = entities;
	}

	// State control methods
	public pause(): void {
		this.paused = true;
	}
	public unpause(): void {
		this.paused = false;
	}
	public step(): void {
		this.accumulator = this.frameTime;
	}

	public lag() {
		this.lagging = true;
	}
	public unlag() {
		this.lagging = false;
	}

	public resetAccumulators(): void {
		this.accumulator = 0;
	}
}
