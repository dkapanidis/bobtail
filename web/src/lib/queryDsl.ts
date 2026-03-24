/**
 * Query DSL parser/serializer.
 *
 * Syntax:
 *   <kind> | group by <key> [| <filterKey> <op> <filterValue>]
 *
 * Examples:
 *   PostgresCluster | group by spec.postgresVersion
 *   PostgresCluster | group by spec.postgresVersion | spec.instances[0].replicas > 2
 *   PostgresCluster | group by metadata.name | metadata.name ~ orders
 *
 * Operators: =  !=  >  >=  <  <=  ~ (LIKE)
 */

export interface ParsedQuery {
  kind: string;
  groupBy: string;
  filterKey: string;
  filterOp: string; // API op: eq, neq, gt, gte, lt, lte, like
  filterValue: string;
}

const OP_SYMBOLS: Record<string, string> = {
  "!=": "neq",
  ">=": "gte",
  "<=": "lte",
  "=": "eq",
  ">": "gt",
  "<": "lt",
  "~": "like",
};

const OP_TO_SYMBOL: Record<string, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "~",
};

// Ordered longest-first so >= is matched before >
const OP_PATTERN = /^(!=|>=|<=|=|>|<|~)$/;
const OP_TOKENS = ["!=", ">=", "<=", "=", ">", "<", "~"];

export function parseQuery(input: string): ParsedQuery {
  const result: ParsedQuery = {
    kind: "",
    groupBy: "",
    filterKey: "",
    filterOp: "eq",
    filterValue: "",
  };

  const segments = input.split("|").map((s) => s.trim());
  if (segments.length === 0) return result;

  // First segment: kind
  result.kind = segments[0];

  // Second segment: group by <key>
  if (segments.length >= 2) {
    const groupSeg = segments[1];
    const match = groupSeg.match(/^group\s+by\s+(.+)$/i);
    if (match) {
      result.groupBy = match[1].trim();
    }
  }

  // Third segment: <filterKey> <op> <filterValue>
  if (segments.length >= 3) {
    const filterSeg = segments[2].trim();
    parseFilterExpression(filterSeg, result);
  }

  return result;
}

function parseFilterExpression(expr: string, result: ParsedQuery) {
  // Find the operator in the expression
  for (const op of OP_TOKENS) {
    const idx = expr.indexOf(op);
    if (idx > 0) {
      // Make sure it's not part of a longer operator (e.g., don't match ">" inside ">=")
      const before = expr.slice(0, idx).trim();
      const after = expr.slice(idx + op.length).trim();
      if (before && after !== undefined) {
        // Verify this is actually the operator and not part of the key name
        const potentialLonger = expr.slice(idx, idx + 2);
        if (op.length === 1 && OP_PATTERN.test(potentialLonger)) {
          continue; // Skip, there's a longer match
        }
        result.filterKey = before;
        result.filterOp = OP_SYMBOLS[op] || "eq";
        result.filterValue = after;
        return;
      }
    }
  }
}

export function serializeQuery(q: ParsedQuery): string {
  let result = q.kind || "";
  if (q.groupBy) {
    result += " | group by " + q.groupBy;
  }
  if (q.filterKey && q.filterValue) {
    const opSym = OP_TO_SYMBOL[q.filterOp] || "=";
    result += " | " + q.filterKey + " " + opSym + " " + q.filterValue;
  }
  return result;
}

/**
 * Returns autocomplete suggestions based on cursor position in the query.
 */
export function getSuggestions(
  input: string,
  cursorPos: number,
  kinds: string[],
  keys: string[],
): string[] {
  const beforeCursor = input.slice(0, cursorPos);
  const segments = beforeCursor.split("|");
  const currentSegIndex = segments.length - 1;
  const currentSeg = segments[currentSegIndex].trim();

  if (currentSegIndex === 0) {
    // Typing kind — include "*" for all resources
    const allKinds = ["*", ...kinds];
    if (!currentSeg) return allKinds;
    return allKinds.filter((k) =>
      k.toLowerCase().includes(currentSeg.toLowerCase()),
    );
  }

  if (currentSegIndex === 1) {
    // Typing "group by <key>"
    const resourceFields = ["kind", "cluster", "namespace", "name"];
    const allKeys = [...resourceFields, ...keys.filter((k) => !resourceFields.includes(k))];
    const match = currentSeg.match(/^group\s+by\s+(.*)$/i);
    if (match) {
      const partial = match[1].trim();
      if (!partial) return allKeys;
      return allKeys.filter((k) =>
        k.toLowerCase().includes(partial.toLowerCase()),
      );
    }
    if (!currentSeg || "group by".startsWith(currentSeg.toLowerCase())) {
      return ["group by "];
    }
    return [];
  }

  if (currentSegIndex === 2) {
    // Typing filter: could be key, or key+op+value
    // Check if there's an operator already
    for (const op of OP_TOKENS) {
      if (currentSeg.includes(op)) {
        return []; // Already past the key, no suggestions for values
      }
    }
    // Suggesting filter keys
    if (!currentSeg) return keys;
    return keys.filter((k) =>
      k.toLowerCase().includes(currentSeg.toLowerCase()),
    );
  }

  return [];
}
