import asyncio
from datetime import date
from decimal import Decimal, InvalidOperation

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from app.config import TELEGRAM_BOT_NAME, TELEGRAM_BOT_TOKEN
from app.crud import (
    create_transaction,
    get_total_by_type,
    infer_category_from_description,
    list_transactions,
)
from app.database import SessionLocal
from app.schemas import TransactionCreate


WELCOME_TEXT = f"""
💠 {TELEGRAM_BOT_NAME}

Comandos disponíveis:
/start
/gasto 25 almoço
/ganho 100 freela
/saldo
/hoje
/mes
""".strip()


def format_brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def parse_amount(value: str) -> float:
    cleaned = value.replace("R$", "").replace(".", "").replace(",", ".").strip()

    try:
        amount = Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError("Valor inválido.") from exc

    if amount <= 0:
        raise ValueError("O valor precisa ser maior que zero.")

    return float(amount)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message:
        await update.message.reply_text(WELCOME_TEXT)


async def expense_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await handle_transaction(update, context, transaction_type="expense")


async def income_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await handle_transaction(update, context, transaction_type="income")


async def handle_transaction(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    transaction_type: str,
) -> None:
    if not update.message:
        return

    args = context.args
    if len(args) < 2:
        exemplo = "/gasto 25 almoço" if transaction_type == "expense" else "/ganho 100 freela"
        await update.message.reply_text(f"Formato inválido. Exemplo: {exemplo}")
        return

    try:
        amount = parse_amount(args[0])
    except ValueError as exc:
        await update.message.reply_text(str(exc))
        return

    description = " ".join(args[1:]).strip()
    category = infer_category_from_description(description, transaction_type)

    payload = TransactionCreate(
        type=transaction_type,
        amount=amount,
        category=category,
        description=description,
        transaction_date=date.today(),
        notes="",
    )

    db = SessionLocal()
    try:
        transaction = create_transaction(db, payload)
    finally:
        db.close()

    emoji = "🔻" if transaction_type == "expense" else "🟢"
    label = "Gasto" if transaction_type == "expense" else "Ganho"

    await update.message.reply_text(
        f"{emoji} {label} registrado\n"
        f"Valor: {format_brl(transaction.amount)}\n"
        f"Descrição: {transaction.description}\n"
        f"Categoria: {transaction.category}"
    )


async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return

    db = SessionLocal()
    try:
        transactions = list_transactions(db)
        total_income = sum(item.amount for item in transactions if item.type == "income")
        total_expense = sum(item.amount for item in transactions if item.type == "expense")
    finally:
        db.close()

    balance = total_income - total_expense

    await update.message.reply_text(
        f"💠 Saldo geral\n"
        f"Ganhos: {format_brl(total_income)}\n"
        f"Gastos: {format_brl(total_expense)}\n"
        f"Saldo: {format_brl(balance)}"
    )


async def today_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return

    today = date.today()

    db = SessionLocal()
    try:
        income = get_total_by_type(db, "income", target_date=today)
        expense = get_total_by_type(db, "expense", target_date=today)
    finally:
        db.close()

    balance = income - expense

    await update.message.reply_text(
        f"📅 Resumo de hoje ({today.strftime('%d/%m/%Y')})\n"
        f"Ganhos: {format_brl(income)}\n"
        f"Gastos: {format_brl(expense)}\n"
        f"Saldo do dia: {format_brl(balance)}"
    )


async def month_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return

    today = date.today()

    db = SessionLocal()
    try:
        income = get_total_by_type(db, "income", month=today.month, year=today.year)
        expense = get_total_by_type(db, "expense", month=today.month, year=today.year)
    finally:
        db.close()

    balance = income - expense

    await update.message.reply_text(
        f"📊 Resumo do mês ({today.month:02d}/{today.year})\n"
        f"Ganhos: {format_brl(income)}\n"
        f"Gastos: {format_brl(expense)}\n"
        f"Saldo do mês: {format_brl(balance)}"
    )


async def run_bot() -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError("Defina TELEGRAM_BOT_TOKEN no arquivo .env")

    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("gasto", expense_command))
    application.add_handler(CommandHandler("ganho", income_command))
    application.add_handler(CommandHandler("saldo", balance_command))
    application.add_handler(CommandHandler("hoje", today_command))
    application.add_handler(CommandHandler("mes", month_command))

    print("DashNOX Bot online...")

    await application.initialize()
    await application.start()
    await application.updater.start_polling()

    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()


if __name__ == "__main__":
    asyncio.run(run_bot())