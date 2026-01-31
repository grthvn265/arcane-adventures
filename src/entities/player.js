import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Inventory } from 'Inventory'; // Import the Inventory class
const PLAYER_HEIGHT = 1.8; // Keep for camera target offset logic
const PLAYER_RADIUS = 0.4; // Keep for simple collision logic for now
const MOVEMENT_SPEED = 5.0;
const JUMP_VELOCITY = 7.0;
const GRAVITY = -18.0;
const CAMERA_DISTANCE = 6.0; // Slightly further back
const CAMERA_HEIGHT = 1.8; // Slightly lower target height
const CAMERA_LAG = 0.1;
const ROTATION_SPEED = 10.0; // Default camera rotation speed, will be multiplied by sensitivity
const BASE_CAMERA_ROTATION_SPEED = 0.005;
const CAMERA_PITCH_MIN = -Math.PI / 3;
const CAMERA_PITCH_MAX = Math.PI / 2.5;

export class Player {
    constructor(game, scene, camera) { // Add game as the first argument
        this.game = game; // Store the game instance
        this.scene = scene;
        this.camera = camera;
        this.health = 100;
        this.maxHealth = 100;
        this.mana = 50;
        this.maxMana = 50;
        this.attackManaCost = 5; // Mana cost per attack
        this.attackDamage = 15; // Amount of damage player's attack deals
        this.attackRange = 2.0; // How close player needs to be to hit (adjust to match animation)
        this.attackAngle = Math.PI / 2.5; // Cone of attack in front of player (90 degrees total, 45 each side)
        this.defenseDamageReduction = 0.5; // 50% damage reduction while defending
        this.mesh = null; // Initialize mesh as null, will be loaded async
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.moveDirection = new THREE.Vector3();
        this.targetCameraPosition = new THREE.Vector3();
        this.currentCameraPosition = new THREE.Vector3();
        this.cameraPhi = 0;
        this.cameraTheta = Math.PI / 6;
        // Mana Regeneration
        this.manaRegenRate = 5; // Mana per second
        this.manaRegenCooldown = 1.5; // Seconds after mana use before regen starts
        this.lastManaUseTime = -Infinity; // Time mana was last used
        // Animation properties
        this.mixer = null;
        this.animations = {}; // Store actions by name
        this.currentAction = null;
        this.isJumping = false; // Track jump state for animation
        this.isAttacking = false; // Track attack state
        this.isDefending = false; // Track defense state
        this.attackCooldown = 0.8; // Seconds between attacks
        this.lastAttackTime = -Infinity; // Time of the last attack start
		this.isAlive = true; // Player starts alive
		this.inventory = new Inventory(12); // Player has a 12-slot inventory
		this._loadModel();
		this._updateCameraRotation(0, 0); // Initial rotation setup
	}
    _loadModel() {
        const loader = new GLTFLoader();
        const modelUrl = 'https://play.rosebud.ai/assets/Knight.glb?QjIz';
        loader.load(modelUrl, (gltf) => {
            this.mesh = gltf.scene;
            this.mesh.scale.set(1.0, 1.0, 1.0); // Adjust scale if needed
            this.mesh.position.set(0, 0, 5); // Initial position, Y adjusted by collision later
            // Set shadows for all meshes in the loaded model
            this.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = false; // Typically characters don't receive on themselves
                }
            });
            this.scene.add(this.mesh);
            // Initialize camera position *after* mesh is loaded and added
            this.currentCameraPosition.copy(this.mesh.position).add(this._calculateCameraOffset());
            this.camera.position.copy(this.currentCameraPosition);
            this.camera.lookAt(this._getCameraLookAtTarget());
             // --- Animation Setup ---
             this.mixer = new THREE.AnimationMixer(this.mesh);
             const clips = gltf.animations;
             console.log("Available animations:", clips.map(clip => clip.name)); // DEBUG LOG - List all animation names
             // Find specific clips (adjust names if needed based on the GLB file)
             let idleClip = THREE.AnimationClip.findByName(clips, 'Idle');
             if (!idleClip) {
                 console.warn("'Idle' animation not found. Trying 'Stand'...");
                 idleClip = THREE.AnimationClip.findByName(clips, 'Stand');
             }
             if (!idleClip) {
                console.warn("'Stand' animation not found. Using the first available animation as idle if present.");
             }
             // TPose_Idle check removed
             if (!idleClip && clips.length > 0) {
                 console.warn("No specific idle animation ('Idle', 'Stand') found. Using the first available animation as idle: " + clips[0].name);
                 idleClip = clips[0]; // Use the first animation in the list as a fallback
             }
            // --- Find WALK/MOVE Animation ---
            // Prioritize specific walking animations
            this.animations['walking_a'] = THREE.AnimationClip.findByName(clips, 'Walking_A');
            this.animations['walking_b'] = THREE.AnimationClip.findByName(clips, 'Walking_B');
            this.animations['walking_backwards'] = THREE.AnimationClip.findByName(clips, 'Walking_Backwards');
            this.animations['walking_c'] = THREE.AnimationClip.findByName(clips, 'Walking_C');
            // Fallback to generic walk if specifics aren't found
            if (!this.animations['walking_a'] && !this.animations['walking_b'] && !this.animations['walking_c']) {
                let genericWalkClip = THREE.AnimationClip.findByName(clips, 'Walk') || THREE.AnimationClip.findByName(clips, 'walk');
                if (genericWalkClip) {
                    this.animations['walking_a'] = genericWalkClip; // Use 'walking_a' as the primary generic walk slot
                    console.warn("Specific walk animations (A, B, C) not found. Using generic 'Walk'/'walk' for 'walking_a'.");
                }
            }
            
