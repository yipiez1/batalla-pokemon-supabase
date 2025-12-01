// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://yktvjgydcbqfbnryvzsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdHZqZ3lkY2JxZmJucnl2enNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDAyMTksImV4cCI6MjA4MDA3NjIxOX0.D8iDmR7W67q-drlmTWPF9TCxMLcERo-wO1a-uDzgJBU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales
let POKEMON_BASE_STATS = {};
let MOVES = {};
let gameState = null;

const MAX_BAR_WIDTH = 250; 

// --- CARGA DE DATOS ---
async function loadGameData() {
    // 1. Cargar Pokémons
    const { data: pokemonsData, error: pokeError } = await supabase
        .from('pokemons')
        .select('*');
    
    if (pokeError) throw pokeError;

    pokemonsData.forEach(p => {
        POKEMON_BASE_STATS[p.id] = {
            name: p.name,
            hp: p.hp,
            damage: p.damage,
            sprite: p.sprite
        };
    });

    // 2. Cargar Movimientos
    const { data: movesData, error: moveError } = await supabase
        .from('moves')
        .select('*');
        
    if (moveError) throw moveError;

    MOVES['default'] = {};
    movesData.forEach(m => {
        if (!MOVES[m.pokemon_id]) {
            MOVES[m.pokemon_id] = {};
        }
        MOVES[m.pokemon_id][m.move_slot] = {
            name: m.name,
            basePower: m.base_power,
            isStatus: m.is_status,
            defenseBonus: m.defense_bonus
        };
    });
}

// --- LÓGICA DEL JUEGO ---

function initializeTeam(teamIds) {
    return teamIds.map(id => {
        const stats = POKEMON_BASE_STATS[id];
        // Protección por si un ID no existe en la base de datos
        if (!stats) {
            console.error("No se encontró el Pokémon con ID:", id);
            return null;
        }
        return {
            id: id,
            name: stats.name,
            currentHp: stats.hp,
            maxHp: stats.hp,
            damage: stats.damage,
            sprite: stats.sprite,
            moves: MOVES[id] || MOVES['default'],
            defenseBonus: 0,
            isFainted: false,
        };
    }).filter(p => p !== null); // Eliminar nulos si hubo error
}

function updateActivePokemonDisplay(playerState) {
    const activePoke = playerState.team[playerState.activeSlot];
    const healthPercent = activePoke.currentHp / activePoke.maxHp;
    const newBarWidth = MAX_BAR_WIDTH * healthPercent;
    
    playerState.lifeBarElement.style.width = Math.max(0, newBarWidth) + 'px';
    playerState.lifeBarElement.style.backgroundColor = getHealthColor(healthPercent);
    playerState.hpTextElement.textContent = `HP: ${Math.max(0, activePoke.currentHp)}`;

    document.querySelector(`.info.info-${playerState.teamTag} .nombre-poke`).textContent = activePoke.name;
    playerState.pokeElement.src = `img/${activePoke.sprite}`;
}

function updateTeamDisplay(playerTag, team) {
    const isP1 = playerTag === 'j1';
    const activeSlot = isP1 ? gameState.p1.activeSlot : gameState.p2.activeSlot;
    
    team.forEach((poke, index) => {
        const slotIndex = isP1 ? index + 1 : index + 4;
        const pokeElement = document.querySelector(`.icon-${playerTag}-${index + 1}`);
        const ballElement = document.querySelector(`.pokeball-${slotIndex}`);

        if (!pokeElement || !ballElement) return;

        if (index === activeSlot) {
            pokeElement.style.opacity = 0;
            ballElement.style.opacity = 1;
        } else if (poke.isFainted) {
            pokeElement.style.opacity = 0.3; 
            ballElement.style.opacity = 0;
        } else {
            pokeElement.style.opacity = 1;
            ballElement.style.opacity = 0;
        }
    });
}

function getHealthColor(percent) {
    if (percent > 0.75) return '#00f218'; 
    if (percent > 0.50) return '#68c818'; 
    if (percent > 0.25) return '#ffde00'; 
    return '#ff2222'; 
}

function displayMessage(message, duration = 3000) {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'mensaje-batalla';
    messageContainer.textContent = message;

    messageContainer.style.cssText = `
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        padding: 20px 40px; background-color: #333; color: white; border: 4px solid #fff;
        border-radius: 28px; font-size: 30px; font-weight: bold; text-align: center;
        z-index: 10; opacity: 0; transition: opacity 0.5s; font-family: 'Pokemon Solid', sans-serif;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
    `;
    
    document.querySelector('.escritorio').appendChild(messageContainer);
    setTimeout(() => { messageContainer.style.opacity = 1; }, 50);
    setTimeout(() => {
        messageContainer.style.opacity = 0;
        messageContainer.addEventListener('transitionend', () => messageContainer.remove());
    }, duration);
}

