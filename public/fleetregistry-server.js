const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json({ limit: '10mb' }));

const dbConfig = {
    host: 'localhost',
    user: 'YOUR_HOSTINGER_DB_USER',
    password: 'YOUR_HOSTINGER_DB_PASSWORD',
    database: 'YOUR_HOSTINGER_DB_NAME'
};

let pool;

async function initializeDatabase() {
    try {
        const tempPool = mysql.createPool({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
        await tempPool.end();

        pool = mysql.createPool(dbConfig);

        // Create vessels table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vessels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                designation VARCHAR(100) NOT NULL UNIQUE,
                ship_class VARCHAR(100) NOT NULL,
                builder VARCHAR(150),
                registry_number VARCHAR(50) UNIQUE,
                status ENUM('Active', 'Reserve', 'Decommissioned') DEFAULT 'Active',
                fleet VARCHAR(100),
                hull_length DECIMAL(6,2),
                hull_width DECIMAL(6,2),
                crew_complement VARCHAR(100),
                armor_type VARCHAR(150),
                max_warp_speed VARCHAR(50),
                max_sublight_speed VARCHAR(50),
                primary_armament TEXT,
                secondary_armament TEXT,
                defensive_systems TEXT,
                operational_notes TEXT,
                commission_date VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create service_histories table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS service_histories (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                vessel_ref VARCHAR(120) NOT NULL,
                event_date DATE NULL,
                event_type VARCHAR(80) NOT NULL DEFAULT 'service',
                title VARCHAR(255) NOT NULL,
                details TEXT NULL,
                location VARCHAR(255) NULL,
                source_reference VARCHAR(255) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY(id),
                KEY idx_service_vessel(vessel_ref)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Create armament_sheets table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS armament_sheets (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                vessel_ref VARCHAR(120) NOT NULL,
                title VARCHAR(255) NOT NULL,
                primary_armament TEXT NULL,
                secondary_armament TEXT NULL,
                defensive_systems TEXT NULL,
                ammunition_notes TEXT NULL,
                classification VARCHAR(80) NOT NULL DEFAULT 'standard',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY(id),
                UNIQUE KEY uq_armament_vessel_title(vessel_ref, title),
                KEY idx_armament_vessel(vessel_ref)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Create black_box_files table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS black_box_files (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                vessel_ref VARCHAR(120) NOT NULL,
                file_code VARCHAR(120) NOT NULL,
                title VARCHAR(255) NOT NULL,
                incident_date DATE NULL,
                classification VARCHAR(80) NOT NULL DEFAULT 'operator-only',
                summary TEXT NULL,
                payload MEDIUMTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY(id),
                UNIQUE KEY uq_black_box_vessel_code(vessel_ref, file_code),
                KEY idx_black_box_vessel(vessel_ref)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Seed vessels if empty
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM vessels');
        if (rows[0].count === 0) {
            await pool.query(`
                INSERT INTO vessels (
                    designation, ship_class, builder, registry_number, status, fleet,
                    hull_length, hull_width, crew_complement, armor_type, max_warp_speed,
                    max_sublight_speed, primary_armament, secondary_armament, defensive_systems,
                    operational_notes, commission_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'F5000 SAGITTARIUS',
                'Multi-Role Deep-Strike Starfighter',
                'Celestial Dynamics Shipworks, Platform Theta-7',
                'SF-5000-Alpha-7',
                'Active',
                'Star Force 7th Rapid Response Fleet',
                47.30, 9.10,
                '1 (Neural Interface Class IV)',
                'Chrome Darian Trinite — Class 7 Ablative',
                'Warp 7.2 sustained', '0.92c',
                '4× MK-9 Helical Plasma Repeaters — 1,200 RPM, 14.8 km effective range',
                '15× Antimatter Micro-Mines — AM-7 Cascade warhead',
                'Graviton Force-Field Class 6 Barrier — 8.4 sec recharge, full sphere 360° coverage',
                'Baseline production model. Neural Interface Class IV required.',
                'Stardate 2841.3'
            ]);
        }
        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Database error:', err.message);
    }
}

// ---- Vessels API ----

app.get('/api/vessels', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM vessels');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Archive APIs ----

app.get('/api/service-histories', async (req, res) => {
    try {
        const vesselRef = req.query.vessel_ref;
        let sql = 'SELECT * FROM service_histories';
        const params = [];
        if (vesselRef) {
            sql += ' WHERE vessel_ref = ?';
            params.push(vesselRef);
        }
        sql += ' ORDER BY event_date DESC, id DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/armament-sheets', async (req, res) => {
    try {
        const vesselRef = req.query.vessel_ref;
        let sql = 'SELECT * FROM armament_sheets';
        const params = [];
        if (vesselRef) {
            sql += ' WHERE vessel_ref = ?';
            params.push(vesselRef);
        }
        sql += ' ORDER BY id DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/black-box-files', async (req, res) => {
    try {
        const vesselRef = req.query.vessel_ref;
        let sql = 'SELECT * FROM black_box_files';
        const params = [];
        if (vesselRef) {
            sql += ' WHERE vessel_ref = ?';
            params.push(vesselRef);
        }
        sql += ' ORDER BY incident_date DESC, id DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- HTML ----

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><title>Star Force Vessel Registry</title>
    <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        :root { --bg-deep: #050a14; --panel-bg: #0a1628; --border-glow: rgba(0, 229, 255, 0.3); --accent-cyan: #00e5ff; --text-main: #c0d8ff; --text-dim: #5c7fa8; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: var(--bg-deep); color: var(--text-main); font-family: 'Share Tech Mono', monospace; min-height: 100vh; display: flex; flex-direction: column; }
        header { background: var(--panel-bg); border-bottom: 2px solid var(--accent-cyan); padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
        .header-title { font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 1.5rem; color: var(--accent-cyan); letter-spacing: 2px; }
        .main-container { display: grid; grid-template-columns: 350px 1fr; flex: 1; height: calc(100vh - 70px); }
        aside { background: rgba(10, 22, 40, 0.9); border-right: 1px solid var(--border-glow); padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .search-box { background: var(--bg-deep); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 10px; font-family: 'Share Tech Mono', monospace; width: 100%; outline: none; }
        .vessel-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
        .vessel-item { background: var(--panel-bg); border: 1px solid var(--border-glow); padding: 12px; cursor: pointer; }
        .vessel-item:hover, .vessel-item.active { border-color: var(--accent-cyan); background: rgba(0, 229, 255, 0.05); }
        .vessel-item h4 { font-family: 'Orbitron', sans-serif; font-size: 0.9rem; color: var(--accent-cyan); margin-bottom: 4px; }
        .vessel-item p { font-size: 0.8rem; color: var(--text-dim); }
        main { padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        .dossier-header { background: var(--panel-bg); border: 1px solid var(--border-glow); padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
        .dossier-title h1 { font-family: 'Orbitron', sans-serif; font-size: 2rem; color: var(--accent-cyan); margin-bottom: 5px; }
        .status-badge { background: rgba(0, 229, 255, 0.1); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 6px 14px; font-family: 'Orbitron', sans-serif; }
        .tabs { display: flex; gap: 10px; border-bottom: 1px solid var(--border-glow); padding-bottom: 10px; }
        .tab-btn { background: var(--panel-bg); border: 1px solid var(--border-glow); color: var(--text-dim); padding: 10px 20px; cursor: pointer; font-family: 'Share Tech Mono', monospace; }
        .tab-btn.active { background: rgba(0, 229, 255, 0.1); border-color: var(--accent-cyan); color: var(--accent-cyan); }
        .tab-content { display: none; background: var(--panel-bg); border: 1px solid var(--border-glow); padding: 25px; flex-direction: column; gap: 20px; }
        .tab-content.active { display: flex; }
        .spec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .spec-card { background: var(--bg-deep); border: 1px solid var(--border-glow); padding: 15px; }
        .spec-card label { display: block; color: var(--text-dim); font-size: 0.8rem; margin-bottom: 5px; text-transform: uppercase; }
        .spec-card value { display: block; color: var(--accent-cyan); font-size: 1.1rem; }
    </style>
</head>
<body>
    <header>
        <div class="header-title">STAR FORCE VESSEL REGISTRY</div>
        <div class="header-meta">CLOUD DB SYNC ACTIVE</div>
    </header>
    <div class="main-container">
        <aside>
            <input type="text" class="search-box" placeholder="SEARCH DATABASE..." id="searchInput" oninput="filterVessels()">
            <div class="vessel-list" id="vesselList"></div>
        </aside>
        <main>
            <div class="dossier-header">
                <div class="dossier-title">
                    <h1 id="shipDesignation">LOADING...</h1>
                    <p id="shipClass">Connecting to Cloud Database...</p>
                </div>
                <div class="status-badge" id="shipStatus">SYNC</div>
            </div>
            <div class="tabs">
                <button class="tab-btn active" onclick="switchTab(0)">REGISTRY CARD</button>
                <button class="tab-btn" onclick="switchTab(1)">SPECIFICATIONS</button>
                <button class="tab-btn" onclick="switchTab(2)">WEAPONS & DEFENSE</button>
                <button class="tab-btn" onclick="switchTab(3)">CREW SYSTEMS</button>
            </div>
            <div class="tab-content active">
                <div class="spec-grid">
                    <div class="spec-card"><label>Builder</label><value id="valBuilder">-</value></div>
                    <div class="spec-card"><label>Registry</label><value id="valRegistry">-</value></div>
                    <div class="spec-card"><label>Fleet</label><value id="valFleet">-</value></div>
                    <div class="spec-card"><label>Commission</label><value id="valCommission">-</value></div>
                </div>
                <div class="spec-card"><label>Notes</label><value id="valNotes">-</value></div>
            </div>
            <div class="tab-content">
                <div class="spec-grid">
                    <div class="spec-card"><label>Length</label><value id="valLength">-</value></div>
                    <div class="spec-card"><label>Width</label><value id="valWidth">-</value></div>
                    <div class="spec-card"><label>Warp</label><value id="valWarp">-</value></div>
                    <div class="spec-card"><label>Sublight</label><value id="valSublight">-</value></div>
                </div>
            </div>
            <div class="tab-content">
                <div class="spec-grid">
                    <div class="spec-card"><label>Primary Armament</label><value id="valPrimary">-</value></div>
                    <div class="spec-card"><label>Secondary Armament</label><value id="valSecondary">-</value></div>
                </div>
                <div class="spec-card"><label>Defense</label><value id="valDefense">-</value></div>
            </div>
            <div class="tab-content">
                <div class="spec-grid">
                    <div class="spec-card"><label>Crew</label><value id="valCrew">-</value></div>
                    <div class="spec-card"><label>Armor</label><value id="valArmor">-</value></div>
                </div>
            </div>
        </main>
    </div>
    <script>
        let vessels = [], currentVessel = null;
        async function fetchVessels() {
            const res = await fetch('/api/vessels');
            vessels = await res.json();
            renderList(vessels);
            if (vessels.length > 0) selectVessel(vessels[0].id);
        }
        function renderList(data) {
            document.getElementById('vesselList').innerHTML = data.map(v => \`
                <div class="vessel-item \${currentVessel && currentVessel.id === v.id ? 'active' : ''}" onclick="selectVessel(\${v.id})">
                    <h4>\${v.designation}</h4><p>\${v.registry_number}</p>
                </div>
            \`).join('');
        }
        function selectVessel(id) {
            currentVessel = vessels.find(v => v.id === id);
            if (!currentVessel) return;
            renderList(vessels);
            document.getElementById('shipDesignation').innerText = currentVessel.designation;
            document.getElementById('shipClass').innerText = currentVessel.ship_class;
            document.getElementById('shipStatus').innerText = currentVessel.status;
            document.getElementById('valBuilder').innerText = currentVessel.builder;
            document.getElementById('valRegistry').innerText = currentVessel.registry_number;
            document.getElementById('valFleet').innerText = currentVessel.fleet;
            document.getElementById('valCommission').innerText = currentVessel.commission_date;
            document.getElementById('valNotes').innerText = currentVessel.operational_notes;
            document.getElementById('valLength').innerText = currentVessel.hull_length + 'm';
            document.getElementById('valWidth').innerText = currentVessel.hull_width + 'm';
            document.getElementById('valWarp').innerText = currentVessel.max_warp_speed;
            document.getElementById('valSublight').innerText = currentVessel.max_sublight_speed;
            document.getElementById('valPrimary').innerText = currentVessel.primary_armament;
            document.getElementById('valSecondary').innerText = currentVessel.secondary_armament;
            document.getElementById('valDefense').innerText = currentVessel.defensive_systems;
            document.getElementById('valCrew').innerText = currentVessel.crew_complement;
            document.getElementById('valArmor').innerText = currentVessel.armor_type;
        }
        function switchTab(index) {
            document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === index));
            document.querySelectorAll('.tab-content').forEach((c, i) => c.classList.toggle('active', i === index));
        }
        function filterVessels() {
            const q = document.getElementById('searchInput').value.toLowerCase();
            renderList(vessels.filter(v => v.designation.toLowerCase().includes(q) || v.registry_number.toLowerCase().includes(q)));
        }
        fetchVessels();
    </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
initializeDatabase().then(() => {
    app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
});
