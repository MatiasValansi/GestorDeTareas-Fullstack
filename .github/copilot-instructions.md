# GitHub Copilot Instructions for GestorDeTareas-Fullstack

## Visión general del proyecto
- Monorepo con dos apps:
  - `backend/`: API REST Node.js + Express, JWT, MongoDB (Mongo Atlas), Docker, Biome.
  - `frontend/`: SPA Vue 3 + Vite, Pinia, Axios, EmailJS, gráficos (VueChart.js) y consumo de MockAPI.
- Dominio principal: gestión de usuarios y tareas, con roles (admin/usuario), dashboard de estadísticas y vistas detalle.

## Cómo ejecutar y probar
- **Backend** (desde `backend/`):
  - Instalar dependencias: `npm install`
  - Levantar servidor en dev: revisa `package.json` y usa el script principal (por ejemplo `npm run app` o `npm start`).
  - API principal montada en `src/app.js` y `src/server.js`. CORS ya configurado para `http://localhost:5173`.
  - Status endpoints: `GET /v01/status`, `GET /v02/status` (ver `src/routes/statusRouter.js`).
  - Login local: `POST /login` en `src/app.js`, con usuario admin local hardcodeado.
  - Pruebas: existe `src/test/app.test.js` con Jest (ver `jest.config.js`); respeta esa estructura al agregar tests.
  - Docker: `Dockerfile` expone puerto `3004` y usa `npm start`; al cambiar scripts mantén consistencia.
- **Frontend** (desde `frontend/`):
  - Instalar dependencias: `npm install`
  - Desarrollo: `npm run dev` (Vite en puerto 5173 por defecto).
  - Build: `npm run build`.

## Arquitectura backend
- Punto de entrada: `src/server.js` crea el servidor y usa `src/app.js`.
- `src/app.js`:
  - Configura Express, CORS, `express.json()`.
  - Conecta a Mongo vía `database/mongoose.database.js` usando la config de `config/config.js`.
  - Registra routers: `statusRouter`, `taskRouter`, `userRouter`.
  - Implementa `/login` de admin local y generación de JWT con `utils/jwt.token.js`.
- Capas por dominio (seguir este patrón):
  - **Modelos**: `model/Task.js`, `model/User.js` (esquemas Mongoose). Si agregas campos, hazlo aquí.
  - **Repositorios**:
    - Mongo: `repository/task.mongo.repository.js`, `repository/user.mongo.repository.js`.
    - Implementación genérica/archivo JSON: `task.repository.js`, `user.repository.js` usando `utils/JsonManager.js` y `db/*.json`.
  - **Servicios**: `services/task.service.js`, `services/user.service.js` encapsulan la lógica de negocio y llaman a los repositorios.
  - **Controladores**: `controller/task.controller.js`, `controller/user.controller.js` manejan `req/res` y delegan en servicios.
  - **Rutas**: `routes/taskRouter.js`, `routes/userRouter.js`, `routes/statusRouter.js` exponen endpoints Express.
  - **Middleware auth**: `middleware/auth.jwt.js` valida JWT usando `utils/jwt.token.js`.
- Al agregar nuevas funcionalidades de backend:
  - Crea/actualiza modelo → repositorio → servicio → controlador → ruta, respetando la separación actual.
  - No accedas directamente a Mongoose en los controladores; usa los servicios/repositorios existentes como ejemplo.

## Arquitectura frontend
- Entrada: `src/main.js` monta `App.vue` y configura router (`src/router/index.js`) y Pinia (`src/stores/user.js`).
- Vistas principales en `src/views/`:
  - Usuarios: `UserView.vue`, `NewUserView.vue`, `EditUserView.vue`, `UserDetailView.vue`.
  - Tareas: `TaskView.vue`, `NewTaskView.vue`, `EditTaskView.vue`, `TaskDetailView.vue`.
  - Otras: `LoginView.vue`, `EmailSenderView.vue`.
- Componentes reutilizables en `src/components/` (ej. `DashboardStats.vue`, `GraficoTareas.vue`, `icons/*`).
- Acceso a datos:
  - `src/utils/api.js` centraliza configuración de Axios hacia el backend (cuando se use backend real).
  - `src/services/users.js` y `src/services/tasks.js` encapsulan llamadas HTTP; al agregar endpoints nuevos, extender aquí.
  - Algunas vistas (ej. `NewUserView.vue`, `NewTaskView.vue`) consumen MockAPI externos por URL fija; mantén consistente la base URL o migra a `api.js` si pasas a backend propio.
- Estado global:
  - `src/stores/user.js` mantiene el usuario logueado y permisos (ejemplo: `store.user.admin` usado en `UserDetailView.vue`).
  - Al introducir nuevos flags/roles, actualiza este store y ajusta checks en vistas.

## Convenciones y patrones del proyecto
- **Código backend**:
  - Módulos ES (`import`/`export`) en todo `src/`.
  - Respuestas JSON simples (`res.json({ ... })`) sin vistas; sigue el estilo de `task.controller.js` y `user.controller.js`.
  - Manejo de errores con `try/catch` en servicios/controladores; responde con códigos HTTP adecuados, siguiendo el estilo existente.
  - Autenticación: usa siempre `auth.jwt.js` como middleware en rutas protegidas, y genera tokens con `userToken` de `utils/jwt.token.js`.
- **Código frontend**:
  - Uso de `<script setup>` en componentes Vue nuevos.
  - Estilos definidos normalmente como `<style scoped>` y siguiendo la estética actual (colores Tailwind-like, bordes redondeados, sombras suaves).
  - Navegación con `useRouter()` y rutas declaradas en `router/index.js`; no hardcodear URLs fuera de ahí salvo redirecciones simples.
  - Validaciones de formularios en el propio componente (ver `NewUserView.vue` / `NewTaskView.vue` como guía).
- **Datos y persistencia local**:
  - JSONs de apoyo en backend: `src/db/task.db.json`, `src/db/user.db.json` gestionados por `utils/JsonManager.js`.
  - JSON de frontend para pruebas: `frontend/bd/tasks.bd.json`.

## Qué debe tener en cuenta un agente de IA
- Antes de cambiar scripts de `package.json`, revisa que coincidan con Docker (`backend/Dockerfile`) y con la documentación del README.
- No dupliques lógica de negocio: si necesitas una nueva variante de operación, extiende los servicios/repositorios existentes.
- Para nuevas vistas o flujos en frontend, reutiliza servicios y store actuales en vez de llamar APIs directo con Axios desde todos los componentes.
- Mantén los endpoints y esquemas en sincronía entre backend (`model/*`, `routes/*`) y frontend (`services/*`, vistas) cuando agregues/renombres campos.
- Las pruebas Jest en backend deben levantar la app desde `src/app.js`; usa el patrón ya definido en `src/test/app.test.js` para nuevos casos.
