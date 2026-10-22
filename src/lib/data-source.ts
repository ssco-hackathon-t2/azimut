/** Pure URL routing, shared by hooks, chart sources and exports. */
export function resultURL(name: string, query: string, basePath: string, mode: string, apiOrigin = ''): string {
  if (mode === "fixture") return `${basePath}/data/fixture/${name}`;
  const input = new URLSearchParams(query);
  const output = new URLSearchParams();
  const keys = name === "timeline.json" ? ["scope"] :
    ["runs.json", "traces.json"].includes(name) ? ["jahr", "szenario", "scope"] : [];
  for (const key of keys) {
    const value = input.get(key);
    if (value) output.set(key, value);
  }
  return `${apiOrigin.replace(/\/$/, '') || basePath}/api/${name}${output.size ? `?${output}` : ""}`;
}
