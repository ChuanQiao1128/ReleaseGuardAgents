import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectFramework } from "../src/scanner/frameworkDetector";
import { findReactRouterRoutes } from "../src/scanner/viteReactRouterRouteScanner";
import {
  findAxiosCallsites,
  findAxiosCreateAssignments,
  findUnresolvedAxiosCallsites,
} from "../src/scanner/axiosCallsiteScanner";
import { scanRepository } from "../src/scanner/repoScanner";

describe("Vite + React Router framework detection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "releaseguard-vite-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("detects vite_react_router when package.json has vite + react-router-dom and a src/ dir", async () => {
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "demo",
        dependencies: { "react-router-dom": "^7.0.0" },
        devDependencies: { vite: "^7.0.0" },
      }),
    );
    await fs.mkdir(path.join(tmpDir, "src"));
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), "{}");

    const detection = await detectFramework(tmpDir);

    expect(detection.kind).toBe("vite_react_router");
    expect(detection.isViteReactRouter).toBe(true);
    expect(detection.isTypeScript).toBe(true);
    expect(detection.appRoot).toBe(tmpDir);
  });

  it("falls back to unsupported when only vite is present (no router)", async () => {
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ devDependencies: { vite: "^7.0.0" } }),
    );
    await fs.mkdir(path.join(tmpDir, "src"));

    const detection = await detectFramework(tmpDir);

    expect(detection.kind).toBe("unsupported");
  });

  it("falls back to unsupported when src/ is missing", async () => {
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: { "react-router-dom": "^7.0.0" },
        devDependencies: { vite: "^7.0.0" },
      }),
    );

    const detection = await detectFramework(tmpDir);

    expect(detection.kind).toBe("unsupported");
  });

  it("prefers Next.js App Router over Vite when both could match", async () => {
    // Set up a hybrid: app/ dir AND vite + react-router in deps.
    // The Next.js detector should win (first pass).
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: { "react-router-dom": "^7.0.0", next: "^14.0.0" },
        devDependencies: { vite: "^7.0.0" },
      }),
    );
    await fs.mkdir(path.join(tmpDir, "app"));
    await fs.mkdir(path.join(tmpDir, "src"));

    const detection = await detectFramework(tmpDir);

    expect(detection.kind).toBe("nextjs_app_router");
  });
});

describe("React Router route extraction", () => {
  it("extracts paths from JSX <Route path>", () => {
    const source = `
      import { Routes, Route } from "react-router-dom";
      export function App() {
        return (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recalls" element={<RecallList />} />
            <Route path="/recalls/:id" element={<RecallDetail />} />
          </Routes>
        );
      }
    `;
    const matches = findReactRouterRoutes(source);
    const paths = matches.map((m) => m.path).sort();

    expect(paths).toContain("/");
    expect(paths).toContain("/recalls");
    expect(paths).toContain("/recalls/:id");
    expect(matches.every((m) => m.basis === "react_router_jsx_route")).toBe(
      true,
    );
  });

  it("extracts paths from createBrowserRouter object form", () => {
    const source = `
      import { createBrowserRouter } from "react-router-dom";
      export const router = createBrowserRouter([
        { path: "/", element: <Home /> },
        { path: "/checkout", element: <Checkout /> },
        { path: "/admin", element: <Admin />, children: [
          { path: "/admin/users", element: <Users /> }
        ]},
      ]);
    `;
    const matches = findReactRouterRoutes(source);
    const paths = matches.map((m) => m.path).sort();

    expect(paths).toContain("/");
    expect(paths).toContain("/checkout");
    expect(paths).toContain("/admin");
    expect(paths).toContain("/admin/users");
    expect(matches.every((m) => m.basis === "react_router_object_route")).toBe(
      true,
    );
  });

  it("does not match path: properties outside router constructors", () => {
    const source = `
      const config = {
        path: "/etc/foo",
        otherKey: 1,
      };
    `;
    expect(findReactRouterRoutes(source)).toEqual([]);
  });

  it("handles useRoutes object form", () => {
    const source = `
      const element = useRoutes([
        { path: "/login", element: <Login /> },
        { path: "/signup", element: <Signup /> },
      ]);
    `;
    const paths = findReactRouterRoutes(source).map((m) => m.path).sort();
    expect(paths).toEqual(["/login", "/signup"]);
  });

  it("ignores non-literal path expressions", () => {
    const source = `
      <Route path={someVar} element={<X />} />
      createBrowserRouter([
        { path: \`/users/\${id}\`, element: <U /> },
      ]);
    `;
    expect(findReactRouterRoutes(source)).toEqual([]);
  });
});

