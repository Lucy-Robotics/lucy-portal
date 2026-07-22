import { env } from "../config/env.ts";

type ApiRequestOptions = RequestInit & {
    accessToken?: string | null;
};

export async function apiFetch(path: string, options: ApiRequestOptions = {}) {
    const { accessToken, headers, ...rest } = options;

    const response = await fetch(`${env.backendUrl}${path}`, {
        ...rest,
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...headers,
        },
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
}
