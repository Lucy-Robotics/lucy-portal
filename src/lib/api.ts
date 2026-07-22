import { env } from "../config/env.ts";
import type { TimelineItem } from "../types/timeline.ts";

type ApiRequestOptions = RequestInit & {
    accessToken?: string | null;
};

export async function apiFetch(path: string, options: ApiRequestOptions = {}) {
    const { accessToken, headers, ...rest } = options;

    const response = await fetch(`${env.backendUrl}${path}`, {
        ...rest,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(accessToken ? { "X-Auth-Token": accessToken } : {}),
            ...headers,
        },
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
}

export async function getRoadmapItems() {
    const response = await apiFetch("/roadmap-items");
    return response.json() as Promise<TimelineItem[]>;
}

export async function getRoadmapItem(id: string) {
    const response = await apiFetch(`/roadmap-items/${id}`);
    return response.json() as Promise<TimelineItem>;
}

export async function updateRoadmapItem(
    id: string,
    item: Omit<TimelineItem, "id">,
    accessToken: string
) {
    const response = await apiFetch(`/roadmap-items/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(item),
    });
    return response.json() as Promise<TimelineItem>;
}

export async function deleteRoadmapItem(id: string, accessToken: string) {
    await apiFetch(`/roadmap-items/${id}`, {
        method: "DELETE",
        accessToken,
    });
}

export async function createRoadmapItem(
    item: Omit<TimelineItem, "id">,
    accessToken: string
) {
    const response = await apiFetch("/roadmap-items", {
        method: "POST",
        accessToken,
        body: JSON.stringify(item),
    });
    return response.json() as Promise<TimelineItem>;
}
