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