#version 300 es
in vec4 a_position;
out vec2 v_texcoord;

void main() {
    gl_Position = a_position;
    v_texcoord = (a_position.xy + 1.0) * 0.5;
}