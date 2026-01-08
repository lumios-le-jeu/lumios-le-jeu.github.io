/**
 * Lumios - Modern Web Version
 * Core Game Logic
 */

/* --- Constants & Config --- */
const CONFIG = {
  colors: {
    green: '#10b981',
    blue: '#3b82f6',
    red: '#f43f5e',
    gold: '#fbbf24',
    white: '#f8fafc'
  },
  physics: {
    friction: 0.94,         // Linear velocity decay (Lower = more drag)
    angularFriction: 0.95,   // Rotational decay
    restitution: 0.8,        // Bounciness
    stopThreshold: 0.05,     // Speed to snap to 0
    maxPower: 25,            // Max launch speed
    dragScale: 0.15,         // Drag pixel to speed ratio
    wobbleStrength: 0.15,    // Force derived from offset mass
    curveBias: 0.02          // Curvature factor for "biased" rolling
  },
  game: {
    ballRadius: 22,
    lumieRadius: 20,
    lumieSpacing: 70,
    cooldown: 4000
  }
};

/* --- Math Helpers --- */
const Vec2 = {
  add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
  sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
  mul: (v, s) => ({ x: v.x * s, y: v.y * s }),
  len: (v) => Math.hypot(v.x, v.y),
  norm: (v) => { const l = Math.hypot(v.x, v.y); return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l }; },
  dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
  dist: (v1, v2) => Math.hypot(v1.x - v2.x, v1.y - v2.y)
};

/* --- Classes --- */
class Ball {
  constructor(x, y, r, color, isLumie = false) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color; // 'red', 'green', 'blue', 'gold' (player ball)
    this.vx = 0;
    this.vy = 0;

    // Physics properties for "Realism"
    this.mass = r;
    this.angle = Math.random() * Math.PI * 2; // Orientation
    this.angularVelocity = 0;

    // "Barycentre Déporté" (Eccentricity) properties
    // Each ball has a unique "heavy spot" angle offset relative to its visual center
    this.heavyPhase = Math.random() * Math.PI * 2;

