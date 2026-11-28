# FidiaCorp — aplicación web

Cliente web con Vue, Vue Router y Tailwind CSS sobre Vite. El encabezado y los formularios usan HTML/CSS propios.

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
VITE_API_BASE_URL=/api/v1 pnpm build
pnpm preview
pnpm audit
```

`build` genera `dist/`; `preview` permite comprobar esa compilación localmente.
La auditoría detecta vulnerabilidades conocidas y no garantiza ausencia de malware.

## Configuración inicial y navegación

`src/main.js` registra Vue Router. Los estilos se definen en `src/style.css`,
que también importa Tailwind mediante su plugin de Vite. El encabezado usa HTML
nativo; PrimeVue y sus dependencias se retiraron por completo al no ser necesarios.
No se configura ni se simula una licencia, ni se modifican avisos de terceros.

La instancia del router se define en `src/router/index.js`; `src/router.js` la
reexporta por compatibilidad. Inicio utiliza la vista
`src/shared/presentation/views/home.vue` integrada desde `develop`.
Los destinos están centralizados en `src/router/navigation.js`:

| Ruta | Sección |
| --- | --- |
| `/home` | Inicio |
| `/realState` | Inmobiliario |
| `/offers` | Ofertas recibidas y detalle `/offers/:id` |
| `/notifications` | Notificaciones |
| `/simulations` | Simulación y recuperación de cronograma |
| `/profile` | Perfil |

La ruta `/` redirige a `/home`. Las rutas desconocidas muestran una página 404
con enlace al inicio. Inicio es público. `/login` y `/register` permiten ingresar y crear una cuenta.
Las otras secciones requieren sesión; Perfil consulta y actualiza los datos de la API.
Inmuebles, ofertas, notificaciones, perfil y simulaciones se conectan a la API.
`/products` y `/messaging` conservan compatibilidad mediante redirecciones a
`/offers` y `/notifications`.

El router utiliza historial HTML5 y respeta la base de Vite. En el servidor de
publicación se debe devolver `index.html` para rutas de la aplicación que no
correspondan a archivos, para permitir abrir y recargar enlaces directamente.

## API y cuentas

El frontend puede arrancar sin backend; registro, ingreso y perfil necesitan la API.
Crea `.env.development.local` con `VITE_API_BASE_URL=http://localhost:8080/api/v1`
(valor predeterminado en desarrollo) y reinicia Vite. Al compilar se exige un
valor explícito y válido; consulta la sección de despliegue. Todos los valores
`VITE_*` son públicos: nunca deben contener contraseñas, claves JWT o secretos
2FA. Si la API está en otro origen, el backend debe permitir ese origen con CORS.

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

La tarea 19 retiró PrimeVue, cuyo único uso era el contenedor del encabezado.
La navegación conserva enlaces, accesibilidad y estilos propios sin requerir una
clave de licencia. La suite integrada de Chrome verifica los recorridos reales.

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

## Sprint 3 alineado con los contratos reales (Etapa 1)

Todos los módulos usan los DTO reales del backend Spring Boot v1.3.0:

| Historia | Módulo | Contrato |
| --- | --- | --- |
| US05/US06 | `src/subscriptions` | `GET /payments/gateways`, `POST /payments/checkout` (402 = rechazo con `declineCode` y reintento con otra pasarela) y `POST /payments/verify` con `{ transactionReference, paymentMethod, amount, currency, planName }`; se leen `planName`, `endDate`, `statusDescription` y `paymentCount`. |
| US09 | `RegistryValidationBadge.vue` | `POST /properties/{id}/verify-registry` con `{ registryNumber, claimedOwner }`; badge desde `legitimacyStatus`/`certificateHash` de `PropertyResponse` (`VERIFIED_GENUINE`, `FLAGGED_ANOMALY`, `PENDING_VERIFICATION`). |
| US12 | `OfferSchedule.vue`, `ScheduleResult.vue` | Botones de descarga `.xlsx` (simulación y oferta). |
| US15 | `src/simulations/ai-api.js` | `{ monthlyIncome, downPaymentAvailable, currency, preferredDistrict, desiredTermYears, preferenceTags }`; lee `maxAllowableInstallment`, `evaluationSummary`, `relevanceScore`, `debtToIncomeRatioPercent`, `financiallyViable`, `recommendationReason`. |
| US16–US18 | `src/messaging`, `PropertiesView.vue` | Conversaciones reales con UUID (`POST/GET /messages/conversations`, `GET …/{id}/messages`), botón «Contactar» en cada ficha ajena, mensajes enviados/recibidos, bloqueos con `blockId`/`blockedId` y exportación `.txt`/`.json` del UUID real. |

`tests/contracts/sprint3-contracts.json` contiene respuestas **capturadas del backend real**
(`FrontendContractFixturesTest`) y `tests/contracts/openapi-v1.3.0.json` el documento
`/v3/api-docs` generado. `tests/sprint3-features.test.js` valida cada cuerpo enviado contra el
esquema de request del OpenAPI y procesa exactamente esas respuestas. Para regenerarlos:
`mvn test -Dtest=FrontendContractFixturesTest,OpenApiContractTest` en el backend y copiar
`target/frontend-contracts/sprint3-contracts.json` y `target/openapi/generated.json`.

