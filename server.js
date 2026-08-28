const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto"); // NOUVEAU : Module de cryptographie pour le coffre-fort

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/homeid",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// --- SÉCURITÉ COFFRE FORT (AES-256) ---
// Clé de chiffrement générée à partir d'un secret serveur
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.VAULT_SECRET || "home-id-ultra-secure-key-2026").digest('base64').substring(0, 32);
const IV_LENGTH = 16;

function encryptPassword(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptPassword(text) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), year INT, surface INT, land INT, owner_password VARCHAR(255), is_setup BOOLEAN DEFAULT FALSE);
      CREATE TABLE IF NOT EXISTS systems (id VARCHAR(50) PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, name VARCHAR(100), icon VARCHAR(10), status VARCHAR(50), color VARCHAR(20));
      CREATE TABLE IF NOT EXISTS equipment (id VARCHAR(50) PRIMARY KEY, system_id VARCHAR(50) REFERENCES systems(id) ON DELETE CASCADE, name VARCHAR(100), model VARCHAR(100), installed VARCHAR(50), notice TEXT, artisan VARCHAR(100), specs JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS alerts (id SERIAL PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, title VARCHAR(255), text TEXT, date VARCHAR(50));
      CREATE TABLE IF NOT EXISTS professionals (id SERIAL PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, name VARCHAR(100), domain VARCHAR(100), access VARCHAR(50), expires VARCHAR(50));
      CREATE TABLE IF NOT EXISTS documents (id VARCHAR(50) PRIMARY KEY, system_id VARCHAR(50) REFERENCES systems(id) ON DELETE CASCADE, name VARCHAR(255), added VARCHAR(50));
      
      -- Tables pour le coffre-fort
      CREATE TABLE IF NOT EXISTS vault_items (id SERIAL PRIMARY KEY, home_id VARCHAR(50) REFERENCES home(id) ON DELETE CASCADE, title VARCHAR(100), login VARCHAR(100), encrypted_pwd TEXT);
    `);

    await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS specs JSONB;`);
    await pool.query(`ALTER TABLE home ADD COLUMN IF NOT EXISTS plans JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await pool.query(`ALTER TABLE professionals ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
    await pool.query(`ALTER TABLE professionals ADD COLUMN IF NOT EXISTS email VARCHAR(100);`);
    await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_done BOOLEAN DEFAULT FALSE;`);
    await pool.query(`ALTER TABLE systems ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;`);
    await pool.query(`ALTER TABLE professionals ADD COLUMN IF NOT EXISTS notes TEXT;`);
    
    // Ajout du code PIN du coffre à la maison
    await pool.query(`ALTER TABLE home ADD COLUMN IF NOT EXISTS vault_pin VARCHAR(255);`);

    // --- NOUVEAUTÉ : Ajout des colonnes JSON pour Diagnostics, Widgets et CADASTRE ---
    await pool.query(`ALTER TABLE home ADD COLUMN IF NOT EXISTS diagnostics JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE home ADD COLUMN IF NOT EXISTS custom_widgets JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE home ADD COLUMN IF NOT EXISTS cadastre JSONB DEFAULT '[]'::jsonb;`);

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
      { id: `elec_${id}`, name: "Électricité", icon: "⚡", status: "À configurer", color: "orange", order: 1 },
      { id: `eau_${id}`, name: "Plomberie & Eau", icon: "💧", status: "À configurer", color: "orange", order: 2 },
      { id: `chauffe_${id}`, name: "Chauffage", icon: "🔥", status: "À configurer", color: "orange", order: 3 },
      { id: `clim_${id}`, name: "Clim & VMC", icon: "❄️", status: "À configurer", color: "orange", order: 4 },
      { id: `piscine_${id}`, name: "Piscine", icon: "🏊", status: "À configurer", color: "orange", order: 5 },
      { id: `ext_${id}`, name: "Extérieur", icon: "🌳", status: "À configurer", color: "orange", order: 6 },
      { id: `domo_${id}`, name: "Réseau", icon: "📡", status: "À configurer", color: "orange", order: 7 }
    ];
    
    for (let sys of defaultSystems) { 
      await pool.query(`INSERT INTO systems (id, home_id, name, icon, status, color, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [sys.id, id, sys.name, sys.icon, sys.status, sys.color, sys.order]); 
    }
    
    res.json({ ok: true, id: id });
  } catch (err) { 
    res.status(500).json({ error: "Erreur serveur" }); 
  }

