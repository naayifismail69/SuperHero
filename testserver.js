// Importer le module `fs` pour lire le fichier JSON
const fs = require('fs');

// Charger les super héros depuis le fichier JSON
const loadSuperHeroes = () => {
  const data = fs.readFileSync('heroes.json', 'utf-8'); // Assurez-vous que le chemin du fichier est correct
  return JSON.parse(data);
};


// Fonction pour attribuer un héros aléatoirement
const getRandomHero = (heroes) => {
  const randomIndex = Math.floor(Math.random() * heroes.length);
  return heroes[randomIndex];
};

// Fonction pour attribuer un héros à un joueur et à un adversaire
const assignHeroesToPlayers = (heroes) => {
  const playerHero = getRandomHero(heroes);
  let opponentHero;
  
  // Assurez-vous que l'adversaire est différent du joueur
  do {
    opponentHero = getRandomHero(heroes);
  } while (opponentHero.id === playerHero.id);

  return { playerHero, opponentHero };
};

// Chargement des super héros
const heroes = loadSuperHeroes();


//Definition des PV Initiaux (points de vies) pour chaque héros
const initialHealth = 1000;


// Attribution aléatoire des héros
const { playerHero, opponentHero } = assignHeroesToPlayers(heroes);


// La personne qui attaque est choisis aléatoirement.
const attacker = Math.random() < 0.5 ? playerHero : opponentHero;
const defender = attacker === playerHero ? opponentHero : playerHero;
 
//Si je suis l'attaquant, je veux choisir l'attaque de mon joueur
const playerAttack = attacker === playerHero ? playerHero.attack : opponentHero.attack;
const opponentAttack = attacker === opponentHero ? opponentHero.attack : playerHero.attack;


console.log("Voici la liste des héros disponibles :");
heroes.forEach(hero => {
  //console.log(`- ${hero.name}`);
});


console.log(`Le héros attribué au joueur est : ${playerHero.name}`);
console.log(`L'adversaire attribué est : ${opponentHero.name}`);
console.log(`Le premier attaquant est : ${attacker.name}`);
console.log(`Le permier défenseur est : ${defender.name}`);
console.log(`Le PV initiaux de ${playerHero.name} est : ${initialHealth}`);
console.log(`Le PV initiaux de ${opponentHero.name} est : ${initialHealth}`);

console.log("L'attaque choisie est : ");
console.log(`- ${playerAttack}`);