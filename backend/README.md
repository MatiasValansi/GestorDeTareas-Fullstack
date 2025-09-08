# GestorDeTareas-ProyectoFinalTPII

# 📋 Gestor de Tareas API - Lucio Giraldez y Matías Valansi

API REST desarrollada con **Node.js, Express y JWT ** para la gestión de usuarios y tareas.  

---

## 📦 Tecnologías
- Node.js
- Express
- Docker
- JWT
- Biome
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
│   ├── 📂 repositories           # Capa de acceso a datos (consultas a la base de datos)
│   │     ├── userRepository.js
│   │     └── taskRepository.js
│
│   ├── 📂 config                 # Configuración de variables y servicios externos
│   │     ├── db.js                  # Conexión a PostgreSQL
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
│
│── .env                          # Variables de entorno (DB, API keys, etc.)
│── package.json                  # Dependencias y scripts de npm
│── README.md                     # Instrucciones de instalación y uso


---

## 📌 Funcionalidades
✅ CRUD de usuarios  
✅ CRUD de tareas 
✅ Autenticación con JWT
✅ Persistencia en MongoAtlas
✅ Pruebas unitarias testeadas

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

---
