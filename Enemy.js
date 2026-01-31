import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AudioLoader, Audio } from 'three'; // Added Audio and AudioLoader
const ENEMY_MODEL_URL = 'https://play.rosebud.ai/assets/Skeleton_Warrior.glb?ymv2';
const ENEMY_ATTACK_SOUND_URL = 'https://play.rosebud.ai/assets/03_Claw_03.wav?UIzl';
const ENEMY_SCALE = 1.0; // Adjust as needed
export class Enemy {
    constructor(scene, player, initialPosition = new THREE.Vector3(0, 0, 0), audioListener, effectUpdaters = []) {
        this.scene = scene;
        this.player = player; // Reference to the player for AI later
        this.initialPosition = initialPosition; // Store the initial position
        this.audioListener = audioListener; // Store the audio listener
        this.effectUpdaters = effectUpdaters; // Store the effect updaters array
        this.mesh = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        this.health = 50; // Example health
        this.maxHealth = 50;
        this.isAlive = true;
        this.originalMaterials = new Map(); // To store original materials for damage flash
        this.damageFlashColor = new THREE.Color(0xff0000); // Red flash
        this.damageFlashDuration = 0.15; // Seconds
        this.damageFlashTimer = 0;
        this.movementSpeed = 1.5; // Units per second
        this.attackRange = 2.0; // Distance to stop and attack
        this.sightRange = 20.0; // Distance to start chasing
        this.targetPosition = new THREE.Vector3(); // For AI movement
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.attackDamage = 3; // Damage dealt by enemy - Updated to 5
        this.attackCooldown = 2.0; // Seconds between attacks
        this.lastAttackTime = -Infinity; // Time of last attack
        this.isAttacking = false; // Is enemy currently in an attack animation
        this.attackWindUpTime = 0.5; // Time from attack anim start to damage dealt (sync with animation)
        this.radius = 0.5; // Approximate radius for collision
        this.attackSoundBuffer = null;
        this.attackSound = null;
        // this.deathRemovalTimer = null; // No longer used, removal handled by update loop
        // this.deathLingerDuration = 1.5; // No longer used directly by a timer
        this.deathAnimationCompleted = false; // Tracks if death animation has finished
        this.deathSmokeEffect = null; // Stores the smoke effect instance for this enemy's death
        this._loadModel();
        this._loadSounds();
    }
    static _smokeTexture = null; // Cache the texture
    static getSmokeParticleTexture() {
        if (!Enemy._smokeTexture) {
            const canvas = document.createElement('canvas');
            const size = 128;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(
                size / 2, size / 2, 0,
                size / 2, size / 2, size / 2
            );
            gradient.addColorStop(0, 'rgba(200, 200, 200, 0.7)'); // Center of smoke
            gradient.addColorStop(0.6, 'rgba(150, 150, 150, 0.4)');
            gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');    // Outer edge (transparent)
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            Enemy._smokeTexture = new THREE.CanvasTexture(canvas);
            Enemy._smokeTexture.needsUpdate = true;
        }
        return Enemy._smokeTexture;
    }
    