            // --- Find RUN Animation ---
            this.animations['running_a'] = THREE.AnimationClip.findByName(clips, 'Running_A');
            this.animations['running_b'] = THREE.AnimationClip.findByName(clips, 'Running_B');
            // Determine primaryMoveClip: Prefer Walking_A, then B, then C, then generic Walk, then Running_A
            // --- DIAGNOSTIC: Force Running_A as primary move clip ---
            let primaryMoveClip = this.animations['running_a'];
            let forcedDiagnosticAnim = false;
            if (primaryMoveClip) {
                console.warn("DIAGNOSTIC: Attempting to force 'Running_A' as primary movement animation.");
                forcedDiagnosticAnim = true;
            } else {
                // Fallback to original logic if Running_A is not found
                console.warn("DIAGNOSTIC: 'Running_A' not found for diagnostic. Reverting to original primaryMoveClip logic.");
                primaryMoveClip = this.animations['walking_a'] || this.animations['walking_b'] || this.animations['walking_c'];
                if (!primaryMoveClip) {
                    primaryMoveClip = this.animations['running_a'] || this.animations['running_b']; // This will also be null if the above check failed for running_a
                    if (primaryMoveClip) {
                        console.warn("No walk animations found. Using a running animation as primary movement.");
                    } else {
                        // Final fallback to any 'Run' or 'run' clip if even specific running anims are missing
                        let genericRunClip = THREE.AnimationClip.findByName(clips, 'Run') || THREE.AnimationClip.findByName(clips, 'run');
                        primaryMoveClip = genericRunClip;
                        if (primaryMoveClip) {
                           console.warn("No specific walk or run animations found. Using generic 'Run'/'run' as primary movement.");
                        }
                    }
                }
            }
            if(forcedDiagnosticAnim && !primaryMoveClip) {
                // This case should ideally not be hit if Running_A was expected but somehow became null after assignment.
                // For safety, ensure primaryMoveClip doesn't proceed as null if diagnostic assignment failed unexpectedly.
                // Re-run original logic as a comprehensive fallback.
                console.warn("DIAGNOSTIC: 'Running_A' was initially found but became null. Re-evaluating primaryMoveClip with full logic.");
                 primaryMoveClip = this.animations['walking_a'] || this.animations['walking_b'] || this.animations['walking_c'] ||
                                  this.animations['running_a'] || this.animations['running_b'] ||
                                  THREE.AnimationClip.findByName(clips, 'Run') || THREE.AnimationClip.findByName(clips, 'run');
            }
            // --- End DIAGNOSTIC ---
            // The existing console.log for "Player: Determined primaryMoveClip to be:" will show what was ultimately selected.
            // --- End Find WALK/MOVE ---
            // --- Find JUMP Animations ---
            this.animations['jump_full_long'] = THREE.AnimationClip.findByName(clips, 'Jump_Full_Long');
            this.animations['jump_full_short'] = THREE.AnimationClip.findByName(clips, 'Jump_Full_Short');
            this.animations['jump_idle'] = THREE.AnimationClip.findByName(clips, 'Jump_Idle');
            const jumpClip = this.animations['jump_idle'] || THREE.AnimationClip.findByName(clips, 'Jump'); // Prioritize Jump_Idle
            const attackClip = THREE.AnimationClip.findByName(clips, '1H_Melee_Attack_Slice_Diagonal');
            const attackChopClip = THREE.AnimationClip.findByName(clips, '1H_Melee_Attack_Chop');
            // Note: The separate 'runClip' loading is removed; its candidates are now part of primaryMoveClip search.
            if (idleClip) {
                 this.animations['idle'] = this.mixer.clipAction(idleClip);
                 this.animations['idle'].setLoop(THREE.LoopRepeat); // Ensure idle animation loops
                 this.animations['idle'].play(); // Start in idle state
                 this.currentAction = this.animations['idle'];
                 console.log(`Using '${idleClip.name}' as idle animation.`);
             } else {
                console.error("CRITICAL: No suitable idle animation found for the player model. Player may remain in T-pose.");
             }
            // Load PRIMARY MOVE animation into 'walk' action (still using 'walk' as the key for the primary one)
            if (primaryMoveClip) {
               this.animations['walk'] = this.mixer.clipAction(primaryMoveClip); // This will be the default walk/run
               this.animations['walk'].setLoop(THREE.LoopRepeat);
               console.log(`Primary movement animation loaded into 'walk': ${primaryMoveClip.name}`);
            } else {
                console.warn("CRITICAL: No suitable primary movement animation found. Player movement may not animate.");
            }
            // Process all found walk animations
            ['walking_a', 'walking_b', 'walking_backwards', 'walking_c'].forEach(name => {
                if (this.animations[name] && this.animations[name] !== primaryMoveClip) { // Avoid re-processing if it's the primary
                    this.animations[name] = this.mixer.clipAction(this.animations[name]);
                    this.animations[name].setLoop(THREE.LoopRepeat);
                    console.log(`${name} animation loaded.`);
                } else if (this.animations[name] === primaryMoveClip && name !== 'walk') {
                    // If it was chosen as primary, ensure it's also accessible by its specific name if different from 'walk'
                    this.animations[name] = this.animations['walk']; 
                }
            });
            // Process all found run animations
            ['running_a', 'running_b'].forEach(name => {
                if (this.animations[name] && this.animations[name] !== primaryMoveClip) {
                    this.animations[name] = this.mixer.clipAction(this.animations[name]);
                    this.animations[name].setLoop(THREE.LoopRepeat);
                    console.log(`${name} animation loaded.`);
                } else if (this.animations[name] === primaryMoveClip && name !== 'walk') {
                     this.animations[name] = this.animations['walk'];
                }
            });
            
