import type { ImportOutcome } from "../../data/api/imports";
import type { BadgeTone } from "../../components/ui/Primitives";

export const OUTCOME_BADGE: Record<ImportOutcome, { tone: BadgeTone; label: string }> = {
  exact_file: { tone: "neutral", label: "Already exists — reused" },
  new_resume_version: { tone: "warning", label: "Newer version — review needed" },
  possible_same_person: { tone: "warning", label: "Possible duplicate — review needed" },
  new_candidate: { tone: "success", label: "Added to library" },
  quarantined: { tone: "danger", label: "Quarantined" },
  parse_failed: { tone: "danger", label: "Parse failed" },
  too_large: { tone: "danger", label: "File too large" },
  unsupported_type: { tone: "danger", label: "Unsupported file type" },
};

export const OUTCOME_DETAIL: Record<ImportOutcome, string> = {
  exact_file: "Identical to a file already on record — content reused, this upload logged as a new source.",
  new_resume_version: "Same contact details as the existing candidate, newer content — needs confirmation.",
  possible_same_person: "Name matches an existing candidate, contact details differ — identity unclear.",
  new_candidate: "New candidate, no conflicts — added to the Resume Library. No job selected.",
  quarantined: "File appears password-protected. Isolated for security review — not sent to parsing or AI.",
  parse_failed:
    "Could not extract readable text from this scan. Duplicate check could not run — this is shown as incomplete, not “no duplicates found.”",
  too_large: "File exceeds the 25 MB limit. Not uploaded.",
  unsupported_type: "Unsupported file type. Only PDF, DOCX and TXT are accepted. Not uploaded.",
};

export function formatFileSize(sizeKB: number): string {
  return sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
}
