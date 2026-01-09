// Configuración de Supabase
const SUPABASE_URL = 'https://junonydusnrcumbjjzqt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vmnxlj3GbQPYqoXSjoK4IA_WN37wTR8';

// Inicializar Supabase (se inicializará después de que cargue el script)
let supabase;

// Estado del juego
let gameState = {
    currentUser: null,
    userId: null,
    userColor: null,
    gameActive: false,
    gameInProgress: false,
    board: null,
    emptyCells: [],
    correctAnswers: new Map(),
    pieces: [],
    users: new Map(),
    placedPieces: new Map(),
    tableSize: 10, // Tamaño de la tabla (5-15)
    missingPieces: 15 // Cantidad de piezas faltantes (10-30)
};

// Canal de Realtime para comunicación
let gameChannel = null;


// Colores disponibles para usuarios (colores claros y distintivos)
const USER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA',
    '#FCBAD3', '#A8E6CF', '#FFD93D', '#6BCB77', '#FFD93D',
    '#FFB347', '#87CEEB', '#DDA0DD', '#F0E68C', '#98D8C8'
];

// Elementos DOM
const usernameModal = document.getElementById('usernameModal');
const mainContainer = document.getElementById('mainContainer');
const usernameInput = document.getElementById('usernameInput');
const joinGameBtn = document.getElementById('joinGameBtn');
const newGameBtn = document.getElementById('newGameBtn');
const countdownModal = document.getElementById('countdownModal');
const countdownEl = document.getElementById('countdown');
const board = document.getElementById('multiplicationBoard');
const boardTitle = document.getElementById('boardTitle');
const piecesContainer = document.getElementById('piecesContainer');
const usersList = document.getElementById('usersList');
const gameCompleteModal = document.getElementById('gameCompleteModal');
const gameConfigModal = document.getElementById('gameConfigModal');
const restartGameBtn = document.getElementById('restartGameBtn');
const startGameBtn = document.getElementById('startGameBtn');
const cancelConfigBtn = document.getElementById('cancelConfigBtn');
const tableSizeSelect = document.getElementById('tableSize');
const missingPiecesInput = document.getElementById('missingPieces');
const finalScores = document.getElementById('finalScores');

// Función para inicializar Supabase
function initializeSupabase() {
    // El CDN expone la biblioteca como módulo ES6 a través de window.supabaseJs
    if (typeof window !== 'undefined' && window.supabaseJs && window.supabaseJs.createClient) {
        return window.supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
}

// Inicialización - esperar a que Supabase esté cargado
function waitForSupabase(maxAttempts = 50) {
    let attempts = 0;
    const checkSupabase = setInterval(() => {
        attempts++;
        supabase = initializeSupabase();
        
        if (supabase) {
            clearInterval(checkSupabase);
            initApp();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkSupabase);
            console.error('Supabase library not loaded after multiple attempts.');
            alert('Error: No se pudo cargar la biblioteca de Supabase. Por favor, recarga la página.');
        }
    }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que Supabase se cargue (se carga como módulo ES6)
    waitForSupabase();
});

// Función para inicializar la aplicación
function initApp() {
    if (!supabase) {
        console.error('Supabase not initialized');
        return;
    }

    joinGameBtn.addEventListener('click', joinGame);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    newGameBtn.addEventListener('click', function(e) {
        if (!this.disabled) {
            showGameConfig();
        }
    });
    restartGameBtn.addEventListener('click', showGameConfig);
    startGameBtn.addEventListener('click', startNewGameWithConfig);
    cancelConfigBtn.addEventListener('click', () => {
        gameConfigModal.classList.add('hidden');
    });
    
    // Actualizar máximo de piezas faltantes cuando cambia el tamaño del tablero
    tableSizeSelect.addEventListener('change', updateMissingPiecesMax);
    
    // Inicializar el máximo al cargar
    updateMissingPiecesMax();

    // Inicializar Realtime subscriptions
    setupRealtime();
}