    static playSpawnEffect(scene, position, effectUpdaters) {
        const effect = new SpawnSmokeEffect(scene, position);
        effectUpdaters.push(effect);
        return effect; // Return the created effect instance
    }
    _loadModel() {
        const loader = new GLTFLoader();
        loader.load(ENEMY_MODEL_URL, (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.scale.set(ENEMY_SCALE, ENEMY_SCALE, ENEMY_SCALE);
            this.mesh.position.copy(this.initialPosition); // Use the passed initial position
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true; // Enemies can receive shadows
                    if (child.material) {
                        // Store original material(s) for flashing
                        if (Array.isArray(child.material)) {
                            child.material.forEach((mat, index) => {
                                this.originalMaterials.set(`${child.uuid}_${index}`, mat.clone());
                            });
                        } else {
                            this.originalMaterials.set(child.uuid, child.material.clone());
                        }
                    }
                }
            });
            this.scene.add(this.mesh);
            console.log("Skeleton Warrior model loaded successfully.");
            // Animation Setup
            this.mixer = new THREE.AnimationMixer(this.mesh);
            const clips = gltf.animations;
            console.log("Skeleton Warrior available animations:", clips.map(clip => clip.name));
            const idleClip = THREE.AnimationClip.findByName(clips, 'Idle');
            const attackClip = THREE.AnimationClip.findByName(clips, '1H_Melee_Attack_Chop');
            // Enhanced search for death animation
            const deathAnimNames = ['Death_A', 'Death_B', 'Death_C_Skeleton', 'Death_C_Skeletons', 'Death_A_Pose', 'Death_B_Pose', 'Death_C_Pose'];
            let deathClip = null; // This will be populated by the loop if an animation is found
            let foundDeathAnimName = '';
            for (const animName of deathAnimNames) {
                const clip = THREE.AnimationClip.findByName(clips, animName);
                if (clip) {
                    deathClip = clip; // Assign to the deathClip variable to be used later
                    foundDeathAnimName = animName;
                    console.log(`Skeleton: Found potential death animation: ${animName}`);
                    break; // Found a suitable animation, stop searching
                }
            }
            // --- Walk Animations for Enemy ---
            this.animations['walking_a'] = THREE.AnimationClip.findByName(clips, 'Walking_A');
            this.animations['walking_b'] = THREE.AnimationClip.findByName(clips, 'Walking_B');
            this.animations['walking_backwards'] = THREE.AnimationClip.findByName(clips, 'Walking_Backwards');
            this.animations['walking_c'] = THREE.AnimationClip.findByName(clips, 'Walking_C');
            
