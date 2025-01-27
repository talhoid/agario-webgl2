#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_center;
in vec4 a_color;
uniform mat4 u_matrix;
uniform float u_outline_width;
out vec4 v_color;

void main() {
    vec2 position = a_position;
    // Expand vertex by outline width
    vec2 vertex_normal = vec2(0.0);
    if (a_center != position) {
        vertex_normal = normalize(position - a_center);
    }
    vec4 transformedPosition = u_matrix * vec4(position + vertex_normal * u_outline_width, 0, 1);
    
    gl_Position = transformedPosition;
    v_color = a_color;
}