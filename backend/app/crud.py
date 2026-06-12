from datetime import date, datetime, timedelta

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models import DashboardConfig, GoalConfig, Habit, HabitCheckin, Task, Transaction
from app.schemas import (
    HabitCheckinToggle,
    HabitCreate,
    TaskCreate,
    TotalBalanceConfigCreate,
    TransactionCreate,
    GoalConfigCreate,
)


def _normalize_category(category: str | None) -> str:
    raw = "" if category is None else str(category).strip()

    if not raw or raw.lower() == "undefined":
        return "Outros"

    return raw


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


# =============================
# TASKS / ROTINA
# =============================

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


# =============================
# HABITS / PESSOAL
# =============================

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


# =============================
# GOALS / METAS
# =============================

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