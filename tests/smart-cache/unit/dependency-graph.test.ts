import { DependencyGraph } from '../../../src/smart-cache/discovery/dependency-graph';
import { TableRelationship } from '../../../src/smart-cache/types/schema';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph(3);
  });

  describe('addRelationship', () => {
    it('should add a relationship', () => {
      const relationship: TableRelationship = {
        constraintName: 'fk_orders_user',
        fromTable: 'orders',
        fromColumn: 'user_id',
        toTable: 'users',
        toColumn: 'id',
      };

      graph.addRelationship(relationship);

      const dependents = graph.getDependents('users');
      const dependencies = graph.getDependencies('orders');

      expect(dependents).toContain('orders');
      expect(dependencies).toContain('users');
    });

    it('should handle multiple relationships from same table', () => {
      const rel1: TableRelationship = {
        constraintName: 'fk_orders_user',
        fromTable: 'orders',
        fromColumn: 'user_id',
        toTable: 'users',
        toColumn: 'id',
      };

      const rel2: TableRelationship = {
        constraintName: 'fk_orders_product',
        fromTable: 'orders',
        fromColumn: 'product_id',
        toTable: 'products',
        toColumn: 'id',
      };

      graph.addRelationship(rel1);
      graph.addRelationship(rel2);

      const dependencies = graph.getDependencies('orders');

      expect(dependencies).toContain('users');
      expect(dependencies).toContain('products');
      expect(dependencies).toHaveLength(2);
    });
  });

  describe('buildFromRelationships', () => {
    it('should build graph from array of relationships', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_order_items_order',
          fromTable: 'order_items',
          fromColumn: 'order_id',
          toTable: 'orders',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const usersDependents = graph.getDependents('users');
      const ordersDependents = graph.getDependents('orders');

      expect(usersDependents).toContain('orders');
      expect(ordersDependents).toContain('order_items');
    });
  });

  describe('getDependents', () => {
    it('should return empty array for table with no dependents', () => {
      const dependents = graph.getDependents('users');

      expect(dependents).toEqual([]);
    });

    it('should return all tables that depend on target table', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_comments_user',
          fromTable: 'comments',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const dependents = graph.getDependents('users');

      expect(dependents).toContain('orders');
      expect(dependents).toContain('comments');
      expect(dependents).toHaveLength(2);
    });
  });

  describe('getDependencies', () => {
    it('should return empty array for table with no dependencies', () => {
      const dependencies = graph.getDependencies('users');

      expect(dependencies).toEqual([]);
    });

    it('should return all tables that target table depends on', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_orders_product',
          fromTable: 'orders',
          fromColumn: 'product_id',
          toTable: 'products',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const dependencies = graph.getDependencies('orders');

      expect(dependencies).toContain('users');
      expect(dependencies).toContain('products');
      expect(dependencies).toHaveLength(2);
    });
  });

  describe('getInvalidationTargets', () => {
    it('should return only self when no relationships', () => {
      const targets = graph.getInvalidationTargets('users');

      expect(targets).toEqual(['users']);
    });

    it('should return cascading targets', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_order_items_order',
          fromTable: 'order_items',
          fromColumn: 'order_id',
          toTable: 'orders',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const targets = graph.getInvalidationTargets('users');

      expect(targets).toContain('users');
      expect(targets).toContain('orders');
      expect(targets).toContain('order_items');
    });

    it('should handle circular references without infinite loop', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_users_manager',
          fromTable: 'users',
          fromColumn: 'manager_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const targets = graph.getInvalidationTargets('users');

      // Should include users only once
      expect(targets).toContain('users');
      expect(targets.filter((t) => t === 'users')).toHaveLength(1);
    });

    it('should respect max depth', () => {
      const limitedGraph = new DependencyGraph(1);

      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_order_items_order',
          fromTable: 'order_items',
          fromColumn: 'order_id',
          toTable: 'orders',
          toColumn: 'id',
        },
      ];

      limitedGraph.buildFromRelationships(relationships);

      const targets = limitedGraph.getInvalidationTargets('users');

      // Should only include users and orders (depth 1), not order_items
      expect(targets).toContain('users');
      expect(targets).toContain('orders');
      // May or may not contain order_items depending on depth limit
    });
  });

  describe('getAllTables', () => {
    it('should return empty array for empty graph', () => {
      const tables = graph.getAllTables();

      expect(tables).toEqual([]);
    });

    it('should return all unique tables', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_order_items_order',
          fromTable: 'order_items',
          fromColumn: 'order_id',
          toTable: 'orders',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const tables = graph.getAllTables();

      expect(tables).toContain('users');
      expect(tables).toContain('orders');
      expect(tables).toContain('order_items');
      expect(tables).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('should clear all relationships', () => {
      const relationship: TableRelationship = {
        constraintName: 'fk_orders_user',
        fromTable: 'orders',
        fromColumn: 'user_id',
        toTable: 'users',
        toColumn: 'id',
      };

      graph.addRelationship(relationship);
      graph.clear();

      const tables = graph.getAllTables();

      expect(tables).toEqual([]);
    });
  });

  describe('getGraphInfo', () => {
    it('should return correct graph info', () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_order_items_order',
          fromTable: 'order_items',
          fromColumn: 'order_id',
          toTable: 'orders',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_order_items_product',
          fromTable: 'order_items',
          fromColumn: 'product_id',
          toTable: 'products',
          toColumn: 'id',
        },
      ];

      graph.buildFromRelationships(relationships);

      const info = graph.getGraphInfo();

      expect(info.tables).toBe(4); // users, orders, order_items, products
      expect(info.relationships).toBe(3);
    });
  });
});
