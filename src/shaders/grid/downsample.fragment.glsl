#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
in vec2 v_texcoord;
out vec4 outColor;

const float PI = 3.141592653589793f;
const float a = 2.0f; // Lanczos radius

float lanczosWeight(float x) {
    x = abs(x);
    if(x < 0.0001f)
        return 1.0f;
    if(x > a)
        return 0.0f;
    float xpi = x * PI;
    return (sin(xpi) / xpi) * sin(xpi / a) / (xpi / a);
}

void main() {
    vec4 color = vec4(0.0f);
    float weightSum = 0.0f;

    for(int x = -2; x <= 2; x++) {
        for(int y = -2; y <= 2; y++) {
            vec2 offset = vec2(x, y) * u_texelSize;
            float weight = lanczosWeight(float(x)) * lanczosWeight(float(y));

            color += texture(u_texture, v_texcoord + offset) * weight;
            weightSum += weight;
        }
    }

    outColor = color / weightSum;
}