// Función para unirse al juego
async function joinGame() {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Por favor ingresa un nombre de usuario');
        return;
    }

    const userId = generateUserId();
    // Obtener un color único que no esté en uso
    const userColor = getAvailableUserColor();

    gameState.currentUser = username;
    gameState.userId = userId;
    gameState.userColor = userColor;

    // Agregar usuario actual a la lista local
    gameState.users.set(userId, {
        id: userId,
        username: username,
        color: userColor
    });
    gameState.placedPieces.set(userId, 0);

    usernameModal.classList.add('hidden');
    mainContainer.classList.remove('hidden');

    // Suscribirse al canal de juego
    await subscribeToGameChannel();

    // Esperar un momento para asegurar que la suscripción esté completamente activa
    await new Promise(resolve => setTimeout(resolve, 200));

    // Notificar a otros usuarios que nos hemos unido (enviar múltiples veces para asegurar)
    if (gameChannel) {
        const sendUserJoined = async () => {
            await gameChannel.send({
                type: 'broadcast',
                event: 'user_joined',
                payload: {
                    userId: userId,
                    username: username,
                    color: userColor
                }
            });
        };

        // Enviar inmediatamente
        await sendUserJoined();

        // Enviar de nuevo después de un breve delay para asegurar que todos lo reciban
        setTimeout(async () => {
            await sendUserJoined();
        }, 500);

        // Pedir a otros usuarios que se identifiquen
        await gameChannel.send({
            type: 'broadcast',
            event: 'request_users',
            payload: {
                userId: userId
            }
        });

        // Reenviar la solicitud después de un delay
        setTimeout(async () => {
            await gameChannel.send({
                type: 'broadcast',
                event: 'request_users',
                payload: {
                    userId: userId
                }
            });
        }, 1000);
    }

    updateUsersList();
    
    // Asegurar que el botón esté habilitado inicialmente si no hay juego activo
    if (!gameState.gameActive) {
        newGameBtn.disabled = false;
        newGameBtn.style.opacity = '1';
        newGameBtn.style.cursor = 'pointer';
        newGameBtn.title = '';
    }
}

