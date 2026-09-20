import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getJobDetail } from "../data/api/jobs";
import { db, getApplicationsForJob, getCandidate, getEvaluation, getRecsForJob } from "../data/db";
import type { Job } from "../data/fixtures/jobs";
import type { Candidate } from "../data/fixtures/candidates";
import type { Application } from "../data/fixtures/applications";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { DecisionOutcome } from "../data/fixtures/decisions";
import type { EligibilityStatus } from "../lib/scoring";
import { confidenceLabel, inferRecommendation } from "../lib/scoring";
import {
  Badge,
  CandidateAvatar,
  CoverageBar,
  EligibilityBadge,
  EmptyState,
  FreshnessBadge,
  PageHeader,
  RecommendationBadge,
  ScoreRing,
} from "../components/ui/Primitives";

type EligFilter = "all" | EligibilityStatus;

const DECISION_LABEL: Record<DecisionOutcome, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold",
  do_not_advance: "Do not advance",
  request_information: "Request Information",
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function WorkspaceRow({ app, cand, ev }: { app: Application; cand: Candidate; ev: Evaluation | undefined }) {
  const { t } = useStore();
  const navigate = useNavigate();
  const decision = db.decisions[app.id];
  const humanStatus = decision ? (
    <Badge tone="success">
      {t("Decided —")} {t(DECISION_LABEL[decision.outcome] || cap(decision.outcome))}
    </Badge>
  ) : app.screeningStatus === "review_pending" ? (
    <Badge tone="info">{t("Review pending")}</Badge>
  ) : (
    <Badge tone="outline">{t(cap((app.screeningStatus || "not started").replace(/_/g, " ")))}</Badge>
  );

  return (
    <tr className="clickable" onClick={() => navigate(`/applications/${app.id}`)}>
      <td>
        <CandidateAvatar id={cand.id} name={cand.displayName} />
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{cand.displayName}</div>
        {ev?.freshness === "stale" && <FreshnessBadge freshness="stale" />}
      </td>
      <td>{ev ? <EligibilityBadge status={ev.eligibilityStatus} /> : <Badge tone="outline">{t("Not run")}</Badge>}</td>
      <td>{ev ? <ScoreRing overall={ev.overall} size="sm" /> : "—"}</td>
      <td style={{ minWidth: 120 }}>{ev ? <CoverageBar coverage={ev.coverage} /> : "—"}</td>
      <td>
        {ev?.evaluationStatus === "insufficient_evidence" ? (
          <Badge tone="warning">{t("Review (insufficient evidence)")}</Badge>
        ) : (
          <RecommendationBadge outcome={inferRecommendation(ev)} />
        )}
      </td>
      <td>{humanStatus}</td>
      <td className="text-right">
        <Link className="btn btn-sm btn-secondary" to={`/applications/${app.id}`} onClick={(e) => e.stopPropagation()}>
          {t("Open", "Open (action)")}
        </Link>
      </td>
    </tr>
  );
}

export function ScreeningWorkspacePage() {
  const { id = "" } = useParams();
  const { t, state } = useStore();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [eligFilter, setEligFilter] = useState<EligFilter>("all");

  const load = useCallback(() => {
    getJobDetail(id)
      .then(setJob)
      .catch(() => setJob(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (job === undefined) return null;
  if (job === null) return <EmptyState icon="work_off" title={t("Job not found")} />;

  const suggested = getRecsForJob(job.id).filter((r) => r.status === "proposed");
  let rows = getApplicationsForJob(job.id).map((app) => ({ app, cand: getCandidate(app.candidateId)!, ev: getEvaluation(app.id) }));
  if (eligFilter !== "all") rows = rows.filter((r) => r.ev && r.ev.eligibilityStatus === eligFilter);
  rows = [...rows].sort((a, b) => (b.ev?.overall ?? -1) - (a.ev?.overall ?? -1));

  return (
    <>
      <PageHeader
        title={`${job.title} — ${t("Screening workspace")}`}
        subtitle={`${job.team} · ${job.location} · ${t("Standard")} v${job.criteriaVersion} (${t("confirmed")})`}
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title }]}
        actions={
          <>
            <Link className="btn btn-secondary" to={`/jobs/${job.id}/criteria`}>
              {t("Requirements & rubric")}
            </Link>
            <Link className="btn btn-primary" to="/comparisons/cmp-job-a">
              {t("Compare candidates")}
            </Link>
          </>
        }
      />

      <div className="underline-tabs">
        <div className="u-tab active">
          {t("Suggested candidates")} <span className="cnt">{suggested.length}</span>
        </div>
      </div>
      {suggested.length ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Candidate")}</th>
                <th>{t("Confidence")}</th>
                <th>{t("Rationale")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suggested.map((r) => {
                const cand = getCandidate(r.candidateId)!;
                return (
                  <RecommendationRow key={r.id} candidate={cand} confidence={confidenceLabel(r, state.lang)} rationale={r.rationale} />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <EmptyState
            icon="inbox"
            title={t("No pending recommendations")}
            body={t("AI-proposed matches for this role will appear here before anyone confirms them.")}
          />
        </div>
      )}

      <div className="page-header">
        <div className="underline-tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
          <div className="u-tab active">
            {t("Linked candidates")} <span className="cnt">{getApplicationsForJob(job.id).length}</span>
          </div>
        </div>
        <div className="actions">
          <select
            value={eligFilter}
            onChange={(e) => setEligFilter(e.target.value as EligFilter)}
            style={{ padding: "7px 10px", border: "1px solid var(--border-strong)", borderRadius: 6, fontSize: "var(--fs-sm)", background: "var(--surface)", color: "var(--text)" }}
          >
            <option value="all">{t("All eligibility")}</option>
            <option value="eligible">{t("Eligible")}</option>
            <option value="needs_verification">{t("Needs verification")}</option>
            <option value="not_eligible">{t("Not eligible")}</option>
          </select>
        </div>
      </div>
      <div className="card">
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>{t("Candidate")}</th>
                <th>{t("Eligibility")}</th>
                <th>{t("Overall")}</th>
                <th>{t("Coverage")}</th>
                <th>{t("AI recommendation")}</th>
                <th>{t("Human status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <WorkspaceRow key={r.app.id} app={r.app} cand={r.cand} ev={r.ev} />
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon="group_off" title={t("No linked candidates match this filter")} />
        )}
      </div>
    </>
  );
}

function RecommendationRow({ candidate, confidence, rationale }: { candidate: Candidate; confidence: string; rationale: string }) {
  const { t } = useStore();
  const navigate = useNavigate();
  return (
    <tr className="clickable" onClick={() => navigate(`/candidates/${candidate.id}/jobs`)}>
      <td>
        <span className="flex items-center gap-8">
          <CandidateAvatar id={candidate.id} name={candidate.displayName} size="sm" /> {candidate.displayName}
        </span>
      </td>
      <td className="tiny">{confidence}</td>
      <td className="tiny">{rationale}</td>
      <td className="text-right">
        <Link className="btn btn-sm btn-primary" to={`/candidates/${candidate.id}/jobs`} onClick={(e) => e.stopPropagation()}>
          {t("Review", "Review (action)")}
        </Link>
      </td>
    </tr>
  );
}
