from datetime import date, datetime, timedelta

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models import Appointment, Barber, BarberAvailability, BarberTimeOff, Client, DashboardConfig, GoalConfig, Habit, HabitCheckin, HaircutRecord, Service, Task, Transaction, User
from app.schemas import (
    AppointmentCreate,
    BarberCreate,
    ClientCreate,
    HaircutRecordCreate,
    HabitCheckinToggle,
    HabitCreate,
    ServiceCreate,
    BarberAvailabilityCreate,
    BarberTimeOffCreate,
    TaskCreate,
    TotalBalanceConfigCreate,
    TransactionCreate,
    GoalConfigCreate,
    UserCreate,
    UserUpdate,
)


def _normalize_category(category: str | None) -> str:
    raw = "" if category is None else str(category).strip()

    if not raw or raw.lower() == "undefined":
        return "Outros"

    return raw


# CUTHUB - USUÁRIOS / AUTH

def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    stmt = select(User).where(User.id == user_id)
    return db.scalar(stmt)


def get_user_by_email(db: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == normalize_email(email))
    return db.scalar(stmt)


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


def create_transaction(db: Session, payload: TransactionCreate) -> Transaction:
    transaction = Transaction(
        type=payload.type,
        amount=payload.amount,
        category=_normalize_category(payload.category),
        description=payload.description,
        transaction_date=payload.transaction_date,
        notes=payload.notes,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def list_transactions(
    db: Session,
    month: int | None = None,
    year: int | None = None,
) -> list[Transaction]:
    stmt = select(Transaction)

    if month is not None:
        stmt = stmt.where(extract("month", Transaction.transaction_date) == month)

    if year is not None:
        stmt = stmt.where(extract("year", Transaction.transaction_date) == year)

    stmt = stmt.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    return list(db.scalars(stmt).all())


def get_transaction_by_id(db: Session, transaction_id: int) -> Transaction | None:
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    return db.scalar(stmt)


def update_transaction(
    db: Session,
    transaction_id: int,
    payload: TransactionCreate,
) -> Transaction | None:
    transaction = get_transaction_by_id(db, transaction_id)

    if transaction is None:
        return None

    transaction.type = payload.type
    transaction.amount = payload.amount
    transaction.category = _normalize_category(payload.category)
    transaction.description = payload.description
    transaction.transaction_date = payload.transaction_date
    transaction.notes = payload.notes

    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(db: Session, transaction_id: int) -> bool:
    transaction = get_transaction_by_id(db, transaction_id)

    if transaction is None:
        return False

    db.delete(transaction)
    db.commit()
    return True


def delete_transactions_bulk(db: Session, ids: list[int]) -> int:
    if not ids:
        return 0

    stmt = select(Transaction).where(Transaction.id.in_(ids))
    transactions = list(db.scalars(stmt).all())

    if not transactions:
        return 0

    deleted_count = len(transactions)

    for transaction in transactions:
        db.delete(transaction)

    db.commit()
    return deleted_count


def get_total_by_type(
    db: Session,
    transaction_type: str,
    month: int | None = None,
    year: int | None = None,
) -> float:
    stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        Transaction.type == transaction_type
    )

    if month is not None:
        stmt = stmt.where(extract("month", Transaction.transaction_date) == month)

    if year is not None:
        stmt = stmt.where(extract("year", Transaction.transaction_date) == year)

    return float(db.scalar(stmt) or 0.0)


def get_category_breakdown(
    db: Session,
    month: int | None = None,
    year: int | None = None,
) -> list[dict]:
    stmt = (
        select(
            Transaction.category,
            func.coalesce(func.sum(Transaction.amount), 0.0).label("total"),
        )
        .where(Transaction.type == "expense")
    )

    if month is not None:
        stmt = stmt.where(extract("month", Transaction.transaction_date) == month)

    if year is not None:
        stmt = stmt.where(extract("year", Transaction.transaction_date) == year)

    stmt = stmt.group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc())

    rows = db.execute(stmt).all()
    return [{"category": _normalize_category(row[0]), "total": float(row[1])} for row in rows]


