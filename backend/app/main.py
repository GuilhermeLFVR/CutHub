from datetime import date
from pathlib import Path
import csv
import io
import json

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.database import get_db, engine
from app import models, schemas, crud


# =============================
# DATABASE
# =============================
models.Base.metadata.create_all(bind=engine)


# =============================
# PATHS
# =============================
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = (BASE_DIR.parent / "frontend").resolve()
LOCAL_CONFIG_DIR = BASE_DIR / "local_config"
LOCAL_CONFIG_DIR.mkdir(exist_ok=True)
MONTHLY_GOALS_FILE = LOCAL_CONFIG_DIR / "monthly_goals.json"


# =============================
# APP
# =============================
app = FastAPI()


def calculate_status(income: float, expense: float, balance: float) -> str:
    if income == 0 and expense == 0:
        return "Sem atividade no período"

    if expense > income:
        return "Você está gastando mais do que ganha"

    if balance > 0 and expense == 0:
        return "Período positivo sem gastos"

    if income >= expense * 1.5:
        return "Saldo positivo e controlado"

    if balance > 0:
        return "Leve saldo positivo"

    if balance == 0 and (income > 0 or expense > 0):
        return "Equilíbrio financeiro"

    return "Atenção ao ritmo dos gastos"




# =============================
# SALDO TOTAL AUTOMÁTICO
# =============================
def _transaction_balance_delta_from_values(transaction_type: str, amount: float) -> float:
    value = float(amount or 0)

    if transaction_type == "income":
        return value

    if transaction_type == "expense":
        return -value

    return 0.0


def _transaction_balance_delta(transaction) -> float:
    if not transaction:
        return 0.0

    return _transaction_balance_delta_from_values(
        getattr(transaction, "type", ""),
        float(getattr(transaction, "amount", 0) or 0),
    )


def _payload_balance_delta(payload: schemas.TransactionCreate) -> float:
    return _transaction_balance_delta_from_values(payload.type, float(payload.amount or 0))


def _get_transaction_by_id(db: Session, transaction_id: int):
    transactions = crud.list_transactions(db)

    for transaction in transactions:
        if transaction.id == transaction_id:
            return transaction

    return None


def _adjust_total_balance(db: Session, delta: float) -> None:
    if not delta:
        return

    dashboard_config = crud.get_dashboard_config(db)
    current_total = float(dashboard_config.total_balance) if dashboard_config else 0.0
    new_total = current_total + float(delta)

    crud.save_total_balance_config(
        db,
        schemas.TotalBalanceConfigCreate(total_balance=new_total),
    )


def _create_transaction_and_adjust_balance(db: Session, payload: schemas.TransactionCreate):
    transaction = crud.create_transaction(db, payload)
    _adjust_total_balance(db, _payload_balance_delta(payload))
    return transaction


def _update_transaction_and_adjust_balance(db: Session, transaction_id: int, payload: schemas.TransactionCreate):
    old_transaction = _get_transaction_by_id(db, transaction_id)
    old_delta = _transaction_balance_delta(old_transaction)

    transaction = crud.update_transaction(db, transaction_id, payload)

    if transaction:
        new_delta = _payload_balance_delta(payload)
        _adjust_total_balance(db, new_delta - old_delta)

    return transaction


def _delete_transaction_and_adjust_balance(db: Session, transaction_id: int):
    old_transaction = _get_transaction_by_id(db, transaction_id)
    old_delta = _transaction_balance_delta(old_transaction)

    deleted = crud.delete_transaction(db, transaction_id)

    if deleted:
        _adjust_total_balance(db, -old_delta)

    return deleted


# =============================
# CORS
# =============================
ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================
# STATIC FILES
# =============================
if (FRONTEND_DIR / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIR / "assets"),
        name="assets",
    )


# =============================
# FRONTEND
# =============================
@app.get("/")
def serve_dashboard():
    index_file = FRONTEND_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend não encontrado.")

    return FileResponse(index_file)


# =============================
# TRANSAÇÕES
# =============================
@app.get("/api/transactions", response_model=list[schemas.TransactionResponse])
def get_transactions(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    return crud.list_transactions(db, month=month, year=year)


@app.post("/api/transactions", response_model=schemas.TransactionResponse)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
):
    return _create_transaction_and_adjust_balance(db, payload)


