import { EventEmitter } from "events";

type ListChangeEvent<T> =
	| AddEvent<T>
	| RemoveEvent<T>
	| ReplaceEvent<T>
	| ClearEvent<T>
	| SpliceEvent<T>
	| ReorderEvent<T>
	| FillEvent<T>
	| CopyWithinEvent<T>
	| SetEvent<T>;

interface AddEvent<T> {
	type: "add";
	items: T[];
	index: number;
}

interface RemoveEvent<T> {
	type: "remove";
	items: T[];
	index: number;
}

interface ReplaceEvent<T> {
	type: "replace";
	oldValue: T;
	newValue: T;
	index: number;
}

interface ClearEvent<T> {
	type: "clear";
	removedItems: T[];
}

interface SpliceEvent<T> {
	type: "splice";
	index: number;
	removedItems: T[];
	items: T[];
}

interface ReorderEvent<T> {
	type: "reorder";
	method: "sort" | "reverse";
}

interface FillEvent<T> {
	type: "fill";
	value: T;
	start: number;
	end: number;
	modifiedIndices: number[];
}

interface CopyWithinEvent<T> {
	type: "copyWithin";
	target: number;
	start: number;
	end: number;
	movedItems: T[];
}

interface SetEvent<T> {
	type: "set";
	items: T[];
}

export class DynamicList<T> extends EventEmitter {
	private _items: T[];
	private _proxy: T[];

	constructor(initialItems: T[] = []) {
		super();
		this._items = [...initialItems];
		this._proxy = this.createProxy();
	}
	push = (...items: T[]) => this._proxy.push(...items);
	pop = () => this._proxy.pop();
	shift = () => this._proxy.shift();
	unshift = (...items: T[]) => this._proxy.unshift(...items);
	splice = (start: number, deleteCount?: number, ...items: T[]) =>
		this._proxy.splice(start, deleteCount ?? 0, ...items);
	sort = (compareFn?: (a: T, b: T) => number) => this._proxy.sort(compareFn);
	reverse = () => this._proxy.reverse();
	fill = (value: T, start?: number, end?: number) =>
		this._proxy.fill(value, start, end);
	copyWithin = (target: number, start: number, end?: number) =>
		this._proxy.copyWithin(target, start, end);

	// Proxied array access
	get items(): T[] {
		return this._proxy;
	}

	set items(newItems: T[]) {
		this._items = [...newItems];
		this._proxy = this.createProxy();
		this.emitChange({
			type: "set",
			items: this._items,
		});
	}
	private _sources: DynamicList<T>[] = [];

	concat(other: DynamicList<T>): DynamicList<T> {
		const concatenated = new DynamicList<T>();
		concatenated._sources = [this, other];

		// Initial population
		concatenated._rebuildFromSources();

		// Set up listeners for both sources
		this._setupSourceListeners(concatenated);
		other._setupSourceListeners(concatenated);

		return concatenated;
	}

	private _setupSourceListeners(concatenated: DynamicList<T>) {
		const forwardEvent = (
			source: DynamicList<T>,
			event: ListChangeEvent<T>
		) => {
			const sourceIndex = concatenated._sources.indexOf(source);
			if (sourceIndex === -1) return;

			let offset = 0;
			for (let i = 0; i < sourceIndex; i++) {
				offset += concatenated._sources[i].length;
			}

			this._applySourceEvent(concatenated, event, offset);
		};

		this.on("change", (event) => forwardEvent(this, event));
	}

