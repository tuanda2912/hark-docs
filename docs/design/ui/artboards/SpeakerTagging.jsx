/* global React, Icon, MacWindow, Eyebrow, SPEAKER_COLORS */
/* Interactive: click "Who is this?" → modal with audio snippets + name entry + save.
   After save, the row transitions to a confirmed state with a "voiceprint saved" toast.
   Separate artboard shows the (Alice?) ambiguous chip with confirm/correct actions. */

const { useState: useStateST, useEffect: useEffectST, useRef: useRefST } = React;

// ─────────────────────────────────────────────────────────────────────
// Mini playable audio snippet — animated bars + playhead
// ─────────────────────────────────────────────────────────────────────
function PlayableSnippet({ duration = 8, heights, accent = "var(--accent)" }) {
  const [playing, setPlaying] = useStateST(false);
  const [pos, setPos] = useStateST(0); // 0..1
  const rafRef = useRefST(null);
  const startRef = useRefST(null);

  useEffectST(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now() - pos * duration * 1000;
    const tick = (now) => {
      const elapsed = (now - startRef.current) / 1000;
      const next = Math.min(elapsed / duration, 1);
      setPos(next);
      if (next >= 1) { setPlaying(false); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]); // eslint-disable-line

  const toggle = () => {
    if (pos >= 1) setPos(0);
    setPlaying((p) => !p);
  };

  const mm = Math.floor(pos * duration);
  const ss = Math.floor((pos * duration - mm) * 60).toString().padStart(2, "0");

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px",
      borderRadius: 8,
      background: "var(--surface)",
      border: "1px solid var(--border)",
    }}>
      <button onClick={toggle} style={{
        width: 26, height: 26, borderRadius: "50%",
        background: accent, color: "var(--bg)",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name={playing ? "pause" : "play"} size={10} style={{ marginLeft: playing ? 0 : 1 }} />
      </button>
      <div style={{ position: "relative", flex: 1, height: 18, display: "flex", alignItems: "center", gap: 1.5 }}>
        {heights.map((h, i) => {
          const barP = i / (heights.length - 1);
          const played = barP <= pos;
          return (
            <span key={i} style={{
              flex: 1,
              height: h + "px",
              borderRadius: 1.2,
              background: played ? accent : "color-mix(in oklab, var(--text-3) 55%, transparent)",
              transition: "background 0.05s linear",
            }} />
          );
        })}
        <span style={{
          position: "absolute",
          left: `calc(${pos * 100}% - 1px)`,
          top: -2, bottom: -2,
          width: 2,
          background: accent,
          opacity: playing || pos > 0 ? 1 : 0,
          transition: "opacity 0.15s",
          borderRadius: 1,
        }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)", width: 32, textAlign: "right" }}>
        {String(mm).padStart(2,"0")}:{ss}
      </span>
    </div>
  );
}

// Deterministic waveform heights (so the design is stable)
const WF_A = [4,7,10,6,12,8,14,9,11,7,13,8,10,6,9,12,7,10,8,13,5,9,6,11,7,10,8,12,6,9,4,7,5];
const WF_B = [3,5,8,12,7,10,6,9,11,7,4,8,6,13,9,5,11,7,10,6,8,4,9,12,7,10,5,8,11,6,9,7,4];
const WF_C = [5,9,6,11,8,4,13,7,10,6,8,12,5,9,11,7,4,10,6,8,13,9,5,11,7,10,6,8,4,9,12,6,7];

