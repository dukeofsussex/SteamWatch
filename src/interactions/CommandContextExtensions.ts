import { Context, Message, MessageEmbedOptions } from 'slash-create';
import { EMBED_COLOURS, EMOJIS } from '../utils/constants';

type EmbedOptions = Omit<MessageEmbedOptions, 'color' | 'description'>;

declare module 'slash-create' {
  interface CommandContext {
    embed(embed: MessageEmbedOptions): Promise<boolean | Message>;
    success(message: string, embedOptions?: EmbedOptions): Promise<boolean | Message>;
    error(message: string, embedOptions?: EmbedOptions): Promise<boolean | Message>;
  }
}

Context.prototype.embed = function sendEmbed(embed: MessageEmbedOptions) {
  return this.editOriginal({
    embeds: [embed],
    components: [],
  });
};

Context.prototype.success = function sendSuccessEmbed(
  message: string,
  embedOptions: EmbedOptions = {},
) {
  return this.embed({
    color: EMBED_COLOURS.SUCCESS,
    description: `${EMOJIS.SUCCESS} ${message}`,
    ...embedOptions,
  });
};

Context.prototype.error = function sendErrorEmbed(
  message: string,
  embedOptions: EmbedOptions = {},
) {
  return this.embed({
    color: EMBED_COLOURS.ERROR,
    description: `${EMOJIS.ERROR} ${message}`,
    ...embedOptions,
  });
};
