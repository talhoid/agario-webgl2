import type { Byte } from "@/util/byte";

export interface Color extends Uint8Array {
	0: Byte;
	1: Byte;
	2: Byte;
	3: Byte;
	toNormalRGBA(): { r: number; g: number; b: number; a: number };
}

export class RGBAColor extends Uint8Array implements Color {
	0: Byte;
	1: Byte;
	2: Byte;
	3: Byte;
	constructor(r: Byte, g: Byte, b: Byte, a: Byte) {
		super(4);
		this.set([r, g, b, a], 0);
		// Make sure the class uses the correct prototype.
		Object.setPrototypeOf(this, RGBAColor.prototype);
	}

	toNormalRGBA() {
		return {
			r: this[0] / 255,
			g: this[1] / 255,
			b: this[2] / 255,
			a: this[3] / 255,
		};
	}
}