app.get("/api/home", async (req, res) => {
  const homeId = req.query.id; 
  try {
    const homeResult = await pool.query(`SELECT * FROM home WHERE id = $1`, [homeId]);
    if (homeResult.rows.length === 0) return res.status(404).json({ error: "Maison introuvable." });
    
    let systems = (await pool.query(`SELECT * FROM systems WHERE home_id = $1 ORDER BY display_order ASC, id ASC`, [homeId])).rows;
    const equipCount = await pool.query(`SELECT system_id, COUNT(*) as count FROM equipment WHERE system_id IN (SELECT id FROM systems WHERE home_id = $1) GROUP BY system_id`, [homeId]);
    systems = systems.map(sys => {
      const match = equipCount.rows.find(e => e.system_id === sys.id);
      return { ...sys, equipment: match ? parseInt(match.count) : 0 };
    });

    const alerts = (await pool.query(`SELECT * FROM alerts WHERE home_id = $1 ORDER BY id DESC`, [homeId])).rows;
    const pros = (await pool.query(`SELECT * FROM professionals WHERE home_id = $1 ORDER BY id DESC`, [homeId])).rows;

    res.json({ 
      id: homeResult.rows[0].id, 
      name: homeResult.rows[0].name, 
      year: homeResult.rows[0].year, 
      surface: homeResult.rows[0].surface, 
      land: homeResult.rows[0].land, 
      plans: homeResult.rows[0].plans || [], 
      role: "owner", 
      systems, 
      alerts, 
      professionals: pros,
      // --- NOUVEAUTÉ : On inclut les diagnostics, Widgets et Cadastre dans la réponse ! ---
      diagnostics: homeResult.rows[0].diagnostics || [], 
      customWidgets: homeResult.rows[0].custom_widgets || [],
      cadastre: homeResult.rows[0].cadastre || []
    });
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

// --- NOUVELLE ROUTE UNIFIÉE POUR SAUVEGARDER LES DIAGNOSTICS, WIDGETS ET CADASTRE ---
app.post("/api/home/update-fields", async (req, res) => {
  const { id, diagnostics, customWidgets, cadastre } = req.body;
  if (!id) return res.status(400).json({ error: "ID manquant" });

  try {
    if (diagnostics !== undefined) {
      await pool.query("UPDATE home SET diagnostics = $1 WHERE id = $2", [JSON.stringify(diagnostics), id]);
    }
    if (customWidgets !== undefined) {
      await pool.query("UPDATE home SET custom_widgets = $1 WHERE id = $2", [JSON.stringify(customWidgets), id]);
    }
    if (cadastre !== undefined) {
      await pool.query("UPDATE home SET cadastre = $1 WHERE id = $2", [JSON.stringify(cadastre), id]);
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur lors de la sauvegarde" });
  }
});

// --- ROUTES SYSTÈMES, EQUIPEMENTS, ALERTES ET ARTISANS ---
app.get("/api/systems/:id", async (req, res) => {
  try {
    const sysResult = await pool.query(`SELECT * FROM systems WHERE id = $1`, [req.params.id]);
    const equipResult = await pool.query(`SELECT * FROM equipment WHERE system_id = $1 ORDER BY created_at ASC`, [req.params.id]);
    if (sysResult.rows.length === 0) return res.status(404).json({ error: "Introuvable" });
    res.json({ id: sysResult.rows[0].id, name: sysResult.rows[0].name, icon: sysResult.rows[0].icon, specs: sysResult.rows[0].specs || {}, equipment: equipResult.rows || [] });
  } catch(e) { res.status(500).json({ error: "Erreur" }); }
});

app.post("/api/systems/add", async (req, res) => {
  const { homeId, name, icon } = req.body;
  const sysId = "SYS-" + Date.now().toString(36).toUpperCase();
  try {
    await pool.query(`INSERT INTO systems (id, home_id, name, icon, status, color, display_order) VALUES ($1, $2, $3, $4, 'À configurer', 'orange', 99)`, [sysId, homeId, name, icon || "⚙️"]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur serveur." }); }
});

app.post("/api/systems/update", async (req, res) => {
  const { id, name, icon } = req.body;
  try {
    await pool.query(`UPDATE systems SET name = $1, icon = $2 WHERE id = $3`, [name, icon, id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

app.post("/api/systems/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query(`DELETE FROM systems WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

app.post("/api/systems/reorder", async (req, res) => {
  const { orderData } = req.body;
  try {
    for (let item of orderData) {
      await pool.query(`UPDATE systems SET display_order = $1 WHERE id = $2`, [item.order, item.id]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur de tri" }); }
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

app.post("/api/alerts/add", async (req, res) => {
  const { homeId, title, date, text } = req.body;
  try {
    await pool.query(`INSERT INTO alerts (home_id, title, date, text) VALUES ($1, $2, $3, $4)`, [homeId, title, date, text || ""]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

app.post("/api/alerts/toggle", async (req, res) => {
  const { id, is_done } = req.body;
  try {
    await pool.query(`UPDATE alerts SET is_done = $1 WHERE id = $2`, [is_done, id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

app.post("/api/alerts/update", async (req, res) => {
  const { id, title, date, text } = req.body;
  try {
    await pool.query(`UPDATE alerts SET title = $1, date = $2, text = $3 WHERE id = $4`, [title, date, text || "", id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur de modification." }); }
});

app.post("/api/alerts/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query(`DELETE FROM alerts WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur de suppression." }); }
});

app.post("/api/professionals/add", async (req, res) => {
  const { homeId, name, domain, phone, email, notes } = req.body;
  try {
    await pool.query(`INSERT INTO professionals (home_id, name, domain, phone, email, notes, access) VALUES ($1, $2, $3, $4, $5, $6, 'Intervenu')`, [homeId, name, domain, phone || null, email || null, notes || ""]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

app.post("/api/professionals/update", async (req, res) => {
  const { id, name, domain, phone, email, notes } = req.body;
  try {
    await pool.query(`UPDATE professionals SET name = $1, domain = $2, phone = $3, email = $4, notes = $5 WHERE id = $6`, [name, domain, phone || null, email || null, notes || "", id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

app.post("/api/professionals/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query(`DELETE FROM professionals WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur." }); }
});

// --- NOUVELLES ROUTES : COFFRE-FORT DE MOTS DE PASSE ---

app.post("/api/vault/check", async (req, res) => {
  const { homeId } = req.body;
  try {
    const home = await pool.query(`SELECT vault_pin FROM home WHERE id = $1`, [homeId]);
    if (home.rows.length === 0) return res.status(404).json({ error: "Maison introuvable" });
    res.json({ isSetup: !!home.rows[0].vault_pin });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/vault/setup", async (req, res) => {
  const { homeId, pin } = req.body;
  try {
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
    await pool.query(`UPDATE home SET vault_pin = $1 WHERE id = $2`, [hashedPin, homeId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/vault/unlock", async (req, res) => {
  const { homeId, pin } = req.body;
  try {
    const home = await pool.query(`SELECT vault_pin FROM home WHERE id = $1`, [homeId]);
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
    
    if (home.rows[0].vault_pin !== hashedPin) {
      return res.status(401).json({ error: "Code PIN incorrect" });
    }

    const items = await pool.query(`SELECT * FROM vault_items WHERE home_id = $1`, [homeId]);
    const decryptedItems = items.rows.map(item => ({
      id: item.id,
      title: item.title,
      login: item.login,
      password: decryptPassword(item.encrypted_pwd)
    }));

    res.json({ ok: true, items: decryptedItems });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/vault/add", async (req, res) => {
  const { homeId, pin, title, login, password } = req.body;
  try {
    const home = await pool.query(`SELECT vault_pin FROM home WHERE id = $1`, [homeId]);
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
    if (home.rows[0].vault_pin !== hashedPin) return res.status(401).json({ error: "Accès refusé" });

    const encryptedPwd = encryptPassword(password);
    
    await pool.query(
      `INSERT INTO vault_items (home_id, title, login, encrypted_pwd) VALUES ($1, $2, $3, $4)`,
      [homeId, title, login || "", encryptedPwd]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/vault/delete", async (req, res) => {
  const { homeId, pin, itemId } = req.body;
  try {
    const home = await pool.query(`SELECT vault_pin FROM home WHERE id = $1`, [homeId]);
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
    if (home.rows[0].vault_pin !== hashedPin) return res.status(401).json({ error: "Accès refusé" });

    await pool.query(`DELETE FROM vault_items WHERE id = $1`, [itemId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));
