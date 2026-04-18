export type ToolErrorCode =
  | "apify_not_configured"
  | "apify_timeout"
  | "apify_empty_result"
  | "apify_rate_limited"
  | "llm_parse_failed"
  | "llm_rate_limited"
  | "llm_content_blocked"
  | "nano_banana_rate_limited"
  | "nano_banana_failed"
  | "r2_put_failed"
  | "session_not_found"
  | "session_expired"
  | "invalid_input";

export type ToolError = {
  error: true;
  error_code: ToolErrorCode;
  message: string;
  recoverable: boolean;
  retry_safe: boolean;
  context?: Record<string, unknown>;
};

export function toolError(params: {
  code: ToolErrorCode;
  message: string;
  recoverable: boolean;
  retry_safe: boolean;
  context?: Record<string, unknown>;
}): ToolError {
  return {
    error: true,
    error_code: params.code,
    message: params.message,
    recoverable: params.recoverable,
    retry_safe: params.retry_safe,
    context: params.context,
  };
}

export function isToolError(v: unknown): v is ToolError {
  return (
    typeof v === "object" &&
    v !== null &&
    "error" in v &&
    (v as { error: unknown }).error === true
  );
}
