const API_BASE = "/api";
let categoryChart = null;
let dailyFlowChart = null;
let editingTransactionId = null;
let allTransactions = [];
let pendingDeleteId = null;
let pendingDeleteMode = "single";
let selectedTransactionIds = new Set();
let autoCategoryTouched = false;
let activeSection = "finance";
let bettingOperations = [];

let bettingManualWorkCash = Number(
  localStorage.getItem("dashnox_manual_work_cash") || 0
);

function getUnifiedTotalBalance() {
  return Number(
    currentDashboardData?.total_balance_base ??
    currentDashboardData?.total_balance ??
    0
  );
}

function saveBettingManualWorkCash() {
  localStorage.setItem(
    "dashnox_manual_work_cash",
    String(bettingManualWorkCash)
  );
}

function syncBettingBalanceInput() {
  const input = document.getElementById("bettingRealBalanceInput");
  if (!input || document.activeElement === input) return;

  const unifiedBalance = getUnifiedTotalBalance();
  input.value = unifiedBalance > 0 ? unifiedBalance.toFixed(2) : "";
}

function syncFinanceTotalBalanceInput() {
  const input = document.getElementById("totalBalanceInput");
  if (!input || document.activeElement === input) return;

  const unifiedBalance = getUnifiedTotalBalance();
  input.value = unifiedBalance > 0 ? unifiedBalance.toFixed(2) : "";
}

async function updateUnifiedTotalBalance(value) {
  await saveTotalBalanceConfig(value);
  await loadDashboard({ showLoader: false });

  if (currentDashboardData) {
    currentDashboardData.total_balance_base = value;
    currentDashboardData.total_balance = value;
  }

  syncBettingBalanceInput();
  syncFinanceTotalBalanceInput();
  renderBettingCashAndMonthlyPanel();
  safeRenderBettingExtraPanels();
  startBettingCountdowns();
  renderBettingPerformancePanel();
  initializeBettingSoundControls();
  renderBettingAgenda();
}

function initializeBettingOperationalBalance() {
  const input = document.getElementById("bettingRealBalanceInput");
  const button = document.getElementById("saveBettingBalanceButton");
  const workCashInput = document.getElementById("bettingWorkCashInput");
  const workCashButton = document.getElementById("saveBettingWorkCashButton");

  syncBettingBalanceInput();

  if (workCashInput && document.activeElement !== workCashInput) {
    workCashInput.value = bettingManualWorkCash > 0
      ? bettingManualWorkCash.toFixed(2)
      : "";
  }

  if (button && !button.dataset.bound) {
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      const value = Number(String(input?.value || "0").replace(",", "."));

      if (!Number.isFinite(value) || value < 0) {
        showToast("Valor inválido", "Digite um saldo total válido.", "error");
        return;
      }

      const originalText = button.textContent || "Atualizar";

      try {
        button.disabled = true;
        button.textContent = "Salvando...";

        await updateUnifiedTotalBalance(value);

        showToast(
          "Saldo sincronizado",
          "Financeiro e caixa de trabalho foram atualizados.",
          "success"
        );
      } catch (error) {
        showToast("Erro", error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }

  if (workCashButton && !workCashButton.dataset.bound) {
    workCashButton.dataset.bound = "true";

    workCashButton.addEventListener("click", () => {
      const value = Number(String(workCashInput?.value || "0").replace(",", "."));

      if (!Number.isFinite(value) || value < 0) {
        showToast("Valor inválido", "Digite um caixa operacional válido.", "error");
        return;
      }

      bettingManualWorkCash = value;

      saveBettingManualWorkCash();
      renderBettingCashAndMonthlyPanel();

      if (workCashInput) {
        workCashInput.value = value > 0 ? value.toFixed(2) : "";
      }

      showToast(
        "Caixa atualizado",
        "Caixa operacional ajustado.",
        "success"
      );
    });
  }
}

let bettingOperationsFilter = 'all';
let currentPage = 1;
const transactionsPerPage = 10;

function pulseElement(target, className = "micro-pop") {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), 520);
}

function pulseCollection(selector, className = "micro-pop") {
  document.querySelectorAll(selector).forEach((element, index) => {
    setTimeout(() => pulseElement(element, className), index * 45);
  });
}
let currentDashboardData = null;
let goalsConfig = { finance_monthly_goal: 0 };


function getSectionMeta(section) {
  const sectionMap = {
    finance: {
      title: "Financeiro",
      description: "Controle ganhos, gastos, saldo real e metas mensais sem misturar as operações.",
    },
    betting: {
      title: "Apostas",
      description: "Central para surebets, freebets, missões, PA, cashout e performance operacional.",
    },
  };

  return sectionMap[section] || sectionMap.finance;
}

function switchSection(section) {
  const allowedSections = ["finance", "betting"];
  const targetSection = allowedSections.includes(section) ? section : "finance";
  activeSection = targetSection;

  document.querySelectorAll("[data-section-target]").forEach((element) => {
    const isActive = element.dataset.sectionTarget === targetSection;
    element.classList.toggle("active", isActive);
  });

  document.querySelectorAll(".module-section").forEach((sectionElement) => {
    const shouldShow = sectionElement.id === `section-${targetSection}`;
    sectionElement.classList.toggle("hidden", !shouldShow);
    sectionElement.classList.toggle("module-section-active", shouldShow);
  });

  const heading = document.getElementById("moduleHeading");
  const description = document.getElementById("moduleDescription");
  const meta = getSectionMeta(targetSection);

  if (heading) heading.textContent = meta.title;
  if (description) description.textContent = meta.description;

  const activePanel = document.getElementById(`section-${targetSection}`);
  pulseElement(activePanel, "section-activate");

  const openModalButton = document.getElementById("openModalButton");
  const toolbarPanel = document.querySelector(".toolbar-panel");
  const exportButton = document.getElementById("exportCsvButton");

  if (toolbarPanel) {
    toolbarPanel.classList.toggle("hidden", targetSection !== "finance");
  }

  if (openModalButton) {
    openModalButton.classList.toggle("hidden", targetSection !== "finance");
  }

  if (exportButton) {
    exportButton.classList.toggle("hidden", targetSection !== "finance");
  }

  const financeGoalsPanel = document.getElementById("financeGoalsPanel");
  if (financeGoalsPanel) {
    financeGoalsPanel.classList.toggle("hidden", targetSection !== "finance");
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) return "--";

  const normalizedValue = String(value).includes("T")
    ? value
    : `${value}T00:00`;

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function showToast(title, message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    setTimeout(() => {
      toast.remove();
    }, 220);
  }, 2600);
}

function triggerLogoFeedback(type = "neutral") {
  const wrap = document.getElementById("heroLogoWrap");
  if (!wrap) return;

  wrap.classList.remove("feedback-positive", "feedback-negative", "feedback-neutral");
  void wrap.offsetWidth;

  if (type === "positive") {
    wrap.classList.add("feedback-positive");
  } else if (type === "negative") {
    wrap.classList.add("feedback-negative");
  } else {
    wrap.classList.add("feedback-neutral");
  }

  setTimeout(() => {
    wrap.classList.remove("feedback-positive", "feedback-negative", "feedback-neutral");
  }, 850);
}

function triggerBalanceFeedback(type = "neutral") {
  const balanceCard = document.querySelector(".stat-card-featured");
  if (!balanceCard) return;

  balanceCard.classList.remove("feedback-positive", "feedback-negative", "feedback-neutral");
  void balanceCard.offsetWidth;

  if (type === "positive") {
    balanceCard.classList.add("feedback-positive");
  } else if (type === "negative") {
    balanceCard.classList.add("feedback-negative");
  } else {
    balanceCard.classList.add("feedback-neutral");
  }

  setTimeout(() => {
    balanceCard.classList.remove("feedback-positive", "feedback-negative", "feedback-neutral");
  }, 950);
}

function triggerBalanceValueFeedback(type = "neutral") {
  const value = document.getElementById("balanceValue");
  if (!value) return;

  value.classList.remove("feedback-positive", "feedback-negative", "feedback-neutral");
  void value.offsetWidth;

  if (type === "positive") {
    value.classList.add("feedback-positive");
  } else if (type === "negative") {
    value.classList.add("feedback-negative");
  } else {
    value.classList.add("feedback-neutral");
  }

  setTimeout(() => {
    value.classList.remove("feedback-positive", "feedback-negative", "feedback-neutral");
  }, 900);
}

function hideAppLoader() {
  const loader = document.getElementById("appLoader");
  if (!loader) return;
  loader.classList.add("hidden");
}

function showDashboardLoading() {
  document.getElementById("dashboardSkeleton")?.classList.remove("hidden");
  document.getElementById("dashboardContent")?.classList.add("hidden");
}

function hideDashboardLoading() {
  document.getElementById("dashboardSkeleton")?.classList.add("hidden");
  document.getElementById("dashboardContent")?.classList.remove("hidden");
}

function restartRevealAnimations() {
  document.querySelectorAll(".reveal-up").forEach((element, index) => {
    element.style.animation = "none";
    void element.offsetHeight;
    element.style.animation = "revealUp 0.42s ease both";
    element.style.animationDelay = `${Math.min(index * 0.03, 0.18)}s`;
  });
}

function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function getPreviousPeriod(month, year) {
  if (month === 1) {
    return { month: 12, year: year - 1 };
  }
  return { month: month - 1, year };
}

function populateFilters() {
  const monthFilter = document.getElementById("monthFilter");
  const yearFilter = document.getElementById("yearFilter");
  const current = getCurrentMonthYear();

  if (!monthFilter || !yearFilter) return;

  monthFilter.innerHTML = "";
  yearFilter.innerHTML = "";

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  monthNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = index + 1;
    option.textContent = name;

    if (index + 1 === current.month) {
      option.selected = true;
    }

    monthFilter.appendChild(option);
  });

  for (let year = current.year - 3; year <= current.year + 1; year += 1) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = String(year);

    if (year === current.year) {
      option.selected = true;
    }

    yearFilter.appendChild(option);
  }
}

function getSelectedPeriod() {
  return {
    month: Number(document.getElementById("monthFilter").value),
    year: Number(document.getElementById("yearFilter").value),
  };
}

function animateNumber(element, start, end, formatter, duration = 700) {
  const startTime = performance.now();

  function frame(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = start + (end - start) * eased;

    element.textContent = formatter(currentValue);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      element.textContent = formatter(end);
    }
  }

  requestAnimationFrame(frame);
}

function animateCurrencyValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;

  animateNumber(
    element,
    0,
    Number(value || 0),
    (current) => formatCurrency(current)
  );
}

function animateIntegerValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;

  animateNumber(
    element,
    0,
    Number(value || 0),
    (current) => Math.round(current).toString()
  );
}

