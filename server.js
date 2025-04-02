const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

// Configuration du serveur
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Charger les données des héros
let heroes = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'heroes.json'), 'utf8');
  heroes = JSON.parse(data);
} catch (err) {
  console.error("Erreur lors du chargement des héros:", err);
}

// Gestion des joueurs
const players = new Map();
const rooms = new Map();
let waitingPlayer = null;

// Fonction pour choisir un héros aléatoire
function getRandomHero() {
  return heroes[Math.floor(Math.random() * heroes.length)];
}

// Fonction pour créer une nouvelle partie
function createGame(player1Id, player2Id) {
  const gameId = `game_${Date.now()}`;
  
  const hero1 = getRandomHero();
  const hero2 = getRandomHero();
  
  const firstPlayer = Math.random() < 0.5 ? player1Id : player2Id;
  
  const gameState = {
    gameId,
    players: {
      [player1Id]: {
        hero: hero1,
        health: 1000,
        isAttacker: firstPlayer === player1Id
      },
      [player2Id]: {
        hero: hero2,
        health: 1000,
        isAttacker: firstPlayer === player2Id
      }
    },
    currentAttacker: firstPlayer,
    gameOver: false,
    winner: null
  };
  
  rooms.set(gameId, gameState);
  
  players.get(player1Id).gameId = gameId;
  players.get(player2Id).gameId = gameId;
  
  return gameState;
}

// Fonction pour calculer les dégâts
function calculateDamage(attackType, defenseType, attacker, defender) {
  const attackValue = attacker.hero.powerstats[attackType];
  const defenseValue = defender.hero.powerstats[defenseType];
  
  // Formule des dégâts: statistique utilisée × modificateur − réduction de défense
  // Pour simplifier, nous utilisons un modificateur de 2 pour l'attaque
  const damage = Math.max(0, (attackValue * 2) - defenseValue);
  
  return damage;
}

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
  console.log(`Nouveau joueur connecté: ${socket.id}`);
  
  // Enregistrer le joueur
  players.set(socket.id, {
    id: socket.id,
    gameId: null
  });
  
  // Recherche d'adversaire
  socket.on('findOpponent', () => {
    if (!waitingPlayer) {
      // Aucun joueur en attente, ce joueur devient le joueur en attente
      waitingPlayer = socket.id;
      socket.emit('waiting');
    } else if (waitingPlayer !== socket.id) {
      // Un adversaire est trouvé
      const player1 = waitingPlayer;
      const player2 = socket.id;
      waitingPlayer = null;
      
      // Créer une nouvelle partie
      const gameState = createGame(player1, player2);
      
      // Informer les deux joueurs que la partie commence
      io.to(player1).emit('gameStart', {
        gameId: gameState.gameId,
        hero: gameState.players[player1].hero,
        opponent: gameState.players[player2].hero.name,
        isAttacker: gameState.players[player1].isAttacker
      });
      
      io.to(player2).emit('gameStart', {
        gameId: gameState.gameId,
        hero: gameState.players[player2].hero,
        opponent: gameState.players[player1].hero.name,
        isAttacker: gameState.players[player2].isAttacker
      });
    }
  });
  
  // Choix d'attaque
  socket.on('attack', ({ gameId, attackType }) => {
    const game = rooms.get(gameId);
    
    if (!game || game.gameOver || game.currentAttacker !== socket.id) {
      return;
    }
    
    const attacker = game.players[socket.id];
    const defenderId = Object.keys(game.players).find(id => id !== socket.id);
    const defender = game.players[defenderId];
    
    // Stocker le type d'attaque pour attendre la défense
    game.pendingAttack = {
      attackerId: socket.id,
      defenderId,
      attackType
    };
    
    // Informer le défenseur qu'il doit choisir une défense
    io.to(defenderId).emit('chooseDefense', { attackType });
  });
  
  // Choix de défense
  socket.on('defend', ({ gameId, defenseType }) => {
    const game = rooms.get(gameId);
    
    if (!game || !game.pendingAttack || game.pendingAttack.defenderId !== socket.id) {
      return;
    }
    
    const attacker = game.players[game.pendingAttack.attackerId];
    const defender = game.players[socket.id];
    
    // Calculer les dégâts
    const damage = calculateDamage(
      game.pendingAttack.attackType,
      defenseType,
      attacker,
      defender
    );
    
    // Appliquer les dégâts
    defender.health = Math.max(0, defender.health - damage);
    
    // Vérifier si la partie est terminée
    if (defender.health <= 0) {
      game.gameOver = true;
      game.winner = game.pendingAttack.attackerId;
      
      // Informer les deux joueurs que la partie est terminée
      io.to(game.pendingAttack.attackerId).emit('gameOver', {
        winner: true,
        heroName: attacker.hero.name
      });
      
      io.to(socket.id).emit('gameOver', {
        winner: false,
        heroName: attacker.hero.name
      });
      
      return;
    }
    conso
    
    // Changer le joueur attaquant
    game.currentAttacker = socket.id;
    attacker.isAttacker = false;
    defender.isAttacker = true;
    
    // Mettre à jour les deux joueurs sur l'état du jeu
    io.to(game.pendingAttack.attackerId).emit('turnResult', {
      damage,
      attackerHealth: attacker.health,
      defenderHealth: defender.health,
      isAttacker: false
    });
    
    io.to(socket.id).emit('turnResult', {
      damage,
      attackerHealth: defender.health,
      defenderHealth: attacker.health,
      isAttacker: true
    });
    
    // Nettoyer l'attaque en attente
    delete game.pendingAttack;
  });
  
  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté: ${socket.id}`);
    
    // Si le joueur était en attente, réinitialiser le joueur en attente
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }
    
    // Si le joueur était dans une partie, notifier l'autre joueur
    const player = players.get(socket.id);
    if (player && player.gameId) {
      const game = rooms.get(player.gameId);
      if (game) {
        // Trouver l'adversaire
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        
        if (opponentId) {
          // Notifier l'adversaire
          io.to(opponentId).emit('opponentLeft');
          
          // Mettre à jour l'état de l'adversaire
          const opponent = players.get(opponentId);
          if (opponent) {
            opponent.gameId = null;
          }
        }
        
        // Supprimer la partie
        rooms.delete(player.gameId);
      }
    }
    
    // Supprimer le joueur
    players.delete(socket.id);
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});