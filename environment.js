import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'; // Import ColladaLoader
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // Import GLTFLoader
const GROUND_SIZE = 100; // Increased world size
const NUM_TREES = 90; // Increased tree count to match larger world
const TREE_MODEL_URLS = [
    'https://play.rosebud.ai/assets/Tree Type0 01.dae?mTNB',
    'https://play.rosebud.ai/assets/Tree Type0 02.dae?62We',
    'https://play.rosebud.ai/assets/Tree Type0 03.dae?wOeh'
];
const TREE_TEXTURE_URL = 'https://play.rosebud.ai/assets/Colorsheet Tree Normal.png?WZsm';
const GRASS_MODEL_URL = 'https://play.rosebud.ai/assets/Grass_1_A_Color1.gltf?fFPX'; // Added grass model URL
const NUM_GRASS_PATCHES = 300; // Increased grass patches for larger world
export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.ground = null;
        this.trees = new THREE.Group();
        this.grass = new THREE.Group(); // Added group for grass
        this._createGround();
        this.treeModels = []; // Store multiple loaded tree models
        this.treeBaseOffsets = {}; // Store calculated base offsets for each tree model URL
        this.treeTexture = null; // Store the loaded texture
        this.grassModel = null; // Store the loaded grass model
        this.modelsLoaded = { trees: false, grass: false }; // Track loading status separately
        this._loadTexture(() => { // Load texture first
            this._loadTreeModels(() => { // Then load tree models
                this.modelsLoaded.trees = true;
                this._tryScatterAssets(); // Try scattering after trees load
            });
        });
        this._loadGrassModel(() => { // Load grass model concurrently
            this.modelsLoaded.grass = true;
            this._tryScatterAssets(); // Try scattering after grass loads
        });
    }
    _createGround() {
        const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 10, 10);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x558855, // Lush green
            roughness: 0.9,
            metalness: 0.0,
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2; // Lay flat
        this.ground.receiveShadow = true;
        // Optionally hide the base ground plane if grass covers it well
        // this.ground.visible = false;
        this.scene.add(this.ground); // Add ground to scene here
    }
    _loadTexture(onLoadCallback) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(TREE_TEXTURE_URL, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
            texture.flipY = false; // DAE models might need this
            this.treeTexture = texture;
            // console.log("Tree texture loaded successfully."); // Removed for cleaner console
            onLoadCallback();
        }, undefined, (error) => {
            console.error('Error loading tree texture:', error);
            onLoadCallback(); // Proceed even if texture fails, trees will be untextured
        });
    }
    _loadTreeModels(onAllLoadedCallback) {
        const loader = new ColladaLoader();
        let modelsToLoad = TREE_MODEL_URLS.length;
        TREE_MODEL_URLS.forEach((url, index) => {
            loader.load(url, (collada) => {
                const daeScene = collada.scene;
                daeScene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = false;
                        if (child.material) {
                           // Apply the loaded texture
                           if (this.treeTexture) {
                               child.material.map = this.treeTexture;
                               child.material.needsUpdate = true;
                           }
                            // Adjust other material properties if needed
                            if (child.material.metalness !== undefined) child.material.metalness = 0.0; // Non-metallic
                            if (child.material.roughness !== undefined) child.material.roughness = 0.9; // Rough bark/leaves
                        }
                    }
                });
                const wrapperGroup = new THREE.Group();
                wrapperGroup.add(daeScene);
                // Removed explicit rotation: wrapperGroup.rotation.x = -Math.PI / 2;
                // Relying on ColladaLoader's default `convertUpAxis = true` to handle orientation.
                const loadedModel = wrapperGroup; // Use the wrapper for all subsequent calculations
                // Calculate bounding box and offset *after* applying texture/material changes to daeScene.
                // The wrapperGroup itself now has no additional rotation applied by us here.
                const box = new THREE.Box3().setFromObject(loadedModel);
                const size = new THREE.Vector3();
                box.getSize(size);
                // This offset ensures the lowest point of the rotated model sits on the ground.
                const baseOffsetY = Math.abs(box.min.y); 
                this.treeBaseOffsets[url] = baseOffsetY;
                // console.log(`Tree model ${index + 1} loaded from ${url}, Base offset: ${baseOffsetY.toFixed(2)}`); // Cleaned up log
                this.treeModels[index] = loadedModel; // Store the wrapper group
                modelsToLoad--;
                if (modelsToLoad === 0) {
                    onAllLoadedCallback(); // All models are loaded
                }
            }, undefined, (error) => {
                console.error(`Error loading tree model ${index + 1} from ${url}:`, error);
                modelsToLoad--; // Still count it as 'processed' even on error
                if (modelsToLoad === 0) {
                     onAllLoadedCallback(); // Call callback even if some failed
                 }
             }); // Close loader.load callback
        }); // Close TREE_MODEL_URLS.forEach
    } // Close _loadTreeModels method
    _loadGrassModel(onLoadCallback) {
        const loader = new GLTFLoader(); // Now GLTFLoader is defined
        loader.load(GRASS_MODEL_URL, (gltf) => {
            this.grassModel = gltf.scene;
            // Set shadow properties for grass
            this.grassModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true; // Grass can cast subtle shadows
                    child.receiveShadow = true; // Grass should receive shadows
                    // Adjust material properties if needed (e.g., make less shiny)
                    if (child.material && child.material.metalness !== undefined) {
                       child.material.metalness = 0.1;
                    }
                     if (child.material && child.material.roughness !== undefined) {
                       child.material.roughness = 0.8;
                    }
                }
            });
            // console.log("Grass model loaded successfully."); // Removed for cleaner console
            onLoadCallback();
        }, undefined, (error) => {
            console.error('Error loading grass model:', error);
            onLoadCallback(); // Proceed even if grass fails
        });
    }
     _tryScatterAssets() {
        // Only scatter when *both* trees and grass are loaded
        if (this.modelsLoaded.trees && this.modelsLoaded.grass) {
            // console.log("All assets loaded, scattering trees and grass."); // Removed for cleaner console
            this._scatterTrees();
            this._scatterGrass();
            this.scene.add(this.trees);
            this.scene.add(this.grass);
        }
    }
     _scatterTrees() {
        if (!this.modelsLoaded.trees || this.treeModels.length === 0) {
            console.warn("Tree models not loaded, cannot scatter trees.");
            return;
        }
        const baseScale = 1.7;
        for (let i = 0; i < NUM_TREES; i++) {
            // Randomly select one of the loaded models
            const modelIndex = Math.floor(Math.random() * this.treeModels.length);
            const selectedModel = this.treeModels[modelIndex];
            // Check if the selected model actually loaded successfully
            if (!selectedModel) {
                console.warn(`Skipping tree ${i} because model index ${modelIndex} failed to load.`);
                continue; // Skip this iteration if the model wasn't loaded
            }
            const treeInstance = selectedModel.clone(); // Clone the chosen model scene
            // Note: Shadow properties are already set during loading, no need to traverse again here.
            // Random position within the ground area, avoiding the center spawn
            let validPosition = false;
            let xPos, zPos;
            while (!validPosition) {
                xPos = (Math.random() - 0.5) * (GROUND_SIZE * 0.9);
                zPos = (Math.random() - 0.5) * (GROUND_SIZE * 0.9);
                if (Math.sqrt(xPos * xPos + zPos * zPos) > 5) { // Keep away from player start (0,0)
                   validPosition = true;
               }
            }
            // Define randomScale *before* using it
            const randomScale = (Math.random() * 0.5 + 0.75) * baseScale; // Define random scale (e.g., 0.75x to 1.25x of base)
            const modelUrl = TREE_MODEL_URLS[modelIndex]; // Get the URL corresponding to the model
            const baseOffsetY = (this.treeBaseOffsets[modelUrl] || 0) * randomScale; // Get pre-calculated offset and apply scale
            treeInstance.position.set(
                xPos,
                this.getGroundHeight(xPos, zPos) + baseOffsetY, // Add the calculated offset
                zPos
            );
            // Now randomScale is defined and can be used here
            treeInstance.scale.set(randomScale, randomScale, randomScale);
            treeInstance.rotation.y = Math.random() * Math.PI * 2; // Random Y rotation
            this.trees.add(treeInstance); // Add the instance to the group ONCE
            // Removed duplicate add call
        }
    }
    _scatterGrass() {
        if (!this.grassModel) {
            console.warn("Grass model not loaded, cannot scatter grass.");
            return;
        }
         const baseScale = 1.0; // Base scale for grass patches
         const grassClusterRadius = 0.8; // Radius within which to place individual grass blades per "patch"
         const numBladesPerPatch = 3; // Number of grass models per cluster point
        for (let i = 0; i < NUM_GRASS_PATCHES; i++) {
             // Determine a center point for the grass patch
            const clusterX = (Math.random() - 0.5) * (GROUND_SIZE * 0.95); // Slightly less spread than trees
            const clusterZ = (Math.random() - 0.5) * (GROUND_SIZE * 0.95);
            const groundY = this.getGroundHeight(clusterX, clusterZ);
             for (let j = 0; j < numBladesPerPatch; j++) {
                const grassInstance = this.grassModel.clone(); // Clone the loaded grass model
                 // Position blades randomly within the cluster radius
                const offsetX = (Math.random() - 0.5) * grassClusterRadius * 2;
                const offsetZ = (Math.random() - 0.5) * grassClusterRadius * 2;
                 grassInstance.position.set(
                    clusterX + offsetX,
                    groundY, // Place directly on ground
                    clusterZ + offsetZ
                );
                const randomScale = (Math.random() * 0.3 + 0.85) * baseScale; // Random size variation
                grassInstance.scale.set(randomScale, randomScale, randomScale);
                grassInstance.rotation.y = Math.random() * Math.PI * 2; // Random Y rotation
                this.grass.add(grassInstance);
            }
        }
    }
    getGroundHeight(x, z) {
        // For a flat plane, height is always 0
        // Later, could use raycasting or heightmap data
        return 0;
    }
     update(deltaTime, playerPosition) {
         // No updates needed currently for the static environment
     }
}