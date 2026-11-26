
import * as THREE from 'three';

import { createPhysics } from './physics.js';
import { createPieces } from './objects.js';
import { createHUD } from './hud.js';
import { createAulaEnvironment } from './aula.js';

import {
  CATEGORIES,
  TABLES,
  TABLE,
  TABLE_TOP,
  BIN_X,
  BIN_Z,
  BIN,
  BIN_FLOOR,
  BIN_RIM,
  BIN_STATION,
  HUD_POSITION,
  localToWorldXZ
} from './config.js';

// =====================================================
// NEXUS VR - PRÁCTICA 3.3
// ESCENARIO AULA Y9 - DISTRIBUCIÓN EN U
// =====================================================

// =====================================================
// TEXTURAS DE ETIQUETAS
// =====================================================

function labelTexture(
  text,
  accent = '#ffffff',
  width = 512,
  height = 160
) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0c1b2c';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;

  ctx.strokeRect(
    6,
    6,
    width - 12,
    height - 12
  );

  ctx.font = 'bold 57px Arial';
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(
    text,
    width / 2,
    height / 2,
    width - 32
  );

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

// =====================================================
// ESCENARIO PRINCIPAL
// =====================================================

export function createLaboratoryScene() {

  const scene = new THREE.Scene();

  scene.background =
    new THREE.Color(0x08101e);

  scene.fog =
    new THREE.Fog(0x08101e, 16, 32);

  // Cámara para la vista de escritorio.
  // En VR se utiliza la posición real del visor.

  const camera = new THREE.PerspectiveCamera(
    67,
    1,
    0.05,
    55
  );

  camera.position.set(0, 2.20, 2.85);
  camera.lookAt(0, 1.25, -1.65);

  const physics = createPhysics();

  // ===================================================
  // ILUMINACIÓN
  // ===================================================

  scene.add(
    new THREE.HemisphereLight(
      0xcce6ff,
      0x253247,
      2.3
    )
  );

  const sun = new THREE.DirectionalLight(
    0xffffff,
    2.4
  );

  sun.position.set(-1.2, 4.1, 1.9);
  scene.add(sun);

  const violet = new THREE.PointLight(
    0x7a69ff,
    10,
    6
  );

  violet.position.set(1.6, 2.5, -2.0);
  scene.add(violet);

  // ===================================================
  // PISO
  // ===================================================

  const floorMat =
    new THREE.MeshStandardMaterial({
      color: 0x101b2b,
      roughness: 0.92
    });

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    floorMat
  );

  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.003;

  scene.add(floorMesh);

  const grid = new THREE.GridHelper(
    12,
    40,
    0x345675,
    0x1b3047
  );

  grid.position.y = 0.005;

  scene.add(grid);

  // ===================================================
  // POSICIÓN INICIAL DEL USUARIO VR
  // ===================================================

  const positionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.25, 48),

    new THREE.MeshBasicMaterial({
      color: 0x4cd9f4,
      transparent: true,
      opacity: 0.54,
      side: THREE.DoubleSide
    })
  );

  positionRing.rotation.x = -Math.PI / 2;

  positionRing.position.set(0, 0.012, 0);

  scene.add(positionRing);

  // ===================================================
  // MATERIALES
  // ===================================================

  const boardMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x233951,
      roughness: 0.48,
      metalness: 0.22
    });

  const legMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x18263a,
      roughness: 0.6,
      metalness: 0.16
    });

  const edgeMaterial =
    new THREE.LineBasicMaterial({
      color: 0x4cd9f4
    });

  // ===================================================
  // CUERPOS SÓLIDOS Y COLISIONADORES
  // ===================================================

  function solidBox(
    x,
    y,
    z,
    w,
    h,
    d,
    material,
    rotationY = 0
  ) {

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );

    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;

    scene.add(mesh);

    physics.staticBox(
      x,
      y,
      z,
      w,
      h,
      d,
      rotationY
    );

    return mesh;
  }

  function stationBox(
    frame,
    x,
    y,
    z,
    w,
    h,
    d,
    material
  ) {

    const pos = localToWorldXZ(
      frame,
      x,
      z
    );

    return solidBox(
      pos.x,
      y,
      pos.z,
      w,
      h,
      d,
      material,
      frame.rotationY
    );
  }

  // ===================================================
  // CUATRO MESAS - DISTRIBUCIÓN EN U
  // ===================================================

  for (const [i, t] of TABLES.entries()) {

    const top = stationBox(
      t,
      0,
      TABLE.centerY,
      0,
      TABLE.width,
      TABLE.thick,
      TABLE.depth,
      boardMaterial
    );

    top.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(top.geometry),
        edgeMaterial
      )
    );

    const legHeight =
      TABLE.centerY - TABLE.thick / 2;

    const legX =
      TABLE.width / 2 - 0.105;

    const legZ =
      TABLE.depth / 2 - 0.085;

    for (const dx of [-legX, legX]) {

      for (const dz of [-legZ, legZ]) {

        stationBox(
          t,
          dx,
          legHeight / 2,
          dz,
          0.060,
          legHeight,
          0.060,
          legMaterial
        );

      }
    }

    // Etiquetas de las mesas.

    const nameTex = labelTexture(
      `MESA ${i + 1}`,
      '#b8efff'
    );

    const namePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.14),

      new THREE.MeshBasicMaterial({
        map: nameTex,
        transparent: true,
        side: THREE.DoubleSide
      })
    );

    const frontEdge = 1;

    const labelPos = localToWorldXZ(
      t,
      0,
      frontEdge * (TABLE.depth / 2 + 0.012)
    );

    namePlate.position.set(
      labelPos.x,
      TABLE_TOP + 0.062,
      labelPos.z
    );

    namePlate.rotation.order = 'YXZ';

    namePlate.rotation.set(
      -Math.PI / 3,
      t.rotationY,
      0
    );

    scene.add(namePlate);
  }

  // ===================================================
  // MESA DE CLASIFICACIÓN
  // ===================================================

  stationBox(
    BIN_STATION,
    0,
    0.55,
    BIN_Z,
    3.08,
    0.14,
    0.67,
    boardMaterial
  );

  for (const x of [-1.39, 1.39]) {

    stationBox(
      BIN_STATION,
      x,
      0.24,
      BIN_Z,
      0.075,
      0.48,
      0.08,
      legMaterial
    );

  }

  // ===================================================
  // CONTENEDORES ESTANDARIZADOS - PRÁCTICA 3.3
  //
  // ID 1 = ESFERAS
  // ID 2 = CUBOS
  // ID 3 = PIRÁMIDES
  // ID 4 = PRISMAS HEXAGONALES
  // ===================================================

  const bins = CATEGORIES.map(
    (category, index) => {

      const x = BIN_X[index];

      const wallMaterial =
        new THREE.MeshStandardMaterial({
          color: category.color,
          roughness: 0.52,
          metalness: 0.12,
          transparent: true,
          opacity: 0.61,
          side: THREE.DoubleSide,
          depthWrite: true
        });

      const baseMat =
        new THREE.MeshStandardMaterial({
          color: 0x18354a,
          roughness: 0.68
        });

      const t = BIN.wallThick;
      const w = BIN.width;
      const d = BIN.depth;

      // Base física del contenedor.

      stationBox(
        BIN_STATION,
        x,
        BIN.baseY,
        BIN_Z,
        w,
        BIN.baseThick,
        d,
        baseMat
      );

      const y =
        BIN_FLOOR + BIN.wallHeight / 2;

      // Pared izquierda.

      stationBox(
        BIN_STATION,
        x - (w - t) / 2,
        y,
        BIN_Z,
        t,
        BIN.wallHeight,
        d,
        wallMaterial
      );

      // Pared derecha.

      stationBox(
        BIN_STATION,
        x + (w - t) / 2,
        y,
        BIN_Z,
        t,
        BIN.wallHeight,
        d,
        wallMaterial
      );

      // Pared posterior.

      stationBox(
        BIN_STATION,
        x,
        y,
        BIN_Z - (d - t) / 2,
        w - 2 * t,
        BIN.wallHeight,
        t,
        wallMaterial
      );

      // Pared frontal.

      stationBox(
        BIN_STATION,
        x,
        y,
        BIN_Z + (d - t) / 2,
        w - 2 * t,
        BIN.wallHeight,
        t,
        wallMaterial
      );

      // ===============================================
      // MARCOS VISUALES DE LOS CONTENEDORES
      // ===============================================

      const frameMaterial =
        new THREE.MeshBasicMaterial({
          color: category.color,
          toneMapped: false
        });

      const frameY = BIN_RIM + 0.012;

      function frameSegment(
        width,
        depth,
        px,
        pz
      ) {

        const segment = new THREE.Mesh(
          new THREE.BoxGeometry(
            width,
            0.023,
            depth
          ),
          frameMaterial
        );

        const pos = localToWorldXZ(
          BIN_STATION,
          px,
          pz
        );

        segment.position.set(
          pos.x,
          frameY,
          pos.z
        );

        segment.rotation.y =
          BIN_STATION.rotationY;

        scene.add(segment);
      }

      frameSegment(
        w + 0.025,
        0.024,
        x,
        BIN_Z - d / 2
      );

      frameSegment(
        w + 0.025,
        0.024,
        x,
        BIN_Z + d / 2
      );

      frameSegment(
        0.024,
        d + 0.025,
        x - w / 2,
        BIN_Z
      );

      frameSegment(
        0.024,
        d + 0.025,
        x + w / 2,
        BIN_Z
      );

      // ===============================================
      // ETIQUETAS DE LOS CONTENEDORES
      // ===============================================

      const normalLabel = labelTexture(
        category.name,
        category.css
      );

      const completedLabel = labelTexture(
        category.name + ' ✓',
        '#59e3aa'
      );

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.49, 0.15),

        new THREE.MeshBasicMaterial({
          map: normalLabel,
          side: THREE.DoubleSide
        })
      );

      const labelPos = localToWorldXZ(
        BIN_STATION,
        x,
        BIN_Z + d / 2 + 0.025
      );

      sign.position.set(
        labelPos.x,
        BIN_RIM + 0.11,
        labelPos.z
      );

      sign.rotation.y =
        BIN_STATION.rotationY;

      // Identificadores para FastAPI y MySQL.

      sign.name =
        `contenedor-${category.containerId}`;

      sign.userData.id_contenedor =
        category.containerId;

      sign.userData.category =
        category.id;

      scene.add(sign);

      return {

        // Identificador interno original.
        id: category.id,

        // Identificador numérico de la base de datos.
        id_contenedor: category.containerId,

        name: category.name,

        ...localToWorldXZ(
          BIN_STATION,
          x,
          BIN_Z
        ),

        rotationY: BIN_STATION.rotationY,

        width: w,
        depth: d,

        floor: BIN_FLOOR,
        rim: BIN_RIM,

        color: category.color,

        frameMaterial,
        sign,
        normalLabel,
        completedLabel
      };
    }
  );

  // ===================================================
  // CONTENEDOR COMPLETADO
  // ===================================================

  function markBinComplete(
    categoryId,
    complete
  ) {

    const bin = bins.find(
      item => item.id === categoryId
    );

    if (!bin) return;

    bin.frameMaterial.color.setHex(
      complete
        ? 0x59e3aa
        : bin.color
    );

    bin.sign.material.map =
      complete
        ? bin.completedLabel
        : bin.normalLabel;

    bin.sign.material.needsUpdate = true;
  }

  // ===================================================
  // MODELO DEL AULA Y9
  // ===================================================

  const aula = createAulaEnvironment({
    scene,
    physics,
    floorMesh,
    grid
  });

  // ===================================================
  // CREACIÓN DE LAS 20 FIGURAS
  // ===================================================

  const objectSet = createPieces(
    scene,
    physics
  );

  // ===================================================
  // MARCADOR HUD
  // ===================================================

  const hud = createHUD();

  scene.add(hud.group);

  const statusLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),

    new THREE.MeshBasicMaterial({
      color: 0x59e3aa
    })
  );

  statusLamp.position.set(
    HUD_POSITION.x,
    2.97,
    HUD_POSITION.z + 0.05
  );

  scene.add(statusLamp);

  // ===================================================
  // ACTUALIZACIÓN DEL ESCENARIO
  // ===================================================

  function update(t) {

    statusLamp.material.opacity =
      0.88 + 0.12 * Math.sin(t * 2.5);

    statusLamp.material.transparent = true;
  }

  // ===================================================
  // FUNCIONES PÚBLICAS
  // ===================================================

  return {
    scene,
    camera,
    physics,

    pieces: objectSet.pieces,
    bins,
    hud,

    sync: objectSet.sync,
    resetPositions: objectSet.resetPositions,
    restore: objectSet.restore,

    update,
    tables: TABLES,

    markBinComplete,

    loadAula: aula.load,
    getAulaStatus: aula.getStatus
  };
}