            let primaryWalkClip = this.animations['walking_a'] || 
                                  this.animations['walking_b'] || 
                                  this.animations['walking_c'] ||
                                  THREE.AnimationClip.findByName(clips, 'Walk') || // Fallback to generic Walk
                                  THREE.AnimationClip.findByName(clips, 'walk');   // Fallback to generic walk
            if (idleClip) {
                this.animations['idle'] = this.mixer.clipAction(idleClip);
                this.animations['idle'].play();
                this.currentAction = this.animations['idle'];
                console.log("Skeleton Idle animation loaded.");
            } else {
                console.warn("Skeleton Idle animation not found.");
            }
            if (primaryWalkClip) {
                this.animations['walk'] = this.mixer.clipAction(primaryWalkClip);
                this.animations['walk'].setLoop(THREE.LoopRepeat);
                console.log(`Skeleton primary walk animation loaded as 'walk': ${primaryWalkClip.name}`);
            } else {
                console.warn("Skeleton: No suitable primary walk animation found.");
            }
            ['walking_a', 'walking_b', 'walking_backwards', 'walking_c'].forEach(name => {
                if (this.animations[name] && this.animations[name] !== primaryWalkClip) {
                    if (this.animations[name] instanceof THREE.AnimationClip) {
                        this.animations[name] = this.mixer.clipAction(this.animations[name]);
                        this.animations[name].setLoop(THREE.LoopRepeat);
                        console.log(`Skeleton ${name} animation loaded.`);
                    }
                } else if (this.animations[name] === primaryWalkClip && name !== 'walk' && this.animations['walk']) {
                     this.animations[name] = this.animations['walk']; 
                }
            });
            if (attackClip) {
                this.animations['attack'] = this.mixer.clipAction(attackClip);
                this.animations['attack'].setLoop(THREE.LoopOnce);
                this.animations['attack'].clampWhenFinished = false; 
                console.log("Skeleton Attack animation loaded.");
            } else {
                console.warn("Skeleton Attack animation not found.");
            }
            if (deathClip) { // deathClip is now populated by the loop above
                this.animations['death'] = this.mixer.clipAction(deathClip);
                this.animations['death'].setLoop(THREE.LoopOnce);
                this.animations['death'].clampWhenFinished = true; // Keep last frame of death
                console.log(`Skeleton: '${foundDeathAnimName}' animation loaded as 'death'.`); // Use foundDeathAnimName
            } else {
                console.warn("Skeleton: No suitable death animation found from the provided list. Searched for: ['Death_A', 'Death_B', 'Death_C_Skeleton', 'Death_C_Skeletons', 'Death_A_Pose', 'Death_B_Pose', 'Death_C_Pose']");
            }
            // Listen for animation finishes
            this.mixer.addEventListener('finished', (e) => {
                if (e.action === this.animations['attack']) {
                    this.isAttacking = false;
                } else if (e.action === this.animations['death']) {
                    // After death animation finishes, make non-interactive or remove
                    // For now, we'll just ensure it stays dead and might fade out later or be removed by a manager
                    console.log("Skeleton death animation finished. Waiting for smoke effect if any.");
                    this.deathAnimationCompleted = true;
                    // Mesh removal is now handled in the update loop after smoke effect also finishes.
                }
            });
             // Attempt to set initial ground position after model loads
            if (this.scene.environment) { // Assuming environment is accessible via scene
                const groundY = this.scene.environment.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
                this.mesh.position.y = groundY;
                this.onGround = true;
            }


        }, undefined, (error) => {
            console.error('Error loading enemy model:', error);
            // Optional: Create a fallback placeholder
            const fallbackGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
            const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x880000 });
            this.mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            this.mesh.position.copy(this.initialPosition); // Use passed initial position for fallback too
            this.mesh.castShadow = true;
            this.scene.add(this.mesh);
        });
    }

    update(deltaTime, environment) {
        // 1. Update mixer (always, if exists, for animations like death)
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        // 2. Check for and handle despawn condition if enemy is dead and mesh exists
        if (!this.isAlive && this.mesh) {
            // Death animation is considered finished if flag is true, or if there was no death animation to begin with.
            const animFinished = this.deathAnimationCompleted;
            const smokeFinished = !this.deathSmokeEffect || this.deathSmokeEffect.isFinished;
            if (animFinished && smokeFinished) {
                console.log("Enemy despawn: Death animation and smoke effect complete. Removing mesh.");
                if (this.scene) {
                    this.scene.remove(this.mesh);
                }
                // TODO: Consider disposing geometry/materials here if they are unique and not shared.
                // For example:
                // if (this.mesh.geometry) this.mesh.geometry.dispose();
                // this.mesh.traverse(child => {
                //   if (child.isMesh && child.material) { /* dispose materials */ }
                // });
                this.mesh = null; // Nullify reference to stop further processing for this instance.
            }
        }
        // 3. Early exit if mesh is gone (despawned or other issue)
        if (!this.mesh) {
            return; 
        }
        // 4. Early exit for AI/movement if dead but mesh still exists (death sequence playing)
        if (!this.isAlive) {
            return; 
        }
        // 5. Proceed with updates for ALIVE enemies with a MESH
        // Handle damage flash
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= deltaTime;
            if (this.damageFlashTimer <= 0) {
                this._revertMaterial();
            }
        }
        // this.mixer.update(deltaTime); // Mixer update moved to top of function
        let isMoving = false;
        let targetAnimation = 'idle'; // Default animation
        if (this.isAttacking) {
            // If currently in an attack animation, keep playing 'attack'.
            // The 'finished' listener will set this.isAttacking = false.
            targetAnimation = 'attack';
            this.velocity.x = 0;
            this.velocity.z = 0;
            isMoving = false; // Explicitly set isMoving to false during attack
        } else if (this.player && this.player.mesh && this.player.isAlive) {
            const playerPosition = this.player.mesh.position;
            const enemyPosition = this.mesh.position;
            const distanceToPlayer = enemyPosition.distanceTo(playerPosition);
            const now = this.mixer.time;
            if (distanceToPlayer <= this.sightRange) {
                const lookAtTarget = new THREE.Vector3(playerPosition.x, enemyPosition.y, playerPosition.z);
                this.mesh.lookAt(lookAtTarget);
                if (distanceToPlayer <= this.attackRange && (now - this.lastAttackTime) >= this.attackCooldown) {
                    this._performAttack(now); // This will set isAttacking = true and targetAnimation = 'attack'
                    targetAnimation = 'attack'; // _performAttack will trigger this via playAnimation
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                    isMoving = false;
                } else if (distanceToPlayer > this.attackRange) {
                    // Move towards player
                    const direction = new THREE.Vector3().subVectors(playerPosition, enemyPosition).normalize();
                    this.velocity.x = direction.x * this.movementSpeed;
                    this.velocity.z = direction.z * this.movementSpeed;
                    targetAnimation = 'walk';
                    isMoving = true;
                } else {
                    // In attack range, but on cooldown or just finished an attack and isAttacking is now false
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                    targetAnimation = 'idle'; // Default to idle if in range but not attacking
                    isMoving = false;
                }
            } else {
                // Player out of sight
                this.velocity.x = 0;
                this.velocity.z = 0;
                targetAnimation = 'idle';
                isMoving = false;
            }
        } else {
            // No player or player is dead
            this.velocity.x = 0;
            this.velocity.z = 0;
            targetAnimation = 'idle';
            isMoving = false;
        }
        // Play the determined animation
        this.playAnimation(targetAnimation);
        // Apply movement (if any)
        // Movement should only happen if not attacking and isMoving is true
        if (isMoving && !this.isAttacking) {
            this.mesh.position.x += this.velocity.x * deltaTime;
            this.mesh.position.z += this.velocity.z * deltaTime;
        }
        // World Border Check
        if (environment && environment.ground) {
            const groundSize = environment.ground.geometry.parameters.width; // From environment.js
            const halfGroundSize = groundSize / 2;
            if (this.mesh.position.x > halfGroundSize) {
                this.mesh.position.x = halfGroundSize;
                this.velocity.x = 0; 
            } else if (this.mesh.position.x < -halfGroundSize) {
                this.mesh.position.x = -halfGroundSize;
                this.velocity.x = 0;
            }
            if (this.mesh.position.z > halfGroundSize) {
                this.mesh.position.z = halfGroundSize;
                this.velocity.z = 0;
            } else if (this.mesh.position.z < -halfGroundSize) {
                this.mesh.position.z = -halfGroundSize;
                this.velocity.z = 0;
            }
        }
        // Apply gravity
