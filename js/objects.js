import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import {
  CATEGORIES,
  TABLES,
  TABLE_TOP,
  localToWorldXZ
} from './config.js';

// =====================================================
// FORMAS FÍSICAS
// =====================================================

function pyramidShape() {
  const r = 0.105;
  const h = 0.23;

  const points = [
    [-r, -h / 2, -r],
    [r, -h / 2, -r],
    [r, -h / 2, r],
    [-r, -h / 2, r],
    [0, h / 2, 0]
  ].map(v => new CANNON.Vec3(...v));

  return new CANNON.ConvexPolyhedron({
    vertices: points,
    faces: [
      [0, 1, 2, 3],
      [0, 4, 1],
      [1, 4, 2],
      [2, 4, 3],
      [3, 4, 0]
    ]
  });
}

function prismShape() {
  const r = 0.117;
  const h = 0.225;
  const vertices = [];

  for (const y of [-h / 2, h / 2]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;

      vertices.push(
        new CANNON.Vec3(
          r * Math.cos(a),
          y,
          r * Math.sin(a)
        )
      );
    }
  }

  const faces = [
    Array.from({ length: 6 }, (_, i) => i),
    [11, 10, 9, 8, 7, 6]
  ];

  for (let i = 0; i < 6; i++) {
    faces.push([
      i,
      i + 6,
      6 + ((i + 1) % 6),
      (i + 1) % 6
    ]);
  }

  return new CANNON.ConvexPolyhedron({
    vertices,
    faces
  });
}

// =====================================================
// GEOMETRÍAS VISUALES
// =====================================================

const geometryByType = {
  cubo: () =>
    new THREE.BoxGeometry(0.205, 0.205, 0.205),

  esfera: () =>
    new THREE.SphereGeometry(0.112, 20, 14),

  piramide: () => {
    const g = new THREE.ConeGeometry(
      0.149,
      0.23,
      4,
      1
    );

    g.rotateY(Math.PI / 4);

    return g;
  },

  prisma: () =>
    new THREE.CylinderGeometry(
      0.117,
      0.117,
      0.225,
      6
    )
};

// =====================================================
// GEOMETRÍAS FÍSICAS
// =====================================================

const shapeByType = {
  cubo: () =>
    new CANNON.Box(
      new CANNON.Vec3(
        0.1025,
        0.1025,
        0.1025
      )
    ),

  esfera: () =>
    new CANNON.Sphere(0.112),

  piramide: pyramidShape,

  prisma: prismShape
};

// =====================================================
// DISTRIBUCIÓN ALEATORIA
// =====================================================

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [array[i], array[j]] = [
      array[j],
      array[i]
    ];
  }

  return array;
}

// =====================================================
// POSICIONES SOBRE LAS MESAS
// =====================================================

const SLOTS = [
  { x: -0.36, z: -0.14 },
  { x: 0, z: -0.14 },
  { x: 0.36, z: -0.14 },
  { x: -0.18, z: 0.15 },
  { x: 0.18, z: 0.15 }
];

// =====================================================
// CREACIÓN DE FIGURAS
// =====================================================

