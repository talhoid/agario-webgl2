// grid-system.ts
import * as twgl from "twgl.js";
import { mat4 } from "gl-matrix";
import gridVS from "@/shaders/grid/vertex.glsl";
import gridFS from "@/shaders/grid/fragment.glsl";
import gridDSVS from "@/shaders/grid/downsample.vertex.glsl";
import gridDSFS from "@/shaders/grid/downsample.fragment.glsl";
import type { RenderCommand } from "./renderer";

export class Grid {
	private readonly fbo: WebGLFramebuffer;
	private readonly texture: WebGLTexture;
	private readonly mainProgram: twgl.ProgramInfo;
	private readonly postProgram: twgl.ProgramInfo;
	private readonly scale: number = 4;

	constructor(private readonly gl: WebGL2RenderingContext) {
		// Initialize WebGL resources
		this.fbo = this.gl.createFramebuffer();
		this.texture = this.gl.createTexture();
		this.mainProgram = twgl.createProgramInfo(this.gl, [gridVS, gridFS]);
		this.postProgram = twgl.createProgramInfo(this.gl, [
			gridDSVS,
			gridDSFS,
		]);

		// Setup framebuffer
		this.initFramebuffer();
	}

	public getCommands(camera: mat4): RenderCommand[] {
		return [this.createGridCommand(camera), this.createPostCommand()];
	}

	private createGridCommand(camera: mat4): RenderCommand {
		return {
			programInfo: this.mainProgram,
			buffers: this.createFullscreenQuad(),
			uniforms: {
				u_worldMatrix: mat4.invert(mat4.create(), camera),
				u_gridSize: 40,
				u_gridColor: [0.807843137, 0.835294118, 0.850980392, 1],
			},
			drawType: this.gl.TRIANGLE_STRIP,
			setup: (gl) => {
				gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
				gl.viewport(
					0,
					0,
					gl.canvas.width * this.scale,
					gl.canvas.height * this.scale
				);

				// Clear the framebuffer
				gl.clearColor(0, 0, 0, 0); // Clear to transparent black
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // Clear color and depth buffers
			},
		};
	}

	private createPostCommand(): RenderCommand {
		return {
			programInfo: this.postProgram,
			buffers: this.createFullscreenQuad(),
			uniforms: {
				u_texture: this.texture,
				u_texelSize: [
					1 / (this.gl.canvas.width * this.scale),
					1 / (this.gl.canvas.height * this.scale),
				],
			},
			drawType: this.gl.TRIANGLE_STRIP,
		};
	}

	private createFullscreenQuad(): twgl.BufferInfo {
		return twgl.createBufferInfoFromArrays(this.gl, {
			a_position: {
				numComponents: 2,
				data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
			},
		});
	}

	private initFramebuffer(): void {
		const gl = this.gl;

		// Configure texture
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.canvas.width * this.scale,
			gl.canvas.height * this.scale,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		// Configure framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.texture,
			0
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
}
