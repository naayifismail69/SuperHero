// Établir une connexion avec le serveur
const socket = io("http://localhost:3000", {
    transports: ['websocket']
});

// Éléments DOM
const waitingScreen = document.getElementById('waitingScreen');
const gameArea = document.getElementById('gameArea');
const resultScreen = document.getElementById('resultScreen');
const victoryMessage = document.getElementById('victoryMessage');
const defeatMessage = document.getElementById('defeatMessage');
const playAgainBtn = document.getElementById('playAgainBtn');
const resultImage = document.getElementById('resultImage');

const yourHeroName = document.getElementById('yourHeroName');
const yourHeroImage = document.getElementById('yourHeroImage');
const yourHealthValue = document.getElementById('yourHealthValue');
const yourHealthFill = document.getElementById('yourHealthFill');
const yourRole = document.getElementById('yourRole');

const opponentHeroName = document.getElementById('opponentHeroName');
const opponentHeroImage = document.getElementById('opponentHeroImage');
const opponentHealthValue = document.getElementById('opponentHealthValue');
const opponentHealthFill = document.getElementById('opponentHealthFill');
const opponentRole = document.getElementById('opponentRole');

const messageLog = document.getElementById('messageLog');
const attackButtons = document.getElementById('attackButtons');
const defenseButtons = document.getElementById('defenseButtons');

// Variables globales
let myHero;
let myRole;
let opponentHero;
let attacks = [];
let defenses = [];
let incomingAttack = null;

// Fonction pour mettre à jour les barres de statistiques
function updateStatBars(hero, prefix) {
    const stats = hero.powerstats;
    
    document.getElementById(`${prefix}IntelligenceValue`).textContent = stats.intelligence;
    document.getElementById(`${prefix}IntelligenceFill`).style.width = `${stats.intelligence}%`;
    
    document.getElementById(`${prefix}StrengthValue`).textContent = stats.strength;
    document.getElementById(`${prefix}StrengthFill`).style.width = `${stats.strength}%`;
    
    document.getElementById(`${prefix}SpeedValue`).textContent = stats.speed;
    document.getElementById(`${prefix}SpeedFill`).style.width = `${stats.speed}%`;
    
    document.getElementById(`${prefix}DurabilityValue`).textContent = stats.durability;
    document.getElementById(`${prefix}DurabilityFill`).style.width = `${stats.durability}%`;
    
    document.getElementById(`${prefix}PowerValue`).textContent = stats.power;
    document.getElementById(`${prefix}PowerFill`).style.width = `${stats.power}%`;
    
    document.getElementById(`${prefix}CombatValue`).textContent = stats.combat;
    document.getElementById(`${prefix}CombatFill`).style.width = `${stats.combat}%`;
}

// Fonction pour mettre à jour les barres de vie
function updateHealthBar(hp, maxHp, element, fillElement) {
    const percentage = Math.max(0, (hp / maxHp) * 100);
    element.textContent = `${hp} PV`;
    fillElement.style.width = `${percentage}%`;
    
    // Animation de secousse si dégâts importants
    if (percentage < 30) {
        fillElement.parentElement.parentElement.classList.add('shake');
        setTimeout(() => {
            fillElement.parentElement.parentElement.classList.remove('shake');
        }, 500);
    }
}

// Fonction pour ajouter un message au journal
function addMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    messageLog.appendChild(messageElement);
    messageLog.scrollTop = messageLog.scrollHeight;
}

// Fonction pour calculer les dégâts
function calculateDamage(attack, defense) {
    const statUsed = myHero.powerstats[attack.superPower.toLowerCase()];
    const baseDamage = statUsed * attack.modifier;
    const defenseReduction = defense ? defense.reduction : 0;
    const finalDamage = Math.max(0, baseDamage - defenseReduction);
    
    return {
        baseDamage: baseDamage,
        defenseReduction: defenseReduction,
        finalDamage: finalDamage
    };
}

