declare module "*.glsl" {
	const content: string;
	export default content;
}

declare module "*.mp3" {
	const url: string;
	export default url;
}
interface Performance extends Performance {
	memory?: {
		/** The maximum size of the heap, in bytes, that is available to the context. */
		jsHeapSizeLimit: number;
		/** The total allocated heap size, in bytes. */
		totalJSHeapSize: number;
		/** The currently active segment of JS heap, in bytes. */
		usedJSHeapSize: number;
	};
}

type Unwrap<T> = {
	[K in keyof T]: T[K];
} & unknown;

declare module "spectorjs" {
	class Spector {
		constructor();
		public displayUI(): void;
	}
}
// interface Window extends Window {
// 	render?: number[];
// 	alternativeRender?: number;
// }

type SelectorElement = keyof HTMLElementTagNameMap;
type SelectorClass = `.${string}`;
type SelectorId = `#${string}`;
type SelectorAttribute = `[${string}]`;

type ModifierCombinationBase =
	| `${SelectorClass}`
	| `${SelectorId}`
	| `${SelectorAttribute}`;
type ModifierCombination =
	| ModifierCombinationBase
	| `${SelectorClass}${SelectorId}`
	| `${SelectorClass}${SelectorAttribute}`
	| `${SelectorId}${SelectorAttribute}`;

type QuerySelector =
	| SelectorElement
	| `${SelectorElement}${ModifierCombinationBase}`;

type ExtractElement<T extends QuerySelector> =
	T extends `${infer E extends SelectorElement}${ModifierCombinationBase}`
		? E
		: T;

interface ParentNode extends ParentNode {
	querySelector<K extends QuerySelector>(
		selectors: K
	):
		| (K extends SelectorElement
				? HTMLElementTagNameMap[K]
				: HTMLElementTagNameMap[ExtractElement<K>])
		| null;

	querySelectorAll<K extends QuerySelector>(
		selectors: K
	): NodeListOf<
		K extends SelectorElement
			? HTMLElementTagNameMap[K]
			: HTMLElementTagNameMap[ExtractElement<K>]
	>;
}

declare global {
	interface ProxyConstructor {
		new <TSource extends object, TTarget extends object>(
			target: TSource,
			handler: ProxyHandler<TSource>
		): TTarget;
	}
}
