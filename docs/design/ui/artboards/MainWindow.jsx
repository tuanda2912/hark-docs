/* global React, Icon, MacWindow, TranscriptLine, SpeakerTag, StatusBanner, Eyebrow, SAMPLE_TRANSCRIPT, SPEAKER_COLORS, AudioMeter, TermCard, BookmarkHover */

function MainWindow({ theme = "dark", variant = "default" }) {
  const speakers = [
    { name: "Alice Chen",   color: SPEAKER_COLORS[0], tagged: true,  meta: "Host · Acme" },
    { name: "Linh Nguyễn",  color: SPEAKER_COLORS[1], tagged: true,  meta: "PM · Vendor"  },
    { name: "Ahmed K.",     color: SPEAKER_COLORS[2], tagged: true,  meta: "Counsel"      },
    { name: "Speaker 4",    color: SPEAKER_COLORS[3], tagged: false, meta: "Unlabeled — 1m 14s spoken" },
  ];

  return (
    <div data-theme={theme} className="app-shell" style={{ width: 1100, height: 700 }}>
      <MacWindow
        title="Q3 Vendor Review — Acme × Tessera"
        width={1100}
        height={700}
        accessory={
          <>
            <button className="icon-btn" title="Toggle left sidebar"><Icon name="sidebar" size={14} /></button>
            <button className="icon-btn" title="Toggle right panel"><Icon name="panelRight" size={14} /></button>
          </>
        }
      >
        {/* Top bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="rec-dot" />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--status-recording)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}>REC 00:14:27</span>
          </div>
          <AudioMeter style={{ color: "var(--accent)" }} />
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }}>
            <Icon name="pause" size={12} /> Pause
          </button>
          <button className="btn btn-ghost" style={{ padding: "4px 10px" }}>
            <Icon name="bookmark" size={12} /> Bookmark
            <span style={{
              marginLeft: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-3)",
              padding: "1px 4px",
              border: "1px solid var(--border)",
              borderRadius: 3,
            }}>⌘⇧B</span>
          </button>
          <div style={{ flex: 1 }} />
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
            padding: "3px 8px",
            border: "1px solid var(--border)",
            borderRadius: 999,
            background: "var(--bg-2)",
          }}>
            <Icon name="cloudOff" size={12} />
            audio · local-only
          </div>
          <button className="icon-btn"><Icon name="settings" size={15} /></button>
        </div>

        {/* Status banner */}
        <StatusBanner tone="warning" icon="alert" action={
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "3px 8px" }}>Review</button>
        }>
          Translation switched to <strong style={{ color: "var(--text)" }}>local model</strong> — Claude API rate limit reached. Quality may be lower.
        </StatusBanner>

        {/* 3-column body */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "240px 1fr 320px",
        }}>
          {/* LEFT: Speakers */}
          <div style={{
            borderRight: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}>
            <div style={{ padding: "14px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow>Attendees · 4</Eyebrow>
              <button className="icon-btn" title="Add speaker"><Icon name="plus" size={12} /></button>
            </div>
            <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {speakers.map((s) => (
                <div key={s.name} style={{
                  padding: "10px 8px",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  background: !s.tagged ? "color-mix(in oklab, var(--status-warning) 8%, transparent)" : "transparent",
                  border: !s.tagged ? "1px dashed color-mix(in oklab, var(--status-warning) 35%, transparent)" : "1px solid transparent",
                }}>
                  <span className="sp-chip" style={{ background: s.color, marginTop: 5, width: 10, height: 10 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: s.tagged ? "var(--text)" : "var(--text-2)",
                      fontStyle: s.tagged ? "normal" : "italic",
                    }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{s.meta}</div>
                    {!s.tagged && (
                      <button className="btn btn-secondary" style={{
                        marginTop: 6,
                        fontSize: 11,
                        padding: "3px 8px",
                      }}>Who is this?</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--text-3)",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span>diarization · FluidAudio</span>
              <span style={{ color: "var(--status-success)" }}>● 0.94</span>
            </div>
          </div>

          {/* CENTER: Transcript */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            background: "var(--bg)",
            position: "relative",
          }}>
            <div style={{
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderBottom: "1px solid var(--border)",
            }}>
              <Eyebrow>Live transcript</Eyebrow>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>· auto-scroll</span>
              <div style={{ flex: 1 }} />
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 999,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
                fontFamily: "var(--font-mono)",
              }}>
                <Icon name="languages" size={12} />
                <span style={{ color: "var(--text)" }}>VI</span>
                <Icon name="arrow" size={10} style={{ color: "var(--text-3)" }} />
                <span style={{ color: "var(--text)" }}>EN</span>
              </div>
            </div>

            <div className="scroll-y" style={{
              flex: 1,
              padding: "8px 24px 24px",
              minHeight: 0,
            }}>
              {SAMPLE_TRANSCRIPT.map((t, i) => (
                <TranscriptLine
                  key={i}
                  speaker={t.speaker}
                  speakerColor={t.color}
                  time={t.time}
                  text={t.text}
                  translation={t.translation}
                  bookmarked={t.bookmarked}
                  citation={t.citation}
                  variant={variant === "compact" ? "compact" : "default"}
                />
              ))}
              {/* live partial */}
              <div style={{ padding: "10px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
                <span className="sp-chip tx-speaker-chip" style={{ background: SPEAKER_COLORS[0] }} />
                <span className="tx-speaker" style={{ "--sp-color": SPEAKER_COLORS[0] }}>Alice Chen</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>00:03:51</span>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.55, paddingLeft: 16, color: "var(--text-2)", fontStyle: "italic" }}>
                So if we exclude the migration window the SLA math actually—
                <span className="live-caret" />
              </div>
            </div>

            {/* Floating term card over the [[Tessera deal]] wikilink in line 3 — demonstrates hover behavior. */}
            <div style={{
              position: "absolute",
              top: 80,
              left: 220,
              zIndex: 10,
              pointerEvents: "none",
            }}>
              {/* Arrow pointing down at the wikilink */}
              <div style={{
                width: 10, height: 10,
                background: "var(--surface)",
                borderRight: "1px solid var(--border-2)",
                borderBottom: "1px solid var(--border-2)",
                transform: "rotate(45deg)",
                position: "absolute",
                bottom: -6,
                left: 70,
              }} />
              <TermCard
                term="Tessera deal"
                path="vault/meetings/2026-03-14-tessera-counsel.md"
                excerpt="Negotiated §4.2 down to audio-handling sub-processors only. Counsel agreed; redline lives in /legal/redlines/tessera-march.diff."
                updated="Mar 14 · Linh"
                backlinks={7}
              />
            </div>

            {/* Footer */}
            <div style={{
              padding: "8px 24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-3)",
            }}>
              <span>1,284 words · 14m 27s</span>
              <span>·</span>
              <span>3 bookmarks</span>
              <span>·</span>
              <span>2 vault links</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: "var(--status-success)" }}>● WhisperKit · large-v3-turbo</span>
              <span>· RTF 0.18</span>
            </div>
          </div>

          {/* RIGHT: Q&A panel preview */}
          <div style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
              <Eyebrow>Ask · ⌘⇧Q</Eyebrow>
              <div style={{ flex: 1 }} />
              <button className="icon-btn"><Icon name="x" size={12} /></button>
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                borderRadius: 6,
                padding: "8px 10px",
              }}>
                <Icon name="search" size={13} style={{ color: "var(--text-3)" }} />
                <span style={{ fontSize: 13, color: "var(--text)" }}>What did we decide about §4.2 sub-processors?</span>
              </div>
            </div>
            <div className="scroll-y" style={{ flex: 1, padding: "4px 14px 14px", minHeight: 0 }}>
              <Eyebrow style={{ margin: "6px 0 8px" }}>Answer · streaming</Eyebrow>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text)" }}>
                On the Tessera deal you narrowed §4.2 to <em>audio-handling sub-processors only</em>
                <sup style={{ marginLeft: 2, fontSize: 9, color: "var(--accent)" }}>[1]</sup>.
                The vendor's counsel today is asking for the broader version. Linh is pulling the
                March redline to anchor the same scope
                <sup style={{ marginLeft: 2, fontSize: 9, color: "var(--accent)" }}>[2]</sup>.
              </div>

              <Eyebrow style={{ margin: "16px 0 8px" }}>Sources · 2</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { n: 1, t: "Tessera DPA redline · 2026-03-14", s: "narrowed §4.2 sub-processor enumeration to audio-only…" },
                  { n: 2, t: "This meeting · 00:02:11", s: "Linh: \"negotiated it down — chỉ enumerate ones that handle audio.\"" },
                ].map((c) => (
                  <div key={c.n} style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    fontSize: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 3,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                      }}>{c.n}</span>
                      <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 500 }}>{c.t}</span>
                    </div>
                    <div style={{ color: "var(--text-2)", lineHeight: 1.5, paddingLeft: 22 }}>{c.s}</div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 16,
                padding: 10,
                borderRadius: 6,
                background: "color-mix(in oklab, var(--status-cloud) 10%, transparent)",
                border: "1px dashed color-mix(in oklab, var(--status-cloud) 35%, transparent)",
                display: "flex",
                gap: 8,
                fontSize: 11.5,
                color: "var(--text-2)",
                lineHeight: 1.45,
              }}>
                <Icon name="cloud" size={13} style={{ color: "var(--status-cloud)", flexShrink: 0, marginTop: 1 }} />
                <span>
                  Q&A used Claude API · PII redacted (3 names, 1 dollar amount).
                  <a style={{ color: "var(--accent)", marginLeft: 4 }}>View log</a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

window.MainWindow = MainWindow;
