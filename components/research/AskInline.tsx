"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type AskInput = {
  question: string;
  mode: "single" | "multi";
  options: string[];
};

export function AskInline({
  toolCallId,
  input,
  onSubmit,
}: {
  toolCallId: string;
  input: AskInput;
  onSubmit: (reply: string | string[]) => void;
}) {
  const [selection, setSelection] = React.useState<string[]>([]);
  const [other, setOther] = React.useState("");

  const optionsWithOther = React.useMemo(
    () => [...input.options, "Other"],
    [input.options],
  );

  const toggle = (opt: string) => {
    setSelection((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt],
    );
  };

  const needsOther = selection.includes("Other");
  const canSubmit =
    selection.length > 0 && (!needsOther || other.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    const final = selection
      .map((s) => (s === "Other" ? other.trim() : s))
      .filter(Boolean);
    if (final.length === 0) return;
    onSubmit(input.mode === "single" ? final[0] : final);
  };

  const radioName = `ask-${toolCallId}`;

  return (
    <div
      className="glass-heavy rounded-card border-l-4 p-4 animate-in fade-in duration-200"
      style={{ borderLeftColor: "hsl(var(--accent-ask))" }}
      role="group"
      aria-label={input.question}
    >
      <p className="font-medium mb-3">{input.question}</p>
      {input.mode === "single" ? (
        <RadioGroup
          name={radioName}
          value={selection[0]}
          onValueChange={(v) => setSelection([v])}
        >
          {optionsWithOther.map((opt) => {
            const id = `${radioName}-${opt}`;
            return (
              <label
                key={opt}
                htmlFor={id}
                className="flex items-center gap-2 cursor-pointer text-sm"
              >
                <RadioGroupItem id={id} value={opt} />
                <span>{opt}</span>
              </label>
            );
          })}
        </RadioGroup>
      ) : (
        <div className="flex flex-col gap-2">
          {optionsWithOther.map((opt) => {
            const id = `${radioName}-${opt}`;
            return (
              <label
                key={opt}
                htmlFor={id}
                className="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Checkbox
                  id={id}
                  checked={selection.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}
      {needsOther && (
        <Input
          autoFocus
          placeholder="Your answer…"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          className="mt-2"
        />
      )}
      <Button
        disabled={!canSubmit}
        onClick={submit}
        className="mt-3"
        size="sm"
      >
        Submit
      </Button>
    </div>
  );
}
