import { Vector, VectorPool } from "@/geometry/vector";

export interface Physics {
	position: Vector;
	velocity: Vector;
	acceleration: Vector;
	update(deltaTime: number): void;
	accelerate(acceleration: Vector): void;
}

export class VerletPhysics implements Physics {
	acceleration: Vector = VectorPool.acquire();
	#position: Vector = VectorPool.acquire();
	private lastPosition: Vector = VectorPool.acquire();
	private lastDeltaTime: number = 1;
	private uninitialized: boolean = true;

	set position(position: Vector) {
		if (this.uninitialized) {
			this.lastPosition = position;
			this.uninitialized = false;
		} else {
			// this.lastPosition = position.subtract(this.velocity);
		}
		this.#position = position;
	}

	get position() {
		return this.#position;
	}

	get velocity() {
		return this.#position
			.subtract(this.lastPosition)
			.scale(1 / this.lastDeltaTime);
	}

	set velocity(value: Vector) {
		this.lastPosition = this.#position.subtract(
			value.scale(this.lastDeltaTime)
		);
	}

	update(deltaTime: number) {
		if (this.uninitialized) {
			this.lastDeltaTime = deltaTime;
			this.uninitialized = false;
		}
		const nextPosition = this.#position
			.add(
				this.#position
					.subtract(this.lastPosition)
					.scale(deltaTime / this.lastDeltaTime)
			)
			.add(
				this.acceleration
					.scale((deltaTime + this.lastDeltaTime) / 2)
					.scale(deltaTime)
			);

        // VectorPool.release(this.lastPosition);
		this.lastPosition = this.#position;
        // VectorPool.release(this.#position);
		this.#position = nextPosition;
		this.lastDeltaTime = deltaTime;
		this.acceleration.set(0, 0);
	}

	accelerate(a: Vector) {
		this.acceleration = this.acceleration.add(a);
	}
}

export class NullPhysics implements Physics {
	position: Vector = VectorPool.acquire();
	velocity: Vector = VectorPool.acquire();
	acceleration: Vector = VectorPool.acquire();

	update(_deltaTime: number) {}

	accelerate(_a: Vector) {}
}
