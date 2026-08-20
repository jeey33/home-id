const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Fonction pour générer une base de données vierge
function getInitialDatabase() {
  return {
    isSetup: false, // Détermine si la maison a été configurée ou non
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
}

let homeDatabase = getInitialDatabase();

// Récupération de l'état de la maison
app.get("/api/home", (req, res) => {
  const role = req.query.role || "owner";

  // Si la maison n'est pas configurée, on renvoie juste l'état
  if (!homeDatabase.isSetup) {
    return res.json({ isSetup: false });
  }

  let filteredSystems = homeDatabase.systems;

  // Filtrage par rôle (Pro)
  if (role === "electricien") filteredSystems = homeDatabase.systems.filter(s => s.id === "electricite");
  else if (role === "pisciniste") filteredSystems = homeDatabase.systems.filter(s => s.id === "piscine");
  else if (role === "clim") filteredSystems = homeDatabase.systems.filter(s => s.id === "climatisation");

  res.json({
    isSetup: true,
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

// Route pour configurer la maison pour la première fois
app.post("/api/setup", (req, res) => {
  const { name, year, surface, land } = req.body;

  if (!name || !year) {
    return res.status(400).json({ error: "Le nom et l'année sont obligatoires." });
  }

  homeDatabase.isSetup = true;
  homeDatabase.name = name;
  homeDatabase.year = parseInt(year);
  homeDatabase.surface = parseInt(surface) || 0;
  homeDatabase.land = parseInt(land) || 0;

  // Création des catégories standards vides
  homeDatabase.systems = [
    { id: "electricite", name: "Électricité", icon: "⚡", status: "À jour", color: "green", equipment: 0 },
    { id: "eau", name: "Eau & Plomberie", icon: "💧", status: "À jour", color: "green", equipment: 0 },
    { id: "chauffage", name: "Chauffage", icon: "🔥", status: "À jour", color: "green", equipment: 0 },
    { id: "climatisation", name: "Climatisation", icon: "❄️", status: "À jour", color: "green", equipment: 0 },
    { id: "piscine", name: "Piscine", icon: "🏊", status: "À configurer", color: "orange", equipment: 0 },
    { id: "exterieur", name: "Extérieur", icon: "🌳", status: "À jour", color: "green", equipment: 0 }
  ];

  // Initialisation des détails vides
  homeDatabase.systems.forEach(sys => {
    homeDatabase.details[sys.id] = {
      name: sys.name,
      icon: sys.icon,
      equipment: [],
      documents: []
    };
  });

  res.json({ ok: true });
});

// Récupération d'un système
app.get("/api/systems/:id", (req, res) => {
  const system = homeDatabase.details[req.params.id];
  if (!system) return res.status(404).json({ error: "Système introuvable" });
  res.json(system);
});

// Ajout d'équipement (modifié pour gérer l'incrémentation propre)
app.post("/api/equipment", (req, res) => {
  const { systemId, name, model, installed, warranty } = req.body;

  if (!systemId || !name || !homeDatabase.details[systemId]) {
    return res.status(400).json({ error: "Données invalides" });
  }

  const newEquip = { name, model: model || "", installed: installed || "", warranty: warranty || "" };
  homeDatabase.details[systemId].equipment.push(newEquip);

  const sysCard = homeDatabase.systems.find(s => s.id === systemId);
  if (sysCard) sysCard.equipment = homeDatabase.details[systemId].equipment.length;

  res.json({ ok: true });
});

// Route pour réinitialiser la démo (utile pour tes tests)
app.post("/api/reset", (req, res) => {
  homeDatabase = getInitialDatabase();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`HOME ID fonctionne sur le port ${PORT}`);
});
