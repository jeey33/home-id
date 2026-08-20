const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Base de données en mémoire
let homeDatabase = {
  isSetup: false, // Verrou de configuration
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

// ==========================================
// MIDDLEWARE DE SÉCURITÉ / REDIRECTION
// ==========================================
app.use((req, res, next) => {
  // 1. Si on accède au tableau de bord mais que la maison est vierge -> go setup
  if ((req.path === '/' || req.path === '/index.html') && !homeDatabase.isSetup) {
    return res.redirect('/setup.html');
  }
  // 2. Si on tente de retourner sur la page de setup alors que c'est déjà configuré -> go dashboard
  if (req.path === '/setup.html' && homeDatabase.isSetup) {
    return res.redirect('/');
  }
  next();
});

// Sert les fichiers statiques (html, css, js) APRÈS les redirections
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// ROUTES API
// ==========================================

// Configuration initiale de la maison (Une seule fois)
app.post("/api/setup", (req, res) => {
  if (homeDatabase.isSetup) {
    return res.status(403).json({ error: "La maison est déjà configurée." });
  }

  const { name, year, surface, land } = req.body;

  if (!name || !year) {
    return res.status(400).json({ error: "Nom et année requis." });
  }

  homeDatabase.isSetup = true; // On verrouille
  homeDatabase.name = name;
  homeDatabase.year = parseInt(year);
  homeDatabase.surface = parseInt(surface) || 0;
  homeDatabase.land = parseInt(land) || 0;

  // Initialisation des systèmes par défaut
  homeDatabase.systems = [
    { id: "electricite", name: "Électricité", icon: "⚡", status: "À jour", color: "green", equipment: 0 },
    { id: "eau", name: "Eau & Plomberie", icon: "💧", status: "À jour", color: "green", equipment: 0 },
    { id: "chauffage", name: "Chauffage", icon: "🔥", status: "À jour", color: "green", equipment: 0 },
    { id: "climatisation", name: "Climatisation", icon: "❄️", status: "À jour", color: "green", equipment: 0 },
    { id: "piscine", name: "Piscine", icon: "🏊", status: "À configurer", color: "orange", equipment: 0 },
    { id: "exterieur", name: "Extérieur", icon: "🌳", status: "À jour", color: "green", equipment: 0 }
  ];

  homeDatabase.systems.forEach(sys => {
    homeDatabase.details[sys.id] = { name: sys.name, icon: sys.icon, equipment: [], documents: [] };
  });

  res.json({ ok: true });
});

// Récupérer les données pour l'interface
app.get("/api/home", (req, res) => {
  if (!homeDatabase.isSetup) {
    return res.status(403).json({ error: "Non configuré" });
  }

  const role = req.query.role || "owner";
  let filteredSystems = homeDatabase.systems;

  if (role === "electricien") filteredSystems = homeDatabase.systems.filter(s => s.id === "electricite");
  else if (role === "pisciniste") filteredSystems = homeDatabase.systems.filter(s => s.id === "piscine");
  else if (role === "clim") filteredSystems = homeDatabase.systems.filter(s => s.id === "climatisation");

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

// Récupération des détails d'un système
app.get("/api/systems/:id", (req, res) => {
  const system = homeDatabase.details[req.params.id];
  if (!system) return res.status(404).json({ error: "Système introuvable" });
  res.json(system);
});

// Ajout d'un équipement
app.post("/api/equipment", (req, res) => {
  const { systemId, name, model } = req.body;
  if (!systemId || !name || !homeDatabase.details[systemId]) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const newEquip = { name, model: model || "", installed: "Aujourd'hui" };
  homeDatabase.details[systemId].equipment.push(newEquip);

  const sysCard = homeDatabase.systems.find(s => s.id === systemId);
  if (sysCard) sysCard.equipment = homeDatabase.details[systemId].equipment.length;

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