function updateCards(data) {
  animateCurrencyValue("balanceValue", data.balance);
  animateCurrencyValue("incomeValue", data.total_income);
  animateCurrencyValue("expenseValue", data.total_expense);
  animateCurrencyValue("totalBalanceValue", data.total_balance);

  const totalBalanceBase = Number(
    data.total_balance_base ?? (Number(data.total_balance || 0) - Number(data.balance || 0))
  );

  const totalBalanceBaseValue = document.getElementById("totalBalanceBaseValue");
  if (totalBalanceBaseValue) {
    totalBalanceBaseValue.textContent = formatCurrency(totalBalanceBase);
  }

  const totalBalanceInput = document.getElementById("totalBalanceInput");
  if (totalBalanceInput && document.activeElement !== totalBalanceInput) {
    totalBalanceInput.value = totalBalanceBase.toFixed(2);
  }

  const statusElement = document.getElementById("statusValue");
  if (statusElement) {
    statusElement.textContent = data.transactions.length
      ? `${data.transactions.length} lançamentos`
      : "Sem lançamentos";
  }
}

async function saveTotalBalanceConfig(value) {
  const response = await fetch(`${API_BASE}/config/total-balance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      total_balance: value,
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível salvar o saldo total base.");
  }

  return response.json();
}

async function handleSaveTotalBalance() {
  const input = document.getElementById("totalBalanceInput");
  const hint = document.getElementById("totalBalanceHint");
  const button = document.getElementById("saveTotalBalanceButton");

  if (!input) return;

  const rawValue = String(input.value || "").replace(",", ".");
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value < 0) {
    showToast("Valor inválido", "Digite um saldo base válido.", "error");
    return;
  }

  const originalText = button?.textContent || "Salvar";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    await updateUnifiedTotalBalance(value);

    if (hint) {
      hint.textContent = "Saldo total atualizado.";
    }

    showToast("Saldo total salvo", "Saldo sincronizado com o caixa de trabalho.", "success");
  } catch (error) {
    showToast("Erro", error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function updateTitles(month, year) {
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const label = `${monthNames[month - 1]}/${year}`;
  document.getElementById("chartTitle").textContent = `Gastos por Categoria - ${label}`;
  document.getElementById("flowTitle").textContent = `Fluxo Diário - ${label}`;
  document.getElementById("tableTitle").textContent = `Transações - ${label}`;
}

function renderTransactions(transactions) {
  allTransactions = transactions;
  sanitizeSelections();
  applyTableFilters();
}

function sanitizeSelections() {
  const availableIds = new Set(allTransactions.map((transaction) => transaction.id));
  selectedTransactionIds = new Set(
    [...selectedTransactionIds].filter((id) => availableIds.has(id))
  );
}

function getFilteredTransactions() {
  const search = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const type = document.getElementById("typeFilter")?.value || "";
  const category = document.getElementById("categoryFilter")?.value.toLowerCase().trim() || "";

  return allTransactions.filter((transaction) => {
    const description = transaction.description.toLowerCase();
    const transactionCategory = (transaction.category || "outros").toLowerCase();

    const matchSearch = !search || description.includes(search);
    const matchType = !type || transaction.type === type;
    const matchCategory = !category || transactionCategory.includes(category);

    return matchSearch && matchType && matchCategory;
  });
}

function safeCategory(category) {
  return (category || "Outros").toLowerCase();
}



function getPaginatedTransactions(transactions) {
  const totalPages = Math.max(1, Math.ceil(transactions.length / transactionsPerPage));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * transactionsPerPage;
  return transactions.slice(startIndex, startIndex + transactionsPerPage);
}

function updatePaginationControls(totalItems) {
  const pagination = document.getElementById("transactionsPagination");
  const pageInfo = document.getElementById("pageInfo");
  const prevButton = document.getElementById("prevPageButton");
  const nextButton = document.getElementById("nextPageButton");

  if (!pagination || !pageInfo || !prevButton || !nextButton) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / transactionsPerPage));
  const shouldShow = totalItems > 0;

  pagination.classList.toggle("hidden", !shouldShow);
  pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  prevButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= totalPages;
}

function updateSelectionUI(filteredTransactions = null) {
  const bulkDeleteButton = document.getElementById("bulkDeleteButton");
  const selectionSummary = document.getElementById("selectionSummary");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const tablePanel = document.getElementById("transactions-section");
  const selectedCount = selectedTransactionIds.size;

  if (bulkDeleteButton) {
    bulkDeleteButton.disabled = selectedCount === 0;
  }

  if (selectionSummary && tablePanel) {
    if (selectedCount > 0) {
      selectionSummary.textContent = `${selectedCount} transaç${selectedCount === 1 ? "ão selecionada" : "ões selecionadas"}`;
      selectionSummary.classList.remove("hidden");
      tablePanel.classList.add("selection-mode");
    } else {
      selectionSummary.classList.add("hidden");
      tablePanel.classList.remove("selection-mode");
    }
  }

  if (!filteredTransactions) {
    filteredTransactions = getFilteredTransactions();
  }

  const visibleIds = getPaginatedTransactions(filteredTransactions).map((transaction) => transaction.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedTransactionIds.has(id));
  const someVisibleSelected =
    visibleIds.length > 0 && visibleIds.some((id) => selectedTransactionIds.has(id));

  if (selectAllCheckbox) {
    selectAllCheckbox.checked = allVisibleSelected;
    selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
  }
}

function renderEmptyState(isVisible) {
  const emptyState = document.getElementById("emptyState");
  const tableWrapper = document.getElementById("tableWrapper");
  const selectionSummary = document.getElementById("selectionSummary");
  const bulkDeleteButton = document.getElementById("bulkDeleteButton");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const pagination = document.getElementById("transactionsPagination");

  if (!emptyState || !tableWrapper) return;

  if (isVisible) {
    emptyState.classList.remove("hidden");
    tableWrapper.classList.add("hidden");
    pagination?.classList.add("hidden");
    selectionSummary?.classList.add("hidden");
    if (bulkDeleteButton) bulkDeleteButton.disabled = true;
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  } else {
    emptyState.classList.add("hidden");
    tableWrapper.classList.remove("hidden");
  }
}

function applyTableFilters() {
  const tbody = document.getElementById("transactionsBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const filtered = getFilteredTransactions();

  if (!filtered.length) {
    renderEmptyState(true);
    updateSelectionUI(filtered);
    return;
  }

  renderEmptyState(false);

  const paginatedTransactions = getPaginatedTransactions(filtered);

  paginatedTransactions.forEach((transaction) => {
    const row = document.createElement("tr");
    const typeClass = transaction.type === "income" ? "type-income" : "type-expense";
    const typeLabel = transaction.type === "income" ? "Entrada" : "Saída";
    const isChecked = selectedTransactionIds.has(transaction.id);
    const checkedAttr = isChecked ? "checked" : "";
    const selectedClass = isChecked ? "selected-row" : "";

    row.className = selectedClass;
    row.innerHTML = `
      <td class="checkbox-cell">
        <input class="row-checkbox" data-id="${transaction.id}" type="checkbox" ${checkedAttr} />
      </td>
      <td>${transaction.id}</td>
      <td class="${typeClass}">${typeLabel}</td>
      <td>${transaction.category}</td>
      <td>${transaction.description}</td>
      <td class="${typeClass}">${formatCurrency(transaction.amount)}</td>
      <td>${formatDate(transaction.transaction_date)}</td>
      <td class="action-cell">
        <button class="edit-button" data-id="${transaction.id}" type="button">Editar</button>
        <button class="danger-button single-delete-button" data-id="${transaction.id}" type="button">Excluir</button>
      </td>
    `;

    tbody.appendChild(row);
  });

  attachRowEvents();
  attachSelectionEvents(filtered);
  updateSelectionUI(filtered);
  updatePaginationControls(filtered.length);
}

function attachSelectionEvents(filteredTransactions) {
  document.querySelectorAll(".row-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = Number(checkbox.dataset.id);
      const row = checkbox.closest("tr");

      if (checkbox.checked) {
        selectedTransactionIds.add(id);
        row?.classList.add("selected-row");
      } else {
        selectedTransactionIds.delete(id);
        row?.classList.remove("selected-row");
      }

      updateSelectionUI(filteredTransactions);
    });
  });
}

function attachRowEvents() {
  document.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);
      const transaction = allTransactions.find((item) => item.id === id);

      if (!transaction) {
        showToast("Erro", "Transação não encontrada.", "error");
        return;
      }

      openEditModal(transaction);
    });
  });

  document.querySelectorAll(".single-delete-button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);

      if (!id || Number.isNaN(id)) {
        console.error("ID inválido:", button.dataset.id);
        showToast("Erro", "ID da transação inválido.", "error");
        return;
      }

      pendingDeleteMode = "single";
      pendingDeleteId = id;
      openDeleteModal();
    });
  });
}


function getChartColors() {
  return [
    "rgba(59, 130, 246, 0.90)",
    "rgba(139, 92, 246, 0.88)",
    "rgba(34, 197, 94, 0.86)",
    "rgba(245, 158, 11, 0.88)",
    "rgba(239, 68, 68, 0.86)",
    "rgba(6, 182, 212, 0.88)",
    "rgba(236, 72, 153, 0.86)",
    "rgba(99, 102, 241, 0.88)",
    "rgba(148, 163, 184, 0.86)",
    "rgba(249, 115, 22, 0.86)",
    "rgba(16, 185, 129, 0.86)",
    "rgba(168, 85, 247, 0.86)",
  ];
}

function getCategoryColors(breakdown) {
  const palette = getChartColors();
  return breakdown.map((_, index) => palette[index % palette.length]);
}

function getCategoryHoverColors(breakdown) {
  const palette = [
    "rgba(59, 130, 246, 1)",
    "rgba(139, 92, 246, 0.98)",
    "rgba(34, 197, 94, 0.96)",
    "rgba(245, 158, 11, 0.98)",
    "rgba(239, 68, 68, 0.96)",
    "rgba(6, 182, 212, 0.98)",
    "rgba(236, 72, 153, 0.96)",
    "rgba(99, 102, 241, 0.98)",
    "rgba(148, 163, 184, 0.96)",
    "rgba(249, 115, 22, 0.96)",
    "rgba(16, 185, 129, 0.96)",
    "rgba(168, 85, 247, 0.96)",
  ];
  return breakdown.map((_, index) => palette[index % palette.length]);
}

function renderCategoryChart(breakdown) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;

  if (categoryChart) {
    categoryChart.destroy();
  }

  if (!breakdown.length) {
    categoryChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Sem gastos"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["rgba(58, 134, 255, 0.18)"],
            borderColor: "rgba(8, 17, 33, 0.9)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            labels: {
              color: "#d8e7ff",
              padding: 18,
              font: {
                family: "Inter",
                size: 13,
              },
            },
          },
          tooltip: {
            enabled: false,
          },
        },
      },
    });
    return;
  }

  const labels = breakdown.map((item) => {
    const raw = String(item.category ?? "").trim();

    if (!raw || raw.toLowerCase() === "undefined") {
      return "Outros";
    }

    return raw;
  });

  const values = breakdown.map((item) => item.total);

  categoryChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderWidth: 1,
          borderColor: "rgba(8, 17, 33, 0.9)",
          backgroundColor: getCategoryColors(breakdown),
          hoverBackgroundColor: getCategoryHoverColors(breakdown),
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 650,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          labels: {
            color: "#d8e7ff",
            padding: 18,
            font: {
              family: "Inter",
              size: 13,
            },
            generateLabels(chart) {
              return Chart.defaults.plugins.legend.labels.generateLabels(chart);
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(8, 17, 33, 0.96)",
          borderColor: "rgba(58, 134, 255, 0.2)",
          borderWidth: 1,
          padding: 12,
          titleColor: "#f2f7ff",
          bodyColor: "#d7e6ff",
          callbacks: {
            label(context) {
              const label = context.label || "";
              const value = context.raw || 0;
              return `${label}: ${formatCurrency(value)}`;
            },
          },
        },
      },
    },
  });
}

function renderDailyFlowChart(dailyFlow) {

  const canvas = document.getElementById("dailyFlowChart");
  if (!canvas) return;

  if (dailyFlowChart) {
    dailyFlowChart.destroy();
  }

  if (!dailyFlow.length) {
    dailyFlowChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Sem dados"],
        datasets: [
          {
            label: "Ganhos",
            data: [0],
            backgroundColor: "rgba(0, 255, 156, 0.3)",
            borderColor: "rgba(0, 255, 156, 0.5)",
            borderWidth: 1,
            borderRadius: 8,
          },
          {
            label: "Gastos",
            data: [0],
            backgroundColor: "rgba(255, 95, 122, 0.3)",
            borderColor: "rgba(255, 95, 122, 0.5)",
            borderWidth: 1,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#d8e7ff",
              font: {
                family: "Inter",
                size: 13,
              },
            },
          },
          tooltip: {
            enabled: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#b9cfff",
            },
            grid: {
              color: "rgba(58, 134, 255, 0.08)",
            },
          },
          y: {
            ticks: {
              color: "#b9cfff",
              callback(value) {
                return formatCurrency(value);
              },
            },
            grid: {
              color: "rgba(58, 134, 255, 0.08)",
            },
          },
        },
      },
    });
    return;
  }

  const labels = dailyFlow.map((item) => `Dia ${item.day}`);
  const incomes = dailyFlow.map((item) => item.income);
  const expenses = dailyFlow.map((item) => item.expense);

  dailyFlowChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Ganhos",
          data: incomes,
          backgroundColor: "rgba(0, 255, 156, 0.75)",
          borderColor: "rgba(0, 255, 156, 1)",
          borderWidth: 1,
          borderRadius: 8,
        },
        {
          label: "Gastos",
          data: expenses,
          backgroundColor: "rgba(255, 95, 122, 0.75)",
          borderColor: "rgba(255, 95, 122, 1)",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 650,
        easing: "easeOutQuart",
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: "#d8e7ff",
            font: {
              family: "Inter",
              size: 13,
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(8, 17, 33, 0.96)",
          borderColor: "rgba(58, 134, 255, 0.2)",
          borderWidth: 1,
          padding: 12,
          titleColor: "#f2f7ff",
          bodyColor: "#d7e6ff",
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#b9cfff",
          },
          grid: {
            color: "rgba(58, 134, 255, 0.08)",
          },
        },
        y: {
          ticks: {
            color: "#b9cfff",
            callback(value) {
              return formatCurrency(value);
            },
          },
          grid: {
            color: "rgba(58, 134, 255, 0.08)",
          },
        },
      },
    },
  });
}

function renderSummary(summary) {
  const topCategoryElement = document.getElementById("topCategory");
  const totalTransactionsElement = document.getElementById("totalTransactions");
  const avgTicketElement = document.getElementById("avgTicket");
  const highestDayElement = document.getElementById("highestDay");

  if (!topCategoryElement || !totalTransactionsElement || !avgTicketElement || !highestDayElement) {
    return;
  }

  if (!summary) {
    topCategoryElement.textContent = "-";
    totalTransactionsElement.textContent = "0";
    avgTicketElement.textContent = formatCurrency(0);
    highestDayElement.textContent = "-";
    return;
  }

  topCategoryElement.textContent = summary.top_category || "-";
  highestDayElement.textContent = summary.highest_spend_day
    ? formatDate(summary.highest_spend_day)
    : "-";

  animateIntegerValue("totalTransactions", summary.total_transactions ?? 0);
  animateCurrencyValue("avgTicket", summary.avg_ticket || 0);

  const topCategoryCard = topCategoryElement.closest(".stat-card");
  if (topCategoryCard) {
    topCategoryCard.classList.toggle("highlight-card", Boolean(summary.top_category));
  }
}

function renderInsight(currentData, previousData) {
  const insightPanel = document.getElementById("insightPanel");
  const insightText = document.getElementById("insightText");

  if (!insightPanel || !insightText) {
    return;
  }

  const currentExpense = Number(currentData.total_expense || 0);
  const previousExpense = Number(previousData?.total_expense || 0);
  const topCategory = currentData.summary?.top_category;
  const avgTicket = Number(currentData.summary?.avg_ticket || 0);
  const highestDay = currentData.summary?.highest_spend_day
    ? formatDate(currentData.summary.highest_spend_day)
    : null;

  let message = "";

  if (!currentData.transactions.length) {
    message = "Ainda não há movimentações neste período. Assim que você registrar a primeira transação, o DashNOX começa a gerar insights automáticos por aqui.";
  } else if (previousExpense > 0) {
    const diff = currentExpense - previousExpense;
    const percent = Math.abs((diff / previousExpense) * 100).toFixed(1);

    if (diff > 0) {
      message = `Seus gastos subiram ${percent}% em relação ao mês anterior. ${
        topCategory ? `A categoria que mais pesou foi ${topCategory}. ` : ""
      }${highestDay ? `O pico de gasto aconteceu em ${highestDay}.` : ""}`;
    } else if (diff < 0) {
      message = `Boa. Seus gastos caíram ${percent}% em relação ao mês anterior. ${
        topCategory ? `Mesmo assim, ${topCategory} ainda foi a categoria mais pesada. ` : ""
      }${avgTicket > 0 ? `Seu ticket médio ficou em ${formatCurrency(avgTicket)}.` : ""}`;
    } else {
      message = `Seus gastos ficaram no mesmo nível do mês anterior. ${
        topCategory ? `A categoria dominante continua sendo ${topCategory}. ` : ""
      }${avgTicket > 0 ? `O ticket médio do mês está em ${formatCurrency(avgTicket)}.` : ""}`;
    }
  } else if (currentExpense > 0) {
    message = `Este período ainda não tem base anterior para comparação. ${
      topCategory ? `Por enquanto, a categoria com maior peso é ${topCategory}. ` : ""
    }${avgTicket > 0 ? `O ticket médio está em ${formatCurrency(avgTicket)}. ` : ""}${
      highestDay ? `Seu dia mais caro foi ${highestDay}.` : ""
    }`;
  } else {
    message = "Sem gastos registrados neste período. Quando as transações entrarem, o DashNOX passa a gerar insights automáticos por aqui.";
  }

  insightText.textContent = message;
  insightPanel.classList.remove("hidden");
}

async function fetchDashboard(month, year) {
  const response = await fetch(`${API_BASE}/dashboard?month=${month}&year=${year}`);

  if (!response.ok) {
    throw new Error("Não foi possível carregar o dashboard.");
  }

  return response.json();
}

async function downloadCsv() {
  const { month, year } = getSelectedPeriod();
  const button = document.getElementById("exportCsvButton");
  const originalText = button?.textContent || "Baixar extrato";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Baixando...";
    }

    const response = await fetch(`${API_BASE}/transactions/export?month=${month}&year=${year}`);

    if (!response.ok) {
      throw new Error("Não foi possível baixar o extrato.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `extrato-${year}-${String(month).padStart(2, "0")}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);

    triggerLogoFeedback("neutral");
    triggerBalanceFeedback("neutral");
    triggerBalanceValueFeedback("neutral");
    showToast("Extrato baixado", "O arquivo foi gerado com sucesso.", "success");
  } catch (error) {
    showToast("Erro", error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function loadDashboard(options = { showLoader: true }) {
  const { month, year } = getSelectedPeriod();
  const previousPeriod = getPreviousPeriod(month, year);
  currentPage = 1;

  if (options.showLoader) {
    showDashboardLoading();
  }

  try {
    const [currentData, previousData] = await Promise.all([
      fetchDashboard(month, year),
      fetchDashboard(previousPeriod.month, previousPeriod.year).catch(() => null),
    ]);

    currentDashboardData = currentData;
    updateCards(currentData);
    updateTitles(currentData.month, currentData.year);
    renderTransactions(currentData.transactions);
    renderSummary(currentData.summary);
    renderCategoryChart(currentData.category_breakdown);
    renderDailyFlowChart(currentData.daily_flow);
    renderInsight(currentData, previousData);
    renderGoalsProgress();
    renderBettingCashAndMonthlyPanel();
    bindBettingWorkCashControls();
    syncBettingBalanceInput();
    syncFinanceTotalBalanceInput();

    hideDashboardLoading();
    restartRevealAnimations();
  } catch (error) {
    hideDashboardLoading();
    showToast("Erro", error.message, "error");
  }
}

function resetFormState() {
  editingTransactionId = null;
  autoCategoryTouched = false;

  document.getElementById("transactionId").value = "";
  document.getElementById("modalTitle").textContent = "Nova Transação";
  document.getElementById("submitButton").textContent = "Salvar";
  document.getElementById("transactionForm").reset();
  document.getElementById("categoryHint").textContent = "A categoria pode ser sugerida automaticamente.";

  const { month, year } = getSelectedPeriod();
  const currentDay = new Date().getDate().toString().padStart(2, "0");
  const transactionDate = `${year}-${String(month).padStart(2, "0")}-${currentDay}`;
  document.getElementById("transaction_date").value = transactionDate;
}

function openModal() {
  resetFormState();
  document.getElementById("transactionModal").classList.remove("hidden");
}

function openEditModal(transaction) {
  editingTransactionId = transaction.id;
  autoCategoryTouched = true;

  document.getElementById("transactionId").value = transaction.id;
  document.getElementById("modalTitle").textContent = "Editar Transação";
  document.getElementById("submitButton").textContent = "Atualizar";

  document.getElementById("type").value = transaction.type;
  document.getElementById("amount").value = transaction.amount;
  document.getElementById("category").value = transaction.category;
  document.getElementById("transaction_date").value = transaction.transaction_date;
  document.getElementById("description").value = transaction.description;
  document.getElementById("notes").value = transaction.notes || "";
  document.getElementById("categoryHint").textContent = "Categoria carregada da transação.";

  document.getElementById("transactionModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("transactionModal").classList.add("hidden");
  document.getElementById("formMessage").textContent = "";
  document.getElementById("formMessage").className = "form-message";
  resetFormState();
}

function openDeleteModal() {
  const deleteModalTitle = document.getElementById("deleteModalTitle");
  const deleteConfirmText = document.getElementById("deleteConfirmText");

  if (pendingDeleteMode === "bulk") {
    const count = selectedTransactionIds.size;
    deleteModalTitle.textContent = "Excluir Transações";
    deleteConfirmText.textContent = `Tem certeza que deseja excluir ${count} transaç${count === 1 ? "ão selecionada" : "ões selecionadas"}? Essa ação não poderá ser desfeita.`;
  } else {
    deleteModalTitle.textContent = "Excluir Transação";
    deleteConfirmText.textContent = "Tem certeza que deseja excluir esta transação? Essa ação não poderá ser desfeita.";
  }

  document.getElementById("deleteConfirmModal").classList.remove("hidden");
}

function closeDeleteModal() {
  document.getElementById("deleteConfirmModal").classList.add("hidden");
  pendingDeleteId = null;
  pendingDeleteMode = "single";
}

async function confirmDelete() {
  if (pendingDeleteMode === "bulk") {
    await confirmBulkDelete();
    return;
  }

  if (pendingDeleteMode === "single" && (!pendingDeleteId || Number.isNaN(pendingDeleteId))) {
    showToast("Erro", "ID inválido para exclusão.", "error");
    closeDeleteModal();
    return;
  }

  if (pendingDeleteId === null) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/transactions/${pendingDeleteId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Não foi possível excluir a transação.");
    }

    selectedTransactionIds.delete(pendingDeleteId);

    await loadDashboard({ showLoader: false });
    closeDeleteModal();

    triggerLogoFeedback("negative");
    triggerBalanceFeedback("negative");
    triggerBalanceValueFeedback("negative");

    showToast("Transação excluída", "A transação foi removida com sucesso.", "success");
  } catch (error) {
    closeDeleteModal();
    showToast("Erro", error.message, "error");
  }
}

async function confirmBulkDelete() {
  const ids = [...selectedTransactionIds];

  if (!ids.length) {
    closeDeleteModal();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/transactions/bulk-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error("Não foi possível excluir as transações selecionadas.");
    }

    const data = await response.json();
    selectedTransactionIds.clear();

    await loadDashboard({ showLoader: false });
    closeDeleteModal();

    triggerLogoFeedback("negative");
    triggerBalanceFeedback("negative");
    triggerBalanceValueFeedback("negative");

    showToast(
      "Transações excluídas",
      `${data.deleted_count} transaç${data.deleted_count === 1 ? "ão foi removida" : "ões foram removidas"} com sucesso.`,
      "success"
    );
  } catch (error) {
    closeDeleteModal();
    showToast("Erro", error.message, "error");
  }
}

async function suggestCategory() {
  const description = document.getElementById("description").value.trim();
  const type = document.getElementById("type").value;
  const categoryInput = document.getElementById("category");
  const hint = document.getElementById("categoryHint");

  if (!description || autoCategoryTouched) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/suggest-category`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description,
        type,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    if (data.category) {
      categoryInput.value = data.category;
      hint.textContent = `Categoria sugerida automaticamente: ${data.category}`;
    }
  } catch {
    hint.textContent = "Não foi possível sugerir categoria agora.";
  }
}

async function submitTransaction(event) {
  event.preventDefault();

  const form = document.getElementById("transactionForm");
  const formData = new FormData(form);
  const message = document.getElementById("formMessage");

  const payload = {
    type: formData.get("type"),
    amount: Number(formData.get("amount")),
    category: formData.get("category"),
    description: formData.get("description"),
    transaction_date: formData.get("transaction_date"),
    notes: formData.get("notes") || "",
  };

  const isEditing = editingTransactionId !== null;
  const url = isEditing
    ? `${API_BASE}/transactions/${editingTransactionId}`
    : `${API_BASE}/transactions`;
  const method = isEditing ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        isEditing
          ? "Não foi possível atualizar a transação."
          : "Não foi possível salvar a transação."
      );
    }

    message.textContent = isEditing
      ? "Transação atualizada com sucesso."
      : "Transação salva com sucesso.";
    message.className = "form-message success";

    await loadDashboard({ showLoader: false });

    const pulseType = payload.type === "income" ? "positive" : "negative";

    showToast(
      isEditing ? "Transação atualizada" : "Transação criada",
      isEditing
        ? "As alterações foram salvas com sucesso."
        : "A nova transação foi adicionada ao dashboard.",
      "success"
    );

    setTimeout(() => {
      closeModal();

      setTimeout(() => {
        triggerLogoFeedback(pulseType);
        triggerBalanceFeedback(pulseType);
        triggerBalanceValueFeedback(pulseType);
      }, 180);
    }, 500);
  } catch (error) {
    message.textContent = error.message;
    message.className = "form-message error";
    showToast("Erro", error.message, "error");
  }
}

function handleSelectAllChange() {
  const filtered = getPaginatedTransactions(getFilteredTransactions());
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

  filtered.forEach((transaction) => {
    if (selectAllCheckbox.checked) {
      selectedTransactionIds.add(transaction.id);
    } else {
      selectedTransactionIds.delete(transaction.id);
    }
  });

  applyTableFilters();
}

function handleBulkDeleteClick() {
  if (selectedTransactionIds.size === 0) {
    return;
  }

  pendingDeleteMode = "bulk";
  openDeleteModal();
}


function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function setGoalCard(prefix, current, goal, unitLabel, emptyText) {
  const headline = document.getElementById(`${prefix}GoalHeadline`);
  const text = document.getElementById(`${prefix}GoalText`);
  const bar = document.getElementById(`${prefix}GoalBar`);
  const card = headline?.closest('.goal-progress-card');

  if (!headline || !text || !bar) return;

  card?.classList.remove('goal-state-empty', 'goal-state-stopped', 'goal-state-progress', 'goal-state-almost', 'goal-state-done');

  if (!goal || goal <= 0) {
    headline.textContent = 'Sem meta';
    text.textContent = emptyText;
    bar.style.width = '0%';
    card?.classList.add('goal-state-empty');
    return;
  }

  const percent = clampPercent((current / goal) * 100);
  const remaining = Math.max(goal - current, 0);

  const formatUnit = (value) => {
    if (unitLabel === 'reais') return formatCurrency(value);
    return `${value} ${unitLabel}`;
  };

  let status = 'No ritmo';
  let detail = '';

  if (current >= goal) {
    status = 'Meta batida';
    detail = `${formatUnit(current)} de ${formatUnit(goal)}. Excelente ritmo.`;
    card?.classList.add('goal-state-done');
  } else if (percent >= 70) {
    status = 'Quase lá';
    detail = `Faltam ${formatUnit(remaining)} para fechar a meta.`;
    card?.classList.add('goal-state-almost');
  } else if (percent > 0) {
    status = 'Em andamento';
    detail = `${percent.toFixed(0)}% concluído. Faltam ${formatUnit(remaining)}.`;
    card?.classList.add('goal-state-progress');
  } else {
    status = 'Parada';
    detail = `Ainda não começou. Faltam ${formatUnit(remaining)}.`;
    card?.classList.add('goal-state-stopped');
  }

  headline.textContent = `${status} · ${percent.toFixed(0)}%`;
  text.textContent = detail;
  bar.style.width = `${percent}%`;
}

function getSelectedGoalPeriodQuery() {
  const { month, year } = getSelectedPeriod();
  return `month=${month}&year=${year}`;
}

function renderGoalsInputs() {
  const financeInput = document.getElementById('financeGoalInput');

  if (financeInput && document.activeElement !== financeInput) {
    financeInput.value = Number(goalsConfig.finance_monthly_goal || 0);
  }
}

function renderGoalsProgress() {
  const financeCurrent = Number(currentDashboardData?.balance || 0);
  setGoalCard('finance', financeCurrent, Number(goalsConfig.finance_monthly_goal || 0), 'reais', 'Defina sua meta mensal para acompanhar o ritmo.');
}

async function loadGoals() {
  try {
    const response = await fetch(`${API_BASE}/goals?${getSelectedGoalPeriodQuery()}`);
    if (!response.ok) throw new Error('Não foi possível carregar a meta do mês.');
    const data = await response.json();
    goalsConfig = {
      finance_monthly_goal: Number(data?.finance_monthly_goal || 0),
    };
    renderGoalsInputs();
    renderGoalsProgress();
  } catch (error) {
    showToast('Erro', error.message, 'error');
  }
}

async function saveGoals() {
  const button = document.getElementById('saveGoalsButton');
  const originalText = button?.textContent || 'Salvar meta';
  const { month, year } = getSelectedPeriod();
  const payload = {
    month,
    year,
    finance_monthly_goal: Number(document.getElementById('financeGoalInput')?.value || 0),
  };

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }

    const response = await fetch(`${API_BASE}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Não foi possível salvar a meta do mês.');

    const data = await response.json();
    goalsConfig = {
      finance_monthly_goal: Number(data?.finance_monthly_goal || 0),
    };
    renderGoalsInputs();
    renderGoalsProgress();
    pulseCollection('.goal-progress-card', 'success-glow');
    showToast('Meta salva', 'A meta deste mês foi atualizada.', 'success');
  } catch (error) {
    showToast('Erro', error.message, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function loadBettingOperations() {
  try {
    const response = await fetch(`${API_BASE}/betting-operations`);
    if (!response.ok) throw new Error('Não foi possível carregar o módulo de apostas.');
    const data = await response.json();
    bettingOperations = Array.isArray(data.operations) ? data.operations : [];
    renderBettingModule();
    renderBettingAlerts();
    renderBettingAgenda();
  renderBettingAlerts();
  } catch (error) {
    showToast('Erro', error.message, 'error');
    bettingOperations = [];
    renderBettingModule();
  renderBettingAlerts();
  }
}

async function saveBettingOperation(payload) {
  const response = await fetch(`${API_BASE}/betting-operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Não foi possível salvar a operação.');
  }

  return response.json();
}

async function removeBettingOperation(id) {
  const response = await fetch(`${API_BASE}/betting-operations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Não foi possível excluir a operação.');
  }
}

async function removeAllBettingOperations() {
  const response = await fetch(`${API_BASE}/betting-operations`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Não foi possível limpar as operações.');
}


const BETTING_HOUSE_OPTIONS = ["BET365", "BETANO", "RIVALO", "SUPERBET", "BANDBET", "BETSUL", "GALERA BET", "ALFA BET", "VIVA SORTE", "F12", "CASADEAPOSTAS", "BETNACIONAL", "REI DO PITACO", "NOVIBET", "PINNACLE", "BETSSON", "ALFABET", "SPORTY", "BETFAIR", "BET7K", "PIXBET", "APOSTA TUDO", "VERABET", "DONALDBET", "SORTENABET", "APOSTAMAX", "RICOBET", "BATEUBET", "BETPONTOBET", "BETDASORTE", "BRXBET", "BULLSBET", "BETOUBET", "JOGADABET", "B1BET", "MMABET", "GERALBET", "KINGPANDA", "LIDERBET", "VBET", "7GAMES", "BETÃO", "R7", "SEUBET", "BRAVO", "H2BET", "MAXIMABET", "SEGUROBET", "ULTRA", "ESTRELA", "MCGAMES", "ESPORTIVA", "JOGO DE OURO", "BR4BET", "APOSTA1", "LOTOGREEN", "GOLDEBET", "MULTIBET", "VUP", "CASSINOPIX", "PAGOLBET", "BRBET", "BRASILDASORTE", "BLAZE", "JONBET", "BETVIP", "AFUNBET", "GANHEBET", "APOSTAGANHA", "LUCKYBET", "ONABET", "REALSBET", "ESPORTES365", "STARBET", "LUVA BET", "TIVOBET", "FAZ1BET", "IJOGO", "BETFAST", "BETPIX365", "VAIDEBET", "HIPERBET", "ESPORTE DASORTE", "MARIOS", "APOSTOU", "STAKE", "BETMGM", "KTO", "BETWARRIOR", "BOLSA", "BETBRA", "FULLTBET", "BETESPORTE", "LANCE DE SORTE", "BETBOO", "SPORTINGBET", "VIVASORTE", "GINGA BET", "4 PLAY"];


function normalizeBettingHouseName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function getFilteredHouseOptions(query) {
  const q = normalizeBettingHouseName(query);
  if (!q) return BETTING_HOUSE_OPTIONS.slice(0, 12);
  return BETTING_HOUSE_OPTIONS.filter((name) => normalizeBettingHouseName(name).includes(q)).slice(0, 14);
}

function closeAllHouseDropdowns(except = null) {
  document.querySelectorAll(".house-search-menu.open").forEach((menu) => {
    if (menu !== except) menu.classList.remove("open");
  });
}

function renderHouseSearchMenu(row, query = "") {
  const menu = row.querySelector(".house-search-menu");
  const input = row.querySelector(".betting-house-name");
  if (!menu || !input) return;

  const filteredOptions = getFilteredHouseOptions(query);
  const exactMatch = BETTING_HOUSE_OPTIONS.some(
    (name) => normalizeBettingHouseName(name) === normalizeBettingHouseName(query)
  );

  const items = filteredOptions.map((name) => `
    <button class="house-search-option" type="button" data-house="${name}">
      <span>${name}</span>
    </button>
  `);

  if (query.trim() && !exactMatch) {
    items.push(`
      <button class="house-search-option house-search-option-custom" type="button" data-house="${query.trim()}">
        <span>+ Adicionar "${query.trim()}"</span>
      </button>
    `);
  }

  if (!items.length) items.push(`<div class="house-search-empty">Nenhuma casa encontrada.</div>`);

  menu.innerHTML = items.join("");
  menu.classList.add("open");
  closeAllHouseDropdowns(menu);

  menu.querySelectorAll(".house-search-option").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.house || "";
      menu.classList.remove("open");
    });
  });
}