def get_daily_flow(
    db: Session,
    month: int,
    year: int,
) -> list[dict]:
    stmt = (
        select(
            extract("day", Transaction.transaction_date).label("day"),
            Transaction.type,
            func.coalesce(func.sum(Transaction.amount), 0.0).label("total"),
        )
        .where(extract("month", Transaction.transaction_date) == month)
        .where(extract("year", Transaction.transaction_date) == year)
        .group_by(extract("day", Transaction.transaction_date), Transaction.type)
        .order_by(extract("day", Transaction.transaction_date))
    )

    rows = db.execute(stmt).all()
    daily_map: dict[int, dict] = {}

    for row in rows:
        day = int(row[0])
        transaction_type = row[1]
        total = float(row[2])

        if day not in daily_map:
            daily_map[day] = {"day": day, "income": 0.0, "expense": 0.0}

        daily_map[day][transaction_type] = total

    return [daily_map[day] for day in sorted(daily_map.keys())]


def get_monthly_summary(
    db: Session,
    month: int,
    year: int,
) -> dict:
    total_transactions_stmt = select(func.count(Transaction.id)).where(
        extract("month", Transaction.transaction_date) == month,
        extract("year", Transaction.transaction_date) == year,
    )
    total_transactions = int(db.scalar(total_transactions_stmt) or 0)

    avg_ticket_stmt = select(func.coalesce(func.avg(Transaction.amount), 0.0)).where(
        Transaction.type == "expense",
        extract("month", Transaction.transaction_date) == month,
        extract("year", Transaction.transaction_date) == year,
    )
    avg_ticket = float(db.scalar(avg_ticket_stmt) or 0.0)

    top_category_stmt = (
        select(
            Transaction.category,
            func.coalesce(func.sum(Transaction.amount), 0.0).label("total"),
        )
        .where(
            Transaction.type == "expense",
            extract("month", Transaction.transaction_date) == month,
            extract("year", Transaction.transaction_date) == year,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc(), Transaction.category.asc())
        .limit(1)
    )
    top_category_row = db.execute(top_category_stmt).first()

    highest_spend_day_stmt = (
        select(
            Transaction.transaction_date,
            func.coalesce(func.sum(Transaction.amount), 0.0).label("total"),
        )
        .where(
            Transaction.type == "expense",
            extract("month", Transaction.transaction_date) == month,
            extract("year", Transaction.transaction_date) == year,
        )
        .group_by(Transaction.transaction_date)
        .order_by(func.sum(Transaction.amount).desc(), Transaction.transaction_date.asc())
        .limit(1)
    )
    highest_spend_day_row = db.execute(highest_spend_day_stmt).first()

    return {
        "top_category": _normalize_category(top_category_row[0]) if top_category_row else None,
        "total_transactions": total_transactions,
        "avg_ticket": round(avg_ticket, 2),
        "highest_spend_day": highest_spend_day_row[0] if highest_spend_day_row else None,
    }


def infer_category_from_description(description: str, transaction_type: str) -> str:
    text = description.lower()

    expense_map = {
        "Alimentação": ["almoco", "almoço", "janta", "lanche", "frango", "comida", "mercado", "padaria", "ifood"],
        "Transporte": ["uber", "99", "taxi", "ônibus", "onibus", "metro", "gasolina", "combustivel"],
        "Faculdade": ["faculdade", "mensalidade", "curso", "livro", "xerox"],
        "Casa": ["aluguel", "energia", "agua", "internet", "luz", "gás", "gas"],
        "Lazer": ["cinema", "jogo", "streaming", "bar", "role", "rolê"],
        "Saúde": ["farmacia", "remedio", "consulta", "academia"],
    }

    income_map = {
        "Salário": ["salario", "salário", "pagamento"],
        "Freela": ["freela", "freelance", "workana"],
        "Extra": ["extra", "pix", "bonus", "bônus", "comissao", "comissão"],
    }

    mapping = income_map if transaction_type == "income" else expense_map

    for category, keywords in mapping.items():
        if any(keyword in text for keyword in keywords):
            return category

    return "Outros"


def get_dashboard_config(db: Session) -> DashboardConfig | None:
    stmt = select(DashboardConfig).order_by(DashboardConfig.id.asc()).limit(1)
    return db.scalar(stmt)


def save_total_balance_config(
    db: Session,
    payload: TotalBalanceConfigCreate,
) -> DashboardConfig:
    config = get_dashboard_config(db)

    if config is None:
        config = DashboardConfig(total_balance=payload.total_balance)
        db.add(config)
    else:
        config.total_balance = payload.total_balance

    db.commit()
    db.refresh(config)
    return config


