import * as THREE from 'three'; 
export class InputHandler {
    constructor() { // REMOVED targetElement parameter
        this.keys = {};
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
        this.isPointerDown = false; // Tracks if *any* pointer (mouse or touch) is down
        this.mouseButtonDown = -1; // Tracks which mouse button is down (-1 for none, 0 left, 1 middle, 2 right)
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.pointerLocked = false; 
        this.targetElement = document.body; // Target for pointer lock (usually canvas or body)
        this._addEventListeners();
    }
    _addEventListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            if (e.key === ' ') {
                 e.preventDefault();
            }
            if (key === 'escape' && this.pointerLocked) {
                this.unlockPointer();
            }
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });
        // --- Mouse Listeners ---
        window.addEventListener('mousedown', (e) => {
            this.isPointerDown = true;
            this.mouseButtonDown = e.button; 
            this.lastPointerX = e.clientX;
            this.lastPointerY = e.clientY;
            // Attempt to lock pointer on right click (button 2)
            // We'll add a condition later based on game state and settings
            if (e.button === 2 && !this.pointerLocked) {
                this.lockPointer();
            }
        });
        window.addEventListener('mouseup', (e) => {
            this.isPointerDown = false;
            this.mouseButtonDown = -1;
        });
        window.addEventListener('mousemove', (e) => {
            if (this.pointerLocked) {
                this.mouseDeltaX += e.movementX || 0;
                this.mouseDeltaY += e.movementY || 0;
            } else {
                // Only update if a button is down (e.g. right-click dragging before lock)
                // or for general UI interaction if needed elsewhere (though usually not for camera)
                if (this.isPointerDown) { 
                    const deltaX = e.clientX - this.lastPointerX;
                    const deltaY = e.clientY - this.lastPointerY;
                    this.mouseDeltaX += deltaX;
                    this.mouseDeltaY += deltaY;
                    this.lastPointerX = e.clientX;
                    this.lastPointerY = e.clientY;
                }
            }
        });
        // --- Touch Listeners ---
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) { 
                this.isPointerDown = true;
                const touch = e.touches[0];
                this.lastPointerX = touch.clientX;
                this.lastPointerY = touch.clientY;
                this.mouseButtonDown = -1; 
            }
            e.preventDefault(); 
        }, { passive: false });
        window.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.isPointerDown = false;
                this.mouseButtonDown = -1; 
            }
            e.preventDefault();
        });
        window.addEventListener('touchmove', (e) => {
            if (this.isPointerDown && e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - this.lastPointerX;
                const deltaY = touch.clientY - this.lastPointerY;
                this.mouseDeltaX += deltaX;
                this.mouseDeltaY += deltaY;
                this.lastPointerX = touch.clientX;
                this.lastPointerY = touch.clientY;
            }
            e.preventDefault(); 
        }, { passive: false });
        // --- Pointer Lock Listeners ---
        document.addEventListener('pointerlockchange', this._onPointerLockChange.bind(this), false);
        document.addEventListener('pointerlockerror', this._onPointerLockError.bind(this), false);
    }
    _onPointerLockChange() {
        if (document.pointerLockElement === this.targetElement) {
            this.pointerLocked = true;
            console.log('Pointer locked');
        } else {
            this.pointerLocked = false;
            console.log('Pointer unlocked');
        }
    }
    _onPointerLockError(e) {
        console.error('Pointer lock error:', e);
        this.pointerLocked = false; // Ensure state is correct
    }
    lockPointer() {
        this.targetElement.requestPointerLock();
    }
    unlockPointer() {
        document.exitPointerLock();
    }
    isPointerActive() { // Renamed for clarity: is mouse/touch active for movement
        return this.pointerLocked || (this.isPointerDown && this.mouseButtonDown === 2); // Locked or right-click drag
    }
    resetMouseDelta() {
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
    }

}
