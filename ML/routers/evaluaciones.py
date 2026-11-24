from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from app.security import supabase_admin, obtener_entrenador_actual
from app.services.ml_service import procesar_jugador_completo

router = APIRouter(prefix="/api/evalucacionnes", tags=["Procesamiento y Prediccion de Pruebas"])


@router.post("/evaluar-jugador", summary="Subir saltos de UN jugador + ingresar 9 hits y clasificar")
async def evaluar_jugador_en_paquete(
    file: UploadFile = File(..., description="Excel/CSV con las 3 repeticiones de salto de UN solo jugador"),
    jugador: Optional[str] = Form(None, description="Código o nombre del jugador (opcional; si se deja vacío usa el del archivo)"),
    intento1_hit1: float = Form(..., gt=0, description="Intento 1 - Hit 1 (ms)"),
    intento1_hit2: float = Form(..., gt=0, description="Intento 1 - Hit 2 (ms)"),
    intento1_hit3: float = Form(..., gt=0, description="Intento 1 - Hit 3 (ms)"),
    intento2_hit1: float = Form(..., gt=0, description="Intento 2 - Hit 1 (ms)"),
    intento2_hit2: float = Form(..., gt=0, description="Intento 2 - Hit 2 (ms)"),
    intento2_hit3: float = Form(..., gt=0, description="Intento 2 - Hit 3 (ms)"),
    intento3_hit1: float = Form(..., gt=0, description="Intento 3 - Hit 1 (ms)"),
    intento3_hit2: float = Form(..., gt=0, description="Intento 3 - Hit 2 (ms)"),
    intento3_hit3: float = Form(..., gt=0, description="Intento 3 - Hit 3 (ms)"),
    usuario = Depends(obtener_entrenador_actual)
):
    try:
        entrenador_id = usuario.id
        contents = await file.read()

        # 1. Procesar saltos + promediar los 9 hits + predecir en un solo paquete
        resultado = procesar_jugador_completo(
            file_bytes=contents,
            filename=file.filename,
            hits_intento_1=[intento1_hit1, intento1_hit2, intento1_hit3],
            hits_intento_2=[intento2_hit1, intento2_hit2, intento2_hit3],
            hits_intento_3=[intento3_hit1, intento3_hit2, intento3_hit3],
            codigo_jugador_manual=jugador
        )

        codigo_jugador = str(resultado["jugador"])

        # 2. Crear o actualizar jugador en Supabase (usando la columna 'jugador')
        res_j = supabase_admin.table("jugadores") \
            .select("id") \
            .eq("entrenador_id", entrenador_id) \
            .eq("jugador", codigo_jugador) \
            .execute()

        if res_j.data:
            jugador_id = res_j.data[0]["id"]
            supabase_admin.table("jugadores").update({
                "masa_kg": resultado["masa_kg"]
            }).eq("id", jugador_id).execute()
        else:
            ins_j = supabase_admin.table("jugadores").insert({
                "entrenador_id": entrenador_id,
                "jugador": codigo_jugador,
                "masa_kg": resultado["masa_kg"]
            }).execute()
            jugador_id = ins_j.data[0]["id"]

        # 3. Guardar la evaluación completa en Supabase
        eval_data = {
            "jugador_id": jugador_id,
            "entrenador_id": entrenador_id,
            "cmj_promedio_cm": resultado["cmj_promedio_cm"],
            "sj_promedio_cm": resultado["sj_promedio_cm"],
            "rsi_dj_promedio": resultado["rsi_dj_promedio"],
            "tiempo_reaccion_total_ms": resultado["tiempo_reaccion_total_ms"],
            "rsi_mod_promedio": resultado["rsi_mod_promedio"],
            "contacto_dj_promedio": resultado["contacto_dj_promedio"],
            "cluster_predicho": resultado["cluster_predicho"],
            "perfil_fisico": resultado["perfil_fisico"],
            "probabilidad_explosivo": resultado["probabilidad_explosivo"],
            "probabilidad_no_explosivo": resultado["probabilidad_no_explosivo"]
        }

        supabase_admin.table("evaluaciones").insert(eval_data).execute()

        return {
            "message": "Jugador evaluado y guardado correctamente en un solo paquete",
            "resultado": resultado
        }

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al procesar la evaluación: {str(e)}")