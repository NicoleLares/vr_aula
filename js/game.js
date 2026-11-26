
import {
  CATEGORIES,
  TABLES,
  TABLE_TOP,
  localToWorldXZ,
  insideBinXZ,
  WORKSPACE
} from './config.js';

export function createGame(lab) {
  const { pieces, bins, hud } = lab;

  const counts = Object.fromEntries(
    CATEGORIES.map(c => [c.id, 0])
  );

  const times = Object.fromEntries(
    CATEGORIES.map(c => [c.id, null])
  );

  let phase = 'pending';
  let hits = 0;
  let errors = 0;
  let attempts = 0;
  let elapsed = 0;
  let runStart = 0;

  let message = 'Pulsa COMENZAR dentro del laboratorio';
  let noticeUntil = 0;
  let audioContext = null;
  let lastHudAt = 0;

  const nowMs = () => performance.now();

  // ==========================================
  // CRONOMETRO Y MENSAJES
  // ==========================================

  function elapsedSeconds(now = nowMs()) {
    return elapsed + (
      phase === 'active'
        ? (now - runStart) / 1000
        : 0
    );
  }

  function notify(text, duration = 1700) {
    message = text;
    noticeUntil = nowMs() + duration;
    lastHudAt = 0;
  }

  // ==========================================
  // AUDIO
  // ==========================================

  function unlockAudio() {
    try {
      const Audio =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!Audio) return;

      if (!audioContext) {
        audioContext = new Audio();
      }

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
    } catch (error) {
      console.warn('Audio no disponible', error);
    }
  }

  function tone(frequency, delay = 0, duration = .13) {
    if (
      !audioContext ||
      audioContext.state !== 'running'
    ) return;

    const when = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(
      .06, when + .014
    );
    gain.gain.exponentialRampToValueAtTime(
      .0001, when + duration
    );

    oscillator.start(when);
    oscillator.stop(when + duration + .01);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  function sound(type) {
    if (type === 'success') {
      tone(630);
      tone(840, .10);
    }

    if (type === 'error') {
      tone(240, 0, .22);
    }

    if (type === 'complete') {
      tone(530);
      tone(680, .14);
      tone(890, .29, .24);
    }
  }

  // ==========================================
  // INICIO, PAUSA Y REANUDACION
  // ==========================================

  function start() {
    if (phase !== 'pending') return;

    unlockAudio();
    phase = 'active';
    runStart = nowMs();

    notify(
      'Clasifica las veinte figuras en sus botes',
      2500
    );
  }

  function pause() {
    if (phase !== 'active') return;

    elapsed = elapsedSeconds();
    phase = 'paused';

    notify('Pausa: sesión VR cerrada');
  }

  function resume() {
    if (phase !== 'paused') return;

    phase = 'active';
    runStart = nowMs();

    notify('Partida reanudada');
  }

  // ==========================================
  // IDENTIFICAR PIRAMIDES
  // ==========================================

  function isPyramid(piece) {
    const name = String(
      `${piece.category || ''} ${piece.categoryName || ''}`
    )
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return (
      name.includes('piramid') ||
      name.includes('pyramid')
    );
  }

  // ==========================================
  // RESTAURAR COLOR DE UNA FIGURA
  // ==========================================

  function restorePieceColor(piece) {
    if (piece.originalEmissiveColor != null) {
      piece.mesh.material.emissive.setHex(
        piece.originalEmissiveColor
      );
    }

    piece.mesh.material.emissiveIntensity = .07;
    piece.warningUntil = null;
  }

  // ==========================================
  // AGARRAR FIGURAS
  // ==========================================

  function canGrab(piece) {
    return phase === 'active' &&
      ![
        'held',
        'classified',
        'recovering'
      ].includes(piece.state);
  }

  function onGrab(piece) {
    if (!canGrab(piece)) return false;

    // Guardar el color original la primera vez.
    if (piece.originalEmissiveColor == null) {
      piece.originalEmissiveColor =
        piece.mesh.material.emissive.getHex();
    }

    // Permite recuperar figuras equivocadas.
    restorePieceColor(piece);

    piece.state = 'held';
    piece.stillFor = 0;
    piece.containedFor = 0;
    piece.enteredFromTop = false;
    piece.recoveryAt = null;
    piece.floorSince = null;

    piece.mesh.material.emissiveIntensity = .35;

    return true;
  }

  function onRelease(piece) {
    if (piece.state !== 'held') return;

    piece.state = 'released';
    piece.releaseId++;

    piece.stillFor = 0;
    piece.containedFor = 0;
    piece.releasedAt = nowMs();
    piece.floorSince = null;

    piece.mesh.material.emissiveIntensity = .07;
  }

  // ==========================================
  // RECUPERAR FIGURAS DEL SUELO
  // ==========================================

  function findRecoveryPosition(piece) {
    const t = TABLES[piece.tableIndex];

    const options = [
      [-.36, -.14],
      [0, -.14],
      [.36, -.14],
      [-.18, .15],
      [.18, .15],
      [-.37, .16],
      [.37, .16],
      [0, .16]
    ];

    for (const [dx, dz] of options) {
      const { x, z } = localToWorldXZ(t, dx, dz);

      const free = pieces.every(other =>
        other === piece ||
        (
          Math.hypot(
            other.body.position.x - x,
            other.body.position.z - z
          ) > .255 ||
          Math.abs(
            other.body.position.y - TABLE_TOP
          ) > .65
        )
      );

      if (free) {
        return {
          x,
          y: TABLE_TOP + .17,
          z
        };
      }
    }

    return {
      ...piece.home,
      y: TABLE_TOP + .33
    };
  }

  function restore(piece) {
    lab.restore(
      piece,
      findRecoveryPosition(piece)
    );

    restorePieceColor(piece);

    piece.floorSince = null;
    piece.containedFor = 0;
    piece.stillFor = 0;
  }

  // ==========================================
  // REINICIAR PARTIDA
  // ==========================================

  function reset() {
    hits = 0;
    errors = 0;
    attempts = 0;
    elapsed = 0;
    runStart = 0;
    phase = 'pending';

    for (const category of CATEGORIES) {
      counts[category.id] = 0;
      times[category.id] = null;

      lab.markBinComplete?.(
        category.id,
        false
      );
    }

    lab.resetPositions();

    pieces.forEach(piece => {
      restorePieceColor(piece);
      piece.floorSince = null;
      piece.containedFor = 0;
      piece.stillFor = 0;
      piece.enteredFromTop = false;
    });

    lab.physics.resetClock();

    notify(
      'Nueva distribución. Pulsa COMENZAR.',
      2800
    );

    updateHUD(true);
  }

  // ==========================================
  // VALIDAR POSICION EN LA CAJA
  // ==========================================

  function isHorizontallyInside(piece, bin) {
    const p = piece.body.position;

    const margin = isPyramid(piece)
      ? .055
      : .075;

    return insideBinXZ(bin, p.x, p.z, margin);
  }

  function isContained(piece, bin) {
    const p = piece.body.position;

    if (!isHorizontallyInside(piece, bin)) {
      return false;
    }

    // Las piramides pueden quedar
    // inclinadas o recostadas.
    if (isPyramid(piece)) {
      return (
        p.y >= bin.floor + .025 &&
        p.y <= bin.rim + .10
      );
    }

    return (
      p.y >= bin.floor + .068 &&
      p.y <= bin.rim - .027
    );
  }

  // ==========================================
  // COMPROBAR ENTRADA AL RECIPIENTE
  // ==========================================

  function hasValidEntry(piece, bin) {
    if (piece.enteredFromTop) {
      return true;
    }

    // Para piramides, permitir el conteo
    // si su centro ya esta dentro del bote.
    if (isPyramid(piece)) {
      return (
        isContained(piece, bin) &&
        piece.body.position.y < bin.rim - .02
      );
    }

    return false;
  }

  // ==========================================
  // ESTABILIDAD DE FIGURAS
  // ==========================================

  function isStable(piece) {
    const v = piece.body.velocity;
    const av = piece.body.angularVelocity;

    const speed = Math.hypot(
      v.x, v.y, v.z
    );

    const rotationSpeed = Math.hypot(
      av.x, av.y, av.z
    );

    if (isPyramid(piece)) {
      return (
        speed < .32 &&
        rotationSpeed < 1.4
      );
    }

    return (
      speed < .19 &&
      rotationSpeed < .8
    );
  }

  // ==========================================
  // REGISTRAR INTENTO
  // ==========================================

  function registerAttempt(piece, bin) {
    // Un intento por cada liberacion.
    if (
      piece.countedReleaseId ===
      piece.releaseId
    ) return;

    piece.countedReleaseId = piece.releaseId;
    attempts++;

    if (piece.category === bin.id) {

      // ====================================
      // CLASIFICACION CORRECTA
      // ====================================

      hits++;
      counts[bin.id]++;

      piece.state = 'classified';

      restorePieceColor(piece);
      piece.mesh.material.emissiveIntensity = .23;

      sound('success');

      notify(
        `¡Correcto! ${piece.categoryName}: ${counts[bin.id]}/5`,
        2000
      );

      console.log(
        `[CORRECTO] ${piece.categoryName}: ${counts[bin.id]}/5`
      );

      // ====================================
      // CAJA COMPLETA
      // ====================================

      if (counts[bin.id] === 5) {

        times[bin.id] = elapsedSeconds();

        lab.markBinComplete?.(
          bin.id,
          true
        );

        notify(
          `¡${bin.name} COMPLETADO! 5/5`,
          2500
        );
      }

      // ====================================
      // OBJETIVO LOGRADO
      // ====================================

      if (hits === 20) {

        elapsed = elapsedSeconds();
        phase = 'completed';

        notify(
          `¡OBJETIVO LOGRADO! 20/20 · Precisión: ${(100 * hits / attempts).toFixed(1)}%`,
          15000
        );

        sound('complete');
      }

    } else {

      // ====================================
      // CAJA INCORRECTA
      // ====================================

      errors++;

      // NUEVA LOGICA:
      // La figura queda en el recipiente.
      // No se programa ninguna recuperacion.
      // Se puede volver a agarrar.

      piece.state = 'misplaced';
      piece.recoveryAt = null;

      if (piece.originalEmissiveColor == null) {
        piece.originalEmissiveColor =
          piece.mesh.material.emissive.getHex();
      }

      piece.mesh.material.emissive.setHex(
        0xff3535
      );

      piece.mesh.material.emissiveIntensity = .60;

      // El color rojo desaparece,
      // pero la figura permanece en la caja.
      piece.warningUntil = nowMs() + 2400;

      sound('error');

      notify(
        `¡Caja equivocada! ${piece.categoryName}. Recógela y corrígela.`,
        2600
      );

      console.log(
        `[ERROR] ${piece.categoryName} en ${bin.name}. La figura permanece en la caja.`
      );
    }

    updateHUD(true);
  }

  // ==========================================
  // PROTECCION CONTRA CAIDAS
  // ==========================================

  const FLOOR_THRESHOLD = .33;
  const FLOOR_CONFIRM_MS = 350;
  const RETURN_DELAY_MS = 950;

  // ==========================================
  // FISICA Y CLASIFICACION
  // ==========================================

  function updatePhysicsRules(dt) {
    if (phase !== 'active') return;

    const now = nowMs();

    for (const piece of pieces) {

      // ====================================
      // RECUPERAR FIGURA CAIDA
      // ====================================

      if (piece.state === 'recovering') {
        if (now >= piece.recoveryAt) {
          restore(piece);
        }
        continue;
      }

      // Figuras clasificadas o sujetadas.
      if (
        piece.state === 'classified' ||
        piece.state === 'held'
      ) continue;

      const p = piece.body.position;

      // ====================================
      // QUITAR DESTELLO DE ERROR
      // ====================================

      if (
        piece.state === 'misplaced' &&
        piece.warningUntil != null &&
        now >= piece.warningUntil
      ) {
        restorePieceColor(piece);
      }

      // ====================================
      // FIGURA QUE CAE AL SUELO
      // ====================================

      if (p.y < FLOOR_THRESHOLD) {

        if (piece.floorSince == null) {
          piece.floorSince = now;
        }

        if (
          now - piece.floorSince >=
          FLOOR_CONFIRM_MS
        ) {
          piece.state = 'recovering';
          piece.recoveryAt =
            now + RETURN_DELAY_MS;

          piece.body.velocity.setZero();
          piece.body.angularVelocity.setZero();

          piece.mesh.material.emissive.setHex(
            0xffd166
          );

          piece.mesh.material.emissiveIntensity = .42;

          notify(
            `${piece.categoryName}: vuelve a su mesa.`,
            1900
          );
        }

        continue;
      }

      piece.floorSince = null;

      // ====================================
      // PIEZA EN CAJA INCORRECTA
      // ====================================

      if (piece.state === 'misplaced') {
        // No se devuelve a su mesa.
        // No cuenta nuevamente el mismo error.
        // Solo se mueve mediante la fisica,
        // o cuando el usuario la agarre.
      }

      // ====================================
      // CLASIFICAR PIEZAS RECIEN SOLTADAS
      // ====================================

      else if (
        piece.state === 'released' ||
        piece.state === 'stabilizing'
      ) {

        let inside = null;

        for (const bin of bins) {

          if (
            isHorizontallyInside(piece, bin) &&
            p.y >= bin.rim - .04
          ) {
            piece.enteredFromTop = true;
          }

          if (isContained(piece, bin)) {
            inside = bin;
            break;
          }
        }

        if (
          inside &&
          hasValidEntry(piece, inside)
        ) {

          piece.containedFor =
            (piece.containedFor || 0) +
            Math.min(dt, .065);

          if (isStable(piece)) {
            piece.stillFor += Math.min(dt, .065);
          } else {
            piece.stillFor = 0;
          }

          piece.state = 'stabilizing';

          const requiredTime = isPyramid(piece)
            ? .45
            : .64;

          // Una piramide puede presentar
          // pequeñas oscilaciones al apoyarse.
          const pyramidFallback =
            isPyramid(piece) &&
            piece.containedFor >= 1.8 &&
            Math.hypot(
              p.x - inside.x,
              p.z - inside.z
            ) < Math.min(
              inside.width,
              inside.depth
            ) / 2 - .055 &&
            Math.hypot(
              piece.body.velocity.x,
              piece.body.velocity.y,
              piece.body.velocity.z
            ) < .5 &&
            Math.hypot(
              piece.body.angularVelocity.x,
              piece.body.angularVelocity.y,
              piece.body.angularVelocity.z
            ) < 2.5;

          if (
            piece.stillFor >= requiredTime ||
            pyramidFallback
          ) {
            registerAttempt(piece, inside);
          }

        } else {

          piece.stillFor = 0;
          piece.containedFor = 0;
          piece.state = 'released';
        }
      }

      // ====================================
      // LIMITES DEL LABORATORIO
      // ====================================

      if (
        p.x < WORKSPACE.minX - .45 ||
        p.x > WORKSPACE.maxX + .45 ||
        p.z > WORKSPACE.maxZ + .45 ||
        p.z < WORKSPACE.minZ - .45 ||
        p.y < -.9
      ) {
        restore(piece);

        notify(
          'Pieza recuperada de los límites del laboratorio.'
        );
      }
    }
  }

  // ==========================================
  // ACTUALIZAR PANEL HUD
  // ==========================================

  function updateHUD(force = false) {
    const now = nowMs();

    if (!force && now - lastHudAt < 180) {
      return;
    }

    lastHudAt = now;

    if (noticeUntil && now > noticeUntil) {
      noticeUntil = 0;

      if (phase === 'pending') {
        message = 'Pulsa COMENZAR para iniciar';
      } else if (phase === 'completed') {
        message = '¡Todos los recipientes completos!';
      } else if (phase === 'paused') {
        message = 'Partida pausada';
      } else {
        message =
          'Selecciona, suelta y deja estabilizar la figura';
      }
    }

    hud.update({
      phase,
      hits,
      errors,
      attempts,

      precision: attempts
        ? (hits / attempts) * 100
        : 0,

      elapsed: elapsedSeconds(now),

      counts,
      times,
      message
    });

    const progress = document.getElementById(
      'preview-progress'
    );

    if (progress) {
      const prefix = phase === 'completed'
        ? '¡OBJETIVO LOGRADO! · '
        : '';

      progress.textContent =
        `${prefix}${hits}/20 · ${errors} errores · ${elapsedSeconds(now).toFixed(0)} s`;
    }
  }

  // ==========================================
  // ACTUALIZACION GENERAL
  // ==========================================

  function update(dt) {
    updatePhysicsRules(dt);
    updateHUD();
  }

  updateHUD(true);

  return {
    start,
    pause,
    resume,
    reset,
    onGrab,
    onRelease,
    canGrab,
    unlockAudio,
    update,

    get phase() {
      return phase;
    },

    getStats: () => ({
      phase,
      hits,
      errors,
      attempts,
      elapsed: elapsedSeconds(),
      counts: { ...counts },
      times: { ...times }
    })
  };
}