// Función para generar ID único
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Función para obtener un color disponible que no esté en uso
function getAvailableUserColor() {
    // Obtener todos los colores que ya están en uso
    const usedColors = new Set();
    gameState.users.forEach((user) => {
        if (user.color) {
            usedColors.add(user.color);
        }
    });
    
    // Si el usuario actual ya tiene un color, también incluirlo
    if (gameState.userColor) {
        usedColors.add(gameState.userColor);
    }
    
    // Buscar un color disponible
    const availableColors = USER_COLORS.filter(color => !usedColors.has(color));
    
    // Si hay colores disponibles, seleccionar uno aleatorio
    if (availableColors.length > 0) {
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    // Si todos los colores están en uso, generar uno aleatorio
    // Esto solo debería pasar si hay más de 15 usuarios (más que colores disponibles)
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 65%)`;
}

// Función para suscribirse al canal de juego
async function subscribeToGameChannel() {
    if (!gameChannel) {
        gameChannel = supabase.channel('multiplication-game-room', {
            config: {
                broadcast: { self: true }
            }
        });

        // Escuchar cuando un usuario se une
        gameChannel.on('broadcast', { event: 'user_joined' }, (payload) => {
            if (payload && payload.payload) {
                const { userId, username, color } = payload.payload;
                if (userId && userId !== gameState.userId) {
                    // Validar que tenemos los datos necesarios
                    if (username && color) {
                        // Verificar si hay conflicto de color con el usuario actual
                        if (color === gameState.userColor) {
                            // Si hay conflicto, obtener un nuevo color para el usuario actual
                            gameState.userColor = getAvailableUserColor();
                            
                            // Actualizar el color en la lista de usuarios local
                            if (gameState.users.has(gameState.userId)) {
                                gameState.users.get(gameState.userId).color = gameState.userColor;
                            }
                            
                            // Actualizar el color de las piezas renderizadas
                            document.querySelectorAll('.piece').forEach(piece => {
                                piece.style.borderColor = gameState.userColor;
                            });
                            
                            // Notificar el cambio de color
                            if (gameChannel) {
                                gameChannel.send({
                                    type: 'broadcast',
                                    event: 'user_joined',
                                    payload: {
                                        userId: gameState.userId,
                                        username: gameState.currentUser,
                                        color: gameState.userColor
                                    }
                                });
                            }
                        }
                        
                        gameState.users.set(userId, { id: userId, username, color });
                        if (!gameState.placedPieces.has(userId)) {
                            gameState.placedPieces.set(userId, 0);
                        }
                        updateUsersList();
                    }
                }
            }
        });

        // Escuchar solicitud de lista de usuarios (responder con nuestra info)
        gameChannel.on('broadcast', { event: 'request_users' }, async (payload) => {
            if (payload && payload.payload && payload.payload.userId !== gameState.userId && gameState.userId && gameState.currentUser) {
                // Esperar un pequeño delay para evitar problemas de timing
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Responder enviando nuestra información y estado del juego
                if (gameChannel) {
                    await gameChannel.send({
                        type: 'broadcast',
                        event: 'user_joined',
                        payload: {
                            userId: gameState.userId,
                            username: gameState.currentUser,
                            color: gameState.userColor
                        }
                    });
                    
                }
            }
        });


        // Escuchar cuando un usuario abandona
        gameChannel.on('broadcast', { event: 'user_left' }, (payload) => {
            const { userId } = payload.payload;
            if (userId !== gameState.userId) {
                gameState.users.delete(userId);
                gameState.placedPieces.delete(userId);
                updateUsersList();
            }
        });

        // Escuchar inicio de juego
        gameChannel.on('broadcast', { event: 'game_started' }, async (payload) => {
            if (payload && payload.payload) {
                const gameData = payload.payload;
                const { emptyCells, pieces, userId: starterUserId, correctAnswers, tableSize, missingPieces } = gameData;
                
                if (starterUserId !== gameState.userId) {
                    // Usar EXACTAMENTE los mismos datos que el usuario que inició el juego
                    handleRemoteGameStart({ 
                        emptyCells, 
                        pieces, 
                        correctAnswers,
                        starterUserId,
                        tableSize,
                        missingPieces
                    });
                    
                    // Cuando se inicia un juego, enviar nuestra información para sincronizar
                    if (gameState.userId && gameState.currentUser && gameChannel) {
                        await gameChannel.send({
                            type: 'broadcast',
                            event: 'user_joined',
                            payload: {
                                userId: gameState.userId,
                                username: gameState.currentUser,
                                color: gameState.userColor
                            }
                        });
                    }
                }
            }
        });

        // Escuchar solicitud de sincronización de usuarios
        gameChannel.on('broadcast', { event: 'sync_users' }, async (payload) => {
            if (payload && payload.payload && gameState.userId && gameState.currentUser && gameChannel) {
                // Responder con nuestra información
                await gameChannel.send({
                    type: 'broadcast',
                    event: 'user_joined',
                    payload: {
                        userId: gameState.userId,
                        username: gameState.currentUser,
                        color: gameState.userColor
                    }
                });
            }
        });

        // Escuchar cuando se coloca una pieza
        gameChannel.on('broadcast', { event: 'piece_placed' }, (payload) => {
            const { userId, cellKey, value, pieceId } = payload.payload;
            if (userId !== gameState.userId) {
                handleRemotePiecePlaced({ userId, cellKey, value, pieceId });
            }
        });

        // Escuchar actualización de puntuación
        gameChannel.on('broadcast', { event: 'score_updated' }, (payload) => {
            const { userId, score } = payload.payload;
            if (userId !== gameState.userId) {
                gameState.placedPieces.set(userId, score);
                updateUsersList();
            }
        });


        // Suscribirse al canal
        const subscribeStatus = await gameChannel.subscribe();
        
        // Verificar que la suscripción fue exitosa
        if (subscribeStatus === 'SUBSCRIBED') {
            console.log('Conectado al canal de juego');
        } else {
            console.warn('Estado de suscripción:', subscribeStatus);
        }
        
        // Manejar desconexión de usuarios
        gameChannel.on('presence', { event: 'leave' }, ({ key, newPresences }) => {
            // Cuando alguien se desconecta, se elimina automáticamente del presence
            // Pero podemos mantener un manejo adicional si es necesario
        });
        
        // Detectar cuando alguien se desconecta usando el estado del canal
        gameChannel.on('system', {}, (payload) => {
            if (payload.status === 'SUBSCRIBED') {
                console.log('Conectado al canal de juego');
            } else if (payload.status === 'CHANNEL_ERROR') {
                console.error('Error en el canal:', payload);
            }
        });
    } else {
        // Si el canal ya existe, asegurar que estamos suscritos
        if (gameChannel.state !== 'joined') {
            await gameChannel.subscribe();
        }
    }
}

// Manejar cuando el usuario abandona la página
window.addEventListener('beforeunload', async () => {
    if (gameChannel && gameState.userId) {
        // Notificar que el usuario se va
        await gameChannel.send({
            type: 'broadcast',
            event: 'user_left',
            payload: {
                userId: gameState.userId
            }
        });
        
        // Desconectarse del canal
        await gameChannel.unsubscribe();
    }
});

// Función para verificar y sincronizar usuarios
async function verifyAndSyncUsers() {
    if (!gameChannel || !gameState.userId) return;

    // Enviar nuestra información de usuario
    await gameChannel.send({
        type: 'broadcast',
        event: 'user_joined',
        payload: {
            userId: gameState.userId,
            username: gameState.currentUser,
            color: gameState.userColor
        }
    });

    // Solicitar sincronización de todos los usuarios
    await gameChannel.send({
        type: 'broadcast',
        event: 'sync_users',
        payload: {
            userId: gameState.userId,
            timestamp: Date.now()
        }
    });

    // Esperar un momento y verificar si hay usuarios que no tenemos
    setTimeout(async () => {
        // Reenviar nuestra información una vez más para asegurar
        if (gameChannel && gameState.userId && gameState.currentUser) {
            await gameChannel.send({
                type: 'broadcast',
                event: 'user_joined',
                payload: {
                    userId: gameState.userId,
                    username: gameState.currentUser,
                    color: gameState.userColor
                }
            });
        }
        updateUsersList();
    }, 500);
}

// Función para actualizar lista de usuarios
function updateUsersList() {
    usersList.innerHTML = '';
    
    // Agregar usuario actual primero
    if (gameState.userId && gameState.currentUser) {
        const currentUserItem = createUserItem(
            gameState.userId, 
            gameState.currentUser, 
            gameState.userColor, 
            gameState.placedPieces.get(gameState.userId) || 0, 
            true
        );
        usersList.appendChild(currentUserItem);
    }

    // Agregar otros usuarios (excluyendo el usuario actual para evitar duplicados)
    gameState.users.forEach((user, userId) => {
        if (userId !== gameState.userId) {
            const userItem = createUserItem(userId, user.username, user.color, gameState.placedPieces.get(userId) || 0, false);
            usersList.appendChild(userItem);
        }
    });
}

// Función para crear elemento de usuario
function createUserItem(userId, username, color, score, isCurrent) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.style.borderLeftColor = color;
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.style.background = color;
    avatar.textContent = username.charAt(0).toUpperCase();
    
    const info = document.createElement('div');
    info.className = 'user-info';
    
    const name = document.createElement('div');
    name.className = 'user-name';
    name.textContent = username + (isCurrent ? ' (Tú)' : '');
    
    const scoreEl = document.createElement('div');
    scoreEl.className = 'user-score';
    scoreEl.innerHTML = `Piezas colocadas: <span>${score}</span>`;
    
    info.appendChild(name);
    info.appendChild(scoreEl);
    div.appendChild(avatar);
    div.appendChild(info);
    
    return div;
}

// Función para configurar Realtime (ahora solo inicializa, la suscripción se hace al unirse)
function setupRealtime() {
    // El canal se crea cuando el usuario se une al juego
    // Ver función subscribeToGameChannel()
}

// Función para crear tablero de multiplicación
function createMultiplicationBoard() {
    board.innerHTML = '';
    const size = gameState.tableSize;
    
    // Actualizar título
    boardTitle.textContent = `Tabla de multiplicar (${size}x${size})`;
    
    // Actualizar grid CSS para el tamaño dinámico
    board.style.gridTemplateColumns = `repeat(${size + 1}, 1fr)`;
    
    // Crear cabeceras
    for (let i = 0; i <= size; i++) {
        for (let j = 0; j <= size; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            
            if (i === 0 && j === 0) {
                cell.textContent = '×';
                cell.className += ' header';
            } else if (i === 0) {
                cell.textContent = j;
                cell.className += ' header';
            } else if (j === 0) {
                cell.textContent = i;
                cell.className += ' header';
            } else {
                const result = i * j;
                const cellKey = `${i}-${j}`;
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.dataset.value = result;
                cell.dataset.key = cellKey;
                
                // Marcar como vacía si está en la lista
                if (gameState.emptyCells.includes(cellKey)) {
                    cell.classList.add('empty');
                    cell.textContent = '?';
                } else {
                    cell.textContent = result;
                }
                
                // Agregar eventos de drag & drop
                cell.addEventListener('dragover', handleDragOver);
                cell.addEventListener('drop', handleDrop);
                cell.addEventListener('dragleave', handleDragLeave);
            }
            
            board.appendChild(cell);
        }
    }
    
    // Guardar respuestas correctas
    gameState.emptyCells.forEach(cellKey => {
        const [row, col] = cellKey.split('-').map(Number);
        gameState.correctAnswers.set(cellKey, row * col);
    });
    
    // Actualizar tamaño de las piezas para que coincida con las celdas
    updatePiecesSize();
}

// Función para actualizar el tamaño de las piezas para que coincida con las celdas
function updatePiecesSize() {
    // Obtener una celda del tablero para medir su tamaño
    const firstCell = board.querySelector('.cell:not(.header)');
    if (firstCell) {
        const cellRect = firstCell.getBoundingClientRect();
        const cellSize = cellRect.width;
        
        // Aplicar el mismo tamaño a todas las piezas
        document.querySelectorAll('.piece').forEach(piece => {
            piece.style.width = `${cellSize}px`;
            piece.style.height = `${cellSize}px`;
            piece.style.minWidth = `${cellSize}px`;
            piece.style.minHeight = `${cellSize}px`;
            piece.style.maxWidth = `${cellSize}px`;
        });
    }
}

// Función para actualizar el tablero con piezas ya colocadas
function updateBoardWithPlacedPieces() {
    // Buscar todas las piezas usadas y colocarlas en el tablero
    // También buscar en el tablero las celdas que tienen valores pero deberían estar vacías
    gameState.emptyCells.forEach(cellKey => {
        const cell = document.querySelector(`[data-key="${cellKey}"]`);
        if (cell) {
            // Si la celda está marcada como empty pero tiene un valor (no es "?"), 
            // significa que alguien ya colocó una pieza ahí
            if (cell.classList.contains('empty') && cell.textContent !== '?') {
                const cellValue = parseInt(cell.textContent);
                if (!isNaN(cellValue)) {
                    // Encontrar la pieza que corresponde a este valor y celda
                    const piece = gameState.pieces.find(p => 
                        p.value === cellValue && 
                        p.cellKey === cellKey && 
                        p.isCorrect
                    );
                    
                    if (piece) {
                        piece.used = true;
                        cell.classList.remove('empty');
                        cell.classList.add('filled');
                        // Usar un color neutro si no sabemos quién la colocó
                        cell.style.borderColor = '#999';
                        cell.style.background = '#f5f5f5';
                    }
                }
            }
        }
    });
    
    // También buscar piezas usadas que tienen cellKey
    gameState.pieces.forEach(piece => {
        if (piece.used && piece.cellKey) {
            const cell = document.querySelector(`[data-key="${piece.cellKey}"]`);
            if (cell && cell.classList.contains('empty')) {
                cell.classList.remove('empty');
                cell.classList.add('filled');
                cell.textContent = piece.value;
                // Usar un color neutro si no sabemos quién la colocó
                cell.style.borderColor = '#999';
                cell.style.background = '#f5f5f5';
            }
        }
    });
}

// Función para generar casillas vacías aleatorias
function generateEmptyCells() {
    const empty = [];
    const possible = [];
    const size = gameState.tableSize;
    const missingCount = gameState.missingPieces;
    
    // Generar todas las posibles casillas (excluyendo la fila y columna de cabeceras)
    for (let i = 1; i <= size; i++) {
        for (let j = 1; j <= size; j++) {
            possible.push(`${i}-${j}`);
        }
    }
    
    // Seleccionar la cantidad especificada aleatoriamente
    const count = Math.min(missingCount, possible.length);
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * possible.length);
        empty.push(possible.splice(randomIndex, 1)[0]);
    }
    
    return empty;
}

// Función para generar piezas
function generatePieces() {
    const pieces = [];
    const correctValues = [];
    
    // Obtener una pieza por cada casilla vacía (los valores que faltan)
    // Calcular el valor directamente desde la celda (row * col)
    gameState.emptyCells.forEach(cellKey => {
        const [row, col] = cellKey.split('-').map(Number);
        const value = row * col; // Calcular el valor directamente
        correctValues.push(value);
        // Agregar una pieza correcta por cada casilla vacía
        pieces.push({
            value: value,
            isCorrect: true,
            used: false,
            cellKey: cellKey, // Guardar la casilla asociada para validación
            id: 'piece_' + Math.random().toString(36).substr(2, 9)
        });
    });
    
    // Generar solo 2 distractores (números que no sirven)
    const correctSet = new Set(correctValues);
    const allPossibleValues = new Set();
    const size = gameState.tableSize;
    
    // Generar todos los valores posibles de la tabla de multiplicar según el tamaño
    for (let i = 1; i <= size; i++) {
        for (let j = 1; j <= size; j++) {
            allPossibleValues.add(i * j);
        }
    }
    
    // Seleccionar 2 valores que NO estén en los correctos y que estén en el rango de la tabla
    const possibleDistractors = Array.from(allPossibleValues).filter(v => !correctSet.has(v));
    
    let distractorsAdded = 0;
    while (distractorsAdded < 2 && possibleDistractors.length > 0) {
        const randomIndex = Math.floor(Math.random() * possibleDistractors.length);
        const distractor = possibleDistractors.splice(randomIndex, 1)[0];
        pieces.push({
            value: distractor,
            isCorrect: false,
            used: false,
            id: 'piece_' + Math.random().toString(36).substr(2, 9)
        });
        distractorsAdded++;
    }
    
    // Ordenar piezas de menor a mayor por valor
    pieces.sort((a, b) => a.value - b.value);
    
    return pieces;
}

// Función para renderizar piezas
function renderPieces() {
    piecesContainer.innerHTML = '';
    
    gameState.pieces.forEach(piece => {
        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece';
        // Solo habilitar drag si el juego está en progreso y la pieza no está usada
        pieceEl.draggable = gameState.gameInProgress && !piece.used;
        // Asegurar que el número siempre se vea
        pieceEl.textContent = String(piece.value);
        pieceEl.dataset.pieceId = piece.id;
        pieceEl.dataset.value = piece.value;
        pieceEl.dataset.isCorrect = piece.isCorrect;
        pieceEl.style.borderColor = gameState.userColor;
        // Usar color oscuro para el texto para que siempre sea visible
        pieceEl.style.color = '#333';
        pieceEl.style.fontWeight = 'bold';
        
        if (piece.used) {
            pieceEl.classList.add('used');
        }
        
        pieceEl.addEventListener('dragstart', handleDragStart);
        pieceEl.addEventListener('dragend', handleDragEnd);
        
        piecesContainer.appendChild(pieceEl);
    });
    
    // Actualizar tamaño de las piezas después de renderizarlas
    setTimeout(() => {
        updatePiecesSize();
    }, 100);
}

// Función para actualizar el máximo de piezas faltantes
function updateMissingPiecesMax() {
    if (!tableSizeSelect || !missingPiecesInput) return;
    
    const tableSize = parseInt(tableSizeSelect.value);
    const maxCells = tableSize * tableSize;
    missingPiecesInput.max = maxCells;
    missingPiecesInput.setAttribute('max', maxCells);
    
    // Actualizar el texto de ayuda
    const helpText = missingPiecesInput.nextElementSibling;
    if (helpText && helpText.tagName === 'SMALL') {
        helpText.textContent = `Entre 10 y ${maxCells} piezas (máximo: ${maxCells} casillas en ${tableSize}x${tableSize})`;
    }
    
    // Si el valor actual es mayor que el máximo, ajustarlo
    const currentValue = parseInt(missingPiecesInput.value);
    if (currentValue > maxCells) {
        missingPiecesInput.value = maxCells;
    }
}

// Función para mostrar modal de configuración
function showGameConfig() {
    // Restaurar las opciones del juego anterior
    tableSizeSelect.value = gameState.tableSize || 10;
    missingPiecesInput.value = gameState.missingPieces || 15;
    
    // Actualizar el máximo de piezas faltantes según el tamaño seleccionado
    updateMissingPiecesMax();
    
    gameConfigModal.classList.remove('hidden');
}

// Función para iniciar juego con configuración
async function startNewGameWithConfig() {
    // Leer valores del formulario
    const tableSize = parseInt(tableSizeSelect.value);
    const missingPieces = parseInt(missingPiecesInput.value);
    
    // Validar valores
    if (tableSize < 5 || tableSize > 15) {
        alert('El tamaño de la tabla debe estar entre 5 y 15');
        return;
    }
    
    // Calcular el máximo de piezas faltantes basado en el tamaño del tablero
    const maxCells = tableSize * tableSize;
    
    if (missingPieces < 10 || missingPieces > maxCells) {
        alert(`Las piezas faltantes deben estar entre 10 y ${maxCells} (máximo de casillas en una tabla de ${tableSize}x${tableSize})`);
        return;
    }
    
    // Guardar configuración
    gameState.tableSize = tableSize;
    gameState.missingPieces = missingPieces;
    
    // Cerrar modal
    gameConfigModal.classList.add('hidden');
    
    // Iniciar juego
    await startNewGame();
}

// Función para iniciar nuevo juego
async function startNewGame() {
    gameState.gameActive = true;
    gameState.gameInProgress = false;
    gameState.emptyCells = generateEmptyCells();
    gameState.placedPieces.clear();
    gameState.correctAnswers.clear();
    
    // Llenar correctAnswers antes de generar piezas
    gameState.emptyCells.forEach(cellKey => {
        const [row, col] = cellKey.split('-').map(Number);
        gameState.correctAnswers.set(cellKey, row * col);
    });
    
    // Ahora generar las piezas (ya tiene acceso a correctAnswers)
    gameState.pieces = generatePieces();
    
    // Resetear puntuaciones de todos los usuarios
    gameState.users.forEach((user, userId) => {
        gameState.placedPieces.set(userId, 0);
    });
    gameState.placedPieces.set(gameState.userId, 0);
    
    createMultiplicationBoard();
    renderPieces();
    updateUsersList();
    
    gameCompleteModal.classList.add('hidden');
    
    // Notificar inicio de juego a otros usuarios por broadcast
    // Enviar TODA la información necesaria para sincronización completa
    if (gameChannel) {
        const gameData = {
            userId: gameState.userId,
            tableSize: gameState.tableSize,
            missingPieces: gameState.missingPieces,
            emptyCells: [...gameState.emptyCells], // Copia del array
            pieces: gameState.pieces.map(p => ({ 
                value: p.value, 
                isCorrect: p.isCorrect, 
                id: p.id,
                cellKey: p.cellKey || null
            })),
            correctAnswers: Object.fromEntries(gameState.correctAnswers) // Convertir Map a objeto
        };

        // Enviar el evento de inicio de juego con todos los datos
        await gameChannel.send({
            type: 'broadcast',
            event: 'game_started',
            payload: gameData
        });

        // Verificar y sincronizar usuarios al iniciar juego
        await verifyAndSyncUsers();
    }
    
    // Contador regresivo en modal
    countdownModal.classList.remove('hidden');
    countdownEl.textContent = '3';
    
    setTimeout(() => {
        countdownEl.textContent = '2';
    }, 1000);
    
    setTimeout(() => {
        countdownEl.textContent = '1';
    }, 2000);
    
    setTimeout(() => {
        countdownEl.textContent = '¡Comenzar!';
        gameState.gameInProgress = true;
        
        setTimeout(() => {
            countdownModal.classList.add('hidden');
        }, 1000);
        
        // Habilitar drag & drop
        gameState.pieces.forEach(piece => {
            if (!piece.used) {
                const pieceEl = document.querySelector(`[data-piece-id="${piece.id}"]`);
                if (pieceEl) {
                    pieceEl.draggable = true;
                }
            }
        });
    }, 3000);
}

// Event handlers para drag & drop
let draggedPiece = null;

function handleDragStart(e) {
    if (!gameState.gameInProgress) {
        e.preventDefault();
        return;
    }
    
    draggedPiece = {
        id: e.target.dataset.pieceId,
        value: parseInt(e.target.dataset.value),
        isCorrect: e.target.dataset.isCorrect === 'true'
    };
    
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedPiece = null;
    
    // Remover drag-over de todas las celdas
    document.querySelectorAll('.cell.drag-over').forEach(cell => {
        cell.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (!gameState.gameInProgress || !draggedPiece) return;
    
    e.preventDefault();
    const cell = e.target.closest('.cell');
    if (cell && cell.classList.contains('empty') && !cell.classList.contains('filled')) {
        cell.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const cell = e.target.closest('.cell');
    if (cell) {
        cell.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    if (!gameState.gameInProgress || !draggedPiece) return;
    
    const cell = e.target.closest('.cell');
    if (!cell || !cell.classList.contains('empty') || cell.classList.contains('filled')) {
        return;
    }
    
    const cellKey = cell.dataset.key;
    const correctValue = gameState.correctAnswers.get(cellKey);
    
    // Validar si la pieza es correcta
    if (draggedPiece.value === correctValue) {
        // Colocar pieza localmente
        cell.classList.remove('empty', 'drag-over');
        cell.classList.add('filled');
        cell.textContent = draggedPiece.value;
        cell.style.borderColor = gameState.userColor;
        cell.style.background = gameState.userColor + '20';
        cell.dataset.placedBy = gameState.userId;
        
        // Marcar pieza como usada
        const piece = gameState.pieces.find(p => p.id === draggedPiece.id);
        if (piece) {
            piece.used = true;
        }
        
        // Actualizar contador de usuario
        const currentCount = gameState.placedPieces.get(gameState.userId) || 0;
        gameState.placedPieces.set(gameState.userId, currentCount + 1);
        
        // Notificar movimiento a otros usuarios por broadcast
        if (gameChannel) {
            await gameChannel.send({
                type: 'broadcast',
                event: 'piece_placed',
                payload: {
                    userId: gameState.userId,
                    cellKey: cellKey,
                    value: draggedPiece.value,
                    pieceId: draggedPiece.id
                }
            });

            // Notificar actualización de puntuación
            await gameChannel.send({
                type: 'broadcast',
                event: 'score_updated',
                payload: {
                    userId: gameState.userId,
                    score: currentCount + 1
                }
            });
        }
        
        updateUsersList();
        renderPieces();
        
        // Verificar si el juego está completo
        checkGameComplete();
    } else {
        // Pieza incorrecta, hacer vibrar la celda
        cell.style.animation = 'shake 0.3s';
        setTimeout(() => {
            cell.style.animation = '';
        }, 300);
    }
    
    cell.classList.remove('drag-over');
}

// Función para manejar pieza colocada remotamente
function handleRemotePiecePlaced({ userId, cellKey, value, pieceId }) {
    const cell = document.querySelector(`[data-key="${cellKey}"]`);
    if (cell && !cell.classList.contains('filled')) {
        const user = gameState.users.get(userId) || { username: 'Usuario', color: '#999' };
        
        cell.classList.remove('empty');
        cell.classList.add('filled');
        cell.textContent = value;
        cell.style.borderColor = user.color;
        cell.style.background = user.color + '20';
        cell.dataset.placedBy = userId;
        
        // Marcar pieza como usada localmente usando el ID exacto de la pieza
        const piece = gameState.pieces.find(p => p.id === pieceId && !p.used);
        if (piece) {
            piece.used = true;
        } else {
            // Si no encontramos por ID, buscar por valor (fallback)
            const pieceByValue = gameState.pieces.find(p => p.value === value && !p.used);
            if (pieceByValue) {
                pieceByValue.used = true;
            }
        }
        
        updateUsersList();
        renderPieces();
        checkGameComplete();
    }
}

// Función para manejar inicio remoto de juego
function handleRemoteGameStart({ emptyCells, pieces, correctAnswers, starterUserId, tableSize, missingPieces }) {
    // IMPORTANTE: Usar EXACTAMENTE los mismos datos que el usuario que inició el juego
    // No generar nada nuevo, usar solo lo que se recibió
    
    gameState.gameActive = true;
    gameState.gameInProgress = false;
    
    // Usar EXACTAMENTE la misma configuración
    if (tableSize) gameState.tableSize = tableSize;
    if (missingPieces) gameState.missingPieces = missingPieces;
    
    // Usar EXACTAMENTE las mismas casillas vacías
    gameState.emptyCells = Array.isArray(emptyCells) ? [...emptyCells] : [];
    
    // Usar EXACTAMENTE las mismas piezas (con los mismos IDs)
    gameState.pieces = pieces.map(p => ({
        value: p.value,
        isCorrect: p.isCorrect,
        used: false,
        id: p.id, // Mantener el mismo ID
        cellKey: p.cellKey || null
    }));
    
    // Usar EXACTAMENTE las mismas respuestas correctas
    gameState.correctAnswers.clear();
    if (correctAnswers && typeof correctAnswers === 'object') {
        // Si viene como objeto, convertirlo a Map
        Object.entries(correctAnswers).forEach(([key, value]) => {
            gameState.correctAnswers.set(key, value);
        });
    } else {
        // Si no viene, calcular desde emptyCells (fallback)
        gameState.emptyCells.forEach(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            gameState.correctAnswers.set(cellKey, row * col);
        });
    }
    
    // Resetear puntuaciones de todos los usuarios
    gameState.placedPieces.clear();
    gameState.users.forEach((user, userId) => {
        gameState.placedPieces.set(userId, 0);
    });
    gameState.placedPieces.set(gameState.userId, 0);
    
    // Cerrar modal de configuración si está abierto
    gameConfigModal.classList.add('hidden');
    
    // Recrear el tablero y renderizar piezas con los datos recibidos
    createMultiplicationBoard();
    renderPieces();
    updateUsersList();
    gameCompleteModal.classList.add('hidden');
    
    // Actualizar tamaño de piezas después de crear el tablero
    setTimeout(() => {
        updatePiecesSize();
    }, 200);
    
    // Contador regresivo en modal
    countdownModal.classList.remove('hidden');
    countdownEl.textContent = '3';
    
    setTimeout(() => {
        countdownEl.textContent = '2';
    }, 1000);
    
    setTimeout(() => {
        countdownEl.textContent = '1';
    }, 2000);
    
    setTimeout(() => {
        countdownEl.textContent = '¡Comenzar!';
        gameState.gameInProgress = true;
        
        setTimeout(() => {
            countdownModal.classList.add('hidden');
        }, 1000);
        
        // Habilitar drag & drop
        gameState.pieces.forEach(piece => {
            if (!piece.used) {
                const pieceEl = document.querySelector(`[data-piece-id="${piece.id}"]`);
                if (pieceEl) {
                    pieceEl.draggable = true;
                }
            }
        });
    }, 3000);
}

// Función para verificar si el juego está completo
function checkGameComplete() {
    const filledCells = document.querySelectorAll('.cell.filled').length;
    if (filledCells === gameState.missingPieces) {
        gameState.gameInProgress = false;
        
        // Mostrar mensaje de tablero completado por 2 segundos en modal
        countdownModal.classList.remove('hidden');
        countdownEl.textContent = '🎉 Tablero Completado 🎉';
        
        // Ocultar el mensaje después de 2 segundos
        setTimeout(() => {
            countdownModal.classList.add('hidden');
        }, 2000);
    }
}

// Estilo adicional para shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);