function bindHouseSearch(row) {
  const input = row.querySelector(".betting-house-name");
  const menu = row.querySelector(".house-search-menu");
  if (!input || !menu) return;

  input.addEventListener("focus", () => renderHouseSearchMenu(row, input.value));
  input.addEventListener("input", () => renderHouseSearchMenu(row, input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") menu.classList.remove("open");
    if (event.key === "Enter") {
      event.preventDefault();
      const first = menu.querySelector(".house-search-option");
      if (first) {
        input.value = first.dataset.house || input.value;
        menu.classList.remove("open");
      }
    }
  });
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".house-search-field")) closeAllHouseDropdowns();
});

function createBettingHouseRow(house = {}) {
  const row = document.createElement("div");
  row.className = "betting-house-row";
  const houseName = typeof house === "string" ? house : (house.name || "");

  row.innerHTML = `
    <div class="house-search-field">
      <input class="betting-house-name" type="text" maxlength="80" placeholder="Buscar casa..." value="${houseName}" autocomplete="off" />
      <div class="house-search-menu"></div>
    </div>
    <button class="icon-button betting-house-remove" type="button" title="Remover casa">✕</button>
  `;

  bindHouseSearch(row);
  row.querySelector(".betting-house-remove")?.addEventListener("click", () => {
    row.remove();
    ensureMinimumBettingHouseRows();
  });
  return row;
}

