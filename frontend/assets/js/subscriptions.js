/* CutHub subscriptions.js */
window.CutHub = window.CutHub || {};

CutHub.subscriptionPlanSeeds = [
  { name: "Hub Start", price: 39.90, description: "Plano de entrada para clientes que cortam uma vez por mês.", monthly_limit: 1, included_services: "Corte", extra_discount_percent: 5, is_active: true },
  { name: "Hub Plus", price: 99.90, description: "Plano para cliente frequente, com até quatro cortes mensais.", monthly_limit: 4, included_services: "Corte, Acabamento", extra_discount_percent: 10, is_active: true },
  { name: "Hub Unlimited", price: 149.90, description: "Cortes sem limite mensal, acabamento incluso e prioridade de agendamento.", monthly_limit: 999, included_services: "Corte, Acabamento", extra_discount_percent: 15, is_active: true },
  { name: "Hub Elite", price: 189.90, description: "Plano premium com cabelo, barba, sobrancelha e acabamento inclusos.", monthly_limit: 999, included_services: "Corte, Barba, Sobrancelha, Acabamento", extra_discount_percent: 15, is_active: true },
];

CutHub.getPlanLimitLabel = function getPlanLimitLabel(plan) {
  const limit = Number(plan?.monthly_limit || 0);
  if (limit >= 999) return "Sem limite mensal";
  return `${limit} uso${limit === 1 ? "" : "s"} por mês`;
};

CutHub.getStatusLabel = function getStatusLabel(status) {
  const map = { active: "Ativa", overdue: "Atrasada", cancelled: "Cancelada", expired: "Expirada" };
  return map[String(status || "active")] || "Ativa";
};

CutHub.getCurrentClientRecord = function getCurrentClientRecord() {
  const user = CutHub.getCurrentUser?.();
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) return null;
  return (CutHub.state.clients || []).find((client) => String(client.email || "").trim().toLowerCase() === email) || null;
};

CutHub.getSubscriptionForClient = function getSubscriptionForClient(clientId) {
  return (CutHub.state.subscriptions || []).find((item) => {
    const sub = item.subscription || {};
    return Number(sub.client_id) === Number(clientId) && String(sub.status || "") === "active";
  }) || null;
};

CutHub.calculateSubscriptionStats = function calculateSubscriptionStats() {
  const details = CutHub.state.subscriptions || [];
  const active = details.filter((item) => String(item.subscription?.status || "") === "active");
  const mrr = active.reduce((sum, item) => sum + Number(item.plan?.price || 0), 0);
  const clientsCount = Math.max(1, (CutHub.state.clients || []).length);
  return { activeCount: active.length, mrr, adoption: Math.round((active.length / clientsCount) * 100) };
};

CutHub.planCardTemplate = function planCardTemplate(plan, mode = "admin", currentSubscription = null) {
  const isFeatured = plan.name === "Hub Plus";
  const isCurrentPlan = Number(currentSubscription?.plan?.id || 0) === Number(plan.id);
  const canSubscribe = mode === "client" && !isCurrentPlan;

  return `
    <article class="subscription-plan-card ${isFeatured ? "featured" : ""} ${isCurrentPlan ? "current" : ""}">
      <div class="subscription-plan-top">
        <div>
          <span class="panel-eyebrow">Plano mensal</span>
          <h3>${CutHub.safeText(plan.name)}</h3>
        </div>
        ${isFeatured ? `<span class="subscription-badge">Mais vendido</span>` : ""}
        ${isCurrentPlan ? `<span class="subscription-badge subscription-badge-current">Plano atual</span>` : ""}
      </div>
      <strong class="subscription-price">${CutHub.formatCurrency(plan.price)} <small>/mês</small></strong>
      <p class="module-switcher-description">${CutHub.safeText(plan.description)}</p>
      <ul class="subscription-benefits">
        <li>${CutHub.getPlanLimitLabel(plan)}</li>
        <li>Serviços inclusos: ${CutHub.safeText(plan.included_services || "Corte")}</li>
        <li>${Number(plan.extra_discount_percent || 0)}% OFF em extras</li>
      </ul>
      ${canSubscribe ? `<button class="primary-button subscription-subscribe-button" type="button" data-subscribe-plan="${plan.id}">Assinar plano</button>` : ""}
    </article>
  `;
};



