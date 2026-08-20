let homeData = null;

async function init() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "";

    const response = await fetch(`/api/home?role=${roleParam}`);
    
    if (!response.ok) {
      window.location.reload(); // Redirection automatique via serveur si pas configuré
      return;
    }

    homeData = await response.json();

    updateUserBadge(homeData.role);
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();

  } catch (error) {
    console.error(error);
  }
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
  else if (role === "clim") label.textContent = "Accès Climatisation";
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
      </div>
    `;
  }).join("");
}

function displayAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;
  if (!homeData.alerts || homeData.alerts.length === 0) {
    container.innerHTML = "<p style='color:#77827a; font-size:13px;'>Aucun rappel d'entretien de prévu.</p>";
    return;
  }
  container.innerHTML = homeData.alerts.map(alert => `
    <div class="alert">
      <span class="date">${alert.date}</span>
      <strong>${alert.title}</strong>
      <p>${alert.text}</p>
    </div>
  `).join("");
}

function displayProfessionals() {
  const container = document.getElementById("professionals");
  if (!container) return;
  if (!homeData.professionals || homeData.professionals.length === 0) {
    container.innerHTML = "<p style='color:#77827a; font-size:13px;'>Aucun accès professionnel actif.</p>";
    return;
  }
  container.innerHTML = homeData.professionals.map(pro => `
    <div class="pro">
      <span class="access-active">${pro.access}</span>
      <strong>${pro.name}</strong>
      <p>${pro.domain} · accès jusqu'au ${pro.expires}</p>
    </div>
  `).join("");
}

// ==========================================
// AFFICHAGE PROFOND DES ÉQUIPEMENTS
// ==========================================
async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${systemId}`);
    const system = await response.json();

    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        // Rendu des caractéristiques poussées (specs)
        let specsHTML = "";
        if (item.specs && Object.keys(item.specs).length > 0) {
          specsHTML = `<div class="specs-grid">` + 
            Object.entries(item.specs).filter(([k,v]) => v).map(([key, value]) => `
              <div class="spec-tag"><strong>${key}</strong>: ${value}</div>
            `).join("") + 
          `</div>`;
        }

        return `
          <div class="equipment-deep">
            <div class="equip-header">
              <strong>${item.name}</strong>
              <span class="equip-model">${item.model ? item.model : "Modèle non précisé"}</span>
            </div>
            ${specsHTML}
            <div class="equip-footer">Installé le : ${item.installed}</div>
          </div>
        `;
      }).join("");
    } else {
      equipmentHTML = `
        <div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;">
          <p style='color:#707a74; font-size:13px; margin:0 0 10px 0;'>Aucun équipement enregistré.</p>
        </div>
      `;
    }

    const modalContent = document.getElementById("modal-content");
    modalContent.innerHTML = `
      <div class="eyebrow">${system.icon} SYSTÈME</div>
      <h2>${system.name}</h2>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-bottom:1px solid #e3e8e4; padding-bottom:10px;">
        <h3 style="margin:0;">Équipements de pointe</h3>
        <button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${systemId}')">+ Ajouter</button>
      </div>
      <div style="margin-top:15px;">
        ${equipmentHTML}
      </div>
    `;
    openModal();
  } catch (error) {
    showMessage("Impossible d'ouvrir ce système.");
  }
}

// ==========================================
// MENU 3 OPTIONS RESTAURÉ
// ==========================================
function openAddMenu() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddEquipmentModal()">
        ➕ <strong>Un équipement détaillé</strong><br>
        <small style="color:#6d7771;">Moteur, filtre, PAC, caractéristiques techniques...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddAlertModal()">
        📅 <strong>Un entretien ou un rappel</strong><br>
        <small style="color:#6d7771;">Programmer un hivernage, un ramonage...</small>
      </button>
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openImportModal()">
        📄 <strong>Un document ou une notice</strong><br>
        <small style="color:#6d7771;">PDF, facture, schéma électrique...</small>
      </button>
    </div>
  `;
  openModal();
}

// ==========================================
// FORMULAIRE DYNAMIQUE PROFOND
// ==========================================
function openAddEquipmentModal(preselectedSystem = "") {
  const modalContent = document.getElementById("modal-content");
  const systemOptions = homeData.systems.map(sys => {
    const selected = sys.id === preselectedSystem ? "selected" : "";
    return `<option value="${sys.id}" ${selected}>${sys.name}</option>`;
  }).join("");

  modalContent.innerHTML = `
    <div class="eyebrow">EXPERT</div>
    <h2>Configuration de l'équipement</h2>
    <form onsubmit="submitEquipment(event)" style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
      
      <div style="background:#f8f9f7; padding:15px; border-radius:12px; border:1px solid #e3e8e4;">
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Système concerné</label>
        <select id="form-sys-id" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;" onchange="renderDynamicFields()">
          <option value="" disabled selected>-- Choisissez un système --</option>
          ${systemOptions}
        </select>
      </div>

      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Nom de l'appareil *</label>
        <input type="text" id="form-name" placeholder="ex: Pompe de filtration" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
      
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Marque / Modèle</label>
        <input type="text" id="form-model" placeholder="ex: Hayward Super Pump" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>

      <!-- CONTENEUR DES CHAMPS SPÉCIFIQUES -->
      <div id="dynamic-fields-container" style="display:flex; flex-direction:column; gap:10px;"></div>

      <button type="submit" class="button primary" style="margin-top:10px;">Enregistrer l'équipement complet</button>
    </form>
  `;
  openModal();
  
  // Si on a préselectionné via le bouton dans la modale système, on affiche les champs de suite
  if(preselectedSystem) {
    document.getElementById('form-sys-id').value = preselectedSystem;
    renderDynamicFields();
  }
}

function renderDynamicFields() {
  const sysId = document.getElementById("form-sys-id").value;
  const container = document.getElementById("dynamic-fields-container");
  let html = "";

  if (sysId === "piscine") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:10px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Caractéristiques Bassin & Filtration</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <input type="text" id="spec-volume" placeholder="Volume (ex: 45m3)" class="spec-input">
          <select id="spec-traitement" class="spec-input">
            <option value="">-- Traitement --</option>
            <option value="Sel (Électrolyseur)">Au Sel</option>
            <option value="Chlore (Galets)">Chlore</option>
            <option value="Brome">Brome</option>
          </select>
          <select id="spec-filtre" class="spec-input">
            <option value="">-- Type Filtre --</option>
            <option value="Sable">Sable / Verre</option>
            <option value="Cartouche">Cartouche</option>
          </select>
          <input type="text" id="spec-media" placeholder="Réf Média (ex: Verre 150kg)" class="spec-input">
        </div>
      </div>
    `;
  } else if (sysId === "chauffage") {
    html = `
      <div style="border-left: 3px solid #d18a35; padding-left: 10px; margin-top:10px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#d18a35;">Caractéristiques Thermiques</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select id="spec-energie" class="spec-input">
            <option value="">-- Énergie --</option>
            <option value="Gaz de ville">Gaz de ville</option>
            <option value="Électrique (PAC)">Électrique (PAC)</option>
            <option value="Granulés/Bois">Bois / Granulés</option>
          </select>
          <input type="text" id="spec-puissance" placeholder="Puissance (ex: 12 kW)" class="spec-input">
        </div>
      </div>
    `;
  } else if (sysId === "electricite") {
    html = `
      <div style="border-left: 3px solid #a24b4b; padding-left: 10px; margin-top:10px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#a24b4b;">Caractéristiques Réseau</h4>
        <input type="text" id="spec-puissance-compteur" placeholder="Puissance souscrite (ex: 9 kVA - Monophasé)" class="spec-input" style="width:100%;">
      </div>
    `;
  }

  container.innerHTML = html;
}

