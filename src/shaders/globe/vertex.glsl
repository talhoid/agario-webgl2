#version 300 es

in vec2 a_position;
in vec4 a_color;

uniform vec2 u_resolution;

out vec4 v_color;

void main() {
    // Normalize the position to the range [0, 1]
    vec2 zeroToOne = a_position / u_resolution;

    // Convert to clip space coordinates [-1, 1]
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    // Apply an inverse fisheye effect using radial distortion
    float distortionStrength = 0.01;  // Controls the fisheye intensity (higher values = stronger distortion)
    float radius = length(clipSpace);  // Distance from the center
    float distortedRadius = radius / (1.0 + distortionStrength * radius * radius);  // Inward radial distortion

    // Scale the clipSpace coordinates based on the distorted radius
    vec2 distortedPosition = clipSpace * distortedRadius / radius;

    // Set the final position and apply time-based depth
    gl_Position = vec4(distortedPosition * vec2(1.0, -1.0), 0.0, 3.0f);

    v_color = a_color;
}
