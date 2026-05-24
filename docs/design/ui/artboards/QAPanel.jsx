/* global React, Icon, Eyebrow, CitationChip */

function QAPanel({ theme = "dark" }) {
  return (
    <div data-theme={theme} className="app-shell" style={{ width: 380, height: 700 }}>
      <div style={{
        width: 380, height: 700,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-modal)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{
            width: 24, height: 24,
            borderRadius: 6,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="quote" size={13} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Ask Hark</div>
            <div style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
              across 142 meetings · 8,910 notes
            </div>
          </div>
          <button className="icon-btn"><Icon name="ellipsis" size={14} /></button>
        </div>

        {/* Input */}
        <div style={{ padding: "12px 14px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            boxShadow: "0 0 0 3px var(--accent-soft)",
            borderRadius: 8,
            padding: "10px 12px",
          }}>
            <Icon name="search" size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>
              What's our usual SLA position with vendors?
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)",
              padding: "1px 4px",
              border: "1px solid var(--border)",
              borderRadius: 3,
            }}>↵</span>
          </div>
          <div style={{
            marginTop: 8, display: "flex", gap: 6,
            fontSize: 10.5, fontFamily: "var(--font-mono)",
            color: "var(--text-3)",
            alignItems: "center",
          }}>
            <span>Scope:</span>
            {["All vault", "Last 30 days", "This meeting"].map((s, i) => (
              <span key={s} style={{
                padding: "2px 8px",
                borderRadius: 999,
                background: i === 0 ? "var(--accent-soft)" : "transparent",
                color: i === 0 ? "var(--accent)" : "var(--text-3)",
                border: `1px solid ${i === 0 ? "color-mix(in oklab, var(--accent) 30%, transparent)" : "var(--border)"}`,
                cursor: "pointer",
              }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Answer */}
        <div className="scroll-y" style={{ flex: 1, padding: "0 14px 14px", minHeight: 0 }}>
          <Eyebrow style={{ marginTop: 6, marginBottom: 8 }}>Answer</Eyebrow>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>
            Across the last 14 vendor contracts you tend to <strong>open at three-nines, counter to four-nines only with planned-window exclusions</strong>
            <sup style={{ marginLeft: 2, fontSize: 9.5, color: "var(--accent)" }}>[1]</sup>
            , and avoid liquidated-damages clauses past 12 months of fees
            <sup style={{ marginLeft: 2, fontSize: 9.5, color: "var(--accent)" }}>[2]</sup>.
            <br /><br />
            On-prem deployments specifically: you've conceded four-nines twice
            <sup style={{ marginLeft: 2, fontSize: 9.5, color: "var(--accent)" }}>[3]</sup>
            , both times with explicit storage-migration carve-outs that took ops about
            five weeks to draft.
          </div>

          <div style={{
            marginTop: 14,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            fontSize: 12,
          }}>
            <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: "3px 8px" }}>
              Follow-up: <span style={{ color: "var(--text)" }}>“show me the two on-prem ones”</span>
            </button>
          </div>

          <Eyebrow style={{ marginTop: 20, marginBottom: 10 }}>Sources · 3</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { n: 1, t: "Vendor SLA playbook v3", p: "vault/playbooks/sla-playbook.md", s: "Default opening: 99.9% with monthly measurement window. Four-nines only after…", date: "Feb 2026" },
              { n: 2, t: "Liquidated damages — legal note", p: "vault/legal/liquidated-damages.md", s: "We cap at 12 months of fees; anything beyond requires partner sign-off…", date: "Nov 2025" },
              { n: 3, t: "Pinecone on-prem signing call", p: "meetings/2025-11-08-pinecone.md", s: "“Conceded four-nines but only with planned-window exclusion clauses…”", date: "Nov 2025" },
            ].map((c) => (
              <div key={c.n} style={{
                padding: 10,
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 3,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                  }}>{c.n}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500 }}>{c.t}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>{c.date}</span>
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--accent)",
                  marginBottom: 4,
                }}>{c.p}</div>
                <div style={{ color: "var(--text-2)", fontSize: 12, lineHeight: 1.5, fontStyle: "italic" }}>"{c.s}"</div>
              </div>
            ))}
          </div>

          {/* Prior */}
          <Eyebrow style={{ marginTop: 20, marginBottom: 8 }}>Recent asks</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              "What did Ahmed say about §4.2 last quarter?",
              "Summarize the on-prem deployment SLA debate",
              "All meetings mentioning [[Tessera]]",
            ].map((q, i) => (
              <button key={i} style={{
                padding: "7px 10px",
                background: "transparent",
                border: "none",
                borderRadius: 6,
                color: "var(--text-2)",
                fontSize: 12.5,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                gap: 8,
                fontFamily: "var(--font-ui)",
              }}>
                <Icon name="search" size={11} style={{ color: "var(--text-3)", marginTop: 3 }} />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy footer */}
        <div style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border)",
          background: "color-mix(in oklab, var(--status-cloud) 8%, transparent)",
          fontSize: 11,
          color: "var(--text-2)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          lineHeight: 1.4,
        }}>
          <Icon name="cloud" size={12} style={{ color: "var(--status-cloud)", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            This answer used Claude · <strong style={{ color: "var(--text)" }}>4 names redacted</strong>
          </span>
          <a style={{ color: "var(--accent)", fontSize: 11 }}>Log</a>
        </div>
      </div>
    </div>
  );
}

window.QAPanel = QAPanel;
