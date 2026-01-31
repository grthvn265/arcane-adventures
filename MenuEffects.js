import * as THREE from 'three';

const PARTICLE_COUNT = 80; // Fewer, more subtle particles
const PARTICLE_SIZE = 0.15; // Slightly larger, but more transparent
const SPREAD_RADIUS = 25; // Wider horizontal/vertical spread
const DEPTH_SPREAD = 20; // Deeper spread for more parallax
const DRIFT_SPEED = 0.1; // Slower, more gentle drift

export class MenuEffects {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.particlePositions = null;
        this.particleVelocities = [];
        this.isActive = false; // Start inactive

        this._createParticles();
    }

    _createParticles() {
        const geometry = new THREE.BufferGeometry();
        this.particlePositions = new Float32Array(PARTICLE_COUNT * 3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            // Initial random position within the spread volume
            this.particlePositions[i3] = (Math.random() - 0.5) * SPREAD_RADIUS * 2; // Local X: [-SPREAD_RADIUS, SPREAD_RADIUS]
            this.particlePositions[i3 + 1] = (Math.random() - 0.5) * SPREAD_RADIUS * 2; // Local Y: [-SPREAD_RADIUS, SPREAD_RADIUS]
            // Local Z: particles spread from 0 to -2*DEPTH_SPREAD relative to particle system's origin
            this.particlePositions[i3 + 2] = Math.random() * -2 * DEPTH_SPREAD;
            // Slower, more multi-directional drift
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * DRIFT_SPEED * 0.7, // Gentle horizontal drift
                (Math.random() - 0.5) * DRIFT_SPEED,       // Gentle vertical drift (up and down)
                (Math.random() - 0.5) * DRIFT_SPEED * 0.5  // Gentle depth drift
            );
            this.particleVelocities.push(velocity);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xf5f5f5, // Soft, off-white color
            size: PARTICLE_SIZE,
            transparent: true,
            opacity: 0.25, // More subtle opacity
            blending: THREE.AdditiveBlending, // Good for glowing effect on dark backgrounds
            depthWrite: false,
            sizeAttenuation: true,
        });

        this.particles = new THREE.Points(geometry, material);
        this.particles.visible = false; // Initially hidden
        this.scene.add(this.particles);
    }

    activate() {
        if (this.particles) {
            this.particles.visible = true;
            this.isActive = true;
        }
    }

    deactivate() {
        if (this.particles) {
            this.particles.visible = false;
            this.isActive = false;
        }
    }

    update(deltaTime, cameraPosition) {
         if (!this.isActive || !this.particles) return;

         // Center the particle system around the camera roughly
        this.particles.position.copy(cameraPosition).add(new THREE.Vector3(0, 0, -DEPTH_SPREAD));

        const positions = this.particles.geometry.attributes.position.array;
        
        const localHalfSpreadX = SPREAD_RADIUS;
        const localHalfSpreadY = SPREAD_RADIUS;
        // Particles are positioned locally from 0 (at particle system origin) to -2 * DEPTH_SPREAD (furthest back)
        const localDepthMax = 0; 
        const localDepthMin = -2 * DEPTH_SPREAD;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const velocity = this.particleVelocities[i];
            positions[i3] += velocity.x * deltaTime;
            positions[i3 + 1] += velocity.y * deltaTime;
            positions[i3 + 2] += velocity.z * deltaTime;
            // Wrap particles within their defined local volume
            if (positions[i3] > localHalfSpreadX) positions[i3] = -localHalfSpreadX;
            else if (positions[i3] < -localHalfSpreadX) positions[i3] = localHalfSpreadX;
            if (positions[i3 + 1] > localHalfSpreadY) positions[i3 + 1] = -localHalfSpreadY;
            else if (positions[i3 + 1] < -localHalfSpreadY) positions[i3 + 1] = localHalfSpreadY;
            if (positions[i3 + 2] > localDepthMax) positions[i3 + 2] = localDepthMin + Math.random(); // Add small random to avoid all clumping at edge
            else if (positions[i3 + 2] < localDepthMin) positions[i3 + 2] = localDepthMax - Math.random();
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
         if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.particles = null;
            this.particleVelocities = [];
            this.particlePositions = null;
        }
    }
}