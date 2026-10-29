# FidiaCorp — aplicación web

Base del cliente web con Vue, Vue Router, PrimeVue y Tailwind CSS sobre Vite.

## Requisitos

- Node.js 24.22.1 (LTS utilizada para la validación).
- pnpm 12.15.0, fijado en `package.json`.

## Instalación y ejecución

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Vite muestra la dirección local disponible, normalmente `http://localhost:5173`.
La instalación utiliza `pnpm-lock.yaml`; no se requiere npm ni npx. Los scripts
propios del proyecto se ejecutan explícitamente con los comandos siguientes.

```sh
pnpm build
pnpm preview
pnpm audit
```

`build` genera `dist/`; `preview` permite comprobar esa compilación localmente.
La auditoría detecta vulnerabilidades conocidas y no garantiza ausencia de malware.

## Configuración inicial y navegación

`src/main.js` registra Vue Router y PrimeVue en modo unstyled. Los estilos de la
base se definen en `src/style.css`, que también importa Tailwind mediante su
plugin de Vite. No se requieren plugins de traducción ni de estado para esta etapa.

La instancia del router se define en `src/router/index.js`; `src/router.js` la
reexporta por compatibilidad. Inicio utiliza la vista
`src/shared/presentation/views/home.vue` integrada desde `develop`.
Los destinos están centralizados en `src/router/navigation.js`:

| Ruta | Sección |
| --- | --- |
| `/home` | Inicio |
| `/realState` | Inmobiliario |
| `/messaging` | Mensajería |
| `/products` | Mis productos |
| `/profile` | Perfil |

La ruta `/` redirige a `/home`. Las rutas desconocidas muestran una página 404
con enlace al inicio. Inicio es público. `/login` y `/register` permiten ingresar y crear una cuenta.
Las otras secciones requieren sesión; Perfil consulta y actualiza los datos de la API.
Inmuebles, mensajería y productos conservan sus vistas iniciales.

El router utiliza historial HTML5 y respeta la base de Vite. En el servidor de
publicación se debe devolver `index.html` para rutas de la aplicación que no
correspondan a archivos, para permitir abrir y recargar enlaces directamente.

## API y cuentas

El frontend puede arrancar sin backend; registro, ingreso y perfil necesitan la API.
Crea `.env.local` con `VITE_API_BASE_URL=http://localhost:8080/api/v1`
(valor predeterminado) y reinicia Vite. En producción configura esa variable antes
de compilar. El backend debe permitir el origen del frontend mediante CORS.

El cliente usa `/auth/register`, `/auth/login` y `/users/me` (GET/PUT). Los tokens
se guardan en `sessionStorage` de la pestaña; nunca se guardan contraseñas. La
expiración o un 401 de una petición autenticada elimina la sesión y solicita
reingreso. Perfil permite actualizar nombres, apellidos y correo; los roles se
asignan en el backend. El botón «Cerrar sesión» del encabezado o Perfil envía `POST /auth/logout`
para revocar únicamente el token actual y elimina el acceso local inmediatamente.
Las respuestas privadas anteriores al cierre se descartan. Si la API falla, la
interfaz informa que no confirmó la invalidación; «Reintentar invalidación» usa
una copia del token solo en memoria y únicamente para revocarlo. Recargar/cerrar
la pestaña pierde ese reintento: no se presenta el cierre remoto como confirmado.
Un 401 al revocar indica que ese token ya no permite acceso. Otras sesiones
permanecen activas.

En Perfil se puede consultar, activar o desactivar el segundo factor TOTP. El
backend necesita `TWO_FACTOR_ENCRYPTION_KEY` configurada (véase su README).
La clave manual y la URI se muestran solo durante la configuración, sin QR ni
servicios externos; no se guardan en el navegador. La configuración vence en
10 minutos. Un código incorrecto o vencido no activa la función. Los códigos
son de un solo uso: espera al siguiente intervalo de 30 segundos después de
confirmar, ingresar o desactivar. Al ingresar, el código se solicita después
de validar correo y contraseña; no se inicia sesión hasta completar ambos pasos.
Los límites de intentos se presentan con el tiempo de espera que indica la API.

