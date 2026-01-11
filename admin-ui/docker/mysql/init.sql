-- SqlDB Initialization Script
-- This script sets up the required tables for SqlDB features

-- Query Statistics Table (for performance monitoring)
CREATE TABLE IF NOT EXISTS __sqldb_query_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  query_type VARCHAR(50) NOT NULL,
  filters TEXT,
  execution_time_ms DECIMAL(10, 2) NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_name (table_name),
  INDEX idx_query_type (query_type),
  INDEX idx_execution_time (execution_time_ms),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example Services Table (for demo/testing)
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_is_active (is_active),
  FULLTEXT INDEX idx_fulltext (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data
INSERT INTO services (title, description, category, price) VALUES
  ('Web Development', 'Custom website design and development using modern frameworks', 'Development', 5000.00),
  ('Mobile App Development', 'Native and cross-platform mobile application development', 'Development', 8000.00),
  ('Database Optimization', 'Query performance tuning and database indexing', 'Database', 2500.00),
  ('Cloud Migration', 'Seamless migration to AWS, Azure, or Google Cloud', 'Infrastructure', 15000.00),
  ('API Development', 'RESTful and GraphQL API design and implementation', 'Development', 3500.00),
  ('DevOps Consulting', 'CI/CD pipeline setup and infrastructure automation', 'Infrastructure', 4000.00),
  ('Security Audit', 'Comprehensive security assessment and penetration testing', 'Security', 6000.00),
  ('Performance Testing', 'Load testing and performance optimization services', 'Testing', 3000.00),
  ('UI/UX Design', 'User interface and experience design for web and mobile', 'Design', 4500.00),
  ('Data Analytics', 'Business intelligence and data visualization solutions', 'Analytics', 7000.00);

-- Users table for CRUD demo
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample users
INSERT INTO users (username, email, full_name, role) VALUES
  ('admin', 'admin@example.com', 'Admin User', 'admin'),
  ('john_doe', 'john@example.com', 'John Doe', 'user'),
  ('jane_smith', 'jane@example.com', 'Jane Smith', 'user'),
  ('bob_wilson', 'bob@example.com', 'Bob Wilson', 'moderator');

-- Products table for relationship demo
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INT DEFAULT 0,
  category_id INT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sku (sku),
  INDEX idx_category_id (category_id),
  FULLTEXT INDEX idx_product_search (name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample products
INSERT INTO products (name, sku, description, price, stock_quantity, category_id) VALUES
  ('Laptop Pro', 'LAP-001', 'High-performance laptop for professionals', 1299.99, 50, 1),
  ('Wireless Mouse', 'MOU-001', 'Ergonomic wireless mouse with precision tracking', 29.99, 200, 2),
  ('USB-C Hub', 'HUB-001', 'Multi-port USB-C hub with HDMI and Ethernet', 49.99, 150, 2),
  ('Monitor 27"', 'MON-001', '27-inch 4K UHD monitor with HDR support', 399.99, 75, 1),
  ('Mechanical Keyboard', 'KEY-001', 'RGB mechanical keyboard with cherry MX switches', 129.99, 100, 2);

COMMIT;
