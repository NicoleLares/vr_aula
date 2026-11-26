export const CATEGORIES = [
  {
    id: 'cubo',
    name: 'CUBOS',
    color: 0x4aa3ff,
    css: '#4aa3ff',
    prefix: 'CUB',
    containerId: 2
  },
  {
    id: 'esfera',
    name: 'ESFERAS',
    color: 0x59e3aa,
    css: '#59e3aa',
    prefix: 'ESF',
    containerId: 1
  },
  {
    id: 'piramide',
    name: 'PIRÁMIDES',
    color: 0xffaa66,
    css: '#ffaa66',
    prefix: 'PIR',
    containerId: 3
  },
  {
    id: 'prisma',
    name: 'PRISMAS HEXAGONALES',
    color: 0xb08aff,
    css: '#b08aff',
    prefix: 'HEX',
    containerId: 4
  }
];

// =====================================================
// DISTRIBUCIÓN EN U - AULA Y9
// =====================================================

export const BIN_STATION = {
  x: 0,
  z: -2.10,
  rotationY: 0
};

export const HUD_POSITION = {
  x: -0.33,
  y: 2.15,
  z: -3.86
};

// =====================================================
// TRANSFORMACIONES DE COORDENADAS
// =====================================================

export function localToWorldXZ(frame, x, z) {
  const c = Math.cos(frame.rotationY || 0);
  const s = Math.sin(frame.rotationY || 0);

  return {
    x: frame.x + c * x + s * z,
    z: frame.z - s * x + c * z
  };
}

export function worldToLocalXZ(frame, x, z) {
  const c = Math.cos(frame.rotationY || 0);
  const s = Math.sin(frame.rotationY || 0);

  const dx = x - frame.x;
  const dz = z - frame.z;

  return {
    x: c * dx - s * dz,
    z: s * dx + c * dz
  };
}

export function insideBinXZ(bin, x, z, margin = 0.075) {
  const local = worldToLocalXZ(bin, x, z);

  return (
    Math.abs(local.x) <= bin.width / 2 - margin &&
    Math.abs(local.z) <= bin.depth / 2 - margin
  );
}

// =====================================================
// MESAS
// =====================================================

export const TABLES = [
  {
    id: 'mesa-1',
    x: -1.25,
    z: 0.25,
    rotationY: Math.PI / 2
  },
  {
    id: 'mesa-2',
    x: -1.25,
    z: -1.05,
    rotationY: Math.PI / 2
  },
  {
    id: 'mesa-3',
    x: 1.25,
    z: 0.25,
    rotationY: -Math.PI / 2
  },
  {
    id: 'mesa-4',
    x: 1.25,
    z: -1.05,
    rotationY: -Math.PI / 2
  }
];

export const TABLE = {
  width: 1.10,
  depth: 0.65,
  centerY: 0.635,
  thick: 0.085
};

export const TABLE_TOP =
  TABLE.centerY + TABLE.thick / 2;

// =====================================================
// CONTENEDORES
// =====================================================

export const BIN_X = [-1.14, -0.38, 0.38, 1.14];
export const BIN_Z = 0;

export const BIN = {
  width: 0.69,
  depth: 0.66,
  baseY: 0.65,
  baseThick: 0.06,
  wallHeight: 0.40,
  wallThick: 0.035
};

export const BIN_FLOOR =
  BIN.baseY + BIN.baseThick / 2;

export const BIN_RIM =
  BIN_FLOOR + BIN.wallHeight;

// =====================================================
// ZONA DE TRABAJO
// =====================================================

export const WORKSPACE = {
  minX: -3.20,
  maxX: 3.20,
  minZ: -3.40,
  maxZ: 1.50,
  minY: 0.16,
  maxY: 2.40
};

export const FIXED_STEP = 1 / 60;

// =====================================================
// CONFIGURACIÓN DEL AULA Y9
// =====================================================

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