let homeData = null;
let currentHomeId = null; 

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  currentHomeId = urlParams.get("id");

  if (!currentHomeId) {
    document.body.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:#f4f6f5;">
        <h2 style="font-family:sans-serif; color:#1e362d;">Veuillez scanner un QR Code HOME ID.</h2>
      </div>`;
    return;
  }

  // Vérification de la sécurité
  const activeSession = sessionStorage.getItem("homeid_session");
  
  if (activeSession === currentHomeId) {
    // Si l'utilisateur a rentré son mot de passe (ou vient de créer la maison), on charge !
    loadHomeData();
  } else {
    // Sinon, on bloque et on demande le mot de passe
    openLoginModal();
  }
}

// LE POPUP DE CONNEXION
function openLoginModal() {
  document.getElementById("modal-content").innerHTML = `
    <div class="eyebrow">SÉCURITÉ</div>
    <h2>Déverrouiller la maison</h2>
    <p style="font-size:13px; color:#77827a;">Entrez le mot de passe propriétaire pour accéder au carnet.</p>
    
    <form onsubmit="submitLogin(event)" style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
      <input type="password" id="login-password" required placeholder="Votre mot de passe" style="width:100%; padding:12px; border-radius:8px; border:1px solid #cdd4ce;">
      <button type="submit" class="button primary" style="padding:12px;">Accéder</button>
    </form>
    <div id="login-error" style="color:#d93025; font-size:13px; margin-top:15px; display:none; font-weight:bold;"></div>
  `;
  
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  
  // Désactiver la croix et le clic extérieur pour forcer la connexion
  modal.onclick = null; 
  const closeBtn = document.querySelector('.close');
  if (closeBtn) closeBtn.style.display = 'none'; 
}

async function submitLogin(event) {
  event.preventDefault();
  const password = document.getElementById("login-password").value;
  const errDiv = document.getElementById("login-error");

  try {
    const response = await fetch("/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentHomeId, password: password })
    });

    if (response.ok) {
      // Mot de passe correct : on enregistre la session et on ouvre
      sessionStorage.setItem("homeid_session", currentHomeId);
      document.getElementById("modal").classList.add("hidden");
      
      const closeBtn = document.querySelector('.close');
      if (closeBtn) closeBtn.style.display = 'block'; 
      
      loadHomeData();
    } else {
      errDiv.textContent = "Mot de passe incorrect.";
      errDiv.style.display = "block";
    }
  } catch (error) {
    errDiv.textContent = "Erreur serveur.";
    errDiv.style.display = "block";
  }
}

// CHARGEMENT RÉEL DES DONNÉES (l'ancien contenu de init)
async function loadHomeData() {
  try {
    const response = await fetch(`/api/home?id=${currentHomeId}`);
    if (!response.ok) throw new Error();
    
    homeData = await response.json();
    populateHouseInfo();
    displaySystems();
    displayAlerts();
    displayProfessionals();
  } catch (error) {
    showMessage("Impossible de charger HOME ID.");
  }
}
/* ============================================================
   INFORMATIONS DE LA MAISON
   ============================================================ */

function populateHouseInfo() {

  const name = document.getElementById("display-house-name");
  const id = document.getElementById("display-house-id");
  const year = document.getElementById("display-house-year");
  const surface = document.getElementById("display-house-surface");
  const land = document.getElementById("display-house-land");

  if (name) {
    name.textContent = homeData.name || "Ma Maison";
  }

  if (id) {
    id.textContent = `Maison #${homeData.id}`;
  }

  if (year) {
    year.textContent = homeData.year || "—";
  }

  if (surface) {
    surface.textContent =
      homeData.surface
        ? `${homeData.surface} m²`
        : "—";
  }

  if (land) {
    land.textContent =
      homeData.land
        ? `${homeData.land} m²`
        : "—";
  }

}


/* ============================================================
   BADGE UTILISATEUR
   ============================================================ */