    this.isLumie = isLumie;
    this.lockedUntil = 0; // Timestamp
    this.lastHit = 0;
  }

  update() {
    // 1. Apply Physics
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.angularVelocity;

    // 2. Friction
    this.vx *= CONFIG.physics.friction;
    this.vy *= CONFIG.physics.friction;
    this.angularVelocity *= CONFIG.physics.angularFriction;

    // 3. "Eccentric Mass" Simulation (Wobble & Curve)
    // Only applies to Lumies (target balls). Player ball is normal.
    // If moving, the offset mass creates a fluctuating force
    const speed = Math.hypot(this.vx, this.vy);
    if (this.isLumie && speed > 0.1) {
      // The heavy spot rotates. 
      // Force vector aligns with the current heavy angle
      const currentHeavyAngle = this.angle + this.heavyPhase;

      // Wobble force: pulls the ball slightly in the direction of the weight
      const wobbleX = Math.cos(currentHeavyAngle) * CONFIG.physics.wobbleStrength;
      const wobbleY = Math.sin(currentHeavyAngle) * CONFIG.physics.wobbleStrength;

      // Apply only a fraction based on speed (higher speed = less noticeable wobble initially, until it slows)
      // Actually, bias involves curving towards the heavy side.
      // Let's add the wobble force unconditionally if moving.
      this.vx += wobbleX;
      this.vy += wobbleY;

      // Coupling Linear <-> Angular
      // Rolling creates angular velocity
      this.angularVelocity += (speed * 0.05) * (Math.random() > 0.5 ? 1 : -1);
      // (Simplified coupling for visual variation)
    }

    // 4. Stop Threshold
    if (speed < CONFIG.physics.stopThreshold) {
      this.vx = 0;
      this.vy = 0;
      this.angularVelocity = 0;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Draw Body
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors[this.color] || this.color;
    ctx.fill();

    // Inner Glow/Shadow for 3D effect
    const grad = ctx.createRadialGradient(-this.r * 0.3, -this.r * 0.3, this.r * 0.2, 0, 0, this.r);
    grad.addColorStop(0, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw "Heavy Spot" or stripe to see rotation
    if (this.isLumie) {
      ctx.beginPath();
      // A stripe indicating the 'culbuto' weight or just orientation
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 3;
      ctx.moveTo(-this.r / 2, 0);
      ctx.lineTo(this.r / 2, 0);
      ctx.stroke();

      // Visual indicator of center
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(this.r * 0.4, -this.r * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Player ball - NORMAL (No eccentricity visuals)
      ctx.fillStyle = CONFIG.colors[this.color];
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();

      // Inner Glow
      const grad = ctx.createRadialGradient(-this.r * 0.3, -this.r * 0.3, this.r * 0.2, 0, 0, this.r);
      grad.addColorStop(0, 'rgba(255,255,255,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Simple highlight, no stripe
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(this.r * 0.3, -this.r * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Locked Indicator (Shield)
    if (Date.now() < this.lockedUntil) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.lumies = [];
    this.playerBall = null;
    this.currentPlayer = 1; // 1 or 2
    this.playerColors = { 1: null, 2: null };
    this.scores = { green: 0, blue: 0 };
    this.turnState = 'aiming'; // 'aiming', 'rolling', 'process_turn'

    this.dragStart = null;
    this.dragCurrent = null;

    this.turnChanges = [];

    this.narrator = document.getElementById('narrationText');

    this.bindEvents();
    this.resize();
    this.initBoard();
    this.loop();
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Touch/Mouse
    const start = (p) => {
      if (this.turnState !== 'aiming') return;
      // Check region (for P1 bottom, P2 top)
      const allowedY = this.currentPlayer === 1
        ? p.y > this.height * 0.75
        : p.y < this.height * 0.25;

      // Or allow grabbing the ball directly if it's there
      const distToBall = Vec2.dist(p, this.playerBall);

      if (allowedY || distToBall < 60) {
        this.dragStart = p;
        this.dragCurrent = p;
      }
    };

    const move = (p) => {
      if (!this.dragStart) return;
      this.dragCurrent = p;
      this.updatepowerUI();
    };

    const end = () => {
      if (!this.dragStart) return;
      this.shoot();
      this.dragStart = null;
      this.dragCurrent = null;
      this.hidePowerUI();
    };

    // Mapping Mouse/Touch
    this.canvas.addEventListener('mousedown', e => start({ x: e.clientX, y: e.clientY }));
    window.addEventListener('mousemove', e => move({ x: e.clientX, y: e.clientY }));
    window.addEventListener('mouseup', end);

    this.canvas.addEventListener('touchstart', e => start({ x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: false });
    window.addEventListener('touchmove', e => move({ x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: false });
    window.addEventListener('touchend', end);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    // Re-layout lumies if needed
  }

  initBoard() {
    this.lumies = [];
    const count = 5;
    const spacing = Math.min(this.width / (count + 1), CONFIG.game.lumieSpacing);
    const startX = (this.width - (spacing * (count - 1))) / 2;
    const centerY = this.height / 2;

    for (let i = 0; i < count; i++) {
      this.lumies.push(new Ball(
        startX + i * spacing,
        centerY,
        CONFIG.game.lumieRadius,
        'red',
        true
      ));
    }
    this.resetPlayerBall();
  }

  resetPlayerBall() {
    const y = this.currentPlayer === 1
      ? this.height - 100
      : 100;
    this.playerBall = new Ball(this.width / 2, y, CONFIG.game.ballRadius, 'gold');
  }

  updatepowerUI() {
    // Drag-to-Shoot: Drag TOWARDS target (Pool Cue / Direct)
    if (!this.dragStart) return;
    const v = Vec2.sub(this.dragCurrent, this.dragStart); // Vector points from Start -> Current (Drag Dir)

    // HTML Meter magnitude
    const len = Vec2.len(v);
    const pct = Math.min(len / 200, 1) * 100;

    const bar = document.getElementById('powerBar');
    const wrap = document.querySelector('.power-indicator');
    if (bar && wrap) {
      wrap.classList.add('visible');
      bar.style.width = pct + '%';
    }
  }

  hidePowerUI() {
    document.querySelector('.power-indicator')?.classList.remove('visible');
  }

  shoot() {
    // Drag-to-Shoot: Start -> Current
    const v = Vec2.sub(this.dragCurrent, this.dragStart);
    const len = Vec2.len(v);
    if (len < 5) return; // Ignore small taps

    const power = Math.min(len * CONFIG.physics.dragScale, CONFIG.physics.maxPower);
    const dir = Vec2.norm(v);

    this.playerBall.vx = dir.x * power;
    this.playerBall.vy = dir.y * power;
    this.playerBall.angularVelocity = power * 0.1;


    this.turnState = 'rolling';
    this.turnChanges = []; // Reset tracking
    this.turnStartTime = Date.now(); // Track time for 3s limit

    // Unlock expired Lumies
    const now = Date.now();
    this.lumies.forEach(l => {
      if (l.lockedUntil < now) l.lockedUntil = 0;
    });
  }

  loop() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.turnState === 'rolling') {
      this.updatePhysics();
    }

    this.draw();

    requestAnimationFrame(() => this.loop());
  }

  updatePhysics() {
    let moving = false;
    const allBalls = [...this.lumies, this.playerBall];

    // 3-SECOND RULE:
    // If turn has lasted > 3 seconds, force stop with heavy damping
    const elapsed = Date.now() - (this.turnStartTime || 0);
    const timeLimitReached = elapsed > 3000;

    // Update positions
    allBalls.forEach(b => {
      b.update();

      // If time limit reached, Force Hard Stop to prevent drifting
      if (timeLimitReached) {
        b.vx = 0;
        b.vy = 0;
        b.angularVelocity = 0;
      }

      if (Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0) moving = true;

      // Walls
      if (b.x < b.r) { b.x = b.r; b.vx *= -CONFIG.physics.restitution; }
      if (b.x > this.width - b.r) { b.x = this.width - b.r; b.vx *= -CONFIG.physics.restitution; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -CONFIG.physics.restitution; }
      if (b.y > this.height - b.r) { b.y = this.height - b.r; b.vy *= -CONFIG.physics.restitution; }
    });

    // Collisions
    for (let i = 0; i < allBalls.length; i++) {
      for (let j = i + 1; j < allBalls.length; j++) {
        this.resolveCollision(allBalls[i], allBalls[j]);
      }
    }

    if (!moving) {
      if (this.turnState === 'rolling') {
        this.endTurn();
      }
    }
  }

  resolveCollision(b1, b2) {
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = b1.r + b2.r;

    if (dist < minDist) {
      // 1. Separate
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      b1.x -= nx * overlap * 0.5;
      b1.y -= ny * overlap * 0.5;
      b2.x += nx * overlap * 0.5;
      b2.y += ny * overlap * 0.5;

      // 2. Reflect velocity
      // Tangent vector
      const tx = -ny;
      const ty = nx;

      // Dot products tangent
      const dpTan1 = b1.vx * tx + b1.vy * ty;
      const dpTan2 = b2.vx * tx + b2.vy * ty;

      // Dot products normal
      const dpNorm1 = b1.vx * nx + b1.vy * ny;
      const dpNorm2 = b2.vx * nx + b2.vy * ny;

      // Conservation of momentum (assuming equal mass)
      const m1 = b1.mass;
      const m2 = b2.mass;

      const v1n = (dpNorm1 * (m1 - m2) + 2 * m2 * dpNorm2) / (m1 + m2);
      const v2n = (dpNorm2 * (m2 - m1) + 2 * m1 * dpNorm1) / (m1 + m2);

      b1.vx = tx * dpTan1 + nx * v1n;
      b1.vy = ty * dpTan1 + ny * v1n;
      b2.vx = tx * dpTan2 + nx * v2n;
      b2.vy = ty * dpTan2 + ny * v2n;

      // Handle Game Logic if Lumie Impact
      // Use relative speed to determine intensity
      const impactPower = Math.abs(dpNorm1 - dpNorm2);
      if (impactPower > 0.5) {
        if (b1.isLumie) this.onHitLumie(b1);
        if (b2.isLumie) this.onHitLumie(b2);
      }

      // Add wobble to angular velocity on impact (chaos)
      b1.angularVelocity += (Math.random() - 0.5);
      b2.angularVelocity += (Math.random() - 0.5);
    }
  }

  onHitLumie(lumie) {
    if (Date.now() < lumie.lockedUntil) return;

    const prevColor = lumie.color;

    // Logic: Red -> Random(Green/Blue), Green->Blue, Blue->Green
    if (lumie.color === 'red') {
      const pick = Math.random() > 0.5 ? 'green' : 'blue';
      lumie.color = pick;

      // First blood assignment
      if (!this.playerColors[1] && !this.playerColors[2]) {
        this.playerColors[this.currentPlayer] = pick;
        this.playerColors[this.currentPlayer === 1 ? 2 : 1] = pick === 'green' ? 'blue' : 'green';
        this.updateBadge();
      }
    } else if (lumie.color === 'green') {
      lumie.color = 'blue';
    } else if (lumie.color === 'blue') {
      lumie.color = 'green';
    }

    // Lock it
    lumie.lockedUntil = Date.now() + CONFIG.game.cooldown;

    // Track change
    this.turnChanges.push({ ball: lumie, before: prevColor, after: lumie.color });
    this.updateScores();
  }

  updateScores() {
    let g = 0, b = 0;
    this.lumies.forEach(l => {
      if (l.color === 'green') g++;
      if (l.color === 'blue') b++;
    });
    document.getElementById('scoreGreen').textContent = g;
    document.getElementById('scoreBlue').textContent = b;

    // Win cond
    if (g === 5) this.gameOver('green');
    if (b === 5) this.gameOver('blue');
  }

  updateBadge() {
    const p1Col = this.playerColors[1];
    const badge = document.getElementById('playerBadge');
    if (!p1Col) badge.textContent = `JOUEUR ${this.currentPlayer}`;
    else {
      const myCol = this.playerColors[this.currentPlayer];
      badge.textContent = `JOUEUR ${this.currentPlayer} (${myCol.toUpperCase()})`;
      badge.style.borderColor = CONFIG.colors[myCol];
    }
  }

  endTurn() {
    this.turnState = 'process_turn';

    // --- Replay Rules ---
    // Rule: Replay if you gained >= 1 ball of YOUR color AND 0 of OPPONENT color.
    // Otherwise: Switch turn.

    let switchTurn = true;
    const myCol = this.playerColors[this.currentPlayer];

    if (myCol) {
      const opponentCol = (myCol === 'green') ? 'blue' : 'green';

      let gainedMy = 0;
      let gainedOpponent = 0;

      this.turnChanges.forEach(change => {
        if (change.after === myCol) gainedMy++;
        if (change.after === opponentCol) gainedOpponent++;
      });

      // Debug info
      console.log(`P${this.currentPlayer} (${myCol}): Gained ${gainedMy}, Opponent Gained ${gainedOpponent}`);

      if (gainedMy > 0 && gainedOpponent === 0) {
        // Replay!
        switchTurn = false;
      }
    } else {
      // Colors not assigned yet, standard switch
      switchTurn = true;
    }

    if (switchTurn) {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }

    this.updateBadge();

    this.resetPlayerBall();
    this.turnState = 'aiming';

    // Show toast
    const toast = document.getElementById('toast');
    if (!switchTurn) {
      toast.textContent = `REJOUER ! (Gagné: ${myCol})`;
      toast.style.color = CONFIG.colors[myCol];
    } else {
      toast.textContent = `Tour du Joueur ${this.currentPlayer}`;
      toast.style.color = '#fff';
    }
  }

  gameOver(winnerColor) {
    const overlay = document.getElementById('overlay');
    const modal = document.querySelector('.modal');

    // Random Boy vs Girl
    // NOTE: We assume 'win_boy.png' and 'win_girl.png' are in the same folder
    const charImg = (Math.random() > 0.5) ? 'win_boy.png' : 'win_girl.png';

    // Custom festive content
    modal.innerHTML = `
        <img src="${charImg}" style="width:100%; border-radius:12px; margin-bottom:12px;">
        <h1 style="color:${CONFIG.colors[winnerColor]}; text-transform:uppercase; font-size:2rem;">Victoire ${winnerColor}!</h1>
        <p>LumiiiiiioooooOOoosss !</p>
        <button class="btn btn-primary" onclick="location.reload()">Rejouer</button>
     `;

    overlay.classList.add('visible');

    // Creating simple confetti particles via DOM for the celebration
    for (let i = 0; i < 50; i++) {
      const c = document.createElement('div');
      c.style.position = 'absolute';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.top = '-10px';
      c.style.width = '10px';
      c.style.height = '10px';
      c.style.background = Math.random() > 0.5 ? CONFIG.colors.green : CONFIG.colors.blue;
      c.style.animation = `fall ${2 + Math.random() * 3}s linear infinite`;
      document.body.appendChild(c);
    }

    // Add css for confetti
    const style = document.createElement('style');
    style.innerHTML = `
       @keyframes fall { to { transform: translateY(100vh) rotate(360deg); } }
     `;
    document.head.appendChild(style);
  }

  draw() {
    this.playerBall.draw(this.ctx);
    this.lumies.forEach(l => l.draw(this.ctx));

    // Draw drag line (Drag-to-Shoot Style: Arrow follows cursor)
    if (this.dragStart && this.dragCurrent) {
      // Vector: Start -> Current
      const v = Vec2.sub(this.dragCurrent, this.dragStart);

      this.ctx.beginPath();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = 'round';

      // Draw from Start (Ball) towards Current (Cursor)
      this.ctx.moveTo(this.dragStart.x, this.dragStart.y);
      this.ctx.lineTo(this.dragStart.x + v.x, this.dragStart.y + v.y);
      this.ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(v.y, v.x);
      const headLen = 15;
      this.ctx.beginPath();
      this.ctx.moveTo(this.dragStart.x + v.x, this.dragStart.y + v.y);
      this.ctx.lineTo(this.dragStart.x + v.x - headLen * Math.cos(angle - Math.PI / 6), this.dragStart.y + v.y - headLen * Math.sin(angle - Math.PI / 6));
      this.ctx.lineTo(this.dragStart.x + v.x - headLen * Math.cos(angle + Math.PI / 6), this.dragStart.y + v.y - headLen * Math.sin(angle + Math.PI / 6));
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.fill();
    }
  }
}

// Start
window.GAME = new Game();
