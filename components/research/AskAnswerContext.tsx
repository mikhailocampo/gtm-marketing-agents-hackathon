"use client";

import * as React from "react";

export type AskAnswer = (toolCallId: string, reply: string | string[]) => void;

const AskAnswerContext = React.createContext<AskAnswer | null>(null);

export function AskAnswerProvider({
  value,
  children,
}: {
  value: AskAnswer;
  children: React.ReactNode;
}) {
  return (
    <AskAnswerContext.Provider value={value}>
      {children}
    </AskAnswerContext.Provider>
  );
}

export function useAskAnswer(): AskAnswer | null {
  return React.useContext(AskAnswerContext);
}