function updateUserBadge(role) {

  const label =
    document.getElementById("user-role-label");

  if (!label) return;

  if (role === "electricien") {

    label.textContent =
      "Accès Électricien";

  } else if (role === "pisciniste") {

    label.textContent =
      "Accès Pisciniste";

  } else if (role === "clim") {

    label.textContent =
      "Accès Clim / Chauffage";

  } else {

    label.textContent =
      "Propriétaire";

  }

}


/* ============================================================
   AFFICHER LES SYSTÈMES
   ============================================================ */

function displaySystems() {

  const container =
    document.getElementById("systems");

  if (!container) return;

  const systems =
    homeData.systems || [];


  if (systems.length === 0) {

    container.innerHTML = `
      <p style="
        grid-column:1/-1;
        color:#77827a;
      ">
        Aucun système accessible.
      </p>
    `;

    return;
  }


  container.innerHTML =
    systems.map(system => {

      const equipmentCount =
        Number(system.equipment || 0);


      const equipmentHTML =
        equipmentCount > 0

          ? `
            <div style="
              font-size:11px;
              color:#77827a;
              margin-top:4px;
            ">
              ${equipmentCount}
              équipement${equipmentCount > 1 ? "s" : ""}
            </div>
          `

          : `
            <div style="
              font-size:11px;
              color:#a26b28;
              margin-top:4px;
            ">
              À configurer
            </div>
          `;


      return `
        <div
          class="system"
          onclick="openSystem('${system.id}')"
        >

          <div class="system-icon">
            ${system.icon || "🏠"}
          </div>

          <div class="system-name">
            ${escapeHTML(system.name)}
          </div>

          <div class="status ${system.color || "orange"}">

            <span class="dot"></span>

            ${escapeHTML(system.status || "À configurer")}

          </div>

          ${equipmentHTML}

        </div>
      `;

    }).join("");

}


/* ============================================================
   ALERTES / ENTRETIENS
   ============================================================ */

function displayAlerts() {

  const container =
    document.getElementById("alerts");

  if (!container) return;


  const alerts =
    homeData.alerts || [];


  if (alerts.length === 0) {

    container.innerHTML = `
      <p style="
        color:#77827a;
        font-size:13px;
      ">
        Aucun rappel de prévu.
      </p>
    `;

    return;
  }


  container.innerHTML =
    alerts.map(alert => `

      <div class="alert">

        <span class="date">
          ${escapeHTML(alert.date || "")}
        </span>

        <strong>
          ${escapeHTML(alert.title || "")}
        </strong>

        <p>
          ${escapeHTML(alert.text || "")}
        </p>

      </div>

    `).join("");

}


/* ============================================================
   PROFESSIONNELS
   ============================================================ */

