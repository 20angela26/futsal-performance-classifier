# FutsalLab · Front de reportes

Front estático (HTML + CSS + JS, sin build) para la API `futsal-performance-classifier`.

## Cómo correrlo
1. Levanta el backend:  `uvicorn main:app --reload`  (queda en http://localhost:8000)
2. Sirve esta carpeta:  `python -m http.server 5500`  y abre http://localhost:5500
   (también funciona abriendo `index.html` directo o usando `python -m http.server 5500 -d front` cuando el front está en una carpeta separada ).
   
4. Si tu API está en otra URL: cámbiala en `js/config.js` (`API_BASE`) o en el login → "Servidor".
5. Botón **"Probar con datos de ejemplo"** para ver todo sin backend.

CORS ya está abierto (`allow_origins=["*"]`) en `main.py`.

## Qué consume
| Pantalla | Endpoint |
|---|---|
| Login / registro / recuperar | `/api/auth/login`, `/registro`, `/recuperar-pregunta`, `/restablecer-password` |
| Panel, Jugadores, Detalle, Comparar | `GET /api/consultas/jugadores` |
| Búsqueda en Jugadores | `GET /api/consultas/buscar?jugador=` |
| Reporte por perfil | `GET /api/consultas/por-cluster/{0|1}` |
| Nueva evaluación | `POST /api/evalucacionnes/evaluar-jugador` (multipart) |



## Reportes
- **Panel**: KPIs, distribución de perfiles, radar por clúster, top explosivos, evaluaciones recientes.
- **Jugadores**: tabla ordenable, búsqueda, filtro por perfil, export CSV / imprimir.
- **Detalle de jugador**: perfil, 6 métricas con variación vs. evaluación anterior, radar vs. equipo, evolución, historial.
- **Por perfil**: comparación Explosivo vs. Posicional + tablas de evaluaciones.
- **Comparar**: 2–4 jugadores en radar y tabla.
- **Evaluar**: sube el CSV/Excel + 9 hits y muestra la clasificación.