# TASKS / ROTINA

def create_task(db: Session, payload: TaskCreate) -> Task:
    task = Task(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        status=payload.status,
        due_date=payload.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session) -> list[Task]:
    stmt = select(Task).order_by(
        Task.status.asc(),
        Task.priority.desc(),
        func.coalesce(Task.due_date, func.date(Task.created_at)).asc(),
        Task.id.desc(),
    )
    return list(db.scalars(stmt).all())


def get_task_by_id(db: Session, task_id: int) -> Task | None:
    stmt = select(Task).where(Task.id == task_id)
    return db.scalar(stmt)


def update_task(db: Session, task_id: int, payload: TaskCreate) -> Task | None:
    task = get_task_by_id(db, task_id)
    if task is None:
        return None

    task.title = payload.title
    task.description = payload.description
    task.priority = payload.priority
    task.status = payload.status
    task.due_date = payload.due_date

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int) -> bool:
    task = get_task_by_id(db, task_id)
    if task is None:
        return False
    db.delete(task)
    db.commit()
    return True


def get_tasks_dashboard(db: Session) -> dict:
    tasks = list_tasks(db)
    today = date.today()

    tasks_payload = []
    for task in tasks:
        tasks_payload.append(
            {
                "id": task.id,
                "title": task.title,
                "description": task.description or "",
                "priority": task.priority,
                "status": task.status,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "is_due_today": task.due_date == today if task.due_date else False,
                "is_overdue": bool(task.due_date and task.due_date < today and task.status != "done"),
            }
        )

    summary = {
        "today_count": sum(1 for task in tasks if task.due_date == today and task.status != "done"),
        "pending_count": sum(1 for task in tasks if task.status != "done"),
        "done_count": sum(1 for task in tasks if task.status == "done"),
        "focus_label": next((task.title for task in tasks if task.status != "done"), "Sem foco definido"),
    }

    return {"tasks": tasks_payload, "summary": summary}


# HABITS / PESSOAL

