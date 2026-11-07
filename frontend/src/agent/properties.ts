// The data an edge collects is a JSON-schema object (`properties` + `required`).
// The editor shows it as a list of rows, which is easier to edit field by field.

import type { AgentEdge, PropertySchema } from "../types";

export type PropertyRow = {
  name: string;
  type: string;
  description: string;
  required: boolean;
  /** Allowed values, comma-separated. Empty means any value. */
  options: string;
};

export const PROPERTY_TYPES = ["string", "number", "integer", "boolean"];

export function rowsFromEdge(edge: AgentEdge): PropertyRow[] {
  const required = edge.required ?? [];
  return Object.entries(edge.properties ?? {}).map(([name, schema]) => ({
    name,
    type: schema.type,
    description: schema.description ?? "",
    required: required.includes(name),
    options: (schema.enum ?? []).join(", "),
  }));
}

export function edgeFieldsFromRows(rows: PropertyRow[]): Pick<AgentEdge, "properties" | "required"> {
  const properties: Record<string, PropertySchema> = {};
  for (const row of rows) {
    properties[row.name] = schemaFromRow(row);
  }
  const required = rows.filter((row) => row.required).map((row) => row.name);
  return { properties, required };
}

function schemaFromRow(row: PropertyRow): PropertySchema {
  const schema: PropertySchema = { type: row.type };
  if (row.description) {
    schema.description = row.description;
  }
  const options = row.options
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
  if (options.length > 0) {
    schema.enum = options;
  }
  return schema;
}