Para pruebas unitarias sin dependencias adicionales: `node --test tests/*.test.js`.


## Validación de la configuración inicial

La instalación con lockfile congelado y scripts de dependencias desactivados,
la compilación de producción y las respuestas HTTP del servidor local fueron
comprobadas con Node.js 24.22.1 y pnpm 12.15.0. La auditoría realizada el
27 de octubre de 2026 no reportó vulnerabilidades conocidas.

PrimeVue 5.0.2, ya declarado en el proyecto, emite un aviso de licencia PrimeUI
no configurada y puede mostrar un banner. Esta tarea no incorpora una licencia;
antes de publicar se deberá resolver el licenciamiento de esa dependencia.

También se comprobaron mediante renderizado en servidor siete navegaciones:
la redirección inicial, las cinco secciones y una ruta desconocida. Se verificaron
encabezados, títulos y enlaces activos. No se realizó una revisión visual en navegador.

## Catálogo inmobiliario

`/realState` consulta `GET /properties` con búsqueda por texto, etiquetas separadas
por coma (todas deben cumplirse), filtro de propios y paginación de 20 registros.
Retirar una etiqueta o limpiar filtros actualiza la consulta. El registro usa
`POST /properties`; título, dirección, precio y moneda son obligatorios. El precio
viaja como string decimal y se muestra sin convertirlo a Number, conservando hasta
16 dígitos enteros y 2 decimales. Solo se muestra Eliminar para el propietario
identificado por `/users/me`; la API vuelve a comprobar el permiso. Cancelar el
diálogo no envía DELETE. Confirmar llama `DELETE /properties/{id}` y recarga el
listado conservando filtros y una página válida. Esta tarea no incorpora edición.

## Ofertas y notificaciones

`/offers` lista ofertas recibidas; `/offers/:id` consulta su detalle autorizado.
`/notifications` lista avisos, permite filtrar sin leer y marcarlos como leídos.
Los accesos anteriores `/products` y `/messaging` redirigen a esas páginas.
Todos estos datos requieren sesión y los permisos se comprueban en el backend.
Las propuestas se identifican como **DEMO**: no acreditan aprobación bancaria.
Los importes y porcentajes se formatean desde strings sin convertir a Number.
La emisión de ofertas se realiza mediante la API autorizada para REALTOR; esta
interfaz no incorpora emisión; el detalle permite consultar y generar su cronograma.

Un único feed del encabezado consulta `/notifications` cada 5 segundos, después
de terminar la consulta previa, mientras la pestaña esté visible y autenticada.
El badge muestra `unreadCount` total y los avisos nuevos generan un mensaje en la
aplicación. Al ocultar la pestaña se pausa; al volver se consulta inmediatamente.
Al cerrar sesión o desmontar se detiene y limpia. Las respuestas antiguas no
pueden restaurar avisos de otra sesión ni revertir una marca de lectura.
Un error de red se informa y se puede reintentar; el polling también reintenta.

## Simulación y cronogramas

`/simulations` permite calcular (`POST /simulations/calculate`) y recuperar por
UUID (`GET /simulations/{id}`) simulaciones propias. El formulario envía meses,
importes como strings y porcentajes convertidos exactamente a decimal; por
ejemplo `8.123456 %` se envía como `"0.08123456"`. El préstamo no supera el valor
del inmueble, el plazo es 1–360 meses y la TEA es mayor que 0 y hasta 100 %.
La fecha inicial admite 1900–9990 y la última cuota no puede superar 9999.

Opciones avanzadas: gracia parcial/total de 1–36 meses menor al plazo; balón
positivo al vencimiento de hasta el préstamo; seguros mensuales y gastos por
defecto cero; COK opcional (vacío usa TEA y cero es válido). El backend realiza
las validaciones financieras definitivas. La interfaz no calcula cuotas ni
recalcula métricas localmente. Con gracia total, amortización e intereses se
solapan por capitalización: no se suman para inferir el costo total.