// Fonction pour mettre à jour l'interface en fonction du rôle
function updateInterface() {
    if (myRole === 'attacker') {
        yourRole.textContent = 'Attaquant';
        yourRole.className = 'hero-role role-attacker';
        opponentRole.textContent = 'Défenseur';
        opponentRole.className = 'hero-role role-defender';
        
        // Activer les boutons d'attaque, désactiver les boutons de défense
        Array.from(attackButtons.querySelectorAll('button')).forEach(btn => {
            btn.disabled = false;
        });
        
        Array.from(defenseButtons.querySelectorAll('button')).forEach(btn => {
            btn.disabled = true;
        });
        
        addMessage('C\'est votre tour d\'attaquer ! Choisissez une attaque.', 'system');
    } else {
        yourRole.textContent = 'Défenseur';
        yourRole.className = 'hero-role role-defender';
        opponentRole.textContent = 'Attaquant';
        opponentRole.className = 'hero-role role-attacker';
        
        // Désactiver les boutons d'attaque
        Array.from(attackButtons.querySelectorAll('button')).forEach(btn => {
            btn.disabled = true;
        });
        
        // Les boutons de défense seront activés lorsqu'une attaque arrive
        Array.from(defenseButtons.querySelectorAll('button')).forEach(btn => {
            btn.disabled = true;
        });
        
        addMessage('En attente de l\'attaque de l\'adversaire...', 'system');
    }
}

// Générer les boutons d'attaque et de défense
function generateActionButtons() {
    // Vider les conteneurs
    attackButtons.innerHTML = '';
    defenseButtons.innerHTML = '';
    
    // Créer les boutons d'attaque
    attacks.forEach(attack => {
        const button = document.createElement('button');
        button.className = 'attack-btn';
        
        // Icône différente selon le type d'attaque
        let icon = '⚔️';
        if (attack.superPower.toLowerCase() === 'intelligence') icon = '🧠';
        else if (attack.superPower.toLowerCase() === 'speed') icon = '⚡';
        
        button.innerHTML = `
            <span class="action-icon">${icon}</span>
            <span>
                <strong>${attack.name}</strong><br>
                <small>${attack.superPower} (x${attack.modifier})</small>
            </span>
        `;
        
        button.disabled = myRole !== 'attacker';
        
        button.addEventListener('click', () => {
            // Calcul des dégâts de base (sans défense)
            const damageInfo = calculateDamage(attack, null);
            
            socket.emit('attack', { 
                attackName: attack.name,
                baseDamage: damageInfo.baseDamage,
                potentialDamage: damageInfo.finalDamage,
                statUsed: attack.superPower
            });
            
            addMessage(`⚔️ Vous utilisez ${attack.name} (${attack.superPower}) !`, 'attack');
            addMessage(`💥 Dégâts potentiels: ${damageInfo.baseDamage} (${myHero.powerstats[attack.superPower.toLowerCase()]} × ${attack.modifier})`, 'damage');
            
            // Désactiver tous les boutons d'attaque après l'avoir utilisé
            Array.from(attackButtons.querySelectorAll('button')).forEach(btn => {
                btn.disabled = true;
            });
        });
        
        attackButtons.appendChild(button);
    });
    
    // Créer les boutons de défense
    defenses.forEach(defense => {
        const button = document.createElement('button');
        button.className = 'defense-btn';
        
        // Icône différente selon le type de défense
        let icon = '🛡️';
        if (defense.superPower.toLowerCase() === 'durability') icon = '🛡️';
        else if (defense.superPower.toLowerCase() === 'intelligence') icon = '🧠';
        
        button.innerHTML = `
            <span class="action-icon">${icon}</span>
            <span>
                <strong>${defense.name}</strong><br>
                <small>${defense.superPower} (-${defense.reduction})</small>
            </span>
        `;
        
        button.disabled = myRole !== 'defender' || !incomingAttack;
        
        button.addEventListener('click', () => {
            // Trouver l'attaque correspondante dans notre liste
            const attackUsed = attacks.find(a => a.name === incomingAttack.attackName);
            
            socket.emit('defend', { 
                defenseName: defense.name,
                incomingAttack: incomingAttack.attackName,
                baseDamage: incomingAttack.baseDamage,
                defenseReduction: defense.reduction,
                statUsed: attackUsed.superPower
            });
            
            addMessage(`🛡️ Vous utilisez ${defense.name} contre ${incomingAttack.attackName} !`, 'defense');
            addMessage(`🛡 Réduction de dégâts: ${defense.reduction} points`, 'damage');
            
            // Désactiver tous les boutons de défense après l'avoir utilisé
            Array.from(defenseButtons.querySelectorAll('button')).forEach(btn => {
                btn.disabled = true;
            });
            
            // Réinitialiser l'attaque entrante
            incomingAttack = null;
        });
        
        defenseButtons.appendChild(button);
    });
}

