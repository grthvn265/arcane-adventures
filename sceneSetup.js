import * as THREE from 'three';
import { createSky } from 'Sky'; // Import the createSky function

export function setupScene(camera) { // Camera might be needed for other setup, keeping it
    const scene = new THREE.Scene();

    // Add Sky
    const sky = createSky();
    scene.add(sky);

    // Add Fog - color should ideally match the sky's horizon
    // Sky.js uses horizonColor = new THREE.Color(0x87ceeb)
    // Fog distances: near, far. GROUND_SIZE is 100.
    scene.fog = new THREE.Fog(0x87ceeb, 25, 90); 

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Slightly increased ambient for better visibility with sky
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Slightly increased intensity
    directionalLight.position.set(50, 80, 30); // Adjusted position for broader coverage
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096; // Increased shadow map resolution
    directionalLight.shadow.mapSize.height = 4096;
    
    // Adjust shadow camera frustum to cover a larger area, considering GROUND_SIZE = 100
    const shadowCamSize = 60; // Half-width/height of the shadow camera's view area
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200; // Increased far plane
    directionalLight.shadow.camera.left = -shadowCamSize;
    directionalLight.shadow.camera.right = shadowCamSize;
    directionalLight.shadow.camera.top = shadowCamSize;
    directionalLight.shadow.camera.bottom = -shadowCamSize;
    directionalLight.shadow.bias = -0.0005; // Helps prevent shadow acne

    scene.add(directionalLight);
    
    // Optional: Add a light helper for debugging
    // const lightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
    // scene.add(lightHelper);
    // const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
    // scene.add(shadowCameraHelper);
    return { scene, directionalLight }; // Return both scene and the main light
}