CutHub.getOperationalServiceRevenue = function getOperationalServiceRevenue() {
  return (CutHub.state.appointments || [])
    .filter((appointment) => String(appointment.status || "").toLowerCase() === "completed")
    .reduce((sum, appointment) => {
      const service = CutHub.findById?.(CutHub.state.services || [], appointment.service_id)
        || (CutHub.state.services || []).find((item) => Number(item.id) === Number(appointment.service_id));

      return sum + Number(appointment.price || appointment.service_price || service?.price || 0);
    }, 0);
};

CutHub.getTopCompletedServiceName = function getTopCompletedServiceName() {
  const counter = {};

  (CutHub.state.appointments || [])
    .filter((appointment) => String(appointment.status || "").toLowerCase() === "completed")
    .forEach((appointment) => {
      const serviceId = Number(appointment.service_id || 0);
      if (!serviceId) return;
      counter[serviceId] = (counter[serviceId] || 0) + 1;
    });

  const topServiceId = Number(Object.entries(counter).sort((a, b) => b[1] - a[1])[0]?.[0] || 0);
  const service = CutHub.findById?.(CutHub.state.services || [], topServiceId)
    || (CutHub.state.services || []).find((item) => Number(item.id) === topServiceId);

  return service?.name || "Nenhum";
};

CutHub.getSubscriptionClientRankings = function getSubscriptionClientRankings(active = []) {
  return active.map((item) => {
    const sub = item.subscription || {};
    const plan = item.plan || {};
    const client = item.client || {};
    const impact = CutHub.calculateSubscriptionPlanImpact?.(client.id, plan, sub) || {
      estimatedSavings: 0,
      used: Number(sub.used_this_month || 0),
      engagement: "Baixo",
    };

    return {
      client,
      plan,
      sub,
      recurringRevenue: Number(plan.price || 0),
      savings: Number(impact.estimatedSavings || 0),
      usage: Number(impact.used || sub.used_this_month || 0),
      engagement: impact.engagement || "Baixo",
    };
  });
};

CutHub.getTopSubscriptionRankings = function getTopSubscriptionRankings(active = []) {
  const rows = CutHub.getSubscriptionClientRankings(active);

  return {
    byRevenue: rows.slice().sort((a, b) => b.recurringRevenue - a.recurringRevenue).slice(0, 5),
    bySavings: rows.slice().sort((a, b) => b.savings - a.savings).slice(0, 5),
    byUsage: rows.slice().sort((a, b) => b.usage - a.usage).slice(0, 5),
  };
};

CutHub.renderRankingRows = function renderRankingRows(items = [], mode = "revenue") {
  if (!items.length) {
    return `<div class="cuthub-empty-mini">Sem dados suficientes para ranking.</div>`;
  }

  return items.map((item, index) => {
    const value = mode === "savings"
      ? CutHub.formatCurrency(item.savings)
      : mode === "usage"
        ? `${item.usage} uso${item.usage === 1 ? "" : "s"}`
        : CutHub.formatCurrency(item.recurringRevenue);

    const detail = mode === "savings"
      ? `Economia estimada · ${CutHub.safeText(item.plan.name)}`
      : mode === "usage"
        ? `Engajamento ${CutHub.safeText(item.engagement)} · ${CutHub.safeText(item.plan.name)}`
        : `Receita recorrente · ${CutHub.safeText(item.plan.name)}`;

    return `
      <article class="subscription-ranking-row">
        <strong>${index + 1}. ${CutHub.safeText(item.client.name || "Cliente")}</strong>
        <span>${detail}</span>
        <em>${value}</em>
      </article>
    `;
  }).join("");
};

