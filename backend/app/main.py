from datetime import date
import base64
import re
from pathlib import Path
import tempfile

from deepface import DeepFace
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db, engine
from app import models, schemas, crud
from app.auth import authenticate_user, hash_password


# DATABASE

models.Base.metadata.create_all(bind=engine)


def _ensure_runtime_columns():
    with engine.begin() as conn:
        client_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(clients)")).fetchall()]
        if "status" not in client_columns:
            conn.execute(text("ALTER TABLE clients ADD COLUMN status VARCHAR DEFAULT 'active' NOT NULL"))
        if "face_image_url" not in client_columns:
            conn.execute(text("ALTER TABLE clients ADD COLUMN face_image_url VARCHAR DEFAULT ''"))
        if "allows_photos" not in client_columns:
            conn.execute(text("ALTER TABLE clients ADD COLUMN allows_photos BOOLEAN DEFAULT 1 NOT NULL"))
        if "allows_face_recognition" not in client_columns:
            conn.execute(text("ALTER TABLE clients ADD COLUMN allows_face_recognition BOOLEAN DEFAULT 1 NOT NULL"))

        user_columns = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "phone" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR DEFAULT '' NOT NULL"))


_ensure_runtime_columns()


# PATHS

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve()
FACE_IMAGES_DIR = FRONTEND_DIR / "assets" / "client-faces"
FACE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


# APP

app = FastAPI()


# AUTH - LOGIN / USUÁRIOS

def _require_admin_header(x_user_role: str | None = Header(default=None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")


@app.post("/api/auth/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)

    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha inválidos.")

    return {
        "user": user,
        "message": "Login realizado com sucesso.",
    }


@app.post("/api/auth/register-client", response_model=schemas.LoginResponse)
def register_client(payload: schemas.ClientRegisterRequest, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Já existe usuário com esse email.")

    user_payload = schemas.UserCreate(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        password=payload.password,
        role="client",
        is_active=True,
    )
    user = crud.create_user(db, user_payload, hash_password(payload.password))

    existing_client = crud.get_client_by_email(db, payload.email)
    if not existing_client:
        client_payload = schemas.ClientCreate(
            name=payload.name,
            phone=payload.phone,
            email=payload.email,
            status="active",
            allows_photos=True,
            allows_face_recognition=True,
            preferred_cut="",
            notes="Cadastro feito pelo portal do cliente.",
        )
        crud.create_client(db, client_payload)

    return {"user": user, "message": "Cadastro realizado com sucesso."}


@app.post("/api/auth/seed-admin", response_model=schemas.UserResponse)
@app.get("/api/auth/seed-admin", response_model=schemas.UserResponse)
def seed_admin(db: Session = Depends(get_db)):
    return crud.ensure_default_admin(db, "admin123")


@app.get("/api/users", response_model=list[schemas.UserResponse])
def get_users(
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin_header),
):
    return crud.list_users(db)


@app.post("/api/users", response_model=schemas.UserResponse)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin_header),
):
    if payload.role == "client":
        raise HTTPException(status_code=400, detail="Clientes devem se cadastrar pela tela de cadastro do cliente.")

    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Já existe usuário com esse email.")

    return crud.create_user(db, payload, hash_password(payload.password))


@app.put("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin_header),
):
    if payload.role == "client":
        raise HTTPException(status_code=400, detail="Na aba Usuários, crie apenas administradores e barbeiros.")

    existing_email_user = crud.get_user_by_email(db, payload.email)

    if existing_email_user and existing_email_user.id != user_id:
        raise HTTPException(status_code=400, detail="Já existe usuário com esse email.")

    user = crud.update_user(db, user_id, payload)

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    return user


@app.patch("/api/users/{user_id}/password", response_model=schemas.UserResponse)
def reset_user_password(
    user_id: int,
    payload: schemas.UserPasswordReset,
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin_header),
):
    user = crud.reset_user_password(db, user_id, hash_password(payload.password))

    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    return user


@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    x_user_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
    _: None = Depends(_require_admin_header),
):
    if x_user_id and str(user_id) == str(x_user_id):
        raise HTTPException(status_code=400, detail="Você não pode excluir seu próprio usuário logado.")

    deleted = crud.delete_user(db, user_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    return {"message": "Usuário removido com sucesso."}


# CORS

ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# STATIC FILES

if (FRONTEND_DIR / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIR / "assets"),
        name="assets",
    )


# FRONTEND

@app.get("/")
def serve_dashboard():
    index_file = FRONTEND_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend não encontrado.")

    return FileResponse(index_file)

# CLIENTES

@app.get("/api/cuthub/dashboard")
def cuthub_dashboard(db: Session = Depends(get_db)):
    return crud.get_cuthub_dashboard(db)