function ensureMinimumBettingHouseRows() {
  const list = document.getElementById("bettingHousesList");
  if (!list) return;
  while (list.querySelectorAll(".betting-house-row").length < 5) {
    list.appendChild(createBettingHouseRow());
  }
}

function ensureAtLeastOneBettingHouseRow() {
  ensureMinimumBettingHouseRows();
}

function resetBettingHouses(houses = []) {
  const list = document.getElementById("bettingHousesList");
  if (!list) return;
  list.innerHTML = "";

  const normalized = Array.isArray(houses)
    ? houses.map((h) => typeof h === "string" ? { name: h } : h).filter((h) => String(h?.name || "").trim())
    : [];

  normalized.forEach((h) => list.appendChild(createBettingHouseRow(h)));
  ensureMinimumBettingHouseRows();
}

function getBettingHousesFromForm() {
  return [...document.querySelectorAll("#bettingHousesList .betting-house-row")]
    .map((row) => ({ name: row.querySelector(".betting-house-name")?.value.trim() || "" }))
    .filter((house) => house.name);
}

function getPrimaryBettingHouse(houses = []) {
  return Array.isArray(houses) && houses.length ? houses[0].name || "" : "";
}

function formatBettingHousesLabel(operation) {
  const houses = Array.isArray(operation.houses) ? operation.houses : [];
  if (!houses.length) return operation.house || "Casa não informada";
  return houses.map((house) => house.name || "Casa").join(" · ");
}

