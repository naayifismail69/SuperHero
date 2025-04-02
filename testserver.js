const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Charger les données des superhéros
const superheroes = JSON.parse(fs.readFileSync('./heroes.json', 'utf8'));

// Définir les attaques et défenses
const attacks = [
  { superPower: 'Intelligence', name: 'Stratégie imparable', modifier: 1.1 },
  { superPower: 'Intelligence', name: 'Feinte déstabilisante', modifier: 1.05 },
  { superPower: 'Force', name: 'Coup de poing titanesque', modifier: 1.5 },
  { superPower: 'Force', name: 'Coup de pied écrasant', modifier: 1.4 },
  { superPower: 'Vitesse', name: 'Frappe éclair', modifier: 1.3 },
  { superPower: 'Vitesse', name: 'Rafale de coups', modifier: 1.2 },
  { superPower: 'Durabilité', name: 'Impact écrasant', modifier: 1.4 },
  { superPower: 'Durabilité', name: 'Résistance offensive', modifier: 1.3 },
  { superPower: 'Puissance', name: 'Rayon laser', modifier: 1.7 },
  { superPower: 'Puissance', name: 'Explosion télékinétique', modifier: 1.6 },
  { superPower: 'Combat', name: 'Combo martial', modifier: 1.3 },
  { superPower: 'Combat', name: 'Projection au sol', modifier: 1.2 }
];

const defenses = [
  { superPower: 'Intelligence', name: 'Lecture de l\'attaque', reduction: 10 },
  { superPower: 'Intelligence', name: 'Feinte défensive', reduction: 8 },
  { superPower: 'Force', name: 'Blocage indestructible', reduction: 15 },
  { superPower: 'Force', name: 'Parade musclée', reduction: 12 },
  { superPower: 'Vitesse', name: 'Esquive ultra-rapide', reduction: 20 },
  { superPower: 'Vitesse', name: 'Déplacement instantané', reduction: 18 },
  { superPower: 'Durabilité', name: 'Endurance renforcée', reduction: 15 },
  { superPower: 'Durabilité', name: 'Absorption des chocs', reduction: 12 },
  { superPower: 'Puissance', name: 'Bouclier d\'énergie', reduction: 25 },
  { superPower: 'Puissance', name: 'Absorption d\'énergie', reduction: 22 },
  { superPower: 'Combat', name: 'Riposte défensive', reduction: 14 },
  { superPower: 'Combat', name: 'Contre-attaque rapide', reduction: 12 }
];

// Stocker les informations des joueurs
const players = {};
let waitingPlayer = null;
let gameInProgress = false;

