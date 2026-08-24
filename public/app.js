let homeData = null;

async function init() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "";
    const response = await fetch(`/api/home?role=${roleParam}`);
    
    if (!response.ok) { throw new Error("Mode hors-ligne"); }
    
    homeData = await response.json();
    updateUserBadge(homeData.role);
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();
  } catch (error) { 
    console.warn("API non disponible, utilisation de données simulées.");
    // Simulation si pas de backend
    homeData = {
      name: "Ma Maison", id: "001", year: "2020", surface: "120", land: "500", role: "",
      systems: [
        { id: "chauffage", name: "Chauffage", icon: "🔥", status: "Actif", color: "green", equipment: 0 }
      ],
      alerts: [],
      professionals: [{ name: "Plomberie Dupont", domain: "Plombier", access: "Actif", expires: "12/12/2026" }]
    };
    populateHouseInfo(); displaySystems(); displayProfessionals();
  }
}

function populateHouseInfo() {
  document.getElementById("display-house-name").textContent = homeData.name || "Maison par défaut";
  document.getElementById("display-house-id").textContent = `Maison #${homeData.id || '000'}`;
  document.getElementById("display-house-year").textContent = homeData.year || "—";
  document.getElementById("display-house-surface").textContent = homeData.surface ? `${homeData.surface} m²` : "—";
  document.getElementById("display-house-land").textContent = homeData.land ? `${homeData.land} m²` : "—";
}

function updateUserBadge(role) {
  const label = document.getElementById("user-role-label");
  if (role === "electricien") label.textContent = "Accès Électricien";
  else if (role === "pisciniste") label.textContent = "Accès Pisciniste";
  else if (role === "clim") label.textContent = "Accès Clim/Chauffage";
  else label.textContent = "Propriétaire";
}

function displaySystems() {
  const container = document.getElementById("systems");
  if (!container) return;
  if (!homeData.systems || homeData.systems.length === 0) {
    container.innerHTML = "<p style='grid-column:1/-1; color:#77827a;'>Aucun système accessible.</p>";
    return;
  }
  container.innerHTML = homeData.systems.map(system => {
    const equipCount = system.equipment > 0 
      ? `<div style="font-size:11px; color:#77827a; margin-top:4px;">${system.equipment} équipement(s)</div>` 
      : `<div style="font-size:11px; color:#a26b28; margin-top:4px;">Vide</div>`;
    return `
      <div class="system" onclick="openSystem('${system.id}')">
        <div class="system-icon">${system.icon}</div>
        <div class="system-name">${system.name}</div>
        <div class="status ${system.color}"><span class="dot"></span>${system.status}</div>
        ${equipCount}
      </div>`;
  }).join("");
}

function displayAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;
  if (!homeData.alerts || homeData.alerts.length === 0) {
    container.innerHTML = "<p style='color:#77827a; font-size:13px;'>Aucun rappel de prévu.</p>";
    return;
  }
  container.innerHTML = homeData.alerts.map(alert => `
    <div class="alert"><span class="date">${alert.date}</span><strong>${alert.title}</strong><p>${alert.text}</p></div>
  `).join("");
}

// MODIFICATION : Séparation des artisans (Maison vs Google)
function displayProfessionals() {
  const container = document.getElementById("professionals");
  if (!container) return;
  
  let html = "";

  // 1. Artisans de la maison (ceux qui ont un accès ou ajoutés via équipement)
  html += `<div class="pro-section-title">🏠 Intervenus dans la maison</div>`;
  if (!homeData.professionals || homeData.professionals.length === 0) {
    html += "<p style='color:#77827a; font-size:13px; margin-bottom:15px;'>Aucun artisan enregistré.</p>";
  } else {
    html += homeData.professionals.map(pro => `
      <div class="pro" style="margin-bottom:10px;">
        <span class="access-active" style="float:right; font-size:10px; background:#e6f4ea; color:#1e8e3e; padding:2px 6px; border-radius:4px;">Intervenu</span>
        <strong>${pro.name}</strong><p style="margin:2px 0 0 0; color:#555; font-size:12px;">${pro.domain}</p>
      </div>
    `).join("");
  }

  // 2. Recommandations Google (Simulées pour l'exemple d'après la notation)
  html += `<div class="pro-section-title">⭐ Recommandés près de chez vous (Google)</div>`;
  const googlePros = [
    { name: "Élec Express 75", domain: "Électricien", rating: "4.8/5 (124 avis)" },
    { name: "Chauffe-Eau Pro", domain: "Plombier / Chauffagiste", rating: "4.6/5 (89 avis)" }
  ];
  
  html += googlePros.map(pro => `
    <div class="pro" style="margin-bottom:10px; border-left: 3px solid #fbbc04;">
      <span style="float:right; font-size:12px; font-weight:bold; color:#f9ab00;">${pro.rating}</span>
      <strong>${pro.name}</strong><p style="margin:2px 0 0 0; color:#555; font-size:12px;">${pro.domain}</p>
    </div>
  `).join("");

  container.innerHTML = html;
}