describe("Axios callsite extraction", () => {
  it("extracts axios.METHOD literal calls", () => {
    const source = `
      import axios from "axios";
      export async function loadRecalls() {
        return axios.get("/api/recalls");
      }
      export async function searchRecalls(q: string) {
        return axios.post("/api/recalls/search", { q });
      }
    `;
    const matches = findAxiosCallsites(source);

    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/recalls",
        method: "GET",
        basis: "axios_method_literal",
      }),
    );
    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/recalls/search",
        method: "POST",
        basis: "axios_method_literal",
      }),
    );
  });

  it("extracts axios callable form with method config", () => {
    const source = `
      axios("/api/billing/charge", { method: "POST" });
      axios("/api/recalls/123");
    `;
    const matches = findAxiosCallsites(source);

    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/billing/charge",
        method: "POST",
        basis: "axios_callable_literal",
      }),
    );
    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/recalls/123",
        method: "GET",
        basis: "axios_callable_literal",
      }),
    );
  });

  it("extracts axios.request config object", () => {
    const source = `
      axios.request({ url: "/api/auth/login", method: "POST" });
    `;
    const matches = findAxiosCallsites(source);

    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/auth/login",
        method: "POST",
        basis: "axios_request_config_literal",
      }),
    );
  });

  it("extracts callsites from a TanStack Query queryFn (axios inside)", () => {
    const source = `
      const query = useQuery({
        queryKey: ["recalls"],
        queryFn: () => axios.get("/api/recalls"),
      });
    `;
    const matches = findAxiosCallsites(source);
    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/recalls",
        method: "GET",
      }),
    );
  });

  it("extracts wrapped client calls (apiClient.METHOD literal)", () => {
    const source = `
      const apiClient = axios.create({ baseURL: "/api" });
      apiClient.post("/recalls", { name: "test" });
    `;
    const matches = findAxiosCallsites(source);
    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/recalls",
        method: "POST",
        basis: "axios_client_wrapper_literal",
      }),
    );
  });

  it("recognizes the well-known 'http' client name without an explicit assignment", () => {
    // Common pattern: http is imported from another file. Even without
    // discovering the assignment in this file, we should pick up the call.
    const source = `
      import { http } from "./api/http";
      export async function loadDecks() {
        return http.get<Deck[]>("/api/v1/authoring/decks");
      }
      export async function createDeck(body: unknown) {
        return http.post("/api/v1/authoring/decks", body);
      }
    `;
    const matches = findAxiosCallsites(source);

    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/v1/authoring/decks",
        method: "GET",
        basis: "axios_client_wrapper_literal",
      }),
    );
    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/v1/authoring/decks",
        method: "POST",
        basis: "axios_client_wrapper_literal",
      }),
    );
  });

  it("discovers axios.create() assignments and uses the variable name", () => {
    const source = `
      import axios from "axios";
      export const myCustomThing = axios.create({ baseURL: "/api" });
      const otherClient = axios.create({});
      let unconventional = axios.create({});
    `;
    const names = findAxiosCreateAssignments(source);
    expect(names.sort()).toEqual([
      "myCustomThing",
      "otherClient",
      "unconventional",
    ]);
  });

  it("uses discovered names from a different file to recognize callsites", () => {
    // Two-file simulation: one file defines the client, another uses it.
    // findAxiosCallsites should pick up the usage when given the discovered
    // set.
    const definitionSource = `
      import axios from "axios";
      export const myCustomThing = axios.create({ baseURL: "/api" });
    `;
    const usageSource = `
      import { myCustomThing } from "./client";
      myCustomThing.delete("/recalls/123");
    `;
    const discovered = new Set<string>(findAxiosCreateAssignments(definitionSource));

    const matches = findAxiosCallsites(usageSource, new Set([
      ...discovered,
      "http", "api", "client", "request", "instance",
      "httpClient", "axiosInstance",
    ]));

    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/recalls/123",
        method: "DELETE",
      }),
    );
  });

  it("rejects template literals with ${...} interpolation as resolved (regression)", () => {
    // Regression for the "api_cards_id_encodeuricomponent_cardid_v1_authoring"
    // garbage-id bug found on a real-world Vite + React Router project.
    // Backtick templates with interpolation must NOT produce api nodes; they
    // should fall through to the unresolved scanner.
    const source = `
      import { http } from "./api/http";
      export async function deleteCard(cardId: string) {
        return http.delete<ApiResult<null>>(\`/api/v1/authoring/cards?id=\${encodeURIComponent(cardId)}\`);
      }
      export async function checkStatus(jobId: string) {
        return http.get(\`/api/v1/authoring/publish/status?jobId=\${encodeURIComponent(jobId)}\`);
      }
    `;
    const matches = findAxiosCallsites(source);
    // No URL containing "${" should be in the resolved match list.
    for (const m of matches) {
      expect(m.url).not.toContain("\${");
    }
    // And the unresolved scanner should pick them up.
    const unresolved = findUnresolvedAxiosCallsites(source, "src/api/x.ts");
    expect(unresolved.length).toBeGreaterThanOrEqual(2);
  });

  it("still resolves backtick literals WITHOUT interpolation", () => {
    // Sanity: plain backtick literals must still work — only ${ triggers
    // the rejection.
    const source = `
      import { http } from "./api/http";
      http.get(\`/api/v1/recalls\`);
    `;
    const matches = findAxiosCallsites(source);
    expect(matches).toContainEqual(
      expect.objectContaining({
        url: "/api/v1/recalls",
        method: "GET",
      }),
    );
  });

  it("flags non-literal axios URLs as unresolved", () => {
    const source = `
      axios.get(url);
      axios.post(\`/api/users/\${id}\`);
    `;
    const unresolved = findUnresolvedAxiosCallsites(source, "src/api/x.ts");
    expect(unresolved.length).toBeGreaterThanOrEqual(2);
    expect(unresolved.every((u) => u.confidence === "unresolved")).toBe(true);
  });
});

