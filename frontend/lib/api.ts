const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
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
      cache: "no-store"
    });

    const data = await readJson(response);

    if (!response.ok) {
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await readJson(response);

    if (!response.ok) {
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
      method: "DELETE"
    });

    const data = await readJson(response);

    if (!response.ok) {
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