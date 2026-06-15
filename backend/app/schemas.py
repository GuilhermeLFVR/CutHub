from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

TransactionType = Literal["income", "expense"]
TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["todo", "doing", "done"]
UserRole = Literal["admin", "barber", "client"]


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
# CUTHUB - AUTH / USUÁRIOS
# =============================

class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=160)


class ClientRegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=4, max_length=72)


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=30)
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=4, max_length=72)
    role: UserRole = "barber"
    is_active: bool = True




class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=30)
    email: str = Field(min_length=3, max_length=160)
    role: UserRole = "barber"
    is_active: bool = True


class UserPasswordReset(BaseModel):
    password: str = Field(min_length=4, max_length=72)


class UserResponse(BaseModel):
    id: int
    name: str
    phone: str = ""
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    user: UserResponse
    message: str = "Login realizado com sucesso."

# =============================
# CUTHUB - BARBEARIA
# =============================

ClientStatus = Literal["active", "inactive"]
AppointmentStatus = Literal["scheduled", "in_progress", "completed", "cancelled"]


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    email: str = ""
    status: ClientStatus = "active"
    face_image_url: str = ""
    allows_photos: bool = True
    allows_face_recognition: bool = True
    preferred_cut: str = ""
    notes: str = ""


class ClientResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    status: ClientStatus
    face_image_url: str | None
    allows_photos: bool = True
    allows_face_recognition: bool = True
    preferred_cut: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientFaceCaptureRequest(BaseModel):
    image_data: str = Field(min_length=20)


class RecognitionIdentifyRequest(BaseModel):
    image_data: str = Field(min_length=20)
    appointment_date: date | None = None



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


class BarberAvailabilityCreate(BaseModel):
    barber_id: int
    weekday: int = Field(ge=0, le=6)
    start_time: str = Field(default="09:00", min_length=4, max_length=5)
    end_time: str = Field(default="18:00", min_length=4, max_length=5)
    is_active: bool = True


class BarberAvailabilityResponse(BaseModel):
    id: int
    barber_id: int
    weekday: int
    start_time: str
    end_time: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BarberTimeOffCreate(BaseModel):
    barber_id: int
    off_date: date
    start_time: str = ""
    end_time: str = ""
    reason: str = ""


class BarberTimeOffResponse(BaseModel):
    id: int
    barber_id: int
    off_date: date
    start_time: str | None
    end_time: str | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailableSlotsResponse(BaseModel):
    barber_id: int
    service_id: int
    target_date: date
    slots: list[str]


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


class HaircutRecordCreate(BaseModel):
    client_id: int
    service_id: int | None = None
    barber_id: int | None = None
    cut_date: date
    title: str = Field(default="Corte", min_length=1, max_length=120)
    notes: str = ""
    photo_url: str = ""
    tools_used: str = ""


class HaircutRecordResponse(BaseModel):
    id: int
    client_id: int
    service_id: int | None
    barber_id: int | None
    cut_date: date
    title: str
    notes: str | None
    photo_url: str | None
    tools_used: str | None
    created_at: datetime

    model_config = {"from_attributes": True}