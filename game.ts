import * as twgl from "twgl.js";
import shapeVS from "./shaders/shape/vertex.glsl";
import shapeFS from "./shaders/shape/fragment.glsl";
import gridVS from "./shaders/grid/vertex.glsl";
import gridFS from "./shaders/grid/fragment.glsl";
import outlineVS from "./shaders/outline/vertex.glsl";
import outlineFS from "./shaders/outline/fragment.glsl";

import { nonnull } from "./util/nonnull";
import { Entity } from "./2d/physics/entity";
import { Quadtree } from "./2d/physics/quadtree";
import { Rectangle, RectanglePool } from "./2d/geometry/rectangle";
import { BoundBehavior } from "./behaviors/bound";
import { GameProvider } from "./providers/game";
import { Camera } from "./2d/rendering/camera";
import type { Vertex } from "./2d/geometry/vertex";
import { mat4 } from "gl-matrix";
import { binaryRadixSort } from "./util/sort";
import { PieChart } from "./chart";
import { NullPhysics } from "./2d/physics/physics";

type Hook = {
	position: "begin" | "end";
	run: () => any;
};

type Hooks = {
	update: Hook[];
	render: Hook[];
};

enum RenderLayer {
	BACKGROUND = 0,
	GRID = 1,
	OBJECTS = 2,
	UI = 3,
}

type RenderBatch = {
	bufferInfo: twgl.BufferInfo | null;
	isDirty: boolean;
	objects: Entity[];
	layer: RenderLayer;
	drawType: GLenum;
	program: twgl.ProgramInfo;
	render: boolean;
};

export class Game {
	private static readonly INDEX_PATTERNS = new Map<number, Uint16Array>();
	private static readonly MAX_PRECOMPUTED_VERTS = 1024;

	// Initialize index patterns once (call this during app initialization)
	public static initializeIndexPatterns() {
		for (let n = 3; n <= this.MAX_PRECOMPUTED_VERTS + 2; n++) {
			const indices = new Uint16Array((n - 1) * 3);
			for (let i = 0; i < n - 1; i++) {
				indices[i * 3] = 0;
				indices[i * 3 + 1] = i;
				indices[i * 3 + 2] = i + 1;
			}
			this.INDEX_PATTERNS.set(n, indices);
		}
	}
	// --- Rendering Properties ---
	public camera: Camera;
	private canvas: HTMLCanvasElement;
	private gl: WebGL2RenderingContext;
	private programs: {
		[k: string]: twgl.ProgramInfo;
		shape: twgl.ProgramInfo;
		grid: twgl.ProgramInfo;
		outline: twgl.ProgramInfo;
	};
	private batches: Map<string, RenderBatch> = new Map();
	// private originalCameraMatrix: mat4;
	// private originalCameraBounds: Rectangle;

	// --- State Properties ---
	public paused: boolean = false;
	#lag: boolean = false;
	private isDirty = true;
	private mainCharacter: Entity | null = null;
	#step: boolean = false;

	// --- Physics/Simulation Properties ---
	public objects: Entity[] = [];
	public bounds: Rectangle;
	public quadtree: Quadtree<Entity>;

	// --- Performance/Timing Properties ---
	private BUFFER_SIZE = 1024 * 1024;
	private buffer = new ArrayBuffer(
		this.BUFFER_SIZE * Float32Array.BYTES_PER_ELEMENT
	);
	private readonly vertexBuffer: Float32Array;
	private readonly colorBuffer: Float32Array;
	private readonly indexBuffer: Uint16Array;
	private readonly centerBuffer: Float32Array;
	private lastTime = performance.now();
	private targetFPS = 60;
	private frameTime = 1000 / this.targetFPS;
	private frame = 0n;
	public accumulator = 0;

	// --- System Properties ---
	private provider = new GameProvider();
	public hooks: Hooks = {
		update: [],
		render: [],
	};
	private debugChart: PieChart;