describe("End-to-end scan on a fixture Vite + React Router project", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "releaseguard-vite-e2e-"));

    // Minimal Vite + React Router 7 project layout
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "fixture",
        type: "module",
        dependencies: {
          axios: "^1.13.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "react-router-dom": "^7.0.0",
          "@tanstack/react-query": "^5.0.0",
        },
        devDependencies: {
          vite: "^7.0.0",
          typescript: "^5.0.0",
        },
      }),
    );
    await fs.writeFile(path.join(tmpDir, "tsconfig.json"), "{}");

    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
    await fs.mkdir(path.join(tmpDir, "src", "pages"), { recursive: true });

    // App.tsx with JSX routes
    await fs.writeFile(
      path.join(tmpDir, "src", "App.tsx"),
      `
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RecallList } from "./pages/RecallList";
import { Checkout } from "./pages/Checkout";
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/recalls" element={<RecallList />} />
        <Route path="/checkout" element={<Checkout />} />
      </Routes>
    </BrowserRouter>
  );
}
      `.trim(),
    );

    // Wrapped axios client (mirrors the real-world recallsmith/frontend layout)
    await fs.mkdir(path.join(tmpDir, "src", "api"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "src", "api", "http.ts"),
      `
import axios from "axios";
export const http = axios.create({
  baseURL: "/api",
  timeout: 15000,
});
      `.trim(),
    );

    // Page that uses the wrapped client (no direct 'axios' identifier here)
    await fs.writeFile(
      path.join(tmpDir, "src", "pages", "RecallList.tsx"),
      `
import { http } from "../api/http";
import { useQuery } from "@tanstack/react-query";
export function RecallList() {
  const q = useQuery({
    queryKey: ["recalls"],
    queryFn: () => http.get("/api/recalls"),
  });
  return <div>recalls</div>;
}
      `.trim(),
    );

    // Critical page that calls billing through the wrapped client
    await fs.writeFile(
      path.join(tmpDir, "src", "pages", "Checkout.tsx"),
      `
import { http } from "../api/http";
export function Checkout() {
  async function pay() {
    await http.post("/api/billing/charge", { amount: 1 });
  }
  return <button onClick={pay}>Pay</button>;
}
      `.trim(),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("builds a capability graph with routes and outbound APIs", async () => {
    const { graph, result } = await scanRepository(tmpDir);

    const routeNodes = Object.values(graph.nodes).filter(
      (node) => node.type === "route",
    );
    const apiNodes = Object.values(graph.nodes).filter(
      (node) => node.type === "api",
    );

    const routePaths = routeNodes.map((node) => node.target).sort();
    expect(routePaths).toEqual(["/", "/checkout", "/recalls"]);

    const apiTargets = apiNodes.map((node) => node.target).sort();
    expect(apiTargets).toContain("GET /api/recalls");
    expect(apiTargets).toContain("POST /api/billing/charge");

    // /checkout should be elevated to high risk because of the route name heuristic
    const checkoutNode = routeNodes.find((node) => node.target === "/checkout");
    expect(checkoutNode?.risk).toBe("high");

    // Billing API should be elevated to high risk because of the URL heuristic
    const billingApi = apiNodes.find(
      (node) => node.target === "POST /api/billing/charge",
    );
    expect(billingApi?.risk).toBe("high");

    // Coverage report should reflect the detected routes/APIs
    expect(result.coverage.detectedRoutes.length).toBe(3);
    expect(result.coverage.detectedApis.length).toBeGreaterThanOrEqual(2);
    expect(result.coverage.resolvedCallsites.length).toBeGreaterThanOrEqual(2);
  });
});
