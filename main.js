import { Container, QuotaManager } from './QuotaManager.js';

let manager;
let activeContainerId = null;

document.addEventListener('DOMContentLoaded', () => {
  const initialContainers = [
    new Container('A', 10, 10),
    new Container('B', 8, 10),
    new Container('C', 2, 10),
  ];
  manager = new QuotaManager(50, 10, initialContainers);
  activeContainerId = manager.containers.length > 0 ? manager.containers[0].id : null;
  bindControlPanelEvents();
  bindMetricsEvents();
  bindContainerEvents();
  renderAll();
});

function bindControlPanelEvents() {
  document.querySelector('#ctrl-total').addEventListener('input', e => {
    manager.setTotalQuota(parseInt(e.target.value) || 0);
    renderAll();
  });

  document.querySelector('#ctrl-max').addEventListener('input', e => {
    manager.setMaxPerContainer(parseInt(e.target.value) || 0);
    renderAll();
  });

  document.querySelector('#btn-add-container').addEventListener('click', () => {
    const input = document.querySelector('#ctrl-new-id');
    const id = input.value.trim() || `Container ${manager.containers.length + 1}`;
    try {
      manager.addContainer(id, 0);
      activeContainerId = id;
      input.value = '';
      renderAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

function bindMetricsEvents() {
  document.querySelector('#btn-submit').addEventListener('click', () => {
    manager.commitChanges();
    renderAll();
  });
}

function bindContainerEvents() {
  document.querySelector('#containers-row').addEventListener('click', e => {
    const card = e.target.closest('.container-card');
    if (!card) return;

    const id = card.dataset.id;
    const btnAdd = e.target.closest('.btn-add');
    const btnRemove = e.target.closest('.btn-remove');
    const btnDelete = e.target.closest('.btn-delete');
    const input = e.target.closest('.item-input');

    if (btnDelete) {
      if (confirm(`Are you sure you want to delete container ${id}?`)) {
        manager.removeContainer(id);
        if (activeContainerId === id) {
          activeContainerId = manager.containers.length > 0 ? manager.containers[0].id : null;
        }
        renderAll();
      }
      return;
    }

    if (btnAdd) {
      const inputEl = card.querySelector('.item-input');
      manager.addItems(id, parseInt(inputEl.value) || 1);
      activeContainerId = id;
      renderAll();
      return;
    }

    if (btnRemove) {
      const inputEl = card.querySelector('.item-input');
      manager.removeItems(id, parseInt(inputEl.value) || 1);
      activeContainerId = id;
      renderAll();
      return;
    }

    if (input) return;

    // Select container if clicking anywhere else on the card
    activeContainerId = id;
    renderAll();
  });
}

function renderAll() {
  // Ensure an active container is always selected if possible
  if (!activeContainerId || !manager.containers.some(c => c.id === activeContainerId)) {
    activeContainerId = manager.containers.length > 0 ? manager.containers[0].id : null;
  }

  renderMetrics();
  renderEquation();
  renderContainers();
}

function renderMetrics() {
  document.querySelector('#m-total').textContent = manager.totalQuota;
  document.querySelector('#m-snapshot').textContent = manager.snapshotAllocated;

  const delta = manager.sessionDelta;
  const deltaEl = document.querySelector('#m-delta');
  deltaEl.textContent = (delta > 0 ? '+' : '') + delta;
  deltaEl.style.color = delta === 0 ? 'var(--text)' : 'var(--blue-btn)';

  document.querySelector('#m-remaining').textContent = manager.remainingQuota;
  document.querySelector('#btn-submit').disabled = delta === 0;
}

function renderEquation() {
  if (!activeContainerId || manager.containers.length === 0) return;

  const eq = manager.getEquationDetails(activeContainerId);

  document.querySelector('#eq-c1-max').textContent = eq.maxPerContainer;
  document.querySelector('#eq-c2-total').textContent = eq.totalQuota;
  document.querySelector('#eq-c1-result').textContent = eq.constraint1;
  document.querySelector('#eq-c2-result').textContent = eq.constraint2;
  document.querySelector('#eq-r1').textContent = eq.constraint1;
  document.querySelector('#eq-r2').textContent = eq.constraint2;
  document.querySelector('#eq-answer').textContent = eq.result;
}

function renderContainers() {
  const row = document.querySelector('#containers-row');
  row.innerHTML = manager.containers.map(c => {
    const canAdd = manager.maxCanAdd(c.id);
    const isActive = c.id === activeContainerId;

    const effectiveMax = c.currentItems + canAdd;
    const effectiveFillPercent = effectiveMax === 0 ? 0 : Math.min(100, Math.round((c.currentItems / effectiveMax) * 100));

    let status = 'ok';
    if (c.currentItems >= effectiveMax) status = 'full';
    else if (canAdd === 0) status = 'quota-limit';

    const overCapacityWarning = c.currentItems > QuotaManager.maxPerContainer 
      ? `<div class="over-capacity-tooltip">⚠️ Over Capacity! Reduce items.</div>` 
      : '';

    return `
      <div class="container-card ${isActive ? 'active' : ''}" data-id="${c.id}">
        ${overCapacityWarning}
        <div class="card-header">
          <span class="card-id">
            ${c.id}
            <button class="btn-delete" title="Delete Container">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </span>
          <span class="card-badge" data-status="${status}">
            ${status === 'full' ? 'full' : status === 'quota-limit' ? 'limit' : 'ok'}
          </span>
        </div>
        <div class="card-count">
           <strong>${c.currentItems}</strong> / ${effectiveMax} items
           ${c.localDelta !== 0 ? `<span style="color:var(--blue-btn); font-size: 12px; margin-left: 4px;">(${c.localDelta > 0 ? '+' : ''}${c.localDelta})</span>` : ''}
        </div>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${effectiveFillPercent}%" data-level="${status}"></div>
        </div>
        <div class="card-can-add">
          <span>Can Add: <strong>${canAdd}</strong></span>
        </div>
        <div class="card-controls">
          <input type="number" class="item-input" id="inp-${c.id}" min="1" max="${Math.max(1, canAdd)}" value="1" ${canAdd === 0 ? 'disabled' : ''} />
          <button class="btn-add" ${canAdd === 0 ? 'disabled' : ''}>+</button>
          <button class="btn-remove" ${c.currentItems === 0 ? 'disabled' : ''}>−</button>
        </div>
      </div>
    `;
  }).join('');
}

// Update Max Per Container dynamically
document.getElementById('ctrl-max').addEventListener('input', (e) => {
  const newVal = parseInt(e.target.value) || 0;
  QuotaManager.maxPerContainer = newVal;
  renderAll();
});

// Update Total Global Quota dynamically
document.getElementById('ctrl-total').addEventListener('input', (e) => {
  const newVal = parseInt(e.target.value) || 0;
  QuotaManager.globalTotalQuota = newVal;
  renderAll();
});