// ─────────────────────────────────────────────────────────────────────
// Tagging modal — interactive: play snippets, type name, save, see toast
// ─────────────────────────────────────────────────────────────────────
function SpeakerTaggingModal({ theme = "dark" }) {
  const [name, setName] = useStateST("");
  const [saved, setSaved] = useStateST(false);

  const suggestions = ["Linh Nguyễn", "Bao Trần", "Mai Phạm"]; // from prior vault speakers w/ similar but sub-threshold embedding
  const canSave = name.trim().length >= 2 && !saved;

  return (
    <div data-theme={theme} className="app-shell" style={{
      width: 860, height: 620,
      borderRadius: 12,
      border: "1px solid var(--border-2)",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Dimmed parent context — barely-visible transcript hint */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, var(--bg-2) 0%, var(--bg) 100%)",
        opacity: 0.6,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "color-mix(in oklab, var(--bg) 55%, transparent)",
        backdropFilter: "blur(4px)",
      }} />

      {/* Faux page chrome behind modal */}
      <div style={{
        position: "absolute", top: 14, left: 14, right: 14,
        display: "flex", alignItems: "center", gap: 8,
        color: "var(--text-3)", fontSize: 11.5, fontFamily: "var(--font-mono)",
        opacity: 0.55,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ed6a5e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f5be4f" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#62c554" }} />
        <span style={{ marginLeft: 12 }}>Q3 Vendor Review — Acme × Tessera</span>
        <span style={{ marginLeft: "auto" }}>· paused while you label</span>
      </div>

      {/* Modal card */}
      <div style={{
        position: "relative",
        margin: "auto",
        width: 640,
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        boxShadow: "var(--shadow-modal)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span className="sp-chip" style={{
            background: SPEAKER_COLORS[3],
            width: 14, height: 14, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
            }}>
              Who is <span style={{ color: SPEAKER_COLORS[3] }}>Speaker 4</span>?
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
              5m 08s spoken · 3 segments · clustered by voice only
            </div>
          </div>
          <button className="icon-btn" title="Close" disabled={saved}><Icon name="x" size={13} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px 4px" }}>
          <Eyebrow>Listen · 3 representative snippets</Eyebrow>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <PlayableSnippet duration={8}  heights={WF_A} accent={SPEAKER_COLORS[3]} />
            <PlayableSnippet duration={6}  heights={WF_B} accent={SPEAKER_COLORS[3]} />
            <PlayableSnippet duration={11} heights={WF_C} accent={SPEAKER_COLORS[3]} />
          </div>
          <div style={{
            marginTop: 6, fontSize: 10.5,
            fontFamily: "var(--font-mono)", color: "var(--text-3)",
          }}>
            audio stays on this Mac · samples taken from §4.2 chapter
          </div>
        </div>

        {/* Suggestions */}
        <div style={{ padding: "12px 20px 4px" }}>
          <Eyebrow>Hark thinks it might be one of these <span style={{ color: "var(--text-3)", fontWeight: 400 }}>· sub-threshold matches</span></Eyebrow>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {suggestions.map((s, i) => {
              const pct = [62, 51, 44][i];
              const selected = name === s;
              return (
                <button key={s}
                  onClick={() => !saved && setName(s)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 10px 5px 8px",
                    borderRadius: 999,
                    border: selected
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border-2)",
                    background: selected ? "var(--accent-soft)" : "var(--bg-2)",
                    color: selected ? "var(--accent)" : "var(--text)",
                    fontSize: 12,
                    cursor: saved ? "default" : "pointer",
                    fontFamily: "var(--font-ui)",
                  }}>
                  <Icon name="user" size={11} />
                  {s}
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: selected ? "var(--accent)" : "var(--text-3)",
                    marginLeft: 2,
                  }}>{pct}%</span>
                </button>
              );
            })}
            <span style={{ alignSelf: "center", marginLeft: 4, fontSize: 11, color: "var(--text-3)" }}>or type below</span>
          </div>
        </div>

        {/* Name input */}
        <div style={{ padding: "14px 20px 16px" }}>
          <Eyebrow>Name</Eyebrow>
          <div style={{ marginTop: 6, position: "relative" }}>
            <input
              className="input"
              placeholder="Linh Nguyễn · or any name"
              value={name}
              onChange={(e) => !saved && setName(e.target.value)}
              style={{
                width: "100%",
                fontSize: 14,
                padding: "10px 12px",
                paddingRight: name && !saved ? 30 : 12,
              }}
              autoFocus
            />
            {name && !saved && (
              <button
                onClick={() => setName("")}
                title="Clear"
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "transparent", border: "none",
                  color: "var(--text-3)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <Icon name="x" size={10} />
              </button>
            )}
          </div>

          {/* Privacy receipt */}
          <div style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="shield" size={13} style={{ color: "var(--status-success)" }} />
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>
                Voiceprint will save to
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", marginLeft: 4 }}>
                  vault/.speakers/{slugify(name) || "<name>"}.json
                </span>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="cloudOff" size={13} style={{ color: "var(--status-success)" }} />
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Embedding ({"~"}3KB) never leaves this Mac. Used only to recognize this voice in future meetings.
              </span>
            </div>
            <div style={{
              marginTop: 2,
              paddingTop: 8,
              borderTop: "1px dashed var(--border)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Icon name="shield" size={13} style={{ color: "var(--text-3)" }} />
              <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>
                Names are redacted before any cloud summary request.{" "}
                <span style={{ color: "var(--text-3)" }}>(currently <strong style={{ color: "var(--status-success)" }}>ON</strong> for all speakers)</span>
              </span>
              <a style={{
                fontSize: 11.5,
                color: "var(--accent)",
                fontFamily: "var(--font-ui)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}>Settings →</a>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-2)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 11.5, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
            ⏎ to save · esc to cancel
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" disabled={saved}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => canSave && setSaved(true)}
            style={{
              opacity: canSave || saved ? 1 : 0.5,
              cursor: canSave ? "pointer" : "not-allowed",
            }}>
            {saved ? <><Icon name="check" size={11} /> Saved</> : <>Save & remember voice</>}
          </button>
        </div>
      </div>

      {/* Saved toast */}
      {saved && (
        <div style={{
          position: "absolute",
          left: "50%",
          bottom: 20,
          transform: "translateX(-50%)",
          padding: "10px 14px",
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid color-mix(in oklab, var(--status-success) 40%, var(--border-2))",
          boxShadow: "var(--shadow-modal)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13,
          color: "var(--text)",
          fontFamily: "var(--font-ui)",
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "var(--status-success)",
            color: "#0f1c14",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="check" size={12} />
          </span>
          <div>
            <div>Speaker 4 → <strong>{name}</strong></div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 1 }}>
              3 segments renamed · voiceprint saved · git committed
            </div>
          </div>
          <button onClick={() => setSaved(false)} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11.5 }}>
            <Icon name="arrow" size={10} /> undo
          </button>
        </div>
      )}
    </div>
  );
}

