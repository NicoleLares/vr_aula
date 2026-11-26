
import * as CANNON from 'cannon-es';
import { FIXED_STEP, WORKSPACE } from './config.js';

// Cannon-es sigue siendo la fuente de verdad de la simulacion.
// Los agarres cinemáticos se validan contra todos los colisionadores.
export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;
  world.solver.iterations = 18;
  world.solver.tolerance = 0.0008;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.defaultContactMaterial.friction = 0.57;
  world.defaultContactMaterial.restitution = 0.10;
  world.defaultContactMaterial.contactEquationStiffness = 1e7;
  world.defaultContactMaterial.contactEquationRelaxation = 4;
  world.defaultContactMaterial.frictionEquationStiffness = 1e7;

  const obstacles = [];
  let accumulator = 0;

  function staticBox(x, y, z, width, height, depth, rotationY = 0) {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
    body.position.set(x, y, z);
    body.quaternion.setFromEuler(0, rotationY, 0);
    body.aabbNeedsUpdate = true;
    world.addBody(body);
    const inverse = new CANNON.Quaternion();
    inverse.setFromEuler(0, -rotationY, 0);
    obstacles.push({
      x, y, z, rotationY,
      inverse,
      cos: Math.cos(rotationY), sin: Math.sin(rotationY),
      worldMin: { x: x - (Math.abs(Math.cos(rotationY))*width + Math.abs(Math.sin(rotationY))*depth)/2,
        y: y-height/2, z: z-(Math.abs(Math.sin(rotationY))*width + Math.abs(Math.cos(rotationY))*depth)/2 },
      worldMax: { x: x + (Math.abs(Math.cos(rotationY))*width + Math.abs(Math.sin(rotationY))*depth)/2,
        y: y+height/2, z: z+(Math.abs(Math.sin(rotationY))*width + Math.abs(Math.cos(rotationY))*depth)/2 },
      min: { x: -width / 2, y: -height / 2, z: -depth / 2 },
      max: { x: width / 2, y: height / 2, z: depth / 2 }
    });
    return body;
  }

  const floor = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  function step(delta) {
    accumulator += Math.min(Math.max(delta, 0), 0.055);
    let substeps = 0;
    while (accumulator >= FIXED_STEP && substeps < 4) {
      world.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      substeps++;
    }
    if (substeps === 4) accumulator = 0;
  }

  function resetClock() { accumulator = 0; }

  // Profundidad AABB: 0 significa sin interseccion.
  // Comparar el solapamiento anterior y posterior evita el bloqueo del agarre
  // cuando una figura ya estaba ligeramente encimada a un borde.
  function overlapDepth(aMin, aMax, bMin, bMax) {
    const ox = Math.min(aMax.x, bMax.x) - Math.max(aMin.x, bMin.x);
    const oy = Math.min(aMax.y, bMax.y) - Math.max(aMin.y, bMin.y);
    const oz = Math.min(aMax.z, bMax.z) - Math.max(aMin.z, bMin.z);
    return ox > 0 && oy > 0 && oz > 0 ? Math.min(ox, oy, oz) : 0;
  }

  const candidateMin = new CANNON.Vec3();
  const candidateMax = new CANNON.Vec3();
  const initialMin = new CANNON.Vec3();
  const initialMax = new CANNON.Vec3();
  const candidatePosition = new CANNON.Vec3();
  const initialPosition = new CANNON.Vec3();

  const localCandidate = new CANNON.Vec3();
  const localInitial = new CANNON.Vec3();
  const localQ = new CANNON.Quaternion();
  const localNextMin = new CANNON.Vec3(), localNextMax = new CANNON.Vec3();
  const localPrevMin = new CANNON.Vec3(), localPrevMax = new CANNON.Vec3();
  function toObstacleLocal(position, obstacle, out) {
    const dx = position.x - obstacle.x, dz = position.z - obstacle.z;
    out.set(obstacle.cos*dx - obstacle.sin*dz, position.y - obstacle.y,
      obstacle.sin*dx + obstacle.cos*dz);
  }

  // Se acepta cualquier movimiento que NO cree una nueva penetracion ni
  // agrave una ya existente. Así una pieza atrapada puede retroceder o deslizarse.
  function safeForHeld(x, y, z, heldBody, from = heldBody?.position) {
    if (!heldBody?.shapes?.length || !from) return false;
    if (x < WORKSPACE.minX || x > WORKSPACE.maxX ||
        y < WORKSPACE.minY || y > WORKSPACE.maxY ||
        z < WORKSPACE.minZ || z > WORKSPACE.maxZ) return false;

    const shape = heldBody.shapes[0];
    candidatePosition.set(x, y, z);
    initialPosition.set(from.x, from.y, from.z);
    shape.calculateWorldAABB(candidatePosition, heldBody.quaternion, candidateMin, candidateMax);
    shape.calculateWorldAABB(initialPosition, heldBody.quaternion, initialMin, initialMax);
    if (candidateMin.y < 0.008) return false;

    function wouldPenetrateMore(bMin, bMax) {
      const next = overlapDepth(candidateMin, candidateMax, bMin, bMax);
      if (next <= 0.0002) return false;
      const before = overlapDepth(initialMin, initialMax, bMin, bMax);
      // No permitimos nuevas intersecciones; sí escapar de las existentes.
      return before <= 0.0002 || next > before + 0.00001;
    }

    for (const obstacle of obstacles) {
      if (overlapDepth(candidateMin, candidateMax, obstacle.worldMin, obstacle.worldMax) <= 0) continue;
      if (!obstacle.rotationY) {
        if (wouldPenetrateMore(obstacle.worldMin, obstacle.worldMax)) return false;
        continue;
      }
      // Evaluar la pieza en el sistema local de cada caja orientada.
      // La envolvente de la pieza es conservadora, pero no se usa la AABB
      // global de una mesa girada (que bloquearía espacios vacíos).
      toObstacleLocal(candidatePosition, obstacle, localCandidate);
      toObstacleLocal(initialPosition, obstacle, localInitial);
      obstacle.inverse.mult(heldBody.quaternion, localQ);
      shape.calculateWorldAABB(localCandidate, localQ, localNextMin, localNextMax);
      const next = overlapDepth(localNextMin, localNextMax, obstacle.min, obstacle.max);
      if (next <= .0002) continue;
      shape.calculateWorldAABB(localInitial, localQ, localPrevMin, localPrevMax);
      const before = overlapDepth(localPrevMin, localPrevMax, obstacle.min, obstacle.max);
      if (before <= .0002 || next > before + .00001) return false;
    }

    for (const other of world.bodies) {
      if (other === heldBody ||
          (other.type !== CANNON.Body.DYNAMIC && other.type !== CANNON.Body.KINEMATIC)) {
        continue;
      }
      if (other.aabbNeedsUpdate) other.updateAABB();
      if (wouldPenetrateMore(other.aabb.lowerBound, other.aabb.upperBound)) return false;
    }
    return true;
  }

  return { world, obstacles, staticBox, step, resetClock, safeForHeld };
}