function getBettingHousesTotalStake(operation) {
  return Number(operation.stake || 0);
}

function resetBettingForm() {
  const form = document.getElementById('bettingOperationForm');
  if (form) form.reset();
  const idInput = document.getElementById('bettingOperationId');
  if (idInput) idInput.value = '';
  const dateInput = document.getElementById('bettingDate');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  const freebetInput = document.getElementById('bettingFreebetValue');
  if (freebetInput) freebetInput.value = '';

  const gameInput = document.getElementById('bettingGame');
  if (gameInput) gameInput.value = '';

  const eventDateInput = document.getElementById('bettingEventDate');
  if (eventDateInput) eventDateInput.value = '';
  resetBettingHouses();

  const title = document.getElementById('bettingFormTitle');
  if (title) title.textContent = 'Nova operação';
}

function getBettingFormPayload() {
  return {
    id: document.getElementById('bettingOperationId')?.value || crypto.randomUUID(),
    type: document.getElementById('bettingOperationType')?.value || 'Surebet',
    houses: getBettingHousesFromForm(),
    house: getPrimaryBettingHouse(getBettingHousesFromForm()),
    market: document.getElementById('bettingMarket')?.value.trim() || '',
    game: document.getElementById('bettingGame')?.value.trim() || '',
    status: bettingOperations.find((item) => item.id === (document.getElementById('bettingOperationId')?.value || ''))?.status || 'Aberta',
    stake: Number(String(document.getElementById('bettingStake')?.value || '0').replace(',', '.')),
    freebet_value: Number(String(document.getElementById('bettingFreebetValue')?.value || '0').replace(',', '.')),
    mission_cost: Number(String(document.getElementById('bettingMissionCost')?.value || '0').replace(',', '.')),
    profit: Number(String(document.getElementById('bettingExpectedProfit')?.value || '0').replace(',', '.')),
    date: document.getElementById('bettingDate')?.value || new Date().toISOString().slice(0, 10),
    event_date: document.getElementById('bettingEventDate')?.value || '',
    notes: document.getElementById('bettingNotes')?.value.trim() || '',
  };
}


function isBettingOperationOpen(operation) {
  const status = String(operation?.status || '').trim().toLowerCase();
  return status !== 'finalizada' && status !== 'finalizado' && status !== 'fechada' && status !== 'fechado';
}


function getFilteredBettingOperations() {
  if (bettingOperationsFilter === 'open') {
    return bettingOperations.filter(isBettingOperationOpen);
  }

  if (bettingOperationsFilter === 'finished') {
    return bettingOperations.filter((operation) => !isBettingOperationOpen(operation));
  }

  return bettingOperations;
}



function renderBettingAlerts() {
  const container = document.getElementById('bettingAlertsList');
  if (!container) return;

  const alerts = [];
  const now = new Date();

  bettingOperations.forEach((operation) => {
    const operationName = operation.game || operation.market || 'Operação';

    const isOpen = isBettingOperationOpen(operation);

    if (!operation.event_date || String(operation.event_date).trim() === '') {
      alerts.push({
        title: 'Jogo sem data',
        description: `${operationName} está sem data definida.`,
        tag: 'DATA',
        danger: false,
      });
    }

    if (isOpen && operation.date) {
      const operationDate = new Date(operation.date);
      const diffMs = now - operationDate;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours >= 24) {
        alerts.push({
          title: 'Operação aberta há muito tempo',
          description: `${operationName} continua aberta há mais de 24h.`,
          tag: 'ABERTA',
          danger: true,
        });
      }
    }

    if (
      String(operation.type || '').toLowerCase() === 'freebet' &&
      Number(operation.freebet_value || 0) <= 0
    ) {
      alerts.push({
        title: 'Freebet sem valor',
        description: `${operationName} não possui valor de freebet informado.`,
        tag: 'FREEBET',
        danger: false,
      });
    }

    if (Number(operation.stake || 0) <= 0) {
      alerts.push({
        title: 'Valor investido ausente',
        description: `${operationName} está sem valor investido válido.`,
        tag: 'STAKE',
        danger: true,
      });
    }

    if (Number(operation.profit || 0) <= 0) {
      alerts.push({
        title: 'Lucro não informado',
        description: `${operationName} está sem lucro previsto/real.`,
        tag: 'LUCRO',
        danger: false,
      });
    }
  });

  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state">Nenhum alerta operacional.</div>';
    return;
  }

  container.innerHTML = alerts.map((alert) => `
    <div class="betting-alert-item ${alert.danger ? 'betting-alert-danger' : ''}">
      <div class="betting-alert-content">
        <span class="betting-alert-title">${alert.title}</span>
        <span class="betting-alert-description">${alert.description}</span>
      </div>

      <span class="betting-alert-tag">${alert.tag}</span>
    </div>
  `).join('');
}



function isBettingOperationFinished(operation) {
  return !isBettingOperationOpen(operation);
}

function getBettingReferenceDate(operation) {
  const rawDate = operation?.date || new Date().toISOString().slice(0, 10);
  return String(rawDate).slice(0, 10);
}

function isBettingOperationInSelectedPeriod(operation) {
  const { month, year } = getSelectedPeriod();
  const rawDate = getBettingReferenceDate(operation);
  const dateParts = rawDate.split("-");

  if (dateParts.length < 2) return false;

  return Number(dateParts[0]) === year && Number(dateParts[1]) === month;
}

