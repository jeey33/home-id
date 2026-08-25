const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/homeid",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), year INT, surface INT, land INT, owner_password VARCHAR(255), is_setup BOOLEAN DEFAULT FALSE);
      CREATE TABLE IF NOT EXISTS systems (id VARCHAR(50) PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, name VARCHAR(100), icon VARCHAR(10), status VARCHAR(50), color VARCHAR(20));
      CREATE TABLE IF NOT EXISTS equipment (id VARCHAR(50) PRIMARY KEY, system_id VARCHAR(50) REFERENCES systems(id) ON DELETE CASCADE, name VARCHAR(100), model VARCHAR(100), installed VARCHAR(50), notice VARCHAR(255), artisan VARCHAR(100), specs JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS alerts (id SERIAL PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, title VARCHAR(255), text TEXT, date VARCHAR(50));
      CREATE TABLE IF NOT EXISTS professionals (id SERIAL PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, name VARCHAR(100), domain VARCHAR(100), access VARCHAR(50), expires VARCHAR(50));
      CREATE TABLE IF NOT EXISTS documents (id VARCHAR(50) PRIMARY KEY, system_id VARCHAR(50) REFERENCES systems(id) ON DELETE CASCADE, name VARCHAR(255), added VARCHAR(50));
    `);

    await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS specs JSONB;`);
    await pool.query(`ALTER TABLE home ADD COLUMN IF NOT EXISTS plans JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE equipment ALTER COLUMN notice TYPE TEXT;`);
    await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS notes TEXT;`);

    console.log("Base de données connectée, mise à jour et prête !");
  } catch (error) {
    console.error("Erreur init DB :", error);
  }
}
initDB();

app.use(express.static(path.join(__dirname, "public")));

// --- ROUTES MAISON ET CONNEXION ---
app.get("/scan/:id", async (req, res) => {
  const scannedId = req.params.id;
  try {
    const checkHome = await pool.query(`SELECT is_setup FROM home WHERE id = $1`, [scannedId]);
    if (checkHome.rows.length === 0) return res.redirect(`/setup.html?id=${scannedId}`);
    return res.redirect(`/?id=${scannedId}`);
  } catch (err) { res.status(500).send("Erreur de lecture."); }
});

app.post("/api/login", async (req, res) => {
  const { id, password } = req.body;
  try {
    const user = await pool.query(`SELECT id FROM home WHERE id = $1 AND owner_password = $2`, [id, password]);
    if (user.rows.length > 0) res.json({ ok: true });
    else res.status(401).json({ error: "Mot de passe incorrect." });
  } catch (err) { res.status(500).json({ error: "Erreur serveur." }); }
});

app.post("/api/setup", async (req, res) => {
  const { id, name, year, surface, land, password } = req.body;
  try {
    await pool.query(`INSERT INTO home (id, name, year, surface, land, owner_password, is_setup, plans) VALUES ($1, $2, $3, $4, $5, $6, TRUE, '[]'::jsonb)`, [id, name, parseInt(year), parseInt(surface)||0, parseInt(land)||0, password]);
    const defaultSystems = [
      { id: `elec_${id}`, name: "Électricité", icon: "⚡", status: "À configurer", color: "orange" },
      { id: `eau_${id}`, name: "Plomberie & Eau", icon: "💧", status: "À configurer", color: "orange" },
      { id: `chauffe_${id}`, name: "Chauffage", icon: "🔥", status: "À configurer", color: "orange" },
      { id: `clim_${id}`, name: "Clim & VMC", icon: "❄️", status: "À configurer", color: "orange" },
      { id: `piscine_${id}`, name: "Piscine", icon: "🏊", status: "À configurer", color: "orange" },
      { id: `ext_${id}`, name: "Extérieur", icon: "🌳", status: "À configurer", color: "orange" },
      { id: `domo_${id}`, name: "Réseau", icon: "📡", status: "À configurer", color: "orange" }
    ];
    for (let sys of defaultSystems) { await pool.query(`INSERT INTO systems (id, home_id, name, icon, status, color) VALUES ($1, $2, $3, $4, $5, $6)`, [sys.id, id, sys.name, sys.icon, sys.status, sys.color]); }
    res.json({ ok: true, id: id });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.get("/api/home", async (req, res) => {
  const homeId = req.query.id; 
  try {
    const homeResult = await pool.query(`SELECT * FROM home WHERE id = $1`, [homeId]);
    if (homeResult.rows.length === 0) return res.status(404).json({ error: "Maison introuvable." });
    
    let systems = (await pool.query(`SELECT * FROM systems WHERE home_id = $1`, [homeId])).rows;
    const equipCount = await pool.query(`SELECT system_id, COUNT(*) as count FROM equipment WHERE system_id IN (SELECT id FROM systems WHERE home_id = $1) GROUP BY system_id`, [homeId]);
    systems = systems.map(sys => {
      const match = equipCount.rows.find(e => e.system_id === sys.id);
      return { ...sys, equipment: match ? parseInt(match.count) : 0 };
    });

    const alerts = (await pool.query(`SELECT * FROM alerts WHERE home_id = $1 ORDER BY id DESC`, [homeId])).rows;
    const pros = (await pool.query(`SELECT * FROM professionals WHERE home_id = $1 ORDER BY id DESC`, [homeId])).rows;

    res.json({ id: homeResult.rows[0].id, name: homeResult.rows[0].name, year: homeResult.rows[0].year, surface: homeResult.rows[0].surface, land: homeResult.rows[0].land, plans: homeResult.rows[0].plans || [], role: "owner", systems, alerts, professionals: pros });
  } catch (err) { res.status(500).json({ error: "Erreur serveur." }); }
});

app.post("/api/home/update", async (req, res) => {
  const { id, name, year, surface, land, currentPassword } = req.body;
  try {
    const check = await pool.query(`SELECT id FROM home WHERE id = $1 AND owner_password = $2`, [id, currentPassword]);
    if (check.rows.length === 0) return res.status(401).json({ error: "Mot de passe incorrect." });
    await pool.query(`UPDATE home SET name = $1, year = $2, surface = $3, land = $4 WHERE id = $5`, [name, parseInt(year), parseInt(surface)||0, parseInt(land)||0, id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur MAJ." }); }
});

app.post("/api/home/plan", async (req, res) => {
  const { id, name, image } = req.body;
  try {
    const homeRes = await pool.query(`SELECT plans FROM home WHERE id = $1`, [id]);
    let plans = homeRes.rows[0].plans || [];
    plans.push({ id: "PLN-" + Date.now(), name: name, image: image });
    await pool.query(`UPDATE home SET plans = $1 WHERE id = $2`, [JSON.stringify(plans), id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur serveur." }); }
});

// --- ROUTES SYSTÈMES ET ÉQUIPEMENTS ---
app.get("/api/systems/:id", async (req, res) => {
  try {
    const sysResult = await pool.query(`SELECT * FROM systems WHERE id = $1`, [req.params.id]);
    const equipResult = await pool.query(`SELECT * FROM equipment WHERE system_id = $1 ORDER BY created_at ASC`, [req.params.id]);
    if (sysResult.rows.length === 0) return res.status(404).json({ error: "Introuvable" });
    res.json({ id: sysResult.rows[0].id, name: sysResult.rows[0].name, icon: sysResult.rows[0].icon, specs: sysResult.rows[0].specs || {}, equipment: equipResult.rows || [] });
  } catch(e) { res.status(500).json({ error: "Erreur" }); }
});

// NOUVEAU : AJOUTER UN SYSTÈME
app.post("/api/systems/add", async (req, res) => {
  const { homeId, name, icon } = req.body;
  const sysId = "SYS-" + Date.now().toString(36).toUpperCase();
  try {
    await pool.query(
      `INSERT INTO systems (id, home_id, name, icon, status, color) VALUES ($1, $2, $3, $4, 'À configurer', 'orange')`,
      [sysId, homeId, name, icon || "⚙️"]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur serveur." }); }
});

// NOUVEAU : MODIFIER UN SYSTÈME
app.post("/api/systems/update", async (req, res) => {
  const { id, name, icon } = req.body;
  try {
    await pool.query(`UPDATE systems SET name = $1, icon = $2 WHERE id = $3`, [name, icon, id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

// NOUVEAU : SUPPRIMER UN SYSTÈME
app.post("/api/systems/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query(`DELETE FROM systems WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