## Sprint 4 (Etapa 2): US19–US22

| Historia | Módulo | Contrato (vía API Gateway) |
| --- | --- | --- |
| US19 | `SimulationView.vue`, `src/simulations/model.js` | Selector **TEA/TNA** (`#sim-rateType`) y capitalización (`#sim-compounding`: 360, 365, 12, 4, 2, 1). Se envía `rateType` y, con TNA, `compoundingPeriodsPerYear`; el resultado muestra la tasa ingresada y la **TEA equivalente** (`rate.effectiveAnnualRate`, p. ej. TNA 12 % diaria → 12.747431 %). |
| US20 | `SimulationHistory.vue`, `ScenarioComparatorView.vue` (`/simulations/compare`), `src/simulations/scenarios.js` | `GET /simulations?page&size` (historial propio, más recientes primero) y `POST /simulations/compare` con 2–3 escenarios (etiquetas únicas, misma moneda, prepago opcional `REDUCE_TERM`/`REDUCE_INSTALLMENT`); tabla lado a lado y mejor escenario por TCEA, intereses, cuota, VAN y costo total. |
| US21 | `src/offers/QuotationVersions.vue`, `OfferVersionsView.vue` (`/offers/:id/versions`), `src/offers/versions.js` | `GET /offers/{id}/versions`, `GET /quotations/versions/{versionId}/verify` (integridad SHA-256 recalculada en el servidor, vigencia) y, solo para `ROLE_REALTOR` emisor, `POST /offers/{id}/versions` con campos opcionales heredados. |
| US22 | `OfferSchedule.vue` («Exportar PDF»), `QuotationVersions.vue` | `GET /offers/{id}/schedule/export/pdf?version=n` (PDF desde el snapshot inmutable; 409 si el SHA-256 no coincide) y `GET /offers/{id}/exports` (historial de exportaciones). |

`tests/contracts/sprint4-contracts.json` contiene respuestas **capturadas del stack docker compose** a través
del gateway y `tests/contracts/openapi-v2-gateway.json` fusiona el OpenAPI generado por los 5 microservicios
(`target/openapi/<módulo>.json` de `OpenApiContractTest`). `tests/sprint4-features.test.js` valida los payloads
contra esos esquemas y procesa exactamente esas respuestas.

## Contenedor

`Dockerfile` multi-stage (`node:22-alpine` → `nginx:1.27-alpine`) compila con
`VITE_API_BASE_URL=/api/v1` y sirve la SPA en `:80`. `deploy/nginx.conf` aplica el fallback
`try_files $uri $uri/ /index.html` y reenvía `/api/` a **`http://api-gateway:8080`** (Etapa 2). El
`docker-compose.yml` del backend construye este repositorio como servicio `credicasa-frontend`.

## Pruebas integradas contra la API real (stack de microservicios)

Requisitos: Node.js y pnpm indicados arriba, Chrome instalado y el stack del backend levantado con Docker
(`docker compose up --build -d` en `../upc-pre-202620-1ASI0657-15987-FidiaCorp-backend`) **con
`E2E_FIXTURE_TOKEN` definido**, que habilita el endpoint interno que promueve la cuenta desechable del asesor.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test:unit
E2E_FIXTURE_TOKEN=<mismo valor que docker compose> pnpm test:e2e     # PowerShell: $env:E2E_FIXTURE_TOKEN='…'
```

`test:e2e` espera al API Gateway (`E2E_API_BASE_URL`, por defecto `http://localhost:8080/api/v1`; solo se
admite loopback HTTP con ruta `/api/v1`), registra por la API pública tres cuentas desechables (cliente, otro
cliente y asesor), promueve al asesor con `POST http://127.0.0.1:8081/api/v1/internal/e2e/accounts/{id}/realtor`
(`X-Fixture-Token` + `X-Internal-Token`, variables `E2E_FIXTURE_TOKEN` / `E2E_INTERNAL_TOKEN`), escribe un
manifiesto privado 0600 verificado por PID e inicia Vite en un puerto aleatorio con `VITE_API_BASE_URL` apuntando al
gateway (CORS central del gateway). No intercepta ni simula respuestas desde Playwright.

La configuración usa un trabajador, cero reintentos y datos únicos por escenario. Los 15 recorridos cubren
Sprint 2 (registro/perfil, catálogo, avisos por polling, simulación y aislamiento, revocación de sesión y TOTP
real), Sprint 3 (pasarelas, SUNARP, XLSX, asesor hipotecario, mensajería y bloqueos) y Sprint 4 (TNA→TEA,
historial, comparador con prepago, versiones inmutables, verificación SHA-256, PDF por versión y exportaciones,
emisión de versión por el asesor). Los avisos de oferta llegan de forma asíncrona (outbox → RabbitMQ → inbox), por
lo que las pruebas los esperan con sondeo. El TOTP espera los intervalos reales de 30 segundos.

Los procesos dedicados se detienen y el manifiesto se elimina al terminar, ante error, timeout, SIGINT o SIGTERM.
Capturas, trazas y vídeos están desactivados para no persistir claves TOTP temporales. Para un caso concreto:

