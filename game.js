"use strict";
/// <reference types="phaser" />
/**
 * =============================================================================
 *  SPACE EATERS — Shooter vertical retro (8 bits)
 *  Taller práctico: Setup, Desarrollo y Despliegue con Phaser 3
 * =============================================================================
 *
 *  Este es el único módulo de lógica del juego. Se compila con `tsc`
 *  (ver tsconfig.json) y genera `game.js`, que index.html carga con una
 *  etiqueta <script> normal.
 *
 *  Phaser 3 llega desde un CDN y queda expuesto como el global `Phaser`
 *  (de ahí la referencia de tipos de la primera línea).
 *
 *  ATLAS DE SPRITES
 *  ----------------
 *  Todo el arte proviene de `assets/pico8_invaders_sprites_LARGE.png`, una hoja
 *  128x128 con sprites de 8x8 organizados en una rejilla de 16x16 celdas.
 *  La hoja usa negro puro (#000000) como "transparente" (convención PICO-8),
 *  por eso en BootScene se recorta el negro a alfa 0 antes de definir los
 *  frames: así los sprites se pueden superponer sin cajas negras.
 *
 *  ÍNDICE DE LA HOJA (columna.fila, cada celda 8x8)
 *  ------------------------------------------------
 *   0.0 / 1.0 / 2.0 .... nave del jugador
 *   3.0 .. 10.0 ........ 8 tipos de enemigo (fotograma A)
 *   3.1 .. 10.1 ........ los mismos 8 enemigos (fotograma B)
 *   1.3 ................ bala del jugador (orbe azul)
 *   2.3 ................ bala alternativa (orbe amarillo)
 *   6.4 / 5.4 / 2.4 / 1.4  fotogramas de explosión
 *   4.7 ................ corazón (icono de vidas)
 *   11.0 .. 15.1 ....... asteroides decorativos
 *   (72,40) 48x24 ...... logotipo "SPACE EATERS"
 * =============================================================================
 */
