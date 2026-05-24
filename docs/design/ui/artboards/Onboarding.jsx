/* global React, Icon, MacWindow, Eyebrow */

function OnboardingTrust({ theme = "dark" }) {
  return (
    <div data-theme={theme} className="app-shell" style={{ width: 720, height: 520 }}>
      <MacWindow title="Hark" width={720} height={520}>
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "48px 56px 32px",
          position: "relative",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            color: "var(--text-3)", letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            <span>Step 1 of 3 · Trust</span>
            <span style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 1, position: "relative" }}>
              <span style={{ position: "absolute", inset: 0, width: "33%", background: "var(--accent)", borderRadius: 1 }} />
            </span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 40 }}>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              lineHeight: 1.1,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              margin: 0,
              color: "var(--text)",
              maxWidth: 480,
            }}>
              Your audio never leaves this Mac.
            </h1>
            <p style={{
              marginTop: 16,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--text-2)",
              maxWidth: 460,
            }}>
              Hark transcribes meetings entirely on-device using WhisperKit on the Apple Neural Engine.
              Three things to know before we start.
            </p>

            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { ic: "mic",      h: "Audio is captured and transcribed locally", s: "Apple Silicon · WhisperKit large-v3-turbo · never streamed anywhere." },
                { ic: "cloud",    h: "Cloud features are opt-in and itemized",     s: "Summary, translation, and Q&A use Claude — only when you ask. PII is redacted." },
                { ic: "folder",   h: "Your notes live in a folder you control",     s: "Plain markdown in your vault. Open it in Obsidian, version it with git, move it offline." },
              ].map((row) => (
                <div key={row.h} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "var(--surface)",
                    border: "1px solid var(--border-2)",
                    color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon name={row.ic} size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{row.h}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2, lineHeight: 1.55, maxWidth: 460 }}>{row.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 24,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>
              ↵ to continue
            </span>
            <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
              Got it
              <Icon name="arrow" size={12} />
            </button>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

function OnboardingPermissions({ theme = "dark" }) {
  const perms = [
    { ic: "mic", name: "Microphone", why: "Captures your voice during meetings.", status: "granted" },
    { ic: "panelRight", name: "Screen recording", why: "Lets Hark capture the system audio of meeting participants. We do not record video.", status: "needed" },
    { ic: "keyboard", name: "Accessibility (optional)", why: "Enables global hotkeys like ⌘⇧R from any app.", status: "skippable" },
  ];

  return (
    <div data-theme={theme} className="app-shell" style={{ width: 720, height: 520 }}>
      <MacWindow title="Hark" width={720} height={520}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 56px 28px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            color: "var(--text-3)", letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            <span>Step 2 of 3 · Permissions</span>
            <span style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 1, position: "relative" }}>
              <span style={{ position: "absolute", inset: 0, width: "66%", background: "var(--accent)", borderRadius: 1 }} />
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 26, fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "32px 0 4px",
            color: "var(--text)",
          }}>Three system permissions.</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: 0 }}>
            macOS will ask. We explain why first, no surprises.
          </p>

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            {perms.map((p) => (
              <div key={p.name} style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr auto",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                alignItems: "center",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: "var(--bg-2)",
                  color: p.status === "granted" ? "var(--status-success)" : "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name={p.ic} size={15} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.5, maxWidth: 460 }}>{p.why}</div>
                </div>
                {p.status === "granted" ? (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11.5, color: "var(--status-success)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    <Icon name="check" size={12} /> Granted
                  </span>
                ) : p.status === "skippable" ? (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }}>Skip</button>
                ) : (
                  <button className="btn btn-primary" style={{ fontSize: 12 }}>Grant</button>
                )}
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12.5 }}>← Back</button>
            <button className="btn btn-primary" style={{ padding: "8px 18px" }}>Continue <Icon name="arrow" size={12} /></button>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

function OnboardingSetup({ theme = "dark" }) {
  return (
    <div data-theme={theme} className="app-shell" style={{ width: 720, height: 520 }}>
      <MacWindow title="Hark" width={720} height={520}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 56px 28px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            color: "var(--text-3)", letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            <span>Step 3 of 3 · Setup</span>
            <span style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 1, position: "relative" }}>
              <span style={{ position: "absolute", inset: 0, width: "100%", background: "var(--accent)", borderRadius: 1 }} />
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 26, fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "32px 0 4px",
            color: "var(--text)",
          }}>Where should your notes live?</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: 0 }}>
            Hark writes plain markdown into a folder you choose. Point it at your Obsidian vault, or anywhere else.
          </p>

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Vault picker */}
            <div>
              <label style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" }}>Vault folder</label>
              <div style={{
                marginTop: 6,
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 7,
                background: "var(--surface)",
                border: "1px solid var(--accent)",
                boxShadow: "0 0 0 3px var(--accent-soft)",
              }}>
                <Icon name="folder" size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text)", flex: 1 }}>
                  ~/Documents/Obsidian/work-vault/hark
                </span>
                <button className="btn btn-secondary" style={{ fontSize: 12 }}>Choose…</button>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-3)", display: "flex", gap: 12 }}>
                <span style={{ color: "var(--status-success)", fontFamily: "var(--font-mono)" }}>● writable</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>● git-tracked</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>● Obsidian detected</span>
              </div>
            </div>

            {/* API key */}
            <div>
              <label style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" }}>Anthropic API key</label>
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-3)" }}>· optional · skip if you'll only use local features</span>
              <div style={{
                marginTop: 6,
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 7,
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
              }}>
                <Icon name="lock" size={14} style={{ color: "var(--text-3)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-2)", flex: 1, letterSpacing: "0.05em" }}>
                  sk-ant-····················································
                </span>
                <Icon name="eyeOff" size={14} style={{ color: "var(--text-3)" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-3)" }}>
                Stored in macOS Keychain. We <strong style={{ color: "var(--text-2)" }}>never</strong> see your key.
                <a style={{ color: "var(--accent)", marginLeft: 6 }}>I'll add this later →</a>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12.5 }}>← Back</button>
            <button className="btn btn-primary" style={{ padding: "8px 22px", fontSize: 13 }}>
              <Icon name="check" size={12} /> Start using Hark
            </button>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

window.OnboardingTrust = OnboardingTrust;
window.OnboardingPermissions = OnboardingPermissions;
window.OnboardingSetup = OnboardingSetup;