	private _applySourceEvent(
		target: DynamicList<T>,
		event: ListChangeEvent<T>,
		offset: number
	) {
		switch (event.type) {
			case "add":
				target.splice(offset + event.index, 0, ...event.items);
				break;
			case "remove":
				target.splice(offset + event.index, event.items.length);
				break;
			case "replace":
				target.items[offset + event.index] = event.newValue;
				break;
			case "splice":
				target.splice(
					offset + event.index,
					event.removedItems.length,
					...event.items
				);
				break;
			case "clear":
				target.splice(offset, event.removedItems.length);
				break;
			case "fill":
				target.fill(
					event.value,
					offset + event.start,
					offset + event.end
				);
				break;
			case "copyWithin":
				// Handle complex copyWithin logic
				const adjustedTarget = offset + event.target;
				const adjustedStart = offset + event.start;
				const adjustedEnd = offset + event.end;
				target.copyWithin(adjustedTarget, adjustedStart, adjustedEnd);
				break;
			case "reorder":
				// Full rebuild needed for reordering
				target._rebuildFromSources();
				break;
			case "set":
				// Replace entire section from this source
				target.splice(offset, target.length - offset, ...event.items);
				break;
		}
	}

	private _rebuildFromSources() {
		if (!this._sources.length) return;
		const newItems = this._sources.flatMap((source) => source.items);
		this.splice(0, this.length, ...newItems);
	}

	private createProxy(): T[] {
		return new Proxy(this._items, {
			get: (target, prop) => {
				const value = Reflect.get(target, prop);

				if (typeof value === "function") {
					return (...args: unknown[]) => {
						const prevState = [...target];
						const result = Reflect.apply(value, target, args);

						switch (prop) {
							case "push":
								this.handlePush(result as number, args as T[]);
								break;
							case "pop":
								this.handlePop(
									result as T | undefined,
									prevState
								);
								break;
							case "shift":
								this.handleShift(
									result as T | undefined,
									prevState
								);
								break;
							case "unshift":
								this.handleUnshift(
									result as number,
									args as T[]
								);
								break;
							case "splice":
								this.handleSplice(
									result as T[],
									args,
									prevState
								);
								break;
							case "reverse":
							case "sort":
								this.handleReorder(prop as "reverse" | "sort");
								break;
							case "fill":
								this.handleFill(
									args as [T, number?, number?],
									prevState
								);
								break;
							case "copyWithin":
								this.handleCopyWithin(
									args as [number, number, number?],
									prevState
								);
								break;
						}

						return result;
					};
				}

				return value;
			},

			set: (target, prop, value): boolean => {
				const numericProp = Number(prop);
				if (
					!isNaN(numericProp) &&
					numericProp >= 0 &&
					numericProp < target.length
				) {
					const oldValue = target[numericProp];
					const success = Reflect.set(target, prop, value as T);
					if (success) {
						this.emitChange({
							type: "replace",
							oldValue,
							newValue: value as T,
							index: numericProp,
						});
					}
					return success;
				}
				return false;
			},
		});
	}

	// Mutation handlers
	private handlePush(result: number, args: T[]) {
		this.emitChange({
			type: "add",
			items: args,
			index: result - args.length,
		});
	}

	private handlePop(result: T | undefined, prevState: T[]) {
		if (result !== undefined) {
			this.emitChange({
				type: "remove",
				items: [result],
				index: prevState.length - 1,
			});
		}
	}

	private handleShift(result: T | undefined, prevState: T[]) {
		if (result !== undefined) {
			this.emitChange({
				type: "remove",
				items: [result],
				index: 0,
			});
		}
	}

	private handleUnshift(result: number, args: T[]) {
		this.emitChange({
			type: "add",
			items: args,
			index: 0,
		});
	}

	remove(...items: T[]): T[] {
		const removed: T[] = [];
		const indices: number[] = [];

		// Find all occurrences
		for (const item of items) {
			let index = this._proxy.indexOf(item);
			while (index !== -1) {
				indices.push(index);
				index = this._proxy.indexOf(item, index + 1);
			}
		}

		// Remove from highest index first to prevent shifting
		const uniqueIndices = [...new Set(indices)].sort((a, b) => b - a);
		for (const index of uniqueIndices) {
			const [removedItem] = this._proxy.splice(index, 1);
			removed.push(removedItem);
		}

		// Emit single remove event for all items
		if (removed.length > 0) {
			this.emitChange({
				type: "remove",
				items: removed,
				index: -1, // Indicates multiple indices
			});
		}

		return removed;
	}

