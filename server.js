const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/homeid",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// INITIALISATION SÉCURISÉE (Ne détruit plus la base)
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
    console.log("Base de données connectée et prête !");
  } catch (error) {
    console.error("Erreur init DB :", error);
  }
}
initDB();

app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// 🛠️ OUTIL DE RÉPARATION (À utiliser une seule fois)
// ======================================================
app.get("/reset", async (req, res) => {
  try {
    await pool.query(`
      DROP TABLE IF EXISTS documents CASCADE;
      DROP TABLE IF EXISTS equipment CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS professionals CASCADE;
      DROP TABLE IF EXISTS systems CASCADE;
      DROP TABLE IF EXISTS home CASCADE;
    `);
    await initDB();
    res.send("<h1>SUCCÈS !</h1><p>La base de données a été réparée. Vous pouvez retourner sur l'accueil ou scanner un QR code.</p>");
  } catch(e) {
    res.send("Erreur de réparation : " + e.message);
  }
});

// ======================================================
// 📱 LE SCANNEUR DE QR CODE
// ======================================================
app.get("/scan/:id", async (req, res) => {
  const scannedId = req.params.id;
  try {
    const checkHome = await pool.query(`SELECT is_setup FROM home WHERE id = $1`, [scannedId]);
    if (checkHome.rows.length === 0) {
      return res.redirect(`/setup.html?id=${scannedId}`);
    } else {
      // On redirige vers l'accueil. Le Javascript (app.js) bloquera la page si non connecté.
      return res.redirect(`/?id=${scannedId}`);
    }
  } catch (err) {
    res.status(500).send("Erreur de lecture.");
  }
});

// ======================================================
// 🔒 VÉRIFICATION MOT DE PASSE (LOGIN)
// ======================================================
app.post("/api/login", async (req, res) => {
  const { id, password } = req.body;
  try {
    const user = await pool.query(`SELECT id FROM home WHERE id = $1 AND owner_password = $2`, [id, password]);
    if (user.rows.length > 0) res.json({ ok: true });
    else res.status(401).json({ error: "Mot de passe incorrect." });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ======================================================
// SETUP ET AUTRES ROUTES
// ======================================================
app.post("/api/setup", async (req, res) => {
  const { id, name, year, surface, land, password } = req.body;
  if (!id || !name || !password) return res.status(400).json({ error: "Champs obligatoires." });

  try {
    await pool.query(
      `INSERT INTO home (id, name, year, surface, land, owner_password, is_setup) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [id, name, parseInt(year), parseInt(surface)||0, parseInt(land)||0, password]
    );

    const defaultSystems = [
      { id: `elec_${id}`, name: "Électricité", icon: "⚡", status: "À configurer", color: "orange" },
      { id: `eau_${id}`, name: "Plomberie & Eau", icon: "💧", status: "À configurer", color: "orange" },
      { id: `chauffe_${id}`, name: "Chauffage", icon: "🔥", status: "À configurer", color: "orange" },
      { id: `clim_${id}`, name: "Clim & VMC", icon: "❄️", status: "À configurer", color: "orange" },
      { id: `piscine_${id}`, name: "Piscine", icon: "🏊", status: "À configurer", color: "orange" },
      { id: `ext_${id}`, name: "Extérieur", icon: "🌳", status: "À configurer", color: "orange" },
      { id: `domo_${id}`, name: "Réseau", icon: "📡", status: "À configurer", color: "orange" }
    ];

    for (let sys of defaultSystems) {
      await pool.query(`INSERT INTO systems (id, home_id, name, icon, status, color) VALUES ($1, $2, $3, $4, $5, $6)`, [sys.id, id, sys.name, sys.icon, sys.status, sys.color]);
    }
    res.json({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors du setup." });
  }
});

// --- INFOS MAISON ---
app.get("/api/home", async (req, res) => {
  const homeId = req.query.id; 
  if (!homeId) return res.status(400).json({ error: "ID manquant." });

  try {
    const homeResult = await pool.query(`SELECT * FROM home WHERE id = $1`, [homeId]);
    if (homeResult.rows.length === 0) return res.status(404).json({ error: "Maison introuvable." });
    
    const systemsResult = await pool.query(`SELECT * FROM systems WHERE home_id = $1`, [homeId]);
    let systems = systemsResult.rows;

    const equipCount = await pool.query(`SELECT system_id, COUNT(*) as count FROM equipment WHERE system_id IN (SELECT id FROM systems WHERE home_id = $1) GROUP BY system_id`, [homeId]);
    systems = systems.map(sys => {
      const match = equipCount.rows.find(e => e.system_id === sys.id);
      return { ...sys, equipment: match ? parseInt(match.count) : 0 };
    });

    const alertsResult = await pool.query(`SELECT * FROM alerts WHERE home_id = $1 ORDER BY id DESC`, [homeId]);
    const prosResult = await pool.query(`SELECT * FROM professionals WHERE home_id = $1 ORDER BY id DESC`, [homeId]);

    res.json({
      id: homeResult.rows[0].id, name: homeResult.rows[0].name, year: homeResult.rows[0].year, surface: homeResult.rows[0].surface, land: homeResult.rows[0].land, role: "owner",
      systems: systems, alerts: alertsResult.rows, professionals: prosResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.get("/api/systems/:id", async (req, res) => {
  // (Votre route /api/systems/ reste identique, je la raccourcis ici pour la lisibilité)
  try {
    const sysResult = await pool.query(`SELECT * FROM systems WHERE id = $1`, [req.params.id]);
    const equipResult = await pool.query(`SELECT * FROM equipment WHERE system_id = $1`, [req.params.id]);
    res.json({ id: sysResult.rows[0].id, name: sysResult.rows[0].name, icon: sysResult.rows[0].icon, equipment: equipResult.rows || [] });
  } catch(e) { res.status(500).json({ error: "Erreur" }); }
});
// ======================================================
// ✏️ MODIFIER LES INFOS DE LA MAISON
// ======================================================
app.post("/api/home/update", async (req, res) => {
  const { id, name, year, surface, land, currentPassword } = req.body;
  try {
    // 1. Vérification de sécurité
    const check = await pool.query(`SELECT id FROM home WHERE id = $1 AND owner_password = $2`, [id, currentPassword]);
    if (check.rows.length === 0) return res.status(401).json({ error: "Mot de passe incorrect." });

    // 2. Mise à jour
    await pool.query(
      `UPDATE home SET name = $1, year = $2, surface = $3, land = $4 WHERE id = $5`,
      [name, parseInt(year), parseInt(surface) || 0, parseInt(land) || 0, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));
