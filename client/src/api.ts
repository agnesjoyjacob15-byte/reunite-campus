const base = import.meta.env.VITE_API_URL || "/api";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(base + path, {
      method,
      credentials: "include",
      headers: data === undefined ? {} : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    if (r.status === 204) return undefined as T;
    const body = await r
      .json()
      .catch(() => ({
        message: "The service returned an unexpected response.",
      }));
    if (!r.ok)
      throw new ApiError(
        body.message || "The request could not be completed.",
        r.status,
      );
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError")
      throw new ApiError("The request took too long. Please try again.");
    throw new ApiError(
      "We couldn't reach the service. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function downloadSummary() {
  const r = await fetch(base + "/reports.csv", {
    credentials: "include",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw new Error("The summary could not be downloaded. Please try again.");
  const url = URL.createObjectURL(await r.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download = "reunite-report-summary.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
