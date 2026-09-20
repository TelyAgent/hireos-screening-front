import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { runImportBatch, simulateSampleBatch, type ImportBatch, type ImportItemResult } from "../../data/api/imports";
import { Icon } from "../../components/ui/Icons";
import { Badge, Button } from "../../components/ui/Primitives";
import { OUTCOME_BADGE, OUTCOME_DETAIL, formatFileSize } from "./importOutcome";

interface Run {
  id: string;
  fileCount: number;
  batch?: ImportBatch;
}

const FAIL_OUTCOMES = new Set(["quarantined", "parse_failed", "too_large", "unsupported_type"]);

function ImportItemRow({ item, onRetry, retrying }: { item: ImportItemResult; onRetry: () => void; retrying: boolean }) {
  const { t } = useStore();
  const badge = OUTCOME_BADGE[item.outcome];
  let action: React.ReactNode = null;
  if (item.outcome === "new_resume_version" || item.outcome === "possible_same_person") {
    action = item.duplicateReviewId ? (
      <Link className="btn btn-sm btn-secondary" to={`/duplicates/${item.duplicateReviewId}`}>
        {t("Review", "Review (action)")}
      </Link>
    ) : null;
  } else if (item.outcome === "new_candidate") {
    action = item.candidateId ? (
      <Link className="btn btn-sm btn-secondary" to={`/candidates/${item.candidateId}`}>
        {t("Open profile")}
      </Link>
    ) : null;
  } else if (item.outcome === "parse_failed") {
    action = (
      <Button variant="secondary" size="sm" onClick={onRetry} disabled={retrying}>
        {t("Retry")}
      </Button>
    );
  } else if (item.outcome === "quarantined") {
    action = <span className="tiny muted">{t("File isolated — not sent to AI")}</span>;
  } else if (item.outcome === "too_large" || item.outcome === "unsupported_type") {
    action = <span className="tiny muted">{t("Not accepted")}</span>;
  } else {
    action = <span className="tiny muted">{t("No action needed")}</span>;
  }

  return (
    <div className="list-row" style={{ padding: "10px 4px" }}>
      <Icon name="description" style={{ color: "var(--text-tertiary)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-sm)" }}>
          {item.fileName} <span className="tiny muted">({formatFileSize(item.sizeKB)})</span>
        </div>
        <div className="tiny">{t(OUTCOME_DETAIL[item.outcome])}</div>
      </div>
      <Badge tone={badge.tone}>{t(badge.label)}</Badge>
      <div style={{ width: 130, textAlign: "right" }}>{action}</div>
    </div>
  );
}

function BatchCard({ run, onRetryItem, retryingId }: { run: Run; onRetryItem: (itemId: string) => void; retryingId: string | null }) {
  const { t } = useStore();
  if (!run.batch) {
    return (
      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>
            {t("Batch")} — 0/{run.fileCount} {t("processed")}
          </div>
          <span className="tiny muted">{t("Processing…")}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: "35%" }} />
        </div>
      </div>
    );
  }
  const batch = run.batch;
  const failCount = batch.items.filter((i) => FAIL_OUTCOMES.has(i.outcome)).length;
  const stateBadge =
    failCount === 0 ? (
      <Badge tone="success">{t("Succeeded")}</Badge>
    ) : failCount === batch.items.length ? (
      <Badge tone="danger">{t("Failed")}</Badge>
    ) : (
      <Badge tone="warning">{t("Partially succeeded")}</Badge>
    );
  return (
    <div className="card card-pad" style={{ marginTop: 14 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>
          {t("Batch")} {batch.id} — {batch.items.length}/{batch.items.length} {t("processed")}
        </div>
        {stateBadge}
      </div>
      <div className="progress-track" style={{ marginBottom: 14 }}>
        <div className="progress-fill" style={{ width: "100%" }} />
      </div>
      {batch.items.map((item) => (
        <ImportItemRow key={item.id} item={item} onRetry={() => onRetryItem(item.id)} retrying={retryingId === item.id} />
      ))}
    </div>
  );
}

export function UploadTab({ onChanged }: { onChanged?: () => void }) {
  const { t, say } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const startRun = async (files: File[]) => {
    const id = "run-" + Date.now();
    setRuns((prev) => [{ id, fileCount: files.length }, ...prev]);
    const batch = files.length ? await runImportBatch(files) : await simulateSampleBatch();
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, batch } : r)));
    onChanged?.();
  };

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length) startRun(files);
  };

  const handleSample = async () => {
    const id = "run-" + Date.now();
    setRuns((prev) => [{ id, fileCount: 6 }, ...prev]);
    const batch = await simulateSampleBatch();
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, batch } : r)));
    onChanged?.();
  };

  const handleRetryItem = (itemId: string) => {
    setRetryingId(itemId);
    setTimeout(() => {
      setRetryingId(null);
      say(t("Retried — file is still unreadable. Try re-scanning at a higher quality or upload a text-based PDF."), { type: "error" });
    }, 900);
  };

  return (
    <>
      <div
        className={`card card-pad upload-dropzone${dragOver ? " drag-over" : ""}`}
        style={{ border: "2px dashed var(--border-strong)", textAlign: "center", padding: "40px 20px", cursor: "pointer" }}
        onClick={() => document.getElementById("upload-file-input")?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          id="upload-file-input"
          multiple
          accept=".pdf,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          style={{ display: "none" }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Icon name="cloud_upload" size={36} style={{ color: "var(--text-tertiary)" }} />
        <h3 style={{ margin: "8px 0 4px", fontWeight: 500 }}>{t("Drag files here, or click to choose")}</h3>
        <p className="tiny">{t("Supports PDF, DOCX, TXT · Up to 25 MB per file · No job selection required")}</p>
        <Button
          variant="primary"
          style={{ marginTop: 10 }}
          onClick={(e) => {
            e.stopPropagation();
            document.getElementById("upload-file-input")?.click();
          }}
        >
          {t("Choose files")}
        </Button>
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
        <span className="tiny muted">{t("No real files handy? Use sample data instead.")}</span>
        <Button variant="secondary" size="sm" icon="science" onClick={handleSample}>
          {t("Simulate a batch (sample data)")}
        </Button>
      </div>
      {runs.map((run) => (
        <BatchCard key={run.id} run={run} onRetryItem={handleRetryItem} retryingId={retryingId} />
      ))}
    </>
  );
}