// Corrected previous GRAVITY constant name (was missing from provided snippet)
// Assuming GRAVITY is defined elsewhere, e.g., const GRAVITY = -18.0;
// This edit block is just to ensure the context for the next one is correct.
// No actual code change in this block for this step if GRAVITY is globally accessible or defined in class.
// For this specific step, we'll assume GRAVITY is implicitly available.
// The actual change is about the AI logic and animation handling.
// This is a placeholder to ensure the diff tool has a line to match.
// If GRAVITY is a class member (e.g. this.GRAVITY), no change needed here.
// If it was a local const, it might need to be this.GRAVITY or passed.
// For now, let's assume it's fine.
// ... (lines 184-189 from the previous response)
// this.velocity.y += GRAVITY * deltaTime;
// ...
// This block is primarily to adjust line numbers for the following important changes.
// The key modifications are in the AI decision-making and attack execution logic.
// No changes to gravity application itself in this step.
        const GRAVITY = -18.0; // Define GRAVITY if not already accessible
        if (!this.onGround) {
            this.velocity.y += GRAVITY * deltaTime; 
        } else {
            this.velocity.y = Math.max(0, this.velocity.y);
        }
        this.mesh.position.y += this.velocity.y * deltaTime;
        if (!this.onGround) {
            this.velocity.y += GRAVITY * deltaTime; // Simple gravity
        } else {
            this.velocity.y = Math.max(0, this.velocity.y);
        }
        this.mesh.position.y += this.velocity.y * deltaTime;
        // Ground check
        if (environment) {
            const groundLevel = environment.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
            if (this.mesh.position.y <= groundLevel) {
                this.mesh.position.y = groundLevel;
                this.velocity.y = 0;
                this.onGround = true;
            } else {
                this.onGround = false;
            }
        }
        // Player collision (after movement and ground check)
        this._handlePlayerCollision();
    }
    // Placeholder for taking damage
    takeDamage(amount) {
        this.health -= amount;
        console.log(`Enemy took ${amount} damage, health is now ${this.health}`);
        // Trigger damage flash
        this._flashMaterial();
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (!this.isAlive) return;
        this.isAlive = false;
        console.log("Enemy has died. Initializing death sequence.");
        // Play smoke effect for death
        if (this.mesh && this.effectUpdaters && typeof Enemy.playSpawnEffect === 'function') {
            this.deathSmokeEffect = Enemy.playSpawnEffect(this.scene, this.mesh.position, this.effectUpdaters);
            console.log("Death smoke effect initiated.");
        } else {
            if (!this.mesh) console.warn("Death smoke effect: Enemy mesh is null.");
            if (!this.effectUpdaters) console.warn("Death smoke effect: effectUpdaters array not provided to enemy.");
            if (typeof Enemy.playSpawnEffect !== 'function') console.warn("Death smoke effect: Enemy.playSpawnEffect is not a function.");
        }
        // Ensure material is reverted from any damage flash
        if (this.damageFlashTimer > 0) {
            this._revertMaterial();
            this.damageFlashTimer = 0; // Stop the flash timer logic in update
        }
        if (this.animations['death'] && this.mixer) {
            const deathAction = this.animations['death'];
            const currentClipName = this.currentAction ? this.currentAction.getClip().name : "None";
            console.log(`Current action before death: ${currentClipName}. Transitioning to death anim: ${deathAction.getClip().name}`);
            // Explicitly stop the current animation and play 'death' directly
            if (this.currentAction && this.currentAction !== deathAction) {
                this.currentAction.stop();
            }
            
            deathAction.reset(); // Ensure it plays from the start
            deathAction.setLoop(THREE.LoopOnce); // Should already be set, but re-affirm
            deathAction.clampWhenFinished = true; // Should already be set, but re-affirm
            deathAction.play();
            this.currentAction = deathAction; // Manually update currentAction
            console.log(`Playing '${deathAction.getClip().name}' for death. Is running: ${deathAction.isRunning()}. Mixer time: ${this.mixer.time.toFixed(2)}`);
            // The 'finished' listener in _loadModel should handle removal after animation.
        } else {
            console.log("No death animation found or mixer not available. Will remove after smoke effect (if any).");
            this.deathAnimationCompleted = true; // Mark animation as "done" since there isn't one
            // Mesh removal is handled by the update loop
        }
    }
    _loadSounds() {
        if (!this.audioListener) {
            console.warn("Enemy: AudioListener not provided, cannot load sounds.");
            return;
        }
        const loader = new AudioLoader();
        loader.load(ENEMY_ATTACK_SOUND_URL, (buffer) => {
            this.attackSoundBuffer = buffer;
            this.attackSound = new Audio(this.audioListener);
            this.attackSound.setBuffer(this.attackSoundBuffer);
            this.attackSound.setVolume(0.4); // Adjust volume as needed (0.0 to 1.0)
            console.log("Enemy attack sound loaded.");
        }, undefined, (error) => {
            console.error("Error loading enemy attack sound:", error);
        });
    }
    _performAttack(currentTime) {
        if (!this.isAlive || this.isAttacking || !this.animations['attack']) return;
        console.log("Enemy is attacking!");
        this.isAttacking = true;
        this.lastAttackTime = currentTime;
        this.playAnimation('attack', 0.1, THREE.LoopOnce, false); // Fast transition to attack
        if (this.attackSound && !this.attackSound.isPlaying) {
            this.attackSound.play();
        }
        // Deal damage after a delay (wind-up)
        setTimeout(() => {
            if (!this.isAlive || !this.player || !this.player.isAlive || !this.player.mesh || !this.mesh) {
                // Player might have died or enemy died during wind-up
                this.isAttacking = false; // Ensure state is reset if attack is aborted
                return;
            }
            const enemyPosition = this.mesh.position;
            const playerPosition = this.player.mesh.position;
            const distanceToPlayer = enemyPosition.distanceTo(playerPosition);
            if (distanceToPlayer <= this.attackRange * 1.2) { // Allow a little extra range for hit confirm
                const enemyForward = new THREE.Vector3();
                this.mesh.getWorldDirection(enemyForward);
                enemyForward.y = 0;
                enemyForward.normalize();
                const directionToPlayer = new THREE.Vector3().subVectors(playerPosition, enemyPosition);
                directionToPlayer.y = 0;
                directionToPlayer.normalize();
                const angle = enemyForward.angleTo(directionToPlayer);
                // Use a wider angle for enemy attacks to make them a bit more forgiving
                if (angle <= (Math.PI / 2)) { // 90 degree cone
                    console.log(`Enemy hits player! Dealing ${this.attackDamage} damage.`);
                    this.player.takeDamage(this.attackDamage);
                } else {
                    console.log("Enemy attack missed (angle).");
                }
            } else {
                console.log("Enemy attack missed (range).");
            }
            // isAttacking will be reset by the animation 'finished' listener
        }, this.attackWindUpTime * 1000);
    }
