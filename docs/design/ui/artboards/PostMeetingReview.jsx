/* global React, Icon, MacWindow, Eyebrow, SPEAKER_COLORS, SpeakerTag */

function PostMeetingReview({ theme = "dark" }) {
  const [tab, setTab] = React.useState("summary");
  const tabs = [
    { id: "summary",     label: "Summary",        count: null },
    { id: "actions",     label: "Action items",   count: 5    },
    { id: "decisions",   label: "Decisions",      count: 3    },
    { id: "questions",   label: "Open questions", count: 2    },
    { id: "transcript",  label: "Full transcript", count: null },
    { id: "speakers",    label: "Speakers",       count: 4    },
  ];

  return (
    <div data-theme={theme} className="app-shell" style={{ width: 1100, height: 780 }}>
      <MacWindow
        title="Review — Q3 Vendor Review · 38m"
        width={1100}
        height={780}
      >
        {/* Meeting header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: 8,
            background: "var(--surface)",
            border: "1px solid var(--border-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)",
          }}>
            <Icon name="waveform" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.015em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              Q3 Vendor Review — Acme × Tessera
              <Icon name="ellipsis" size={14} style={{ color: "var(--text-3)" }} />
            </div>
            <div style={{
              fontSize: 12,
              color: "var(--text-2)",
              marginTop: 3,
              fontFamily: "var(--font-mono)",
              display: "flex",
              gap: 12,
            }}>
              <span>Fri 24 May · 14:00–14:38</span>
              <span>·</span>
              <span>4 speakers</span>
              <span>·</span>
              <span>3 bookmarks</span>
              <span>·</span>
              <span style={{ color: "var(--accent)" }}>vault://meetings/2026-05-24-tessera.md</span>
            </div>
          </div>
          <button className="btn btn-secondary"><Icon name="folder" size={12} /> Open in Obsidian</button>
          <button className="btn btn-primary"><Icon name="check" size={12} /> Confirm & file</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: 4,
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
        }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                color: tab === t.id ? "var(--text)" : "var(--text-2)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: -1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-ui)",
              }}
            >
              {t.label}
              {t.count != null && (
                <span style={{
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: tab === t.id ? "var(--accent-soft)" : "var(--surface)",
                  border: "1px solid var(--border)",
                  color: tab === t.id ? "var(--accent)" : "var(--text-3)",
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 320px" }}>
          {/* Main pane: Summary */}
          <div className="scroll-y" style={{ padding: "24px 32px", borderRight: "1px solid var(--border)" }}>
            <Eyebrow>TL;DR</Eyebrow>
            <div style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--text)",
              maxWidth: 640,
            }}>
              Vendor counsel is asking for full sub-processor enumeration in §4.2 of the DPA.
              Linh is pulling the March Tessera redline where you negotiated the same scope down
              to audio-handling sub-processors only — if it lands, the deal closes this sprint.
              Open: on-prem four-nines SLA, which staging uptime (99.94%) doesn't yet support.
            </div>

            <div style={{ height: 24 }} />
            <Eyebrow>Chapters · 4</Eyebrow>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { t: "Agenda & framing",          time: "00:00 – 02:30", n: 0, hl: false },
                { t: "DPA §4.2 sub-processors",   time: "02:30 – 14:10", n: 1, hl: true  },
                { t: "On-prem SLA negotiation",   time: "14:10 – 28:45", n: 2, hl: false },
                { t: "Next-steps & owners",       time: "28:45 – 38:02", n: 3, hl: false },
              ].map((c, i) => (
                <button key={i} style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: c.hl ? "var(--accent-soft)" : "var(--surface)",
                  border: `1px solid ${c.hl ? "color-mix(in oklab, var(--accent) 30%, transparent)" : "var(--border)"}`,
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto auto",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  fontFamily: "var(--font-ui)",
                }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-3)",
                  }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{c.t}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{c.time}</span>
                  <Icon name="chevron" size={12} style={{ color: "var(--text-3)" }} />
                </button>
              ))}
            </div>

            <div style={{ height: 24 }} />
            <Eyebrow>Action items · 5</Eyebrow>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { d: true,  t: "Send DPA §4.2 enumeration draft to compliance", o: "Linh Nguyễn", by: "EOD Fri" },
                { d: false, t: "Pull Tessera March redline as anchor",          o: "Linh Nguyễn", by: "Today" },
                { d: false, t: "Confirm staging uptime methodology with ops",   o: "Alice Chen",  by: "Mon"   },
                { d: false, t: "Draft counter on 99.991 SLA with planned-window exclusion", o: "Alice Chen", by: "Tue" },
                { d: false, t: "Schedule joint call with vendor counsel",       o: "Ahmed K.",    by: "Wed"   },
              ].map((a, i) => (
                <div key={i} style={{
                  padding: "8px 12px",
                  display: "grid",
                  gridTemplateColumns: "16px 1fr 120px 80px",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `1.5px solid ${a.d ? "var(--accent)" : "var(--border-2)"}`,
                    background: a.d ? "var(--accent)" : "transparent",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {a.d && <Icon name="check" size={9} style={{ color: "#fff" }} />}
                  </span>
                  <span style={{
                    color: a.d ? "var(--text-3)" : "var(--text)",
                    textDecoration: a.d ? "line-through" : "none",
                  }}>{a.t}</span>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{a.o}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>by {a.by}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 24 }} />
            <Eyebrow>Decisions</Eyebrow>
            <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 13.5, color: "var(--text)", lineHeight: 1.7 }}>
              <li>Match Tessera March scope: enumerate only <em>audio-handling</em> sub-processors</li>
              <li>Use planned-window-excluded uptime in counter; do not commit four-nines yet</li>
              <li>File this meeting under <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>vault/meetings/tessera/</span></li>
            </ul>
          </div>

          {/* Side: cloud activity + privacy */}
          <div className="scroll-y" style={{ padding: "20px 18px", background: "var(--bg-2)" }}>
            <Eyebrow>Summary generated with</Eyebrow>
            <div style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              border: "1px dashed color-mix(in oklab, var(--status-cloud) 35%, transparent)",
              background: "color-mix(in oklab, var(--status-cloud) 10%, transparent)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="cloud" size={13} style={{ color: "var(--status-cloud)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Claude API · sonnet</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                PII redacted: 4 names, 1 dollar figure, 1 phone number. Audio never sent.
                <a style={{ color: "var(--accent)", display: "block", marginTop: 6 }}>View redaction log →</a>
              </div>
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)",
                fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)",
                display: "flex", justifyContent: "space-between",
              }}>
                <span>~3,200 in · 480 out</span>
                <span style={{ color: "var(--text-2)" }}>$0.014</span>
              </div>
            </div>

            <div style={{ height: 20 }} />
            <Eyebrow>Speakers · 4</Eyebrow>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { c: SPEAKER_COLORS[0], n: "Alice Chen",  d: "12m 04s" },
                { c: SPEAKER_COLORS[1], n: "Linh Nguyễn", d: "9m 38s"  },
                { c: SPEAKER_COLORS[2], n: "Ahmed K.",     d: "11m 12s" },
              ].map((s) => (
                <div key={s.n} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 0",
                }}>
                  <span className="sp-chip" style={{ background: s.c, width: 10, height: 10 }} />
                  <div style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>
                    {s.n}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{s.d}</div>
                </div>
              ))}

              {/* Unlabeled — inline resolution */}
              <div style={{
                marginTop: 4,
                padding: 10,
                borderRadius: 8,
                background: "color-mix(in oklab, var(--status-warning) 8%, transparent)",
                border: "1px dashed color-mix(in oklab, var(--status-warning) 35%, transparent)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="sp-chip" style={{ background: SPEAKER_COLORS[3], width: 10, height: 10 }} />
                  <div style={{ flex: 1, fontSize: 13, color: "var(--text-2)", fontStyle: "italic" }}>
                    Speaker 4 — unlabeled
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>5m 08s</div>
                </div>
                {/* Mini waveform sample with play */}
                <div style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}>
                  <button style={{
                    width: 22, height: 22,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "var(--bg)",
                    border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}>
                    <Icon name="play" size={9} />
                  </button>
                  <MiniWaveform />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)" }}>0:08</span>
                </div>
                <input
                  className="input"
                  placeholder="Who is this? Type a name…"
                  style={{
                    marginTop: 8,
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                  audio sample stays on this Mac · never uploaded
                </div>
              </div>
            </div>

            <div style={{ height: 24 }} />
            <Eyebrow>Vault</Eyebrow>
            <div style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--text-2)",
              lineHeight: 1.55,
            }}>
              meetings/<wbr />
              tessera/<wbr />
              <span style={{ color: "var(--text)" }}>2026-05-24-q3-review.md</span>
              <div style={{
                marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)",
                fontFamily: "var(--font-ui)",
                color: "var(--text-3)",
                fontSize: 11,
                display: "flex",
                gap: 10,
              }}>
                <span style={{ color: "var(--status-success)" }}>● git clean</span>
                <span>2 backlinks</span>
              </div>
            </div>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

window.PostMeetingReview = PostMeetingReview;

function MiniWaveform() {
  // Static SVG waveform — deterministic, no Math.random
  const heights = [3,5,7,4,8,6,10,7,9,5,11,6,8,4,7,9,5,8,6,10,4,7,5,9,6,8,4,7,5,6];
  return (
    <svg viewBox={`0 0 ${heights.length * 3} 14`} width={heights.length * 3} height={14} style={{ flex: 1, display: "block" }} preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect key={i} x={i * 3} y={(14 - h) / 2} width={1.6} height={h} rx={0.8}
          fill={i < 12 ? "var(--accent)" : "var(--text-3)"} />
      ))}
    </svg>
  );
}
