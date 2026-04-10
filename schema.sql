CREATE TABLE styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_number TEXT NOT NULL UNIQUE,
    buyer_name TEXT,
    style_name TEXT,
    color TEXT,
    image_path TEXT,
    cmt_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE style_operation_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_id INTEGER NOT NULL,
    operation_id INTEGER NOT NULL,
    rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (style_id) REFERENCES styles(id),
    FOREIGN KEY (operation_id) REFERENCES operations(id),
    UNIQUE (style_id, operation_id)
);

CREATE TABLE sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cutting_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_id INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    remarks TEXT,
    FOREIGN KEY (style_id) REFERENCES styles(id)
);

CREATE TABLE cutting_entry_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cutting_entry_id INTEGER NOT NULL,
    size_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (cutting_entry_id) REFERENCES cutting_entries(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id),
    UNIQUE (cutting_entry_id, size_id)
);

CREATE TABLE workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_code TEXT NOT NULL UNIQUE,
    worker_name TEXT NOT NULL,
    worker_type TEXT NOT NULL DEFAULT 'piece_rate'
);

CREATE TABLE production_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_id INTEGER NOT NULL,
    operation_id INTEGER NOT NULL,
    worker_id INTEGER,
    entry_date DATE NOT NULL,
    size_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 0,
    remarks TEXT,
    FOREIGN KEY (style_id) REFERENCES styles(id),
    FOREIGN KEY (operation_id) REFERENCES operations(id),
    FOREIGN KEY (worker_id) REFERENCES workers(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id)
);

CREATE TABLE acceptance_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_id INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    remarks TEXT,
    FOREIGN KEY (style_id) REFERENCES styles(id)
);

CREATE TABLE acceptance_entry_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acceptance_entry_id INTEGER NOT NULL,
    size_id INTEGER NOT NULL,
    accepted_quantity INTEGER NOT NULL DEFAULT 0,
    rejected_quantity INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (acceptance_entry_id) REFERENCES acceptance_entries(id),
    FOREIGN KEY (size_id) REFERENCES sizes(id),
    UNIQUE (acceptance_entry_id, size_id)
);

CREATE VIEW style_cutting_summary AS
SELECT
    ce.style_id,
    cei.size_id,
    SUM(cei.quantity) AS total_cut_qty
FROM cutting_entry_items cei
JOIN cutting_entries ce ON ce.id = cei.cutting_entry_id
GROUP BY ce.style_id, cei.size_id;

CREATE VIEW style_acceptance_summary AS
SELECT
    ae.style_id,
    aei.size_id,
    SUM(aei.accepted_quantity) AS total_accepted_qty,
    SUM(aei.rejected_quantity) AS total_rejected_qty
FROM acceptance_entry_items aei
JOIN acceptance_entries ae ON ae.id = aei.acceptance_entry_id
GROUP BY ae.style_id, aei.size_id;

CREATE VIEW worker_billing_summary AS
SELECT
    pe.worker_id,
    pe.style_id,
    pe.operation_id,
    SUM(pe.quantity) AS total_qty,
    sor.rate AS rate,
    SUM(pe.quantity) * sor.rate AS total_amount
FROM production_entries pe
JOIN style_operation_rates sor
    ON sor.style_id = pe.style_id
   AND sor.operation_id = pe.operation_id
GROUP BY pe.worker_id, pe.style_id, pe.operation_id, sor.rate;
