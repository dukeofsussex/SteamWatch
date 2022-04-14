export interface TagNode {
  tag: string;
  attrs: { [key: string]: string };
  content: TagNodeContent;
  markdown?: string[];
}

export interface ListTagNode extends TagNode {
  depth?: number;
}

export type TagNodeContentNode = string | ListTagNode | TagNode;

export type TagNodeContent = TagNodeContentNode[];
