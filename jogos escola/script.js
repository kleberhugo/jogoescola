/* =========================================================
   SPACE DEFENDER — HTML5 Canvas + JavaScript puro
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- utilidades ---------------- */
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var randInt = function (a, b) { return Math.floor(rand(a, b + 1)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2;

  /* ---------------- persistência ---------------- */
  var KEY_S = "spacedefender.settings.v1";
  var KEY_H = "spacedefender.scores.v1";

  var defaults = { music: true, sfx: true, volume: 60, difficulty: "normal", particles: true, touch: "auto" };
  var settings = load(KEY_S, defaults);
  var scores = load(KEY_H, []);

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      var val = JSON.parse(raw);
      if (Array.isArray(fallback)) return Array.isArray(val) ? val : [];
      var out = JSON.parse(JSON.stringify(fallback));
      for (var k in fallback) if (Object.prototype.hasOwnProperty.call(val, k)) out[k] = val[k];
      return out;
    } catch (e) { return JSON.parse(JSON.stringify(fallback)); }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function bestScore() { return scores.length ? scores[0].score : 0; }

  /* ---------------- áudio (Web Audio API) ---------------- */
  var Audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null, musicTimer: null, step: 0, started: false,
    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.applySettings();
    },
    resume: function () { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
    applySettings: function () {
      if (!this.ctx) return;
      var v = clamp(settings.volume, 0, 100) / 100;
      this.master.gain.value = v;
      this.musicGain.gain.value = settings.music ? 0.22 : 0;
      this.sfxGain.gain.value = settings.sfx ? 0.55 : 0;
    },
    beep: function (freq, dur, type, vol, slideTo) {
      if (!this.ctx || !settings.sfx) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || "square"; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
    },
    noise: function (dur, vol, freq) {
      if (!this.ctx || !settings.sfx) return;
      var t = this.ctx.currentTime, len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = this.ctx.createBufferSource(); s.buffer = buf;
      var f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq || 1200;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.4;
      s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t);
    },
    shoot: function () { this.beep(880, 0.09, "square", 0.16, 320); },
    enemyShoot: function () { this.beep(300, 0.12, "sawtooth", 0.12, 140); },
    hit: function () { this.beep(220, 0.07, "triangle", 0.18, 120); },
    explode: function () { this.noise(0.4, 0.5, 900); },
    bigExplode: function () { this.noise(0.9, 0.7, 500); this.beep(90, 0.6, "sawtooth", 0.25, 40); },
    power: function () { this.beep(520, 0.1, "sine", 0.25); var s = this; setTimeout(function () { s.beep(780, 0.14, "sine", 0.25); }, 90); },
    levelUp: function () { var s = this, n = [523, 659, 784, 1046]; n.forEach(function (f, i) { setTimeout(function () { s.beep(f, 0.16, "triangle", 0.22); }, i * 110); }); },
    gameOver: function () { var s = this, n = [440, 350, 260, 160]; n.forEach(function (f, i) { setTimeout(function () { s.beep(f, 0.35, "sawtooth", 0.24); }, i * 190); }); },
    win: function () { var s = this, n = [523, 659, 784, 1046, 1318]; n.forEach(function (f, i) { setTimeout(function () { s.beep(f, 0.25, "sine", 0.26); }, i * 150); }); },
    startMusic: function () {
      var self = this;
      this.stopMusic();
      if (!this.ctx || !settings.music) return;
      var bass = [55, 55, 73.4, 65.4, 61.7, 61.7, 82.4, 73.4];
      var lead = [329.6, 392, 493.9, 392, 440, 523.3, 440, 392];
      this.step = 0;
      this.musicTimer = setInterval(function () {
        if (!self.ctx || !settings.music) return;
        var t = self.ctx.currentTime, i = self.step % 8;
        tone(bass[i], 0.34, "triangle", 0.5);
        if (self.step % 2 === 0) tone(lead[i], 0.22, "square", 0.16);
        if (self.step % 4 === 2) {
          var len = Math.floor(self.ctx.sampleRate * 0.05);
          var buf = self.ctx.createBuffer(1, len, self.ctx.sampleRate), d = buf.getChannelData(0);
          for (var k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
          var src = self.ctx.createBufferSource(); src.buffer = buf;
          var hp = self.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
          var hg = self.ctx.createGain(); hg.gain.value = 0.25;
          src.connect(hp); hp.connect(hg); hg.connect(self.musicGain); src.start(t);
        }
        self.step++;
        function tone(f, dur, type, vol) {
          var o = self.ctx.createOscillator(), g = self.ctx.createGain();
          o.type = type; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(self.musicGain); o.start(t); o.stop(t + dur + 0.05);
        }
      }, 250);
    },
    stopMusic: function () { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  };

  /* ---------------- canvas ---------------- */
  var canvas = $("game"), ctx = canvas.getContext("2d");
  var W = 900, H = 600, DPR = 1;

  function resize() {
    var r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(r.width));
    H = Math.max(360, Math.round(r.height));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    if (game.player) {
      game.player.x = clamp(game.player.x, 24, W - 24);
      game.player.y = clamp(game.player.y, 24, H - 24);
    }
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });

  /* ---------------- estrelas de fundo ---------------- */
  var stars = [];
  function buildStars() {
    stars = [];
    var n = Math.round((W * H) / 6500);
    for (var i = 0; i < n; i++) {
      stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.25, 1), s: rand(0.5, 1.9) });
    }
  }

  /* ---------------- estado ---------------- */
  var DIFF = {
    easy:   { hp: 1.0, spd: 0.85, rate: 0.75, dmg: 0.7, score: 0.8, lives: 4 },
    normal: { hp: 1.0, spd: 1.0,  rate: 1.0,  dmg: 1.0, score: 1.0, lives: 3 },
    hard:   { hp: 1.35, spd: 1.18, rate: 1.35, dmg: 1.35, score: 1.4, lives: 2 }
  };
  var MAX_LEVEL = 15, WAVES_PER_LEVEL = 3;

  var game = {
    state: "menu",
    player: null, bullets: [], eBullets: [], enemies: [], powerups: [], particles: [], floats: [],
    score: 0, level: 1, wave: 1, kills: 0, shake: 0, spawnQueue: [], spawnTimer: 0,
    waveBanner: 0, waveText: "", boss: null, time: 0, diff: DIFF.normal, over: false, flash: 0
  };

  /* ---------------- entrada ---------------- */
  var keys = {};
  var touchMove = { active: false, dx: 0, dy: 0, id: null };
  var firing = false;

  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(k) >= 0) e.preventDefault();
    keys[k] = true;
    if (k === "p" || k === "escape") { if (game.state === "playing") pauseGame(); else if (game.state === "paused") resumeGame(); }
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", function () { keys = {}; if (game.state === "playing") pauseGame(); });

  /* joystick virtual */
  var stick = $("stick"), knob = stick.firstElementChild, fireBtn = $("fire-btn");
  function stickStart(e) {
    e.preventDefault(); var t = e.changedTouches ? e.changedTouches[0] : e;
    touchMove.active = true; touchMove.id = t.identifier != null ? t.identifier : "m"; stickMove(e);
  }
  function stickMove(e) {
    if (!touchMove.active) return;
    e.preventDefault();
    var list = e.changedTouches ? e.changedTouches : [e], t = null;
    for (var i = 0; i < list.length; i++) {
      var id = list[i].identifier != null ? list[i].identifier : "m";
      if (id === touchMove.id) t = list[i];
    }
    if (!t) return;
    var r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = t.clientX - cx, dy = t.clientY - cy, max = r.width / 2, d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    touchMove.dx = dx / max; touchMove.dy = dy / max;
    knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
  }
  function stickEnd(e) {
    if (e) e.preventDefault();
    touchMove.active = false; touchMove.dx = 0; touchMove.dy = 0; touchMove.id = null;
    knob.style.transform = "translate(-50%,-50%)";
  }
  stick.addEventListener("touchstart", stickStart, { passive: false });
  stick.addEventListener("touchmove", stickMove, { passive: false });
  stick.addEventListener("touchend", stickEnd, { passive: false });
  stick.addEventListener("touchcancel", stickEnd, { passive: false });
  stick.addEventListener("mousedown", stickStart);
  window.addEventListener("mousemove", function (e) { if (touchMove.active && touchMove.id === "m") stickMove(e); });
  window.addEventListener("mouseup", function () { if (touchMove.id === "m") stickEnd(); });

  function fireOn(e) { if (e) e.preventDefault(); firing = true; Audio.resume(); }
  function fireOff(e) { if (e) e.preventDefault(); firing = false; }
  fireBtn.addEventListener("touchstart", fireOn, { passive: false });
  fireBtn.addEventListener("touchend", fireOff, { passive: false });
  fireBtn.addEventListener("touchcancel", fireOff, { passive: false });
  fireBtn.addEventListener("mousedown", fireOn);
  window.addEventListener("mouseup", fireOff);

  function isTouchDevice() { return ("ontouchstart" in window) || navigator.maxTouchPoints > 0; }
  function updateTouchVisibility() {
    var show = settings.touch === "on" || (settings.touch === "auto" && isTouchDevice());
    $("touch").classList.toggle("hidden", !(show && (game.state === "playing" || game.state === "paused")));
  }

  /* ---------------- entidades ---------------- */
  function makePlayer() {
    return {
      x: W / 2, y: H - 90, r: 16, speed: 330, hp: 100, maxHp: 100,
      lives: game.diff.lives, cooldown: 0, invuln: 1.4, shield: 0, spread: 0, rapid: 0, speedUp: 0,
      bombs: 1, thrust: 0
    };
  }

  var TYPES = {
    basic:  { r: 15, hp: 20, speed: 55,  score: 100, color: "#7dd3fc", fire: 0 },
    fast:   { r: 12, hp: 14, speed: 135, score: 150, color: "#f472b6", fire: 0 },
    tank:   { r: 22, hp: 70, speed: 38,  score: 250, color: "#fbbf24", fire: 0 },
    shooter:{ r: 16, hp: 30, speed: 48,  score: 200, color: "#a78bfa", fire: 2.1 }
  };

  function spawnEnemy(type, x, y) {
    var t = TYPES[type], d = game.diff, lvl = game.level;
    var e = {
      type: type, x: x, y: y, r: t.r,
      hp: Math.round(t.hp * d.hp * (1 + (lvl - 1) * 0.16)),
      maxHp: 0, speed: t.speed * d.spd * (1 + (lvl - 1) * 0.05),
      score: Math.round(t.score * d.score), color: t.color,
      fireCd: t.fire ? rand(0.6, t.fire) : 0, fireRate: t.fire / d.rate,
      phase: rand(0, TAU), hitFlash: 0, boss: false
    };
    e.maxHp = e.hp;
    game.enemies.push(e);
  }

  function spawnBoss(level) {
    var d = game.diff, tier = Math.floor(level / 5);
    var b = {
      type: "boss", boss: true, x: W / 2, y: -120, r: 54,
      hp: Math.round((900 + tier * 700) * d.hp), maxHp: 1, speed: 60 * d.spd,
      score: Math.round(3000 * tier * d.score), color: "#fb7185",
      pattern: 0, patternT: 0, fireCd: 1.2, entering: true, dir: 1, hitFlash: 0, tier: tier
    };
    b.maxHp = b.hp;
    game.enemies.push(b);
    game.boss = b;
    $("boss-bar-wrap").classList.remove("hidden");
    toast("CHEFE NÍVEL " + level);
  }

  function bullet(x, y, vx, vy, dmg, color, r) {
    game.bullets.push({ x: x, y: y, vx: vx, vy: vy, dmg: dmg, color: color || "#67e8f9", r: r || 3.5 });
  }
  function eBullet(x, y, vx, vy, dmg, color, r) {
    game.eBullets.push({ x: x, y: y, vx: vx, vy: vy, dmg: dmg, color: color || "#f9a8d4", r: r || 4.5 });
  }

  var POWER = ["spread", "shield", "speed", "heal", "bomb"];
  function spawnPower(x, y, forced) {
    var kind = forced || POWER[randInt(0, POWER.length - 1)];
    game.powerups.push({ x: x, y: y, vy: 70, r: 13, kind: kind, t: 0 });
  }

  function particles(x, y, n, color, spd, life) {
    if (!settings.particles) n = Math.min(n, 4);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), s = rand(spd * 0.25, spd);
      game.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(life * 0.5, life), max: life, color: color, r: rand(1.2, 3.4)
      });
    }
  }
  function floatText(x, y, text, color) {
    game.floats.push({ x: x, y: y, text: text, color: color || "#fff", life: 0.9 });
  }
  function toast(msg) {
    var el = document.createElement("div");
    el.className = "toast-item"; el.textContent = msg;
    $("toast").appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }

  /* ---------------- ondas ---------------- */
  function buildWave(level, wave) {
    var list = [], count = 5 + level * 2 + wave * 2;
    count = Math.min(count, 34);
    for (var i = 0; i < count; i++) {
      var roll = Math.random(), type = "basic";
      if (level >= 2 && roll > 0.72) type = "fast";
      if (level >= 3 && roll > 0.86) type = "shooter";
      if (level >= 4 && roll > 0.94) type = "tank";
      list.push(type);
    }
    return list;
  }

  function startWave() {
    game.spawnQueue = buildWave(game.level, game.wave);
    game.spawnTimer = 0.5;
    game.waveText = "NÍVEL " + game.level + " — ONDA " + game.wave + "/" + WAVES_PER_LEVEL;
    game.waveBanner = 2.2;
    updateHUD();
  }

  function startBossFight() {
    game.spawnQueue = [];
    game.waveText = "ALERTA: CHEFE!";
    game.waveBanner = 2.4;
    spawnBoss(game.level);
    updateHUD();
  }

  function nextWave() {
    if (game.wave < WAVES_PER_LEVEL) { game.wave++; startWave(); return; }
    if (game.level >= MAX_LEVEL) { winGame(); return; }
    game.level++; game.wave = 1;
    game.score += 500 * game.level;
    Audio.levelUp();
    if (game.level % 5 === 0) startBossFight(); else startWave();
    if (game.player) {
      game.player.hp = clamp(game.player.hp + 20, 0, game.player.maxHp);
    }
  }

  /* ---------------- fluxo ---------------- */
  function showScreen(id) {
    ["menu", "how", "scores", "settings", "pause", "over"].forEach(function (s) {
      $(s).classList.toggle("hidden", s !== id);
    });
    if (!id) ["menu", "how", "scores", "settings", "pause", "over"].forEach(function (s) { $(s).classList.add("hidden"); });
  }

  function startGame() {
    Audio.init(); Audio.resume();
    game.diff = DIFF[settings.difficulty] || DIFF.normal;
    game.player = makePlayer();
    game.bullets = []; game.eBullets = []; game.enemies = []; game.powerups = [];
    game.particles = []; game.floats = []; game.spawnQueue = [];
    game.score = 0; game.level = 1; game.wave = 1; game.kills = 0; game.boss = null;
    game.shake = 0; game.flash = 0; game.over = false; game.state = "playing";
    $("boss-bar-wrap").classList.add("hidden");
    $("hud").classList.remove("hidden");
    showScreen(null);
    updateTouchVisibility();
    Audio.startMusic();
    startWave();
  }

  function pauseGame() {
    if (game.state !== "playing") return;
    game.state = "paused"; showScreen("pause"); Audio.stopMusic();
  }
  function resumeGame() {
    if (game.state !== "paused") return;
    game.state = "playing"; showScreen(null); Audio.resume(); Audio.startMusic();
  }
  function toMenu() {
    game.state = "menu"; Audio.stopMusic();
    $("hud").classList.add("hidden");
    $("boss-bar-wrap").classList.add("hidden");
    showScreen("menu"); updateTouchVisibility();
  }

  function endGame(won) {
    game.state = won ? "won" : "over";
    Audio.stopMusic();
    if (won) Audio.win(); else Audio.gameOver();
    var isNew = registerScore(game.score);
    $("over-title").textContent = won ? "VITÓRIA!" : "FIM DE JOGO";
    $("over-sub").textContent = won
      ? "Você defendeu a órbita e derrotou todas as frotas inimigas."
      : "Sua nave foi destruída. A frota inimiga avança...";
    $("over-score").textContent = game.score;
    $("over-level").textContent = game.level;
    $("over-kills").textContent = game.kills;
    $("over-new").classList.toggle("hidden", !isNew);
    $("hud").classList.add("hidden");
    showScreen("over");
    updateTouchVisibility();
  }
  function winGame() { endGame(true); }

  function registerScore(score) {
    if (score <= 0) return false;
    var prevBest = bestScore();
    scores.push({ score: score, level: game.level, date: new Date().toISOString().slice(0, 10), diff: settings.difficulty });
    scores.sort(function (a, b) { return b.score - a.score; });
    scores = scores.slice(0, 10);
    save(KEY_H, scores);
    renderScores();
    return score > prevBest;
  }

  function renderScores() {
    var ol = $("score-list");
    ol.innerHTML = "";
    if (!scores.length) {
      var li = document.createElement("li");
      li.textContent = "Nenhum recorde ainda — jogue uma partida!";
      ol.appendChild(li); return;
    }
    scores.forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = s.score + " pts · nível " + s.level + " · " + s.diff + " · " + s.date;
      ol.appendChild(li);
    });
  }

  /* ---------------- atualização ---------------- */
  function update(dt) {
    game.time += dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2.4);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 2.5);
    if (game.waveBanner > 0) game.waveBanner -= dt;

    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      st.y += (24 + st.z * 130) * dt;
      if (st.y > H) { st.y = -2; st.x = rand(0, W); }
    }

    if (game.state !== "playing") return;

    updatePlayer(dt);
    updateSpawns(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePowerups(dt);
    updateParticles(dt);
    collisions();

    if (!game.spawnQueue.length && !game.enemies.length && !game.over) nextWave();
    updateHUD();
  }

  function updatePlayer(dt) {
    var p = game.player;
    if (!p) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.shield = Math.max(0, p.shield - dt);
    p.spread = Math.max(0, p.spread - dt);
    p.rapid = Math.max(0, p.rapid - dt);
    p.speedUp = Math.max(0, p.speedUp - dt);
    p.cooldown -= dt;

    var dx = 0, dy = 0;
    if (keys["arrowleft"] || keys["a"]) dx -= 1;
    if (keys["arrowright"] || keys["d"]) dx += 1;
    if (keys["arrowup"] || keys["w"]) dy -= 1;
    if (keys["arrowdown"] || keys["s"]) dy += 1;
    if (touchMove.active) { dx += touchMove.dx; dy += touchMove.dy; }
    var len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    var spd = p.speed * (p.speedUp > 0 ? 1.55 : 1);
    p.x = clamp(p.x + dx * spd * dt, p.r, W - p.r);
    p.y = clamp(p.y + dy * spd * dt, p.r + 60, H - p.r - 6);
    p.thrust = Math.hypot(dx, dy);

    if ((keys[" "] || keys["spacebar"] || firing) && p.cooldown <= 0) shoot(p);
    if (keys["b"] && p.bombs > 0) useBomb();
  }

  function shoot(p) {
    var rate = p.rapid > 0 ? 0.09 : 0.17;
    p.cooldown = rate;
    var speed = -640, dmg = 10;
    if (p.spread > 0) {
      bullet(p.x, p.y - 18, 0, speed, dmg);
      bullet(p.x - 10, p.y - 12, -150, speed * 0.96, dmg);
      bullet(p.x + 10, p.y - 12, 150, speed * 0.96, dmg);
    } else {
      bullet(p.x - 7, p.y - 14, 0, speed, dmg);
      bullet(p.x + 7, p.y - 14, 0, speed, dmg);
    }
    Audio.shoot();
    particles(p.x, p.y + 6, 2, "#67e8f9", 60, 0.25);
  }

  function useBomb() {
    var p = game.player;
    if (!p || p.bombs <= 0) return;
    p.bombs--;
    keys["b"] = false;
    game.shake = 1; game.flash = 1;
    Audio.bigExplode();
    game.eBullets = [];
    for (var i = game.enemies.length - 1; i >= 0; i--) {
      var e = game.enemies[i];
      damageEnemy(e, e.boss ? 260 : 999, i);
    }
    particles(p.x, p.y, 60, "#fbbf24", 420, 0.9);
    toast("BOMBA!");
  }

  function updateSpawns(dt) {
    if (!game.spawnQueue.length) return;
    game.spawnTimer -= dt;
    if (game.spawnTimer > 0) return;
    var burst = Math.min(game.spawnQueue.length, randInt(1, 3));
    for (var i = 0; i < burst; i++) {
      var type = game.spawnQueue.shift();
      spawnEnemy(type, rand(40, W - 40), rand(-160, -40));
    }
    game.spawnTimer = Math.max(0.35, 1.25 - game.level * 0.05) / (game.diff.rate);
  }

  function updateEnemies(dt) {
    var p = game.player;
    for (var i = game.enemies.length - 1; i >= 0; i--) {
      var e = game.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4);

      if (e.boss) { updateBoss(e, dt); continue; }

      if (e.type === "fast") {
        e.phase += dt * 4;
        e.x += Math.cos(e.phase) * 130 * dt;
        e.y += e.speed * dt;
      } else if (e.type === "shooter") {
        e.phase += dt * 1.4;
        e.x += Math.sin(e.phase) * 60 * dt;
        e.y += e.speed * dt * (e.y > H * 0.35 ? 0.25 : 1);
        e.fireCd -= dt;
        if (e.fireCd <= 0 && p) {
          e.fireCd = e.fireRate;
          var a = Math.atan2(p.y - e.y, p.x - e.x);
          eBullet(e.x, e.y + 12, Math.cos(a) * 240, Math.sin(a) * 240, 12 * game.diff.dmg, "#c4b5fd");
          Audio.enemyShoot();
        }
      } else if (e.type === "tank") {
        e.y += e.speed * dt;
        e.x += Math.sin(game.time * 0.8 + e.phase) * 25 * dt;
      } else {
        e.y += e.speed * dt;
        e.x += Math.sin(game.time * 1.6 + e.phase) * 40 * dt;
      }
      e.x = clamp(e.x, e.r, W - e.r);

      if (e.y > H + 60) {
        game.enemies.splice(i, 1);
        if (p) { hurtPlayer(6 * game.diff.dmg, true); }
      }
    }
  }

  function updateBoss(b, dt) {
    var p = game.player;
    if (b.entering) {
      b.y += 70 * dt;
      if (b.y >= 130) { b.y = 130; b.entering = false; }
      return;
    }
    b.x += b.dir * b.speed * dt;
    if (b.x < b.r + 10) { b.x = b.r + 10; b.dir = 1; }
    if (b.x > W - b.r - 10) { b.x = W - b.r - 10; b.dir = -1; }
    b.y = 130 + Math.sin(game.time * 1.1) * 22;

    b.patternT += dt;
    if (b.patternT > 6) { b.patternT = 0; b.pattern = (b.pattern + 1) % 3; }

    b.fireCd -= dt;
    if (b.fireCd > 0) return;
    var dmg = 14 * game.diff.dmg;
    if (b.pattern === 0) {
      b.fireCd = 1.15 / game.diff.rate;
      for (var i = -3; i <= 3; i++) {
        var a = Math.PI / 2 + i * 0.20;
        eBullet(b.x, b.y + 30, Math.cos(a) * 240, Math.sin(a) * 240, dmg, "#fda4af", 6);
      }
    } else if (b.pattern === 1) {
      b.fireCd = 0.13 / game.diff.rate;
      var ang = game.time * 3.2;
      for (var k = 0; k < 3; k++) {
        var aa = ang + (k * TAU) / 3;
        eBullet(b.x, b.y, Math.cos(aa) * 200, Math.sin(aa) * 200, dmg * 0.7, "#f472b6", 5);
      }
    } else {
      b.fireCd = 0.55 / game.diff.rate;
      if (p) {
        var t = Math.atan2(p.y - b.y, p.x - b.x);
        for (var j = -1; j <= 1; j++) {
          eBullet(b.x, b.y + 20, Math.cos(t + j * 0.12) * 320, Math.sin(t + j * 0.12) * 320, dmg, "#fecaca", 5);
        }
      }
    }
    Audio.enemyShoot();
  }

  function updateBullets(dt) {
    var i, b;
    for (i = game.bullets.length - 1; i >= 0; i--) {
      b = game.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) game.bullets.splice(i, 1);
    }
    for (i = game.eBullets.length - 1; i >= 0; i--) {
      b = game.eBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) game.eBullets.splice(i, 1);
    }
  }

  function updatePowerups(dt) {
    for (var i = game.powerups.length - 1; i >= 0; i--) {
      var pu = game.powerups[i];
      pu.t += dt; pu.y += pu.vy * dt; pu.x += Math.sin(pu.t * 2) * 22 * dt;
      if (pu.y > H + 30) game.powerups.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    var i;
    for (i = game.particles.length - 1; i >= 0; i--) {
      var pa = game.particles[i];
      pa.life -= dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt;
      pa.vx *= 0.96; pa.vy *= 0.96;
      if (pa.life <= 0) game.particles.splice(i, 1);
    }
    for (i = game.floats.length - 1; i >= 0; i--) {
      var f = game.floats[i]; f.life -= dt; f.y -= 40 * dt;
      if (f.life <= 0) game.floats.splice(i, 1);
    }
  }

  function hit(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r;
    return dx * dx + dy * dy <= r * r;
  }

  function damageEnemy(e, dmg, index) {
    e.hp -= dmg;
    e.hitFlash = 1;
    if (e.hp > 0) { Audio.hit(); particles(e.x, e.y, 3, e.color, 90, 0.3); return false; }
    var idx = index != null ? index : game.enemies.indexOf(e);
    if (idx >= 0) game.enemies.splice(idx, 1);
    game.kills++;
    game.score += e.score;
    floatText(e.x, e.y, "+" + e.score, e.color);
    if (e.boss) {
      Audio.bigExplode();
      particles(e.x, e.y, 90, "#fb7185", 380, 1.1);
      particles(e.x, e.y, 50, "#fbbf24", 260, 0.9);
      game.shake = 1.2; game.flash = 0.8;
      game.boss = null;
      $("boss-bar-wrap").classList.add("hidden");
      spawnPower(e.x - 30, e.y, "heal");
      spawnPower(e.x + 30, e.y, "bomb");
      spawnPower(e.x, e.y + 20, "shield");
    } else {
      Audio.explode();
      particles(e.x, e.y, e.type === "tank" ? 30 : 18, e.color, 200, 0.6);
      game.shake = Math.max(game.shake, 0.25);
      if (Math.random() < 0.11) spawnPower(e.x, e.y);
    }
    return true;
  }

  function hurtPlayer(dmg, silentFx) {
    var p = game.player;
    if (!p || game.over) return;
    if (p.invuln > 0) return;
    if (p.shield > 0) {
      p.shield = 0;
      particles(p.x, p.y, 26, "#38bdf8", 220, 0.6);
      Audio.hit(); toast("ESCUDO PERDIDO");
      p.invuln = 0.8;
      return;
    }
    p.hp -= dmg;
    game.shake = Math.max(game.shake, 0.5);
    if (!silentFx) particles(p.x, p.y, 12, "#fb7185", 160, 0.5);
    Audio.hit();
    if (p.hp <= 0) {
      p.lives--;
      Audio.explode();
      particles(p.x, p.y, 60, "#f472b6", 300, 0.9);
      game.shake = 1;
      if (p.lives <= 0) { game.over = true; endGame(false); return; }
      p.hp = p.maxHp; p.invuln = 2.4; p.x = W / 2; p.y = H - 90;
      p.spread = 0; p.rapid = 0; p.speedUp = 0; p.shield = 0;
      game.eBullets = [];
      toast("VIDA PERDIDA — " + p.lives + " restante(s)");
    }
  }

  function applyPower(kind) {
    var p = game.player;
    Audio.power();
    if (kind === "spread") { p.spread = 12; p.rapid = 8; toast("TIRO TRIPLO"); }
    else if (kind === "shield") { p.shield = 14; toast("ESCUDO ATIVO"); }
    else if (kind === "speed") { p.speedUp = 12; toast("PROPULSOR"); }
    else if (kind === "heal") { p.hp = clamp(p.hp + 45, 0, p.maxHp); toast("CASCO REPARADO"); }
    else if (kind === "bomb") { p.bombs++; toast("BOMBA ADQUIRIDA (B)"); }
    game.score += 50;
  }

  function collisions() {
    var p = game.player, i, j;
    if (!p) return;

    for (i = game.bullets.length - 1; i >= 0; i--) {
      var b = game.bullets[i];
      for (j = game.enemies.length - 1; j >= 0; j--) {
        var e = game.enemies[j];
        if (!hit(b, e)) continue;
        game.bullets.splice(i, 1);
        particles(b.x, b.y, 4, "#e0f2fe", 110, 0.25);
        damageEnemy(e, b.dmg, j);
        break;
      }
    }
    for (i = game.eBullets.length - 1; i >= 0; i--) {
      var eb = game.eBullets[i];
      if (hit(eb, { x: p.x, y: p.y, r: p.r * 0.8 })) {
        game.eBullets.splice(i, 1);
        hurtPlayer(eb.dmg);
      }
    }
    for (i = game.enemies.length - 1; i >= 0; i--) {
      var en = game.enemies[i];
      if (!hit(en, { x: p.x, y: p.y, r: p.r * 0.85 })) continue;
      if (en.boss) { hurtPlayer(28 * game.diff.dmg); }
      else { hurtPlayer(20 * game.diff.dmg); damageEnemy(en, 40, i); }
    }
    for (i = game.powerups.length - 1; i >= 0; i--) {
      var pu = game.powerups[i];
      if (hit(pu, { x: p.x, y: p.y, r: p.r + 6 })) { game.powerups.splice(i, 1); applyPower(pu.kind); }
    }
  }

  /* ---------------- HUD ---------------- */
  function updateHUD() {
    var p = game.player;
    $("hud-score").textContent = game.score;
    $("hud-level").textContent = game.level;
    $("hud-wave").textContent = (game.boss ? "CHEFE" : game.wave + "/" + WAVES_PER_LEVEL);
    $("hud-best").textContent = Math.max(bestScore(), game.score);
    if (!p) return;
    $("bar-hp").style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + "%";

    var lv = $("hud-lives");
    if (lv.childElementCount !== p.lives) {
      lv.innerHTML = "";
      for (var i = 0; i < p.lives; i++) { var d = document.createElement("i"); d.className = "life"; lv.appendChild(d); }
    }
    var pw = [];
    if (p.spread > 0) pw.push("TRIPLO " + Math.ceil(p.spread));
    if (p.shield > 0) pw.push("ESCUDO " + Math.ceil(p.shield));
    if (p.speedUp > 0) pw.push("VELOZ " + Math.ceil(p.speedUp));
    if (p.bombs > 0) pw.push("BOMBA x" + p.bombs);
    var box = $("hud-powers");
    var html = pw.map(function (t) { return '<span class="pw">' + t + "</span>"; }).join("");
    if (box.innerHTML !== html) box.innerHTML = html;

    if (game.boss) $("bar-boss").style.width = clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100) + "%";
  }

  /* ---------------- desenho ---------------- */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0930"); g.addColorStop(0.55, "#06041a"); g.addColorStop(1, "#03020b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.globalAlpha = 0.16;
    var nb = ctx.createRadialGradient(W * 0.25, H * 0.25, 10, W * 0.25, H * 0.25, W * 0.5);
    nb.addColorStop(0, "#7c3aed"); nb.addColorStop(1, "transparent");
    ctx.fillStyle = nb; ctx.fillRect(0, 0, W, H);
    var nb2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 10, W * 0.8, H * 0.7, W * 0.45);
    nb2.addColorStop(0, "#0e7490"); nb2.addColorStop(1, "transparent");
    ctx.fillStyle = nb2; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = 0.25 + s.z * 0.75;
      ctx.fillStyle = s.z > 0.75 ? "#a5f3fc" : "#dbeafe";
      ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.z));
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (game.shake > 0) {
      var m = game.shake * 9;
      ctx.translate(rand(-m, m), rand(-m, m));
    }

    drawPowerups();
    drawEnemies();
    drawBullets();
    if (game.player && game.state !== "menu") drawPlayer(game.player);
    drawParticles();

    ctx.restore();

    if (game.waveBanner > 0 && game.state === "playing") {
      var a = clamp(game.waveBanner, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = "bold " + Math.round(Math.min(W * 0.055, 34)) + "px Trebuchet MS, sans-serif";
      ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 24;
      ctx.fillStyle = "#e0fbff";
      ctx.fillText(game.waveText, W / 2, H * 0.42);
      ctx.restore();
    }

    if (game.flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + (game.flash * 0.5) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function neon(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }

  function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;

    var fl = 12 + Math.sin(game.time * 40) * 5 + p.thrust * 10;
    var fg = ctx.createLinearGradient(0, 12, 0, 12 + fl);
    fg.addColorStop(0, "#fef08a"); fg.addColorStop(0.5, "#fb923c"); fg.addColorStop(1, "transparent");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.lineTo(0, 12 + fl); ctx.closePath(); ctx.fill();

    neon("#22d3ee", 18);
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(13, 10); ctx.lineTo(6, 14); ctx.lineTo(0, 8);
    ctx.lineTo(-6, 14); ctx.lineTo(-13, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 12; ctx.fillStyle = "#a5f3fc";
    ctx.beginPath(); ctx.arc(0, -4, 4, 0, TAU); ctx.fill();

    if (p.shield > 0) {
      ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = 22;
      ctx.strokeStyle = "rgba(56,189,248," + (0.45 + 0.35 * Math.sin(game.time * 8)) + ")";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, p.r + 12, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawEnemies() {
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      ctx.save();
      ctx.translate(e.x, e.y);
      var col = e.hitFlash > 0.05 ? "#ffffff" : e.color;
      neon(col, e.boss ? 30 : 14);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.fillStyle = "rgba(10,12,32,.85)";

      if (e.boss) drawBossShape(e, col);
      else if (e.type === "fast") {
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(10, -10); ctx.lineTo(0, -4); ctx.lineTo(-10, -10);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (e.type === "tank") {
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = (k / 6) * TAU + Math.PI / 6;
          var x = Math.cos(a) * e.r, y = Math.sin(a) * e.r;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.42, 0, TAU); ctx.stroke();
      } else if (e.type === "shooter") {
        ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(14, 0); ctx.lineTo(8, -12);
        ctx.lineTo(-8, -12); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 2, 4, 0, TAU); ctx.fillStyle = col; ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(13, -8); ctx.lineTo(-13, -8);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -1, 3.5, 0, TAU); ctx.fillStyle = col; ctx.fill();
      }

      if (!e.boss && e.hp < e.maxHp) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(-e.r, -e.r - 9, e.r * 2, 3);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(-e.r, -e.r - 9, e.r * 2 * (e.hp / e.maxHp), 3);
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }

  function drawBossShape(b, col) {
    var r = b.r;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.85);
    ctx.lineTo(r, r * 0.15);
    ctx.lineTo(r * 0.65, -r * 0.55);
    ctx.lineTo(0, -r * 0.3);
    ctx.lineTo(-r * 0.65, -r * 0.55);
    ctx.lineTo(-r, r * 0.15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fillStyle = b.hitFlash > 0.05 ? "#fff" : "#fda4af"; ctx.fill();
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55 + Math.sin(game.time * 3) * 3, 0, TAU); ctx.stroke();
  }

  function drawBullets() {
    var i, b;
    for (i = 0; i < game.bullets.length; i++) {
      b = game.bullets[i];
      neon("#22d3ee", 14);
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 2.2, 0, 0, TAU); ctx.fill();
    }
    for (i = 0; i < game.eBullets.length; i++) {
      b = game.eBullets[i];
      neon("#f472b6", 14);
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  var PW_LABEL = { spread: "S", shield: "E", speed: "V", heal: "+", bomb: "B" };
  var PW_COLOR = { spread: "#4ade80", shield: "#38bdf8", speed: "#facc15", heal: "#fb7185", bomb: "#f97316" };
  function drawPowerups() {
    for (var i = 0; i < game.powerups.length; i++) {
      var pu = game.powerups[i], c = PW_COLOR[pu.kind];
      ctx.save(); ctx.translate(pu.x, pu.y); ctx.rotate(Math.sin(pu.t * 2) * 0.3);
      neon(c, 20);
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.fillStyle = "rgba(4,6,20,.8)";
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-pu.r, -pu.r, pu.r * 2, pu.r * 2, 5)
        : ctx.rect(-pu.r, -pu.r, pu.r * 2, pu.r * 2);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 6; ctx.fillStyle = c;
      ctx.font = "bold 15px Trebuchet MS, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(PW_LABEL[pu.kind], 0, 1);
      ctx.restore(); ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    var i;
    for (i = 0; i < game.particles.length; i++) {
      var p = game.particles[i], a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      neon(p.color, 10);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a + 0.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    for (i = 0; i < game.floats.length; i++) {
      var f = game.floats[i];
      ctx.globalAlpha = clamp(f.life / 0.9, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = "bold 14px Trebuchet MS, sans-serif";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- loop ---------------- */
  var last = 0;
  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- UI ---------------- */
  function bindUI() {
    $("menu").addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) return;
      Audio.init(); Audio.resume(); Audio.beep(660, 0.07, "square", 0.15);
      if (act === "play") startGame();
      else if (act === "how") showScreen("how");
      else if (act === "scores") { renderScores(); showScreen("scores"); }
      else if (act === "settings") { syncSettingsUI(); showScreen("settings"); }
    });
    Array.prototype.forEach.call(document.querySelectorAll(".btn.back"), function (b) {
      b.addEventListener("click", function () { showScreen("menu"); });
    });
    $("clear-scores").addEventListener("click", function () {
      scores = []; save(KEY_H, scores); renderScores(); toast("RECORDES APAGADOS");
    });
    $("btn-pause").addEventListener("click", pauseGame);
    $("resume").addEventListener("click", resumeGame);
    $("restart").addEventListener("click", startGame);
    $("to-menu").addEventListener("click", toMenu);
    $("again").addEventListener("click", startGame);
    $("over-menu").addEventListener("click", toMenu);

    var m = $("set-music"), s = $("set-sfx"), v = $("set-vol"), d = $("set-diff"),
        pt = $("set-particles"), tc = $("set-touch");
    function persist() {
      settings.music = m.checked; settings.sfx = s.checked;
      settings.volume = parseInt(v.value, 10); settings.difficulty = d.value;
      settings.particles = pt.checked; settings.touch = tc.value;
      save(KEY_S, settings);
      Audio.init(); Audio.applySettings();
      if (settings.music && game.state === "playing") Audio.startMusic(); else if (!settings.music) Audio.stopMusic();
      updateTouchVisibility();
    }
    [m, s, v, d, pt, tc].forEach(function (el) { el.addEventListener("change", persist); });
    v.addEventListener("input", persist);
  }

  function syncSettingsUI() {
    $("set-music").checked = !!settings.music;
    $("set-sfx").checked = !!settings.sfx;
    $("set-vol").value = settings.volume;
    $("set-diff").value = settings.difficulty;
    $("set-particles").checked = !!settings.particles;
    $("set-touch").value = settings.touch;
  }

  /* ---------------- init ---------------- */
  resize();
  bindUI();
  syncSettingsUI();
  renderScores();
  showScreen("menu");
  updateTouchVisibility();
  document.addEventListener("touchstart", function once() {
    Audio.init(); Audio.resume(); document.removeEventListener("touchstart", once);
  }, { passive: true });
  requestAnimationFrame(loop);
})();
