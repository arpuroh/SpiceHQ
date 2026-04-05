const app = document.getElementById("app");

const PIPELINE_STAGE_ORDER = [
  "intro_requested",
  "first_meeting",
  "follow_up",
  "dd",
  "soft_circled",
  "legal_docs",
];

const VIEW_LABELS = {
  dashboard: "HQ Home",
  fundraising: "Fundraising",
  tasks: "Tasks",
  relationships: "Relationships",
  portfolio: "Portfolio",
};

const state = {
  seed: null,
  view: "dashboard",
  search: "",
  selectedPipelineId: null,
  selectedRelationshipId: null,
  selectedPortfolioId: null,
};

function getNow() {
  return new Date(state.seed?.generatedAt || Date.now());
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value || 0);
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function number(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function dateLabel(value) {
  if (!value) {
    return "No date";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function dateTimeLabel(value) {
  if (!value) {
    return "No date";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function daysAway(value) {
  const now = getNow();
  const target = new Date(value);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSince(value) {
  const now = getNow();
  return Math.floor((now.getTime() - new Date(value).getTime()) / (1000 * 60 * 60 * 24));
}

function stageLabel(stage) {
  return String(stage || "").replaceAll("_", " ");
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function titleCase(text) {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compactList(items) {
  return items.filter(Boolean).join(", ");
}

function sortByDateAsc(items, key) {
  return [...items].sort((a, b) => new Date(a[key]) - new Date(b[key]));
}

function sortByDateDesc(items, key) {
  return [...items].sort((a, b) => new Date(b[key]) - new Date(a[key]));
}

function getCollections() {
  const seed = state.seed;
  return {
    workspace: seed.workspace,
    user: seed.users[0],
    fund: seed.funds[0],
    organizations: seed.organizations,
    contacts: seed.contacts,
    fundraisingPipeline: seed.fundraising_pipeline,
    portfolioCompanies: seed.portfolio_companies,
    tasks: seed.tasks,
    activities: seed.activities,
    googleLinks: seed.google_links,
    upcomingMoments: seed.upcoming_moments,
    integrations: seed.integrations,
  };
}

function priorityTone(priority) {
  if (priority === "urgent") {
    return "danger";
  }
  if (priority === "high") {
    return "warn";
  }
  if (priority === "medium") {
    return "brand";
  }
  return "";
}

function healthTone(health) {
  if (health === "needs_help") {
    return "danger";
  }
  if (health === "watch") {
    return "warn";
  }
  return "good";
}

function statusTone(status) {
  if (["at_risk", "drifting", "down"].includes(status)) {
    return "danger";
  }
  if (["upcoming", "active", "warm", "high", "up"].includes(status)) {
    return "warn";
  }
  if (["hot", "strong", "modeled", "scaffolded"].includes(status)) {
    return "good";
  }
  return "";
}

function linkMarkup(label, url) {
  if (!url) {
    return `<span class="link-muted">${escapeHtml(label)} unavailable</span>`;
  }
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function getTaskSubjectLabel(task) {
  if (task.subject_type === "pipeline") {
    const pipeline = getPipelineRecords().find((item) => item.id === task.subject_id);
    return pipeline ? pipeline.organization.name : "Fundraising";
  }
  if (task.subject_type === "portfolio") {
    const company = getPortfolioRecords().find((item) => item.id === task.subject_id);
    return company ? company.name : "Portfolio";
  }
  const relationship = getRelationshipRecords().find((item) => item.id === task.subject_id);
  return relationship ? relationship.name : "Relationship";
}

function getPipelineRecords() {
  const { fundraisingPipeline, organizations, contacts, tasks, activities, googleLinks } = getCollections();
  return fundraisingPipeline
    .map((pipeline) => {
      const organization = organizations.find((item) => item.id === pipeline.organization_id);
      const primaryContact = contacts.find((item) => item.id === pipeline.primary_contact_id);
      const pipelineTasks = sortByDateAsc(
        tasks.filter((item) => item.subject_type === "pipeline" && item.subject_id === pipeline.id),
        "due_at",
      );
      const pipelineActivities = sortByDateDesc(
        activities.filter((item) => item.subject_type === "pipeline" && item.subject_id === pipeline.id),
        "occurred_at",
      );
      const googleAssets = googleLinks.filter((item) => item.subject_type === "pipeline" && item.subject_id === pipeline.id);
      const overdueTasks = pipelineTasks.filter((item) => item.status !== "completed" && daysAway(item.due_at) < 0);
      const incompleteMaterials = pipeline.requested_materials?.length || 0;
      const readinessScore = Math.max(
        12,
        100 -
          overdueTasks.length * 20 -
          (pipeline.risk_flags?.length || 0) * 8 -
          (pipeline.materials_status?.includes("missing") ? 18 : 0) -
          (pipeline.materials_status?.includes("in_progress") ? 8 : 0),
      );
      return {
        ...pipeline,
        organization,
        primaryContact,
        tasks: pipelineTasks,
        activities: pipelineActivities,
        googleAssets,
        overdueTasks,
        lastTouchDays: daysSince(pipeline.last_touch_at),
        nextTouchDays: daysAway(pipeline.next_touch_at),
        readinessScore,
        incompleteMaterials,
        atRisk:
          overdueTasks.length > 0 ||
          daysSince(pipeline.last_touch_at) >= 7 ||
          daysAway(pipeline.next_internal_deadline_at) <= 1 ||
          (pipeline.risk_flags?.length || 0) >= 2,
      };
    })
    .sort((a, b) => PIPELINE_STAGE_ORDER.indexOf(a.stage) - PIPELINE_STAGE_ORDER.indexOf(b.stage));
}

function getRelationshipRecords() {
  const { organizations, contacts, tasks, activities } = getCollections();
  const pipelineRecords = getPipelineRecords();
  return organizations.map((organization) => {
    const orgContacts = contacts.filter((item) => item.organization_id === organization.id);
    const primaryContact = orgContacts[0] || null;
    const pipeline = pipelineRecords.find((item) => item.organization_id === organization.id) || null;
    const relationshipTasks = tasks.filter((item) => item.subject_type === "relationship" && item.subject_id === organization.id);
    const relatedActivities = sortByDateDesc(
      activities.filter((item) => item.subject_type === "relationship" && item.subject_id === organization.id),
      "occurred_at",
    );
    const openTaskCount =
      relationshipTasks.filter((item) => !["completed"].includes(item.status)).length +
      (pipeline?.tasks.filter((item) => item.status !== "completed").length || 0);
    return {
      ...organization,
      contacts: orgContacts,
      primaryContact,
      pipeline,
      activities: relatedActivities,
      openTaskCount,
      lastTouchDays: daysSince(organization.last_touch_at),
      nextTouchDays: daysAway(organization.next_touch_at),
    };
  });
}

function getPortfolioRecords() {
  const { portfolioCompanies, contacts, tasks, activities, googleLinks } = getCollections();
  return portfolioCompanies.map((company) => {
    const founders = company.founder_ids.map((id) => contacts.find((item) => item.id === id)).filter(Boolean);
    const companyTasks = sortByDateAsc(
      tasks.filter((item) => item.subject_type === "portfolio" && item.subject_id === company.id),
      "due_at",
    );
    const companyActivities = sortByDateDesc(
      activities.filter((item) => item.subject_type === "portfolio" && item.subject_id === company.id),
      "occurred_at",
    );
    const googleAssets = googleLinks.filter((item) => item.subject_type === "portfolio" && item.subject_id === company.id);
    const overdueTasks = companyTasks.filter((item) => item.status !== "completed" && daysAway(item.due_at) < 0);
    return {
      ...company,
      founders,
      tasks: companyTasks,
      activities: companyActivities,
      googleAssets,
      overdueTasks,
      lastTouchDays: daysSince(company.last_touch_at),
      nextTouchDays: daysAway(company.next_touch_at),
      boardDays: daysAway(company.board_meeting_at),
      supportLoad: (company.support_requests?.length || 0) + overdueTasks.length,
    };
  });
}

function getAllTasks() {
  return sortByDateAsc(getCollections().tasks, "due_at");
}

function getUpcomingMoments() {
  return sortByDateAsc(getCollections().upcomingMoments, "starts_at");
}

function getRecentActivity(limit = 8) {
  return sortByDateDesc(getCollections().activities, "occurred_at").slice(0, limit);
}

function getIntegrations() {
  return getCollections().integrations.providers;
}

function viewCount(view) {
  if (view === "fundraising") {
    return getPipelineRecords().filter((item) => item.atRisk).length;
  }
  if (view === "tasks") {
    return getAllTasks().filter((item) => item.status !== "completed" && item.status !== "waiting").length;
  }
  if (view === "relationships") {
    return getRelationshipRecords().filter((item) => item.relationship_status === "drifting" || item.lastTouchDays >= 7).length;
  }
  if (view === "portfolio") {
    return getPortfolioRecords().filter((item) => item.health !== "strong").length;
  }
  return dashboardSignals().missedItems.length;
}

function dashboardSignals() {
  const pipelineRecords = getPipelineRecords();
  const portfolioRecords = getPortfolioRecords();
  const openTasks = getAllTasks().filter((task) => task.status !== "completed");
  const overdueTasks = openTasks.filter((task) => task.status !== "waiting" && daysAway(task.due_at) < 0);
  const atRiskPipeline = pipelineRecords.filter((item) => item.atRisk);
  const portfolioFirelist = portfolioRecords.filter((item) => item.health !== "strong");
  const missedItems = [
    ...overdueTasks.map((task) => ({
      kind: "task",
      tone: priorityTone(task.priority) || "danger",
      label: "Missed task",
      title: task.title,
      detail: `${getTaskSubjectLabel(task)} · due ${dateTimeLabel(task.due_at)}`,
      subjectType: task.subject_type,
      subjectId: task.subject_id,
    })),
    ...atRiskPipeline.map((item) => ({
      kind: "pipeline",
      tone: "danger",
      label: `${item.lastTouchDays}d since touch`,
      title: item.organization.name,
      detail: item.best_next_action,
      subjectType: "pipeline",
      subjectId: item.id,
    })),
    ...portfolioFirelist
      .filter((item) => item.health === "needs_help")
      .map((item) => ({
        kind: "portfolio",
        tone: "warn",
        label: item.health.replaceAll("_", " "),
        title: item.name,
        detail: item.best_next_action,
        subjectType: "portfolio",
        subjectId: item.id,
      })),
  ].slice(0, 8);

  return {
    openTasks,
    overdueTasks,
    atRiskPipeline,
    portfolioFirelist,
    missedItems,
  };
}

function filteredPipelineRecords() {
  const query = state.search.trim().toLowerCase();
  return getPipelineRecords().filter((item) => {
    if (!query) {
      return true;
    }
    return [
      item.organization.name,
      item.primaryContact?.first_name,
      item.primaryContact?.last_name,
      item.summary,
      item.best_next_action,
      item.sector_interest,
      compactList(item.risk_flags || []),
      compactList(item.requested_materials || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function filteredRelationshipRecords() {
  const query = state.search.trim().toLowerCase();
  return getRelationshipRecords().filter((item) => {
    if (!query) {
      return true;
    }
    return [
      item.name,
      item.primaryContact?.first_name,
      item.primaryContact?.last_name,
      item.primaryContact?.title,
      item.notes,
      item.pipeline?.best_next_action,
      item.sector_focus,
      compactList(item.tags || []),
      compactList(item.warm_paths || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function filteredPortfolioRecords() {
  const query = state.search.trim().toLowerCase();
  return getPortfolioRecords().filter((item) => {
    if (!query) {
      return true;
    }
    return [
      item.name,
      item.sector,
      item.summary,
      item.best_next_action,
      item.key_support_context,
      compactList(item.key_risks || []),
      compactList(item.support_requests || []),
      ...item.founders.map((founder) => `${founder.first_name} ${founder.last_name}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function setDefaults() {
  const pipelines = getPipelineRecords();
  const relationships = getRelationshipRecords();
  const portfolio = getPortfolioRecords();
  if (!state.selectedPipelineId) {
    state.selectedPipelineId = pipelines[0]?.id || null;
  }
  if (!state.selectedRelationshipId) {
    state.selectedRelationshipId = relationships[0]?.id || null;
  }
  if (!state.selectedPortfolioId) {
    state.selectedPortfolioId = portfolio[0]?.id || null;
  }
}

function render() {
  setDefaults();
  const { workspace, user, fund } = getCollections();
  const dashboard = dashboardSignals();
  const upcoming72h = getUpcomingMoments().filter((item) => daysAway(item.starts_at) <= 3);
  const firstCloseDays = daysAway(fund.first_close_target);

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar panel">
        <div class="brand-lockup">
          <div class="eyebrow">Spice Capital</div>
          <h1>Spice HQ <span>V2.3</span></h1>
          <p>${escapeHtml(workspace.subtitle)}</p>
        </div>

        <div class="owner-card">
          <div class="tiny-label">Workspace Owner</div>
          <strong>${escapeHtml(user.full_name)}</strong>
          <div>${escapeHtml(fund.name)}</div>
          <div class="muted">${escapeHtml(dateLabel(state.seed.generatedAt))} snapshot</div>
          <div class="sidebar-highlight">
            <span class="pill ${firstCloseDays <= 60 ? "warn" : ""}">${firstCloseDays}d to first close</span>
            <span>${currency(fund.committed_total)} committed</span>
          </div>
        </div>

        <nav class="nav-stack">
          ${Object.entries(VIEW_LABELS)
            .map(
              ([key, label]) => `
                <button class="nav-button ${state.view === key ? "active" : ""}" data-view="${key}">
                  <span>${escapeHtml(label)}</span>
                  <span class="nav-count">${viewCount(key)}</span>
                </button>
              `,
            )
            .join("")}
        </nav>

        <div class="search-block">
          <div class="tiny-label">Global Search</div>
          <input id="search" class="search-input" type="search" placeholder="People, LPs, docs, support asks" value="${escapeHtml(state.search)}">
        </div>

        <div class="sidebar-section">
          <div class="section-title">Today’s Pressure</div>
          <div class="mini-stack">
            <div class="mini-card">
              <span class="metric">${dashboard.overdueTasks.length}</span>
              <div>Missed items already past due</div>
            </div>
            <div class="mini-card">
              <span class="metric">${dashboard.atRiskPipeline.length}</span>
              <div>Fundraising records at risk of drift or deadline failure</div>
            </div>
            <div class="mini-card">
              <span class="metric">${dashboard.portfolioFirelist.filter((item) => item.health === "needs_help").length}</span>
              <div>Portfolio companies needing direct help now</div>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">Next 72 Hours</div>
          <div class="mini-stack">
            ${upcoming72h
              .slice(0, 3)
              .map(
                (item) => `
                  <button class="mini-card panel-button" data-open-subject-type="${item.subject_type}" data-open-subject-id="${item.subject_id}">
                    <strong>${escapeHtml(item.title)}</strong>
                    <div class="muted">${escapeHtml(dateTimeLabel(item.starts_at))}</div>
                  </button>
                `,
              )
              .join("")}
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">Google Backbone</div>
          <div class="mini-stack">
            ${getIntegrations()
              .filter((item) => item.category === "google")
              .map(
                (item) => `
                  <div class="mini-card">
                    <div class="inline-top">
                      <strong>${escapeHtml(item.name)}</strong>
                      <span class="pill ${statusTone(item.status)}">${escapeHtml(item.status)}</span>
                    </div>
                    <div>${escapeHtml(item.sync_state)}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      </aside>

      <main class="main">
        ${renderView()}
      </main>

      <aside class="inspector panel">
        ${renderInspector()}
      </aside>
    </div>
  `;

  wireEvents();
}

function renderView() {
  if (state.view === "fundraising") {
    return renderFundraisingView();
  }
  if (state.view === "tasks") {
    return renderTasksView();
  }
  if (state.view === "relationships") {
    return renderRelationshipsView();
  }
  if (state.view === "portfolio") {
    return renderPortfolioView();
  }
  return renderDashboardView();
}

function renderDashboardView() {
  const { fund } = getCollections();
  const pipelineRecords = getPipelineRecords();
  const portfolioRecords = getPortfolioRecords();
  const integrations = getIntegrations();
  const { overdueTasks, missedItems } = dashboardSignals();
  const topActions = getAllTasks()
    .filter((task) => task.status !== "completed" && task.status !== "waiting")
    .sort((a, b) => {
      const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityRank[a.priority] - priorityRank[b.priority] || new Date(a.due_at) - new Date(b.due_at);
    })
    .slice(0, 6);
  const upcomingMoments = getUpcomingMoments().slice(0, 6);
  const supportQueue = portfolioRecords
    .filter((item) => item.health !== "strong" || item.support_level === "active")
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, active: 2 };
      return (rank[a.support_level] ?? 3) - (rank[b.support_level] ?? 3);
    })
    .slice(0, 4);

  return `
    <section class="hero panel">
      <div class="hero-copy">
        <div class="eyebrow">HQ Home</div>
        <h2>A command center for what could slip, stall, or need help next.</h2>
        <p>The app now treats fundraising, relationships, portfolio support, and Google-native execution as one operating surface instead of separate note piles.</p>
      </div>
      <div class="hero-band">
        <div class="hero-stat">
          <div class="tiny-label">Fund III Target</div>
          <strong>${currency(fund.target_size)}</strong>
        </div>
        <div class="hero-stat">
          <div class="tiny-label">Soft Circled</div>
          <strong>${currency(fund.soft_circled_total)}</strong>
        </div>
        <div class="hero-stat">
          <div class="tiny-label">Committed</div>
          <strong>${currency(fund.committed_total)}</strong>
        </div>
        <div class="hero-stat">
          <div class="tiny-label">First Close</div>
          <strong>${daysAway(fund.first_close_target)}d</strong>
        </div>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-panel panel">
        <div class="tiny-label">Conversion Stack</div>
        <strong>${pipelineRecords.filter((item) => ["dd", "soft_circled", "legal_docs"].includes(item.stage)).length}</strong>
        <p>Active LPs in diligence or later-stage conversion.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Missed Items</div>
        <strong>${missedItems.length}</strong>
        <p>Overdue tasks, stale LP motion, or portfolio support risks.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Support Queue</div>
        <strong>${portfolioRecords.filter((item) => item.support_level !== "active" || item.health !== "strong").length}</strong>
        <p>Companies where Spice should contribute more than passive tracking.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Scaffolded Integrations</div>
        <strong>${integrations.filter((item) => item.status !== "foundation_ready").length}</strong>
        <p>Google-first modules with future sync path already defined.</p>
      </article>
    </section>

    <section class="command-grid">
      <article class="panel focus-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Action Center</div>
            <div class="muted">The shortest path to unblocking real progress this week.</div>
          </div>
        </div>
        <div class="stack">
          ${topActions
            .map(
              (task) => `
                <button class="task-row panel-button" data-task-subject-type="${task.subject_type}" data-task-subject-id="${task.subject_id}">
                  <div class="inline-top">
                    <strong>${escapeHtml(task.title)}</strong>
                    <span class="pill ${priorityTone(task.priority)}">${escapeHtml(task.priority)}</span>
                  </div>
                  <div class="muted">${escapeHtml(getTaskSubjectLabel(task))}</div>
                  <div>${escapeHtml(task.description)}</div>
                  <div class="value-line">
                    <span>${escapeHtml(task.lane)}</span>
                    <span>${escapeHtml(dateTimeLabel(task.due_at))}</span>
                  </div>
                </button>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="panel focus-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Missed Or At Risk</div>
            <div class="muted">Exactly the queue the earlier prototype was still missing.</div>
          </div>
        </div>
        <div class="stack">
          ${missedItems
            .map(
              (item) => `
                <button class="signal-row panel-button" data-open-subject-type="${item.subjectType}" data-open-subject-id="${item.subjectId}">
                  <div class="inline-top">
                    <span class="pill ${item.tone}">${escapeHtml(item.label)}</span>
                    <span class="signal-kind">${escapeHtml(item.kind)}</span>
                  </div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <div>${escapeHtml(item.detail)}</div>
                </button>
              `,
            )
            .join("") || `<div class="empty-card">Nothing is slipping right now.</div>`}
        </div>
      </article>

      <article class="panel focus-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Upcoming Moments</div>
            <div class="muted">Meetings, board prep, and hard deadlines that shape the next few days.</div>
          </div>
        </div>
        <div class="stack">
          ${upcomingMoments
            .map(
              (item) => `
                <button class="activity-row panel-button" data-open-subject-type="${item.subject_type}" data-open-subject-id="${item.subject_id}">
                  <div class="inline-top">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="pill ${statusTone(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span>
                  </div>
                  <div class="muted">${escapeHtml(dateTimeLabel(item.starts_at))} · ${escapeHtml(item.channel)}</div>
                  <div>${escapeHtml(item.owner)}</div>
                </button>
              `,
            )
            .join("")}
        </div>
      </article>
    </section>

    <section class="content-grid">
      <article class="panel list-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Fundraising Heatmap</div>
            <div class="muted">Stage, readiness, and next action in one dense view.</div>
          </div>
        </div>
        <div class="stack">
          ${pipelineRecords
            .slice(0, 5)
            .map(
              (item) => `
                <button class="pipeline-snapshot panel-button" data-open-pipeline="${item.id}">
                  <div class="inline-top">
                    <strong>${escapeHtml(item.organization.name)}</strong>
                    <span class="pill ${item.atRisk ? "danger" : "good"}">${item.readinessScore}% ready</span>
                  </div>
                  <div class="muted">${escapeHtml(titleCase(stageLabel(item.stage)))} · ${currency(item.target_commitment)}</div>
                  <div>${escapeHtml(item.best_next_action)}</div>
                  <div class="value-line">
                    <span>${escapeHtml(item.primaryContact.first_name)} via ${escapeHtml(item.organization.preferred_channel)}</span>
                    <span>${escapeHtml(dateLabel(item.next_touch_at))}</span>
                  </div>
                </button>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="panel list-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Portfolio Support Queue</div>
            <div class="muted">Support requests and company context in operating terms.</div>
          </div>
        </div>
        <div class="stack">
          ${supportQueue
            .map(
              (item) => `
                <button class="support-card panel-button" data-open-portfolio="${item.id}">
                  <div class="inline-top">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="pill ${healthTone(item.health)}">${escapeHtml(item.support_level)}</span>
                  </div>
                  <div class="muted">${escapeHtml(item.stage)} · runway ${item.runway_months}m · board in ${item.boardDays}d</div>
                  <div>${escapeHtml(item.key_support_context)}</div>
                  <div class="support-list">${(item.support_requests || []).slice(0, 2).map((req) => `<span class="pill subtle">${escapeHtml(req)}</span>`).join("")}</div>
                </button>
              `,
            )
            .join("")}
        </div>
      </article>
    </section>

    <section class="content-grid">
      <article class="panel list-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Integration Hub</div>
            <div class="muted">Google-first scaffolding now has explicit states and next implementation steps.</div>
          </div>
        </div>
        <div class="integration-grid">
          ${integrations
            .map(
              (item) => `
                <div class="integration-card">
                  <div class="inline-top">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="pill ${statusTone(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span>
                  </div>
                  <div class="muted">${escapeHtml(item.coverage)}</div>
                  <div>${escapeHtml(item.sync_state)}</div>
                  <div class="tiny-note">${escapeHtml(item.next_step)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="panel list-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Recent Activity</div>
            <div class="muted">Still grounded in live threads, docs, and meeting moments.</div>
          </div>
        </div>
        <div class="stack">
          ${getRecentActivity()
            .map(
              (item) => `
                <div class="activity-row">
                  <div class="inline-top">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span class="pill">${escapeHtml(item.channel)}</span>
                  </div>
                  <div class="muted">${escapeHtml(dateTimeLabel(item.occurred_at))}</div>
                  <div>${escapeHtml(item.summary)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderFundraisingView() {
  const pipelineRecords = filteredPipelineRecords();
  const activeCapital = pipelineRecords.reduce((sum, item) => sum + item.target_commitment, 0);
  const lateStage = pipelineRecords.filter((item) => ["dd", "soft_circled", "legal_docs"].includes(item.stage));
  const atRisk = pipelineRecords.filter((item) => item.atRisk);

  return `
    <section class="panel section-hero">
      <div>
        <div class="eyebrow">Fundraising</div>
        <h2>Pipeline depth, decision pressure, and next actions on the same surface.</h2>
      </div>
      <div class="section-kicker">Readiness, material gaps, channel preference, and deadline pressure are visible without opening a separate CRM record.</div>
    </section>

    <section class="stats-grid">
      <article class="stat-panel panel">
        <div class="tiny-label">Active Pipeline</div>
        <strong>${currency(activeCapital)}</strong>
        <p>Total target commitments currently being worked.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Late-Stage LPs</div>
        <strong>${lateStage.length}</strong>
        <p>In diligence, soft circle, or legal.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">At Risk</div>
        <strong>${atRisk.length}</strong>
        <p>Stale motion, missed deadlines, or missing materials.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Due In 72h</div>
        <strong>${pipelineRecords.filter((item) => daysAway(item.next_internal_deadline_at) <= 3).length}</strong>
        <p>LP records with internal deadlines in the near window.</p>
      </article>
    </section>

    <section class="content-grid fundraising-layout">
      <article class="panel focus-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Fundraising Next Actions</div>
            <div class="muted">The queue that most directly affects close velocity.</div>
          </div>
        </div>
        <div class="stack">
          ${pipelineRecords
            .slice()
            .sort((a, b) => new Date(a.next_internal_deadline_at) - new Date(b.next_internal_deadline_at))
            .slice(0, 6)
            .map(
              (item) => `
                <button class="task-row panel-button" data-open-pipeline="${item.id}">
                  <div class="inline-top">
                    <strong>${escapeHtml(item.organization.name)}</strong>
                    <span class="pill ${item.atRisk ? "danger" : "good"}">${escapeHtml(titleCase(stageLabel(item.stage)))}</span>
                  </div>
                  <div>${escapeHtml(item.best_next_action)}</div>
                  <div class="value-line">
                    <span>${escapeHtml(item.materials_status.replaceAll("_", " "))}</span>
                    <span>${escapeHtml(dateTimeLabel(item.next_internal_deadline_at))}</span>
                  </div>
                </button>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="panel list-panel">
        <div class="block-header">
          <div>
            <div class="section-title">Pipeline Board</div>
            <div class="muted">Cards now show readiness, channel, and real blockers.</div>
          </div>
        </div>
        <div class="lane-grid">
          ${PIPELINE_STAGE_ORDER.map((stage) => {
            const laneItems = pipelineRecords.filter((item) => item.stage === stage);
            return `
              <article class="lane stage-lane">
                <div class="lane-header">
                  <div>
                    <strong>${escapeHtml(titleCase(stageLabel(stage)))}</strong>
                    <div class="muted">${laneItems.length} record${laneItems.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div class="stack">
                  ${laneItems
                    .map(
                      (item) => `
                        <button class="card-button ${state.selectedPipelineId === item.id ? "selected" : ""}" data-open-pipeline="${item.id}">
                          <div class="inline-top">
                            <strong>${escapeHtml(item.organization.name)}</strong>
                            <span class="pill ${item.atRisk ? "danger" : ""}">${item.readinessScore}%</span>
                          </div>
                          <div class="muted">${escapeHtml(item.primaryContact.first_name)} · ${escapeHtml(item.organization.preferred_channel)}</div>
                          <div class="value-line">
                            <span>${currency(item.target_commitment)}</span>
                            <span>${escapeHtml(dateLabel(item.next_touch_at))}</span>
                          </div>
                          <p>${escapeHtml(item.best_next_action)}</p>
                          <div class="support-list">
                            ${(item.risk_flags || []).slice(0, 2).map((flag) => `<span class="pill subtle">${escapeHtml(flag)}</span>`).join("")}
                          </div>
                        </button>
                      `,
                    )
                    .join("") || `<div class="empty-card">No records in this stage.</div>`}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderTasksView() {
  const tasks = getAllTasks().filter((item) => item.status !== "completed");
  const missed = tasks.filter((item) => item.status !== "waiting" && daysAway(item.due_at) < 0);
  const today = tasks.filter((item) => item.status !== "waiting" && daysAway(item.due_at) >= 0 && daysAway(item.due_at) <= 1);
  const thisWeek = tasks.filter((item) => item.status !== "waiting" && daysAway(item.due_at) >= 2 && daysAway(item.due_at) <= 7);
  const waiting = tasks.filter((item) => item.status === "waiting" || daysAway(item.due_at) > 7);

  return `
    <section class="panel section-hero">
      <div>
        <div class="eyebrow">Tasks</div>
        <h2>Missed items, immediate work, and waiting states in one operating queue.</h2>
      </div>
      <div class="section-kicker">The queue is now organized around dropped-ball prevention and near-term action instead of a flat task dump.</div>
    </section>

    <section class="stats-grid">
      <article class="stat-panel panel">
        <div class="tiny-label">Open</div>
        <strong>${tasks.filter((item) => item.status !== "waiting").length}</strong>
        <p>Tasks actively owned by Maya.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Missed</div>
        <strong>${missed.length}</strong>
        <p>Already overdue and should be surfaced aggressively.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Portfolio</div>
        <strong>${tasks.filter((item) => item.lane === "portfolio" && item.status !== "waiting").length}</strong>
        <p>Support work tied to active company needs.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Fundraising</div>
        <strong>${tasks.filter((item) => item.lane === "fundraising" && item.status !== "waiting").length}</strong>
        <p>LP conversion tasks in motion.</p>
      </article>
    </section>

    <section class="task-columns">
      ${renderTaskColumn("Missed", missed, "danger")}
      ${renderTaskColumn("Today / Tomorrow", today, "warn")}
      ${renderTaskColumn("This Week", thisWeek, "brand")}
      ${renderTaskColumn("Waiting / Later", waiting, "")}
    </section>
  `;
}

function renderTaskColumn(title, items, tone) {
  return `
    <article class="panel lane">
      <div class="lane-header">
        <strong>${escapeHtml(title)}</strong>
        <span class="pill ${tone}">${items.length}</span>
      </div>
      <div class="stack">
        ${items
          .map(
            (task) => `
              <button class="card-button" data-task-subject-type="${task.subject_type}" data-task-subject-id="${task.subject_id}">
                <div class="inline-top">
                  <strong>${escapeHtml(task.title)}</strong>
                  <span class="pill ${priorityTone(task.priority)}">${escapeHtml(task.priority)}</span>
                </div>
                <div class="muted">${escapeHtml(getTaskSubjectLabel(task))}</div>
                <div>${escapeHtml(task.description)}</div>
                <div class="value-line">
                  <span>${escapeHtml(task.lane)}</span>
                  <span>${escapeHtml(dateTimeLabel(task.due_at))}</span>
                </div>
              </button>
            `,
          )
          .join("") || `<div class="empty-card">Nothing here.</div>`}
      </div>
    </article>
  `;
}

function renderRelationshipsView() {
  const relationships = filteredRelationshipRecords();
  return `
    <section class="panel section-hero">
      <div>
        <div class="eyebrow">Relationships</div>
        <h2>Organizations and people modeled with channels, coverage, warmth, and real asks.</h2>
      </div>
      <div class="section-kicker">LinkedIn remains prominent, Google links stay first-class, and X / WhatsApp remain foundation-ready rather than hidden in notes.</div>
    </section>

    <section class="stats-grid">
      <article class="stat-panel panel">
        <div class="tiny-label">Priority Coverage</div>
        <strong>${relationships.filter((item) => item.coverage_tier === "priority").length}</strong>
        <p>LP relationships that need deliberate care right now.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Drifting</div>
        <strong>${relationships.filter((item) => item.relationship_status === "drifting" || item.lastTouchDays >= 7).length}</strong>
        <p>Relationships likely to cool unless touched soon.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">LinkedIn Coverage</div>
        <strong>${relationships.filter((item) => item.linkedin_url || item.primaryContact?.linkedin_url).length}</strong>
        <p>Orgs with visible LinkedIn presence in the model.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Warm Paths</div>
        <strong>${relationships.reduce((sum, item) => sum + (item.warm_paths?.length || 0), 0)}</strong>
        <p>Documented ways back into key relationships.</p>
      </article>
    </section>

    <section class="card-grid">
      ${relationships
        .map(
          (item) => `
            <button class="relationship-card ${state.selectedRelationshipId === item.id ? "selected" : ""}" data-open-relationship="${item.id}">
              <div class="inline-top">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="pill ${statusTone(item.relationship_status)}">${escapeHtml(item.relationship_status)}</span>
              </div>
              <div class="muted">${escapeHtml(item.primaryContact?.first_name || "")} ${escapeHtml(item.primaryContact?.last_name || "")} · ${escapeHtml(item.primaryContact?.title || "")}</div>
              <div class="detail-grid">
                <div>
                  <span class="tiny-label">Preferred</span>
                  <div>${escapeHtml(item.preferred_channel)}</div>
                </div>
                <div>
                  <span class="tiny-label">Coverage</span>
                  <div>${escapeHtml(item.coverage_tier)}</div>
                </div>
                <div>
                  <span class="tiny-label">Score</span>
                  <div>${item.relationship_score}</div>
                </div>
                <div>
                  <span class="tiny-label">Open Queue</span>
                  <div>${item.openTaskCount}</div>
                </div>
              </div>
              <div>${escapeHtml(item.next_real_ask)}</div>
              <div class="support-list">
                ${(item.channel_profiles || []).map((channel) => `<span class="pill subtle">${escapeHtml(channel.channel)}</span>`).join("")}
              </div>
              <div class="link-row">
                ${linkMarkup("LinkedIn", item.linkedin_url)}
                ${linkMarkup("Contact", item.primaryContact?.linkedin_url)}
                ${linkMarkup("Gmail", item.gmail_thread_url)}
              </div>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderPortfolioView() {
  const companies = filteredPortfolioRecords();
  return `
    <section class="panel section-hero">
      <div>
        <div class="eyebrow">Portfolio</div>
        <h2>Company detail with support context, not just ownership and stage.</h2>
      </div>
      <div class="section-kicker">Each company now carries founder sentiment, runway, support asks, risk stack, board timing, and Google links that future integrations can use.</div>
    </section>

    <section class="stats-grid">
      <article class="stat-panel panel">
        <div class="tiny-label">Direct Help Now</div>
        <strong>${companies.filter((item) => item.health === "needs_help").length}</strong>
        <p>Companies where Maya should intervene directly.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Watchlist</div>
        <strong>${companies.filter((item) => item.health === "watch").length}</strong>
        <p>Healthy enough to operate, but not healthy enough to ignore.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Support Requests</div>
        <strong>${companies.reduce((sum, item) => sum + (item.support_requests?.length || 0), 0)}</strong>
        <p>Explicit asks recorded across the portfolio.</p>
      </article>
      <article class="stat-panel panel">
        <div class="tiny-label">Boards In 14d</div>
        <strong>${companies.filter((item) => item.boardDays <= 14).length}</strong>
        <p>Companies where board prep is imminent.</p>
      </article>
    </section>

    <section class="portfolio-grid">
      ${companies
        .map(
          (company) => `
            <button class="portfolio-card ${state.selectedPortfolioId === company.id ? "selected" : ""}" data-open-portfolio="${company.id}">
              <div class="inline-top">
                <strong>${escapeHtml(company.name)}</strong>
                <span class="pill ${healthTone(company.health)}">${escapeHtml(company.health.replaceAll("_", " "))}</span>
              </div>
              <div class="muted">${escapeHtml(company.stage)} · ${escapeHtml(company.sector)}</div>
              <div class="detail-grid">
                <div>
                  <span class="tiny-label">Runway</span>
                  <div>${company.runway_months}m</div>
                </div>
                <div>
                  <span class="tiny-label">ARR</span>
                  <div>${currency(company.arr)}</div>
                </div>
                <div>
                  <span class="tiny-label">Growth QoQ</span>
                  <div>${percent(company.growth_qoq_pct)}</div>
                </div>
                <div>
                  <span class="tiny-label">Board</span>
                  <div>${company.boardDays}d</div>
                </div>
              </div>
              <div>${escapeHtml(company.key_support_context)}</div>
              <div class="support-list">
                ${(company.support_requests || []).slice(0, 3).map((req) => `<span class="pill subtle">${escapeHtml(req)}</span>`).join("")}
              </div>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderInspector() {
  if (state.view === "dashboard") {
    return renderDashboardInspector();
  }
  if (state.view === "portfolio") {
    return renderPortfolioInspector();
  }
  if (state.view === "relationships") {
    return renderRelationshipInspector();
  }
  if (state.view === "tasks") {
    return renderTaskInspector();
  }
  return renderPipelineInspector();
}

function renderDashboardInspector() {
  const fund = getCollections().fund;
  const integrations = getIntegrations();
  const routes = getCollections().integrations.routes;
  return `
    <div class="inspector-header">
      <div class="eyebrow">HQ Detail</div>
      <h3>Operating Posture</h3>
      <p>Spice HQ is now organized around missed-item prevention, fundraising execution, and portfolio support with integration scaffolding that can graduate into real sync later.</p>
    </div>

    <div class="info-card">
      <div class="info-grid">
        <div><span class="tiny-label">Target</span><strong>${currency(fund.target_size)}</strong></div>
        <div><span class="tiny-label">Soft Circled</span><strong>${currency(fund.soft_circled_total)}</strong></div>
        <div><span class="tiny-label">Committed</span><strong>${currency(fund.committed_total)}</strong></div>
        <div><span class="tiny-label">First Close</span><strong>${escapeHtml(dateLabel(fund.first_close_target))}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Integration Readiness</div>
      <div class="stack">
        ${integrations
          .map(
            (item) => `
              <div class="activity-row">
                <div class="inline-top">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="pill ${statusTone(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span>
                </div>
                <div>${escapeHtml(item.sync_state)}</div>
                <div class="muted">${escapeHtml(item.next_step)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Local Routes</div>
      <div class="record-list">
        ${routes.map((route) => `<div><span class="tiny-label">${escapeHtml(route.path)}</span><strong>${escapeHtml(route.purpose)}</strong></div>`).join("")}
      </div>
    </div>
  `;
}

function renderTaskInspector() {
  const tasks = getAllTasks().filter((item) => item.status !== "completed");
  const missed = tasks.filter((item) => item.status !== "waiting" && daysAway(item.due_at) < 0);
  const urgent = tasks.filter((item) => item.priority === "urgent" && item.status !== "waiting");
  return `
    <div class="inspector-header">
      <div class="eyebrow">Task Lens</div>
      <h3>Dropped-Ball Prevention</h3>
      <p>This queue is now explicitly split into missed, near-term, and waiting states so the app can surface operational failures instead of just listing todos.</p>
    </div>
    <div class="info-card">
      <div class="info-grid">
        <div><span class="tiny-label">Missed</span><strong>${missed.length}</strong></div>
        <div><span class="tiny-label">Urgent</span><strong>${urgent.length}</strong></div>
        <div><span class="tiny-label">Portfolio</span><strong>${tasks.filter((item) => item.lane === "portfolio").length}</strong></div>
        <div><span class="tiny-label">Fundraising</span><strong>${tasks.filter((item) => item.lane === "fundraising").length}</strong></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="section-title">Operating Rules</div>
      <ul class="inspector-list">
        <li>Anything overdue is treated as a missed item, not just an old task.</li>
        <li>Waiting items stay visible but no longer clutter the active queue.</li>
        <li>Every task still resolves back into a fundraising, relationship, or portfolio record.</li>
      </ul>
    </div>
  `;
}

function renderPipelineInspector() {
  const pipeline = getPipelineRecords().find((item) => item.id === state.selectedPipelineId) || getPipelineRecords()[0];
  if (!pipeline) {
    return `<div class="empty-card">No pipeline selected.</div>`;
  }

  return `
    <div class="inspector-header">
      <div class="eyebrow">Fundraising Detail</div>
      <h3>${escapeHtml(pipeline.organization.name)}</h3>
      <p>${escapeHtml(pipeline.summary)}</p>
    </div>

    <div class="info-card">
      <div class="info-grid">
        <div><span class="tiny-label">Stage</span><strong>${escapeHtml(titleCase(stageLabel(pipeline.stage)))}</strong></div>
        <div><span class="tiny-label">Probability</span><strong>${pipeline.probability_score}</strong></div>
        <div><span class="tiny-label">Target</span><strong>${currency(pipeline.target_commitment)}</strong></div>
        <div><span class="tiny-label">Readiness</span><strong>${pipeline.readinessScore}%</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Decision Context</div>
      <div class="record-list">
        <div><span class="tiny-label">Primary Contact</span><strong>${escapeHtml(pipeline.primaryContact.first_name)} ${escapeHtml(pipeline.primaryContact.last_name)}</strong><span>${escapeHtml(pipeline.primaryContact.title)}</span></div>
        <div><span class="tiny-label">Preferred Channel</span><strong>${escapeHtml(pipeline.organization.preferred_channel)}</strong><span>${escapeHtml(pipeline.organization.next_real_ask)}</span></div>
        <div><span class="tiny-label">Next Internal Deadline</span><strong>${escapeHtml(dateTimeLabel(pipeline.next_internal_deadline_at))}</strong></div>
        <div><span class="tiny-label">Next Touch</span><strong>${escapeHtml(dateTimeLabel(pipeline.next_touch_at))}</strong><span>${pipeline.nextTouchDays}d away</span></div>
        <div><span class="tiny-label">Materials Status</span><strong>${escapeHtml(pipeline.materials_status.replaceAll("_", " "))}</strong></div>
        <div><span class="tiny-label">Best Next Action</span><strong>${escapeHtml(pipeline.best_next_action)}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Blockers + Requested Materials</div>
      <div class="stack">
        ${(pipeline.risk_flags || []).map((flag) => `<div class="activity-row"><strong>${escapeHtml(flag)}</strong></div>`).join("")}
        ${(pipeline.requested_materials || []).map((item) => `<div class="activity-row"><div>${escapeHtml(item)}</div></div>`).join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Channels + Docs</div>
      <div class="link-stack">
        ${linkMarkup("Organization LinkedIn", pipeline.organization.linkedin_url)}
        ${linkMarkup("Contact LinkedIn", pipeline.primaryContact.linkedin_url)}
        ${linkMarkup("Gmail thread", pipeline.organization.gmail_thread_url)}
        ${linkMarkup("Calendar event", pipeline.organization.google_calendar_url)}
        ${linkMarkup("Drive folder", pipeline.organization.google_drive_url)}
        ${linkMarkup("Key doc", pipeline.organization.google_doc_url)}
        ${pipeline.googleAssets.map((asset) => linkMarkup(asset.label, asset.url)).join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Open Tasks</div>
      <div class="stack">
        ${pipeline.tasks
          .map(
            (task) => `
              <div class="activity-row">
                <div class="inline-top">
                  <strong>${escapeHtml(task.title)}</strong>
                  <span class="pill ${priorityTone(task.priority)}">${escapeHtml(task.priority)}</span>
                </div>
                <div>${escapeHtml(task.description)}</div>
                <div class="muted">${escapeHtml(dateTimeLabel(task.due_at))}</div>
              </div>
            `,
          )
          .join("") || `<div class="empty-card">No open tasks.</div>`}
      </div>
    </div>
  `;
}

function renderRelationshipInspector() {
  const relationship = getRelationshipRecords().find((item) => item.id === state.selectedRelationshipId) || getRelationshipRecords()[0];
  if (!relationship) {
    return `<div class="empty-card">No relationship selected.</div>`;
  }
  return `
    <div class="inspector-header">
      <div class="eyebrow">Relationship Detail</div>
      <h3>${escapeHtml(relationship.name)}</h3>
      <p>${escapeHtml(relationship.notes)}</p>
    </div>

    <div class="info-card">
      <div class="info-grid">
        <div><span class="tiny-label">Status</span><strong>${escapeHtml(relationship.relationship_status)}</strong></div>
        <div><span class="tiny-label">Score</span><strong>${relationship.relationship_score}</strong></div>
        <div><span class="tiny-label">Coverage</span><strong>${escapeHtml(relationship.coverage_tier)}</strong></div>
        <div><span class="tiny-label">Next Touch</span><strong>${escapeHtml(dateLabel(relationship.next_touch_at))}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">People Coverage</div>
      <div class="stack">
        ${relationship.contacts
          .map(
            (contact) => `
              <div class="activity-row">
                <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</strong>
                <div>${escapeHtml(contact.title)}</div>
                <div class="muted">${escapeHtml(contact.preferred_channel)} · ${escapeHtml(contact.email)}</div>
                <div class="link-row">
                  ${linkMarkup("LinkedIn", contact.linkedin_url)}
                  ${linkMarkup("X", contact.x_url)}
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Channels + Warm Paths</div>
      <div class="record-list">
        ${(relationship.channel_profiles || [])
          .map(
            (channel) => `
              <div>
                <span class="tiny-label">${escapeHtml(channel.channel)}</span>
                <strong>${escapeHtml(channel.strength)}</strong>
                <span>${escapeHtml(channel.notes)}</span>
              </div>
            `,
          )
          .join("")}
        ${(relationship.warm_paths || [])
          .map((path) => `<div><span class="tiny-label">Warm Path</span><strong>${escapeHtml(path)}</strong></div>`)
          .join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Linked Records</div>
      <div class="link-stack">
        ${linkMarkup("Website", relationship.website)}
        ${linkMarkup("Organization LinkedIn", relationship.linkedin_url)}
        ${linkMarkup("Primary LinkedIn", relationship.primaryContact?.linkedin_url)}
        ${linkMarkup("Gmail thread", relationship.gmail_thread_url)}
        ${linkMarkup("Drive folder", relationship.google_drive_url)}
        ${linkMarkup("Working doc", relationship.google_doc_url)}
      </div>
    </div>

    ${
      relationship.pipeline
        ? `
          <div class="detail-section">
            <div class="section-title">Fundraising Overlay</div>
            <div class="record-list">
              <div><span class="tiny-label">Stage</span><strong>${escapeHtml(titleCase(stageLabel(relationship.pipeline.stage)))}</strong></div>
              <div><span class="tiny-label">Target</span><strong>${currency(relationship.pipeline.target_commitment)}</strong></div>
              <div><span class="tiny-label">Readiness</span><strong>${relationship.pipeline.readinessScore}%</strong></div>
              <div><span class="tiny-label">Best Next Action</span><strong>${escapeHtml(relationship.pipeline.best_next_action)}</strong></div>
            </div>
          </div>
        `
        : ""
    }
  `;
}

function renderPortfolioInspector() {
  const company = getPortfolioRecords().find((item) => item.id === state.selectedPortfolioId) || getPortfolioRecords()[0];
  if (!company) {
    return `<div class="empty-card">No portfolio company selected.</div>`;
  }
  return `
    <div class="inspector-header">
      <div class="eyebrow">Portfolio Detail</div>
      <h3>${escapeHtml(company.name)}</h3>
      <p>${escapeHtml(company.summary)}</p>
    </div>

    <div class="info-card">
      <div class="info-grid">
        <div><span class="tiny-label">Health</span><strong>${escapeHtml(company.health.replaceAll("_", " "))}</strong></div>
        <div><span class="tiny-label">Support Level</span><strong>${escapeHtml(company.support_level)}</strong></div>
        <div><span class="tiny-label">Runway</span><strong>${company.runway_months}m</strong></div>
        <div><span class="tiny-label">Board</span><strong>${escapeHtml(dateLabel(company.board_meeting_at))}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Performance + Ownership</div>
      <div class="record-list">
        <div><span class="tiny-label">Check</span><strong>${currency(company.check_size)}</strong></div>
        <div><span class="tiny-label">Ownership</span><strong>${percent(company.ownership_pct)}</strong></div>
        <div><span class="tiny-label">ARR</span><strong>${currency(company.arr)}</strong></div>
        <div><span class="tiny-label">Growth QoQ</span><strong>${percent(company.growth_qoq_pct)}</strong></div>
        <div><span class="tiny-label">Founder Sentiment</span><strong>${escapeHtml(company.founder_sentiment)}</strong></div>
        <div><span class="tiny-label">Best Next Action</span><strong>${escapeHtml(company.best_next_action)}</strong></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Support Context</div>
      <div class="stack">
        ${(company.support_requests || []).map((item) => `<div class="activity-row"><strong>${escapeHtml(item)}</strong></div>`).join("")}
        ${(company.key_risks || []).map((risk) => `<div class="activity-row"><div class="muted">Risk</div><strong>${escapeHtml(risk)}</strong></div>`).join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Founders</div>
      <div class="stack">
        ${company.founders
          .map(
            (founder) => `
              <div class="activity-row">
                <strong>${escapeHtml(founder.first_name)} ${escapeHtml(founder.last_name)}</strong>
                <div>${escapeHtml(founder.title)}</div>
                <div class="muted">${escapeHtml(founder.preferred_channel)} · ${escapeHtml(founder.email)}</div>
                <div class="link-row">
                  ${linkMarkup("LinkedIn", founder.linkedin_url)}
                  ${linkMarkup("X", founder.x_url)}
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>

    <div class="detail-section">
      <div class="section-title">Google + Channel Surface</div>
      <div class="link-stack">
        ${linkMarkup("Company LinkedIn", company.linkedin_url)}
        ${linkMarkup("X / Twitter", company.x_url)}
        ${linkMarkup("Gmail thread", company.gmail_thread_url)}
        ${linkMarkup("Drive folder", company.google_drive_url)}
        ${linkMarkup("Google doc", company.google_doc_url)}
        ${linkMarkup("Google sheet", company.google_sheet_url)}
        ${linkMarkup("Calendar event", company.google_calendar_url)}
        ${company.googleAssets.map((asset) => linkMarkup(asset.label, asset.url)).join("")}
      </div>
    </div>
  `;
}

function openSubject(subjectType, subjectId) {
  if (subjectType === "pipeline") {
    state.view = "fundraising";
    state.selectedPipelineId = subjectId;
    render();
    return;
  }
  if (subjectType === "portfolio") {
    state.view = "portfolio";
    state.selectedPortfolioId = subjectId;
    render();
    return;
  }
  state.view = "relationships";
  state.selectedRelationshipId = subjectId;
  render();
}

function wireEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });

  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", (event) => {
      state.search = event.target.value;
      render();
    });
  }

  document.querySelectorAll("[data-open-pipeline]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPipelineId = button.dataset.openPipeline;
      state.view = "fundraising";
      render();
    });
  });

  document.querySelectorAll("[data-open-relationship]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRelationshipId = button.dataset.openRelationship;
      state.view = "relationships";
      render();
    });
  });

  document.querySelectorAll("[data-open-portfolio]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPortfolioId = button.dataset.openPortfolio;
      state.view = "portfolio";
      render();
    });
  });

  document.querySelectorAll("[data-task-subject-type]").forEach((button) => {
    button.addEventListener("click", () => {
      openSubject(button.dataset.taskSubjectType, button.dataset.taskSubjectId);
    });
  });

  document.querySelectorAll("[data-open-subject-type]").forEach((button) => {
    button.addEventListener("click", () => {
      openSubject(button.dataset.openSubjectType, button.dataset.openSubjectId);
    });
  });
}

async function init() {
  const response = await fetch("/api/data");
  state.seed = await response.json();
  render();
}

init().catch((error) => {
  console.error(error);
  app.innerHTML = `<div class="panel" style="padding: 24px;">Unable to load Spice HQ data.</div>`;
});
