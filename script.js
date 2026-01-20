const API_URL = "https://script.google.com/macros/s/AKfycbwaKu6Vq-K_tQ0mayBU44w0LK36OCiDcFa87HIADiHiqz1r2BkOpCbmHU36760H1r89/exec"; 
let products = [];
let currentProduct = null;
let currentFilter = "all";
let imageTemp = "";

window.onload = loadData;

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

function getStatus(p) {
    const total = Number(p.totalQty) || 0;
    const done = Number(p.completedQty) || 0;
    if (total > 0 && done >= total) return 'completed';
    if (!p.deadline) return 'active';
    
    // Date Logic
    const now = new Date(); now.setHours(0,0,0,0);
    const dLine = new Date(p.deadline); dLine.setHours(0,0,0,0);
    const diff = (dLine - now) / (1000 * 60 * 60 * 24);
    
    if (diff < 0) return 'pending'; // Overdue
    if (diff <= 3) return 'urgent'; // < 3 Days
    return 'active';
}

function getStatusColor(status) {
    if(status==='completed') return '#1976D2'; // Blue
    if(status==='urgent') return '#F57C00'; // Orange
    if(status==='pending') return '#D32F2F'; // Red
    return '#2F7D32'; // Green
}

async function loadData() {
    try {
        const res = await fetch(API_URL);
        products = await res.json();
        renderList();
        if (products.length > 0) openProduct(0); 
        else document.getElementById("emptyState").style.display = "block";
    } catch (e) {
        document.getElementById("navDeadline").innerHTML = "<span>Offline mode</span>";
    }
}

function renderList() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const list = document.getElementById("productList");
    list.innerHTML = "";

    const filtered = products.filter(p => {
        const matchesName = (p.name || "").toLowerCase().includes(query);
        const matchesFilter = currentFilter === "all" || getStatus(p) === currentFilter;
        return matchesName && matchesFilter;
    });

    filtered.forEach((p) => {
        const index = products.findIndex(x => x.id === p.id);
        const status = getStatus(p);
        const color = getStatusColor(status);
        
        const li = document.createElement("li");
        li.className = "order-item";
        li.onclick = () => { openProduct(index); toggleSidebar(); };
        li.innerHTML = `
            <div class="o-info">
                <h4>${p.name}</h4>
                <p>${p.company || 'Client'}</p>
            </div>
            <div class="status-dot" style="background:${color}"></div>
        `;
        list.appendChild(li);
    });
}

function openProduct(index) {
    currentProduct = products[index];
    document.getElementById("dashboard").style.display = "block";
    document.getElementById("emptyState").style.display = "none";

    // Text Data
    document.getElementById("dName").innerText = currentProduct.name;
    document.getElementById("dCompany").innerText = currentProduct.company || "Direct Client";
    document.getElementById("dCustomer").innerText = currentProduct.customer || "-";
    document.getElementById("dDeadline").innerText = currentProduct.deadline ? new Date(currentProduct.deadline).toLocaleDateString() : "No Date";
    
    // Status Badge
    const status = getStatus(currentProduct);
    const badge = document.getElementById("dStatusBadge");
    badge.innerText = status === 'pending' ? 'OVERDUE' : status.toUpperCase();
    badge.style.color = getStatusColor(status);
    badge.style.backgroundColor = getStatusColor(status) + '20'; // 20% opacity

    // Ticker Update
    const tick = document.getElementById("navDeadline");
    if(status === 'urgent') {
        tick.style.background = "#F57C00";
        tick.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>High Priority Order</span>`;
    } else if (status === 'pending') {
        tick.style.background = "#D32F2F";
        tick.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>Order Overdue</span>`;
    } else {
        tick.style.background = "#263238";
        tick.innerHTML = `<i class="fas fa-check-circle"></i> <span>Production Normal</span>`;
    }

    // Image
    const img = document.getElementById("dImage");
    const ph = document.getElementById("imgPlaceholder");
    if(currentProduct.imageURL) { img.src = currentProduct.imageURL; img.style.display="block"; ph.style.display="none"; }
    else { img.style.display="none"; ph.style.display="block"; }

    updateStats(status);
    renderSOP();
}

function updateStats(status) {
    const total = Number(currentProduct.totalQty) || 0;
    const done = Number(currentProduct.completedQty) || 0;
    const left = Math.max(0, total - done);
    const pct = total > 0 ? Math.round((done/total)*100) : 0;

    if(pct === 100 && status !== 'completed') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    document.getElementById("dQty").innerText = total;
    document.getElementById("completed").innerText = done;
    document.getElementById("leftUnits").innerText = left;
    document.getElementById("percent").innerText = pct + "%";

    // SVG Ring
    const circle = document.getElementById('progressPath');
    const offset = 283 - (pct / 100) * 283;
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = getStatusColor(status);

    // Target Logic
    const tCard = document.querySelector('.target-card');
    const tLabel = document.getElementById("targetLabel");
    const tVal = document.getElementById("dailyTargetVal");
    const tDays = document.getElementById("daysLeftVal");
    
    tCard.style.background = getStatusColor(status);
    
    if (status === 'completed') {
        tLabel.innerText = "ORDER STATUS";
        tVal.innerHTML = "DONE";
        tDays.innerText = "Production Complete";
    } else if (status === 'pending') {
        tLabel.innerText = "BACKLOG";
        tVal.innerHTML = left;
        tDays.innerText = "Schedule Overrun";
    } else {
        const now = new Date();
        const dLine = new Date(currentProduct.deadline);
        const days = Math.ceil((dLine - now)/(86400000));
        
        if (days > 0) {
            tLabel.innerText = "DAILY TARGET";
            tVal.innerHTML = Math.ceil(left/days);
            tDays.innerText = `${days} Days Remaining`;
        } else {
            tLabel.innerText = "DUE TODAY";
            tVal.innerHTML = left;
            tDays.innerText = "Final Day";
        }
    }
}