            // Process JUMP animations
            const jumpAnims = {'jump': jumpClip, // 'jump' key will store the primary jump animation
                               'jump_full_long': this.animations['jump_full_long'],
                               'jump_full_short': this.animations['jump_full_short'],
                               'jump_idle': this.animations['jump_idle']}; // Keep original Jump_Idle if it was specifically found and not the primary 'jumpClip'
            
            for (const [key, clip] of Object.entries(jumpAnims)) {
                if (clip) {
                    // If the clip is already an AnimationAction (because it was primaryMoveClip or similar), don't re-create
                    if (clip instanceof THREE.AnimationClip) {
                        this.animations[key] = this.mixer.clipAction(clip);
                    } else if (clip instanceof THREE.AnimationAction) {
                         this.animations[key] = clip; // Already an action
                    } else {
                        continue; // Skip if not a clip or action
                    }
                    this.animations[key].setLoop(THREE.LoopOnce);
                    this.animations[key].clampWhenFinished = true;
                    console.log(`${key} animation loaded (Clip: ${clip.name || clip._clip.name}).`);
                } else {
                    // Only warn if it's the primary 'jump' that's missing and wasn't found via 'Jump_Idle' or 'Jump'
                    if (key === 'jump') console.warn("Primary jump animation ('Jump_Idle' or 'Jump') not found in model.");
                    // else console.log(`${key} animation not found.`); // Less critical for non-primary jumps
                }
            }
            if (attackClip) {
                this.animations['attack'] = this.mixer.clipAction(attackClip);
                this.animations['attack'].setLoop(THREE.LoopOnce);
                // No clampWhenFinished needed if we transition back manually
                 console.log("Attack animation loaded.");
                 // Listen for the attack animation to finish
                 this.mixer.addEventListener('finished', (e) => {
                     if (e.action === this.animations['attack']) {
                         this.isAttacking = false; // Reset attack state when animation completes
                     }
                 });
             } else {
                 console.warn("Attack animation not found in model.");
             }
             if (attackChopClip) {
                this.animations['attack_chop'] = this.mixer.clipAction(attackChopClip);
                this.animations['attack_chop'].setLoop(THREE.LoopOnce);
                console.log("1H_Melee_Attack_Chop animation loaded as 'attack_chop'.");
                // We might need a separate event listener if it behaves differently
                this.mixer.addEventListener('finished', (e) => {
                    if (e.action === this.animations['attack_chop']) {
                        this.isAttacking = false; // Reset attack state for chop attack
                        console.log("Attack_chop animation finished."); // Optional: for debugging
                    }
                });
             } else {
                console.warn("1H_Melee_Attack_Chop animation not found in model.");
             }
            // --- Load Death Animation ---
            const deathClip = THREE.AnimationClip.findByName(clips, 'Death_A');
            if (deathClip) {
                this.animations['death'] = this.mixer.clipAction(deathClip);
                this.animations['death'].setLoop(THREE.LoopOnce);
                this.animations['death'].clampWhenFinished = true;
                console.log("Death_A animation loaded as 'death'.");
            } else {
                console.warn("'Death_A' animation not found in model. Player death may not animate correctly.");
            }
            // The 'runClip' loading block (previously here) has been removed
            // as its candidates ('Running_A', etc.) are now included in the
            // 'primaryMoveClip' search logic and loaded into this.animations['walk'].
            // Load Defend animation (or use Idle as fallback)
            const defendClip = THREE.AnimationClip.findByName(clips, 'Defend') || THREE.AnimationClip.findByName(clips, 'Block');
            if (defendClip) {
                this.animations['defend'] = this.mixer.clipAction(defendClip);
                this.animations['defend'].setLoop(THREE.LoopRepeat); // Defensive stance usually loops
                console.log("Defend/Block animation loaded.");
            } else {
                // Fallback to Idle if no specific defend animation and Idle exists
                if (this.animations['idle']) {
                    this.animations['defend'] = this.animations['idle']; // Use idle as a placeholder
                    // Ensure the fallback also loops if it's intended for a held state
                    this.animations['defend'].setLoop(THREE.LoopRepeat); 
                    console.warn("Defend/Block animation not found in model. Using 'Idle' as placeholder for 'defend'.");
                } else {
                    console.warn("Defend/Block animation not found, and Idle animation also not available for fallback for 'defend'.");
                }
            }
             // --- End Animation Setup ---
            console.log("Knight model loaded successfully.");
        }, undefined, (error) => {
            console.error('An error happened loading the player model:', error);
            // Fallback or error handling: maybe create a simple box?
            const fallbackGeometry = new THREE.BoxGeometry(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2);
            const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            this.mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            this.mesh.position.set(0, PLAYER_HEIGHT / 2, 5); // Pivot at base
            this.mesh.castShadow = true;
            this.scene.add(this.mesh);
             // Initialize camera for fallback
            this.currentCameraPosition.copy(this.mesh.position).add(this._calculateCameraOffset());
            this.camera.position.copy(this.currentCameraPosition);
            this.camera.lookAt(this._getCameraLookAtTarget());
        });
    }
    // Updated signature: now receives keys directly, but keeps inputHandler for mouse/attack
    update(deltaTime, keys, inputHandler, environment) {
        // Wait until the mesh and mixer are ready
        if (!this.mesh || !this.mixer) return;
        if (!this.isAlive) {
            // If player is not alive, only update mixer for potential death animation and gravity
            if (this.mixer) this.mixer.update(deltaTime);
            this._applyGravity(deltaTime); // Keep applying gravity so they fall
            this._checkCollisions(environment); // Keep checking collisions (e.g. with ground)
            // Do not process input or other updates
            return;
        }
        this._handleInput(keys, inputHandler, deltaTime); // Pass keys and inputHandler separately
        this._regenerateMana(deltaTime); // Add mana regeneration
        // --- Animation State ---
        const isMoving = this.moveDirection.lengthSq() > 0.01; // Used for walk/idle when not attacking/defending
        let targetActionName = 'idle'; // Default action
        if (this.isAttacking && this.animations['attack']) {
            targetActionName = 'attack';
        } else if (this.isDefending && this.animations['defend']) {
            targetActionName = 'defend';
        } else if (!this.onGround) { // Player is in the air (and not attacking/defending)
            if (this.isJumping && this.animations['jump']) {
                targetActionName = 'jump'; 
            } else { // Falling or jump animation finished mid-air
                targetActionName = 'idle'; // Fallback to idle (or a specific falling animation)
                if (this.animations['jump']?.isRunning()) { // Let jump finish if it was running
                    targetActionName = 'jump';
                }
            }
        } else { // Player is on the ground (and not attacking/defending)
            if (isMoving && this.animations['walk']) {
                targetActionName = 'walk';
            } else {
                targetActionName = 'idle';
            }
            // Reset jump flag only when grounded and not in a higher priority state
            if (this.isJumping) { 
                this.isJumping = false;
                // Don't abruptly stop jump animation if it's fading out or just finished
                // The animation state logic will handle transitioning away from 'jump'
            }
        }
        // Switch animation if the target is different from the current one
        if (this.animations[targetActionName] && this.currentAction !== this.animations[targetActionName]) {
            const nextAction = this.animations[targetActionName];
            nextAction.reset(); 
            nextAction.enabled = true;
            if (targetActionName === 'attack') {
                nextAction.setLoop(THREE.LoopOnce); // Ensure attack plays once
                nextAction.clampWhenFinished = true; // Clamp attack to hold last frame for smoother transition
                nextAction.play();
                if (this.currentAction && this.currentAction !== nextAction) {
                    this.currentAction.fadeOut(0.1);
                }
            } else if (targetActionName === 'attack_chop') { // Handle the new attack animation
                nextAction.setLoop(THREE.LoopOnce);
                nextAction.clampWhenFinished = true; // Clamp attack_chop to hold last frame
                nextAction.play();
                if (this.currentAction && this.currentAction !== nextAction) {
                    this.currentAction.fadeOut(0.1);
                }
            } else if (targetActionName === 'defend') {
                nextAction.setLoop(THREE.LoopRepeat); // Ensure defend loops
                nextAction.play();
                if (this.currentAction && this.currentAction !== nextAction) {
                    this.currentAction.fadeOut(0.2); 
                }
            } else if (targetActionName === 'jump') {
                nextAction.setLoop(THREE.LoopOnce); // Ensure jump plays once
                nextAction.clampWhenFinished = true; // Jump should hold last frame
                nextAction.play();
                if (this.currentAction && this.currentAction !== nextAction) {
                    this.currentAction.fadeOut(0.1);
                }
            } else { // Idle/Walk transitions
                nextAction.setLoop(THREE.LoopRepeat); // Idle and Walk should loop
                if (this.currentAction) {
                    this.currentAction.crossFadeTo(nextAction, 0.3, true);
                    nextAction.play(); // Ensure the idle/walk animation is played after fading
                } else {
                    nextAction.play(); 
                }
            }
            this.currentAction = nextAction;
        }
        // --- End Animation State ---
        // --- Player Rotation ---
        // Rotate only when moving on the ground AND not attacking
        if (isMoving && this.onGround && !this.isAttacking) {
        // Convert world-space moveDirection to camera-relative direction
        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0; // Ignore vertical component for movement rotation
        cameraForward.normalize();
        const cameraRight = new THREE.Vector3().crossVectors(this.camera.up, cameraForward).normalize();
        const moveLocal = new THREE.Vector3();
        moveLocal.addScaledVector(cameraForward, this.moveDirection.z);
        moveLocal.addScaledVector(cameraRight, this.moveDirection.x);
        moveLocal.normalize();
        const targetAngle = Math.atan2(moveLocal.x, moveLocal.z);
        const targetQuaternion = new THREE.Quaternion();
        targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
        // Interpolate player model rotation
        this.mesh.quaternion.slerp(targetQuaternion, deltaTime * ROTATION_SPEED);
    }
    this._applyMovement(deltaTime); // Apply camera-relative movement
    this._applyGravity(deltaTime);
    this._checkCollisions(environment);
    this._updateCamera(deltaTime);
     // Update animation mixer
     this.mixer.update(deltaTime);
    // Reset mouse delta after using it
    inputHandler.resetMouseDelta();
    }
    _getCameraLookAtTarget() {
        // Target roughly the center of the loaded mesh
        if (!this.mesh) return new THREE.Vector3(); // Return default if mesh not loaded
        return this.mesh.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT * 0.7, 0)); // Adjust height offset
    }
    _updateCameraRotation(deltaX, deltaY) {
    const effectiveRotationSpeed = BASE_CAMERA_ROTATION_SPEED * (this.game.settings.cameraSensitivity || 1.0);
    this.cameraPhi -= deltaX * effectiveRotationSpeed;
    this.cameraTheta += deltaY * effectiveRotationSpeed;
    // Clamp vertical rotation (theta)
    this.cameraTheta = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, this.cameraTheta));
}
// Public method to update sensitivity if game settings change
// Note: Sensitivity is now read directly from game.settings in _updateCameraRotation
// So this explicit method might not be strictly needed unless there are other things to update.
// setCameraSensitivity(sensitivity) {
    // this.cameraSensitivity = sensitivity; // Store it locally if preferred
