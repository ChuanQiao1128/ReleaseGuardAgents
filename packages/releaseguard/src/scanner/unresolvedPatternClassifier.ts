import { UnresolvedCallsite } from "./types";

export type UnresolvedPatternCategory =
  | "endpoint_constant"
  | "template_literal"
  | "axios_wrapper"
  | "trpc_client"
  | "graphql_operation"
  | "generated_client"
  | "dynamic_url"
  | "unknown_client_call"
  | "unsupported_framework";

export function classifyUnresolvedPattern(
  callsite: Pick<UnresolvedCallsite, "reason" | "quote">,
): UnresolvedPatternCategory {
  const haystack = `${callsite.reason} ${callsite.quote}`.toLowerCase();
  if (haystack.includes("unsupported framework")) {
    return "unsupported_framework";
  }
  if (/\baxios\b/.test(haystack)) {
    return "axios_wrapper";
  }
  if (/\btrpc\b|\bapi\.[a-z0-9_]+\.[a-z0-9_]+/.test(haystack)) {
    return "trpc_client";
  }
  if (/\bgraphql\b|\bgql\b|apollo|urql/.test(haystack)) {
    return "graphql_operation";
  }
  if (haystack.includes("`") || haystack.includes("${")) {
    return "template_literal";
  }
  if (/generated|openapi|sdk|client\./.test(haystack)) {
    return "generated_client";
  }
  if (/const\s+[a-z0-9_]*url|endpoint|api_url|base_url/.test(haystack)) {
    return "endpoint_constant";
  }
  if (/fetch\s*\(\s*[a-z0-9_./]+|dynamic url|unsupported fetch/.test(haystack)) {
    return "dynamic_url";
  }
  return "unknown_client_call";
}