async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${systemId}`);
    if (!response.ok) throw new Error();
    const system = await response.json();
    renderSystemDetails(system, systemId);
  } catch (error) { 
    // Simulation si erreur réseau
    const dummySystem = { name: "Système", icon: "⚙️", equipment: [] };
    renderSystemDetails(dummySystem, systemId);
  }
}

function renderSystemDetails(system, systemId) {
    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        let specsHTML = "";
        if (item.specs && Object.keys(item.specs).length > 0) {
          specsHTML = `<div class="specs-grid">` + 
            Object.entries(item.specs).filter(([k,v]) => v).map(([key, value]) => `
              <div class="spec-tag"><strong>${key}</strong>: ${value}</div>
            `).join("") + `</div>`;
        }
        return `
          <div class="equipment-deep">
            <div class="equip-header">
              <strong>${item.name}</strong>
              <span class="equip-model">${item.model ? item.model : "Modèle non précisé"}</span>
            </div>
            ${specsHTML}
            <div class="equip-footer" style="display:flex; justify-content:space-between;">
              <span>Enregistré le : ${item.installed || 'Aujourd\'hui'}</span>
              ${item.notice ? `<span style="color:#2a7049; cursor:pointer;" onclick="showMessage('Ouverture PDF : ${item.notice}')">📄 Voir Notice</span>` : ''}
            </div>
          </div>`;
      }).join("");
    } else {
      equipmentHTML = `<div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;"><p style='color:#707a74; font-size:13px; margin:0 0 10px 0;'>Aucun équipement enregistré.</p></div>`;
    }

    document.getElementById("modal-content").innerHTML = `
      <div class="eyebrow">${system.icon} SYSTÈME</div>
      <h2>${system.name}</h2>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-bottom:1px solid #e3e8e4; padding-bottom:10px;">
        <h3 style="margin:0;">Équipements de pointe</h3>
        <button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${systemId}')">+ Ajouter</button>
      </div>
      <div style="margin-top:15px;">${equipmentHTML}</div>`;
    openModal();
}

function openAddMenu() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddEquipmentModal()">
        ➕ <strong>Un équipement / Appareil</strong><br><small style="color:#6d7771;">Portail, Pompe, Box Internet, Compteur...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddAlertModal()">
        📅 <strong>Un entretien ou rappel</strong><br><small style="color:#6d7771;">Ramonage, vidange, remplacement filtre...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openImportModal()">
        📄 <strong>Un document</strong><br><small style="color:#6d7771;">Facture, notice, garantie PDF...</small>
      </button>
    </div>`;
  openModal();
}

function openAddEquipmentModal(preselectedSystem = "") {
  const systemOptions = (homeData.systems || []).map(sys => `<option value="${sys.id}" ${sys.id === preselectedSystem ? "selected" : ""}>${sys.name}</option>`).join("");
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">EXPERT</div>
    <h2>Ajouter un équipement</h2>
    <form onsubmit="submitEquipment(event)" style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
      <div style="background:#f8f9f7; padding:15px; border-radius:12px; border:1px solid #e3e8e4;">
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Dans quelle catégorie ?</label>
        <select id="form-sys-id" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;" onchange="renderDynamicFields()">
          <option value="" disabled selected>-- Choisissez une catégorie --</option>
          ${systemOptions}
        </select>
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Nom de l'appareil *</label>
        <input type="text" id="form-name" placeholder="ex: Moteur portail, Box Fibre, Adoucisseur..." required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Marque / Modèle</label>
        <input type="text" id="form-model" placeholder="ex: Somfy Evolvia, Freebox Pop, Culligan..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
      
      <!-- NOUVEAU CHAMP : Artisan -->
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Artisan installateur (Optionnel)</label>
        <input type="text" id="form-artisan" placeholder="Nom de l'entreprise..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>

      <div id="dynamic-fields-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button type="submit" class="button primary" style="margin-top:10px;">Sauvegarder l'appareil</button>
    </form>`;
  openModal();
  if(preselectedSystem) renderDynamicFields();
}