function disableGameControls(showReset = true) {
    document.querySelector('.controles-principales').style.display = 'none';
    document.querySelector('.menu-ataque').style.display = 'none';
    document.querySelector('.menu-cambio').style.display = 'none';

    let resetButton = document.querySelector('.btn-reset');
    if (showReset) {
        if (!resetButton) {
            resetButton = document.createElement('div');
            resetButton.className = 'btn-reset';
            resetButton.textContent = 'REINICIAR';
            resetButton.style.cssText = `
                position: absolute; top: 30px; left: 50px; width: 250px; height: 60px;
                background-color: #4a90e2; border-radius: 50px; display: flex;
                align-items: center; justify-content: center; font-size: 32px;
                color: white; font-weight: bold; font-family: 'Pokemon Solid', sans-serif;
                text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
                z-index: 5; cursor: pointer; box-shadow: 0 5px #1c88a8; transition: all 0.1s;
            `;
            resetButton.addEventListener('click', () => location.reload());
            document.querySelector('.escritorio').appendChild(resetButton);
        }
        resetButton.style.display = 'flex'; 
    } else {
        if (resetButton) resetButton.style.display = 'none';
    }
}

function showSwapMenu(isForcedSwap = false) {
    if (gameState.isGameOver) return;
    gameState.isSwapForced = isForcedSwap; 

    document.querySelector('.controles-principales').style.display = 'none';
    document.querySelector('.menu-ataque').style.display = 'none';
    const swapMenu = document.querySelector('.menu-cambio');
    swapMenu.style.display = 'flex';
    swapMenu.innerHTML = ''; 

    gameState.p1.team.forEach((poke, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn-cambio-poke';
        btn.textContent = poke.name;
        
        const hpSpan = document.createElement('span');
        hpSpan.className = 'hp-cambio';
        hpSpan.textContent = `HP: ${poke.currentHp}/${poke.maxHp}`;
        btn.appendChild(hpSpan);
        btn.dataset.slotIndex = index;
        
        if (poke.isFainted || index === gameState.p1.activeSlot) {
            btn.disabled = true;
            btn.style.opacity = 0.5;
        } else {
            btn.addEventListener('click', handleSwapSelection);
        }
        swapMenu.appendChild(btn);
    });

    if (!isForcedSwap) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn-ataque btn-atras';
        backBtn.textContent = 'ATRÁS';
        backBtn.onclick = handleBackButton;
        swapMenu.appendChild(backBtn);
    }
}

function updateAttackMenu() {
    const activePokeMoves = gameState.p1.team[gameState.p1.activeSlot].moves;
    const attackButtons = document.querySelectorAll('.btn-ataque');
    
    for (let i = 0; i < 3; i++) {
        const button = attackButtons[i];
        const move = activePokeMoves[i + 1];
        if (move) {
            button.innerHTML = move.name;
            const powerText = move.isStatus 
                ? (move.defenseBonus > 0 ? `(+${move.defenseBonus * 100} DEF)` : '(ESTADO)')
                : `(${move.basePower} PWR)`;
            const span = document.createElement('span');
            span.className = 'bonus-defensa';
            span.textContent = powerText;
            button.appendChild(span);
            button.dataset.attackId = i + 1;
            button.onclick = handlePlayerAttack;
            button.style.display = 'flex';
        } else {
            button.style.display = 'none';
        }
    }
}

function checkWinCondition() {
    const p1Active = gameState.p1.team[gameState.p1.activeSlot];
    const p2Active = gameState.p2.team[gameState.p2.activeSlot];
    let turnHandled = false;
    let delay = 0;

    if (p1Active.currentHp <= 0 && !p1Active.isFainted) {
        p1Active.isFainted = true;
        displayMessage(`${p1Active.name} se debilitó!`);
        updateTeamDisplay('j1', gameState.p1.team);
        
        const available = gameState.p1.team.filter(p => !p.isFainted).length;
        delay = 3000;
        
        if (available > 0) {
            setTimeout(() => showSwapMenu(true), delay); 
        } else {
            displayMessage(`¡${p2Active.name} ganó la batalla!`);
            gameState.isGameOver = true;
            disableGameControls();
        }
        turnHandled = true; 
    } 
    
    if (p2Active.currentHp <= 0 && !p2Active.isFainted) {
        p2Active.isFainted = true;
        displayMessage(`${p2Active.name} rival se debilitó!`);
        updateTeamDisplay('j2', gameState.p2.team);
        
        const available = gameState.p2.team.filter(p => !p.isFainted).length;
        delay = Math.max(delay, 3000); 

        if (available > 0) {
            setTimeout(handleOpponentForcedSwap, delay); 
        } else {
            displayMessage(`¡${p1Active.name} ganó la batalla!`);
            gameState.isGameOver = true;
            disableGameControls();
        }
        turnHandled = true; 
    }

    if (!turnHandled && !gameState.isGameOver) { 
        if ((gameState.turn % 2) === 0) {
            setTimeout(handleOpponentTurn, 1000); 
        } else {
            document.querySelector('.controles-principales').style.display = 'flex';
        }
    }
    return turnHandled; 
}

