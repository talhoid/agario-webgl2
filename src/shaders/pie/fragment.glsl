#version 300 es
precision highp float;

uniform float u_total;           // Total number of segments
uniform float u_radius;          // Radius of the circle
uniform float u_depth;
uniform float u_layerSize;
uniform vec2 u_scale;            // Scaling factors for the screen space
in vec2 v_position;

// Segment struct to organize angle, color, and parent radius scaling factor
struct Segment {
    float startAngle;
    float endAngle;
    vec4 color;
    float radius;   // For nested segments, usually 0.9 (90%)
    bool nested;
};

uniform Segment u_segments[16]; // Up to 16 segments

out vec4 outColor;

const float PI = 3.14159265359f;

void main() {
    // Convert fragment position to circle space
    vec2 pos = v_position * u_scale;

    float layerCount = abs(floor(u_depth / u_layerSize));
    float closestDist = 1.0f; // Track the closest distance to any layer
    for(float i = 0.0f; i <= layerCount; i++) {
        // Compute the vertical offset for this layer
        float offset = i * u_layerSize;
        vec2 layerPos = pos - vec2(0.0f, -offset);
        float dist = length(layerPos);
        closestDist = min(closestDist, dist); // Find the nearest layer
    }

    // Discard fragments completely outside all layers
    if(closestDist > u_radius) {
        discard;
    }

    // Calculate the distance from the center
    float originalDist = length(pos);

    // Adjust position for fragments outside the circle
    bool dark = false;
    vec2 circlePos = pos;
    if(originalDist > u_radius) {
        float newY = sign(pos.y) * sqrt(max(0.0f, u_radius * u_radius - pos.x * pos.x));
        circlePos = vec2(pos.x, newY);
        dark = true;
    }

    // Calculate the angle [0, 2π] for the corrected circle position
    float angle = atan(circlePos.y, circlePos.x);
    if(angle < 0.0f)
        angle += 2.0f * PI;

    // Default color (transparent)
    vec4 color = vec4(0.0f);

    // Iterate through segments and their nested segments
    for(int i = 0; i < int(u_total); i++) {
        if(u_segments[i].nested)
            continue;

        // Check if current fragment is within the angular range of the segment
        if(angle >= u_segments[i].startAngle && angle < u_segments[i].endAngle) {
            float radius = u_radius * u_segments[i].radius;

            if(closestDist <= radius) {
                color = u_segments[i].color;
                break;
            }
        }
    }

    float newRadiuses[16] = float[16](0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f);
    for(int i = 0; i < int(u_total); i++) {
        if(!u_segments[i].nested)
            continue;
        newRadiuses[i] = u_segments[i].radius;
    }

    for(int i = 0; i < int(u_total); i++) {
        if(!u_segments[i].nested)
            continue;

        vec2 newPos = pos;
        if(originalDist > u_radius) {
            float newY = sign(pos.y) * sqrt(max(0.0f, newRadiuses[i] * newRadiuses[i] - pos.x * pos.x));
            newPos = vec2(pos.x, newY);
        }

    // Calculate the angle [0, 2π] for the corrected circle position
        float newAngle = atan(newPos.y, newPos.x);
        if(newAngle < 0.0f)
            newAngle += 2.0f * PI;

        // Check if current fragment is within the angular range of the segment
        if(newAngle >= u_segments[i].startAngle && newAngle < u_segments[i].endAngle) {
            // If it's a nested segment, reduce the radius by a factor (e.g., 90%)
            float radius = u_radius * u_segments[i].radius;

            if(closestDist <= radius) {
                color = u_segments[i].color;
                break;
            }
        }
    }

    if(originalDist > u_radius) {
        color.rgb *= .8f;
    }

    // Output the color
    outColor = color;
}
