let homeData = null;

async function init() {
  try {
    const response = await fetch("/api/home");

    if (!response.ok) {
      throw new Error("Impossible de récupérer la maison");
    }

    homeData = await response.json();

    displaySystems();
    displayAlerts();
    displayProfessionals();

  } catch (error) {
    console.error(error);
    showMessage("Impossible de charger HOME ID.");
  }
}


function displaySystems() {
  const container = document.getElementById("systems");

  if (!container) return;

  container.innerHTML = homeData.systems.map(system => {

    return `
      <div
        class="system"
        onclick="openSystem('${system.id}')"
      >

        <div class="system-icon">
          ${system.icon}
        </div>

        <div class="system-name">
          ${system.name}
        </div>

        <div class="status ${system.color}">
          <span class="dot"></span>
          ${system.status}
        </div>

      </div>
    `;

  }).join("");
}


function displayAlerts() {
  const container = document.getElementById("alerts");

  if (!container) return;

  container.innerHTML = homeData.alerts.map(alert => {

    return `
      <div class="alert">

        <span class="date">
          ${alert.date}
        </span>

        <strong>
          ${alert.title}
        </strong>

        <p>
          ${alert.text}
        </p>

      </div>
    `;

  }).join("");
}


function displayProfessionals() {
  const container = document.getElementById("professionals");

  if (!container) return;

  container.innerHTML = homeData.professionals.map(pro => {

    return `
      <div class="pro">

        <span class="access-active">
          ${pro.access}
        </span>

        <strong>
          ${pro.name}
        </strong>

        <p>
          ${pro.domain}
          · accès jusqu'au
          ${pro.expires}
        </p>

      </div>
    `;

  }).join("");
}


async function openSystem(systemId) {

  try {

    const response =
      await fetch(`/api/systems/${systemId}`);

    if (!response.ok) {
      throw new Error("Système introuvable");
    }

    const system = await response.json();

    let equipmentHTML = "";

    if (
      system.equipment &&
      system.equipment.length > 0
    ) {

      equipmentHTML = system.equipment.map(item => {

        return `
          <div class="equipment">

            <strong>
              ${item.name}
            </strong>

            <span>

              ${item.model
                ? item.model + " · "
                : ""
              }

              ${item.installed
                ? "Installé le " + item.installed
                : ""
              }

              ${item.warranty
                ? " · Garantie " + item.warranty
                : ""
              }

            </span>

          </div>
        `;

      }).join("");

    } else {

      equipmentHTML =
        "<p>Aucun équipement enregistré.</p>";

    }


    let documentsHTML = "";

    if (
      system.documents &&
      system.documents.length > 0
    ) {

      documentsHTML = system.documents.map(document => {

        return `
          <div class="equipment">
            📄 ${document}
          </div>
        `;

      }).join("");

    } else {

      documentsHTML =
        "<p>Aucun document.</p>";

    }


    const modalContent =
      document.getElementById("modal-content");


    modalContent.innerHTML = `

      <div class="eyebrow">
        ${system.icon} SYSTÈME
      </div>

      <h2>
        ${system.name}
      </h2>

      <p style="
        color:#737c76;
        font-size:13px;
      ">

        Dernier entretien :
        ${system.lastMaintenance || "—"}

        <br>

        Prochain entretien :
        ${system.nextMaintenance || "—"}

      </p>

      <h3>
        Équipements
      </h3>

      ${equipmentHTML}

      <h3>
        Documents
      </h3>

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


function openPlan() {

  const modalContent =
    document.getElementById("modal-content");

  modalContent.innerHTML = `

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

      Cette fonctionnalité sera l'une
      des prochaines grandes fonctions
      de HOME ID.

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

          Import PDF / JPG / PNG

          <br>

          puis positionnement
          des équipements.

        </small>

      </div>

    </div>

  `;

  openModal();
}


function openModal() {

  const modal =
    document.getElementById("modal");

  modal.classList.remove("hidden");
}


function closeModal() {

  const modal =
    document.getElementById("modal");

  modal.classList.add("hidden");
}


document.addEventListener(
  "click",
  function(event) {

    const modal =
      document.getElementById("modal");

    if (event.target === modal) {
      closeModal();
    }

  }
);


function showMessage(message) {

  const toast =
    document.getElementById("toast");

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);
}


init();