async function submitEquipment(event) {
  event.preventDefault();
  
  // Collecte des champs standards
  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: document.getElementById("form-model").value,
    specs: {}
  };

  // Collecte des champs dynamiques spécifiques
  if (payload.systemId === "piscine") {
    payload.specs["Volume"] = document.getElementById("spec-volume")?.value;
    payload.specs["Traitement"] = document.getElementById("spec-traitement")?.value;
    payload.specs["Filtre"] = document.getElementById("spec-filtre")?.value;
    payload.specs["Charge Filtrante"] = document.getElementById("spec-media")?.value;
  } else if (payload.systemId === "chauffage") {
    payload.specs["Énergie"] = document.getElementById("spec-energie")?.value;
    payload.specs["Puissance"] = document.getElementById("spec-puissance")?.value;
  } else if (payload.systemId === "electricite") {
    payload.specs["Abonnement"] = document.getElementById("spec-puissance-compteur")?.value;
  }

  try {
    const response = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      closeModal();
      showMessage("Équipement expert sauvegardé !");
      init();
    }
  } catch (error) {
    showMessage("Erreur réseau.");
  }
}

// === ALERTES & DOCUMENTS ===

function openAddAlertModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">NOUVEAU RAPPEL</div>
    <h2>Programmer un entretien</h2>
    <form onsubmit="submitAlert(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <input type="text" id="alert-title" placeholder="Titre (ex: Filtre Sable)" required style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      <input type="text" id="alert-text" placeholder="Action (ex: Faire un lavage à contre-courant)" required style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      <input type="text" id="alert-date" placeholder="Date (ex: 15/06/2026)" required style="padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      <button type="submit" class="button primary">Programmer</button>
    </form>
  `;
  openModal();
}

async function submitAlert(event) {
  event.preventDefault();
  const payload = {
    title: document.getElementById("alert-title").value,
    text: document.getElementById("alert-text").value,
    date: document.getElementById("alert-date").value
  };
  await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  closeModal();
  showMessage("Entretien programmé !");
  init();
}

function openImportModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">BIBLIOTHÈQUE</div>
    <h2>Importer un document</h2>
    <div style="border:2px dashed #cdd4ce; border-radius:16px; padding:30px; text-align:center; background:#f8f9f7; margin-top:15px;">
      <div style="font-size:36px; margin-bottom:10px;">📄</div>
      <strong>Glissez votre fichier PDF ici</strong><br>
      <small style="color:#7c867f;">Facture, notice technique, schéma unifilaire...</small>
      <br><br>
      <button class="button primary" onclick="showMessage('Fichier enregistré dans la bibliothèque.'); closeModal();">Parcourir les fichiers</button>
    </div>
  `;
  openModal();
}

function openQrSimulatorModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">TEST SIMULATION QR CODE</div>
    <h2>Scanner en tant que...</h2>
    <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
      <a href="/" class="button secondary" style="text-decoration:none; text-align:center;">👤 Propriétaire</a>
      <a href="/?role=pisciniste" class="button secondary" style="text-decoration:none; text-align:center;">🏊 Pisciniste (Vue Restreinte)</a>
    </div>
  `;
  openModal();
}

function openPlan() { showMessage("Plan interactif à venir."); }
function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }

document.addEventListener("click", function(event) {
  if (event.target === document.getElementById("modal")) closeModal();
});

function showMessage(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

init();
