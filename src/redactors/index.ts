import type { Redactor, RedactableFormat } from "../types.ts";
import { redactEnv } from "./env.ts";
import { redactJson } from "./json.ts";
import { redactYaml } from "./yaml.ts";
import { redactToml } from "./toml.ts";

export const redactors: Record<RedactableFormat, Redactor> = {
  env: redactEnv,
  json: redactJson,
  yaml: redactYaml,
  toml: redactToml,
};
