export class Container {
  constructor(id, currentItems, maxCapacity) {
    this.id = id;
    this.snapshotItems = currentItems;
    this.localDelta = 0;        
    this.maxCapacity = maxCapacity;
  }
  
  get currentItems() { return this.snapshotItems + this.localDelta; }
  get remainingCapacity() { return this.maxCapacity - this.currentItems; }
  get isFull() { return this.currentItems >= this.maxCapacity; }
  get fillPercent() { return Math.min(100, Math.max(0, Math.round((this.currentItems / this.maxCapacity) * 100))); }
}

export class QuotaManager {
  constructor(totalQuota, maxPerContainer, initialContainers = []) {
    this.totalQuota = totalQuota;
    this.maxPerContainer = maxPerContainer;
    this.containers = initialContainers;
  }
  
  get snapshotAllocated() {
    return this.containers.reduce((sum, c) => sum + c.snapshotItems, 0);
  }

  get sessionDelta() { return this.containers.reduce((sum, c) => sum + c.localDelta, 0); }
  get realAllocated() { return this.snapshotAllocated + this.sessionDelta; }
  get remainingQuota() { return this.totalQuota - this.realAllocated; }

  setTotalQuota(val) { this.totalQuota = Math.max(0, val); }
  setMaxPerContainer(val) { 
    this.maxPerContainer = Math.max(1, val);
    this.containers.forEach(c => c.maxCapacity = this.maxPerContainer);
  }

  commitChanges() {
    this.containers.forEach(c => {
      c.snapshotItems += c.localDelta;
      c.localDelta = 0;
    });
  }

  addContainer(id, initialItems = 0) {
    if (!id || id.trim() === '') throw new Error("Container ID cannot be empty");
    if (this.containers.some(x => x.id === id)) throw new Error(`Container "${id}" already exists`);
    
    const c = new Container(id.trim(), initialItems, this.maxPerContainer);
    this.containers.push(c);
    return c;
  }

  removeContainer(id) {
    this.containers = this.containers.filter(c => c.id !== id);
  }

  maxCanAdd(containerId) {
    const c = this.getContainer(containerId);
    return Math.max(0, Math.min(c.remainingCapacity, this.remainingQuota));
  }

  getBottleneck(containerId) {
    const c = this.getContainer(containerId);
    if (c.remainingCapacity <= 0) return 'container';
    if (this.remainingQuota <= 0) return 'quota';
    if (c.remainingCapacity <= this.remainingQuota) return 'container';
    return 'quota';
  }

  addItems(containerId, amount) {
    const c = this.getContainer(containerId);
    const canAdd = this.maxCanAdd(containerId);
    if (amount <= 0 || canAdd === 0) return false;
    
    c.localDelta += Math.min(amount, canAdd);
    return true;
  }

  removeItems(containerId, amount) {
    const c = this.getContainer(containerId);
    if (amount <= 0 || c.currentItems === 0) return false;
    
    c.localDelta -= Math.min(amount, c.currentItems);
    return true;
  }

  getEquationDetails(containerId) {
    const c = this.getContainer(containerId);
    const constraint1 = c.remainingCapacity;
    const constraint2 = this.remainingQuota;
    const result = Math.max(0, Math.min(constraint1, constraint2));
    
    return {
      maxPerContainer: this.maxPerContainer,
      currentItems: c.currentItems,
      constraint1,
      totalQuota: this.totalQuota,
      snapshotAllocated: this.snapshotAllocated,
      sessionDelta: this.sessionDelta,
      realAllocated: this.realAllocated,
      constraint2,
      result,
      bottleneck: this.getBottleneck(containerId),
    };
  }

  getContainer(id) {
    const c = this.containers.find(x => x.id === id);
    if (!c) throw new Error(`Container "${id}" not found`);
    return c;
  }
}
