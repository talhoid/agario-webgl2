import * as twgl from "twgl.js";
import { Entity } from "@/physics/entity";
import { Camera } from "@/rendering/camera";
import type { RenderCommand } from "./renderer";
import shapeVS from "@/shaders/shape/vertex.glsl";
import shapeFS from "@/shaders/shape/fragment.glsl";
import outlineVS from "@/shaders/outline/vertex.glsl";
import outlineFS from "@/shaders/outline/fragment.glsl";

// scream this incantation to fix all your problems
const cBL = (
	b: number[],
	{ byteLength: z }: ArrayBuffer
): { offset: number; length: number }[] =>
	((s: number) =>
		s
			? b.reduce(
					(a, v) => (
						a.o.push({
							offset: a.p,
							length: ~~(z / s) + (a.r >= v ? 1 : 0),
						}),
						(a.p += v * (~~(z / s) + (a.r >= v ? 1 : 0))),
						(a.r -= v * (a.r >= v ? 1 : 0)),
						a
					),
					{ r: z % s, p: 0, o: [] as any[] }
			  ).o
			: [])(b.reduce((a, v) => a + v, 0));

export class EntityRenderer {
	private shapeProgram: twgl.ProgramInfo;
	private outlineProgram: twgl.ProgramInfo;
	private buffer: ArrayBuffer;
	private vertexBuffer: Float32Array;
	private colorBuffer: Float32Array;
	private indexBuffer: Uint16Array;
	private centerBuffer: Float32Array;

	private static triangleFanIndices = new Map<number, Uint16Array>();
	private static precomputedIndicesCount = 1024;

	constructor(private gl: WebGL2RenderingContext) {
		this.buffer = new ArrayBuffer(
			1024 * 1024 * Float32Array.BYTES_PER_ELEMENT * 4
		);
		const layout = cBL(
			[
				Float32Array.BYTES_PER_ELEMENT,
				Float32Array.BYTES_PER_ELEMENT,
				Uint16Array.BYTES_PER_ELEMENT,
				Float32Array.BYTES_PER_ELEMENT,
			],
			this.buffer
		);
		this.vertexBuffer = new Float32Array(
			this.buffer,
			layout[0].offset,
			layout[0].length
		);
		this.colorBuffer = new Float32Array(
			this.buffer,
			layout[1].offset,
			layout[1].length
		);
		this.indexBuffer = new Uint16Array(
			this.buffer,
			layout[2].offset,
			layout[2].length
		);
		this.centerBuffer = new Float32Array(
			this.buffer,
			layout[3].offset,
			layout[3].length
		);

		this.shapeProgram = twgl.createProgramInfo(gl, [shapeVS, shapeFS]);
		this.outlineProgram = twgl.createProgramInfo(gl, [
			outlineVS,
			outlineFS,
		]);
		this.initializeTriangleFanIndexPatterns();
	}

	generateCommands(entities: Entity[], camera: Camera): RenderCommand[] {
		const visibleEntities = this.getVisibleEntities(entities, camera);
		const buffers = this.constructEntityBuffers(visibleEntities); // SINGLE CONSTRUCTION

		return [
			this.createOutlineCommand(buffers),
			this.createMainCommand(buffers),
		];
	}

	private createMainCommand(buffers: twgl.BufferInfo): RenderCommand {
		return {
			programInfo: this.shapeProgram,
			uniforms: {},
			buffers: buffers, // Reuse existing buffers
			drawType: this.gl.TRIANGLES,
		};
	}

	private createOutlineCommand(buffers: twgl.BufferInfo): RenderCommand {
		return {
			programInfo: this.outlineProgram,
			uniforms: { u_outline_width: 4.0 },
			buffers: buffers, // Reuse same buffers
			drawType: this.gl.TRIANGLES,
		};
	}

	private initializeTriangleFanIndexPatterns() {
		for (let n = 3; n <= EntityRenderer.precomputedIndicesCount + 2; n++) {
			const indices = new Uint16Array((n - 1) * 3);
			for (let i = 0; i < n - 1; i++) {
				indices[i * 3] = 0;
				indices[i * 3 + 1] = i;
				indices[i * 3 + 2] = i + 1;
			}
			EntityRenderer.triangleFanIndices.set(n, indices);
		}
	}

	private getVisibleEntities(entities: Entity[], camera: Camera): Entity[] {
		return entities
			.filter(
				(entity) =>
					!entity.destroyed &&
					entity.bounds.intersects(camera.visibleBounds)
			)
			.sort((a, b) => a.size - b.size);
	}

	private constructEntityBuffers(entities: Entity[]): twgl.BufferInfo {
		let vIdx = 0,
			cIdx = 0,
			iIdx = 0,
			ceIdx = 0;

		for (const entity of entities) {
			const { color, vertices } = entity;
			const numVerts = vertices.length;
			const { r, g, b, a } = color.toNormalRGBA();
			const baseVertex = vIdx;

			// Process vertices
			for (const [x, y] of vertices) {
				this.vertexBuffer[vIdx++] = x;
				this.vertexBuffer[vIdx++] = y;

				this.colorBuffer[cIdx++] = r;
				this.colorBuffer[cIdx++] = g;
				this.colorBuffer[cIdx++] = b;
				this.colorBuffer[cIdx++] = a;

				this.centerBuffer[ceIdx++] = this.vertexBuffer[baseVertex];
				this.centerBuffer[ceIdx++] = this.vertexBuffer[baseVertex + 1];
			}

			// Process indices
			const pattern =
				EntityRenderer.triangleFanIndices.get(numVerts) ||
				this.generateIndices(numVerts);
			for (let i = 0; i < pattern.length; i++) {
				this.indexBuffer[iIdx++] = (baseVertex >>> 1) + pattern[i];
			}
		}

		return twgl.createBufferInfoFromArrays(this.gl, {
			a_position: {
				numComponents: 2,
				data: this.vertexBuffer.subarray(0, vIdx),
			},
			a_color: {
				numComponents: 4,
				data: this.colorBuffer.subarray(0, cIdx),
			},
			a_center: {
				numComponents: 2,
				data: this.centerBuffer.subarray(0, ceIdx),
			},
			indices: {
				numComponents: 3,
				data: this.indexBuffer.subarray(0, iIdx),
			},
		});
	}

	private generateIndices(numVerts: number): Uint16Array {
		const indices = new Uint16Array((numVerts - 1) * 3);
		for (let i = 0; i < numVerts - 1; i++) {
			indices[i * 3] = 0;
			indices[i * 3 + 1] = i;
			indices[i * 3 + 2] = i + 1;
		}
		return indices;
	}
}