var SpaceEaters;
(function (SpaceEaters) {
    /* ===========================================================================
     * 1. CONFIGURACIÓN
     * ======================================================================== */
    /** Clave de la textura que se genera en runtime a partir del PNG original. */
    const ATLAS = 'sprites';
    /** Clave de la textura temporal que contiene la imagen tal cual viene. */
    const SOURCE_KEY = 'sheet-source';
    /** Clave de localStorage para el récord. */
    const BEST_SCORE_KEY = 'space-eaters:best-score';
    /**
     * Resolución lógica mínima. El factor de zoom se calcula para que el mundo
     * nunca baje de este tamaño, sin importar las dimensiones de la ventana.
     */
    const MIN_WORLD_WIDTH = 320;
    const MIN_WORLD_HEIGHT = 180;
    /** Fuente pixel-art. Si el CDN falla, cae a una monoespaciada del sistema. */
    const FONT_FAMILY = '"Press Start 2P", "Courier New", monospace';
    /** Paleta PICO-8 (solo los tonos que usa el juego). */
    const PALETTE = {
        darkBlue: 0x1d2b53,
        darkPurple: 0x7e2553,
        darkGreen: 0x008751,
        brown: 0xab5236,
        darkGrey: 0x5f574f,
        lightGrey: 0xc2c3c7,
        white: 0xfff1e8,
        red: 0xff004d,
        orange: 0xffa300,
        yellow: 0xffec27,
        green: 0x00e436,
        blue: 0x29adff,
        lavender: 0x83769c,
        pink: 0xff77a8
    };
    /** Convierte un entero 0xRRGGBB al string CSS que espera Phaser.Text. */
    const css = (value) => `#${value.toString(16).padStart(6, '0')}`;
    /* ------------------------------ Jugador ---------------------------------- */
    const PLAYER_SPEED = 135;
    const PLAYER_SCALE = 2;
    const PLAYER_LIVES = 3;
    const PLAYER_FIRE_COOLDOWN = 200;
    const PLAYER_INVULNERABLE_MS = 1600;
    /** El jugador no puede subir por encima de esta fracción de la pantalla. */
    const PLAYER_MIN_Y_RATIO = 0.36;
    /* ------------------------------ Enemigos --------------------------------- */
    const ENEMY_SCALE = 2;
    const ENEMY_SPAWN_Y = -18;
    const ENEMY_BASE_SPEED = 58;
    const ENEMY_MAX_STRAFE = 58;
    const ENEMY_STEER = 2.2;
    /**
     * Altura mínima (en unidades de mundo) para que un enemigo sea destruible.
     * Evita que las explosiones queden escondidas detrás del marcador superior.
     */
    const ENEMY_ENTRY_Y = 32;
    /** Estadísticas por tipo de enemigo: puntos y multiplicador de velocidad. */
    const ENEMY_KINDS = [
        { points: 30, speed: 1.0 }, // 3.x  verde
        { points: 20, speed: 0.85 }, // 4.x  ámbar
        { points: 25, speed: 0.95 }, // 5.x  rosado
        { points: 40, speed: 1.15 }, // 6.x  verde lima
        { points: 15, speed: 0.8 }, // 7.x  amarillo
        { points: 35, speed: 1.05 }, // 8.x  rosado claro
        { points: 50, speed: 1.25 }, // 9.x  araña blanca
        { points: 45, speed: 1.1 } // 10.x azul
    ];
    const ENEMY_TYPE_COUNT = ENEMY_KINDS.length;
    const ENEMY_FIRST_COLUMN = 3;
    const ASTEROID_COUNT = 5;
    const ASTEROID_FIRST_COLUMN = 11;
    /* ----------------------------- Dificultad -------------------------------- */
    const KILLS_PER_LEVEL = 9;
    const MAX_LEVEL = 12;
    /* ------------------------------- Balas ----------------------------------- */
    const BULLET_SPEED = 340;
    const BULLET_SCALE = 1;
    /** Construye la definición de un frame a partir de su celda 8x8. */
    const cell = (name, column, row) => ({
        name,
        x: column * 8,
        y: row * 8,
        w: 8,
        h: 8
    });
    /** Todos los frames que el juego necesita, recortados de la hoja original. */
    const FRAME_DEFS = (() => {
        const frames = [
            // Nave del jugador y sus variantes de color.
            cell('player', 0, 0),
            cell('player-alt', 1, 0),
            // Proyectiles.
            cell('bullet', 1, 3),
            cell('bullet-alt', 2, 3),
            // Explosión: chispa -> fuego -> fuego -> destello.
            cell('boom-0', 6, 4),
            cell('boom-1', 5, 4),
            cell('boom-2', 2, 4),
            cell('boom-3', 1, 4),
            // Icono de vidas.
            cell('heart', 4, 7),
            // Logotipo: no está alineado a la rejilla, se recorta como bloque.
            { name: 'logo', x: 72, y: 40, w: 48, h: 24 }
        ];
        for (let i = 0; i < ENEMY_TYPE_COUNT; i++) {
            frames.push(cell(`enemy-${i}-a`, ENEMY_FIRST_COLUMN + i, 0));
            frames.push(cell(`enemy-${i}-b`, ENEMY_FIRST_COLUMN + i, 1));
        }
        for (let i = 0; i < ASTEROID_COUNT; i++) {
            frames.push(cell(`rock-${i}-a`, ASTEROID_FIRST_COLUMN + i, 0));
            frames.push(cell(`rock-${i}-b`, ASTEROID_FIRST_COLUMN + i, 1));
        }
        return frames;
    })();
    /* ===========================================================================
     * 3. PERSISTENCIA DEL RÉCORD
     * ======================================================================== */
    const readBestScore = () => {
        try {
            const raw = window.localStorage.getItem(BEST_SCORE_KEY);
            const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        }
        catch {
            return 0;
        }
    };
    const writeBestScore = (value) => {
        try {
            window.localStorage.setItem(BEST_SCORE_KEY, String(value));
        }
        catch {
            /* Almacenamiento bloqueado (modo privado): el récord no persiste. */
        }
    };
    /* ===========================================================================
     * 4. AUDIO — efectos 8 bits sintetizados con WebAudio
     * ========================================================================== */
    /**
     * El paquete de assets no incluye sonidos, así que los efectos se generan
     * con osciladores y ruido. El AudioContext se crea en el primer gesto del
     * usuario (clic en Play) para respetar las políticas de autoplay.
     */
    class Sfx {
        constructor() {
            this.context = null;
            this.master = null;
            this.noise = null;
            this.muted = false;
        }
        /** Crea (o reanuda) el contexto de audio. Debe llamarse tras un gesto. */
        unlock() {
            if (this.context) {
                void this.context.resume();
                return;
            }
            const Ctor = window.AudioContext ??
                window.webkitAudioContext;
            if (!Ctor) {
                return;
            }
            const context = new Ctor();
            const master = context.createGain();
            master.gain.value = 0.16;
            master.connect(context.destination);
            this.context = context;
            this.master = master;
        }
        toggleMute() {
            this.muted = !this.muted;
            return this.muted;
        }
        isMuted() {
            return this.muted;
        }
        /** Disparo: barrido descendente de onda cuadrada. */
        shoot() {
            const context = this.context;
            const master = this.master;
            if (!context || !master || this.muted) {
                return;
            }
            const now = context.currentTime;
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(920, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
            osc.connect(gain).connect(master);
            osc.start(now);
            osc.stop(now + 0.12);
        }
        /** Explosión: ruido blanco filtrado con caída de frecuencia. */
        boom() {
            const context = this.context;
            const master = this.master;
            if (!context || !master || this.muted) {
                return;
            }
            const now = context.currentTime;
            const source = context.createBufferSource();
            source.buffer = this.getNoiseBuffer(context);
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2200, now);
            filter.frequency.exponentialRampToValueAtTime(120, now + 0.34);
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.7, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
            source.connect(filter).connect(gain).connect(master);
            source.start(now);
            source.stop(now + 0.4);
        }
        /** Impacto recibido: zumbido grave y corto. */
        hurt() {
            const context = this.context;
            const master = this.master;
            if (!context || !master || this.muted) {
                return;
            }
            const now = context.currentTime;
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.28);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            osc.connect(gain).connect(master);
            osc.start(now);
            osc.stop(now + 0.32);
        }
        /** Inicio de partida: arpegio ascendente. */
        start() {
            const context = this.context;
            const master = this.master;
            if (!context || !master || this.muted) {
                return;
            }
            const now = context.currentTime;
            [440, 554, 659, 880].forEach((frequency, index) => {
                const osc = context.createOscillator();
                const gain = context.createGain();
                const at = now + index * 0.07;
                osc.type = 'square';
                osc.frequency.setValueAtTime(frequency, at);
                gain.gain.setValueAtTime(0.18, at);
                gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
                osc.connect(gain).connect(master);
                osc.start(at);
                osc.stop(at + 0.1);
            });
        }
        /** Fin de partida: secuencia descendente. */
        gameOver() {
            const context = this.context;
            const master = this.master;
            if (!context || !master || this.muted) {
                return;
            }
            const now = context.currentTime;
            [523, 392, 311, 196].forEach((frequency, index) => {
                const osc = context.createOscillator();
                const gain = context.createGain();
                const at = now + index * 0.16;
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(frequency, at);
                gain.gain.setValueAtTime(0.28, at);
                gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
                osc.connect(gain).connect(master);
                osc.start(at);
                osc.stop(at + 0.22);
            });
        }
        /** Búfer de ruido reutilizable (se genera una sola vez). */
        getNoiseBuffer(context) {
            if (this.noise) {
                return this.noise;
            }
            const length = Math.floor(context.sampleRate * 0.5);
            const buffer = context.createBuffer(1, length, context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noise = buffer;
            return buffer;
        }
    }
    /* ===========================================================================
     * 5. ESCENA BASE — escala y cámara adaptables a toda la pantalla
     * ======================================================================== */
    /**
     * Concentra la lógica de "llenar la pantalla":
     *
     *  1. El lienzo ocupa siempre el viewport (Scale.RESIZE).
     *  2. Se elige un zoom entero `z` para que el mundo lógico nunca sea menor
     *     que MIN_WORLD_WIDTH x MIN_WORLD_HEIGHT. Un zoom entero mantiene los
     *     píxeles nítidos (sin interpolación).
     *  3. El mundo mide exactamente `ancho / z` x `alto / z`, y la cámara se
     *     centra en él: no hay barras negras ni recortes.
     */
    class WorldScene extends Phaser.Scene {
        constructor() {
            super(...arguments);
            this.worldWidth = MIN_WORLD_WIDTH;
            this.worldHeight = MIN_WORLD_HEIGHT;
            this.pixelZoom = 1;
            /** Factores de escala del mundo respecto al tamaño lógico de referencia. */
            this.scaleX = 1;
            this.scaleY = 1;
            /** Textos creados por la escena, para reajustar su nitidez al redimensionar. */
            this.texts = [];
        }
        create() {
            this.texts.length = 0;
            this.applyScale();
            this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
            this.build();
            this.layout();
        }
        /** Crea un texto con la fuente pixel y registra su resolución. */
        createText(x, y, content, size, color, align = 'center') {
            const text = this.add.text(x, y, content, {
                fontFamily: FONT_FAMILY,
                fontSize: `${size}px`,
                color: css(color),
                align,
                resolution: this.textResolution()
            });
            text.setOrigin(0.5, 0.5);
            this.texts.push(text);
            return text;
        }
        /** Recalcula la resolución interna de todos los textos (nitidez). */
        refreshTextResolution() {
            const resolution = this.textResolution();
            for (const text of this.texts) {
                text.setResolution(resolution);
            }
        }
        textResolution() {
            const devicePixelRatio = Math.min(2, window.devicePixelRatio || 1);
            return Math.max(1, Math.min(8, Math.round(this.pixelZoom * devicePixelRatio)));
        }
        handleResize() {
            this.applyScale();
            this.layout();
        }
        handleShutdown() {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
        }
        applyScale() {
            const width = this.scale.width;
            const height = this.scale.height;
            // En vertical (móvil) se permite un mundo más estrecho para que la
            // interfaz no quede diminuta; en horizontal manda el mínimo de 320.
            const isPortrait = width < height;
            const minWidth = isPortrait ? MIN_WORLD_WIDTH * 0.62 : MIN_WORLD_WIDTH;
            // Zoom entero: píxeles nítidos y mundo lógico dentro de un rango jugable.
            const zoom = Math.max(1, Math.round(Math.min(width / minWidth, height / MIN_WORLD_HEIGHT)));
            this.pixelZoom = zoom;
            this.worldWidth = width / zoom;
            this.worldHeight = height / zoom;
            this.scaleX = this.worldWidth / MIN_WORLD_WIDTH;
            this.scaleY = this.worldHeight / MIN_WORLD_HEIGHT;
            const camera = this.cameras.main;
            camera.setZoom(zoom);
            camera.setSize(width, height);
            camera.setRoundPixels(true);
            camera.setBackgroundColor('#000000');
            camera.centerOn(this.worldWidth / 2, this.worldHeight / 2);
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        }
    }
    /* ===========================================================================
     * 6. FONDO ESTELAR
     * ======================================================================== */
    /** Campo de estrellas con parallax simple; se recicla al salir por abajo. */
    class Starfield {
        constructor(scene, count, width, height) {
            this.stars = [];
            this.speeds = [];
            this.width = width;
            this.height = height;
            const tints = [PALETTE.white, PALETTE.lavender, PALETTE.blue, PALETTE.lightGrey];
            for (let i = 0; i < count; i++) {
                const size = Math.random() < 0.78 ? 1 : 2;
                const star = scene.add.image(0, 0, 'pixel');
                star.setScale(size);
                star.setTint(tints[Phaser.Math.Between(0, tints.length - 1)]);
                star.setAlpha(Phaser.Math.FloatBetween(0.2, 0.85));
                star.setDepth(0);
                this.stars.push(star);
                this.speeds.push(Phaser.Math.FloatBetween(5, 13) + size * 5);
                this.place(star, Phaser.Math.Between(0, Math.floor(this.height)));
            }
        }
        /** Reubica una estrella dentro del área visible. */
        place(star, y) {
            star.x = Phaser.Math.Between(0, Math.floor(this.width));
            star.y = y;
        }
        resize(width, height) {
            this.width = width;
            this.height = height;
            for (const star of this.stars) {
                if (star.x > width || star.y > height) {
                    this.place(star, Phaser.Math.Between(0, Math.floor(height)));
                }
            }
        }
        update(deltaSeconds) {
            for (let i = 0; i < this.stars.length; i++) {
                const star = this.stars[i];
                star.y += this.speeds[i] * deltaSeconds;
                if (star.y > this.height + 2) {
                    this.place(star, -2);
                }
            }
        }
    }
    /* ===========================================================================
     * 7. ENTIDADES
     * ======================================================================== */
    /** Nave del jugador. */
    class Player extends Phaser.Physics.Arcade.Sprite {
        constructor(scene, x, y) {
            super(scene, x, y, ATLAS, 'player');
            this.invulnerableUntil = 0;
            this.blinkTween = null;
            scene.add.existing(this);
            scene.physics.add.existing(this);
            this.setScale(PLAYER_SCALE);
            this.setDepth(12);
            // Caja de colisión algo menor que el sprite: se siente más justa.
            this.body.setSize(6, 6).setOffset(1, 1);
            this.body.setCollideWorldBounds(true);
        }
        /** Indica si la nave puede recibir daño en este instante. */
        isVulnerable(time) {
            return time >= this.invulnerableUntil;
        }
        /** Activa la invulnerabilidad temporal con parpadeo. */
        makeInvulnerable(time, durationMs) {
            this.invulnerableUntil = time + durationMs;
            this.blinkTween?.remove();
            this.blinkTween = this.scene.tweens.add({
                targets: this,
                alpha: { from: 1, to: 0.2 },
                duration: 110,
                yoyo: true,
                repeat: Math.floor(durationMs / 220),
                onComplete: () => {
                    this.setAlpha(1);
                    this.blinkTween = null;
                }
            });
        }
        /** Oculta la nave (al perder la última vida). */
        hideShip() {
            this.blinkTween?.remove();
            this.blinkTween = null;
            this.setAlpha(0);
            this.body.enable = false;
        }
    }
    /** Enemigo: cae desde arriba y persigue horizontalmente al jugador. */
    class Enemy extends Phaser.Physics.Arcade.Sprite {
        constructor(scene, x, y, kind) {
            super(scene, x, y, ATLAS, `enemy-${kind}-a`);
            this.kind = kind;
            this.points = ENEMY_KINDS[kind].points;
            this.speedMultiplier = ENEMY_KINDS[kind].speed;
            this.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
            scene.add.existing(this);
            scene.physics.add.existing(this);
            this.setScale(ENEMY_SCALE);
            this.setDepth(10);
            this.body.setSize(7, 7).setOffset(0.5, 0.5);
            this.play(`enemy-${kind}`);
        }
        /**
         * Ajusta la velocidad para "rastrear" la posición horizontal del jugador.
         * La interpolación exponencial hace que el giro sea suave y estable
         * independientemente de los FPS.
         *
         * Las velocidades llegan ya escaladas por la escena, de modo que el ritmo
         * de juego es el mismo en cualquier relación de aspecto.
         */
        steer(targetX, fallSpeed, maxStrafe, deltaSeconds, time) {
            const distance = targetX - this.x;
            const desired = Phaser.Math.Clamp(distance * ENEMY_STEER, -maxStrafe, maxStrafe);
            const blend = 1 - Math.exp(-3.2 * deltaSeconds);
            const nextX = Phaser.Math.Linear(this.body.velocity.x, desired, blend);
            // Micro-oscilación para que la formación no se vea robótica.
            const wobble = Math.sin(time * 0.003 + this.phase) * maxStrafe * 0.17;
            this.body.setVelocityX(nextX + wobble);
            this.body.setVelocityY(fallSpeed * this.speedMultiplier);
        }
    }
    /** Proyectil del jugador. */
    class Bullet extends Phaser.Physics.Arcade.Sprite {
        constructor(scene, x, y) {
            super(scene, x, y, ATLAS, 'bullet');
            scene.add.existing(this);
            scene.physics.add.existing(this);
            this.setScale(BULLET_SCALE);
            this.setDepth(15);
            this.body.setSize(5, 6).setOffset(1.5, 1);
        }
        /** Sale disparada hacia arriba con un pequeño destello inicial. */
        launch(speed) {
            this.body.setVelocityY(-speed);
            this.scene.tweens.add({
                targets: this,
                scaleX: { from: 1.8, to: BULLET_SCALE },
                scaleY: { from: 0.6, to: BULLET_SCALE },
                duration: 90,
                ease: 'Quad.easeOut'
            });
        }
    }
    /* ===========================================================================
     * 8. HUD
     * ======================================================================== */
    /** Marcador, vidas y nivel, dibujados en coordenadas del mundo. */
    class Hud {
        constructor(scene) {
            this.hearts = [];
            // Banda oscura para que el marcador se lea sobre los enemigos.
            this.backdrop = scene.add.rectangle(0, 0, 10, 27, 0x000000, 0.62).setDepth(98);
            for (let i = 0; i < PLAYER_LIVES; i++) {
                const heart = scene.add.image(0, 0, ATLAS, 'heart');
                heart.setScale(1.5).setDepth(100);
                this.hearts.push(heart);
            }
            this.divider = scene.add.rectangle(0, 0, 10, 1, PALETTE.darkBlue).setDepth(99);
            this.scoreText = scene.add.text(0, 0, '000000', {
                fontFamily: FONT_FAMILY,
                fontSize: '9px',
                color: css(PALETTE.white)
            });
            this.scoreText.setDepth(100).setOrigin(1, 0);
            this.levelText = scene.add.text(0, 0, 'NIVEL 1', {
                fontFamily: FONT_FAMILY,
                fontSize: '6px',
                color: css(PALETTE.lavender)
            });
            this.levelText.setDepth(100).setOrigin(0, 0.5);
            this.hintText = scene.add.text(0, 0, 'P PAUSA   M SONIDO', {
                fontFamily: FONT_FAMILY,
                fontSize: '5px',
                color: css(PALETTE.darkGrey)
            });
            this.hintText.setDepth(100).setOrigin(0.5, 1);
        }
        layout(worldWidth, worldHeight) {
            this.backdrop.setPosition(worldWidth / 2, 13.5);
            this.backdrop.setSize(worldWidth, 27);
            for (let i = 0; i < this.hearts.length; i++) {
                this.hearts[i].setPosition(11 + i * 14, 12);
            }
            this.scoreText.setPosition(worldWidth - 10, 8);
            this.levelText.setPosition(56, 13);
            this.hintText.setPosition(worldWidth / 2, worldHeight - 3);
            this.divider.setPosition(worldWidth / 2, 23);
            this.divider.setSize(worldWidth - 20, 1);
        }
        setLives(lives) {
            for (let i = 0; i < this.hearts.length; i++) {
                const alive = i < lives;
                this.hearts[i].setAlpha(alive ? 1 : 0.15);
                this.hearts[i].setTint(alive ? 0xffffff : PALETTE.darkGrey);
            }
        }
        setScore(score) {
            this.scoreText.setText(String(score).padStart(6, '0'));
        }
        setLevel(level) {
            this.levelText.setText(`NIVEL ${level}`);
        }
        setResolution(resolution) {
            this.scoreText.setResolution(resolution);
            this.levelText.setResolution(resolution);
            this.hintText.setResolution(resolution);
        }
        setVisible(visible) {
            for (const heart of this.hearts) {
                heart.setVisible(visible);
            }
            this.scoreText.setVisible(visible);
            this.levelText.setVisible(visible);
            this.hintText.setVisible(visible);
            this.backdrop.setVisible(visible);
            this.divider.setVisible(visible);
        }
        /** Aplica la misma resolución que usan los textos de la escena. */
        syncResolution(scene) {
            this.setResolution(Math.max(1, Math.round(scene.cameras.main.zoom)));
        }
    }
    /* ===========================================================================
     * 9. BOOT — carga y preparación del atlas
     * ======================================================================== */
    class BootScene extends Phaser.Scene {
        constructor() {
            super('Boot');
        }
        preload() {
            this.load.image(SOURCE_KEY, 'assets/pico8_invaders_sprites_LARGE.png');
        }
        create() {
            this.buildAtlas();
            this.buildPixelTexture();
            this.buildAnimations();
            this.scene.start('Menu');
        }
        /**
         * Convierte el negro puro de la hoja en transparencia y registra los frames.
         * Es un paso necesario porque el PNG trae el fondo opaco (convención PICO-8).
         */
        buildAtlas() {
            const source = this.textures.get(SOURCE_KEY).getSourceImage();
            if (!(source instanceof HTMLImageElement)) {
                throw new Error('No se pudo leer la hoja de sprites.');
            }
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                throw new Error('El navegador no soporta canvas 2D.');
            }
            context.imageSmoothingEnabled = false;
            context.drawImage(source, 0, 0);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = image.data;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) {
                    pixels[i + 3] = 0;
                }
            }
            context.putImageData(image, 0, 0);
            const texture = this.textures.addCanvas(ATLAS, canvas);
            if (!texture) {
                throw new Error('No se pudo registrar el atlas.');
            }
            for (const frame of FRAME_DEFS) {
                texture.add(frame.name, 0, frame.x, frame.y, frame.w, frame.h);
            }
        }
        /** Textura de 1x1 usada para las estrellas del fondo. */
        buildPixelTexture() {
            if (this.textures.exists('pixel')) {
                return;
            }
            const texture = this.textures.createCanvas('pixel', 1, 1);
            if (!texture) {
                return;
            }
            const context = texture.getContext();
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, 1, 1);
            texture.refresh();
        }
        /** Animaciones compartidas por todas las escenas. */
        buildAnimations() {
            for (let i = 0; i < ENEMY_TYPE_COUNT; i++) {
                this.anims.create({
                    key: `enemy-${i}`,
                    frames: [
                        { key: ATLAS, frame: `enemy-${i}-a` },
                        { key: ATLAS, frame: `enemy-${i}-b` }
                    ],
                    frameRate: 5,
                    repeat: -1
                });
            }
            this.anims.create({
                key: 'boom',
                // Llama -> destello -> ascuas: la lectura clásica de una explosión.
                frames: ['boom-1', 'boom-2', 'boom-0'].map((frame) => ({ key: ATLAS, frame })),
                frameRate: 18,
                hideOnComplete: false
            });
        }
    }
    /* ===========================================================================
     * 10. MENÚ
     * ======================================================================== */
    class MenuScene extends WorldScene {
        constructor() {
            super('Menu');
            this.decorations = [];
            this.starting = false;
        }
        build() {
            this.starting = false;
            this.sfx = new Sfx();
            this.cameras.main.setBackgroundColor('#000000');
            this.stars = new Starfield(this, 90, this.worldWidth, this.worldHeight);
            // Pequeña formación de enemigos flotando a los costados.
            this.decorations = [];
            for (let i = 0; i < 4; i++) {
                const enemy = this.add.sprite(0, 0, ATLAS, `enemy-${i % ENEMY_TYPE_COUNT}-a`);
                enemy.setScale(ENEMY_SCALE).setDepth(5);
                this.decorations.push(enemy);
            }
            this.logo = this.add.image(0, 0, ATLAS, 'logo').setDepth(10);
            this.button = this.add.rectangle(0, 0, 132, 36, PALETTE.darkBlue).setDepth(10);
            this.button.setStrokeStyle(2, PALETTE.blue);
            this.buttonLabel = this.createText(0, 0, 'PLAY', 12, PALETTE.green);
            this.buttonLabel.setDepth(11);
            this.instructions = this.createText(0, 0, 'FLECHAS: MOVER\nCLIC: DISPARAR', 6, PALETTE.lightGrey);
            this.instructions.setAlign('center');
            this.instructions.setDepth(11);
            this.bestLabel = this.createText(0, 0, '', 6, PALETTE.orange);
            this.bestLabel.setDepth(11);
            this.footer = this.createText(0, 0, 'PHASER 3 + TYPESCRIPT', 5, PALETTE.darkGrey);
            this.footer.setDepth(11);
            this.configureButton();
            this.animateDecorations();
            this.refreshBestScore();
        }
        layout() {
            const width = this.worldWidth;
            const height = this.worldHeight;
            this.stars.resize(width, height);
            // Escala del logotipo: entera (píxeles nítidos) y acotada por ancho y alto.
            const logoScale = Math.max(1, Math.min(Math.round((width * 0.62) / 48), Math.round((height * 0.42) / 24)));
            const logoHeight = 24 * logoScale;
            const buttonHeight = 30;
            const gap = 12;
            const instructionsHeight = 16;
            const lineHeight = 7;
            // Bloque vertical centrado: se adapta a cualquier relación de aspecto.
            const stackHeight = logoHeight + gap + buttonHeight + gap + instructionsHeight + 6 + lineHeight;
            const top = Math.max(6, (height - stackHeight) / 2);
            const logoY = top + logoHeight / 2;
            const buttonY = top + logoHeight + gap + buttonHeight / 2;
            const instructionsY = top + logoHeight + gap + buttonHeight + gap + instructionsHeight / 2;
            const bestY = instructionsY + instructionsHeight / 2 + 9;
            this.logo.setScale(logoScale);
            this.logo.setPosition(width / 2, logoY);
            this.button.setPosition(width / 2, buttonY);
            this.buttonLabel.setPosition(width / 2, buttonY);
            this.instructions.setPosition(width / 2, instructionsY);
            this.bestLabel.setPosition(width / 2, bestY);
            this.footer.setPosition(width / 2, height - 7);
            // Enemigos decorativos pegados a los bordes, lejos del botón.
            for (let i = 0; i < this.decorations.length; i++) {
                const enemy = this.decorations[i];
                const side = i % 2 === 0 ? 1 : -1;
                const row = Math.floor(i / 2);
                enemy.setPosition(side > 0 ? width - 17 : 17, buttonY - 4 + row * 22);
            }
            this.refreshTextResolution();
        }
        /** Zona interactiva del botón + atajos de teclado. */
        configureButton() {
            this.button.setInteractive({ useHandCursor: true });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
                this.button.setFillStyle(PALETTE.blue);
                this.buttonLabel.setColor(css(PALETTE.darkBlue));
            });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
                this.button.setFillStyle(PALETTE.darkBlue);
                this.buttonLabel.setColor(css(PALETTE.green));
            });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
                this.button.setScale(0.96);
            });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
                this.button.setScale(1);
                this.startGame();
            });
            const keyboard = this.input.keyboard;
            if (keyboard) {
                keyboard.on('keydown-ENTER', () => this.startGame());
                keyboard.on('keydown-SPACE', () => this.startGame());
            }
        }
        animateDecorations() {
            this.tweens.add({
                targets: this.logo,
                y: '+=3',
                duration: 1600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.tweens.add({
                targets: this.instructions,
                alpha: { from: 1, to: 0.35 },
                duration: 900,
                yoyo: true,
                repeat: -1
            });
            for (let i = 0; i < this.decorations.length; i++) {
                this.decorations[i].play(`enemy-${(ENEMY_TYPE_COUNT - 1 - i) % ENEMY_TYPE_COUNT}`);
            }
        }
        refreshBestScore() {
            const best = readBestScore();
            this.bestLabel.setText(best > 0 ? `RÉCORD ${String(best).padStart(6, '0')}` : '');
        }
        startGame() {
            if (this.starting) {
                return;
            }
            this.starting = true;
            this.sfx.unlock();
            this.sfx.start();
            this.cameras.main.flash(140, 41, 173, 255);
            this.time.delayedCall(160, () => this.scene.start('Game'));
        }
    }
    /* ===========================================================================
     * 11. ESCENA PRINCIPAL
     * ======================================================================== */
    class GameScene extends WorldScene {
        constructor() {
            super('Game');
            this.score = 0;
            this.lives = PLAYER_LIVES;
            this.level = 1;
            this.kills = 0;
            this.nextFireAt = 0;
            this.firing = false;
            this.paused = false;
            this.gameOver = false;
            this.spawnTimer = null;
            this.pauseOverlay = null;
        }
        /* ------------------------------ Construcción --------------------------- */
        build() {
            this.score = 0;
            this.lives = PLAYER_LIVES;
            this.level = 1;
            this.kills = 0;
            this.nextFireAt = 0;
            this.firing = false;
            this.paused = false;
            this.gameOver = false;
            this.pauseOverlay = null;
            this.sfx = new Sfx();
            this.sfx.unlock();
            this.cameras.main.setBackgroundColor('#000000');
            this.stars = new Starfield(this, 120, this.worldWidth, this.worldHeight);
            this.bullets = this.physics.add.group();
            this.enemies = this.physics.add.group();
            this.player = new Player(this, this.worldWidth / 2, this.worldHeight - 30);
            this.hud = new Hud(this);
            // Llama del motor: un píxel escalado que parpadea bajo la nave.
            this.thruster = this.add.image(0, 0, 'pixel');
            this.thruster.setTint(PALETTE.orange).setDepth(11).setScale(4, 5);
            this.tweens.add({
                targets: this.thruster,
                scaleY: { from: 3, to: 7 },
                alpha: { from: 1, to: 0.6 },
                duration: 80,
                yoyo: true,
                repeat: -1
            });
            this.bindInput();
            this.bindCollisions();
            this.restartSpawnTimer();
            this.hud.setLives(this.lives);
            this.hud.setScore(this.score);
            this.hud.setLevel(this.level);
            this.hud.syncResolution(this);
            this.sfx.start();
            this.cameras.main.fadeIn(220, 0, 0, 0);
        }
        layout() {
            this.stars.resize(this.worldWidth, this.worldHeight);
            // Mantiene al jugador dentro del área jugable al redimensionar.
            if (this.player) {
                this.player.x = Phaser.Math.Clamp(this.player.x, 6, this.worldWidth - 6);
                this.player.y = Phaser.Math.Clamp(this.player.y, this.worldHeight * PLAYER_MIN_Y_RATIO, this.worldHeight - 8);
            }
            if (this.hud) {
                this.hud.layout(this.worldWidth, this.worldHeight);
                this.hud.syncResolution(this);
            }
            if (this.pauseOverlay) {
                this.pauseOverlay.setPosition(this.worldWidth / 2, this.worldHeight / 2);
            }
            this.refreshTextResolution();
        }
        bindInput() {
            const keyboard = this.input.keyboard;
            if (!keyboard) {
                return;
            }
            this.cursors = keyboard.createCursorKeys();
            this.wasd = {
                up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
            };
            keyboard.on('keydown-SPACE', () => {
                this.firing = true;
            });
            keyboard.on('keyup-SPACE', () => {
                this.firing = false;
            });
            keyboard.on('keydown-P', () => this.togglePause());
            keyboard.on('keydown-ESC', () => this.togglePause());
            keyboard.on('keydown-M', () => {
                const muted = this.sfx.toggleMute();
                this.flashMessage(muted ? 'SILENCIO' : 'SONIDO ON');
            });
            // Disparo con el ratón (mantener pulsado repite el disparo).
            this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) => {
                this.firing = true;
                // En pantallas táctiles el dedo también arrastra la nave.
                if (pointer.wasTouch) {
                    this.movePlayerToPointer(pointer);
                }
            });
            this.input.on(Phaser.Input.Events.POINTER_UP, () => {
                this.firing = false;
            });
            this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
                if (pointer.wasTouch && pointer.isDown) {
                    this.movePlayerToPointer(pointer);
                }
            });
        }
        /** Arrastre táctil: la nave sigue el dedo dentro del área jugable. */
        movePlayerToPointer(pointer) {
            if (this.gameOver) {
                return;
            }
            this.player.x = Phaser.Math.Clamp(pointer.worldX, 6, this.worldWidth - 6);
            this.player.y = Phaser.Math.Clamp(pointer.worldY, this.worldHeight * PLAYER_MIN_Y_RATIO, this.worldHeight - 8);
        }
        bindCollisions() {
            this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletHitsEnemy, undefined, this);
            this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHitsEnemy, undefined, this);
        }
        /* -------------------------------- Bucle -------------------------------- */
        update(time, delta) {
            const deltaSeconds = delta / 1000;
            this.stars.update(deltaSeconds);
            if (this.gameOver || this.paused) {
                return;
            }
            this.updatePlayer();
            this.updateEnemies(time, deltaSeconds);
            this.updateBullets();
            this.cleanupEnemies();
            if (this.firing) {
                this.fire(time);
            }
        }
        updatePlayer() {
            const speed = PLAYER_SPEED;
            let velocityX = 0;
            let velocityY = 0;
            const left = this.cursors.left.isDown || this.wasd.left.isDown;
            const right = this.cursors.right.isDown || this.wasd.right.isDown;
            const up = this.cursors.up.isDown || this.wasd.up.isDown;
            const down = this.cursors.down.isDown || this.wasd.down.isDown;
            if (left) {
                velocityX -= 1;
            }
            if (right) {
                velocityX += 1;
            }
            if (up) {
                velocityY -= 1;
            }
            if (down) {
                velocityY += 1;
            }
            // Normaliza la diagonal para no moverse más rápido en esa dirección.
            if (velocityX !== 0 && velocityY !== 0) {
                velocityX *= Math.SQRT1_2;
                velocityY *= Math.SQRT1_2;
            }
            this.player.setVelocity(velocityX * speed, velocityY * speed);
            // Límites: laterales de la pantalla y banda inferior del campo.
            const minY = this.worldHeight * PLAYER_MIN_Y_RATIO;
            const maxY = this.worldHeight - 8;
            this.player.x = Phaser.Math.Clamp(this.player.x, 6, this.worldWidth - 6);
            this.player.y = Phaser.Math.Clamp(this.player.y, minY, maxY);
            this.thruster.setPosition(this.player.x, this.player.y + 9);
        }
        updateEnemies(time, deltaSeconds) {
            const levelSpeed = 1 + (this.level - 1) * 0.1;
            const fallSpeed = ENEMY_BASE_SPEED * levelSpeed * this.scaleY;
            const maxStrafe = ENEMY_MAX_STRAFE * this.scaleX;
            for (const child of this.enemies.getChildren()) {
                const enemy = child;
                if (!enemy.active) {
                    continue;
                }
                enemy.steer(this.player.x, fallSpeed, maxStrafe, deltaSeconds, time);
            }
        }
        updateBullets() {
            for (const child of this.bullets.getChildren()) {
                const bullet = child;
                if (bullet.y < -16) {
                    bullet.destroy();
                }
            }
        }
        /** Los enemigos que salen por abajo desaparecen (esquivaron al jugador). */
        cleanupEnemies() {
            for (const child of this.enemies.getChildren()) {
                const enemy = child;
                if (enemy.y > this.worldHeight + 20) {
                    enemy.destroy();
                }
            }
        }
        /* ------------------------------- Disparo ------------------------------- */
        fire(time) {
            if (time < this.nextFireAt || this.gameOver) {
                return;
            }
            this.nextFireAt = time + PLAYER_FIRE_COOLDOWN;
            const bullet = new Bullet(this, this.player.x, this.player.y - 9);
            this.bullets.add(bullet);
            bullet.launch(BULLET_SPEED * this.scaleY);
            this.sfx.shoot();
        }
        /* ----------------------------- Colisiones ------------------------------ */
        handleBulletHitsEnemy(bulletObject, enemyObject) {
            const bullet = bulletObject;
            const enemy = enemyObject;
            if (!bullet.active || !enemy.active || this.gameOver) {
                return;
            }
            // Los enemigos recién aparecidos aún no son destruibles.
            if (enemy.y < ENEMY_ENTRY_Y) {
                return;
            }
            bullet.destroy();
            this.destroyEnemy(enemy);
            this.addScore(enemy.points);
        }
        handlePlayerHitsEnemy(_playerObject, enemyObject) {
            const enemy = enemyObject;
            if (!enemy.active || this.gameOver) {
                return;
            }
            // Durante la invulnerabilidad la nave atraviesa enemigos sin daño.
            if (!this.player.isVulnerable(this.time.now)) {
                return;
            }
            this.destroyEnemy(enemy, false);
            this.damagePlayer();
        }
        destroyEnemy(enemy, withSound = true) {
            if (!enemy.active) {
                return;
            }
            this.explodeAt(enemy.x, enemy.y);
            enemy.destroy();
            if (withSound) {
                this.sfx.boom();
                this.cameras.main.shake(60, 0.0008);
            }
            this.kills += 1;
            this.updateLevel();
        }
        /* -------------------------------- Vidas -------------------------------- */
        damagePlayer() {
            this.lives -= 1;
            this.hud.setLives(Math.max(0, this.lives));
            this.cameras.main.shake(200, 0.0022);
            this.cameras.main.flash(120, 255, 0, 77);
            this.sfx.hurt();
            if (this.lives <= 0) {
                this.endGame();
                return;
            }
            this.player.makeInvulnerable(this.time.now, PLAYER_INVULNERABLE_MS);
        }
        endGame() {
            this.gameOver = true;
            this.firing = false;
            this.spawnTimer?.remove();
            this.spawnTimer = null;
            this.explodeAt(this.player.x, this.player.y);
            this.explodeAt(this.player.x - 6, this.player.y + 4);
            this.player.hideShip();
            this.thruster.setVisible(false);
            this.sfx.gameOver();
            this.cameras.main.shake(380, 0.0032);
            const best = Math.max(readBestScore(), this.score);
            writeBestScore(best);
            this.time.delayedCall(950, () => {
                this.physics.pause();
                this.scene.launch('GameOver', {
                    score: this.score,
                    level: this.level,
                    best
                });
            });
        }
        /* ------------------------------- Pausa --------------------------------- */
        togglePause() {
            if (this.gameOver) {
                return;
            }
            this.paused = !this.paused;
            if (this.paused) {
                this.physics.pause();
                this.time.paused = true;
                this.pauseOverlay = this.createText(this.worldWidth / 2, this.worldHeight / 2, 'PAUSA', 16, PALETTE.yellow);
                this.pauseOverlay.setDepth(200);
                this.refreshTextResolution();
            }
            else {
                this.physics.resume();
                this.time.paused = false;
                this.pauseOverlay?.destroy();
                this.pauseOverlay = null;
            }
        }
        /* ------------------------------ Puntuación ----------------------------- */
        addScore(points) {
            this.score += points;
            this.hud.setScore(this.score);
        }
        updateLevel() {
            const nextLevel = Math.min(MAX_LEVEL, 1 + Math.floor(this.kills / KILLS_PER_LEVEL));
            if (nextLevel !== this.level) {
                this.level = nextLevel;
                this.hud.setLevel(this.level);
                this.restartSpawnTimer();
                this.flashMessage(`NIVEL ${this.level}`);
            }
        }
        /** Reinicia el temporizador de aparición con la dificultad actual. */
        restartSpawnTimer() {
            this.spawnTimer?.remove();
            const delay = Math.max(250, 700 - (this.level - 1) * 45);
            this.spawnTimer = this.time.addEvent({
                delay,
                loop: true,
                callback: () => this.spawnEnemy()
            });
        }
        spawnEnemy() {
            if (this.gameOver) {
                return;
            }
            const kind = Phaser.Math.Between(0, ENEMY_TYPE_COUNT - 1);
            const margin = 14;
            const x = Phaser.Math.Between(margin, Math.max(margin + 1, Math.floor(this.worldWidth - margin)));
            const enemy = new Enemy(this, x, ENEMY_SPAWN_Y, kind);
            this.enemies.add(enemy);
        }
        /* ------------------------------ Efectos -------------------------------- */
        explodeAt(x, y) {
            const boom = this.add.sprite(x, y, ATLAS, 'boom-0');
            boom.setDepth(20);
            boom.setScale(1.8);
            boom.play('boom');
            // Se expande rápido y se desvanece al final: lectura clara del impacto.
            this.tweens.add({
                targets: boom,
                scale: 4.6,
                duration: 420,
                ease: 'Quad.easeOut'
            });
            this.tweens.add({
                targets: boom,
                alpha: 0,
                delay: 120,
                duration: 300,
                ease: 'Quad.easeIn',
                onComplete: () => boom.destroy()
            });
        }
        flashMessage(message) {
            const text = this.createText(this.worldWidth / 2, this.worldHeight * 0.34, message, 10, PALETTE.green);
            text.setDepth(150);
            text.setAlpha(0);
            this.refreshTextResolution();
            this.tweens.add({
                targets: text,
                alpha: { from: 0, to: 1 },
                y: '-=6',
                duration: 180,
                yoyo: true,
                hold: 520,
                onComplete: () => text.destroy()
            });
        }
    }
    class GameOverScene extends WorldScene {
        constructor() {
            super('GameOver');
            this.payload = { score: 0, level: 1, best: 0 };
        }
        init(data) {
            this.payload = data;
        }
        build() {
            this.overlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.78).setDepth(300);
            this.title = this.createText(0, 0, 'GAME OVER', 16, PALETTE.red);
            this.title.setDepth(301);
            const scoreLine = `PUNTOS ${String(this.payload.score).padStart(6, '0')}`;
            this.scoreLabel = this.createText(0, 0, scoreLine, 8, PALETTE.white);
            this.scoreLabel.setDepth(301);
            const bestLine = this.payload.score >= this.payload.best && this.payload.score > 0
                ? '¡NUEVO RÉCORD!'
                : `RÉCORD ${String(this.payload.best).padStart(6, '0')}`;
            this.bestLabel = this.createText(0, 0, bestLine, 7, PALETTE.orange);
            this.bestLabel.setDepth(301);
            this.button = this.add.rectangle(0, 0, 132, 34, PALETTE.darkBlue).setDepth(301);
            this.button.setStrokeStyle(2, PALETTE.blue);
            this.buttonLabel = this.createText(0, 0, 'REINTENTAR', 9, PALETTE.green);
            this.buttonLabel.setDepth(302);
            this.menuButton = this.add.rectangle(0, 0, 132, 26, 0x000000).setDepth(301);
            this.menuButton.setStrokeStyle(1, PALETTE.darkGrey);
            this.menuLabel = this.createText(0, 0, 'MENÚ', 7, PALETTE.lavender);
            this.menuLabel.setDepth(302);
            this.configureButtons();
            this.cameras.main.fadeIn(200, 0, 0, 0);
        }
        layout() {
            const width = this.worldWidth;
            const height = this.worldHeight;
            this.overlay.setPosition(width / 2, height / 2);
            this.overlay.setSize(width, height);
            this.title.setPosition(width / 2, height * 0.26);
            this.scoreLabel.setPosition(width / 2, height * 0.4);
            this.bestLabel.setPosition(width / 2, height * 0.47);
            this.button.setPosition(width / 2, height * 0.62);
            this.buttonLabel.setPosition(width / 2, height * 0.62);
            this.menuButton.setPosition(width / 2, height * 0.62 + 42);
            this.menuLabel.setPosition(width / 2, height * 0.62 + 42);
            this.refreshTextResolution();
        }
        configureButtons() {
            this.button.setInteractive({ useHandCursor: true });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
                this.button.setFillStyle(PALETTE.blue);
                this.buttonLabel.setColor(css(PALETTE.darkBlue));
            });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
                this.button.setFillStyle(PALETTE.darkBlue);
                this.buttonLabel.setColor(css(PALETTE.green));
            });
            this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.retry());
            this.menuButton.setInteractive({ useHandCursor: true });
            this.menuButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
                this.menuButton.setFillStyle(PALETTE.darkBlue);
            });
            this.menuButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
                this.menuButton.setFillStyle(0x000000);
            });
            this.menuButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
                // Hay que detener la partida: si queda pausada, se dibuja por encima
                // del menú porque su escena va después en la lista de escenas.
                this.scene.stop('Game');
                this.scene.start('Menu');
            });
            const keyboard = this.input.keyboard;
            if (keyboard) {
                keyboard.on('keydown-ENTER', () => this.retry());
                keyboard.on('keydown-SPACE', () => this.retry());
            }
        }
        retry() {
            this.scene.stop('Game');
            this.scene.start('Game');
        }
    }
    /* ===========================================================================
     * 13. ARRANQUE
     * ======================================================================== */
    const CONFIG = {
        type: Phaser.AUTO,
        parent: 'game',
        backgroundColor: '#000000',
        // `pixelArt` desactiva el suavizado: los píxeles se ven duros y nítidos.
        pixelArt: true,
        roundPixels: true,
        scale: {
            // El lienzo se ajusta al tamaño del contenedor (el viewport completo).
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: window.innerWidth,
            height: window.innerHeight
        },
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: 0 },
                debug: false
            }
        },
        scene: [BootScene, MenuScene, GameScene, GameOverScene]
    };
    /**
     * Espera a la fuente pixel antes de crear el juego: los textos de Phaser se
     * rasterizan una sola vez, así que hay que asegurarse de que la fuente ya
     * está disponible.
     *
     * La espera está limitada a 2,5 s: si el CDN de fuentes falla o se cuelga,
     * el juego arranca igualmente con la tipografía de reserva.
     */
    const waitForPixelFont = () => {
        const fonts = document.fonts;
        if (!fonts) {
            return Promise.resolve();
        }
        const timeout = new Promise((resolve) => {
            window.setTimeout(resolve, 2500);
        });
        const loaded = fonts
            .load('16px "Press Start 2P"')
            .then(() => fonts.ready)
            .then(() => undefined)
            .catch(() => undefined);
        return Promise.race([loaded, timeout]);
    };
    waitForPixelFont().then(() => {
        new Phaser.Game(CONFIG);
    });
})(SpaceEaters || (SpaceEaters = {}));
