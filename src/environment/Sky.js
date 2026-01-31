import * as THREE from 'three';

export function createSky() {
    // Sky sphere geometry - radius should be larger than the playable area
    // Using 500 as GROUND_SIZE in environment.js is 100.
    const skyGeo = new THREE.SphereGeometry(500, 32, 24);

    const zenithColor = new THREE.Color(0x3498db); // A brighter, more vibrant blue for the zenith
    const horizonColor = new THREE.Color(0x85c1e9); // A lighter, softer blue for the horizon
    const nadirColor = new THREE.Color(0xaed6f1); // A very light, almost pastel blue for below the horizon

    const colors = [];
    const positions = skyGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        
        // Normalize vertex y position to range [-1, 1] relative to sphere radius
        // This y value represents the height on the sphere
        const normalizedY = vertex.y / 500; 

        let color = new THREE.Color();

        if (normalizedY > 0) { // Above horizon
            // Interpolate between horizon and zenith.
            // Math.sqrt(normalizedY) biases the gradient towards the horizon color,
            // making the zenith color appear more at the very top.
            color.lerpColors(horizonColor, zenithColor, Math.sqrt(normalizedY));
        } else { // Below horizon
            // Interpolate between horizon and nadir.
            // Math.sqrt(-normalizedY) for the portion below the horizon.
            color.lerpColors(horizonColor, nadirColor, Math.sqrt(-normalizedY));
        }
        colors.push(color.r, color.g, color.b);
    }

    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const skyMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false // The sky itself should not be affected by scene fog
    });

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    // Ensure sky is rendered behind everything else, though typically depth testing handles this.
    // For very large skyboxes, this might not be strictly necessary but can be a safeguard.
    skyMesh.renderOrder = -1; 
    
    return skyMesh;
}