	// Improved splice handler to emit remove events
	private handleSplice(removed: T[], args: any[], prevState: T[]) {
		const start = args[0] ?? 0;
		const deleteCount = args[1] ?? 0;
		const items = args.slice(2) as T[];

		this.emitChange({
			type: "splice",
			index: start,
			removedItems: removed,
			items,
		});

		// Also emit individual remove events
		removed.forEach((item, offset) => {
			this.emitChange({
				type: "remove",
				items: [item],
				index: start + offset,
			});
		});
	}

	private handleReorder(method: "reverse" | "sort") {
		this.emitChange({
			type: "reorder",
			method,
		});
	}

	private handleFill(args: [T, number?, number?], prevState: T[]) {
		const [value, start = 0, end = this._items.length] = args;
		const modifiedIndices = Array.from(
			{ length: end - start },
			(_, i) => start + i
		).filter((i) => this._items[i] !== value);

		if (modifiedIndices.length > 0) {
			this.emitChange({
				type: "fill",
				value,
				start,
				end,
				modifiedIndices,
			});
		}
	}

	private handleCopyWithin(args: [number, number, number?], prevState: T[]) {
		const [target, start, end = this._items.length] = args;
		const movedItems = prevState.slice(start, end);

		this.emitChange({
			type: "copyWithin",
			target,
			start,
			end,
			movedItems,
		});
	}

	// Event emission
	private emitChange(event: ListChangeEvent<T>) {
		this.emit("change", event);
		this.emit(event.type, event);
	}

	// Type-safe event listeners
	on(event: "change", listener: (event: ListChangeEvent<T>) => void): this;
	on(event: "add", listener: (event: AddEvent<T>) => void): this;
	on(event: "remove", listener: (event: RemoveEvent<T>) => void): this;
	on(event: "replace", listener: (event: ReplaceEvent<T>) => void): this;
	on(event: "clear", listener: (event: ClearEvent<T>) => void): this;
	on(event: "splice", listener: (event: SpliceEvent<T>) => void): this;
	on(event: "reorder", listener: (event: ReorderEvent<T>) => void): this;
	on(event: "fill", listener: (event: FillEvent<T>) => void): this;
	on(
		event: "copyWithin",
		listener: (event: CopyWithinEvent<T>) => void
	): this;
	on(event: "set", listener: (event: SetEvent<T>) => void): this;
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	// Utility methods
	clear(): void {
		const removed = [...this._items];
		this._items = [];
		this._proxy = this.createProxy();
		this.emitChange({
			type: "clear",
			removedItems: removed,
		});
	}

	replaceAll(items: T[]): void {
		this.items = items;
	}

	clone(): DynamicList<T> {
		return new DynamicList([...this._items]);
	}

	get length() {
		return this._items.length;
	}
	at(index: number) {
		return this._items.at(index);
	}
	find(predicate: (value: T, index: number, obj: T[]) => unknown) {
		return this._items.find(predicate);
	}
	filter(predicate: (value: T, index: number, array: T[]) => boolean) {
		return this._items.filter(predicate);
	}
	map<U>(callback: (value: T, index: number, array: T[]) => U) {
		return this._items.map(callback);
	}
	reduce<U>(
		callback: (accumulator: U, value: T, index: number, array: T[]) => U,
		initialValue: U
	) {
		return this._items.reduce(callback, initialValue);
	}
	some(predicate: (value: T, index: number, array: T[]) => unknown) {
		return this._items.some(predicate);
	}
	every(predicate: (value: T, index: number, array: T[]) => unknown) {
		return this._items.every(predicate);
	}
	indexOf(searchElement: T, fromIndex?: number) {
		return this._items.indexOf(searchElement, fromIndex);
	}
	lastIndexOf(searchElement: T, fromIndex?: number) {
		return this._items.lastIndexOf(searchElement, fromIndex);
	}
	includes(searchElement: T, fromIndex?: number) {
		return this._items.includes(searchElement, fromIndex);
	}

	// Iteration
	[Symbol.iterator](): IterableIterator<T> {
		return this._items[Symbol.iterator]();
	}
}
