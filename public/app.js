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
    // Simulation : J'ai ajouté l'électricité et préparé les tableaux vides pour les équipements
    homeData = {
      name: "Ma Maison", id: "001", year: "2020", surface: "120", land: "500", role: "",
      systems: [
        { id: "electricite", name: "Électricité", icon: "⚡", status: "Actif", color: "green", equipment: [] },
        { id: "chauffage", name: "Chauffage", icon: "🔥", status: "Actif", color: "green", equipment: [] },
        { id: "eau", name: "Plomberie", icon: "💧", status: "Actif", color: "green", equipment: [] }
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
    // CORRECTION : On compte la longueur du tableau d'équipements
    const equipCount = system.equipment && system.equipment.length > 0 
      ? `<div style="font-size:11px; color:#77827a; margin-top:4px;">${system.equipment.length} équipement(s)</div>` 
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
  
  let html = "";
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
    // Simulation : On va chercher le système directement dans nos données locales
    const system = homeData.systems.find(s => s.id === systemId);
    if(system) {
        renderSystemDetails(system, systemId);
    }
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
      
      <!-- Optionnel : Un espace pour les données globales du système (ex: PDL Linky) pourrait venir ici -->

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-bottom:1px solid #e3e8e4; padding-bottom:10px;">
        <h3 style="margin:0;">Équipements du réseau</h3>
        <button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${systemId}')">+ Ajouter un appareil</button>
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
        ➕ <strong>Un équipement / Appareil</strong><br><small style="color:#6d7771;">Prise, Moteur Portail, Four, Pompe...</small>
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
        <input type="text" id="form-name" placeholder="ex: Four, Prise connectée, Disjoncteur..." required style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d; display:block; margin-bottom:5px;">Marque / Modèle</label>
        <input type="text" id="form-model" placeholder="ex: Bosch Série 6, Legrand Céliane..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cdd4ce;">
      </div>
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

function renderDynamicFields() {
  const sysId = document.getElementById("form-sys-id").value;
  const container = document.getElementById("dynamic-fields-container");
  let html = "";

  // CORRECTION : L'électricité demande désormais des infos sur l'appareil (et plus sur le compteur général)
  if (sysId === "electricite") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Informations de l'appareil</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <input type="text" data-key="Pièce / Emplacement" placeholder="ex: Cuisine, Salon" class="spec-input">
          <select data-key="Type d'appareil" class="spec-input">
            <option value="">-- Type --</option>
            <option value="Prise de courant">Prise de courant</option>
            <option value="Éclairage">Éclairage</option>
            <option value="Électroménager">Électroménager</option>
            <option value="Disjoncteur / Module">Module Tableau</option>
          </select>
          <input type="text" data-key="Protection (Ampères)" placeholder="ex: 16A, 32A" class="spec-input">
          <input type="text" data-key="Puissance Max" placeholder="ex: 2000W" class="spec-input">
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
  } else if (sysId === "eau") {
    html = `
      <div style="border-left: 3px solid #4b9b69; padding-left: 10px; margin-top:5px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#4b9b69;">Plomberie & Traitement</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <select data-key="Type d'équipement" class="spec-input">
            <option value="">-- Type --</option><option value="Chauffe-eau (Cumulus)">Cumulus</option><option value="Chauffe-eau Thermodynamique">Thermodynamique</option><option value="Adoucisseur">Adoucisseur</option><option value="Robinetterie">Robinetterie</option>
          </select>
          <input type="text" data-key="Emplacement" placeholder="ex: Salle de bain" class="spec-input">
        </div>
      </div>`;
  }
  // (Vous pouvez rajouter les autres if pour piscine, clim, etc. de la même façon)
  
  container.innerHTML = html;
}

async function submitEquipment(event) {
  event.preventDefault();
  
  const systemId = document.getElementById("form-sys-id").value;
  const model = document.getElementById("form-model").value;
  const artisan = document.getElementById("form-artisan").value;
  
  const payload = {
    systemId: systemId,
    name: document.getElementById("form-name").value,
    model: model,
    artisan: artisan,
    notice: model ? `Notice_${model.replace(/\s+/g, '_')}.pdf` : null,
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
    if (!response.ok) throw new Error("Pas de backend");
    closeModal(); showMessage(`Appareil sauvegardé !`); init();
  } catch (error) { 
    // CORRECTION : AJOUT LOCAL DANS LE TABLEAU
    const targetSystem = homeData.systems.find(s => s.id === systemId);
    if (targetSystem) {
        if (!targetSystem.equipment) targetSystem.equipment = [];
        
        // On pousse le nouvel appareil dans la donnée de la page
        targetSystem.equipment.push({
            name: payload.name,
            model: payload.model,
            installed: new Date().toLocaleDateString("fr-FR"),
            notice: payload.notice,
            specs: payload.specs
        });
        
        // Si un artisan est renseigné, on l'ajoute à la liste des professionnels
        if(payload.artisan) {
            homeData.professionals.push({
                name: payload.artisan,
                domain: "Installateur",
                access: "Inactif",
                expires: "N/A"
            });
        }
    }

    closeModal(); 
    let msg = `Équipement sauvegardé !`;
    if (payload.notice) {
        msg += ` Notice générée : ${payload.notice}.`;
        document.getElementById("doc-notices").textContent = "1 fichier(s)";
    }
    
    showMessage(msg); 
    
    // On met à jour l'affichage de l'accueil pour voir le compteur augmenter !
    displaySystems();
    displayProfessionals();
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
    homeData.alerts.push(payload);
    closeModal(); showMessage("Entretien programmé !"); displayAlerts();
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

function openPlan() {
  document.getElementById('plan-upload').click();
}

function handlePlanUpload(event) {
  const file = event.target.files[0];
  if(file) {
    const btn = document.getElementById('btn-plan');
    btn.textContent = "✅ Plan : " + file.name;
    btn.style.backgroundColor = "#1e8e3e"; 
    btn.style.color = "white";
    btn.style.borderColor = "#1e8e3e";
    document.getElementById('doc-plans').textContent = "1 fichier(s)";
    showMessage(`Plan ${file.name} ajouté avec succès !`);
  }
}

function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
document.addEventListener("click", function(event) { if (event.target === document.getElementById("modal")) closeModal(); });
function showMessage(message) {
  const toast = document.getElementById("toast"); 
  toast.textContent = message; 
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500); 
}

init();