function getBettingMonthlyStats() {
  const monthOperations = bettingOperations.filter(isBettingOperationInSelectedPeriod);
  const finishedMonthOperations = monthOperations.filter(isBettingOperationFinished);
  const openOperations = bettingOperations.filter(isBettingOperationOpen);

  const openCapital = openOperations.reduce((sum, item) => sum + getBettingHousesTotalStake(item), 0);
  const openCount = openOperations.length;

  const finishedStake = finishedMonthOperations.reduce((sum, item) => sum + getBettingHousesTotalStake(item), 0);
  const finishedProfit = finishedMonthOperations.reduce((sum, item) => sum + Number(item.profit || 0), 0);
  const finishedMissionCost = finishedMonthOperations.reduce((sum, item) => sum + Number(item.mission_cost || 0), 0);
  const finishedFreebet = finishedMonthOperations.reduce((sum, item) => sum + Number(item.freebet_value || 0), 0);
  const netProfit = finishedProfit - finishedMissionCost;
  const roi = finishedStake > 0 ? (netProfit / finishedStake) * 100 : 0;

  return {
    monthOperations,
    finishedMonthOperations,
    openOperations,
    openCapital,
    openCount,
    finishedStake,
    finishedProfit,
    finishedMissionCost,
    finishedFreebet,
    netProfit,
    roi,
  };
}


function bindBettingWorkCashControls() {
  const input = document.getElementById("bettingWorkCashInput");
  const button = document.getElementById("saveBettingWorkCashButton");

  if (input && document.activeElement !== input) {
    input.value = bettingManualWorkCash > 0 ? bettingManualWorkCash.toFixed(2) : "";
  }

  if (!button || button.dataset.forceBound === "true") return;

  button.dataset.forceBound = "true";

  button.addEventListener("click", () => {
    const rawValue = String(input?.value || "0").replace(",", ".");
    const value = Number(rawValue);

    if (!Number.isFinite(value) || value < 0) {
      showToast("Valor inválido", "Digite um caixa operacional válido.", "error");
      return;
    }

    bettingManualWorkCash = value;
    localStorage.setItem("dashnox_manual_work_cash", String(value));

    const workCashElement = document.getElementById("bettingWorkCashValue");
    if (workCashElement) {
      workCashElement.textContent = formatCurrency(value);
    }

    if (input) {
      input.value = value > 0 ? value.toFixed(2) : "";
    }

    renderBettingCashAndMonthlyPanel();

    showToast("Caixa atualizado", "Caixa operacional salvo.", "success");
  });
}


function renderBettingCashAndMonthlyPanel() {
  bindBettingWorkCashControls();
  const stats = getBettingMonthlyStats();
  const realBalance = Number(currentDashboardData?.total_balance_base || currentDashboardData?.total_balance || 0);

  bettingManualWorkCash = Number(
    localStorage.getItem("dashnox_manual_work_cash") ||
    bettingManualWorkCash ||
    0
  );

  const workCashBase = bettingManualWorkCash > 0
    ? bettingManualWorkCash
    : realBalance;

  const availableBalance = workCashBase - stats.openCapital;
  const suggestedWorkCash = workCashBase;

  const realBalanceElement = document.getElementById("bettingRealBalanceValue");
  const openCapitalElement = document.getElementById("bettingOpenCapitalValue");
  const availableElement = document.getElementById("bettingAvailableBalanceValue");
  const workCashElement = document.getElementById("bettingWorkCashValue");

  if (realBalanceElement) realBalanceElement.textContent = formatCurrency(realBalance);
  if (openCapitalElement) openCapitalElement.textContent = formatCurrency(stats.openCapital);
  if (availableElement) {
    availableElement.textContent = formatCurrency(availableBalance);
    availableElement.classList.toggle("negative", availableBalance < 0);
    availableElement.classList.toggle("positive", availableBalance >= 0);
  }
  if (workCashElement) workCashElement.textContent = formatCurrency(suggestedWorkCash);

  const workCashInput = document.getElementById("bettingWorkCashInput");
  if (workCashInput && document.activeElement !== workCashInput) {
    workCashInput.value = bettingManualWorkCash > 0 ? bettingManualWorkCash.toFixed(2) : "";
  }

  const monthProfitElement = document.getElementById("bettingMonthProfitValue");
  const monthMissionCostElement = document.getElementById("bettingMonthMissionCostValue");
  const monthFreebetElement = document.getElementById("bettingMonthFreebetValue");
  const monthRoiElement = document.getElementById("bettingMonthRoiValue");

  if (monthProfitElement) {
    monthProfitElement.textContent = formatCurrency(stats.netProfit);
    monthProfitElement.classList.toggle("negative", stats.netProfit < 0);
    monthProfitElement.classList.toggle("positive", stats.netProfit >= 0);
  }
  if (monthMissionCostElement) monthMissionCostElement.textContent = formatCurrency(stats.finishedMissionCost);
  if (monthFreebetElement) monthFreebetElement.textContent = formatCurrency(stats.finishedFreebet);
  if (monthRoiElement) monthRoiElement.textContent = `${stats.roi.toFixed(2)}%`;
}



function getBettingOperationTimestamp(operation) {
  if (!operation?.event_date) return Number.MAX_SAFE_INTEGER;

  const timestamp = new Date(operation.event_date).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getBettingOperationHousesText(operation) {
  const houses = Array.isArray(operation.houses)
    ? operation.houses.map((house) => house?.name || house).join(" ")
    : "";

  return `${houses} ${operation.house || ""}`.toLowerCase();
}

function filterBettingOperationsByHouse(operations) {
  const input = document.getElementById("bettingHouseFilter");
  const term = input?.value?.trim().toLowerCase() || "";

  if (!term) return operations;

  return operations.filter((operation) => (
    getBettingOperationHousesText(operation).includes(term)
  ));
}

function sortBettingOperationsByStatusAndGameDate(operations) {
  return [...operations].sort((a, b) => {
    const aOpen = isBettingOperationOpen(a);
    const bOpen = isBettingOperationOpen(b);

    if (aOpen !== bOpen) {
      return aOpen ? -1 : 1;
    }

    return getBettingOperationTimestamp(a) - getBettingOperationTimestamp(b);
  });
}

function getVisibleBettingOperations() {
  return sortBettingOperationsByStatusAndGameDate(
    filterBettingOperationsByHouse(getFilteredBettingOperations())
  );
}



function getStartOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getBettingEventDate(operation) {
  if (!operation?.event_date) return null;

  const date = new Date(operation.event_date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderAgendaList(element, operations) {
  if (!element) return;

  if (!operations.length) {
    element.innerHTML = '<div class="betting-agenda-empty">Sem jogos</div>';
    return;
  }

  element.innerHTML = operations.map((operation) => `
    <div class="betting-agenda-item">
      <strong>${operation.game || "Jogo não informado"}</strong>
      <span>${formatDateTime(operation.event_date)}</span>
      <small class="betting-countdown" data-countdown-date="${operation.event_date}">${formatCountdownFromDate(operation.event_date)}</small>
      <small>${formatBettingHousesLabel(operation)}</small>
    </div>
  `).join("");
}

function renderBettingAgenda() {
  const todayElement = document.getElementById("bettingAgendaToday");
  const tomorrowElement = document.getElementById("bettingAgendaTomorrow");
  const weekElement = document.getElementById("bettingAgendaWeek");

  if (!todayElement || !tomorrowElement || !weekElement) return;

  const todayStart = getStartOfDay();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const afterTomorrowStart = new Date(todayStart);
  afterTomorrowStart.setDate(afterTomorrowStart.getDate() + 2);

  const weekLimit = new Date(todayStart);
  weekLimit.setDate(weekLimit.getDate() + 7);

  const openOperations = bettingOperations
    .filter(isBettingOperationOpen)
    .map((operation) => ({
      operation,
      eventDate: getBettingEventDate(operation),
    }))
    .filter((item) => item.eventDate)
    .sort((a, b) => a.eventDate - b.eventDate);

  const todayOps = [];
  const tomorrowOps = [];
  const weekOps = [];

  openOperations.forEach(({ operation, eventDate }) => {
    if (eventDate >= todayStart && eventDate < tomorrowStart) {
      todayOps.push(operation);
    } else if (eventDate >= tomorrowStart && eventDate < afterTomorrowStart) {
      tomorrowOps.push(operation);
    } else if (eventDate >= todayStart && eventDate <= weekLimit) {
      weekOps.push(operation);
    }
  });

  renderAgendaList(todayElement, todayOps);
  renderAgendaList(tomorrowElement, tomorrowOps);
  renderAgendaList(weekElement, weekOps);
}




let bettingSoundEnabled = localStorage.getItem("dashnox_betting_sound_enabled") === "true";
let bettingSoundType = localStorage.getItem("dashnox_betting_sound_type") || "soft";
let bettingSoundVolume = Number(localStorage.getItem("dashnox_betting_sound_volume") || 35);

const bettingTriggeredAlerts = new Set();

function createBettingSound(type = "soft", volume = 0.35) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === "digital") {
      oscillator.type = "square";
      oscillator.frequency.value = 720;
    } else if (type === "radar") {
      oscillator.type = "triangle";
      oscillator.frequency.value = 520;
    } else {
      oscillator.type = "sine";
      oscillator.frequency.value = 420;
    }

    gainNode.gain.value = volume;

    oscillator.start();

    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 180);
  } catch (error) {
    console.error(error);
  }
}

function showBrowserNotification(title, body) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function triggerBettingAlert(operation, type) {
  if (!bettingSoundEnabled) return;

  const key = `${operation.id}_${type}`;

  if (bettingTriggeredAlerts.has(key)) return;

  bettingTriggeredAlerts.add(key);

  createBettingSound(
    bettingSoundType,
    bettingSoundVolume / 100
  );

  const gameName = operation.game || "Jogo";

  if (type === "15min") {
    showToast("Jogo próximo", `${gameName} começa em 15 minutos.`, "info");
    showBrowserNotification("DashNOX", `${gameName} começa em 15 minutos.`);
  }

  if (type === "start") {
    showToast("Jogo iniciado", `${gameName} começou agora.`, "success");
    showBrowserNotification("DashNOX", `${gameName} começou agora.`);
  }
}

function checkBettingGameAlerts() {
  const now = Date.now();

  bettingOperations
    .filter(isBettingOperationOpen)
    .forEach((operation) => {
      if (!operation.event_date) return;

      const gameTime = new Date(operation.event_date).getTime();

      if (Number.isNaN(gameTime)) return;

      const diffMinutes = (gameTime - now) / 60000;

      if (diffMinutes <= 15 && diffMinutes > 10) {
        triggerBettingAlert(operation, "15min");
      }

      if (diffMinutes <= 0 && diffMinutes > -5) {
        triggerBettingAlert(operation, "start");
      }
    });
}


function updateBettingSoundButtonState() {
  const enableButton = document.getElementById("enableBettingSoundButton");

  if (!enableButton) return;

  enableButton.textContent = bettingSoundEnabled
    ? "Alertas ativados"
    : "Alertas desativados";

  enableButton.classList.toggle("sound-enabled", bettingSoundEnabled);
  enableButton.classList.toggle("sound-disabled", !bettingSoundEnabled);
}

