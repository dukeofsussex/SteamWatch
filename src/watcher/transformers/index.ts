// @ts-ignore Missing typings
import core from '@bbob/core';
import createPreset from './preset';
import createRender from './render';
import { TagNode } from './BBob';

const { AllHtmlEntities } = require('html-entities');

interface TransformedArticle {
  exceedsMaxlength: boolean;
  markdown: string;
  thumbnail: string;
}

export default function transformArticle(
  content: string,
  maxLength: number,
  maxNewlines: number,
): TransformedArticle {
  let decodedContent = content;
  let options: any = { render: createRender(maxLength, maxNewlines) };
  let thumbnail = '';

  if (/<\/?p>|<br\/?>/i.test(content)) {
    // Respect html tags.
    decodedContent = AllHtmlEntities.decode(decodedContent.replace(/\n/g, ''));
    options = {
      ...options,
      openTag: '<',
      closeTag: '>',
    };
  }

  const onImage = (tag: TagNode) => {
    if (thumbnail || typeof tag === 'string') {
      return;
    }

    thumbnail = tag.attrs.src || tag.content.filter((t): t is string => typeof t === 'string')[0];
  };

  const render = core(createPreset(onImage)())
    .process(decodedContent, options)
    .html;

  return { ...render, thumbnail };
}