playAnimation(name, crossFadeDuration = 0.3, loop = THREE.LoopRepeat, clampWhenFinished = false) {
    if (!this.mesh || !this.mixer) return; // Ensure mesh and mixer are ready
    let targetAction = this.animations[name];
    if (!targetAction) {
        // Attempt common fallbacks if direct name not found
        if (name.toLowerCase() === 'idle' && this.animations['Idle']) {
            targetAction = this.animations['Idle'];
        } else if (name.toLowerCase() === 'walk') { // General 'walk' request
            // Prefer 'Walking_A', then 'walk' (which holds the primary loaded walk/run)
            targetAction = this.animations['walking_a'] || this.animations['walk'] || this.animations['Walking_B'] || this.animations['Walking_C'];
        } else if (name.toLowerCase() === 'walking_a' && this.animations['walking_a']) {
            targetAction = this.animations['walking_a'];
        } else if (name.toLowerCase() === 'walking_b' && this.animations['walking_b']) {
            targetAction = this.animations['walking_b'];
        } else if (name.toLowerCase() === 'walking_backwards' && this.animations['walking_backwards']) {
            targetAction = this.animations['walking_backwards'];
        } else if (name.toLowerCase() === 'walking_c' && this.animations['walking_c']) {
            targetAction = this.animations['walking_c'];
        } else if (name.toLowerCase() === 'attack' && this.animations['1H_Melee_Attack_Chop']) {
             targetAction = this.animations['1H_Melee_Attack_Chop'];
        }
        
        if (!targetAction) {
            // console.warn(`Enemy animation "${name}" not found.`); // Can be noisy
            return;
        }
    }
    // If this action is already the current one and is running:
    // - For looping animations, do nothing.
    // - For LoopOnce animations (like 'attack'), also do nothing if it's already running (let it finish).
    if (this.currentAction === targetAction && targetAction.isRunning()) {
        return;
    }
    // Prepare the target action
    targetAction.enabled = true; // Make sure it's enabled before potential play/fade
    targetAction.setLoop(loop);
    targetAction.clampWhenFinished = clampWhenFinished;
    // Always reset LoopOnce animations before playing them or fading to them,
    // if they are not the current running action or if they are but finished.
    if (loop === THREE.LoopOnce) {
        targetAction.reset();
    }
    if (this.currentAction && this.currentAction !== targetAction) {
        // If there's a current action and it's different, fade to the new one
        // Stop the current action before fading to prevent issues if currentAction is also LoopOnce
        if (this.currentAction.loop === THREE.LoopOnce) {
            this.currentAction.stop(); // Stop explicitly if it was a non-looping one
        }
        this.currentAction.crossFadeTo(targetAction, crossFadeDuration, true);
        targetAction.play(); // Must play the action being faded TO
    } else {
        // No current action, or it's the same action but wasn't running (e.g., a LoopOnce that finished)
        targetAction.play();
    }
    this.currentAction = targetAction;
}
    _flashMaterial() {
        if (!this.mesh) return;
        this.damageFlashTimer = this.damageFlashDuration;
        this.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.color) mat.emissive.copy(this.damageFlashColor); // Use emissive for flash
                    });
                } else {
                    if (child.material.color) child.material.emissive.copy(this.damageFlashColor);
                }
            }
        });
    }
    _revertMaterial() {
        if (!this.mesh) return;
        this.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat, index) => {
                        const originalMat = this.originalMaterials.get(`${child.uuid}_${index}`);
                        if (originalMat && mat.emissive) mat.emissive.set(0x000000); // Reset emissive
                        // Note: If other properties were changed, revert them here.
                        // For simple color flash, just resetting emissive is often enough.
                        // Or, more robustly, copy all properties from originalMat.
                        // e.g., mat.copy(originalMat); but this might be too much if only color/emissive changed.
                    });
                } else {
                    const originalMat = this.originalMaterials.get(child.uuid);
                    if (originalMat && child.material.emissive) child.material.emissive.set(0x000000);
                }
            }
        });
    }
    _handlePlayerCollision() {
        if (!this.mesh || !this.player || !this.player.mesh || !this.player.isAlive) {
            return;
        }
        const enemyPosition = this.mesh.position;
        const playerPosition = this.player.mesh.position;
        // Using PLAYER_RADIUS from player.js would be better if accessible
        // For now, assuming a similar radius for player for this check.
        const playerRadius = this.player.radius || 0.4; // Use player's radius if available
        const combinedRadii = this.radius + playerRadius;
        const distanceSq = enemyPosition.distanceToSquared(playerPosition);
        if (distanceSq < combinedRadii * combinedRadii) {
            // Collision detected
            const distance = Math.sqrt(distanceSq);
            const overlap = combinedRadii - distance;
            if (distance === 0) { // Avoid division by zero if perfectly overlapped
                // Nudge enemy randomly if perfectly on top
                this.mesh.position.x += (Math.random() - 0.5) * 0.1;
                this.mesh.position.z += (Math.random() - 0.5) * 0.1;
                return;
            }
            const pushDirection = new THREE.Vector3().subVectors(enemyPosition, playerPosition).normalize();
            
            // Push enemy away from player
            this.mesh.position.addScaledVector(pushDirection, overlap);
            // Optional: Slightly reduce enemy velocity if it was moving towards player
            // This helps prevent "sticking" due to continuous movement updates.
            const movingTowardsPlayer = this.velocity.dot(pushDirection.clone().negate()) > 0;
            if (movingTowardsPlayer) {
                this.velocity.multiplyScalar(0.8); // Dampen velocity
            }
        }
    }
}
// Removed the extra closing brace that was here causing the syntax error
class SpawnSmokeEffect {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position.clone();
        this.particles = [];
        this.isFinished = false;
        this.effectGroup = new THREE.Group();
        this.scene.add(this.effectGroup);
        const numParticles = 10 + Math.floor(Math.random() * 5); // 10 to 14 particles
        const texture = Enemy.getSmokeParticleTexture();
        for (let i = 0; i < numParticles; i++) {
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: 0xaaaaaa, // Greyish smoke
                transparent: true,
                opacity: 0.6 + Math.random() * 0.2, // Initial opacity
                blending: THREE.NormalBlending, 
                depthWrite: false 
            });
            const sprite = new THREE.Sprite(material);
            const initialScale = 0.4 + Math.random() * 0.7;
            sprite.scale.set(initialScale, initialScale, initialScale);
            
            // Spawn particles slightly above the given position (ground level)
            sprite.position.copy(this.position);
            sprite.position.y += 0.2; // Start slightly above ground
            sprite.position.x += (Math.random() - 0.5) * 0.3;
            sprite.position.z += (Math.random() - 0.5) * 0.3;
            const particleData = {
                sprite: sprite,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 1.2, 
                    0.6 + Math.random() * 1.0,   
                    (Math.random() - 0.5) * 1.2  
                ),
                life: 0.9 + Math.random() * 0.8, 
                initialLife: 0,
                rotationSpeed: (Math.random() - 0.5) * 1.5,
                scaleFactor: 1.2 + Math.random() * 0.8 
            };
            particleData.initialLife = particleData.life;
            this.particles.push(particleData);
            this.effectGroup.add(sprite);
        }
    }
    update(deltaTime) {
        if (this.isFinished) return;
        let allParticlesDead = true;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.effectGroup.remove(p.sprite);
                p.sprite.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            allParticlesDead = false;
            p.sprite.position.addScaledVector(p.velocity, deltaTime);
            p.velocity.y -= 2.0 * deltaTime; // Gravity on smoke
            const lifeRatio = p.life / p.initialLife;
            p.sprite.material.opacity = Math.max(0, lifeRatio * (0.6 + Math.random()*0.1)); // Fade out
            
            const currentScale = p.sprite.scale.x;
            const scaleIncrease = p.scaleFactor * deltaTime * (0.5 + lifeRatio * 0.5); // Grow more when new
            p.sprite.scale.set(currentScale + scaleIncrease, currentScale + scaleIncrease, currentScale + scaleIncrease);
            
            p.sprite.material.rotation += p.rotationSpeed * deltaTime;
        }
        if (allParticlesDead && this.particles.length === 0) {
            this.isFinished = true;
            this.scene.remove(this.effectGroup);
            // console.log("Smoke effect finished and removed.");
        }
    }
}