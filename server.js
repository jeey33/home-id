const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Base de données en mémoire
let homeDatabase = {
  isSetup: false,
  id: "HID-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
  name: "",
  year: null,
  surface: null,
  land: null,
  systems: [],
  alerts: [],
  professionals: [],
  details: {}
};

app.use((req, res, next) => {
  if ((req.path === '/' || req.path === '/index.html') && !homeDatabase.isSetup) {
    return res.redirect('/setup.html');
  }
  if (req.path === '/setup.html' && homeDatabase.isSetup) {
    return res.redirect('/');
  }
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/setup", (req, res) => {
  if (homeDatabase.isSetup) return res.status(403).json({ error: "Déjà configuré." });

  const { name, year, surface, land } = req.body;
  if (!name || !year) return res.status(400).json({ error: "Nom et année requis." });

  homeDatabase.isSetup = true;
  homeDatabase.name = name;
  homeDatabase.year = parseInt(year);
  homeDatabase.surface = parseInt(surface) || 0;
  homeDatabase.land = parseInt(land) || 0;

  // Création exhaustive des systèmes
  homeDatabase.systems = [
    { id: "electricite", name: "Électricité", icon: "⚡", status: "À jour", color: "green", equipment: 0 },
    { id: "eau", name: "Plomberie & Eau", icon: "💧", status: "À jour", color: "green", equipment: 0 },
    { id: "chauffage", name: "Chauffage", icon: "🔥", status: "À configurer", color: "orange", equipment: 0 },
    { id: "climatisation", name: "Clim & VMC", icon: "❄️", status: "À jour", color: "green", equipment: 0 },
    { id: "piscine", name: "Piscine & Spa", icon: "🏊", status: "À configurer", color: "orange", equipment: 0 },
    { id: "exterieur", name: "Extérieur & Fermetures", icon: "🌳", status: "À jour", color: "green", equipment: 0 },
    { id: "domotique", name: "Réseau & Sécurité", icon: "📡", status: "À jour", color: "green", equipment: 0 }
  ];

  homeDatabase.systems.forEach(sys => {
    homeDatabase.details[sys.id] = { name: sys.name, icon: sys.icon, equipment: [], documents: [] };
  });

  res.json({ ok: true });
});

app.get("/api/home", (req, res) => {
  if (!homeDatabase.isSetup) return res.status(403).json({ error: "Non configuré" });

  const role = req.query.role || "owner";
  let filteredSystems = homeDatabase.systems;

  if (role === "electricien") filteredSystems = homeDatabase.systems.filter(s => ["electricite", "domotique"].includes(s.id));
  else if (role === "pisciniste") filteredSystems = homeDatabase.systems.filter(s => s.id === "piscine");
  else if (role === "clim") filteredSystems = homeDatabase.systems.filter(s => ["climatisation", "chauffage"].includes(s.id));

  res.json({
    id: homeDatabase.id,
    name: homeDatabase.name,
    year: homeDatabase.year,
    surface: homeDatabase.surface,
    land: homeDatabase.land,
    role: role,
    systems: filteredSystems,
    alerts: homeDatabase.alerts,
    professionals: homeDatabase.professionals
  });
});

app.get("/api/systems/:id", (req, res) => {
  const system = homeDatabase.details[req.params.id];
  if (!system) return res.status(404).json({ error: "Système introuvable" });
  res.json(system);
});

app.post("/api/equipment", (req, res) => {
  const { systemId, name, model, specs } = req.body;
  if (!systemId || !name || !homeDatabase.details[systemId]) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const newEquip = { name, model: model || "", installed: "Aujourd'hui", specs: specs || {} };
  homeDatabase.details[systemId].equipment.push(newEquip);

  const sysCard = homeDatabase.systems.find(s => s.id === systemId);
  if (sysCard) sysCard.equipment = homeDatabase.details[systemId].equipment.length;

  res.json({ ok: true });
});

app.post("/api/alerts", (req, res) => {
  const { title, text, date } = req.body;
  homeDatabase.alerts.unshift({ id: Date.now(), title, text, date });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
