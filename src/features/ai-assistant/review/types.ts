import type { JSONContent } from "@tiptap/core";
import type { Fragment, Node } from "@tiptap/pm/model";

/** Document adapter for previewing a demo or a server-backed proposal. */
export interface LocalReviewProposal {
  id: string;
  baseDocument: JSONContent;
  groups: Array<{
    id: string;
    explanation: string;
    operations: Array<{
      startIndex: number;
      deleteCount: number;
      newBlocks: JSONContent[];
    }>;
  }>;
}

export interface ReviewOperation {
  from: number;
  to: number;
  original: Fragment;
  replacement: Fragment;
}

export interface ReviewGroup {
  id: string;
  explanation: string;
  status: "pending" | "applied" | "rejected";
  operations: ReviewOperation[];
}

export interface ReviewSession {
  proposalId: string;
  expectedDocument: Node;
  groups: ReviewGroup[];
  activeGroupId: string | null;
  visible: boolean;
  stale: boolean;
  locked?: boolean;
}
