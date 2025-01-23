import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";


/**
 * Align all imports in the specified file.
 * @param {string} filePath - The path to the file to align imports.
 */
function alignImports(filePath) {
	const fileContent = fs.readFileSync(filePath, "utf8");

	const importRegex =
		/^import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"]);?$/gm;
	const imports = [...fileContent.matchAll(importRegex)];

	if (imports.length === 0) {
		console.log(`No imports found in the file: ${filePath}`);
		return;
	}

	// Extract and format parts of each import.
	const importParts = imports.map(([full, name, what, how, where]) => {
		const beforeFrom = full.split("from")[0].trim();
		return {
            realFull: full,
			full: `${beforeFrom} from "${where}";`,
			beforeFrom: `${beforeFrom} from`,
			modulePath: `"${where}"`,
		};
	});

	// Find the maximum length of `full` to align without excessive padding.
	const maxLength = Math.max(
		...importParts.map((part) => part.full.length)
	);

	// Rebuild the imports with padding for alignment.
	const alignedImports = importParts.map((part) => {
		const padding = " ".repeat(
			Math.max(0, maxLength - part.full.length)
		);
		return `${part.beforeFrom}${padding} ${part.modulePath};`;
	});

	// Replace the original imports with aligned ones in the file content.
	let alignedContent = fileContent;
	importParts.forEach((part, index) => {
		alignedContent = alignedContent.replace(
			part.realFull,
			alignedImports[index]
		);
	});

	// Write the updated content back to the file.
	fs.writeFileSync(filePath, alignedContent, "utf8");
	console.log(`Imports in '${filePath}' have been aligned!`);
}

/**
 * Align imports for all files matching a glob pattern.
 * Excludes files in hidden folders by default.
 * @param {string} pattern - The glob pattern to match files.
 */
function alignImportsGlob(pattern) {
	const files = glob.sync(pattern, {
		dot: false,
		ignore: ["node_modules/**"],
	}); // Exclude hidden files and folders

	if (files.length === 0) {
		console.error("No files matched the specified pattern.");
		return;
	}

	files.forEach((file) => {
		try {
			alignImports(file);
		} catch (error) {
			console.error(`Error processing file '${file}':`, error);
		}
	});
}

// Example usage:
const pattern = process.argv[2];
if (!pattern) {
	console.error("Please specify a glob pattern to align imports.");
	process.exit(1);
}

alignImportsGlob(pattern);
