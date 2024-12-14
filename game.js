// Canvas postavke
const canvas = document.getElementById('play_board');
canvas.width = innerWidth;
canvas.height = innerHeight;
const context = canvas.getContext('2d');

// ElementiUI
const scoreElement = document.getElementById("scoreElement");
const bigScoreElement = document.getElementById("bigScoreElement");
const startButton = document.getElementById("startBtn");
const startDialog = document.getElementById("startDialog");
const card = document.getElementById("card");

// Monada Maybe
class Maybe {
    constructor(value) {
        this.value = value;
    }

    static of(value) {
        return new Maybe(value);
    }

    isNothing() {
        return this.value === null || this.value === undefined;
    }

    isJust() {
        return !this.isNothing();
    }

    map(fn) {
        return this.isNothing() ? Maybe.of(null) : Maybe.of(fn(this.value));
    }

    flatMap(fn) {
        return this.isNothing() ? Maybe.of(null) : fn(this.value);
    }

    filter(predicate) {
        return this.isNothing() || predicate(this.value) ? this : Maybe.of(null);
    }

    getOrElse(defaultValue) {
        return this.isNothing() ? defaultValue : this.value;
    }

    toString() {
        return this.isNothing() ? 'Maybe(null)' : `Maybe(${this.value})`;
    }
}

// Efekti igrice
const backgroundImage = new Image();
backgroundImage.src = "vortex_bg.jpg";

const gameSound = new Audio("game_music.mp3");
gameSound.volume = 0.3;

const hitSound = new Audio("hit_music.mp3");
hitSound.volume = 0.9;

const gameOverSound = new Audio("game_over.mp3");
hitSound.volume = 0.9;

// Globalne promenljive
let score = 0;
let gameOver = false;

// Sistem za entitete
const entityManager = {
    entities: [],
    add: entity => entityManager.entities = [...entityManager.entities, entity],
    remove: entity => entityManager.entities = entityManager.entities.filter(e => e !== entity),
    getByType: type => entityManager.entities.filter(entity => entity.type === type),
};

// Funkcija za kreiranje entiteta
const createEntity = (type, x, y, radius, color, velocity = { x: 0, y: 0 }) => ({
    type,
    x,
    y,
    radius,
    color,
    velocity,
});

// Sistemi

//Rendering
const renderSystem = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    entityManager.entities
        .map(entity => Maybe.of(entity)) // Vrapuje sve entitete u Maybe
        .map(maybeEntity =>
            maybeEntity.map(entity => {
                context.beginPath();
                context.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
                context.fillStyle = entity.color;
                context.fill();
            })
        );
};

//Kretanje
const movementSystem = () => {
    entityManager.entities = entityManager.entities
        .map(entity => {
            // Ako je entitet tipa 'explosionPart', provera koliko je prošlo vremena od ekspolzije
            if (entity.type === 'explosionPart') {
                const timePassed = entity.creationTime ? (Date.now() - entity.creationTime) / 1000 : 0.4;
                // Ako je prošlo 0.5 sekundi
                if (timePassed >= 0.5) {
                    return null;
                }
        }

        // Ažuriranje pozicija svih entiteta
        return entity ? {
            ...entity,
            x: entity.x + entity.velocity.x,
            y: entity.y + entity.velocity.y,
        } : null;
    });

    // Filtriranje null vrednosti - primena Maybe monada na rukovanje null vrednostima
    entityManager.entities = entityManager.entities
    .map(entity => Maybe.of(entity))
    .filter(maybeEntity => maybeEntity.isJust())
    .map(maybeEntity => maybeEntity.value); // Ekstrakcija vrednosti, koja je validna

};

//Kolizije
const collisionSystem = () => {
    const player = entityManager.getByType('player')[0];
    const enemies = entityManager.getByType('enemy');
    const projectiles = entityManager.getByType('projectile');

    // Sudar igrača sa neprijateljima
    enemies.map(enemy => {
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist - player.radius - enemy.radius < 1 && !gameOver) {
            gameOver = true;
            endGame();
        }
    });

    // Sudar projektila sa neprijateljima
    projectiles.map(projectile => {
        return enemies.map(enemy => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
        
            // Da li su projektili udarili u neprijatelja
            if (dist - projectile.radius - enemy.radius < 1) {
                score += 100;
                scoreElement.innerText = score;
                hitSound.play();

                // Brisanje projektila i neprijatelja
                const updatedEntities = entityManager.entities.filter(e => e !== projectile && e !== enemy);

                const explosionParts = createExplosion(enemy.x, enemy.y, enemy.radius, enemy.color);
                const newEntities = [...updatedEntities, ...explosionParts]; 
                entityManager.entities = newEntities;

                // Vraća novi Maybe objekat sa ažuriranim entitetima
                return Maybe.of(newEntities);
            }

            // Ako nema kontakta, vraća Maybe sa null vrednošću
            return Maybe.of(null);
        })
        .flatMap(maybe => maybe.isNothing() ? Maybe.of(null) : maybe);
    }).flat();

};

