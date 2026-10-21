import assert from "node:assert/strict";
import test from "node:test";

import { stripMarkdown } from "./markdownText.ts";

test("stripMarkdown keeps the readable text only", () => {
    const md = [
        "## This post is SO GREAT",
        "",
        "That is supports [links]() and ",
        '<img src="https://i.ytimg.com/vi/iULi4-qz22I/maxresdefault.jpg" alt="kung fu" width="300" />',
        "",
        "> And even **MERMAID**",
        "",
        "```mermaid",
        "graph LR",
        "    A[Broken] --> B{Powered?}",
        "    B -->|No| C[Plug / On]",
        "    B -->|Yes| D{Beans / Water?}",
        "    D -->|Empty| E[Refill]",
        "    D -->|Full| F[Repair]",
        "```",
        "",
        "- boom `badaboom`",
        "",
        '![got u](https://i.insider.com/602ee9ced3ad27001837f2ac)',
    ].join("\n");
    assert.equal(stripMarkdown(md), "Lucy update Read the docs first. one two Done with code.");
});

test("stripMarkdown leaves legacy HTML untouched for the HTML parser", () => {
    assert.equal(stripMarkdown("<p>Hello <b>world</b></p>"), "<p>Hello <b>world</b></p>");
});
