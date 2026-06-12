from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

TransactionType = Literal["income", "expense"]
TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["todo", "doing", "done"]


class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0)
    category: str
    description: str
    transaction_date: date
    notes: str = ""


class TransactionResponse(BaseModel):
    id: int
    type: TransactionType
    amount: float
    category: str
    description: str
    transaction_date: date
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkDeleteRequest(BaseModel):
    ids: list[int]


class CategorySuggestRequest(BaseModel):
    description: str
    type: TransactionType


class TotalBalanceConfigCreate(BaseModel):
    total_balance: float


class TotalBalanceConfigResponse(BaseModel):
    id: int
    total_balance: float

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = ""
    priority: TaskPriority = "medium"
    status: TaskStatus = "todo"
    due_date: date | None = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str
    priority: TaskPriority
    status: TaskStatus
    due_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=50)
    target_frequency: Literal["daily"] = "daily"


class HabitResponse(BaseModel):
    id: int
    name: str
    category: str
    target_frequency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HabitCheckinToggle(BaseModel):
    checkin_date: date | None = None
    notes: str = ""

class GoalConfigCreate(BaseModel):
    finance_monthly_goal: float = 0
    routine_daily_goal: int = 0
    habit_daily_goal: int = 0


class GoalConfigResponse(BaseModel):
    id: int
    finance_monthly_goal: float
    routine_daily_goal: int
    habit_daily_goal: int

    model_config = {"from_attributes": True}

# =============================
# CUTHUB - BARBEARIA
# =============================

ClientStatus = Literal["active", "inactive"]
AppointmentStatus = Literal["scheduled", "completed", "cancelled"]


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    email: str = ""
    preferred_cut: str = ""
    notes: str = ""


class ClientResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    preferred_cut: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BarberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    specialty: str = ""
    status: ClientStatus = "active"


class BarberResponse(BaseModel):
    id: int
    name: str
    phone: str | None
    specialty: str | None
    status: ClientStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: float = Field(default=0, ge=0)
    duration_minutes: int = Field(default=30, ge=5, le=480)
    description: str = ""
    tools: str = ""


class ServiceResponse(BaseModel):
    id: int
    name: str
    price: float
    duration_minutes: int
    description: str | None
    tools: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AppointmentCreate(BaseModel):
    client_id: int
    barber_id: int
    service_id: int
    appointment_date: date
    appointment_time: str = Field(default="09:00", min_length=4, max_length=5)
    status: AppointmentStatus = "scheduled"
    notes: str = ""


class AppointmentResponse(BaseModel):
    id: int
    client_id: int
    barber_id: int
    service_id: int
    appointment_date: date
    appointment_time: str
    status: AppointmentStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}