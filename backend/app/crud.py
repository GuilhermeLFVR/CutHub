from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    ClientSubscription,
    SubscriptionPlan,
    Barber,
    BarberAvailability,
    BarberTimeOff,
    Client,
    HaircutRecord,
    Service,
    User,
)
from app.schemas import (
    AppointmentCreate,
    ClientSubscriptionCreate,
    SubscriptionPlanCreate,
    BarberAvailabilityCreate,
    BarberCreate,
    BarberTimeOffCreate,
    ClientCreate,
    HaircutRecordCreate,
    ServiceCreate,
    UserCreate,
    UserUpdate,
)


# =============================
# USUÁRIOS / AUTH
# =============================

def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_email(db: Session, email: str) -> User | None:
    clean_email = normalize_email(email)
    if not clean_email:
        return None
    return db.scalar(select(User).where(func.lower(User.email) == clean_email))


def list_users(db: Session) -> list[User]:
    stmt = (
        select(User)
        .where(User.role.in_(["admin", "barber"]))
        .order_by(User.created_at.desc(), User.id.desc())
    )
    return list(db.scalars(stmt).all())


def create_user(db: Session, payload: UserCreate, password_hash: str) -> User:
    user = User(
        name=payload.name.strip(),
        email=normalize_email(payload.email),
        phone=str(getattr(payload, "phone", "") or "").strip(),
        password_hash=password_hash,
        role=payload.role,
        is_active=payload.is_active,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_default_admin(db: Session, password_hash: str) -> User:
    admin_email = "admin@cuthub.com"
    existing = get_user_by_email(db, admin_email)

    if existing:
        return existing

    user = User(
        name="Administrador",
        email=admin_email,
        phone="",
        password_hash=password_hash,
        role="admin",
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: UserUpdate) -> User | None:
    user = get_user_by_id(db, user_id)

    if not user:
        return None

    user.name = payload.name.strip()
    user.email = normalize_email(payload.email)
    user.phone = str(getattr(payload, "phone", "") or "").strip()
    user.role = payload.role
    user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user


def reset_user_password(db: Session, user_id: int, password_hash: str) -> User | None:
    user = get_user_by_id(db, user_id)

    if not user:
        return None

    user.password_hash = password_hash
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = get_user_by_id(db, user_id)

    if not user:
        return False

    db.delete(user)
    db.commit()
    return True


# =============================
# CLIENTES
# =============================

def create_client(db: Session, payload: ClientCreate) -> Client:
    client = Client(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=payload.email.strip().lower(),
        status=getattr(payload, "status", "active"),
        face_image_url=getattr(payload, "face_image_url", "").strip(),
        allows_photos=bool(getattr(payload, "allows_photos", True)),
        allows_face_recognition=bool(getattr(payload, "allows_face_recognition", True)),
        preferred_cut=payload.preferred_cut.strip(),
        notes=payload.notes.strip(),
    )

    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def list_clients(db: Session) -> list[Client]:
    stmt = select(Client).order_by(Client.created_at.desc(), Client.id.desc())
    return list(db.scalars(stmt).all())


def get_client_by_id(db: Session, client_id: int) -> Client | None:
    return db.scalar(select(Client).where(Client.id == client_id))


def get_client_by_email(db: Session, email: str) -> Client | None:
    clean_email = normalize_email(email)
    if not clean_email:
        return None
    return db.scalar(select(Client).where(func.lower(Client.email) == clean_email))


def set_client_status(db: Session, client_id: int, status: str) -> Client | None:
    client = get_client_by_id(db, client_id)

    if client is None:
        return None

    client.status = "inactive" if status == "inactive" else "active"
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client_id: int, payload: ClientCreate) -> Client | None:
    client = get_client_by_id(db, client_id)

    if client is None:
        return None

    client.name = payload.name.strip()
    client.phone = payload.phone.strip()
    client.email = payload.email.strip().lower()
    client.status = getattr(payload, "status", getattr(client, "status", "active"))

    if getattr(payload, "face_image_url", ""):
        client.face_image_url = payload.face_image_url.strip()

    client.allows_photos = bool(getattr(payload, "allows_photos", getattr(client, "allows_photos", True)))
    client.allows_face_recognition = bool(
        getattr(payload, "allows_face_recognition", getattr(client, "allows_face_recognition", True))
    )
    client.preferred_cut = payload.preferred_cut.strip()
    client.notes = payload.notes.strip()

    db.commit()
    db.refresh(client)
    return client