// Gérer les connexions
io.on('connection', (socket) => {
  console.log('Un joueur s\'est connecté:', socket.id);

  // Attribuer un superhéros aléatoire au joueur
  const randomHero = superheroes[Math.floor(Math.random() * superheroes.length)];
  
  // Créer le joueur
  players[socket.id] = {
    id: socket.id,
    hero: randomHero,
    hp: 1000,
    role: null // 'attacker' ou 'defender'
  };

  // Informer le joueur de son héros
  socket.emit('hero-assigned', { 
    hero: randomHero,
    attacks: attacks,
    defenses: defenses
  });

  // Si un joueur attend déjà, démarrer une partie
  if (waitingPlayer && !gameInProgress) {
    const player1 = players[waitingPlayer];
    const player2 = players[socket.id];
    
    // Déterminer aléatoirement qui attaque et qui défend
    if (Math.random() > 0.5) {
      player1.role = 'attacker';
      player2.role = 'defender';
    } else {
      player1.role = 'defender';
      player2.role = 'attacker';
    }
    
    // Informer les joueurs de leurs rôles
    io.to(waitingPlayer).emit('game-start', {
      role: player1.role,
      opponent: {
        hero: player2.hero,
        hp: player2.hp
      }
    });
    
    io.to(socket.id).emit('game-start', {
      role: player2.role,
      opponent: {
        hero: player1.hero,
        hp: player1.hp
      }
    });
    
    // Marquer le jeu comme en cours
    gameInProgress = true;
    waitingPlayer = null;
  } else {
    // Mettre le joueur en attente
    waitingPlayer = socket.id;
    socket.emit('waiting-for-opponent');
  }

  // Gérer les attaques
  socket.on('attack', (data) => {
    const attacker = players[socket.id];
    let defender = null;
    
    // Trouver le défenseur
    for (const id in players) {
      if (id !== socket.id) {
        defender = players[id];
        break;
      }
    }
    
    if (!defender || attacker.role !== 'attacker') {
      return;
    }
    
    // Trouver l'attaque choisie
    const selectedAttack = attacks.find(a => a.name === data.attackName);
    if (!selectedAttack) return;
    
    // Calculer les dégâts en fonction du pouvoir correspondant
    const powerStat = selectedAttack.superPower.toLowerCase();
    let baseDamage = 0;
    
    switch (powerStat) {
      case 'intelligence':
        baseDamage = attacker.hero.powerstats.intelligence;
        break;
      case 'force':
      case 'strength':
        baseDamage = attacker.hero.powerstats.strength;
        break;
      case 'vitesse':
      case 'speed':
        baseDamage = attacker.hero.powerstats.speed;
        break;
      case 'durabilité':
      case 'durability':
        baseDamage = attacker.hero.powerstats.durability;
        break;
      case 'puissance':
      case 'power':
        baseDamage = attacker.hero.powerstats.power;
        break;
      case 'combat':
        baseDamage = attacker.hero.powerstats.combat;
        break;
    }
    
    // Appliquer le modificateur d'attaque
    const damage = Math.round(baseDamage * selectedAttack.modifier);
    
    // Informer les deux joueurs de l'attaque
    io.to(defender.id).emit('incoming-attack', {
      attackName: selectedAttack.name,
      attacker: attacker.hero.name,
      damage: damage
    });
    
    socket.emit('attack-sent', {
      attackName: selectedAttack.name,
      damage: damage
    });
  });

  // Gérer les défenses
  socket.on('defend', (data) => {
    const defender = players[socket.id];
    let attacker = null;
    
    // Trouver l'attaquant
    for (const id in players) {
      if (id !== socket.id) {
        attacker = players[id];
        break;
      }
    }
    
    if (!attacker || defender.role !== 'defender') {
      return;
    }
    
    // Trouver la défense choisie
    const selectedDefense = defenses.find(d => d.name === data.defenseName);
    if (!selectedDefense) return;
    
    // Calculer la réduction de dégâts
    const damageReduction = selectedDefense.reduction;
    const finalDamage = Math.max(0, data.incomingDamage - damageReduction);
    
    // Appliquer les dégâts
    defender.hp -= finalDamage;
    
    // Vérifier si le défenseur est vaincu
    if (defender.hp <= 0) {
      io.to(attacker.id).emit('victory', {
        heroName: attacker.hero.name
      });
      
      socket.emit('defeat', {
        heroName: defender.hero.name
      });
      
      // Réinitialiser le jeu
      gameInProgress = false;
      delete players[attacker.id];
      delete players[defender.id];
    } else {
      // Informer les deux joueurs du résultat
      io.to(attacker.id).emit('defense-result', {
        defenseName: selectedDefense.name,
        damageReduction: damageReduction,
        finalDamage: finalDamage,
        defenderHp: defender.hp
      });
      
      socket.emit('defense-result', {
        defenseName: selectedDefense.name,
        damageReduction: damageReduction,
        finalDamage: finalDamage,
        yourHp: defender.hp
      });
      
      // Inverser les rôles
      attacker.role = 'defender';
      defender.role = 'attacker';
      
      // Informer les joueurs du changement de rôle
      io.to(attacker.id).emit('role-change', { role: 'defender' });
      socket.emit('role-change', { role: 'attacker' });
    }
  });

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log('Un joueur s\'est déconnecté:', socket.id);
    
    // Si le joueur était en attente, réinitialiser
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }
    
    // Si le joueur était dans une partie, informer l'autre joueur
    if (gameInProgress) {
      for (const id in players) {
        if (id !== socket.id) {
          io.to(id).emit('opponent-left');
          gameInProgress = false;
          break;
        }
      }
    }
    
    // Supprimer le joueur
    delete players[socket.id];
  });
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});