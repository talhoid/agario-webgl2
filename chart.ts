import * as twgl from "twgl.js";
import pieFS from "@/shaders/pie/fragment.glsl";
import pieVS from "@/shaders/pie/vertex.glsl";

type Color = [number, number, number];

// function averageColorsWithWeights(colors: Color[], weights: number[]): Color {
// 	if (colors.length !== weights.length) {
// 		throw new Error("The number of colors and weights must match.");
// 	}

// 	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
// 	if (totalWeight === 0) {
// 		throw new Error("The sum of weights must not be zero.");
// 	}

// 	const weightedSum: Color = colors.reduce(
// 		(acc, color, index) => {
// 			const weight = weights[index];
// 			return [
// 				acc[0] + color[0] * weight,
// 				acc[1] + color[1] * weight,
// 				acc[2] + color[2] * weight,
// 			];
// 		},
// 		[0, 0, 0]
// 	);

// 	return [
// 		weightedSum[0] / totalWeight,
// 		weightedSum[1] / totalWeight,
// 		weightedSum[2] / totalWeight,
// 	];
// }

class Segment {
	public name: string = "";
	public color: Color = [0, 0, 0];
	public radius: number = 1;
	public parent: Segment | null = null;
	public children: Segment[] = []; // Track child segments
	public value = 0;
	public nested: boolean = false;
	public level = -1;

	addSegment(name: string, color: [number, number, number]) {
		const child = new Segment();
		child.nested = this.level !== -1;
		child.level = this.level + 1;
		child.radius = child.nested ? this.radius * 0.9 : this.radius;
		child.color = color;
		child.name = child.nested ? `${this.name}.${name}` : name;
		child.parent = this;
		this.children.push(child); // Add to children list
		return child;
	}

	getChildSegments(): Segment[] {
		let children: Segment[] = [];
		for (const child of this.children) {
			children.push(child);
			children = children.concat(child.getChildSegments());
		}
		return children;
	}
}

export class PieChart {
	private gl: WebGL2RenderingContext;
	private program: twgl.ProgramInfo;
	private buffer: twgl.BufferInfo;
	private glCanvas: OffscreenCanvas;
	private textCanvas: OffscreenCanvas;
	private ctx: OffscreenCanvasRenderingContext2D;
	private displayCanvas: HTMLCanvasElement;
	private scale: [number, number] = [1.0, 1.5];
	private padding: [number, number] = [24, 24];
	private rootSegment = new Segment();

	constructor(canvas: HTMLCanvasElement) {
		this.displayCanvas = canvas;
		this.glCanvas = new OffscreenCanvas(canvas.width, canvas.width);
		this.textCanvas = new OffscreenCanvas(canvas.width, canvas.height);

		this.gl = this.glCanvas.getContext("webgl2")!;
		this.program = twgl.createProgramInfo(this.gl, [pieVS, pieFS]);
		this.buffer = twgl.createBufferInfoFromArrays(this.gl, {
			position: {
				data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
				numComponents: 2,
			},
		});

		this.gl.enable(this.gl.DEPTH_TEST);
		this.gl.enable(this.gl.BLEND);

		this.ctx = this.textCanvas.getContext("2d")!;
		this.ctx.textAlign = "center";
		this.ctx.textBaseline = "middle";
		this.ctx.font = "12px monospace";
	}

	private drawAnnotation(
		name: string,
		value: number,
		startAngle: number,
		endAngle: number
	) {
		const midAngle = (startAngle + endAngle) / 2;
		const radius = 0.7; // Slightly inside the pie

		// Calculate position on arc
		let x =
			this.glCanvas.width / 2 +
			(Math.cos(midAngle) * radius * this.glCanvas.width) / 3;
		// x *= this.scale[0];
		let y =
			this.glCanvas.height / 2 +
			(Math.sin(midAngle) * -radius * this.glCanvas.height) / 3;
		// y *= this.scale[1];

		const percentage =
			value / this.segments.reduce((c, a) => a.value + c, 0);
		// Draw text

		this.ctx.fillStyle = "white";
		this.ctx.fillText(
			`${name}: ${value.toFixed(3)}ms (${(percentage * 100).toFixed(
				3
			)}%)`,
			x,
			y
		);
	}

