# NEXUS VR — Práctica 3.2: Interacción virtual

Evolución de **NEXUS VR / práctica 3.1** a un laboratorio de clasificación geométrica con **física real** en navegador y seguimiento de manos para **Meta Quest 3**.

## Funcionalidades implementadas en código

- 4 mesas tridimensionales estáticas y 20 figuras (5 cubos, 5 esferas, 5 pirámides, 5 prismas hexagonales), repartidas en 5 por mesa. Cada mesa contiene todas las clases y un quinto objeto extra.
- 4 recipientes abiertos rotulados, con bases y 4 paredes físicas independientes.
- `cannon-es` para cuerpos dinámicos/estáticos/cinemáticos, gravedad −9.82 m/s², fricción, restitución, colisiones y paso fijo de 1/60 s con delta limitado.
- WebXR immersive-vr con *hand tracking*, modelo de manos, raycasting y gesto de pinza heredados de 3.1. Sin mandos físicos obligatorios.
- Agarre cinemático de cuerpos, velocidad de soltado limitada, caída real sin snap, colisiones con objetos y superficies.
- Acierto únicamente después de entrada por la boca y reposo físico dentro del bote de la categoría correcta durante 0.64 s. Un solo registro por liberación; error en bote equivocado con retorno controlado después de un aviso.
- Panel 3D con aciertos 0/20, progreso 0/5 por clase, errores, intentos, precisión, cronómetro global y tiempos de cierre de cada bote.
- Botones 3D COMENZAR, REINICIAR y SALIR VR; pausa al cerrar VR; nueva distribución aleatoria al reiniciar.
- Portada con Bootstrap 5, favicon, estilos de NEXUS VR, vista previa no inmersiva de escritorio, recursos y rutas relativas para GitHub Pages.

**Importante:** el código se preparó y se validó sintácticamente. La ejecución real en un navegador y las pruebas con Meta Quest 3 **están pendientes**. Ver `PRUEBAS.md`. No consideres la práctica completa hasta probarla, corregir posibles incompatibilidades y guardar evidencias.

## Versiones y restricciones

| Recurso | Versión / uso |
|---|---|
| Three.js | 0.187.0, módulo ES vía jsDelivr |
| cannon-es | 0.20.0, módulo ES vía jsDelivr |
| Bootstrap | 5.3.3, CSS solo en portada |
| JavaScript | Módulos ES nativos |
| Hardware para validación real | Meta Quest 3 + Meta Quest Browser |

Sin Node.js, npm, bundlers, frameworks de app, backend, API o base de datos. La primera carga requiere internet para CDN.

## Cómo ejecutar en computadora

1. Descomprime la carpeta `interaccion-virtual-3-2`.
2. Abre esa carpeta en Visual Studio Code.
3. Con Live Server, abre `index.html` en `http://localhost:5500` (o puerto correspondiente).
4. Revisa el escenario: deben verse 4 mesas, 20 figuras y 4 recipientes abiertos.
5. Abre **Developer Tools → Console** y ejecuta:

```js
window.__nexusDebug.summary()
```

Debería informar `objects: 20`, `bins: 4`, `tables: 4` y 5 objetos por categoría. Si el objeto `__nexusDebug` no aparece, revisa los errores de Console y Network.

6. Comprueba que los 20 objetos se estabilizan sobre las mesas y que REINICIAR reordena las piezas. El botón de escritorio COMENZAR activa el cronómetro, **no emula las manos**.

> `file://` no es recomendable para módulos ES. Usa Live Server o un servidor estático local, sin compilación.

## Cómo publicar en GitHub Pages

1. Crea un repositorio nuevo, por ejemplo `nexus-vr-interaccion-3-2`.
2. Sube **el contenido** de esta carpeta a la raíz del repositorio (no subas `.git` de 3.1).
3. En **Settings → Pages** elige **Deploy from a branch → main → /(root)** y guarda.
4. Abre la URL `https://TU-USUARIO.github.io/TU-REPOSITORIO/` y comprueba Console / Network.
5. Abre exactamente esa URL desde **Meta Quest Browser** (HTTPS).
6. Permite el seguimiento de manos del visor. Pulsa ENTRAR A REALIDAD VIRTUAL y después COMENZAR dentro del HUD 3D utilizando la pinza.

## Reglas y métricas