@app.get("/api/clients", response_model=list[schemas.ClientResponse])
def get_clients(db: Session = Depends(get_db)):
    return crud.list_clients(db)


@app.post("/api/clients", response_model=schemas.ClientResponse)
def create_client(payload: schemas.ClientCreate, db: Session = Depends(get_db)):
    return crud.create_client(db, payload)


@app.put("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: int,
    payload: schemas.ClientCreate,
    db: Session = Depends(get_db),
):
    client = crud.update_client(db, client_id, payload)

    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    return client


@app.patch("/api/clients/{client_id}/status", response_model=schemas.ClientResponse)
def update_client_status(
    client_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    status_value = str(payload.get("status", "active")).strip().lower()
    if status_value not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="Status inválido.")

    client = crud.set_client_status(db, client_id, status_value)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return client


@app.post("/api/clients/{client_id}/face", response_model=schemas.ClientResponse)
def save_client_face(
    client_id: int,
    payload: schemas.ClientFaceCaptureRequest,
    db: Session = Depends(get_db),
):
    client = crud.get_client_by_id(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    raw_data = payload.image_data.strip()
    match = re.match(r"^data:image/(png|jpeg|jpg);base64,(.+)$", raw_data)
    if not match:
        raise HTTPException(status_code=400, detail="Imagem inválida. Capture uma foto pela webcam.")

    extension = "jpg" if match.group(1) in {"jpeg", "jpg"} else "png"
    try:
        image_bytes = base64.b64decode(match.group(2), validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Não foi possível processar a imagem.") from exc

    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Imagem muito pequena. Capture novamente.")

    file_name = f"client_{client_id}_face.{extension}"
    file_path = FACE_IMAGES_DIR / file_name
    file_path.write_bytes(image_bytes)

    face_url = f"/assets/client-faces/{file_name}"
    updated = crud.update_client_face_image(db, client_id, face_url)
    if not updated:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    return updated


@app.post("/api/recognition/identify")
def identify_client_by_face(
    payload: schemas.RecognitionIdentifyRequest,
    db: Session = Depends(get_db),
):
    """Identifica o cliente pela foto capturada na câmera.

    O fluxo usa DeepFace.verify com o modelo Facenet512 para comparar a imagem
    capturada com as fotos faciais cadastradas dos clientes ativos. O OpenCV é
    usado como backend de detecção facial dentro do DeepFace.

    Clientes com agendamento no dia são priorizados, pois em uma barbearia a
    câmera normalmente identifica pessoas que chegaram para um horário marcado.
    """
    raw_data = payload.image_data.strip()
    match = re.match(r"^data:image/(png|jpeg|jpg);base64,(.+)$", raw_data)
    if not match:
        raise HTTPException(status_code=400, detail="Imagem inválida. Capture uma foto pela webcam.")

    try:
        captured_bytes = base64.b64decode(match.group(2), validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Não foi possível processar a imagem capturada.") from exc

    recognition_date = payload.appointment_date or date.today()
    day_appointments = [
        item for item in crud.list_appointments(db, target_date=recognition_date)
        if item.status in {"scheduled", "in_progress"}
    ]
    appointment_by_client_id = {item.client_id: item for item in day_appointments}

    all_face_clients = [
        client
        for client in crud.list_clients(db)
        if getattr(client, "status", "active") == "active"
        and bool(getattr(client, "allows_face_recognition", True))
        and str(getattr(client, "face_image_url", "") or "").strip()
    ]

    if not all_face_clients:
        raise HTTPException(status_code=404, detail="Nenhum cliente ativo com rosto cadastrado e autorizado.")

    # Prioriza clientes com horário no dia antes de comparar com toda a base.
    scheduled_client_ids = {item.client_id for item in day_appointments}
    scheduled_clients = [client for client in all_face_clients if client.id in scheduled_client_ids]
    candidates_pool = scheduled_clients or all_face_clients

    def _client_face_path(client) -> Path:
        face_url = str(getattr(client, "face_image_url", "") or "").lstrip("/")
        return FRONTEND_DIR / face_url

    def _client_payload(client, score: float, source: str):
        appointment = appointment_by_client_id.get(client.id)
        return {
            "client": schemas.ClientResponse.model_validate(client).model_dump(mode="json"),
            "appointment": schemas.AppointmentResponse.model_validate(appointment).model_dump(mode="json") if appointment else None,
            "score": round(float(score), 4),
            "source": source,
        }

    ranked: list[dict] = []
    recognition_engine = "deepface"

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as captured_file:
        captured_file.write(captured_bytes)
        captured_path = captured_file.name

    for client in candidates_pool:
        face_path = _client_face_path(client)

        if not face_path.exists():
            continue

        try:
            recognition_engine = "deepface"
            result = DeepFace.verify(
                img1_path=captured_path,
                img2_path=str(face_path),
                model_name="Facenet512",
                detector_backend="opencv",
                enforce_detection=False
            )

            distance = float(result.get("distance", 1))
            score = max(0.0, min(1.0, 1 - distance))

            if client.id in scheduled_client_ids:
                score += 0.05

            ranked.append(
                _client_payload(
                    client,
                    min(score, 1.0),
                    recognition_engine
                )
            )
        except Exception as exc:
            continue

    if ranked:
        ranked.sort(key=lambda item: item["score"], reverse=True)
    else:
        ranked = []

    if not ranked:
        raise HTTPException(status_code=404, detail="Não foi possível comparar a imagem com rostos cadastrados.")

    best = ranked[0]
    best_client = best["client"]
    appointment = best["appointment"]
    score = float(best.get("score") or 0)
    if score < 0.30:
        raise HTTPException(
            status_code=404,
            detail="Nenhum rosto reconhecido com confiança suficiente.",
        )
    low_confidence = score < 0.58

    if low_confidence:
        message = "Possível cliente encontrado. Confirme antes de iniciar o atendimento."
    elif appointment:
        message = "Cliente reconhecido com agendamento ativo hoje."
    else:
        message = "Cliente reconhecido sem agendamento ativo hoje."

    return {
        "client": best_client,
        "appointment": appointment,
        "score": round(score, 4),
        "low_confidence": low_confidence,
        "engine": best.get("source"),
        "candidates": ranked[:5],
        "message": message,
    }


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_client(db, client_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    return {"message": "Cliente removido com sucesso."}


# BARBEIROS

@app.get("/api/barbers", response_model=list[schemas.BarberResponse])
def get_barbers(db: Session = Depends(get_db)):
    return crud.list_barbers(db)


@app.post("/api/barbers", response_model=schemas.BarberResponse)
def create_barber(payload: schemas.BarberCreate, db: Session = Depends(get_db)):
    return crud.create_barber(db, payload)


@app.put("/api/barbers/{barber_id}", response_model=schemas.BarberResponse)
def update_barber(
    barber_id: int,
    payload: schemas.BarberCreate,
    db: Session = Depends(get_db),
):
    barber = crud.update_barber(db, barber_id, payload)

    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")

    return barber


@app.delete("/api/barbers/{barber_id}")
def delete_barber(barber_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_barber(db, barber_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")

    return {"message": "Barbeiro removido com sucesso."}


# SERVIÇOS

@app.get("/api/services", response_model=list[schemas.ServiceResponse])
def get_services(db: Session = Depends(get_db)):
    return crud.list_services(db)


@app.post("/api/services", response_model=schemas.ServiceResponse)
def create_service(payload: schemas.ServiceCreate, db: Session = Depends(get_db)):
    return crud.create_service(db, payload)


@app.put("/api/services/{service_id}", response_model=schemas.ServiceResponse)
def update_service(
    service_id: int,
    payload: schemas.ServiceCreate,
    db: Session = Depends(get_db),
):
    service = crud.update_service(db, service_id, payload)

    if not service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    return service


@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_service(db, service_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    return {"message": "Serviço removido com sucesso."}


# DISPONIBILIDADE

@app.get("/api/availability", response_model=list[schemas.BarberAvailabilityResponse])
def get_availability(db: Session = Depends(get_db)):
    return crud.list_barber_availability(db)


@app.post("/api/availability", response_model=schemas.BarberAvailabilityResponse)
def create_availability(payload: schemas.BarberAvailabilityCreate, db: Session = Depends(get_db)):
    if not crud.get_barber_by_id(db, payload.barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")
    return crud.create_barber_availability(db, payload)


@app.get("/api/barbers/{barber_id}/availability", response_model=list[schemas.BarberAvailabilityResponse])
def get_barber_availability(barber_id: int, db: Session = Depends(get_db)):
    if not crud.get_barber_by_id(db, barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")
    crud.seed_default_barber_availability(db, barber_id)
    return crud.list_barber_availability(db, barber_id=barber_id)


@app.put("/api/barbers/{barber_id}/availability", response_model=list[schemas.BarberAvailabilityResponse])
def save_barber_availability(
    barber_id: int,
    payload: list[schemas.BarberAvailabilityCreate],
    db: Session = Depends(get_db),
):
    if not crud.get_barber_by_id(db, barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")
    clean_payload = []
    for item in payload:
        clean_payload.append(item.model_copy(update={"barber_id": barber_id}))
    return crud.replace_barber_availability(db, barber_id, clean_payload)


@app.get("/api/barbers/time-off", response_model=list[schemas.BarberTimeOffResponse])
def get_barber_time_off(
    barber_id: int | None = Query(default=None),
    target_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return crud.list_barber_time_off(db, barber_id=barber_id, target_date=target_date)


@app.post("/api/barbers/time-off", response_model=schemas.BarberTimeOffResponse)
def create_barber_time_off(
    payload: schemas.BarberTimeOffCreate,
    db: Session = Depends(get_db),
):
    if not crud.get_barber_by_id(db, payload.barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")
    return crud.create_barber_time_off(db, payload)


@app.delete("/api/barbers/time-off/{time_off_id}")
def delete_barber_time_off(time_off_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_barber_time_off(db, time_off_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Bloqueio não encontrado.")
    return {"message": "Bloqueio removido com sucesso."}


@app.get("/api/available-slots", response_model=schemas.AvailableSlotsResponse)
def get_available_slots(
    barber_id: int = Query(...),
    service_id: int = Query(...),
    target_date: date = Query(...),
    db: Session = Depends(get_db),
):
    slots = crud.get_available_slots(db, barber_id=barber_id, service_id=service_id, target_date=target_date)
    return {
        "barber_id": barber_id,
        "service_id": service_id,
        "target_date": target_date,
        "slots": slots,
    }


# AGENDAMENTOS

@app.get("/api/appointments", response_model=list[schemas.AppointmentResponse])
def get_appointments(
    target_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return crud.list_appointments(db, target_date=target_date)


@app.post("/api/appointments", response_model=schemas.AppointmentResponse)
def create_appointment(
    payload: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
):
    client = crud.get_client_by_id(db, payload.client_id)

    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    if str(getattr(client, "status", "active") or "active").lower() != "active":
        raise HTTPException(
            status_code=403,
            detail="Perfil inativo por tempo indeterminado por ordem da barbearia.",
        )

    if not crud.get_barber_by_id(db, payload.barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")

    if not crud.get_service_by_id(db, payload.service_id):
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    available_slots = crud.get_available_slots(
        db,
        barber_id=payload.barber_id,
        service_id=payload.service_id,
        target_date=payload.appointment_date,
    )

    if payload.appointment_time not in available_slots and payload.status == "scheduled":
        raise HTTPException(status_code=400, detail="Horário indisponível para esse barbeiro.")

    return crud.create_appointment(db, payload)


@app.put("/api/appointments/{appointment_id}", response_model=schemas.AppointmentResponse)
def update_appointment(
    appointment_id: int,
    payload: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
):
    appointment = crud.update_appointment(db, appointment_id, payload)

    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    return appointment


@app.patch("/api/appointments/{appointment_id}/reschedule", response_model=schemas.AppointmentResponse)
def reschedule_appointment(
    appointment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    appointment = crud.get_appointment_by_id(db, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    new_date = payload.get("appointment_date")
    new_time = payload.get("appointment_time")
    if not new_date or not new_time:
        raise HTTPException(status_code=400, detail="Informe data e horário.")

    from datetime import date as _date
    target_date = _date.fromisoformat(str(new_date))
    available_slots = crud.get_available_slots(
        db,
        barber_id=appointment.barber_id,
        service_id=appointment.service_id,
        target_date=target_date,
    )
    if new_time not in available_slots:
        raise HTTPException(status_code=400, detail="Horário indisponível para esse barbeiro.")

    appointment.appointment_date = target_date
    appointment.appointment_time = str(new_time)[:5]
    db.commit()
    db.refresh(appointment)
    return appointment


@app.delete("/api/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_appointment(db, appointment_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    return {"message": "Agendamento removido com sucesso."}


# HISTÓRICO DE CORTES

@app.get("/api/haircuts", response_model=list[schemas.HaircutRecordResponse])
def get_haircut_records(
    client_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return crud.list_haircut_records(db, client_id=client_id)


@app.post("/api/haircuts", response_model=schemas.HaircutRecordResponse)
def create_haircut_record(
    payload: schemas.HaircutRecordCreate,
    db: Session = Depends(get_db),
):
    if not crud.get_client_by_id(db, payload.client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    if payload.service_id and not crud.get_service_by_id(db, payload.service_id):
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    if payload.barber_id and not crud.get_barber_by_id(db, payload.barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")

    return crud.create_haircut_record(db, payload)


@app.put("/api/haircuts/{record_id}", response_model=schemas.HaircutRecordResponse)
def update_haircut_record(
    record_id: int,
    payload: schemas.HaircutRecordCreate,
    db: Session = Depends(get_db),
):
    record = crud.update_haircut_record(db, record_id, payload)

    if not record:
        raise HTTPException(status_code=404, detail="Registro de corte não encontrado.")

    return record


@app.delete("/api/haircuts/{record_id}")
def delete_haircut_record(record_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_haircut_record(db, record_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Registro de corte não encontrado.")

    return {"message": "Registro de corte removido com sucesso."}