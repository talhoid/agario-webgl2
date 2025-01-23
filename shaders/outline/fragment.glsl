#version 300 es
precision mediump float;

in vec4 v_color;
out vec4 outColor;

void main() {
    // Make color 40% darker
    outColor = vec4(v_color.rgb * 0.6, v_color.a);
}