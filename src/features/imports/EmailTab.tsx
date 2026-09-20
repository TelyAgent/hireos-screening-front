import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { listConnections, readNowConnection, reconnectConnection } from "../../data/api/files";
import type { Connection } from "../../data/fixtures/connections";
import { relTime } from "../../lib/format";
import { Icon } from "../../components/ui/Icons";
import { Badge, Button } from "../../components/ui/Primitives";

export function EmailTab() {
  const { t, say, state } = useStore();
  const [connections, setConnections] = useState<Connection[]>([]);

  const load = () => listConnections().then((rows) => setConnections(rows.filter((c) => c.kind === "email")));
  useEffect(() => {
    load();
  }, []);

  const readNow = async (id: string) => {
    const c = await readNowConnection(id);
    say(`${c.name}: ${t("read now — 1 new item found")}`, { type: "success" });
    load();
  };
  const reconnect = async (id: string) => {
    const c = await reconnectConnection(id);
    say(`${c.name}: ${t("reauthorized — resuming from last checkpoint")}`, { type: "success" });
    load();
  };

  return (
    <div className="card card-pad">
      <div className="section-title">{t("Import from email")}</div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Authorized mailboxes are read on a schedule, or on demand. Reading a message doesn’t mean the business object is imported — that’s tracked separately below.")}
      </p>
      {connections.map((c) => (
        <div className="list-row" key={c.id} style={{ padding: "12px 4px" }}>
          <Icon name={c.status === "connected" ? "mark_email_read" : "error_outline"} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            <div className="tiny">
              {c.account} · {c.scope} · {t("Last read")} {relTime(c.lastRead, state.lang)}
            </div>
          </div>
          {c.status === "connected" ? (
            <>
              <Badge tone="success">{t("Connected")}</Badge>
              <Button variant="secondary" size="sm" onClick={() => readNow(c.id)}>
                {t("Read now")}
              </Button>
            </>
          ) : (
            <>
              <Badge tone="danger">{t("Authorization required")}</Badge>
              <Button variant="secondary" size="sm" onClick={() => reconnect(c.id)}>
                {t("Reconnect")}
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