// Fonction préservée à 100%
function renderDynamicFields() {
  const sysId = document.getElementById("form-sys-id").value;
  const container = document.getElementById("dynamic-fields-container");
  let html = "";

  if (sysId === "piscine") {
    html = `
      <div style="border-left: 3px solid #d18a35; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#d18a35;">Fiche Technique Bassin</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <input type="text" data-key="Volume" placeholder="Volume (ex: 45m3)" class="spec-input">
          <select data-key="Traitement" class="spec-input">
            <option value="">-- Traitement --</option><option value="Électrolyse (Sel)">Au Sel</option><option value="Chlore">Chlore</option><option value="Brome/Oxygène">Brome / UV</option>
          </select>
          <select data-key="Filtre" class="spec-input">
            <option value="">-- Type Filtre --</option><option value="Sable/Verre">Sable / Verre</option><option value="Cartouche">Cartouche</option>
          </select>
          <input type="text" data-key="Charge filtrante" placeholder="Média (ex: Verre 150kg)" class="spec-input">
        </div>
      </div>`;
  } else if (sysId === "chauffage") {
    html = `
      <div style="border-left: 3px solid #d18a35; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#d18a35;">Caractéristiques Thermiques</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Énergie" class="spec-input">
            <option value="">-- Énergie --</option><option value="Gaz de ville">Gaz de ville</option><option value="Électrique (PAC)">PAC / Électrique</option><option value="Bois/Granulés">Bois / Granulés</option><option value="Fioul">Fioul</option>
          </select>
          <input type="text" data-key="Puissance" placeholder="Puissance (ex: 12 kW)" class="spec-input">
          <select data-key="Diffusion" class="spec-input">
            <option value="">-- Diffusion --</option><option value="Plancher chauffant">Plancher chauffant</option><option value="Radiateurs">Radiateurs</option><option value="Air pulsé (Gainable)">Air pulsé</option>
          </select>
          <input type="text" data-key="Entretien annuel" placeholder="Mois d'entretien (ex: Octobre)" class="spec-input">
        </div>
      </div>`;
  } else if (sysId === "electricite") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Tableau & Réseau</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Type d'abonnement" class="spec-input">
            <option value="">-- Phase --</option><option value="Monophasé">Monophasé</option><option value="Triphasé">Triphasé</option>
          </select>
          <select data-key="Puissance Souscrite" class="spec-input">
            <option value="">-- Puissance --</option><option value="6 kVA">6 kVA</option><option value="9 kVA">9 kVA</option><option value="12 kVA">12 kVA</option><option value="36 kVA">36 kVA</option>
          </select>
          <select data-key="Type Compteur" class="spec-input">
            <option value="">-- Compteur --</option><option value="Linky">Linky</option><option value="Électronique ancien">Électronique</option>
          </select>
          <input type="text" data-key="PDL / PRM" placeholder="N° PDL (14 chiffres)" class="spec-input">
        </div>
      </div>`;
  } else if (sysId === "eau") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Plomberie & Traitement</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Type d'équipement" class="spec-input">
            <option value="">-- Type --</option><option value="Chauffe-eau (Cumulus)">Cumulus</option><option value="Chauffe-eau Thermodynamique">Thermodynamique</option><option value="Adoucisseur">Adoucisseur</option><option value="Surpresseur">Surpresseur</option>
          </select>
          <input type="text" data-key="Capacité / Volume" placeholder="Capacité (ex: 200L)" class="spec-input">
          <input type="text" data-key="Consommable" placeholder="Consommable (ex: Sel pastilles)" class="spec-input" style="grid-column: 1 / -1;">
        </div>
      </div>`;
  } else if (sysId === "climatisation") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Génie Climatique</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Type d'installation" class="spec-input">
            <option value="">-- Type --</option><option value="Split mural">Split mural</option><option value="Gainable">Gainable</option><option value="VMC Double Flux">VMC Double Flux</option>
          </select>
          <select data-key="Gaz réfrigérant" class="spec-input">
            <option value="">-- Gaz --</option><option value="R32">R32</option><option value="R410A">R410A</option><option value="R290">R290</option>
          </select>
          <select data-key="Fonction Réversible" class="spec-input">
            <option value="">-- Réversible --</option><option value="Oui">Oui (Chaud/Froid)</option><option value="Non">Non</option>
          </select>
        </div>
      </div>`;
  } else if (sysId === "exterieur") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Aménagement & Motorisation</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Installation" class="spec-input">
            <option value="">-- Type --</option><option value="Portail motorisé">Portail motorisé</option><option value="Porte de garage">Porte de garage</option><option value="Arrosage auto">Arrosage automatique</option><option value="Store Banne">Store Banne</option>
          </select>
          <select data-key="Alimentation" class="spec-input">
            <option value="">-- Énergie --</option><option value="Sur Secteur 230V">Secteur 230V</option><option value="Solaire / Batterie">Solaire / Batterie</option>
          </select>
          <input type="text" data-key="Mécanisme" placeholder="Méca (ex: Vérin, Bras...)" class="spec-input" style="grid-column: 1 / -1;">
        </div>
      </div>`;
  } else if (sysId === "domotique") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Technologie, Réseau & Alarme</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Catégorie" class="spec-input">
            <option value="">-- Catégorie --</option><option value="Box Internet / Routeur">Box Internet</option><option value="Centrale Alarme">Alarme</option><option value="Caméra Sécurité">Caméra</option><option value="Box Domotique">Serveur Domotique</option>
          </select>
          <select data-key="Protocole Radio" class="spec-input">
            <option value="">-- Protocole --</option><option value="Wi-Fi">Wi-Fi</option><option value="Zigbee">Zigbee</option><option value="Z-Wave">Z-Wave</option><option value="RTS / io-homecontrol">RTS / IO</option><option value="Filaire (RJ45)">Filaire</option>
          </select>
          <select data-key="Batterie de secours" class="spec-input">
            <option value="">-- Secours --</option><option value="Onduleur / Batterie intégrée">Oui (Batterie)</option><option value="Aucun">Non</option>
          </select>
          <input type="text" data-key="Connectivité" placeholder="Réseau (ex: Fibre, 4G, ADSL)" class="spec-input">
        </div>
      </div>`;
  }
  container.innerHTML = html;
}

async function submitEquipment(event) {
  event.preventDefault();
  
  const model = document.getElementById("form-model").value;
  const artisan = document.getElementById("form-artisan").value;
  
  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: model,
    artisan: artisan,
    notice: model ? `Notice_${model.replace(/\s+/g, '_')}.pdf` : null, // Génération auto de la notice
    specs: {}
  };

  const specInputs = document.querySelectorAll('.spec-input');
  specInputs.forEach(input => {
    if (input.value) {
      payload.specs[input.getAttribute('data-key')] = input.value;
    }
  });

  try {
    const response = await fetch("/api/equipment", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (response.ok) {
      closeModal(); 
      showMessage(`Appareil sauvegardé. Notice liée : ${payload.notice || 'Aucune'}`); 
      init();
    } else {
      throw new Error("Pas de backend");
    }
  } catch (error) { 
    // FALLBACK : Mode Démo (Très important pour que ça marche chez vous sans serveur)
    closeModal(); 
    let msg = `(Simulation) Équipement sauvegardé !`;
    if (payload.notice) {
        msg += ` 📄 Notice générée automatiquement : ${payload.notice}.`;
        document.getElementById("doc-notices").textContent = "1 fichier(s)";
    }
    if (payload.artisan) {
        msg += ` 🧑‍🔧 Artisan ${payload.artisan} ajouté.`;
    }
    showMessage(msg); 
    console.log("Payload envoyé :", payload);
  }
}

function openAddAlertModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">NOUVEAU RAPPEL</div>
    <h2>Programmer un entretien</h2>
    <form onsubmit="submitAlert(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="alert-title" placeholder="Titre (ex: Adoucisseur, Portail...)" required style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      <input type="text" id="alert-text" placeholder="Action (ex: Changer la cartouche, graisser l'axe)" required style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      <input type="text" id="alert-date" placeholder="Date limite (ex: 15/06/2026)" required style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      <button type="submit" class="button primary">Programmer</button>
    </form>`;
  openModal();
}