CutHub.calculateSubscriptionAnalytics = function calculateSubscriptionAnalytics() {
  const plans = CutHub.state.subscriptionPlans || [];
  const subscriptions = CutHub.state.subscriptions || [];
  const clients = CutHub.state.clients || [];

  const active = subscriptions.filter((item) => {
    const sub = item.subscription || {};
    return String(sub.status || "").toLowerCase() === "active";
  });

  const mrr = active.reduce((sum, item) => sum + Number(item.plan?.price || 0), 0);
  const clientsCount = clients.length;
  const adoptionRate = clientsCount ? (active.length / clientsCount) * 100 : 0;

  const byPlan = plans.map((plan) => {
    const count = active.filter((item) => Number(item.plan?.id) === Number(plan.id)).length;
    const revenue = count * Number(plan.price || 0);
    const share = active.length ? (count / active.length) * 100 : 0;
    return { plan, count, revenue, share };
  });

  const leader = byPlan.slice().sort((a, b) => b.count - a.count || b.revenue - a.revenue)[0] || null;
  const best = leader && leader.count > 0 ? leader : null;

  const insights = [];
  if (best) {
    insights.push(`${best.plan.name} lidera as assinaturas com ${best.count} cliente${best.count === 1 ? "" : "s"} ativo${best.count === 1 ? "" : "s"}.`);
    insights.push(`${best.plan.name} representa ${best.share.toFixed(1)}% da base assinante.`);
  } else {
    insights.push("Ainda não há plano líder porque nenhuma assinatura ativa foi registrada.");
  }

  if (active.length) {
    insights.push(`A receita recorrente prevista é de ${CutHub.formatCurrency(mrr)} por mês.`);
  }

  if (clientsCount) {
    insights.push(`${adoptionRate.toFixed(1)}% dos clientes cadastrados já aderiram a algum plano.`);
  }

  const serviceRevenue = CutHub.getOperationalServiceRevenue();
  const totalRevenue = mrr + serviceRevenue;
  const subscribers = active.length;
  const nonSubscribers = Math.max(0, clientsCount - subscribers);
  const ticketAverage = subscribers ? (mrr / subscribers) : 0;
  const topService = CutHub.getTopCompletedServiceName();
  const rankings = CutHub.getTopSubscriptionRankings(active);
  const recurringShare = totalRevenue ? (mrr / totalRevenue) * 100 : 0;

  if (totalRevenue) {
    insights.push(`A receita recorrente representa ${recurringShare.toFixed(1)}% do faturamento total estimado.`);
  }

  if (topService !== "Nenhum") {
    insights.push(`Serviço mais vendido entre atendimentos concluídos: ${topService}.`);
  }

  const negativeSavingsClients = rankings.bySavings.filter((item) => Number(item.savings || 0) < 0).length;
  if (negativeSavingsClients) {
    insights.push(`${negativeSavingsClients} assinante ainda está com economia negativa e pode precisar de incentivo para usar mais o plano.`);
  }

  return {
    activeCount: active.length,
    mrr,
    adoptionRate,
    byPlan,
    leaderName: best?.plan?.name || "Nenhum",
    insights,
    serviceRevenue,
    totalRevenue,
    subscribers,
    nonSubscribers,
    ticketAverage,
    topService,
    rankings,
    recurringShare,
  };
};

