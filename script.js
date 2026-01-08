const API_URL = "https://script.google.com/macros/s/AKfycby1zcw0sm6xhGM9_3OsxHdC62QIcrXa8XmU3xfOhxhdmID7o8nNNGXjxREWGYRL7xn7/exec";
let products = [];
let currentProduct = null;
let imageTemp = "";

// Function to force the browser to show the organizational permission screen
function forceGoogleLogin() {
    window.open(API_URL, '_blank');
}

// Initial Data Load
async function loadData() {
    const statusText = document.getElementById("connectionStatus");
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Org Blocked");

        products = await response.json();
        renderList(products);
        
        if (products.length > 0) {
            const index = currentProduct ? products.findIndex(p => p.id === currentProduct.id) : 0;
            openProduct(index >= 0 ? index : 0);
        } else {
            showForm();
        }
        
        if(statusText) {
            statusText.innerText = "Connected: Akshay (plantables.store)";
            statusText.style.color = "#4caf50";
        }
        document.getElementById("authSection").style.display = "none";

    } catch (e) {
        console.error("Load Error:", e);
        if(statusText) {
            statusText.innerText = "Error: Click Login Below"; 
            statusText.style.color = "#f44336";
        }
        document.getElementById("authSection").style.display = "block";
    }
}

// Search Filtering Logic
function filterProducts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = products.filter(p => 
        (p.name && p.name.toLowerCase().includes(query)) || 
        (p.company && p.company.toLowerCase().includes(query))
    );
    renderList(filtered);
}

// UI RENDERING - Updated to handle search results
function renderList(productsToDisplay = products) {
    const list = document.getElementById("productList");
    list.innerHTML = "";
    productsToDisplay.forEach((p) => {
        const actualIndex = products.indexOf(p);
        const li = document.createElement("li");
        li.innerHTML = `<span style="flex:1; cursor:pointer;" onclick="openProduct(${actualIndex})">${p.name || 'Unnamed'}</span>`;
        list.appendChild(li);
    });
}

function openProduct(index) {
    currentProduct = products[index];
    document.getElementById("productForm").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    // Mapping to your 11 columns
    document.getElementById("dName").innerText = currentProduct.name || "";
    document.getElementById("dCompany").innerText = currentProduct.company || "N/A";
    document.getElementById("dCustomer").innerText = currentProduct.customer || "N/A";
    document.getElementById("dOrder").innerText = currentProduct.orderID || "N/A";
    document.getElementById("dOrderDate").innerText = currentProduct.orderDate || "N/A";
    document.getElementById("dDeadline").innerText = currentProduct.deadline || "N/A";
    document.getElementById("dQty").innerText = currentProduct.totalQty || 0;
    document.getElementById("dImage").src = currentProduct.imageURL || "";

    renderSOP();
    updateProgress();
}

function showForm() {
    document.getElementById("productForm").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
}

// ADD NEW PRODUCT (Workspace Resilient)
async function addProduct() {
    const btn = document.getElementById("saveBtn");
    const name = document.getElementById("pName").value;
    if(!name) return;

    btn.innerText = "Syncing with Org Cloud...";
    btn.disabled = true;

    const payload = {
        action: "add",
        name: name,
        company: document.getElementById("pCompany").value,
        customer: document.getElementById("pCustomer").value,
        order: document.getElementById("pOrder").value,
        orderDate: document.getElementById("pOrderDate").value,
        deadline: document.getElementById("pDeadline").value,
        qty: Number(document.getElementById("pQty").value),
        image: imageTemp 
    };

    try {
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors", 
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain" }
        });

        alert("Request sent to Company Sheet! Reloading...");
        setTimeout(loadData, 2000); 
    } catch (e) {
        alert("Domain Security Error: Ensure you have clicked the Sign-In button.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Product";
    }
}

// SOP / PROCESS STEPS
function renderSOP() {
    const container = document.getElementById("sopSteps");
    container.innerHTML = "";
    const steps = currentProduct.stepsJSON || [];
    
    steps.forEach((step, i) => {
        const div = document.createElement("div");
        div.className = `sop-step ${step.done ? 'completed' : ''}`;
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${step.done ? "checked" : ""} onchange="toggleStep(${i})">
                <span>${step.name}</span>
            </div>
            <button class="delete-step" onclick="removeStep(${i})">×</button>
        `;
        container.appendChild(div);
    });
    updateProcessBar();
}

async function addNewStep() {
    const input = document.getElementById("newStepName");
    if (!input.value) return;
    if (!currentProduct.stepsJSON) currentProduct.stepsJSON = [];
    
    currentProduct.stepsJSON.push({ name: input.value, done: false });
    input.value = "";
    renderSOP();
    await syncToCloud();
}

async function removeStep(i) {
    if(confirm("Remove this process?")) {
        currentProduct.stepsJSON.splice(i, 1);
        renderList(products);
        renderSOP();
        await syncToCloud();
    }
}

async function toggleStep(i) {
    currentProduct.stepsJSON[i].done = !currentProduct.stepsJSON[i].done;
    renderSOP();
    await syncToCloud();
}

function updateProcessBar() {
    const steps = currentProduct.stepsJSON || [];
    const total = steps.length;
    const done = steps.filter(s => s.done).length;
    const p = total ? Math.round((done / total) * 100) : 0;
    const fill = document.getElementById("processFill");
    if(fill) {
        fill.style.width = p + "%";
        fill.innerText = p + "%";
    }
}

// PRODUCTION QTY
async function addProduction() {
    const input = document.getElementById("todayQty");
    const val = Number(input.value);
    if (val <= 0) return;
    
    currentProduct.completedQty = (Number(currentProduct.completedQty) || 0) + val;
    if (currentProduct.completedQty > currentProduct.totalQty) 
        currentProduct.completedQty = currentProduct.totalQty;
        
    updateProgress();
    input.value = "";
    await syncToCloud();
}

function updateProgress() {
    const c = Number(currentProduct.completedQty) || 0;
    const t = Number(currentProduct.totalQty) || 1;
    const p = Math.round((c / t) * 100);
    
    document.getElementById("completed").innerText = c;
    document.getElementById("remaining").innerText = Math.max(0, t - c);
    document.getElementById("percent").innerText = p + "%";
    
    const fill = document.getElementById("progressFill");
    if(fill) {
        fill.style.width = p + "%";
        fill.innerText = p + "%";
    }
}

// CLOUD SYNC
async function syncToCloud() {
    if (!currentProduct) return;
    try {
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                action: "update",
                id: currentProduct.id,
                completedQty: currentProduct.completedQty,
                steps: currentProduct.stepsJSON
            }),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
    } catch (e) { 
        console.error("Sync Error:", e); 
    }
}

function loadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { 
        imageTemp = reader.result; 
        document.getElementById("preview").src = imageTemp; 
    };
    reader.readAsDataURL(file);
}

window.onload = loadData;