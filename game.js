'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick  = arr => arr[randInt(0, arr.length - 1)];

// ── Bullet ────────────────────────────────────────────────────────────────────
const LASER_LEN  = 15;
const LASER_CORE = '#ffffff';
const LASER_GLOW = '#6aa8ff';

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Se apaga en el último tramo en vez de desaparecer de golpe
    const fade = Math.min(1, this.ttl / 0.25);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // Estela: opaca en la punta, disuelta en la cola. La dirección se lee
    // por el degradado, no por la forma.
    const trail = ctx.createLinearGradient(-LASER_LEN, 0, 0, 0);
    trail.addColorStop(0, `rgba(106, 168, 255, 0)`);
    trail.addColorStop(1, `rgba(150, 200, 255, ${(0.85 * fade).toFixed(2)})`);
    ctx.strokeStyle = trail;
    ctx.lineWidth   = 3.4;
    ctx.shadowColor = LASER_GLOW;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.moveTo(-LASER_LEN, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // Núcleo blanco: la parte que realmente lee como "quema"
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = LASER_CORE;
    ctx.globalAlpha = fade;
    ctx.lineWidth   = 1.3;
    ctx.beginPath();
    ctx.moveTo(-LASER_LEN * 0.5, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Luz del mundo, arriba a la izquierda. La roca gira; la luz NO. Por eso el
// degradado se define en coordenadas del mundo y los vértices se rotan a mano:
// si dejáramos que ctx.rotate() moviera también el degradado, la zona iluminada
// giraría con la piedra y se leería como una calcomanía, no como volumen.
const LIGHT_X = -0.72;
const LIGHT_Y = -0.69;
const ROCK_LIT   = '#b9c2cd';
const ROCK_MID   = '#69737f';
const ROCK_DARK  = '#232931';

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }

    // Cráteres: se generan una vez y viajan pegados a la roca, así que sí
    // acompañan el giro. Son la referencia que deja ver que está rotando.
    this.craters = [];
    for (let i = 0, n = randInt(2, 4); i < n; i++) {
      const ca = rand(0, Math.PI * 2);
      const cd = rand(0.1, 0.5) * this.radius;
      this.craters.push([
        Math.cos(ca) * cd,
        Math.sin(ca) * cd,
        rand(0.11, 0.22) * this.radius,
      ]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    const cos = Math.cos(this.rot);
    const sin = Math.sin(this.rot);
    const R   = this.radius;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.lineJoin = 'round';

    // Contorno: mismos vértices de siempre, rotados a mano
    ctx.beginPath();
    this.verts.forEach(([vx, vy], i) => {
      const px = vx * cos - vy * sin;
      const py = vx * sin + vy * cos;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();

    // Cuerpo: del lado iluminado al lado en sombra, en eje del mundo
    const body = ctx.createLinearGradient(
      LIGHT_X * R, LIGHT_Y * R, -LIGHT_X * R, -LIGHT_Y * R
    );
    body.addColorStop(0,    ROCK_LIT);
    body.addColorStop(0.45, ROCK_MID);
    body.addColorStop(1,    ROCK_DARK);
    ctx.fillStyle = body;
    ctx.fill();

    // Rim light: el borde brilla del lado de la luz y se apaga en la sombra.
    // Un contorno de color uniforme aplana todo lo que ganó el relleno.
    const rim = ctx.createLinearGradient(
      LIGHT_X * R, LIGHT_Y * R, -LIGHT_X * R, -LIGHT_Y * R
    );
    rim.addColorStop(0,   'rgba(226, 236, 248, 0.95)');
    rim.addColorStop(0.5, 'rgba(150, 162, 176, 0.5)');
    rim.addColorStop(1,   'rgba(90, 100, 112, 0.25)');
    ctx.strokeStyle = rim;
    ctx.lineWidth   = 1.6;
    ctx.stroke();

    // Cráteres: recortados contra el cuerpo para que no se salgan del canto
    ctx.clip();
    for (const [cx, cy, cr] of this.craters) {
      const px = cx * cos - cy * sin;
      const py = cx * sin + cy * cos;
      ctx.beginPath();
      ctx.arc(px, py, cr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 24, 30, 0.45)';
      ctx.fill();
      // Reborde encendido del lado contrario a la luz: un hueco recibe luz
      // en su pared lejana, justo al revés que un bulto.
      ctx.beginPath();
      ctx.arc(px, py, cr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(198, 210, 224, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
// El volumen es falso: el casco se parte en dos facetas que comparten la quilla
// central y se rellenan con brillos distintos. Como la división corre a lo largo
// del eje de la nave, la ilusión se sostiene en cualquier ángulo de giro — no
// hace falta compensar la rotación como haría una luz fija en el mundo.
const HULL_TOP    = ['#eaf3ff', '#8fa7c7'];  // faceta superior: clara
const HULL_BOTTOM = ['#5d7492', '#26374f'];  // faceta inferior: en sombra
const HULL_EDGE   = '#cfe2ff';
const HULL_GLOW   = '#6aa8ff';
const COCKPIT     = '#bfe6ff';

class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(triple = false) {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const SPREAD = 0.22;  // rad de separación entre balas del abanico
    const offsets = triple ? [-SPREAD, 0, SPREAD] : [0];
    return offsets.map(o => new Bullet(ox, oy, this.angle + o));
  }

  // Una faceta triangular: nariz → punta de ala → muesca trasera
  drawFacet(wingY, [from, to]) {
    const g = ctx.createLinearGradient(0, wingY, 0, 0);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo( 20, 0);
    ctx.lineTo(-12, wingY);
    ctx.lineTo( -7, 0);
    ctx.closePath();
    ctx.fill();
  }

  drawThruster() {
    // Dos lenguas superpuestas: la exterior naranja y difusa, la interior
    // corta y casi blanca. El núcleo caliente es lo que la hace leer como fuego.
    const len = rand(10, 18);
    ctx.save();
    ctx.shadowColor = '#ff7a18';
    ctx.shadowBlur  = 14;

    const outer = ctx.createLinearGradient(-8, 0, -8 - len, 0);
    outer.addColorStop(0, 'rgba(255, 196, 60, 0.95)');
    outer.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(-8 - len, 0);
    ctx.lineTo(-7,  5);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 245, 214, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-7, -2.4);
    ctx.lineTo(-8 - len * 0.45, 0);
    ctx.lineTo(-7,  2.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';

    // La llama va primero: queda por debajo del casco
    if (this.thrusting) this.drawThruster();

    this.drawFacet(-9, HULL_TOP);
    this.drawFacet( 9, HULL_BOTTOM);

    // Quilla: el filo donde se encuentran las dos facetas
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-7, 0);
    ctx.stroke();

    // Contorno con halo: despega la nave del fondo negro
    ctx.shadowColor = HULL_GLOW;
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = HULL_EDGE;
    ctx.lineWidth   = 1.4;
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Cabina
    ctx.shadowBlur = 6;
    ctx.fillStyle  = COCKPIT;
    ctx.beginPath();
    ctx.ellipse(3, 0, 3.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUps ──────────────────────────────────────────────────────────────────
// Tabla única de tipos: color e etiqueta de HUD salen de acá, así el ítem que
// flota y su contador nunca se desincronizan.
const POWERUP_TYPES = {
  triple: { color: '#4de3ff', hud: 'TRIPLE' },
  shield: { color: '#8cff6a', hud: 'ESCUDO' },
};
const POWERUP_KINDS    = Object.keys(POWERUP_TYPES);
const POWERUP_TTL      = 12;    // segundos en pantalla antes de desvanecerse
const POWERUP_BLINK    = 3;     // parpadea los últimos N segundos
const DROP_CHANCE      = 0.12;  // probabilidad por asteroide destruido
const TRIPLE_DURATION  = 10;    // segundos de disparo triple
const SHIELD_DURATION  = 5;     // segundos, o hasta absorber un impacto

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(15, 35);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rot = 0;
    this.rotSpeed = 1.4;
    this.radius = 12;
    this.ttl  = POWERUP_TTL;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo de aviso antes de expirar
    if (this.ttl < POWERUP_BLINK && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const color = POWERUP_TYPES[this.type].color;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.8;
    ctx.lineJoin    = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 12;

    // Núcleo encendido: sin relleno, el hexágono se lee como alambre vacío
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius);
    glow.addColorStop(0, `${color}55`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;

    // Cápsula hexagonal
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * this.radius;
      const py = Math.sin(a) * this.radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Icono interno según el tipo
    ctx.lineWidth = 1.4;
    if (this.type === 'triple') {
      // Tres trazos en abanico
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.stroke();
      }
    } else {
      // Cúpula: arco con base
      ctx.beginPath();
      ctx.arc(0, 2, 7, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, 2);
      ctx.lineTo( 7, 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let powerup;      // PowerUp | null — ítem flotante pendiente de recoger
let powerupUsed;  // ya se recogió en este nivel (uno por nivel)
let tripleShot;   // segundos restantes del disparo triple
let shield;       // segundos restantes del escudo
// La pausa NO es un estado del juego: es la suspensión del tiempo. Si fuera un
// valor más de `state` habría que recordar de dónde veníamos ('playing' o
// 'dead') para poder volver. Como bandera aparte se cruza con cualquier estado
// sin ensuciar la máquina.
let paused;
let pauseTime;    // reloj propio: sigue corriendo para animar el cartel

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerup     = null;
  powerupUsed = false;
  tripleShot  = 0;
  shield      = 0;
  paused      = false;
  pauseTime   = 0;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerup     = null;   // si quedó sin recoger, se va con el nivel
  powerupUsed = false;  // vuelve a estar disponible: uno por nivel
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Se resuelve antes que cualquier estado: en 'gameover' no hay nada que pausar
  if (state !== 'gameover' && pressed('KeyP')) {
    paused = !paused;
    // Limpiar los flancos pendientes: si no, un ESPACIO apretado durante la
    // pausa dispara solo al reanudar.
    for (const code in justPressed) justPressed[code] = false;
  }
  if (paused) return;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  if (tripleShot > 0) tripleShot -= dt;
  if (shield     > 0) shield     -= dt;

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot(tripleShot > 0));
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        // Drop aleatorio: uno solo en pantalla, uno solo por nivel, tipo sorteado
        if (!powerupUsed && !powerup && Math.random() < DROP_CHANCE)
          powerup = new PowerUp(a.x, a.y, pick(POWERUP_KINDS));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Power-up: deriva, expiración y recogida
  if (powerup) {
    powerup.update(dt);
    if (!ship.dead && dist(ship, powerup) < ship.radius + powerup.radius) {
      if (powerup.type === 'triple') tripleShot = TRIPLE_DURATION;
      else                           shield     = SHIELD_DURATION;
      powerupUsed = true;
      explode(powerup.x, powerup.y, 10);
      powerup = null;
    } else if (powerup.dead) {
      powerup = null;
    }
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (shield > 0) {
          // El escudo vaporiza el asteroide SIN fragmentarlo: los pedazos
          // aparecerían encima de la nave justo al romperse el escudo.
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 6);
          shield = 0;             // se consume con el impacto
          ship.invincible = 1.2;  // margen para salir del cúmulo
        } else {
          killShip();
        }
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Fondo de galaxia ──────────────────────────────────────────────────────────
// Las nebulosas son fijas: se pintan UNA vez en un canvas fuera de pantalla y
// después se copian de un plumazo. Rehacer tres degradados radiales de 800x600
// en cada frame es trabajo tirado a la basura 60 veces por segundo.
function buildBackdrop() {
  const c = document.createElement('canvas');
  c.width  = W;
  c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#05060d';
  g.fillRect(0, 0, W, H);

  g.globalCompositeOperation = 'lighter';
  const blobs = [
    [W * 0.20, H * 0.26, 360, '86, 52, 168', 0.30],
    [W * 0.80, H * 0.70, 420, '24, 92, 150', 0.26],
    [W * 0.58, H * 0.12, 280, '150, 44, 120', 0.16],
  ];
  for (const [x, y, r, rgb, alpha] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }
  return c;
}

// Tres capas con velocidad y tamaño distintos: eso es el paralaje, y es lo que
// convierte un puñado de puntos en profundidad.
const STAR_LAYERS = [
  { n: 110, speed:  2, size: 0.7, alpha: 0.40, color: '159, 182, 216' },
  { n:  50, speed:  5, size: 1.1, alpha: 0.70, color: '220, 233, 255' },
  { n:  20, speed: 10, size: 1.7, alpha: 0.95, color: '255, 255, 255' },
];

const backdrop = buildBackdrop();
const stars = STAR_LAYERS.flatMap((layer, i) =>
  Array.from({ length: layer.n }, () => ({
    x: rand(0, W),
    y: rand(0, H),
    layer: i,
    phase: rand(0, Math.PI * 2),
  }))
);

let starTime = 0;

function drawBackground(dt) {
  starTime += dt;
  ctx.drawImage(backdrop, 0, 0);

  for (const s of stars) {
    const layer = STAR_LAYERS[s.layer];
    s.x = wrap(s.x - layer.speed * dt, W);
    // Titileo: cada estrella con su propia fase, si no laten todas juntas
    const tw = 0.75 + 0.25 * Math.sin(starTime * 2.2 + s.phase);
    ctx.fillStyle = `rgba(${layer.color}, ${(layer.alpha * tw).toFixed(2)})`;
    ctx.fillRect(s.x, s.y, layer.size, layer.size);
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.fillStyle   = 'rgba(143, 167, 199, 0.35)';
  ctx.fill();
  ctx.strokeStyle = HULL_EDGE;
  ctx.lineWidth   = 1.2;
  ctx.stroke();
  ctx.restore();
}

const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// Etiqueta chica y apagada arriba, dato grande y encendido abajo. Dos niveles
// de jerarquía: el ojo encuentra el número sin tener que leer la palabra.
function drawStat(label, value, x, align) {
  ctx.textAlign  = align;
  ctx.font       = `10px ${FONT}`;
  ctx.fillStyle  = 'rgba(158, 178, 210, 0.8)';
  ctx.fillText(label, x, 22);
  ctx.font       = `bold 20px ${FONT}`;
  ctx.fillStyle  = '#eaf3ff';
  ctx.shadowColor = HULL_GLOW;
  ctx.shadowBlur  = 8;
  ctx.fillText(value, x, 43);
  ctx.shadowBlur  = 0;
}

function drawHUD() {
  ctx.save();

  // Banda superior: el HUD necesita apoyarse en algo o las nebulosas se lo comen
  const band = ctx.createLinearGradient(0, 0, 0, 72);
  band.addColorStop(0, 'rgba(5, 6, 13, 0.88)');
  band.addColorStop(1, 'rgba(5, 6, 13, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 72);

  drawStat('PUNTAJE', String(score), 18, 'left');
  drawStat('NIVEL',   String(level), W / 2, 'center');

  ctx.textAlign = 'right';
  ctx.font      = `10px ${FONT}`;
  ctx.fillStyle = 'rgba(158, 178, 210, 0.8)';
  ctx.fillText('NAVES', W - 18, 22);
  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 26 - i * 24, 37);

  // Contadores de efectos activos, apilados (pueden coexistir)
  const active = [];
  if (tripleShot > 0) active.push(['triple', tripleShot]);
  if (shield     > 0) active.push(['shield', shield]);

  ctx.textAlign = 'center';
  ctx.font      = `bold 12px ${FONT}`;
  active.forEach(([kind, t], i) => {
    const type = POWERUP_TYPES[kind];
    ctx.fillStyle   = type.color;
    ctx.shadowColor = type.color;
    ctx.shadowBlur  = 10;
    ctx.fillText(`${type.hud}  ${Math.ceil(t)}`, W / 2, 64 + i * 17);
  });

  // Pista discreta: una tecla que el jugador no sabe que existe, no existe
  if (!paused && state !== 'gameover') {
    ctx.textAlign = 'left';
    ctx.font      = `10px ${FONT}`;
    ctx.fillStyle = 'rgba(158, 178, 210, 0.4)';
    ctx.fillText('P  PAUSA', 18, H - 16);
  }

  ctx.restore();
}

function drawShield() {
  // Parpadeo de aviso en el último tramo
  if (shield < 1.5 && Math.floor(shield * 8) % 2 === 0) return;

  const R     = 22;
  const pulse = 0.6 + 0.25 * Math.sin(shield * 9);
  const a     = v => (v * pulse).toFixed(3);

  ctx.save();
  ctx.translate(ship.x, ship.y);
  // Modo aditivo: los brillos se suman en vez de taparse, que es como se
  // comporta la luz real. Sin esto, la burbuja apagaría a la nave.
  ctx.globalCompositeOperation = 'lighter';

  // Fresnel: hueca en el centro, encendida en el borde. Una esfera vista de
  // frente muestra más superficie de canto en los bordes, y por eso brillan más.
  const g = ctx.createRadialGradient(0, 0, R * 0.45, 0, 0, R);
  g.addColorStop(0,    'rgba(140, 255, 106, 0)');
  g.addColorStop(0.72, `rgba(140, 255, 106, ${a(0.12)})`);
  g.addColorStop(1,    `rgba(190, 255, 160, ${a(0.5)})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();

  // Borde con bloom
  ctx.shadowColor = '#8cff6a';
  ctx.shadowBlur  = 16;
  ctx.strokeStyle = `rgba(180, 255, 150, ${a(0.9)})`;
  ctx.lineWidth   = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();

  // Reflejo especular, fijo respecto al mundo: una esfera se ve idéntica
  // rotada, así que el brillo NO debe acompañar el giro de la nave.
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = `rgba(240, 255, 230, ${a(0.85)})`;
  ctx.lineWidth   = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, R - 2.5, Math.PI * 1.14, Math.PI * 1.46);
  ctx.stroke();

  // Arcos de energía girando: le dan superficie viva, no un aro estático
  const spin = -shield * 1.6;
  ctx.strokeStyle = `rgba(140, 255, 106, ${a(0.55)})`;
  ctx.lineWidth   = 1;
  for (const off of [0, Math.PI]) {
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.74, spin + off, spin + off + 0.85);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPause() {
  // Latido suave en vez de encendido/apagado seco: llama la atención sin
  // castigar la vista, porque este cartel puede quedar minutos en pantalla.
  const beat = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(pauseTime * 3.4));

  ctx.save();
  ctx.fillStyle = 'rgba(4, 5, 11, 0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign   = 'center';
  ctx.font        = `bold 54px ${FONT}`;
  ctx.fillStyle   = `rgba(234, 243, 255, ${beat.toFixed(2)})`;
  ctx.shadowColor = HULL_GLOW;
  ctx.shadowBlur  = 26 * beat;
  ctx.fillText('PAUSA', W / 2, H / 2 - 4);

  ctx.shadowBlur = 0;
  ctx.font       = `12px ${FONT}`;
  ctx.fillStyle  = 'rgba(190, 206, 230, 0.75)';
  ctx.fillText('P PARA CONTINUAR', W / 2, H / 2 + 30);
  ctx.restore();
}

function drawOverlay(title, sub) {
  ctx.save();

  // Viñeta: oscurece los bordes y deja el centro respirando, para que el ojo
  // vaya al panel y no a las nebulosas del fondo.
  const vig = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.72);
  vig.addColorStop(0, 'rgba(4, 5, 11, 0.55)');
  vig.addColorStop(1, 'rgba(4, 5, 11, 0.93)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const pw = 460, ph = 196;
  const px = (W - pw) / 2, py = (H - ph) / 2;

  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fillStyle = 'rgba(11, 15, 28, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(106, 168, 255, 0.45)';
  ctx.lineWidth   = 1.2;
  ctx.shadowColor = HULL_GLOW;
  ctx.shadowBlur  = 22;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  ctx.textAlign   = 'center';
  ctx.font        = `bold 42px ${FONT}`;
  ctx.fillStyle   = '#eaf3ff';
  ctx.shadowColor = HULL_GLOW;
  ctx.shadowBlur  = 18;
  ctx.fillText(title, W / 2, py + 74);
  ctx.shadowBlur  = 0;

  // El puntaje es el premio: va grande y en el color de la nave
  ctx.font      = `10px ${FONT}`;
  ctx.fillStyle = 'rgba(158, 178, 210, 0.8)';
  ctx.fillText('PUNTAJE FINAL', W / 2, py + 102);
  ctx.font      = `bold 30px ${FONT}`;
  ctx.fillStyle = HULL_EDGE;
  ctx.fillText(String(score), W / 2, py + 134);

  ctx.font      = `12px ${FONT}`;
  ctx.fillStyle = 'rgba(190, 206, 230, 0.75)';
  ctx.fillText(sub, W / 2, py + 166);

  ctx.restore();
}

function draw(dt) {
  drawBackground(dt);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  if (powerup) powerup.draw();
  bullets.forEach(b => b.draw());
  ship.draw();
  if (shield > 0 && !ship.dead) drawShield();

  drawHUD();

  if (paused) drawPause();

  if (state === 'gameover')
    drawOverlay('GAME OVER', 'ESPACIO PARA REINICIAR');
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  // Con la pausa activa el mundo recibe dt = 0 (hasta las estrellas se
  // detienen), pero el reloj del cartel sigue corriendo aparte.
  if (paused) pauseTime += dt;
  draw(paused ? 0 : dt);
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