CutHub.renderSubscriptionAnalytics = function renderSubscriptionAnalytics() {
  const mount = document.getElementById("subscriptionAnalyticsPanel");
  if (!mount) return;

  const analytics = CutHub.calculateSubscriptionAnalytics();
  const totalSubscriptions = Math.max(analytics.activeCount, 1);

  mount.innerHTML = `
    <section class="subscription-analytics-grid">
      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Receita mensal prevista</span>
        <strong>${CutHub.formatCurrency(analytics.mrr)}</strong>
        <small>Baseada nas assinaturas ativas.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Plano líder</span>
        <strong>${CutHub.safeText(analytics.leaderName)}</strong>
        <small>Plano com mais clientes ativos.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Adoção dos clientes</span>
        <strong>${analytics.adoptionRate.toFixed(1)}%</strong>
        <small>Assinantes sobre clientes cadastrados.</small>
      </article>
    </section>

    <section class="subscription-operational-grid">
      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Receita operacional</span>
        <strong>${CutHub.formatCurrency(analytics.serviceRevenue)}</strong>
        <small>Atendimentos concluídos.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Receita total</span>
        <strong>${CutHub.formatCurrency(analytics.totalRevenue)}</strong>
        <small>Recorrência + serviços.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Serviço mais vendido</span>
        <strong>${CutHub.safeText(analytics.topService)}</strong>
        <small>Entre atendimentos concluídos.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Clientes assinantes</span>
        <strong>${analytics.subscribers}</strong>
        <small>Planos ativos.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Clientes sem plano</span>
        <strong>${analytics.nonSubscribers}</strong>
        <small>Potencial de conversão.</small>
      </article>

      <article class="subscription-analytics-card">
        <span class="panel-eyebrow">Ticket médio</span>
        <strong>${CutHub.formatCurrency(analytics.ticketAverage)}</strong>
        <small>Receita recorrente por assinante.</small>
      </article>
    </section>

    <section class="subscription-distribution-panel">
      <div class="panel-header compact">
        <div>
          <span class="panel-eyebrow">Distribuição por plano</span>
          <h3>Participação das assinaturas</h3>
        </div>
      </div>

      <div class="subscription-distribution-list">
        ${analytics.byPlan.map(({ plan, count, revenue, share }) => `
          <article class="subscription-distribution-row">
            <div>
              <strong>${CutHub.safeText(plan.name)}</strong>
              <span>${count} cliente${count === 1 ? "" : "s"} · ${CutHub.formatCurrency(revenue)}/mês</span>
            </div>
            <div class="subscription-distribution-meter">
              <span style="width: ${Math.max(0, Math.min(100, share))}%"></span>
            </div>
            <small>${analytics.activeCount ? share.toFixed(1) : "0.0"}%</small>
          </article>
        `).join("")}
      </div>
    </section>


    <section class="subscription-ranking-panel">
      <div class="panel-header compact">
        <div>
          <span class="panel-eyebrow">Ranking de clientes</span>
          <h3>Assinantes com maior impacto</h3>
        </div>
      </div>

      <div class="subscription-ranking-grid">
        <div>
          <h4>Receita recorrente</h4>
          ${CutHub.renderRankingRows(analytics.rankings.byRevenue, "revenue")}
        </div>

        <div>
          <h4>Economia gerada</h4>
          ${CutHub.renderRankingRows(analytics.rankings.bySavings, "savings")}
        </div>

        <div>
          <h4>Utilização</h4>
          ${CutHub.renderRankingRows(analytics.rankings.byUsage, "usage")}
        </div>
      </div>
    </section>

    <section class="subscription-insights-panel">
      <span class="panel-eyebrow">Insights automáticos</span>
      <ul>
        ${analytics.insights.map((item) => `<li>${CutHub.safeText(item)}</li>`).join("")}
      </ul>
    </section>
  `;
};

CutHub.renderSubscriptionPlans = function renderSubscriptionPlans() {
  const mount = document.getElementById("subscriptionPlansList");
  if (!mount) return;
  const plans = CutHub.state.subscriptionPlans || [];

  mount.innerHTML = plans.length
    ? plans.map((plan) => CutHub.planCardTemplate(plan, "admin")).join("")
    : `<div class="cuthub-empty-mini">Nenhum plano cadastrado.</div>`;
};

