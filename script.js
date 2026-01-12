const API_URL = "https://script.google.com/macros/s/AKfycbwaKu6Vq-K_tQ0mayBU44w0LK36OCiDcFa87HIADiHiqz1r2BkOpCbmHU36760H1r89/exec";
let products = [];
let currentProduct = null;
let imageTemp = "";

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString('en-GB');
}

async function loadData() {
    const statusText = document.getElementById("connectionStatus");
    try {
        const response = await fetch(API_URL);
        products = await response.json();
        renderList(products);
        if (products.length > 0) openProduct(0); else initNewProduct();
        statusText.innerText = "● System Online";
        statusText.style.color = "#2F7D32";
    } catch (e) {
        statusText.innerText = "● System Offline";
        statusText.style.color = "#d32f2f";
    }
}

function getStatus(p) {
    const total = Number(p.totalQty) || 0;
    const done = Number(p.completedQty) || 0;
    if (done >= total && total > 0) return 'completed';
    if (!p.deadline) return 'active';
    const diff = (new Date(p.deadline) - new Date()) / (86400000);
    return diff < 3 ? 'urgent' : 'active';
}

function filterProducts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const statusVal = document.getElementById("statusFilter").value;
    const filtered = products.filter(p => {
        const nameMatch = (p.name || "").toLowerCase().includes(query);
        const companyMatch = (p.company || "").toLowerCase().includes(query);
        const statusMatch = statusVal === "all" || getStatus(p) === statusVal;
        return (nameMatch || companyMatch) && statusMatch;
    });
    renderList(filtered);
}

function renderList(productsToDisplay) {
    const list = document.getElementById("productList");
    list.innerHTML = "";
    productsToDisplay.forEach((p) => {
        const globalIndex = products.findIndex(item => item.id === p.id);
        const status = getStatus(p);
        const li = document.createElement("li");
        li.className = `sidebar-item ${currentProduct && currentProduct.id === p.id ? 'active' : ''}`;
        li.innerHTML = `
            <div onclick="openProduct(${globalIndex})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; font-size:13px;">${p.name || 'Untitled'}</span>
                    <span class="badge badge-${status}" style="width:8px; height:8px; border-radius:50%; padding:0;"></span>
                </div>
                <div style="font-size:11px; color:#666; margin-top:2px;">${p.company || 'Direct Client'}</div>
            </div>
        `;
        list.appendChild(li);
    });
}

function openProduct(index) {
    currentProduct = products[index];
    document.getElementById("productForm").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    document.getElementById("sidebar").classList.remove("open");

    document.getElementById("dName").innerText = currentProduct.name;
    const status = getStatus(currentProduct);
    const badge = document.getElementById("dStatusBadge");
    badge.className = `badge badge-${status}`;
    badge.innerText = status;

    document.getElementById("dCompany").innerText = currentProduct.company || "Direct Client";
    document.getElementById("dCustomer").innerText = currentProduct.customer || "N/A";
    document.getElementById("dSalesperson").innerText = currentProduct.salesperson || "N/A";
    document.getElementById("dDesigner").innerText = currentProduct.designer || "N/A";
    document.getElementById("dOrderDate").innerText = formatDate(currentProduct.orderDate);
    document.getElementById("dDeadline").innerText = formatDate(currentProduct.deadline);
    document.getElementById("dQty").innerText = currentProduct.totalQty || 0;
    document.getElementById("dImage").src = currentProduct.imageURL || "";

    const navD = document.getElementById("navDeadline");
    if (currentProduct.deadline) {
        const days = Math.ceil((new Date(currentProduct.deadline) - new Date()) / (86400000));
        navD.innerText = days < 0 ? `Late by ${Math.abs(days)}d` : `${days} days left`;
        navD.style.background = days < 3 ? "#d32f2f" : "rgba(255,255,255,0.15)";
    }

    renderSOP();
    updateProgress();
    renderList(products);
}

function updateProgress() {
    if(!currentProduct) return;
    const total = Number(currentProduct.totalQty) || 0;
    const done = Number(currentProduct.completedQty) || 0;
    const left = total - done;
    let p = total > 0 ? Math.round((done / total) * 100) : 0;
    p = Math.min(p, 100); 

    document.getElementById("completed").innerText = done;
    document.getElementById("leftUnits").innerText = left > 0 ? left : 0;
    document.getElementById("percent").innerText = p + "%";
    
    const fill = document.getElementById("prodFill");
    fill.style.width = p + "%";
    fill.innerText = p + "%";
}

function renderSOP() {
    const container = document.getElementById("sopSteps");
    container.innerHTML = "";
    const steps = currentProduct.stepsJSON || [];
    steps.forEach((step, i) => {
        const div = document.createElement("div");
        div.className = `sop-step ${step.done ? 'completed' : ''}`;
        div.innerHTML = `
            <span><input type="checkbox" ${step.done ? "checked" : ""} onchange="toggleStep(${i})"> ${step.name}</span>
            <button onclick="removeStep(${i})" style="background:none; color:#ccc; border:none; cursor:pointer;">×</button>
        `;
        container.appendChild(div);
    });
    
    let p = steps.length ? Math.round((steps.filter(s => s.done).length / steps.length) * 100) : 0;
    p = Math.min(p, 100);
    const sFill = document.getElementById("processFill");
    sFill.style.width = p + "%";
    sFill.innerText = p > 10 ? p + "%" : "";
}

