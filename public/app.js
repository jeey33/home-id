let homeData = null;

async function init() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "";
    const response = await fetch(`/api/home?role=${roleParam}`);
    
    if (!response.ok) { window.location.reload(); return; }
    
    homeData = await response.json();
    updateUserBadge(homeData.role);
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();
  } catch (error) { console.error(error); }
}

function populateHouseInfo() {
  document.getElementById("display-house-name").textContent = homeData.name;
  document.getElementById("display-house-id").textContent = `Maison #${homeData.id}`;
  document.getElementById("display-house-year").textContent = homeData.year;
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
  if (homeData.systems.length === 0) {
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

function displayProfessionals() {
  const container = document.getElementById("professionals");
  if (!container) return;
  if (!homeData.professionals || homeData.professionals.length === 0) {
    container.innerHTML = "<p style='color:#77827a; font-size:13px;'>Aucun accès pro actif.</p>";
    return;
  }
  container.innerHTML = homeData.professionals.map(pro => `
    <div class="pro"><span class="access-active">${pro.access}</span><strong>${pro.name}</strong><p>${pro.domain} · accès jusqu'au ${pro.expires}</p></div>
  `).join("");
}

async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${systemId}`);
    const system = await response.json();
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
            <div class="equip-footer">Enregistré le : ${item.installed}</div>
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
  } catch (error) { showMessage("Erreur réseau"); }
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
  const systemOptions = homeData.systems.map(sys => `<option value="${sys.id}" ${sys.id === preselectedSystem ? "selected" : ""}>${sys.name}</option>`).join("");
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
      <div id="dynamic-fields-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button type="submit" class="button primary" style="margin-top:10px;">Sauvegarder l'appareil</button>
    </form>`;
  openModal();
  if(preselectedSystem) renderDynamicFields();
}

// LE GÉNÉRATEUR EXHAUSTIF DE CHAMPS (La vraie puissance de l'outil)
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

// SAUVEGARDE INTELLIGENTE : Collecte automatiquement tous les champs 'spec-input'
async function submitEquipment(event) {
  event.preventDefault();
  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: document.getElementById("form-model").value,
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
      closeModal(); showMessage("Équipement expert sauvegardé !"); init();
    }
  } catch (error) { showMessage("Erreur réseau."); }
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
  await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  closeModal(); showMessage("Entretien programmé !"); init();
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

function openPlan() { showMessage("Plan interactif à venir."); }
function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
document.addEventListener("click", function(event) { if (event.target === document.getElementById("modal")) closeModal(); });
function showMessage(message) {
  const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}
init();
