let homeData = null;

async function init() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get("role") || "";

    const response = await fetch(`/api/home?role=${roleParam}`);
    homeData = await response.json();

    const onboardingView = document.getElementById("onboarding-view");
    const dashboardView = document.getElementById("dashboard-view");
    const userBadge = document.getElementById("user-badge");

    // SI LA MAISON N'EST PAS CONFIGURÉE
    if (!homeData.isSetup) {
      onboardingView.classList.remove("hidden");
      dashboardView.classList.add("hidden");
      userBadge.style.display = "none";
      return;
    }

    // SI LA MAISON EST CONFIGURÉE
    onboardingView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    userBadge.style.display = "flex";

    // Mise à jour de l'UI
    updateUserBadge(homeData.role);
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();

  } catch (error) {
    console.error(error);
    showMessage("Erreur de connexion au serveur.");
  }
}

// === ONBOARDING (CRÉATION MAISON) ===

async function submitSetup(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById("setup-name").value,
    year: document.getElementById("setup-year").value,
    surface: document.getElementById("setup-surface").value,
    land: document.getElementById("setup-land").value
  };

  try {
    const response = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      showMessage("Maison configurée avec succès !");
      init(); // Recharge l'interface
    }
  } catch (error) {
    showMessage("Erreur lors de la création.");
  }
}

async function resetDemo() {
  if(confirm("Voulez-vous vraiment effacer la maison et recommencer ?")) {
    await fetch("/api/reset", { method: "POST" });
    window.location.href = "/";
  }
}

// === TABLEAU DE BORD ===

function populateHouseInfo() {
  document.getElementById("display-house-name").textContent = homeData.name;
  document.getElementById("display-house-id").textContent = `Maison #${homeData.id}`;
  document.getElementById("display-house-year").textContent = homeData.year;
  document.getElementById("display-house-surface").textContent = homeData.surface ? `${homeData.surface} m²` : "Non renseigné";
  document.getElementById("display-house-land").textContent = homeData.land ? `${homeData.land} m²` : "Non renseigné";
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
    container.innerHTML = "<p style='grid-column:1/-1; color:#77827a;'>Aucun système accessible pour cet accès.</p>";
    return;
  }

  container.innerHTML = homeData.systems.map(system => {
    // Affiche le nombre d'équipements
    const equipCount = system.equipment > 0 
      ? `<div style="font-size:11px; color:#77827a; margin-top:4px;">${system.equipment} équipement(s)</div>` 
      : `<div style="font-size:11px; color:#a26b28; margin-top:4px;">Vide</div>`;

    return `
      <div class="system" onclick="openSystem('${system.id}')">
        <div class="system-icon">${system.icon}</div>
        <div class="system-name">${system.name}</div>
        <div class="status ${system.color}">
          <span class="dot"></span>
          ${system.status}
        </div>
        ${equipCount}
      </div>
    `;
  }).join("");
}

function displayAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;
  
  if (!homeData.alerts || homeData.alerts.length === 0) {
    container.innerHTML = "<p style='color:#77827a; font-size:13px; padding:10px 0;'>Aucun rappel de prévu.</p>";
    return;
  }

  container.innerHTML = homeData.alerts.map(alert => {
    return `
      <div class="alert">
        <span class="date">${alert.date}</span>
        <strong>${alert.title}</strong>
        <p>${alert.text}</p>
      </div>
    `;
  }).join("");
}

function displayProfessionals() {
  const container = document.getElementById("professionals");
  if (!container) return;

  if (!homeData.professionals || homeData.professionals.length === 0) {
    container.innerHTML = "<p style='color:#77827a; font-size:13px; padding:10px 0;'>Aucun accès professionnel actif.</p>";
    return;
  }

  container.innerHTML = homeData.professionals.map(pro => {
    return `
      <div class="pro">
        <span class="access-active">${pro.access}</span>
        <strong>${pro.name}</strong>
        <p>${pro.domain} · accès jusqu'au ${pro.expires}</p>
      </div>
    `;
  }).join("");
}

// === MODALES ET AJOUTS ===

