#version 300 es
precision highp float;
uniform float u_gridSize;
uniform vec4 u_gridColor;
in vec2 v_worldPos;
out vec4 outColor;

void main() {
    vec2 grid = abs(fract(v_worldPos / u_gridSize + 0.5) - 0.5);
    float lineX = step(0.01, grid.x);
    float lineY = step(0.01, grid.y);
    float gridLine = max(1.0 - lineX, 1.0 - lineY);
    outColor = vec4(u_gridColor.rgb * gridLine, gridLine);
}