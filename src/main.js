import * as THREE from 'three';
import { Game } from 'game'; 

const renderDiv = document.getElementById('renderDiv');
const game = new Game(renderDiv);

game.start();