	constructor(canvas: HTMLCanvasElement, bounds: Rectangle) {
		this.canvas = canvas;
		this.gl = nonnull(canvas.getContext("webgl2", {}));
		this.bounds = bounds;
		this.quadtree = new Quadtree<Entity>(this.bounds, 10, 12);
		this.camera = new Camera(
			bounds,
			RectanglePool.acquire(0, 0, canvas.width, canvas.height)
		);
		// this.originalCameraMatrix = this.camera.getTransformationMatrix();
		// this.originalCameraBounds = this.camera.visibleBounds.clone();
		this.provider.register("quadtree", this.quadtree);
		this.provider.register("game", this);
		this.provider.register("camera", this.camera);
		this.programs = {
			shape: twgl.createProgramInfo(this.gl, [shapeVS, shapeFS]),
			grid: twgl.createProgramInfo(this.gl, [gridVS, gridFS]),
			outline: twgl.createProgramInfo(this.gl, [outlineVS, outlineFS]),
		};
		this.vertexBuffer = new Float32Array(
			this.buffer,
			0,
			this.BUFFER_SIZE / 4
		);
		this.colorBuffer = new Float32Array(
			this.buffer,
			this.BUFFER_SIZE,
			this.BUFFER_SIZE / 4
		);
		this.indexBuffer = new Uint16Array(
			this.buffer,
			this.BUFFER_SIZE * 2,
			this.BUFFER_SIZE / 4
		);
		this.centerBuffer = new Float32Array(
			this.buffer,
			this.BUFFER_SIZE * 2.5,
			this.BUFFER_SIZE / 4
		);
		const debugCanvas = document.createElement("canvas");
		debugCanvas.width = 600;
		debugCanvas.height = window.innerHeight;
		debugCanvas.style.position = "fixed";
		debugCanvas.style.top = "10px";
		debugCanvas.style.right = "10px";
		document.body.appendChild(debugCanvas);

		this.debugChart = new PieChart(debugCanvas);
		const updateSegment = this.debugChart.addSegment("update", [
			163 / 255,
			230 / 255,
			53 / 255,
		]);
		updateSegment.addSegment("bhooks", [1, 0, 0]);
		updateSegment.addSegment("ehooks", [0, 0, 1]);
		this.debugChart.addSegment("render", [139 / 255, 92 / 255, 246 / 255]);
		this.debugChart.addSegment("idle", [0.25, 0.25, 0.25]);
		this.init();
	}

	private initBatches() {
		this.batches.set("objects", {
			bufferInfo: null,
			isDirty: true,
			objects: [],
			layer: RenderLayer.OBJECTS,
			drawType: this.gl.TRIANGLES,
			program: this.programs.shape,
			render: true,
		});
		this.batches.set("grid", {
			bufferInfo: null,
			isDirty: true,
			objects: [],
			layer: RenderLayer.GRID,
			drawType: this.gl.TRIANGLE_STRIP,
			program: this.programs.grid,
			render: true,
		});
		this.batches.set("quadtree", {
			bufferInfo: null,
			isDirty: true,
			objects: [],
			layer: RenderLayer.GRID,
			drawType: this.gl.LINES,
			program: this.programs.shape,
			render: false,
		});
		this.batches.set("outlines", {
			bufferInfo: null,
			isDirty: true,
			objects: [],
			layer: RenderLayer.OBJECTS - 0.5, // Render before objects
			drawType: this.gl.TRIANGLES,
			program: this.programs.outline,
			render: true,
		});
	}

