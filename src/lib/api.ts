import { env } from "../config/env.ts";
import type { TimelineItem } from "../types/timeline.ts";
import type { BlogPost, BlogPostInput } from "../types/blog.ts";
import type {
    AdminFeedbackForm,
    Answers,
    FeedbackForm,
    FeedbackFormListItem,
    FeedbackFormSummary,
    FeedbackQuestion,
    FormInput,
    FormStats,
    PublicFeedbackForm,
    QuestionInput,
    ResponsesPage,
} from "../types/feedback.ts";

type ApiErrorData = { message?: string; errors?: Record<string, string> };

export class ApiError extends Error {
    readonly status: number;
    // Parsed JSON error body, when there is one
    readonly data: ApiErrorData | null;

    constructor(message: string, status: number, data: ApiErrorData | null) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

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
        const data = await response.json().catch(() => null);
        throw new ApiError(
            `API request failed: ${response.status} ${response.statusText}`,
            response.status,
            data
        );
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

export async function getBlogPosts() {
    const response = await apiFetch("/blog-posts");
    return response.json() as Promise<BlogPost[]>;
}

export async function getBlogPost(id: string) {
    const response = await apiFetch(`/blog-posts/${id}`);
    return response.json() as Promise<BlogPost>;
}

export async function createBlogPost(
    post: BlogPostInput,
    accessToken: string
) {
    const response = await apiFetch("/blog-posts", {
        method: "POST",
        accessToken,
        body: JSON.stringify(post),
    });
    return response.json() as Promise<BlogPost>;
}

export async function updateBlogPost(
    id: string,
    post: BlogPostInput,
    accessToken: string
) {
    const response = await apiFetch(`/blog-posts/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(post),
    });
    return response.json() as Promise<BlogPost>;
}

export async function deleteBlogPost(id: string, accessToken: string) {
    await apiFetch(`/blog-posts/${id}`, {
        method: "DELETE",
        accessToken,
    });
}

export async function getOpenFeedbackForms() {
    const response = await apiFetch("/feedback/forms");
    return response.json() as Promise<FeedbackFormSummary[]>;
}

export async function getFeedbackForm(slug: string) {
    const response = await apiFetch(`/feedback/forms/${encodeURIComponent(slug)}`);
    return response.json() as Promise<PublicFeedbackForm>;
}

export async function submitFeedback(
    slug: string,
    answers: Answers,
    respondent: string,
    website: string
) {
    await apiFetch(`/feedback/forms/${encodeURIComponent(slug)}/responses`, {
        method: "POST",
        body: JSON.stringify({ answers, respondent, website }),
    });
}

export async function getAdminFeedbackForms(accessToken: string) {
    const response = await apiFetch("/feedback/admin/forms", { accessToken });
    return response.json() as Promise<FeedbackFormListItem[]>;
}

export async function getAdminFeedbackForm(id: string, accessToken: string) {
    const response = await apiFetch(`/feedback/admin/forms/${id}`, { accessToken });
    return response.json() as Promise<AdminFeedbackForm>;
}

export async function createFeedbackForm(form: FormInput, accessToken: string) {
    const response = await apiFetch("/feedback/admin/forms", {
        method: "POST",
        accessToken,
        body: JSON.stringify(form),
    });
    return response.json() as Promise<FeedbackForm>;
}

export async function updateFeedbackForm(id: string, form: FormInput, accessToken: string) {
    const response = await apiFetch(`/feedback/admin/forms/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(form),
    });
    return response.json() as Promise<FeedbackForm>;
}

export async function deleteFeedbackForm(id: string, accessToken: string) {
    await apiFetch(`/feedback/admin/forms/${id}`, {
        method: "DELETE",
        accessToken,
    });
}

export async function duplicateFeedbackForm(id: string, accessToken: string) {
    const response = await apiFetch(`/feedback/admin/forms/${id}/duplicate`, {
        method: "POST",
        accessToken,
    });
    return response.json() as Promise<FeedbackForm>;
}

export async function createFeedbackQuestion(
    formId: string,
    question: QuestionInput,
    accessToken: string
) {
    const response = await apiFetch(`/feedback/admin/forms/${formId}/questions`, {
        method: "POST",
        accessToken,
        body: JSON.stringify(question),
    });
    return response.json() as Promise<FeedbackQuestion>;
}

export async function updateFeedbackQuestion(
    id: string,
    question: QuestionInput,
    accessToken: string
) {
    const response = await apiFetch(`/feedback/admin/questions/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(question),
    });
    return response.json() as Promise<FeedbackQuestion>;
}

// Answered questions are archived instead of deleted
export async function deleteFeedbackQuestion(id: string, accessToken: string) {
    const response = await apiFetch(`/feedback/admin/questions/${id}`, {
        method: "DELETE",
        accessToken,
    });
    return response.json() as Promise<{ archived: boolean }>;
}

export async function reorderFeedbackQuestions(
    formId: string,
    ids: string[],
    accessToken: string
) {
    await apiFetch(`/feedback/admin/forms/${formId}/questions/order`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify({ ids }),
    });
}

export async function getFeedbackStats(formId: string, accessToken: string) {
    const response = await apiFetch(`/feedback/admin/forms/${formId}/stats`, { accessToken });
    return response.json() as Promise<FormStats>;
}

export async function getFeedbackResponses(formId: string, page: number, accessToken: string) {
    const response = await apiFetch(
        `/feedback/admin/forms/${formId}/responses?page=${page}`,
        { accessToken }
    );
    return response.json() as Promise<ResponsesPage>;
}

export async function deleteFeedbackResponse(id: string, accessToken: string) {
    await apiFetch(`/feedback/admin/responses/${id}`, {
        method: "DELETE",
        accessToken,
    });
}

// A plain link cannot send the auth header, so fetch the file and save it.
export async function downloadFeedbackCsv(formId: string, slug: string, accessToken: string) {
    const response = await apiFetch(`/feedback/admin/forms/${formId}/responses.csv`, {
        accessToken,
    });
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-responses.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