function slugify(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─────────────────────────────────────────────────────────────────────
// Auto-recognition states — confirm/correct the "Alice?" chip
// ─────────────────────────────────────────────────────────────────────
function SpeakerAutoRecognition({ theme = "dark" }) {
  // Speaker 2 ambiguous match: Alice (78%) — in the confirm band
  const [alice, setAlice] = useStateST("ambiguous"); // ambiguous | confirmed | corrected
  // Speaker 3 high-confidence auto-match: Ahmed K. (94%) — confirmed automatically, can still undo
  const [ahmed, setAhmed] = useStateST("auto");      // auto | undone
  // Speaker 4 fully unknown
  const [linh, setLinh]   = useStateST("unknown");   // unknown | tagging | tagged
  const [linhName, setLinhName] = useStateST("");

  const reset = () => {
    setAlice("ambiguous");
    setAhmed("auto");
    setLinh("unknown");
    setLinhName("");
  };

  return (
    <div data-theme={theme} className="app-shell" style={{
      width: 720, height: 620,
      borderRadius: 12,
      border: "1px solid var(--border-2)",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Icon name="user" size={14} style={{ color: "var(--accent)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-display)" }}>
            Attendees · 4
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>
            New meeting · Hark cross-checked your vault voiceprints
          </div>
        </div>
        <button onClick={reset} className="btn btn-ghost" style={{ fontSize: 11.5, padding: "4px 8px" }}>
          <Icon name="arrow" size={10} style={{ transform: "rotate(180deg)" }} /> reset demo
        </button>
      </div>

      <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>

        {/* ── 1 · High-confidence auto-resolved ─────────── */}
        <SpeakerRow
          color={SPEAKER_COLORS[2]}
          name={ahmed === "auto" ? "Ahmed K." : "Speaker 3"}
          state={ahmed === "auto" ? "confirmed-auto" : "unknown"}
          meta={ahmed === "auto" ? "Auto-matched · 94% · Counsel" : "Match undone — please re-tag manually"}
          duration="11m 12s"
          rightAction={
            ahmed === "auto" ? (
              <button className="btn btn-ghost" onClick={() => setAhmed("undone")} style={{ fontSize: 11, padding: "3px 7px" }}>
                Not Ahmed?
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={() => setAhmed("auto")} style={{ fontSize: 11, padding: "3px 8px" }}>
                Re-apply
              </button>
            )
          }
        />

        {/* ── 2 · Ambiguous "Alice?" chip — needs confirm ─────────── */}
        <SpeakerRow
          color={SPEAKER_COLORS[0]}
          name={
            alice === "ambiguous" ? (
              <span style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: "var(--text-3)" }}>Speaker 1</span>
                <span style={{ color: SPEAKER_COLORS[0] }}>(Alice?)</span>
              </span>
            ) :
            alice === "confirmed" ? "Alice Chen" :
            "Speaker 1"
          }
          state={
            alice === "ambiguous" ? "ambiguous" :
            alice === "confirmed" ? "confirmed-by-user" :
            "rejected"
          }
          meta={
            alice === "ambiguous" ? "Possible match — 78% confidence · last seen Mar 14" :
            alice === "confirmed" ? "Voiceprint reinforced · 4 meetings together" :
            "Match rejected — Hark won't suggest Alice for this voice again"
          }
          duration="12m 04s"
          rightAction={
            alice === "ambiguous" ? (
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setAlice("confirmed")}
                  className="btn btn-primary"
                  style={{ fontSize: 11, padding: "3px 9px" }}
                  title="Yes, this is Alice"
                >
                  <Icon name="check" size={10} /> Yes
                </button>
                <button
                  onClick={() => setAlice("corrected")}
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: "3px 9px" }}
                  title="No — not Alice"
                >
                  <Icon name="x" size={10} /> No
                </button>
              </div>
            ) : alice === "confirmed" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--status-success)" }}>
                <Icon name="check" size={11} /> confirmed
              </span>
            ) : (
              <button className="btn btn-ghost" onClick={() => setAlice("ambiguous")} style={{ fontSize: 11, padding: "3px 7px" }}>
                undo
              </button>
            )
          }
          showPlay={alice === "ambiguous"}
          playColor={SPEAKER_COLORS[0]}
        />

        {/* ── 3 · Fully unknown — inline tagging UI ─────────── */}
        <SpeakerRow
          color={SPEAKER_COLORS[1]}
          name={linh === "tagged" ? linhName : "Speaker 4"}
          state={linh === "tagged" ? "confirmed-by-user" : "unknown"}
          meta={
            linh === "tagged" ? "New voiceprint saved · will auto-match next time" :
            linh === "tagging" ? "Type a name below to label this voice" :
            "Unknown voice · not in your vault"
          }
          duration="5m 08s"
          rightAction={
            linh === "unknown" ? (
              <button onClick={() => setLinh("tagging")} className="btn btn-secondary" style={{ fontSize: 11, padding: "3px 9px" }}>
                Who is this?
              </button>
            ) : linh === "tagging" ? (
              <button onClick={() => { setLinh("unknown"); setLinhName(""); }} className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 7px" }}>
                <Icon name="x" size={10} /> cancel
              </button>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--status-success)" }}>
                <Icon name="check" size={11} /> saved
              </span>
            )
          }
          showPlay={linh !== "tagged"}
          playColor={SPEAKER_COLORS[1]}
        >
          {linh === "tagging" && (
            <div style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}>
              <input
                className="input"
                placeholder="Linh Nguyễn"
                value={linhName}
                onChange={(e) => setLinhName(e.target.value)}
                style={{ flex: 1, fontSize: 13 }}
                autoFocus
              />
              <button
                disabled={linhName.trim().length < 2}
                onClick={() => linhName.trim().length >= 2 && setLinh("tagged")}
                className="btn btn-primary"
                style={{
                  fontSize: 12,
                  opacity: linhName.trim().length >= 2 ? 1 : 0.4,
                  cursor: linhName.trim().length >= 2 ? "pointer" : "not-allowed",
                }}
              >
                <Icon name="check" size={10} /> Save
              </button>
            </div>
          )}
        </SpeakerRow>

        {/* Footer explanation */}
        <div style={{ flex: 1 }} />
        <div style={{
          marginTop: 6,
          padding: "10px 12px",
          borderRadius: 8,
          background: "var(--bg-2)",
          border: "1px dashed var(--border)",
          fontSize: 11.5,
          color: "var(--text-2)",
          lineHeight: 1.55,
        }}>
          <Icon name="info" size={12} style={{ color: "var(--accent)", marginRight: 6 }} />
          Voiceprints from past meetings live in <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>vault/.speakers/</span>.
          Cosine similarity ≥ 0.85 auto-matches; 0.65–0.85 surfaces as an <em>(Alice?)</em> chip; below 0.65 stays unlabeled. Adjust thresholds in Settings → Speakers.
        </div>
      </div>
    </div>
  );
}