def create_habit(db: Session, payload: HabitCreate) -> Habit:
    habit = Habit(
        name=payload.name,
        category=payload.category,
        target_frequency=payload.target_frequency,
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def list_habits(db: Session) -> list[Habit]:
    stmt = select(Habit).order_by(Habit.created_at.desc(), Habit.id.desc())
    return list(db.scalars(stmt).all())


def get_habit_by_id(db: Session, habit_id: int) -> Habit | None:
    stmt = select(Habit).where(Habit.id == habit_id)
    return db.scalar(stmt)


def delete_habit(db: Session, habit_id: int) -> bool:
    habit = get_habit_by_id(db, habit_id)
    if habit is None:
        return False

    checkins = list(
        db.scalars(select(HabitCheckin).where(HabitCheckin.habit_id == habit_id)).all()
    )
    for checkin in checkins:
        db.delete(checkin)

    db.delete(habit)
    db.commit()
    return True


def toggle_habit_checkin(db: Session, habit_id: int, payload: HabitCheckinToggle) -> dict | None:
    habit = get_habit_by_id(db, habit_id)
    if habit is None:
        return None

    selected_date = payload.checkin_date or date.today()
    stmt = select(HabitCheckin).where(
        HabitCheckin.habit_id == habit_id,
        HabitCheckin.checkin_date == selected_date,
    )
    checkin = db.scalar(stmt)

    if checkin:
        db.delete(checkin)
        checked = False
    else:
        checkin = HabitCheckin(
            habit_id=habit_id,
            checkin_date=selected_date,
            notes=payload.notes,
        )
        db.add(checkin)
        checked = True

    db.commit()
    return {
        "habit_id": habit_id,
        "checkin_date": selected_date.isoformat(),
        "checked": checked,
    }


def _get_habit_dates(db: Session, habit_id: int) -> list[date]:
    rows = list(
        db.scalars(
            select(HabitCheckin.checkin_date)
            .where(HabitCheckin.habit_id == habit_id)
            .order_by(HabitCheckin.checkin_date.desc())
        ).all()
    )
    return rows


def _calculate_streak(dates: list[date]) -> int:
    if not dates:
        return 0

    unique_dates = sorted(set(dates), reverse=True)
    today = date.today()

    if unique_dates[0] == today:
        expected = today
    elif unique_dates[0] == today - timedelta(days=1):
        expected = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    date_set = set(unique_dates)
    while expected in date_set:
        streak += 1
        expected -= timedelta(days=1)
    return streak


def get_habits_dashboard(db: Session, month: int, year: int) -> dict:
    habits = list_habits(db)
    today = date.today()
    month_start = date(year, month, 1)
    month_end = date(year + (month // 12), (month % 12) + 1, 1) - timedelta(days=1)

    habits_payload = []
    best_streak = 0
    checked_today = 0

    for habit in habits:
        dates = _get_habit_dates(db, habit.id)
        date_set = set(dates)
        current_streak = _calculate_streak(dates)
        best_streak = max(best_streak, current_streak)
        is_checked_today = today in date_set
        if is_checked_today:
            checked_today += 1

        month_count = sum(1 for d in dates if month_start <= d <= month_end)

        habits_payload.append(
            {
                "id": habit.id,
                "name": habit.name,
                "category": habit.category,
                "target_frequency": habit.target_frequency,
                "checked_today": is_checked_today,
                "current_streak": current_streak,
                "month_count": month_count,
                "latest_checkin": dates[0].isoformat() if dates else None,
            }
        )

    summary = {
        "active_habits": len(habits),
        "checked_today": checked_today,
        "best_streak": best_streak,
        "focus_label": habits[0].name if habits else "Sem hábitos cadastrados",
    }

    return {"habits": habits_payload, "summary": summary}


# GOALS / METAS

def get_goal_config(db: Session) -> GoalConfig | None:
    stmt = select(GoalConfig).order_by(GoalConfig.id.asc()).limit(1)
    return db.scalar(stmt)


def save_goal_config(db: Session, payload: GoalConfigCreate) -> GoalConfig:
    config = get_goal_config(db)

    if config is None:
        config = GoalConfig(
            finance_monthly_goal=payload.finance_monthly_goal,
            routine_daily_goal=payload.routine_daily_goal,
            habit_daily_goal=payload.habit_daily_goal,
        )
        db.add(config)
    else:
        config.finance_monthly_goal = payload.finance_monthly_goal
        config.routine_daily_goal = payload.routine_daily_goal
        config.habit_daily_goal = payload.habit_daily_goal

    db.commit()
    db.refresh(config)
    return config

# CUTHUB - CLIENTES

def create_client(db: Session, payload: ClientCreate) -> Client:
    client = Client(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=payload.email.strip(),
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
    stmt = select(Client).where(Client.id == client_id)
    return db.scalar(stmt)



def get_client_by_email(db: Session, email: str) -> Client | None:
    clean_email = (email or "").strip().lower()
    if not clean_email:
        return None
    stmt = select(Client).where(func.lower(Client.email) == clean_email)
    return db.scalar(stmt)


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
    client.email = payload.email.strip()
    client.status = getattr(payload, "status", getattr(client, "status", "active"))
    if hasattr(payload, "face_image_url") and payload.face_image_url:
        client.face_image_url = payload.face_image_url.strip()
    client.allows_photos = bool(getattr(payload, "allows_photos", getattr(client, "allows_photos", True)))
    client.allows_face_recognition = bool(getattr(payload, "allows_face_recognition", getattr(client, "allows_face_recognition", True)))
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


# CUTHUB - BARBEIROS

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
    stmt = select(Barber).where(Barber.id == barber_id)
    return db.scalar(stmt)


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


# CUTHUB - SERVIÇOS

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
    allowed = [item["name"].lower() for item in DEFAULT_SERVICES]
    stmt = select(Service).where(func.lower(Service.name).in_(allowed)).order_by(Service.id.asc())
    return list(db.scalars(stmt).all())


def get_service_by_id(db: Session, service_id: int) -> Service | None:
    stmt = select(Service).where(Service.id == service_id)
    return db.scalar(stmt)


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



# CUTHUB - DISPONIBILIDADE


def _time_to_minutes(value: str) -> int:
    hour, minute = str(value or "00:00").split(":")
    return int(hour) * 60 + int(minute)

def _minutes_to_time(value: int) -> str:
    return f"{value // 60:02d}:{value % 60:02d}"

def seed_default_barber_availability(db: Session, barber_id: int) -> None:
    existing = db.scalar(select(BarberAvailability).where(BarberAvailability.barber_id == barber_id))
    if existing:
        return
    # Segunda a sábado, com almoço fora: 09-12 e 14-18. Domingo inativo.
    for weekday in range(0, 6):
        db.add(BarberAvailability(barber_id=barber_id, weekday=weekday, start_time="09:00", end_time="12:00", is_active=True))
        db.add(BarberAvailability(barber_id=barber_id, weekday=weekday, start_time="14:00", end_time="18:00", is_active=True))
    db.commit()

def list_barber_availability(db: Session, barber_id: int | None = None) -> list[BarberAvailability]:
    stmt = select(BarberAvailability)
    if barber_id is not None:
        stmt = stmt.where(BarberAvailability.barber_id == barber_id)
    stmt = stmt.order_by(BarberAvailability.barber_id.asc(), BarberAvailability.weekday.asc(), BarberAvailability.start_time.asc())
    return list(db.scalars(stmt).all())

def replace_barber_availability(db: Session, barber_id: int, items: list[BarberAvailabilityCreate]) -> list[BarberAvailability]:
    current = list_barber_availability(db, barber_id)
    for item in current:
        db.delete(item)
    db.commit()
    for payload in items:
        db.add(BarberAvailability(
            barber_id=barber_id,
            weekday=payload.weekday,
            start_time=payload.start_time,
            end_time=payload.end_time,
            is_active=payload.is_active,
        ))
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

def list_barber_time_off(db: Session, barber_id: int | None = None, target_date: date | None = None) -> list[BarberTimeOff]:
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
    windows = [item for item in list_barber_availability(db, barber_id) if item.weekday == weekday and item.is_active]
    if not windows:
        return []
    appointments = [item for item in list_appointments(db, target_date) if item.barber_id == barber_id and item.status != "cancelled"]
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


def list_appointments(
    db: Session,
    target_date: date | None = None,
) -> list[Appointment]:
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
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    return db.scalar(stmt)


def update_appointment(
    db: Session,
    appointment_id: int,
    payload: AppointmentCreate,
) -> Appointment | None:
    appointment = get_appointment_by_id(db, appointment_id)
    if appointment is None:
        return None

    appointment.client_id = payload.client_id
    appointment.barber_id = payload.barber_id
    appointment.service_id = payload.service_id
    appointment.appointment_date = payload.appointment_date
    appointment.appointment_time = payload.appointment_time
    appointment.status = payload.status
    appointment.notes = payload.notes.strip()

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


def get_cuthub_dashboard(db: Session) -> dict:
    today = date.today()

    clients = list_clients(db)
    barbers = list_barbers(db)
    services = list_services(db)
    today_appointments = list_appointments(db, today)

    completed_today = [
        appointment for appointment in today_appointments
        if appointment.status == "completed"
    ]

    scheduled_today = [
        appointment for appointment in today_appointments
        if appointment.status == "scheduled"
    ]

    return {
        "clients_count": len(clients),
        "active_barbers_count": sum(1 for barber in barbers if barber.status == "active"),
        "services_count": len(services),
        "appointments_today_count": len(today_appointments),
        "scheduled_today_count": len(scheduled_today),
        "completed_today_count": len(completed_today),
        "recent_clients": clients[:8],
        "today_appointments": today_appointments,
    }


# CUTHUB - HISTÓRICO DE CORTES

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


def list_haircut_records(
    db: Session,
    client_id: int | None = None,
) -> list[HaircutRecord]:
    stmt = select(HaircutRecord)

    if client_id is not None:
        stmt = stmt.where(HaircutRecord.client_id == client_id)

    stmt = stmt.order_by(HaircutRecord.cut_date.desc(), HaircutRecord.id.desc())
    return list(db.scalars(stmt).all())


def get_haircut_record_by_id(db: Session, record_id: int) -> HaircutRecord | None:
    stmt = select(HaircutRecord).where(HaircutRecord.id == record_id)
    return db.scalar(stmt)


def update_haircut_record(
    db: Session,
    record_id: int,
    payload: HaircutRecordCreate,
) -> HaircutRecord | None:
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
