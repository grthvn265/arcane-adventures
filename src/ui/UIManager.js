export class UIManager {
    constructor(renderDiv, gameInstance) { // Added gameInstance
        this.renderDiv = renderDiv; // The div containing the canvas
        this.gameInstance = gameInstance; // Store the game instance
        this.container = null;
        this.healthBarFill = null;
        this.manaBarFill = null;
        this.hotbarSlots = [];
        this.mainMenuElement = null; // Added for main menu
        this.statusBarContainer = null; // Store ref for status bars
        this.hotbarContainer = null; // Store ref for hotbar
        this.settingsPanelElement = null; // Added for settings panel
        this.volumeSlider = null; // Reference to the volume slider input
        this.volumeValueLabel = null; // Reference to the volume value label
        this.sensitivitySlider = null; // For camera sensitivity
        this.sensitivityValueLabel = null; // For sensitivity value display
        this.controlsHintElement = null; // For displaying game controls
        this.pauseMenuElement = null; // Added for pause menu
        this.gameOverScreenElement = null; // Added for game over screen
        this.inventoryPanelElement = null; // For the inventory panel
        this.inventorySlotsDOMElements = []; // To store DOM refs for inventory slots
        this.objectiveTextElement = null; // For displaying the objective message
        this.shadowQualitySelect = null; // For shadow quality setting
        this._createStyles();
        this._createUIContainer();
        this._createMainMenu(); // Create menu first
        this._createSettingsPanel(); // Create settings panel
        this._createPauseMenu(); // Create pause menu
        this._createGameOverScreen(); // Create game over screen
        this._createInventoryPanel(); // Create inventory panel
        this._createBars();
        this._createHotbar();
        this._createControlsHint(); // Create the controls hint
        this._createObjectiveDisplay(); // Create the objective display
    }
    _createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ui-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none; /* Allow clicks to pass through to the canvas */
                color: white;
                font-family: 'Arial', sans-serif;
                text-shadow: 1px 1px 2px black;
                overflow: hidden; /* Prevents scrollbars if content overflows */
                z-index: 10; /* Ensure UI is above the canvas */
            }

            .status-bars {
                position: absolute;
                top: 20px;
                left: 20px;
                width: 200px;
            }

            .bar {
                background-color: rgba(50, 50, 50, 0.7);
                border-radius: 5px;
                height: 15px;
                margin-bottom: 8px;
                overflow: hidden;
                border: 1px solid rgba(20, 20, 20, 0.8);
                box-shadow: 0 0 5px rgba(0,0,0,0.5) inset;
            }

            .bar-fill {
                height: 100%;
                width: 100%; /* Start full */
                border-radius: 4px;
                transition: width 0.3s ease-out;
            }

            .health-bar-fill {
                background: linear-gradient(to right, #ff4d4d, #cc0000);
                 box-shadow: 0 0 8px rgba(255, 0, 0, 0.6);
            }

            .mana-bar-fill {
                 background: linear-gradient(to right, #4d4dff, #0000cc);
                 box-shadow: 0 0 8px rgba(0, 0, 255, 0.6);
            }

            .hotbar {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 8px;
                background-color: rgba(30, 30, 30, 0.8);
                padding: 8px;
                border-radius: 8px;
                border: 1px solid rgba(0, 0, 0, 0.9);
                 box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            }

            .hotbar-slot {
                width: 50px;
                height: 50px;
                background-color: rgba(80, 80, 80, 0.6);
                border: 2px solid rgba(150, 150, 150, 0.7);
                border-radius: 5px;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 10px; /* For keybind hint */
                position: relative;
            }

             .hotbar-slot .keybind {
                position: absolute;
                bottom: 2px;
                right: 4px;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.7);
            }

            /* Basic responsiveness */
             @media (max-width: 600px) {
                .status-bars {
                    width: 150px;
                    top: 10px;
                    left: 10px;
                }
                .bar {
                     height: 12px;
                }
                 .hotbar {
                     bottom: 10px;
                     gap: 5px;
                     padding: 5px;
                 }
                 .hotbar-slot {
                     width: 40px;
                     height: 40px;
                 }
                 .hotbar-slot .keybind {
                     font-size: 9px;
                 }
            }
            }
             /* Main Menu Styles */
            .main-menu {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: transparent; /* Make menu background see-through */
                display: flex;
                flex-direction: column;
                justify-content: center; /* Center content vertically */
                align-items: center;
                text-align: center; /* Ensure text within is centered */
                gap: 30px; /* Add space between title and buttons using gap */
                box-sizing: border-box; /* Include padding in height calculation */
                z-index: 100; /* Above other UI */
                opacity: 1;
                transition: opacity 0.5s ease-out;
            }
             .main-menu.hidden {
                 opacity: 0;
                 pointer-events: none; /* Prevent interaction when hidden */
            }
            @keyframes fadeInTitle {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .menu-title {
                font-size: 3.2em; /* Slightly smaller again */
                color: #e0d6b3; /* Parchment-like color */
                /* margin-bottom: 50px; Removed - Use gap on parent flex container instead */
                text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.8); /* Darker shadow */
                font-family: 'Arial', sans-serif; /* Changed to Arial */
                font-weight: bold;
                animation: fadeInTitle 1s ease-out forwards; /* Add fade-in animation */
                width: 100%; /* Ensure it takes full width */
                text-align: center; /* Explicitly center the text within the h1 */
            }
            .menu-options {
                display: flex;
                flex-direction: column;
                align-items: center; /* Center buttons horizontally within the column */
                gap: 15px; /* Increased gap between buttons */
                width: 100%; /* Ensure container takes width for centering */
            }
             @keyframes popInButton {
                 from { opacity: 0; transform: scale(0.8); }
                 to { opacity: 1; transform: scale(1); }
            }
            .menu-button {
                 font-size: 1.1em; /* Medium button font size */
                 padding: 10px 20px; /* Medium button padding */
                 background: linear-gradient(to bottom, rgba(80, 60, 40, 0.8), rgba(50, 40, 30, 0.9)); /* Brownish gradient */
                 border: 1px solid #a89468; /* Slightly darker base border */
                 color: #e0d6b3; /* Parchment text color */
                 cursor: pointer;
                 border-radius: 5px; /* Slightly rounded edges */
                 transition: background 0.2s ease-out, transform 0.15s ease-out, border-color 0.2s ease-out, box-shadow 0.2s ease-out;
                 text-align: center;
                 min-width: 180px; /* Enforce a consistent medium width */
                pointer-events: all; /* Buttons should be clickable */
                font-family: 'Arial', sans-serif; /* Changed to Arial */
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
                 opacity: 0; /* Start hidden for animation */
                 transform: scale(0.8); /* Start smaller for animation */
                 animation: popInButton 0.5s ease-out forwards; /* Pop-in animation */
                 box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            }
            /* Stagger button animations */
            .menu-button:nth-child(1) { animation-delay: 0.6s; }
            .menu-button:nth-child(2) { animation-delay: 0.7s; }
            .menu-button:nth-child(3) { animation-delay: 0.8s; }
            .menu-button:hover {
                 background: linear-gradient(to bottom, rgba(95, 75, 55, 0.95), rgba(65, 55, 45, 1.0));
                 border-color: #d4c08c; /* Brighter border on hover */
                 transform: scale(1.05) translateY(-1px); /* More noticeable scale and lift */
                 box-shadow: 0 3px 5px rgba(0,0,0,0.4); /* Increased shadow */
            }
            /* Responsive adjustments for Menu */
            @media (max-width: 600px) {
                .menu-title {
                    font-size: 2.5em; /* Adjusted responsive title size */
                    margin-bottom: 30px;
                }
                 .menu-button {
                     font-size: 1.0em; /* Adjust responsive button font */
                     padding: 8px 15px; /* Adjust responsive button padding */
                     min-width: 150px; /* Adjust responsive button width */
                 }
             }
             /* Settings Panel Styles */
            .settings-panel {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(10, 10, 20, 0.9); /* Slightly darker overlay */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 20px; /* Adjusted gap */
                z-index: 110; /* Above main menu */
                opacity: 1;
                transition: opacity 0.4s ease-out, visibility 0s linear 0.4s; /* Delay visibility change */
                pointer-events: none;
                visibility: hidden;
                font-family: 'Arial', sans-serif; /* Changed to Arial */
                box-sizing: border-box;
                padding: 20px;
            }
            .settings-panel.visible {
                opacity: 1;
                pointer-events: all;
                visibility: visible;
                transition: opacity 0.4s ease-out;
            }
             .settings-title {
                 font-size: 2.8em; /* Larger title */
                color: #e0d6b3; /* Parchment title */
                font-family: 'Arial', sans-serif; /* Changed to Arial */
                text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.8);
                 margin-bottom: 20px;
            }
            .settings-section {
                background: rgba(30, 25, 20, 0.5); /* Subtle background for sections */
                padding: 15px;
                border-radius: 8px;
                border: 1px solid rgba(168, 148, 104, 0.3); /* Faint border */
                width: 90%;
                max-width: 400px; /* Max width for content */
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            .settings-section-title {
                font-size: 1.4em;
                color: #d4c08c;
                margin-bottom: 15px;
                border-bottom: 1px solid rgba(168, 148, 104, 0.2);
                padding-bottom: 5px;
            }
             .setting-item {
                 display: flex;
                 flex-direction: column; /* Stack label and control vertically on small screens */
                 align-items: flex-start; /* Align items to the start */
                 gap: 8px; /* Gap between label and control */
                 color: #e0d6b3;
                 font-size: 1.1em;
                 margin-bottom: 12px; /* Space between setting items */
                 width: 100%;
            }
             .setting-item label {
                 /* min-width: 120px; Adjusted */
                 /* text-align: right; No longer needed with column layout */
                 font-weight: bold;
                 color: #d4c08c;
            }
            .slider-container {
                display: flex;
                align-items: center;
                width: 100%;
                gap: 10px;
            }
             .setting-item input[type="range"] {
                 cursor: pointer;
                 flex-grow: 1; /* Slider takes available space */
                 height: 10px; /* Make track thicker */
                 background: rgba(80, 60, 40, 0.5);
                 border-radius: 5px;
                 -webkit-appearance: none;
                 appearance: none;
             }
             .setting-item input[type="range"]::-webkit-slider-thumb {
                 -webkit-appearance: none;
                 appearance: none;
                 width: 20px;
                 height: 20px;
                 background: #a89468;
                 border-radius: 50%;
                 cursor: pointer;
                 border: 2px solid #e0d6b3;
             }
            .setting-item input[type="range"]::-moz-range-thumb {
                 width: 20px;
                 height: 20px;
                 background: #a89468;
                 border-radius: 50%;
                 cursor: pointer;
                 border: 2px solid #e0d6b3;
            }
            .setting-item .value-label {
                 min-width: 40px; /* Space for percentage */
                 text-align: right;
                 color: #e0d6b3;
            }
            .checkbox-container {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .checkbox-container input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: #a89468; /* Themed checkbox color */
            }
            .checkbox-container label {
                font-weight: normal; /* Normal weight for checkbox labels */
                 color: #e0d6b3;
            }
            .setting-item select {
                padding: 8px;
                background-color: rgba(80, 60, 40, 0.7);
                border: 1px solid #a89468;
                color: #e0d6b3;
                border-radius: 4px;
                font-family: 'Arial', sans-serif;
                font-size: 0.9em;
                cursor: pointer;
                flex-grow: 1; /* Allow select to take space if in a flex row */
            }
            .setting-item select:focus {
                outline: none;
                border-color: #d4c08c;
                box-shadow: 0 0 5px rgba(212, 192, 140, 0.5);
            }
            /* Back button styled like menu buttons */
            .settings-back-button {
                 margin-top: 25px; /* Add space above back button */
            }
             @media (min-width: 500px) {
                .setting-item {
                    flex-direction: row; /* Horizontal layout on larger screens */
                    align-items: center;
                }
                .setting-item label {
                    min-width: 150px; /* Give labels more space */
                    text-align: right;
                }
             }
            .controls-hint {
                position: absolute;
                bottom: 15px;
                right: 15px;
font-size: 0.85em;
color: rgba(220, 220, 220, 0.8);
text-shadow: 1px 1px 1px black;
z-index: 15; /* Above hotbar, below menu */
pointer-events: none;
display: none; /* Hidden by default, shown during gameplay */
padding: 8px;
background-color: rgba(0, 0, 0, 0.3);
border-radius: 4px;
line-height: 1.5; /* Adjust for better readability of stacked lines */
            }
            @media (max-width: 600px) {
                .controls-hint {
                    font-size: 0.7em;
                    bottom: 10px;
                    right: 10px;
                }
            }
            /* Pause Menu Styles */
            .pause-menu {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.75); /* Darker overlay than settings */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 25px;
                z-index: 120; /* Above settings panel */
                opacity: 0; /* Start hidden */
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.3s ease-out, visibility 0s linear 0.3s;
                font-family: 'Arial', sans-serif;
            }
            .pause-menu.visible {
                opacity: 1;
                visibility: visible;
                pointer-events: all;
                transition: opacity 0.3s ease-out;
            }
            .pause-menu-title {
                font-size: 2.8em;
                color: #d4c08c; /* Slightly less prominent than main menu title */
                text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
                margin-bottom: 15px;
            }
            /* Pause menu buttons can reuse .menu-button styles or have their own */
            .pause-menu .menu-button {
                 animation: none; /* No pop-in for pause menu buttons for faster appearance */
                 opacity: 1;
                 transform: scale(1);
            }
            /* Game Over Screen Styles */
            .game-over-screen {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(20, 0, 0, 0.85); /* Dark red, semi-transparent */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 30px;
                z-index: 130; /* Above pause menu */
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.5s ease-out, visibility 0s linear 0.5s;
                font-family: 'Arial', sans-serif; /* Consistent font */
            }
            .game-over-screen.visible {
                opacity: 1;
                visibility: visible;
                pointer-events: all;
                transition: opacity 0.5s ease-out;
            }
            .game-over-title {
                font-size: 3.5em; /* Large and imposing */
                color: #a02020; /* Dark, blood red */
                text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.9);
                margin-bottom: 10px;
            }
            /* Game Over buttons can reuse .menu-button styling or have specific ones */
            .game-over-screen .menu-button {
                animation: none; /* No animation for quicker appearance */
                opacity: 1;
                transform: scale(1);
                background: linear-gradient(to bottom, rgba(100, 40, 40, 0.8), rgba(70, 20, 20, 0.9)); /* Darker red buttons */
                border-color: #803030;
            }
            .game-over-screen .menu-button:hover {
                background: linear-gradient(to bottom, rgba(120, 50, 50, 0.95), rgba(90, 30, 30, 1.0));
                border-color: #a04040;
            }
            /* Objective Display Styles */
            .objective-display {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 250px; /* Adjust as needed */
                padding: 10px;
                background-color: rgba(30, 30, 30, 0.75);
                border: 1px solid rgba(100, 100, 100, 0.5);
                border-radius: 5px;
                color: #e0d6b3; /* Parchment-like text */
                font-size: 0.9em;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.6);
                box-shadow: 0 1px 5px rgba(0,0,0,0.3);
                display: none; /* Hidden by default, shown during gameplay with an objective */
                z-index: 15; /* Same as controls hint, adjust if needed */
                text-align: left;
            }
            @media (max-width: 768px) { /* Adjust breakpoint as needed */
                .objective-display {
                    width: 200px;
                    top: 100px; /* Move below status bars on smaller screens */
                    right: 10px;
                    font-size: 0.8em;
                }
            }
            /* Inventory Panel Styles */
            .inventory-panel {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 500px; /* Max width for the panel */
                min-height: 300px; /* Minimum height */
                background-color: rgba(25, 20, 15, 0.92); /* Dark, slightly brown overlay */
                border: 2px solid #786448; /* Dark wood-like border */
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.6);
                display: flex;
                flex-direction: column;
                align-items: center;
                z-index: 50; /* Above game UI, below menus */
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.3s ease-out, visibility 0s linear 0.3s;
                font-family: 'Arial', sans-serif;
                flex-wrap: wrap; /* Allow content to wrap if needed */
                justify-content: space-around; /* Distribute space for armor and grid */
            }
            .inventory-panel.visible {
                opacity: 1;
                visibility: visible;
                pointer-events: all; /* Allow interaction when visible */
                 transition: opacity 0.3s ease-out;
            }
            .inventory-title {
                font-size: 2em;
                color: #e0d6b3; /* Parchment color */
                margin-bottom: 20px;
                text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
                width: 100%; /* Ensure title spans full width above sections */
                text-align: center;
            }
            .inventory-sections-container {
                display: flex;
                flex-direction: row; /* Armor and grid side-by-side */
                justify-content: space-between; /* Or space-around */
                align-items: flex-start; /* Align tops */
                width: 100%;
                gap: 20px; /* Space between armor section and grid */
                margin-bottom: 10px; /* Space before close hint */
            }
            .armor-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background-color: rgba(0,0,0,0.15);
                border-radius: 5px;
                width: 100px; /* Fixed width for armor section */
            }
            .armor-slot-placeholder { /* For the text like 'Helmet' */
                font-size: 0.8em;
                color: #a09070;
                margin-bottom: -5px; /* Pull slot closer */
            }
            .inventory-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); /* Responsive columns */
                gap: 10px;
                flex-grow: 1; /* Grid takes remaining space */
                padding: 10px;
                background-color: rgba(0,0,0,0.2);
                border-radius: 5px;
                overflow-y: auto; /* Scroll if many items */
                max-height: 260px; /* Adjusted height */
            }
            .inventory-slot-ui { /* Styles for both general and armor slots */
                width: 60px;
                height: 60px;
                background-color: rgba(50, 40, 30, 0.7); /* Darker slot background */
                border: 1px solid #605040;
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                position: relative;
                font-size: 9px;
                color: #c0b090;
                overflow: hidden; /* Clip item name if too long */
                cursor: default; /* Or pointer if items are clickable */
            }
            .inventory-slot-ui.has-item {
                border-color: #a89468; /* Highlight if has item */
            }
            .inventory-item-icon {
                width: 32px;
                height: 32px;
                background-color: rgba(255,255,255,0.1); /* Placeholder icon color */
                margin-bottom: 3px;
                border-radius: 3px;
                 /* background-image: url('path/to/default-icon.png'); For actual icons */
                 background-size: contain;
                 background-repeat: no-repeat;
                 background-position: center;
            }
            .inventory-item-name {
                text-align: center;
                width: 100%;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding: 0 2px;
            }
            .inventory-item-quantity {
                position: absolute;
                bottom: 2px;
                right: 4px;
                font-size: 10px;
                font-weight: bold;
                color: #fff;
                background-color: rgba(0,0,0,0.5);
                padding: 1px 3px;
                border-radius: 2px;
            }
            .inventory-panel-close-hint {
                margin-top: 15px;
                font-size: 0.9em;
                color: #a09070;
            }
             @media (max-width: 600px) {
                .inventory-panel {
                .inventory-panel {
                    width: 90%;
                    padding: 15px;
                }
                .inventory-sections-container {
                    flex-direction: column; /* Stack armor and grid on small screens */
                    align-items: center;
                }
                .armor-section {
                    width: 80%; /* Allow armor section to be wider */
                    margin-bottom: 15px;
                }
                .inventory-title {
                    font-size: 1.6em;
                }
                .inventory-grid {
                    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
                    gap: 8px;
                    max-height: 200px; /* Further adjust height */
                }
                .inventory-slot-ui {
                    width: 50px;
                    height: 50px;
                }
                .inventory-item-icon {
                    width: 28px;
                    height: 28px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    _createUIContainer() {
        this.container = document.createElement('div');
        this.container.className = 'ui-container';
        // Prepend to renderDiv so canvas is added after it
        this.renderDiv.prepend(this.container);
    }
    _createMainMenu() {
        this.mainMenuElement = document.createElement('div');
        this.mainMenuElement.className = 'main-menu hidden'; // Start hidden by default, game.js will show it
        const title = document.createElement('h1');
        title.className = 'menu-title';
        title.textContent = 'Arcane Adventures';
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'menu-options';
        const startButton = this._createMenuButton('Start Game', 'start-game');
        const settingsButton = this._createMenuButton('Settings', 'settings');
        const exitButton = this._createMenuButton('Exit', 'exit');
        optionsContainer.appendChild(startButton);
        optionsContainer.appendChild(settingsButton);
        optionsContainer.appendChild(exitButton);
        this.mainMenuElement.appendChild(title);
        this.mainMenuElement.appendChild(optionsContainer);
        this.container.appendChild(this.mainMenuElement);
    }
    _createSettingsPanel() {
        this.settingsPanelElement = document.createElement('div');
        this.settingsPanelElement.className = 'settings-panel'; // Start hidden via CSS (no 'visible' class)
        const title = document.createElement('h2');
        title.className = 'settings-title';
        title.textContent = 'Settings';
        this.settingsPanelElement.appendChild(title);
        // --- Controls Section ---
        const controlsSection = this._createSettingsSection('Controls');
        // Volume Control
        const volumeSetting = this._createSliderSetting(
            'Music Volume:', 'volume-slider', '0', '1', '0.01', '0.3',
            (slider, label) => { this.volumeSlider = slider; this.volumeValueLabel = label; },
            value => `${Math.round(parseFloat(value) * 100)}%`
        );
        controlsSection.appendChild(volumeSetting);
        // Sensitivity Control
        const sensitivitySetting = this._createSliderSetting(
            'Camera Sensitivity:', 'sensitivity-slider', '0.1', '2', '0.05', '1', // Assuming 1 is default
            (slider, label) => { this.sensitivitySlider = slider; this.sensitivityValueLabel = label; },
            value => parseFloat(value).toFixed(2)
        );
        controlsSection.appendChild(sensitivitySetting);
        this.settingsPanelElement.appendChild(controlsSection);
        // --- Graphics Section ---
        const graphicsSection = this._createSettingsSection('Graphics');
        // Shadow Quality Setting
        const shadowOptions = [
            { value: 'disabled', text: 'Disabled' },
            { value: 'low', text: 'Low' },
            { value: 'medium', text: 'Medium' },
            { value: 'high', text: 'High' }
        ];
        const shadowQualitySetting = this._createDropdownSetting(
            'Shadow Quality:', 'shadow-quality-select', shadowOptions, 'high', // Default to High
            (select) => { 
                this.shadowQualitySelect = select; 
                // Add event listener here, ensuring gameInstance is available
                if (this.gameInstance && typeof this.gameInstance.applyShadowQuality === 'function') {
                    select.addEventListener('change', (event) => {
                        this.gameInstance.applyShadowQuality(event.target.value);
                    });
                } else {
                    console.warn("UIManager: Game instance or applyShadowQuality method not available for shadow settings.");
                }
            }
        );
        graphicsSection.appendChild(shadowQualitySetting);
        // Only add graphics section if it has content
        if (graphicsSection.childElementCount > 1) { // Check if more than just title is present
            this.settingsPanelElement.appendChild(graphicsSection);
        }
        // --- Back Button ---
        const backButton = this._createMenuButton('Back', 'settings-back');
        backButton.classList.add('settings-back-button');
        this.settingsPanelElement.appendChild(backButton);
        this.container.appendChild(this.settingsPanelElement);
    }
    _createPauseMenu() {
        this.pauseMenuElement = document.createElement('div');
        this.pauseMenuElement.className = 'pause-menu'; // Starts hidden by CSS
        const title = document.createElement('h2');
        title.className = 'pause-menu-title';
        title.textContent = 'Paused';
        this.pauseMenuElement.appendChild(title);
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'menu-options'; // Re-use for layout
        const resumeButton = this._createMenuButton('Resume', 'pause-resume');
        const settingsButton = this._createMenuButton('Settings', 'pause-settings');
        const exitToMenuButton = this._createMenuButton('Exit to Main Menu', 'pause-exit-menu');
        optionsContainer.appendChild(resumeButton);
        optionsContainer.appendChild(settingsButton);
        optionsContainer.appendChild(exitToMenuButton);
        this.pauseMenuElement.appendChild(optionsContainer);
        this.container.appendChild(this.pauseMenuElement);
    }
    _createGameOverScreen() {
        this.gameOverScreenElement = document.createElement('div');
        this.gameOverScreenElement.className = 'game-over-screen'; // Starts hidden by CSS
        const title = document.createElement('h1');
        title.className = 'game-over-title';
        title.textContent = 'Game Over';
        this.gameOverScreenElement.appendChild(title);
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'menu-options'; // Re-use for layout
        // In Game.js, you'll need to hook up this button's click event
        // to call game.restartGame()
        const restartButton = this._createMenuButton('Restart', 'gameover-restart');
        // And this to game._enterMenuState() or similar
        const exitToMenuButton = this._createMenuButton('Exit to Main Menu', 'gameover-exit-menu');
        optionsContainer.appendChild(restartButton);
        optionsContainer.appendChild(exitToMenuButton);
        this.gameOverScreenElement.appendChild(optionsContainer);
        this.container.appendChild(this.gameOverScreenElement);
    }
    _createSettingsSection(titleText) {
        const section = document.createElement('div');
        section.className = 'settings-section';
        const title = document.createElement('h3');
        title.className = 'settings-section-title';
        title.textContent = titleText;
        section.appendChild(title);
        return section;
    }
    _createSliderSetting(labelText, sliderId, min, max, step, defaultValue, refCallback, valueFormatCallback) {
        const settingItem = document.createElement('div');
        settingItem.className = 'setting-item';
        const label = document.createElement('label');
        label.setAttribute('for', sliderId);
        label.textContent = labelText;
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = sliderId;
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = defaultValue;
        const valueLabel = document.createElement('span');
        valueLabel.className = 'value-label';
        valueLabel.textContent = valueFormatCallback(defaultValue);
        slider.addEventListener('input', () => {
            valueLabel.textContent = valueFormatCallback(slider.value);
        });
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueLabel);
        settingItem.appendChild(label);
        settingItem.appendChild(sliderContainer);
        if (refCallback) refCallback(slider, valueLabel);
        return settingItem;
    }
    _createCheckboxSetting(labelText, checkboxId, defaultChecked, refCallback) {
        const settingItem = document.createElement('div');
        settingItem.className = 'setting-item'; // Re-use for consistent spacing
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.checked = defaultChecked;
        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        label.textContent = labelText;
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        settingItem.appendChild(checkboxContainer); // Add checkbox container to setting item
        if (refCallback) refCallback(checkbox);
        return settingItem;
    }
    _createDropdownSetting(labelText, selectId, options, defaultValue, refCallback) {
        const settingItem = document.createElement('div');
        settingItem.className = 'setting-item';
        const label = document.createElement('label');
        label.setAttribute('for', selectId);
        label.textContent = labelText;
        const select = document.createElement('select');
        select.id = selectId;
        options.forEach(opt => {
            const optionElement = document.createElement('option');
            optionElement.value = typeof opt === 'object' ? opt.value : opt;
            optionElement.textContent = typeof opt === 'object' ? opt.text : opt;
            if ((typeof opt === 'object' ? opt.value : opt) === defaultValue) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });
        // On smaller screens, label is above. On larger, it's to the side.
        // The select itself will be added directly if label is stacked, or inside a container if side-by-side.
        // For simplicity here, and consistency with _createSliderSetting, we'll assume direct appending.
        // If more complex layout needed per setting, more containers would be used like in _createSliderSetting.
        const controlContainer = document.createElement('div'); // Use a container for flex-grow if needed
        controlContainer.style.flexGrow = "1"; // Allow select to take available space in row layout
        controlContainer.appendChild(select);
        settingItem.appendChild(label);
        settingItem.appendChild(controlContainer); // Add select (or its container)
        if (refCallback) refCallback(select);
        return settingItem;
    }
    _createMenuButton(text, id) {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.textContent = text;
        button.id = `menu-${id}`;
        return button;
    }
    _createBars() {
        this.statusBarContainer = document.createElement('div'); // Store reference
        this.statusBarContainer.className = 'status-bars';

        // Health Bar
        const healthBar = document.createElement('div');
        healthBar.className = 'bar health-bar';
        this.healthBarFill = document.createElement('div');
        this.healthBarFill.className = 'bar-fill health-bar-fill';
        healthBar.appendChild(this.healthBarFill);

        // Mana Bar
        const manaBar = document.createElement('div');
        manaBar.className = 'bar mana-bar';
        this.manaBarFill = document.createElement('div');
        this.manaBarFill.className = 'bar-fill mana-bar-fill';
        manaBar.appendChild(this.manaBarFill);

        this.statusBarContainer.appendChild(healthBar);
        this.statusBarContainer.appendChild(manaBar);
        this.container.appendChild(this.statusBarContainer);
    }
    _createHotbar(numSlots = 6) {
        this.hotbarContainer = document.createElement('div'); // Store reference
        this.hotbarContainer.className = 'hotbar';

        for (let i = 0; i < numSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.id = `hotbar-slot-${i + 1}`;

            // Add keybind hint
            const keybindHint = document.createElement('span');
            keybindHint.className = 'keybind';
            keybindHint.textContent = `${i + 1}`;
            slot.appendChild(keybindHint);

            this.hotbarContainer.appendChild(slot); // Use this.hotbarContainer
            this.hotbarSlots.push(slot);
        }

        this.container.appendChild(this.hotbarContainer);
    }
    _createControlsHint() {
this.controlsHintElement = document.createElement('div');
this.controlsHintElement.className = 'controls-hint';
this.controlsHintElement.innerHTML = `
            WASD: Move <br>
            Space: Jump <br>
            LMB: Attack <br>
            RMB: Block <br>
            I: Inventory <br>
            ESC: Pause / Mouse
        `;
this.container.appendChild(this.controlsHintElement);
    }
    _createObjectiveDisplay() {
        this.objectiveTextElement = document.createElement('div');
        this.objectiveTextElement.className = 'objective-display';
        this.objectiveTextElement.textContent = ''; // Initial empty text
        this.container.appendChild(this.objectiveTextElement);
    }
    _createInventoryPanel(slotCount = 12) { // Default to 12 slots
        this.inventoryPanelElement = document.createElement('div');
        this.inventoryPanelElement.className = 'inventory-panel'; // Hidden by default via CSS
        const title = document.createElement('h2');
        title.className = 'inventory-title';
        title.textContent = 'Inventory';
        this.inventoryPanelElement.appendChild(title);
        const sectionsContainer = document.createElement('div');
        sectionsContainer.className = 'inventory-sections-container';
        // Armor Section
        const armorSection = document.createElement('div');
        armorSection.className = 'armor-section';
        const armorTypes = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
        this.armorSlotsDOMElements = {}; // Store armor slots by type
        armorTypes.forEach(type => {
            const placeholderText = document.createElement('div');
            placeholderText.className = 'armor-slot-placeholder';
            placeholderText.textContent = type;
            armorSection.appendChild(placeholderText);
            const slotElement = this._createSingleInventorySlotDOM(`armor-${type.toLowerCase()}`);
            // We can add specific dataset or class for armor type if needed later
            // slotElement.slotElement.dataset.armorType = type.toLowerCase();
            armorSection.appendChild(slotElement.slotElement);
            this.armorSlotsDOMElements[type.toLowerCase()] = slotElement;
        });
        sectionsContainer.appendChild(armorSection);
        // Inventory Grid Section
        const inventoryGrid = document.createElement('div');
        inventoryGrid.className = 'inventory-grid';
        this.inventorySlotsDOMElements = []; // For general inventory
        for (let i = 0; i < slotCount; i++) {
            const slotDOM = this._createSingleInventorySlotDOM(`inventory-${i}`);
            inventoryGrid.appendChild(slotDOM.slotElement);
            this.inventorySlotsDOMElements.push(slotDOM);
        }
        sectionsContainer.appendChild(inventoryGrid);
        this.inventoryPanelElement.appendChild(sectionsContainer);
        const closeHint = document.createElement('p');
        closeHint.className = 'inventory-panel-close-hint';
        closeHint.textContent = "Press 'I' to close";
        this.inventoryPanelElement.appendChild(closeHint);
        this.container.appendChild(this.inventoryPanelElement);
    }
    _createSingleInventorySlotDOM(idSuffix) {
        const slotElement = document.createElement('div');
        slotElement.className = 'inventory-slot-ui';
        slotElement.id = `slot-${idSuffix}`; // Unique ID for each slot
        const iconElement = document.createElement('div');
        iconElement.className = 'inventory-item-icon';
        const nameElement = document.createElement('div');
        nameElement.className = 'inventory-item-name';
        nameElement.textContent = '';
        const quantityElement = document.createElement('div');
        quantityElement.className = 'inventory-item-quantity';
        quantityElement.textContent = '';
        slotElement.appendChild(iconElement);
        slotElement.appendChild(nameElement);
        slotElement.appendChild(quantityElement);
        return { slotElement, iconElement, nameElement, quantityElement };
    }
    // --- Control Methods ---
    showMainMenu() {
        if (this.mainMenuElement) {
            this.mainMenuElement.classList.remove('hidden');
        }
    }
    hideMainMenu() {
        if (this.mainMenuElement) {
           this.mainMenuElement.classList.add('hidden');
        }
    }
     showSettingsPanel() {
        if (this.settingsPanelElement) {
            this.settingsPanelElement.classList.add('visible');
        }
        // Removed direct manipulation of main menu elements.
        // Game.js will now handle showing/hiding main menu elements
        // when settings are displayed from the main menu context.
    }
    hideSettingsPanel() {
        if (this.settingsPanelElement) {
            this.settingsPanelElement.classList.remove('visible');
        }
        // Removed direct manipulation of main menu elements.
        // Game.js will now handle showing/hiding main menu elements
        // when settings are closed and returning to the main menu context.
    }
    showGameUI() {
        // Show health/mana bars and hotbar (assuming they exist and refs are stored)
        if (this.statusBarContainer) this.statusBarContainer.style.display = 'block';
        if (this.hotbarContainer) this.hotbarContainer.style.display = 'flex';
        if (this.controlsHintElement) this.controlsHintElement.style.display = 'block'; // Show controls hint
        if (this.objectiveTextElement && this.objectiveTextElement.textContent.trim() !== "") {
            this.objectiveTextElement.style.display = 'block'; // Show objective if it has text
        }
    }
    hideGameUI() {
       // Hide health/mana bars, hotbar, controls hint, and objective display
        if (this.statusBarContainer) this.statusBarContainer.style.display = 'none';
        if (this.hotbarContainer) this.hotbarContainer.style.display = 'none';
        if (this.controlsHintElement) this.controlsHintElement.style.display = 'none'; // Hide controls hint
        if (this.objectiveTextElement) this.objectiveTextElement.style.display = 'none'; // Hide objective display
    }
    showPauseMenu() {
        if (this.pauseMenuElement) {
            this.pauseMenuElement.classList.add('visible');
        }
    }
    hidePauseMenu() {
        if (this.pauseMenuElement) {
            this.pauseMenuElement.classList.remove('visible');
        }
    }
    showGameOverScreen() {
        if (this.gameOverScreenElement) {
            this.gameOverScreenElement.classList.add('visible');
        }
    }
    hideGameOverScreen() {
        if (this.gameOverScreenElement) {
            this.gameOverScreenElement.classList.remove('visible');
        }
    }
    toggleInventoryPanel() {
        if (this.inventoryPanelElement) {
            const isVisible = this.inventoryPanelElement.classList.toggle('visible');
            if (isVisible) {
                // Potentially call updateInventoryDisplay here if needed immediately upon opening
                // Example: this.updateInventoryDisplay(game.player.inventory.getItems());
                // This requires passing game instance or player inventory to UIManager
                // For now, game loop will handle updating it.
                console.log("Inventory panel shown");
            } else {
                console.log("Inventory panel hidden");
            }
            return isVisible; // Return the new visibility state
        }
        return false; // Return false if panel element doesn't exist
    }
     // --- Getters for Control Elements ---
    getVolumeSlider() {
         return this.volumeSlider;
    }
    getVolumeValueLabel() {
        return this.volumeValueLabel;
    }
    getSensitivitySlider() {
        return this.sensitivitySlider;
    }
    getSensitivityValueLabel() {
        return this.sensitivityValueLabel;
    }
    getShadowQualitySelect() {
        return this.shadowQualitySelect;
    }
    // getBloomToggle() REMOVED
    // getVignetteToggle() REMOVED
    // --- Update Methods ---
    updateHealth(currentHealth, maxHealth) {
        const percentage = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
        if (this.healthBarFill) {
            this.healthBarFill.style.width = `${percentage}%`;
        }
    }

    updateMana(currentMana, maxMana) {
        const percentage = Math.max(0, Math.min(100, (currentMana / maxMana) * 100));
         if (this.manaBarFill) {
            this.manaBarFill.style.width = `${percentage}%`;
        }
    }

    // Placeholder for updating hotbar slots later
    updateHotbarSlot(slotIndex, content) {
        if (slotIndex >= 0 && slotIndex < this.hotbarSlots.length) {
            // Example: Set background image or icon
            // this.hotbarSlots[slotIndex].innerHTML = content; // Or modify specific elements
        }
    }
    updateInventoryDisplay(inventoryItems) { // inventoryItems is an array from Player's Inventory class
        if (!this.inventorySlotsDOMElements || this.inventorySlotsDOMElements.length === 0) return;
        this.inventorySlotsDOMElements.forEach((slotDOM, index) => {
            const item = inventoryItems[index]; // Get item from the passed array
            if (item) {
                slotDOM.slotElement.classList.add('has-item');
                slotDOM.nameElement.textContent = item.name || 'Unknown Item';
                // For icon: slotDOM.iconElement.style.backgroundImage = `url(${item.icon || 'path/to/default.png'})`;
                // For now, just a visual cue if an item exists
                slotDOM.iconElement.style.backgroundColor = item.icon ? 'rgba(100,150,200,0.5)' : 'rgba(150,150,150,0.3)'; // Example color change
                if (item.quantity > 1) {
                    slotDOM.quantityElement.textContent = item.quantity;
                    slotDOM.quantityElement.style.display = 'block';
                } else {
                    slotDOM.quantityElement.textContent = '';
                    slotDOM.quantityElement.style.display = 'none';
                }
            } else {
                slotDOM.slotElement.classList.remove('has-item');
                slotDOM.nameElement.textContent = '';
                slotDOM.iconElement.style.backgroundColor = 'rgba(255,255,255,0.1)'; // Default empty icon style
                slotDOM.iconElement.style.backgroundImage = '';
                slotDOM.quantityElement.textContent = '';
                slotDOM.quantityElement.style.display = 'none';
            }
        });
    }
    updateObjective(message) {
        if (this.objectiveTextElement) {
            this.objectiveTextElement.textContent = message;
            if (message && message.trim() !== "") {
                this.objectiveTextElement.style.display = 'block';
            } else {
                this.objectiveTextElement.style.display = 'none';
            }
        }
        }
    }