function SpeakerRow({ color, name, state, meta, duration, rightAction, showPlay, playColor, children }) {
  const styles = {
    confirmed: { bg: "transparent", border: "1px solid transparent" },
    "confirmed-auto": {
      bg: "color-mix(in oklab, var(--status-success) 7%, transparent)",
      border: "1px solid color-mix(in oklab, var(--status-success) 25%, var(--border))",
    },
    "confirmed-by-user": {
      bg: "color-mix(in oklab, var(--status-success) 7%, transparent)",
      border: "1px solid color-mix(in oklab, var(--status-success) 25%, var(--border))",
    },
    ambiguous: {
      bg: "color-mix(in oklab, var(--status-warning) 8%, transparent)",
      border: "1px dashed color-mix(in oklab, var(--status-warning) 50%, transparent)",
    },
    unknown: {
      bg: "color-mix(in oklab, var(--text-3) 7%, transparent)",
      border: "1px dashed color-mix(in oklab, var(--text-3) 35%, transparent)",
    },
    rejected: {
      bg: "transparent",
      border: "1px solid var(--border)",
    },
  };
  const s = styles[state] || styles.unknown;

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 10,
      background: s.bg,
      border: s.border,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span className="sp-chip" style={{
          background: color,
          width: 12, height: 12, marginTop: 5, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "var(--font-ui)",
            }}>{name}</span>
            {state === "confirmed-auto" && (
              <ConfBadge tone="success" text="auto · 94%" />
            )}
            {state === "ambiguous" && (
              <ConfBadge tone="warning" text="needs your confirm" />
            )}
            {state === "rejected" && (
              <ConfBadge tone="neutral" text="rejected" />
            )}
            {state === "confirmed-by-user" && (
              <ConfBadge tone="success" text="✓ you confirmed" />
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{duration}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 3 }}>{meta}</div>
          {showPlay && (
            <div style={{ marginTop: 8, maxWidth: 360 }}>
              <PlayableSnippet duration={5} heights={WF_A.slice(0, 22)} accent={playColor || color} />
            </div>
          )}
          {children}
        </div>
        <div style={{ flexShrink: 0 }}>
          {rightAction}
        </div>
      </div>
    </div>
  );
}

function ConfBadge({ tone, text }) {
  const tones = {
    success: { bg: "color-mix(in oklab, var(--status-success) 18%, transparent)", color: "var(--status-success)" },
    warning: { bg: "color-mix(in oklab, var(--status-warning) 22%, transparent)", color: "var(--status-warning)" },
    neutral: { bg: "var(--bg-2)", color: "var(--text-3)" },
  };
  const t = tones[tone];
  return (
    <span style={{
      padding: "1px 6px",
      borderRadius: 999,
      background: t.bg,
      color: t.color,
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.02em",
    }}>{text}</span>
  );
}

window.SpeakerTaggingModal = SpeakerTaggingModal;
window.SpeakerAutoRecognition = SpeakerAutoRecognition;
