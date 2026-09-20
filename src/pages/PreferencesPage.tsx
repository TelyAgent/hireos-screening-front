import { useEffect, useState } from "react";
import { useStore } from "../store/StoreContext";
import { activateProposal, getPreferences, rejectProposal, rollbackToVersion } from "../data/api/preferences";
import { getPerson } from "../data/db";
import type { PreferenceLayer, PreferencesData } from "../data/fixtures/preferences";
import { fmtDate, pct } from "../lib/format";
import { Badge, PageHeader } from "../components/ui/Primitives";

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function PrefLayerCard({ layer }: { layer: PreferenceLayer }) {
  const { t } = useStore();
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{layer.scope}</div>
        <Badge tone="success">{t(cap(layer.status))}</Badge>
      </div>
      {layer.pointerOnly ? (
        <p className="tiny" style={{ marginTop: 8 }}>
          {t("Points to the job’s confirmed rubric — see")} <a href="/jobs/job-a/criteria">{t("Requirements & rubric")}</a>.
        </p>
      ) : (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
          {(layer.rules || []).map((r, i) => (
            <li key={i}>
              {r.feature}
              {r.weightAdjustment ? ` — ${r.weightAdjustment}` : ""}
              {r.locked && <Badge tone="outline">{t("Locked")}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PreferencesPage() {
  const { t, state, say } = useStore();
  const [prefs, setPrefs] = useState<PreferencesData | null>(null);

  const load = () => getPreferences().then(setPrefs);
  useEffect(() => {
    load();
  }, []);

  if (!prefs) return null;

  const review = async (proposalId: string, outcome: "activated" | "rejected") => {
    if (outcome === "activated") {
      await activateProposal(proposalId, "morgan");
      say(t("New shared preference version activated"), { type: "success" });
    } else {
      await rejectProposal(proposalId);
      say(t("Proposal rejected — no change to active preferences"));
    }
    load();
  };

  const rollback = async (versionId: string) => {
    await rollbackToVersion(versionId, "morgan");
    say(t("Rolled back — a new version was created pointing at the prior configuration"), { type: "success" });
    load();
  };

  return (
    <>
      <PageHeader
        title={t("Preferences")}
        subtitle={t("Organization and Team layers govern official scoring. Personal views never change team results.")}
        crumbs={[{ label: t("Settings"), href: "/settings/preferences" }, { label: t("Preferences") }]}
      />
      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <PrefLayerCard layer={prefs.organization} />
        <PrefLayerCard layer={prefs.team} />
        <PrefLayerCard layer={prefs.role} />
        <PrefLayerCard layer={prefs.user} />
      </div>

      <div className="section-block" style={{ marginTop: 24 }}>
        <div className="section-title">
          {t("Feedback signals")} <span className="tiny" style={{ fontWeight: 400 }}>{t("(from shortlist/advance/override actions)")}</span>
        </div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Feature")}</th>
                <th>{t("Direction")}</th>
                <th>{t("Strength")}</th>
                <th>{t("Source")}</th>
                <th>{t("Eligibility")}</th>
              </tr>
            </thead>
            <tbody>
              {prefs.signals.map((s) => (
                <tr key={s.id}>
                  <td>{s.feature}</td>
                  <td className="tiny">{t(cap(s.direction))}</td>
                  <td>{pct(s.strength)}</td>
                  <td className="tiny">{s.source}</td>
                  <td>{s.eligibility === "eligible" ? <Badge tone="success">{t("Eligible")}</Badge> : <Badge tone="danger">{t("Prohibited — excluded")}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">
          {t("Proposed shared preferences")} <span className="tiny" style={{ fontWeight: 400 }}>{t("(pending review)")}</span>
        </div>
        <div className="card">
          {prefs.proposed.length ? (
            prefs.proposed.map((pr) => (
              <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }} key={pr.id}>
                <div className="flex items-center justify-between flex-wrap gap-8">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{pr.title}</div>
                    <div className="tiny">
                      {t("Basis:")} {pr.basis} · {t("Sample size")} {pr.sampleSize} · {pr.window}
                    </div>
                  </div>
                  <div className="flex gap-6">
                    {state.currentUser === "morgan" ? (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => review(pr.id, "rejected")}>
                          {t("Reject")}
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={() => review(pr.id, "activated")}>
                          {t("Activate new version")}
                        </button>
                      </>
                    ) : (
                      <Badge tone="info">{t("Awaiting Admin review")}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card-pad tiny">{t("No proposals pending.")}</div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">{t("Version history")}</div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Version")}</th>
                <th>{t("Activated")}</th>
                <th>{t("By")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prefs.versions.map((v) => (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td className="tiny">{fmtDate(v.activatedAt, "en")}</td>
                  <td className="tiny">{getPerson(v.activatedBy)?.name}</td>
                  <td className="text-right">
                    {!v.label.includes("current") && (
                      <button className="btn btn-sm btn-secondary" onClick={() => rollback(v.id)}>
                        {t("Roll back to this")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
