
export const CATEGORIES = [
  { id: 'cubo', name: 'CUBOS', color: 0x4aa3ff, css: '#4aa3ff' },
  { id: 'esfera', name: 'ESFERAS', color: 0x59e3aa, css: '#59e3aa' },
  { id: 'piramide', name: 'PIRÁMIDES', color: 0xffaa66, css: '#ffaa66' },
  { id: 'prisma', name: 'PRISMAS', color: 0xb08aff, css: '#b08aff' }
];

// Coordenadas del aula centrada: -Z hacia el pizarrón.
// Distribución en U: dos mesas a cada lado y clasificación al frente.
// Los bordes de las mesas y las etiquetas miran hacia el pasillo central.
export const BIN_STATION = { x: 0, z: -2.10, rotationY: 0 };
export const HUD_POSITION = { x: -0.33, y: 2.15, z: -3.86 };

// Transformaciones compartidas por mallas, cuerpos físicos y reglas del juego.
export function localToWorldXZ(frame, x, z) {
  const c = Math.cos(frame.rotationY || 0), s = Math.sin(frame.rotationY || 0);
  return { x: frame.x + c*x + s*z, z: frame.z - s*x + c*z };
}

export function worldToLocalXZ(frame, x, z) {
  const c = Math.cos(frame.rotationY || 0), s = Math.sin(frame.rotationY || 0);
  const dx = x - frame.x, dz = z - frame.z;
  return { x: c*dx - s*dz, z: s*dx + c*dz };
}

export function insideBinXZ(bin, x, z, margin = .075) {
  const local = worldToLocalXZ(bin, x, z);
  return Math.abs(local.x) <= bin.width / 2 - margin &&
    Math.abs(local.z) <= bin.depth / 2 - margin;
}

export const TABLES = [
  { id: 'mesa-1', x: -1.25, z:  .25, rotationY:  Math.PI / 2 },
  { id: 'mesa-2', x: -1.25, z: -1.05, rotationY:  Math.PI / 2 },
  { id: 'mesa-3', x:  1.25, z:  .25, rotationY: -Math.PI / 2 },
  { id: 'mesa-4', x:  1.25, z: -1.05, rotationY: -Math.PI / 2 }
];

export const TABLE = {
  width: 1.10,
  depth: 0.65,
  centerY: 0.635,
  thick: 0.085
};

export const TABLE_TOP = TABLE.centerY + TABLE.thick / 2;

// Recipientes ampliados y separados.
export const BIN_X = [-1.14, -0.38, 0.38, 1.14];
export const BIN_Z = 0; // coordenada local de la estación de clasificación

export const BIN = {
  width: 0.69,
  depth: 0.66,
  baseY: 0.65,
  baseThick: 0.06,
  wallHeight: 0.40,
  wallThick: 0.035
};

export const BIN_FLOOR = BIN.baseY + BIN.baseThick / 2;
export const BIN_RIM = BIN_FLOOR + BIN.wallHeight;

export const WORKSPACE = {
  minX: -3.20,
  maxX: 3.20,
  minZ: -3.40,
  maxZ: 1.50,
  minY: 0.16,
  maxY: 2.40
};

export const FIXED_STEP = 1 / 60;

// Configuración Aula Y9.
export const AULA = {
  width: 7.5,
  depth: 8.6,
  height: 3.2,
  wallThickness: 0.20,
  rotationY: Math.PI,
  scale: 1,
  offsetX: 0,
  offsetZ: 0,
  collisionWalls: true
};