CutHub.renderClientPlans = function renderClientPlans() {
  const mount = document.getElementById("clientSubscriptionPlansList");
  if (!mount) return;

  const plans = (CutHub.state.subscriptionPlans || []).filter((plan) => plan.is_active !== false);
  const client = CutHub.getCurrentClientRecord();
  const currentSubscription = client ? CutHub.getSubscriptionForClient(client.id) : null;

  mount.innerHTML = plans.length
    ? plans.map((plan) => CutHub.planCardTemplate(plan, "client", currentSubscription)).join("")
    : `<div class="cuthub-empty-mini">Nenhum plano disponível no momento.</div>`;

  mount.querySelectorAll("[data-subscribe-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      await CutHub.subscribeToPlan(Number(button.dataset.subscribePlan));
    });
  });
};

CutHub.renderMySubscriptionBox = function renderMySubscriptionBox() {
  const mount = document.getElementById("mySubscriptionBox");
  if (!mount) return;

  const client = CutHub.getCurrentClientRecord();
  if (!client) {
    mount.innerHTML = `
      <div class="cuthub-empty-mini">
        Não encontramos um cadastro de cliente vinculado ao seu email. Atualize seu cadastro ou fale com a barbearia.
      </div>
    `;
    return;
  }

  const detail = CutHub.getSubscriptionForClient(client.id);
  if (!detail) {
    mount.innerHTML = `
      <article class="my-subscription-card">
        <span class="panel-eyebrow">Minha assinatura</span>
        <h3>Nenhum plano ativo</h3>
        <p class="module-switcher-description">Escolha um plano abaixo para liberar os benefícios mensais.</p>
      </article>
    `;
    return;
  }

  const sub = detail.subscription || {};
  const plan = detail.plan || {};
  const renewalDate = CutHub.getSubscriptionRenewalDate(sub.start_date);

  mount.innerHTML = `
    <article class="my-subscription-card active">
      <div>
        <span class="panel-eyebrow">Minha assinatura</span>
        <h3>${CutHub.safeText(plan.name)}</h3>
        <p class="module-switcher-description">${CutHub.safeText(plan.description)}</p>
      </div>

${CutHub.getSubscriptionUsageHtml(sub, plan)}

      <div class="subscription-row-meta">
        <span>Status: ${CutHub.getStatusLabel(sub.status)}</span>
        <span>${CutHub.formatCurrency(plan.price)}/mês</span>
        <span>Renovação: ${renewalDate}</span>
      </div>
    </article>
  `;
};


