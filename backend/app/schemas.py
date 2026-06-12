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