// }
_calculateCameraOffset() {
    const offset = new THREE.Vector3();
    // Calculate offset using spherical coordinates
    offset.x = CAMERA_DISTANCE * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    offset.y = CAMERA_DISTANCE * Math.sin(this.cameraTheta) + CAMERA_HEIGHT; // Add base height
    offset.z = CAMERA_DISTANCE * Math.cos(this.cameraPhi) * Math.cos(this.cameraTheta);
    return offset;
}
// Updated signature: receives keys directly
_handleInput(keys, inputHandler, deltaTime) {
    if (!this.mesh || !this.mixer) return;
    this._updateCameraRotation(inputHandler.mouseDeltaX, inputHandler.mouseDeltaY);
    const leftMouseDown = inputHandler.mouseButtonDown === 0;
    const rightMouseDown = inputHandler.mouseButtonDown === 2;
    const now = this.mixer.time;
    // --- State Updates based on Input ---
    // Try to start an attack (Left Click)
    if (leftMouseDown && !this.isAttacking && !this.isDefending &&
        (now - this.lastAttackTime) >= this.attackCooldown && this.animations['attack'] &&
        this.mana >= this.attackManaCost) { // Check for sufficient mana
        this.isAttacking = true;
        this.lastAttackTime = now;
        this.mana -= this.attackManaCost; // Consume mana
        this.lastManaUseTime = now; // Update last mana use time
        if (this.game && this.game.uiManager) { // Update UI
            this.game.uiManager.updateMana(this.mana, this.maxMana);
        }
        this.isDefending = false; // Attack overrides defense
        // Play the new player-specific attack sound
        if (this.game && this.game.playerAttackSound) { // Check for the new sound
            this.game.playSoundEffect(this.game.playerAttackSound);
        } else if (this.game && this.game.attackSound) { // Fallback to generic attack sound if new one isn't loaded
            console.warn("Player attack sound not loaded, using generic attack sound as fallback.");
            this.game.playSoundEffect(this.game.attackSound);
        }
        console.log(`Attack triggered! Playing player attack sound. Mana left: ${this.mana}`);
        // --- Deal Damage Logic ---
        this._dealDamage();
    } else if (leftMouseDown && this.mana < this.attackManaCost && !this.isAttacking && !this.isDefending && 
               (now - this.lastAttackTime) >= this.attackCooldown && this.animations['attack']) { // Ensure other conditions met before insufficient mana message
        // Optionally, play a "not enough mana" sound or show a UI message
        console.log("Not enough mana to attack.");
        // You could add a brief sound effect here via this.game.playSoundEffect(...)
        // Or a UI notification if this.game.uiManager.showNotification("Not enough mana!") exists
    }
    // Update defending state (Right Click)
    // Can only start or continue defending if not currently in an attack animation sequence
    if (rightMouseDown && !this.isAttacking) {
        this.isDefending = true;
    } else if (!rightMouseDown && this.isDefending) {
        // If was defending, but right mouse is no longer down (or another button is, or no button)
        this.isDefending = false;
    }
    // Ensure attack state takes precedence if an attack was just initiated
    if (this.isAttacking) {
        this.isDefending = false;
    }
    // --- Movement and Jump based on State ---
    if (this.isAttacking || this.isDefending) {
        // Stop all horizontal movement if attacking or defending
        this.moveDirection.set(0, 0, 0);
        this.velocity.x = 0;
        this.velocity.z = 0;
        // Note: Vertical velocity (gravity/jump) is handled separately by _applyGravity
    } else {
        // --- Movement Input (only if not attacking or defending) ---
        let forward = 0;
        let right = 0;
        if (keys['w'] || keys['arrowup']) { forward += 1; }
        if (keys['s'] || keys['arrowdown']) { forward -= 1; }
        if (keys['a'] || keys['arrowleft']) { right += 1; } 
        if (keys['d'] || keys['arrowright']) { right -= 1; } 
        this.moveDirection.set(right, 0, forward);
        if (this.moveDirection.lengthSq() > 0) {
            this.moveDirection.normalize();
        }
        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();
        const cameraRight = new THREE.Vector3().crossVectors(this.camera.up, cameraForward).normalize();
        
        const desiredVelocity = new THREE.Vector3();
        desiredVelocity.addScaledVector(cameraForward, this.moveDirection.z * MOVEMENT_SPEED);
        desiredVelocity.addScaledVector(cameraRight, this.moveDirection.x * MOVEMENT_SPEED);
        
        this.velocity.x = desiredVelocity.x;
        this.velocity.z = desiredVelocity.z;
        // --- Jump Input (only if not attacking or defending, and on ground) ---
        if (keys[' '] && this.onGround) { 
            this.velocity.y = JUMP_VELOCITY;
            this.onGround = false;
            this.isJumping = true;
            if (this.game && this.game.jumpSound) {
                this.game.playSoundEffect(this.game.jumpSound);
            }
        }
    }
}
_applyMovement(deltaTime) {
    // Calculate displacement based on X and Z velocity only
    const displacement = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).multiplyScalar(deltaTime);
    this.mesh.position.add(displacement);
}
     _applyGravity(deltaTime) {
        if (!this.onGround) {
            this.velocity.y += GRAVITY * deltaTime;
        } else {
            this.velocity.y = Math.max(0, this.velocity.y); // Prevent sinking if already on ground
        }
        const verticalDisplacement = new THREE.Vector3(0, this.velocity.y * deltaTime, 0);
        this.mesh.position.add(verticalDisplacement);
    }

    _checkCollisions(environment) {
        if (!this.mesh) return; // Need mesh for collision checks
        // Simple ground collision (using mesh base)
        const groundLevel = environment.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
        if (this.mesh.position.y <= groundLevel) {
            this.mesh.position.y = groundLevel;
            this.velocity.y = 0;
            this.onGround = true;
            // Landing logic handled in the animation state section of update()
        } else {
            this.onGround = false;
        }
        // --- Tree Collision ---
        if (environment && environment.trees && environment.trees.children.length > 0) {
            const playerPos2D = new THREE.Vector2(this.mesh.position.x, this.mesh.position.z);
            const collisionRadius = PLAYER_RADIUS + 0.8; // Player radius + approx tree radius
            const collisionRadiusSq = collisionRadius * collisionRadius;
            environment.trees.children.forEach(tree => {
                // Ensure tree has position data (might not be loaded instantly)
                if (!tree.position) return;
                const treePos2D = new THREE.Vector2(tree.position.x, tree.position.z);
                const distanceSq = playerPos2D.distanceToSquared(treePos2D);
                if (distanceSq < collisionRadiusSq) {
                    // Collision detected!
                    const collisionVector = playerPos2D.clone().sub(treePos2D).normalize();
                    const pushBackDistance = collisionRadius - Math.sqrt(distanceSq);
                    // Apply correction directly to mesh position
                    this.mesh.position.x += collisionVector.x * pushBackDistance;
                    this.mesh.position.z += collisionVector.y * pushBackDistance; // Vector2 y corresponds to world z
                    // Optional: Dampen velocity in the direction of the collision (simple approach)
                    // This helps prevent sticking or jittering in some cases
                    const velocityCorrection = new THREE.Vector3(collisionVector.x, 0, collisionVector.y);
                    const velocityInCollisionDir = this.velocity.dot(velocityCorrection);
                    if (velocityInCollisionDir > 0) { // Only correct if moving towards the tree
                         // Replace subScaledVector with multiplyScalar and sub
                         const correctionAmount = velocityCorrection.clone().multiplyScalar(velocityInCollisionDir * 0.5);
                         this.velocity.sub(correctionAmount); // Reduce velocity into the tree
                    }
                }
			});
		}
        // --- World Border Check ---
        if (environment && environment.ground) {
            const groundSize = environment.ground.geometry.parameters.width;
            const halfGroundSize = groundSize / 2;
            if (this.mesh.position.x > halfGroundSize - PLAYER_RADIUS) {
                this.mesh.position.x = halfGroundSize - PLAYER_RADIUS;
                this.velocity.x = 0;
            } else if (this.mesh.position.x < -halfGroundSize + PLAYER_RADIUS) {
                this.mesh.position.x = -halfGroundSize + PLAYER_RADIUS;
                this.velocity.x = 0;
            }
            if (this.mesh.position.z > halfGroundSize - PLAYER_RADIUS) {
                this.mesh.position.z = halfGroundSize - PLAYER_RADIUS;
                this.velocity.z = 0;
            } else if (this.mesh.position.z < -halfGroundSize + PLAYER_RADIUS) {
                this.mesh.position.z = -halfGroundSize + PLAYER_RADIUS;
                this.velocity.z = 0;
            }
        }
    }
    _updateCamera(deltaTime) {
        if (!this.mesh) return; // Need mesh for camera positioning
    // Calculate target position based on current angles and player position
    const offset = this._calculateCameraOffset();
    this.targetCameraPosition.copy(this.mesh.position).add(offset);
    // Smoothly interpolate camera position
    // Use a smaller lerp factor for faster response during rotation
    const lerpFactor = Math.min(1.0, CAMERA_LAG / deltaTime); // Adjust interpolation based on framerate
    this.currentCameraPosition.lerp(this.targetCameraPosition, lerpFactor);
    this.camera.position.copy(this.currentCameraPosition);
    // Always look towards the player's look-at target
    this.camera.lookAt(this._getCameraLookAtTarget());
    }
    resetControlsAndCamera() {
        if (!this.mesh || !this.camera) return;
        // Reset camera angles to default
        this.cameraPhi = 0;
        this.cameraTheta = Math.PI / 6; // Default vertical angle
        // Apply the reset rotation immediately
        this._updateCameraRotation(0, 0); // Pass 0,0 as no mouse delta
        // Reset movement state
        this.moveDirection.set(0, 0, 0);
        this.velocity.set(0, 0, 0); // Resetting full velocity, gravity will take over if airborne
        // Snap camera to the new target position without lag
        const offset = this._calculateCameraOffset();
        this.targetCameraPosition.copy(this.mesh.position).add(offset);
        this.currentCameraPosition.copy(this.targetCameraPosition);
        this.camera.position.copy(this.currentCameraPosition);
        this.camera.lookAt(this._getCameraLookAtTarget());
        // Reset any animation states that might be stuck from a previous state
        this.isAttacking = false;
        this.isDefending = false;
        this.isJumping = false; // Reset jump state
        // It might be good to force a transition to 'idle' animation here if currentAction is not idle
        // For now, the update loop's animation logic should handle this on the next frame.
        console.log("Player controls and camera reset.");
    }
    takeDamage(amount) {
if (!this.isAlive) return;
let actualDamage = amount;
if (this.isDefending) {
    actualDamage *= (1 - this.defenseDamageReduction);
    console.log(`Player defending! Reduced damage by ${this.defenseDamageReduction * 100}%. Original: ${amount}, Actual: ${actualDamage}`);
    // Optionally, play a block sound effect here
    // if (this.game && this.game.blockSound) {
    //     this.game.playSoundEffect(this.game.blockSound);
    // }
}
this.health -= actualDamage;
this.health = Math.max(0, this.health); // Ensure health doesn't go below 0
        console.log(`Player took ${actualDamage.toFixed(1)} damage (defending: ${this.isDefending}), health is now ${this.health.toFixed(1)}`);
        // TODO: Add visual feedback (e.g., screen flash, sound)
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        // Update UI immediately
        if (this.game && this.game.uiManager) {
            this.game.uiManager.updateHealth(this.health, this.maxHealth);
        }
    }
    die() {
        if (!this.isAlive) return;
        this.isAlive = false;
        console.log("Player has died.");
        // Stop current action and play death animation if available
        if (this.animations['death']) {
            // A more robust playAnimation method for player would be good, similar to Enemy's.
            // For now, let's try a simplified direct play.
            const deathAction = this.animations['death'];
            deathAction.reset();
            deathAction.setLoop(THREE.LoopOnce);
            deathAction.clampWhenFinished = true; // Hold last frame of death animation
            deathAction.enabled = true;
            if (this.currentAction) {
                this.currentAction.crossFadeTo(deathAction, 0.2, true);
            } else {
                deathAction.play();
            }
            this.currentAction = deathAction;
            console.log("Playing player death animation.");
        } else {
            // If no death animation, maybe just transition to idle to stop other anims
             if (this.animations['idle'] && this.currentAction !== this.animations['idle']) {
                const idleAction = this.animations['idle'];
                idleAction.reset();
                idleAction.play();
                if (this.currentAction) {
                    this.currentAction.crossFadeTo(idleAction, 0.2, true);
                }
                this.currentAction = idleAction;
            }
            console.log("Player death: No death animation, stopping other animations.");
        }
        // Notify the game instance that the player has died
        if (this.game) {
            this.game.gameOver();
        }
    }
    _dealDamage() {
        if (!this.game || !this.game.enemies || !this.mesh) return;
        const playerPosition = this.mesh.position;
        const playerForward = new THREE.Vector3();
        this.mesh.getWorldDirection(playerForward); // Player's forward direction
        playerForward.y = 0; // Ignore Y for 2D angle check
        playerForward.normalize();
        this.game.enemies.forEach(enemy => {
            if (enemy.isAlive && enemy.mesh) {
                const enemyPosition = enemy.mesh.position;
                const distanceToEnemy = playerPosition.distanceTo(enemyPosition);
                if (distanceToEnemy <= this.attackRange) {
                    const directionToEnemy = new THREE.Vector3().subVectors(enemyPosition, playerPosition);
                    directionToEnemy.y = 0; // Ignore Y for 2D angle check
                    directionToEnemy.normalize();
                    const angle = playerForward.angleTo(directionToEnemy);
                    if (angle <= this.attackAngle / 2) { // Check if enemy is within the attack cone
                        console.log(`Player hit ${enemy.constructor.name}! Dealing ${this.attackDamage} damage.`);
                        const enemyWasAlive = enemy.isAlive;
                        enemy.takeDamage(this.attackDamage);
                        // If the enemy was alive before taking damage and is not alive now, report it as defeated
                        if (enemyWasAlive && !enemy.isAlive) {
                            this.game.reportEnemyDefeated(enemy);
                        }
                    }
                }
            }
        });
    }
    _regenerateMana(deltaTime) {
        if (!this.isAlive) return;
        const now = this.mixer ? this.mixer.time : this.game.clock.getElapsedTime(); // Use mixer time if available
        if ((now - this.lastManaUseTime) >= this.manaRegenCooldown) {
            if (this.mana < this.maxMana) {
                const prevMana = this.mana;
                this.mana += this.manaRegenRate * deltaTime;
                this.mana = Math.min(this.mana, this.maxMana); // Cap at maxMana
                // Only update UI if mana actually changed (to avoid spamming updates)
                if (this.mana !== prevMana && this.game && this.game.uiManager) {
                    this.game.uiManager.updateMana(this.mana, this.maxMana);
                }
            }
        }
    }
}

