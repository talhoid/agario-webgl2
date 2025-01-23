import glsl from                   "./glsl";
import path from                     "path";
import { inspect } from               "bun";
import { rm, cp, mkdir } from "fs/promises";
import { exec } from        "child_process";
import { existsSync } from             "fs";

const hex2truecolor = (hex: string) =>
	`\x1b[38;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(
		hex.slice(3, 5),
		16
	)};${parseInt(hex.slice(5, 7), 16)}m`;

if (existsSync(path.resolve("./dist/output.css"))) {
	await Bun.write(
		Bun.file("./copy/output.css"),
		Bun.file("./dist/output.css")
	);
	process.stdout.write(
		`${hex2truecolor(
			"#F59E0B"
		)}[✓]\x1b[39m copied previous output.css to out\r\n`
	);
}

await rm(path.resolve("./dist/"), {
	recursive: true,
	force: true,
});

await mkdir(path.resolve("./dist/"));

await cp(path.resolve("./copy/"), path.resolve("./dist/"), {
    recursive: true,
	force: true,
});

const toBuild = [
	Bun.build({
		entrypoints: ["./index.ts"],
		outdir: "./dist",
		minify: false,
		sourcemap: "linked",
		plugins: [glsl],
	}),
];

const processTailwind = async () => {
	return new Promise((resolve, reject) => {
		exec(
			"bun run tailwindcss -i ./styles/main.css -o ./dist/output.css",
			(error, stdout, stderr) => {
				if (error) {
					reject(stderr || stdout);
				} else {
					resolve(stdout);
				}
			}
		);
	});
};

process.stdout.write(`${hex2truecolor("#F59E0B")}[…]\x1b[39m building`);

const buildPromises = toBuild.map((promise) =>
	promise
		.then((output) => {
			process.stdout.write("\r\x1b[0K");
			if (!output) {
				process.stdout.write(
					`${hex2truecolor("#EF4444")}[\u2A09]\x1b[39m unknown error`
				);
				process.exit(1);
			}

			if (!output.success) {
				throw output.logs;
			}
			process.stdout.write(
				`${hex2truecolor("#84CC16")}[✓]\x1b[39m scripting done!\n`
			);
		})
		.catch((logs: (BuildMessage | ResolveMessage)[]) => {
			process.stdout.write(`${hex2truecolor(
				"#EF4444"
			)}[\u2A09]\x1b[39m error(s) occurred
    ${logs.map((log) => inspect(log))}`);
			process.exit(1);
		})
);

Promise.all(buildPromises).then(async () => {
	try {
		await processTailwind();
		process.stdout.write(
			`${hex2truecolor("#84CC16")}[✓]\x1b[39m css done!\n`
		);
	} catch (error) {
		process.stdout.write(
			`${hex2truecolor("#EF4444")}[\u2A09]\x1b[39m css error: ${error}`
		);
		process.exit(1);
	}
});
