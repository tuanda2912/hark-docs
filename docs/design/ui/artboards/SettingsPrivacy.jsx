/* global React, Icon, MacWindow, Eyebrow, Toggle */

function SettingsPrivacy({ theme = "dark" }) {
  const [redact, setRedact] = React.useState(true);
  const [showRedacted, setShowRedacted] = React.useState(true);
  const [analytics, setAnalytics] = React.useState(false);
  const [diagnostics, setDiagnostics] = React.useState(false);

  const nav = [
    { id: "privacy", label: "Privacy",       icon: "shield",    active: true },
    { id: "audio",   label: "Audio",          icon: "mic",      active: false },
    { id: "trans",   label: "Translation",    icon: "languages",active: false },
    { id: "api",     label: "API & cost",     icon: "cloud",    active: false },
    { id: "keys",    label: "Hotkeys",        icon: "keyboard", active: false },
    { id: "vault",   label: "Vault",          icon: "folder",   active: false },
    { id: "about",   label: "About",          icon: "info",     active: false },
  ];

  const recent = [
    { t: "13:42 today",      a: "Summary",     redacted: "4 names, 1 phone",      ok: true,  cost: "0.014" },
    { t: "13:38 today",      a: "Translation", redacted: "3 names",                ok: true,  cost: "0.009" },
    { t: "11:14 today",      a: "Q&A",          redacted: "2 names, 1 amount",     ok: true,  cost: "0.022" },
    { t: "10:02 today",      a: "Q&A",          redacted: "—",                      ok: false, cost: "0.018" },
    { t: "Yesterday 17:28",  a: "Summary",     redacted: "1 name",                 ok: true,  cost: "0.011" },
    { t: "Yesterday 15:11",  a: "Translation", redacted: "0 (none detected)",     ok: true,  cost: "0.006" },
  ];

  return (
    <div data-theme={theme} className="app-shell" style={{ width: 1100, height: 720 }}>
      <MacWindow title="Hark — Settings" width={1100} height={720}>
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "220px 1fr" }}>
          {/* Side nav */}
          <div style={{
            background: "var(--bg-2)",
            borderRight: "1px solid var(--border)",
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}>
            <Eyebrow style={{ padding: "0 8px 8px" }}>Settings</Eyebrow>
            {nav.map((n) => (
              <button key={n.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                background: n.active ? "var(--accent-soft)" : "transparent",
                color: n.active ? "var(--accent)" : "var(--text-2)",
                border: "none",
                fontSize: 13,
                fontWeight: n.active ? 600 : 500,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-ui)",
              }}>
                <Icon name={n.icon} size={14} />
                {n.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{
              padding: "10px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--text-3)",
              borderTop: "1px solid var(--border)",
              marginTop: 12,
            }}>
              Hark 0.9.3 (build 2841)
              <br />
              <span style={{ color: "var(--status-success)" }}>● audio engine ready</span>
            </div>
          </div>

          {/* Right pane */}
          <div className="scroll-y" style={{ padding: "32px 40px", minHeight: 0 }}>
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 16,
              paddingBottom: 24,
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{
                width: 44, height: 44,
                borderRadius: 10,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon name="shield" size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.015em",
                  margin: 0,
                  color: "var(--text)",
                }}>Privacy</h1>
                <p style={{
                  marginTop: 8,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--text-2)",
                  maxWidth: 620,
                }}>
                  Hark never sends your audio anywhere. The only cloud-touching features are
                  Claude API calls for summary, translation (high-quality mode), and Q&amp;A —
                  and only when you invoke them.
                </p>
              </div>
            </div>

            {/* Trust receipt */}
            <div style={{
              marginTop: 24,
              padding: "16px 18px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 24,
            }}>
              <ReceiptRow icon="cloudOff" tone="success" label="Audio leaves this Mac" value="Never"  />
              <ReceiptRow icon="cloud"    tone="cloud"   label="Cloud calls (7d)"      value="38"     sub="$0.42 spent" />
              <ReceiptRow icon="eyeOff"   tone="success" label="PII redacted last call" value="Yes"  sub="4 entities" />
            </div>

            {/* Toggles */}
            <div style={{ marginTop: 28 }}>
              <Eyebrow>Cloud-touching features</Eyebrow>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column" }}>
                <SettingRow
                  label="Redact PII before sending to Claude"
                  desc="Names, phone numbers, emails, addresses, dollar figures, and ID numbers are replaced with placeholders before any cloud call. Recommended."
                  control={<Toggle on={redact} onClick={() => setRedact(!redact)} />}
                />
                <SettingRow
                  label="Show me what was redacted"
                  desc="After each cloud call, open a side log listing exactly what was replaced. Audit-friendly."
                  control={<Toggle on={showRedacted} onClick={() => setShowRedacted(!showRedacted)} />}
                />
                <SettingRow
                  label="Anonymous usage analytics"
                  desc="Crash reports and feature usage counters. No transcript content, ever."
                  control={<Toggle on={analytics} onClick={() => setAnalytics(!analytics)} />}
                />
                <SettingRow
                  label="Detailed diagnostics"
                  desc="Verbose local logs to help debug audio capture issues. Stored at ~/Library/Logs/Hark/."
                  control={<Toggle on={diagnostics} onClick={() => setDiagnostics(!diagnostics)} />}
                />
              </div>
            </div>

            {/* Activity log */}
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <Eyebrow>Recent cloud-touching activity</Eyebrow>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Last 10 · transcript content never logged</span>
              </div>
              <div style={{
                marginTop: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "150px 120px 1fr 110px 80px",
                  padding: "8px 14px",
                  background: "var(--bg-2)",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}>
                  <span>When</span>
                  <span>Action</span>
                  <span>Redacted</span>
                  <span>Status</span>
                  <span style={{ textAlign: "right" }}>Cost</span>
                </div>
                {recent.map((r, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "150px 120px 1fr 110px 80px",
                    padding: "10px 14px",
                    fontSize: 12.5,
                    borderBottom: i === recent.length - 1 ? "none" : "1px solid var(--border)",
                    alignItems: "center",
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-2)" }}>{r.t}</span>
                    <span style={{ color: "var(--text)" }}>{r.a}</span>
                    <span style={{ color: "var(--text-2)" }}>{r.redacted}</span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      color: r.ok ? "var(--status-success)" : "var(--status-warning)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}>
                      ● {r.ok ? "ok" : "no PII found"}
                    </span>
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-2)" }}>
                      ${r.cost}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 10,
                fontSize: 11.5,
                color: "var(--text-3)",
                display: "flex",
                gap: 16,
              }}>
                <a style={{ color: "var(--accent)" }}>Export full log (.csv)</a>
                <a style={{ color: "var(--accent)" }}>Open redaction directory</a>
              </div>
            </div>

            {/* Spend */}
            <div style={{ marginTop: 32, paddingBottom: 24 }}>
              <Eyebrow>7-day API spend</Eyebrow>
              <div style={{
                marginTop: 12,
                padding: 16,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                display: "grid",
                gridTemplateColumns: "1fr 280px",
                gap: 20,
                alignItems: "center",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--font-display)" }}>$0.42</span>
                    <span style={{ color: "var(--text-3)", fontSize: 12 }}>/ $5.00 monthly cap</span>
                  </div>
                  <div style={{ height: 4, marginTop: 8, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: "8.4%", height: "100%", background: "var(--accent)" }} />
                  </div>
                  <div style={{
                    marginTop: 10,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-3)",
                    display: "flex",
                    gap: 16,
                  }}>
                    <span>38 calls</span>
                    <span>· median $0.011</span>
                    <span>· 0 throttled</span>
                  </div>
                </div>
                <SparkChart />
              </div>
            </div>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

function ReceiptRow({ icon, tone, label, value, sub }) {
  const toneColor = tone === "success" ? "var(--status-success)" :
                    tone === "cloud"   ? "var(--status-cloud)" :
                    tone === "warning" ? "var(--status-warning)" : "var(--text-2)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ color: toneColor }}><Icon name={icon} size={14} /></span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--text)", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{sub}</div>}
    </div>
  );
}

function SettingRow({ label, desc, control }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 24,
      padding: "14px 0",
      borderBottom: "1px solid var(--border)",
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3, maxWidth: 540, lineHeight: 1.5 }}>{desc}</div>
      </div>
      {control}
    </div>
  );
}

function SparkChart() {
  const data = [0.02, 0.05, 0.09, 0.04, 0.11, 0.06, 0.05];
  const max = 0.12;
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
        {data.map((v, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: i === data.length - 1 ? "var(--accent)" : "color-mix(in oklab, var(--accent) 30%, transparent)",
            borderRadius: 2,
          }} />
        ))}
      </div>
      <div style={{
        display: "flex", gap: 6, marginTop: 4,
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)",
      }}>
        {labels.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center" }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

window.SettingsPrivacy = SettingsPrivacy;
