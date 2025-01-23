export function makeDraggable(
    container: HTMLElement,
    outerElement: HTMLElement,
    allowedDepth: number = 1) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    function getDepth(element: HTMLElement, root: HTMLElement): number {
        let depth = 0;
        while (element && element !== root) {
            depth++;
            element = element.parentElement as HTMLElement;
        }
        return depth;
    }

    container.addEventListener("mousedown", (event) => {
        const target = event.target as HTMLElement;
        const depth = getDepth(target, container);

        isDragging = depth <= allowedDepth;

        if (!isDragging) return;

        offset.x = event.clientX - container.getBoundingClientRect().left;
        offset.y = event.clientY - container.getBoundingClientRect().top;

        event.preventDefault();
    });

    outerElement.addEventListener("mousemove", (event) => {
        if (isDragging) {
            const containerRect = outerElement.getBoundingClientRect();
            const elementRect = container.getBoundingClientRect();

            const newX = Math.min(
                Math.max(event.clientX - offset.x, containerRect.left),
                containerRect.right - elementRect.width
            );
            const newY = Math.min(
                Math.max(event.clientY - offset.y, containerRect.top),
                containerRect.bottom - elementRect.height
            );

            container.style.left = `${newX}px`;
            container.style.top = `${newY}px`;

            container.style.right = `${containerRect.right - newX - elementRect.width}px`;
            container.style.bottom = `${containerRect.bottom - newY - elementRect.height}px`;
        }
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });

    container.addEventListener("dragstart", (event) => {
        event.preventDefault();
    });
}
