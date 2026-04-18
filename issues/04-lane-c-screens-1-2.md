# 04 — Lane C: Screens 1 + 2

> **Do not run this until ticket 01 (scaffold) is merged.** Can run in parallel with Lane A, but full end-to-end testing requires Lane A's API to be live. Before Lane A merges, test against fixture short-circuit (set `DEMO_FALLBACK=1` without `APIFY_TOKEN`).

**Depends on:** 01.
**Parallel with:** 02, 03, 05.
**Lane tree:** `app/page.tsx`, `app/research/[sid]/**`, `components/research/**`, `components/ui/Favicon.tsx`, `components/ui/SocialInputList.tsx`.
**Files outside this tree are READ-ONLY.** If you need to change a shared file, STOP and flag.
**Estimated effort:** CC ~35 min.

## Why

Screen 1 captures the URL + optional socials. Screen 2 is the ChatGPT-style research stream with inline tool calls, thought blocks, and the AskInline human-in-the-loop form. This is the first two emotional peaks of the demo.

## Scope

### `components/ui/Favicon.tsx`

Google s2 favicon with letter-tile fallback.

```tsx
export function Favicon({ domain, size = 24, className }: { domain: string; size?: number; className?: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    const letter = domain[0]?.toUpperCase() ?? '?';
    return <div className={cn('flex items-center justify-center rounded-input bg-muted text-muted-foreground font-medium', className)} style={{ width: size, height: size, fontSize: size * 0.5 }}>{letter}</div>;
  }
  return <img src={`https://www.google.com/s2/favicons?sz=${size * 2}&domain=${domain}`} width={size} height={size} alt="" onError={() => setErrored(true)} className={cn('rounded-input', className)} />;
}
```

### `components/ui/SocialInputList.tsx`

Repeating social URL inputs. Detects platform on paste; shows favicon inline.

- Platform registry: map hostname → ChannelId (`tiktok.com → tiktok`, `instagram.com → instagram`, `x.com|twitter.com → x`, `facebook.com → facebook`, `linkedin.com → linkedin`, `youtube.com → youtube`, `threads.net → threads`, `pinterest.com → pinterest`).
- Handle extraction regex per platform.
- onChange: parse URL; if hostname matches a platform, attach `{platform, handle, url}` to the row.
- After last input is filled, a new empty row appears automatically (max 6).
- Shown to parent as `socials: Social[]` via callback.

### `app/page.tsx` — Screen 1

```tsx
<main className="mx-auto max-w-2xl p-8 flex flex-col gap-6">
  <h1 className="font-serif text-3xl">Tell us about your brand.</h1>
  <p className="text-muted-foreground">Paste your site. Add any socials we should look at.</p>
  <UrlInput ... />
  <SocialInputList onChange={setSocials} />
  <Button disabled={!websiteValid || submitting} onClick={handleStart}>
    {submitting ? 'Starting research…' : 'Research this brand →'}
  </Button>
