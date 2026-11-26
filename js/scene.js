
import * as THREE from 'three';
import { createPhysics } from './physics.js';
import { createPieces } from './objects.js';
import { createHUD } from './hud.js';
import { createAulaEnvironment } from './aula.js';
import { CATEGORIES, TABLES, TABLE, TABLE_TOP, BIN_X, BIN_Z, BIN, BIN_FLOOR, BIN_RIM, BIN_STATION, HUD_POSITION, localToWorldXZ } from './config.js';

function labelTexture(text, accent = '#ffffff', width = 512, height = 160) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c1b2c'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent; ctx.lineWidth = 8; ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.font = 'bold 57px Arial'; ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2, width - 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLaboratoryScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08101e);
  scene.fog = new THREE.Fog(0x08101e, 16, 32); // mayor distancia para el aula
  const camera = new THREE.PerspectiveCamera(67, 1, 0.05, 55);
  // Cámara oblicua SOLO para la vista previa de escritorio.
  // En Meta Quest, WebXR usa la pose real (local-floor) del visor.
  camera.position.set(0, 2.20, 2.85);
  camera.lookAt(0, 1.25, -1.65);
  const physics = createPhysics();
  scene.add(new THREE.HemisphereLight(0xcce6ff, 0x253247, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-1.2, 4.1, 1.9); scene.add(sun);
  const violet = new THREE.PointLight(0x7a69ff, 10, 6);
  violet.position.set(1.6, 2.5, -2.0); scene.add(violet);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x101b2b, roughness: .92 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -.003;
  scene.add(floorMesh);
  const grid = new THREE.GridHelper(12, 40, 0x345675, 0x1b3047);
  grid.position.y = .005; scene.add(grid);
  // Marca de suelo no colisionable para orientar al usuario VR (en el centro).
  const positionRing = new THREE.Mesh(new THREE.RingGeometry(.22, .25, 48),
    new THREE.MeshBasicMaterial({ color: 0x4cd9f4, transparent: true, opacity: .54, side: THREE.DoubleSide }));
  positionRing.rotation.x = -Math.PI / 2;
  positionRing.position.set(0, .012, 0);
  scene.add(positionRing);

  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x233951, roughness: .48, metalness: .22 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x18263a, roughness: .6, metalness: .16 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4cd9f4 });
  function solidBox(x, y, z, w, h, d, material, rotationY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.rotation.y = rotationY; scene.add(mesh);
    physics.staticBox(x, y, z, w, h, d, rotationY);
    return mesh;
  }
  function stationBox(frame, x, y, z, w, h, d, material) {
    const pos = localToWorldXZ(frame, x, z);
    return solidBox(pos.x, y, pos.z, w, h, d, material, frame.rotationY);
  }
  for (const [i, t] of TABLES.entries()) {
    const top = stationBox(t, 0, TABLE.centerY, 0, TABLE.width, TABLE.thick, TABLE.depth, boardMaterial);
    top.add(new THREE.LineSegments(new THREE.EdgesGeometry(top.geometry), edgeMaterial));
    // Patas calculadas desde la altura/dimensiones de la cubierta:
    // tanto la malla como el colisionador comparten exactamente la posición.
    const legHeight = TABLE.centerY - TABLE.thick / 2;
    const legX = TABLE.width / 2 - .105;
    const legZ = TABLE.depth / 2 - .085;
    for (const dx of [-legX, legX]) for (const dz of [-legZ, legZ]) {
      stationBox(t, dx, legHeight / 2, dz, .060, legHeight, .060, legMaterial);
    }
    const nameTex = labelTexture(`MESA ${i + 1}`, '#b8efff');
    const namePlate = new THREE.Mesh(new THREE.PlaneGeometry(.45, .14), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, side: THREE.DoubleSide }));
    // Rótulos en el borde dirigido hacia el usuario, sin cuerpos de colisión.
    const frontEdge = 1;
    const labelPos = localToWorldXZ(t, 0, frontEdge * (TABLE.depth / 2 + .012));
    namePlate.position.set(labelPos.x, TABLE_TOP + .062, labelPos.z);
    namePlate.rotation.order = 'YXZ';
    namePlate.rotation.set(-Math.PI / 3, t.rotationY, 0);
    scene.add(namePlate);
  }

  // Estación de clasificación más baja, delante de la zona de agarre.
  // El plano superior coincide con el fondo de los recipientes.
  stationBox(BIN_STATION, 0, .55, BIN_Z, 3.08, .14, .67, boardMaterial);
  for (const x of [-1.39, 1.39]) stationBox(BIN_STATION, x, .24, BIN_Z, .075, .48, .08, legMaterial);

  const bins = CATEGORIES.map((category, index) => {
    const x = BIN_X[index];
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: category.color, roughness: .52, metalness: .12, transparent: true, opacity: .61,
      side: THREE.DoubleSide, depthWrite: true
    });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x18354a, roughness: .68 });
    const t = BIN.wallThick, w = BIN.width, d = BIN.depth;
    stationBox(BIN_STATION, x, BIN.baseY, BIN_Z, w, BIN.baseThick, d, baseMat);
    const y = BIN_FLOOR + BIN.wallHeight / 2;
    // Cuatro paredes físicas independientes: la abertura superior está libre.
    stationBox(BIN_STATION, x - (w - t) / 2, y, BIN_Z, t, BIN.wallHeight, d, wallMaterial);
    stationBox(BIN_STATION, x + (w - t) / 2, y, BIN_Z, t, BIN.wallHeight, d, wallMaterial);
    stationBox(BIN_STATION, x, y, BIN_Z - (d - t) / 2, w - 2*t, BIN.wallHeight, t, wallMaterial);
    stationBox(BIN_STATION, x, y, BIN_Z + (d - t) / 2, w - 2*t, BIN.wallHeight, t, wallMaterial);
    // Borde superior VISUAL (sin colisionador extra) para indicar la categoría completa.
    // Se cambia a verde solo cuando hay 5 aciertos en el recipiente.
    const frameMaterial = new THREE.MeshBasicMaterial({
      color: category.color, toneMapped: false
    });
    const frameY = BIN_RIM + .012;
    function frameSegment(width, depth, px, pz) {
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(width, .023, depth), frameMaterial
      );
      const pos = localToWorldXZ(BIN_STATION, px, pz);
      segment.position.set(pos.x, frameY, pos.z);
      segment.rotation.y = BIN_STATION.rotationY;
      scene.add(segment);
    }
    frameSegment(w + .025, .024, x, BIN_Z - d / 2);
    frameSegment(w + .025, .024, x, BIN_Z + d / 2);
    frameSegment(.024, d + .025, x - w / 2, BIN_Z);
    frameSegment(.024, d + .025, x + w / 2, BIN_Z);

    const normalLabel = labelTexture(category.name, category.css);
    const completedLabel = labelTexture(category.name + ' ✓', '#59e3aa');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(.49, .15),
      new THREE.MeshBasicMaterial({ map: normalLabel, side: THREE.DoubleSide })
    );
    const labelPos = localToWorldXZ(BIN_STATION, x, BIN_Z + d / 2 + .025);
    sign.position.set(labelPos.x, BIN_RIM + .11, labelPos.z);
    sign.rotation.y = BIN_STATION.rotationY;
    scene.add(sign);
    return {
      id: category.id, name: category.name, ...localToWorldXZ(BIN_STATION, x, BIN_Z),
      rotationY: BIN_STATION.rotationY,
      width: w, depth: d, floor: BIN_FLOOR, rim: BIN_RIM, color: category.color,
      frameMaterial, sign, normalLabel, completedLabel
    };
  });

  function markBinComplete(categoryId, complete) {
    const bin = bins.find(item => item.id === categoryId);
    if (!bin) return;
    bin.frameMaterial.color.setHex(complete ? 0x59e3aa : bin.color);
    bin.sign.material.map = complete ? bin.completedLabel : bin.normalLabel;
    bin.sign.material.needsUpdate = true;
  }

  // El modelo se carga después, sin detener la simulación de NEXUS VR.
  const aula = createAulaEnvironment({ scene, physics, floorMesh, grid });
  const objectSet = createPieces(scene, physics);
  const hud = createHUD();
  scene.add(hud.group);
  const statusLamp = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0x59e3aa }));
  statusLamp.position.set(HUD_POSITION.x, 2.97, HUD_POSITION.z + .05); scene.add(statusLamp);

  function update(t) {
    statusLamp.material.opacity = .88 + .12 * Math.sin(t * 2.5);
    statusLamp.material.transparent = true;
  }
  return { scene, camera, physics, pieces: objectSet.pieces, bins, hud,
    sync: objectSet.sync, resetPositions: objectSet.resetPositions,
    restore: objectSet.restore, update, tables: TABLES,
    markBinComplete, loadAula: aula.load, getAulaStatus: aula.getStatus };
}
