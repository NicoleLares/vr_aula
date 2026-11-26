
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AULA } from './config.js';

const AULA_URL = new URL(
  '../assets/models/AulaY9.glb',
  import.meta.url
);

// Obtener nombres de materiales de una malla.
function materialNames(mesh) {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  return materials.map(m => m?.name || '').join(' ');
}

// Localizar el piso del salón para calcular
// el centro sin incluir objetos externos.
function floorBounds(root) {
  const floors = new THREE.Box3();
  let hasFloor = false;

  root.traverseVisible(object => {
    if (!object.isMesh) return;

    const description =
      `${object.name} ${materialNames(object)}`;

    if (!/(loseta|piso|suelo|floor|tile)/i.test(description)) {
      return;
    }

    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());

    if (bounds.isEmpty() || size.x * size.z < 0.02) {
      return;
    }

    floors.union(bounds);
    hasFloor = true;
  });

  if (!hasFloor) {
    throw new Error(
      'No se pudo localizar el piso del aula en AulaY9.glb'
    );
  }

  return floors;
}

// Calcular dimensiones visibles de la arquitectura.
function visibleArchitectureBounds(root) {
  const bounds = new THREE.Box3();

  root.traverseVisible(object => {
    if (object.isMesh) {
      bounds.union(
        new THREE.Box3().setFromObject(object)
      );
    }
  });

  return bounds;
}

// ==========================================
// CREACIÓN DEL ENTORNO AULA Y9
// ==========================================

export function createAulaEnvironment({
  scene,
  physics,
  floorMesh,
  grid
}) {
  let root = null;
  let loaded = false;

  let diagnostics = {
    loaded: false,
    url: AULA_URL.href,
    message: 'Carga pendiente'
  };

  const loader = new GLTFLoader();

  // Colisionadores físicos simplificados
  // para las cuatro paredes exteriores.
  function addWallColliders(floor) {
    if (!AULA.collisionWalls) return 0;

    const dimensions = floor.getSize(new THREE.Vector3());
    const w = dimensions.x;
    const d = dimensions.z;

    if (w < 3 || d < 3 || w > 20 || d > 20) {
      console.warn(
        'Dimensiones de piso inesperadas: no se crean paredes físicas.'
      );
      return 0;
    }

    const h = AULA.height * AULA.scale;
    const t = AULA.wallThickness;

    const x = (floor.min.x + floor.max.x) / 2;
    const z = (floor.min.z + floor.max.z) / 2;

    // Pared izquierda.
    physics.staticBox(
      x - w / 2, h / 2, z,
      t, h, d
    );

    // Pared derecha.
    physics.staticBox(
      x + w / 2, h / 2, z,
      t, h, d
    );

    // Pared del fondo.
    physics.staticBox(
      x, h / 2, z - d / 2,
      w, h, t
    );

    // Pared frontal.
    physics.staticBox(
      x, h / 2, z + d / 2,
      w, h, t
    );

    // La puerta no tiene un paso físico
    // individualmente modelado.
    return 4;
  }

  // ========================================
  // CARGAR MODELO GLB
  // ========================================

  async function load() {
    try {
      const gltf = await loader.loadAsync(AULA_URL.href);

      if (!gltf.scene) {
        throw new Error(
          'El GLB no contiene una escena'
        );
      }

      root = gltf.scene;
      root.name = 'AulaY9-SketchUp';

      // Ocultar figura humana de referencia
      // exportada desde SketchUp.
      let hiddenReference = false;

      root.traverse(object => {
        if (/^ThomThom(?:_|$)/i.test(object.name || '')) {
          object.visible = false;
          hiddenReference = true;
        }
      });

      // Mantener escala y orientación.
      root.rotation.y = AULA.rotationY;
      root.scale.setScalar(AULA.scale);
      root.updateMatrixWorld(true);

      // Centrar el salón utilizando el piso.
      const originalFloor = floorBounds(root);
      const center = originalFloor.getCenter(
        new THREE.Vector3()
      );

      root.position.set(
        AULA.offsetX - center.x,
        -originalFloor.min.y,
        AULA.offsetZ - center.z
      );

      root.updateMatrixWorld(true);

      // Hacer visibles las superficies
      // interiores del modelo.
      root.traverseVisible(object => {
        if (!object.isMesh) return;

        object.castShadow = false;
        object.receiveShadow = false;

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        for (const material of materials) {
          if (!material) continue;

          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        }
      });

      // Agregar el aula a Three.js.
      scene.add(root);

      // Ocultar el piso antiguo de NEXUS VR.
      // El plano físico original se mantiene.
      floorMesh.visible = false;
      grid.visible = false;

      // Diagnóstico de dimensiones.
      const placedFloor = floorBounds(root);
      const roomSize = placedFloor.getSize(
        new THREE.Vector3()
      );

      const architecture = visibleArchitectureBounds(root);
      const builtSize = architecture.getSize(
        new THREE.Vector3()
      );

      // Crear paredes físicas.
      const wallColliders = addWallColliders(placedFloor);

      loaded = true;

      diagnostics = {
        loaded: true,
        url: AULA_URL.href,
        width: Number(roomSize.x.toFixed(2)),
        depth: Number(roomSize.z.toFixed(2)),
        height: Number(builtSize.y.toFixed(2)),
        wallColliders,
        hiddenReference,
        scale: AULA.scale,
        rotationY: AULA.rotationY
      };

      console.info(
        'AulaY9 integrada:',
        diagnostics
      );

      if (
        Math.abs(roomSize.x - AULA.width * AULA.scale) > 0.15 ||
        Math.abs(roomSize.z - AULA.depth * AULA.scale) > 0.15
      ) {
        console.warn(
          'La escala o rotación del aula no coincide con la ficha del GLB.'
        );
      }

      return { ...diagnostics };

    } catch (error) {
      console.error(
        'No se pudo cargar el aula; sigue disponible NEXUS VR sin arquitectura:',
        error
      );

      if (root?.parent) {
        root.parent.remove(root);
      }

      root = null;

      diagnostics = {
        loaded: false,
        url: AULA_URL.href,
        message: error.message
      };

      return { ...diagnostics };
    }
  }

  return {
    load,

    getStatus: () => ({
      ...diagnostics
    }),

    get model() {
      return root;
    },

    get loaded() {
      return loaded;
    }
  };
}