// Événements socket.io
// Quand un héros est attribué au joueur
socket.on('hero-assigned', (data) => {
    myHero = data.hero;
    attacks = data.attacks;
    defenses = data.defenses;
    
    // Mettre à jour l'interface avec les informations du héros
    yourHeroName.textContent = myHero.name;
    updateStatBars(myHero, 'your');
    
    // Générer les boutons d'attaque et de défense
    generateActionButtons();
    
    // Charger l'image du héros
    const imgElement = document.createElement('img');
    imgElement.src = myHero.images.md || 'https://via.placeholder.com/180x240';
    imgElement.alt = myHero.name;
    imgElement.onerror = () => {
        yourHeroImage.innerHTML = `<div>${myHero.name}</div>`;
    };
    yourHeroImage.innerHTML = '';
    yourHeroImage.appendChild(imgElement);
});

// En attente d'un adversaire
socket.on('waiting-for-opponent', () => {
    waitingScreen.style.display = 'block';
    gameArea.style.display = 'none';
    resultScreen.style.display = 'none';
});

// Début de la partie
socket.on('game-start', (data) => {
    myRole = data.role;
    opponentHero = data.opponent.hero;
    
    // Mettre à jour l'interface avec les informations de l'adversaire
    opponentHeroName.textContent = opponentHero.name;
    updateStatBars(opponentHero, 'opponent');
    updateHealthBar(data.opponent.hp, 1000, opponentHealthValue, opponentHealthFill);
    
    // Charger l'image de l'adversaire
    const imgElement = document.createElement('img');
    imgElement.src = opponentHero.images.md || 'https://via.placeholder.com/180x240';
    imgElement.alt = opponentHero.name;
    imgElement.onerror = () => {
        opponentHeroImage.innerHTML = `<div>${opponentHero.name}</div>`;
    };
    opponentHeroImage.innerHTML = '';
    opponentHeroImage.appendChild(imgElement);
    
    // Mettre à jour l'interface en fonction du rôle
    updateInterface();
    
    // Afficher la zone de jeu
    waitingScreen.style.display = 'none';
    gameArea.style.display = 'flex';
    resultScreen.style.display = 'none';
    
    // Ajouter un message de début de jeu
    addMessage(`La partie commence ! Vous êtes ${myHero.name} et vous affrontez ${opponentHero.name}.`, 'system');
    addMessage(`Vous êtes ${myRole === 'attacker' ? 'l\'attaquant' : 'le défenseur'} pour ce tour.`, 'system');
});

// Réception d'une attaque
socket.on('incoming-attack', (data) => {
    incomingAttack = data;
    
    addMessage(`⚔️ ${data.attacker} vous attaque avec ${data.attackName} (${data.statUsed}) !`, 'attack');
    addMessage(`💥 Dégâts de base: ${data.baseDamage} (${data.statUsed} × modificateur)`, 'damage');
    addMessage('🛡️ Choisissez une défense !', 'system');
    
    // Activer les boutons de défense
    Array.from(defenseButtons.querySelectorAll('button')).forEach(btn => {
        btn.disabled = false;
    });
});

