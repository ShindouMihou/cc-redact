export type RedactableFormat = "env" | "json" | "yaml" | "toml";

export type Redactor = (content: string) => string;

export type FormatDetection =
  | { kind: "redactable"; format: RedactableFormat }
  | { kind: "opaque" };

export interface HookInput {
  cwd?: string;
  tool_input: {
    file_path: string;
    limit?: number;
    offset?: number;
    pages?: string;
  };
}