def update_client_face_image(db: Session, client_id: int, face_image_url: str) -> Client | None:
    client = get_client_by_id(db, client_id)

    if client is None:
        return None

    client.face_image_url = (face_image_url or "").strip()
    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, client_id: int) -> bool:
    client = get_client_by_id(db, client_id)

    if client is None:
        return False

    db.delete(client)
    db.commit()
    return True




# =============================
# ASSINATURAS
# =============================

def ensure_default_subscription_plans(db: Session) -> None:
    if db.scalar(select(SubscriptionPlan).limit(1)):
        return

    default_plans = [
        SubscriptionPlan(name="Hub Start", price=39.90, description="Plano de entrada para clientes que cortam uma vez por mês.", monthly_limit=1, included_services="Corte", extra_discount_percent=5),
        SubscriptionPlan(name="Hub Plus", price=99.90, description="Plano para cliente frequente, com até quatro cortes mensais.", monthly_limit=4, included_services="Corte, Acabamento", extra_discount_percent=10),
        SubscriptionPlan(name="Hub Unlimited", price=149.90, description="Cortes sem limite mensal, com prioridade de agendamento.", monthly_limit=999, included_services="Corte, Acabamento", extra_discount_percent=15),
        SubscriptionPlan(name="Hub Elite", price=189.90, description="Plano premium com cabelo, barba e sobrancelha inclusos.", monthly_limit=999, included_services="Corte, Barba, Sobrancelha, Acabamento", extra_discount_percent=15),
    ]
    db.add_all(default_plans)
    db.commit()


def list_subscription_plans(db: Session, active_only: bool = False) -> list[SubscriptionPlan]:
    ensure_default_subscription_plans(db)
    stmt = select(SubscriptionPlan)
    if active_only:
        stmt = stmt.where(SubscriptionPlan.is_active == True)
    stmt = stmt.order_by(SubscriptionPlan.price.asc(), SubscriptionPlan.id.asc())
    return list(db.scalars(stmt).all())


def get_subscription_plan_by_id(db: Session, plan_id: int) -> SubscriptionPlan | None:
    return db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))


