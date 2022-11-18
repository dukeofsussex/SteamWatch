// @ts-ignore Missing typings
import { isStringNode, isTagNode } from '@bbob/plugin-helper';
// @ts-ignore Missing typings
import { createPreset } from '@bbob/preset';
import type {
  ListTagNode,
  TagNode,
  TagNodeContentNode,
  TagNodeContent,
} from './BBob';

const SPECIAL_SPACE = '\u00A0';

const isListTagNode = (node: ListTagNode) => node.tag
  && (node.tag === 'list'
    || node.tag === 'ol'
    || node.tag === 'ul');
const isNewlineNode = (node: TagNodeContentNode) => ((typeof node === 'string' && node === '\n')
  || (typeof node === 'object' && (node.tag === 'br' || node.tag === 'br/')));
const needsTrimming = (node: TagNodeContentNode) => (typeof node === 'string' && node === ' ')
  || isNewlineNode(node);
const trimContent = (content: TagNodeContent): TagNodeContent => {
  if (needsTrimming(content[0]!)) {
    return trimContent(content.slice(1));
  }

  if (needsTrimming(content[content.length - 1]!)) {
    return trimContent(content.slice(0, -1));
  }

  return content;
};

// Modified version of @bbob/preset-html5.
const listifyContent = (
  content: any[],
  { type, depth }: { type: string, depth: number },
) => {
  let listIdx = 0;
  const listItems: any = [];
  const ordered = type === 'ol';

  const addItem = (val: TagNodeContentNode) => {
    if (listItems[listIdx] && listItems[listIdx].content) {
      listItems[listIdx].content = listItems[listIdx].content.concat(val);
    } else {
      listItems[listIdx] = listItems[listIdx].concat(val);
    }
  };
  const getListItemMarkdown = () => [
    `${''.padEnd(depth * 2, SPECIAL_SPACE)}${(ordered ? `${listIdx + 1}. ` : '- ')}`,
    '',
  ];
  const createListItemNode = () => ({
    tag: 'li',
    markdown: getListItemMarkdown(),
    attrs: {},
    content: [],
  });
  const ensureListItem = (val: TagNodeContentNode) => {
    listItems[listIdx] = listItems[listIdx] || val;
  };
  const closeListItem = () => {
    if (!listItems[listIdx]) {
      return;
    }

    const lastNode = listItems[listIdx].content
      ? listItems[listIdx].content[listItems[listIdx].content.length - 1]
      : listItems[listIdx];

    // Don't add newlines after nested lists.
    if (!isListTagNode(lastNode)) {
      listItems.push('\n');
      listIdx += 1;
    }

    listIdx += 1;
  };

  for (let i = 0; i < content.length; i += 1) {
    const node = content[i];

    // Due to typical Steam inconsistencies, remove all newlines.
    // Required/desired newlines will be added back later on.
    if (isNewlineNode(node)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (isStringNode(node) && node.startsWith('*')) {
      closeListItem();
      ensureListItem(createListItemNode());
      addItem(node.substr(1));
    } else if (isTagNode(node) && node.tag === '*') {
      closeListItem();
      ensureListItem(createListItemNode());
    } else if (isTagNode(node) && node.tag === 'li') {
      closeListItem();
      node.markdown = getListItemMarkdown();
      ensureListItem(node);

    // Nested lists.
    } else if (isTagNode(node) && isListTagNode(node)) {
      if (listItems[listIdx] && listItems[listIdx].tag === 'li') {
        const emptyList = !listItems[listIdx].content[0];

        // Remove list markdown from empty lists.
        listItems[listIdx].markdown = [emptyList ? '' : listItems[listIdx].markdown[0], ''];

        if (!emptyList) {
          listItems[listIdx].content.push('\n');
        }
      }

      node.depth = depth + 1;
      addItem(node);
    } else if (!isTagNode(listItems[listIdx])) {
      closeListItem();
      ensureListItem(node);
    } else if (listItems[listIdx]) {
      addItem(node);
    } else {
      ensureListItem(node);
    }
  }

  closeListItem();

  return listItems;
};

const getUniqAttr = (attrs: { [key: string]: any }): string | null => Object
  .keys(attrs)
  .reduce((_, key) => (attrs[key] === key ? attrs[key] : null), null);

export default function create(onImage: (tag: TagNode) => void) {
  return createPreset({
    a: (node: TagNode) => ({
      ...node,
      markdown: ['[', `](${node.attrs['href']})`],
      content: trimContent(node.content),
    }),
    b: (node: TagNode) => ({
      ...node,
      markdown: ['**', '**'],
      content: trimContent(node.content),
    }),
    br: () => '\n',
    'br/': () => '\n',
    code: (node: TagNode) => ({
      ...node,
      markdown: ['```\n', '\n```'],
      content: trimContent(node.content),
    }),
    em: (node: TagNode) => ({
      ...node,
      markdown: ['*', '*'],
      content: trimContent(node.content),
    }),
    h1: (node: TagNode) => ({
      ...node,
      markdown: ['__**', '**__'],
      content: trimContent(node.content),
    }),
    i: (node: TagNode) => ({
      ...node,
      markdown: ['*', '*'],
      content: trimContent(node.content),
    }),
    img: (node: TagNode) => {
      onImage(node);
      return '';
    },
    list: (node: ListTagNode) => {
      const type = getUniqAttr(node.attrs) ? 'ol' : 'ul';

      return {
        tag: type,
        attrs: {},
        content: listifyContent(node.content, { type, depth: node.depth || 0 }),
      };
    },
    noparse: () => '',
    quote: (node: TagNode) => ({
      ...node,
      markdown: ['>>> ', ''],
    }),
    ol: (node: ListTagNode) => ({
      tag: 'ol',
      attrs: {},
      content: listifyContent(
        node.content,
        { type: node.tag, depth: node.depth || 0 },
      ),
    }),
    p: (node: TagNode) => ({
      ...node,
      content: node.content.concat(['\n']),
    }),
    previewyoutube: (node: TagNode) => {
      const id = getUniqAttr(node.attrs);
      return !id ? '' : {
        ...node,
        markdown: ['[', `](https://www.youtube.com/watch?v=${id})`],
        content: node.content.length > 0 ? trimContent(node.content) : ['YouTube Video'],
      };
    },
    spoiler: (node: TagNode) => ({
      ...node,
      markdown: ['||', '||'],
      content: trimContent(node.content),
    }),
    strike: (node: TagNode) => ({
      ...node,
      markdown: ['~~', '~~'],
      content: trimContent(node.content),
    }),
    strong: (node: TagNode) => ({
      ...node,
      markdown: ['**', '**'],
      content: trimContent(node.content),
    }),
    table: () => '',
    u: (node: TagNode) => ({
      ...node,
      markdown: ['__', '__'],
      content: trimContent(node.content),
    }),
    ul: (node: ListTagNode) => ({
      tag: 'ul',
      attrs: {},
      content: listifyContent(
        node.content,
        { type: node.tag, depth: node.depth || 0 },
      ),
    }),
    url: (node: TagNode) => ({
      ...node,
      markdown: ['[', `](${getUniqAttr(node.attrs) ? getUniqAttr(node.attrs) : node.content})`],
    }),
  });
}
