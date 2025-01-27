class Stats {
    static readonly REVISION = 16;
    readonly container: HTMLDivElement;
    private mode: number = 0;
    private beginTime: number = performance.now();
    private prevTime: number = this.beginTime;
    private frames: number = 0;
    private fpsPanel: Panel;
    private msPanel: Panel;
    private memPanel?: Panel;

    constructor() {
        this.container = document.createElement('div');
        this.container.style.cssText = 'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000';
        this.container.addEventListener('click', (event) => {
            event.preventDefault();
            this.showPanel(++this.mode % this.container.children.length);
        });

        this.fpsPanel = this.addPanel(new Panel('FPS', '#0ff', '#002'));
        this.msPanel = this.addPanel(new Panel('MS', '#0f0', '#020'));

        if (performance.memory) {
            this.memPanel = this.addPanel(new Panel('MB', '#f08', '#201'));
        }

        this.showPanel(0);
        this.makeDraggable(this.container);
    }

    private addPanel(panel: Panel): Panel {
        this.container.appendChild(panel.dom);
        return panel;
    }

    private showPanel(id: number): void {
        Array.from(this.container.children).forEach((child, i) => {
            (child as HTMLElement).style.display = i === id ? 'block' : 'none';
        });
        this.mode = id;
    }

    public begin(): void {
        this.beginTime = performance.now();
    }

    public end(): number {
        this.frames++;
        const time = performance.now();
        this.msPanel.update(time - this.beginTime, 200);

        if (time >= this.prevTime + 1000) {
            this.fpsPanel.update((this.frames * 1000) / (time - this.prevTime), 100);
            this.prevTime = time;
            this.frames = 0;

            if (this.memPanel && performance.memory) {
                const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
                this.memPanel.update(usedJSHeapSize / 1048576, jsHeapSizeLimit / 1048576);
            }
        }

        return time;
    }

    public update(): void {
        this.beginTime = this.end();
    }

    private makeDraggable(element: HTMLElement): void {
        element.addEventListener('mousedown', (event: MouseEvent) => {
            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            const { offsetLeft, offsetTop } = element;

            const onMouseMove = (moveEvent: MouseEvent) => {
                element.style.left = `${offsetLeft + moveEvent.clientX - startX}px`;
                element.style.top = `${offsetTop + moveEvent.clientY - startY}px`;
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
}

class Panel {
    private min: number = Infinity;
    private max: number = 0;
    private round: (value: number) => number = Math.round;
    private PR: number = this.round(window.devicePixelRatio || 1);
    private WIDTH: number = 80 * this.PR;
    private HEIGHT: number = 48 * this.PR;
    private TEXT_X: number = 3 * this.PR;
    private TEXT_Y: number = 2 * this.PR;
    private GRAPH_X: number = 3 * this.PR;
    private GRAPH_Y: number = 15 * this.PR;
    private GRAPH_WIDTH: number = 74 * this.PR;
    private GRAPH_HEIGHT: number = 30 * this.PR;

    public readonly dom: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private name: string;
    private fg: string;
    private bg: string;

    constructor(name: string, fg: string, bg: string) {
        this.name = name;
        this.fg = fg;
        this.bg = bg;

        const canvas = document.createElement('canvas');
        canvas.width = this.WIDTH;
        canvas.height = this.HEIGHT;
        canvas.style.cssText = 'width:80px;height:48px';

        this.context = canvas.getContext('2d')!;
        this.context.font = `bold ${9 * this.PR}px monospace`;
        this.context.textBaseline = 'top';

        this.context.fillStyle = this.bg;
        this.context.fillRect(0, 0, this.WIDTH, this.HEIGHT);
        this.context.fillStyle = this.fg;
        this.context.fillText(this.name, this.TEXT_X, this.TEXT_Y);
        this.context.fillRect(this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT);

        this.context.fillStyle = this.bg;
        this.context.globalAlpha = 0.9;
        this.context.fillRect(this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT);

        this.dom = canvas;
    }

    public update(value: number, maxValue: number): void {
        this.min = Math.min(this.min, value);
        this.max = Math.max(this.max, value);

        this.context.fillStyle = this.bg;
        this.context.globalAlpha = 1;
        this.context.fillRect(0, 0, this.WIDTH, this.GRAPH_Y);
        this.context.fillStyle = this.fg;
        this.context.fillText(`${this.round(value)} ${this.name} (${this.round(this.min)}-${this.round(this.max)})`, this.TEXT_X, this.TEXT_Y);

        this.context.drawImage(this.dom, this.GRAPH_X + this.PR, this.GRAPH_Y, this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT, this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT);

        this.context.fillRect(this.GRAPH_X + this.GRAPH_WIDTH - this.PR, this.GRAPH_Y, this.PR, this.GRAPH_HEIGHT);

        this.context.fillStyle = this.bg;
        this.context.globalAlpha = 0.9;
        this.context.fillRect(this.GRAPH_X + this.GRAPH_WIDTH - this.PR, this.GRAPH_Y, this.PR, this.round((1 - (value / maxValue)) * this.GRAPH_HEIGHT));
    }
}

export default Stats;