CutHub.getSubscriptionRenewalDate = function getSubscriptionRenewalDate(startDate = null) {
  const base = startDate ? new Date(`${String(startDate).slice(0, 10)}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + 1);
    return fallback.toLocaleDateString("pt-BR");
  }

  const today = new Date();
  const renewal = new Date(base);
  while (renewal <= today) {
    renewal.setMonth(renewal.getMonth() + 1);
  }
  return renewal.toLocaleDateString("pt-BR");
};

CutHub.getSubscriptionUsageHtml = function getSubscriptionUsageHtml(sub = {}, plan = {}) {
  const used = Number(sub.used_this_month || 0);
  const limit = Number(plan.monthly_limit || 0);
  const unlimited = limit >= 999;

  if (unlimited) {
    return `
      <div class="subscription-usage-block unlimited">
        <span class="panel-eyebrow">Atividade do mês</span>
        <strong>Plano ilimitado ativo</strong>
        <small>${used} atendimento${used === 1 ? "" : "s"} registrado${used === 1 ? "" : "s"} este mês</small>
      </div>
    `;
  }

  const progress = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  return `
    <div class="subscription-usage-block">
      <div class="subscription-usage-header">
        <strong>Utilização do mês</strong>
        <span>${used}/${limit}</span>
      </div>

      <div class="subscription-progress">
        <span style="width:${progress}%"></span>
      </div>

      <small>${progress}% utilizado</small>
    </div>
  `;
};


CutHub.getCurrentMonthRange = function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
  };
};

CutHub.getHaircutRecordDateISO = function getHaircutRecordDateISO(record = {}) {
  return String(record.cut_date || record.date || record.created_at || "").slice(0, 10);
};

CutHub.getServicePriceForRecord = function getServicePriceForRecord(record = {}) {
  const service = CutHub.findById?.(CutHub.state.services || [], record.service_id)
    || (CutHub.state.services || []).find((item) => Number(item.id) === Number(record.service_id));

  return Number(record.price || record.service_price || service?.price || 0);
};

CutHub.calculateSubscriptionPlanImpact = function calculateSubscriptionPlanImpact(clientId, plan = {}, sub = {}) {
  const { startISO, endISO } = CutHub.getCurrentMonthRange();
  const records = (CutHub.state.haircuts || []).filter((record) => {
    const dateISO = CutHub.getHaircutRecordDateISO(record);
    return Number(record.client_id) === Number(clientId)
      && dateISO >= startISO
      && dateISO <= endISO;
  });

  const servicesValue = records.reduce((sum, record) => sum + CutHub.getServicePriceForRecord(record), 0);
  const recurringValue = Number(plan.price || 0);
  const estimatedSavings = servicesValue - recurringValue;
  const used = Number(sub.used_this_month || records.length || 0);
  const limit = Number(plan.monthly_limit || 0);
  const utilization = limit >= 999 ? null : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  let engagement = "Baixo";
  if (limit >= 999) {
    engagement = used >= 4 ? "Alto" : used >= 2 ? "Médio" : "Baixo";
  } else if (utilization >= 75) {
    engagement = "Alto";
  } else if (utilization >= 40) {
    engagement = "Médio";
  }

  return {
    records,
    servicesValue,
    recurringValue,
    estimatedSavings,
    used,
    utilization,
    engagement,
  };
};


CutHub.getRenewalPrediction = function getRenewalPrediction(impact = {}) {
  const savings = Number(impact.estimatedSavings || 0);
  const utilization = impact.utilization;
  const used = Number(impact.used || 0);

  if (utilization === null) {
    if (used >= 4 || savings > 0) {
      return {
        label: "Alta chance",
        level: "high",
        reason: "Cliente usa bastante o plano ilimitado e já demonstra alto engajamento.",
      };
    }

    if (used >= 2) {
      return {
        label: "Média chance",
        level: "medium",
        reason: "Cliente já utilizou o plano, mas ainda pode aumentar a frequência de uso.",
      };
    }

    return {
      label: "Baixa chance",
      level: "low",
      reason: "Cliente usa pouco o plano ilimitado, o que pode reduzir a percepção de valor.",
    };
  }

  if (utilization >= 75 && savings >= 0) {
    return {
      label: "Alta chance",
      level: "high",
      reason: `Cliente utilizou ${utilization}% do plano e já está próximo ou acima do valor da mensalidade.`,
    };
  }

  if (utilization >= 40 || savings >= 0) {
    return {
      label: "Média chance",
      level: "medium",
      reason: `Cliente utilizou ${utilization}% do plano, mas ainda precisa consolidar mais valor percebido.`,
    };
  }

  return {
    label: "Baixa chance",
    level: "low",
    reason: `Cliente utilizou apenas ${utilization}% do plano e ainda está com economia estimada negativa.`,
  };
};

CutHub.getSubscriptionImpactHtml = function getSubscriptionImpactHtml(client = {}, plan = {}, sub = {}) {
  const impact = CutHub.calculateSubscriptionPlanImpact(client.id, plan, sub);
  const utilizationText = impact.utilization === null ? "Plano ilimitado" : `${impact.utilization}%`;

  return `
    <section class="subscription-impact-grid">
      <article>
        <span class="panel-eyebrow">Serviços realizados</span>
        <strong>${impact.records.length}</strong>
        <small>Histórico registrado no mês atual.</small>
      </article>

      <article>
        <span class="panel-eyebrow">Valor avulso equivalente</span>
        <strong>${CutHub.formatCurrency(impact.servicesValue)}</strong>
        <small>Soma dos serviços consumidos.</small>
      </article>

      <article>
        <span class="panel-eyebrow">Economia estimada</span>
        <strong>${CutHub.formatCurrency(impact.estimatedSavings)}</strong>
        <small>Comparação entre consumo avulso e mensalidade.</small>
      </article>

      <article>
        <span class="panel-eyebrow">Engajamento</span>
        <strong>${impact.engagement}</strong>
        <small>Utilização: ${utilizationText}.</small>
      </article>

      <article>
        <span class="panel-eyebrow">Previsão de renovação</span>
        <strong class="renewal-prediction-${CutHub.getRenewalPrediction(impact).level}">
          ${CutHub.getRenewalPrediction(impact).label}
        </strong>
        <small>${CutHub.safeText(CutHub.getRenewalPrediction(impact).reason)}</small>
      </article>
    </section>
  `;
};

CutHub.openSubscriptionDetailModal = function openSubscriptionDetailModal(detail = {}) {
  const sub = detail.subscription || {};
  const plan = detail.plan || {};
  const client = detail.client || {};
  const renewal = CutHub.getSubscriptionRenewalDate(sub.start_date);

  document.getElementById("subscriptionDetailModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "subscriptionDetailModal";
  modal.className = "modal subscription-detail-modal";

  modal.innerHTML = `
    <div class="modal-content moving-border subscription-detail-content">
      <div class="modal-header">
        <div>
          <span class="panel-eyebrow">Detalhes da assinatura</span>
          <h2>${CutHub.safeText(client.name || "Cliente")}</h2>
        </div>
        <button class="icon-button" type="button" data-close-subscription-detail>×</button>
      </div>

      <section class="subscription-detail-summary">
        <article>
          <span class="panel-eyebrow">Plano</span>
          <strong>${CutHub.safeText(plan.name || "Sem plano")}</strong>
          <small>${CutHub.formatCurrency(plan.price || 0)}/mês</small>
        </article>

        <article>
          <span class="panel-eyebrow">Status</span>
          <strong>${CutHub.getStatusLabel(sub.status)}</strong>
          <small>Início: ${CutHub.formatDate?.(sub.start_date) || sub.start_date || "-"}</small>
        </article>

        <article>
          <span class="panel-eyebrow">Renovação prevista</span>
          <strong>${renewal}</strong>
          <small>Projeção mensal do plano.</small>
        </article>
      </section>

      ${CutHub.getSubscriptionUsageHtml(sub, plan)}

      ${CutHub.getSubscriptionImpactHtml(client, plan, sub)}

      <section class="subscription-detail-notes">
        <span class="panel-eyebrow">Leitura analítica</span>
        <p>
          Este cliente contribui com ${CutHub.formatCurrency(plan.price || 0)} de receita recorrente mensal.
          A comparação entre consumo avulso, uso do plano e economia estimada ajuda a medir engajamento,
          valor percebido e potencial de retenção.
        </p>
      </section>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("[data-close-subscription-detail]")?.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });
};

