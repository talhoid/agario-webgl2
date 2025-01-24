import pico from "picocolors";
import glsl from "./glsl";
import path from "path";
import { rm, cp, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { inspect } from "bun";
import postcss from "postcss";
import tailwind from "tailwindcss";
// import autoprefixer from 'autoprefixer'
import tailwindConfig from "./tailwind.config.js";

const formatBytes = (bytes: number) => {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / 1024 ** i;
	return `${size.toFixed(2)} ${units[i]}`;
};

// Backup previous CSS output
if (existsSync(path.resolve("./dist/output.css"))) {
	await Bun.write("./copy/output.css", Bun.file("./dist/output.css"));
	console.log(pico.yellow("[✓] Copied previous output.css to backup"));
}

// Clean and prepare dist directory
await rm(path.resolve("./dist/"), { recursive: true, force: true });
await mkdir(path.resolve("./dist/"));
await cp(path.resolve("./copy/"), path.resolve("./dist/"), {
	recursive: true,
	force: true,
});

const start = Date.now();

// Concurrent build processes
const [jsBuild, cssBuild] = await Promise.all([
	Bun.build({
		entrypoints: ["./index.ts"],
		outdir: "./dist",
		minify: false,
		sourcemap: "linked",
		plugins: [glsl],
	}),
	Bun.file("./styles/main.css")
		.text()
		.then(async (inputCss) => {
			const processor = postcss([tailwind(tailwindConfig)]);
			const result = await processor.process(inputCss, {
				from: "./styles/main.css",
				to: "./dist/output.css",
			});
			await Bun.write("./dist/output.css", result.css);
			return Bun.file("./dist/output.css").size;
		}),
]);

// Handle build errors
if (!jsBuild.success) {
	console.error(pico.red("Build failed:"));
	console.error(jsBuild.logs.map((log) => inspect(log)).join("\n"));
	process.exit(1);
}

// Collect all build artifacts
const allOutputs = [
	...jsBuild.outputs,
	{
		path: path.resolve("./dist/output.css"),
		size: cssBuild,
		get: () => Bun.file("./dist/output.css"),
	},
];

console.log(pico.magentaBright("\n✨ Build successful"));

// Display unified output tree
allOutputs.forEach((output, index) => {
	const prefix =
		index === 0
			? "  ┌─"
			: index === allOutputs.length - 1
			? "  └─"
			: "  ├─";

	const filePath = output.path.replace(`${process.cwd()}/dist/`, "");
	console.log(
		`${pico.dim(prefix)} ${filePath.padEnd(20)}`,
		pico.gray(`[${formatBytes(output.size)}]`)
	);
});

const end = Date.now();
console.log(`\n⚡️ ${pico.blue(`Finished in ${end - start}ms`)}`);