async function submitAlert(event) {
  event.preventDefault();
  const payload = { title: document.getElementById("alert-title").value, text: document.getElementById("alert-text").value, date: document.getElementById("alert-date").value };
  try {
    const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if(!res.ok) throw new Error();
    closeModal(); showMessage("Entretien programmé !"); init();
  } catch (e) {
    closeModal(); showMessage("(Simulation) Entretien programmé !");
  }
}

function openImportModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">BIBLIOTHÈQUE</div>
    <h2>Importer un document</h2>
    <div style="border:2px dashed #cdd4ce; border-radius:16px; padding:30px; text-align:center; background:#f8f9f7; margin-top:15px;">
      <div style="font-size:36px; margin-bottom:10px;">📄</div>
      <strong>Glissez votre fichier PDF ici</strong><br>
      <small style="color:#7c867f;">Facture, notice technique, plan...</small><br><br>
      <button class="button primary" onclick="showMessage('Fichier ajouté.'); closeModal();">Parcourir les fichiers</button>
    </div>`;
  openModal();
}

function openQrSimulatorModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">TEST SIMULATION QR CODE</div>
    <h2>Scanner en tant que...</h2>
    <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
      <a href="/" class="button secondary" style="text-decoration:none; text-align:center;">👤 Propriétaire</a>
      <a href="/?role=electricien" class="button secondary" style="text-decoration:none; text-align:center;">⚡ Artisan Réseau/Élec (Vue Restreinte)</a>
    </div>`;
  openModal();
}

