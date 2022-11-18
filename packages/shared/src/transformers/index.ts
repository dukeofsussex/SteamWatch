// @ts-ignore Missing typings
import bbob from '@bbob/core';
import { decode } from 'html-entities';
import type { TagNode } from './BBob';
import createPreset from './preset';
import createRender from './render';

interface TransformedArticle {
  exceedsMaxlength: boolean;
  markdown: string;
  thumbnail: string | null;
}

export default function transformArticle(
  content: string,
  maxLength: number,
  maxNewlines: number,
): TransformedArticle {
  let decodedContent = content;
  let options: any = { render: createRender(maxLength, maxNewlines) };
  let thumbnail: string | null = null;

  if (/<\/?p>|<br\/?>/i.test(content)) {
    // Respect html tags.
    decodedContent = decode(decodedContent.replace(/\n/g, ''));
    options = {
      ...options,
      openTag: '<',
      closeTag: '>',
    };
  } else {
    decodedContent = decodedContent.replace(/\[\/\*\]/g, '');
  }

  const onImage = (tag: TagNode) => {
    if (thumbnail || typeof tag === 'string') {
      return;
    }

    thumbnail = tag.attrs['src'] || tag.content.filter((t): t is string => typeof t === 'string')[0] || null;

    // Certain publishers don't use a protocol
    thumbnail = thumbnail?.startsWith('//') ? `https:${thumbnail}` : thumbnail;

    // Strip query params
    [thumbnail] = thumbnail?.split('?') ?? [null];
  };

  const render = bbob(createPreset(onImage)())
    .process(decodedContent, options)
    .html;

  return { ...render, thumbnail };
}