Desde `/offers/:id` se consulta `GET /offers/{id}/schedule` y se genera o recupera
con `POST` al mismo endpoint sin cuerpo ni términos adicionales. Se utilizan las
instantáneas de la oferta DEMO con cero cargos y sin gracia ni balón. Ambos
recorridos requieren sesión y la API verifica propiedad/destinatario; un 404 no
revela recursos ajenos. Una respuesta incompleta, sin métricas/cuotas o con
saldo final distinto de cero se rechaza y no se presenta como resultado válido.
La tabla completa conserva fechas ISO (sin ajuste de zona horaria), todos los
importes exactos, métricas con cero y VAN negativo. En móvil se desplaza la tabla
horizontalmente con teclado o gesto táctil.

## Pruebas integradas contra la API real

Requisitos: Java 21, Maven, Node.js y pnpm indicados arriba, y Chrome instalado.
El backend debe estar disponible como repositorio hermano
`../upc-pre-202620-1ASI0657-15987-FidiaCorp-backend`, con el fixture de pruebas de
la tarea 15. Para otra ubicación local, establece `E2E_BACKEND_DIR`.
No necesitas PostgreSQL, claves de producción ni un backend ya iniciado.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test:unit
pnpm build
pnpm test:e2e
```

`@playwright/test`, `playwright` y `playwright-core` están fijados en 1.64.1; se
revisaron sus metadatos y no se ejecutan scripts de instalación. Se utiliza Chrome
del equipo en un contexto de prueba aislado, sin abrir perfiles personales ni
instalar un navegador automáticamente. Si tu ejecutable está en otra ubicación,
configura `E2E_BROWSER_EXECUTABLE` con su ruta local.

`test:e2e` compila las clases de prueba del backend y su classpath Maven, inicia
`BrowserFixtureServer` en loopback con H2, claves y credenciales aleatorias, y lee
su manifiesto privado 0600. Verifica el PID y rechaza URLs de API remotas. Luego
inicia Vite en un puerto aleatorio con `VITE_API_BASE_URL` del fixture. No utiliza
el backend de `.env.local` ni intercepta/responde solicitudes API desde Playwright.
El runner de Playwright se invoca mediante el launcher; ejecutarlo directamente
sin sus variables de entorno falla para evitar usar otro servidor accidentalmente.

La configuración usa un trabajador, cero reintentos y datos únicos por escenario.
Los seis recorridos verifican registro/perfil persistente (US01/US02), catálogo,
filtros y cancelación/eliminación (US07/US08/US14), entrega de oferta mediante el
polling real y lectura idempotente del aviso (US10), cronograma persistente desde
la oferta y simulación directa (US11), aislamiento entre dos usuarios, revocación
de una sesión sin cerrar la otra (US04), y activación/ingreso/desactivación TOTP
real (US03). Este último espera los siguientes intervalos reales de 30 segundos;
no altera el reloj ni simula códigos/respuestas del backend.

Los procesos dedicados se detienen y el manifiesto se elimina tanto al terminar
como ante error, timeout, SIGINT o SIGTERM. Las pruebas unitarias del launcher
cubren éxito, error, señal ya recibida, cierre prematuro, timeout y validación del
manifiesto. Un fallo conserva un log privado del fixture para diagnóstico en
`test-results/backend-fixture.log`; no imprime credenciales. Los resultados y
reportes se ignoran en Git. Capturas, trazas y vídeos están desactivados para no
persistir visualmente las claves TOTP temporales; cualquier diagnóstico local de
fallo sigue siendo privado y no debe publicarse como evidencia sin revisión.

Para ejecutar un caso específico, se pasan argumentos al runner:

```sh
pnpm test:e2e --grep "catálogo real"
```

El launcher no modifica el código del backend: genera únicamente sus artefactos
Maven de prueba y bases H2 efímeras. No se incluyen fixture ni credenciales en la
compilación de producción del frontend.