function performAttack(attackerState, defenderState, attackData, callback) {
    if (gameState.isGameOver) { callback?.(); return; }

    const DEFAULT_DELAY = 3000;
    let totalDelay = DEFAULT_DELAY;
    const defenderPlayerState = (defenderState.id === gameState.p1.team[gameState.p1.activeSlot].id) ? gameState.p1 : gameState.p2;

    if (attackData.isStatus) {
        if (attackData.defenseBonus > 0) {
            attackerState.defenseBonus = (attackerState.defenseBonus || 0) + attackData.defenseBonus;
            displayMessage(`${attackerState.name} usó ${attackData.name}! Defensa +${Math.round(attackData.defenseBonus * 100)}%!`, DEFAULT_DELAY);
        } else {
            displayMessage(`${attackerState.name} usó ${attackData.name}.`, DEFAULT_DELAY);
        }
        setTimeout(callback, DEFAULT_DELAY);
        return;
    }

    const baseDamage = attackerState.damage * (attackData.basePower / 100);
    const variation = Math.floor(Math.random() * (baseDamage * 0.2)) - (baseDamage * 0.1); 
    let finalDamage = Math.max(1, Math.round(baseDamage + variation)); 

    if (defenderState.defenseBonus > 0) {
        finalDamage = Math.max(1, Math.round(finalDamage / (1.0 + defenderState.defenseBonus)));
        displayMessage(`${defenderState.name} se defiende! Daño reducido.`, 2000);
        totalDelay += 2000;
    }

    defenderState.currentHp = Math.max(0, defenderState.currentHp - finalDamage);
    displayMessage(`${attackerState.name} usó ${attackData.name}! Daño: ${finalDamage}`, DEFAULT_DELAY);
    totalDelay += DEFAULT_DELAY;

    setTimeout(() => {
        updateActivePokemonDisplay(defenderPlayerState);
    }, totalDelay - DEFAULT_DELAY); 

    setTimeout(callback, totalDelay);
}

function handleOpponentTurn() {
    if (gameState.isGameOver) return;
    const p2Poke = gameState.p2.team[gameState.p2.activeSlot];
    const p1Poke = gameState.p1.team[gameState.p1.activeSlot];
    
    const availableMoves = Object.values(p2Poke.moves);
    const attackData = availableMoves[Math.floor(Math.random() * availableMoves.length)];

    disableGameControls(false); 
    gameState.turn++;
    performAttack(p2Poke, p1Poke, attackData, checkWinCondition);
}

function handlePlayerAttack(event) {
    if (gameState.isGameOver) return;
    const moveId = parseInt(event.currentTarget.dataset.attackId);
    const p1Poke = gameState.p1.team[gameState.p1.activeSlot];
    const p2Poke = gameState.p2.team[gameState.p2.activeSlot];
    const attackData = p1Poke.moves[moveId];

    document.querySelector('.menu-ataque').style.display = 'none';
    disableGameControls(false); 
    gameState.turn++;
    performAttack(p1Poke, p2Poke, attackData, checkWinCondition); 
}

function handleSwapSelection(event) {
    const newSlot = parseInt(event.currentTarget.dataset.slotIndex);
    const oldSlot = gameState.p1.activeSlot;
    const oldPoke = gameState.p1.team[oldSlot];
    
    gameState.p1.activeSlot = newSlot;
    const newPoke = gameState.p1.team[newSlot];
    
    oldPoke.defenseBonus = 0; 
    newPoke.defenseBonus = 0;

    document.querySelector('.menu-cambio').style.display = 'none';
    displayMessage(`${oldPoke.name} vuelve! Ve, ${newPoke.name}!`, 3000);
    
    setTimeout(() => {
        updateActivePokemonDisplay(gameState.p1);
        updateAttackMenu();
        updateTeamDisplay('j1', gameState.p1.team);
    }, 100); 

    if (gameState.isSwapForced) {
        gameState.isSwapForced = false;
        setTimeout(() => { document.querySelector('.controles-principales').style.display = 'flex'; }, 3100); 
    } else {
        gameState.turn++; 
        setTimeout(handleOpponentTurn, 4100); 
    }
}

