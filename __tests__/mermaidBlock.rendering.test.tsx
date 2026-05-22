import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MermaidBlock from '../components/MermaidBlock';

describe('MermaidBlock', () => {
  it('renders sandboxed iframe with correct properties', () => {
    render(<MermaidBlock code="graph TD; A-->B" />);
    const iframe = screen.getByTitle('Sandboxed Mermaid Diagram');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', '/vendor/mermaid/index.html');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
  });

  it('handles postMessage communication flow for resize and error', () => {
    let capturedId: string | null = null;
    const postMessageSpy = vi.fn((message) => {
      if (message && message.type === 'render') {
        capturedId = message.id;
      }
    });

    const contentWindowMock = {
      postMessage: postMessageSpy,
    };

    // Mock contentWindow on the iframe prototype using a stable cached object reference
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get() {
        return contentWindowMock;
      },
      configurable: true,
    });

    render(<MermaidBlock code="graph TD; A-->B" />);
    const iframe = screen.getByTitle('Sandboxed Mermaid Diagram') as HTMLIFrameElement;

    // 1. Simulate the ready event from iframe
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ready' },
          source: iframe.contentWindow,
        })
      );
    });

    // Verify postMessage was called with render request containing the instance ID
    expect(postMessageSpy).toHaveBeenCalled();
    expect(capturedId).not.toBeNull();

    // 2. Simulate resize message from iframe using capturedId
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'resize',
            height: 350,
            id: capturedId,
          },
        })
      );
    });

    // Check if iframe height gets updated
    expect(iframe).toHaveStyle({ height: '350px' });

    // 3. Simulate error message from iframe using capturedId
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'error',
            error: 'Syntax error near line 2',
            id: capturedId,
          },
        })
      );
    });

    // Verify error box renders
    expect(screen.getByText(/Mermaid Syntax Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Syntax error near line 2/i)).toBeInTheDocument();
  });
});
