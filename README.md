# SPACE EATERS — Phaser 3 + TypeScript

Shooter vertical retro (8 bits) construido con **Phaser 3** y **TypeScript estricto**,
usando exclusivamente los sprites del paquete de assets incluido.

Trabajo individual del taller *«Setup, Desarrollo y Despliegue con Phaser 3»*.

---

## 1. Contenido del proyecto

```
.
├── index.html                          # Página del juego (pantalla completa + CDN de Phaser)
├── game.ts                             # Código fuente: toda la lógica del juego
├── game.js                             # Salida compilada de game.ts (la carga index.html)
├── tsconfig.json                       # Configuración de TypeScript (modo estricto)
├── package.json                        # Scripts de compilación y dependencias de desarrollo
└── assets/
    ├── pico8_invaders_sprites_LARGE.png  # Atlas principal (sprites de 8x8)
    ├── pico8_invaders_sprites.png        # Atlas alternativo (mismo formato)
    └── pico8_invaders_SPLASH.png         # Captura promocional del paquete
```

`node_modules/` solo contiene las herramientas de compilación (`typescript` y los
tipos de `phaser`). **No se publica**: en el navegador Phaser llega desde el CDN.

---

## 2. Cómo ejecutarlo en local

El juego carga imágenes y scripts, así que necesita servirse por HTTP
(abrir `index.html` con doble clic no funciona por las restricciones de `file://`).

```bash
# Opción A — extensión Live Server de VS Code
# Clic derecho sobre index.html -> "Open with Live Server"

# Opción B — servidor de Python
python -m http.server 8080
# http://localhost:8080

# Opción C — script incluido en package.json
npm run serve
```

---

## 3. Cómo recompilar el TypeScript

`game.js` ya está compilado y listo, pero si modificas `game.ts`:

```bash
npm install      # solo la primera vez
npm run build    # tsc -> genera game.js
npm run watch    # recompila al guardar
```

`tsconfig.json` activa `strict`, `noImplicitOverride`, `noUnusedLocals`,
`noUnusedParameters` y `noImplicitReturns`. El archivo no tiene `import`/`export`,
por lo que `tsc` emite un **script clásico**: `index.html` lo carga con una
etiqueta `<script>` normal, sin bundler.

---

## 4. Controles

| Acción            | Tecla / ratón                    |
| ----------------- | -------------------------------- |
| Mover la nave     | Flechas ← ↑ → ↓ o `W A S D`      |
| Disparar          | Clic izquierdo (mantener = ráfaga) o `Espacio` |
| Pausa             | `P` o `Esc`                      |
| Silenciar audio   | `M`                              |
| Jugar / reintentar| `Enter` o `Espacio` en los menús |

En pantallas táctiles: arrastrar el dedo mueve la nave y tocando se dispara.

---

## 5. Mecánicas implementadas

- **Pantalla de inicio** con logotipo animado y botón **PLAY**. La partida no
  empieza hasta pulsarlo (o `Enter`).
- **Jugador**: 3 vidas, movimiento en 8 direcciones, disparo con el ratón y
  1,6 s de invulnerabilidad con parpadeo tras recibir un impacto.
- **Enemigos**: 8 tipos distintos, aparecen solo por la parte superior y caen
  **rastreando horizontalmente** la posición del jugador (interpolación suave,
  no teletransporte). Si esquivan al jugador, siguen cayendo y desaparecen al
  salir de pantalla.
- **Colisiones**: bala ↔ enemigo destruye al enemigo y lanza la animación de
  explosión; enemigo ↔ jugador cuesta 1 vida.
- **Puntuación** por tipo de enemigo, **récord** guardado en `localStorage` y
  **dificultad progresiva** (más nivel = aparecen antes y más rápido).
- **Audio 8 bits** sintetizado con WebAudio (el paquete de assets no trae sonidos).
- **Efectos**: explosión animada, sacudida de cámara, destello al recibir daño,
  campo de estrellas con parallax y llama del motor.

---

## 6. Cómo se usan los assets

`assets/pico8_invaders_sprites_LARGE.png` es una hoja de 128×128 con sprites de
8×8 en una rejilla de 16×16 celdas. Usa **negro puro como fondo opaco**
(convención PICO-8), así que `BootScene` lo recorta en tiempo de ejecución:

1. Carga la imagen con `this.load.image`.
2. La dibuja en un `<canvas>` y recorre los píxeles: todo `#000000` pasa a alfa 0.
3. Registra el resultado como textura (`this.textures.addCanvas`).
4. Define cada sprite con `texture.add(nombre, 0, x, y, 8, 8)`.

Así los sprites se superponen sin cajas negras y **el PNG original no se modifica**.

Frames usados (columna.fila de la rejilla de 8×8):

| Sprite            | Celda        |
| ----------------- | ------------ |
| Nave del jugador  | `0.0`        |
| 8 enemigos (2 frames) | `3.0`–`10.0` y `3.1`–`10.1` |
| Bala              | `1.3`        |
| Explosión         | `6.4`, `5.4`, `2.4` |
| Corazón (vidas)   | `4.7`        |
| Logotipo          | bloque `(72, 40)` de 48×24 |

---

## 7. Escala y cámara (pantalla completa)

- `scale.mode = Phaser.Scale.RESIZE`: el lienzo mide **siempre** el viewport.
- Se calcula un **zoom entero** `z = max(1, floor(min(ancho/320, alto/180)))`, de
  modo que el mundo lógico nunca baja de 320×180 y los píxeles se ven nítidos
  (sin interpolación).
- El mundo mide exactamente `ancho/z` × `alto/z` y la cámara se centra en él:
  no hay barras negras ni recortes en ninguna relación de aspecto.
- `scale.on('resize')` recalcula zoom, límites físicos, HUD y posición del
  jugador, y ajusta la resolución interna de los textos para que no se vean
  borrosos al ampliar.

---

## 8. Despliegue en GitHub Pages

1. Crea el repositorio `apellidos-nombres-jueg-gr3` (público).
2. Sube el proyecto:

   ```bash
   git init
   git add .
   git commit -m "feat: space eaters con phaser 3 y typescript"
   git branch -M main
   git remote add origin https://github.com/<usuario>/apellidos-nombres-jueg-gr3.git
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main →
   carpeta `/ (root)` → Save**.
4. Espera unos minutos y abre `https://<usuario>.github.io/apellidos-nombres-jueg-gr3/`.

Todas las rutas son relativas (`game.js`, `assets/...`), así que funcionan igual
en la raíz del dominio o en un subdirectorio como el de GitHub Pages.