async function toggleBettingSoundAlerts() {
  bettingSoundEnabled = !bettingSoundEnabled;

  localStorage.setItem(
    "dashnox_betting_sound_enabled",
    String(bettingSoundEnabled)
  );

  if (bettingSoundEnabled && "Notification" in window && Notification.permission !== "granted") {
    await Notification.requestPermission();
  }

  updateBettingSoundButtonState();

  if (bettingSoundEnabled) {
    createBettingSound(bettingSoundType, bettingSoundVolume / 100);
  }

  showToast(
    "Alertas",
    bettingSoundEnabled
      ? "Alertas sonoros ativados."
      : "Alertas sonoros desativados.",
    bettingSoundEnabled ? "success" : "info"
  );
}

function bindBettingSoundControls() {
  const enableButton = document.getElementById("enableBettingSoundButton");
  const soundType = document.getElementById("bettingSoundType");
  const volumeInput = document.getElementById("bettingSoundVolume");
  const testButton = document.getElementById("testBettingSoundButton");

  updateBettingSoundButtonState();

  if (soundType && !soundType.dataset.bound) {
    soundType.dataset.bound = "true";
    soundType.value = bettingSoundType;

    soundType.addEventListener("change", () => {
      bettingSoundType = soundType.value;
      localStorage.setItem("dashnox_betting_sound_type", bettingSoundType);
    });
  }

  if (volumeInput && !volumeInput.dataset.bound) {
    volumeInput.dataset.bound = "true";
    volumeInput.value = bettingSoundVolume;

    volumeInput.addEventListener("input", () => {
      bettingSoundVolume = Number(volumeInput.value || 35);
      localStorage.setItem("dashnox_betting_sound_volume", String(bettingSoundVolume));
    });
  }

  if (enableButton && !enableButton.dataset.bound) {
    enableButton.dataset.bound = "true";
    enableButton.addEventListener("click", toggleBettingSoundAlerts);
  }

  if (testButton && !testButton.dataset.bound) {
    testButton.dataset.bound = "true";
    testButton.addEventListener("click", () => {
      createBettingSound(bettingSoundType, bettingSoundVolume / 100);
      showToast("Teste de som", "Som reproduzido.", "info");
    });
  }
}

function initializeBettingSoundControls() {
  bindBettingSoundControls();
  const enableButton = document.getElementById("enableBettingSoundButton");
  const soundType = document.getElementById("bettingSoundType");
  const volumeInput = document.getElementById("bettingSoundVolume");
  const testButton = document.getElementById("testBettingSoundButton");

  if (soundType) {
    soundType.value = bettingSoundType;
  }

  if (volumeInput) {
    volumeInput.value = bettingSoundVolume;
  }

  if (enableButton) {
    enableButton.textContent = bettingSoundEnabled
      ? "Alertas ativados"
      : "Ativar alertas";

    enableButton.onclick = async () => {
      bettingSoundEnabled = !bettingSoundEnabled;

      localStorage.setItem(
        "dashnox_betting_sound_enabled",
        String(bettingSoundEnabled)
      );

      if ("Notification" in window) {
        await Notification.requestPermission();
      }

      enableButton.textContent = bettingSoundEnabled
        ? "Alertas ativados"
        : "Ativar alertas";

      showToast(
        "Alertas",
        bettingSoundEnabled
          ? "Alertas sonoros ativados."
          : "Alertas sonoros desativados.",
        "info"
      );
    };
  }

  if (soundType) {
    soundType.onchange = () => {
      bettingSoundType = soundType.value;
      localStorage.setItem("dashnox_betting_sound_type", bettingSoundType);
    };
  }

  if (volumeInput) {
    volumeInput.oninput = () => {
      bettingSoundVolume = Number(volumeInput.value || 35);

      localStorage.setItem(
        "dashnox_betting_sound_volume",
        String(bettingSoundVolume)
      );
    };
  }

  if (testButton) {
    testButton.onclick = () => {
      createBettingSound(
        bettingSoundType,
        bettingSoundVolume / 100
      );
    };
  }
}

function switchBettingTab(tabName) {
  const targetTab = tabName || "overview";

  document.querySelectorAll("[data-betting-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.bettingTab === targetTab);
  });

  document.querySelectorAll("[data-betting-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.bettingPanel === targetTab);
  });

  if (targetTab === "agenda") {
    renderBettingAgenda();
  }

  if (targetTab === "alerts") {
    renderBettingAlerts();
    bindBettingSoundControls();
  }

  if (targetTab === "performance") {
    renderBettingPerformancePanel();
  }
}

function renderBettingPerformancePanel() {
  const stats = getBettingMonthlyStats();

  const profitElement = document.getElementById("bettingPerformanceProfitValue");
  const missionCostElement = document.getElementById("bettingPerformanceMissionCostValue");
  const freebetElement = document.getElementById("bettingPerformanceFreebetValue");
  const roiElement = document.getElementById("bettingPerformanceRoiValue");

  if (profitElement) {
    profitElement.textContent = formatCurrency(stats.netProfit);
    profitElement.classList.toggle("negative", stats.netProfit < 0);
    profitElement.classList.toggle("positive", stats.netProfit >= 0);
  }

  if (missionCostElement) missionCostElement.textContent = formatCurrency(stats.finishedMissionCost);
  if (freebetElement) freebetElement.textContent = formatCurrency(stats.finishedFreebet);
  if (roiElement) roiElement.textContent = `${stats.roi.toFixed(2)}%`;
}


let bettingCountdownIntervalId = null;

function safeRenderBettingExtraPanels() {
  try { renderBettingAgenda(); } catch (error) { console.warn("Agenda não renderizada:", error); }
  try { renderBettingAlerts(); } catch (error) { console.warn("Alertas não renderizados:", error); }
  try { renderBettingPerformancePanel(); } catch (error) { console.warn("Performance não renderizada:", error); }
  try { updateBettingTabBadges(); } catch (error) { console.warn("Badges não atualizadas:", error); }
}

function countBettingAlerts() {
  return bettingOperations.reduce((count, operation) => {
    const isOpen = isBettingOperationOpen(operation);
    let total = count;

    if (!operation.event_date || String(operation.event_date).trim() === "") total += 1;

    if (isOpen && operation.date) {
      const operationDate = new Date(operation.date);
      const diffHours = (Date.now() - operationDate.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 24) total += 1;
    }

    if (String(operation.type || "").toLowerCase() === "freebet" && Number(operation.freebet_value || 0) <= 0) total += 1;
    if (Number(operation.stake || 0) <= 0) total += 1;
    if (Number(operation.profit || 0) <= 0) total += 1;

    return total;
  }, 0);
}

function countAgendaOperations() {
  return bettingOperations.filter((operation) => (
    isBettingOperationOpen(operation) &&
    operation.event_date &&
    !Number.isNaN(new Date(operation.event_date).getTime())
  )).length;
}

function updateBettingTabBadges() {
  const operationsBadge = document.getElementById("bettingOperationsBadge");
  const agendaBadge = document.getElementById("bettingAgendaBadge");
  const alertsBadge = document.getElementById("bettingAlertsBadge");

  const openCount = bettingOperations.filter(isBettingOperationOpen).length;
  const agendaCount = countAgendaOperations();
  const alertCount = countBettingAlerts();

  if (operationsBadge) operationsBadge.textContent = String(openCount);
  if (agendaBadge) agendaBadge.textContent = String(agendaCount);
  if (alertsBadge) alertsBadge.textContent = String(alertCount);

  [operationsBadge, agendaBadge, alertsBadge].forEach((badge) => {
    if (!badge) return;
    badge.classList.toggle("tab-badge-empty", Number(badge.textContent || 0) === 0);
  });
}

function formatCountdownFromDate(dateValue) {
  if (!dateValue) return "";

  const target = new Date(dateValue).getTime();
  if (Number.isNaN(target)) return "";

  const diff = target - Date.now();
  const absDiff = Math.abs(diff);
  const totalMinutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (diff < 0) {
    if (totalMinutes < 60) return `começou há ${minutes}min`;
    return `começou há ${hours}h ${minutes}min`;
  }

  if (hours <= 0) return `começa em ${minutes}min`;
  return `começa em ${hours}h ${minutes}min`;
}

function updateBettingCountdowns() {
  document.querySelectorAll("[data-countdown-date]").forEach((element) => {
    element.textContent = formatCountdownFromDate(element.dataset.countdownDate);
  });
}

function startBettingCountdowns() {
  if (bettingCountdownIntervalId) return;
  updateBettingCountdowns();
  bettingCountdownIntervalId = setInterval(updateBettingCountdowns, 30000);
}

function renderBettingModule() {
  const list = document.getElementById('bettingOperationsList');
  const empty = document.getElementById('bettingOperationsEmpty');
  const statusSummary = document.getElementById('bettingStatusSummary');
  if (!list || !empty) return;

  const stats = getBettingMonthlyStats();
  const openBettingOperations = stats.openOperations;
  const totalStake = stats.openCapital;
  const totalMissionCost = stats.finishedMissionCost;
  const netProfit = stats.netProfit;
  const roi = stats.roi;

  const profitElement = document.getElementById('bettingProfitValue');
  if (profitElement) {
    profitElement.textContent = formatCurrency(netProfit);
    profitElement.classList.toggle('negative', netProfit < 0);
    profitElement.classList.toggle('positive', netProfit >= 0);
  }
  const stakeElement = document.getElementById('bettingStakeValue');
  if (stakeElement) stakeElement.textContent = formatCurrency(totalStake);
  const missionCostElement = document.getElementById('bettingMissionCostValue');
  if (missionCostElement) missionCostElement.textContent = formatCurrency(totalMissionCost);
  const roiElement = document.getElementById('bettingRoiValue');
  if (roiElement) roiElement.textContent = `${roi.toFixed(2)}%`;
  const countElement = document.getElementById('bettingCountValue');
  if (countElement) countElement.textContent = String(stats.openCount);
  if (statusSummary) statusSummary.textContent = bettingOperations.length ? `${stats.openCount} abertas · ${bettingOperations.length} total` : 'Sem operações';

  renderBettingCashAndMonthlyPanel();

  list.innerHTML = '';
  empty.classList.toggle('hidden', bettingOperations.length > 0);

  getVisibleBettingOperations()
    .forEach((operation) => {
      const itemMissionCost = Number(operation.mission_cost || 0);
      const itemStake = getBettingHousesTotalStake(operation);
      const itemNetProfit = Number(operation.profit || 0) - itemMissionCost;
      const roiItem = itemStake > 0 ? (itemNetProfit / itemStake) * 100 : 0;
      const eventDateLabel = operation.event_date ? `Jogo: ${formatDateTime(operation.event_date)}` : 'Jogo: sem data';
      const countdownLabel = operation.event_date ? `<span class="betting-countdown" data-countdown-date="${operation.event_date}">${formatCountdownFromDate(operation.event_date)}</span>` : '';
      const card = document.createElement('article');
      card.className = 'module-item-card betting-operation-card';
      card.innerHTML = `
        <div class="module-item-main">
          <div class="module-item-title-row">
            <strong>${operation.type} · ${formatBettingHousesLabel(operation)}</strong>
            <span class="module-placeholder-tag ${String(operation.status || '').toLowerCase() === 'finalizada' ? 'betting-status-finished' : 'betting-status-open'}">${String(operation.status || '').toLowerCase() === 'finalizada' ? 'Finalizada' : 'Aberta'}</span>
          </div>
          <p class="module-item-description">${operation.game || "Jogo não informado"} · ${operation.market} · Operação: ${formatDate(operation.date)} · ${eventDateLabel} ${countdownLabel}${operation.notes ? ` · ${operation.notes}` : ''}</p>
          <div class="betting-operation-metrics">
            <span>${isBettingOperationOpen(operation) ? 'Em aberto' : 'Investido'}: <strong>${formatCurrency(itemStake)}</strong></span>
            ${Number(operation.freebet_value || 0) > 0 ? `<span>Freebet: <strong class="positive">${formatCurrency(operation.freebet_value)}</strong></span>` : ''}
            <span>Custo missão: <strong class="negative">${formatCurrency(itemMissionCost)}</strong></span>
            <span>Lucro líquido: <strong class="${itemNetProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(itemNetProfit)}</strong></span>
            <span>ROI: <strong>${roiItem.toFixed(2)}%</strong></span>
          </div>
        </div>
        <div class="module-item-actions">
          <button class="secondary-button betting-toggle-button ${String(operation.status || '').toLowerCase() === 'finalizada' ? 'betting-toggle-on' : 'betting-toggle-off'}" type="button" data-id="${operation.id}">
            ${String(operation.status || '').toLowerCase() === 'finalizada' ? 'Finalizada' : 'Aberta'}
          </button>
          <button class="edit-button betting-edit-button" type="button" data-id="${operation.id}">Editar</button>
          <button class="danger-button betting-delete-button" type="button" data-id="${operation.id}">Excluir</button>
        </div>
      `;
      list.appendChild(card);
    });


  document.querySelectorAll('.betting-filter-button').forEach((button) => {
    button.addEventListener('click', () => {
      bettingOperationsFilter = button.dataset.filter || 'all';

      document.querySelectorAll('.betting-filter-button').forEach((item) => {
        item.classList.remove('active');
      });

      button.classList.add('active');
      renderBettingModule();
  renderBettingAlerts();
    });
  });


  document.querySelectorAll('.betting-toggle-button').forEach((button) => {
    button.addEventListener('click', () => toggleBettingOperationFinished(button.dataset.id));
  });

  document.querySelectorAll('.betting-edit-button').forEach((button) => {
    button.addEventListener('click', () => editBettingOperation(button.dataset.id));
  });
  document.querySelectorAll('.betting-delete-button').forEach((button) => {
    button.addEventListener('click', () => deleteBettingOperation(button.dataset.id));
  });
}