// FIXED: Save Product now avoids "Error" by ensuring payload is safe
async function saveProductAction() {
    const btn = document.getElementById("saveBtn");
    const editId = document.getElementById("editProductId").value;
    
    if (!document.getElementById("pName").value) {
        alert("Product Name is required!");
        return;
    }

    btn.innerText = "⏱ Saving...";
    btn.disabled = true;

    try {
        const payload = {
            action: editId ? "edit" : "add",
            id: editId || null,
            name: document.getElementById("pName").value,
            company: document.getElementById("pCompanyInput").value,
            customer: document.getElementById("pCustomer").value,
            salesperson: document.getElementById("pSalesperson").value,
            designer: document.getElementById("pDesigner").value,
            qty: Number(document.getElementById("pQty").value) || 0,
            orderDate: document.getElementById("pOrderDate").value,
            deadline: document.getElementById("pDeadline").value,
            image: imageTemp || (editId && currentProduct ? currentProduct.imageURL : ""),
            steps: (editId && currentProduct) ? currentProduct.stepsJSON : [],
            completedQty: (editId && currentProduct) ? currentProduct.completedQty : 0
        };

        await fetch(API_URL, { 
            method: "POST", 
            mode: "no-cors", 
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload) 
        });

        btn.innerText = "✅ Saved!";
        setTimeout(() => location.reload(), 1500);
    } catch (error) {
        console.error("Save Error:", error);
        btn.innerText = "❌ Network Error";
        btn.disabled = false;
    }
}

// NEW: Delete Product Action
async function deleteProductAction() {
    if (!currentProduct) return;
    const confirmDelete = confirm(`Are you sure you want to delete "${currentProduct.name}"?`);
    if (!confirmDelete) return;

    const statusText = document.getElementById("connectionStatus");
    statusText.innerText = "● Deleting...";

    try {
        await fetch(API_URL, { 
            method: "POST", 
            mode: "no-cors", 
            body: JSON.stringify({ action: "delete", id: currentProduct.id }) 
        });
        alert("Product deleted.");
        location.reload();
    } catch (error) {
        alert("Error deleting product.");
        statusText.innerText = "● Delete Failed";
    }
}

function initNewProduct() {
    currentProduct = null;
    imageTemp = "";
    document.getElementById("formTitle").innerText = "Add New Product";
    document.getElementById("editProductId").value = "";
    
    document.getElementById("pName").value = "";
    document.getElementById("pCompanyInput").value = "";
    document.getElementById("pCustomer").value = "";
    document.getElementById("pSalesperson").value = "";
    document.getElementById("pDesigner").value = "";
    document.getElementById("pQty").value = "";
    document.getElementById("pOrderDate").value = "";
    document.getElementById("pDeadline").value = "";
    document.getElementById("imageInput").value = "";
    document.getElementById("preview").src = "";
    
    showForm();
}

function initEditCurrent() {
    if(!currentProduct) return;
    showForm();
    document.getElementById("formTitle").innerText = "Edit Product Details";
    document.getElementById("editProductId").value = currentProduct.id;
    document.getElementById("pName").value = currentProduct.name || "";
    document.getElementById("pCompanyInput").value = currentProduct.company || "";
    document.getElementById("pCustomer").value = currentProduct.customer || "";
    document.getElementById("pSalesperson").value = currentProduct.salesperson || "";
    document.getElementById("pDesigner").value = currentProduct.designer || "";
    document.getElementById("pQty").value = currentProduct.totalQty || 0;
    
    if(currentProduct.orderDate) {
        const oDate = new Date(currentProduct.orderDate);
        document.getElementById("pOrderDate").value = oDate.toISOString().split('T')[0];
    }
    
    if(currentProduct.deadline) {
        const date = new Date(currentProduct.deadline);
        document.getElementById("pDeadline").value = date.toISOString().split('T')[0];
    }
    document.getElementById("preview").src = currentProduct.imageURL || "";
}

async function addProduction() {
    const input = document.getElementById("todayQty");
    const val = Number(input.value);
    if (val <= 0 || !currentProduct) return;
    currentProduct.completedQty = (Number(currentProduct.completedQty) || 0) + val;
    input.value = "";
    updateProgress();
    await syncToCloud();
}

async function syncToCloud() {
    if(!currentProduct) return;
    await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ 
        action: "update", id: currentProduct.id, completedQty: currentProduct.completedQty, steps: currentProduct.stepsJSON 
    }) });
}

async function toggleStep(i) { currentProduct.stepsJSON[i].done = !currentProduct.stepsJSON[i].done; renderSOP(); await syncToCloud(); }
async function addNewStep() { 
    const val = document.getElementById("newStepName").value;
    if(!val || !currentProduct) return;
    if(!currentProduct.stepsJSON) currentProduct.stepsJSON = [];
    currentProduct.stepsJSON.push({name: val, done: false});
    document.getElementById("newStepName").value = "";
    renderSOP(); await syncToCloud();
}
async function removeStep(i) { currentProduct.stepsJSON.splice(i, 1); renderSOP(); await syncToCloud(); }

function showForm() { 
    document.getElementById("productForm").style.display = "block"; 
    document.getElementById("dashboard").style.display = "none"; 
    document.getElementById("sidebar").classList.remove("open");
}
function hideForm() { 
    document.getElementById("productForm").style.display = "none"; 
    if (currentProduct) {
        document.getElementById("dashboard").style.display = "block"; 
    } else if (products.length > 0) {
        openProduct(0);
    }
}
function loadImage(e) {
    const reader = new FileReader();
    reader.onload = () => { imageTemp = reader.result; document.getElementById("preview").src = imageTemp; };
    if(e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
}
function exportToPDF() { window.print(); }
window.onload = loadData;
