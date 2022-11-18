import type { TagNodeContent, TagNodeContentNode } from './BBob';

// Prevent long newline chains.
const MAX_NEWLINE_REPETITIONS = 2;

export default function createRender(maxLength: number, maxNewlines: number) {
  let currentLength = 0;
  let currentNewlines = 0;
  let currentNewlineRepetitions = 0;
  let exceeded = false;

  const renderNode = (node: TagNodeContentNode) => {
    let rendered = '';

    if (!node) {
      return rendered;
    }

    if (typeof node === 'string') {
      if (node === '\n') {
        currentNewlineRepetitions += 1;

        if (currentNewlineRepetitions > MAX_NEWLINE_REPETITIONS) {
          return rendered;
        }

        currentNewlines += 1;
      }

      const { length } = node;
      exceeded = (currentLength + length) >= maxLength || currentNewlines >= maxNewlines;

      rendered = exceeded
        ? node.substring(0, length - (maxLength - currentLength))
        : node;

      if (node !== '\n') {
        currentNewlineRepetitions = 0;
      }

      currentLength += rendered.length;
    } else if (typeof node === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const inner = renderNodes(node.content);

      if (inner) {
        const markdown = node.markdown || ['', ''];
        currentLength += markdown.reduce((acc, val) => acc + val.length, 0);
        rendered = `${markdown[0]}${inner}${markdown[1]}`;
      }
    } else if (Array.isArray(node)) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      rendered = renderNodes(node);
    }

    return rendered;
  };

  const renderNodes = (nodes: TagNodeContent) => {
    let rendered = '';

    for (let i = 0; i < nodes.length; i += 1) {
      if (exceeded) {
        break;
      }

      rendered += renderNode(nodes[i]!);
    }

    return rendered;
  };

  return (nodes: TagNodeContent) => ({
    markdown: `${renderNodes(nodes).trim()}${exceeded ? '...' : ''}`,
    exceedsMaxlength: exceeded,
  });
}
