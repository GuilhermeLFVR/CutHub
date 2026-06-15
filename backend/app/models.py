from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    transaction_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DashboardConfig(Base):
    __tablename__ = "dashboard_config"

    id = Column(Integer, primary_key=True, index=True)
    total_balance = Column(Float, nullable=False, default=0.0)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True, default="")
    priority = Column(String, nullable=False, default="medium")
    status = Column(String, nullable=False, default="todo")
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, default="Geral")
    target_frequency = Column(String, nullable=False, default="daily")
    created_at = Column(DateTime, default=datetime.utcnow)


class HabitCheckin(Base):
    __tablename__ = "habit_checkins"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False, index=True)
    checkin_date = Column(Date, nullable=False, index=True)
    notes = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class GoalConfig(Base):
    __tablename__ = "goal_config"

    id = Column(Integer, primary_key=True, index=True)
    finance_monthly_goal = Column(Float, nullable=False, default=0.0)
    routine_daily_goal = Column(Integer, nullable=False, default=0)
    habit_daily_goal = Column(Integer, nullable=False, default=0)



# CUTHUB - USUÁRIOS / AUTH


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=False, default="")
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="barber")  # admin | barber | client
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# CUTHUB - BARBEARIA

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=False, default="")
    email = Column(String, nullable=True, default="")
    status = Column(String, nullable=False, default="active")
    face_image_url = Column(String, nullable=True, default="")
    allows_photos = Column(Boolean, nullable=False, default=True)
    allows_face_recognition = Column(Boolean, nullable=False, default=True)
    preferred_cut = Column(String, nullable=True, default="")
    notes = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Barber(Base):
    __tablename__ = "barbers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True, default="")
    specialty = Column(String, nullable=True, default="")
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    price = Column(Float, nullable=False, default=0.0)
    duration_minutes = Column(Integer, nullable=False, default=30)
    description = Column(String, nullable=True, default="")
    tools = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class BarberAvailability(Base):
    __tablename__ = "barber_availability"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False, index=True)  # 0=segunda ... 6=domingo
    start_time = Column(String, nullable=False, default="09:00")
    end_time = Column(String, nullable=False, default="18:00")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BarberTimeOff(Base):
    __tablename__ = "barber_time_off"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    off_date = Column(Date, nullable=False, index=True)
    start_time = Column(String, nullable=True, default="")
    end_time = Column(String, nullable=True, default="")
    reason = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    appointment_date = Column(Date, nullable=False, index=True)
    appointment_time = Column(String, nullable=False, default="09:00")
    status = Column(String, nullable=False, default="scheduled")
    notes = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class HaircutRecord(Base):
    __tablename__ = "haircut_records"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=True, index=True)
    cut_date = Column(Date, nullable=False, index=True)
    title = Column(String, nullable=False, default="Corte")
    notes = Column(String, nullable=True, default="")
    photo_url = Column(String, nullable=True, default="")
    tools_used = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
