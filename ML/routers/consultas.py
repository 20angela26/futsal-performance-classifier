from fastapi import APIRouter, Depends, Query, HTTPException
from app.security import supabase_admin, obtener_entrenador_actual

router = APIRouter(prefix="/api/consultas", tags=["Consultas para el Entrenador"])


@router.get("/jugadores", summary="Listar todos los jugadores del entrenador con sus evaluaciones")
def listar_jugadores(usuario = Depends(obtener_entrenador_actual)):
    try:
        res = supabase_admin.table("jugadores") \
            .select("*, evaluaciones(*)") \
            .eq("entrenador_id", usuario.id) \
            .order("jugador", desc=False) \
            .execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al listar jugadores: {str(e)}")


@router.get("/por-cluster/{cluster_id}", summary="Filtrar evaluaciones por clúster (0 = Explosivo, 1 = Menor rendimiento)")
def listar_por_cluster(cluster_id: int, usuario = Depends(obtener_entrenador_actual)):
    if cluster_id not in (0, 1):
        raise HTTPException(status_code=400, detail="El cluster_id debe ser 0 o 1.")
    try:
        res = supabase_admin.table("evaluaciones") \
            .select("*, jugadores(jugador, masa_kg)") \
            .eq("entrenador_id", usuario.id) \
            .eq("cluster_predicho", cluster_id) \
            .order("id", desc=True) \
            .execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al filtrar por clúster: {str(e)}")


@router.get("/buscar", summary="Buscar jugador por código o nombre")
def buscar_jugador(
    jugador: str = Query(..., description="Código o nombre del jugador a buscar (ej. 408)"),
    usuario = Depends(obtener_entrenador_actual)
):
    try:
        res = supabase_admin.table("jugadores") \
            .select("*, evaluaciones(*)") \
            .eq("entrenador_id", usuario.id) \
            .ilike("jugador", f"%{jugador.strip()}%") \
            .execute()

        if not res.data:
            raise HTTPException(status_code=404, detail=f"No se encontraron jugadores con '{jugador}'.")
        return res.data
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al buscar jugador: {str(e)}")