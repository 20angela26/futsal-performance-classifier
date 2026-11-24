import io
import joblib
import pandas as pd
from fastapi import HTTPException

pipeline = joblib.load("modelo_clasificacion_jugadores.joblib")

PERFILES = {
    0: "Mayor rendimiento explosivo, reactivo y de agilidad",
    1: "Menor rendimiento relativo en las capacidades evaluadas"
}


def procesar_jugador_completo(
    file_bytes: bytes,
    filename: str,
    hits_intento_1: list[float],
    hits_intento_2: list[float],
    hits_intento_3: list[float],
    codigo_jugador_manual: str | None = None
) -> dict:
    """
    Procesa el archivo de saltos de UN ÚNICO jugador junto con sus 9 hits (3x3),
    promedia todo en un solo paquete y ejecuta el modelo con las 6 variables reales.
    """
    try:
        if filename.endswith(".csv"):
            df_raw = pd.read_csv(io.BytesIO(file_bytes))
        else:
            df_raw = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer el archivo: {str(e)}")

    df_raw.columns = df_raw.columns.str.strip()

    # 1. Identificar código de atleta y repetición
    if "deportista" in df_raw.columns:
        extraido = df_raw["deportista"].astype(str).str.strip().str.extract(
            r"^(?P<id_atleta>.+)\.(?P<repeticion>\d+)$"
        )
        if extraido.isna().any().any():
            raise HTTPException(
                status_code=400,
                detail="El formato de 'deportista' debe ser 'codigo.repeticion' (ej. FSU1_2025_28.1)."
            )
        df_raw["id_atleta"] = extraido["id_atleta"]
        df_raw["repeticion"] = extraido["repeticion"].astype(int)
    elif "Jugador" in df_raw.columns and "repeticion" in df_raw.columns:
        df_raw["id_atleta"] = df_raw["Jugador"].astype(str).str.strip()
        df_raw["repeticion"] = df_raw["repeticion"].astype(int)
    else:
        raise HTTPException(
            status_code=400,
            detail="El archivo debe contener la columna 'deportista' o las columnas 'Jugador' y 'repeticion'."
        )

    # 2. Validar que el archivo pertenezca a UN SOLO jugador
    atletas_unicos = df_raw["id_atleta"].unique()
    if len(atletas_unicos) != 1:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo debe contener los datos de un único jugador, pero se encontraron {len(atletas_unicos)}: {list(atletas_unicos)}."
        )

    id_atleta_archivo = str(atletas_unicos[0])

    # Validar categoría universitario si existe la columna
    if "categoria" in df_raw.columns:
        cat = df_raw["categoria"].astype(str).str.strip().str.casefold().unique()
        if list(cat) != ["universitario"]:
            raise HTTPException(
                status_code=400,
                detail=f"Solo se permiten deportistas de categoría 'universitario'. Se encontró: {list(cat)}."
            )

    # 3. Validar las 3 repeticiones exactas [1, 2, 3] y consistencia de masa_kg
    reps = sorted(df_raw["repeticion"].tolist())
    if reps != [1, 2, 3]:
        raise HTTPException(
            status_code=400,
            detail=f"El jugador debe tener exactamente 3 repeticiones [1, 2, 3]. Se encontraron: {reps}."
        )

    columnas_necesarias = [
        "masa_kg",
        "jump_height_impdis_cm_cmj",
        "rsi_mod_m/s_cmj",
        "contact_time_s_dj",
        "rsi_ratio_dj",
        "jump_height_impdis_cm_sj"
    ]
    faltan = sorted(set(columnas_necesarias) - set(df_raw.columns))
    if faltan:
        raise HTTPException(status_code=400, detail=f"Faltan columnas en el archivo: {faltan}")

    df_num = df_raw[columnas_necesarias].apply(pd.to_numeric, errors="coerce")
    if df_num.isna().any().any():
        raise HTTPException(status_code=400, detail="Existen valores faltantes o no numéricos en las pruebas de salto.")
    if df_num["masa_kg"].nunique() != 1:
        raise HTTPException(status_code=400, detail="La columna 'masa_kg' tiene valores distintos entre repeticiones.")
    if (df_num["contact_time_s_dj"] <= 0).any():
        raise HTTPException(status_code=400, detail="El tiempo de contacto DJ debe ser mayor que cero.")

    # 4. Calcular promedios de saltos y masa corporal
    masa_kg = float(df_num["masa_kg"].iloc[0])
    cmj_prom = float(df_num["jump_height_impdis_cm_cmj"].mean())
    sj_prom = float(df_num["jump_height_impdis_cm_sj"].mean())
    rsi_dj_prom = float(df_num["rsi_ratio_dj"].mean())
    rsi_mod_prom = float(df_num["rsi_mod_m/s_cmj"].mean())
    contacto_dj_prom = float(df_num["contact_time_s_dj"].mean())

    # 5. Validar y promediar los 9 hits (3 intentos x 3 hits)
    for idx, intento in enumerate([hits_intento_1, hits_intento_2, hits_intento_3], start=1):
        if len(intento) != 3 or any(h <= 0 for h in intento):
            raise HTTPException(
                status_code=400,
                detail=f"El intento {idx} debe tener exactamente 3 valores positivos en milisegundos."
            )

    prom_int_1 = sum(hits_intento_1) / 3.0
    prom_int_2 = sum(hits_intento_2) / 3.0
    prom_int_3 = sum(hits_intento_3) / 3.0
    t_reaccion_total = round((prom_int_1 + prom_int_2 + prom_int_3) / 3.0, 4)

    # 6. Ejecutar el Pipeline con las 6 variables reales
    X_input = pd.DataFrame([{
        'CMJ PROMEDIO (cm)': cmj_prom,
        'SJ PROMEDIO (cm)': sj_prom,
        'RSI DJ PROMEDIO': rsi_dj_prom,
        'Tiempo de reacción promedio TOTAL(ms)': t_reaccion_total,
        'RSI mod PROMEDIO': rsi_mod_prom,
        'Contacto DJ PROMEDIO': contacto_dj_prom
    }])

    pred = int(pipeline.predict(X_input)[0])
    probas = pipeline.predict_proba(X_input)[0]

    jugador_final = codigo_jugador_manual.strip() if codigo_jugador_manual and codigo_jugador_manual.strip() else id_atleta_archivo

    return {
        "jugador": jugador_final,
        "masa_kg": masa_kg,
        "cmj_promedio_cm": round(cmj_prom, 4),
        "sj_promedio_cm": round(sj_prom, 4),
        "rsi_dj_promedio": round(rsi_dj_prom, 4),
        "tiempo_reaccion_total_ms": t_reaccion_total,
        "detalle_hits": {
            "promedio_intento_1_ms": round(prom_int_1, 4),
            "promedio_intento_2_ms": round(prom_int_2, 4),
            "promedio_intento_3_ms": round(prom_int_3, 4),
        },
        "rsi_mod_promedio": round(rsi_mod_prom, 4),
        "contacto_dj_promedio": round(contacto_dj_prom, 4),
        "cluster_predicho": pred,
        "perfil_fisico": PERFILES.get(pred, "Por interpretar"),
        "probabilidad_explosivo": round(float(probas[0]), 4),
        "probabilidad_no_explosivo": round(float(probas[1]), 4)
    }