// -----------------------------------------------------
// NOUVELLES FONCTIONNALITÉS
// -----------------------------------------------------

// 1. Profil Propriétaire (Maintenant fonctionnel)
function openProfileModal() {
  const currentName = document.getElementById("user-role-label").textContent;
  const content = `
    <div class="eyebrow">COMPTE</div>
    <h2>Mon Profil</h2>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
        <input type="text" id="owner-name" value="${currentName === 'Propriétaire' ? '' : currentName}" placeholder="Votre nom complet" style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;"/>
        <input type="email" id="owner-email" placeholder="Adresse email" style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;"/>
        <button class="button primary" onclick="saveProfile()">Enregistrer les modifications</button>
    </div>
  `;
  document.getElementById('modal-content').innerHTML = content;
  openModal();
}

function saveProfile() {
  const newName = document.getElementById("owner-name").value;
  if (newName.trim() !== "") {
      document.getElementById("user-role-label").textContent = newName;
      showMessage("Profil mis à jour avec succès !");
      closeModal();
  }
}

// 2. Upload de Plan (Avec mise à jour visuelle)
function openPlan() {
  document.getElementById('plan-upload').click();
}

function handlePlanUpload(event) {
  const file = event.target.files[0];
  if(file) {
    // Modifier le bouton visuellement
    const btn = document.getElementById('btn-plan');
    btn.textContent = "✅ Plan : " + file.name;
    btn.style.backgroundColor = "#1e8e3e"; // Vert Google
    btn.style.color = "white";
    btn.style.borderColor = "#1e8e3e";
    
    // Mettre à jour le compteur de documents
    document.getElementById('doc-plans').textContent = "1 fichier(s)";
    
    showMessage(`Plan ${file.name} ajouté avec succès !`);
  }
}

// -----------------------------------------------------
// UTILITAIRES DE BASE
// -----------------------------------------------------
function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
document.addEventListener("click", function(event) { if (event.target === document.getElementById("modal")) closeModal(); });
function showMessage(message) {
  const toast = document.getElementById("toast"); 
  toast.textContent = message; 
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500); // Temps un peu plus long pour lire les infos (notice, artisan)
}

// Démarrage de l'application
init();
