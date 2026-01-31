import * as THREE from 'three';
import { Game } from 'game'; // This matches the 'game' key in the importmap

const renderDiv = document.getElementById('renderDiv');
const game = new Game(renderDiv);
game.start();