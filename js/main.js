
import * as THREE from 'three';

import { createLaboratoryScene } from './scene.js';
import { createHands } from './hands.js';
import { createGame } from './game.js';
import { createInteraction } from './interaction.js';

import {
  setRenderStatus,
  setCompatibility,
  setVRMessage,
  getVRButton
} from './ui.js';

// ==========================================
// ELEMENTOS DE LA INTERFAZ
// ==========================================

const container =
  document.getElementById('scene-container');

const enterVR = getVRButton();

const previewStart =
  document.getElementById('preview-start');

const previewReset =
  document.getElementById('preview-reset');

// ==========================================
// INICIALIZACIÓN
// ==========================================

async function initialize() {
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });

    renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, 1.5)
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.xr.enabled = true;

    renderer.xr.setReferenceSpaceType(
      'local-floor'
    );

    container.appendChild(renderer.domElement);

  } catch (err) {
    setRenderStatus(
      `Error al iniciar WebGL: ${err.message}`
    );

    setCompatibility(
      'No hay WebGL disponible.',
      false
    );

    console.error(err);
    return;
  }

  // ========================================
  // CREAR LABORATORIO
  // ========================================

  const lab = createLaboratoryScene();

  // ========================================
  // CARGAR AULA Y9
  // ========================================

  lab.loadAula().then(result => {
    if (result.loaded) {
      setRenderStatus(
        `Aula Y9 cargada (${result.width} × ${result.depth} m) · física 3D activa`
      );
    } else {
      setRenderStatus(
        'Falta AulaY9.glb: vista NEXUS original · física 3D activa'
      );

      console.info(
        'Exporta AulaY9.skp como GLB y colócalo en assets/models/AulaY9.glb.'
      );
    }
  });

  // ========================================
  // JUEGO Y SEGUIMIENTO DE MANOS
  // ========================================

  const game = createGame(lab);

  const hands = createHands(
    renderer,
    lab.scene
  );

  async function exitVR() {
    const session = renderer.xr.getSession();

    if (session) {
      await session.end();
    }
  }

  const interaction = createInteraction(
    lab,
    hands,
    game,
    {
      onExitVR: exitVR
    }
  );

  // ========================================
  // BOTONES DE ESCRITORIO
  // ========================================

  previewStart.addEventListener(
    'click',
    () => {
      game.start();
      game.unlockAudio();
    }
  );

  previewReset.addEventListener(
    'click',
    () => {
      interaction.releaseAll();
      game.reset();
    }
  );

  // ========================================
  // TAMAÑO DEL RENDERIZADO
  // ========================================

  function resize() {
    const width = Math.max(
      container.clientWidth,
      1
    );

    const height = Math.max(
      container.clientHeight,
      1
    );

    renderer.setSize(
      width,
      height,
      false
    );

    lab.camera.aspect = width / height;

    lab.camera.updateProjectionMatrix();
  }

  resize();

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(container);
  } else {
    window.addEventListener(
      'resize',
      resize
    );
  }

  // ========================================
  // CICLO DE ANIMACIÓN Y FÍSICA
  // ========================================

  let previous = null;

  renderer.setAnimationLoop(time => {
    const t = time / 1000;

    const dt = previous === null
      ? 0
      : Math.min(
        Math.max(t - previous, 0),
        0.055
      );

    previous = t;

    // Actualizar manos solo en VR.
    if (renderer.xr.isPresenting) {
      interaction.update();
    }

    // Simulación física.
    if (game.phase !== 'paused') {
      lab.physics.step(dt);
    }

    // Sincronizar figuras con cuerpos físicos.
    lab.sync();

    // Actualizar juego y escenario.
    game.update(dt);
    lab.update(t);

    renderer.render(
      lab.scene,
      lab.camera
    );
  });

  setRenderStatus(
    'Simulación de gravedad activa · previsualización no inmersiva'
  );

  // ========================================
  // COMPROBAR WEBXR
  // ========================================

  if (!window.isSecureContext) {
    setCompatibility(
      'Requiere HTTPS o localhost.',
      false
    );
    return;
  }

  if (!navigator.xr) {
    setCompatibility(
      'WebXR no disponible en este navegador.',
      false
    );

    setVRMessage(
      'En computadora puedes inspeccionar la física. Para manos y VR usa Meta Quest Browser.'
    );

    return;
  }

  let supportsVR = false;

  try {
    supportsVR = await navigator.xr.isSessionSupported(
      'immersive-vr'
    );
  } catch (err) {
    console.warn('WebXR:', err);
  }

  if (!supportsVR) {
    setCompatibility(
      'Este navegador no admite immersive-vr.',
      false
    );

    setVRMessage(
      'Usa Meta Quest Browser para la sesión inmersiva.'
    );

    return;
  }

  setCompatibility(
    'Compatible con immersive-vr; falta verificar seguimiento real de manos.',
    true
  );

  setVRMessage(
    'Entra con Meta Quest Browser; usa la pinza para pulsar COMENZAR.'
  );

  // ========================================
  // INICIAR SESIÓN VR
  // ========================================

  renderer.xr.addEventListener(
    'sessionstart',
    () => {
      interaction.resume();

      enterVR.disabled = false;
      enterVR.textContent = 'Salir de VR';

      setVRMessage(
        'Sesión activa. Pulsa COMENZAR en el panel 3D.'
      );
    }
  );

  // ========================================
  // FINALIZAR SESIÓN VR
  // ========================================

  renderer.xr.addEventListener(
    'sessionend',
    () => {
      interaction.stop();
      previous = null;

      enterVR.disabled = false;
      enterVR.textContent = 'Entrar a realidad virtual';

      setVRMessage(
        'Sesión cerrada. El progreso se conserva y el tiempo queda en pausa.'
      );
    }
  );

  // ========================================
  // BOTÓN ENTRAR A VR
  // ========================================

  enterVR.addEventListener(
    'click',
    async () => {
      enterVR.disabled = true;

      try {
        if (renderer.xr.isPresenting) {
          await exitVR();
          return;
        }

        game.unlockAudio();

        const session =
          await navigator.xr.requestSession(
            'immersive-vr',
            {
              requiredFeatures: [
                'local-floor',
                'hand-tracking'
              ]
            }
          );

        try {
          await renderer.xr.setSession(session);
        } catch (error) {
          await session.end();
          throw error;
        }

      } catch (err) {
        console.error(
          'No se pudo iniciar VR:',
          err
        );

        setVRMessage(
          `No se pudo entrar con manos reales: ${err.message}`
        );

        enterVR.disabled = false;
      }
    }
  );

  // ========================================
  // CERRAR SESIÓN SI SALE DE LA PÁGINA
  // ========================================

  window.addEventListener(
    'beforeunload',
    () => {
      if (renderer.xr.getSession()) {
        exitVR();
      }
    }
  );

  // ========================================
  // HERRAMIENTAS DE DEPURACIÓN
  // ========================================

  window.__nexusDebug = {

    summary() {
      return {
        objects: lab.pieces.length,

        bins: lab.bins.length,

        tables: lab.tables.length,

        categories: Object.fromEntries(
          [...new Set(
            lab.pieces.map(p => p.category)
          )].map(c => [
            c,
            lab.pieces.filter(
              p => p.category === c
            ).length
          ])
        ),

        game: game.getStats(),

        physicsBodies:
          lab.physics.world.bodies.length
      };
    },

    reset() {
      interaction.releaseAll();
      game.reset();
    },

    aula() {
      return lab.getAulaStatus();
    }
  };
}

// ==========================================
// EJECUTAR APLICACIÓN
// ==========================================

initialize().catch(error => {
  console.error(
    'Error crítico de inicio:',
    error
  );

  setRenderStatus(
    `Error: ${error.message}`
  );

  setVRMessage(
    'Consulta Console en herramientas del navegador.'
  );
});
