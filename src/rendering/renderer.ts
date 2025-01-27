import type { mat4 } from "gl-matrix";
import * as twgl from "twgl.js";

export interface RenderCommand {
	programInfo: twgl.ProgramInfo;
	buffers: twgl.BufferInfo;
	uniforms: Record<string, any>;
	drawType: GLenum;
	setup?: (gl: WebGL2RenderingContext) => void;
	teardown?: (gl: WebGL2RenderingContext) => void;
}

export class Renderer {
	public readonly gl: WebGL2RenderingContext;
	private canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const ctx = canvas.getContext("webgl2");
		if (!ctx) throw new Error("WebGL2 unavailable");
		this.gl = ctx;
		this.initializeWebGLState();
	}

	private initializeWebGLState(): void {
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		this.gl.clearColor(0, 0, 0, 0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		this.gl.enable(this.gl.BLEND);
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
		// this.gl.enable(this.gl.DEPTH_TEST);
		// this.gl.depthFunc(this.gl.LEQUAL);
	}

	execute(commands: RenderCommand[], matrix: mat4): void {
		const resolution = [this.canvas.width, this.canvas.height];
		const gl = this.gl;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(this.gl.COLOR_BUFFER_BIT);
		for (const command of commands) {
			this.validateCommand(command);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, this.canvas.width, this.canvas.height);

			command.setup?.(gl);

			// Merge global uniforms with command-specific uniforms
			gl.useProgram(command.programInfo.program);
			twgl.setUniforms(command.programInfo, {
				u_resolution: resolution,
				u_matrix: matrix,
				u_time: performance.now() / 1000,
			});
			twgl.setUniforms(command.programInfo, command.uniforms);

			twgl.setBuffersAndAttributes(
				gl,
				command.programInfo,
				command.buffers
			);
			this.drawCommand(command);
			command.teardown?.(gl);
		}
	}

	private validateCommand(command: RenderCommand): void {
		if (!command.buffers) {
			throw new Error(
				`Render command missing buffers for program: ${command.programInfo.program}`
			);
		}
	}

	private drawCommand(command: RenderCommand): void {
		twgl.drawBufferInfo(this.gl, command.buffers, command.drawType);
	}
}
