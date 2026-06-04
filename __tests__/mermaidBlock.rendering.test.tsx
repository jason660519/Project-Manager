import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MermaidBlock from '../components/MermaidBlock';

function installIframeContentWindow(contentWindowMock: Window) {
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get() {
      return contentWindowMock;
    },
    configurable: true,
  });
}

describe('MermaidBlock', () => {
  it('renders sandboxed iframe with correct properties', () => {
    render(<MermaidBlock code="graph TD; A-->B" />);
    const iframe = screen.getByTitle('Sandboxed Mermaid Diagram');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', '/vendor/mermaid/index.html');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
  });

  it('handles postMessage communication flow for resize and error', async () => {
    let capturedId: string | null = null;
    let capturedRequestId: string | null = null;
    const postMessageSpy = vi.fn((message) => {
      if (message && message.type === 'render') {
        capturedId = message.id;
        capturedRequestId = message.requestId;
      }
    });

    const contentWindowMock = {
      postMessage: postMessageSpy,
    } as unknown as Window;

    // Mock contentWindow on the iframe prototype using a stable cached object reference
    installIframeContentWindow(contentWindowMock);

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
    await waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    expect(capturedId).not.toBeNull();
    expect(capturedRequestId).not.toBeNull();

    // 2. Simulate resize message from iframe using capturedId
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'resize',
            height: 350,
            id: capturedId,
            requestId: capturedRequestId,
          },
          source: iframe.contentWindow,
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
            requestId: capturedRequestId,
          },
          source: iframe.contentWindow,
        })
      );
    });

    // Verify error box renders
    expect(screen.getByText(/Mermaid Syntax Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Syntax error near line 2/i)).toBeInTheDocument();
  });

  it('ignores stale render messages and messages from unrelated windows', async () => {
    let capturedId: string | null = null;
    let capturedRequestId: string | null = null;
    const postMessageSpy = vi.fn((message) => {
      if (message && message.type === 'render') {
        capturedId = message.id;
        capturedRequestId = message.requestId;
      }
    });

    const contentWindowMock = {
      postMessage: postMessageSpy,
    } as unknown as Window;
    const unrelatedWindowMock = {
      postMessage: vi.fn(),
    } as unknown as Window;

    installIframeContentWindow(contentWindowMock);

    render(<MermaidBlock code="graph TD; A-->B" />);
    const iframe = screen.getByTitle('Sandboxed Mermaid Diagram') as HTMLIFrameElement;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ready' },
          source: iframe.contentWindow,
        })
      );
    });
    await waitFor(() => expect(postMessageSpy).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'resize',
            height: 350,
            id: capturedId,
            requestId: capturedRequestId,
          },
          source: iframe.contentWindow,
        })
      );
    });
    expect(iframe).toHaveStyle({ height: '350px' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'resize',
            height: 999,
            id: capturedId,
            requestId: 'old-request',
          },
          source: iframe.contentWindow,
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'resize',
            height: 111,
            id: capturedId,
            requestId: capturedRequestId,
          },
          source: unrelatedWindowMock,
        })
      );
    });

    expect(iframe).toHaveStyle({ height: '350px' });
  });

  it('keeps the iframe mounted after syntax errors and rerenders when code changes', async () => {
    let capturedId: string | null = null;
    let capturedRequestId: string | null = null;
    const postMessageSpy = vi.fn((message) => {
      if (message && message.type === 'render') {
        capturedId = message.id;
        capturedRequestId = message.requestId;
      }
    });

    const contentWindowMock = {
      postMessage: postMessageSpy,
    } as unknown as Window;

    installIframeContentWindow(contentWindowMock);

    const { rerender } = render(<MermaidBlock code="graph TD; A-->" />);
    const iframe = screen.getByTitle('Sandboxed Mermaid Diagram') as HTMLIFrameElement;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ready' },
          source: iframe.contentWindow,
        })
      );
    });
    await waitFor(() => expect(postMessageSpy).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'error',
            error: 'Syntax error near line 1',
            id: capturedId,
            requestId: capturedRequestId,
          },
          source: iframe.contentWindow,
        })
      );
    });

    expect(await screen.findByText(/Syntax error near line 1/i)).toBeInTheDocument();
    expect(screen.getByTitle('Sandboxed Mermaid Diagram')).toBeInTheDocument();

    rerender(<MermaidBlock code="graph TD; A-->B" />);

    await waitFor(() => expect(postMessageSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/Syntax error near line 1/i)).not.toBeInTheDocument());
  });
});
