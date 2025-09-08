# 📋 Gestor de Tareas API - Lucio Giraldez y Matías Valansi

API REST desarrollada con **Node.js, Express y PostgreSQL** para la gestión de usuarios y tareas.  
Incluye integración con APIs públicas para enriquecer la experiencia.

---

## 📦 Tecnologías
- Node.js
- Express
- PostgreSQL
- Axios
- Nodemailer
- Vue.js (Frontend, próximamente)

---

## 📁 Estructura de Carpetas

📁 tp2-proyecto-final
│── 📂 src
│   ├── 📂 controllers            # Controladores para manejar la lógica de negocio
│   │     ├── userController.js
│   │     └── taskController.js
│
│   ├── 📂 routes                 # Definición de rutas del servidor
│   │     ├── userRoutes.js
│   │     └── taskRoutes.js
│
│   ├── 📂 models                 # Modelos de datos y esquema de la base de datos
│   │     ├── userModel.js
│   │     └── taskModel.js
│
│   ├── 📂 services               # Servicios para interactuar con APIs externas y otras operaciones
│   │     ├── weatherService.js       # Servicio de clima
│   │     ├── cityService.js          # Servicio de ciudades
│   │     ├── holidayService.js       # Servicio de feriados
│   │     ├── currencyService.js      # Servicio de monedas
│   │     └── mailService.js          # Servicio de envío de mails
│
│   ├── 📂 repositories           # Capa de acceso a datos (consultas a la base de datos)
│   │     ├── userRepository.js
│   │     └── taskRepository.js
│
│   ├── 📂 config                 # Configuración de variables y servicios externos
│   │     ├── db.js                  # Conexión a PostgreSQL
│   │     └── mailConfig.js          # Configuración de Nodemailer
│
│   ├── 📂 tests                  # Pruebas unitarias y de integración
│   │     ├── user.test.js
│   │     └── task.test.js
│
│   ├── server.js                 # Punto de entrada del servidor (config Express)
│
│── 📂 docs                       # Documentación del proyecto (UML, casos de uso, etc.)
│   └── README-tecnico.md
│
│── 📂 public                     # Archivos estáticos o frontend si aplica (cuando sumes Vue)
│
│── .env                          # Variables de entorno (DB, API keys, etc.)
│── package.json                  # Dependencias y scripts de npm
│── README.md                     # Instrucciones de instalación y uso


---

## 📌 Funcionalidades
✅ CRUD de usuarios  
✅ CRUD de tareas  
✅ Consulta de clima al asignar tareas  *
✅ Verificación de feriados  *
✅ Conversión de presupuestos a USD *  
✅ Envío de mail al asignar tareas  *
✅ Validación/autocompletado de ciudades *
* --> Parte de la idea final 

---

## 📦 Instalación

1. Clonar el repositorio  
`git clone https://github.com/tuusuario/gestor-tareas-api.git`

2. Instalar dependencias  
`npm install`

3. Configurar `.env` con las claves de APIs y DB

4. Levantar el servidor  
`npm run app`

---

## 📋 Próximas mejoras
- Desarrollar frontend en Vue.js
- Autenticación JWT
- Historial de tareas completadas
- Subida de imágenes a tareas


## 🔗 APIs Externas que Pensamo Integrar a Futuro
- 🌦️ [OpenWeatherMap](https://openweathermap.org/api) → Consulta del clima.
- 📍 [GeoDB Cities](https://rapidapi.com/wirefreethought/api/geodb-cities/) → Validación/autocompletado de ciudades.
- 📅 [Calendarific](https://calendarific.com/) → Detección de feriados.
- 💵 [ExchangeRate](https://exchangerate.host/) → Conversión de monedas.
- 📧 [Nodemailer](https://nodemailer.com/) → Envío de mails al asignar tareas.

---

---