	private init() {
		for (const [, program] of window.Object.entries(this.programs)) {
			twgl.setUniforms(program, {
				u_resolution: [this.canvas.width, this.canvas.height],
			});
		}
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		this.gl.clearColor(0, 0, 0, 0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		this.gl.enable(this.gl.BLEND);
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
		this.initBatches();
		Game.initializeIndexPatterns();
	}

	public update() {
		const now = performance.now();
		const dt = now - this.lastTime;
		let steps = 0;

		if (!this.paused || this.#step) this.accumulator += dt;
		this.lastTime = now;

		this.debugChart.resetSegments();

		this.debugChart.measureTime("bhooks", () => {
			for (const hook of this.hooks.update.filter(
				(h) => h.position == "begin"
			)) {
				hook.run();
			}
		});

		this.debugChart.measureTime("update", () => {
			if (!this.#lag)
				while (
					this.accumulator >= this.frameTime &&
					performance.now() - now < this.frameTime
				) {
					for (const object of this.objects) {
						if (object.physics instanceof NullPhysics) continue;
						object.update(1);
						this.quadtree.update(object);
					}
					for (const object of this.objects) {
						object.animate();
					}
					this.accumulator -= this.frameTime;
					steps++;
					this.isDirty = true;
				}
		});

		this.debugChart.measureTime("render", () => {
			this.render(dt);
		});

		this.isDirty = false;
		this.#step = false;
		this.frame++;

		this.debugChart.measureTime("ehooks", () => {
			for (const hook of this.hooks.update.filter(
				(h) => h.position == "end"
			)) {
				hook.run();
			}
		});

		// Update debug chart
		this.debugChart.update("idle", this.frameTime - this.debugChart.total);
		this.debugChart.render();

		requestAnimationFrame(this.update.bind(this));
	}

	private render(deltaTime: number) {
		this.camera.update(deltaTime);
		if (this.mainCharacter) this.camera.follow(this.mainCharacter);
		const bounds = this.camera.visibleBounds;

		const objects = binaryRadixSort(
			this.quadtree
				.retrieve(bounds)
				.filter((object) => !object.destroyed)
				.filter((object) =>
					object.bounds.intersects(this.camera.visibleBounds)
				),
			(object) => object.size
		);

		for (const hook of this.hooks.render.filter(
			(hook) => hook.position == "begin"
		)) {
			hook.run();
		}

		if (!this.paused || this.#step)
			for (const object of objects) {
				object.refresh();
			}

		if (this.isDirty) {
			nonnull(this.batches.get("objects")).objects = objects;
			nonnull(this.batches.get("objects")).isDirty = true;
			nonnull(this.batches.get("outlines")).objects = objects;
			nonnull(this.batches.get("outlines")).isDirty = true;
		}

		const batches = Array.from(this.batches.entries())
			.sort(([, a], [, b]) => a.layer - b.layer)
			.filter(([, batch]) => batch.render);
		const objectBuffer = this.#constructObjectBuffers(objects);

		this.gl.clearColor(0, 0, 0, 0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		for (const [type, batch] of batches) {
			if (batch.isDirty) {
				if (type === "objects") {
					batch.bufferInfo = objectBuffer;
				} else if (type === "outlines") {
					batch.bufferInfo = objectBuffer;
				} else if (type === "grid") {
					batch.bufferInfo = twgl.createBufferInfoFromArrays(
						this.gl,
						{
							a_position: {
								numComponents: 2,
								data: new Float32Array([
									-1, -1, 1, -1, -1, 1, 1, 1,
								]),
							},
						}
					);
				} else if (type == "quadtree") {
					batch.bufferInfo = this.#constructQuadtreeBuffers(
						this.quadtree
					);
				}
				batch.isDirty = false;
			}

			if (batch.bufferInfo) {
				const program = batch.program;
				this.gl.useProgram(program.program);
				const cameraMatrix = this.camera.getTransformationMatrix();

				twgl.setUniforms(program, {
					u_resolution: [this.canvas.width, this.canvas.height],
					u_matrix: cameraMatrix,
					u_time: performance.now() / 1000,
				});

				if (type === "grid") {
					// Auto-calculate appropriate grid size based on zoom
					const gridSize = 40;
					twgl.setUniforms(program, {
						u_gridSize: gridSize,
						u_gridColor: [0.807843137, 0.835294118, 0.850980392, 1],
						u_worldMatrix: mat4.invert(mat4.create(), cameraMatrix),
						u_viewMatrix: cameraMatrix,
					});
				} else if (type === "outlines") {
					twgl.setUniforms(program, {
						u_outline_width: 4.0,
					});
				}

				twgl.setBuffersAndAttributes(
					this.gl,
					program,
					batch.bufferInfo
				);
				twgl.drawBufferInfo(this.gl, batch.bufferInfo, batch.drawType);
			}
		}

		for (const hook of this.hooks.render.filter(
			(hook) => hook.position == "end"
		)) {
			hook.run();
		}
	}

	public pause() {
		this.paused = true;
	}

	public unpause() {
		this.paused = false;
	}

	public step() {
		this.#step = true;
	}

	public lag() {
		this.#lag = true;
	}

	public unlag() {
		this.#lag = false;
	}

	public add(...objects: Entity[]) {
		for (const object of objects) {
			object.behaviors.push(new BoundBehavior(this.bounds));
			object.setProvider(this.provider);
			object.refresh();
			this.quadtree.insert(object);
		}
		this.objects.push(...objects);
		this.isDirty = true;
	}

	public destroy(...objects: Entity[]) {
		for (let i = 0; i < objects.length; i++) {
			objects[i].destroy();
		}
		this.objects = this.objects.filter(
			(object) => !objects.includes(object)
		);
		this.isDirty = true;
	}

	public setMainCharacter(object: Entity) {
		this.mainCharacter = object;
	}

	/**
	 * Constructs buffer information for rendering objects.
	 *
	 * @param {Entity[]} objects - The array of objects to be rendered.
	 * @returns {twgl.BufferInfo} - The buffer information for the objects.
	 */
	#constructObjectBuffers(objects: Entity[]): twgl.BufferInfo {
		// Pre-calculate totals and filter valid objects in single pass

		// Get direct views of the underlying buffers
		const vertexView = this.vertexBuffer;
		const colorView = this.colorBuffer;
		const indexView = this.indexBuffer;
		const centerView = this.centerBuffer;

		let vIdx = 0,
			cIdx = 0,
			iIdx = 0,
			ceIdx = 0;

		for (let i = 0; i < objects.length; i++) {
			const { color, vertices } = objects[i];
			const numVerts = vertices.length;
			const { r, g, b, a } = color.toNormalRGBA();
			let baseVertex = vIdx;

			// 1. Process vertices (2 components per vertex)
			for (let i = 0; i < numVerts; i++) {
				vertexView[vIdx++] = vertices[i][0];
				vertexView[vIdx++] = vertices[i][1];
				colorView[cIdx++] = r;
				colorView[cIdx++] = g;
				colorView[cIdx++] = b;
				colorView[cIdx++] = a;
				centerView[ceIdx++] = vertexView[baseVertex];
				centerView[ceIdx++] = vertexView[baseVertex + 1];
			}

			// 3. Process indices
			baseVertex >>>= 1; // Bitwise division by 2
			const pattern =
				Game.INDEX_PATTERNS.get(numVerts) ||
				this.#generateIndices(numVerts);
			for (let i = 0; i < pattern.length; i++) {
				indexView[iIdx++] = baseVertex + pattern[i];
			}
		}

		return twgl.createBufferInfoFromArrays(this.gl, {
			a_position: {
				numComponents: 2,
				data: vertexView.subarray(0, vIdx),
			},
			a_color: { numComponents: 4, data: colorView.subarray(0, cIdx) },
			a_center: { numComponents: 2, data: centerView.subarray(0, ceIdx) },
			indices: { numComponents: 3, data: indexView.subarray(0, iIdx) },
		});
	}

	#generateIndices(numVerts: number): Uint16Array {
		console.log("cache miss!!!!!!!");
		const indices = new Uint16Array((numVerts - 1) * 3);
		for (let i = 0; i < numVerts - 1; i++) {
			indices[i * 3] = 0;
			indices[i * 3 + 1] = i;
			indices[i * 3 + 2] = i + 1;
		}
		return indices;
	}

	#constructQuadtreeBuffers<T extends Entity>(
		quadtree: Quadtree<T>
	): twgl.BufferInfo {
		const horizontalLines = new Map<
			number,
			{ minX: number; maxX: number }[]
		>();
		const verticalLines = new Map<
			number,
			{ minY: number; maxY: number }[]
		>();
		const lines: [Vertex, Vertex][] = [];

		function addNode(node: Quadtree<T>): void {
			if (!node) return;
			const { x, y, width, height } = node.bounds;

			for (const yPos of [y, y + height]) {
				if (!horizontalLines.has(yPos)) {
					horizontalLines.set(yPos, []);
				}
				horizontalLines.get(yPos)!.push({ minX: x, maxX: x + width });
			}

			for (const xPos of [x, x + width]) {
				if (!verticalLines.has(xPos)) {
					verticalLines.set(xPos, []);
				}
				verticalLines.get(xPos)!.push({ minY: y, maxY: y + height });
			}

			for (const child of node.nodes) {
				addNode(child);
			}
		}

		addNode(quadtree);

		horizontalLines.forEach((segments, y) => {
			segments.sort((a, b) => a.minX - b.minX);
			let current = segments[0];
			for (let i = 1; i < segments.length; i++) {
				if (segments[i].minX <= current.maxX) {
					current.maxX = Math.max(current.maxX, segments[i].maxX);
				} else {
					lines.push([
						[current.minX, y],
						[current.maxX, y],
					]);
					current = segments[i];
				}
			}
			lines.push([
				[current.minX, y],
				[current.maxX, y],
			]);
		});

		verticalLines.forEach((segments, x) => {
			segments.sort((a, b) => a.minY - b.minY);
			let current = segments[0];
			for (let i = 1; i < segments.length; i++) {
				if (segments[i].minY <= current.maxY) {
					current.maxY = Math.max(current.maxY, segments[i].maxY);
				} else {
					lines.push([
						[x, current.minY],
						[x, current.maxY],
					]);
					current = segments[i];
				}
			}
			lines.push([
				[x, current.minY],
				[x, current.maxY],
			]);
		});

		return this.#constructLinesBuffer(lines);
	}

	#constructLinesBuffer(lines: [Vertex, Vertex][]): twgl.BufferInfo {
		const positions: number[] = [];
		const colors: number[] = [];

		for (const line of lines) {
			positions.push(...line.flat(2));
			const color = [0.807843137, 0.835294118, 0.850980392, 1];
			for (let i = 0; i < 2; i++) {
				colors.push(...color);
			}
		}

		const arrays = {
			a_position: { numComponents: 2, data: new Float32Array(positions) },
			a_color: { numComponents: 4, data: new Float32Array(colors) },
		};

		return twgl.createBufferInfoFromArrays(this.gl, arrays);
	}
}
