Arcane Adventures
An unfinished 3D adventure game built with Three.js and Rosebud.AI. This project explores a mystical world where players can navigate through procedurally placed environments with a custom-built HUD and interactive systems.

🎮 Features
Immersive World: A vibrant 3D environment featuring stylized low-poly trees and a large terrain.

Dynamic Lighting: Atmospheric scene setup utilizing directional sunlight, ambient fill light, and depth-enhancing fog.

Custom HUD: Functional UI manager handling health and mana bars, as well as a specialized hotbar system.

Robust Game Loop: Centralized game management for updating entities, handling inputs, and rendering transitions.

📂 Project Structure
The project is organized to separate core logic from game entities:

/src

/core: Contains sceneSetup.js (world environment) and inputHandler.js (controls).

/entities: Contains environment.js (geometry and assets).

/ui: Contains uiManager.js (HUD and interface).

main.js: The entry point for the application.

game.js: The primary engine and game loop logic.

index.html: Main entry file with import mappings.

🛠️ Setup & Installation
Since this project uses ES6 modules and Import Maps, it requires a local server to run correctly.

Clone the repository to your local machine.

Open the project folder in a code editor (like VS Code).

Launch a local server (e.g., using the "Live Server" extension).

Navigate to index.html in your web browser.

📜 Credits
Engine: Three.js

Development Platform: Rosebud.AI

Asset Design: Built-in Three.js geometries and Rosebud generated concepts.
