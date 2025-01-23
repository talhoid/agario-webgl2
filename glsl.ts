import { type BunPlugin } from "bun";

export default {
	name: "glsl shader loader",
	async setup(build) {
		build.onLoad({ filter: /\.glsl$/ }, async ({ path }) => {
			const file = await Bun.file(path).text();
			const contents = file;

			return {
				contents,
				loader: "text",
			};
		});
	},
} as BunPlugin;
