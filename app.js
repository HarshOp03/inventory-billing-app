// StockPro - Inventory Management & Dashboard Core Script
document.addEventListener("DOMContentLoaded", () => {
  // --- APPLICATION STATE ---
  let products = [];
  let currentTheme = localStorage.getItem("theme") || "dark";

  // --- INITIALIZATION ---
  /**
   * Initializes the application state, loads data from localStorage or fallback mock data,
   * sets the current system date, initializes the theme, and verifies user session with the backend.
   */
  async function init() {
    // Load products from localStorage or fallback to bootstrap mock data
    if (localStorage.getItem("products")) {
      try {
        products = JSON.parse(localStorage.getItem("products"));
      } catch (e) {
        products = window.initialProducts ? [...window.initialProducts] : [];
      }
    } else if (window.initialProducts) {
      products = [...window.initialProducts];
      saveToStorage("products", products);
    }

    // Set system date to today
    const dateElem = document.getElementById("system-date");
    if (dateElem) {
      dateElem.textContent = new Date().toISOString().split("T")[0];
    }

    // Setup Theme
    setTheme(currentTheme);

    // Initial renders
    renderCategoryDropdowns();
    renderAll();
    setupEventListeners();

    // Check Authentication & Load live products from SQLite database
    if (window.StockProAuth) {
      const isAuthenticated = await window.StockProAuth.checkSession();
      if (isAuthenticated) {
        await loadProductsFromAPI();
      }
    }
  }

  /**
   * Fetches user products from SQLite database API and re-renders the views.
   */
  async function loadProductsFromAPI() {
    const token = window.StockProAuth ? window.StockProAuth.getToken() : null;
    if (!token) return;

    try {
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        products = data;
        saveToStorage("products", products);
        renderCategoryDropdowns();
        renderAll();
      }
    } catch (err) {
      console.warn("Could not connect to SQLite backend API, running with local data.", err);
    }
  }

  // --- STORAGE UTILITIES ---
  /**
   * Serializes JavaScript data into JSON and stores it in the browser's localStorage.
   * @param {string} key - The localStorage item key.
   * @param {*} data - The value or object to serialize and save.
   */
  function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Sets the visual theme across the application by updating the data-theme attribute on <html>.
   * @param {string} theme - The target theme ("dark" or "light").
   */
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme || "dark");
  }

  // --- RENDER DISPATCHER ---
  /**
   * Master render dispatcher that refreshes both Dashboard metrics and Inventory tables.
   */
  function renderAll() {
    renderDashboard();
    renderInventory();
  }

  // --- ROUTING / NAV SWITCHING ---
  /**
   * Handles SPA view/tab navigation (e.g. switching between "dashboard" and "inventory").
   * Updates visibility of sections, highlights active sidebar and mobile navigation items,
   * updates page titles, triggers view-specific renders, and closes the mobile drawer.
   * @param {string} targetId - The ID of the target section ("dashboard" or "inventory").
   */
  function switchTab(targetId) {
    // Hide all sections
    document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
    
    // Show target section
    const activeSec = document.getElementById(`section-${targetId}`);
    if (activeSec) activeSec.classList.add("active");

    // Manage sidebar items
    document.querySelectorAll(".sidebar-menu li").forEach(li => li.classList.remove("active"));
    const activeLi = document.querySelector(`.sidebar-menu li[data-target="${targetId}"]`);
    if (activeLi) activeLi.classList.add("active");

    // Manage mobile bottom nav items
    document.querySelectorAll(".mobile-bottom-nav .mobile-nav-btn").forEach(btn => btn.classList.remove("active"));
    const activeMobileBtn = document.querySelector(`.mobile-bottom-nav .mobile-nav-btn[data-target="${targetId}"]`);
    if (activeMobileBtn) activeMobileBtn.classList.add("active");

    // Update header texts
    const title = document.getElementById("current-section-title");
    const desc = document.getElementById("current-section-desc");
    
    const meta = {
      dashboard: ["Dashboard", "Real-time inventory overview & performance."],
      inventory: ["Inventory Management", "Track and manage stock levels, pricing, and reorder levels."]
    };

    if (meta[targetId] && title && desc) {
      title.textContent = meta[targetId][0];
      desc.textContent = meta[targetId][1];
    }

    // Routines when loading sections
    if (targetId === "dashboard") {
      renderDashboard();
    } else if (targetId === "inventory") {
      renderInventory();
    }

    // Auto-close mobile sidebar if open
    closeMobileSidebar();
    
    // Scroll window smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Mobile Drawer Controls
  /**
   * Opens the slide-out navigation sidebar drawer on mobile devices
   * and displays the semi-transparent backdrop overlay.
   */
  function openMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
  }

  /**
   * Closes the slide-out navigation sidebar drawer on mobile devices
   * and hides the backdrop overlay.
   */
  function closeMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");
  }

  // --- CATEGORY CACHING & DROPDOWN RENDER ---
  /**
   * Extracts unique product categories from the products array, sorts them alphabetically,
   * and populates the inventory filter dropdown while retaining the currently selected option.
   */
  function renderCategoryDropdowns() {
    const filterSelect = document.getElementById("inventory-filter-category");
    if (!filterSelect) return;

    const currentVal = filterSelect.value;
    const categories = [...new Set(products.map(p => p.category))].sort();
    
    filterSelect.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentVal) opt.selected = true;
      filterSelect.appendChild(opt);
    });
  }

  // --- 1. DASHBOARD COMPONENT RENDERER ---
  /**
   * Formats numeric amounts as Indian Rupees (₹) with en-IN numbering.
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Calculates dashboard summary statistics (total products, inventory valuation,
   * total stock units, low stock count), updates metric cards, renders the low stock
   * alert notification list, populates recent stock overview table rows, and calls drawCategoryChart().
   */
  function renderDashboard() {
    // Metrics calculation
    const totalProducts = products.length;
    const stockVal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStockCount = products.filter(p => p.stock <= p.reorderLevel).length;

    // Stat cards
    const prodCountElem = document.getElementById("stat-products-count");
    const stockValElem = document.getElementById("stat-stock-value");
    const totalStockElem = document.getElementById("stat-total-stock");
    const lowStockElem = document.getElementById("stat-low-stock");

    if (prodCountElem) prodCountElem.textContent = totalProducts;
    if (stockValElem) stockValElem.textContent = formatCurrency(stockVal);
    if (totalStockElem) totalStockElem.textContent = totalUnits.toLocaleString('en-US');
    if (lowStockElem) lowStockElem.textContent = lowStockCount;

    // Render Low Stock Warning List
    const alertList = document.getElementById("dashboard-low-stock-list");
    if (alertList) {
      alertList.innerHTML = "";
      const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);
      if (lowStockItems.length === 0) {
        alertList.innerHTML = '<li style="color: var(--text-muted); font-style: italic; text-align: center; padding: 24px 0;">All inventory stocks are healthy.</li>';
      } else {
        lowStockItems.slice(0, 5).forEach(p => {
          const li = document.createElement("li");
          li.style.display = "flex";
          li.style.justifyContent = "space-between";
          li.style.alignItems = "center";
          li.style.padding = "10px 12px";
          li.style.borderRadius = "var(--border-radius-sm)";
          li.style.backgroundColor = "rgba(245, 158, 11, 0.08)";
          li.style.borderLeft = "4px solid var(--color-warning)";
          
          li.innerHTML = `
            <div>
              <div style="font-weight: 600; font-size: 13px;">${escapeHTML(p.name)}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">SKU: ${escapeHTML(p.sku)}</div>
            </div>
            <div style="text-align: right;">
              <div class="badge badge-warning">${p.stock} units left</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Threshold: ${p.reorderLevel}</div>
            </div>
          `;
          alertList.appendChild(li);
        });
      }
    }

    // Render Stock Overview Table
    const overviewTbody = document.getElementById("dashboard-products-tbody");
    if (overviewTbody) {
      overviewTbody.innerHTML = "";
      if (products.length === 0) {
        overviewTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">No inventory records available. Click "Add Product" to get started.</td></tr>';
      } else {
        // Show up to 5 items in dashboard overview
        products.slice(0, 5).forEach(p => {
          const tr = document.createElement("tr");
          let badgeClass = "badge-success";
          let statusText = "In Stock";
          if (p.stock === 0) {
            badgeClass = "badge-danger";
            statusText = "Out of Stock";
          } else if (p.stock <= p.reorderLevel) {
            badgeClass = "badge-warning";
            statusText = "Low Stock Alert";
          }

          const productTotalValue = p.price * p.stock;

          tr.innerHTML = `
            <td style="font-family: monospace; font-weight: 600;">${escapeHTML(p.sku)}</td>
            <td><strong>${escapeHTML(p.name)}</strong></td>
            <td>${escapeHTML(p.category)}</td>
            <td>${formatCurrency(p.price)}</td>
            <td><strong>${p.stock}</strong></td>
            <td style="font-weight: 600; color: var(--color-primary);">${formatCurrency(productTotalValue)}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
          `;
          overviewTbody.appendChild(tr);
        });
      }
    }

    // Dynamic Category Chart rendering
    drawCategoryChart();
  }

  // --- DYNAMIC SVG CATEGORY VALUATION CHART ---
  /**
   * Generates and renders a responsive SVG bar chart visualizing inventory valuation by category.
   * Aggregates total stock value and units per category, sorts categories descending by value,
   * dynamically draws Y-axis gridlines/ticks, and draws colored bars with value and category labels.
   */
  function drawCategoryChart() {
    const chartWrapper = document.getElementById("category-chart-wrapper");
    if (!chartWrapper) return;
    
    chartWrapper.innerHTML = ""; // Clear wrapper
    
    // Group products by category and calculate total value
    const categoryTotals = {};
    products.forEach(p => {
      const cat = p.category || "Uncategorized";
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { category: cat, value: 0, units: 0 };
      }
      categoryTotals[cat].value += (p.price * p.stock);
      categoryTotals[cat].units += p.stock;
    });

    const data = Object.values(categoryTotals);
    if (data.length === 0) {
      chartWrapper.innerHTML = '<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-style: italic;">No inventory data to chart.</div>';
      return;
    }

    // Sort by value descending
    data.sort((a, b) => b.value - a.value);

    const maxVal = Math.max(...data.map(d => d.value), 100);

    // Setup SVG dimensions based on parent container
    const width = chartWrapper.clientWidth || 500;
    const height = chartWrapper.clientHeight || 280;
    const paddingLeft = 55;
    const paddingBottom = 45;
    const paddingTop = 20;
    const paddingRight = 25;
    
    const chartWidth = Math.max(width - paddingLeft - paddingRight, 100);
    const chartHeight = Math.max(height - paddingTop - paddingBottom, 100);

    let svgContent = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--color-primary)" />
            <stop offset="100%" stop-color="var(--color-secondary)" />
          </linearGradient>
        </defs>
    `;

    // Horizontal Gridlines & Y-Axis values
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const val = (maxVal / gridCount) * i;
      const y = chartHeight + paddingTop - (chartHeight / gridCount) * i;
      
      svgContent += `
        <line class="chart-grid-line" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />
        <text class="chart-text" x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end">₹${Math.round(val).toLocaleString('en-IN')}</text>
      `;
    }

    // Columns Bar Rendering
    const colCount = data.length;
    const colSpacing = chartWidth / colCount;
    const barWidth = Math.min(Math.max(colSpacing * 0.5, 14), 44);

    data.forEach((d, idx) => {
      const x = paddingLeft + (colSpacing * idx) + (colSpacing - barWidth) / 2;
      const barHeight = Math.max((d.value / maxVal) * chartHeight, 4);
      const y = chartHeight + paddingTop - barHeight;

      // Truncate category label if too long
      const maxChar = width < 450 ? 6 : 10;
      const shortLabel = d.category.length > maxChar ? d.category.substring(0, maxChar - 1) + '..' : d.category;

      // Draw Bar with title tooltip
      svgContent += `
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}">
          <title>${escapeHTML(d.category)}: ${formatCurrency(d.value)} (${d.units} units)</title>
        </rect>
        <text class="chart-text" x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-weight="600" font-size="10">₹${Math.round(d.value).toLocaleString('en-IN')}</text>
        <text class="chart-text" x="${x + barWidth / 2}" y="${chartHeight + paddingTop + 20}" text-anchor="middle">${escapeHTML(shortLabel)}</text>
      `;
    });

    svgContent += `</svg>`;
    chartWrapper.innerHTML = svgContent;
  }

  // --- 2. INVENTORY SECTION RENDERER ---
  /**
   * Renders the product inventory table with live client-side filtering.
   * Filters records by search keyword (name or SKU), category, and stock status
   * (all, in stock, low stock, out of stock), then generates table rows with edit and delete actions.
   */
  function renderInventory() {
    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const searchElem = document.getElementById("inventory-search");
    const catElem = document.getElementById("inventory-filter-category");
    const statusElem = document.getElementById("inventory-filter-status");

    const searchVal = searchElem ? searchElem.value.trim().toLowerCase() : "";
    const catVal = catElem ? catElem.value : "all";
    const statusVal = statusElem ? statusElem.value : "all";

    const filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || p.sku.toLowerCase().includes(searchVal);
      const matchCat = catVal === "all" || p.category === catVal;
      
      let matchStatus = true;
      if (statusVal === "low") {
        matchStatus = p.stock <= p.reorderLevel;
      } else if (statusVal === "instock") {
        matchStatus = p.stock > p.reorderLevel;
      } else if (statusVal === "out") {
        matchStatus = p.stock === 0;
      }

      return matchSearch && matchCat && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 24px;">No matching products found.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement("tr");
      
      let badgeClass = "badge-success";
      let statusText = "In Stock";
      if (p.stock === 0) {
        badgeClass = "badge-danger";
        statusText = "Out of Stock";
      } else if (p.stock <= p.reorderLevel) {
        badgeClass = "badge-warning";
        statusText = "Low Stock Alert";
      }

      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 600;">${escapeHTML(p.sku)}</td>
        <td><strong>${escapeHTML(p.name)}</strong></td>
        <td>${escapeHTML(p.category)}</td>
        <td style="font-weight: 600;">${formatCurrency(p.price)}</td>
        <td><strong>${p.stock}</strong> units</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn-icon edit-product-btn" data-id="${p.id}" title="Edit Product" aria-label="Edit Product">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-icon delete-product-btn" data-id="${p.id}" style="color: var(--color-danger);" title="Delete Product" aria-label="Delete Product">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- SAVE PRODUCT HANDLER ---
  /**
   * Processes the Add/Edit Product modal form submission.
   * Validates mandatory fields (Name, SKU, Category), enforces unique SKUs,
   * saves product to SQLite database when logged in (or localStorage fallback),
   * refreshes UI views, and closes the modal dialog.
   */
  async function saveProductHandler() {
    const idField = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value.trim();
    const sku = document.getElementById("product-sku").value.trim().toUpperCase();
    const category = document.getElementById("product-category").value.trim();
    const price = parseFloat(document.getElementById("product-price").value) || 0;
    const stock = parseInt(document.getElementById("product-stock").value) || 0;
    const reorder = parseInt(document.getElementById("product-reorder").value) || 0;

    if (!name || !sku || !category) {
      alert("Please fill out all mandatory product fields (Name, SKU, Category).");
      return;
    }

    const token = window.StockProAuth ? window.StockProAuth.getToken() : null;

    if (token) {
      try {
        const url = idField ? `/api/products/${idField}` : '/api/products';
        const method = idField ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, sku, category, price, stock, reorderLevel: reorder })
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Failed to save product to database.');
          return;
        }

        if (idField) {
          const idx = products.findIndex(p => p.id === idField);
          if (idx !== -1) products[idx] = data;
        } else {
          products.unshift(data);
        }
      } catch (err) {
        console.error("Database save error, saving locally:", err);
      }
    } else {
      // Local fallback
      if (idField) {
        const idx = products.findIndex(p => p.id === idField);
        if (idx !== -1) {
          if (products.some(p => p.sku === sku && p.id !== idField)) {
            alert("A different product already uses this SKU code. SKU must be unique.");
            return;
          }
          products[idx] = { id: idField, name, sku, category, price, stock, reorderLevel: reorder };
        }
      } else {
        if (products.some(p => p.sku === sku)) {
          alert("A product with this SKU code already exists. Please choose a unique SKU.");
          return;
        }
        const newId = "p_" + Date.now();
        products.push({ id: newId, name, sku, category, price, stock, reorderLevel: reorder });
      }
    }

    saveToStorage("products", products);
    renderCategoryDropdowns();
    renderAll();
    closeModal("modal-product");
  }

  // --- MODAL UTILITIES ---
  /**
   * Displays a modal overlay dialog by adding the "active" CSS class.
   * @param {string} modalId - The element ID of the modal dialog container.
   */
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  }

  /**
   * Hides an open modal overlay dialog by removing the "active" CSS class.
   * @param {string} modalId - The element ID of the modal dialog container.
   */
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  }

  // --- EVENT LISTENERS INITIALIZATION ---
  /**
   * Attaches all application event listeners including:
   * - Sidebar and mobile bottom navigation links
   * - Mobile navigation drawer toggle and backdrop dismiss
   * - Quick jump navigation buttons
   * - Modal close buttons and outside overlay click detection
   * - Product add / edit form triggers and submissions
   * - Live inventory search, category filters, and status filters
   * - Delegated table actions (edit product, delete product)
   * - Database backup export and JSON backup file import
   */
  function setupEventListeners() {
    // 1. Desktop Sidebar Navigation Clicks
    document.querySelectorAll(".sidebar-menu li").forEach(li => {
      li.addEventListener("click", (e) => {
        e.preventDefault();
        const target = li.getAttribute("data-target");
        if (target) switchTab(target);
      });
    });

    // 2. Mobile Bottom Navigation Clicks
    document.querySelectorAll(".mobile-bottom-nav .mobile-nav-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.getAttribute("data-target");
        if (target) switchTab(target);
      });
    });

    // 3. Mobile Hamburger Menu Toggle
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener("click", () => {
        openMobileSidebar();
      });
    }

    // 4. Mobile Close Drawer Button
    const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener("click", () => {
        closeMobileSidebar();
      });
    }

    // 5. Sidebar Backdrop Click
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", () => {
        closeMobileSidebar();
      });
    }

    // 6. Quick Jump links (e.g. View All in Dashboard)
    document.querySelectorAll(".nav-jump-btn").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.getAttribute("data-target");
        if (target) switchTab(target);
      });
    });


    // 8. Close Modal buttons
    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-modal");
        if (modalId) closeModal(modalId);
      });
    });

    // 9. Close modal when clicking outside modal-container
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("active");
        }
      });
    });

    // 10. Product Form Submission prevention
    const productForm = document.getElementById("product-form");
    if (productForm) {
      productForm.addEventListener("submit", (e) => e.preventDefault());
    }

    // 11. Add Product Trigger
    const btnAddProduct = document.getElementById("btn-add-product");
    if (btnAddProduct) {
      btnAddProduct.addEventListener("click", () => {
        if (productForm) productForm.reset();
        document.getElementById("product-id").value = "";
        document.getElementById("product-modal-title").textContent = "Add New Product";
        openModal("modal-product");
      });
    }

    // 12. Save Product Click
    const btnSaveProduct = document.getElementById("btn-save-product");
    if (btnSaveProduct) {
      btnSaveProduct.addEventListener("click", () => {
        saveProductHandler();
      });
    }

    // 13. Inventory Search & Filters
    const invSearch = document.getElementById("inventory-search");
    if (invSearch) invSearch.addEventListener("input", renderInventory);

    const invCatFilter = document.getElementById("inventory-filter-category");
    if (invCatFilter) invCatFilter.addEventListener("change", renderInventory);

    const invStatusFilter = document.getElementById("inventory-filter-status");
    if (invStatusFilter) invStatusFilter.addEventListener("change", renderInventory);

    // 14. Inventory Table Action Buttons (Edit / Delete)
    const invTbody = document.getElementById("inventory-tbody");
    if (invTbody) {
      invTbody.addEventListener("click", (e) => {
        const target = e.target.closest("button");
        if (!target) return;

        const prodId = target.getAttribute("data-id");
        if (target.classList.contains("edit-product-btn")) {
          const product = products.find(p => p.id === prodId);
          if (product) {
            document.getElementById("product-id").value = product.id;
            document.getElementById("product-name").value = product.name;
            document.getElementById("product-sku").value = product.sku;
            document.getElementById("product-category").value = product.category;
            document.getElementById("product-price").value = product.price;
            document.getElementById("product-stock").value = product.stock;
            document.getElementById("product-reorder").value = product.reorderLevel;
            
            document.getElementById("product-modal-title").textContent = "Edit Product Details";
            openModal("modal-product");
          }
        } else if (target.classList.contains("delete-product-btn")) {
          if (confirm("Are you sure you want to delete this product?")) {
            const token = window.StockProAuth ? window.StockProAuth.getToken() : null;
            if (token) {
              fetch(`/api/products/${prodId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              }).catch(err => console.error("Database delete error:", err));
            }
            products = products.filter(p => p.id !== prodId);
            saveToStorage("products", products);
            renderCategoryDropdowns();
            renderAll();
          }
        }
      });
    }

    // 15. Inventory Database Export
    const btnExport = document.getElementById("btn-export-db");
    if (btnExport) {
      btnExport.addEventListener("click", () => {
        const dbDump = {
          products,
          exportDate: new Date().toISOString(),
          version: "2.0"
        };
        
        const blob = new Blob([JSON.stringify(dbDump, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stockpro_inventory_backup_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // 16. Inventory Database Import
    const importInput = document.getElementById("import-file-input");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (imported.products && Array.isArray(imported.products)) {
              if (confirm("Importing backup data will replace your current inventory database. Continue?")) {
                const token = window.StockProAuth ? window.StockProAuth.getToken() : null;
                if (token) {
                  try {
                    const res = await fetch('/api/products/sync', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ products: imported.products })
                    });
                    const data = await res.json();
                    if (data.products) products = data.products;
                  } catch (syncErr) {
                    console.error("Failed to sync import with SQLite database:", syncErr);
                    products = imported.products;
                  }
                } else {
                  products = imported.products;
                }

                saveToStorage("products", products);
                renderCategoryDropdowns();
                renderAll();
                alert("Inventory database successfully imported!");
              }
            } else {
              alert("Invalid backup file format. Expected a JSON file with 'products' array.");
            }
          } catch (err) {
            alert("Error reading backup file: " + err.message);
          }
          importInput.value = "";
        };
        reader.readAsText(file);
      });
    }

    // 17. Listen for Auth Events (Login / Logout)
    window.addEventListener('auth:login', async () => {
      await loadProductsFromAPI();
    });

    window.addEventListener('auth:logout', () => {
      products = [];
      saveToStorage("products", products);
      renderCategoryDropdowns();
      renderAll();
    });
  }

  // --- UTILITY FUNCTIONS ---
  /**
   * Sanitizes text strings by escaping special HTML characters (&, <, >, ', ")
   * to protect against Cross-Site Scripting (XSS) when outputting dynamic content into innerHTML.
   * @param {string} str - Raw input string to escape.
   * @returns {string} Sanitized string safe for HTML injection.
   */
  function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // Window resize handler: redraw SVG chart responsively (debounced by 150ms)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const dashSection = document.getElementById("section-dashboard");
      if (dashSection && dashSection.classList.contains("active")) {
        drawCategoryChart();
      }
    }, 150);
  });

  // Start initialization
  init();
});