async function openSystem(systemId) {
  try {
    const response = await fetch(`/api/systems/${systemId}`);
    const system = await response.json();

    let equipmentHTML = "";
    if (system.equipment && system.equipment.length > 0) {
      equipmentHTML = system.equipment.map(item => {
        return `
          <div class="equipment">
            <strong>${item.name}</strong>
            <span>
              ${item.model ? item.model + " · " : ""}
              ${item.installed ? "Installé : " + item.installed : ""}
            </span>
          </div>
        `;
      }).join("");
    } else {
      equipmentHTML = `
        <div style="background:#f8f9f7; padding:20px; text-align:center; border-radius:12px; margin-top:10px;">
          <p style='color:#707a74; font-size:13px; margin:0 0 10px 0;'>Aucun équipement enregistré dans ce système.</p>
          <button class="button secondary" onclick="openAddEquipmentModal('${systemId}')">Ajouter mon premier équipement</button>
        </div>
      `;
    }

    const modalContent = document.getElementById("modal-content");
    modalContent.innerHTML = `
      <div class="eyebrow">${system.icon} SYSTÈME</div>
      <h2>${system.name}</h2>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
        <h3 style="margin:0;">Équipements</h3>
        ${system.equipment.length > 0 ? `<button class="button secondary" style="padding:4px 10px; font-size:12px;" onclick="openAddEquipmentModal('${systemId}')">+ Ajouter</button>` : ''}
      </div>
      ${equipmentHTML}
    `;

    openModal();
  } catch (error) {
    showMessage("Impossible d'ouvrir ce système.");
  }
}

function openAddMenu() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">ACTION RAPIDE</div>
    <h2>Que voulez-vous ajouter ?</h2>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <button class="button secondary" style="text-align:left; padding:16px;" onclick="openAddEquipmentModal()">
        ➕ <strong>Un équipement</strong><br>
        <small style="color:#6d7771;">Ajouter une pompe, une clim, un tableau...</small>
      </button>
    </div>
  `;
  openModal();
}

function openAddEquipmentModal(preselectedSystem = "") {
  const modalContent = document.getElementById("modal-content");
  const systemOptions = homeData.systems.map(sys => {
    const selected = sys.id === preselectedSystem ? "selected" : "";
    return `<option value="${sys.id}" ${selected}>${sys.name}</option>`;
  }).join("");

  modalContent.innerHTML = `
    <div class="eyebrow">NOUVEL ÉQUIPEMENT</div>
    <h2>Ajouter un appareil</h2>
    <form onsubmit="submitEquipment(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:15px;">
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Système concerné</label>
        <select id="form-sys-id" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce;">
          ${systemOptions}
        </select>
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Nom (ex: Pompe à chaleur) *</label>
        <input type="text" id="form-name" required style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce;">
      </div>
      <div>
        <label style="font-size:12px; font-weight:700; color:#59645d;">Modèle / Marque</label>
        <input type="text" id="form-model" style="width:100%; padding:10px; border-radius:10px; border:1px solid #cdd4ce;">
      </div>
      <button type="submit" class="button primary" style="margin-top:10px;">Enregistrer</button>
    </form>
  `;
  openModal();
}

async function submitEquipment(event) {
  event.preventDefault();
  const payload = {
    systemId: document.getElementById("form-sys-id").value,
    name: document.getElementById("form-name").value,
    model: document.getElementById("form-model").value
  };

  try {
    const response = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      closeModal();
      showMessage("Équipement ajouté !");
      init();
    }
  } catch (error) {
    showMessage("Erreur réseau.");
  }
}

function openQrSimulatorModal() {
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <div class="eyebrow">TEST SIMULATION QR CODE</div>
    <h2>Scanner en tant que...</h2>
    <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
      <a href="/" class="button secondary" style="text-decoration:none; text-align:center;">👤 Propriétaire</a>
      <a href="/?role=electricien" class="button secondary" style="text-decoration:none; text-align:center;">⚡ Électricien</a>
    </div>
  `;
  openModal();
}

function openPlan() {
  showMessage("Plan interactif à venir.");
}

function openModal() {
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

document.addEventListener("click", function(event) {
  const modal = document.getElementById("modal");
  if (event.target === modal) closeModal();
});

function showMessage(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

init();
