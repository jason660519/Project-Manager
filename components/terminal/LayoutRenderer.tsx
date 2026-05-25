'use client';

import {
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Block } from './Block';
import type {
  Block as BlockModel,
  LayoutNode,
  SplitDirection,
  SplitNode,
} from './blockLayout';

interface RendererProps {
  node: LayoutNode;
  workspaceId: string;
  cwd: string;
  cwdIssue?: string;
  homepageUrl: string;
  onUpdateBlock: (
    blockId: string,
    updater: (block: BlockModel) => BlockModel,
  ) => void;
  onCloseBlock: (blockId: string) => void;
  onSplit: (blockId: string, direction: SplitDirection) => void;
  onUpdateRatio: (splitId: string, ratio: number) => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function beginDrag(
  onMove: (event: MouseEvent) => void,
  cursor: 'col-resize' | 'row-resize',
  onEnd: () => void,
) {
  let frameId: number | null = null;
  let latest: MouseEvent | null = null;
  const flush = () => {
    frameId = null;
    if (latest) onMove(latest);
  };
  const handleMove = (event: MouseEvent) => {
    latest = event;
    if (frameId === null) frameId = requestAnimationFrame(flush);
  };
  const handleUp = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (latest) onMove(latest);
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', handleUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    onEnd();
  };
  document.body.style.userSelect = 'none';
  document.body.style.cursor = cursor;
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleUp);
}

export function LayoutRenderer(props: RendererProps) {
  const { node } = props;
  if (node.type === 'leaf') {
    return (
      <Block
        block={node.block}
        workspaceId={props.workspaceId}
        cwd={props.cwd}
        cwdIssue={props.cwdIssue}
        homepageUrl={props.homepageUrl}
        onUpdate={(updater) => props.onUpdateBlock(node.block.id, updater)}
        onClose={() => props.onCloseBlock(node.block.id)}
        onSplitRight={() => props.onSplit(node.block.id, 'vertical')}
        onSplitDown={() => props.onSplit(node.block.id, 'horizontal')}
      />
    );
  }
  return <SplitView split={node} {...props} />;
}

function SplitView({
  split,
  ...rest
}: RendererProps & { split: SplitNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const isVertical = split.direction === 'vertical';

  const startResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cursor = isVertical ? 'col-resize' : 'row-resize';
      setDragging(true);
      beginDrag(
        (moveEvent) => {
          const ratio = isVertical
            ? (moveEvent.clientX - rect.left) / rect.width
            : (moveEvent.clientY - rect.top) / rect.height;
          rest.onUpdateRatio(split.id, clamp(ratio, 0.1, 0.9));
        },
        cursor,
        () => setDragging(false),
      );
    },
    [isVertical, rest, split.id],
  );

  const firstStyle = isVertical
    ? { width: `${split.ratio * 100}%`, minWidth: 0 }
    : { height: `${split.ratio * 100}%`, minHeight: 0 };

  return (
    <div
      ref={containerRef}
      className={
        isVertical
          ? 'flex h-full min-h-0 w-full min-w-0'
          : 'flex h-full min-h-0 w-full min-w-0 flex-col'
      }
    >
      <div className="min-h-0 min-w-0" style={firstStyle}>
        <LayoutRenderer {...rest} node={split.first} />
      </div>
      <div
        onMouseDown={startResize}
        role="separator"
        aria-orientation={isVertical ? 'vertical' : 'horizontal'}
        aria-label="Resize split"
        className={[
          'shrink-0 bg-stone-900 transition-colors hover:bg-sky-400/60',
          isVertical ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
          dragging ? 'bg-sky-400/80' : '',
        ].join(' ')}
      />
      <div className="min-h-0 min-w-0 flex-1">
        <LayoutRenderer {...rest} node={split.second} />
      </div>
    </div>
  );
}
