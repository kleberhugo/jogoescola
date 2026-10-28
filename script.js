/* ============================================================
   SPACE DEFENDER - JOGO COMPLETO VANILLA JAVASCRIPT
   ============================================================ */

(() => {
  // CONFIGURAÇÕES E ESTADO DO JOGO
  const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 900,
    playerSpeed: 6,
    baseShootDelay: 220,
    maxLives: 3,
    maxLevel: 15,
  };

  const SETTINGS = {
    sfx: true,
    music: true,
    particles: true,
    difficulty: 'normal', // 'easy', 'normal', 'hard'
  };

  const DIFFICULTY_FACTORS = {
    easy: { enemySpeed: 0.8, enemyHp: 0.8, spawnRate: 1.2 },
    normal: { enemySpeed: 1.0, enemyHp: 1.0, spawnRate: 1.0 },
    hard: { enemySpeed: 1.3, enemyHp: 1.2, spawnRate: 0.8 },
  };

  // ÁUDIO VIA WEB AUDIO API (sem arquivos externos)
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.musicOsc = null;
      this.musicGain = null;
      this.musicTimer = null;
      this.notes = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94];
      this.step = 0;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playShoot() {
      if (!SETTINGS.sfx || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    }

    playExplosion(isBoss = false) {
      if (!SETTINGS.sfx || !this.ctx) return;
      const duration = isBoss ? 0.6 : 0.25;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isBoss ? 400 : 800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isBoss ? 0.5 : 0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    }

    playPowerUp() {
      if (!SETTINGS.sfx || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.25);
    }

    playDamage() {
      if (!SETTINGS.sfx || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.2);
    }

    playVictory() {
      if (!SETTINGS.sfx || !this.ctx) return;
      [440, 554, 659, 880].forEach((freq, idx) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.3);
        }, idx * 160);
      });
    }

    startMusic() {
      if (!SETTINGS.music || this.musicTimer) return;
      this.init();
      const bassline = [65.41, 65.41, 77.78, 87.31, 98.00, 87.31, 77.78, 65.41];
      this.musicTimer = setInterval(() => {
        if (!SETTINGS.music || !this.ctx) return;
        const note = bassline[this.step % bassline.length];
        this.step++;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      }, 200);
    }

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }
  }

  const audio = new SoundManager();

  // PARTICULAS E EXPLOSÕES
  class Particle {
    constructor(x, y, color, size = 3, speed = 4) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.size = Math.random() * size + 1;
      const angle = Math.random() * Math.PI * 2;
      const vel = Math.random() * speed;
      this.vx = Math.cos(angle) * vel;
      this.vy = Math.sin(angle) * vel;
      this.alpha = 1;
      this.decay = Math.random() * 0.03 + 0.02;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= this.decay;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // JOGADOR
  class Player {
    constructor(game) {
      this.game = game;
      this.width = 44;
      this.height = 48;
      this.x = game.width / 2 - this.width / 2;
      this.y = game.height - 90;
      this.vx = 0;
      this.vy = 0;
      this.lives = CONFIG.maxLives;
      this.hp = 100;
      this.maxHp = 100;
      this.shootCooldown = 0;
      this.powerups = {
        double: 0,
        triple: 0,
        shield: 0,
        speed: 0,
        fastFire: 0,
      };
      this.invincibleTimer = 0;
    }

    reset() {
      this.x = this.game.width / 2 - this.width / 2;
      this.y = this.game.height - 90;
      this.lives = CONFIG.maxLives;
      this.hp = 100;
      this.powerups = { double: 0, triple: 0, shield: 0, speed: 0, fastFire: 0 };
      this.invincibleTimer = 0;
    }

    takeDamage(amount) {
      if (this.invincibleTimer > 0) return;
      if (this.powerups.shield > 0) {
        this.powerups.shield = 0;
        this.invincibleTimer = 40;
        audio.playDamage();
        return;
      }

      this.hp -= amount;
      audio.playDamage();
      this.invincibleTimer = 50;

      if (this.hp <= 0) {
        this.lives--;
        if (this.lives > 0) {
          this.hp = this.maxHp;
        } else {
          this.game.gameOver();
        }
      }
      this.game.updateHUD();
    }

    update() {
      const currentSpeed = this.powerups.speed > 0 ? CONFIG.playerSpeed * 1.5 : CONFIG.playerSpeed;

      // Movimentação via Teclado ou Joystick
      let dirX = 0;
      let dirY = 0;

      if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) dirX -= 1;
      if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) dirX += 1;
      if (this.game.keys['ArrowUp'] || this.game.keys['KeyW']) dirY -= 1;
      if (this.game.keys['ArrowDown'] || this.game.keys['KeyS']) dirY += 1;

      if (this.game.joystickVector.x !== 0 || this.game.joystickVector.y !== 0) {
        dirX = this.game.joystickVector.x;
        dirY = this.game.joystickVector.y;
      }

      this.x += dirX * currentSpeed;
      this.y += dirY * currentSpeed;

      // Limites da tela
      this.x = Math.max(0, Math.min(this.game.width - this.width, this.x));
      this.y = Math.max(80, Math.min(this.game.height - this.height - 20, this.y));

      // Diminuir timers de powerups
      for (const key in this.powerups) {
        if (this.powerups[key] > 0) this.powerups[key]--;
      }
      if (this.invincibleTimer > 0) this.invincibleTimer--;

      // Tiro automático / tecla espaço / touch
      if (this.shootCooldown > 0) this.shootCooldown--;
      const fireRequested = this.game.keys['Space'] || this.game.isFiringMobile;

      if (fireRequested && this.shootCooldown <= 0) {
        this.shoot();
        const baseRate = this.powerups.fastFire > 0 ? CONFIG.baseShootDelay * 0.5 : CONFIG.baseShootDelay;
        this.shootCooldown = Math.round(baseRate / 16.6); // Em frames aprox
      }
    }

    shoot() {
      const cx = this.x + this.width / 2;
      const cy = this.y;

      if (this.powerups.triple > 0) {
        this.game.playerProjectiles.push(new Projectile(cx, cy, 0, -11, '#00f0ff'));
        this.game.playerProjectiles.push(new Projectile(cx - 12, cy + 4, -2.5, -10, '#00f0ff'));
        this.game.playerProjectiles.push(new Projectile(cx + 12, cy + 4, 2.5, -10, '#00f0ff'));
      } else if (this.powerups.double > 0) {
        this.game.playerProjectiles.push(new Projectile(cx - 10, cy, 0, -11, '#00f0ff'));
        this.game.playerProjectiles.push(new Projectile(cx + 10, cy, 0, -11, '#00f0ff'));
      } else {
        this.game.playerProjectiles.push(new Projectile(cx, cy, 0, -11, '#00f0ff'));
      }
      audio.playShoot();
    }

    draw(ctx) {
      if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0) {
        return; // Efeito de piscar ao levar dano
      }

      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

      // Rastro de propulsão
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-6, this.height / 2);
      ctx.lineTo(6, this.height / 2);
      ctx.lineTo(0, this.height / 2 + 10 + Math.random() * 8);
      ctx.closePath();
      ctx.fill();

      // Nave do jogador (design vetor neon)
      ctx.fillStyle = '#0a1026';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(0, -this.height / 2); // Bico
      ctx.lineTo(this.width / 2, this.height / 2);
      ctx.lineTo(this.width / 4, this.height / 3);
      ctx.lineTo(0, this.height / 2 - 4);
      ctx.lineTo(-this.width / 4, this.height / 3);
      ctx.lineTo(-this.width / 2, this.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cabine
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.ellipse(0, -2, 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Escudo ativo
      if (this.powerups.shield > 0) {
        ctx.strokeStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, this.width * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // PROJÉTIL
  class Projectile {
    constructor(x, y, vx, vy, color = '#00f0ff', isEnemy = false) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.radius = isEnemy ? 4 : 3;
      this.color = color;
      this.isEnemy = isEnemy;
      this.markedForDeletion = false;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
    }

    draw(ctx) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // INIMIGOS
  class Enemy {
    constructor(game, type) {
      this.game = game;
      this.type = type; // 1: comum, 2: rapido, 3: resistente, 4: atirador
      this.markedForDeletion = false;

      const diff = DIFFICULTY_FACTORS[SETTINGS.difficulty];

      switch (type) {
        case 1: // Comum
          this.width = 36;
          this.height = 36;
          this.hp = Math.round(1 * diff.enemyHp);
          this.speed = (2 + Math.random() * 1 + game.level * 0.15) * diff.enemySpeed;
          this.color = '#ff3366';
          this.points = 100;
          break;
        case 2: // Rápido
          this.width = 28;
          this.height = 28;
          this.hp = Math.round(1 * diff.enemyHp);
          this.speed = (4 + Math.random() * 1.5 + game.level * 0.2) * diff.enemySpeed;
          this.color = '#ffcc00';
          this.points = 150;
          break;
        case 3: // Resistente
          this.width = 46;
          this.height = 46;
          this.hp = Math.round(4 * diff.enemyHp + Math.floor(game.level * 0.5));
          this.speed = (1.2 + game.level * 0.08) * diff.enemySpeed;
          this.color = '#bf00ff';
          this.points = 250;
          break;
        case 4: // Atirador
          this.width = 38;
          this.height = 38;
          this.hp = Math.round(2 * diff.enemyHp);
          this.speed = (1.8 + game.level * 0.1) * diff.enemySpeed;
          this.color = '#00ffcc';
          this.points = 200;
          this.shootTimer = Math.random() * 60 + 60;
          break;
      }

      this.x = Math.random() * (game.width - this.width);
      this.y = -this.height;
      this.initialX = this.x;
      this.angle = 0;
    }

    update() {
      this.y += this.speed;

      // Movimentação em ondas senoidais para o rápido
      if (this.type === 2) {
        this.angle += 0.08;
        this.x = this.initialX + Math.sin(this.angle) * 50;
      }

      // Inimigo que atira
      if (this.type === 4) {
        this.shootTimer--;
        if (this.shootTimer <= 0) {
          this.shoot();
          this.shootTimer = 110 + Math.random() * 40;
        }
      }

      // Chegou ao fundo da tela: causa dano ao jogador e se destrói
      if (this.y > this.game.height) {
        this.markedForDeletion = true;
        this.game.player.takeDamage(15);
      }
    }

    shoot() {
      const p = new Projectile(
        this.x + this.width / 2,
        this.y + this.height,
        0,
        5,
        '#ff3344',
        true
      );
      this.game.enemyProjectiles.push(p);
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.strokeStyle = this.color;
      ctx.fillStyle = '#0f1423';
      ctx.lineWidth = 2;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      if (this.type === 1) { // Triângulo invertido
        ctx.moveTo(0, this.height / 2);
        ctx.lineTo(-this.width / 2, -this.height / 2);
        ctx.lineTo(this.width / 2, -this.height / 2);
      } else if (this.type === 2) { // Losango ágil
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(this.width / 2, 0);
        ctx.lineTo(0, this.height / 2);
        ctx.lineTo(-this.width / 2, 0);
      } else if (this.type === 3) { // Hexágono pesado
        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
      } else if (this.type === 4) { // Nave com asas
        ctx.moveTo(0, this.height / 2);
        ctx.lineTo(this.width / 2, 0);
        ctx.lineTo(this.width / 4, -this.height / 2);
        ctx.lineTo(-this.width / 4, -this.height / 2);
        ctx.lineTo(-this.width / 2, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  // CHEFE (BOSS) A CADA 5 NÍVEIS
  class Boss {
    constructor(game, level) {
      this.game = game;
      this.level = level;
      this.width = 130;
      this.height = 90;
      this.x = game.width / 2 - this.width / 2;
      this.y = -this.height;
      this.targetY = 90;

      const diff = DIFFICULTY_FACTORS[SETTINGS.difficulty];
      this.maxHp = Math.round((35 + level * 15) * diff.enemyHp);
      this.hp = this.maxHp;
      this.speedX = 2.5 * diff.enemySpeed;
      this.shootCooldown = 0;
      this.markedForDeletion = false;
      this.patternTimer = 0;
    }

    update() {
      // Descida até a posição de combate
      if (this.y < this.targetY) {
        this.y += 2;
        return;
      }

      this.x += this.speedX;
      if (this.x <= 20 || this.x + this.width >= this.game.width - 20) {
        this.speedX = -this.speedX;
      }

      this.patternTimer++;
      this.shootCooldown--;

      if (this.shootCooldown <= 0) {
        this.attack();
        this.shootCooldown = 45;
      }
    }

    attack() {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height;

      // Padrões alternados
      const pattern = Math.floor(this.patternTimer / 180) % 3;

      if (pattern === 0) {
        // Disparo triplo espalhado
        this.game.enemyProjectiles.push(new Projectile(cx, cy, 0, 5, '#ff0055', true));
        this.game.enemyProjectiles.push(new Projectile(cx - 20, cy, -2, 4.5, '#ff0055', true));
        this.game.enemyProjectiles.push(new Projectile(cx + 20, cy, 2, 4.5, '#ff0055', true));
      } else if (pattern === 1) {
        // Tiro direcionado ao jogador
        const dx = (this.game.player.x + this.game.player.width / 2) - cx;
        const dy = this.game.player.y - cy;
        const angle = Math.atan2(dy, dx);
        const speed = 5.5;
        this.game.enemyProjectiles.push(
          new Projectile(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed, '#ff9900', true)
        );
      } else {
        // Disparo quádruplo frontal
        for (let i = -1.5; i <= 1.5; i += 1) {
          this.game.enemyProjectiles.push(
            new Projectile(cx + i * 25, cy, i * 0.8, 5, '#ff00ff', true)
          );
        }
      }
    }

    takeDamage(amount) {
      this.hp -= amount;
      if (this.hp <= 0) {
        this.markedForDeletion = true;
        this.game.bossDefeated();
      }
      this.game.updateBossHUD();
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

      ctx.fillStyle = '#15051a';
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 20;

      // Corpo principal do Chefe
      ctx.beginPath();
      ctx.moveTo(0, this.height / 2);
      ctx.lineTo(this.width / 2, this.height / 4);
      ctx.lineTo(this.width / 2 - 10, -this.height / 2);
      ctx.lineTo(0, -this.height / 3);
      ctx.lineTo(-this.width / 2 + 10, -this.height / 2);
      ctx.lineTo(-this.width / 2, this.height / 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Núcleo pulsante
      const pulse = 8 + Math.sin(this.patternTimer * 0.1) * 3;
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // POWER-UPS
  class PowerUp {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 14;
      this.speed = 1.8;
      this.markedForDeletion = false;

      // Tipos: 'life', 'double', 'triple', 'shield', 'speed'
      const types = ['life', 'double', 'triple', 'shield', 'speed'];
      this.type = types[Math.floor(Math.random() * types.length)];

      const meta = {
        life: { color: '#ff3366', symbol: '❤️' },
        double: { color: '#00f0ff', symbol: '2X' },
        triple: { color: '#ffff00', symbol: '3X' },
        shield: { color: '#00ff88', symbol: '🛡️' },
        speed: { color: '#ff9900', symbol: '⚡' },
      };

      this.color = meta[this.type].color;
      this.symbol = meta[this.type].symbol;
    }

    update() {
      this.y += this.speed;
      if (this.y > 1000) this.markedForDeletion = true;
    }

    draw(ctx) {
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(10, 16, 38, 0.9)';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.symbol, this.x, this.y + 1);

      ctx.restore();
    }

    apply(player) {
      audio.playPowerUp();
      switch (this.type) {
        case 'life':
          if (player.lives < CONFIG.maxLives) player.lives++;
          player.hp = player.maxHp;
          break;
        case 'double':
          player.powerups.double = 600; // ~10s
          break;
        case 'triple':
          player.powerups.triple = 450; // ~7.5s
          break;
        case 'shield':
          player.powerups.shield = 600;
          break;
        case 'speed':
          player.powerups.speed = 500;
          break;
      }
    }
  }

  // GERENCIADOR CENTRAL DO JOGO
  class Game {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.width = CONFIG.canvasWidth;
      this.height = CONFIG.canvasHeight;

      this.score = 0;
      this.highScore = parseInt(localStorage.getItem('space_highScore') || '0', 10);
      this.maxLevelReached = parseInt(localStorage.getItem('space_maxLevel') || '1', 10);
      this.level = 1;

      this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER', 'VICTORY'
      this.keys = {};

      this.player = new Player(this);
      this.playerProjectiles = [];
      this.enemyProjectiles = [];
      this.enemies = [];
      this.boss = null;
      this.powerups = [];
      this.particles = [];
      this.stars = [];

      this.spawnTimer = 0;
      this.enemiesRemainingInWave = 0;

      // Mobile
      this.joystickVector = { x: 0, y: 0 };
      this.isFiringMobile = false;

      this.initResize();
      this.initStars();
      this.initEvents();
      this.loadSettings();
      this.updateHUD();

      // Loop do jogo
      this.lastTime = 0;
      requestAnimationFrame(this.loop.bind(this));
    }

    initResize() {
      const resize = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
      };
      window.addEventListener('resize', resize);
      resize();
    }

    initStars() {
      this.stars = [];
      const count = 120;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 2 + 0.5,
          speed: Math.random() * 1.5 + 0.3,
          brightness: Math.random(),
        });
      }
    }

    loadSettings() {
      const saved = localStorage.getItem('space_settings');
      if (saved) {
        try {
          Object.assign(SETTINGS, JSON.parse(saved));
        } catch (e) {}
      }

      document.getElementById('setting-sfx').checked = SETTINGS.sfx;
      document.getElementById('setting-music').checked = SETTINGS.music;
      document.getElementById('setting-particles').checked = SETTINGS.particles;
      document.getElementById('setting-difficulty').value = SETTINGS.difficulty;

      document.getElementById('best-score-display').textContent = this.highScore;
      document.getElementById('best-level-display').textContent = this.maxLevelReached;
    }

    saveSettings() {
      SETTINGS.sfx = document.getElementById('setting-sfx').checked;
      SETTINGS.music = document.getElementById('setting-music').checked;
      SETTINGS.particles = document.getElementById('setting-particles').checked;
      SETTINGS.difficulty = document.getElementById('setting-difficulty').value;
      localStorage.setItem('space_settings', JSON.stringify(SETTINGS));

      if (!SETTINGS.music) audio.stopMusic();
      else if (this.state === 'PLAYING') audio.startMusic();
    }

    start() {
      audio.init();
      this.score = 0;
      this.level = 1;
      this.player.reset();
      this.playerProjectiles = [];
      this.enemyProjectiles = [];
      this.enemies = [];
      this.boss = null;
      this.powerups = [];
      this.particles = [];

      this.startWave();
      this.state = 'PLAYING';

      // Alternar telas
      document.querySelectorAll('.modal-screen').forEach(el => el.classList.add('hidden'));
      document.getElementById('hud').classList.remove('hidden');

      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').classList.remove('hidden');
      }

      audio.startMusic();
      this.updateHUD();
    }

    startWave() {
      this.enemiesRemainingInWave = 10 + this.level * 4;
      this.spawnTimer = 0;

      // É nível de Chefe? (a cada 5 níveis)
      if (this.level % 5 === 0) {
        this.boss = new Boss(this, this.level);
        document.getElementById('boss-hud').classList.remove('hidden');
        this.updateBossHUD();
      } else {
        this.boss = null;
        document.getElementById('boss-hud').classList.add('hidden');
      }
    }

    spawnEnemy() {
      if (this.boss) return; // Não gera inimigos comuns durante o chefe
      if (this.enemiesRemainingInWave <= 0 && this.enemies.length === 0) {
        this.advanceLevel();
        return;
      }
      if (this.enemiesRemainingInWave <= 0) return;

      // Seleção probabilística do tipo de inimigo por nível
      let type = 1;
      const rand = Math.random();

      if (this.level >= 2 && rand > 0.65) type = 2; // Rápido
      if (this.level >= 3 && rand > 0.8) type = 3;  // Resistente
      if (this.level >= 4 && rand > 0.88) type = 4; // Atirador

      this.enemies.push(new Enemy(this, type));
      this.enemiesRemainingInWave--;
    }

    advanceLevel() {
      this.level++;
      if (this.level > this.maxLevelReached) {
        this.maxLevelReached = this.level;
        localStorage.setItem('space_maxLevel', this.maxLevelReached);
      }

      if (this.level > CONFIG.maxLevel) {
        this.victory();
        return;
      }

      this.startWave();
      this.updateHUD();
    }

    bossDefeated() {
      this.createExplosion(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ff0055', 60, true);
      this.addScore(2000 * (this.level / 5));
      this.boss = null;
      document.getElementById('boss-hud').classList.add('hidden');

      // Drop de múltiplos powerups
      this.powerups.push(new PowerUp(this.width / 2 - 30, 150));
      this.powerups.push(new PowerUp(this.width / 2 + 30, 150));

      setTimeout(() => {
        this.advanceLevel();
      }, 1500);
    }

    addScore(pts) {
      this.score += pts;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('space_highScore', this.highScore);
      }
      this.updateHUD();
    }

    createExplosion(x, y, color = '#ff007f', count = 18, isBoss = false) {
      audio.playExplosion(isBoss);
      if (!SETTINGS.particles) return;
      for (let i = 0; i < count; i++) {
        this.particles.push(new Particle(x, y, color, isBoss ? 5 : 3, isBoss ? 7 : 4));
      }
    }

    updateHUD() {
      document.getElementById('score-display').textContent = this.score;
      document.getElementById('level-display').textContent = this.level;

      // Corações
      const heartsContainer = document.getElementById('lives-container');
      heartsContainer.innerHTML = '❤️'.repeat(Math.max(0, this.player.lives));

      // Barra HP
      const hpPercent = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
      document.getElementById('hp-bar-fill').style.width = `${hpPercent}%`;

      // Powerups ativos
      const pContainer = document.getElementById('active-powerups');
      pContainer.innerHTML = '';
      for (const [key, val] of Object.entries(this.player.powerups)) {
        if (val > 0) {
          const pill = document.createElement('div');
          pill.className = 'powerup-pill';
          const sec = Math.ceil(val / 60);
          pill.textContent = `${key.toUpperCase()}: ${sec}s`;
          pContainer.appendChild(pill);
        }
      }
    }

    updateBossHUD() {
      if (!this.boss) return;
      const pct = Math.max(0, (this.boss.hp / this.boss.maxHp) * 100);
      document.getElementById('boss-hp-fill').style.width = `${pct}%`;
    }

    pause() {
      if (this.state !== 'PLAYING') return;
      this.state = 'PAUSED';
      audio.stopMusic();
      document.getElementById('pause-screen').classList.remove('hidden');
    }

    resume() {
      if (this.state !== 'PAUSED') return;
      this.state = 'PLAYING';
      audio.startMusic();
      document.getElementById('pause-screen').classList.add('hidden');
    }

    gameOver() {
      this.state = 'GAMEOVER';
      audio.stopMusic();
      this.createExplosion(this.player.x, this.player.y, '#00f0ff', 40);

      const isNewRecord = this.score >= this.highScore && this.score > 0;
      document.getElementById('new-record-badge').classList.toggle('hidden', !isNewRecord);
      document.getElementById('final-score').textContent = this.score;
      document.getElementById('final-level').textContent = this.level;
      document.getElementById('final-record').textContent = this.highScore;

      document.getElementById('hud').classList.add('hidden');
      document.getElementById('mobile-controls').classList.add('hidden');
      document.getElementById('gameover-screen').classList.remove('hidden');
    }

    victory() {
      this.state = 'VICTORY';
      audio.stopMusic();
      audio.playVictory();

      document.getElementById('victory-score').textContent = this.score;
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('mobile-controls').classList.add('hidden');
      document.getElementById('victory-screen').classList.remove('hidden');
    }

    goToMenu() {
      this.state = 'MENU';
      audio.stopMusic();
      document.querySelectorAll('.modal-screen').forEach(el => el.classList.add('hidden'));
      document.getElementById('menu-screen').classList.remove('hidden');
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('mobile-controls').classList.add('hidden');
    }

    // COLISÕES RETANGULARES SIMPLES
    checkCollision(rect1, rect2) {
      return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
      );
    }

    update() {
      // Atualizar estrelas de fundo
      this.stars.forEach(s => {
        s.y += s.speed;
        if (s.y > this.height) {
          s.y = 0;
          s.x = Math.random() * this.width;
        }
      });

      if (this.state !== 'PLAYING') return;

      this.player.update();

      // Gerar inimigos
      this.spawnTimer++;
      const spawnRate = Math.max(35, 90 - this.level * 4) * DIFFICULTY_FACTORS[SETTINGS.difficulty].spawnRate;
      if (this.spawnTimer >= spawnRate) {
        this.spawnEnemy();
        this.spawnTimer = 0;
      }

      // Projéteis do jogador
      this.playerProjectiles.forEach(p => {
        p.update();
        if (p.y < -20) p.markedForDeletion = true;
      });

      // Projéteis inimigos
      this.enemyProjectiles.forEach(p => {
        p.update();
        if (p.y > this.height + 20) p.markedForDeletion = true;

        // Colisão com jogador
        const pBox = { x: p.x - p.radius, y: p.y - p.radius, width: p.radius * 2, height: p.radius * 2 };
        if (this.checkCollision(pBox, this.player)) {
          p.markedForDeletion = true;
          this.player.takeDamage(20);
        }
      });

      // Chefe
      if (this.boss) {
        this.boss.update();

        // Colisão projéteis do jogador com o Chefe
        this.playerProjectiles.forEach(proj => {
          if (proj.markedForDeletion) return;
          const projBox = { x: proj.x - proj.radius, y: proj.y - proj.radius, width: proj.radius * 2, height: proj.radius * 2 };
          if (this.checkCollision(projBox, this.boss)) {
            proj.markedForDeletion = true;
            this.boss.takeDamage(1);
            this.createExplosion(proj.x, proj.y, '#ff0055', 4);
          }
        });
      }

      // Inimigos comuns
      this.enemies.forEach(enemy => {
        enemy.update();

        // Colisão com jogador
        if (this.checkCollision(enemy, this.player)) {
          enemy.markedForDeletion = true;
          this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
          this.player.takeDamage(25);
        }

        // Colisão com projéteis do jogador
        this.playerProjectiles.forEach(proj => {
          if (proj.markedForDeletion || enemy.markedForDeletion) return;
          const projBox = { x: proj.x - proj.radius, y: proj.y - proj.radius, width: proj.radius * 2, height: proj.radius * 2 };

          if (this.checkCollision(projBox, enemy)) {
            proj.markedForDeletion = true;
            enemy.hp--;

            if (enemy.hp <= 0) {
              enemy.markedForDeletion = true;
              this.addScore(enemy.points);
              this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);

              // Chance de drop de power-up (12%)
              if (Math.random() < 0.12) {
                this.powerups.push(new PowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
              }
            } else {
              this.createExplosion(proj.x, proj.y, '#ffffff', 3);
            }
          }
        });
      });

      // Power-ups
      this.powerups.forEach(pw => {
        pw.update();
        const pwBox = { x: pw.x - pw.radius, y: pw.y - pw.radius, width: pw.radius * 2, height: pw.radius * 2 };
        if (this.checkCollision(pwBox, this.player)) {
          pw.markedForDeletion = true;
          pw.apply(this.player);
          this.updateHUD();
        }
      });

      // Partículas
      this.particles.forEach(pt => pt.update());

      // Limpeza de objetos marcados
      this.playerProjectiles = this.playerProjectiles.filter(p => !p.markedForDeletion);
      this.enemyProjectiles = this.enemyProjectiles.filter(p => !p.markedForDeletion);
      this.enemies = this.enemies.filter(e => !e.markedForDeletion);
      this.powerups = this.powerups.filter(p => !p.markedForDeletion);
      this.particles = this.particles.filter(p => p.alpha > 0);

      this.updateHUD();
    }

    draw() {
      // Limpar Canvas
      this.ctx.clearRect(0, 0, this.width, this.height);

      // Fundo estrelado
      this.ctx.fillStyle = '#fff';
      this.stars.forEach(s => {
        this.ctx.globalAlpha = 0.3 + s.brightness * 0.7;
        this.ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      this.ctx.globalAlpha = 1;

      // Partículas
      this.particles.forEach(pt => pt.draw(this.ctx));

      // Power-ups
      this.powerups.forEach(pw => pw.draw(this.ctx));

      // Projéteis
      this.playerProjectiles.forEach(p => p.draw(this.ctx));
      this.enemyProjectiles.forEach(p => p.draw(this.ctx));

      // Inimigos e Chefe
      this.enemies.forEach(e => e.draw(this.ctx));
      if (this.boss) this.boss.draw(this.ctx);

      // Jogador
      if (this.state === 'PLAYING' || this.state === 'PAUSED') {
        this.player.draw(this.ctx);
      }
    }

    loop() {
      this.update();
      this.draw();
      requestAnimationFrame(this.loop.bind(this));
    }

    // EVENT LISTENERS (TECLADO, TOUCH, MENUS)
    initEvents() {
      // Teclado
      window.addEventListener('keydown', e => {
        this.keys[e.code] = true;
        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.state === 'PLAYING') this.pause();
          else if (this.state === 'PAUSED') this.resume();
        }
      });

      window.addEventListener('keyup', e => {
        this.keys[e.code] = false;
      });

      // Botões UI
      document.getElementById('btn-play').addEventListener('click', () => this.start());
      document.getElementById('btn-pause').addEventListener('click', () => this.pause());
      document.getElementById('btn-resume').addEventListener('click', () => this.resume());
      document.getElementById('btn-restart-pause').addEventListener('click', () => this.start());
      document.getElementById('btn-menu-pause').addEventListener('click', () => this.goToMenu());

      document.getElementById('btn-retry').addEventListener('click', () => this.start());
      document.getElementById('btn-menu-over').addEventListener('click', () => this.goToMenu());

      document.getElementById('btn-victory-again').addEventListener('click', () => this.start());
      document.getElementById('btn-victory-menu').addEventListener('click', () => this.goToMenu());

      // Telas Secundárias
      document.getElementById('btn-how').addEventListener('click', () => {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('how-screen').classList.remove('hidden');
      });
      document.getElementById('btn-how-back').addEventListener('click', () => {
        document.getElementById('how-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
      });

      document.getElementById('btn-scores').addEventListener('click', () => {
        document.getElementById('best-score-display').textContent = this.highScore;
        document.getElementById('best-level-display').textContent = this.maxLevelReached;
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('scores-screen').classList.remove('hidden');
      });
      document.getElementById('btn-scores-back').addEventListener('click', () => {
        document.getElementById('scores-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
      });

      document.getElementById('btn-settings').addEventListener('click', () => {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('settings-screen').classList.remove('hidden');
      });
      document.getElementById('btn-settings-back').addEventListener('click', () => {
        this.saveSettings();
        document.getElementById('settings-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
      });

      // Controles Mobile / Touch Virtual Joystick
      const joystickZone = document.getElementById('joystick-zone');
      const joystickStick = document.getElementById('joystick-stick');
      let touchId = null;
      let center = { x: 0, y: 0 };
      const maxDist = 40;

      joystickZone.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        const rect = joystickZone.getBoundingClientRect();
        center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });

      joystickZone.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === touchId) {
            const dx = touch.clientX - center.x;
            const dy = touch.clientY - center.y;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const clampedDist = Math.min(dist, maxDist);

            const sx = Math.cos(angle) * clampedDist;
            const sy = Math.sin(angle) * clampedDist;

            joystickStick.style.transform = `translate(${sx}px, ${sy}px)`;
            this.joystickVector = {
              x: sx / maxDist,
              y: sy / maxDist,
            };
          }
        }
      });

      const resetJoystick = e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touchId = null;
            joystickStick.style.transform = `translate(0px, 0px)`;
            this.joystickVector = { x: 0, y: 0 };
          }
        }
      };

      joystickZone.addEventListener('touchend', resetJoystick);
      joystickZone.addEventListener('touchcancel', resetJoystick);

      // Botão Mobile de Tiro
      const fireBtn = document.getElementById('btn-mobile-fire');
      fireBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        this.isFiringMobile = true;
      });
      fireBtn.addEventListener('touchend', e => {
        e.preventDefault();
        this.isFiringMobile = false;
      });
    }
  }

  // INICIALIZAÇÃO
  window.addEventListener('DOMContentLoaded', () => {
    new Game();
  });
})();
