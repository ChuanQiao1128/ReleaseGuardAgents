import { ScannerCoverage, UnresolvedCallsite } from "./types";

export type SuggestedOverride = {
  routeId: string;
  apiId: string;
  reason: string;
};

export function suggestOverrides(args: {
  coverage: ScannerCoverage;
  unresolvedCallsites: UnresolvedCallsite[];
}): SuggestedOverride[] {
  const suggestions: SuggestedOverride[] = [];
  const routeCheckout = args.coverage.detectedRoutes.find(
    (route) => route.id === "route_checkout" || route.target === "/checkout",
  );
  const discountApi = args.coverage.detectedApis.find(
    (api) => api.id === "api_apply_discount" ||
      api.target === "POST /api/discount/apply",
  );
  if (!routeCheckout || !discountApi) {
    return suggestions;
  }

  const hasCheckoutDiscountUnresolved = args.unresolvedCallsites.some((callsite) => {
    const haystack = `${callsite.filePath} ${callsite.quote} ${callsite.reason}`.toLowerCase();
    return haystack.includes("checkout") || haystack.includes("discount");
  });
  if (!hasCheckoutDiscountUnresolved) {
    return suggestions;
  }

  suggestions.push({
    routeId: routeCheckout.id,
    apiId: discountApi.id,
    reason:
      "Unresolved checkout/discount callsite may represent a route-to-API dependency.",
  });
  return suggestions;
}

export function renderSuggestedOverrideSnippet(
  suggestions: SuggestedOverride[],
): string[] {
  if (suggestions.length === 0) {
    return ["- None"];
  }
  const lines = ["```yaml", "suggested_overrides:", "  consumers:"];
  for (const suggestion of suggestions) {
    lines.push(`    ${suggestion.routeId}:`);
    lines.push(`      - ${suggestion.apiId}`);
  }
  lines.push("```");
  return lines;
}
