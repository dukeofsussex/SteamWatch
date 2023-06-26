import { Context, Message, MessageEmbedOptions } from 'slash-create';
import { EMBED_COLOURS, EMOJIS } from '@steamwatch/shared';

type EmbedOptions = Omit<MessageEmbedOptions, 'color' | 'description'>;

declare module 'slash-create' {
  interface CommandContext {
    embed(embed: MessageEmbedOptions): Promise<Message>;
    success(message: string, embedOptions?: EmbedOptions): Promise<Message>;
    error(message: string, embedOptions?: EmbedOptions): Promise<Message>;
    timeout(): Promise<void>;
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

Context.prototype.timeout = async function sendTimeoutEmbed() {
  try {
    await this.error('Interaction timed out! Please run the command again.');
  } catch {
    // Interaction may have already been deleted by the user
    // or expired before being able to send this message
  }
};