CutHub.subscribeToPlan = async function subscribeToPlan(planId) {
  const client = CutHub.getCurrentClientRecord();
  if (!client) {
    CutHub.showToast("Assinatura", "Não encontramos seu cadastro de cliente.", "error");
    return;
  }

  const plan = (CutHub.state.subscriptionPlans || []).find((item) => Number(item.id) === Number(planId));
  if (!plan) {
    CutHub.showToast("Assinatura", "Plano não encontrado.", "error");
    return;
  }

  const confirmed = confirm(`Assinar o plano ${plan.name} por ${CutHub.formatCurrency(plan.price)}/mês?`);
  if (!confirmed) return;

  await CutHub.post("/subscriptions", {
    client_id: Number(client.id),
    plan_id: Number(plan.id),
    start_date: CutHub.todayISO(),
    end_date: null,
    status: "active",
    used_this_month: 0,
  });

  CutHub.showToast("Plano assinado", `Você assinou o ${plan.name}.`, "success");
  await CutHub.renderPlans();
};

CutHub.renderSubscriptionsList = function renderSubscriptionsList() {
  const mount = document.getElementById("subscriptionsList");
  if (!mount) return;
  const details = CutHub.state.subscriptions || [];

  mount.innerHTML = details.length ? details.map((item) => {
    const sub = item.subscription || {};
    const plan = item.plan || {};
    const client = item.client || {};
    return `
      <article class="subscription-row subscription-row-clickable" data-open-subscription-detail="${sub.id}">
        <div>
          <span class="panel-eyebrow">${CutHub.safeText(plan.name)}</span>
          <h3>${CutHub.safeText(client.name)}</h3>
          <div class="subscription-row-meta">
            <span>${CutHub.formatCurrency(plan.price)}/mês</span>
            <span>${CutHub.getPlanLimitLabel(plan)}</span>
            <span>${Number(sub.used_this_month || 0)} usados neste mês</span>
            <span>Início: ${CutHub.formatDate?.(sub.start_date) || sub.start_date}</span>
          </div>
        </div>
        <div class="subscription-row-actions">
          <span class="subscription-status ${CutHub.safeText(sub.status)}">${CutHub.getStatusLabel(sub.status)}</span>
          <button class="secondary-button ghost-button" type="button" data-delete-subscription="${sub.id}">Cancelar</button>
        </div>
      </article>
    `;
  }).join("") : `<div class="cuthub-empty-mini">Nenhum cliente assinante ainda.</div>`;

  mount.querySelectorAll("[data-open-subscription-detail]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const detail = details.find((item) => Number(item.subscription?.id) === Number(row.dataset.openSubscriptionDetail));
      if (detail) CutHub.openSubscriptionDetailModal(detail);
    });
  });

  mount.querySelectorAll("[data-delete-subscription]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Cancelar esta assinatura?")) return;
      await CutHub.del(`/subscriptions/${button.dataset.deleteSubscription}`);
      CutHub.showToast("Assinatura", "Assinatura cancelada/removida.", "success");
      await CutHub.renderSubscriptions();
    });
  });
};

