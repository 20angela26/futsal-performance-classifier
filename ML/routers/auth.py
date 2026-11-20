from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from app.security import supabase, supabase_admin
import bcrypt

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

# Configuración de encriptación bcrypt para el historial de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def obtener_hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verificar_password(password_plana: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password_plana.encode('utf-8'), 
        password_hash.encode('utf-8')
    )

# ==========================================
# ESQUEMAS DE VALIDACIÓN (PYDANTIC)
# ==========================================

class RegistroSchema(BaseModel):
    email: EmailStr
    password: str
    nombre_completo: str
    equipo: str
    pregunta_seguridad: str
    respuesta_seguridad: str

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class RecuperarPreguntaSchema(BaseModel):
    email: EmailStr

class RestablecerPasswordSchema(BaseModel):
    email: EmailStr
    respuesta_seguridad: str
    nueva_password: str


# ==========================================
# ENDPOINTS DE AUTENTICACIÓN
# ==========================================

@router.post("/registro", summary="Registrar un nuevo entrenador")
def registrar_entrenador(datos: RegistroSchema):
    try:
        # 1. Verificar si el email ya existe en la tabla de perfiles
        existente = supabase_admin.table("perfiles_entrenadores") \
            .select("id") \
            .eq("email", datos.email) \
            .execute()
        
        if existente.data:
            raise HTTPException(
                status_code=400, 
                detail="El entrenador ya se encuentra registrado con este correo electrónico."
            )

        # 2. Crear usuario directamente confirmado en Auth (sin envío de correos)
        res = supabase_admin.auth.admin.create_user({
            "email": datos.email,
            "password": datos.password,
            "email_confirm": True
        })
        if not res.user:
            raise HTTPException(status_code=400, detail="No se pudo registrar al entrenador en Auth.")

        user_id = res.user.id
        hash_inicial = obtener_hash_password(datos.password)

        try:
            # 3. Guardar perfil en perfiles_entrenadores
            supabase_admin.table("perfiles_entrenadores").insert({
                "id": user_id,
                "nombre_completo": datos.nombre_completo,
                "email": datos.email,
                "equipo": datos.equipo,
                "rol": "entrenador",
                "pregunta_seguridad": datos.pregunta_seguridad,
                "respuesta_seguridad": datos.respuesta_seguridad.strip().lower()
            }).execute()

            # 4. Guardar hash inicial en historial_passwords
            supabase_admin.table("historial_passwords").insert({
                "entrenador_id": user_id,
                "password_hash": hash_inicial
            }).execute()
        except Exception as db_error:
            # Rollback: elimina el usuario de Auth si falla el guardado en base de datos
            supabase_admin.auth.admin.delete_user(user_id)
            raise db_error

        return {
            "message": "Entrenador registrado exitosamente.",
            "user_id": user_id
        }

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al registrar al entrenador: {str(e)}")


@router.post("/login", summary="Login Entrenador")
def login_entrenador(datos: LoginSchema):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": datos.email,
            "password": datos.password
        })
        
        if not res.session:
            raise HTTPException(status_code=401, detail="Credenciales inválidas.")

        return {
            "access_token": res.session.access_token,
            "token_type": "bearer",
            "user_id": res.user.id,
            "email": res.user.email
        }

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Error al iniciar sesión: {str(e)}")


@router.post("/recuperar-pregunta", summary="Obtener pregunta de seguridad del entrenador")
def recuperar_pregunta(datos: RecuperarPreguntaSchema):
    try:
        perfil = supabase_admin.table("perfiles_entrenadores") \
            .select("pregunta_seguridad") \
            .eq("email", datos.email) \
            .execute()

        if not perfil.data:
            raise HTTPException(status_code=404, detail="No existe ningún entrenador registrado con ese correo.")

        return {
            "email": datos.email,
            "pregunta_seguridad": perfil.data[0]["pregunta_seguridad"]
        }

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al consultar pregunta: {str(e)}")


@router.post("/restablecer-password", summary="Restablecer contraseña verificando historial")
def restablecer_password(datos: RestablecerPasswordSchema):
    try:
        # 1. Buscar perfil y verificar respuesta de seguridad
        perfil = supabase_admin.table("perfiles_entrenadores") \
            .select("id, respuesta_seguridad") \
            .eq("email", datos.email) \
            .execute()

        if not perfil.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        entrenador = perfil.data[0]
        if entrenador["respuesta_seguridad"] != datos.respuesta_seguridad.strip().lower():
            raise HTTPException(status_code=400, detail="La respuesta de seguridad es incorrecta.")

        user_id = entrenador["id"]

        # 2. Consultar historial de contraseñas usadas por este entrenador
        historial = supabase_admin.table("historial_passwords") \
            .select("password_hash") \
            .eq("entrenador_id", user_id) \
            .execute()

        # 3. Validar que la nueva contraseña no coincida con ninguna anterior
        for registro in historial.data:
            if verificar_password(datos.nueva_password, registro["password_hash"]):
                raise HTTPException(
                    status_code=400,
                    detail="La nueva contraseña no puede ser igual a ninguna contraseña utilizada anteriormente."
                )

        # 4. Actualizar la contraseña en Supabase Auth
        supabase_admin.auth.admin.update_user_by_id(
            user_id,
            {
                "password": datos.nueva_password,
                "email_confirm": True
            }
        )

        # 5. Guardar el nuevo hash en historial_passwords
        nuevo_hash = obtener_hash_password(datos.nueva_password)
        supabase_admin.table("historial_passwords").insert({
            "entrenador_id": user_id,
            "password_hash": nuevo_hash
        }).execute()

        return {"message": "Contraseña actualizada exitosamente y registrada en el historial."}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al restablecer la contraseña: {str(e)}")