	private drawList() {
		const total = this.segments.reduce((c, a) => a.value + c, 0);
		const items = this.segments.map(
			(segment) =>
				`${segment.name.split(".").at(-1)}: ${segment.value.toFixed(3)}ms (${(
					(segment.value * 100) /
					total
				).toFixed(3)}%)`
		);
		const heights = items.map((item) => {
			const measure = this.ctx.measureText(item);
			return (
				measure.actualBoundingBoxAscent +
				measure.actualBoundingBoxDescent
			);
		});
		this.ctx.save();
		this.ctx.textAlign = "start";
		let currentHeight = 0;
		// const color = averageColorsWithWeights(
		// 	this.segments.map((segment) => segment.color),
		// 	this.segments.map((segment) => segment.value)
		// );
		// const hexColor = color
		// 	.map((component) => component * 255)
		// 	.map((component) =>
		// 		Math.round(component).toString(16).padStart(2, "0")
		// 	)
		// 	.join("");
		const maximumColor = this.segments
			.toSorted((a, b) => b.value - a.value)[0]
			.color.map((component) => component * 255)
			.map((component) =>
				Math.round(component).toString(16).padStart(2, "0")
			)
			.join("");
		const gradient = this.ctx.createLinearGradient(
			0,
			0,
			this.glCanvas.width,
			0
		);
		let run = 0;
		for (const segment of this.segments) {
			const hexColor = `#${segment.color
				.map((component) => component * 255)
				.map((component) =>
					Math.round(component).toString(16).padStart(2, "0")
				)
				.join("")}`;
			gradient.addColorStop(run, hexColor);
			run += Math.min(0.5, (segment.value * 0.5) / total);
			gradient.addColorStop(run, hexColor);
		}
		gradient.addColorStop(run, `#${maximumColor}`);
		gradient.addColorStop(1.0, `#${maximumColor}`);
		this.ctx.fillStyle = gradient;
		this.ctx.fillRect(
			0,
			this.glCanvas.height,
			this.glCanvas.width,
			heights.reduce((a, b) => a + b, 0) + this.padding[1] * 2
		);
		this.ctx.fillStyle = `#fff`;
		for (const [i, item] of items.entries()) {
			this.ctx.fillText(
				item,
				this.segments[i].level * 16 + this.padding[0],
				this.glCanvas.height +
					heights[i] +
					currentHeight +
					this.padding[1]
			);
			currentHeight += heights[i];
		}
		this.ctx.restore();
	}

	measureTime(name: string, fn: () => void) {
		const start = performance.now();
		fn();
		this.update(name, performance.now() - start);
	}

	get total() {
		return this.segments.reduce((a, b) => a + b.value, 0);
	}

	get segments() {
		return this.rootSegment.getChildSegments();
	}

	resetSegments() {
		for (const segment of this.segments) {
			segment.value = 0;
		}
	}

	addSegment(name: string, color: [number, number, number]) {
		return this.rootSegment.addSegment(name, color);
	}

	update(name: string, value: number) {
		const segment = this.segments.find((s) => s.name === name);
		if (segment) segment.value = Math.max(0, value);
	}

	render() {
		this.gl.useProgram(this.program.program);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		this.ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);

		const total = this.segments.reduce(
			(sum, s) => sum + (s.nested ? 0 : s.value),
			0
		);
		const parsedSegments: {
			label: string;
			startAngle: number;
			endAngle: number;
			color: [number, number, number, number];
			radius: number;
			nested: boolean;
			value: number;
		}[] = [];
		let angle = Math.PI * 2;

		// Prepare segment data for non-nested segments
		for (const segment of this.segments) {
			if (segment.nested) continue;
			const portion = segment.value / total;
			parsedSegments.push({
				label: segment.name,
				startAngle: angle - portion * Math.PI * 2,
				endAngle: angle,
				color: [...segment.color, 1.0],
				radius: segment.radius,
				nested: segment.nested,
				value: segment.value,
			});
			angle -= portion * Math.PI * 2;
		}

		// Prepare data for nested segments
		for (const segment of this.segments.filter(
			(segment) => segment.nested
		)) {
			if (!segment.parent) {
				console.warn("Nested segment missing parent, skipping.");
				continue;
			}
			const parent = segment.parent;
			const parentSegment = parsedSegments.find(
				(s) => s.label == parent.name
			);
			const parentStart = parentSegment?.startAngle || 0;
			const parentEnd = parentSegment?.endAngle || 0;
			const parentRange = parentEnd - parentStart;

			const portion = segment.value / parent.value;
			parsedSegments.push({
				label: segment.name,
				startAngle: parentStart,
				endAngle: parentStart + portion * parentRange,
				color: [...segment.color, 1.0],
				radius: segment.radius,
				nested: segment.nested,
				value: segment.value,
			});
		}
		const segmentData: {
			startAngle: number;
			endAngle: number;
			color: [number, number, number, number];
			radius: number;
			nested: boolean;
		}[] = parsedSegments.map(
			({ startAngle, endAngle, color, radius, nested }) => ({
				startAngle,
				endAngle,
				color,
				radius,
				nested,
			})
		);
		// Pad remaining space in the struct array
		while (segmentData.length < 16) {
			segmentData.push({
				startAngle: 0,
				endAngle: 0,
				color: [0, 0, 0, 0],
				radius: 1,
				nested: false,
			});
		}

		// Set uniforms
		twgl.setUniforms(this.program, {
			u_total: this.segments.length,
			u_radius: 0.9,
			u_scale: this.scale,
			u_depth: 0.24,
			u_segments: segmentData,
			u_layerSize: 0.01,
		});

		// Render the pie chart
		twgl.setBuffersAndAttributes(this.gl, this.program, this.buffer);
		twgl.drawBufferInfo(this.gl, this.buffer, this.gl.TRIANGLE_STRIP);

		// Draw text annotations
		for (const segment of parsedSegments) {
			this.drawAnnotation(
				segment.label,
				segment.value,
				segment.startAngle,
				segment.endAngle
			);
		}

		this.drawList();

		// Transfer rendered content to display canvas
		const ctx = this.displayCanvas.getContext("2d")!;
		ctx.clearRect(
			0,
			0,
			this.displayCanvas.width,
			this.displayCanvas.height
		);

		const glImage = this.glCanvas.transferToImageBitmap();
		ctx.drawImage(glImage, 0, 0);
		glImage.close();

		const textImage = this.textCanvas.transferToImageBitmap();
		ctx.drawImage(textImage, 0, 0);
		textImage.close();
	}
}
