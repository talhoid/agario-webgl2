import type { Behavior } from                 "./behavior";
import type { Rectangular } from "@/geometry/rectangle";
import type { Entity } from          "@/physics/entity";


export class BoundBehavior implements Behavior {
    // private restitution = 0.1;
    constructor(private bounds: Rectangular) { }

    animate(object: Entity) {
        if (object.position.x < this.bounds.x) {
            object.position.x = this.bounds.x;
            // object.physics.velocity = object.physics.velocity
            //     .scaleX(this.restitution)
            //     .flipX();
        } else if (object.position.x > this.bounds.x + this.bounds.width) {
            object.position.x = this.bounds.x + this.bounds.width;
            // object.physics.velocity = object.physics.velocity
            //     .scaleX(this.restitution)
            //     .flipX();
        }

        if (object.position.y < this.bounds.y) {
            object.position.y = this.bounds.y;
            // object.physics.velocity = object.physics.velocity
            //     .scaleY(this.restitution)
            //     .flipY();
        } else if (object.position.y > this.bounds.y + this.bounds.height) {
            object.position.y = this.bounds.y + this.bounds.height;
            // object.physics.velocity = object.physics.velocity
            //     .scaleY(this.restitution)
            //     .flipY();
        }
    }
}