// Funkcija za kreiranje eksplozije u vidu vatrometa
const createExplosion = (x, y, radius, color) => {
    const numParts = 5; // Broj delova eksplozije
    const explosionParts = Array.from({ length: numParts }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const velocity = {
            x: Math.cos(angle) * Math.random() * 3, // Brzina kretanja delova
            y: Math.sin(angle) * Math.random() * 3,
        };
        return createEntity('explosionPart', x, y, radius / 2, color, velocity, Date.now());
    });

    return explosionParts; // Vraćanje novog niza delova eksplozije
};

// Pomoćna funkcija za konverziju hex u rgb format
const hexToRgb = (hex) => {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
};


// Pomoćna funkcija za crtanje entiteta
const drawCircle = ({ x, y, radius, color }) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
};

// Kreiranje neprijatelja
const createEnemy = () => {
    const radius = Math.random() * (30 - 10) + 10;
    let x, y;

    const side = Math.floor(Math.random() * 4);
    if (side === 0) { x = Math.random() * canvas.width; y = 0; }
    else if (side === 1) { x = Math.random() * canvas.width; y = canvas.height; }
    else if (side === 2) { x = 0; y = Math.random() * canvas.height; }
    else { x = canvas.width; y = Math.random() * canvas.height; }

    const angle = Math.atan2(entityManager.getByType('player')[0].y - y, entityManager.getByType('player')[0].x - x);
    const velocity = { x: Math.cos(angle) * 1.5, y: Math.sin(angle) * 1.5 };

    entityManager.add(createEntity('enemy', x, y, radius, `hsl(${Math.random() * 360}, 50%, 50%)`, velocity));
};

// Kreiranje projektila
const createProjectile = (targetX, targetY) => {
    const player = entityManager.getByType('player')[0];
    const angle = Math.atan2(targetY - player.y, targetX - player.x);
    const velocity = { x: Math.cos(angle) * 5, y: Math.sin(angle) * 5 };
    entityManager.add(createEntity('projectile', player.x, player.y, 5, 'green', velocity));
};

// Pokretanje igre
const startGame = () => {
    entityManager.entities = [];
    score = 0;
    gameOver = false;
    scoreElement.innerText = score;

    const player = createEntity('player', canvas.width / 2, canvas.height / 2, 16, 'bisque');
    entityManager.add(player);

    // Generisanje neprijatelja
    setInterval(createEnemy, 1000);
    gameSound.play();
    gameLoop();
};

// Implementacija kompozicije (reduce)
const createGameLoop = (...systems) => {
    return () => {
        systems.reduce((_, system) => {
            system();
        }, null); // Ovo je samo pocetna vrednost, ne koristi se direktno
    
        // Ako igra nije gotova, poziva sledeći frame
        if (!gameOver) {
            requestAnimationFrame(createGameLoop(...systems)); 
        }
    };
};
    

// Game loop
const gameLoop = createGameLoop(movementSystem, collisionSystem, renderSystem);

//Stara verzija (bez kompozicije)
/* const gameLoop = () => {
    movementSystem();
    collisionSystem();
    renderSystem();

    if (!gameOver) requestAnimationFrame(gameLoop);
}; */

// Završavanje igre
const endGame = () => {
    gameSound.pause();
    bigScoreElement.innerText = score;
    startButton.innerText = "Restart";
    
    const gameOverHeader = card.querySelector("h1");

    // Provera da li element postoji i da li sadrži tekst "Game Over"
    if (!gameOverHeader || gameOverHeader.textContent !== "Game Over") {
        const newHeader = document.createElement("h1");
        newHeader.textContent = "Game Over";
        card.insertBefore(newHeader, bigScoreElement);
    }
    gameOverSound.play(); 
    setTimeout(() => {startDialog.style.display = 'flex'}, 1500);
    gameOver = true;
};

// Kontrole miša
canvas.addEventListener('click', (e) => createProjectile(e.clientX, e.clientY));


startButton.addEventListener('click', () => {
    startDialog.style.display = 'none';
    startGame();
});
