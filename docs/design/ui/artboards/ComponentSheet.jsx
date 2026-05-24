/* global React, Icon, Eyebrow, SPEAKER_COLORS, SpeakerTag, Toggle, StatusBanner, TranscriptLine, CitationChip, TermCard, BookmarkHover, AudioMeter */

function ComponentSheet({ theme = "dark" }) {
  return (
    <div data-theme={theme} className="app-shell" style={{
      width: 1100,
      padding: "32px 36px",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: 10,
    }}>
      <Header />

      <Section title="Buttons" subtitle="Primary, secondary, ghost, destructive, icon">
        <Row>
          <button className="btn btn-primary">Start recording</button>
          <button className="btn btn-primary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>Disabled</button>
          <button className="btn btn-secondary"><Icon name="bookmark" size={12} /> Bookmark</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-ghost">Cancel</button>
          <button className="btn btn-destructive"><Icon name="stop" size={11} /> Stop & discard</button>
          <button className="icon-btn" style={{ border: "1px solid var(--border-2)" }}><Icon name="settings" size={14} /></button>
        </Row>
      </Section>

      <Section title="Inputs" subtitle="Text, masked, dropdown, toggle, slider">
        <Row>
          <input className="input" placeholder="Meeting title…" style={{ width: 220 }} />
          <input className="input" type="password" defaultValue="sk-ant-secret" style={{ width: 220, fontFamily: "var(--font-mono)" }} />
          <select className="input" style={{ width: 180 }}>
            <option>Built-in microphone</option>
            <option>AirPods Pro</option>
          </select>
          <Toggle on={true} />
          <Toggle on={false} />
          <div style={{ width: 180 }}>
            <div style={{ position: "relative", height: 16 }}>
              <div style={{ position: "absolute", inset: "7px 0", background: "var(--border)", borderRadius: 999 }} />
              <div style={{ position: "absolute", left: 0, top: 7, height: 2, width: "60%", background: "var(--accent)", borderRadius: 999 }} />
              <div style={{ position: "absolute", left: "60%", top: 0, width: 16, height: 16, borderRadius: 50, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>VAD sensitivity · 0.60</div>
          </div>
        </Row>
      </Section>

      <Section title="Speaker palette + tags" subtitle="6 muted colors · pill with rename affordance">
        <Row>
          {SPEAKER_COLORS.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: "1px solid color-mix(in oklab, " + c + " 60%, transparent)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{c}</span>
            </div>
          ))}
        </Row>
        <Row>
          <SpeakerTag color={SPEAKER_COLORS[0]} name="Alice Chen" tagged />
          <SpeakerTag color={SPEAKER_COLORS[1]} name="Linh Nguyễn" tagged />
          <SpeakerTag color={SPEAKER_COLORS[3]} name="Speaker 4" tagged={false} />
        </Row>
      </Section>

      <Section title="Status & badges" subtitle="States, indicators, citations">
        <Row>
          <Badge tone="recording"><span className="rec-dot" /> Recording</Badge>
          <Badge tone="paused"><Icon name="pause" size={10} /> Paused</Badge>
          <Badge tone="idle">Idle</Badge>
          <Badge tone="success"><Icon name="check" size={10} /> Saved</Badge>
          <Badge tone="warning"><Icon name="alert" size={10} /> Rate-limited</Badge>
          <Badge tone="cloud"><Icon name="cloud" size={10} /> Cloud touched</Badge>
          <Badge tone="local"><Icon name="cloudOff" size={10} /> Local-only</Badge>
        </Row>
        <Row>
          <CitationChip n={1} label="Tessera DPA redline" />
          <CitationChip n={2} label="meeting · 00:02:11" />
          <CitationChip n={3} label="playbook" />
        </Row>
      </Section>

      <Section title="Banners" subtitle="Info, warning, error, success — never block UI">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
          <StatusBanner tone="info" icon="cloud">Translation switched to <strong style={{ color: "var(--text)" }}>Claude</strong> for higher quality.</StatusBanner>
          <StatusBanner tone="warning" icon="alert">API rate limit reached — falling back to local translation.</StatusBanner>
          <StatusBanner tone="error" icon="alert">ScreenCapture permission denied. Hark can't hear other participants.</StatusBanner>
          <StatusBanner tone="success" icon="check">Meeting filed to <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>vault/meetings/2026-05-24-q3.md</code></StatusBanner>
        </div>
      </Section>

      <Section title="Transcript line — variants" subtitle="Default (comfortable), compact, with translation, bookmarked, with citation">
        <div style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)" }}>
          <TranscriptLine
            speaker="Alice Chen"
            speakerColor={SPEAKER_COLORS[0]}
            time="00:01:42"
            text="That tracks with what [[Aki]] saw on the [[Tessera deal]] in March."
            bookmarked
          />
          <TranscriptLine
            speaker="Linh Nguyễn"
            speakerColor={SPEAKER_COLORS[1]}
            time="00:02:11"
            text="Mình nhớ là negotiated it down — chỉ enumerate ones that handle audio."
            translation="I think we negotiated it down — only enumerate the ones that handle audio."
          />
          <TranscriptLine
            speaker="Ahmed K."
            speakerColor={SPEAKER_COLORS[2]}
            time="00:02:39"
            text="If we can land the same scope here we're done."
            citation={2}
          />
        </div>

        <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-2)" }}>
          <TranscriptLine variant="compact" speaker="Alice Chen" speakerColor={SPEAKER_COLORS[0]} time="00:01:42" text="That tracks with what [[Aki]] saw on the [[Tessera deal]] in March." bookmarked />
          <TranscriptLine variant="compact" speaker="Linh Nguyễn" speakerColor={SPEAKER_COLORS[1]} time="00:02:11" text="Mình nhớ là negotiated it down." translation="I think we negotiated it down." />
        </div>
      </Section>

      <Section title="Floating molecules" subtitle="Hover-revealed cards for [[wikilinks]], pins, and live audio">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Term card</div>
            <TermCard
              term="Tessera deal"
              path="vault/meetings/2026-03-14-tessera-counsel.md"
              excerpt="Negotiated §4.2 down to audio-handling sub-processors only. Counsel agreed."
              updated="Mar 14 · Linh"
              backlinks={7}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Bookmark hover</div>
            <BookmarkHover
              time="00:01:42"
              label="Decision moment"
              before="That tracks with what"
              highlight="Aki saw on the Tessera deal in March"
              after="— did we negotiate it down?"
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Audio level meter</div>
            <div style={{
              padding: "18px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="rec-dot" />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--status-recording)", fontWeight: 600 }}>REC</span>
                <AudioMeter />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>-12 dB</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                Live mic level. The bars confirm capture is happening — without leaking the audio off-device.
              </div>
              <div style={{
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                background: "var(--bg-2)",
                border: "1px dashed var(--border-2)",
                fontSize: 11,
                color: "var(--text-3)",
                fontFamily: "var(--font-mono)",
              }}>
                <Icon name="cloudOff" size={11} />
                level only · waveform never streamed
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Live caret" subtitle="Distinct from the recording-dot pulse — used only for in-flight partial transcript">
        <div style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 15, color: "var(--text-2)", fontStyle: "italic" }}>
          So if we exclude the migration window the SLA math actually—<span className="live-caret" />
        </div>
      </Section>

      <Section title="Empty & error states" subtitle="One SF Symbol · one line · one button. Never illustrated cartoons.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <EmptyState
            icon="waveform"
            title="No meetings yet."
            sub="Press ⌘⇧R or click the tray icon to start your first one."
            cta="Start recording"
          />
          <EmptyState
            icon="cloudOff"
            tone="warning"
            title="ScreenCapture permission denied."
            sub="Hark can transcribe your mic but won't hear other participants. Grant access in System Settings."
            cta="Open System Settings"
          />
        </div>
      </Section>

      <Section title="Iconography" subtitle="Original SF-style monoline glyphs · use only what's listed">
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 8,
          padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)",
        }}>
          {["mic","pause","stop","play","bookmark","settings","sidebar","panelRight","search","plus","check","x","arrow","waveform","lock","shield","cloud","cloudOff","pin","link","folder","user","info","alert","keyboard","languages","eye","eyeOff","ellipsis","quote"].map((n) => (
            <div key={n} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "10px 4px", borderRadius: 4,
            }}>
              <Icon name={n} size={18} style={{ color: "var(--text)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-3)" }}>{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography scale" subtitle="SF Pro Display + SF Pro Text + SF Mono · with Inter / JetBrains fallback">
        <div style={{ padding: 18, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12 }}>
          <TypeRow label="Display 36 · 600" style={{ fontSize: 36, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.1 }}>Your audio never leaves this Mac.</TypeRow>
          <TypeRow label="Display 22 · 600" style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.015em" }}>Privacy</TypeRow>
          <TypeRow label="UI 15 / 1.55"   style={{ fontSize: 15, lineHeight: 1.55 }}>Hark transcribes meetings entirely on your Mac.</TypeRow>
          <TypeRow label="UI 13"          style={{ fontSize: 13 }}>Most settings labels use this size.</TypeRow>
          <TypeRow label="Caption 11"     style={{ fontSize: 11, color: "var(--text-2)" }}>Secondary text, never below 11px.</TypeRow>
          <TypeRow label="Mono 12"        style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>vault://meetings/2026-05-24-tessera.md</TypeRow>
          <TypeRow label="Mono 10 caps"   style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)" }}>Eyebrow / section labels</TypeRow>
        </div>
      </Section>

      <Section title="Color tokens" subtitle="Resolves to dark / light via [data-theme]">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {[
            { name: "bg", v: "var(--bg)", border: "var(--border)" },
            { name: "bg-2", v: "var(--bg-2)" },
            { name: "surface", v: "var(--surface)" },
            { name: "border", v: "var(--border)" },
            { name: "text", v: "var(--text)" },
            { name: "text-2", v: "var(--text-2)" },
            { name: "text-3", v: "var(--text-3)" },
            { name: "accent", v: "var(--accent)" },
            { name: "recording", v: "var(--status-recording)" },
            { name: "warning", v: "var(--status-warning)" },
            { name: "success", v: "var(--status-success)" },
            { name: "cloud", v: "var(--status-cloud)" },
          ].map((c) => (
            <div key={c.name} style={{ borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
              <div style={{ height: 38, background: c.v }} />
              <div style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-2)", background: "var(--surface)" }}>{c.name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing scale" subtitle="4 / 8 / 12 / 16 / 24 / 32 / 48 · no arbitrary 13s">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
          {[4, 8, 12, 16, 24, 32, 48].map((s) => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: s, height: 60, background: "var(--accent)", borderRadius: 2 }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)" }}>{s}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Header() {
  return (
    <div style={{ paddingBottom: 24, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
      <Eyebrow>Component sheet · v0.9</Eyebrow>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        margin: "8px 0 4px",
        color: "var(--text)",
      }}>Hark — atoms & molecules</h1>
      <div style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 600 }}>
        Everything that shows up in more than one screen. Borders before shadows, restraint before color, content before chrome.
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          margin: 0,
          color: "var(--text)",
          minWidth: 220,
        }}>{title}</h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  const map = {
    recording: { bg: "color-mix(in oklab, var(--status-recording) 14%, transparent)", border: "color-mix(in oklab, var(--status-recording) 35%, transparent)", color: "var(--status-recording)" },
    paused:    { bg: "color-mix(in oklab, var(--status-warning) 14%, transparent)",   border: "color-mix(in oklab, var(--status-warning) 35%, transparent)",   color: "var(--status-warning)" },
    idle:      { bg: "var(--surface)", border: "var(--border-2)", color: "var(--text-2)" },
    success:   { bg: "color-mix(in oklab, var(--status-success) 14%, transparent)",   border: "color-mix(in oklab, var(--status-success) 35%, transparent)",   color: "var(--status-success)" },
    warning:   { bg: "color-mix(in oklab, var(--status-warning) 14%, transparent)",   border: "color-mix(in oklab, var(--status-warning) 35%, transparent)",   color: "var(--status-warning)" },
    cloud:     { bg: "color-mix(in oklab, var(--status-cloud) 14%, transparent)",     border: "color-mix(in oklab, var(--status-cloud) 35%, transparent)",     color: "var(--status-cloud)" },
    local:     { bg: "var(--surface)", border: "var(--border-2)", color: "var(--text-2)" },
  };
  const s = map[tone] || map.idle;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px",
      borderRadius: 999,
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontSize: 11.5,
      fontWeight: 500,
      fontFamily: "var(--font-ui)",
    }}>{children}</span>
  );
}

function TypeRow({ label, style, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 18, alignItems: "baseline" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)", letterSpacing: "0.04em" }}>{label}</div>
      <div style={style}>{children}</div>
    </div>
  );
}

function EmptyState({ icon, tone = "neutral", title, sub, cta }) {
  const iconColor = tone === "warning" ? "var(--status-warning)" : "var(--text-3)";
  return (
    <div style={{
      padding: "36px 24px",
      borderRadius: 10,
      border: "1px dashed var(--border-2)",
      background: "var(--bg-2)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 10,
    }}>
      <div style={{ color: iconColor }}>
        <Icon name={icon} size={28} />
      </div>
      <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-2)", maxWidth: 320, lineHeight: 1.5 }}>{sub}</div>
      <button className="btn btn-secondary" style={{ marginTop: 6 }}>{cta}</button>
    </div>
  );
}

window.ComponentSheet = ComponentSheet;