function handleOpponentForcedSwap() {
    const oldSlot = gameState.p2.activeSlot;
    gameState.p2.team[oldSlot].defenseBonus = 0; 
    
    const availableSlot = gameState.p2.team.findIndex(p => !p.isFainted);

    if (availableSlot !== -1) {
        gameState.p2.activeSlot = availableSlot;
        const newPoke = gameState.p2.team[availableSlot];
        newPoke.defenseBonus = 0; 

        displayMessage(`El rival sacó a ${newPoke.name}!`, 3000);
        
        setTimeout(() => {
            updateActivePokemonDisplay(gameState.p2);
            updateTeamDisplay('j2', gameState.p2.team);
        }, 100); 
        
        setTimeout(() => {
            document.querySelector('.controles-principales').style.display = 'flex';
        }, 4100);
    } else {
        disableGameControls(); 
    }
}

function handleBackButton() {
    document.querySelector('.menu-ataque').style.display = 'none';
    document.querySelector('.menu-cambio').style.display = 'none';
    document.querySelector('.controles-principales').style.display = 'flex';
}

document.querySelector('.btn-luchar').addEventListener('click', () => {
    document.querySelector('.controles-principales').style.display = 'none';
    updateAttackMenu();
    document.querySelector('.menu-ataque').style.display = 'grid';
});

document.querySelector('.btn-cambiar').addEventListener('click', () => showSwapMenu(false));

document.querySelector('.btn-huir').addEventListener('click', () => {
    if (gameState.isGameOver) return;
    displayMessage(`No puedes huir de un combate de entrenador!`);
    disableGameControls(false); 
    gameState.turn++; 
    setTimeout(handleOpponentTurn, 2000); 
});

// --- INICIALIZACIÓN ---
window.onload = async () => {
    disableGameControls(false); 
    document.querySelector('.controles-principales').style.display = 'none';
    
    try {
        await loadGameData();
    } catch (e) {
        console.error("Error cargando Supabase:", e);
        alert("Error cargando datos. Revisa la consola.");
        return;
    }

    // Verificar si llegaron datos
    if (Object.keys(POKEMON_BASE_STATS).length === 0) {
        alert("Error Crítico: Supabase devolvió 0 Pokémon. Asegúrate de haber ejecutado el SQL para desactivar RLS.");
        return;
    }

    // EQUIPOS FIJOS (LOS DE TUS IMÁGENES ORIGINALES)
    const J1_IDS = ['103-m-1', '080-m-1', '055-f-1'];
    const J2_IDS = ['089-f-2', '038-f-1', '110-m-1'];

    gameState = {
        p1: {
            team: initializeTeam(J1_IDS),
            activeSlot: 0, 
            lifeBarElement: document.querySelector('.barra-vida.barra-j1'),
            hpTextElement: document.querySelector('.hp-texto.hp-j1'),
            pokeElement: document.querySelector('.poke-j1'),
            teamTag: 'j1',
        },
        p2: {
            team: initializeTeam(J2_IDS),
            activeSlot: 0, 
            lifeBarElement: document.querySelector('.barra-vida.barra-j2'),
            hpTextElement: document.querySelector('.hp-texto.hp-j2'),
            pokeElement: document.querySelector('.poke-j2'),
            teamTag: 'j2',
        },
        isGameOver: false,
        turn: 1, 
        isSwapForced: false,
    };

    // Actualizar iconos de la banca
    gameState.p1.team.forEach((poke, i) => {
        if(poke) document.querySelector(`.icon-j1-${i + 1}`).src = `img/${poke.sprite}`;
    });
    gameState.p2.team.forEach((poke, i) => {
        if(poke) document.querySelector(`.icon-j2-${i + 1}`).src = `img/${poke.sprite}`;
    });

    updateAttackMenu(); 
    updateActivePokemonDisplay(gameState.p1);
    updateActivePokemonDisplay(gameState.p2);
    updateTeamDisplay('j1', gameState.p1.team);
    updateTeamDisplay('j2', gameState.p2.team);

    if(gameState.p1.team[0]) {
        displayMessage(`¡Batalla: ${gameState.p1.team[0].name} VS ${gameState.p2.team[0].name}!`);
        setTimeout(() => { document.querySelector('.controles-principales').style.display = 'flex'; }, 3000);
    }
};