function renderSOP() {
    const list = document.getElementById("sopSteps");
    list.innerHTML = "";
    const steps = currentProduct.stepsJSON || [];
    document.getElementById("sopCount").innerText = `${steps.filter(s=>s.done).length}/${steps.length}`;

    steps.forEach((step, i) => {
        const div = document.createElement("div");
        div.className = `sop-item ${step.done ? 'done' : ''}`;
        div.innerHTML = `
            <div class="sop-left">
                <input type="checkbox" ${step.done ? "checked" : ""} onchange="toggleStep(${i})">
                <span>${step.name}</span>
            </div>
            <i class="fas fa-trash" style="color:#BDBDBD" onclick="removeStep(${i})"></i>
        `;
        list.appendChild(div);
    });
}

// Actions
async function saveProductAction() {
    const btn = document.getElementById("saveBtn");
    btn.innerText = "Saving...";
    const id = document.getElementById("editProductId").value;
    
    const payload = {
        action: id ? "edit" : "add",
        id: id || null,
        name: document.getElementById("pName").value,
        company: document.getElementById("pCompanyInput").value,
        customer: document.getElementById("pCustomer").value,
        salesperson: document.getElementById("pSalesperson").value,
        designer: document.getElementById("pDesigner").value,
        qty: Number(document.getElementById("pQty").value) || 0,
        orderDate: document.getElementById("pOrderDate").value,
        deadline: document.getElementById("pDeadline").value,
        image: imageTemp || (id && currentProduct ? currentProduct.imageURL : ""),
        steps: (id && currentProduct) ? currentProduct.stepsJSON : [],
        completedQty: (id && currentProduct) ? currentProduct.completedQty : 0
    };

    await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
    setTimeout(() => location.reload(), 1500);
}

async function addProduction() {
    const val = Number(document.getElementById("todayQty").value);
    if(val <= 0 || !currentProduct) return;
    currentProduct.completedQty = (Number(currentProduct.completedQty)||0) + val;
    document.getElementById("todayQty").value = "";
    updateStats(getStatus(currentProduct));
    await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({
        action: "update", id: currentProduct.id, completedQty: currentProduct.completedQty, steps: currentProduct.stepsJSON
    })});
}

async function toggleStep(i) {
    currentProduct.stepsJSON[i].done = !currentProduct.stepsJSON[i].done;
    renderSOP();
    await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({
        action: "update", id: currentProduct.id, completedQty: currentProduct.completedQty, steps: currentProduct.stepsJSON
    })});
}

async function addNewStep() {
    const val = document.getElementById("newStepName").value;
    if(!val) return;
    if(!currentProduct.stepsJSON) currentProduct.stepsJSON = [];
    currentProduct.stepsJSON.push({name: val, done: false});
    document.getElementById("newStepName").value = "";
    renderSOP();
    await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({
        action: "update", id: currentProduct.id, completedQty: currentProduct.completedQty, steps: currentProduct.stepsJSON
    })});
}

async function removeStep(i) {
    currentProduct.stepsJSON.splice(i, 1);
    renderSOP();
    await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({
        action: "update", id: currentProduct.id, completedQty: currentProduct.completedQty, steps: currentProduct.stepsJSON
    })});
}

async function deleteProductAction() {
    if(confirm("Delete this order?")) {
        fetch(API_URL, {method:"POST", mode:"no-cors", body:JSON.stringify({action:"delete", id:currentProduct.id})});
        location.reload();
    }
}

// Helper
function setFilter(f, btn) { currentFilter = f; document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active'); renderList(); }
function showForm() { document.getElementById("productForm").style.display = "flex"; }
function hideForm() { document.getElementById("productForm").style.display = "none"; }
function loadImage(e) { const r = new FileReader(); r.onload=()=>{imageTemp=r.result; document.getElementById("preview").src=imageTemp; document.getElementById("preview").style.display="block";}; if(e.target.files[0]) r.readAsDataURL(e.target.files[0]); }
function initNewProduct() { currentProduct=null; imageTemp=""; document.querySelectorAll("input").forEach(i=>i.value=""); document.getElementById("preview").style.display="none"; showForm(); }
function initEditCurrent() { if(!currentProduct) return; showForm(); document.getElementById("editProductId").value=currentProduct.id; document.getElementById("pName").value=currentProduct.name; document.getElementById("pCompanyInput").value=currentProduct.company; document.getElementById("pCustomer").value=currentProduct.customer; document.getElementById("pSalesperson").value=currentProduct.salesperson; document.getElementById("pDesigner").value=currentProduct.designer; document.getElementById("pQty").value=currentProduct.totalQty; if(currentProduct.orderDate) document.getElementById("pOrderDate").value=new Date(currentProduct.orderDate).toISOString().split('T')[0]; if(currentProduct.deadline) document.getElementById("pDeadline").value=new Date(currentProduct.deadline).toISOString().split('T')[0]; if(currentProduct.imageURL) { document.getElementById("preview").src=currentProduct.imageURL; document.getElementById("preview").style.display="block"; } }
