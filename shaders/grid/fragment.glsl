#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_gridSize;
uniform float u_time;
uniform vec4 u_gridColor;
in vec2 v_worldPos;
out vec4 outColor;

void main() {
    // Calculate grid lines based on world position
    if(gl_FragCoord.x < 0.0f || gl_FragCoord.x > u_resolution.x || gl_FragCoord.y < 0.0f || gl_FragCoord.y > u_resolution.y) {
        discard;
    }
    vec2 grid = abs(fract(v_worldPos / u_gridSize + 0.5f) - 0.5f);
    float lineX = grid.x;
    float lineY = grid.y;
    float gridLineX = 1.0f - smoothstep(0.0f, 0.02f, lineX);
    float gridLineY = 1.0f - smoothstep(0.0f, 0.02f, lineY);
    float gridLine = max(gridLineX, gridLineY);

    outColor = mix(vec4(0), u_gridColor, gridLine);
}
