import { TableRelationship } from '../types/schema';

export class DependencyGraph {
  // Adjacency list: table -> set of tables that depend on it (have FK to it)
  private dependents: Map<string, Set<string>> = new Map();

  // Adjacency list: table -> set of tables it depends on (has FK to)
  private dependencies: Map<string, Set<string>> = new Map();

  private maxDepth: number;

  constructor(maxDepth: number = 3) {
    this.maxDepth = maxDepth;
  }

  addRelationship(relationship: TableRelationship): void {
    const { fromTable, toTable } = relationship;

    // fromTable depends on toTable (fromTable has FK to toTable)
    if (!this.dependencies.has(fromTable)) {
      this.dependencies.set(fromTable, new Set());
    }
    this.dependencies.get(fromTable)!.add(toTable);

    // toTable has fromTable as dependent (fromTable references toTable)
    if (!this.dependents.has(toTable)) {
      this.dependents.set(toTable, new Set());
    }
    this.dependents.get(toTable)!.add(fromTable);
  }

  buildFromRelationships(relationships: TableRelationship[]): void {
    for (const rel of relationships) {
      this.addRelationship(rel);
    }
  }

  getDependents(table: string): string[] {
    return Array.from(this.dependents.get(table) || []);
  }

  getDependencies(table: string): string[] {
    return Array.from(this.dependencies.get(table) || []);
  }

  getInvalidationTargets(table: string): string[] {
    const visited = new Set<string>();
    const targets: string[] = [];

    this.bfsTraversal(table, visited, targets, 0);

    return targets;
  }

  private bfsTraversal(
    table: string,
    visited: Set<string>,
    targets: string[],
    depth: number
  ): void {
    if (visited.has(table) || depth > this.maxDepth) {
      return;
    }

    visited.add(table);
    targets.push(table);

    // Get all tables that depend on this table
    const dependents = this.getDependents(table);

    for (const dependent of dependents) {
      this.bfsTraversal(dependent, visited, targets, depth + 1);
    }

    // Optionally, also traverse dependencies (tables this table depends on)
    // This is useful for bidirectional invalidation
    const dependencies = this.getDependencies(table);

    for (const dependency of dependencies) {
      if (!visited.has(dependency) && depth < this.maxDepth) {
        this.bfsTraversal(dependency, visited, targets, depth + 1);
      }
    }
  }

  getAllTables(): string[] {
    const tables = new Set<string>();

    for (const table of this.dependents.keys()) {
      tables.add(table);
    }

    for (const table of this.dependencies.keys()) {
      tables.add(table);
    }

    return Array.from(tables);
  }

  clear(): void {
    this.dependents.clear();
    this.dependencies.clear();
  }

  getGraphInfo(): { tables: number; relationships: number } {
    const allTables = this.getAllTables();
    let relationshipCount = 0;

    for (const deps of this.dependencies.values()) {
      relationshipCount += deps.size;
    }

    return {
      tables: allTables.length,
      relationships: relationshipCount,
    };
  }
}
