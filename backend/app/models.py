from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String

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

# =============================
# CUTHUB - BARBEARIA
# =============================

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=False, default="")
    email = Column(String, nullable=True, default="")
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