def create_subscription_plan(db: Session, payload: SubscriptionPlanCreate) -> SubscriptionPlan:
    plan = SubscriptionPlan(
        name=payload.name.strip(),
        price=payload.price,
        description=payload.description.strip(),
        monthly_limit=payload.monthly_limit,
        included_services=payload.included_services.strip(),
        extra_discount_percent=payload.extra_discount_percent,
        is_active=payload.is_active,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def update_subscription_plan(db: Session, plan_id: int, payload: SubscriptionPlanCreate) -> SubscriptionPlan | None:
    plan = get_subscription_plan_by_id(db, plan_id)
    if not plan:
        return None
    plan.name = payload.name.strip()
    plan.price = payload.price
    plan.description = payload.description.strip()
    plan.monthly_limit = payload.monthly_limit
    plan.included_services = payload.included_services.strip()
    plan.extra_discount_percent = payload.extra_discount_percent
    plan.is_active = payload.is_active
    db.commit()
    db.refresh(plan)
    return plan


def delete_subscription_plan(db: Session, plan_id: int) -> bool:
    plan = get_subscription_plan_by_id(db, plan_id)
    if not plan:
        return False
    db.delete(plan)
    db.commit()
    return True


def list_client_subscriptions(db: Session) -> list[ClientSubscription]:
    stmt = select(ClientSubscription).order_by(ClientSubscription.created_at.desc(), ClientSubscription.id.desc())
    return list(db.scalars(stmt).all())


def get_subscription_by_id(db: Session, subscription_id: int) -> ClientSubscription | None:
    return db.scalar(select(ClientSubscription).where(ClientSubscription.id == subscription_id))


def get_active_subscription_for_client(db: Session, client_id: int) -> ClientSubscription | None:
    stmt = (
        select(ClientSubscription)
        .where(ClientSubscription.client_id == client_id, ClientSubscription.status == "active")
        .order_by(ClientSubscription.created_at.desc(), ClientSubscription.id.desc())
    )
    return db.scalar(stmt)


def register_subscription_usage(db: Session, client_id: int) -> ClientSubscription | None:
    subscription = get_active_subscription_for_client(db, client_id)

    if not subscription:
        return None

    subscription.used_this_month = int(subscription.used_this_month or 0) + 1
    db.flush()
    return subscription


def create_client_subscription(db: Session, payload: ClientSubscriptionCreate) -> ClientSubscription:
    existing = get_active_subscription_for_client(db, payload.client_id)
    if existing:
        existing.status = "cancelled"
    subscription = ClientSubscription(
        client_id=payload.client_id,
        plan_id=payload.plan_id,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        used_this_month=payload.used_this_month,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def update_client_subscription(db: Session, subscription_id: int, payload: ClientSubscriptionCreate) -> ClientSubscription | None:
    subscription = get_subscription_by_id(db, subscription_id)
    if not subscription:
        return None
    subscription.client_id = payload.client_id
    subscription.plan_id = payload.plan_id
    subscription.status = payload.status
    subscription.start_date = payload.start_date
    subscription.end_date = payload.end_date
    subscription.used_this_month = payload.used_this_month
    db.commit()
    db.refresh(subscription)
    return subscription


def delete_client_subscription(db: Session, subscription_id: int) -> bool:
    subscription = get_subscription_by_id(db, subscription_id)
    if not subscription:
        return False
    db.delete(subscription)
    db.commit()
    return True


def get_subscription_stats(db: Session) -> dict:
    plans = list_subscription_plans(db)
    subscriptions = list_client_subscriptions(db)
    active = [item for item in subscriptions if item.status == "active"]
    monthly_revenue = 0.0
    for item in active:
        plan = get_subscription_plan_by_id(db, item.plan_id)
        monthly_revenue += float(getattr(plan, "price", 0) or 0)
    return {
        "plans_count": len(plans),
        "active_subscriptions_count": len(active),
        "monthly_recurring_revenue": monthly_revenue,
    }


# =============================
# BARBEIROS
# =============================

def create_barber(db: Session, payload: BarberCreate) -> Barber:
    barber = Barber(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        specialty=payload.specialty.strip(),
        status=payload.status,
    )

    db.add(barber)
    db.commit()
    db.refresh(barber)

    seed_default_barber_availability(db, barber.id)
    return barber


def list_barbers(db: Session) -> list[Barber]:
    stmt = select(Barber).order_by(Barber.status.asc(), Barber.name.asc())
    return list(db.scalars(stmt).all())


def get_barber_by_id(db: Session, barber_id: int) -> Barber | None:
    return db.scalar(select(Barber).where(Barber.id == barber_id))


def update_barber(db: Session, barber_id: int, payload: BarberCreate) -> Barber | None:
    barber = get_barber_by_id(db, barber_id)

    if barber is None:
        return None

    barber.name = payload.name.strip()
    barber.phone = payload.phone.strip()
    barber.specialty = payload.specialty.strip()
    barber.status = payload.status

    db.commit()
    db.refresh(barber)
    return barber


def delete_barber(db: Session, barber_id: int) -> bool:
    barber = get_barber_by_id(db, barber_id)

    if barber is None:
        return False

    db.delete(barber)
    db.commit()
    return True


# =============================
# SERVIÇOS
# =============================

DEFAULT_SERVICES = [
    {
        "name": "Corte",
        "price": 35.0,
        "duration_minutes": 30,
        "description": "Corte de cabelo tradicional.",
        "tools": "Máquina, tesoura, pente, navalha",
    },
    {
        "name": "Corte e barba",
        "price": 55.0,
        "duration_minutes": 60,
        "description": "Corte de cabelo com acabamento de barba.",
        "tools": "Máquina, tesoura, pente, navalha, toalha, creme de barbear",
    },
    {
        "name": "Barba",
        "price": 25.0,
        "duration_minutes": 30,
        "description": "Modelagem e acabamento de barba.",
        "tools": "Navalha, máquina, toalha, creme de barbear",
    },
    {
        "name": "Sobrancelha",
        "price": 15.0,
        "duration_minutes": 20,
        "description": "Limpeza e acabamento de sobrancelha.",
        "tools": "Pinça, navalha, escovinha",
    },
    {
        "name": "Luzes",
        "price": 80.0,
        "duration_minutes": 90,
        "description": "Aplicação de luzes no cabelo.",
        "tools": "Pincel, papel alumínio, pó descolorante, tonalizante",
    },
]


def ensure_default_services(db: Session) -> None:
    for item in DEFAULT_SERVICES:
        existing = db.scalar(select(Service).where(func.lower(Service.name) == item["name"].lower()))
        if existing:
            continue

        db.add(Service(**item))

    db.commit()


def create_service(db: Session, payload: ServiceCreate) -> Service:
    service = Service(
        name=payload.name.strip(),
        price=payload.price,
        duration_minutes=payload.duration_minutes,
        description=payload.description.strip(),
        tools=payload.tools.strip(),
    )

    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def list_services(db: Session) -> list[Service]:
    ensure_default_services(db)
    stmt = select(Service).order_by(Service.id.asc())
    return list(db.scalars(stmt).all())


def get_service_by_id(db: Session, service_id: int) -> Service | None:
    return db.scalar(select(Service).where(Service.id == service_id))


def update_service(db: Session, service_id: int, payload: ServiceCreate) -> Service | None:
    service = get_service_by_id(db, service_id)

    if service is None:
        return None

    service.name = payload.name.strip()
    service.price = payload.price
    service.duration_minutes = payload.duration_minutes
    service.description = payload.description.strip()
    service.tools = payload.tools.strip()

    db.commit()
    db.refresh(service)
    return service


def delete_service(db: Session, service_id: int) -> bool:
    service = get_service_by_id(db, service_id)

    if service is None:
        return False

    db.delete(service)
    db.commit()
    return True


# =============================
# DISPONIBILIDADE
# =============================

def _time_to_minutes(value: str) -> int:
    hour, minute = str(value or "00:00").split(":")
    return int(hour) * 60 + int(minute)


def _minutes_to_time(value: int) -> str:
    return f"{value // 60:02d}:{value % 60:02d}"


def seed_default_barber_availability(db: Session, barber_id: int) -> None:
    existing = db.scalar(select(BarberAvailability).where(BarberAvailability.barber_id == barber_id))
    if existing:
        return

    # Segunda a sábado: 09h-12h e 14h-18h. Domingo fica fechado por padrão.
    for weekday in range(0, 6):
        db.add(
            BarberAvailability(
                barber_id=barber_id,
                weekday=weekday,
                start_time="09:00",
                end_time="12:00",
                is_active=True,
            )
        )
        db.add(
            BarberAvailability(
                barber_id=barber_id,
                weekday=weekday,
                start_time="14:00",
                end_time="18:00",
                is_active=True,
            )
        )

    db.commit()


def create_barber_availability(db: Session, payload: BarberAvailabilityCreate) -> BarberAvailability:
    item = BarberAvailability(
        barber_id=payload.barber_id,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_active=payload.is_active,
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_barber_availability(db: Session, barber_id: int | None = None) -> list[BarberAvailability]:
    stmt = select(BarberAvailability)

    if barber_id is not None:
        stmt = stmt.where(BarberAvailability.barber_id == barber_id)

    stmt = stmt.order_by(
        BarberAvailability.barber_id.asc(),
        BarberAvailability.weekday.asc(),
        BarberAvailability.start_time.asc(),
    )
    return list(db.scalars(stmt).all())


def replace_barber_availability(
    db: Session,
    barber_id: int,
    items: list[BarberAvailabilityCreate],
) -> list[BarberAvailability]:
    current = list_barber_availability(db, barber_id)

    for item in current:
        db.delete(item)

    db.commit()

    for payload in items:
        db.add(
            BarberAvailability(
                barber_id=barber_id,
                weekday=payload.weekday,
                start_time=payload.start_time,
                end_time=payload.end_time,
                is_active=payload.is_active,
            )
        )

    db.commit()
    return list_barber_availability(db, barber_id)


def create_barber_time_off(db: Session, payload: BarberTimeOffCreate) -> BarberTimeOff:
    item = BarberTimeOff(
        barber_id=payload.barber_id,
        off_date=payload.off_date,
        start_time=payload.start_time.strip(),
        end_time=payload.end_time.strip(),
        reason=payload.reason.strip(),
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_barber_time_off(
    db: Session,
    barber_id: int | None = None,
    target_date: date | None = None,
) -> list[BarberTimeOff]:
    stmt = select(BarberTimeOff)

    if barber_id is not None:
        stmt = stmt.where(BarberTimeOff.barber_id == barber_id)

    if target_date is not None:
        stmt = stmt.where(BarberTimeOff.off_date == target_date)

    stmt = stmt.order_by(BarberTimeOff.off_date.asc(), BarberTimeOff.start_time.asc(), BarberTimeOff.id.asc())
    return list(db.scalars(stmt).all())


def delete_barber_time_off(db: Session, time_off_id: int) -> bool:
    item = db.scalar(select(BarberTimeOff).where(BarberTimeOff.id == time_off_id))

    if item is None:
        return False

    db.delete(item)
    db.commit()
    return True


def get_available_slots(db: Session, barber_id: int, service_id: int, target_date: date) -> list[str]:
    barber = get_barber_by_id(db, barber_id)
    service = get_service_by_id(db, service_id)

    if not barber or barber.status != "active" or not service:
        return []

    seed_default_barber_availability(db, barber_id)

    weekday = target_date.weekday()
    windows = [
        item
        for item in list_barber_availability(db, barber_id)
        if item.weekday == weekday and item.is_active
    ]

    if not windows:
        return []

    appointments = [
        item
        for item in list_appointments(db, target_date)
        if item.barber_id == barber_id and item.status != "cancelled"
    ]
    blocked = list_barber_time_off(db, barber_id=barber_id, target_date=target_date)
    duration = int(service.duration_minutes or 30)
    slots: list[str] = []

    for window in windows:
        start = _time_to_minutes(window.start_time)
        end = _time_to_minutes(window.end_time)
        cursor = start

        while cursor + duration <= end:
            slot = _minutes_to_time(cursor)
            slot_end = cursor + duration

            has_appointment = any(_time_to_minutes(a.appointment_time) == cursor for a in appointments)
            has_block = False

            for off in blocked:
                if not off.start_time or not off.end_time:
                    has_block = True
                    break

                off_start = _time_to_minutes(off.start_time)
                off_end = _time_to_minutes(off.end_time)

                if cursor < off_end and slot_end > off_start:
                    has_block = True
                    break

            if not has_appointment and not has_block:
                slots.append(slot)

            cursor += 30

    return slots


# =============================
# AGENDAMENTOS
# =============================

def create_appointment(db: Session, payload: AppointmentCreate) -> Appointment:
    appointment = Appointment(
        client_id=payload.client_id,
        barber_id=payload.barber_id,
        service_id=payload.service_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        status=payload.status,
        notes=payload.notes.strip(),
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def list_appointments(db: Session, target_date: date | None = None) -> list[Appointment]:
    stmt = select(Appointment)

    if target_date is not None:
        stmt = stmt.where(Appointment.appointment_date == target_date)

    stmt = stmt.order_by(
        Appointment.appointment_date.asc(),
        Appointment.appointment_time.asc(),
        Appointment.id.asc(),
    )
    return list(db.scalars(stmt).all())


def get_appointment_by_id(db: Session, appointment_id: int) -> Appointment | None:
    return db.scalar(select(Appointment).where(Appointment.id == appointment_id))


def update_appointment(db: Session, appointment_id: int, payload: AppointmentCreate) -> Appointment | None:
    appointment = get_appointment_by_id(db, appointment_id)

    if appointment is None:
        return None

    previous_status = str(appointment.status or "").lower()

    appointment.client_id = payload.client_id
    appointment.barber_id = payload.barber_id
    appointment.service_id = payload.service_id
    appointment.appointment_date = payload.appointment_date
    appointment.appointment_time = payload.appointment_time
    appointment.status = payload.status
    appointment.notes = payload.notes.strip()

    new_status = str(payload.status or "").lower()

    if previous_status != "completed" and new_status == "completed":
        register_subscription_usage(db, appointment.client_id)

    db.commit()
    db.refresh(appointment)
    return appointment


def delete_appointment(db: Session, appointment_id: int) -> bool:
    appointment = get_appointment_by_id(db, appointment_id)

    if appointment is None:
        return False

    db.delete(appointment)
    db.commit()
    return True


# =============================
# DASHBOARD
# =============================

def get_cuthub_dashboard(db: Session) -> dict:
    today = date.today()

    clients = list_clients(db)
    barbers = list_barbers(db)
    services = list_services(db)
    today_appointments = list_appointments(db, today)

    completed_today = [
        appointment
        for appointment in today_appointments
        if appointment.status == "completed"
    ]

    scheduled_today = [
        appointment
        for appointment in today_appointments
        if appointment.status == "scheduled"
    ]

    subscription_stats = get_subscription_stats(db)

    return {
        "clients_count": len(clients),
        "active_barbers_count": sum(1 for barber in barbers if barber.status == "active"),
        "services_count": len(services),
        "appointments_today_count": len(today_appointments),
        "scheduled_today_count": len(scheduled_today),
        "completed_today_count": len(completed_today),
        "recent_clients": clients[:8],
        "today_appointments": today_appointments,
        **subscription_stats,
    }


# =============================
# HISTÓRICO DE CORTES
# =============================

def create_haircut_record(db: Session, payload: HaircutRecordCreate) -> HaircutRecord:
    record = HaircutRecord(
        client_id=payload.client_id,
        service_id=payload.service_id,
        barber_id=payload.barber_id,
        cut_date=payload.cut_date,
        title=payload.title.strip(),
        notes=payload.notes.strip(),
        photo_url=payload.photo_url.strip(),
        tools_used=payload.tools_used.strip(),
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_haircut_records(db: Session, client_id: int | None = None) -> list[HaircutRecord]:
    stmt = select(HaircutRecord)

    if client_id is not None:
        stmt = stmt.where(HaircutRecord.client_id == client_id)

    stmt = stmt.order_by(HaircutRecord.cut_date.desc(), HaircutRecord.id.desc())
    return list(db.scalars(stmt).all())


def get_haircut_record_by_id(db: Session, record_id: int) -> HaircutRecord | None:
    return db.scalar(select(HaircutRecord).where(HaircutRecord.id == record_id))


def update_haircut_record(db: Session, record_id: int, payload: HaircutRecordCreate) -> HaircutRecord | None:
    record = get_haircut_record_by_id(db, record_id)

    if record is None:
        return None

    record.client_id = payload.client_id
    record.service_id = payload.service_id
    record.barber_id = payload.barber_id
    record.cut_date = payload.cut_date
    record.title = payload.title.strip()
    record.notes = payload.notes.strip()
    record.photo_url = payload.photo_url.strip()
    record.tools_used = payload.tools_used.strip()

    db.commit()
    db.refresh(record)
    return record


def delete_haircut_record(db: Session, record_id: int) -> bool:
    record = get_haircut_record_by_id(db, record_id)

    if record is None:
        return False

    db.delete(record)
    db.commit()
    return True