// Confirmation d'envoi d'attaque
socket.on('attack-sent', (data) => {
    addMessage(`⚔️ Vous avez attaqué avec ${data.attackName} (${data.statUsed})`, 'attack');
    addMessage(`💥 Dégâts potentiels: ${data.potentialDamage} points`, 'damage');
    addMessage('En attente de la défense de l\'adversaire...', 'system');
});

// Résultat de la défense
socket.on('defense-result', (data) => {
    if (data.yourHp !== undefined) {
        // Mise à jour pour le défenseur
        updateHealthBar(data.yourHp, 1000, yourHealthValue, yourHealthFill);
        addMessage(`🛡️ Vous avez utilisé ${data.defenseName} et réduit ${data.defenseReduction} points de dégâts.`, 'defense');
        addMessage(`💥 Dégâts finaux: ${data.finalDamage} (${data.baseDamage} - ${data.defenseReduction})`, 'damage');
        addMessage(`❤️ Vous subissez ${data.finalDamage} points de dégâts. Il vous reste ${data.yourHp} PV.`, 'system');
    } else {
        // Mise à jour pour l'attaquant
        updateHealthBar(data.defenderHp, 1000, opponentHealthValue, opponentHealthFill);
        addMessage(`🛡️ L'adversaire a utilisé ${data.defenseName} et réduit ${data.defenseReduction} points de dégâts.`, 'defense');
        addMessage(`💥 Dégâts finaux: ${data.finalDamage} (${data.baseDamage} - ${data.defenseReduction})`, 'damage');
        addMessage(`⚔️ Votre attaque inflige ${data.finalDamage} points de dégâts. Il reste ${data.defenderHp} PV à l'adversaire.`, 'system');
    }
});

// Changement de rôle
socket.on('role-change', (data) => {
    myRole = data.role;
    updateInterface();
});

// Victoire
socket.on('victory', (data) => {
    waitingScreen.style.display = 'none';
    gameArea.style.display = 'none';
    resultScreen.style.display = 'block';
    
    victoryMessage.style.display = 'block';
    defeatMessage.style.display = 'none';
    
    // Ajouter l'image du héros victorieux
    resultImage.className = 'result-image win-image';
    resultImage.innerHTML = '';
    const img = document.createElement('img');
    img.src = myHero.images.md || 'https://via.placeholder.com/150';
    img.alt = 'Victoire';
    resultImage.appendChild(img);
});

// Défaite
socket.on('defeat', (data) => {
    waitingScreen.style.display = 'none';
    gameArea.style.display = 'none';
    resultScreen.style.display = 'block';
    
    victoryMessage.style.display = 'none';
    defeatMessage.style.display = 'block';
    
    // Ajouter l'image du héros vaincu
    resultImage.className = 'result-image lose-image';
    resultImage.innerHTML = '';
    const img = document.createElement('img');
    img.src = myHero.images.md || 'https://via.placeholder.com/150';
    img.alt = 'Défaite';
    resultImage.appendChild(img);
});

// Adversaire déconnecté
socket.on('opponent-left', () => {
    addMessage('Votre adversaire s\'est déconnecté. Vous avez gagné par forfait.', 'system');
    
    setTimeout(() => {
        waitingScreen.style.display = 'none';
        gameArea.style.display = 'none';
        resultScreen.style.display = 'block';
        
        victoryMessage.style.display = 'block';
        defeatMessage.style.display = 'none';
        
        // Ajouter l'image du héros victorieux
        resultImage.className = 'result-image win-image';
        resultImage.innerHTML = '';
        const img = document.createElement('img');
        img.src = myHero.images.md || 'https://via.placeholder.com/150';
        img.alt = 'Victoire';
        resultImage.appendChild(img);
    }, 2000);
});

// Bouton pour rejouer
playAgainBtn.addEventListener('click', () => {
    window.location.reload();
});