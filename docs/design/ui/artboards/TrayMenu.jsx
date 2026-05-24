/* global React, Icon, Eyebrow */

function TrayMenu({ theme = "dark", state = "recording" }) {
  // state: idle | recording | paused
  const isRec = state === "recording";
  const isPaused = state === "paused";
  const isIdle = state === "idle";

  return (
    <div data-theme={theme} className="app-shell" style={{ width: 280 }}>
      <div style={{
        width: 280,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-modal)",
        overflow: "hidden",
        fontSize: 13,
      }}>
        {/* Header / state */}
        <div style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isRec && <span className="rec-dot" />}
              {isPaused && <span style={{ width: 8, height: 8, borderRadius: 50, background: "var(--status-warning)" }} />}
              {isIdle && <span style={{ width: 8, height: 8, borderRadius: 50, background: "var(--text-3)" }} />}
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: isRec ? "var(--status-recording)" : isPaused ? "var(--status-warning)" : "var(--text-3)",
                fontWeight: 600,
              }}>
                {isRec ? "RECORDING" : isPaused ? "PAUSED" : "IDLE"}
              </span>
            </div>
            {!isIdle && (
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}>00:14:27</span>
            )}
          </div>
          {!isIdle && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-2)" }}>
              Q3 Vendor Review — Acme × Tessera
            </div>
          )}
          {isIdle && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-3)" }}>
              No active recording. Press ⌘⇧R to start.
            </div>
          )}
        </div>

        {/* Big action */}
        <div style={{ padding: "10px 12px" }}>
          {isIdle ? (
            <button style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 6,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--bg)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              fontFamily: "var(--font-ui)",
            }}>
              <Icon name="mic" size={13} />
              Start recording
              <span style={{
                marginLeft: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                opacity: 0.8,
                padding: "1px 5px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 3,
              }}>⌘⇧R</span>
            </button>
          ) : (
            <button style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 6,
              border: `1px solid color-mix(in oklab, var(--status-recording) 50%, transparent)`,
              background: "color-mix(in oklab, var(--status-recording) 14%, transparent)",
              color: "var(--status-recording)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              fontFamily: "var(--font-ui)",
            }}>
              <Icon name="stop" size={11} />
              Stop & review
            </button>
          )}
        </div>

        {/* Sub-actions */}
        {!isIdle && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            padding: "0 12px 10px",
          }}>
            <button style={trayBtn(isPaused)}>
              <Icon name={isPaused ? "play" : "pause"} size={11} />
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button style={trayBtn(false)}>
              <Icon name="bookmark" size={11} />
              Bookmark
            </button>
          </div>
        )}

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Open / Recent */}
        <div style={{ padding: "8px 6px" }}>
          <MenuItem icon="sidebar" label="Open main window" hotkey="⌘0" />
          <MenuItem icon="search" label="Search transcripts" hotkey="⌘K" />
        </div>

        <div style={{ height: 1, background: "var(--border)" }} />

        <div style={{ padding: "8px 12px 4px" }}>
          <Eyebrow>Recent</Eyebrow>
        </div>
        <div style={{ padding: "0 6px 6px" }}>
          {[
            { t: "Q2 Architecture sync",        d: "Mon · 38m"  },
            { t: "Tessera DPA — counsel call", d: "Mar 14 · 1h 02m" },
            { t: "Hiring loop · L Nguyễn",      d: "Mar 13 · 45m" },
          ].map((r) => (
            <button key={r.t} style={menuItemStyle()}>
              <span style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="waveform" size={13} style={{ color: "var(--text-3)" }} />
              </span>
              <span style={{ flex: 1, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{r.t}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)" }}>{r.d}</span>
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Footer */}
        <div style={{ padding: "6px 6px 8px" }}>
          <MenuItem icon="settings" label="Settings…" hotkey="⌘," />
          <MenuItem icon="x" label="Quit Hark" hotkey="⌘Q" />
        </div>

        {/* Privacy footer */}
        <div style={{
          padding: "8px 12px 10px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-3)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}>
          <Icon name="cloudOff" size={11} />
          <span>audio · local-only</span>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, hotkey }) {
  return (
    <button style={menuItemStyle()}>
      <span style={{ width: 14, display: "inline-flex" }}>
        <Icon name={icon} size={13} style={{ color: "var(--text-2)" }} />
      </span>
      <span style={{ flex: 1, color: "var(--text)", textAlign: "left" }}>{label}</span>
      {hotkey && (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--text-3)",
        }}>{hotkey}</span>
      )}
    </button>
  );
}

function trayBtn(active) {
  return {
    padding: "6px 10px",
    borderRadius: 5,
    background: active ? "var(--accent-soft)" : "var(--surface)",
    border: `1px solid ${active ? "color-mix(in oklab, var(--accent) 35%, transparent)" : "var(--border-2)"}`,
    color: active ? "var(--accent)" : "var(--text)",
    fontSize: 12,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    fontFamily: "var(--font-ui)",
  };
}

function menuItemStyle() {
  return {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 5,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12.5,
    fontFamily: "var(--font-ui)",
  };
}

window.TrayMenu = TrayMenu;