@app.put("/api/transactions/{transaction_id}", response_model=schemas.TransactionResponse)
def edit_transaction(
    transaction_id: int,
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
):
    transaction = _update_transaction_and_adjust_balance(db, transaction_id, payload)

    if not transaction:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    return transaction


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
):
    deleted = _delete_transaction_and_adjust_balance(db, transaction_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Transação não encontrada.")

    return {"message": "Transação removida com sucesso."}


# =============================
# DELETE EM MASSA
# =============================
@app.post("/api/transactions/bulk-delete")
def delete_transactions_bulk(
    payload: schemas.BulkDeleteRequest,
    db: Session = Depends(get_db),
):
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Nenhuma transação foi selecionada.")

    transactions_to_delete = [
        transaction
        for transaction in crud.list_transactions(db)
        if transaction.id in payload.ids
    ]
    total_delta_to_reverse = sum(_transaction_balance_delta(transaction) for transaction in transactions_to_delete)

    deleted_count = crud.delete_transactions_bulk(db, payload.ids)

    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nenhuma transação encontrada para exclusão.")

    _adjust_total_balance(db, -total_delta_to_reverse)

    return {
        "message": "Transações removidas com sucesso.",
        "deleted_count": deleted_count,
    }


# =============================
# EXPORT CSV
# =============================
@app.get("/api/transactions/export")
def export_transactions_csv(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    today = date.today()

    selected_month = month if month is not None else today.month
    selected_year = year if year is not None else today.year

    transactions = crud.list_transactions(
        db,
        month=selected_month,
        year=selected_year,
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        ["ID", "Tipo", "Categoria", "Descrição", "Valor", "Data", "Observações"]
    )

    for t in transactions:
        writer.writerow(
            [
                t.id,
                "Ganho" if t.type == "income" else "Gasto",
                t.category,
                t.description,
                t.amount,
                t.transaction_date.strftime("%d/%m/%Y"),
                t.notes or "",
            ]
        )

    output.seek(0)

    filename = f"extrato-{selected_year}-{str(selected_month).zfill(2)}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


# =============================
# SUGESTÃO DE CATEGORIA
# =============================
@app.post("/api/suggest-category")
def suggest_category(
    payload: schemas.CategorySuggestRequest,
    db: Session = Depends(get_db),
):
    suggested = crud.infer_category_from_description(payload.description, payload.type)
    return {"category": suggested}


# =============================
# CONFIGURAÇÃO DO DASHBOARD
# =============================
@app.post("/api/config/total-balance", response_model=schemas.TotalBalanceConfigResponse)
def save_total_balance_config(
    payload: schemas.TotalBalanceConfigCreate,
    db: Session = Depends(get_db),
):
    return crud.save_total_balance_config(db, payload)


# =============================
# DASHBOARD
# =============================
@app.get("/api/dashboard")
def dashboard(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    today = date.today()

    selected_month = month if month is not None else today.month
    selected_year = year if year is not None else today.year

    transactions = crud.list_transactions(
        db,
        month=selected_month,
        year=selected_year,
    )
    income = crud.get_total_by_type(db, "income", selected_month, selected_year)
    expense = crud.get_total_by_type(db, "expense", selected_month, selected_year)

    balance = income - expense

    dashboard_config = crud.get_dashboard_config(db)
    total_balance_base = float(dashboard_config.total_balance) if dashboard_config else 0.0
    total_balance = total_balance_base
    status = calculate_status(income, expense, balance)

    return {
        "month": selected_month,
        "year": selected_year,
        "total_income": income,
        "total_expense": expense,
        "balance": balance,
        "total_balance": total_balance,
        "status": status,
        "total_balance_base": total_balance_base,
        "transactions": transactions,
        "category_breakdown": crud.get_category_breakdown(db, selected_month, selected_year),
        "daily_flow": crud.get_daily_flow(db, selected_month, selected_year),
        "summary": crud.get_monthly_summary(db, selected_month, selected_year),
    }


# =============================
# METAS MENSAIS
# =============================
def _goal_key(month: int, year: int) -> str:
    return f"{year}-{str(month).zfill(2)}"


def _read_monthly_goals() -> dict:
    if not MONTHLY_GOALS_FILE.exists():
        return {}

    try:
        return json.loads(MONTHLY_GOALS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_monthly_goals(data: dict) -> None:
    MONTHLY_GOALS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@app.get("/api/goals")
def get_goals(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
):
    today = date.today()
    selected_month = month if month is not None else today.month
    selected_year = year if year is not None else today.year

    goals = _read_monthly_goals()
    current_goal = goals.get(_goal_key(selected_month, selected_year), {})

    return {
        "month": selected_month,
        "year": selected_year,
        "finance_monthly_goal": float(current_goal.get("finance_monthly_goal", 0) or 0),
    }


@app.post("/api/goals")
def save_goals(payload: dict):
    today = date.today()

    selected_month = int(payload.get("month") or today.month)
    selected_year = int(payload.get("year") or today.year)

    if selected_month < 1 or selected_month > 12:
        raise HTTPException(status_code=400, detail="Mês inválido.")

    if selected_year < 2000 or selected_year > 2100:
        raise HTTPException(status_code=400, detail="Ano inválido.")

    finance_goal = float(payload.get("finance_monthly_goal") or 0)

    goals = _read_monthly_goals()
    goals[_goal_key(selected_month, selected_year)] = {
        "finance_monthly_goal": finance_goal,
    }
    _write_monthly_goals(goals)

    return {
        "month": selected_month,
        "year": selected_year,
        "finance_monthly_goal": finance_goal,
    }

# =============================
# APOSTAS - OPERAÇÕES
# =============================
BETTING_OPERATIONS_FILE = LOCAL_CONFIG_DIR / "betting_operations.json"


def _read_betting_operations() -> list[dict]:
    if not BETTING_OPERATIONS_FILE.exists():
        return []

    try:
        data = json.loads(BETTING_OPERATIONS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _write_betting_operations(data: list[dict]) -> None:
    BETTING_OPERATIONS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )





BETTING_FINANCE_MARKER_PREFIX = "[BETTING_OPERATION:"


def _is_betting_finalized(status: str) -> bool:
    return str(status or "").strip().lower() in {"finalizada", "finalizado", "fechada", "fechado"}


def _parse_operation_finance_date(operation: dict) -> date:
    """
    Usa a data do jogo para lançar no financeiro.
    Se ela não existir, usa a data da operação.
    """
    raw_date = str(operation.get("date") or date.today().isoformat()).strip()

    try:
        return date.fromisoformat(raw_date[:10])
    except ValueError:
        return date.today()


def _get_betting_marker(operation_id: str) -> str:
    return f"{BETTING_FINANCE_MARKER_PREFIX}{operation_id}]"


def _find_betting_finance_transaction(db: Session, operation_id: str):
    marker = _get_betting_marker(operation_id)
    transactions = crud.list_transactions(db)

    for transaction in transactions:
        notes = str(getattr(transaction, "notes", "") or "")
        description = str(getattr(transaction, "description", "") or "")

        if marker in notes or marker in description:
            return transaction

    return None


def _delete_betting_finance_transaction(db: Session, operation_id: str) -> None:
    transaction = _find_betting_finance_transaction(db, operation_id)

    if transaction:
        _delete_transaction_and_adjust_balance(db, transaction.id)


def _sync_betting_operation_to_finance(db: Session, operation: dict) -> None:
    """
    Se a operação estiver finalizada, cria/atualiza um lançamento no financeiro.
    Se sair de finalizada, remove o lançamento vinculado.

    Resultado líquido:
    profit - mission_cost

    Positivo = income
    Negativo = expense
    Zero = remove lançamento, porque não altera a balança.
    """
    operation_id = str(operation.get("id") or "").strip()
    if not operation_id:
        return

    if not _is_betting_finalized(operation.get("status")):
        _delete_betting_finance_transaction(db, operation_id)
        return

    profit = float(operation.get("profit") or 0)
    mission_cost = float(operation.get("mission_cost") or 0)
    net_result = profit - mission_cost

    if net_result == 0:
        _delete_betting_finance_transaction(db, operation_id)
        return

    marker = _get_betting_marker(operation_id)
    transaction_type = "income" if net_result > 0 else "expense"
    transaction_amount = abs(net_result)
    transaction_date = _parse_operation_finance_date(operation)

    houses = operation.get("houses") if isinstance(operation.get("houses"), list) else []
    if houses:
        house = " / ".join([
            str(house_item.get("name") or "Casa").strip()
            for house_item in houses
            if str(house_item.get("name") or "").strip()
        ]) or "Casa não informada"
    else:
        house = str(operation.get("house") or "Casa não informada").strip()

    market = str(operation.get("market") or "Mercado não informado").strip()
    game = str(operation.get("game") or "Jogo não informado").strip()
    operation_type = str(operation.get("type") or "Operação").strip()

    description = f"Apostas - {operation_type} - {house} - {game} - {market}"
    notes = (
        f"{marker}\n"
        f"Lançamento automático gerado ao marcar a operação como finalizada.\n"
        f"Lucro/prejuízo informado: {profit:.2f}\n"
        f"Custo/perda da missão: {mission_cost:.2f}\n"
        f"Resultado líquido: {net_result:.2f}"
    )

    payload = schemas.TransactionCreate(
        type=transaction_type,
        category="apostas",
        description=description,
        amount=transaction_amount,
        transaction_date=transaction_date,
        notes=notes,
    )

    existing_transaction = _find_betting_finance_transaction(db, operation_id)

    if existing_transaction:
        _update_transaction_and_adjust_balance(db, existing_transaction.id, payload)
    else:
        _create_transaction_and_adjust_balance(db, payload)


def get_betting_period_result(month: int, year: int) -> float:
    """
    Resultado líquido das operações de apostas finalizadas no período.

    Fórmula:
    lucro líquido = profit - mission_cost

    Só entram operações com status Finalizada/finalizada.
    O período usa a data da operação ("date"), não a data do jogo ("event_date").
    """
    operations = _read_betting_operations()
    total = 0.0

    for operation in operations:
        status = str(operation.get("status") or "").strip().lower()
        if status not in {"finalizada", "finalizado", "fechada", "fechado"}:
            continue

        raw_date = str(operation.get("date") or "").strip()
        if not raw_date:
            continue

        try:
            operation_date = date.fromisoformat(raw_date[:10])
        except ValueError:
            continue

        if operation_date.month != month or operation_date.year != year:
            continue

        profit = float(operation.get("profit") or 0)
        mission_cost = float(operation.get("mission_cost") or 0)
        total += profit - mission_cost

    return total


@app.get("/api/betting-operations")
def get_betting_operations():
    return {"operations": _read_betting_operations()}


@app.post("/api/betting-operations")
def save_betting_operation(payload: dict, db: Session = Depends(get_db)):
    operation_id = str(payload.get("id") or "").strip()
    if not operation_id:
        raise HTTPException(status_code=400, detail="ID da operação inválido.")

    operations = _read_betting_operations()
    normalized = {
        "id": operation_id,
        "type": str(payload.get("type") or "Surebet"),
        "houses": payload.get("houses") if isinstance(payload.get("houses"), list) else [],
        "house": str(payload.get("house") or "").strip(),
        "market": str(payload.get("market") or "").strip(),
        "game": str(payload.get("game") or "").strip(),
        "status": str(payload.get("status") or "Aberta"),
        "stake": float(payload.get("stake") or 0),
        "freebet_value": float(payload.get("freebet_value") or 0),
        "mission_cost": float(payload.get("mission_cost") or 0),
        "profit": float(payload.get("profit") or 0),
        "date": str(payload.get("date") or date.today().isoformat()),
        "event_date": str(payload.get("event_date") or "").strip(),
        "notes": str(payload.get("notes") or "").strip(),
    }

    if not (normalized.get("houses") or normalized["house"]) or not normalized["market"]:
        raise HTTPException(status_code=400, detail="Casa e mercado são obrigatórios.")

    existing_index = next((index for index, item in enumerate(operations) if item.get("id") == operation_id), None)

    if existing_index is None:
        operations.append(normalized)
    else:
        operations[existing_index] = normalized

    _write_betting_operations(operations)
    _sync_betting_operation_to_finance(db, normalized)

    return normalized


@app.delete("/api/betting-operations/{operation_id}")
def delete_betting_operation(operation_id: str, db: Session = Depends(get_db)):
    operations = _read_betting_operations()
    updated = [item for item in operations if item.get("id") != operation_id]

    if len(updated) == len(operations):
        raise HTTPException(status_code=404, detail="Operação não encontrada.")

    _write_betting_operations(updated)
    _delete_betting_finance_transaction(db, operation_id)

    return {"message": "Operação removida com sucesso."}


@app.delete("/api/betting-operations")
def clear_betting_operations(db: Session = Depends(get_db)):
    operations = _read_betting_operations()

    for operation in operations:
        operation_id = str(operation.get("id") or "").strip()
        if operation_id:
            _delete_betting_finance_transaction(db, operation_id)

    _write_betting_operations([])
    return {"message": "Operações removidas com sucesso."}

# =============================
# CUTHUB - CLIENTES
# =============================

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


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_client(db, client_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    return {"message": "Cliente removido com sucesso."}


# =============================
# CUTHUB - BARBEIROS
# =============================

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


# =============================
# CUTHUB - SERVIÇOS
# =============================

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


# =============================
# CUTHUB - AGENDAMENTOS
# =============================

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
    if not crud.get_client_by_id(db, payload.client_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    if not crud.get_barber_by_id(db, payload.barber_id):
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado.")

    if not crud.get_service_by_id(db, payload.service_id):
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

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


@app.delete("/api/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_appointment(db, appointment_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    return {"message": "Agendamento removido com sucesso."}