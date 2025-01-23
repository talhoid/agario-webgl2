#version 300 es
precision highp float;

in vec2 position;
out vec2 v_position;

void main() {
    v_position = position;
    gl_Position = vec4(position, 0.0f, 1);
}