app.post("/api/systems/config", async (req, res) => {
  const { systemId, specs } = req.body;
  try {
    await pool.query(`UPDATE systems SET specs = $1, status = 'Configuré', color = 'green' WHERE id = $2`, [specs, systemId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

app.post("/api/equipment", async (req, res) => {
  const { systemId, name, model, artisan, notice, specs, notes } = req.body;
  const eqId = "EQ-" + Date.now().toString(36).toUpperCase();
  const installedDate = new Date().toLocaleDateString("fr-FR");
  try {
    await pool.query(
      `INSERT INTO equipment (id, system_id, name, model, installed, notice, artisan, specs, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [eqId, systemId, name, model || "", installedDate, notice || null, artisan || null, specs || {}, notes || ""]
    );
    await pool.query(`UPDATE systems SET status = 'À jour', color = 'green' WHERE id = $1`, [systemId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

app.post("/api/equipment/update", async (req, res) => {
  const { id, name, model, installed, specs, notes } = req.body;
  try {
    await pool.query(`UPDATE equipment SET name = $1, model = $2, installed = $3, specs = $4, notes = $5 WHERE id = $6`, [name, model || "", installed, specs || {}, notes || "", id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur de modification." }); }
});

app.post("/api/equipment/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query(`DELETE FROM equipment WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur de suppression." }); }
});

// NOUVEAU : AJOUTER UN ENTRETIEN (ALERTE)
app.post("/api/alerts/add", async (req, res) => {
  const { homeId, title, date, text } = req.body;
  try {
    await pool.query(`INSERT INTO alerts (home_id, title, date, text) VALUES ($1, $2, $3, $4)`, [homeId, title, date, text || ""]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

// NOUVEAU : AJOUTER UN ARTISAN
app.post("/api/professionals/add", async (req, res) => {
  const { homeId, name, domain } = req.body;
  try {
    // Par défaut, l'artisan est marqué "Intervenu"
    await pool.query(`INSERT INTO professionals (home_id, name, domain, access) VALUES ($1, $2, $3, 'Intervenu')`, [homeId, name, domain]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));
