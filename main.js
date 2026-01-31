import * as THREE from 'three';
import { Game } from 'game';

// Get the render target
const renderDiv = document.getElementById('renderDiv');

// Initialize and start the game
const game = new Game(renderDiv);
game.start();