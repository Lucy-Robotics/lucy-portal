import React, { isValidElement, useEffect, useId, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Raw HTML is allowed
const schema = { ...defaultSchema, tagNames: [...(defaultSchema.tagNames ?? []), 'u'] };

const Mermaid: React.FC<{ chart: string }> = ({ chart }) => {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Loaded on demand: mermaid is large and most posts have no diagram.
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, theme: 'dark', suppressErrorRendering: true });
        if (!(await mermaid.parse(chart, { suppressErrors: true }))) {
          if (!cancelled) setSvg(null);
          return;
        }
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  // Until it renders, or if the syntax is invalid, show the source.
  if (!svg) {
    return (
      <pre>
        <code>{chart}</code>
      </pre>
    );
  }
  // mermaid's default securityLevel ('strict') sanitizes the SVG it returns.
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
};

const Markdown: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
    components={{
      pre: ({ node: _node, children: preChildren, ...props }) => {
        const code = isValidElement<{ className?: string; children?: React.ReactNode }>(preChildren)
          ? preChildren.props
          : null;
        if (code?.className === 'language-mermaid') {
          return <Mermaid chart={String(code.children).trim()} />;
        }
        return <pre {...props}>{preChildren}</pre>;
      },
    }}
  >
    {children}
  </ReactMarkdown>
);

export default Markdown;
