/* global React, Icon, Eyebrow */

function DocsLanding({ theme = "dark" }) {
  return (
    <div data-theme={theme} className="app-shell" style={{ width: 1280, height: 900 }}>
      <div style={{
        width: 1280, height: 900,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Top nav */}
        <div style={{
          display: "flex", alignItems: "center", gap: 24,
          padding: "16px 32px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HarkMark />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Hark</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 3 }}>v0.1.0 · preview</span>
          </div>
          <nav style={{ display: "flex", gap: 22, fontSize: 13, color: "var(--text-2)" }}>
            <a style={{ color: "var(--text)" }}>Docs</a>
            <a>Architecture</a>
            <a>ADRs</a>
            <a>QA</a>
            <a>Changelog</a>
          </nav>
          <div style={{ flex: 1 }} />
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-3)",
            width: 240,
          }}>
            <Icon name="search" size={12} />
            <span>Search docs</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 5px", border: "1px solid var(--border)", borderRadius: 3 }}>⌘K</span>
          </div>
          <a style={{ fontSize: 13, color: "var(--text-2)", display: "inline-flex", gap: 5, alignItems: "center" }}>
            <Icon name="folder" size={13} /> GitHub
          </a>
        </div>

        {/* Hero */}
        <div className="scroll-y" style={{ flex: 1, minHeight: 0 }}>
          <div style={{
            padding: "72px 96px 56px",
            borderBottom: "1px solid var(--border)",
            background: `
              radial-gradient(ellipse 600px 300px at 30% 0%, var(--accent-soft), transparent 60%),
              var(--bg)`,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 64, alignItems: "center" }}>
              <div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-2)",
                  letterSpacing: "0.04em",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 50, background: "var(--status-success)" }} />
                  Local-first · macOS · open source
                </div>
                <h1 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 58,
                  lineHeight: 1.02,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  margin: "20px 0 16px",
                  color: "var(--text)",
                  maxWidth: 680,
                }}>
                  A meeting tool you can actually trust with your work calls.
                </h1>
                <p style={{
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: "var(--text-2)",
                  margin: 0,
                  maxWidth: 580,
                }}>
                  Hark transcribes meetings on your Mac. Live captions, speaker labels, translation,
                  Q&amp;A across your past notes — every byte of audio stays on the machine.
                </p>
                <div style={{ marginTop: 28, display: "flex", gap: 10, alignItems: "center" }}>
                  <a className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 13 }}>Read the docs <Icon name="arrow" size={12} /></a>
                  <a className="btn btn-secondary" style={{ padding: "10px 14px", fontSize: 13 }}>
                    <Icon name="folder" size={12} /> Clone on GitHub
                  </a>
                  <span style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginLeft: 10 }}>
                    MIT · Apple Silicon
                  </span>
                </div>
              </div>

              {/* Audio-stays-local diagram */}
              <div style={{
                padding: 18,
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 12,
              }}>
                <Eyebrow>Data path</Eyebrow>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <PathRow icon="mic"      label="Audio capture" sub="CoreAudio · 16kHz · WAV" color="var(--text)" />
                  <PathArrow />
                  <PathRow icon="waveform" label="WhisperKit" sub="on-device · large-v3-turbo · ANE" color="var(--text)" />
                  <PathArrow />
                  <PathRow icon="folder"   label="Vault (markdown)" sub="~/vault/meetings/" color="var(--text)" />
                  <div style={{
                    marginTop: 6,
                    padding: 8,
                    borderRadius: 6,
                    background: "color-mix(in oklab, var(--status-cloud) 10%, transparent)",
                    border: "1px dashed color-mix(in oklab, var(--status-cloud) 35%, transparent)",
                    fontSize: 11,
                    color: "var(--text-2)",
                    display: "flex",
                    gap: 8,
                  }}>
                    <Icon name="cloud" size={12} style={{ color: "var(--status-cloud)", flexShrink: 0, marginTop: 1 }} />
                    <span>Claude API (opt-in) — text-only · for summary, Q&amp;A, translation.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 columns */}
          <div style={{ padding: "56px 96px 32px" }}>
            <Eyebrow>Documentation</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 16 }}>
              {[
                {
                  cat: "Product",
                  d: "Why Hark exists, who it's for, what success looks like at v1.",
                  links: [
                    { t: "01 · Vision & personas",        n: "01"  },
                    { t: "02 · Success metrics",          n: "02"  },
                    { t: "03 · Roadmap · v1 / v1.5 / v2", n: "03"  },
                    { t: "04 · User journeys",            n: "04"  },
                    { t: "05 · User stories & ACs",       n: "05"  },
                  ],
                },
                {
                  cat: "Architecture",
                  d: "How the audio, transcript, and RAG pipelines fit together.",
                  links: [
                    { t: "06 · Architecture overview", n: "06" },
                    { t: "07 · Data flows · audio + RAG", n: "07" },
                    { t: "08 · WebSocket API contract", n: "08" },
                    { t: "11 · UI visual brief",        n: "11" },
                  ],
                },
                {
                  cat: "QA",
                  d: "What we test, how, and the privacy-test checklist that gates ship.",
                  links: [
                    { t: "09 · Test strategy",         n: "09" },
                    { t: "10 · Performance benchmarks", n: "10" },
                    { t: "Privacy test checklist",      n: "PT" },
                  ],
                },
              ].map((col) => (
                <div key={col.cat} style={{
                  padding: 22,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{col.cat}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, lineHeight: 1.55 }}>{col.d}</div>
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                    {col.links.map((l) => (
                      <a key={l.t} style={{
                        display: "grid",
                        gridTemplateColumns: "32px 1fr 14px",
                        gap: 8,
                        padding: "8px 8px",
                        margin: "0 -8px",
                        borderRadius: 5,
                        alignItems: "center",
                        fontSize: 13,
                        color: "var(--text)",
                        cursor: "pointer",
                      }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)" }}>{l.n}</span>
                        <span>{l.t}</span>
                        <Icon name="chevron" size={12} style={{ color: "var(--text-3)" }} />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div style={{
            padding: "32px 96px 56px",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32,
              padding: "28px 32px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg-2)",
            }}>
              {[
                { v: "0.18", k: "RTF on M2 (lower is faster)", c: "var(--accent)" },
                { v: "<350ms", k: "First-caption latency", c: "var(--text)" },
                { v: "0", k: "Bytes of audio to cloud", c: "var(--status-success)" },
                { v: "MIT", k: "License", c: "var(--text)" },
              ].map((s) => (
                <div key={s.k}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-3)", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "20px 96px",
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-3)",
            display: "flex",
            gap: 18,
            alignItems: "center",
          }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>© 2026 Hark · MIT</span>
            <span>·</span>
            <a>GitHub</a>
            <a>Changelog</a>
            <a>ADRs</a>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-mono)" }}>Last commit: 4f8a21c · 2 hours ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HarkMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--accent)" />
      <path d="M7 9v6M10 7v10M13 10v4M16 8v8M19 11v2" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PathRow({ icon, label, sub, color }) {
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "center",
      padding: "8px 10px",
      borderRadius: 6,
      border: "1px solid var(--border)",
      background: "var(--bg-2)",
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 5,
        background: "var(--bg)", color: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={12} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color }}>{label}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)" }}>{sub}</div>
      </div>
    </div>
  );
}

function PathArrow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", color: "var(--text-3)" }}>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
        <path d="M5 1v11M2 9l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Doc template page
// ─────────────────────────────────────────────────────────────────────

function DocPage({ theme = "dark" }) {
  return (
    <div data-theme={theme} className="app-shell" style={{ width: 1280, height: 900 }}>
      <div style={{
        width: 1280, height: 900,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Top nav (compact) */}
        <div style={{
          display: "flex", alignItems: "center", gap: 24,
          padding: "12px 28px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HarkMark />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Hark / Docs</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-3)",
            width: 220,
          }}>
            <Icon name="search" size={12} />
            <span>Search</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 5px", border: "1px solid var(--border)", borderRadius: 3 }}>⌘K</span>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "240px 1fr 240px" }}>
          {/* Left nav */}
          <div className="scroll-y" style={{ borderRight: "1px solid var(--border)", padding: "18px 16px", background: "var(--bg-2)" }}>
            {[
              { g: "Product", items: ["01 Vision & personas", "02 Success metrics", "03 Roadmap"] },
              { g: "Analysis", items: ["04 User journeys", "05 User stories"] },
              { g: "Design", items: ["06 Architecture", "07 Data flows", "08 WebSocket API", "11 UI visual brief"], active: "07 Data flows" },
              { g: "QA", items: ["09 Test strategy", "10 Perf benchmarks"] },
              { g: "Decisions (ADR)", items: ["0001 Electron over Tauri", "0002 macOS-only scope", "0003 Swift + WhisperKit engine"] },
            ].map((sec) => (
              <div key={sec.g} style={{ marginBottom: 16 }}>
                <Eyebrow style={{ padding: "0 6px 6px" }}>{sec.g}</Eyebrow>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {sec.items.map((it) => {
                    const isActive = sec.active === it;
                    return (
                      <a key={it} style={{
                        padding: "5px 8px",
                        borderRadius: 4,
                        fontSize: 12.5,
                        color: isActive ? "var(--accent)" : "var(--text-2)",
                        background: isActive ? "var(--accent-soft)" : "transparent",
                        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                        marginLeft: -2,
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                      }}>{it}</a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="scroll-y" style={{ padding: "40px 56px", minHeight: 0 }}>
            <div style={{ maxWidth: 680 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Design · doc 07
              </div>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: 38,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "8px 0 8px",
              }}>Data flows</h1>
              <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>
                Four pipelines move data through Hark — audio, transcript, RAG, and vault sync.
                This doc walks each with sequence diagrams and the latency budget they share.
              </p>

              <div style={{
                marginTop: 18, display: "flex", gap: 8, alignItems: "center",
                fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-3)",
              }}>
                <span>Last updated 2026-05-22</span>
                <span>·</span>
                <span>Owner: Dev</span>
                <span>·</span>
                <span style={{ color: "var(--status-success)" }}>● accepted</span>
                <span>·</span>
                <a style={{ color: "var(--accent)" }}>Edit on GitHub</a>
              </div>

              {/* Callout */}
              <div style={{
                marginTop: 28,
                padding: "14px 16px",
                borderRadius: 8,
                background: "var(--accent-soft)",
                border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
                borderLeft: "3px solid var(--accent)",
                display: "flex",
                gap: 10,
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--text)",
              }}>
                <Icon name="info" size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Audio never leaves the device.</strong> The only IPC over the network is
                  redacted text to Claude. Audit this contract in <a style={{ color: "var(--accent)" }}>08-websocket-api-contract</a>.
                </div>
              </div>

              <h2 style={{ marginTop: 36, fontSize: 22, fontWeight: 600, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                Audio pipeline
              </h2>
              <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.65 }}>
                System audio (via ScreenCaptureKit) and microphone (via CoreAudio) are mixed into
                a single 16kHz PCM stream and fed to the Swift engine. The engine
                exposes a WebSocket on <code style={inlineCode()}>127.0.0.1:7311</code> that the Electron UI subscribes to for
                partial and finalized transcript chunks.
              </p>

              {/* Mermaid-style diagram block */}
              <div style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}>
                <Eyebrow>Sequence · capture → caption</Eyebrow>
                <div style={{
                  marginTop: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "var(--text-2)",
                }}>
                  <div><span style={{ color: "var(--sp-2)" }}>CoreAudio</span>     →  Swift engine     <span style={{ color: "var(--text-3)" }}>{"// 16kHz PCM, 20ms frames"}</span></div>
                  <div><span style={{ color: "var(--sp-3)" }}>ScreenCaptureKit</span> →  Swift engine     <span style={{ color: "var(--text-3)" }}>{"// system audio tap"}</span></div>
                  <div>Swift engine    →  <span style={{ color: "var(--sp-1)" }}>VAD (Silero)</span>     <span style={{ color: "var(--text-3)" }}>{"// speech vs silence"}</span></div>
                  <div>VAD             →  <span style={{ color: "var(--sp-4)" }}>WhisperKit</span>       <span style={{ color: "var(--text-3)" }}>{"// large-v3-turbo · ANE"}</span></div>
                  <div>WhisperKit      →  <span style={{ color: "var(--sp-6)" }}>WebSocket</span>        <span style={{ color: "var(--text-3)" }}>{"// {type: 'partial', text…}"}</span></div>
                  <div>WebSocket       →  Electron UI       <span style={{ color: "var(--text-3)" }}>{"// React render @60fps"}</span></div>
                </div>
              </div>

              {/* Code block */}
              <h2 style={{ marginTop: 36, fontSize: 22, fontWeight: 600, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                Message contract
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.65 }}>
                Partials are append-only deltas keyed by <code style={inlineCode()}>segment_id</code>; the UI replaces
                the in-flight line as the model revises.
              </p>
              <pre style={{
                marginTop: 12,
                padding: "16px 18px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--text)",
                overflow: "hidden",
              }}>
                <span style={{ color: "var(--text-3)" }}>{"// 8.1 partial caption"}</span>{"\n"}
                <span style={{ color: "var(--sp-4)" }}>{"{"}</span>{"\n"}
                {"  "}<span style={{ color: "var(--sp-3)" }}>"type"</span>: <span style={{ color: "var(--sp-2)" }}>"partial"</span>,{"\n"}
                {"  "}<span style={{ color: "var(--sp-3)" }}>"segment_id"</span>: <span style={{ color: "var(--sp-2)" }}>"seg_4f8a"</span>,{"\n"}
                {"  "}<span style={{ color: "var(--sp-3)" }}>"speaker"</span>: <span style={{ color: "var(--sp-2)" }}>"spk_2"</span>,{"\n"}
                {"  "}<span style={{ color: "var(--sp-3)" }}>"t_start_ms"</span>: <span style={{ color: "var(--accent)" }}>132040</span>,{"\n"}
                {"  "}<span style={{ color: "var(--sp-3)" }}>"text"</span>: <span style={{ color: "var(--sp-2)" }}>"…enumerate downstream services we share PII"</span>,{"\n"}
                {"  "}<span style={{ color: "var(--sp-3)" }}>"confidence"</span>: <span style={{ color: "var(--accent)" }}>0.91</span>{"\n"}
                <span style={{ color: "var(--sp-4)" }}>{"}"}</span>
              </pre>

              {/* Warning callout */}
              <div style={{
                marginTop: 24,
                padding: "12px 16px",
                borderRadius: 8,
                background: "color-mix(in oklab, var(--status-warning) 12%, transparent)",
                border: "1px solid color-mix(in oklab, var(--status-warning) 30%, transparent)",
                borderLeft: "3px solid var(--status-warning)",
                display: "flex",
                gap: 10,
                fontSize: 13,
                lineHeight: 1.55,
              }}>
                <Icon name="alert" size={14} style={{ color: "var(--status-warning)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Don't trust partials.</strong> The UI must accept <code style={inlineCode()}>final</code> messages as the
                  source of truth for vault writes. Partials can be revised or withdrawn.
                </div>
              </div>
            </div>
          </div>

          {/* Right outline */}
          <div className="scroll-y" style={{
            borderLeft: "1px solid var(--border)",
            padding: "40px 18px",
            background: "var(--bg)",
            fontSize: 12,
          }}>
            <Eyebrow style={{ marginBottom: 8 }}>On this page</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { t: "Audio pipeline", l: 0, active: true },
                { t: "Message contract", l: 0, active: false },
                { t: "Transcript pipeline", l: 0 },
                { t: "RAG pipeline", l: 0 },
                { t: "Vault sync", l: 0 },
                { t: "Latency budget", l: 0 },
              ].map((o, i) => (
                <a key={i} style={{
                  paddingLeft: o.l * 12,
                  fontSize: 12,
                  color: o.active ? "var(--accent)" : "var(--text-2)",
                  borderLeft: o.active ? "2px solid var(--accent)" : "2px solid transparent",
                  paddingLeft: 8 + o.l * 10,
                  marginLeft: -10,
                  cursor: "pointer",
                  fontWeight: o.active ? 600 : 400,
                }}>{o.t}</a>
              ))}
            </div>

            <div style={{ height: 24 }} />
            <Eyebrow style={{ marginBottom: 8 }}>Related</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <a style={{ color: "var(--text-2)" }}>06 Architecture overview</a>
              <a style={{ color: "var(--text-2)" }}>08 WebSocket API contract</a>
              <a style={{ color: "var(--text-2)" }}>ADR 0003 — Swift + WhisperKit engine</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function inlineCode() {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: "0.88em",
    padding: "1px 5px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    color: "var(--accent)",
  };
}

window.DocsLanding = DocsLanding;
window.DocPage = DocPage;