- Cada pieza tiene **ID único**, categoría, cuerpo, malla, estado y mesa de origen.
- Estados: `available` (disponible), `held` (sujeto), `released` (caída), `stabilizing` (validación), `classified` (acierto fijo), `error` (bote incorrecto) y `recoverable` (en suelo).
- Cada liberación tiene un `releaseId`. Un intento confirmado modifica los contadores una sola vez, mediante `countedReleaseId`.
- **Intento confirmado:** pieza en reposo dentro de un bote, con evidencia de haber estado sobre su boca después de soltarse. No cuenta si queda sobre el borde, fuera del volumen interior o si es arrastrada a través de la pared.
- **Acierto:** intento confirmado en recipiente correcto; el objeto permanece visible en el bote.
- **Error:** intento confirmado en recipiente equivocado; se muestra una alerta y se devuelve a una posición desocupada de su mesa sin sumar aciertos.
- **Precisión** = aciertos / intentos confirmados × 100; con 0 intentos se muestra 0 %.
- **Tiempo por recipiente:** segundos desde COMENZAR hasta validar la quinta pieza de esa categoría; antes se muestra `pendiente`.
- **Tiempo global:** segundos desde COMENZAR hasta llegar exactamente a 20/20, excluyendo tiempo en pausa tras salir de la sesión VR.
- **Reinicio:** restablece estadísticas y tiempos, y vuelve a mezclar figuras aleatoriamente en cuatro mesas.

## Colisionadores

| Figura | Collider de cannon-es | Nota |
|---|---|---|
| Cubo | `Box` | coincide con su tamaño visual |
| Esfera | `Sphere` | redondeado real |
| Pirámide cuadrangular | `ConvexPolyhedron` (5 vértices) | pirámide convexa aproximada |
| Prisma hexagonal | `ConvexPolyhedron` (12 vértices) | prisma de base hexagonal |
| Mesa, suelo y bote | `Box` / `Plane` estáticos | botes sin tapa ni plano invisible superior |

La sujeción cinemática emplea movimiento limitado por cuadro y barreras conservadoras por AABB. Es una **aproximación** a agarre físico, no un solucionador continuo perfecto. Los movimientos extremadamente rápidos pueden causar penetraciones; el visor debe usarse para verificar y ajustar este comportamiento.

## Archivos

```text
index.html                 # portada, import map y acceso VR
css/style.css              # estilos NEXUS VR
assets/favicon.svg         # icono heredado de 3.1
js/config.js               # categorías, mesas, botes y escala
js/physics.js              # cannon-es y cuerpos estáticos
js/objects.js              # geometrías, 20 cuerpos y distribución
js/scene.js                # escena, mesas, botes, luces
js/hands.js                # seguimiento WebXR de ambas manos (3.1)
js/interaction.js          # raycasting, pinza y cinemática
js/game.js                 # validación, errores, reloj y estados
js/hud.js                  # marcador y botones 3D
js/ui.js                   # estatus de la portada (3.1)
js/main.js                 # inicialización, loop y WebXR
PRUEBAS.md                 # aceptación y registro de evidencias
```

## Limitaciones y cuestiones por verificar

- No se han realizado pruebas con el visor Meta Quest 3 en este entorno. Confirmar que ambas manos se ven, que los rayos apuntan correctamente y que la pinza puede pulsar botones y tomar objetos.
- La prueba de navegador automatizada quedó bloqueada por la configuración del entorno de pruebas. Se requiere abrir con Live Server/GitHub Pages en un navegador real.
- La barrera AABB de los cuerpos sujetos y la velocidad de liberación son aproximaciones: verificar penetraciones, estabilidad, comodidad, latencia y alcance.
- En un reinicio extremo, la posición de recuperación puede requerir refinamiento si una mesa está muy ocupada.
- La compatibilidad de `hand-tracking` depende de la versión de Meta Quest Browser y sus permisos.
- El escritorio no reemplaza la comprobación inmersiva. No hay soporte de ratón para fingir pinza.
- Deben añadirse autor/datos académicos definitivos al pie antes de la entrega.
- Antes de entregar, recopilar capturas del visor, URL pública, errores probados, cuatro tiempos y reflexiones propias en la plataforma.

## Licencias / referencias

- [Three.js](https://threejs.org/) — licencia MIT.
- [cannon-es](https://github.com/pmndrs/cannon-es) — licencia MIT.
- [Bootstrap](https://getbootstrap.com/) — licencia MIT.
- Sin imágenes de terceros, fuentes externas, clips de audio ni claves.
- Se reutiliza el código y favicon proporcionados por el alumno para la práctica 3.1.
