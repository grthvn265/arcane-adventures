export class Inventory {
    constructor(slotCount = 12) {
        this.slotCount = slotCount;
        this.items = new Array(this.slotCount).fill(null);
        // Example: { id: 'health_potion', name: 'Health Potion', quantity: 1, maxStack: 10, icon: 'path/to/icon.png' }
    }

    /**
     * Adds an item to the first available slot or stacks if possible.
     * For this basic version, it only adds to the first empty slot.
     * @param {object} itemToAdd - The item object to add.
     * @returns {boolean} True if the item was added, false otherwise (e.g., inventory full).
     */
    addItem(itemToAdd) {
        // Future: Implement stacking for items that can stack.
        // For now, just find the first empty slot.
        const emptySlotIndex = this.items.findIndex(slot => slot === null);

        if (emptySlotIndex !== -1) {
            this.items[emptySlotIndex] = { ...itemToAdd, quantity: itemToAdd.quantity || 1 };
            console.log(`Added ${itemToAdd.name} to inventory slot ${emptySlotIndex}.`);
            return true;
        }

        console.log(`Inventory full. Could not add ${itemToAdd.name}.`);
        return false;
    }

    /**
     * Removes an item from a specific slot.
     * @param {number} slotIndex - The index of the slot to remove the item from.
     * @returns {object|null} The removed item, or null if the slot was empty.
     */
    removeItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.slotCount || !this.items[slotIndex]) {
            return null;
        }
        const item = this.items[slotIndex];
        this.items[slotIndex] = null;
        console.log(`Removed ${item.name} from inventory slot ${slotIndex}.`);
        return item;
    }

    /**
     * Gets the item in a specific slot.
     * @param {number} slotIndex - The index of the slot.
     * @returns {object|null} The item in the slot, or null if empty.
     */
    getItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.slotCount) {
            return null;
        }
        return this.items[slotIndex];
    }

    /**
     * Gets all items currently in the inventory.
     * @returns {Array<object|null>} An array representing the inventory slots.
     */
    getItems() {
        return [...this.items]; // Return a copy
    }

    isFull() {
        return this.items.every(slot => slot !== null);
    }
}