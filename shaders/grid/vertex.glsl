#version 300 es
precision highp float;

in vec2 a_position;
uniform mat4 u_worldMatrix;
out vec2 v_worldPos;

void main() {
    // Transform screen-space quad to world space
    vec4 worldPos = u_worldMatrix * vec4(a_position, 0, 1);
    v_worldPos = worldPos.xy;
    gl_Position = vec4(a_position, 0, 1);
}