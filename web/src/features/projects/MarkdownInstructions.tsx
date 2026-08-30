import { Component, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { safeMarkdownUrl } from './markdownSecurity'

class MarkdownErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {}

  render() {
    if (this.state.failed) {
      return (
        <div className="page-notice page-notice--error" role="alert">
          <strong>Instructions could not be rendered</strong>
          <p>
            The stored Markdown remains available when the project is edited.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

export function MarkdownInstructions({ markdown }: { markdown: string }) {
  return (
    <MarkdownErrorBoundary>
      <div className="markdown-content">
        <ReactMarkdown
          allowedElements={[
            'a',
            'blockquote',
            'br',
            'code',
            'del',
            'em',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'hr',
            'li',
            'ol',
            'p',
            'pre',
            'strong',
            'table',
            'tbody',
            'td',
            'th',
            'thead',
            'tr',
            'ul',
          ]}
          unwrapDisallowed
          urlTransform={safeMarkdownUrl}
          components={{
            a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  )
}