```sh
pnpm test:e2e --grep "sprint 4"
```

## Entornos y despliegue estático

La configuración de la API se incorpora al JavaScript **al compilar**. Cambiar
una variable del servidor después de copiar `dist/` no cambia un build existente:
modifica la variable y vuelve a compilar. Nunca se incluyen secretos en `.env`,
variables `VITE_*` ni el código del navegador; las claves del backend permanecen
solo en su entorno de servidor.

- Desarrollo: `.env.development` contiene `http://localhost:8080/api/v1`.
  `.env.example` se puede copiar a `.env.development.local` para personalizarlo
  sin aplicar ese valor a producción.
- Producción: copia `.env.production.example` a `.env.production.local` y ajusta
  el valor, o suministra `VITE_API_BASE_URL` desde el entorno de build.
  Los archivos `*.local` se ignoran en Git.
- Se acepta `/api/v1` para un proxy del mismo origen o una URL HTTPS terminada
  en `/api/v1`. HTTP solo se permite para loopback local (`localhost`, IPv4
  127.0.0.0/8 o `::1`). Se rechazan credenciales, query, fragmentos, espacios y
  rutas distintas. Una API ausente o inválida impide el build; producción no
  utiliza un fallback implícito a localhost. Evita poner ajustes de desarrollo
  en `.env.local`, porque Vite carga ese archivo en todos los modos.

```sh
# Mismo origen: requiere configurar el proxy /api/ del host.
VITE_API_BASE_URL=/api/v1 pnpm build
# Otro origen: sustituye este dominio de ejemplo por la API real.
VITE_API_BASE_URL=https://api.example.com/api/v1 pnpm build
# Revisión local del build; no es el servidor de producción.
pnpm preview --host 127.0.0.1
```

Publica únicamente el contenido de `dist/`. No copies `.env*`, `node_modules`,
fuentes, manifiestos de prueba ni credenciales a la raíz web. El ejemplo
[`deploy/nginx.conf`](deploy/nginx.conf) sirve esa carpeta en el puerto 8080:

1. Copia `dist/` a `/usr/share/nginx/html` (o ajusta `root`) e instala la
   configuración en un servidor Nginx local que administres.
2. Revisa la configuración con `nginx -t` y reinicia/recarga tu servicio.
3. Termina TLS en Nginx o en el proxy frontal para publicar mediante HTTPS.
   El ejemplo escucha HTTP para uso interno/local y no incorpora certificados.

Nginx devuelve `index.html` para enlaces SPA como `/offers/:id`, `/profile` y
`/simulations`, permitiendo abrirlos o recargarlos directamente. El HTML no se
cachea (`no-store`); los assets con hash de Vite usan un año de caché e
`immutable`. Un asset inexistente y cualquier `/api/` sin proxy devuelven 404;
nunca se ocultan errores API con el HTML de la aplicación.

Con una API HTTPS de otro origen, conserva el bloque `/api/` de ejemplo (404) y
configura en el backend `CORS_ALLOWED_ORIGINS` con el origen HTTPS exacto de la
web. `Authorization` y `Retry-After` son necesarios para el cliente. No se usan
cookies ni claves privadas en el frontend.

Para **mismo origen**, sustituye únicamente el bloque `location ^~ /api/` del
archivo por un reverse proxy a la API que administras:

```nginx
location ^~ /api/ {
    proxy_pass http://api-gateway:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization $http_authorization;
    proxy_cache off;
}
```

`proxy_pass` sin sufijo conserva `/api/v1` completo. `api-gateway:8080`
es el servicio de Compose del backend: este nombre solo resuelve si Nginx se
conecta a la misma red, por lo que debes usar un upstream local alcanzable en tu
instalación. En este caso puedes dejar `CORS_ALLOWED_ORIGINS` vacío; no se necesita
un servicio externo de hosting. El backend tiene su propia configuración y
requisitos de despliegue, descritos en su repositorio.

### Azure Static Web Apps

[`public/staticwebapp.config.json`](public/staticwebapp.config.json) se copia a
`dist/` en cada build y reproduce en Azure Static Web Apps las reglas de
`deploy/nginx.conf`: fallback SPA a `index.html` para las rutas del router,
exclusión de `/assets/*`, `/images/*`, `/api/*` y archivos estáticos (un asset
inexistente sigue siendo 404), `no-store` para `index.html`, caché `immutable`
para los assets con hash y cabeceras `nosniff`, `Referrer-Policy`,
`X-Frame-Options: DENY` y `Permissions-Policy`. Como la API está en otro origen
(el gateway de Container Apps), compila con
`VITE_API_BASE_URL=https://<gateway>/api/v1`; el CORS del gateway admite solo el
hostname de la Static Web App del mismo despliegue (ver
`infra/azure/README-AZURE-DEPLOY.md` del backend).

Validación disponible: 65 pruebas unitarias, build de producción y 15 recorridos Chrome contra los
microservicios reales detrás del API Gateway; la imagen Nginx se construye y queda `healthy` dentro del
`docker-compose.yml` del backend.