CutHub.bindSubscriptionEvents = function bindSubscriptionEvents() {
  const seedButton = document.getElementById("seedSubscriptionPlansButton");
  if (seedButton && seedButton.dataset.bound !== "true") {
    seedButton.dataset.bound = "true";
    seedButton.addEventListener("click", async () => {
      const currentNames = new Set((CutHub.state.subscriptionPlans || []).map((plan) => String(plan.name || "").toLowerCase()));
      for (const plan of CutHub.subscriptionPlanSeeds) {
        if (!currentNames.has(plan.name.toLowerCase())) {
          await CutHub.post("/subscription-plans", plan);
        }
      }
      CutHub.showToast("Planos", "Planos padrão conferidos/restaurados.", "success");
      await CutHub.renderSubscriptions();
    });
  }
};

CutHub.renderSubscriptions = async function renderSubscriptions() {
  await CutHub.loadCoreData();
  const stats = CutHub.calculateSubscriptionStats();
  CutHub.setText("subscriptionMRR", CutHub.formatCurrency(stats.mrr));
  CutHub.setText("subscriptionActiveCount", String(stats.activeCount));
  CutHub.setText("subscriptionAdoptionRate", `${stats.adoption}%`);
  CutHub.renderSubscriptionAnalytics();
  CutHub.renderSubscriptionPlans();
  CutHub.renderSubscriptionsList();
  CutHub.bindSubscriptionEvents();
};

CutHub.renderPlans = async function renderPlans() {
  await CutHub.loadCoreData();
  CutHub.renderMySubscriptionBox();
  CutHub.renderClientPlans();
};