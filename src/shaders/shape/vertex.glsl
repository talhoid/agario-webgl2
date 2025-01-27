#version 300 es
precision lowp float;
in vec2 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
    // Position is in world space, transform directly to clip space
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
    
    v_color = a_color;
}