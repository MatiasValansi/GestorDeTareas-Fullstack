# Gestor de Tareas - Fullstack

Sistema completo de gestión de tareas con soporte para tareas recurrentes, roles de usuario (supervisor/usuario), notificaciones por email y visualización en calendario.

---

## Tabla de Contenidos

- [Visión General](#-visión-general)
- [Tecnologías](#-tecnologías)
- [Funcionalidades](#-funcionalidades)
- [Casos de Uso](#-casos-de-uso)
- [Instalación y Ejecución](#-instalación-y-ejecución)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Endpoints](#-api-endpoints)

---

## Visión General

Este proyecto es un **monorepo** que contiene dos aplicaciones:

| Capa | Descripción |
|------|-------------|
| **Backend** | API REST con Node.js, Express, MongoDB Atlas y autenticación JWT |
| **Frontend** | SPA con Vue 3, Vite, Pinia para gestión de estado y componentes reactivos |

El sistema permite gestionar tareas asignadas a usuarios organizados por sectores, con soporte completo para:
- Tareas únicas con fecha de inicio y vencimiento
- Tareas recurrentes (diarias, semanales, quincenales, mensuales)
- Roles diferenciados (Supervisor / Usuario)
- Notificaciones automáticas por email
- Vista de calendario y lista

---

## Tecnologías

### Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | ≥ 18 | Runtime de JavaScript |
| **Express** | 5.x | Framework web para la API REST |
| **MongoDB** | - | Base de datos NoSQL (Mongo Atlas) |
| **Mongoose** | 8.x | ODM para modelado de datos |
| **JWT** | - | Autenticación basada en tokens |
| **bcrypt** | 6.x | Hash seguro de contraseñas |
| **Nodemailer** | 7.x | Envío de emails (SMTP Brevo) |
| **Jest** | 30.x | Framework de testing |
| **Supertest** | 7.x | Testing de endpoints HTTP |
| **Biome** | 1.9.x | Linter y formateador de código |
| **Docker** | - | Containerización |

### Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Vue.js** | 3.5.x | Framework progresivo de JavaScript |
| **Vite** | 6.x | Build tool y dev server |
| **Vue Router** | 4.x | Enrutamiento SPA |
| **Pinia** | 3.x | Gestión de estado |
| **Axios** | 1.x | Cliente HTTP |
| **Chart.js** | 4.x | Gráficos y visualizaciones |
| **vue-chartjs** | 5.x | Integración de Chart.js con Vue |
| **v-calendar** | 3.x | Componente de calendario |
| **mitt** | 3.x | Event bus ligero |

---

## Funcionalidades

### Autenticación y Autorización

#### Backend
- **Login con JWT**: Autenticación mediante email y contraseña con generación de token
- **Middleware de autenticación**: Validación de tokens en rutas protegidas
- **Roles diferenciados**:
  - **Supervisor**: CRUD completo de usuarios y tareas del sector
  - **Usuario**: Gestión de sus propias tareas asignadas
- **Hash de contraseñas**: Encriptación con bcrypt (10 salt rounds)
- **Protección por sector**: Los supervisores solo pueden gestionar usuarios de su mismo sector

#### Frontend
- **Persistencia de sesión**: Almacenamiento en localStorage
- **Guards de navegación**: Redirección automática según autenticación y rol
- **Store de usuario**: Estado global con Pinia (`isLoggedIn`, `isSupervisor`)

---

### Gestión de Usuarios

#### Backend
- **CRUD completo** de usuarios (solo supervisores)
- **Campos del modelo User**:
  - `name`: Nombre completo
  - `email`: Email único (login)
  - `password`: Contraseña hasheada
  - `sector`: Sector organizacional (ej: `TECNOLOGIA_INFORMATICA`)
  - `isSupervisor`: Booleano que define el rol
- **Endpoints protegidos por rol y sector**

#### Frontend
- **Vista de usuarios**: Lista de usuarios del sector (solo supervisores)
- **Formularios de alta/edición** con validaciones
- **Vista de detalle de usuario**: Perfil con tareas asignadas filtradas en el calendario

---

### Gestión de Tareas

#### Backend
- **CRUD completo** de tareas
- **Campos del modelo Task**:
  - `title`: Título de la tarea
  - `description`: Descripción opcional
  - `date`: Fecha de inicio
  - `deadline`: Fecha de vencimiento
  - `status`: Estado (`PENDIENTE`, `COMPLETADA`, `VENCIDA`)
  - `assignedTo`: Array de usuarios asignados (relación con User)
  - `createdBy`: Usuario que creó la tarea
  - `recurringTaskId`: Referencia a tarea recurrente (si aplica)
- **Índices compuestos** para optimización de consultas
- **Endpoint de calendario** con filtrado por mes

#### Frontend
- **Vista de calendario**: Visualización mensual de tareas por día
- **Vista de lista**: Lista ordenable y filtrable
- **Formularios de creación/edición** con validaciones
- **Detalle de tarea**: Información completa con usuarios asignados
- **Filtros**:
  - Por estado (Pendiente, Completada, Vencida)
  - Por asignación (Mis tareas, Tareas de otros) - solo supervisores

---

### Tareas Recurrentes

#### Backend
- **Modelo RecurringTask** con patrones de recurrencia:
  - `DIARIA`: Todos los días o solo días hábiles (`includeWeekends`)
  - `SEMANAL`: Día específico de la semana
  - `QUINCENAL`: Cada dos semanas en día específico
  - `MENSUAL`: Día numérico del mes
- **Campos adicionales**:
  - `active`: Estado activo/pausado
  - `deactivatedAt`: Fecha de desactivación
  - `datePattern`: Día de la semana (LUNES, MARTES, etc.)
  - `numberPattern`: Día del mes (1-31)
- **Generación automática** de instancias de tareas por mes
- **Titular de tarea**: El usuario en posición 0 del `assignedTo` puede editar

#### Frontend
- **Vista dedicada** de tareas recurrentes
- **Filtros**: Todas, Activas, Pausadas
- **Detalle de tarea recurrente**: Configuración completa y estado
- **Mensajes diferenciados** según rol del usuario

---

### Sistema de Notificaciones

#### Backend
- **Servicio de email** con Nodemailer y SMTP Brevo
- **Tipos de notificaciones**:
  - **Tarea asignada**: Email al asignar una nueva tarea
  - **Recordatorio diario**: Tareas con deadline hoy
  - **Tarea recurrente creada**: Detalle de la configuración
- **Cron service**: Ejecución programada de recordatorios diarios
- **Agrupación inteligente**: Un email por usuario con todas sus tareas del día

#### Frontend
- **Vista de envío de emails** (EmailSenderView)

---

### Dashboard y Estadísticas

#### Frontend
- **Componente DashboardStats**: 
  - Total de tareas
  - Tareas completadas
  - Tareas pendientes
- **Componente GraficoTareas**: Visualización con Chart.js
- **Integración con MockAPI** para demostración

---

### Manejo de Zona Horaria

#### Backend y Frontend
- **Utilidad ArgentinaTime**: Conversión y formateo de fechas en hora Argentina (UTC-3)
- **Middleware dateParser**: Conversión automática de fechas en requests
- **Consistencia**: Todas las fechas se almacenan en UTC y se muestran en hora local

---

## Casos de Uso

### Caso de Uso 1: Supervisor crea una tarea

1. El supervisor inicia sesión en el sistema
2. Navega a "Agregar tarea" desde el botón flotante
3. Completa el formulario con título, descripción, fechas y usuarios asignados
4. El sistema valida los datos y crea la tarea
5. Se envía email de notificación a los usuarios asignados
6. La tarea aparece en el calendario y lista

### Caso de Uso 2: Usuario visualiza sus tareas

1. El usuario inicia sesión
2. Accede automáticamente a la vista principal con el calendario
3. Puede alternar entre vista calendario y lista
4. Solo visualiza las tareas donde está asignado
5. Puede filtrar por estado (Pendiente, Completada, Vencida)

### Caso de Uso 3: Supervisor gestiona usuarios del sector

1. El supervisor accede a la sección de usuarios
2. Visualiza la lista de usuarios de su sector
3. Puede crear nuevos usuarios asignándoles sector y rol
4. Puede editar o eliminar usuarios existentes
5. Puede ver el detalle de un usuario con sus tareas asignadas

### Caso de Uso 4: Creación de tarea recurrente

1. El supervisor (o usuario para sí mismo) accede a crear tarea recurrente
2. Define título, descripción y usuarios asignados
3. Selecciona periodicidad (Diaria, Semanal, Quincenal, Mensual)
4. Configura el patrón según la periodicidad:
   - Diaria: Incluir o no fines de semana
   - Semanal/Quincenal: Día de la semana
   - Mensual: Día del mes
5. El sistema genera automáticamente las instancias para el mes actual
6. Las tareas aparecen en el calendario con referencia a la recurrencia

### Caso de Uso 5: Recordatorios automáticos

1. El sistema ejecuta el cron service diariamente
2. Busca todas las tareas pendientes con deadline hoy
3. Agrupa las tareas por usuario asignado
4. Envía un único email por usuario con el listado de tareas
5. Registra el resultado de la operación

### Caso de Uso 6: Usuario cambia estado de tarea

1. El usuario accede al detalle de una tarea asignada
2. Marca la tarea como completada
3. El sistema actualiza el estado a `COMPLETADA`
4. La vista se actualiza reflejando el nuevo estado
5. Los filtros y contadores se recalculan

---

## Instalación y Ejecución

### Prerrequisitos

- **Node.js** ≥ 18.x
- **npm** ≥ 6.x
- **MongoDB Atlas** (o instancia local de MongoDB)
- **Docker** y **Docker Compose** (opcional, para ejecución containerizada)
- **Git** para clonar el repositorio

---

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/MatiasValansi/GestorDeTareas-Fullstack.git
cd GestorDeTareas-Fullstack
```

---

### Paso 2: Configurar Variables de Entorno

#### Backend (`backend/.env`)

Crear archivo `.env` en la carpeta `backend/`:

```env
# Base de datos MongoDB
MONGO_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# JWT - Clave secreta para firmar tokens (usar una clave segura)
JWT_SECRET=tu_clave_secreta_muy_segura_aqui

# Email - Configuración SMTP (Brevo/Sendinblue)
BREVO_API_KEY=tu_api_key_de_brevo
MAIL_FROM_NAME=Gestor de Tareas
MAIL_FROM_EMAIL=noreply@tudominio.com

# Entorno
NODE_ENV=development
PORT=3004
```

#### Frontend (`frontend/.env`)

Crear archivo `.env` en la carpeta `frontend/`:

```env
# URL del backend API
VITE_API_URL=http://localhost:3004
```

> **Nota**: En producción con Docker, cambiar a `VITE_API_URL=http://localhost:3004` o la URL del servidor.

---

### Opción A: Ejecución Local (Sin Docker)

#### Paso 3A.1: Iniciar el Backend

```bash
# Navegar a la carpeta backend
cd backend

# Instalar dependencias
npm install

# Iniciar en modo desarrollo (con hot reload)
npm run app
```

El servidor estará disponible en: **http://localhost:3004**

##### Comandos adicionales del Backend:

| Comando | Descripción |
|---------|-------------|
| `npm run app` | Modo desarrollo con watch (hot reload) |
| `npm start` | Modo producción |
| `npm test` | Ejecutar tests con Jest |
| `npm run lint` | Lint y formateo con Biome |

#### Paso 3A.2: Iniciar el Frontend

```bash
# Abrir nueva terminal y navegar a la carpeta frontend
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en: **http://localhost:5173**

##### Comandos adicionales del Frontend:

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build para producción |
| `npm run preview` | Preview del build de producción |

#### Verificar que todo funciona:

1. Backend corriendo en `http://localhost:3004`
2. Acceder a `http://localhost:3004` → Debe mostrar: `{"message":"API Gestor de Tareas funcionando correctamente 🚀"}`
3. Frontend corriendo en `http://localhost:5173`
4. Abrir navegador en `http://localhost:5173` → Página de login

---

### Opción B: Ejecución con Docker

El proyecto incluye configuración Docker con:
- **docker-compose.yml**: Orquestación de servicios
- **backend/Dockerfile**: Imagen Node.js Alpine para la API
- **frontend/Dockerfile**: Build multi-stage con Nginx para producción

#### Paso 3B.1: Configurar Variables de Entorno

Asegurarse de tener el archivo `backend/.env` configurado (ver Paso 2).

Para el frontend en Docker, crear `frontend/.env`:

```env
# URL del backend (en Docker, el frontend accede desde el navegador)
VITE_API_URL=http://localhost:3004
```

#### Paso 3B.2: Construir y Ejecutar con Docker Compose

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

Este comando:
1. Construye la imagen del backend (Node.js Alpine)
2. Construye la imagen del frontend (Nginx con build de Vue)
3. Inicia ambos contenedores

#### Paso 3B.3: Verificar los Contenedores

```bash
# Ver contenedores corriendo
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs solo del backend
docker-compose logs -f backend

# Ver logs solo del frontend
docker-compose logs -f frontend
```

#### Servicios Disponibles:

| Servicio | URL | Puerto Host | Puerto Container |
|----------|-----|-------------|------------------|
| **Backend (API)** | http://localhost:3004 | 3004 | 3004 |
| **Frontend (Web)** | http://localhost:5173 | 5173 | 80 |

#### Comandos Docker Útiles:

```bash
# Iniciar en segundo plano (detached)
docker-compose up -d --build

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Reconstruir solo un servicio
docker-compose up --build backend
docker-compose up --build frontend

# Ver estado de los contenedores
docker ps

# Acceder al shell de un contenedor
docker exec -it gestor-backend sh
docker exec -it gestor-frontend sh

# Reiniciar un servicio específico
docker-compose restart backend
```

#### Arquitectura Docker:

```
┌─────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐      ┌─────────────────────┐       │
│  │   gestor-frontend   │      │   gestor-backend    │       │
│  │   (Nginx + Vue)     │ ───► │   (Node.js + API)   │       │
│  │   Puerto: 5173:80   │      │   Puerto: 3004:3004 │       │
│  └─────────────────────┘      └──────────┬──────────┘       │
│                                          │                  │
│                                          ▼                  │
│                               ┌─────────────────────┐       │
│                               │   MongoDB Atlas     │       │
│                               │   (Cloud externo)   │       │
│                               └─────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Ejecutar Tests

```bash
# Desde la carpeta backend
cd backend

# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm test -- --watch

# Ejecutar un archivo de test específico
npm test -- src/test/auth.controller.test.js
```

---

### Troubleshooting

#### El frontend no conecta con el backend

1. Verificar que `VITE_API_URL` en `frontend/.env` apunta a `http://localhost:3004`
2. Verificar que el backend está corriendo
3. En Docker, el frontend accede al backend desde el navegador, no entre contenedores

#### Error de conexión a MongoDB

1. Verificar que `MONGO_URI` en `backend/.env` es correcto
2. Verificar que la IP está whitelisteada en MongoDB Atlas
3. Para desarrollo local, permitir acceso desde `0.0.0.0/0`

#### Puerto ya en uso

```bash
# Ver qué proceso usa el puerto (Windows)
netstat -ano | findstr :3004

# Ver qué proceso usa el puerto (Linux/Mac)
lsof -i :3004

# En Docker, detener contenedores anteriores
docker-compose down
```

#### Reconstruir desde cero (Docker)

```bash
# Eliminar todo y reconstruir
docker-compose down -v
docker system prune -f
docker-compose up --build
```

---

## Estructura del Proyecto

```
GestorDeTareas-FullStackORT/
├── backend/
│   ├── src/
│   │   ├── app.js              # Configuración Express
│   │   ├── server.js           # Entry point
│   │   ├── config/             # Configuración (env, constants)
│   │   ├── controller/         # Controladores HTTP
│   │   ├── database/           # Conexión MongoDB
│   │   ├── middleware/         # Auth, authorization, dateParser
│   │   ├── model/              # Modelos Mongoose
│   │   ├── repository/         # Capa de acceso a datos
│   │   ├── routes/             # Definición de rutas
│   │   ├── services/           # Lógica de negocio
│   │   ├── test/               # Tests unitarios e integración
│   │   └── utils/              # Utilidades (JWT, fechas, JSON)
│   ├── Dockerfile
│   ├── package.json
│   └── biome.json
│
├── frontend/
│   ├── src/
│   │   ├── App.vue             # Componente raíz
│   │   ├── main.js             # Entry point
│   │   ├── assets/             # Estilos CSS
│   │   ├── components/         # Componentes reutilizables
│   │   ├── router/             # Configuración de rutas
│   │   ├── services/           # Llamadas a API
│   │   ├── stores/             # Estado global (Pinia)
│   │   ├── utils/              # Utilidades
│   │   └── views/              # Vistas/páginas
│   ├── adapters/               # Adaptadores de datos
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
│
├── docker-compose.yml
└── README.md
```

---

## API Endpoints

### Autenticación (`/auth`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Iniciar sesión | ❌ |
| GET | `/auth/me` | Obtener perfil actual | ✅ |

### Tareas (`/tasks`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/tasks/allTasks` | Listar todas las tareas | ✅ | - |
| GET | `/tasks/task/:id` | Obtener tarea por ID | ✅ | - |
| GET | `/tasks/calendar` | Tareas para calendario | ✅ | - |
| POST | `/tasks/task` | Crear tarea | ✅ | - |
| PUT | `/tasks/task/:id` | Actualizar tarea | ✅ | - |
| DELETE | `/tasks/task/:id` | Eliminar tarea | ✅ | - |

### Usuarios (`/users`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/users/sector` | Usuarios del mismo sector | ✅ | - |
| GET | `/users/allUsers` | Listar todos los usuarios | ✅ | Supervisor |
| GET | `/users/user/:id` | Obtener usuario por ID | ✅ | Supervisor |
| POST | `/users/user` | Crear usuario | ✅ | Supervisor |
| PUT | `/users/user/:id` | Actualizar usuario | ✅ | Supervisor |
| DELETE | `/users/user/:id` | Eliminar usuario | ✅ | Supervisor |

### Tareas Recurrentes (`/recurringTask`)

| Método | Endpoint | Descripción | Auth | Rol |
|--------|----------|-------------|------|-----|
| GET | `/recurringTask/recurring-tasks` | Listar todas | ✅ | Supervisor |
| GET | `/recurringTask/recurring-tasks/my-tasks` | Mis tareas recurrentes | ✅ | - |
| GET | `/recurringTask/recurring-tasks/detail/:id` | Detalle con permisos | ✅ | - |
| GET | `/recurringTask/recurring-tasks/:id` | Obtener por ID | ✅ | Supervisor |
| POST | `/recurringTask/recurring-tasks` | Crear (asignar a otros) | ✅ | Supervisor |
| POST | `/recurringTask/recurring-tasks/my-task` | Crear para sí mismo | ✅ | - |
| POST | `/recurringTask/recurring-tasks/generate/:year/:month` | Generar instancias | ✅ | - |
| PUT | `/recurringTask/recurring-tasks/:id` | Actualizar | ✅ | Titular |
| PATCH | `/recurringTask/recurring-tasks/:id/deactivate` | Desactivar | ✅ | Titular |
| DELETE | `/recurringTask/recurring-tasks/:id` | Eliminar | ✅ | Supervisor |

### Cron (`/cron`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/cron/run-daily-reminders` | Ejecutar recordatorios | ✅ |

### Status (`/api`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/v01/status` | Estado API v1 | ❌ |
| GET | `/api/v02/status` | Estado API v2 | ❌ |


## Contribuidores

Proyecto desarrollado por Lucio Giraldez y Matías Valansi integrando todo lo aprendido en la carrera de Analista de Sistemas de ORT.