</main>
```

- Validate URL with `new URL(input)`; normalize https/http.
- On submit: `POST /api/research` → receive `sid` → `router.push(`/research/${sid}`)`.
- Error state: red helper text below input, button re-enabled.

### `app/research/[sid]/page.tsx` — Screen 2

Use `@ai-sdk/react` `useChat` with custom transport (pattern from dpc `chi-page-client.tsx:39–92`):

```tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export default function ResearchPage({ params }) {
  const sid = params.sid;
  const customFetch = useCallback(async (input, init) => {
    if (init?.body && typeof init.body === "string") {
      const body = JSON.parse(init.body);
      body.sid = sid;
      init = { ...init, body: JSON.stringify(body) };
    }
    return fetch(input, init);
  }, [sid]);

  const transport = useRef(new DefaultChatTransport({ api: '/api/chat', fetch: customFetch }));

  const { messages, sendMessage, status, stop, error, addToolOutput, setMessages } = useChat({
    transport: transport.current,
    onFinish: () => { /* check for finalize_research tool result */ },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Auto-send seed message on mount
  useEffect(() => {
    if (messages.length === 0) {
      (async () => {
        const { data } = await fetch(`/api/chat/conversations/${sid}`).then(r => r.json());
        if (data?.journal?.length) {
          setMessages(buildUIMessages(data.journal));
        } else {
          sendMessage({ text: buildSeedUserMessage(sessionData) });
        }
      })();
    }
  }, []);

  return (
    <main>
      <HeroStrip brand={...} currentAction={latestInflightToolLabel(messages)} thinking={anyInflight(messages)} />
      <MessageList messages={messages} isStreaming={isStreaming} onAskAnswer={(toolCallId, reply) => addToolOutput({ tool:'askUser', toolCallId, output: { reply } })} />
      {researchDone && <ConfirmCta delay={500} onClick={() => router.push(`/confirm/${sid}`)} />}
    </main>
  );
}
```

### `components/research/HeroStrip.tsx`

Glass-regular full-width strip. Left: `<Favicon>` + brand name (≥24px Inter semibold). Right: current action headline derived from latest unmatched tool-call label ("Reading @balanceyourbp_ on TikTok"). Inline `<ThinkingDot>` when any tool is in-flight. Reconnect state: sub-label "Reconnecting…" in muted-foreground.

### `components/research/ThinkingDot.tsx`

6px pulsing dot. Tailwind `animate-pulse` at 1.5s cycle. Inline-block, vertical-align baseline.

### `components/research/LiveLog.tsx` (or reuse MessageList from scaffold)

The scaffold's `components/stream/MessageList.tsx` IS LiveLog. Just configure it:

- Pass the `messages` array.
- Pass the `addToolOutput` callback so the child `MessageBubble` can detect askUser tool parts and render the AskInline form.
- Scroll sentinel handles auto-pin-to-bottom (from dpc `message-list.tsx:23–48`).

Optional wrapper `components/research/LiveLog.tsx` that adds:
- 400ms minimum inter-event delay for `fact` text segments (debounce on text part arrivals).
- Older events dim to 60% opacity (via `:nth-last-child(n+6)` rule).

### `components/research/AskInline.tsx`

Rendered from inside `MessageBubble` when a tool part has `toolName === 'askUser'` and `state === 'input-available'`. Not a modal — inline in the stream flow.

```tsx
export function AskInline({ toolCallId, input, onSubmit }: { toolCallId: string; input: { question: string; mode: 'single'|'multi'; options: string[] }; onSubmit: (reply: string | string[]) => void }) {
  const [selection, setSelection] = useState<string[]>([]);
  const [other, setOther] = useState('');

  const submit = () => {
    const final = [...selection];
    if (selection.includes('Other') && other.trim()) final.push(other.trim());
    if (final.length === 0) return;
    onSubmit(input.mode === 'single' ? final[0] : final);
  };

  return (
    <Card className="glass-heavy border-l-4 border-l-violet-500 p-4">
      <p className="font-medium mb-3">{input.question}</p>
      {input.mode === 'single' ? (
        <RadioGroup value={selection[0]} onValueChange={v => setSelection([v])}>
          {[...input.options, 'Other'].map(opt => <RadioOption key={opt} value={opt} label={opt} />)}
        </RadioGroup>
      ) : (
        <CheckboxList options={[...input.options, 'Other']} value={selection} onChange={setSelection} />
      )}
      {selection.includes('Other') && <Input placeholder="Your answer…" value={other} onChange={e => setOther(e.target.value)} className="mt-2" />}
      <Button disabled={selection.length === 0 || (selection.includes('Other') && !other.trim())} onClick={submit} className="mt-3">Submit</Button>
    </Card>
  );
}
```

After submit, the tool part's state transitions to `output-available` (via useChat's addToolOutput), which flips rendering to "You answered: {reply}" inline via the MessageBubble's normal tool-result path.

Violet left-accent matches DESIGN.md §3 `--accent-ask`.

### Detection: render AskInline conditionally

Update `components/stream/MessageBubble.tsx` (or its ToolCallLine renderer) to special-case `tool.toolName === 'askUser'` and `tool.state === 'input-available'` → render `<AskInline>` in place of the default ToolCallLine.

## Acceptance

- `bun dev` then navigate to `/` → submit `balanceyourbp.com` with TikTok + IG socials → route advances to `/research/{sid}`.
- Against Lane A's backend (or fixture short-circuit): tool-call lines appear in sequence, thought blocks expand mid-flight and collapse to "Thought briefly", fact text segments appear with 400ms spacing.
- When `askUser` fires: AskInline card renders inline with violet accent, radio options populated, "Other" reveals an input. Submitting calls `addToolOutput` and the card collapses to the user's answer.
- Refresh the page mid-stream: `buildUIMessages` + `setMessages` rehydrates the stream; new events arrive.
- ConfirmCta appears 500ms after `finalize_research` tool result lands.
- Commit: `"lane-c: screens 1 + 2, AskInline HIL, stream rendering"`.

## Watch-outs

- **`addToolOutput` API name** — AI SDK v6 changed from `addToolResult` to `addToolOutput`. Use the newer name; if the installed version has the older name, check the `@ai-sdk/react` version in package.json and adapt.
- **`sendAutomaticallyWhen: 'lastAssistantMessageIsCompleteWithToolCalls'`** may need to be passed to useChat for the tool result to trigger an auto-follow-up request. Check the AI SDK docs; the default behavior in v6 might already handle it.
- **Seed message**: we construct it from `{websiteUrl, socials}`. Format: `"Research the brand at {websiteUrl}. Here are their social accounts: {socials}. Produce a thorough ResearchOutput."`. Make it unambiguous so the LLM knows what to do without ambiguity — this is not a chat; it's a one-turn research task.
- **No chat input UI** — there's no textarea on Screen 2. User does not type. The stream is driven entirely by the seed message + the askUser inline form.
- **HeroStrip action derivation**: scan messages from the end, find the most recent assistant message, find the last tool-call part with `state: 'input-available'` (no matching result), use its tool label. If none inflight → show "Thinking…" or "Synthesizing…" based on presence of reasoning part.

## Do NOT

- Touch Screen 3 or 4 (Lane D).
- Touch backend files (Lane A/B).
- Implement a chat input textarea — there's no multi-turn user chat in this app. The only user input mid-stream is AskInline.
