import * as THREE from 'three';

const PARTICLE_COUNT = 50;
const PARTICLE_LIFETIME = 1.5; // seconds
const PARTICLE_SPREAD = 1.0;
const PARTICLE_SPEED = 1.5;
const PARTICLE_SIZE = 0.08;
const PARTICLE_COLOR = 0xaaaaff; // Sparkle color

export class SimpleParticleSystem {
    constructor(scene, origin, duration = PARTICLE_LIFETIME) {
        this.scene = scene;
        this.origin = origin;
        this.duration = duration;
        this.elapsedTime = 0;
        this.finished = false;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        this.velocities = []; // Store velocity vectors for each particle

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const index = i * 3;
            positions[index] = origin.x;
            positions[index + 1] = origin.y;
            positions[index + 2] = origin.z;

            // Random velocity vector (spherical distribution)
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const speed = Math.random() * PARTICLE_SPEED;
            const velocity = new THREE.Vector3(
                speed * Math.sin(phi) * Math.cos(theta),
                speed * Math.cos(phi) + 0.5, // Bias upwards slightly
                speed * Math.sin(phi) * Math.sin(theta)
            );
            this.velocities.push(velocity);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: PARTICLE_COLOR,
            size: PARTICLE_SIZE,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true, // Particles smaller further away
            depthWrite: false, // Prevent particles from hiding behind transparent objects incorrectly
            blending: THREE.AdditiveBlending // Brighter where particles overlap
        });

        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);
    }

    update(deltaTime) {
        if (this.finished) return;

        this.elapsedTime += deltaTime;
        const progress = this.elapsedTime / this.duration;

        if (progress >= 1.0) {
            this.dispose();
            return;
        }

        const positions = this.points.geometry.attributes.position.array;
        const currentOpacity = 1.0 - progress * progress; // Fade out quadratically
         this.points.material.opacity = Math.max(0, currentOpacity);


        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const index = i * 3;
            const velocity = this.velocities[i];

            // Update position based on velocity
            positions[index] += velocity.x * deltaTime;
            positions[index + 1] += velocity.y * deltaTime;
            positions[index + 2] += velocity.z * deltaTime;

            // Apply some drag/gravity (optional)
             velocity.y -= 1.0 * deltaTime; // Simple gravity effect
        }

        this.points.geometry.attributes.position.needsUpdate = true; // Important!
    }

    isFinished() {
        return this.finished;
    }

    dispose() {
        if (!this.finished) {
             this.finished = true;
             this.scene.remove(this.points);
             this.points.geometry.dispose();
             this.points.material.dispose();
             this.velocities = []; // Clear velocities array
        }
    }
}