function displayProfessionals() {

  const container =
    document.getElementById("professionals");

  if (!container) return;


  const professionals =
    homeData.professionals || [];


  if (professionals.length === 0) {

    container.innerHTML = `
      <p style="
        color:#77827a;
        font-size:13px;
      ">
        Aucun accès professionnel actif.
      </p>
    `;

    return;
  }


  container.innerHTML =
    professionals.map(pro => `

      <div class="pro">

        <span class="access-active">
          ${escapeHTML(pro.access || "Actif")}
        </span>

        <strong>
          ${escapeHTML(pro.name || "")}
        </strong>

        <p>
          ${escapeHTML(pro.domain || "")}
          ${pro.expires
            ? ` · accès jusqu'au ${escapeHTML(pro.expires)}`
            : ""
          }
        </p>

      </div>

    `).join("");

}


/* ============================================================
   OUVRIR UN SYSTÈME
   ============================================================ */

async function openSystem(systemId) {

  try {

    const response =
      await fetch(
        `/api/systems/${encodeURIComponent(systemId)}`
      );


    if (!response.ok) {

      throw new Error(
        "Système introuvable"
      );

    }


    const system =
      await response.json();


    let equipmentHTML = "";


    /* --------------------------------------------------------
       ÉQUIPEMENTS
       -------------------------------------------------------- */

    if (
      system.equipment &&
      system.equipment.length > 0
    ) {

      equipmentHTML =
        system.equipment.map(item => {

          let specsHTML = "";


          if (
            item.specs &&
            typeof item.specs === "object" &&
            Object.keys(item.specs).length > 0
          ) {

            specsHTML = `

              <div class="specs-grid">

                ${
                  Object.entries(item.specs)
                    .filter(([key, value]) => value)
                    .map(([key, value]) => `

                      <div class="spec-tag">

                        <strong>
                          ${escapeHTML(key)}
                        </strong>

                        :
                        ${escapeHTML(String(value))}

                      </div>

                    `)
                    .join("")
                }

              </div>

            `;

          }


          return `

            <div class="equipment-deep">

              <div class="equip-header">

                <strong>
                  ${escapeHTML(item.name)}
                </strong>

                <span class="equip-model">

                  ${
                    item.model
                      ? escapeHTML(item.model)
                      : "Modèle non précisé"
                  }

                </span>

              </div>


              ${specsHTML}


              <div class="equip-footer">

                Enregistré le :
                ${escapeHTML(item.installed || "—")}

              </div>

            </div>

          `;

        }).join("");

    } else {

      equipmentHTML = `

        <div style="
          background:#f8f9f7;
          padding:20px;
          text-align:center;
          border-radius:12px;
          margin-top:10px;
        ">

          <p style="
            color:#707a74;
            font-size:13px;
            margin:0 0 10px 0;
          ">
            Aucun équipement enregistré.
          </p>

        </div>

      `;

    }


    /* --------------------------------------------------------
       DOCUMENTS
       -------------------------------------------------------- */

    let documentsHTML = "";


    if (
      system.documents &&
      system.documents.length > 0
    ) {

      documentsHTML = `

        <h3 style="
          margin-top:25px;
        ">
          Documents
        </h3>

        <div>

          ${
            system.documents.map(document => `

              <div class="equipment-deep">

                📄
                ${escapeHTML(document.name || document)}

              </div>

            `).join("")
          }

        </div>

      `;

    }


    /* --------------------------------------------------------
       MODALE
       -------------------------------------------------------- */

    const modalContent =
      document.getElementById("modal-content");


    if (!modalContent) return;


    modalContent.innerHTML = `

      <div class="eyebrow">

        ${system.icon || "🏠"}
        SYSTÈME

      </div>


      <h2>
        ${escapeHTML(system.name)}
      </h2>


      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-top:20px;
        border-bottom:1px solid #e3e8e4;
        padding-bottom:10px;
        gap:10px;
      ">

        <h3 style="
          margin:0;
        ">
          Équipements
        </h3>


        <button
          class="button secondary"
          style="
            padding:4px 10px;
            font-size:12px;
          "
          onclick="openAddEquipmentModal('${system.id}')"
        >
          + Ajouter
        </button>

      </div>


      <div style="
        margin-top:15px;
      ">

        ${equipmentHTML}

      </div>


      ${documentsHTML}

    `;


    openModal();

  } catch (error) {

    console.error(error);

    showMessage(
      "Impossible d'ouvrir ce système."
    );

  }

}


/* ============================================================
   MENU AJOUT
   ============================================================ */

function openAddMenu() {

  document.getElementById(
    "modal-content"
  ).innerHTML = `

    <div class="eyebrow">
      ACTION RAPIDE
    </div>

    <h2>
      Que voulez-vous ajouter ?
    </h2>


    <div style="
      display:flex;
      flex-direction:column;
      gap:12px;
      margin-top:20px;
    ">


      <button
        class="button secondary"
        style="
          text-align:left;
          padding:16px;
        "
        onclick="openAddEquipmentModal()"
      >

        ➕
        <strong>
          Un équipement / appareil
        </strong>

        <br>

        <small style="
          color:#6d7771;
        ">
          Pompe, portail, climatisation,
          compteur...
        </small>

      </button>


      <button
        class="button secondary"
        style="
          text-align:left;
          padding:16px;
        "
        onclick="openAddAlertModal()"
      >

        📅
        <strong>
          Un entretien ou rappel
        </strong>

        <br>

        <small style="
          color:#6d7771;
        ">
          Ramonage, vidange,
          remplacement filtre...
        </small>

      </button>


      <button
        class="button secondary"
        style="
          text-align:left;
          padding:16px;
        "
        onclick="openImportModal()"
      >

        📄
        <strong>
          Un document
        </strong>

        <br>

        <small style="
          color:#6d7771;
        ">
          Facture, notice, garantie PDF...
        </small>

      </button>

    </div>

  `;


  openModal();

}


/* ============================================================
   AJOUT ÉQUIPEMENT
   ============================================================ */

function openAddEquipmentModal(
  preselectedSystem = ""
) {

  const systems =
    homeData.systems || [];


  const systemOptions =
    systems.map(sys => `

      <option
        value="${escapeHTML(sys.id)}"
        ${
          sys.id === preselectedSystem
            ? "selected"
            : ""
        }
      >
        ${escapeHTML(sys.name)}
      </option>

    `).join("");


  document.getElementById(
    "modal-content"
  ).innerHTML = `

    <div class="eyebrow">
      NOUVEL ÉQUIPEMENT
    </div>

    <h2>
      Ajouter un équipement
    </h2>


    <form
      onsubmit="submitEquipment(event)"
      style="
        display:flex;
        flex-direction:column;
        gap:15px;
        margin-top:15px;
      "
    >


      <div style="
        background:#f8f9f7;
        padding:15px;
        border-radius:12px;
        border:1px solid #e3e8e4;
      ">

        <label style="
          font-size:12px;
          font-weight:700;
          color:#59645d;
          display:block;
          margin-bottom:5px;
        ">
          Catégorie
        </label>


        <select
          id="form-sys-id"
          required
          style="
            width:100%;
            padding:10px;
            border-radius:8px;
            border:1px solid #cdd4ce;
          "
          onchange="renderDynamicFields()"
        >

          <option
            value=""
            disabled
            ${
              preselectedSystem
                ? ""
                : "selected"
            }
          >
            -- Choisissez une catégorie --
          </option>

          ${systemOptions}

        </select>

      </div>


      <div>

        <label style="
          font-size:12px;
          font-weight:700;
          color:#59645d;
          display:block;
          margin-bottom:5px;
        ">
          Nom de l'appareil *
        </label>

        <input
          type="text"
          id="form-name"
          placeholder="Ex : Pompe piscine"
          required
          style="
            width:100%;
            padding:10px;
            border-radius:8px;
            border:1px solid #cdd4ce;
          "
        >

      </div>


      <div>

        <label style="
          font-size:12px;
          font-weight:700;
          color:#59645d;
          display:block;
          margin-bottom:5px;
        ">
          Marque / Modèle
        </label>

        <input
          type="text"
          id="form-model"
          placeholder="Ex : Hayward"
          style="
            width:100%;
            padding:10px;
            border-radius:8px;
            border:1px solid #cdd4ce;
          "
        >

      </div>


      <div
        id="dynamic-fields-container"
        style="
          display:flex;
          flex-direction:column;
          gap:10px;
        "
      ></div>


      <button
        type="submit"
        class="button primary"
        style="
          margin-top:10px;
        "
      >
        Sauvegarder l'appareil
      </button>

    </form>

  `;


  openModal();


  if (preselectedSystem) {
    renderDynamicFields();
  }

}


/* ============================================================
   CHAMPS TECHNIQUES DYNAMIQUES
   ============================================================ */

function renderDynamicFields() {

  const select =
    document.getElementById("form-sys-id");

  const container =
    document.getElementById(
      "dynamic-fields-container"
    );


  if (!select || !container) return;


  const sysId =
    select.value;


  let html = "";


  /* ----------------------------------------------------------
     PISCINE
     ---------------------------------------------------------- */

  if (sysId === "piscine") {

    html = `

      <div style="
        border-left:3px solid #d18a35;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#d18a35;
        ">
          Fiche technique piscine
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <input
            type="text"
            data-key="Volume"
            placeholder="Volume (ex : 45 m³)"
            class="spec-input"
          >


          <select
            data-key="Traitement"
            class="spec-input"
          >

            <option value="">
              -- Traitement --
            </option>

            <option value="Électrolyse au sel">
              Au sel
            </option>

            <option value="Chlore">
              Chlore
            </option>

            <option value="Brome / UV">
              Brome / UV
            </option>

          </select>


          <select
            data-key="Filtre"
            class="spec-input"
          >

            <option value="">
              -- Filtre --
            </option>

            <option value="Sable / Verre">
              Sable / Verre
            </option>

            <option value="Cartouche">
              Cartouche
            </option>

          </select>


          <input
            type="text"
            data-key="Charge filtrante"
            placeholder="Ex : Verre 150 kg"
            class="spec-input"
          >

        </div>

      </div>

    `;

  }


  /* ----------------------------------------------------------
     CHAUFFAGE
     ---------------------------------------------------------- */

  else if (sysId === "chauffage") {

    html = `

      <div style="
        border-left:3px solid #d18a35;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#d18a35;
        ">
          Caractéristiques thermiques
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <select
            data-key="Énergie"
            class="spec-input"
          >

            <option value="">
              -- Énergie --
            </option>

            <option value="Gaz de ville">
              Gaz de ville
            </option>

            <option value="PAC / Électrique">
              PAC / Électrique
            </option>

            <option value="Bois / Granulés">
              Bois / Granulés
            </option>

            <option value="Fioul">
              Fioul
            </option>

          </select>


          <input
            type="text"
            data-key="Puissance"
            placeholder="Puissance (ex : 12 kW)"
            class="spec-input"
          >


          <select
            data-key="Diffusion"
            class="spec-input"
          >

            <option value="">
              -- Diffusion --
            </option>

            <option value="Plancher chauffant">
              Plancher chauffant
            </option>

            <option value="Radiateurs">
              Radiateurs
            </option>

            <option value="Air pulsé">
              Air pulsé
            </option>

          </select>

        </div>

      </div>

    `;

  }


  /* ----------------------------------------------------------
     ÉLECTRICITÉ
     ---------------------------------------------------------- */

  else if (sysId === "electricite") {

    html = `

      <div style="
        border-left:3px solid #4b9b69;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#4b9b69;
        ">
          Tableau électrique & réseau
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <select
            data-key="Phase"
            class="spec-input"
          >

            <option value="">
              -- Phase --
            </option>

            <option value="Monophasé">
              Monophasé
            </option>

            <option value="Triphasé">
              Triphasé
            </option>

          </select>


          <select
            data-key="Puissance souscrite"
            class="spec-input"
          >

            <option value="">
              -- Puissance --
            </option>

            <option value="6 kVA">
              6 kVA
            </option>

            <option value="9 kVA">
              9 kVA
            </option>

            <option value="12 kVA">
              12 kVA
            </option>

            <option value="36 kVA">
              36 kVA
            </option>

          </select>


          <select
            data-key="Type compteur"
            class="spec-input"
          >

            <option value="">
              -- Compteur --
            </option>

            <option value="Linky">
              Linky
            </option>

            <option value="Ancien électronique">
              Ancien électronique
            </option>

          </select>


          <input
            type="text"
            data-key="PDL / PRM"
            placeholder="N° PDL / PRM"
            class="spec-input"
          >

        </div>

      </div>

    `;

  }


  /* ----------------------------------------------------------
     EAU
     ---------------------------------------------------------- */

  else if (sysId === "eau") {

    html = `

      <div style="
        border-left:3px solid #4b9b69;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#4b9b69;
        ">
          Plomberie & traitement
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <select
            data-key="Type équipement"
            class="spec-input"
          >

            <option value="">
              -- Type --
            </option>

            <option value="Cumulus">
              Cumulus
            </option>

            <option value="Chauffe-eau thermodynamique">
              Chauffe-eau thermodynamique
            </option>

            <option value="Adoucisseur">
              Adoucisseur
            </option>

            <option value="Surpresseur">
              Surpresseur
            </option>

          </select>


          <input
            type="text"
            data-key="Capacité"
            placeholder="Ex : 200 L"
            class="spec-input"
          >


          <input
            type="text"
            data-key="Consommable"
            placeholder="Ex : Sel en pastilles"
            class="spec-input"
            style="grid-column:1/-1;"
          >

        </div>

      </div>

    `;

  }


  /* ----------------------------------------------------------
     CLIMATISATION
     ---------------------------------------------------------- */

  else if (sysId === "climatisation") {

    html = `

      <div style="
        border-left:3px solid #4b9b69;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#4b9b69;
        ">
          Génie climatique
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <select
            data-key="Type installation"
            class="spec-input"
          >

            <option value="">
              -- Type --
            </option>

            <option value="Split mural">
              Split mural
            </option>

            <option value="Gainable">
              Gainable
            </option>

            <option value="VMC double flux">
              VMC double flux
            </option>

          </select>


          <select
            data-key="Gaz réfrigérant"
            class="spec-input"
          >

            <option value="">
              -- Gaz --
            </option>

            <option value="R32">
              R32
            </option>

            <option value="R410A">
              R410A
            </option>

            <option value="R290">
              R290
            </option>

          </select>


          <select
            data-key="Réversible"
            class="spec-input"
          >

            <option value="">
              -- Réversible --
            </option>

            <option value="Oui">
              Oui (chaud / froid)
            </option>

            <option value="Non">
              Non
            </option>

          </select>

        </div>

      </div>

    `;

  }


  /* ----------------------------------------------------------
     EXTÉRIEUR
     ---------------------------------------------------------- */

  else if (sysId === "exterieur") {

    html = `

      <div style="
        border-left:3px solid #4b9b69;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#4b9b69;
        ">
          Aménagement & motorisation
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <select
            data-key="Installation"
            class="spec-input"
          >

            <option value="">
              -- Type --
            </option>

            <option value="Portail motorisé">
              Portail motorisé
            </option>

            <option value="Porte de garage">
              Porte de garage
            </option>

            <option value="Arrosage automatique">
              Arrosage automatique
            </option>

            <option value="Store banne">
              Store banne
            </option>

          </select>


          <select
            data-key="Alimentation"
            class="spec-input"
          >

            <option value="">
              -- Alimentation --
            </option>

            <option value="Secteur 230V">
              Secteur 230V
            </option>

            <option value="Solaire / Batterie">
              Solaire / Batterie
            </option>

          </select>


          <input
            type="text"
            data-key="Mécanisme"
            placeholder="Ex : Vérin, bras..."
            class="spec-input"
            style="grid-column:1/-1;"
          >

        </div>

      </div>

    `;

  }


  /* ----------------------------------------------------------
     RÉSEAU / DOMOTIQUE
     ---------------------------------------------------------- */

  else if (sysId === "domotique") {

    html = `

      <div style="
        border-left:3px solid #4b9b69;
        padding-left:10px;
      ">

        <h4 style="
          margin:0 0 10px;
          font-size:13px;
          color:#4b9b69;
        ">
          Réseau, domotique & sécurité
        </h4>


        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        ">

          <select
            data-key="Catégorie"
            class="spec-input"
          >

            <option value="">
              -- Catégorie --
            </option>

            <option value="Box Internet">
              Box Internet
            </option>

            <option value="Alarme">
              Alarme
            </option>

            <option value="Caméra">
              Caméra
            </option>

            <option value="Box domotique">
              Box domotique
            </option>

          </select>


          <select
            data-key="Protocole"
            class="spec-input"
          >

            <option value="">
              -- Protocole --
            </option>

            <option value="Wi-Fi">
              Wi-Fi
            </option>

            <option value="Zigbee">
              Zigbee
            </option>

            <option value="Z-Wave">
              Z-Wave
            </option>

            <option value="Filaire RJ45">
              Filaire RJ45
            </option>

          </select>


          <select
            data-key="Batterie secours"
            class="spec-input"
          >

            <option value="">
              -- Secours --
            </option>

            <option value="Oui">
              Oui
            </option>

            <option value="Non">
              Non
            </option>

          </select>


          <input
            type="text"
            data-key="Connectivité"
            placeholder="Ex : Fibre, 4G..."
            class="spec-input"
          >

        </div>

      </div>

    `;

  }


  container.innerHTML = html;

}


/* ============================================================
   SAUVEGARDE ÉQUIPEMENT
   ============================================================ */

async function submitEquipment(event) {

  event.preventDefault();


  const systemId =
    document.getElementById(
      "form-sys-id"
    ).value;


  const name =
    document.getElementById(
      "form-name"
    ).value.trim();


  const model =
    document.getElementById(
      "form-model"
    ).value.trim();


  const specs = {};


  document
    .querySelectorAll(".spec-input")
    .forEach(input => {

      if (input.value) {

        specs[
          input.getAttribute("data-key")
        ] = input.value;

      }

    });


  try {

    const response =
      await fetch(
        "/api/equipment",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            systemId,
            name,
            model,
            specs
          })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Impossible de sauvegarder."
      );

    }


    closeModal();

    showMessage(
      "Équipement enregistré avec succès."
    );


    await init();


  } catch (error) {

    console.error(error);

    showMessage(
      error.message ||
      "Erreur réseau."
    );

  }

}


/* ============================================================
   AJOUT D'UN RAPPEL
   ============================================================ */

function openAddAlertModal() {

  document.getElementById(
    "modal-content"
  ).innerHTML = `

    <div class="eyebrow">
      NOUVEAU RAPPEL
    </div>

    <h2>
      Programmer un entretien
    </h2>


    <form
      onsubmit="submitAlert(event)"
      style="
        display:flex;
        flex-direction:column;
        gap:12px;
        margin-top:15px;
      "
    >

      <input
        type="text"
        id="alert-title"
        placeholder="Titre : Ramonage, piscine..."
        required
        style="
          padding:10px;
          border-radius:8px;
          border:1px solid #cdd4ce;
        "
      >


      <input
        type="text"
        id="alert-text"
        placeholder="Action à effectuer"
        required
        style="
          padding:10px;
          border-radius:8px;
          border:1px solid #cdd4ce;
        "
      >


      <input
        type="text"
        id="alert-date"
        placeholder="Date : 15/10/2026"
        required
        style="
          padding:10px;
          border-radius:8px;
          border:1px solid #cdd4ce;
        "
      >


      <button
        type="submit"
        class="button primary"
      >
        Programmer
      </button>

    </form>

  `;


  openModal();

}


/* ============================================================
   SAUVEGARDE RAPPEL
   ============================================================ */

async function submitAlert(event) {

  event.preventDefault();


  const payload = {

    title:
      document.getElementById(
        "alert-title"
      ).value.trim(),

    text:
      document.getElementById(
        "alert-text"
      ).value.trim(),

    date:
      document.getElementById(
        "alert-date"
      ).value.trim()

  };


  try {

    const response =
      await fetch(
        "/api/alerts",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify(payload)
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Impossible d'ajouter le rappel."
      );

    }


    closeModal();

    showMessage(
      "Entretien programmé."
    );


    await init();


  } catch (error) {

    console.error(error);

    showMessage(
      error.message ||
      "Erreur réseau."
    );

  }

}


/* ============================================================
   IMPORT DOCUMENT
   ============================================================ */

function openImportModal() {

  document.getElementById(
    "modal-content"
  ).innerHTML = `

    <div class="eyebrow">
      BIBLIOTHÈQUE
    </div>

    <h2>
      Importer un document
    </h2>


    <div style="
      border:2px dashed #cdd4ce;
      border-radius:16px;
      padding:30px;
      text-align:center;
      background:#f8f9f7;
      margin-top:15px;
    ">

      <div style="
        font-size:36px;
        margin-bottom:10px;
      ">
        📄
      </div>


      <strong>
        Documents HOME ID
      </strong>


      <br>


      <small style="
        color:#7c867f;
      ">
        Factures, notices, garanties,
        plans...
      </small>


      <br><br>


      <button
        class="button primary"
        onclick="
          showMessage(
            'Import de documents : prochaine étape.'
          );
        "
      >
        Parcourir les fichiers
      </button>

    </div>

  `;


  openModal();

}


/* ============================================================
   PLAN
   ============================================================ */

function openPlan() {

  document.getElementById(
    "modal-content"
  ).innerHTML = `

    <div class="eyebrow">
      CARTOGRAPHIE
    </div>

    <h2>
      Plan de la maison
    </h2>


    <p style="
      color:#737c76;
      font-size:13px;
    ">
      Le plan deviendra la carte interactive
      de votre HOME ID.
    </p>


    <div style="
      height:300px;
      border:1px dashed #cdd4ce;
      border-radius:16px;
      display:grid;
      place-items:center;
      background:#f8f9f7;
      margin-top:20px;
      text-align:center;
    ">

      <div>

        <div style="
          font-size:42px;
          margin-bottom:12px;
        ">
          🗺️
        </div>

        <strong>
          Plan interactif
        </strong>

        <br>

        <small style="
          color:#7c867f;
        ">
          PDF / JPG / PNG
        </small>

      </div>

    </div>

  `;


  openModal();

}


/* ============================================================
   SIMULATEUR QR / ACCÈS ARTISANS
   ============================================================ */

function openQrSimulatorModal() {

  document.getElementById(
    "modal-content"
  ).innerHTML = `

    <div class="eyebrow">
      ACCÈS PROFESSIONNEL
    </div>

    <h2>
      Scanner en tant que...
    </h2>


    <div style="
      display:flex;
      flex-direction:column;
      gap:10px;
      margin-top:20px;
    ">


      <a
        href="/"
        class="button secondary"
        style="
          text-decoration:none;
          text-align:center;
        "
      >
        👤 Propriétaire
      </a>


      <a
        href="/?role=electricien"
        class="button secondary"
        style="
          text-decoration:none;
          text-align:center;
        "
      >
        ⚡ Électricien
      </a>


      <a
        href="/?role=pisciniste"
        class="button secondary"
        style="
          text-decoration:none;
          text-align:center;
        "
      >
        🏊 Pisciniste
      </a>


      <a
        href="/?role=clim"
        class="button secondary"
        style="
          text-decoration:none;
          text-align:center;
        "
      >
        ❄️ Clim / Chauffage
      </a>

    </div>

  `;


  openModal();

}


/* ============================================================
   MODALE
   ============================================================ */

function openModal() {

  const modal =
    document.getElementById("modal");

  if (modal) {
    modal.classList.remove("hidden");
  }

}


function closeModal() {

  const modal =
    document.getElementById("modal");

  if (modal) {
    modal.classList.add("hidden");
  }

}


document.addEventListener(
  "click",
  function(event) {

    const modal =
      document.getElementById("modal");

    if (
      modal &&
      event.target === modal
    ) {

      closeModal();

    }

  }
);


/* ============================================================
   MESSAGE TEMPORAIRE
   ============================================================ */

function showMessage(message) {

  const toast =
    document.getElementById("toast");

  if (!toast) return;


  toast.textContent =
    message;


  toast.classList.add("show");


  setTimeout(
    () => {

      toast.classList.remove("show");

    },
    2500
  );

}


/* ============================================================
   SÉCURITÉ AFFICHAGE
   ============================================================ */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* ============================================================
   DÉMARRAGE
   ============================================================ */

init();
