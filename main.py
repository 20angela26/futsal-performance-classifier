from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ML.routers import auth, evaluaciones, consultas


app = FastAPI(
    title="API de Evaluación de Jugadores de Futsal",
    description="Backend en FastAPI para el procesamiento de pruebas de salto inferencia con Regresion Logistica y persistencia",
    version="1.0.0",
)

# 2. Configurar CORS (Permite que una interfaz web o frontend realice peticiones a la API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción se puede restringir al dominio de tu app web
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Registrar los Routers de cada módulo
app.include_router(auth.router)
app.include_router(evaluaciones.router)
app.include_router(consultas.router)

# 4. Ruta raíz de prueba/bienvenida
@app.get("/", tags=["Inicio"])
def inicio():
    return {
        "mensaje": "API del Sistema de Clasificación Físico-Deportiva activa",
        "documentacion": "/docs"
    }
