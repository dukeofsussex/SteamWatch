import { TemplateTag, replaceResultTransformer } from 'common-tags';
import { EMOJIS } from './constants';

const capitalize = new TemplateTag({
  onSubstitution(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  onEndResult(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
});

const insertEmoji = new TemplateTag(
  replaceResultTransformer(
    /:[A-Z_]*:/g,
    (match) => EMOJIS[match.slice(1, match.length - 1)] || 'Unknown emoji',
  ),
);

export {
  capitalize,
  insertEmoji,
};
