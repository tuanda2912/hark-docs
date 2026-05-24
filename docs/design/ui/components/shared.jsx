/* global React */
/* Hark shared atoms: icons, mac window chrome, transcript line, etc. */

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────
// Icons — original SVG glyphs inspired by SF Symbol shapes (originals)
// Stroke-only, currentColor, 1em sizing.
// ─────────────────────────────────────────────────────────────────────
function Icon({ name, size = 14, style }) {
  const paths = {
    mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11.5a.75.75 0 0 1 1.5 0 5 5 0 0 0 10 0 .75.75 0 0 1 1.5 0 6.5 6.5 0 0 1-5.75 6.46V20.5a.75.75 0 0 1-1.5 0v-2.54A6.5 6.5 0 0 1 5.5 11.5z",
    pause: "M8 5h3v14H8zM13 5h3v14h-3z",
    stop: "M6.5 6.5h11v11h-11z",
    play: "M7 5l12 7-12 7z",
    bookmark: "M7 4h10a1 1 0 0 1 1 1v15.2a.8.8 0 0 1-1.25.66L12 17.4 7.25 20.86A.8.8 0 0 1 6 20.2V5a1 1 0 0 1 1-1z",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19.4 13a7.5 7.5 0 0 0 0-2l1.7-1.3a.5.5 0 0 0 .12-.62l-1.6-2.78a.5.5 0 0 0-.6-.22l-2 .8a7.4 7.4 0 0 0-1.74-1L15 3.9a.5.5 0 0 0-.5-.4h-3.2a.5.5 0 0 0-.5.4l-.3 2.1a7.4 7.4 0 0 0-1.74 1l-2-.8a.5.5 0 0 0-.6.22L4.7 9.2a.5.5 0 0 0 .12.6L6.5 11a7.5 7.5 0 0 0 0 2l-1.68 1.3a.5.5 0 0 0-.12.6l1.6 2.78a.5.5 0 0 0 .6.22l2-.8a7.4 7.4 0 0 0 1.74 1l.3 2.1a.5.5 0 0 0 .5.4h3.2a.5.5 0 0 0 .5-.4l.3-2.1a7.4 7.4 0 0 0 1.74-1l2 .8a.5.5 0 0 0 .6-.22l1.6-2.78a.5.5 0 0 0-.12-.6L19.4 13z",
    sidebar: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13zm5 .5H5.5v12H9V6z",
    panelRight: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13zM15 6v12h3.5V6H15z",
    search: "M11 4a7 7 0 1 1-4.6 12.27l-3.06 3.06a.75.75 0 0 1-1.06-1.06l3.06-3.06A7 7 0 0 1 11 4zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z",
    chevron: "M9 6l6 6-6 6",
    chevronDown: "M6 9l6 6 6-6",
    plus: "M12 5v14M5 12h14",
    check: "M5 12.5l4.5 4.5L19 7.5",
    x: "M6 6l12 12M18 6L6 18",
    arrow: "M5 12h14M13 6l6 6-6 6",
    waveform: "M2 12h2M5 8v8M8 4v16M11 9v6M14 6v12M17 8v8M20 11v2M22 12h-1",
    lock: "M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z",
    shield: "M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z",
    cloud: "M7 17.5A4.5 4.5 0 0 1 7.5 8.5 6 6 0 0 1 19 10a3.5 3.5 0 0 1 .5 7H7.5z",
    cloudOff: "M3 3l18 18M7 17.5A4.5 4.5 0 0 1 7.5 8.5M9.5 5.5A6 6 0 0 1 19 10a3.5 3.5 0 0 1 1.7 6.6",
    pin: "M12 2v6l3 4v3H9v-3l3-4V2M9 15h6M12 18v4",
    link: "M9.5 14.5l5-5M8 13l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 18M11 6l2.5-2.5a3.5 3.5 0 0 1 5 5L16 11",
    folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
    info: "M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 10v6M12 7.5v.01",
    alert: "M12 3l10 17H2L12 3zm0 6v5m0 2.5v.01",
    keyboard: "M3 6h18v12H3zM6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01M7 15h10",
    languages: "M4 5h8M8 5v2M5 7s.5 4 3 6c-2 1-3 1-3 1M9 7s-.5 4-3 6c2 1 3 1 3 1M13 20l4-10 4 10M14.5 17h5",
    sparkleSmall: "M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    eyeOff: "M3 3l18 18M9.5 9.5a3 3 0 0 0 4 4M6 6.5C3.5 8.5 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M18 18s4-3 4-6c0 0-3.5-7-10-7-1.2 0-2.3.2-3.3.6",
    ellipsis: "M5 12h.01M12 12h.01M19 12h.01",
    quote: "M7 9c0-2 1-3 3-3v2c-1 0-2 .5-2 2v1h2v4H5v-4c0-1 0-2 2-2zm9 0c0-2 1-3 3-3v2c-1 0-2 .5-2 2v1h2v4h-5v-4c0-1 0-2 2-2z",
  };
  const d = paths[name] || paths.info;
  const fillNames = new Set(["bookmark", "play", "pause", "stop", "pin"]);
  const useFill = fillNames.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={useFill ? "currentColor" : "none"}
      stroke={useFill ? "none" : "currentColor"}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-0.15em", ...style }}
    >
      <path d={d} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// macOS window chrome
// ─────────────────────────────────────────────────────────────────────
function MacWindow({ title, children, width, height, accessory, style }) {
  return (
    <div className="mac-window" style={{ width, height, ...style }}>
      <div className="mac-titlebar">
        <div className="traffic">
          <span className="tl-close"></span>
          <span className="tl-min"></span>
          <span className="tl-max"></span>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span className="titlebar-title">{title}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {accessory}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Transcript line
// ─────────────────────────────────────────────────────────────────────
function TranscriptLine({
  speaker,
  speakerColor,
  time,
  text,
  translation,
  bookmarked,
  vaultLinks,
  citation,
  variant = "default",
}) {
  // text can include [[term]] wikilinks
  const renderText = (s) => {
    const parts = s.split(/(\[\[[^\]]+\]\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[\[(.+)\]\]$/);
      if (m) {
        return (
          <span key={i} style={{
            color: "var(--accent)",
            borderBottom: "1px dashed color-mix(in oklab, var(--accent) 50%, transparent)",
            cursor: "pointer",
            padding: "0 1px",
          }}>{m[1]}</span>
        );
      }
      return <span key={i}>{p}</span>;
    });
  };

  if (variant === "compact") {
    return (
      <div className="tx-line" style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "6px 12px",
        padding: "6px 0",
        alignItems: "baseline",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-3)",
          minWidth: 48,
        }}>{time}</div>
        <div>
          <div className="tx-line-meta" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span className="sp-chip tx-speaker-chip" style={{ background: speakerColor }} />
            <span className="tx-speaker" style={{ "--sp-color": speakerColor }}>{speaker}</span>
            {bookmarked && <Icon name="pin" size={11} style={{ color: "var(--accent)" }} />}
          </div>
          <div className="tx-line-body" style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text)" }}>
            {renderText(text)}
            {citation && (
              <sup style={{
                marginLeft: 3,
                fontSize: 10,
                color: "var(--accent)",
                cursor: "pointer",
              }}>[{citation}]</sup>
            )}
          </div>
          {translation && (
            <div className="tx-translation" style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--text-2)",
              marginTop: 4,
              lineHeight: 1.5,
            }}>{translation}</div>
          )}
        </div>
      </div>
    );
  }

  // default
  return (
    <div className="tx-line" style={{
      padding: "10px 0",
      borderBottom: "1px solid var(--highlight)",
    }}>
      <div className="tx-line-meta" style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
      }}>
        <span className="sp-chip tx-speaker-chip" style={{ background: speakerColor }} />
        <span className="tx-speaker tx-speaker-default" style={{ "--sp-color": speakerColor }}>{speaker}</span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-3)",
        }}>{time}</span>
        {bookmarked && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 10,
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
          }}>
            <Icon name="pin" size={11} />pinned
          </span>
        )}
      </div>
      <div className="tx-line-body" style={{ fontSize: 15, lineHeight: 1.55, color: "var(--text)", paddingLeft: 16 }}>
        {renderText(text)}
        {citation && (
          <sup style={{
            marginLeft: 4,
            fontSize: 10,
            color: "var(--accent)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
          }}>[{citation}]</sup>
        )}
      </div>
      {translation && (
        <div className="tx-translation" style={{
          fontSize: 13.5,
          fontStyle: "italic",
          color: "var(--text-2)",
          marginTop: 4,
          paddingLeft: 16,
          lineHeight: 1.5,
        }}>{translation}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Term card — floating preview for [[wikilinks]]
// ─────────────────────────────────────────────────────────────────────
function TermCard({ term, path, excerpt, updated, backlinks = 0, style }) {
  return (
    <div style={{
      width: 320,
      padding: 14,
      borderRadius: 10,
      background: "var(--surface)",
      border: "1px solid var(--border-2)",
      boxShadow: "var(--shadow-modal)",
      fontFamily: "var(--font-ui)",
      ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 5,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="link" size={12} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{term}</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
          {backlinks} backlinks
        </span>
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--accent)",
        wordBreak: "break-all",
      }}>{path}</div>
      <div style={{
        marginTop: 10,
        padding: "8px 10px",
        borderRadius: 6,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        fontSize: 12.5,
        color: "var(--text-2)",
        lineHeight: 1.55,
        fontStyle: "italic",
      }}>
        “{excerpt}”
      </div>
      <div style={{
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--text-3)",
      }}>
        <span>Updated {updated}</span>
        <span style={{ flex: 1 }} />
        <a style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          Open in Obsidian <Icon name="arrow" size={10} />
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bookmark hover — shows the context around a pinned moment
// ─────────────────────────────────────────────────────────────────────
function BookmarkHover({ time, label, before, highlight, after, style }) {
  return (
    <div style={{
      width: 320,
      padding: 12,
      borderRadius: 10,
      background: "var(--surface)",
      border: "1px solid var(--border-2)",
      boxShadow: "var(--shadow-modal)",
      fontFamily: "var(--font-ui)",
      ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--accent)", display: "inline-flex" }}>
          <Icon name="pin" size={12} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)" }}>{time}</span>
      </div>
      <div style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 6,
        background: "var(--bg-2)",
        fontSize: 12,
        color: "var(--text-2)",
        lineHeight: 1.55,
      }}>
        <span style={{ color: "var(--text-3)" }}>{before} </span>
        <span style={{
          background: "color-mix(in oklab, var(--accent) 22%, transparent)",
          color: "var(--text)",
          padding: "0 3px",
          borderRadius: 2,
        }}>{highlight}</span>
        <span style={{ color: "var(--text-3)" }}> {after}</span>
      </div>
      <div style={{
        marginTop: 8,
        display: "flex",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--text-3)",
      }}>
        <a style={{ color: "var(--accent)" }}>Jump to moment</a>
        <a style={{ color: "var(--accent)" }}>Remove pin</a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Audio level meter — animated bars (CSS keyframes), live capture indicator
// ─────────────────────────────────────────────────────────────────────
function AudioMeter({ bars = 6, style }) {
  return (
    <span className="audio-meter" style={style}>
      {Array.from({ length: bars }).map((_, i) => <span key={i} />)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Speaker tag pill
// ─────────────────────────────────────────────────────────────────────
function SpeakerTag({ color, name, tagged = true }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 8px",
      borderRadius: 999,
      border: "1px solid var(--border-2)",
      background: "var(--surface)",
      fontSize: 12,
      color: tagged ? "var(--text)" : "var(--text-2)",
      fontStyle: tagged ? "normal" : "italic",
    }}>
      <span className="sp-chip" style={{ background: color }} />
      {name}
      <Icon name="chevronDown" size={10} style={{ color: "var(--text-3)" }} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Citation chip
// ─────────────────────────────────────────────────────────────────────
function CitationChip({ n, label }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "2px 7px 2px 4px",
      borderRadius: 4,
      background: "var(--accent-soft)",
      border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
      fontSize: 11,
      fontFamily: "var(--font-mono)",
      color: "var(--accent)",
      cursor: "pointer",
    }}>
      <span style={{
        display: "inline-flex",
        width: 14, height: 14,
        borderRadius: 3,
        alignItems: "center", justifyContent: "center",
        background: "color-mix(in oklab, var(--accent) 22%, transparent)",
        fontSize: 10,
        fontWeight: 600,
      }}>{n}</span>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Status banner
// ─────────────────────────────────────────────────────────────────────
function StatusBanner({ tone = "warning", icon = "alert", children, action }) {
  const map = {
    warning: { bg: "color-mix(in oklab, var(--status-warning) 14%, transparent)", border: "color-mix(in oklab, var(--status-warning) 35%, transparent)", text: "var(--status-warning)" },
    error:   { bg: "color-mix(in oklab, var(--status-recording) 14%, transparent)", border: "color-mix(in oklab, var(--status-recording) 35%, transparent)", text: "var(--status-recording)" },
    info:    { bg: "var(--accent-soft)", border: "color-mix(in oklab, var(--accent) 35%, transparent)", text: "var(--accent)" },
    success: { bg: "color-mix(in oklab, var(--status-success) 14%, transparent)", border: "color-mix(in oklab, var(--status-success) 35%, transparent)", text: "var(--status-success)" },
  };
  const c = map[tone];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 14px",
      background: c.bg,
      borderBottom: `1px solid ${c.border}`,
      fontSize: 12.5,
      color: "var(--text)",
    }}>
      <span style={{ color: c.text, display: "inline-flex" }}>
        <Icon name={icon} size={14} />
      </span>
      <span style={{ flex: 1 }}>{children}</span>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Toggle (mac-style)
// ─────────────────────────────────────────────────────────────────────
function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36, height: 22,
        borderRadius: 999,
        background: on ? "var(--accent)" : "var(--border-2)",
        border: "none",
        position: "relative",
        cursor: "pointer",
        transition: "background 150ms ease",
        padding: 0,
      }}
    >
      <span style={{
        position: "absolute",
        top: 2, left: on ? 16 : 2,
        width: 18, height: 18,
        borderRadius: "50%",
        background: "#fff",
        transition: "left 150ms ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Section label
// ─────────────────────────────────────────────────────────────────────
function Eyebrow({ children, style }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: 10.5,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--text-3)",
      ...style,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Constants — speaker palette + sample meeting
// ─────────────────────────────────────────────────────────────────────
const SPEAKER_COLORS = ["#d8a3ad", "#a8bf9a", "#d4a07a", "#b4a3cf", "#d8c98a", "#9aacbf"];

// Realistic engineering / vendor review meeting — English with Vietnamese code-switching
const SAMPLE_TRANSCRIPT = [
  { speaker: "Alice Chen", color: SPEAKER_COLORS[0], time: "00:00:12", text: "Quick agenda check — we have forty minutes. I want to lock the vendor SOC 2 question, then walk through the data-residency exception you flagged last Tuesday." },
  { speaker: "Linh Nguyễn",  color: SPEAKER_COLORS[1], time: "00:00:34", text: "Sounds good. Tôi đã gửi cái draft memo cho compliance rồi nhé — they should have it by EOD. The blocker is still §4.2 of the [[DPA]].", translation: "I already sent the draft memo to compliance — they should have it by EOD." },
  { speaker: "Ahmed K.",     color: SPEAKER_COLORS[2], time: "00:01:08", text: "Right, §4.2. Their counsel pushed back on the sub-processor clause. They want us to enumerate every downstream service we share PII with, not just the categories.", citation: 1 },
  { speaker: "Alice Chen",   color: SPEAKER_COLORS[0], time: "00:01:42", text: "That tracks with what [[Aki]] saw on the [[Tessera deal]] in March. Did we end up agreeing to the enumeration there or did we negotiate it down?", bookmarked: true },
  { speaker: "Linh Nguyễn",  color: SPEAKER_COLORS[1], time: "00:02:11", text: "Mình nhớ là negotiated it down — chỉ enumerate ones that handle audio. Let me pull up the redline.", translation: "I think we negotiated it down — only enumerate the ones that handle audio." },
  { speaker: "Ahmed K.",     color: SPEAKER_COLORS[2], time: "00:02:39", text: "If we can land the same scope here we're done. The other open item is the on-prem deployment SLA — they're asking for four-nines and I'm not sure ops will agree.", citation: 2 },
  { speaker: "Speaker 4",    color: SPEAKER_COLORS[3], time: "00:03:04", text: "Four-nines on-prem is unusual. Have we benchmarked uptime on the staging cluster yet?" },
  { speaker: "Alice Chen",   color: SPEAKER_COLORS[0], time: "00:03:28", text: "Yes — 99.94% over the last sixty days. Below four-nines but the variance is mostly the [[storage migration]]. If we exclude planned windows we're at 99.991." },
];

// Expose
Object.assign(window, {
  Icon, MacWindow, TranscriptLine, SpeakerTag, CitationChip,
  StatusBanner, Toggle, Eyebrow, SPEAKER_COLORS, SAMPLE_TRANSCRIPT,
  TermCard, BookmarkHover, AudioMeter,
});
