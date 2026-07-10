const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const token = window.localStorage.getItem("crm_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(response: Response) {
  if (response.status !== 401 || typeof window === "undefined") {
    return;
  }

  if (window.location.pathname === "/login") {
    return;
  }

  window.localStorage.removeItem("crm_token");
  window.localStorage.removeItem("crm_user");
  document.cookie = "crm_token=; Path=/; Max-Age=0; SameSite=Lax";

  window.location.href = `/login?next=${encodeURIComponent(
    window.location.pathname
  )}`;
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiGet<T = any>(path: string): Promise<T | null> {
  try {
    const response = await fetch(buildUrl(path), {
      cache: "no-store",
      headers: authHeaders()
    });

    const data = await readJson(response);

    if (!response.ok) {
      handleUnauthorized(response);
      return null;
    }

    return data as T;
  } catch {
    return null;
  }
}

export async function apiPost<T = any>(
  path: string,
  body: unknown
): Promise<T | { success: false; message: string }> {
  try {
    const response = await fetch(buildUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(body)
    });

    const data = await readJson(response);

    if (!response.ok) {
      handleUnauthorized(response);
      return (
        data || {
          success: false,
          message: "Request failed"
        }
      );
    }

    return data || ({ success: true } as T);
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Something went wrong"
    };
  }
}

export async function apiPut<T = any>(
  path: string,
  body: unknown
): Promise<T | { success: false; message: string }> {
  try {
    const response = await fetch(buildUrl(path), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(body)
    });

    const data = await readJson(response);

    if (!response.ok) {
      handleUnauthorized(response);
      return (
        data || {
          success: false,
          message: "Request failed"
        }
      );
    }

    return data || ({ success: true } as T);
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Something went wrong"
    };
  }
}

export async function apiDelete<T = any>(
  path: string
): Promise<T | { success: false; message: string }> {
  try {
    const response = await fetch(buildUrl(path), {
      method: "DELETE",
      headers: authHeaders()
    });

    const data = await readJson(response);

    if (!response.ok) {
      handleUnauthorized(response);
      return (
        data || {
          success: false,
          message: "Delete request failed"
        }
      );
    }

    return data || ({ success: true } as T);
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Something went wrong"
    };
  }
}