export function createPieces(scene, physics) {
  const pieces = [];

  const geometries = Object.fromEntries(
    CATEGORIES.map(c => [
      c.id,
      geometryByType[c.id]()
    ])
  );

  for (const category of CATEGORIES) {
    for (let i = 0; i < 5; i++) {

      // Identificador interno de la práctica 3.2.
      const internalId =
        `${category.id}-${i + 1}`;

      // Código estandarizado para la práctica 3.3.
      const codigo =
        `${category.prefix}-${String(i + 1).padStart(2, '0')}`;

      const mesh = new THREE.Mesh(
        geometries[category.id],

        new THREE.MeshStandardMaterial({
          color: category.color,
          roughness: 0.42,
          metalness: 0.10,
          emissive: category.color,
          emissiveIntensity: 0.07,
          flatShading: category.id !== 'esfera'
        })
      );

      // Metadatos de identificación.
      mesh.name = codigo;

      mesh.userData.codigo = codigo;
      mesh.userData.category = category.id;
      mesh.userData.containerId =
        category.containerId;

      const body = new CANNON.Body({
        mass: 0.38,
        linearDamping: 0.32,
        angularDamping: 0.42,
        allowSleep: true
      });

      body.addShape(
        shapeByType[category.id]()
      );

      body.sleepSpeedLimit = 0.11;
      body.sleepTimeLimit = 0.75;

      physics.world.addBody(body);
      scene.add(mesh);

      pieces.push({
        id: internalId,

        // Identificadores para FastAPI y MySQL.
        codigo: codigo,
        containerId: category.containerId,

        category: category.id,
        categoryName: category.name,

        mesh,
        body,

        state: 'available',
        tableIndex: -1,
        home: null,

        releaseId: 0,
        countedReleaseId: -1,

        enteredFromTop: false,
        stillFor: 0,
        recoveryAt: null,
        releasedAt: 0
      });
    }
  }

  // ===================================================
  // SINCRONIZACIÓN VISUAL Y FÍSICA
  // ===================================================

  function sync() {
    for (const p of pieces) {
      p.mesh.position.copy(
        p.body.position
      );

      p.mesh.quaternion.copy(
        p.body.quaternion
      );
    }
  }

  // ===================================================
  // REINICIAR POSICIONES
  // ===================================================

  function resetPositions() {

    // Cada mesa recibe una figura de cada categoría
    // y una figura adicional.
    const groups = TABLES.map((_, i) =>
      shuffle([
        ...CATEGORIES.map(c => c.id),
        CATEGORIES[i].id
      ])
    );

    const shuffledByClass =
      Object.fromEntries(
        CATEGORIES.map(c => [
          c.id,
          shuffle(
            pieces.filter(
              p => p.category === c.id
            )
          )
        ])
      );

    TABLES.forEach((table, tableIndex) => {
      const positions = shuffle(
        SLOTS.map(p => ({ ...p }))
      );

      groups[tableIndex].forEach(
        (categoryId, index) => {
          const p =
            shuffledByClass[categoryId].pop();

          const slot = positions[index];

          const { x, z } = localToWorldXZ(
            table,
            slot.x + (Math.random() - 0.5) * 0.026,
            slot.z + (Math.random() - 0.5) * 0.024
          );

          const y = TABLE_TOP + 0.133;

          p.home = { x, y, z };
          p.tableIndex = tableIndex;

          restore(p, p.home);
        }
      );
    });

    sync();
  }

  // ===================================================
  // RECUPERACIÓN DE FIGURAS
  // ===================================================

  function restore(piece, position) {
    const body = piece.body;

    body.type = CANNON.Body.DYNAMIC;
    body.mass = 0.38;

    body.updateMassProperties();

    body.position.set(
      position.x,
      position.y,
      position.z
    );

    body.aabbNeedsUpdate = true;

    body.quaternion.set(0, 0, 0, 1);

    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.force.setZero();
    body.torque.setZero();

    body.wakeUp();

    piece.state = 'available';
    piece.stillFor = 0;
    piece.enteredFromTop = false;
    piece.recoveryAt = null;
    piece.releasedAt = 0;

    piece.mesh.material.emissive.setHex(
      CATEGORIES.find(
        c => c.id === piece.category
      ).color
    );

    piece.mesh.material.emissiveIntensity =
      0.07;
  }

  resetPositions();

  // ===================================================
  // FUNCIONES PÚBLICAS
  // ===================================================

  return {
    pieces,
    sync,
    restore,
    resetPositions,

    dispose() {
      pieces.forEach(p => {
        physics.world.removeBody(p.body);
        scene.remove(p.mesh);
        p.mesh.material.dispose();
      });

      Object.values(geometries).forEach(
        g => g.dispose()
      );
    }
  };
}