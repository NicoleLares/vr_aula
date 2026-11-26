
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { WORKSPACE, insideBinXZ } from './config.js';

// Manipulacion cinemática con raycasting + pinza WebXR.
// Mantiene las piezas fisicas, pero hace el seguimiento de la mano mas agil.
export function createInteraction(lab, hands, game, options = {}) {
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.03;
  raycaster.far = 3.6;

  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const target = new THREE.Vector3();
  const current = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const accepted = new THREE.Vector3();
  const trial = new THREE.Vector3();

  const grabs = new Map();
  const claimed = new Set();
  const pieceByMesh = new Map(lab.pieces.map(p => [p.mesh, p]));
  const meshes = lab.pieces.map(p => p.mesh);
  let previousTime = performance.now();

  // Seguimiento ligero: responde mas rapido que el paso limitado anterior.
  const FOLLOW_RATE = 22;
  const MAX_FOLLOW_SPEED = 3.0;
  const SWEEP_STEP = 0.012;

  function updateRay(slot) {
    slot.controller.updateMatrixWorld(true);
    rayOrigin.setFromMatrixPosition(slot.controller.matrixWorld);
    rayDirection.set(0, 0, -1)
      .transformDirection(slot.controller.matrixWorld).normalize();
    raycaster.set(rayOrigin, rayDirection);
  }

  function nearestPiece() {
    const hit = raycaster.intersectObjects(meshes, false).find(h => {
      const piece = pieceByMesh.get(h.object);
      return piece && game.canGrab(piece) && !claimed.has(piece.id);
    });
    return hit ? { piece: pieceByMesh.get(hit.object), distance: hit.distance } : null;
  }

  function nearestButton() {
    // El marcador está ahora junto al pizarrón, más lejos del centro.
    const oldFar = raycaster.far;
    raycaster.far = 5.0;
    const hit = raycaster.intersectObjects(lab.hud.buttons, false)[0];
    raycaster.far = oldFar;
    return hit ? { button: hit.object, distance: hit.distance } : null;
  }

  function grab(slot, selected) {
    const piece = selected.piece;
    if (!piece || claimed.has(piece.id) || !game.onGrab(piece)) return;
    const body = piece.body;
    const offset = new THREE.Vector3().copy(body.position)
      .sub(rayOrigin.clone().addScaledVector(rayDirection, selected.distance));
    body.type = CANNON.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.wakeUp();
    grabs.set(slot.index, {
      piece,
      distance: Math.max(0.20, selected.distance),
      offset,
      previous: new THREE.Vector3().copy(body.position),
      velocity: new THREE.Vector3()
    });
    claimed.add(piece.id);
  }

  // Intenta primero el vector completo y, si hay choque, desliza por ejes.
  // Cada paso es pequeño: no atraviesa mesas, paredes ni otras figuras.
  function advanceWithSliding(body, from, intended) {
    if (lab.physics.safeForHeld(intended.x, intended.y, intended.z, body, from)) {
      return intended.clone();
    }
    const pos = from.clone();
    const changes = [
      { axis: 'y', delta: intended.y - pos.y },
      { axis: 'x', delta: intended.x - pos.x },
      { axis: 'z', delta: intended.z - pos.z }
    ];
    // Priorizar subir el objeto al liberarlo de los bordes.
    changes.sort((a, b) => (a.axis === 'y' && a.delta > 0 ? -1 : 0) -
                            (b.axis === 'y' && b.delta > 0 ? -1 : 0) ||
                            Math.abs(b.delta) - Math.abs(a.delta));
    for (const item of changes) {
      if (Math.abs(item.delta) <= 0.00001) continue;
      trial.copy(pos);
      trial[item.axis] = intended[item.axis];
      if (lab.physics.safeForHeld(trial.x, trial.y, trial.z, body, pos)) {
        pos.copy(trial);
      }
    }
    return pos;
  }

  function move(slot, dt) {
    const held = grabs.get(slot.index);
    if (!held) return;
    const piece = held.piece;
    const body = piece.body;

    target.copy(rayOrigin)
      .addScaledVector(rayDirection, held.distance)
      .add(held.offset);
    target.x = THREE.MathUtils.clamp(target.x, WORKSPACE.minX, WORKSPACE.maxX);
    target.y = THREE.MathUtils.clamp(target.y, WORKSPACE.minY, WORKSPACE.maxY);
    target.z = THREE.MathUtils.clamp(target.z, WORKSPACE.minZ, WORKSPACE.maxZ);

    current.copy(body.position);
    delta.subVectors(target, current).multiplyScalar(1 - Math.exp(-FOLLOW_RATE * dt));
    const maxDistance = MAX_FOLLOW_SPEED * dt;
    if (delta.length() > maxDistance) delta.setLength(maxDistance);
    const segments = Math.max(1, Math.ceil(delta.length() / SWEEP_STEP));
    const smallStep = delta.clone().multiplyScalar(1 / segments);
    accepted.copy(current);

    for (let i = 0; i < segments; i++) {
      candidate.copy(accepted).add(smallStep);
      const next = advanceWithSliding(body, accepted, candidate);
      if (next.distanceToSquared(accepted) < 1e-12) break;
      accepted.copy(next);
    }

    const movedDistance = accepted.distanceTo(current);
    if (movedDistance > 0.00001) {
      body.position.set(accepted.x, accepted.y, accepted.z);
      body.aabbNeedsUpdate = true;
      body.wakeUp();

      for (const bin of lab.bins) {
        const insideOpening =
          insideBinXZ(bin, accepted.x, accepted.z, .075);
        if (insideOpening && accepted.y >= bin.rim - 0.035) {
          piece.enteredFromTop = true;
        }
      }

      const newVelocity = accepted.clone().sub(held.previous)
        .divideScalar(Math.max(dt, 0.009));
      held.velocity.lerp(newVelocity, 0.42);
      if (held.velocity.length() > 1.6) held.velocity.setLength(1.6);
      held.previous.copy(accepted);
    } else {
      // Sin movimiento real, no acumular un impulso antiguo al soltar.
      held.velocity.set(0, 0, 0);
      held.previous.copy(current);
    }
    body.velocity.setZero();
  }

  function release(index) {
    const held = grabs.get(index);
    if (!held) return;
    const body = held.piece.body;
    body.type = CANNON.Body.DYNAMIC;
    body.mass = 0.38;
    body.updateMassProperties();
    body.velocity.set(held.velocity.x, held.velocity.y, held.velocity.z);
    body.angularVelocity.setZero();
    body.wakeUp();
    game.onRelease(held.piece);
    claimed.delete(held.piece.id);
    grabs.delete(index);
  }

  function releaseAll() {
    for (const index of [...grabs.keys()]) release(index);
  }

  function activate(button) {
    const action = button?.userData?.action;
    if (action === 'start') game.start();
    if (action === 'reset') { releaseAll(); game.reset(); }
    if (action === 'exit') options.onExitVR?.();
  }

  function update() {
    hands.update();
    const now = performance.now();
    const dt = Math.max(0.009, Math.min((now - previousTime) / 1000, 0.055));
    previousTime = now;
    let chosenButton = null;

    for (const slot of hands.slots) {
      if (!slot.tracking) {
        if (grabs.has(slot.index)) release(slot.index);
        slot.laser.visible = false;
        slot.cursor.visible = false;
        continue;
      }
      updateRay(slot);
      if (grabs.has(slot.index)) {
        if (slot.justReleased || !slot.pressed) release(slot.index);
        else move(slot, dt);
        slot.setRayDistance(0.8);
        continue;
      }
      const buttonHit = nearestButton();
      const pieceHit = game.phase === 'active' ? nearestPiece() : null;
      const hitButton = buttonHit && (!pieceHit || buttonHit.distance < pieceHit.distance);
      slot.setRayDistance(hitButton ? buttonHit.distance : (pieceHit?.distance || 2.0));
      if (hitButton) chosenButton = buttonHit.button;
      if (slot.justPressed) {
        if (hitButton) activate(buttonHit.button);
        else if (pieceHit) grab(slot, pieceHit);
      }
    }
    lab.hud.setHoveredButton(chosenButton);
  }

  function stop() {
    releaseAll();
    hands.resetAll();
    lab.hud.setHoveredButton(null);
    game.pause();
  }

  function resume() { game.resume(); previousTime = performance.now(); }
  return { update, stop, resume, releaseAll };
}