async function submitBettingOperation(event) {
  event.preventDefault();
  const payload = getBettingFormPayload();
  if (!payload.houses.length || !payload.game || !payload.market || !Number.isFinite(payload.stake) || !Number.isFinite(payload.mission_cost) || !Number.isFinite(payload.profit)) {
    showToast('Operação inválida', 'Preencha pelo menos uma casa, jogo, mercado, valor investido, custo da missão e lucro corretamente.', 'error');
    return;
  }

  try {
    const saved = await saveBettingOperation(payload);
    const existingIndex = bettingOperations.findIndex((item) => item.id === saved.id);
    if (existingIndex >= 0) bettingOperations[existingIndex] = saved;
    else bettingOperations.push(saved);

    renderBettingModule();
  renderBettingAlerts();
    resetBettingForm();
    pulseCollection('.betting-kpi-grid .stat-card', 'success-glow');
    showToast('Operação salva', 'Registro de apostas atualizado.', 'success');
  } catch (error) {
    showToast('Erro', error.message, 'error');
  }
}

function editBettingOperation(id) {
  const operation = bettingOperations.find((item) => item.id === id);
  if (!operation) return;
  document.getElementById('bettingOperationId').value = operation.id;
  document.getElementById('bettingOperationType').value = operation.type;
  resetBettingHouses(operation.houses || (operation.house ? [{ name: operation.house }] : []));
  document.getElementById('bettingMarket').value = operation.market;
  document.getElementById('bettingGame').value = operation.game || '';
  document.getElementById('bettingStake').value = Number(operation.stake || 0).toFixed(2);
  document.getElementById('bettingFreebetValue').value = Number(operation.freebet_value || 0).toFixed(2);
  document.getElementById('bettingMissionCost').value = Number(operation.mission_cost || 0).toFixed(2);
  document.getElementById('bettingExpectedProfit').value = Number(operation.profit || 0).toFixed(2);
  document.getElementById('bettingDate').value = operation.date;
  document.getElementById('bettingEventDate').value = operation.event_date ? String(operation.event_date).slice(0, 16) : '';
  document.getElementById('bettingNotes').value = operation.notes || '';
  const title = document.getElementById('bettingFormTitle');
  if (title) title.textContent = 'Editar operação';
  switchSection('betting');
}


async function toggleBettingOperationFinished(id) {
  const operation = bettingOperations.find((item) => item.id === id);
  if (!operation) return;

  const currentStatus = String(operation.status || '').trim().toLowerCase();
  const shouldFinish = currentStatus !== 'finalizada';

  const payload = {
    ...operation,
    status: shouldFinish ? 'Finalizada' : 'Aberta',
  };

  try {
    const saved = await saveBettingOperation(payload);
    const existingIndex = bettingOperations.findIndex((item) => item.id === saved.id);

    if (existingIndex >= 0) {
      bettingOperations[existingIndex] = saved;
    }

    renderBettingModule();
  renderBettingAlerts();
    await loadDashboard({ showLoader: false });
    showToast(
      shouldFinish ? 'Operação finalizada' : 'Operação reaberta',
      shouldFinish
        ? 'O lucro/prejuízo subiu para o Financeiro.'
        : 'O lançamento automático foi removido do Financeiro.',
      shouldFinish ? 'success' : 'info'
    );
  } catch (error) {
    showToast('Erro', error.message, 'error');
  }
}


async function deleteBettingOperation(id) {
  try {
    await removeBettingOperation(id);
    bettingOperations = bettingOperations.filter((item) => item.id !== id);
    renderBettingModule();
  renderBettingAlerts();
    await loadDashboard({ showLoader: false });
    showToast('Operação removida', 'Registro excluído do módulo de apostas.', 'info');
  } catch (error) {
    showToast('Erro', error.message, 'error');
  }
}

async function clearBettingOperations() {
  if (!bettingOperations.length) return;

  try {
    await removeAllBettingOperations();
    bettingOperations = [];
    renderBettingModule();
  renderBettingAlerts();
    resetBettingForm();
    showToast('Módulo limpo', 'Todas as operações foram removidas.', 'info');
  } catch (error) {
    showToast('Erro', error.message, 'error');
  }
}

function attachEvents() {
  bindBettingSoundControls();
  document.querySelectorAll("[data-betting-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      switchBettingTab(button.dataset.bettingTab || "overview");
    });
  });


  document.getElementById("bettingHouseFilter")?.addEventListener("input", () => {
    renderBettingModule();
    renderBettingAlerts();
  });


  document.getElementById("addBettingHouseButton")?.addEventListener("click", () => {
    const list = document.getElementById("bettingHousesList");
    if (list) list.appendChild(createBettingHouseRow());
  });

  ensureMinimumBettingHouseRows();
  bindBettingWorkCashControls();
  initializeBettingOperationalBalance();

  document.getElementById("openModalButton")?.addEventListener("click", openModal);
  document.getElementById("closeModalButton")?.addEventListener("click", closeModal);
  document.getElementById("cancelModalButton")?.addEventListener("click", closeModal);
  document.getElementById("transactionForm")?.addEventListener("submit", submitTransaction);

  document.getElementById("applyFilterButton")?.addEventListener("click", async () => {
    selectedTransactionIds.clear();
    currentPage = 1;
    await loadDashboard();
    await loadGoals();

    triggerLogoFeedback("neutral");
    triggerBalanceFeedback("neutral");
    triggerBalanceValueFeedback("neutral");

    showToast("Filtro aplicado", "O período selecionado foi carregado.", "info");
  });

  document.getElementById("exportCsvButton")?.addEventListener("click", downloadCsv);
  document.getElementById("saveTotalBalanceButton")?.addEventListener("click", handleSaveTotalBalance);
  document.getElementById("saveGoalsButton")?.addEventListener("click", saveGoals);

  document.getElementById("searchInput")?.addEventListener("input", () => {
    currentPage = 1;
    applyTableFilters();
  });
  document.getElementById("typeFilter")?.addEventListener("change", () => {
    currentPage = 1;
    applyTableFilters();
  });
  document.getElementById("categoryFilter")?.addEventListener("input", () => {
    currentPage = 1;
    applyTableFilters();
  });

  document.getElementById("selectAllCheckbox")?.addEventListener("change", handleSelectAllChange);
  document.getElementById("bulkDeleteButton")?.addEventListener("click", handleBulkDeleteClick);

  document.getElementById("prevPageButton")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      applyTableFilters();
    }
  });

  document.getElementById("nextPageButton")?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredTransactions().length / transactionsPerPage));
    if (currentPage < totalPages) {
      currentPage += 1;
      applyTableFilters();
    }
  });

  document.getElementById("confirmDeleteButton")?.addEventListener("click", confirmDelete);
  document.getElementById("cancelDeleteButton")?.addEventListener("click", closeDeleteModal);
  document.getElementById("closeDeleteModalButton")?.addEventListener("click", closeDeleteModal);

  document.getElementById("description")?.addEventListener("blur", suggestCategory);
  document.getElementById("type")?.addEventListener("change", () => {
    autoCategoryTouched = false;
    suggestCategory();
  });

  document.getElementById("category")?.addEventListener("input", () => {
    autoCategoryTouched = true;
    const hint = document.getElementById("categoryHint");
    if (hint) {
      hint.textContent = "Categoria definida manualmente.";
    }
  });

  document.getElementById("emptyStateButton")?.addEventListener("click", openModal);
  document.getElementById("bettingOperationForm")?.addEventListener("submit", submitBettingOperation);
  document.getElementById("resetBettingFormButton")?.addEventListener("click", resetBettingForm);
  document.getElementById("addBettingOperationButton")?.addEventListener("click", () => {
    resetBettingForm();
    document.getElementById("bettingOperationForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("clearBettingOperationsButton")?.addEventListener("click", clearBettingOperations);

  document.getElementById("transactionModal")?.addEventListener("click", (e) => {
    if (e.target.id === "transactionModal") {
      closeModal();
    }
  });

  document.getElementById("deleteConfirmModal")?.addEventListener("click", (e) => {
    if (e.target.id === "deleteConfirmModal") {
      closeDeleteModal();
    }
  });

  document.querySelectorAll("[data-section-target]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      const target = element.dataset.sectionTarget;
      switchSection(target);
    });
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  populateFilters();
  resetFormState();
  attachEvents();
  switchSection("finance");

  resetBettingForm();

  await Promise.all([loadDashboard({ showLoader: false }), loadGoals(), loadBettingOperations()]);
  switchSection("finance");

  setTimeout(() => {
    hideAppLoader();
  }, 700);
});

setInterval(checkBettingGameAlerts, 10000);